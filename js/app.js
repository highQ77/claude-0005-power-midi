const STEP = Tone.Transport.PPQ / 4;
const COLORS = ['#f97362', '#fbbf24', '#34d399', '#60a5fa', '#c084fc', '#f472b6', '#2dd4bf', '#a3e635'];
const ROLE_LABEL = { drums: '鼓組', bass: '貝斯', chords: '和弦', pad: '鋪底', melody: '旋律', arp: '琶音', lead: 'Lead', wobble: 'Wobble', acid: 'Acid', sub: '808', stab: 'Stab', pluck: 'Pluck', chip: 'Chip' };
const MODE_LABEL = { major: '大調', minor: '小調', dorian: 'Dorian' };
const STYLE_LABEL = { acoustic: '原聲', electronic: '電子', lofi: 'Lo-fi', orchestral: '管弦' };
const STORE_KEY = 'midi-workbench-v1';

const state = { bpm: 110, bars: 8, root: 0, mode: 'major', style: 'acoustic', prog: [0, 4, 5, 3], tracks: [], selectedId: null };
const rt = new Map();
let parts = [];
let seekStep = 0;
const undoStack = [], redoStack = [];

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const byId = id => state.tracks.find(t => t.id === id);
const selectedTrack = () => byId(state.selectedId);
const debounce = (fn, ms) => { let h; return () => { clearTimeout(h); h = setTimeout(fn, ms); }; };

const master = new Tone.Volume(0).toDestination();

function makeTrack(p, i) {
  return {
    id: Gen.uid(), name: p.name, role: p.role, isDrum: !!p.isDrum, gmFamily: p.gmFamily || null,
    instrument: p.instrument || 'auto', volume: p.volume ?? -6, mute: false, solo: false,
    color: COLORS[i % COLORS.length], notes: p.notes || [],
  };
}

// ---------- 音色執行期 ----------
const resolvedInstrument = t => t.instrument === 'auto' ? autoPick(t, state.style) : t.instrument;

function ensureRuntime(t) {
  let r = rt.get(t.id);
  if (!r) {
    r = { channel: new Tone.Channel({ volume: t.volume, mute: t.mute, solo: t.solo }).connect(master), inst: null, instId: null, status: '' };
    rt.set(t.id, r);
  }
  const want = resolvedInstrument(t);
  if (r.instId === want) return;
  r.inst?.dispose();
  r.instId = want;
  r.status = 'loading';
  const inst = createInstrument(want, r.channel);
  r.inst = inst;
  inst.ready.then(() => {
    if (r.inst !== inst) return;
    r.status = 'ready';
    updateTrackStatus(t.id);
  }).catch(() => {
    if (r.inst !== inst) return;
    failedInstruments.add(want);
    r.status = 'error';
    if (t.instrument === 'auto') ensureRuntime(t); // 自動模式改用合成器備援
    updateTrackStatus(t.id);
  });
  updateTrackStatus(t.id);
}

function syncRuntimes() {
  state.tracks.forEach(ensureRuntime);
  for (const [id, r] of rt) {
    if (byId(id)) continue;
    r.inst?.dispose();
    r.channel.dispose();
    rt.delete(id);
  }
}

// ---------- 播放 ----------
function rebuildParts() {
  parts.forEach(p => p.dispose());
  parts = [];
  const steps = state.bars * 16;
  Tone.Transport.loop = true;
  Tone.Transport.loopStart = 0;
  Tone.Transport.loopEnd = `${steps * STEP}i`;
  for (const t of state.tracks) {
    const id = t.id;
    const events = t.notes.filter(n => n.start < steps).map(n => ({
      time: `${n.start * STEP}i`, midi: n.midi, dur: Tone.Time(`${n.dur * STEP}i`).toSeconds(), vel: n.vel,
    }));
    if (!events.length) continue;
    parts.push(new Tone.Part((time, e) => rt.get(id)?.inst?.play(e.midi, e.dur, time, e.vel), events).start(0));
  }
}
const scheduleRebuild = debounce(rebuildParts, 40);

const isPlaying = () => Tone.Transport.state === 'started';
const playStep = () => isPlaying() ? Tone.Transport.ticks / STEP : seekStep;

async function togglePlay() {
  await Tone.start();
  if (isPlaying()) {
    Tone.Transport.stop();
  } else {
    rebuildParts();
    Tone.Transport.start('+0.05', `${Math.floor(seekStep) * STEP}i`);
  }
  updatePlayBtn();
}

function seek(step) {
  seekStep = step;
  if (isPlaying()) Tone.Transport.ticks = step * STEP;
  roll.dirty = true;
  updatePos();
}

async function preview(midi, vel = 0.8) {
  if (Tone.context.state !== 'running') await Tone.start();
  const t = selectedTrack();
  rt.get(t?.id)?.inst?.play(midi, 0.35, Tone.now() + 0.01, vel);
}

// ---------- 歷史 / 儲存 ----------
const snapshot = () => JSON.stringify({
  bpm: state.bpm, bars: state.bars, root: state.root, mode: state.mode, style: state.style,
  prog: state.prog, tracks: state.tracks, selectedId: state.selectedId,
});
function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > 100) undoStack.shift();
  redoStack.length = 0;
}
function restore(json) {
  Object.assign(state, JSON.parse(json));
  if (!byId(state.selectedId)) state.selectedId = state.tracks[0]?.id ?? null;
  afterStructureChange();
}
function undo() { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); }
function redo() { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); }

const save = debounce(() => { try { localStorage.setItem(STORE_KEY, snapshot()); } catch { } }, 300);

// ---------- 動作 ----------
function afterStructureChange() {
  Tone.Transport.bpm.value = state.bpm;
  syncRuntimes();
  renderTrackList();
  updateHeader();
  roll.setTrack(selectedTrack() || null);
  updateEditorBar();
  scheduleRebuild();
  save();
}

function onNotesChanged() {
  scheduleRebuild();
  const t = selectedTrack();
  if (t) drawMini(t);
  save();
}

function randomize(withUndo = true) {
  if (withUndo) pushUndo();
  const s = Gen.song();
  Object.assign(state, { bpm: s.bpm, bars: s.bars, root: s.root, mode: s.mode, style: s.style, prog: s.prog });
  state.tracks = s.tracks.map(makeTrack);
  state.selectedId = state.tracks.find(t => t.role === 'melody')?.id ?? state.tracks[0].id;
  seek(0);
  afterStructureChange();
}

function addTrack(p) {
  pushUndo();
  const t = makeTrack(p, state.tracks.length);
  state.tracks.push(t);
  state.selectedId = t.id;
  afterStructureChange();
}

function selectTrack(id) {
  if (state.selectedId === id) return;
  state.selectedId = id;
  document.querySelectorAll('.track').forEach(el => el.classList.toggle('selected', el.dataset.id === id));
  roll.setTrack(selectedTrack());
  updateEditorBar();
  save();
}

function ctxForGen() {
  return { root: state.root, mode: state.mode, bars: state.bars, prog: state.prog, style: state.style };
}

// ---------- MIDI 匯入/匯出 ----------
const MidiCtor = () => window.Midi?.Midi || window.Midi;

async function importMidi(file) {
  const midi = new (MidiCtor())(await file.arrayBuffer());
  const q = midi.header.ppq / 4;
  const src = midi.tracks.filter(t => t.notes.length);
  if (!src.length) { alert('這個 MIDI 檔沒有任何音符'); return; }
  pushUndo();
  state.tracks = src.map((mt, i) => {
    const isDrum = mt.channel === 9 || mt.instrument.percussion;
    const notes = mt.notes.map(n => ({
      id: Gen.uid(), midi: n.midi, start: Math.round(n.ticks / q),
      dur: Math.max(1, Math.round(n.durationTicks / q)), vel: +n.velocity.toFixed(2),
    }));
    return makeTrack({
      name: mt.name || (isDrum ? '鼓組' : mt.instrument.name) || `Track ${i + 1}`,
      role: isDrum ? 'drums' : inferRole(notes), isDrum,
      gmFamily: isDrum ? null : mt.instrument.family, notes,
    }, i);
  });
  const end = Math.max(...state.tracks.flatMap(t => t.notes.map(n => n.start + n.dur)));
  state.bars = Math.min(128, Math.max(1, Math.ceil(end / 16)));
  state.bpm = Math.round(midi.header.tempos[0]?.bpm || 120);
  state.selectedId = state.tracks[0].id;
  seek(0);
  afterStructureChange();
}

function exportMidi() {
  const midi = new (MidiCtor())();
  midi.header.setTempo(state.bpm);
  midi.header.name = 'MIDI 工作台';
  const q = midi.header.ppq / 4;
  let ch = 0;
  for (const t of state.tracks) {
    const mt = midi.addTrack();
    mt.name = t.name;
    if (t.isDrum) mt.channel = 9;
    else {
      if (ch === 9) ch++;
      mt.channel = ch++ % 16;
      mt.instrument.number = INSTRUMENTS[resolvedInstrument(t)].gm ?? 0;
    }
    for (const n of t.notes) mt.addNote({ midi: n.midi, ticks: n.start * q, durationTicks: n.dur * q, velocity: n.vel });
  }
  const url = URL.createObjectURL(new Blob([midi.toArray()], { type: 'audio/midi' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `midi-${NOTE_NAMES[state.root]}-${state.bpm}bpm.mid` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- UI ----------
function instOptions(t) {
  const autoId = resolvedInstrument({ ...t, instrument: 'auto' });
  const opt = id => `<option value="${id}"${t.instrument === id ? ' selected' : ''}>${INSTRUMENTS[id].label}${failedInstruments.has(id) ? '（載入失敗）' : ''}</option>`;
  const ids = Object.keys(INSTRUMENTS);
  const group = (label, kind) => `<optgroup label="${label}">${ids.filter(i => INSTRUMENTS[i].kind === kind).map(opt).join('')}</optgroup>`;
  return `<option value="auto"${t.instrument === 'auto' ? ' selected' : ''}>自動 → ${INSTRUMENTS[autoId].label}</option>`
    + group('合成器 Synth', 'synth') + group('電音 EDM', 'edm') + group('採樣器 Sampler', 'sampler');
}

function renderTrackList() {
  $('#trackList').innerHTML = state.tracks.map(t => `
    <div class="track${t.id === state.selectedId ? ' selected' : ''}" data-id="${t.id}" style="--c:${t.color}">
      <div class="track-row">
        <span class="swatch"></span>
        <input class="name" value="${esc(t.name)}" spellcheck="false">
        <span class="role">${ROLE_LABEL[effectiveRole(t)] || ''}</span>
        <button class="tbtn${t.mute ? ' on' : ''}" data-act="mute" title="靜音">M</button>
        <button class="tbtn solo${t.solo ? ' on' : ''}" data-act="solo" title="獨奏">S</button>
        <button class="tbtn del" data-act="delete" title="刪除音軌">×</button>
      </div>
      <div class="track-row">
        <select class="inst">${instOptions(t)}</select>
        <span class="status" title=""></span>
      </div>
      <div class="track-row">
        <input class="vol" type="range" min="-40" max="6" step="1" value="${t.volume}" title="音量 ${t.volume} dB">
        <canvas class="mini"></canvas>
      </div>
    </div>`).join('');
  state.tracks.forEach(t => { updateTrackStatus(t.id, false); drawMini(t); });
  $('#empty').hidden = state.tracks.length > 0;
}

function updateTrackStatus(id, refreshOptions = true) {
  const card = document.querySelector(`.track[data-id="${id}"]`);
  const t = byId(id), r = rt.get(id);
  if (!card || !t) return;
  const el = card.querySelector('.status');
  const kind = INSTRUMENTS[r?.instId]?.kind === 'sampler' ? '採樣器' : '合成器';
  const map = { loading: ['⏳', '樣本載入中…'], ready: ['●', `${kind}已就緒`], error: ['⚠', '樣本載入失敗'] };
  const [icon, tip] = map[r?.status] || ['', ''];
  el.textContent = icon;
  el.title = tip;
  el.className = 'status ' + (r?.status || '');
  if (refreshOptions) {
    const sel = card.querySelector('.inst');
    if (document.activeElement !== sel) sel.innerHTML = instOptions(t);
  }
}

function drawMini(t) {
  const cv = document.querySelector(`.track[data-id="${t.id}"] .mini`);
  if (!cv) return;
  const dpr = devicePixelRatio || 1, w = cv.clientWidth || 120, h = cv.clientHeight || 26;
  cv.width = w * dpr; cv.height = h * dpr;
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  g.clearRect(0, 0, w, h);
  if (!t.notes.length) return;
  const steps = state.bars * 16;
  const lo = Math.min(...t.notes.map(n => n.midi)), hi = Math.max(...t.notes.map(n => n.midi));
  const span = Math.max(1, hi - lo);
  g.fillStyle = t.color;
  for (const n of t.notes) {
    if (n.start >= steps) continue;
    const y = h - 3 - ((n.midi - lo) / span) * (h - 6);
    g.fillRect((n.start / steps) * w, y - 1, Math.max(1, (n.dur / steps) * w), 2);
  }
}

function updateHeader() {
  $('#bpm').value = state.bpm;
  $('#bars').value = state.bars;
  $('#style').value = state.style;
  $('#keyInfo').textContent = `${NOTE_NAMES[state.root]} ${MODE_LABEL[state.mode]}`;
}

function updateEditorBar() {
  const t = selectedTrack();
  $('#editTrackName').textContent = t ? t.name : '—';
  $('#editTrackName').style.color = t?.color || '';
  $('#regenTrack').disabled = $('#clearTrack').disabled = !t;
}

function updatePlayBtn() {
  const p = isPlaying();
  $('#btnPlay').textContent = p ? '■ 停止' : '▶ 播放';
  $('#btnPlay').classList.toggle('playing', p);
}

function updatePos() {
  const s = Math.floor(playStep());
  $('#pos').textContent = `${Math.floor(s / 16) + 1}.${Math.floor((s % 16) / 4) + 1}.${(s % 4) + 1}`;
}

// ---------- 綁定 ----------
const roll = new PianoRoll($('#roll'), {
  getBars: () => state.bars,
  beforeEdit: pushUndo,
  changed: onNotesChanged,
  preview,
  seek,
  selectionChanged: () => {
    const n = selectedTrack() && roll.selectedNotes()[0];
    if (!n) return;
    const v = Math.round(n.vel * 127);
    $('#vel').value = v;
    $('#velVal').textContent = v;
    roll.vel = n.vel;
  },
});

$('#btnRandom').onclick = () => randomize();
$('#btnPlay').onclick = togglePlay;
$('#btnExport').onclick = exportMidi;
$('#fileImport').onchange = e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) importMidi(f).catch(err => alert('MIDI 解析失敗：' + err.message));
};
$('#bpm').onchange = e => {
  state.bpm = Math.min(240, Math.max(40, +e.target.value || 120));
  e.target.value = state.bpm;
  Tone.Transport.bpm.value = state.bpm;
  rebuildParts(); // 時長以秒計，需依新 BPM 重算
  save();
};
$('#bars').onchange = e => {
  state.bars = Math.min(128, Math.max(1, Math.round(+e.target.value) || 8));
  e.target.value = state.bars;
  if (seekStep >= state.bars * 16) seek(0);
  rebuildParts();
  roll.clamp(); roll.dirty = true;
  state.tracks.forEach(drawMini);
  save();
};
$('#style').onchange = e => {
  state.style = e.target.value;
  syncRuntimes();
  state.tracks.forEach(t => updateTrackStatus(t.id));
  save();
};
$('#master').oninput = e => { master.volume.value = +e.target.value; };
$('#addMelodic').onclick = () => addTrack({ name: '新音軌', role: 'melody' });
$('#addDrum').onclick = () => addTrack({ name: '鼓組', role: 'drums', isDrum: true });
$('#addEdm').innerHTML = '<option value="">+ 電音軌</option>'
  + Object.entries(EDM_ROLES).map(([role, name]) => `<option value="${role}">${name}</option>`).join('');
$('#addEdm').onchange = e => {
  const role = e.target.value;
  e.target.value = '';
  e.target.blur();
  if (role) addTrack({ name: EDM_ROLES[role], role, notes: Gen.track(role, ctxForGen()) });
};
$('#noteLen').onchange = e => { roll.noteLen = +e.target.value; };
$('#zoomIn').onclick = () => roll.zoom(1.25);
$('#zoomOut').onclick = () => roll.zoom(0.8);

let velEditing = false;
$('#vel').oninput = e => {
  const v = +e.target.value;
  $('#velVal').textContent = v;
  roll.vel = v / 127;
  const sel = selectedTrack() && roll.selectedNotes();
  if (sel?.length) {
    if (!velEditing) { pushUndo(); velEditing = true; }
    sel.forEach(n => { n.vel = +(v / 127).toFixed(2); });
    roll.dirty = true;
    onNotesChanged();
  }
};
$('#vel').onchange = () => { velEditing = false; };

$('#regenTrack').onclick = () => {
  const t = selectedTrack();
  if (!t) return;
  pushUndo();
  t.notes = Gen.track(effectiveRole(t), ctxForGen());
  roll.setTrack(t);
  onNotesChanged();
};
$('#clearTrack').onclick = () => {
  const t = selectedTrack();
  if (!t || !t.notes.length) return;
  pushUndo();
  t.notes = [];
  roll.setTrack(t);
  onNotesChanged();
};

const list = $('#trackList');
list.addEventListener('click', e => {
  const card = e.target.closest('.track');
  if (!card) return;
  const t = byId(card.dataset.id), r = rt.get(t.id);
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'mute') {
    t.mute = !t.mute; r.channel.mute = t.mute;
    e.target.classList.toggle('on', t.mute); save();
  } else if (act === 'solo') {
    t.solo = !t.solo; r.channel.solo = t.solo;
    e.target.classList.toggle('on', t.solo); save();
  } else if (act === 'delete') {
    if (!confirm(`刪除音軌「${t.name}」？（可用 ⌘/Ctrl+Z 復原）`)) return;
    pushUndo();
    state.tracks = state.tracks.filter(x => x !== t);
    if (state.selectedId === t.id) state.selectedId = state.tracks[0]?.id ?? null;
    afterStructureChange();
  } else {
    selectTrack(t.id);
  }
});
list.addEventListener('input', e => {
  const t = byId(e.target.closest('.track')?.dataset.id);
  if (!t) return;
  if (e.target.matches('.name')) {
    t.name = e.target.value;
    if (t.id === state.selectedId) updateEditorBar();
    save();
  } else if (e.target.matches('.vol')) {
    t.volume = +e.target.value;
    rt.get(t.id).channel.volume.value = t.volume;
    e.target.title = `音量 ${t.volume} dB`;
    save();
  }
});
list.addEventListener('change', e => {
  if (!e.target.matches('.inst')) return;
  const t = byId(e.target.closest('.track').dataset.id);
  t.instrument = e.target.value;
  ensureRuntime(t);
  e.target.blur();
  updateTrackStatus(t.id);
  save();
});

document.addEventListener('keydown', e => {
  if (e.target.matches('input:not([type=range]), select, textarea')) return;
  const mod = e.metaKey || e.ctrlKey;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
});

function frame() {
  if (isPlaying() || roll.dirty) {
    roll.draw(playStep());
    roll.dirty = false;
    if (isPlaying()) updatePos();
  }
  requestAnimationFrame(frame);
}

// ---------- 啟動 ----------
(function init() {
  let saved = null;
  try { saved = localStorage.getItem(STORE_KEY); } catch { }
  if (saved) {
    try { restore(saved); } catch { randomize(false); }
  } else {
    randomize(false);
  }
  updatePlayBtn();
  updatePos();
  requestAnimationFrame(frame);
})();

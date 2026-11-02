// 音色庫：合成器 (Tone.*Synth) 與採樣器 (Tone.Sampler / Tone.Players)
const SALAMANDER = 'https://tonejs.github.io/audio/salamander/';
const NBRO = 'https://nbrosowsky.github.io/tonejs-instruments/samples/';
const DRUM_BASE = 'https://tonejs.github.io/audio/drum-samples/';

const noteFile = n => n.replace('#', 's') + '.mp3';
const noteList = (names, octaves) => octaves.flatMap(o => names.map(n => n + o));

const INSTRUMENTS = {
  'synth:basic': {
    label: 'Triangle 合成器', kind: 'synth', gm: 80,
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.4, release: 0.6 },
      volume: -6,
    }),
  },
  'synth:lead': {
    label: '方波 Lead', kind: 'synth', gm: 80,
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'square8' },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.5, release: 0.3 },
      volume: -14,
    }),
  },
  'synth:fm': {
    label: 'FM 電鋼琴', kind: 'synth', gm: 4,
    create: () => new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3, modulationIndex: 10,
      envelope: { attack: 0.005, decay: 0.6, sustain: 0.2, release: 1 },
      modulationEnvelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 0.5 },
      volume: -10,
    }),
  },
  'synth:am': {
    label: 'AM 鐘聲', kind: 'synth', gm: 14,
    create: () => new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 2.5,
      envelope: { attack: 0.01, decay: 0.8, sustain: 0.1, release: 1.2 },
      volume: -6,
    }),
  },
  'synth:pad': {
    label: 'Fat Saw Pad', kind: 'synth', gm: 89,
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 30 },
      envelope: { attack: 0.35, decay: 0.3, sustain: 0.7, release: 1.5 },
      volume: -20,
    }),
  },
  'synth:pluck': {
    label: '撥弦合成器', kind: 'synth', gm: 46,
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fmtriangle', modulationType: 'sine', harmonicity: 2 },
      envelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.3 },
      volume: -8,
    }),
  },
  'synth:bass': {
    label: 'Mono 貝斯', kind: 'synth', gm: 38,
    create: () => new Tone.PolySynth(Tone.MonoSynth, {
      oscillator: { type: 'sawtooth' },
      filter: { Q: 2, type: 'lowpass' },
      filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.4, baseFrequency: 80, octaves: 3 },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0.6, release: 0.3 },
      volume: -10,
    }),
  },
  'synth:drums': { label: '合成鼓組', kind: 'synth', drumSynth: true, gm: 0 },

  'edm:supersaw': {
    label: 'Supersaw Lead', kind: 'edm', gm: 81,
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 5, spread: 40 },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.4 },
      volume: -6,
    }),
    fx: () => [new Tone.Filter(6000, 'lowpass'), new Tone.Chorus(4, 2.5, 0.4).start(), new Tone.Reverb({ decay: 2.5, wet: 0.25 })],
  },
  'edm:wobble': {
    label: 'Wobble Bass', kind: 'edm', gm: 38,
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 20 },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.9, release: 0.2 },
      volume: -8,
    }),
    // LFO 同步到 Transport，以 8 分音符週期開合濾波器
    fx: () => [
      new Tone.AutoFilter({ frequency: '8n', baseFrequency: 160, octaves: 4.5, depth: 1, filter: { type: 'lowpass', Q: 5, rolloff: -24 } }).sync().start(0),
      new Tone.Distortion(0.3),
    ],
  },
  'edm:acid': {
    label: 'Acid 303', kind: 'edm', gm: 87,
    create: () => new Tone.PolySynth(Tone.MonoSynth, {
      oscillator: { type: 'sawtooth' },
      filter: { Q: 12, type: 'lowpass', rolloff: -24 },
      filterEnvelope: { attack: 0.001, decay: 0.15, sustain: 0.1, release: 0.2, baseFrequency: 180, octaves: 4.5 },
      envelope: { attack: 0.002, decay: 0.2, sustain: 0.5, release: 0.1 },
      volume: -12,
    }),
    fx: () => [new Tone.Distortion({ distortion: 0.4, wet: 0.6 }), new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.3, wet: 0.2 })],
  },
  'edm:808': {
    label: '808 Sub', kind: 'edm', gm: 38,
    create: () => new Tone.PolySynth(Tone.MembraneSynth, {
      pitchDecay: 0.03, octaves: 1.5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.002, decay: 1.6, sustain: 0.3, release: 0.8 },
      volume: -6,
    }),
    fx: () => [new Tone.Distortion({ distortion: 0.4, wet: 0.8 })],
  },
  'edm:stab': {
    label: 'House Stab', kind: 'edm', gm: 81,
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsquare', count: 2, spread: 15 },
      envelope: { attack: 0.002, decay: 0.3, sustain: 0.25, release: 0.15 },
      volume: -2,
    }),
    fx: () => [new Tone.Filter(3000, 'lowpass'), new Tone.Reverb({ decay: 1.8, wet: 0.3 })],
  },
  'edm:pluck': {
    label: 'Future Pluck', kind: 'edm', gm: 84,
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 25 },
      envelope: { attack: 0.002, decay: 0.35, sustain: 0.15, release: 0.3 },
      volume: 0,
    }),
    fx: () => [new Tone.Filter(4000, 'lowpass'), new Tone.PingPongDelay({ delayTime: '8n.', feedback: 0.35, wet: 0.3 })],
  },
  'edm:chip': {
    label: 'Chiptune', kind: 'edm', gm: 80,
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'pulse', width: 0.25 },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0.4, release: 0.05 },
      volume: -12,
    }),
  },

  'sampler:piano': { label: '鋼琴', kind: 'sampler', gm: 0, base: SALAMANDER, release: 1.2, notes: noteList(['A', 'C', 'D#', 'F#'], [1, 2, 3, 4, 5, 6]) },
  'sampler:bass-electric': { label: '電貝斯', kind: 'sampler', gm: 33, base: NBRO + 'bass-electric/', release: 0.4, notes: ['A#1', 'A#2', 'A#3', 'C#2', 'C#3', 'C#4', 'E1', 'E2', 'E3', 'G1', 'G2', 'G3'] },
  'sampler:guitar-nylon': { label: '尼龍吉他', kind: 'sampler', gm: 24, base: NBRO + 'guitar-nylon/', release: 1, notes: ['A2', 'A3', 'A4', 'A5', 'E2', 'E3', 'E4', 'E5', 'D2', 'D3', 'D5', 'B1', 'B2', 'B3', 'B4'] },
  'sampler:violin': { label: '小提琴', kind: 'sampler', gm: 40, base: NBRO + 'violin/', release: 0.8, notes: ['A3', 'A4', 'A5', 'A6', 'C4', 'C5', 'C6', 'C7', 'E4', 'E5', 'E6', 'G4', 'G5', 'G6'] },
  'sampler:cello': { label: '大提琴', kind: 'sampler', gm: 42, base: NBRO + 'cello/', release: 0.8, notes: ['C2', 'C3', 'C4', 'E2', 'E3', 'E4', 'A2', 'A3', 'A4', 'G2', 'G3', 'G4'] },
  'sampler:flute': { label: '長笛', kind: 'sampler', gm: 73, base: NBRO + 'flute/', release: 0.6, notes: ['A4', 'A5', 'A6', 'C4', 'C5', 'C6', 'C7', 'E4', 'E5', 'E6'] },
  'sampler:trumpet': { label: '小號', kind: 'sampler', gm: 56, base: NBRO + 'trumpet/', release: 0.5, notes: ['A3', 'A5', 'C4', 'C6', 'D5', 'F3', 'F4', 'F5', 'G4'] },
  'sampler:organ': { label: '風琴', kind: 'sampler', gm: 19, base: NBRO + 'organ/', release: 0.5, notes: ['C3', 'C4', 'C5', 'C6', 'A1', 'A2', 'A3', 'A4', 'A5', 'F#1', 'F#2', 'F#3', 'F#4', 'F#5'] },
  'sampler:xylophone': { label: '木琴', kind: 'sampler', gm: 13, base: NBRO + 'xylophone/', release: 1, notes: ['C5', 'C6', 'C7', 'G4', 'G5', 'G6'] },
  'sampler:drums-acoustic': { label: '原聲鼓組', kind: 'sampler', drumKit: 'acoustic-kit', gm: 0 },
  'sampler:drums-cr78': { label: 'CR-78 鼓機', kind: 'sampler', drumKit: 'CR78', gm: 0 },
  'sampler:drums-linn': { label: 'LinnDrum 鼓機', kind: 'sampler', drumKit: 'LINN', gm: 0 },
};

// 依「配器風格 × 音軌角色」自動挑選
const AUTO_MAP = {
  acoustic: { drums: 'sampler:drums-acoustic', bass: 'sampler:bass-electric', chords: 'sampler:piano', pad: 'sampler:cello', melody: 'sampler:flute', arp: 'sampler:guitar-nylon' },
  electronic: { drums: 'synth:drums', bass: 'synth:bass', chords: 'edm:stab', pad: 'synth:pad', melody: 'edm:supersaw', arp: 'edm:pluck' },
  lofi: { drums: 'sampler:drums-cr78', bass: 'sampler:bass-electric', chords: 'synth:fm', pad: 'synth:fm', melody: 'sampler:xylophone', arp: 'sampler:guitar-nylon' },
  orchestral: { drums: 'sampler:drums-acoustic', bass: 'sampler:cello', chords: 'sampler:piano', pad: 'sampler:violin', melody: 'sampler:trumpet', arp: 'sampler:xylophone' },
};
const FALLBACK = {
  drums: 'synth:drums', bass: 'synth:bass', chords: 'synth:fm', pad: 'synth:pad', melody: 'synth:lead', arp: 'synth:pluck',
  lead: 'edm:supersaw', wobble: 'edm:wobble', acid: 'edm:acid', sub: 'edm:808', stab: 'edm:stab', pluck: 'edm:pluck', chip: 'edm:chip',
};
// 電音軌角色：不論配器風格，自動都套用對應的電音音色
const EDM_ROLES = {
  lead: 'Supersaw Lead', wobble: 'Wobble Bass', acid: 'Acid', sub: '808', stab: 'House Stab', pluck: 'Future Pluck', chip: 'Chiptune',
};

// 匯入 MIDI 時依 GM family 對應
const FAMILY_MAP = {
  'piano': 'sampler:piano', 'chromatic percussion': 'sampler:xylophone', 'organ': 'sampler:organ',
  'guitar': 'sampler:guitar-nylon', 'bass': 'sampler:bass-electric', 'strings': 'sampler:violin',
  'ensemble': 'sampler:violin', 'brass': 'sampler:trumpet', 'reed': 'sampler:flute', 'pipe': 'sampler:flute',
  'synth lead': 'synth:lead', 'synth pad': 'synth:pad', 'synth effects': 'synth:am',
  'ethnic': 'synth:pluck', 'percussive': 'synth:am',
};

const failedInstruments = new Set();

function inferRole(notes) {
  if (!notes.length) return 'melody';
  const avg = notes.reduce((s, n) => s + n.midi, 0) / notes.length;
  const starts = new Map();
  notes.forEach(n => starts.set(n.start, (starts.get(n.start) || 0) + 1));
  const poly = Math.max(...starts.values());
  const avgDur = notes.reduce((s, n) => s + n.dur, 0) / notes.length;
  if (avg < 48 && poly < 3) return 'bass';
  if (poly >= 3) return avgDur >= 12 ? 'pad' : 'chords';
  return 'melody';
}

function effectiveRole(t) {
  return t.isDrum ? 'drums' : (t.role || 'melody');
}

function autoPick(t, style) {
  const role = effectiveRole(t);
  let id;
  if (!t.isDrum && t.gmFamily && FAMILY_MAP[t.gmFamily]) {
    id = FAMILY_MAP[t.gmFamily];
    if (id === 'sampler:violin' && role === 'bass') id = 'sampler:cello';
  } else if (EDM_ROLES[role]) {
    id = FALLBACK[role];
  } else {
    id = (AUTO_MAP[style] || AUTO_MAP.acoustic)[role];
  }
  if (!id || failedInstruments.has(id)) id = FALLBACK[role] || 'synth:basic';
  return id;
}

// ---- 執行期實作 ----
const bufferCache = new Map();
function loadBuffer(url) {
  if (!bufferCache.has(url)) bufferCache.set(url, Tone.ToneAudioBuffer.fromUrl(url));
  return bufferCache.get(url);
}

// 同一個單音聲部不能在同一時間點重複觸發，往後推 2ms
function monotonic() {
  const last = new Map();
  return (key, time) => {
    const l = last.get(key) ?? -1;
    const t = time <= l ? l + 0.002 : time;
    last.set(key, t);
    return t;
  };
}

const DRUM_VOICE = { 35: 'kick', 36: 'kick', 37: 'snare', 38: 'snare', 39: 'snare', 40: 'snare', 41: 'tom3', 43: 'tom3', 45: 'tom2', 47: 'tom2', 48: 'tom1', 50: 'tom1' };
const drumVoice = m => DRUM_VOICE[m] || 'hihat';

function createSampler(def, out) {
  const s = new Tone.Sampler({ release: def.release ?? 1 }).connect(out);
  let count = 0, disposed = false;
  const ready = Promise.allSettled(def.notes.map(n =>
    loadBuffer(def.base + noteFile(n)).then(b => { if (!disposed) { s.add(n, b); count++; } })
  )).then(() => { if (!disposed && !count) throw new Error('no samples'); });
  return {
    ready,
    play(m, d, t, v) { if (count) s.triggerAttackRelease(Tone.Frequency(m, 'midi').toNote(), d, t, v); },
    dispose() { disposed = true; s.dispose(); },
  };
}

function createDrumKit(def, out) {
  const players = new Tone.Players().connect(out);
  const mono = monotonic();
  let disposed = false;
  const names = ['kick', 'snare', 'hihat', 'tom1', 'tom2', 'tom3'];
  const ready = Promise.allSettled(names.map(nm =>
    loadBuffer(`${DRUM_BASE}${def.drumKit}/${nm}.mp3`).then(b => { if (!disposed) players.add(nm, b); })
  )).then(() => { if (!disposed && !players.has('kick') && !players.has('snare')) throw new Error('no samples'); });
  return {
    ready,
    play(m, d, t, v) {
      const nm = drumVoice(m);
      if (!players.has(nm)) return;
      const p = players.player(nm);
      const tt = mono(nm, t);
      p.volume.setValueAtTime(Tone.gainToDb(Math.max(v, 0.05)), tt);
      p.start(tt);
    },
    dispose() { disposed = true; players.dispose(); },
  };
}

function createDrumSynth(out) {
  const kick = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.1 } }).connect(out);
  const tom = new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 2, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 }, volume: -4 }).connect(out);
  const snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.18, sustain: 0 }, volume: -10 }).connect(out);
  const hat = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.06, release: 0.02 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5, volume: -26 }).connect(out);
  const mono = monotonic();
  const TOM_NOTE = { tom1: 'G2', tom2: 'D2', tom3: 'A1' };
  return {
    ready: Promise.resolve(),
    play(m, d, t, v) {
      const nm = drumVoice(m);
      const tt = mono(nm.startsWith('tom') ? 'tom' : nm, t);
      if (nm === 'kick') kick.triggerAttackRelease('C1', '8n', tt, v);
      else if (nm === 'snare') snare.triggerAttackRelease('16n', tt, v);
      else if (nm.startsWith('tom')) tom.triggerAttackRelease(TOM_NOTE[nm], '8n', tt, v);
      else hat.triggerAttackRelease(300, m === 46 ? 0.3 : 0.05, tt, v);
    },
    dispose() { [kick, tom, snare, hat].forEach(x => x.dispose()); },
  };
}

function createInstrument(id, out) {
  const def = INSTRUMENTS[id];
  if (def.drumKit) return createDrumKit(def, out);
  if (def.drumSynth) return createDrumSynth(out);
  if (def.notes) return createSampler(def, out);
  const synth = def.create();
  const fx = def.fx ? def.fx() : [];
  synth.chain(...fx, out);
  return {
    ready: Promise.resolve(),
    play: (m, d, t, v) => synth.triggerAttackRelease(Tone.Frequency(m, 'midi').toFrequency(), d, t, v),
    dispose: () => { synth.dispose(); fx.forEach(f => f.dispose()); },
  };
}

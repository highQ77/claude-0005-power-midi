// 隨機作曲：時間單位為 16 分音符 (step)，一小節 16 step
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
};
const PROGRESSIONS = {
  major: [[0, 4, 5, 3], [0, 5, 3, 4], [0, 3, 4, 4], [5, 3, 0, 4], [0, 3, 5, 4], [0, 1, 4, 0]],
  minor: [[0, 5, 2, 6], [0, 3, 4, 0], [0, 6, 5, 6], [0, 5, 3, 4], [0, 3, 6, 2]],
  dorian: [[0, 3, 0, 3], [0, 3, 6, 0], [0, 6, 3, 0]],
};
const STYLES = ['acoustic', 'electronic', 'lofi', 'orchestral'];

const Gen = (() => {
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const chance = p => Math.random() < p;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const note = (midi, start, dur, vel) => ({ id: uid(), midi, start, dur, vel: +clamp(vel, 0.05, 1).toFixed(2) });

  const degMidi = (ctx, deg, base) => {
    const sc = SCALES[ctx.mode];
    return base + Math.floor(deg / 7) * 12 + sc[((deg % 7) + 7) % 7];
  };
  const chordAt = (ctx, bar) => ctx.prog[bar % ctx.prog.length];
  const baseFor = (ctx, oct) => 12 * (oct + 1) + ctx.root - (ctx.root > 6 ? 12 : 0);

  function chords(ctx, sustained = false, pattern = null) {
    const base = baseFor(ctx, 3) + 12 * (ctx.root <= 6 ? 0 : 1);
    const pat = pattern || (sustained ? [[0, 16]] : pick([
      [[0, 16]], [[0, 8], [8, 8]], [[0, 3], [3, 3], [6, 4], [10, 2], [12, 4]],
      [[0, 6], [6, 6], [12, 4]], [[0, 4], [4, 4], [8, 4], [12, 4]],
    ]));
    const seventh = ctx.style === 'lofi' || chance(0.3);
    const out = [];
    for (let bar = 0; bar < ctx.bars; bar++) {
      const deg = chordAt(ctx, bar);
      const shift = deg >= 4 ? -7 : 0;
      const tones = [0, 2, 4].concat(seventh ? [6] : []).map(x => deg + x + shift);
      for (const [s, d] of pat)
        for (const tn of tones) out.push(note(degMidi(ctx, tn, base), bar * 16 + s, d, s === 0 ? 0.7 : 0.55));
    }
    return out;
  }

  function bass(ctx) {
    const base = baseFor(ctx, 2);
    // [start, dur, 音級偏移(0 根音 / 4 五度 / 7 八度)]
    const pat = pick([
      [[0, 4, 0], [4, 4, 0], [8, 4, 0], [12, 4, 0]],
      [[0, 2, 0], [2, 2, 0], [4, 2, 7], [6, 2, 0], [8, 2, 0], [10, 2, 0], [12, 2, 7], [14, 2, 4]],
      [[0, 3, 0], [3, 3, 0], [6, 2, 4], [8, 4, 0], [12, 2, 4], [14, 2, 7]],
      [[0, 6, 0], [6, 2, 0], [8, 6, 4], [14, 2, 0]],
      [[0, 8, 0], [8, 8, 4]],
    ]);
    const out = [];
    for (let bar = 0; bar < ctx.bars; bar++) {
      const deg = chordAt(ctx, bar);
      const last = bar === ctx.bars - 1;
      for (const [s, d, off] of (last ? [[0, 16, 0]] : pat))
        out.push(note(degMidi(ctx, deg + off, base), bar * 16 + s, d, s % 4 === 0 ? 0.85 : 0.7));
    }
    return out;
  }

  function rhythm(len) {
    const out = [];
    const durs = [2, 2, 2, 4, 4, 1, 1, 3, 6, 8];
    let t = 0;
    while (t < len) {
      let d = pick(durs);
      if (t % 2 === 1) d = 1;
      d = Math.min(d, len - t);
      if (!chance(0.18)) out.push([t, d]);
      t += d;
    }
    return out;
  }

  function melody(ctx) {
    const base = baseFor(ctx, 4);
    const motifs = [rhythm(32), rhythm(32)];
    const form = [0, 1, 0, 1];
    let deg = pick([0, 2, 4, 7]);
    const out = [];
    const degs = [];
    for (let seg = 0; seg * 2 < ctx.bars; seg++) {
      const lastSeg = (seg + 1) * 2 >= ctx.bars;
      const r = lastSeg && chance(0.5) ? rhythm(32) : motifs[form[seg % 4]];
      for (const [s, d] of r) {
        const abs = seg * 32 + s;
        if (abs >= ctx.bars * 16) break;
        const chord = chordAt(ctx, Math.floor(abs / 16));
        if (abs % 8 === 0) {
          const tones = [];
          for (let o = -7; o <= 14; o += 7) [0, 2, 4].forEach(x => tones.push(chord + x + o));
          deg = tones.reduce((a, b) => Math.abs(b - deg) < Math.abs(a - deg) ? b : a);
        } else {
          deg += pick([-2, -1, -1, 1, 1, 2, 0, 3, -3]);
        }
        deg = clamp(deg, -2, 11);
        degs.push(deg);
        out.push(note(degMidi(ctx, deg, base), abs, d, 0.6 + Math.random() * 0.3));
      }
    }
    if (out.length) {
      const d = degs[degs.length - 1];
      out[out.length - 1].midi = degMidi(ctx, Math.round(d / 7) * 7, base);
    }
    return out;
  }

  function arp(ctx, rate = pick([1, 2, 2])) {
    const base = baseFor(ctx, 3);
    const pat = pick([[0, 2, 4, 7], [0, 4, 2, 4], [0, 2, 4, 2], [7, 4, 2, 0], [0, 4, 7, 9]]);
    const out = [];
    for (let bar = 0; bar < ctx.bars; bar++) {
      const deg = chordAt(ctx, bar);
      for (let s = 0, i = 0; s < 16; s += rate, i++)
        out.push(note(degMidi(ctx, deg + pat[i % pat.length], base), bar * 16 + s, rate, s % 4 === 0 ? 0.7 : 0.45));
    }
    return out;
  }

  function drums(ctx) {
    let kicks = pick([[0, 8], [0, 6, 8], [0, 7, 10], [0, 3, 8, 11], [0, 8, 10]]);
    if (ctx.style === 'electronic' && chance(0.6)) kicks = [0, 4, 8, 12];
    const hatRate = ctx.style === 'lofi' ? 2 : pick([2, 2, 1]);
    const openHat = chance(0.5);
    const ghost = chance(0.4);
    const out = [];
    for (let bar = 0; bar < ctx.bars; bar++) {
      const o = bar * 16;
      const fill = bar === ctx.bars - 1 && ctx.bars > 1;
      const lim = fill ? 12 : 16;
      kicks.filter(s => s < lim).forEach(s => out.push(note(36, o + s, 1, s === 0 ? 0.95 : 0.8)));
      [4, 12].filter(s => s < lim).forEach(s => out.push(note(38, o + s, 1, 0.85)));
      if (ghost) out.push(note(38, o + 7, 1, 0.25));
      for (let s = 0; s < lim; s += hatRate) {
        if (openHat && s === 14) { out.push(note(46, o + s, 2, 0.5)); continue; }
        out.push(note(42, o + s, 1, s % 4 === 0 ? 0.55 : 0.32));
      }
      if (fill) [38, 45, 43, 41].forEach((m, i) => out.push(note(m, o + 12 + i, 1, 0.7 + i * 0.07)));
    }
    return out;
  }

  // ---- 電音 ----
  const up = (notes, semis) => notes.map(n => ({ ...n, midi: n.midi + semis }));

  function acid(ctx) {
    const base = baseFor(ctx, 2);
    const seq = Array.from({ length: 16 }, (_, s) => ({
      on: s === 0 || chance(0.7), off: pick([0, 0, 0, 0, 4, 2, 6]),
      oct: chance(0.25) ? 12 : 0, accent: chance(0.3), slide: chance(0.15),
    }));
    const out = [];
    for (let bar = 0; bar < ctx.bars; bar++) {
      const deg = chordAt(ctx, bar);
      seq.forEach((x, s) => {
        if (!x.on) return;
        out.push(note(degMidi(ctx, deg + x.off, base) + x.oct, bar * 16 + s, x.slide && s < 15 ? 2 : 1, x.accent ? 0.95 : 0.6));
      });
    }
    return out;
  }

  function sub(ctx) {
    const base = baseFor(ctx, 2);
    const pat = pick([[[0, 6, 0], [6, 4, 0], [10, 6, 0]], [[0, 10, 0], [10, 6, 7]], [[0, 3, 0], [3, 5, 0], [8, 8, 0]], [[0, 14, 0], [14, 2, 7]]]);
    const out = [];
    for (let bar = 0; bar < ctx.bars; bar++) {
      const deg = chordAt(ctx, bar);
      for (const [s, d, off] of pat) out.push(note(degMidi(ctx, deg + off, base), bar * 16 + s, d, 0.9));
    }
    return out;
  }

  function wobble(ctx) {
    const base = baseFor(ctx, 2);
    const pat = pick([[[0, 8, 0], [8, 6, 0], [14, 2, 7]], [[0, 16, 0]], [[0, 4, 0], [4, 4, 0], [8, 8, 4]], [[0, 12, 0], [12, 4, 4]]]);
    const out = [];
    for (let bar = 0; bar < ctx.bars; bar++) {
      const deg = chordAt(ctx, bar);
      for (const [s, d, off] of pat) out.push(note(degMidi(ctx, deg + off, base), bar * 16 + s, d, 0.85));
    }
    return out;
  }

  const stab = ctx => chords(ctx, false, pick([
    [[2, 1], [6, 1], [10, 1], [14, 1]],
    [[0, 2], [3, 2], [6, 2], [10, 2], [12, 2]],
    [[2, 2], [6, 2], [10, 1], [11, 1], [14, 2]],
  ]));

  const byRole = {
    drums, bass, melody, arp, acid, sub, wobble, stab,
    chords: ctx => chords(ctx),
    pad: ctx => chords(ctx, true),
    lead: ctx => up(melody(ctx), 12),
    pluck: ctx => up(arp(ctx, 2), 12),
    chip: ctx => up(arp(ctx, 1), 12),
  };

  function track(role, ctx) {
    return (byRole[role] || melody)(ctx);
  }

  function song() {
    const mode = pick(['major', 'major', 'minor', 'minor', 'dorian']);
    const ctx = {
      root: rnd(0, 11),
      mode,
      bpm: rnd(80, 136),
      bars: pick([4, 8, 8]),
      style: pick(STYLES),
      prog: pick(PROGRESSIONS[mode]),
    };
    const roles = [['drums', '鼓組'], ['bass', '貝斯'], ['chords', '和弦'], ['melody', '旋律']];
    if (ctx.style === 'electronic' || chance(0.35)) roles.push(['arp', '琶音']);
    if (ctx.style === 'orchestral' && chance(0.6)) roles.push(['pad', '鋪底']);
    if (ctx.style === 'electronic') {
      if (chance(0.6)) roles[1] = pick([['sub', '808'], ['wobble', 'Wobble Bass'], ['acid', 'Acid']]);
      if (chance(0.5)) roles[2] = ['stab', 'House Stab'];
      if (chance(0.4)) roles[3] = ['lead', 'Supersaw Lead'];
      if (roles[1][0] !== 'acid' && chance(0.3)) roles.push(['acid', 'Acid']);
    }
    ctx.tracks = roles.map(([role, name]) => ({ name, role, isDrum: role === 'drums', notes: track(role, ctx) }));
    return ctx;
  }

  return { song, track, uid };
})();

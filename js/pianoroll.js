// Canvas Piano Roll：單一 canvas、手動捲動
const BLACK = new Set([1, 3, 6, 8, 10]);
const GM_DRUMS = {
  35: 'Acoustic Kick', 36: 'Kick', 37: 'Side Stick', 38: 'Snare', 39: 'Clap', 40: 'Snare 2',
  41: 'Low Tom 2', 42: 'Closed Hat', 43: 'Low Tom', 44: 'Pedal Hat', 45: 'Mid Tom 2', 46: 'Open Hat',
  47: 'Mid Tom', 48: 'Hi Tom 2', 49: 'Crash', 50: 'Hi Tom', 51: 'Ride', 52: 'China', 53: 'Ride Bell',
  54: 'Tambourine', 55: 'Splash', 56: 'Cowbell', 57: 'Crash 2', 58: 'Vibraslap', 59: 'Ride 2',
  60: 'Hi Bongo', 61: 'Low Bongo', 62: 'Mute Conga', 63: 'Open Conga', 64: 'Low Conga',
  65: 'Hi Timbale', 66: 'Low Timbale', 67: 'Hi Agogo', 68: 'Low Agogo', 69: 'Cabasa', 70: 'Maracas',
  71: 'Short Whistle', 72: 'Long Whistle', 73: 'Short Guiro', 74: 'Long Guiro', 75: 'Claves',
  76: 'Hi Wood Block', 77: 'Low Wood Block', 78: 'Mute Cuica', 79: 'Open Cuica', 80: 'Mute Triangle', 81: 'Open Triangle',
};
const MELODIC_ROWS = Array.from({ length: 88 }, (_, i) => 108 - i);
const DRUM_ROWS = Array.from({ length: 47 }, (_, i) => 81 - i);
const DRUM_ROW_INDEX = new Map(DRUM_ROWS.map((m, i) => [m, i]));
const midiName = m => NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1);

class PianoRoll {
  constructor(canvas, hooks) {
    Object.assign(this, {
      c: canvas, g: canvas.getContext('2d'), h: hooks, track: null,
      cw: 22, rh: 14, rulerH: 24, sx: 0, sy: 0, W: 0, H: 0,
      sel: new Set(), drag: null, dirty: true, noteLen: 4, vel: 0.75, needCenter: false,
    });
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', e => this.onUp(e));
    canvas.addEventListener('pointercancel', e => this.onUp(e));
    canvas.addEventListener('contextmenu', e => this.onContext(e));
    canvas.addEventListener('wheel', e => this.onWheel(e), { passive: false });
    canvas.addEventListener('keydown', e => this.onKey(e));
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
  }

  get keyW() { return this.track?.isDrum ? 112 : 52; }
  get rows() { return this.track?.isDrum ? DRUM_ROWS : MELODIC_ROWS; }
  get steps() { return this.h.getBars() * 16; }
  rowOf(m) {
    if (this.track?.isDrum) return DRUM_ROW_INDEX.get(m) ?? -1;
    return m >= 21 && m <= 108 ? 108 - m : -1;
  }

  resize() {
    const r = this.c.parentElement.getBoundingClientRect();
    const dpr = devicePixelRatio || 1;
    this.W = r.width; this.H = r.height;
    this.c.width = Math.round(r.width * dpr); this.c.height = Math.round(r.height * dpr);
    this.c.style.width = r.width + 'px'; this.c.style.height = r.height + 'px';
    if (this.needCenter) this.center();
    this.clamp();
    this.dirty = true;
  }

  clamp() {
    const maxX = Math.max(0, this.steps * this.cw - (this.W - this.keyW) + 40);
    const maxY = Math.max(0, this.rows.length * this.rh - (this.H - this.rulerH));
    this.sx = Math.min(Math.max(0, this.sx), maxX);
    this.sy = Math.min(Math.max(0, this.sy), maxY);
  }

  setTrack(t) {
    const switched = this.track?.id !== t?.id;
    this.track = t;
    if (switched) { this.sel.clear(); this.drag = null; this.center(); }
    else if (t) {
      const ids = new Set(t.notes.map(n => n.id));
      for (const id of this.sel) if (!ids.has(id)) this.sel.delete(id);
    }
    this.clamp();
    this.dirty = true;
  }

  center() {
    if (!this.track) return;
    if (!this.H) { this.needCenter = true; return; }
    this.needCenter = false;
    const rs = this.track.notes.map(n => this.rowOf(n.midi)).filter(r => r >= 0);
    const mid = rs.length ? (Math.min(...rs) + Math.max(...rs)) / 2 : this.rowOf(this.track.isDrum ? 38 : 60);
    this.sy = mid * this.rh - (this.H - this.rulerH) / 2;
    this.sx = 0;
    this.clamp();
  }

  zoom(f, anchorX = this.keyW) {
    const step = (anchorX - this.keyW + this.sx) / this.cw;
    this.cw = Math.min(60, Math.max(6, this.cw * f));
    this.sx = step * this.cw - (anchorX - this.keyW);
    this.clamp();
    this.dirty = true;
  }

  pos(e) {
    const r = this.c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  cellAt(x, y) {
    return {
      step: Math.floor((x - this.keyW + this.sx) / this.cw),
      row: Math.floor((y - this.rulerH + this.sy) / this.rh),
    };
  }
  noteRect(n) {
    const r = this.rowOf(n.midi);
    if (r < 0) return null;
    return { x: this.keyW + n.start * this.cw - this.sx, y: this.rulerH + r * this.rh - this.sy, w: n.dur * this.cw, h: this.rh };
  }
  hit(x, y) {
    const notes = this.track.notes;
    for (let i = notes.length - 1; i >= 0; i--) {
      const R = this.noteRect(notes[i]);
      if (R && x >= R.x && x <= R.x + R.w && y >= R.y && y < R.y + R.h)
        return { n: notes[i], edge: x >= R.x + R.w - Math.min(7, R.w * 0.35) };
    }
    return null;
  }
  selectedNotes() { return this.track.notes.filter(n => this.sel.has(n.id)); }

  deleteNotes(ids) {
    this.h.beforeEdit();
    this.track.notes = this.track.notes.filter(n => !ids.has(n.id));
    ids.forEach(id => this.sel.delete(id));
    this.h.changed();
    this.dirty = true;
  }

  onDown(e) {
    if (!this.track || e.button === 2) return;
    this.c.focus();
    const { x, y } = this.pos(e);
    if (y < this.rulerH) {
      if (x > this.keyW) {
        this.h.seek(Math.max(0, Math.min(this.steps - 1, this.cellAt(x, y).step)));
        this.drag = { mode: 'seek' };
        this.c.setPointerCapture(e.pointerId);
      }
      return;
    }
    if (x < this.keyW) {
      const m = this.rows[this.cellAt(x, y).row];
      if (m != null) this.h.preview(m, this.vel);
      return;
    }
    const hit = this.hit(x, y);
    if (hit && e.altKey) { this.deleteNotes(new Set([hit.n.id])); return; }
    this.c.setPointerCapture(e.pointerId);

    if (hit) {
      if (e.shiftKey) {
        this.sel.has(hit.n.id) ? this.sel.delete(hit.n.id) : this.sel.add(hit.n.id);
      } else if (!this.sel.has(hit.n.id)) {
        this.sel = new Set([hit.n.id]);
      }
      if (!this.sel.has(hit.n.id)) { this.dirty = true; return; }
      this.startDrag(hit.edge ? 'resize' : 'move', x, y, hit.n);
      this.h.preview(hit.n.midi, hit.n.vel);
    } else if (e.shiftKey) {
      this.drag = { mode: 'marquee', x0: x, y0: y, x1: x, y1: y, base: new Set(this.sel) };
    } else {
      const { step, row } = this.cellAt(x, y);
      const midi = this.rows[row];
      if (midi == null || step < 0 || step >= this.steps) return;
      this.h.beforeEdit();
      const n = { id: Gen.uid(), midi, start: step, dur: this.noteLen, vel: this.vel };
      this.track.notes.push(n);
      this.sel = new Set([n.id]);
      this.startDrag('resize', x, y, n);
      this.drag.changed = true;
      this.h.preview(midi, this.vel);
      this.h.changed();
    }
    this.dirty = true;
  }

  startDrag(mode, x, y, lead) {
    const orig = new Map();
    for (const n of this.selectedNotes()) orig.set(n, { start: n.start, dur: n.dur, row: this.rowOf(n.midi) });
    this.drag = { mode, x0: x, y0: y, orig, lead, changed: false, last: '0,0' };
  }

  onMove(e) {
    if (!this.track) return;
    const { x, y } = this.pos(e);
    const d = this.drag;
    if (!d) {
      const hit = x > this.keyW && y > this.rulerH ? this.hit(x, y) : null;
      this.c.style.cursor = hit ? (hit.edge ? 'ew-resize' : 'grab') : (y < this.rulerH ? 'pointer' : 'crosshair');
      return;
    }
    if (d.mode === 'seek') {
      this.h.seek(Math.max(0, Math.min(this.steps - 1, this.cellAt(x, y).step)));
      return;
    }
    if (d.mode === 'marquee') {
      Object.assign(d, { x1: x, y1: y });
      const [ax, bx] = [Math.min(d.x0, x), Math.max(d.x0, x)];
      const [ay, by] = [Math.min(d.y0, y), Math.max(d.y0, y)];
      this.sel = new Set(d.base);
      for (const n of this.track.notes) {
        const R = this.noteRect(n);
        if (R && R.x < bx && R.x + R.w > ax && R.y < by && R.y + R.h > ay) this.sel.add(n.id);
      }
      this.dirty = true;
      return;
    }

    let dx = Math.round((x - d.x0) / this.cw);
    let dy = d.mode === 'move' ? Math.round((y - d.y0) / this.rh) : 0;
    const os = [...d.orig.values()];
    if (d.mode === 'move') {
      const minStart = Math.min(...os.map(o => o.start));
      const maxEnd = Math.max(...os.map(o => o.start));
      dx = Math.max(-minStart, Math.min(this.steps - 1 - maxEnd, dx));
      const minRow = Math.min(...os.map(o => o.row)), maxRow = Math.max(...os.map(o => o.row));
      dy = Math.max(-minRow, Math.min(this.rows.length - 1 - maxRow, dy));
    }
    const key = dx + ',' + dy;
    if (key === d.last) return;
    if (!d.changed) { this.h.beforeEdit(); d.changed = true; }
    d.last = key;
    for (const [n, o] of d.orig) {
      if (d.mode === 'move') { n.start = o.start + dx; n.midi = this.rows[o.row + dy]; }
      else n.dur = Math.max(1, o.dur + dx);
    }
    if (d.mode === 'move' && dy !== 0 && d.lead) this.h.preview(d.lead.midi, d.lead.vel);
    this.h.changed();
    this.dirty = true;
  }

  onUp(e) {
    if (this.drag?.mode === 'marquee') this.dirty = true;
    this.drag = null;
    if (this.c.hasPointerCapture?.(e.pointerId)) this.c.releasePointerCapture(e.pointerId);
    this.h.selectionChanged?.();
  }

  onContext(e) {
    e.preventDefault();
    if (!this.track) return;
    const { x, y } = this.pos(e);
    const hit = this.hit(x, y);
    if (!hit) return;
    this.deleteNotes(this.sel.has(hit.n.id) ? new Set(this.sel) : new Set([hit.n.id]));
  }

  onWheel(e) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) { this.zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, this.pos(e).x); return; }
    let dx = e.deltaX, dy = e.deltaY;
    if (e.shiftKey && !dx) { dx = dy; dy = 0; }
    this.sx += dx; this.sy += dy;
    this.clamp();
    this.dirty = true;
  }

  onKey(e) {
    if (!this.track) return;
    const mod = e.metaKey || e.ctrlKey;
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.sel.size) {
      e.preventDefault();
      this.deleteNotes(new Set(this.sel));
    } else if (mod && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      this.sel = new Set(this.track.notes.map(n => n.id));
      this.dirty = true;
    } else if (e.key === 'Escape') {
      this.sel.clear();
      this.dirty = true;
    } else if (e.key.startsWith('Arrow') && this.sel.size) {
      e.preventDefault();
      const notes = this.selectedNotes();
      const big = e.shiftKey;
      const dx = e.key === 'ArrowLeft' ? -(big ? 4 : 1) : e.key === 'ArrowRight' ? (big ? 4 : 1) : 0;
      const dy = e.key === 'ArrowUp' ? -(big && !this.track.isDrum ? 12 : 1) : e.key === 'ArrowDown' ? (big && !this.track.isDrum ? 12 : 1) : 0;
      const ok = notes.every(n => {
        const r = this.rowOf(n.midi) + dy, s = n.start + dx;
        return r >= 0 && r < this.rows.length && s >= 0 && s < this.steps;
      });
      if (!ok) return;
      this.h.beforeEdit();
      notes.forEach(n => { n.start += dx; n.midi = this.rows[this.rowOf(n.midi) + dy]; });
      if (dy) this.h.preview(notes[0].midi, notes[0].vel);
      this.h.changed();
      this.dirty = true;
    }
  }

  draw(playStep) {
    const g = this.g, dpr = devicePixelRatio || 1, W = this.W, H = this.H;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#12141a';
    g.fillRect(0, 0, W, H);
    const t = this.track;
    if (!t) return;
    const { cw, rh, sx, sy, rulerH } = this;
    const keyW = this.keyW, rows = this.rows, steps = this.steps;
    const r0 = Math.max(0, Math.floor(sy / rh));
    const r1 = Math.min(rows.length - 1, Math.floor((sy + H - rulerH) / rh));

    g.save();
    g.beginPath(); g.rect(keyW, rulerH, W - keyW, H - rulerH); g.clip();
    for (let r = r0; r <= r1; r++) {
      const m = rows[r], y = rulerH + r * rh - sy;
      const dark = t.isDrum ? r % 2 : BLACK.has(m % 12);
      g.fillStyle = dark ? '#181b22' : '#1e222b';
      g.fillRect(keyW, y, W - keyW, rh);
      g.fillStyle = !t.isDrum && m % 12 === 0 ? '#3a4152' : '#15181e';
      g.fillRect(keyW, y + rh - 1, W - keyW, 1);
    }
    const s0 = Math.max(0, Math.floor(sx / cw));
    const s1 = Math.min(steps, Math.ceil((sx + W - keyW) / cw));
    g.lineWidth = 1;
    for (let s = s0; s <= s1; s++) {
      if (s % 16 === 0) g.strokeStyle = '#4b546a';
      else if (s % 4 === 0) g.strokeStyle = '#2d3340';
      else if (cw >= 10) g.strokeStyle = '#23272f';
      else continue;
      const x = Math.round(keyW + s * cw - sx) + 0.5;
      g.beginPath(); g.moveTo(x, rulerH); g.lineTo(x, H); g.stroke();
    }
    const endX = keyW + steps * cw - sx;
    if (endX < W) { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(endX, rulerH, W - endX, H - rulerH); }

    g.font = '10px ui-monospace, Menlo, monospace';
    g.textBaseline = 'middle';
    for (const n of t.notes) {
      const R = this.noteRect(n);
      if (!R || R.x > W || R.x + R.w < keyW || R.y > H || R.y + R.h < rulerH) continue;
      const selected = this.sel.has(n.id);
      g.globalAlpha = 0.35 + 0.65 * n.vel;
      g.fillStyle = t.color;
      g.beginPath(); g.roundRect(R.x + 0.5, R.y + 1, Math.max(3, R.w - 1), R.h - 2, 3); g.fill();
      g.globalAlpha = 1;
      g.lineWidth = selected ? 2 : 1;
      g.strokeStyle = selected ? '#ffffff' : 'rgba(0,0,0,.45)';
      g.stroke();
      if (R.w > 30 && !t.isDrum) {
        g.fillStyle = 'rgba(0,0,0,.65)';
        g.fillText(midiName(n.midi), R.x + 4, R.y + rh / 2);
      }
    }
    g.lineWidth = 1;

    const d = this.drag;
    if (d?.mode === 'marquee') {
      g.setLineDash([4, 3]);
      g.strokeStyle = '#9ecbff';
      g.fillStyle = 'rgba(120,170,255,.12)';
      const rx = Math.min(d.x0, d.x1), ry = Math.min(d.y0, d.y1);
      g.fillRect(rx, ry, Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0));
      g.strokeRect(rx + 0.5, ry + 0.5, Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0));
      g.setLineDash([]);
    }
    const px = playStep != null ? keyW + playStep * cw - sx : null;
    if (px != null) {
      g.strokeStyle = '#ffd166'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(px, rulerH); g.lineTo(px, H); g.stroke();
    }
    g.restore();

    // 鍵盤
    g.fillStyle = '#16181f';
    g.fillRect(0, rulerH, keyW, H - rulerH);
    g.font = '10px system-ui, sans-serif';
    for (let r = r0; r <= r1; r++) {
      const m = rows[r], y = rulerH + r * rh - sy;
      if (t.isDrum) {
        g.fillStyle = r % 2 ? '#1c1f27' : '#22262f';
        g.fillRect(0, y, keyW - 1, rh);
        g.fillStyle = DRUM_VOICE[m] || m === 42 || m === 46 ? '#d6dae3' : '#7f8696';
        g.fillText(`${m} ${GM_DRUMS[m] || ''}`, 6, y + rh / 2);
      } else {
        const black = BLACK.has(m % 12);
        g.fillStyle = black ? '#2a2e38' : '#d8dbe2';
        g.fillRect(0, y, black ? keyW * 0.62 : keyW - 1, rh - 1);
        if (black) { g.fillStyle = '#d8dbe2'; g.fillRect(keyW * 0.62, y, keyW * 0.38 - 1, rh - 1); }
        if (m % 12 === 0) { g.fillStyle = '#333a48'; g.fillText(midiName(m), keyW - 26, y + rh / 2); }
      }
    }
    g.fillStyle = '#0c0d11';
    g.fillRect(keyW - 1, rulerH, 1, H - rulerH);

    // 時間尺
    g.fillStyle = '#1a1d25';
    g.fillRect(0, 0, W, rulerH);
    g.save();
    g.beginPath(); g.rect(keyW, 0, W - keyW, rulerH); g.clip();
    g.fillStyle = '#9aa3b5';
    g.font = '11px system-ui, sans-serif';
    for (let s = s0 - (s0 % 4); s <= s1; s += 4) {
      const x = Math.round(keyW + s * cw - sx) + 0.5;
      const isBar = s % 16 === 0;
      g.fillStyle = isBar ? '#7d879c' : '#454c5c';
      g.fillRect(x, isBar ? 4 : 14, 1, isBar ? rulerH - 4 : rulerH - 14);
      if (isBar) { g.fillStyle = '#c3cad8'; g.fillText(String(s / 16 + 1), x + 4, 11); }
    }
    if (px != null) {
      g.fillStyle = '#ffd166';
      g.beginPath(); g.moveTo(px - 5, rulerH - 8); g.lineTo(px + 5, rulerH - 8); g.lineTo(px, rulerH); g.fill();
    }
    g.restore();
    g.fillStyle = '#2a2f3a';
    g.fillRect(0, rulerH - 1, W, 1);
  }
}

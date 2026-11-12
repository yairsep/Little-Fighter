'use strict';
/* ---------- shared constants & helpers ---------- */
const W = 960, H = 540;          // logical canvas size
const GY = 322;                  // screen y of the back edge of the walkable floor
const ZMAX = 188;                // depth of the walkable floor
const GRAV = 0.6;
const TAU = Math.PI * 2;
const TEAM_COLORS = ['#4aa3ff', '#ff5d5d', '#5bd66b', '#ffc94a'];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];
const sign = v => (v < 0 ? -1 : v > 0 ? 1 : 0);
const hash = (i, seed = 0) => {            // deterministic 0..1 noise for scenery
  const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/* ---------- sound: everything is synthesised with WebAudio ---------- */
const Sfx = (() => {
  let ac = null, master = null, muted = false, musicTimer = null, step = 0, nextT = 0;
  const last = {};

  function ctx() {
    if (!ac) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ac = new C();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, dur, type = 'square', vol = 0.2, slide = 0, when = 0) {
    const t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  let noiseBuf = null;
  function noise(dur, vol, f0, f1, type = 'lowpass', when = 0) {
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ac.currentTime + when, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; s.loop = true;
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  const defs = {
    swing: () => noise(0.09, 0.14, 2600, 500, 'bandpass'),
    hit: () => { noise(0.08, 0.35, 1800, 300); tone(150, 0.1, 'sine', 0.4, -90); },
    heavy: () => { noise(0.16, 0.45, 1400, 120); tone(110, 0.2, 'sine', 0.5, -70); },
    block: () => { tone(880, 0.05, 'square', 0.1); noise(0.05, 0.15, 3000, 1500, 'highpass'); },
    jump: () => tone(280, 0.12, 'square', 0.08, 320),
    land: () => noise(0.07, 0.2, 420, 90),
    shot: () => tone(720, 0.2, 'sawtooth', 0.11, -520),
    fire: () => { noise(0.35, 0.25, 1000, 180); tone(200, 0.3, 'sawtooth', 0.08, -120); },
    ice: () => { tone(1800, 0.16, 'triangle', 0.15, -900); tone(2500, 0.1, 'sine', 0.1, -600, 0.04); },
    shatter: () => { noise(0.22, 0.3, 6000, 1800, 'highpass'); tone(1300, 0.1, 'triangle', 0.12, -700); },
    boom: () => { noise(0.5, 0.5, 600, 40); tone(85, 0.45, 'sine', 0.5, -50); },
    wind: () => noise(0.22, 0.2, 800, 3200, 'bandpass'),
    tele: () => tone(1300, 0.16, 'sine', 0.14, -1100),
    dark: () => { tone(160, 0.3, 'sawtooth', 0.1, 120); tone(164, 0.3, 'sawtooth', 0.1, 110); },
    heal: () => { tone(520, 0.1, 'sine', 0.15); tone(780, 0.16, 'sine', 0.15, 0, 0.08); },
    pickup: () => { tone(660, 0.07, 'square', 0.1); tone(990, 0.12, 'square', 0.1, 0, 0.07); },
    ko: () => tone(320, 0.55, 'sawtooth', 0.18, -270),
    ui: () => tone(520, 0.05, 'square', 0.07),
    nomp: () => tone(120, 0.09, 'square', 0.1),
    start: () => [392, 523, 659, 784].forEach((f, i) => tone(f, 0.12, 'square', 0.1, 0, i * 0.08)),
    win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.16, 'square', 0.1, 0, i * 0.12)),
    lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.25, 'triangle', 0.16, 0, i * 0.2)),
  };
  function play(name) {
    if (muted || !ctx()) return;
    const now = performance.now();
    if (now - (last[name] || 0) < 35) return;
    last[name] = now;
    defs[name] && defs[name]();
  }

  /* a small looping backing track (original pattern, A minor) */
  const ROOTS = [45, 45, 48, 43, 45, 45, 41, 43];
  const LEAD = [
    [69, 0, 72, 0, 76, 0, 72, 74, 0, 72, 0, 69, 0, 67, 69, 0],
    [0, 0, 69, 72, 0, 76, 0, 79, 0, 76, 0, 74, 72, 0, 0, 0],
    [72, 0, 76, 0, 79, 0, 76, 77, 0, 76, 0, 72, 0, 71, 72, 0],
    [71, 0, 67, 0, 71, 0, 74, 0, 79, 0, 74, 0, 71, 0, 67, 0],
    [69, 0, 0, 72, 0, 0, 76, 0, 81, 0, 79, 0, 76, 0, 72, 0],
    [0, 76, 0, 74, 0, 72, 0, 69, 0, 0, 72, 0, 74, 0, 76, 0],
    [77, 0, 72, 0, 69, 0, 72, 0, 77, 0, 81, 0, 79, 0, 77, 0],
    [79, 0, 0, 74, 0, 0, 71, 0, 74, 0, 79, 0, 83, 0, 79, 0],
  ];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function tick() {
    if (!ac || muted) return;
    const sixteenth = 60 / 126 / 4;
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05;
    while (nextT < ac.currentTime + 0.2) {
      const bar = (step >> 4) % ROOTS.length, s = step & 15, when = nextT - ac.currentTime;
      if ([0, 3, 6, 8, 11, 14].includes(s)) tone(mtof(ROOTS[bar] - (s === 6 || s === 14 ? 0 : 12) + 12), 0.16, 'triangle', 0.16, 0, when);
      const n = LEAD[bar][s];
      if (n) tone(mtof(n), 0.13, 'square', 0.035, 0, when);
      if (s % 4 === 2) noise(0.03, 0.05, 7000, 5000, 'highpass', when);
      if (s % 8 === 0) tone(110, 0.08, 'sine', 0.22, -60, when);
      if (s % 8 === 4) noise(0.08, 0.1, 1800, 600, 'bandpass', when);
      nextT += sixteenth; step++;
    }
  }
  return {
    play,
    unlock() { if (ctx() && !musicTimer) musicTimer = setInterval(tick, 60); },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    get muted() { return muted; },
  };
})();

/* ---------- keyboard / touch input ---------- */
const Keys = { down: new Set(), pressed: new Set() };
const BINDINGS = [
  { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], atk: ['KeyF'], jmp: ['KeyG'], def: ['KeyH'] },
  { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    atk: ['Comma', 'Numpad1'], jmp: ['Period', 'Numpad2'], def: ['Slash', 'Numpad3'] },
];
const GAME_CODES = new Set(BINDINGS.flatMap(b => Object.values(b).flat()).concat(['Space']));
addEventListener('keydown', e => {
  if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (GAME_CODES.has(e.code)) e.preventDefault();
  if (!e.repeat) { Keys.down.add(e.code); Keys.pressed.add(e.code); }
});
addEventListener('keyup', e => Keys.down.delete(e.code));
addEventListener('blur', () => Keys.down.clear());

const NO_INPUT = { mx: 0, mz: 0, atk: false, jmp: false, def: false, run: false };

class HumanInput {
  constructor(idx) { this.b = BINDINGS[idx]; this.frame = 0; this.prevMx = 0; this.tapDir = 0; this.tapT = -99; this.run = 0; }
  poll() {
    this.frame++;
    const d = Keys.down, p = Keys.pressed, b = this.b, any = (l, s) => l.some(c => s.has(c));
    const mx = (any(b.right, d) ? 1 : 0) - (any(b.left, d) ? 1 : 0);
    const mz = (any(b.down, d) ? 1 : 0) - (any(b.up, d) ? 1 : 0);
    if (mx !== 0 && this.prevMx === 0) {            // double-tap a direction to run
      if (this.tapDir === mx && this.frame - this.tapT < 16) this.run = mx;
      this.tapDir = mx; this.tapT = this.frame;
    }
    if (mx !== this.run) this.run = 0;
    this.prevMx = mx;
    return { mx, mz, atk: any(b.atk, p), jmp: any(b.jmp, p), def: any(b.def, d), run: this.run !== 0 };
  }
}

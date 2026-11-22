/* =========================================================
   SUPERCAR GP — carreras arcade estilo retro con gráficos modernos
   Motor pseudo-3D. Todo se dibuja con vectores a la resolución del móvil.
   ========================================================= */
'use strict';

const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
let W = 0, H = 0, PX = 1, XS = 1, YS = 1;

/* ---------- Guardado (Android o navegador) ---------- */
const Store = {
  get(k, d) {
    try {
      let v = null;
      if (window.Android && Android.load) v = Android.load(k);
      else v = localStorage.getItem(k);
      return (v === null || v === undefined || v === '') ? d : JSON.parse(v);
    } catch (e) { return d; }
  },
  set(k, v) {
    try {
      const s = JSON.stringify(v);
      if (window.Android && Android.save) Android.save(k, s); else localStorage.setItem(k, s);
    } catch (e) {}
  }
};
function vibrate(ms) {
  if (!save.vib) return;
  try { if (window.Android && Android.vibrate) Android.vibrate(ms); else if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
}
const DEFAULTS = {
  credits: 0, owned: [0], car: 0, colors: {}, unlocked: 1, best: {}, bestLap: {}, podiums: {},
  music: true, sfx: true, vib: true, autoGas: true, tilt: false, diff: 1, q: 1, lastTrack: 0
};
const save = Object.assign({}, DEFAULTS, Store.get('supercargp', {}));
function persist() { Store.set('supercargp', save); }

/* ---------- Utilidades ---------- */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const mod = (v, m) => ((v % m) + m) % m;
const easeIn = (a, b, p) => a + (b - a) * p * p;
const easeInOut = (a, b, p) => a + (b - a) * ((-Math.cos(p * Math.PI) / 2) + 0.5);
const overlap = (x1, w1, x2, w2) => Math.abs(x1 - x2) < (w1 + w2) / 2;
function hexRGB(hex) { const c = parseInt(hex.slice(1), 16); return [c >> 16, (c >> 8) & 255, c & 255]; }
function shade(hex, a) {
  let [r, g, b] = hexRGB(hex);
  if (a < 0) { r *= 1 + a; g *= 1 + a; b *= 1 + a; } else { r += (255 - r) * a; g += (255 - g) * a; b += (255 - b) * a; }
  return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
}
function rgba(hex, a) { const [r, g, b] = hexRGB(hex); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }
function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
let seed = 1;
function srand(s) { seed = (s >>> 0) || 1; }
function rnd() { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; }
function fmtTime(t) {
  if (!isFinite(t) || t <= 0) return '--:--.--';
  const m = Math.floor(t / 60), s = t - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
}
function fmtNum(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  PX = dpr * save.q;
  W = Math.round(window.innerWidth * PX); H = Math.round(window.innerHeight * PX);
  cv.width = W; cv.height = H;
  XS = Math.min(W / 2, H * 0.95); YS = H / 2;
  BG.cache = null; vignette = null; carCache.clear();
  if (typeof BTN !== 'undefined') layoutButtons();
}

/* =========================================================
   SONIDO — todo sintetizado, sin archivos
   ========================================================= */
const mf = n => 440 * Math.pow(2, (n - 69) / 12);
const SONGS = [
  { bpm: 100, prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]] },   // menú
  { bpm: 132, prog: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]] },   // carrera
  { bpm: 116, prog: [[52, 55, 59], [48, 52, 55], [55, 59, 62], [50, 54, 57]] }    // resultados
];
const AU = {
  ac: null, master: null, musG: null, sfxG: null, nb: null, song: null, want: null, nextT: 0, step: 0, eng: null,
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ac = new AC();
      this.master = this.ac.createGain(); this.master.gain.value = 0.7; this.master.connect(this.ac.destination);
      this.musG = this.ac.createGain(); this.musG.connect(this.master);
      this.sfxG = this.ac.createGain(); this.sfxG.connect(this.master);
      this.setVol();
      const n = this.ac.sampleRate * 2;
      this.nb = this.ac.createBuffer(1, n, this.ac.sampleRate);
      const d = this.nb.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      if (this.want !== null) { const w = this.want; this.song = null; this.playSong(w); }
    } catch (e) { this.ac = null; }
  },
  setVol() {
    if (!this.ac) return;
    this.musG.gain.value = save.music ? 0.26 : 0;
    this.sfxG.gain.value = save.sfx ? 0.9 : 0;
  },
  _tone(at, f, dur, type, vol, slide, dest) {
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, at);
    if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, f + slide), at + dur);
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    o.connect(g); g.connect(dest || this.sfxG); o.start(at); o.stop(at + dur + 0.03);
  },
  _noise(at, dur, vol, ft, fq, dest) {
    const s = this.ac.createBufferSource(); s.buffer = this.nb;
    const f = this.ac.createBiquadFilter(); f.type = ft; f.frequency.value = fq;
    const g = this.ac.createGain(); g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxG); s.start(at, Math.random() * 1.5); s.stop(at + dur + 0.03);
  },
  tone(f, dur, type, vol, slide, delay) { if (this.ac) this._tone(this.ac.currentTime + (delay || 0), f, dur, type, vol, slide); },
  noise(dur, vol, ft, fq) { if (this.ac) this._noise(this.ac.currentTime, dur, vol, ft, fq); },
  click() { this.tone(700, 0.06, 'square', 0.1); },
  beep(hi) { this.tone(hi ? 1046 : 523, hi ? 0.6 : 0.25, 'square', 0.22); },
  crash() { this.noise(0.6, 0.7, 'lowpass', 1200); this.tone(90, 0.35, 'sawtooth', 0.3, -50); },
  bump() { this.noise(0.18, 0.45, 'lowpass', 700); this.tone(140, 0.12, 'square', 0.15, -60); },
  coin() { this.tone(988, 0.08, 'square', 0.14); this.tone(1319, 0.3, 'square', 0.14, 0, 0.08); },
  nitro() { this.noise(0.7, 0.35, 'highpass', 1500); this.tone(200, 0.6, 'sawtooth', 0.12, 500); },
  lap() { [784, 988, 1175].forEach((f, i) => this.tone(f, 0.18, 'square', 0.14, 0, i * 0.09)); },
  win() { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'square', 0.15, 0, i * 0.12)); },
  engineOn() {
    if (!this.ac || this.eng) return;
    const a = this.ac, e = {};
    e.o1 = a.createOscillator(); e.o1.type = 'sawtooth';
    e.o2 = a.createOscillator(); e.o2.type = 'square';
    e.o3 = a.createOscillator(); e.o3.type = 'sawtooth';
    e.f = a.createBiquadFilter(); e.f.type = 'lowpass'; e.f.frequency.value = 500; e.f.Q.value = 5;
    e.g = a.createGain(); e.g.gain.value = 0;
    const m2 = a.createGain(); m2.gain.value = 0.6;
    e.o1.connect(e.f); e.o2.connect(m2); m2.connect(e.f); e.o3.connect(e.f); e.f.connect(e.g); e.g.connect(this.sfxG);
    const mkN = (type, fq, q) => {
      const s = a.createBufferSource(); s.buffer = this.nb; s.loop = true;
      const f = a.createBiquadFilter(); f.type = type; f.frequency.value = fq; f.Q.value = q;
      const g = a.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.sfxG); s.start(); return [s, g];
    };
    [e.ns, e.ng] = mkN('bandpass', 2600, 4);   // derrape
    [e.ws, e.wg] = mkN('highpass', 900, 0.7);  // viento / nitro
    e.o1.start(); e.o2.start(); e.o3.start();
    this.eng = e;
  },
  engineSet(rpm, load, skid, wind) {
    const e = this.eng; if (!e) return;
    const t = this.ac.currentTime, f = 36 + rpm * 150;
    e.o1.frequency.setTargetAtTime(f, t, 0.04);
    e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.04);
    e.o3.frequency.setTargetAtTime(f * 1.012, t, 0.04);
    e.f.frequency.setTargetAtTime(280 + rpm * 1400 + load * 900, t, 0.05);
    e.g.gain.setTargetAtTime(0.045 + load * 0.05 + rpm * 0.035, t, 0.05);
    e.ng.gain.setTargetAtTime(skid * 0.16, t, 0.05);
    e.wg.gain.setTargetAtTime(wind * 0.1, t, 0.1);
  },
  engineOff() {
    const e = this.eng; if (!e) return; this.eng = null;
    const t = this.ac.currentTime;
    e.g.gain.setTargetAtTime(0, t, 0.05); e.ng.gain.setTargetAtTime(0, t, 0.05); e.wg.gain.setTargetAtTime(0, t, 0.05);
    setTimeout(() => { try { e.o1.stop(); e.o2.stop(); e.o3.stop(); e.ns.stop(); e.ws.stop(); } catch (x) {} }, 400);
  },
  playSong(i) {
    this.want = i;
    if (!this.ac || this.song === i) return;
    this.song = i; this.step = 0; this.nextT = this.ac.currentTime + 0.06;
  },
  stopSong() { this.song = null; this.want = null; },
  _kick(t) {
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.14);
    g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g); g.connect(this.musG); o.start(t); o.stop(t + 0.2);
  },
  tick() {
    if (!this.ac || this.song === null || this.ac.state !== 'running') return;
    const s = SONGS[this.song], sp = 60 / s.bpm / 4;
    if (this.nextT < this.ac.currentTime - 0.5) this.nextT = this.ac.currentTime + 0.05;
    while (this.nextT < this.ac.currentTime + 0.2) {
      const st = this.step, i = st % 16, ch = s.prog[Math.floor(st / 16) % s.prog.length], t = this.nextT;
      if (i % 4 === 0) this._kick(t);
      if (i === 4 || i === 12) this._noise(t, 0.14, 0.22, 'highpass', 1600, this.musG);
      if (i % 2 === 0) this._noise(t, 0.035, 0.07, 'highpass', 7000, this.musG);
      if (i % 2 === 0) this._tone(t, mf(ch[0] - 24 + (i % 4 === 2 ? 12 : 0)), sp * 1.7, 'sawtooth', 0.14, 0, this.musG);
      const arp = [0, 1, 2, 1, 0, 2, 1, 2];
      this._tone(t, mf(ch[arp[i % 8]] + 12), sp * 0.9, 'square', 0.04, 0, this.musG);
      if (i === 0) for (const n of ch) this._tone(t, mf(n), sp * 15, 'triangle', 0.045, 0, this.musG);
      if (this.song === 1 && (i === 0 || i === 6 || i === 10)) this._tone(t, mf(ch[(i / 4 | 0) % 3] + 24), sp * 2.5, 'sawtooth', 0.025, 0, this.musG);
      this.nextT += sp; this.step++;
    }
  }
};

/* =========================================================
   DATOS: coches, pinturas, circuitos y ambientes
   ========================================================= */
const PAINT = ['#d0101c', '#f4f4f4', '#f5c400', '#1d5fe0', '#a4adb7', '#161616', '#ff4fa3', '#1fa34a', '#ff7a00', '#7b2cff'];
const CARS = [
  { name: 'Rosso Furia',  tag: 'V12 italiano',          top: 318, acc: 1.00, hand: 1.00, nitro: 3.5, price: 0,     paint: 0,
    st: { w: 1.00, roof: 0.50, wing: false, lights: 'quad',  angular: false, louvers: false, exh: 'quad' } },
  { name: 'Toro Veleno',  tag: 'V10 de ataque',         top: 332, acc: 1.06, hand: 0.94, nitro: 3.6, price: 2500,  paint: 2,
    st: { w: 1.03, roof: 0.42, wing: false, lights: 'slash', angular: true,  louvers: true,  exh: 'center' } },
  { name: 'Silber Pfeil', tag: 'GT alemán',             top: 314, acc: 1.12, hand: 1.16, nitro: 3.9, price: 4500,  paint: 4,
    st: { w: 0.97, roof: 0.56, wing: true,  lights: 'strip', angular: false, louvers: false, exh: 'twin' } },
  { name: 'Blue Vortex',  tag: 'Biturbo británico',     top: 336, acc: 1.18, hand: 1.06, nitro: 4.2, price: 7000,  paint: 3,
    st: { w: 1.00, roof: 0.47, wing: false, lights: 'ring',  angular: false, louvers: true,  exh: 'twin' } },
  { name: 'Nero Hyper',   tag: 'Hiperdeportivo híbrido', top: 352, acc: 1.26, hand: 1.12, nitro: 4.8, price: 11000, paint: 5,
    st: { w: 1.04, roof: 0.44, wing: true,  lights: 'strip', angular: true,  louvers: true,  exh: 'center' } },
  { name: 'Piruleta GT',  tag: 'Edición La Piruleta',    top: 366, acc: 1.32, hand: 1.20, nitro: 5.5, price: 16000, paint: 6,
    st: { w: 1.02, roof: 0.46, wing: true,  lights: 'ring',  angular: false, louvers: false, exh: 'quad' } }
];
const RIVAL_NAMES = ['L. Vega', 'M. Bellini', 'K. Sato', 'A. Ruiz', 'T. Becker', 'É. Moreau', 'D. Paz', 'S. Lund', 'R. Costa', 'J. Hart'];

const THEMES = {
  park: {
    sky: ['#2c78d4', '#a8dbff'], sun: { x: 0.78, y: 0.14, r: 0.05, c: '#fffbe6' }, clouds: 0.9,
    ground: ['#5aa83b', '#4e9a33'], road: ['#6c6c72', '#65656b'], rumble: ['#f2f2f2', '#d22b2b'], lane: '#f2f2f2', edge: '#f8f8f8',
    fog: '#a8dbff', fogD: 5, far: { type: 'mountains', c: '#86acd0', snow: true }, near: { type: 'hills', c: '#4a8a38' }
  },
  coast: {
    sky: ['#2f86dc', '#c4ecff'], sun: { x: 0.2, y: 0.12, r: 0.05, c: '#fffbe6' }, clouds: 0.5,
    ground: ['#cfc6b6', '#c4bba9'], road: ['#5c5c64', '#56565e'], rumble: ['#eeeeee', '#d61f2a'], lane: '#eeeeee', edge: '#ffffff',
    fog: '#c4ecff', fogD: 5, far: { type: 'sea', c: '#2a7fc0' }, near: { type: 'town', c: '#e8c7a0' }
  },
  sakura: {
    sky: ['#2e2160', '#ff9468'], sun: { x: 0.3, y: 0.36, r: 0.09, c: '#ffd27a' }, clouds: 0.35, cloudC: '#ffc2a8',
    ground: ['#5c9a48', '#548f43'], road: ['#646068', '#5d5961'], rumble: ['#f5f0f0', '#d8314a'], lane: '#f4ecec', edge: '#fff4f4',
    fog: '#f0a07c', fogD: 5, far: { type: 'fuji', c: '#6a5a8c' }, near: { type: 'hills', c: '#3d5e46' }
  },
  rain: {
    sky: ['#55606b', '#9aa4ad'], sun: null, clouds: 1, cloudC: '#c5ccd2', rain: true,
    ground: ['#3d7735', '#376d30'], road: ['#474b52', '#43474d'], rumble: ['#d8d8d8', '#b8262c'], lane: '#d8d8d8', edge: '#e0e0e0',
    fog: '#9aa4ad', fogD: 9, far: { type: 'forest', c: '#55705f' }, near: { type: 'forest', c: '#2f4f39' }
  },
  neon: {
    sky: ['#04030d', '#2b0f52'], sun: null, moon: { x: 0.8, y: 0.15, r: 0.035 }, stars: true, night: true, clouds: 0,
    ground: ['#15141d', '#111018'], road: ['#2b2a33', '#27262e'], rumble: ['#ff2bd6', '#1fe0ff'], lane: '#ffe36b', edge: '#ff2bd6',
    fog: '#2b0f52', fogD: 4, far: { type: 'skyline', c: '#1c1236' }, near: null
  },
  dry: {
    sky: ['#3f97e0', '#ffe4b3'], sun: { x: 0.66, y: 0.12, r: 0.05, c: '#fffbe6' }, clouds: 0.3,
    ground: ['#c8a25e', '#bd9854'], road: ['#6e6a66', '#67635f'], rumble: ['#f2f2f2', '#d22b2b'], lane: '#f2f2f2', edge: '#ffffff',
    fog: '#ffe4b3', fogD: 5, far: { type: 'mesas', c: '#c78c5a' }, near: { type: 'hills', c: '#a88448' }
  }
};

// [segmentos, curva (+ derecha), desnivel]
const TRACKS = [
  { name: 'Monza', country: 'Italia', theme: 'park', laps: 3, scale: 1.6,
    layout: [[60, 0, 0], [100, 0, 0], [24, -6, 0], [24, 6, 0], [120, 0, 0], [90, 3, 0], [140, 0, 8], [50, -5, 0], [60, 4, -8], [160, 0, 0], [30, -4, 0], [30, 5, 0], [30, -3, 0], [220, 0, 0], [110, 4.5, 0], [150, 0, 0]] },
  { name: 'Montecarlo', country: 'Mónaco', theme: 'coast', laps: 3, scale: 1.5,
    layout: [[60, 0, 0], [40, 4, 0], [90, 0, 25], [50, -3, 0], [40, 5, 0], [40, 0, -12], [30, -6, 0], [26, 7, 0], [30, -6, -10], [30, 5, 0], [180, 1.5, 0], [24, -5, 0], [24, 5, 0], [80, 0, -5], [30, 4, 0], [24, -4, 0], [24, 4, 0], [40, 0, 0], [30, -5, 0], [30, 5, 0], [60, 0, 0]] },
  { name: 'Suzuka', country: 'Japón', theme: 'sakura', laps: 3, scale: 1.6,
    layout: [[70, 0, 0], [50, 5, 10], [30, -4, 0], [30, 4, 0], [30, -4, 10], [30, 4, 0], [40, -3, 0], [60, 0, -15], [40, 5, 0], [60, 0, 0], [30, -6, -5], [100, 2, 0], [60, -5, 10], [200, 0, 0], [60, 2.5, 0], [30, -5, 0], [30, 5, 0], [60, 0, 0]] },
  { name: 'Spa', country: 'Bélgica', theme: 'rain', laps: 3, scale: 1.5,
    layout: [[60, 0, 0], [30, -7, 0], [60, 0, -18], [20, -3, 0], [30, 4, 14], [30, -3, 10], [220, 0, 0], [30, 5, 0], [30, -5, 0], [60, 0, -15], [50, 4, 0], [60, 0, -8], [60, -3, 0], [60, 0, 0], [40, 3, 0], [40, -3, 0], [60, 4, 0], [100, 1, 10], [60, 0, 0], [24, 5, 0], [24, -5, 0], [50, 0, 0]] },
  { name: 'Las Vegas', country: 'EE. UU.', theme: 'neon', laps: 3, scale: 1.6,
    layout: [[80, 0, 0], [30, -6, 0], [30, 6, 0], [80, 0, 0], [40, -6, 0], [100, 0, 0], [30, 6, 0], [30, -4, 0], [250, 0, 0], [40, 6, 0], [60, 0, 0], [30, -6, 0], [30, 6, 0], [120, 0, 0], [40, 6, 0], [80, 0, 0]] },
  { name: 'Jarama', country: 'España', theme: 'dry', laps: 3, scale: 1.5,
    layout: [[60, 0, 0], [40, 6, 0], [60, 0, 15], [40, -4, 0], [50, 3, -10], [40, -6, 0], [60, 0, 10], [50, 5, 0], [40, -5, -10], [100, 0, 0], [40, 6, 0], [30, -3, 0], [60, 0, -5], [50, 5, 0], [80, 0, 0]] }
];

/* =========================================================
   MOTOR DE CARRETERA
   ========================================================= */
const SEG = 200, RW = 2000, RUMBLE = 3, LANES = 3, DRAW = 280, CAMH = 1000;
const CAMD = 1 / Math.tan((100 / 2) * Math.PI / 180);
const PZ = CAMH * CAMD;
const CARW = 640, PW = CARW / RW, CARLEN = 260;
const BASEMAX = SEG * 60;          // ~320 km/h
const START = 20;                  // segmento de la línea de salida

let segments = [], trackLength = 0, track = null, theme = THEMES.park, trackIdx = -1;

function lastY() { return segments.length ? segments[segments.length - 1].p2.world.y : 0; }
function addSegment(curve, y) {
  const n = segments.length;
  segments.push({
    index: n, curve, sprites: [], cars: [], color: Math.floor(n / RUMBLE) % 2, clip: 0, fog: 1, looped: false,
    p1: { world: { x: 0, y: lastY(), z: n * SEG }, camera: {}, screen: {} },
    p2: { world: { x: 0, y: y, z: (n + 1) * SEG }, camera: {}, screen: {} }
  });
}
function addRoad(enter, hold, leave, curve, y) {
  const sy = lastY(), ey = sy + y * SEG, tot = enter + hold + leave;
  for (let i = 0; i < enter; i++) addSegment(easeIn(0, curve, i / enter), easeInOut(sy, ey, i / tot));
  for (let i = 0; i < hold; i++) addSegment(curve, easeInOut(sy, ey, (enter + i) / tot));
  for (let i = 0; i < leave; i++) addSegment(easeInOut(curve, 0, i / leave), easeInOut(sy, ey, (enter + hold + i) / tot));
}
function findSeg(z) { return segments[Math.floor(z / SEG) % segments.length]; }

/* buildTracks: construye el circuito elegido (trazado, desniveles y decorado) */
function buildTracks(ti) {
  if (trackIdx === ti && segments.length) return;
  trackIdx = ti; track = TRACKS[ti]; theme = THEMES[track.theme];
  segments = [];
  for (const [n, c, h] of track.layout) {
    const N = Math.round(n * track.scale), e = Math.max(4, Math.round(N * 0.25)), hold = Math.max(1, N - 2 * e);
    addRoad(e, hold, e, c, clamp(h, -0.28 * N, 0.28 * N));
  }
  const back = -lastY() / SEG, nb = Math.max(40, Math.ceil(Math.abs(back) / 0.28 / 3));
  addRoad(nb, nb, nb, 0, back);
  trackLength = segments.length * SEG;
  segments[START].start = segments[START + 1].start = true;
  decorate(ti);
  BG.cache = null;
}

/* ---------- Decorado de cada circuito ---------- */
function addSprite(i, type, offset) { if (i >= 0 && i < segments.length) segments[i].sprites.push({ type, offset }); }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }
function side() { return rnd() < 0.5 ? -1 : 1; }
function decorate(ti) {
  srand(1234 + ti * 7919);
  const N = segments.length, t = track.theme;
  addSprite(START, 'gantry', 0);
  const boards = ['board0', 'board1', 'board2', 'board3'];
  for (let i = 0; i < N; i++) {
    const c = segments[i].curve, out = c > 0 ? -1 : 1, near = i > START - 30 && i < START + 50;
    if (i % 110 === 30) addSprite(i, pick(boards), side() * 1.3);
    if (Math.abs(c) > 3.5 && i % 3 === 0 && t !== 'neon') addSprite(i, t === 'coast' ? 'wall' : 'tires', out * 1.14);
    if (near && i % 12 === 0 && t !== 'neon') { addSprite(i, 'stand', -2.1); addSprite(i, 'stand', 2.1); continue; }
    if (t === 'park') {
      if (i % 4 === 0 && rnd() < 0.85) addSprite(i, rnd() < 0.6 ? 'pine' : 'tree', side() * (1.5 + rnd() * 2.5));
      if (i % 9 === 0) addSprite(i, 'tree', side() * (4 + rnd() * 3));
      if (i % 13 === 0 && rnd() < 0.5) addSprite(i, 'bush', side() * (1.25 + rnd() * 0.3));
    } else if (t === 'coast') {
      if (i % 5 === 0) addSprite(i, 'house' + Math.floor(rnd() * 4), -(1.55 + rnd() * 0.5));
      if (i % 5 === 2) addSprite(i, 'house' + Math.floor(rnd() * 4), 1.55 + rnd() * 0.5);
      if (i % 8 === 4) addSprite(i, 'palm', side() * 1.3);
      if (i % 2 === 0 && Math.abs(c) <= 3.5) addSprite(i, 'rail', i % 4 === 0 ? -1.12 : 1.12);
    } else if (t === 'sakura') {
      if (i % 4 === 0 && rnd() < 0.8) addSprite(i, rnd() < 0.55 ? 'cherry' : 'pine', side() * (1.5 + rnd() * 2.5));
      if (i % 10 === 0) addSprite(i, 'cherry', side() * (4 + rnd() * 3));
      if (i % 24 === 12) addSprite(i, side() < 0 ? 'lampL' : 'lampR', 0);
    } else if (t === 'rain') {
      if (i % 3 === 0) addSprite(i, 'pineD', side() * (1.45 + rnd() * 2.8));
      if (i % 5 === 0) addSprite(i, 'pineD', side() * (4 + rnd() * 3));
      if (i % 2 === 0 && Math.abs(c) <= 3.5 && rnd() < 0.6) addSprite(i, 'rail', side() * 1.12);
    } else if (t === 'neon') {
      if (i % 4 === 0) addSprite(i, 'tower' + Math.floor(rnd() * 4), -(1.8 + rnd() * 1.2));
      if (i % 4 === 2) addSprite(i, 'tower' + Math.floor(rnd() * 4), 1.8 + rnd() * 1.2);
      if (i % 8 === 0) { addSprite(i, 'lampL', -1.14); addSprite(i, 'lampR', 1.14); }
    } else if (t === 'dry') {
      if (i % 7 === 0 && rnd() < 0.8) addSprite(i, 'olive', side() * (1.5 + rnd() * 3));
      if (i % 5 === 0 && rnd() < 0.7) addSprite(i, 'drybush', side() * (1.3 + rnd() * 2));
      if (i % 17 === 0) addSprite(i, 'rock', side() * (2 + rnd() * 3));
    }
  }
}

/* =========================================================
   ARTE: objetos del borde de la pista (vectores cacheados)
   ========================================================= */
function glowText(g, txt, x, y, size, col, glow) {
  g.save(); g.font = '900 ' + size + 'px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (glow) { g.shadowColor = glow; g.shadowBlur = size * 0.6; }
  g.fillStyle = col; g.fillText(txt, x, y); g.restore();
}
function artTrunk(g, cx, y0, y1, w) {
  const gr = g.createLinearGradient(cx - w, 0, cx + w, 0); gr.addColorStop(0, '#7a5232'); gr.addColorStop(1, '#3e2716');
  g.fillStyle = gr; g.fillRect(cx - w / 2, y0, w, y1 - y0);
}
function artPine(g, w, h, c) {
  const cx = w / 2; artTrunk(g, cx, h * 0.8, h, w * 0.1);
  for (let i = 0; i < 4; i++) {
    const y0 = h * (0.86 - i * 0.19), y1 = h * (0.86 - i * 0.19 - 0.34), hw = w * (0.48 - i * 0.095);
    const gr = g.createLinearGradient(cx - hw, 0, cx + hw, 0);
    gr.addColorStop(0, shade(c, 0.2)); gr.addColorStop(0.55, c); gr.addColorStop(1, shade(c, -0.45));
    g.fillStyle = gr; g.beginPath(); g.moveTo(cx - hw, y0); g.quadraticCurveTo(cx - hw * 0.3, y0 - h * 0.05, cx, Math.max(1, y1)); g.quadraticCurveTo(cx + hw * 0.3, y0 - h * 0.05, cx + hw, y0); g.closePath(); g.fill();
  }
}
function artBlobTree(g, w, h, c, hl) {
  const cx = w / 2; artTrunk(g, cx, h * 0.55, h, w * 0.1);
  const bl = [[0, 0.38, 0.3], [-0.22, 0.48, 0.22], [0.22, 0.46, 0.23], [-0.12, 0.24, 0.22], [0.14, 0.26, 0.21], [0, 0.14, 0.17]];
  for (const [dx, dy, r] of bl) {
    const x = cx + dx * w, y = dy * h, R = r * w;
    const gr = g.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R);
    gr.addColorStop(0, hl); gr.addColorStop(0.6, c); gr.addColorStop(1, shade(c, -0.4));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill();
  }
}
function artPalm(g, w, h) {
  g.lineCap = 'round';
  g.strokeStyle = '#8a6a44'; g.lineWidth = w * 0.07;
  g.beginPath(); g.moveTo(w * 0.5, h); g.quadraticCurveTo(w * 0.42, h * 0.5, w * 0.55, h * 0.18); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = w * 0.02;
  for (let i = 1; i < 12; i++) { const y = h - i * h * 0.068; g.beginPath(); g.moveTo(w * 0.46, y); g.lineTo(w * 0.54, y - h * 0.01); g.stroke(); }
  const cx = w * 0.55, cy = h * 0.18;
  for (let k = 0; k < 9; k++) {
    const a = -Math.PI + k * Math.PI / 8 + 0.05, L = w * 0.46;
    const ex = cx + Math.cos(a) * L, ey = cy + Math.sin(a) * L * 0.5 + L * 0.35;
    g.strokeStyle = k % 2 ? '#2f8f3a' : '#3fa848'; g.lineWidth = w * 0.06;
    g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + Math.cos(a) * L * 0.6, cy + Math.sin(a) * L * 0.5 - L * 0.15, ex, ey); g.stroke();
  }
}
function artHouse(g, w, h, v) {
  const cols = ['#f3d9b1', '#f2b8a2', '#f7efe2', '#e9c46a'];
  const top = h * (0.12 + v * 0.06), c = cols[v % 4];
  const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, shade(c, 0.1)); gr.addColorStop(1, shade(c, -0.25));
  g.fillStyle = gr; g.fillRect(w * 0.04, top, w * 0.92, h - top);
  g.fillStyle = '#b5523b'; g.beginPath(); g.moveTo(0, top + h * 0.02); g.lineTo(w * 0.5, top - h * 0.07); g.lineTo(w, top + h * 0.02); g.closePath(); g.fill();
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
    const x = w * (0.12 + k * 0.21), y = top + h * 0.06 + r * (h - top) * 0.22;
    if (y > h * 0.86) continue;
    g.fillStyle = '#3d6d8c'; g.fillRect(x, y, w * 0.12, h * 0.1);
    g.fillStyle = '#2f6b45'; g.fillRect(x - w * 0.03, y, w * 0.03, h * 0.1); g.fillRect(x + w * 0.12, y, w * 0.03, h * 0.1);
    g.fillStyle = '#ffffff'; g.fillRect(x - w * 0.03, y + h * 0.1, w * 0.18, h * 0.012);
  }
  g.fillStyle = '#6a4a35'; g.fillRect(w * 0.4, h * 0.86, w * 0.2, h * 0.14);
}
function artTower(g, w, h, v) {
  const pal = [['#ff2bd6', '#2a0f3f'], ['#1fe0ff', '#0d1d38'], ['#ffd02b', '#2b1a0a'], ['#7bff5a', '#0d2a1a']][v % 4];
  const top = h * (0.05 + (v % 3) * 0.1);
  const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, shade(pal[1], 0.2)); gr.addColorStop(1, pal[1]);
  g.fillStyle = gr; g.fillRect(w * 0.06, top, w * 0.88, h - top);
  srand(77 + v * 13);
  for (let y = top + h * 0.03; y < h * 0.95; y += h * 0.035) for (let x = w * 0.12; x < w * 0.88; x += w * 0.08)
    if (rnd() < 0.55) { g.fillStyle = rnd() < 0.7 ? 'rgba(255,230,160,0.85)' : rgba(pal[0], 0.8); g.fillRect(x, y, w * 0.045, h * 0.018); }
  g.save(); g.shadowColor = pal[0]; g.shadowBlur = w * 0.08; g.strokeStyle = pal[0]; g.lineWidth = w * 0.025;
  g.strokeRect(w * 0.06, top, w * 0.88, h - top);
  g.fillStyle = pal[0]; g.fillRect(w * 0.06, top + h * 0.08, w * 0.88, h * 0.012);
  g.restore();
  const words = ['CASINO', 'HOTEL', 'NEON', 'PIRU'];
  glowText(g, words[v % 4], w / 2, top + h * 0.045, w * 0.16, '#ffffff', pal[0]);
}
function artStand(g, w, h) {
  g.fillStyle = '#8d939b'; g.fillRect(w * 0.02, h * 0.3, w * 0.96, h * 0.7);
  srand(9);
  for (let r = 0; r < 7; r++) {
    const y = h * (0.36 + r * 0.085);
    g.fillStyle = r % 2 ? '#a9aeb5' : '#9aa0a8'; g.fillRect(w * 0.04, y, w * 0.92, h * 0.08);
    for (let x = w * 0.05; x < w * 0.95; x += w * 0.022) {
      g.fillStyle = pick(['#e63946', '#f1faee', '#ffb703', '#219ebc', '#2a9d8f', '#e76f51', '#222']);
      g.beginPath(); g.arc(x, y + h * 0.03, w * 0.008, 0, Math.PI * 2); g.fill();
    }
  }
  g.fillStyle = '#d9dde2'; g.fillRect(0, h * 0.2, w, h * 0.06);
  g.fillStyle = '#c0262d'; g.fillRect(0, h * 0.26, w, h * 0.03);
  g.fillStyle = '#6c7178'; for (let x = 0.05; x < 1; x += 0.3) g.fillRect(w * x, h * 0.26, w * 0.015, h * 0.1);
}
const BOARDS = [['LA PIRULETA', 'CAFÉ · PAN · TARTAS', '#ff4fa3', '#7a1747'], ['SUPERCAR GP', 'CAMPEONATO 2026', '#ffcc00', '#1a1a1a'],
  ['PIRU COLA', '¡REFRESCA TU VUELTA!', '#e63946', '#ffffff'], ['TURBO OIL', 'MÁXIMO RENDIMIENTO', '#1fa3ff', '#0b2440']];
function artBoard(g, w, h, v) {
  const [t1, t2, c1, c2] = BOARDS[v];
  g.fillStyle = '#555b63'; g.fillRect(w * 0.15, h * 0.5, w * 0.04, h * 0.5); g.fillRect(w * 0.81, h * 0.5, w * 0.04, h * 0.5);
  const gr = g.createLinearGradient(0, h * 0.05, 0, h * 0.55); gr.addColorStop(0, c1); gr.addColorStop(1, shade(c1, -0.35));
  g.fillStyle = '#20242a'; rr(g, w * 0.01, h * 0.03, w * 0.98, h * 0.54, w * 0.02); g.fill();
  g.fillStyle = gr; rr(g, w * 0.03, h * 0.06, w * 0.94, h * 0.48, w * 0.015); g.fill();
  glowText(g, t1, w / 2, h * 0.24, w * 0.11, c2, null);
  glowText(g, t2, w / 2, h * 0.42, w * 0.05, c2, null);
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(w * 0.03, h * 0.06, w * 0.94, h * 0.08);
}
function artLamp(g, w, h, right) {
  const px = right ? w * 0.85 : w * 0.15, ex = right ? w * 0.1 : w * 0.9;
  g.fillStyle = '#5b6068'; g.fillRect(px - w * 0.03, h * 0.1, w * 0.06, h * 0.9);
  g.strokeStyle = '#5b6068'; g.lineWidth = w * 0.04; g.beginPath(); g.moveTo(px, h * 0.12); g.quadraticCurveTo(px, h * 0.04, ex, h * 0.06); g.stroke();
  const gr = g.createRadialGradient(ex, h * 0.08, 0, ex, h * 0.08, w * 0.16);
  gr.addColorStop(0, '#fffbe0'); gr.addColorStop(0.4, 'rgba(255,230,150,0.8)'); gr.addColorStop(1, 'rgba(255,220,120,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(ex, h * 0.08, w * 0.16, 0, Math.PI * 2); g.fill();
}
function artTires(g, w, h) {
  for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) {
    const x = w * (0.04 + k * 0.24), y = h * (0.66 - r * 0.3);
    g.fillStyle = '#1a1a1a'; rr(g, x, y, w * 0.22, h * 0.3, w * 0.03); g.fill();
    g.fillStyle = (r + k) % 2 ? '#e8e8e8' : '#d32630'; rr(g, x + w * 0.02, y + h * 0.04, w * 0.18, h * 0.08, w * 0.02); g.fill();
  }
}
function artWall(g, w, h) {
  for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#f0f0f0' : '#d32630'; g.fillRect(k * w / 6, h * 0.3, w / 6 + 1, h * 0.7); }
  g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, h * 0.85, w, h * 0.15);
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, h * 0.3, w, h * 0.08);
}
function artRail(g, w, h) {
  g.fillStyle = '#6f757c'; for (let x = 0.05; x < 1; x += 0.3) g.fillRect(w * x, h * 0.4, w * 0.05, h * 0.6);
  const gr = g.createLinearGradient(0, h * 0.42, 0, h * 0.7); gr.addColorStop(0, '#e6e9ec'); gr.addColorStop(1, '#8a9096');
  g.fillStyle = gr; g.fillRect(0, h * 0.42, w, h * 0.26);
}
function artGantry(g, w, h) {
  const pw = w * 0.035;
  for (const x of [w * 0.02, w * 0.98 - pw]) {
    const gr = g.createLinearGradient(x, 0, x + pw, 0); gr.addColorStop(0, '#e3e6ea'); gr.addColorStop(1, '#7f868e');
    g.fillStyle = gr; g.fillRect(x, h * 0.1, pw, h * 0.9);
  }
  g.fillStyle = '#16181c'; g.fillRect(0, h * 0.04, w, h * 0.2);
  const sq = h * 0.05;
  for (let x = 0, k = 0; x < w; x += sq, k++) for (let r = 0; r < 2; r++) { g.fillStyle = (k + r) % 2 ? '#fff' : '#000'; g.fillRect(x, h * 0.04 + r * sq, sq, sq); }
  glowText(g, 'SUPERCAR  GP', w / 2, h * 0.19, h * 0.07, '#ffcc00', null);
  for (let i = 0; i < 5; i++) {
    g.fillStyle = '#300'; g.beginPath(); g.arc(w * (0.4 + i * 0.05), h * 0.29, h * 0.02, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#16181c'; g.fillRect(w * 0.37, h * 0.255, w * 0.26, h * 0.07);
  for (let i = 0; i < 5; i++) { g.fillStyle = '#ff2a2a'; g.beginPath(); g.arc(w * (0.4 + i * 0.05), h * 0.29, h * 0.018, 0, Math.PI * 2); g.fill(); }
}
function artBush(g, w, h, c) {
  for (const [dx, dy, r] of [[-0.25, 0.7, 0.25], [0.25, 0.7, 0.25], [0, 0.55, 0.32]]) {
    const x = w / 2 + dx * w, y = dy * h, R = r * w;
    const gr = g.createRadialGradient(x - R * 0.3, y - R * 0.3, R * 0.1, x, y, R);
    gr.addColorStop(0, shade(c, 0.3)); gr.addColorStop(1, shade(c, -0.35));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill();
  }
}
function artRock(g, w, h) {
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#d8c3a0'); gr.addColorStop(1, '#7a6448');
  g.fillStyle = gr; g.beginPath(); g.moveTo(w * 0.05, h); g.lineTo(w * 0.15, h * 0.45); g.lineTo(w * 0.45, h * 0.25); g.lineTo(w * 0.8, h * 0.4); g.lineTo(w * 0.95, h); g.closePath(); g.fill();
}
function artOlive(g, w, h) {
  g.strokeStyle = '#5a4630'; g.lineWidth = w * 0.08; g.lineCap = 'round';
  g.beginPath(); g.moveTo(w * 0.5, h); g.quadraticCurveTo(w * 0.35, h * 0.7, w * 0.5, h * 0.5); g.stroke();
  artBlobTree(g, w, h * 0.8, '#7f9461', '#b9c99a');
}

const SPR = {
  pine:    { w: 1500, cw: 220, ch: 420, col: 0.25, draw: (g, w, h) => artPine(g, w, h, '#2f7a3a') },
  pineD:   { w: 1600, cw: 220, ch: 440, col: 0.25, draw: (g, w, h) => artPine(g, w, h, '#24563a') },
  tree:    { w: 1800, cw: 300, ch: 340, col: 0.25, draw: (g, w, h) => artBlobTree(g, w, h, '#3f8f3c', '#8fd06a') },
  cherry:  { w: 1800, cw: 300, ch: 320, col: 0.25, draw: (g, w, h) => artBlobTree(g, w, h, '#f08fb4', '#ffe0ee') },
  palm:    { w: 1700, cw: 300, ch: 440, col: 0.2, draw: artPalm },
  bush:    { w: 900, cw: 200, ch: 120, col: 0.8, draw: (g, w, h) => artBush(g, w, h, '#3f8f3c') },
  drybush: { w: 800, cw: 200, ch: 110, col: 0, draw: (g, w, h) => artBush(g, w, h, '#a69a4a') },
  rock:    { w: 1100, cw: 220, ch: 140, col: 0.8, draw: artRock },
  olive:   { w: 1500, cw: 260, ch: 260, col: 0.2, draw: artOlive },
  stand:   { w: 4200, cw: 520, ch: 300, col: 0.95, draw: artStand },
  tires:   { w: 520, cw: 160, ch: 110, col: 0.9, draw: artTires },
  wall:    { w: 700, cw: 180, ch: 70, col: 0.9, draw: artWall },
  rail:    { w: 700, cw: 180, ch: 60, col: 0.9, draw: artRail },
  lampL:   { w: 900, cw: 200, ch: 520, col: 0.12, draw: (g, w, h) => artLamp(g, w, h, false) },
  lampR:   { w: 900, cw: 200, ch: 520, col: 0.12, draw: (g, w, h) => artLamp(g, w, h, true) },
  gantry:  { w: 5600, cw: 900, ch: 560, col: 0, center: true, draw: artGantry }
};
for (let v = 0; v < 4; v++) {
  SPR['board' + v] = { w: 2400, cw: 480, ch: 300, col: 0.9, draw: (g, w, h) => artBoard(g, w, h, v) };
  SPR['house' + v] = { w: 3200, cw: 360, ch: 520, col: 0.95, draw: (g, w, h) => artHouse(g, w, h, v) };
  SPR['tower' + v] = { w: 3600, cw: 360, ch: 720, col: 0.95, draw: (g, w, h) => artTower(g, w, h, v) };
}
// la farola de la izquierda se coloca a la izquierda aunque su offset sea 0
const sprCache = {};
function sprImg(type) {
  let c = sprCache[type]; if (c) return c;
  const d = SPR[type]; c = mkCanvas(d.cw, d.ch);
  const g = c.getContext('2d'); d.draw(g, d.cw, d.ch);
  return (sprCache[type] = c);
}

/* =========================================================
   ARTE: superdeportivos vistos desde atrás
   ========================================================= */
function lightSpots(st) {
  switch (st.lights) {
    case 'quad': return [[0.17, 0.52, 0.04], [0.27, 0.52, 0.04], [0.73, 0.52, 0.04], [0.83, 0.52, 0.04]];
    case 'slash': return [[0.19, 0.51, 0.06], [0.81, 0.51, 0.06]];
    case 'strip': return [[0.15, 0.5, 0.05], [0.35, 0.5, 0.04], [0.5, 0.5, 0.04], [0.65, 0.5, 0.04], [0.85, 0.5, 0.05]];
    default: return [[0.19, 0.52, 0.055], [0.81, 0.52, 0.055]];
  }
}
function drawCarArt(g, w, h, st, color, pose) {
  const X = u => (0.5 + (u - 0.5) * 0.96 * st.w) * w, Y = v => v * h;
  const roofY = 0.62 - st.roof * 0.9;
  // sombra
  const sg = g.createRadialGradient(w / 2, Y(0.93), 0, w / 2, Y(0.93), w * 0.5);
  sg.addColorStop(0, 'rgba(0,0,0,0.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sg; g.save(); g.scale(1, 0.14); g.beginPath(); g.arc(w / 2, Y(0.93) / 0.14, w * 0.5, 0, Math.PI * 2); g.fill(); g.restore();
  // ruedas
  const tx = pose * w * 0.012;
  for (const [a, b] of [[0.06, 0.22], [0.78, 0.94]]) {
    const gr = g.createLinearGradient(0, Y(0.6), 0, Y(0.94)); gr.addColorStop(0, '#2b2b2b'); gr.addColorStop(0.5, '#0c0c0c'); gr.addColorStop(1, '#1d1d1d');
    g.fillStyle = gr; rr(g, X(a) + tx, Y(0.6), X(b) - X(a), Y(0.34), w * 0.025); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.08)'; for (let k = 0; k < 4; k++) g.fillRect(X(a) + tx + w * 0.01, Y(0.66 + k * 0.065), X(b) - X(a) - w * 0.02, Y(0.02));
  }
  // resto del coche con inclinación al girar
  g.save();
  const k = pose * 0.13, yb = Y(0.9);
  g.setTransform(1, 0, k, 1, -k * yb, 0);
  // carrocería
  g.beginPath();
  if (st.angular) {
    g.moveTo(X(0.04), Y(0.86)); g.lineTo(X(0.03), Y(0.6)); g.lineTo(X(0.08), Y(0.45)); g.lineTo(X(0.25), Y(0.4));
    g.lineTo(X(0.35), Y(roofY)); g.lineTo(X(0.65), Y(roofY)); g.lineTo(X(0.75), Y(0.4)); g.lineTo(X(0.92), Y(0.45));
    g.lineTo(X(0.97), Y(0.6)); g.lineTo(X(0.96), Y(0.86));
  } else {
    g.moveTo(X(0.04), Y(0.86)); g.lineTo(X(0.03), Y(0.62)); g.quadraticCurveTo(X(0.03), Y(0.45), X(0.16), Y(0.42));
    g.lineTo(X(0.27), Y(0.4)); g.quadraticCurveTo(X(0.33), Y(roofY + 0.01), X(0.42), Y(roofY));
    g.lineTo(X(0.58), Y(roofY)); g.quadraticCurveTo(X(0.67), Y(roofY + 0.01), X(0.73), Y(0.4));
    g.lineTo(X(0.84), Y(0.42)); g.quadraticCurveTo(X(0.97), Y(0.45), X(0.97), Y(0.62)); g.lineTo(X(0.96), Y(0.86));
  }
  g.closePath();
  const bg = g.createLinearGradient(0, Y(roofY), 0, Y(0.88));
  bg.addColorStop(0, shade(color, 0.35)); bg.addColorStop(0.35, shade(color, 0.08)); bg.addColorStop(0.6, color); bg.addColorStop(1, shade(color, -0.55));
  g.fillStyle = bg; g.fill();
  g.save(); g.clip();
  const sideG = g.createLinearGradient(X(0), 0, X(1), 0);
  sideG.addColorStop(0, 'rgba(0,0,0,0.45)'); sideG.addColorStop(0.18, 'rgba(0,0,0,0)'); sideG.addColorStop(0.35, 'rgba(255,255,255,0.12)');
  sideG.addColorStop(0.65, 'rgba(255,255,255,0.05)'); sideG.addColorStop(0.82, 'rgba(0,0,0,0)'); sideG.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = sideG; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(X(0.05), Y(0.425), X(0.95) - X(0.05), Y(0.012));
  g.restore();
  // luneta o rejillas del motor
  g.beginPath(); g.moveTo(X(0.31), Y(0.39)); g.lineTo(X(0.385), Y(roofY + 0.035)); g.lineTo(X(0.615), Y(roofY + 0.035)); g.lineTo(X(0.69), Y(0.39)); g.closePath();
  const gl = g.createLinearGradient(0, Y(roofY), 0, Y(0.39)); gl.addColorStop(0, '#5d6f88'); gl.addColorStop(1, '#141b26');
  g.fillStyle = gl; g.fill();
  if (st.louvers) { g.fillStyle = shade(color, -0.6); for (let i = 0; i < 5; i++) { const y = lerp(roofY + 0.06, 0.37, i / 4); g.fillRect(X(0.33), Y(y), X(0.67) - X(0.33), Y(0.018)); } }
  else { g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.moveTo(X(0.4), Y(roofY + 0.04)); g.lineTo(X(0.47), Y(roofY + 0.04)); g.lineTo(X(0.41), Y(0.385)); g.lineTo(X(0.35), Y(0.385)); g.closePath(); g.fill(); }
  // panel trasero negro y difusor
  g.fillStyle = '#121212'; rr(g, X(0.14), Y(0.58), X(0.86) - X(0.14), Y(0.14), w * 0.015); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = Math.max(1, w * 0.003);
  for (let x = 0.17; x < 0.84; x += 0.025) { g.beginPath(); g.moveTo(X(x), Y(0.6)); g.lineTo(X(x), Y(0.7)); g.stroke(); }
  g.fillStyle = '#1b1b1b'; g.beginPath(); g.moveTo(X(0.12), Y(0.75)); g.lineTo(X(0.88), Y(0.75)); g.lineTo(X(0.84), Y(0.89)); g.lineTo(X(0.16), Y(0.89)); g.closePath(); g.fill();
  g.fillStyle = '#2c2c2c'; for (let x = 0.24; x < 0.8; x += 0.08) g.fillRect(X(x), Y(0.76), w * 0.008, Y(0.12));
  // escapes
  const ex = st.exh === 'quad' ? [0.38, 0.45, 0.55, 0.62] : st.exh === 'twin' ? [0.3, 0.7] : [0.46, 0.54];
  for (const e of ex) {
    const r = w * 0.024, x = X(e), y = Y(0.8);
    const eg = g.createRadialGradient(x, y, r * 0.2, x, y, r); eg.addColorStop(0, '#000'); eg.addColorStop(0.7, '#333'); eg.addColorStop(1, '#bbb');
    g.fillStyle = eg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // pilotos
  g.save(); g.shadowColor = '#ff2020'; g.shadowBlur = w * 0.02;
  const red = g.createLinearGradient(0, Y(0.47), 0, Y(0.57)); red.addColorStop(0, '#ff6a6a'); red.addColorStop(1, '#a00010');
  g.fillStyle = red; g.strokeStyle = red;
  if (st.lights === 'quad') for (const [u, v, r] of lightSpots(st)) { g.beginPath(); g.arc(X(u), Y(v), r * w * 0.9, 0, Math.PI * 2); g.fill(); }
  else if (st.lights === 'slash') {
    for (const s of [-1, 1]) { const m = u => s < 0 ? u : 1 - u; g.beginPath(); g.moveTo(X(m(0.08)), Y(0.49)); g.lineTo(X(m(0.3)), Y(0.47)); g.lineTo(X(m(0.27)), Y(0.53)); g.lineTo(X(m(0.1)), Y(0.56)); g.closePath(); g.fill(); }
  } else if (st.lights === 'strip') { g.fillRect(X(0.08), Y(0.485), X(0.92) - X(0.08), Y(0.035)); }
  else { g.lineWidth = w * 0.02; for (const [u, v, r] of lightSpots(st)) { g.beginPath(); g.arc(X(u), Y(v), r * w * 0.8, 0, Math.PI * 2); g.stroke(); } }
  g.restore();
  // alerón
  if (st.wing) {
    g.fillStyle = '#1a1a1a'; g.fillRect(X(0.3), Y(0.2), w * 0.02, Y(0.21)); g.fillRect(X(0.7) - w * 0.02, Y(0.2), w * 0.02, Y(0.21));
    const wg = g.createLinearGradient(0, Y(0.15), 0, Y(0.23)); wg.addColorStop(0, '#4a4a4a'); wg.addColorStop(1, '#0d0d0d');
    g.fillStyle = wg; rr(g, X(0.04), Y(0.15), X(0.96) - X(0.04), Y(0.075), w * 0.01); g.fill();
    g.fillStyle = color; g.fillRect(X(0.04), Y(0.13), w * 0.02, Y(0.12)); g.fillRect(X(0.96) - w * 0.02, Y(0.13), w * 0.02, Y(0.12));
  }
  // emblema y tercera luz
  g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(X(0.5), Y(0.455), w * 0.013, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c00'; g.fillRect(X(0.45), Y(roofY + 0.015), X(0.55) - X(0.45), Y(0.012));
  g.restore();
}
const carCache = new Map();
function carImg(m, color, pose, big) {
  const key = m + color + pose + (big ? 'B' : 's');
  let c = carCache.get(key); if (c) return c;
  const w = big ? 620 : 300, h = Math.round(w * 0.56);
  c = mkCanvas(w, h); drawCarArt(c.getContext('2d'), w, h, CARS[m].st, color, pose);
  carCache.set(key, c);
  return c;
}
function carGlow(m, x, y, w, h, strength) {
  const g = ctx; g.save(); g.globalCompositeOperation = 'lighter';
  for (const [u, v, r] of lightSpots(CARS[m].st)) {
    const px = x + (0.5 + (u - 0.5) * 0.96 * CARS[m].st.w) * w, py = y + v * h, R = r * w * 3.2;
    const gr = g.createRadialGradient(px, py, 0, px, py, R);
    gr.addColorStop(0, 'rgba(255,60,50,' + (0.85 * strength) + ')'); gr.addColorStop(1, 'rgba(255,0,0,0)');
    g.fillStyle = gr; g.fillRect(px - R, py - R, R * 2, R * 2);
  }
  g.restore();
}

/* =========================================================
   FONDO: cielo y paisajes en capas (parallax)
   ========================================================= */
const BG = { cache: null, off: [0, 0, 0] };
function periodic(x, L, terms) { let v = 0; for (const [k, a, p] of terms) v += a * Math.sin(2 * Math.PI * k * x / L + p); return v; }
function bgLayer(spec, lw, lh, far) {
  const c = mkCanvas(lw, lh), g = c.getContext('2d');
  srand(far ? 31 : 57);
  const col = spec.c, ridge = (terms, base, amp) => {
    g.beginPath(); g.moveTo(0, lh);
    for (let x = 0; x <= lw; x += 4) g.lineTo(x, base - amp * periodic(x, lw, terms));
    g.lineTo(lw, lh); g.closePath();
  };
  const terms = (n, s) => { const t = []; for (let i = 0; i < n; i++) t.push([s[i], 1 / (i + 1.3), rnd() * 6.28]); return t; };
  const vfill = (top, c1, c2) => { const gr = g.createLinearGradient(0, top, 0, lh); gr.addColorStop(0, c1); gr.addColorStop(1, c2); return gr; };
  switch (spec.type) {
    case 'mountains': {
      const t = terms(4, [3, 5, 8, 13]);
      ridge(t, lh * 0.55, lh * 0.28); g.fillStyle = vfill(lh * 0.1, shade(col, 0.15), shade(col, -0.25)); g.fill();
      if (spec.snow) { g.save(); ridge(t, lh * 0.55, lh * 0.28); g.clip(); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(0, 0, lw, lh * 0.3); g.restore(); }
      break;
    }
    case 'hills': {
      ridge(terms(3, [2, 4, 7]), lh * 0.6, lh * 0.18); g.fillStyle = vfill(lh * 0.3, shade(col, 0.15), shade(col, -0.3)); g.fill();
      g.fillStyle = shade(col, -0.35);
      for (let i = 0; i < 160; i++) { const x = rnd() * lw, y = lh * 0.62 - lh * 0.18 * periodic(x, lw, terms(0, [])) + lh * (0.05 + rnd() * 0.3); g.beginPath(); g.arc(x, y, lh * (0.015 + rnd() * 0.02), 0, Math.PI * 2); g.fill(); }
      break;
    }
    case 'sea': {
      ridge([[1, 1, 0], [3, 0.4, 1]], lh * 0.62, lh * 0.32); g.fillStyle = vfill(lh * 0.2, '#7fa878', '#4f7a50'); g.fill();
      g.fillStyle = vfill(lh * 0.7, '#3f9be0', '#1c5f96'); g.fillRect(0, lh * 0.72, lw, lh * 0.28);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 120; i++) g.fillRect(rnd() * lw, lh * (0.74 + rnd() * 0.25), lw * 0.01 * (0.5 + rnd()), Math.max(1, lh * 0.004));
      for (let i = 0; i < 6; i++) { const x = rnd() * lw, y = lh * (0.76 + rnd() * 0.1), s = lh * 0.04; g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + s * 2, y); g.lineTo(x + s * 1.6, y + s * 0.5); g.lineTo(x + s * 0.3, y + s * 0.5); g.closePath(); g.fill(); g.fillRect(x + s * 0.6, y - s * 0.5, s * 0.8, s * 0.5); }
      break;
    }
    case 'town': {
      const cols = ['#f3d9b1', '#f2b8a2', '#f7efe2', '#e9c46a', '#e8a87c', '#d9e4dd'];
      for (let x = 0; x < lw;) {
        const bw = lh * (0.15 + rnd() * 0.25), bh = lh * (0.25 + rnd() * 0.45), c = pick(cols);
        g.fillStyle = c; g.fillRect(x, lh - bh, bw, bh);
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + bw * 0.8, lh - bh, bw * 0.2, bh);
        g.fillStyle = '#b5523b'; g.fillRect(x - 2, lh - bh - lh * 0.02, bw + 4, lh * 0.02);
        g.fillStyle = 'rgba(40,80,110,0.6)';
        for (let y = lh - bh + lh * 0.05; y < lh - lh * 0.04; y += lh * 0.07) for (let wx = x + bw * 0.12; wx < x + bw * 0.8; wx += bw * 0.22) g.fillRect(wx, y, bw * 0.1, lh * 0.035);
        x += bw + lh * 0.01;
      }
      break;
    }
    case 'fuji': {
      for (const cx of [lw * 0.25, lw * 0.75]) {
        g.beginPath(); g.moveTo(cx - lh * 1.6, lh); g.quadraticCurveTo(cx - lh * 0.35, lh * 0.28, cx - lh * 0.12, lh * 0.12); g.lineTo(cx + lh * 0.12, lh * 0.12); g.quadraticCurveTo(cx + lh * 0.35, lh * 0.28, cx + lh * 1.6, lh); g.closePath();
        g.fillStyle = vfill(lh * 0.1, shade(col, 0.2), shade(col, -0.2)); g.fill();
        g.save(); g.clip(); g.fillStyle = '#fff3f0';
        g.beginPath(); g.moveTo(cx - lh * 0.6, lh * 0.4); for (let i = 0; i <= 8; i++) g.lineTo(cx - lh * 0.6 + i * lh * 0.15, lh * (i % 2 ? 0.44 : 0.36)); g.lineTo(cx + lh * 0.6, 0); g.lineTo(cx - lh * 0.6, 0); g.closePath(); g.fill(); g.restore();
      }
      break;
    }
    case 'forest': {
      for (let row = 0; row < 3; row++) {
        const c = shade(col, -0.15 * row), base = lh * (0.55 + row * 0.15);
        g.fillStyle = c;
        for (let x = -lh * 0.1; x < lw + lh * 0.1; x += lh * 0.07) {
          const th = lh * (0.18 + rnd() * 0.2) , tw = lh * 0.06;
          g.beginPath(); g.moveTo(x - tw, base + lh * 0.05); g.lineTo(x, base - th); g.lineTo(x + tw, base + lh * 0.05); g.closePath(); g.fill();
        }
        g.fillRect(0, base, lw, lh - base);
      }
      if (far) { g.fillStyle = 'rgba(200,210,215,0.35)'; g.fillRect(0, 0, lw, lh); }
      break;
    }
    case 'skyline': {
      for (let layer = 0; layer < 2; layer++) {
        for (let x = 0; x < lw;) {
          const bw = lh * (0.08 + rnd() * 0.14), bh = lh * (0.25 + rnd() * (layer ? 0.45 : 0.7));
          g.fillStyle = layer ? '#120a24' : '#24164a'; g.fillRect(x, lh - bh, bw, bh);
          for (let y = lh - bh + lh * 0.02; y < lh; y += lh * 0.028) for (let wx = x + bw * 0.1; wx < x + bw * 0.9; wx += bw * 0.18)
            if (rnd() < 0.35) { g.fillStyle = pick(['rgba(255,220,140,0.9)', 'rgba(120,230,255,0.8)', 'rgba(255,90,210,0.8)']); g.fillRect(wx, y, bw * 0.09, lh * 0.012); }
          if (rnd() < 0.3) { g.fillStyle = '#ff3030'; g.fillRect(x + bw / 2 - 1, lh - bh - lh * 0.04, 3, lh * 0.04); }
          x += bw + lh * 0.005;
        }
      }
      break;
    }
    case 'mesas': {
      g.beginPath(); g.moveTo(0, lh);
      let x = 0; while (x < lw) { const w0 = lh * (0.4 + rnd() * 0.8), top = lh * (0.35 + rnd() * 0.3); g.lineTo(x + w0 * 0.15, lh * 0.75); g.lineTo(x + w0 * 0.25, top); g.lineTo(x + w0 * 0.75, top); g.lineTo(x + w0 * 0.85, lh * 0.75); x += w0; }
      g.lineTo(lw, lh * 0.75); g.lineTo(lw, lh); g.closePath();
      g.fillStyle = vfill(lh * 0.3, shade(col, 0.15), shade(col, -0.3)); g.fill();
      break;
    }
  }
  return c;
}
function buildBG() {
  const lw = Math.round(Math.max(W, H * 2) * 1.5);
  const th = theme, cache = { lw, layers: [] };
  // nubes
  if (th.clouds) {
    const c = mkCanvas(lw, H * 0.4), g = c.getContext('2d'); srand(5);
    const n = Math.round(10 * th.clouds);
    for (let i = 0; i < n; i++) {
      const cx = rnd() * lw, cy = H * (0.05 + rnd() * 0.25), s = H * (0.04 + rnd() * 0.05);
      for (let k = 0; k < 7; k++) {
        const x = cx + (k - 3) * s * 0.7, y = cy - Math.sin(k / 6 * Math.PI) * s * 0.5, r = s * (0.6 + Math.sin(k / 6 * Math.PI) * 0.5);
        for (const dx of [0, -lw, lw]) {
          const gr = g.createRadialGradient(x + dx, y - r * 0.3, r * 0.1, x + dx, y, r);
          gr.addColorStop(0, rgba(th.cloudC || '#ffffff', 0.95)); gr.addColorStop(1, rgba(th.cloudC || '#ffffff', 0));
          g.fillStyle = gr; g.beginPath(); g.arc(x + dx, y, r, 0, Math.PI * 2); g.fill();
        }
      }
    }
    cache.layers.push({ c, par: 0.05, y: 0 });
  }
  if (th.far) cache.layers.push({ c: bgLayer(th.far, lw, Math.round(H * 0.32), true), par: 0.12, y: 0.58, base: true });
  if (th.near) cache.layers.push({ c: bgLayer(th.near, lw, Math.round(H * 0.2), false), par: 0.3, y: 0.6 });
  if (th.stars) { srand(3); cache.stars = []; for (let i = 0; i < 140; i++) cache.stars.push([rnd(), rnd() * 0.5, rnd()]); }
  BG.cache = cache;
}
function drawBackground(pY) {
  if (!BG.cache) buildBG();
  const th = theme, g = ctx, C = BG.cache;
  const sky = g.createLinearGradient(0, 0, 0, H * 0.6); sky.addColorStop(0, th.sky[0]); sky.addColorStop(1, th.sky[1]);
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  if (C.stars) for (const [x, y, b] of C.stars) { g.fillStyle = 'rgba(255,255,255,' + (0.3 + b * 0.7) + ')'; g.fillRect(x * W, y * H, PX * (1 + b), PX * (1 + b)); }
  const sun = th.sun || th.moon;
  if (sun) {
    const sx = W * sun.x - (BG.off[0] * 0.03 * W) % W, sy = H * sun.y, r = H * sun.r;
    const gr = g.createRadialGradient(sx, sy, r * 0.2, sx, sy, r * 6);
    gr.addColorStop(0, th.sun ? 'rgba(255,250,220,0.75)' : 'rgba(200,200,255,0.4)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gr; g.fillRect(sx - r * 6, sy - r * 6, r * 12, r * 12);
    g.fillStyle = th.sun ? sun.c : '#eeeeff'; g.beginPath(); g.arc(sx, sy, r, 0, Math.PI * 2); g.fill();
  }
  let i = 0;
  for (const L of C.layers) {
    const c = L.c, x = -mod(BG.off[i % 3] * L.par * W, C.lw);
    const y = L.y ? (H * L.y - c.height + pY * -0.00004 * H * (1 + L.par * 3)) : 0;
    g.drawImage(c, x, y); if (x + C.lw < W) g.drawImage(c, x + C.lw, y);
    if (L.y) { g.fillStyle = shade((L === C.layers[C.layers.length - 1] ? (th.near || th.far) : th.far).c, -0.3); g.fillRect(0, y + c.height - 1, W, H); }
    i++;
  }
}

/* =========================================================
   CARRERA
   ========================================================= */
let state = 'title', stateT = 0, raceT = 0, paused = false;
let player = null, rivals = [], results = null, msg = null, shake = 0;
const attract = { dist: 0, x: 0 };

function carMax(m) { return BASEMAX * CARS[m].top / 320; }
function startRace(ti) {
  buildTracks(ti);
  save.lastTrack = ti; persist();
  const pm = save.car;
  player = { m: pm, color: PAINT[save.colors[pm] ?? CARS[pm].paint], dist: 0, x: 0, speed: 0, nitro: CARS[pm].nitro, boost: false,
    lap: 1, lapStart: 0, lapTimes: [], finished: false, time: 0, crashCD: 0, steerVis: 0, brakeT: 0, skid: 0, name: 'TÚ' };
  rivals = [];
  const diffBase = [0.82, 0.92, 1.0][save.diff] + ti * 0.008;
  const names = RIVAL_NAMES.slice().sort(() => Math.random() - 0.5);
  const slots = [0, 1, 2, 3, 4, 5, 7], pslot = 6;
  slots.forEach((s, i) => {
    const m = Math.floor(Math.random() * CARS.length);
    let color = PAINT[Math.floor(Math.random() * PAINT.length)];
    rivals.push({ m, color, name: names[i], top: BASEMAX * (diffBase - i * 0.016) * (0.98 + Math.random() * 0.04),
      dist: -(Math.floor(s / 2) + 1) * SEG * 3, x: s % 2 ? 0.45 : -0.45, lane: [-0.55, 0, 0.55][i % 3], speed: 0, seg: -1, finished: false, time: 0, lapT: 0 });
  });
  player.dist = -(Math.floor(pslot / 2) + 1) * SEG * 3; player.x = pslot % 2 ? 0.45 : -0.45;
  for (const s of segments) s.cars.length = 0;
  raceT = -3.6; results = null; msg = null; paused = false; lastCount = 4;
  setState('race');
  AU.playSong(1); AU.engineOn();
}
let lastCount = 4;
function showMsg(t, c, dur) { msg = { t, c: c || '#ffffff', life: dur || 1.6, max: dur || 1.6 }; }

function update(dt) {
  const th = theme;
  raceT += dt;
  if (raceT < 0) {
    const n = Math.ceil(-raceT);
    if (n < lastCount && n <= 3) { lastCount = n; AU.beep(false); }
  } else if (lastCount > 0) { lastCount = 0; AU.beep(true); showMsg('¡YA!', '#3dff7a', 1); vibrate(80); }

  const p = player, car = CARS[p.m], maxS = carMax(p.m), L = trackLength;
  const pz = mod(START * SEG + p.dist, L), pSeg = findSeg(pz);
  const sp = p.speed / maxS;
  const go = raceT >= 0;

  // --- controles del jugador ---
  let steer = input.steer, gas, brake = input.brake, nit = input.nitro;
  if (p.finished) { steer = clamp(-p.x * 2, -1, 1); gas = true; brake = false; nit = false; }
  else gas = save.autoGas ? !brake : input.gas;
  const dx = dt * 2.2 * Math.min(1, sp * 1.4 + 0.05) * car.hand;
  if (go) {
    p.x += dx * steer;
    p.x -= dx * sp * pSeg.curve * 0.3 / car.hand;
  }
  p.steerVis = lerp(p.steerVis, steer, Math.min(1, dt * 10));
  let cap = maxS;
  p.boost = false;
  if (go) {
    if (brake) p.speed -= maxS / 1.6 * dt;
    else if (gas) p.speed += maxS / (6.2 / car.acc) * (1 - 0.5 * Math.min(1, sp)) * dt * 1.15;
    else p.speed -= maxS / 7 * dt;
    if (nit && gas && p.nitro > 0) {
      if (!p.wasBoost) { AU.nitro(); vibrate(40); }
      p.boost = true; p.nitro = Math.max(0, p.nitro - dt); p.speed += maxS * 0.38 * dt; cap = maxS * 1.24;
    } else if (!p.finished) p.nitro = Math.min(car.nitro, p.nitro + dt * 0.11);
    p.wasBoost = p.boost;
    if (Math.abs(p.x) > 1.05) {
      if (p.speed > maxS * 0.3) p.speed -= maxS * 0.85 * dt;
      if (Math.random() < 0.3) shake = Math.max(shake, 0.25);
    }
    if (p.speed > cap) p.speed -= maxS * 0.45 * dt;
    p.speed = clamp(p.speed, 0, maxS * 1.26);
  }
  p.brakeT = brake ? 1 : Math.max(0, p.brakeT - dt * 4);
  p.crashCD -= dt;

  // choques con objetos del borde
  if (Math.abs(p.x) > 0.9 && p.crashCD <= 0) {
    for (let k = 0; k < 2; k++) {
      const seg = segments[(pSeg.index + k) % segments.length];
      for (const s of seg.sprites) {
        const d = SPR[s.type]; if (!d.col) continue;
        const sw = d.w * d.col / RW, so = s.type === 'lampL' && !s.offset ? -1.2 : s.type === 'lampR' && !s.offset ? 1.2 : s.offset;
        const sx = so + (d.w / RW) * (so > 0 ? 0.5 : -0.5);
        if (overlap(p.x, PW, sx, sw)) {
          p.speed = Math.min(p.speed, maxS * 0.12); p.x += so > 0 ? -0.12 : 0.12;
          p.crashCD = 0.7; shake = 1; AU.crash(); vibrate(150); break;
        }
      }
    }
  }
  // choques con rivales
  for (const r of rivals) {
    const d = r.dist - p.dist;
    if (Math.abs(d) < CARLEN && overlap(p.x, PW, r.x, PW)) {
      if (d > 0 && p.speed > r.speed) {
        p.speed = r.speed * 0.88; p.dist = r.dist - CARLEN; p.x += p.x < r.x ? -0.05 : 0.05;
        if (p.crashCD <= 0) { AU.bump(); vibrate(50); shake = 0.5; p.crashCD = 0.3; }
      } else if (d <= 0 && r.speed > p.speed) { r.speed = p.speed * 0.95; r.dist = p.dist - CARLEN; }
    }
  }
  p.x = clamp(p.x, -2.6, 2.6);
  if (go) p.dist += p.speed * dt;

  // vueltas
  if (!p.finished && p.dist >= p.lap * L) {
    p.lapTimes.push(raceT - p.lapStart); p.lapStart = raceT; p.lap++;
    if (p.lap > track.laps) { p.finished = true; p.time = raceT; finishRace(); }
    else { AU.lap(); showMsg(p.lap === track.laps ? '¡VUELTA FINAL!' : 'VUELTA ' + p.lap, '#ffd24a', 1.8); p.nitro = Math.min(car.nitro, p.nitro + 1); }
  }

  // --- rivales ---
  for (const r of rivals) {
    const rz = mod(START * SEG + r.dist, L), rs = findSeg(rz);
    let target = r.top * (1 - 0.035 * Math.min(1, Math.abs(rs.curve) / 6));
    const gap = r.dist - p.dist;
    if (!p.finished) { if (gap > 3000) target *= 0.95; else if (gap < -3000) target *= 1.05; }
    if (!go) target = 0;
    const racc = r.top / 5.5;
    r.speed += clamp(target - r.speed, -racc * 2 * dt, racc * dt);
    let dir = 0;
    for (const o of [p].concat(rivals)) {
      if (o === r) continue;
      const d = o.dist - r.dist;
      if (d > 0 && d < 1500 && Math.abs(o.x - r.x) < 0.42 && o.speed < r.speed) {
        dir = o.x > r.x ? -1 : 1;
        if (r.x < -0.6) dir = 1; else if (r.x > 0.6) dir = -1;
        if (d < CARLEN * 1.3) r.speed = Math.min(r.speed, o.speed * 0.99);
        break;
      }
    }
    if (dir) r.x += dir * dt * 1.2; else r.x += (r.lane - r.x) * dt * 0.4;
    r.x = clamp(r.x, -0.82, 0.82);
    if (go) r.dist += r.speed * dt;
    if (!r.finished && r.dist >= track.laps * L) { r.finished = true; r.time = raceT; }
    const si = Math.floor(mod(START * SEG + r.dist, L) / SEG) % segments.length;
    if (si !== r.seg) {
      if (r.seg >= 0) { const a = segments[r.seg].cars, j = a.indexOf(r); if (j >= 0) a.splice(j, 1); }
      segments[si].cars.push(r); r.seg = si;
    }
  }

  // sonido del motor
  const g6 = Math.min(5.99, sp * 5.6), gear = Math.floor(g6), frac = g6 - gear;
  const rpm = go ? (gear === 0 ? 0.15 + frac * 0.85 : 0.45 + frac * 0.55) : (gas || input.gas ? 0.5 + Math.random() * 0.1 : 0.12);
  p.skid = go ? clamp((Math.abs(steer) * sp - 0.55) * 1.6 + Math.abs(pSeg.curve) * sp * sp * 0.05 - 0.15, 0, 1) * (Math.abs(p.x) < 1 ? 1 : 0) : 0;
  AU.engineSet(rpm, gas && go ? 1 : 0.2, p.skid, p.boost ? 1 : sp * 0.3);

  // fondo parallax
  BG.off[0] += pSeg.curve * sp * dt * 0.06;
  BG.off[1] += pSeg.curve * sp * dt * 0.06;
  BG.off[2] += pSeg.curve * sp * dt * 0.06;
  if (msg) { msg.life -= dt; if (msg.life <= 0) msg = null; }
  shake = Math.max(0, shake - dt * 3);
  if (th.rain) updateRain(dt, sp);

  if (p.finished && state === 'race' && raceT - p.time > 3) showResults();
}

function standings() {
  const all = [player].concat(rivals);
  return all.sort((a, b) => {
    if (a.finished && b.finished) return a.time - b.time;
    if (a.finished) return -1; if (b.finished) return 1;
    return b.dist - a.dist;
  });
}
function finishRace() {
  const pos = standings().indexOf(player) + 1;
  AU.engineSet(0.3, 0, 0, 0);
  if (pos === 1) { AU.win(); showMsg('¡VICTORIA!', '#ffd24a', 3); } else showMsg('META · ' + pos + 'º', '#ffffff', 3);
  vibrate(200);
}
function showResults() {
  const L = trackLength * track.laps;
  for (const r of rivals) if (!r.finished) r.time = raceT + (L - r.dist) / Math.max(1000, r.speed);
  const order = [player].concat(rivals).sort((a, b) => a.time - b.time);
  const pos = order.indexOf(player) + 1;
  const prize = [2000, 1400, 1000, 600, 400, 300, 200, 150][pos - 1] * [0.7, 1, 1.4][save.diff];
  const ti = trackIdx, key = String(ti);
  const bestLap = Math.min(...player.lapTimes);
  let rec = false;
  if (!save.best[key] || player.time < save.best[key]) { save.best[key] = player.time; rec = true; }
  if (!save.bestLap[key] || bestLap < save.bestLap[key]) save.bestLap[key] = bestLap;
  if (pos <= 3) { save.podiums[key] = Math.min(save.podiums[key] || 9, pos); if (ti + 2 > save.unlocked) save.unlocked = Math.min(TRACKS.length, ti + 2); }
  save.credits += Math.round(prize);
  persist();
  results = { order, pos, prize: Math.round(prize), rec, bestLap, newTrack: pos <= 3 && ti + 1 < TRACKS.length };
  AU.engineOff(); AU.playSong(2); AU.coin();
  setState('results');
}

/* ---------- Lluvia ---------- */
const drops = [];
function updateRain(dt, sp) {
  while (drops.length < 160) drops.push({ x: Math.random(), y: Math.random(), v: 0.8 + Math.random() * 0.8 });
  for (const d of drops) { d.y += d.v * dt * (1.4 + sp); d.x -= dt * 0.15 * (1 + sp); if (d.y > 1) { d.y -= 1; d.x = Math.random() * 1.2; } if (d.x < 0) d.x += 1.2; }
}
function drawRain() {
  const g = ctx; g.strokeStyle = 'rgba(210,220,235,0.45)'; g.lineWidth = Math.max(1, PX * 1.2); g.beginPath();
  for (const d of drops) { const x = d.x * W, y = d.y * H; g.moveTo(x, y); g.lineTo(x + H * 0.012, y - H * 0.05); }
  g.stroke();
}

/* =========================================================
   DIBUJO DE LA CARRETERA
   ========================================================= */
function project(p, cx, cy, cz) {
  p.camera.x = p.world.x - cx; p.camera.y = p.world.y - cy; p.camera.z = p.world.z - cz;
  p.screen.scale = CAMD / p.camera.z;
  p.screen.x = W / 2 + p.screen.scale * p.camera.x * XS;
  p.screen.y = H / 2 - p.screen.scale * p.camera.y * YS;
  p.screen.w = p.screen.scale * RW * XS;
}
function poly(x1, y1, x2, y2, x3, y3, x4, y4, c) {
  const g = ctx; g.fillStyle = c; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.lineTo(x4, y4); g.closePath(); g.fill();
}
function drawSegment(seg) {
  const a0 = seg.p1.screen, b = seg.p2.screen, th = theme, c = seg.color;
  const a = { x: a0.x, y: a0.y + Math.max(1, PX), w: a0.w };
  const g = ctx;
  g.fillStyle = th.ground[c]; g.fillRect(0, b.y, W, a.y - b.y + 1);
  const r1 = a.w / 6, r2 = b.w / 6, l1 = a.w / 36, l2 = b.w / 36;
  poly(a.x - a.w - r1, a.y, a.x - a.w, a.y, b.x - b.w, b.y, b.x - b.w - r2, b.y, th.rumble[c]);
  poly(a.x + a.w + r1, a.y, a.x + a.w, a.y, b.x + b.w, b.y, b.x + b.w + r2, b.y, th.rumble[c]);
  poly(a.x - a.w, a.y, a.x + a.w, a.y, b.x + b.w, b.y, b.x - b.w, b.y, th.road[c]);
  // líneas de borde
  const e1 = a.w * 0.03, e2 = b.w * 0.03, ei1 = a.w * 0.05, ei2 = b.w * 0.05;
  poly(a.x - a.w + ei1, a.y, a.x - a.w + ei1 + e1, a.y, b.x - b.w + ei2 + e2, b.y, b.x - b.w + ei2, b.y, th.edge);
  poly(a.x + a.w - ei1, a.y, a.x + a.w - ei1 - e1, a.y, b.x + b.w - ei2 - e2, b.y, b.x + b.w - ei2, b.y, th.edge);
  if (seg.start) {
    const n = 14;
    for (let i = 0; i < n; i++) {
      if ((i + seg.index) % 2) continue;
      const u1 = -1 + 2 * i / n, u2 = -1 + 2 * (i + 1) / n;
      poly(a.x + a.w * u1, a.y, a.x + a.w * u2, a.y, b.x + b.w * u2, b.y, b.x + b.w * u1, b.y, '#f4f4f4');
    }
  } else if (c === 0) {
    const lw1 = a.w * 2 / LANES, lw2 = b.w * 2 / LANES;
    let lx1 = a.x - a.w + lw1, lx2 = b.x - b.w + lw2;
    for (let k = 1; k < LANES; k++) { poly(lx1 - l1 / 2, a.y, lx1 + l1 / 2, a.y, lx2 + l2 / 2, b.y, lx2 - l2 / 2, b.y, th.lane); lx1 += lw1; lx2 += lw2; }
  }
  if (th.rain && c === 1) { g.globalAlpha = 0.08; poly(a.x - a.w * 0.6, a.y, a.x + a.w * 0.6, a.y, b.x + b.w * 0.6, b.y, b.x - b.w * 0.6, b.y, '#ffffff'); g.globalAlpha = 1; }
  if (seg.fog < 0.995) { g.globalAlpha = 1 - seg.fog; g.fillStyle = th.fog; g.fillRect(0, b.y, W, a.y - b.y + 1); g.globalAlpha = 1; }
}
function drawSprite(img, worldW, scale, x, y, ox, oy, clipY, alpha) {
  const dw = worldW * scale * XS; if (dw < 1 || dw > W * 4) return;
  const dh = dw * img.height / img.width, dx = x + dw * ox, dy = y + dh * oy;
  if (dx > W || dx + dw < 0) return;
  const clipH = clipY ? Math.max(0, dy + dh - clipY) : 0;
  if (clipH >= dh) return;
  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.drawImage(img, 0, 0, img.width, img.height - img.height * clipH / dh, dx, dy, dw, dh - clipH);
  if (alpha < 1) ctx.globalAlpha = 1;
  return [dx, dy, dw, dh];
}
function drawCarSprite(m, color, pose, scale, x, y, clipY, alpha, lights) {
  const dw = CARW * scale * XS;
  const img = carImg(m, color, pose, dw > 280);
  const r = drawSprite(img, CARW, scale, x, y, -0.5, -1, clipY, alpha);
  if (r && lights > 0 && alpha > 0.4) carGlow(m, r[0], r[1], r[2], r[3], lights * alpha);
  return r;
}

let vignette = null;
function renderWorld(camDist, camX, opts) {
  const L = trackLength, N = segments.length, th = theme, g = ctx;
  const pzW = mod(START * SEG + camDist, L), camZ = mod(pzW - PZ, L);
  const base = findSeg(camZ), basePct = (camZ % SEG) / SEG;
  const pSeg = findSeg(pzW), pPct = (pzW % SEG) / SEG;
  const pY = lerp(pSeg.p1.world.y, pSeg.p2.world.y, pPct);
  g.save();
  if (shake > 0) g.translate((Math.random() - 0.5) * shake * H * 0.02, (Math.random() - 0.5) * shake * H * 0.02);
  drawBackground(pY);
  let maxy = H, x = 0, dx = -(base.curve * basePct);
  for (let n = 0; n < DRAW; n++) {
    const seg = segments[(base.index + n) % N];
    seg.looped = seg.index < base.index;
    const fp = n / DRAW; seg.fog = 1 / Math.exp(fp * fp * th.fogD);
    seg.clip = maxy;
    const cz = camZ - (seg.looped ? L : 0);
    project(seg.p1, camX * RW - x, pY + CAMH, cz);
    project(seg.p2, camX * RW - x - dx, pY + CAMH, cz);
    x += dx; dx += seg.curve;
    if (seg.p1.camera.z <= CAMD || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy) { seg.vis = false; continue; }
    seg.vis = true;
    drawSegment(seg);
    maxy = seg.p1.screen.y;
  }
  if (th.night) {
    g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(W / 2, H * 0.8, 0, W / 2, H * 0.8, H * 0.55);
    gr.addColorStop(0, 'rgba(255,240,200,0.22)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gr; g.fillRect(0, H * 0.4, W, H * 0.6); g.restore();
  }
  const pN = mod(pSeg.index - base.index, N);
  for (let n = DRAW - 1; n >= 0; n--) {
    const seg = segments[(base.index + n) % N];
    if (seg.p1.camera.z > CAMD * 2) {
      for (const s of seg.sprites) {
        const d = SPR[s.type];
        let off = s.offset;
        if (s.type === 'lampL' && !off) off = -1.2; else if (s.type === 'lampR' && !off) off = 1.2;
        const sc = seg.p1.screen.scale, sx = seg.p1.screen.x + sc * off * RW * XS;
        drawSprite(sprImg(s.type), d.w, sc, sx, seg.p1.screen.y, d.center ? -0.5 : (off < 0 ? -1 : 0), -1, seg.clip, Math.min(1, seg.fog * 1.25));
      }
      for (const r of seg.cars) {
        const rz = mod(START * SEG + r.dist, L), pct = (rz % SEG) / SEG;
        const sc = lerp(seg.p1.screen.scale, seg.p2.screen.scale, pct);
        const sx = lerp(seg.p1.screen.x, seg.p2.screen.x, pct) + sc * r.x * RW * XS;
        const sy = lerp(seg.p1.screen.y, seg.p2.screen.y, pct);
        const pose = seg.curve > 2.5 ? 1 : seg.curve < -2.5 ? -1 : 0;
        drawCarSprite(r.m, r.color, pose, sc, sx, sy, seg.clip, Math.min(1, seg.fog * 1.3), th.night || th.rain ? 0.7 : 0);
      }
    }
    if (n === pN && opts.player) drawPlayer(pSeg, pPct, opts.player);
  }
  g.restore();
  if (th.rain) { drawRain(); g.fillStyle = 'rgba(40,50,60,0.12)'; g.fillRect(0, 0, W, H); }
  if (!vignette) {
    vignette = mkCanvas(W / 4, H / 4); const vg = vignette.getContext('2d');
    const gr = vg.createRadialGradient(W / 8, H / 8, H * 0.08, W / 8, H / 8, W * 0.17);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.38)'); vg.fillStyle = gr; vg.fillRect(0, 0, W / 4, H / 4);
  }
  g.drawImage(vignette, 0, 0, W, H);
}
function drawPlayer(pSeg, pPct, p) {
  const sc = CAMD / PZ;
  const cy = lerp(pSeg.p1.camera.y, pSeg.p2.camera.y, pPct);
  let y = H / 2 - sc * cy * YS;
  const sp = p.speed / carMax(p.m);
  if (sp > 0.05) y += (Math.random() - 0.5) * H * (Math.abs(p.x) > 1.05 ? 0.012 : 0.003) * sp;
  const pose = p.steerVis > 0.35 ? 1 : p.steerVis < -0.35 ? -1 : 0;
  const r = drawCarSprite(p.m, p.color, pose, sc, W / 2, y, 0, 1, Math.max(p.brakeT, theme.night || theme.rain ? 0.45 : 0));
  if (!r) return;
  const [dx, dy, dw, dh] = r, g = ctx;
  // humo al derrapar o salir de pista
  const off = Math.abs(p.x) > 1.05 && sp > 0.15;
  if ((p.skid > 0.25 || off) ) {
    g.save();
    for (let i = 0; i < 6; i++) {
      const sx = dx + dw * (i % 2 ? 0.14 : 0.86) + (Math.random() - 0.5) * dw * 0.1, sy = dy + dh * 0.92 - Math.random() * dh * 0.2, R = dh * (0.15 + Math.random() * 0.2);
      g.fillStyle = off ? (theme.ground[0] === '#c8a25e' ? 'rgba(210,180,120,0.35)' : 'rgba(120,100,70,0.3)') : 'rgba(230,230,230,0.28)';
      g.beginPath(); g.arc(sx, sy, R, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  if (theme.rain && sp > 0.2) {
    g.fillStyle = 'rgba(220,230,240,0.22)';
    for (let i = 0; i < 8; i++) { const sx = dx + dw * (i % 2 ? 0.14 : 0.86) + (Math.random() - 0.5) * dw * 0.2, sy = dy + dh * (0.85 + Math.random() * 0.15); g.beginPath(); g.arc(sx, sy, dh * 0.12 * Math.random() * sp + 1, 0, Math.PI * 2); g.fill(); }
  }
  // llama del nitro
  if (p.boost) {
    g.save(); g.globalCompositeOperation = 'lighter';
    const ex = CARS[p.m].st.exh === 'quad' ? [0.38, 0.45, 0.55, 0.62] : CARS[p.m].st.exh === 'twin' ? [0.3, 0.7] : [0.46, 0.54];
    for (const e of ex) {
      const fx = dx + dw * (0.5 + (e - 0.5) * 0.96 * CARS[p.m].st.w), fy = dy + dh * 0.82, R = dw * (0.05 + Math.random() * 0.03);
      const gr = g.createRadialGradient(fx, fy, 0, fx, fy + R * 0.6, R * 1.6);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.3, 'rgba(120,200,255,0.8)'); gr.addColorStop(1, 'rgba(40,80,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(fx, fy + R * 0.5, R * 1.6, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
}
function drawSpeedLines(strength) {
  const g = ctx; g.save(); g.strokeStyle = 'rgba(255,255,255,' + (0.25 * strength) + ')'; g.lineWidth = Math.max(1, PX * 1.5);
  g.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = Math.random() * Math.PI * 2, r0 = H * (0.35 + Math.random() * 0.3), r1 = r0 + H * (0.15 + Math.random() * 0.3);
    g.moveTo(W / 2 + Math.cos(a) * r0 * 1.6, H * 0.5 + Math.sin(a) * r0); g.lineTo(W / 2 + Math.cos(a) * r1 * 1.6, H * 0.5 + Math.sin(a) * r1);
  }
  g.stroke(); g.restore();
}

/* =========================================================
   INTERFAZ
   ========================================================= */
function text(t, x, y, size, col, align, weight, italic) {
  const g = ctx; g.font = (italic ? 'italic ' : '') + (weight || 900) + ' ' + Math.round(size) + 'px system-ui, sans-serif';
  g.textAlign = align || 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillText(t, x + size * 0.05, y + size * 0.07);
  g.fillStyle = col || '#fff'; g.fillText(t, x, y);
}
let uiButtons = [];
function uiButton(id, x, y, w, h, label, o = {}) {
  uiButtons.push({ id, x, y, w, h });
  const g = ctx, r = h * 0.22;
  g.save();
  g.fillStyle = 'rgba(0,0,0,0.4)'; rr(g, x, y + h * 0.08, w, h, r); g.fill();
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, o.disabled ? '#666' : (o.c1 || '#ff4d4d')); gr.addColorStop(1, o.disabled ? '#444' : (o.c2 || '#b3001b'));
  g.fillStyle = gr; rr(g, x, y, w, h, r); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.22)'; rr(g, x + h * 0.06, y + h * 0.05, w - h * 0.12, h * 0.32, r * 0.7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = Math.max(1, h * 0.03); rr(g, x, y, w, h, r); g.stroke();
  g.restore();
  text(label, x + w / 2, y + h * 0.53, h * (o.fs || 0.4), o.tc || '#fff', 'center', 900, true);
}
function panel(x, y, w, h, a) {
  const g = ctx; g.fillStyle = 'rgba(10,12,22,' + (a || 0.78) + ')'; rr(g, x, y, w, h, H * 0.03); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = PX * 1.5; rr(g, x, y, w, h, H * 0.03); g.stroke();
}
function drawLogo(cx, cy, s) {
  const g = ctx;
  g.save(); g.translate(cx, cy); g.transform(1, 0, -0.18, 1, 0, 0);
  g.font = '900 italic ' + Math.round(s) + 'px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const tw = g.measureText('SUPERCAR').width;
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillText('SUPERCAR', -s * 0.45 + s * 0.06, s * 0.08);
  const gr = g.createLinearGradient(0, -s * 0.5, 0, s * 0.5);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, '#cfd8e3'); gr.addColorStop(0.5, '#5b6878'); gr.addColorStop(1, '#e8eef5');
  g.fillStyle = gr; g.fillText('SUPERCAR', -s * 0.45, 0);
  g.lineWidth = s * 0.035; g.strokeStyle = '#1b2030'; g.strokeText('SUPERCAR', -s * 0.45, 0);
  const bx = -s * 0.45 + tw / 2 + s * 0.15;
  const rg = g.createLinearGradient(0, -s * 0.5, 0, s * 0.5); rg.addColorStop(0, '#ff5a5a'); rg.addColorStop(1, '#a3000f');
  g.fillStyle = rg; rr(g, bx, -s * 0.52, s * 1.25, s * 1.04, s * 0.12); g.fill();
  g.fillStyle = '#fff'; g.fillText('GP', bx + s * 0.62, s * 0.02);
  g.restore();
  g.fillStyle = '#ffcc00'; g.fillRect(cx - s * 2.6, cy + s * 0.68, s * 5.4, s * 0.06);
}
function drawCredits() {
  const g = ctx, s = H * 0.045;
  panel(W - s * 7.4, s * 0.5, s * 6.8, s * 1.5, 0.6);
  g.fillStyle = '#ffcc00'; g.beginPath(); g.arc(W - s * 6.4, s * 1.25, s * 0.45, 0, Math.PI * 2); g.fill();
  text('₵', W - s * 6.4, s * 1.27, s * 0.6, '#7a5a00');
  text(fmtNum(save.credits), W - s * 1.1, s * 1.27, s * 0.75, '#ffe27a', 'right');
}
function drawHUD() {
  const g = ctx, p = player, s = H * 0.05, car = CARS[p.m];
  const st = standings(), pos = st.indexOf(p) + 1;
  // posición
  panel(s * 0.4, s * 0.4, s * 5.2, s * 3, 0.55);
  text(pos + '', s * 1.9, s * 2.15, s * 2.2, pos === 1 ? '#ffd24a' : '#ffffff', 'center', 900, true);
  text('/8', s * 3.3, s * 2.5, s * 0.9, '#bbbbbb', 'left', 900, true);
  text('POSICIÓN', s * 3, s * 0.85, s * 0.42, '#9fb3c8');
  // vuelta y tiempo
  panel(s * 5.9, s * 0.4, s * 6.2, s * 3, 0.55);
  text('VUELTA ' + Math.min(p.lap, track.laps) + '/' + track.laps, s * 9, s * 1.05, s * 0.6, '#ffd24a', 'center', 900, true);
  text(fmtTime(Math.max(0, raceT)), s * 9, s * 1.95, s * 0.8, '#ffffff', 'center', 800);
  const bl = save.bestLap[String(trackIdx)];
  text('Récord ' + (bl ? fmtTime(bl) : '--'), s * 9, s * 2.75, s * 0.45, '#9fb3c8', 'center', 700);
  // velocímetro
  const kmh = Math.round(p.speed / BASEMAX * 320);
  const cx = W - s * 3.2, cy = s * 2.6, R = s * 2;
  g.save(); g.lineCap = 'round';
  g.fillStyle = 'rgba(10,12,22,0.55)'; g.beginPath(); g.arc(cx, cy, R * 1.12, 0, Math.PI * 2); g.fill();
  g.lineWidth = s * 0.3; g.strokeStyle = 'rgba(255,255,255,0.15)'; g.beginPath(); g.arc(cx, cy, R * 0.85, Math.PI * 0.75, Math.PI * 2.25); g.stroke();
  const f = clamp(kmh / 400, 0, 1);
  const sg = g.createLinearGradient(cx - R, 0, cx + R, 0); sg.addColorStop(0, '#3dd6ff'); sg.addColorStop(0.7, '#ffd24a'); sg.addColorStop(1, '#ff3b3b');
  g.strokeStyle = sg; g.beginPath(); g.arc(cx, cy, R * 0.85, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * f)); g.stroke();
  g.restore();
  text(kmh + '', cx, cy - s * 0.1, s * 1.1, '#ffffff', 'center', 900, true);
  text('km/h', cx, cy + s * 0.75, s * 0.45, '#9fb3c8');
  // nitro
  const nw = s * 4.2, nx = cx - nw / 2, ny = cy + R * 1.25;
  g.fillStyle = 'rgba(10,12,22,0.6)'; rr(g, nx, ny, nw, s * 0.45, s * 0.2); g.fill();
  const ng = g.createLinearGradient(nx, 0, nx + nw, 0); ng.addColorStop(0, '#2b6bff'); ng.addColorStop(1, '#5ff2ff');
  g.fillStyle = ng; rr(g, nx, ny, Math.max(s * 0.2, nw * p.nitro / car.nitro), s * 0.45, s * 0.2); g.fill();
  text('NITRO', cx, ny + s * 0.9, s * 0.38, '#7fe8ff');
  // progreso de la vuelta
  const bw = W * 0.24, bx = W / 2 - bw / 2 + s * 2, by = s * 0.8, L = trackLength;
  g.fillStyle = 'rgba(10,12,22,0.55)'; rr(g, bx, by - s * 0.2, bw, s * 0.4, s * 0.2); g.fill();
  for (const r of rivals) { const u = mod(r.dist, L) / L; g.fillStyle = r.color; g.beginPath(); g.arc(bx + bw * u, by, s * 0.17, 0, Math.PI * 2); g.fill(); }
  const pu = mod(p.dist, L) / L; g.fillStyle = '#fff'; g.beginPath(); g.arc(bx + bw * pu, by, s * 0.27, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#000'; g.lineWidth = PX; g.stroke();
  // pausa
  const pb = BTN.pause; g.fillStyle = 'rgba(10,12,22,0.55)'; g.beginPath(); g.arc(pb.x, pb.y, pb.r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.fillRect(pb.x - pb.r * 0.35, pb.y - pb.r * 0.4, pb.r * 0.25, pb.r * 0.8); g.fillRect(pb.x + pb.r * 0.1, pb.y - pb.r * 0.4, pb.r * 0.25, pb.r * 0.8);
  // semáforo de salida
  if (raceT < 0.8) {
    const n = raceT < 0 ? clamp(4 - Math.ceil(-raceT), 0, 3) : 4;
    const lx = W / 2, ly = H * 0.3, ls = H * 0.065;
    panel(lx - ls * 2.6, ly - ls * 0.8, ls * 5.2, ls * 1.6, 0.8);
    for (let i = 0; i < 3; i++) {
      const on = n > i, green = n === 4;
      g.fillStyle = green ? '#2bff6a' : on ? '#ff2a2a' : '#331111';
      if (on || green) { g.save(); g.shadowColor = g.fillStyle; g.shadowBlur = ls; }
      g.beginPath(); g.arc(lx + (i - 1) * ls * 1.6, ly, ls * 0.55, 0, Math.PI * 2); g.fill();
      if (on || green) g.restore();
    }
    if (raceT < 0) text(String(Math.ceil(-raceT)), W / 2, H * 0.52, H * 0.22, '#ffffff', 'center', 900, true);
  }
  if (msg) {
    const a = Math.min(1, msg.life * 3), sc = 1 + (1 - Math.min(1, (msg.max - msg.life) * 5)) * 0.4;
    g.globalAlpha = a; text(msg.t, W / 2, H * 0.42, H * 0.12 * sc, msg.c, 'center', 900, true); g.globalAlpha = 1;
  }
  drawControls();
}

/* ---------- Botones táctiles ---------- */
const BTN = {};
function layoutButtons() {
  const r = H * 0.115;
  BTN.pause = { x: W - H * 0.12 - H * 0.24, y: H * 0.1, r: H * 0.055 };
  BTN.pause.x = W * 0.5 + W * 0.15 + H * 0.2; BTN.pause.y = H * 0.135;
  BTN.left = { x: H * 0.2, y: H * 0.8, r };
  BTN.right = { x: H * 0.2 + r * 2.5, y: H * 0.8, r };
  if (save.autoGas) {
    BTN.brake = { x: W - H * 0.2, y: H * 0.8, r };
    BTN.nitro = { x: W - H * 0.2 - r * 2.5, y: H * 0.82, r: r * 0.9 };
    BTN.gas = null;
  } else {
    BTN.gas = { x: W - H * 0.2, y: H * 0.78, r: r * 1.1 };
    BTN.brake = { x: W - H * 0.2 - r * 2.5, y: H * 0.84, r: r * 0.9 };
    BTN.nitro = { x: W - H * 0.2, y: H * 0.5, r: r * 0.8 };
  }
}
function roundBtn(b, label, col, on) {
  if (!b) return;
  const g = ctx;
  g.fillStyle = on ? rgba(col, 0.55) : 'rgba(10,12,22,0.32)'; g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = rgba(col, on ? 1 : 0.7); g.lineWidth = b.r * 0.08; g.stroke();
  if (label === '◀' || label === '▶') {
    const s = label === '◀' ? -1 : 1; g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(b.x + s * b.r * 0.42, b.y); g.lineTo(b.x - s * b.r * 0.28, b.y - b.r * 0.42); g.lineTo(b.x - s * b.r * 0.28, b.y + b.r * 0.42); g.closePath(); g.fill();
  } else text(label, b.x, b.y + b.r * 0.03, b.r * 0.36, '#fff', 'center', 900, true);
}
function drawControls() {
  if (!touchUsed) return;
  if (!save.tilt) { roundBtn(BTN.left, '◀', '#ffffff', input.steer < -0.2); roundBtn(BTN.right, '▶', '#ffffff', input.steer > 0.2); }
  roundBtn(BTN.brake, 'FRENO', '#ff4d4d', input.brake);
  roundBtn(BTN.gas, 'GAS', '#3dff7a', input.gas);
  roundBtn(BTN.nitro, 'NITRO', '#3dd6ff', input.nitro);
}

/* ---------- Entrada: táctil, teclado, mando e inclinación ---------- */
const input = { steer: 0, gas: false, brake: false, nitro: false };
const pointers = new Map(), keys = {};
let touchUsed = true, tiltVal = 0;
window.addEventListener('devicemotion', e => {
  const a = e.accelerationIncludingGravity; if (!a || a.y === null) return;
  const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 90;
  const v = (ang === 90 ? a.y : -a.y) / 4.2;
  tiltVal = Math.abs(v) < 0.07 ? 0 : clamp(v, -1, 1);
});
function near(p, b, k) { return b && Math.hypot(p.x - b.x, p.y - b.y) < b.r * (k || 1.35); }
function readInput() {
  let st = 0, gas = false, br = false, ni = false;
  if (state === 'race' && !paused) {
    for (const p of pointers.values()) {
      if (!save.tilt && p.x < W * 0.42 && p.y > H * 0.45) { if (p.x < BTN.left.x + (BTN.right.x - BTN.left.x) / 2) st -= 1; else st += 1; continue; }
      if (near(p, BTN.nitro)) ni = true;
      else if (near(p, BTN.brake)) br = true;
      else if (near(p, BTN.gas, 1.6)) gas = true;
    }
  }
  if (keys.ArrowLeft || keys.KeyA) st -= 1;
  if (keys.ArrowRight || keys.KeyD) st += 1;
  if (keys.ArrowUp || keys.KeyW) gas = true;
  if (keys.ArrowDown || keys.KeyS) br = true;
  if (keys.Space || keys.ShiftLeft || keys.KeyN) ni = true;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of pads) {
    if (!gp) continue;
    const ax = gp.axes[0] || 0; if (Math.abs(ax) > 0.15) st += ax;
    const b = i => gp.buttons[i] && gp.buttons[i].pressed;
    if (b(14)) st -= 1; if (b(15)) st += 1;
    if (b(0) || b(7)) gas = true; if (b(1) || b(6)) br = true; if (b(2) || b(5)) ni = true;
  }
  if (save.tilt && state === 'race') st += tiltVal;
  input.steer = clamp(st, -1, 1); input.gas = gas; input.brake = br; input.nitro = ni;
}
function cxy(e) { return { x: e.clientX * W / window.innerWidth, y: e.clientY * H / window.innerHeight }; }
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); AU.init(); touchUsed = true;
  const p = cxy(e); pointers.set(e.pointerId, p);
  try { cv.setPointerCapture(e.pointerId); } catch (er) {}
  onTap(p.x, p.y);
}, { passive: false });
cv.addEventListener('pointermove', e => { if (pointers.has(e.pointerId)) pointers.set(e.pointerId, cxy(e)); }, { passive: false });
const endP = e => pointers.delete(e.pointerId);
cv.addEventListener('pointerup', endP); cv.addEventListener('pointercancel', endP);
window.addEventListener('keydown', e => {
  AU.init(); keys[e.code] = true;
  if (e.code === 'Escape' || e.code === 'KeyP') window.onBack();
  if (e.code === 'Enter' && uiButtons.length) onTap(uiButtons[0].x + 1, uiButtons[0].y + 1);
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

/* ---------- Estados y menús ---------- */
let garageIdx = 0;
function setState(s) {
  state = s; stateT = 0;
  if (s === 'title' || s === 'tracks' || s === 'garage' || s === 'settings') {
    AU.engineOff(); AU.playSong(0);
    if (updatePending) { applyUpdate(); return; }
  }
}
function onTap(x, y) {
  if (state === 'race') {
    if (paused) { hitMenu(x, y); return; }
    const b = BTN.pause; if (Math.hypot(x - b.x, y - b.y) < b.r * 1.6) { setPause(true); }
    return;
  }
  hitMenu(x, y);
}
function hitMenu(x, y) {
  if (stateT < 0.25) return;
  for (let i = uiButtons.length - 1; i >= 0; i--) {
    const b = uiButtons[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { AU.click(); doAction(b.id); return; }
  }
}
function doAction(id) {
  const [a, v] = id.split(':'), n = Number(v);
  switch (a) {
    case 'race': setState('tracks'); break;
    case 'garage': garageIdx = save.car; setState('garage'); break;
    case 'settings': setState('settings'); break;
    case 'back': setState('title'); break;
    case 'track': if (n < save.unlocked) startRace(n); else AU.bump(); break;
    case 'gprev': garageIdx = mod(garageIdx - 1, CARS.length); break;
    case 'gnext': garageIdx = mod(garageIdx + 1, CARS.length); break;
    case 'gbuy': {
      const c = CARS[garageIdx];
      if (save.owned.includes(garageIdx)) { save.car = garageIdx; persist(); AU.coin(); }
      else if (save.credits >= c.price) { save.credits -= c.price; save.owned.push(garageIdx); save.car = garageIdx; persist(); AU.win(); vibrate(100); }
      else AU.bump();
      break;
    }
    case 'paint': save.colors[garageIdx] = n; persist(); break;
    case 'toggle': {
      if (v === 'diff') save.diff = (save.diff + 1) % 3;
      else if (v === 'q') { save.q = save.q === 1 ? 0.75 : save.q === 0.75 ? 0.55 : 1; resize(); }
      else save[v] = !save[v];
      persist(); AU.setVol(); layoutButtons(); break;
    }
    case 'resume': setPause(false); break;
    case 'restart': paused = false; startRace(trackIdx); break;
    case 'quit': paused = false; setState('title'); break;
    case 'again': startRace(trackIdx); break;
    case 'nextTrack': startRace(Math.min(trackIdx + 1, save.unlocked - 1)); break;
    case 'menu': setState('title'); break;
  }
}
function setPause(on) {
  if (state !== 'race') return;
  paused = on; stateT = 0.3;
  if (on) { AU.engineSet(0, 0, 0, 0); if (AU.ac) AU.ac.suspend(); }
  else { AU.init(); }
}
window.onBack = () => {
  if (state === 'race') { if (paused) setPause(false); else setPause(true); }
  else if (state === 'title') { if (window.Android && Android.exit) Android.exit(); }
  else setState('title');
};
window.onAppPause = () => { if (state === 'race' && !paused) setPause(true); else if (AU.ac) AU.ac.suspend(); };
window.onAppResume = () => { if (!(state === 'race' && paused) && AU.ac) AU.ac.resume(); };

/* Actualización descargada en segundo plano: se aplica en el menú, nunca a mitad de carrera */
let updatePending = false;
const GAME_VERSION = (() => { try { return (window.Android && Android.gameVersion) ? Android.gameVersion() : 0; } catch (e) { return 0; } })();
window.onUpdateReady = () => { updatePending = true; if (state !== 'race' && state !== 'results') applyUpdate(); };
function applyUpdate() { if (updatePending && window.Android && Android.reload) { updatePending = false; Android.reload(); } }

/* ---------- Pantallas ---------- */
function drawAttract(dt) {
  const ti = save.lastTrack < save.unlocked ? save.lastTrack : 0;
  buildTracks(ti);
  const pm = save.car;
  const sp = carMax(pm) * 0.62;
  attract.dist += sp * dt;
  const seg = findSeg(mod(START * SEG + attract.dist, trackLength));
  attract.x = lerp(attract.x, -seg.curve * 0.08, dt);
  BG.off[0] += seg.curve * 0.62 * dt * 0.06; BG.off[1] = BG.off[2] = BG.off[0];
  renderWorld(attract.dist, attract.x, { player: { m: pm, color: PAINT[save.colors[pm] ?? CARS[pm].paint], speed: sp, x: attract.x, steerVis: seg.curve / 5, brakeT: 0, skid: 0, boost: false } });
}
function drawTitle(dt) {
  drawAttract(dt);
  const g = ctx;
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const s = H * 0.13 * Math.min(1, W / (H * 1.9));
  drawLogo(W / 2, H * 0.2, s);
  text('Campeonato arcade de superdeportivos', W / 2, H * 0.2 + s * 1.15, H * 0.038, '#ffffff', 'center', 700, true);
  uiButtons = [];
  const bw = H * 0.62, bh = H * 0.13;
  uiButton('race', W / 2 - bw / 2, H * 0.47, bw, bh, '▶  CARRERA', { fs: 0.45 });
  uiButton('garage', W / 2 - bw / 2, H * 0.63, bw * 0.485, bh * 0.85, 'GARAJE', { c1: '#4a5568', c2: '#1f2633', fs: 0.42 });
  uiButton('settings', W / 2 + bw * 0.015, H * 0.63, bw * 0.485, bh * 0.85, 'AJUSTES', { c1: '#4a5568', c2: '#1f2633', fs: 0.42 });
  drawCredits();
  text('Coche: ' + CARS[save.car].name, W / 2, H * 0.84, H * 0.035, '#ffe27a', 'center', 800, true);
  if (GAME_VERSION) text('v' + GAME_VERSION, H * 0.06, H * 0.95, H * 0.03, 'rgba(255,255,255,0.8)', 'left');
}
function drawTracks(dt) {
  drawAttract(dt);
  const g = ctx; g.fillStyle = 'rgba(5,8,18,0.72)'; g.fillRect(0, 0, W, H);
  uiButtons = [];
  text('ELIGE CIRCUITO', W / 2, H * 0.09, H * 0.07, '#ffffff', 'center', 900, true);
  drawCredits();
  const cols = 3, gap = H * 0.035, cw = Math.min((W - H * 0.3 - gap * (cols - 1)) / cols, H * 0.75), ch = H * 0.33;
  const x0 = W / 2 - (cols * cw + (cols - 1) * gap) / 2, y0 = H * 0.17;
  TRACKS.forEach((t, i) => {
    const x = x0 + (i % cols) * (cw + gap), y = y0 + Math.floor(i / cols) * (ch + gap), th = THEMES[t.theme];
    const locked = i >= save.unlocked;
    uiButtons.push({ id: 'track:' + i, x, y, w: cw, h: ch });
    g.save(); rr(g, x, y, cw, ch, H * 0.025); g.clip();
    const sg = g.createLinearGradient(0, y, 0, y + ch * 0.55); sg.addColorStop(0, th.sky[0]); sg.addColorStop(1, th.sky[1]);
    g.fillStyle = sg; g.fillRect(x, y, cw, ch);
    g.fillStyle = th.ground[0]; g.fillRect(x, y + ch * 0.55, cw, ch * 0.45);
    g.fillStyle = th.road[0]; g.beginPath(); g.moveTo(x + cw * 0.47, y + ch * 0.55); g.lineTo(x + cw * 0.53, y + ch * 0.55); g.lineTo(x + cw * 0.85, y + ch); g.lineTo(x + cw * 0.15, y + ch); g.closePath(); g.fill();
    g.fillStyle = th.rumble[1]; g.fillRect(x + cw * 0.495, y + ch * 0.62, cw * 0.01, ch * 0.08); g.fillRect(x + cw * 0.49, y + ch * 0.78, cw * 0.02, ch * 0.12);
    if (th.sun) { g.fillStyle = th.sun.c; g.beginPath(); g.arc(x + cw * th.sun.x, y + ch * th.sun.y * 1.1, ch * 0.07, 0, Math.PI * 2); g.fill(); }
    if (th.night) { g.fillStyle = '#ff2bd6'; for (let k = 0; k < 8; k++) g.fillRect(x + cw * (0.05 + k * 0.12), y + ch * (0.3 + (k % 3) * 0.05), cw * 0.07, ch * 0.25); }
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, y + ch * 0.62, cw, ch * 0.38);
    if (locked) { g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x, y, cw, ch); }
    g.restore();
    g.strokeStyle = locked ? 'rgba(255,255,255,0.2)' : '#ffcc00'; g.lineWidth = PX * 2; rr(g, x, y, cw, ch, H * 0.025); g.stroke();
    text(t.name.toUpperCase(), x + cw / 2, y + ch * 0.72, ch * 0.14, '#ffffff', 'center', 900, true);
    text(t.country + ' · ' + t.laps + ' vueltas', x + cw / 2, y + ch * 0.85, ch * 0.075, '#cfd8e3', 'center', 700);
    if (locked) {
      text('🔒', x + cw / 2, y + ch * 0.3, ch * 0.2, '#fff');
      text('Sube al podio en ' + TRACKS[i - 1].name, x + cw / 2, y + ch * 0.94, ch * 0.065, '#ffb3b3', 'center', 700);
    } else {
      const b = save.best[String(i)], pd = save.podiums[String(i)];
      text(b ? 'Mejor: ' + fmtTime(b) : 'Sin tiempo', x + cw / 2, y + ch * 0.94, ch * 0.065, '#ffe27a', 'center', 700);
      if (pd) text(['🥇', '🥈', '🥉'][pd - 1], x + cw * 0.9, y + ch * 0.13, ch * 0.13, '#fff');
    }
  });
  uiButton('back', H * 0.05, H * 0.035, H * 0.3, H * 0.1, '◀ VOLVER', { c1: '#4a5568', c2: '#1f2633', fs: 0.36 });
  text('Dificultad: ' + ['Fácil', 'Normal', 'Difícil'][save.diff], W / 2, H * 0.965, H * 0.033, '#9fb3c8', 'center', 700);
}
function statBar(label, v, x, y, w) {
  const g = ctx, h = H * 0.022;
  text(label, x, y - h * 1.2, H * 0.03, '#cfd8e3', 'left', 700);
  g.fillStyle = 'rgba(255,255,255,0.12)'; rr(g, x, y, w, h, h / 2); g.fill();
  const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#ffcc00'); gr.addColorStop(1, '#ff4d4d');
  g.fillStyle = gr; rr(g, x, y, Math.max(h, w * clamp(v, 0, 1)), h, h / 2); g.fill();
}
function drawGarage(dt) {
  const g = ctx;
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0d1020'); bg.addColorStop(0.62, '#1c2238'); bg.addColorStop(0.63, '#0a0c14'); bg.addColorStop(1, '#151a2a');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const spot = g.createRadialGradient(W * 0.36, H * 0.55, 0, W * 0.36, H * 0.55, H * 0.7);
  spot.addColorStop(0, 'rgba(255,240,210,0.35)'); spot.addColorStop(1, 'rgba(255,240,210,0)');
  g.fillStyle = spot; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = PX;
  for (let i = -10; i <= 10; i++) { g.beginPath(); g.moveTo(W * 0.36 + i * W * 0.02, H * 0.63); g.lineTo(W * 0.36 + i * W * 0.12, H); g.stroke(); }
  uiButtons = [];
  const m = garageIdx, c = CARS[m], owned = save.owned.includes(m);
  const color = PAINT[save.colors[m] ?? c.paint];
  const img = carImg(m, color, Math.sin(stateT * 0.8) > 0.6 ? 1 : Math.sin(stateT * 0.8) < -0.6 ? -1 : 0, true);
  const cw = Math.min(W * 0.48, H * 1.15), chh = cw * img.height / img.width, cx = W * 0.36 - cw / 2, cy = H * 0.63 - chh * 0.93;
  g.drawImage(img, cx, cy, cw, chh);
  g.save(); g.globalAlpha = 0.18; g.translate(0, H * 1.26 + chh * 0.02); g.scale(1, -1); g.drawImage(img, cx, cy, cw, chh); g.restore();
  carGlow(m, cx, cy, cw, chh, 0.35 + 0.25 * Math.sin(stateT * 3));
  if (!owned) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx, cy, cw, chh); }
  // flechas
  uiButton('gprev', H * 0.05, H * 0.45, H * 0.13, H * 0.16, '◀', { c1: '#4a5568', c2: '#1f2633', fs: 0.5 });
  uiButton('gnext', W * 0.72 - H * 0.2, H * 0.45, H * 0.13, H * 0.16, '▶', { c1: '#4a5568', c2: '#1f2633', fs: 0.5 });
  // info
  const px = W * 0.72, pw = W - px - H * 0.06;
  panel(px, H * 0.16, pw, H * 0.8, 0.7);
  text(c.name.toUpperCase(), px + pw / 2, H * 0.24, H * 0.06, '#ffffff', 'center', 900, true);
  text(c.tag, px + pw / 2, H * 0.31, H * 0.032, '#ffcc00', 'center', 700, true);
  const sx = px + pw * 0.1, sw = pw * 0.8;
  statBar('Velocidad  ' + c.top + ' km/h', (c.top - 290) / 85, sx, H * 0.4, sw);
  statBar('Aceleración', (c.acc - 0.85) / 0.5, sx, H * 0.49, sw);
  statBar('Manejo', (c.hand - 0.85) / 0.4, sx, H * 0.58, sw);
  statBar('Nitro', (c.nitro - 2.8) / 3, sx, H * 0.67, sw);
  // pintura
  const ps = Math.min(sw / PAINT.length * 0.85, H * 0.05), pg = (sw - ps * PAINT.length) / (PAINT.length - 1);
  PAINT.forEach((p, i) => {
    const x = sx + i * (ps + pg), y = H * 0.73;
    g.fillStyle = p; rr(g, x, y, ps, ps, ps * 0.3); g.fill();
    if (p === color) { g.strokeStyle = '#fff'; g.lineWidth = PX * 2.5; rr(g, x - PX * 2, y - PX * 2, ps + PX * 4, ps + PX * 4, ps * 0.35); g.stroke(); }
    uiButtons.push({ id: 'paint:' + i, x, y, w: ps, h: ps });
  });
  const inUse = save.car === m;
  const label = inUse ? '✓ EN USO' : owned ? 'ELEGIR' : '₵ ' + fmtNum(c.price);
  uiButton('gbuy', px + pw * 0.1, H * 0.81, pw * 0.8, H * 0.11, label,
    inUse ? { c1: '#2fbf5b', c2: '#167a35', fs: 0.4 } : owned ? { fs: 0.42 } : { c1: save.credits >= c.price ? '#ffcc00' : '#777', c2: save.credits >= c.price ? '#c98a00' : '#444', tc: '#1a1200', fs: 0.42 });
  if (!owned && save.credits < c.price) text('Te faltan ₵ ' + fmtNum(c.price - save.credits), W * 0.36, H * 0.72, H * 0.035, '#ffb3b3', 'center', 700);
  text((m + 1) + ' / ' + CARS.length, W * 0.36, H * 0.12, H * 0.04, '#9fb3c8', 'center', 700);
  uiButton('back', H * 0.05, H * 0.035, H * 0.3, H * 0.1, '◀ VOLVER', { c1: '#4a5568', c2: '#1f2633', fs: 0.36 });
  drawCredits();
}
function drawSettings(dt) {
  drawAttract(dt);
  const g = ctx; g.fillStyle = 'rgba(5,8,18,0.75)'; g.fillRect(0, 0, W, H);
  uiButtons = [];
  text('AJUSTES', W / 2, H * 0.1, H * 0.07, '#ffffff', 'center', 900, true);
  const rows = [
    ['music', 'Música: ' + (save.music ? 'Sí' : 'No')],
    ['sfx', 'Efectos y motor: ' + (save.sfx ? 'Sí' : 'No')],
    ['autoGas', 'Acelerador: ' + (save.autoGas ? 'Automático' : 'Botón GAS')],
    ['tilt', 'Dirección: ' + (save.tilt ? 'Inclinar el móvil' : 'Botones')],
    ['diff', 'Dificultad: ' + ['Fácil', 'Normal', 'Difícil'][save.diff]],
    ['vib', 'Vibración: ' + (save.vib ? 'Sí' : 'No')],
    ['q', 'Calidad gráfica: ' + (save.q === 1 ? 'Máxima' : save.q === 0.75 ? 'Media' : 'Baja')]
  ];
  const bw = Math.min(W * 0.4, H * 0.9), bh = H * 0.085, gap = H * 0.022;
  rows.forEach(([k, l], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = W / 2 + (col ? gap / 2 : -bw - gap / 2), y = H * 0.2 + row * (bh + gap);
    uiButton('toggle:' + k, x, y, bw, bh, l, { c1: '#3b4a63', c2: '#1b2333', fs: 0.36 });
  });
  text('Con acelerador automático solo tienes que girar, frenar y usar el nitro.', W / 2, H * 0.86, H * 0.03, '#cfd8e3', 'center', 600);
  uiButton('back', H * 0.05, H * 0.035, H * 0.3, H * 0.1, '◀ VOLVER', { c1: '#4a5568', c2: '#1f2633', fs: 0.36 });
}
function drawPause() {
  const g = ctx; g.fillStyle = 'rgba(5,8,18,0.7)'; g.fillRect(0, 0, W, H);
  uiButtons = [];
  text('PAUSA', W / 2, H * 0.2, H * 0.1, '#ffffff', 'center', 900, true);
  const bw = H * 0.6, bh = H * 0.12;
  uiButton('resume', W / 2 - bw / 2, H * 0.34, bw, bh, '▶ CONTINUAR', { c1: '#2fbf5b', c2: '#167a35' });
  uiButton('restart', W / 2 - bw / 2, H * 0.5, bw, bh, '↻ REPETIR CARRERA', { c1: '#4a5568', c2: '#1f2633' });
  uiButton('quit', W / 2 - bw / 2, H * 0.66, bw, bh, 'SALIR AL MENÚ', { c1: '#4a5568', c2: '#1f2633' });
}
function drawResults(dt) {
  drawAttractRace(dt);
  const g = ctx; g.fillStyle = 'rgba(5,8,18,0.72)'; g.fillRect(0, 0, W, H);
  uiButtons = [];
  const R = results, pos = R.pos;
  text(pos === 1 ? '¡VICTORIA!' : pos <= 3 ? '¡PODIO!' : 'CARRERA TERMINADA', W / 2, H * 0.09, H * 0.075, pos === 1 ? '#ffd24a' : '#ffffff', 'center', 900, true);
  const px = W * 0.08, pw = W * 0.5, py = H * 0.17, ph = H * 0.68;
  panel(px, py, pw, ph, 0.7);
  R.order.forEach((c, i) => {
    const y = py + ph * 0.08 + i * ph * 0.112, me = c === player;
    if (me) { g.fillStyle = 'rgba(255,204,0,0.22)'; rr(g, px + pw * 0.03, y - ph * 0.05, pw * 0.94, ph * 0.1, H * 0.015); g.fill(); }
    text((i + 1) + 'º', px + pw * 0.09, y, H * 0.045, i < 3 ? ['#ffd24a', '#dfe6ee', '#e0a060'][i] : '#ffffff', 'center', 900, true);
    g.fillStyle = c.color; rr(g, px + pw * 0.17, y - H * 0.015, H * 0.05, H * 0.03, H * 0.01); g.fill();
    text(me ? 'TÚ · ' + CARS[c.m].name : c.name + ' · ' + CARS[c.m].name, px + pw * 0.27, y, H * 0.036, me ? '#ffe27a' : '#ffffff', 'left', me ? 900 : 700);
    text(fmtTime(c.time), px + pw * 0.95, y, H * 0.036, '#cfd8e3', 'right', 700);
  });
  const qx = W * 0.62, qw = W * 0.32;
  panel(qx, py, qw, ph * 0.55, 0.7);
  text('Premio', qx + qw / 2, py + ph * 0.08, H * 0.035, '#9fb3c8', 'center', 700);
  text('+ ₵ ' + fmtNum(R.prize), qx + qw / 2, py + ph * 0.18, H * 0.07, '#ffe27a', 'center', 900, true);
  text('Vuelta rápida: ' + fmtTime(R.bestLap), qx + qw / 2, py + ph * 0.3, H * 0.034, '#ffffff', 'center', 700);
  if (R.rec) text('¡Nuevo récord del circuito!', qx + qw / 2, py + ph * 0.38, H * 0.032, '#3dff7a', 'center', 800);
  if (R.newTrack && save.unlocked > trackIdx + 1) text('Desbloqueado: ' + TRACKS[trackIdx + 1].name, qx + qw / 2, py + ph * 0.46, H * 0.032, '#3dd6ff', 'center', 800);
  const bw = qw, bh = H * 0.095;
  uiButton('again', qx, py + ph * 0.6, bw, bh, '↻ REPETIR', { c1: '#4a5568', c2: '#1f2633', fs: 0.38 });
  if (trackIdx + 1 < save.unlocked) uiButton('nextTrack', qx, py + ph * 0.6 + bh * 1.2, bw, bh, 'SIGUIENTE ▶', { fs: 0.38 });
  uiButton('menu', qx, py + ph * 0.6 + bh * 2.4, bw, bh, 'MENÚ', { c1: '#4a5568', c2: '#1f2633', fs: 0.38 });
  drawCredits();
}
function drawAttractRace(dt) {
  player.dist += player.speed * dt * 0.5;
  renderWorld(player.dist, player.x, { player });
}

/* =========================================================
   BUCLE PRINCIPAL
   ========================================================= */
let lastT = performance.now(), frameAvg = 16, qCheckT = 0, errMsg = null;
window.addEventListener('error', e => { errMsg = String(e.message || e); });
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - lastT) / 1000; lastT = now;
  if (dt > 0.1) dt = 0.1; if (dt <= 0) return;
  stateT += dt;
  try {
    readInput();
    AU.tick();
    if (state === 'race') {
      if (!paused) {
        const steps = dt > 0.034 ? 2 : 1;
        for (let i = 0; i < steps; i++) update(dt / steps);
      }
      renderWorld(player.dist, player.x, { player });
      if (player.boost) drawSpeedLines(1);
      if (state === 'race') { drawHUD(); if (paused) drawPause(); }
      // calidad automática si el móvil va justo
      if (!paused && raceT > 2) {
        frameAvg = lerp(frameAvg, dt * 1000, 0.05); qCheckT += dt;
        if (qCheckT > 4 && frameAvg > 24 && save.q > 0.55) { save.q = save.q === 1 ? 0.75 : 0.55; persist(); resize(); qCheckT = 0; frameAvg = 16; }
      }
    } else if (state === 'title') drawTitle(dt);
    else if (state === 'tracks') drawTracks(dt);
    else if (state === 'garage') drawGarage(dt);
    else if (state === 'settings') drawSettings(dt);
    else if (state === 'results') drawResults(dt);
  } catch (e) { errMsg = String(e && e.stack || e); }
  if (errMsg) { ctx.fillStyle = 'rgba(120,0,0,0.85)'; ctx.fillRect(0, H - H * 0.08, W, H * 0.08); text('Error: ' + errMsg.slice(0, 120), W / 2, H - H * 0.04, H * 0.028, '#fff', 'center', 600); }
}
function boot() {
  resize(); layoutButtons();
  window.addEventListener('resize', () => { resize(); layoutButtons(); });
  AU.playSong(0);
  setState('title');
  requestAnimationFrame(t => { lastT = t; frame(t); });
}
boot();

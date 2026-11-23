/* =========================================================
   SUPERCAR GP 3D — carreras de superdeportivos en 3D
   Motor: three.js (incluido arriba). Todo lo demás se genera por código.
   ========================================================= */
'use strict';

const glCanvas = document.getElementById('gl');
const ui = document.getElementById('ui');
const ctx = ui.getContext('2d');
let W = 0, H = 0, PX = 1;           // tamaño del lienzo de interfaz
let renderer = null;

/* ---------- Guardado ---------- */
const Store = {
  get(k, d) {
    try {
      let v = null;
      if (window.Android && Android.load) v = Android.load(k); else v = localStorage.getItem(k);
      return (v === null || v === undefined || v === '') ? d : JSON.parse(v);
    } catch (e) { return d; }
  },
  set(k, v) {
    try { const s = JSON.stringify(v); if (window.Android && Android.save) Android.save(k, s); else localStorage.setItem(k, s); } catch (e) {}
  }
};
const DEFAULTS = {
  credits: 0, owned: [0], car: 0, colors: {}, up: {}, unlocked: 1, best: {}, bestLap: {}, podiums: {}, ghosts: {},
  music: true, sfx: true, vib: true, autoGas: true, tilt: false, diff: 1, q: 2, cam: 0, lastTrack: 0, champ: null, trophies: 0
};
const save = Object.assign({}, DEFAULTS, Store.get('supercargp3d', {}));
function persist() { Store.set('supercargp3d', save); }
function vibrate(ms) {
  if (!save.vib) return;
  try { if (window.Android && Android.vibrate) Android.vibrate(ms); else if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
}

/* ---------- Utilidades ---------- */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const mod = (v, m) => ((v % m) + m) % m;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
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

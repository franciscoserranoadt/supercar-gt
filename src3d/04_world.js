/* ===== MUNDO 3D: pista, terreno, decorado, cielo y luces ===== */
let scene = null, camera = null, sun = null, hemi = null, pmrem = null, envRT = null;
let world = null, skyMat = null, rainFx = null, headLight = null;
let trackIdx = -1, track = null, theme = THEMES.park;
const T = { N: 0, L: 0, ds: DS };   // datos de la pista: px, py, pz, tx, tz, k, wall, map

function initRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, 1, 0.3, 9000);
  pmrem = new THREE.PMREMGenerator(renderer);
  hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.castShadow = true;
  const sc = sun.shadow.camera; sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 1; sc.far = 600;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
  scene.add(sun); scene.add(sun.target);
  applyQuality();
}
function applyQuality() {
  const q = save.q, dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(Math.min(dpr, [0.9, 1.25, 1.7][q]));
  const sh = q > 0;
  renderer.shadowMap.enabled = sh; sun.castShadow = sh;
  const size = q === 2 ? 2048 : 1024;
  if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  scene.traverse(o => { if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); } });
  resize();
}
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  PX = dpr;
  W = Math.round(window.innerWidth * PX); H = Math.round(window.innerHeight * PX);
  ui.width = W; ui.height = H;
  if (renderer) { renderer.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); }
  if (typeof layoutButtons === 'function') layoutButtons();
}

/* ---------- Texturas generadas por código ---------- */
const TEX = {};
function canvasTex(w, h, draw, repeat, srgb = true) {
  const c = mkCanvas(w, h), g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
  return t;
}
function noise(g, w, h, n, cols, rmin, rmax) {
  for (let i = 0; i < n; i++) { g.fillStyle = cols[Math.floor(rnd() * cols.length)]; const r = rmin + rnd() * (rmax - rmin); g.fillRect(rnd() * w, rnd() * h, r, r); }
}
function asphaltTex(wet) {
  return canvasTex(1024, 2048, (g, w, h) => {
    srand(11);
    g.fillStyle = wet ? '#2e3236' : '#45474b'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 240000, wet ? ['#25282c', '#3a3e43', '#30343a'] : ['#3b3d41', '#52545a', '#4a4c50', '#5d5f64'], 1, 3);
    // trazada de goma (más oscura) y manchas
    for (const u of [0.32, 0.68]) { const gr = g.createLinearGradient(w * (u - 0.12), 0, w * (u + 0.12), 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    for (let i = 0; i < 25; i++) { g.fillStyle = 'rgba(0,0,0,0.06)'; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 10 + rnd() * 40, 20 + rnd() * 80, 0, 0, Math.PI * 2); g.fill(); }
    // líneas blancas de borde
    g.fillStyle = '#e9e9e9'; g.fillRect(w * 0.02, 0, w * 0.022, h); g.fillRect(w * 0.958, 0, w * 0.022, h);
    g.fillStyle = 'rgba(0,0,0,0.15)'; noise(g, w, h, 3000, ['rgba(0,0,0,0.25)'], 1, 2);
  }, true);
}
function grassTex(c1, c2) {
  return canvasTex(1024, 1024, (g, w, h) => {
    srand(5);
    g.fillStyle = c1; g.fillRect(0, 0, w, h / 2); g.fillStyle = c2; g.fillRect(0, h / 2, w, h / 2);
    for (let i = 0; i < 60; i++) { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); const x = rnd() * w, y = rnd() * h, r = 20 + rnd() * 70; g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,240,0.05)'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    noise(g, w, h, 160000, [shade(c1, -0.15), shade(c1, 0.12), shade(c2, -0.1), shade(c2, 0.15)], 1, 3);
    for (let i = 0; i < 60; i++) { g.fillStyle = rgba(c1.length === 7 ? c1 : '#4f8f30', 0.0); }
  }, true);
}
function kerbTex() {
  return canvasTex(64, 256, (g, w, h) => {
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#f2f2f2' : '#d1222b'; g.fillRect(0, i * h / 4, w, h / 4); }
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(0,0,0,0.25)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, true);
}
function wallTex(type) {
  return canvasTex(256, 64, (g, w, h) => {
    if (type === 'armco') {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#d7dbe0'); gr.addColorStop(0.3, '#9aa1a8'); gr.addColorStop(0.5, '#e4e7ea'); gr.addColorStop(0.75, '#8a9198'); gr.addColorStop(1, '#5f656b');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#4a4f55'; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 6, h);
    } else {
      for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#f0f0f0' : '#cf1f2a'; g.fillRect(k * w / 4, 0, w / 4, h); }
      g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 4; k++) g.fillRect(k * w / 4, 0, 3, h);
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
  }, true);
}
function facadeTex(neon, emissive) {
  return canvasTex(256, 512, (g, w, h) => {
    srand(neon ? 21 : 33);
    g.fillStyle = emissive ? '#000' : (neon ? '#16122a' : '#ffffff'); g.fillRect(0, 0, w, h);
    for (let y = 12; y < h - 10; y += 22) for (let x = 10; x < w - 10; x += 24) {
      const lit = rnd() < (neon ? 0.5 : 0);
      if (emissive) { if (lit) { g.fillStyle = rnd() < 0.7 ? '#ffd890' : '#8fe6ff'; g.fillRect(x, y, 14, 12); } continue; }
      g.fillStyle = neon ? (lit ? '#ffd890' : '#0b0a14') : '#3c5f7a'; g.fillRect(x, y, 14, 12);
      if (!neon) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x, y, 14, 3); g.fillStyle = '#2f6b45'; g.fillRect(x - 4, y, 3, 12); g.fillRect(x + 15, y, 3, 12); }
    }
    if (!neon && !emissive) { g.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 0; y < h; y += 22) g.fillRect(0, y, w, 2); }
  }, true);
}
function crowdTex() {
  return canvasTex(512, 128, (g, w, h) => {
    srand(9); g.fillStyle = '#7d838b'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 8; r++) { g.fillStyle = r % 2 ? '#8e949c' : '#757b83'; g.fillRect(0, r * 16, w, 16); }
    noise(g, w, h, 1800, ['#e63946', '#f1faee', '#ffb703', '#219ebc', '#2a9d8f', '#e76f51', '#222', '#ffd6a5'], 3, 5);
  }, true);
}
function checkerTex() {
  return canvasTex(256, 64, (g, w, h) => { const s = 16; for (let x = 0; x < w / s; x++) for (let y = 0; y < h / s; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4'; g.fillRect(x * s, y * s, s, s); } }, true);
}
function bannerTex() {
  return canvasTex(1024, 128, (g, w, h) => {
    g.fillStyle = '#111'; g.fillRect(0, 0, w, h);
    const s = 16; for (let x = 0; x < w / s; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#eee'; g.fillRect(x * s, y * s, s, s); g.fillRect(x * s, h - (y + 1) * s, s, s); }
    g.font = '900 italic 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffcc00'; g.fillText('SUPERCAR GP  ·  LA PIRULETA', w / 2, h / 2 + 2);
  }, true);
}
function boardTex(v) {
  const B = [['LA PIRULETA', 'CAFÉ · PAN · TARTAS · ALCORCÓN', '#ff4fa3', '#ffffff'], ['SUPERCAR GP', 'CAMPEONATO 2026', '#111111', '#ffcc00'],
    ['PIRU COLA', '¡REFRESCA TU VUELTA!', '#d8202a', '#ffffff'], ['TURBO OIL', 'MÁXIMO RENDIMIENTO', '#0d4fa8', '#ffffff']][v];
  return canvasTex(512, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, shade(B[2], 0.15)); gr.addColorStop(1, shade(B[2], -0.25));
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = B[3];
    g.font = '900 54px system-ui, sans-serif'; g.fillText(B[0], w / 2, h * 0.4);
    g.font = '700 22px system-ui, sans-serif'; g.fillText(B[1], w / 2, h * 0.8);
  }, true);
}
function glowTex() {
  return canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, false);
}
function blobTex() {
  return canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, false);
}
function cloudTex() {
  return canvasTex(256, 128, (g, w, h) => {
    srand(4);
    for (let i = 0; i < 18; i++) {
      const x = w * (0.2 + rnd() * 0.6), y = h * (0.45 + rnd() * 0.2), r = h * (0.18 + rnd() * 0.22);
      const gr = g.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  }, true);
}

/* ---------- Geometría de la pista ---------- */
function computeTrack(ti) {
  const t = TRACKS[ti];
  const pts = t.shape.map(p => new THREE.Vector3(p[0], 0, p[1]));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  const L = curve.getLength(), N = Math.round(L / DS), sp = curve.getSpacedPoints(N);
  t.len = L;
  // la muestra 0 de la curva es la línea de meta: se desplaza para que quede en START_I
  const off = mod(-START_I, N);
  const px = new Float32Array(N), pz = new Float32Array(N);
  for (let i = 0; i < N; i++) { const q = sp[(i + off) % N]; px[i] = q.x; pz[i] = q.z; }
  const tang = i => { const a = mod(i - 1, N), b = (i + 1) % N; const dx = px[b] - px[a], dz = pz[b] - pz[a], l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
  const tx = new Float32Array(N), tz = new Float32Array(N);
  for (let i = 0; i < N; i++) { const q = tang(i); tx[i] = q[0]; tz[i] = q[1]; }
  const k0 = new Float32Array(N), k = new Float32Array(N);
  for (let i = 0; i < N; i++) { const a = mod(i - 2, N), b = (i + 2) % N; k0[i] = ((tx[b] - tx[a]) * -tz[i] + (tz[b] - tz[a]) * tx[i]) / (4 * DS); }
  for (let i = 0; i < N; i++) { let s = 0; for (let m = -5; m <= 5; m++) s += k0[mod(i + m, N)]; k[i] = s / 11; }
  const py = new Float32Array(N);
  for (const [st, ln, hh] of t.hills) {
    const a0 = Math.floor(st * N), L0 = Math.max(40, Math.floor(ln * N)), h = clamp(hh, -0.07 * L0 * DS / Math.PI, 0.07 * L0 * DS / Math.PI);
    for (let m = 0; m <= L0; m++) py[mod(a0 + m, N)] += h * (1 - Math.cos(2 * Math.PI * m / L0)) / 2;
  }
  Object.assign(T, { N, L: N * DS, px, py, pz, tx, tz, k });
  // curvatura "de pico" (poco suavizada) para calcular a qué velocidad se puede pasar
  const kp = new Float32Array(N);
  for (let i = 0; i < N; i++) { let m = 0; for (let q = -3; q <= 3; q++) m = Math.max(m, Math.abs(k0[mod(i + q, N)])); kp[i] = Math.max(m * 0.85, Math.abs(k[i])); }
  T.kp = kp;
  // trazada ideal: hacia el interior de la curva que viene, suavizada
  const line0 = new Float32Array(N), line = new Float32Array(N);
  for (let i = 0; i < N; i++) { let ka = 0; for (let j = -6; j <= 18; j += 2) ka += k[mod(i + j, N)]; line0[i] = clamp(ka / 13 * 420, -3.4, 3.4); }
  for (let i = 0; i < N; i++) { let sm = 0; for (let m = -12; m <= 12; m++) sm += line0[mod(i + m, N)]; line[i] = sm / 25; }
  T.line = line;
  const cell = 30, grid = new Map();
  for (let i = 0; i < N; i++) { const key = Math.floor(px[i] / cell) + ',' + Math.floor(pz[i] / cell); if (!grid.has(key)) grid.set(key, []); grid.get(key).push(i); }
  T.grid = grid; T.cell = cell;
  const far = (i, j) => { const d = Math.abs(i - j); return Math.min(d, N - d); };
  // cruces (Suzuka): la segunda pasada sube por un puente
  T.bridge = null;
  if (t.bridge) {
    let best = null;
    for (let i = 0; i < N; i += 2) nearIdx(px[i], pz[i], 20, j => { if (j > i && far(i, j) > 150) { const d = Math.hypot(px[j] - px[i], pz[j] - pz[i]); if (!best || d < best[2]) best = [i, j, d]; } });
    if (best) {
      const c = best[1], Lb = 300;
      for (let m = -Lb / 2; m <= Lb / 2; m++) py[mod(c + m, N)] += 8.5 * (1 + Math.cos(Math.PI * m / (Lb / 2))) / 2;
      T.bridge = { c, a: mod(c - 70, N), n: 140, under: best[0] };
    }
  }
  // espacio libre hasta otra parte del circuito (en 3D, para no pisar pistas vecinas)
  const clear = new Float32Array(N), wall = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let md = 400;
    nearIdx(px[i], pz[i], 120, j => { if (far(i, j) > 60) { const d = Math.hypot(px[j] - px[i], pz[j] - pz[i], (py[j] - py[i]) * 4); if (d < md) md = d; } });
    clear[i] = md;
  }
  for (let i = 0; i < N; i++) {
    let c = 400; for (let m = -15; m <= 15; m++) c = Math.min(c, clear[mod(i + m, N)]);
    wall[i] = clamp(Math.min(ROAD_W / 2 + theme.gap, c / 2 - 1.5), ROAD_W / 2 + 1.6, 40);
  }
  // en la parte interior de las curvas cerradas el muro no puede alejarse más que el radio (si no, se dobla y cruza la pista)
  const wl0 = new Float32Array(N), wr0 = new Float32Array(N), wL = new Float32Array(N), wR = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let rinL = 1e9, rinR = 1e9;
    for (let m = -14; m <= 14; m++) { const kk = k0[mod(i + m, N)]; if (kk > 1e-4) rinR = Math.min(rinR, 1 / kk); else if (kk < -1e-4) rinL = Math.min(rinL, -1 / kk); }
    const mn = ROAD_W / 2 + 1.6;
    wl0[i] = Math.max(mn, Math.min(wall[i], rinL * 0.7)); wr0[i] = Math.max(mn, Math.min(wall[i], rinR * 0.7));
  }
  for (let i = 0; i < N; i++) { let a = 1e9, b = 1e9; for (let m = -6; m <= 6; m++) { a = Math.min(a, wl0[mod(i + m, N)]); b = Math.min(b, wr0[mod(i + m, N)]); } wL[i] = a; wR[i] = b; }
  for (let i = 0; i < N; i++) { let a = 0, b = 0; for (let m = -4; m <= 4; m++) { a += wL[mod(i + m, N)]; b += wR[mod(i + m, N)]; } wl0[i] = a / 9; wr0[i] = b / 9; }
  T.clear = clear; T.wallL = wl0; T.wallR = wr0; T.wall = wall;
  let minX = 1e9, minZ = 1e9, maxX = -1e9, maxZ = -1e9;
  for (let i = 0; i < N; i++) { minX = Math.min(minX, px[i]); maxX = Math.max(maxX, px[i]); minZ = Math.min(minZ, pz[i]); maxZ = Math.max(maxZ, pz[i]); }
  T.box = [minX, minZ, maxX, maxZ];
  const sz = Math.max(maxX - minX, maxZ - minZ);
  T.map = []; for (let i = 0; i < N; i++) T.map.push([(px[i] - (minX + maxX) / 2) / sz, (pz[i] - (minZ + maxZ) / 2) / sz]);
  T.center = [(minX + maxX) / 2, (minZ + maxZ) / 2];
}
function nearIdx(x, z, r, fn) {
  const c = T.cell, x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c), z0 = Math.floor((z - r) / c), z1 = Math.floor((z + r) / c);
  for (let a = x0; a <= x1; a++) for (let b = z0; b <= z1; b++) { const l = T.grid.get(a + ',' + b); if (l) for (const j of l) fn(j); }
}
function nearestTrack(x, z, r) {
  let bd = 1e9, bi = -1;
  nearIdx(x, z, r || 90, j => { const d = (T.px[j] - x) ** 2 + (T.pz[j] - z) ** 2; if (d < bd) { bd = d; bi = j; } });
  return [bi, Math.sqrt(bd)];
}
// altura del terreno: pegado a la pista cerca y ondulado lejos
function terrainY(x, z) {
  let bd = 1e18, minY = 1e9;
  nearIdx(x, z, 70, j => { const d = (T.px[j] - x) ** 2 + (T.pz[j] - z) ** 2; if (d < bd) bd = d; if (d < 900 && T.py[j] < minY) minY = T.py[j]; });
  const far = Math.sin(x * 0.004) * Math.cos(z * 0.0035) * 10 + Math.sin(x * 0.011 + z * 0.007) * 4 + 3;
  if (bd > 1e17) return far;
  if (minY > 1e8) { const [i] = nearestTrack(x, z, 70); minY = T.py[i]; }
  const d = Math.sqrt(bd), near = minY - 0.35, w = clamp((d - ROAD_W / 2 - 12) / 50, 0, 1);
  return lerp(near, Math.max(near - 2, far * (theme.night || theme.buildings ? 0.15 : 1)), w * w * (3 - 2 * w));
}
function wallAt(i, s) { i = mod(i, T.N); return s > 0 ? T.wallR[i] : T.wallL[i]; }
function trackPos(i, d) { i = mod(i, T.N); return [T.px[i] - T.tz[i] * d, T.py[i], T.pz[i] + T.tx[i] * d]; }   // derecha = (-tz, tx)

function ribbon(i0, count, fn, closed) {
  const pos = [], uv = [], idx = [];
  for (let n = 0; n <= count; n++) {
    const i = mod(i0 + n, T.N), [dA, yA, dB, yB, uA, uB] = fn(i), v = n * DS;
    const rx = -T.tz[i], rz = T.tx[i];
    pos.push(T.px[i] + rx * dA, T.py[i] + yA, T.pz[i] + rz * dA, T.px[i] + rx * dB, T.py[i] + yB, T.pz[i] + rz * dB);
    uv.push(uA, v, uB, v);
    if (n < count) { const a = n * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function cornerRanges() {
  const N = T.N, on = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (Math.abs(T.k[i]) > 1 / 260) for (let m = -14; m <= 14; m++) on[mod(i + m, N)] = 1;
  const out = []; let i = 0;
  while (i < N) { if (on[i]) { let j = i; while (j < N && on[j]) j++; out.push([i, j - i]); i = j; } else i++; }
  return out;
}

/* ---------- Construcción del escenario ---------- */
function disposeWorld() {
  if (!world) return;
  scene.remove(world);
  world.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); }); });
  world = null;
}
function buildTracks(ti) {
  if (trackIdx === ti && world) return;
  disposeWorld();
  trackIdx = ti; track = TRACKS[ti]; theme = THEMES[track.theme];
  computeTrack(ti);
  world = new THREE.Group(); scene.add(world);
  const th = theme;
  scene.fog = new THREE.Fog(th.fog[0], th.fog[1], th.fog[2]);
  hemi.color.set(th.hemi[0]); hemi.groundColor.set(th.hemi[1]); hemi.intensity = th.hemi[2];
  sun.color.set(th.sun.c); sun.intensity = th.sun.i;
  renderer.toneMappingExposure = th.exposure;
  buildSky();
  // carretera
  const road = new THREE.Mesh(ribbon(0, T.N, () => [-ROAD_W / 2, 0, ROAD_W / 2, 0, 0, 1]).scale(1, 1, 1),
    new THREE.MeshStandardMaterial({ map: asphaltTex(th.rain), roughness: th.rain ? 0.32 : 0.88, metalness: th.rain ? 0.25 : 0.0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  road.material.map.repeat.set(1, 1 / 14); road.receiveShadow = true; world.add(road);
  // pianos en las curvas
  const km = new THREE.MeshStandardMaterial({ map: kerbTex(), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  km.map.repeat.set(1, 1 / 4);
  for (const [a, n] of cornerRanges()) for (const s of [-1, 1]) {
    const m = new THREE.Mesh(ribbon(a, n, () => s < 0 ? [-ROAD_W / 2 - KERB_W, 0.02, -ROAD_W / 2, 0.06, 0, 1] : [ROAD_W / 2, 0.06, ROAD_W / 2 + KERB_W, 0.02, 0, 1]), km);
    m.receiveShadow = true; world.add(m);
  }
  // arcén de hierba que baja hasta el terreno
  const gTex = grassTex(th.grass, th.grass2); gTex.repeat.set(0.25, 1 / 20);
  const vm = new THREE.MeshStandardMaterial({ map: gTex, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(ribbon(0, T.N, i => { const w = Math.min(wallAt(i, s) + 2, ROAD_W / 2 + 8); return s < 0 ? [-w, -0.33, -ROAD_W / 2 + 0.1, -0.01, 0, 1] : [ROAD_W / 2 - 0.1, -0.01, w, -0.33, 0, 1]; }), vm);
    m.receiveShadow = true; world.add(m);
  }
  buildTerrain();
  buildWalls();
  if (T.bridge) buildBridge();
  buildStart();
  buildScenery();
  buildDetails();
  buildMountains();
  if (th.rain) buildRain(); else rainFx = null;
  if (th.night) { if (!headLight) { headLight = new THREE.SpotLight(0xfff1d8, 900, 160, 0.42, 0.5, 1.4); scene.add(headLight); scene.add(headLight.target); } headLight.visible = true; }
  else if (headLight) headLight.visible = false;
  buildEnv();
}
function terrainMeshY(x, z) {   // altura real de la malla del terreno (interpolada)
  const G = T.tg, fx = (x - G.gx0) / G.cell, fz = (z - G.gz0) / G.cell, ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, v = fz - iz, n = G.n1;
  if (ix < 0 || iz < 0 || ix >= n - 1 || iz >= n - 1) return -99;
  const h = G.h, a = h[iz * n + ix], b = h[iz * n + ix + 1], c = h[(iz + 1) * n + ix], d = h[(iz + 1) * n + ix + 1];
  return Math.max(lerp(lerp(a, b, u), lerp(c, d, u), v), a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v);
}
function carveTerrain() {
  const G = T.tg, n = G.n1, h = G.h;
  for (let pass = 0; pass < 3; pass++) for (let i = 0; i < T.N; i++) for (const off of [-ROAD_W / 2 - KERB_W - 3, -ROAD_W / 2, -3, 0, 3, ROAD_W / 2, ROAD_W / 2 + KERB_W + 3]) {
    const [x, y, z] = trackPos(i, off);
    if (terrainMeshY(x, z) <= y - 0.25) continue;
    const ix = Math.floor((x - G.gx0) / G.cell), iz = Math.floor((z - G.gz0) / G.cell);
    for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const k = (iz + b) * n + ix + a; if (h[k] > y - 0.45) h[k] = y - 0.45; }
  }
}
function buildTerrain() {
  const [x0, z0, x1, z1] = T.box, m = 900, size = Math.max(x1 - x0, z1 - z0) + m * 2, seg = Math.min(260, Math.ceil(size / 10));
  const geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, p = geo.attributes.position;
  const n1 = seg + 1, cell = size / seg, gx0 = cx - size / 2, gz0 = cz - size / 2, hg = new Float32Array(n1 * n1), vi = new Int32Array(n1 * n1);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + cx, z = p.getZ(i) + cz, ix = Math.round((x - gx0) / cell), iz = Math.round((z - gz0) / cell);
    hg[iz * n1 + ix] = terrainY(x, z); vi[iz * n1 + ix] = i; p.setX(i, x); p.setZ(i, z);
  }
  T.tg = { gx0, gz0, cell, n1, h: hg };
  carveTerrain();   // garantiza que el césped nunca asome por encima del asfalto
  for (let k = 0; k < hg.length; k++) p.setY(vi[k], hg[k]);
  geo.computeVertexNormals();
  const tex = grassTex(theme.grass, theme.grass2); tex.repeat.set(size / 30, size / 30);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  mesh.receiveShadow = true; world.add(mesh);
  // suelo lejano hasta el horizonte
  const far = new THREE.Mesh(new THREE.CircleGeometry(9000, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: shade(theme.grass, -0.1), roughness: 1 }));
  far.position.set(cx, -6, cz); world.add(far);
  if (theme.buildings === 'pastel') {
    const sea = new THREE.Mesh(new THREE.CircleGeometry(9000, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#1f6fb0', roughness: 0.15, metalness: 0.3 }));
    sea.position.set(cx + size * 0.55 + 4000, -2, cz); sea.scale.set(1, 1, 1); world.add(sea);
  }
}
function buildWalls() {
  const tex = wallTex(theme.wall); tex.repeat.set(1, 1);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: theme.wall === 'armco' ? 0.35 : 0.7, metalness: theme.wall === 'armco' ? 0.6 : 0, side: THREE.DoubleSide });
  const h = theme.wall === 'armco' ? 0.85 : 1.15;
  for (const s of [-1, 1]) {
    const pos = [], uv = [], idx = [];
    for (let n = 0; n <= T.N; n++) {
      const i = n % T.N, [x, y, z] = trackPos(i, s * wallAt(i, s)), gy = Math.max(Math.min(y, terrainY(x, z)) - 0.2, y - 1.6);
      pos.push(x, gy, z, x, y + h, z); uv.push(n * DS / (theme.wall === 'armco' ? 8 : 6), 0, n * DS / (theme.wall === 'armco' ? 8 : 6), 1);
      if (n < T.N) { const a = n * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; world.add(m);
  }
}
function buildBridge() {
  const B = T.bridge, cm = new THREE.MeshStandardMaterial({ color: '#9a9fa6', roughness: 0.85, side: THREE.DoubleSide });
  const ww = ROAD_W / 2 + 2.2;
  for (const s of [-1, 1]) world.add(new THREE.Mesh(ribbon(B.a, B.n, i => [s * ww, -1.4, s * ww, 0.9, 0, 1]), cm));
  world.add(new THREE.Mesh(ribbon(B.a, B.n, () => [-ww, -1.4, ww, -1.4, 0, 1]), cm));
  for (let m = 20; m < B.n; m += 25) {
    const i = mod(B.a + m, T.N), [x, y, z] = trackPos(i, 0), gy = terrainY(x, z), h = y - 1.4 - gy;
    if (h < 1) continue;
    for (const s of [-1, 1]) { const [px2, , pz2] = trackPos(i, s * (ww - 1)); let clash = false; nearIdx(px2, pz2, 15, j => { if (T.py[j] < y - 3 && Math.hypot(T.px[j] - px2, T.pz[j] - pz2) < ROAD_W / 2 + 3) clash = true; }); if (clash) continue; const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, h, 1.2), cm); p.position.set(px2, gy + h / 2, pz2); p.castShadow = true; world.add(p); }
  }
}
function placeAt(obj, i, d, yOff) { const [x, y, z] = trackPos(i, d); obj.position.set(x, y + (yOff || 0), z); obj.rotation.y = Math.atan2(-T.tz[i], T.tx[i]); return obj; }
function buildStart() {
  const i = START_I;
  // línea de meta a cuadros
  const ct = checkerTex(); ct.repeat.set(ROAD_W / 4, 1);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(2.2, ROAD_W).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: ct, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  placeAt(line, i, 0, 0.01); line.receiveShadow = true; world.add(line);
  // casillas de salida
  const bm = new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  for (let k = 0; k < 8; k++) {
    const row = Math.floor(k / 2), d = k % 2 ? 3 : -3, gi = i - 6 - row * 5 - (k % 2) * 2;
    const box = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 2.6).rotateX(-Math.PI / 2), bm); placeAt(box, gi, d, 0.01); world.add(box);
  }
  // pórtico
  const pm = new THREE.MeshStandardMaterial({ color: '#d9dde2', roughness: 0.4, metalness: 0.5 });
  const gw = ROAD_W + 4;
  const g = new THREE.Group();
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8, 0.6), pm); p.position.set(0, 4, s * gw / 2); p.castShadow = true; g.add(p); }
  const bt = bannerTex();
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1, 1.6, gw + 0.6), [pm, pm, pm, pm, new THREE.MeshStandardMaterial({ map: bt, roughness: 0.6 }), new THREE.MeshStandardMaterial({ map: bt, roughness: 0.6 })]);
  beam.position.set(0, 7.6, 0); beam.castShadow = true; g.add(beam);
  START_LIGHTS.length = 0;
  for (let k = 0; k < 5; k++) {
    const lm = new THREE.MeshStandardMaterial({ color: '#220000', emissive: '#ff1a1a', emissiveIntensity: 0 });
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), lm); l.position.set(-0.55, 6.5, (k - 2) * 0.8); g.add(l); START_LIGHTS.push(lm);
  }
  placeAt(g, i, 0); world.add(g);
  // gradas a ambos lados de la recta
  const ctex = crowdTex(); ctex.repeat.set(6, 1);
  const sm = new THREE.MeshStandardMaterial({ map: ctex, roughness: 0.9 }), sb = new THREE.MeshStandardMaterial({ color: '#8b9199', roughness: 0.8 }), sr = new THREE.MeshStandardMaterial({ color: '#c0262d', roughness: 0.6 });
  for (const s of [-1, 1]) for (const off of [-45, 25]) {
    const ii = mod(i + off, T.N), d = s * (wallAt(ii, s) + 9);
    if (theme.night) continue;
    { const [qx, , qz] = trackPos(ii, d); if (!freeSpot(qx, qz, ROAD_W / 2 + 7)) continue; }
    const st = new THREE.Group();
    const front = new THREE.Mesh(new THREE.PlaneGeometry(60, 13), sm); front.rotation.order = 'YXZ'; front.rotation.x = -Math.PI / 2 + 0.6; front.position.set(0, 4.5, 0); if (s > 0) front.rotation.y = Math.PI;
    const back = new THREE.Mesh(new THREE.BoxGeometry(60, 9, 1), sb); back.position.set(0, 4.5, s * 5.6);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(62, 0.4, 9), sr); roof.position.set(0, 11, s * 2.5);
    for (const o of [front, back, roof]) { o.castShadow = true; o.receiveShadow = true; st.add(o); }
    const pi = ii; placeAt(st, pi, d); st.position.y = terrainY(st.position.x, st.position.z); world.add(st);
  }
}
const START_LIGHTS = [];

function instanced(geo, mat, list, shadow) {
  if (!list.length) return;
  const m = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D(), c = new THREE.Color();
  list.forEach((it, n) => {
    o.position.set(it[0], it[1], it[2]); o.rotation.set(0, it[3] || 0, 0); o.scale.set(it[4], it[5] ?? it[4], it[6] ?? it[4]); o.updateMatrix(); m.setMatrixAt(n, o.matrix);
    if (it[7]) m.setColorAt(n, c.set(it[7]));
  });
  m.castShadow = !!shadow; m.receiveShadow = true; world.add(m);
  return m;
}
function freeSpot(x, z, minD) { const [, d] = nearestTrack(x, z, minD + 5); return d > minD; }
function buildScenery() {
  srand(777 + trackIdx * 31);
  const th = theme, trees = { pine: [], round: [], cherry: [], palm: [], olive: [], bush: [] };
  const N = T.N;
  // árboles junto a la pista
  for (let i = 0; i < N; i += 3) for (const s of [-1, 1]) {
    if (!th.trees.length || rnd() > 0.55) continue;
    if (Math.abs(i - START_I) < 70) continue;
    const d = s * (wallAt(i, s) + 4 + rnd() * 45), [x, , z] = trackPos(i, d);
    if (!freeSpot(x, z, ROAD_W / 2 + th.gap + 3)) continue;
    const type = th.trees[Math.floor(rnd() * th.trees.length)], sc = 0.75 + rnd() * 0.6;
    trees[type].push([x, terrainY(x, z), z, rnd() * 6.28, sc]);
  }
  // bosque lejano
  const [x0, z0, x1, z1] = T.box;
  for (let n = 0; n < (th.trees.length ? 900 : 0); n++) {
    const x = lerp(x0 - 600, x1 + 600, rnd()), z = lerp(z0 - 600, z1 + 600, rnd());
    if (!freeSpot(x, z, 60)) continue;
    const type = th.trees[Math.floor(rnd() * th.trees.length)];
    trees[type].push([x, terrainY(x, z), z, rnd() * 6.28, 0.9 + rnd() * 0.9]);
  }
  const trunkM = new THREE.MeshStandardMaterial({ color: '#5a3d26', roughness: 1 });
  const leaf = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true });
  const tr = (l, h, r) => l.map(t => [t[0], t[1] + h * t[4] / 2, t[2], t[3], t[4] * r, t[4], t[4] * r]);
  const col = (l, cs) => l.map(t => (t[7] = cs[Math.floor(rnd() * cs.length)], t));
  if (trees.pine.length) {
    instanced(new THREE.CylinderGeometry(0.22, 0.32, 3, 6), trunkM, tr(trees.pine, 3, 1), true);
    instanced(new THREE.ConeGeometry(2.4, 8, 8).translate(0, 7, 0), leaf('#ffffff'), col(trees.pine.map(t => t.slice()), ['#24572f', '#2c6436', '#1f4c2a', '#2f6b3a']), true);
  }
  for (const [type, cs] of [['round', ['#3f7f35', '#4b8c3c', '#356f2e']], ['cherry', ['#f3a6c4', '#f7bcd3', '#e98fb3']], ['olive', ['#8a9a6a', '#7d8f5f', '#97a676']]]) {
    if (!trees[type].length) continue;
    const big = type === 'olive' ? 0.7 : 1;
    instanced(new THREE.CylinderGeometry(0.25, 0.35, 3.5, 6), trunkM, tr(trees[type], 3.5 * big, big), true);
    instanced(new THREE.IcosahedronGeometry(3.2 * big, 1).translate(0, 5.5 * big, 0), leaf('#ffffff'), col(trees[type].map(t => [t[0], t[1], t[2], t[3], t[4], t[4] * 0.85, t[4]]), cs), true);
  }
  if (trees.bush.length) instanced(new THREE.IcosahedronGeometry(1.3, 1).translate(0, 0.6, 0), leaf('#ffffff'), col(trees.bush.map(t => t.slice()), ['#7f7a3c', '#8d8a48', '#6e6a33']), true);
  if (trees.palm.length) {
    instanced(new THREE.CylinderGeometry(0.18, 0.3, 9, 6).translate(0, 4.5, 0), new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 1 }), trees.palm.map(t => [t[0], t[1], t[2], t[3], t[4]]), true);
    const fr = new THREE.ConeGeometry(3.6, 1.6, 7).translate(0, 9.2, 0);
    instanced(fr, leaf('#ffffff'), col(trees.palm.map(t => t.slice()), ['#2f8f3a', '#3a9e45', '#287a32']), true);
  }
  // edificios
  if (th.buildings) {
    const neon = th.buildings === 'neon', list = [], signs = [];
    for (let i = 0; i < N; i += neon ? 14 : 11) for (const s of [-1, 1]) {
      if (Math.abs(i - START_I) < 30 && !neon) continue;
      const w = 14 + rnd() * 14, dep = 12 + rnd() * 10, h = neon ? 25 + rnd() * 90 : 10 + rnd() * 18;
      const d = s * (wallAt(i, s) + 4 + dep / 2 + rnd() * 6), [x, , z] = trackPos(i, d);
      if (!freeSpot(x, z, ROAD_W / 2 + th.gap + 2 + dep / 2)) continue;
      const y = terrainY(x, z), rot = Math.atan2(-T.tz[i], T.tx[i]);
      const c = neon ? '#ffffff' : ['#f3d9b1', '#f2b8a2', '#f7efe2', '#e9c46a', '#e8a87c', '#d9e4dd'][Math.floor(rnd() * 6)];
      list.push([x, y + h / 2 - 0.5, z, rot, w, h, dep, c]);
      if (neon && rnd() < 0.7) signs.push([x, y + h + 0.6, z, rot, w * 0.9, 1.2, 1.2, ['#ff2bd6', '#1fe0ff', '#ffd02b', '#7bff5a'][Math.floor(rnd() * 4)]]);
    }
    const ft = facadeTex(neon, false); ft.repeat.set(1, 1);
    const mat = new THREE.MeshStandardMaterial({ map: ft, roughness: neon ? 0.4 : 0.85, metalness: neon ? 0.3 : 0 });
    if (neon) { mat.emissiveMap = facadeTex(true, true); mat.emissive = new THREE.Color('#ffffff'); mat.emissiveIntensity = 1.4; }
    instanced(new THREE.BoxGeometry(1, 1, 1), mat, list, true);
    if (signs.length) instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), signs, false);
  }
  // vallas publicitarias
  const bm = [0, 1, 2, 3].map(v => new THREE.MeshStandardMaterial({ map: boardTex(v), roughness: 0.6, emissive: th.night ? '#ffffff' : '#000000', emissiveIntensity: th.night ? 0.5 : 0 }));
  if (th.night) bm.forEach(m => m.emissiveMap = m.map);
  const postM = new THREE.MeshStandardMaterial({ color: '#4a4f55', metalness: 0.5, roughness: 0.5 });
  for (let i = 90, v = 0; i < N; i += 140, v++) {
    const s = v % 2 ? 1 : -1, g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), bm[v % 4]); b.position.set(0, 2.6, 0); b.rotation.y = s > 0 ? Math.PI : 0; b.castShadow = true;
    const back = new THREE.Mesh(new THREE.BoxGeometry(12.3, 3.3, 0.2), postM); back.position.set(0, 2.6, s * 0.15); back.castShadow = true;
    for (const px of [-4.5, 4.5]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.2, 0.25), postM); p.position.set(px, 0.6, s * 0.15); g.add(p); }
    g.add(b); g.add(back);
    { const [bx, , bz] = trackPos(i, s * (wallAt(i, s) + 1.5)); if (!freeSpot(bx, bz, ROAD_W / 2 + 2)) continue; }
    placeAt(g, i, s * (wallAt(i, s) + 1.5)); world.add(g);
  }
  // farolas (de noche o en ciudad)
  if (th.night || th.buildings === 'pastel' || th.fuji) {
    const poles = [], heads = [], glow = glowTex();
    for (let i = 0; i < N; i += th.night ? 18 : 30) for (const s of [-1, 1]) {
      const d = s * (wallAt(i, s) - 0.4), [x, y, z] = trackPos(i, d);
      poles.push([x, y + 4.5, z, 0, 1]);
      const [hx, , hz] = trackPos(i, s * (wallAt(i, s) - 2.2));
      heads.push([hx, y + 9, hz, 0, 1]);
      if (th.night) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#ffd9a0', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: true })); sp.position.set(hx, y + 8.8, hz); sp.scale.set(7, 7, 1); world.add(sp); }
    }
    instanced(new THREE.CylinderGeometry(0.12, 0.16, 9, 6), new THREE.MeshStandardMaterial({ color: '#5b6068', metalness: 0.6, roughness: 0.4 }), poles, true);
    instanced(new THREE.BoxGeometry(1.4, 0.25, 0.5), new THREE.MeshStandardMaterial({ color: '#333', emissive: th.night ? '#ffe2b0' : '#000', emissiveIntensity: 3 }), heads, false);
  }
  // nubes
  if (!th.night) {
    const ct = cloudTex();
    for (let n = 0; n < (th.rain ? 40 : 18); n++) {
      const a = rnd() * 6.28, r = 1500 + rnd() * 2000;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, color: th.rain ? '#aab4bd' : '#ffffff', transparent: true, opacity: th.rain ? 0.9 : 0.85, fog: false, depthWrite: false }));
      sp.position.set(T.center[0] + Math.cos(a) * r, 350 + rnd() * 400, T.center[1] + Math.sin(a) * r); const s = 500 + rnd() * 700; sp.scale.set(s, s * 0.45, 1); world.add(sp);
    }
  }
}
/* ---------- Detalles: grava, neumáticos, carteles de frenada, boxes, pórticos, comisarios, gradas ---------- */
function gravelTex() {
  return canvasTex(512, 512, (g, w, h) => { srand(8); g.fillStyle = '#c9b48c'; g.fillRect(0, 0, w, h); noise(g, w, h, 90000, ['#b59f77', '#d8c6a0', '#a8916a', '#e3d4b4', '#9a8562'], 1, 3); }, true);
}
function brakeBoardTex(nm) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.strokeStyle = '#111'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#111'; g.font = '900 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(nm, w / 2, h / 2 + 4);
  }, true);
}
function pitTex() {
  return canvasTex(1024, 128, (g, w, h) => {
    g.fillStyle = '#e8eaee'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 10; k++) {
      const x = k * w / 10 + 8, cw = w / 10 - 16;
      g.fillStyle = '#2b2f36'; g.fillRect(x, h * 0.3, cw, h * 0.7);
      g.fillStyle = 'rgba(255,255,255,0.08)'; for (let y = h * 0.34; y < h; y += 8) g.fillRect(x, y, cw, 2);
      g.fillStyle = ['#d0101c', '#1d5fe0', '#f5c400', '#14934a', '#ff7a00'][k % 5]; g.fillRect(x, h * 0.12, cw, h * 0.12);
    }
  }, true);
}
function towerTex() {
  return canvasTex(128, 512, (g, w, h) => {
    g.fillStyle = '#101216'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffcc00'; g.font = '900 26px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('GP', w / 2, 34);
    g.font = '700 22px monospace'; g.textAlign = 'left';
    ['1 VEG', '2 BEL', '3 SAT', '4 RUI', '5 BEC', '6 MOR', '7 PAZ', '8 TÚ '].forEach((t, k) => { g.fillStyle = k === 7 ? '#ffe27a' : '#ffffff'; g.fillText(t, 14, 80 + k * 50); });
  }, true);
}
function buildDetails() {
  const th = theme, N = T.N, city = !!th.buildings;
  srand(4242 + trackIdx);
  // 1) escapatorias de grava (o asfalto en circuitos urbanos) en el exterior de las curvas
  const gm = new THREE.MeshStandardMaterial({ map: city ? null : gravelTex(), color: city ? '#55575c' : '#ffffff', roughness: 1, polygonOffset: true, polygonOffsetFactor: -1.5, polygonOffsetUnits: -1.5 });
  if (gm.map) gm.map.repeat.set(1, 1 / 8);
  const tyres = [], boards = [[], [], []];
  for (const [a, n] of cornerRanges()) {
    let ks = 0; for (let m = 0; m < n; m++) ks += T.k[(a + m) % N];
    const out = ks > 0 ? -1 : 1;     // lado exterior
    const inner = ROAD_W / 2 + KERB_W;
    const g = new THREE.Mesh(ribbon(a, n, i => { const wv = Math.max(inner + 0.5, wallAt(i, out) - 0.6); return out < 0 ? [-wv, -0.02, -inner, -0.02, 0, 1] : [inner, -0.02, wv, -0.02, 0, 1]; }), gm);
    g.receiveShadow = true; world.add(g);
    // 2) muro de neumáticos delante del muro exterior
    if (!city || th.buildings === 'pastel') for (let m = 0; m < n; m += 1) {
      const i = (a + m) % N, [x, y, z] = trackPos(i, out * (wallAt(i, out) - 0.45));
      for (let lvl = 0; lvl < 2; lvl++) tyres.push([x, y + 0.2 + lvl * 0.36, z, 0, 1, 1, 1, (m + lvl) % 2 ? '#e8e8e8' : (th.night ? '#ff2bd6' : '#cf1f2a')]);
    }
    // 3) carteles de frenada 150 / 100 / 50 m antes de las curvas fuertes
    let maxK = 0; for (let m = 0; m < n; m++) maxK = Math.max(maxK, T.kp[(a + m) % N]);
    if (maxK > 1 / 90 && n > 20) {
      const e = a + 10;
      let straight = true; for (let m = 20; m < 90; m++) if (T.kp[mod(e - m, N)] > 1 / 300) straight = false;
      if (straight) [75, 50, 25].forEach((back, q) => { const i = mod(e - back, N), [x, y, z] = trackPos(i, out * (ROAD_W / 2 + KERB_W + 1.2)); boards[q].push([x, y + 0.9, z, Math.atan2(-T.tz[i], T.tx[i]) + Math.PI / 2, 1]); });
    }
  }
  instanced(new THREE.CylinderGeometry(0.4, 0.4, 0.36, 12), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }), tyres, true);
  ['150', '100', '50'].forEach((nm, q) => {
    instanced(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshStandardMaterial({ map: brakeBoardTex(nm), roughness: 0.6, side: THREE.DoubleSide }), boards[q], false);
    instanced(new THREE.BoxGeometry(0.08, 1, 0.08).translate(0, -0.6, 0), new THREE.MeshStandardMaterial({ color: '#555' }), boards[q], false);
  });
  // 4) boxes y torre de tiempos junto a la recta de meta (en el lado con más sitio)
  const si = START_I, side = wallAt(si, -1) >= wallAt(si, 1) ? -1 : 1;
  const pitLen = 160, pitStart = mod(si - 40, N);
  const midI = mod(pitStart + 40, N), [mx, my, mz] = trackPos(midI, side * (wallAt(midI, side) + 9));
  window.__pit = freeSpot(mx, mz, ROAD_W / 2 + 6);
  if (window.__pit) {
    const g = new THREE.Group(), pt = pitTex(); pt.repeat.set(1, 1);
    const wallMat = new THREE.MeshStandardMaterial({ color: '#d9dce1', roughness: 0.7 }), front = new THREE.MeshStandardMaterial({ map: pt, roughness: 0.6 });
    const bld = new THREE.Mesh(new THREE.BoxGeometry(pitLen, 9, 14), [wallMat, wallMat, wallMat, wallMat, side < 0 ? front : wallMat, side < 0 ? wallMat : front]);
    bld.position.set(0, 4.5, side * 7); bld.castShadow = true; bld.receiveShadow = true; g.add(bld);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(pitLen + 4, 0.5, 18), new THREE.MeshStandardMaterial({ color: '#c0262d', roughness: 0.6 })); roof.position.set(0, 9.3, side * 6); roof.castShadow = true; g.add(roof);
    const tw = new THREE.Mesh(new THREE.BoxGeometry(2.2, 14, 2.2), [wallMat, wallMat, wallMat, wallMat, new THREE.MeshStandardMaterial({ map: towerTex(), emissive: '#ffffff', emissiveMap: towerTex(), emissiveIntensity: 0.6 }), new THREE.MeshStandardMaterial({ map: towerTex(), emissive: '#ffffff', emissiveMap: towerTex(), emissiveIntensity: 0.6 })]);
    tw.rotation.y = Math.PI / 2; tw.position.set(pitLen / 2 - 30, 16, side * 2); tw.castShadow = true; g.add(tw);
    placeAt(g, midI, side * (wallAt(midI, side) + 2.5)); g.position.y = my - 0.3; world.add(g);
  }
  // 5) pórticos publicitarios sobre las rectas largas
  let placed = 0;
  for (let i = 0; i < N && placed < 3; i += 40) {
    if (Math.abs(i - START_I) < 200) continue;
    let ok = true; for (let m = -30; m <= 30; m++) if (T.kp[mod(i + m, N)] > 1 / 500) ok = false;
    if (!ok || (T.bridge && Math.abs(i - T.bridge.under) < 120)) continue;
    const g = new THREE.Group(), wl = wallAt(i, -1), wr = wallAt(i, 1), span = wl + wr;
    const pm = new THREE.MeshStandardMaterial({ color: '#cfd4da', metalness: 0.5, roughness: 0.4 });
    for (const [s, w] of [[-1, wl], [1, wr]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 8.5, 0.7), pm); p.position.set(0, 4.25, s * (w + 0.4)); p.castShadow = true; g.add(p); }
    const bt = boardTex(placed % 4); bt.repeat.set(1, 1);
    const banner = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, span + 1.2), [pm, pm, pm, pm, new THREE.MeshStandardMaterial({ map: bt }), new THREE.MeshStandardMaterial({ map: bt })]);
    banner.position.set(0, 7.6, (wr - wl) / 2); banner.castShadow = true; g.add(banner);
    placeAt(g, i, 0); world.add(g); placed++; i += 400;
  }
  // 6) casetas de comisarios con bandera
  const posts = [], flags = [];
  for (let i = 100; i < N; i += 230) for (const s of [1]) {
    const sd = (i / 230) % 2 ? 1 : -1, [x, y, z] = trackPos(i, sd * (wallAt(i, sd) + 2.2));
    if (!freeSpot(x, z, ROAD_W / 2 + 2)) continue;
    posts.push([x, y + 1.1, z, Math.atan2(-T.tz[i], T.tx[i]), 2.2, 2.2, 1.6]); flags.push([x, y + 3.4, z + 0.3, Math.atan2(-T.tz[i], T.tx[i]), 0.9, 0.6, 0.05, ['#ffd400', '#1d5fe0', '#2bbf4a'][Math.floor(rnd() * 3)]]);
  }
  instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#ff8a1e', roughness: 0.7 }), posts, true);
  instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7, side: THREE.DoubleSide }), flags, false);
  // 7) gradas en las curvas más cerradas
  if (!th.night) {
    const ctex = crowdTex(); ctex.repeat.set(4, 1);
    const sm = new THREE.MeshStandardMaterial({ map: ctex, roughness: 0.9 }), sb = new THREE.MeshStandardMaterial({ color: '#8b9199', roughness: 0.8 }), sr = new THREE.MeshStandardMaterial({ color: '#c0262d', roughness: 0.6 });
    const cands = []; for (let i = 0; i < N; i += 10) cands.push([T.kp[i], i]);
    cands.sort((a, b) => b[0] - a[0]);
    const used = [];
    for (const [, i] of cands) {
      if (used.length >= 3) break;
      if (used.some(u => Math.min(Math.abs(u - i), N - Math.abs(u - i)) < 250) || Math.abs(i - START_I) < 150) continue;
      const out = T.k[i] > 0 ? -1 : 1, d = out * (wallAt(i, out) + 14), [x, , z] = trackPos(i, d);
      if (!freeSpot(x, z, ROAD_W / 2 + 14)) continue;
      used.push(i);
      const st = new THREE.Group();
      const front = new THREE.Mesh(new THREE.PlaneGeometry(40, 13), sm); front.rotation.order = 'YXZ'; front.rotation.x = -Math.PI / 2 + 0.6; front.position.set(0, 4.5, 0); if (out > 0) front.rotation.y = Math.PI;
      const back = new THREE.Mesh(new THREE.BoxGeometry(40, 9, 1), sb); back.position.set(0, 4.5, out * 5.6);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(42, 0.4, 9), sr); roof.position.set(0, 11, out * 2.5);
      for (const o of [front, back, roof]) { o.castShadow = true; o.receiveShadow = true; st.add(o); }
      placeAt(st, i, d); st.position.y = terrainY(st.position.x, st.position.z); world.add(st);
    }
  }
}
function buildMountains() {
  srand(99 + trackIdx);
  const th = theme, mat = new THREE.MeshStandardMaterial({ color: th.mount, roughness: 1, flatShading: true });
  const list = [];
  for (let n = 0; n < 26; n++) {
    const a = n / 26 * Math.PI * 2 + rnd() * 0.2, r = 3000 + rnd() * 900, h = th.night ? 80 + rnd() * 120 : 220 + rnd() * 520;
    list.push([T.center[0] + Math.cos(a) * r, -10, T.center[1] + Math.sin(a) * r, rnd() * 6.28, (th.night ? 200 : 380) + rnd() * 380, h, 380 + rnd() * 300]);
  }
  instanced(new THREE.ConeGeometry(1, 1, 7, 1).translate(0, 0.5, 0), mat, list, false);
  if (th.fuji) {
    const a = 2.3, x = T.center[0] + Math.cos(a) * 3600, z = T.center[1] + Math.sin(a) * 3600;
    const f = new THREE.Mesh(new THREE.ConeGeometry(1500, 1100, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#6a5a8c', roughness: 1 })); f.position.set(x, 540, z); world.add(f);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(420, 310, 24), new THREE.MeshStandardMaterial({ color: '#fff4f0', roughness: 0.8 })); cap.position.set(x, 935, z); world.add(cap);
  }
}
function buildSky() {
  const th = theme;
  skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(th.sky[0]) }, hor: { value: new THREE.Color(th.sky[1]) }, sunDir: { value: new THREE.Vector3(...th.sun.dir).normalize() },
      sunCol: { value: new THREE.Color(th.night ? '#dfe4ff' : th.sun.c) }, night: { value: th.night ? 1 : 0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }',
    fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night; varying vec3 vDir;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
      void main(){ float y = clamp(vDir.y, -0.2, 1.0); vec3 c = mix(hor, top, pow(max(y,0.0), 0.55));
        if (y < 0.0) c = hor * 0.92;
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        c += sunCol * (pow(s, 900.0) * 6.0 + pow(s, 30.0) * 0.35 + pow(s, 4.0) * 0.12) * (night > 0.5 ? 0.6 : 1.0);
        if (night > 0.5) { vec3 q = floor(vDir * 420.0); float st = step(0.9965, h(q)) * smoothstep(0.05, 0.4, y); c += vec3(st); }
        gl_FragColor = vec4(c, 1.0); }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(8000, 32, 16), skyMat); sky.renderOrder = -1;
  world.add(sky); world.userData.sky = sky;
}
function buildEnv() {
  const es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat));
  const g = new THREE.Mesh(new THREE.CircleGeometry(100, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: shade(theme.grass, -0.3) }));
  g.position.y = -5; es.add(g);
  if (!theme.night) for (let k = 0; k < 3; k++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(60, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide })); p.position.set(Math.cos(k * 2.1) * 70, 40, Math.sin(k * 2.1) * 70); p.lookAt(0, 0, 0); es.add(p); }
  else for (let k = 0; k < 8; k++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(10, 20), new THREE.MeshBasicMaterial({ color: ['#ff2bd6', '#1fe0ff', '#ffd02b'][k % 3], side: THREE.DoubleSide })); p.position.set(Math.cos(k * 0.8) * 70, 10, Math.sin(k * 0.8) * 70); p.lookAt(0, 0, 0); es.add(p); }
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(es, 0.03);
  scene.environment = envRT.texture;
  scene.environmentIntensity = theme.night ? 0.6 : 1;
}
function buildRain() {
  const n = 1400, pos = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) { const x = (Math.random() - 0.5) * 60, y = Math.random() * 30, z = (Math.random() - 0.5) * 60; pos.set([x, y, z, x + 0.05, y + 0.9, z], i * 6); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  rainFx = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#cfd8e0', transparent: true, opacity: 0.35 }));
  rainFx.frustumCulled = false; world.add(rainFx);
}
function updateWorldFx(dt, focus) {
  if (world && world.userData.sky) world.userData.sky.position.copy(camera.position);
  const d = new THREE.Vector3(...theme.sun.dir).normalize();
  sun.position.set(focus.x + d.x * 200, focus.y + d.y * 200, focus.z + d.z * 200); sun.target.position.copy(focus);
  if (rainFx) {
    rainFx.position.set(camera.position.x, camera.position.y - 6, camera.position.z);
    const p = rainFx.geometry.attributes.position, a = p.array;
    for (let i = 0; i < a.length; i += 6) { a[i + 1] -= dt * 28; a[i + 4] -= dt * 28; if (a[i + 1] < 0) { a[i + 1] += 30; a[i + 4] += 30; } }
    p.needsUpdate = true;
  }
}

/* comprobación automática del circuito (para pruebas) */
function trackCheck() {
  let wallOnRoad = 0, terrainOver = 0;
  for (let i = 0; i < T.N; i++) for (const s of [-1, 1]) {
    const A = trackPos(i, s * wallAt(i, s)), B = trackPos(i + 1, s * wallAt(i + 1, s));
    let bad = false;
    for (let q = 0; q <= 6 && !bad; q++) {
      const t = q / 6, x = lerp(A[0], B[0], t), y = lerp(A[1], B[1], t), z = lerp(A[2], B[2], t);
      nearIdx(x, z, 12, j => { if (!bad && Math.abs(T.py[j] - y) < 3 && Math.hypot(T.px[j] - x, T.pz[j] - z) < ROAD_W / 2 + 0.6) bad = true; });
    }
    if (bad) wallOnRoad++;
  }
  for (let i = 0; i < T.N; i++) for (const off of [-ROAD_W / 2, 0, ROAD_W / 2]) { const [x, y, z] = trackPos(i, off); if (terrainMeshY(x, z) > y - 0.1) terrainOver++; }
  return { wallOnRoad, terrainOver };
}

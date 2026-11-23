/* ===== INTERFAZ: marcador, menús, garaje ===== */
function text(t, x, y, size, col, align, weight, italic) {
  const g = ctx; g.font = (italic ? 'italic ' : '') + (weight || 900) + ' ' + Math.round(size) + 'px system-ui, sans-serif';
  g.textAlign = align || 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillText(t, x + size * 0.04, y + size * 0.06);
  g.fillStyle = col || '#fff'; g.fillText(t, x, y);
}
let uiButtons = [];
function uiButton(id, x, y, w, h, label, o = {}) {
  uiButtons.push({ id, x, y, w, h });
  const g = ctx, r = h * 0.22;
  g.save();
  g.fillStyle = 'rgba(0,0,0,0.4)'; rr(g, x, y + h * 0.07, w, h, r); g.fill();
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, o.disabled ? '#666' : (o.c1 || '#ff4d4d')); gr.addColorStop(1, o.disabled ? '#444' : (o.c2 || '#b3001b'));
  g.fillStyle = gr; rr(g, x, y, w, h, r); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.2)'; rr(g, x + h * 0.06, y + h * 0.05, w - h * 0.12, h * 0.3, r * 0.7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = Math.max(1, h * 0.03); rr(g, x, y, w, h, r); g.stroke();
  g.restore();
  text(label, x + w / 2, y + h * 0.53, h * (o.fs || 0.4), o.tc || '#fff', 'center', 900, true);
}
const GREY = { c1: '#4a5568', c2: '#1f2633' };
function panel(x, y, w, h, a) {
  const g = ctx; g.fillStyle = 'rgba(10,12,22,' + (a || 0.75) + ')'; rr(g, x, y, w, h, H * 0.025); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = PX * 1.5; rr(g, x, y, w, h, H * 0.025); g.stroke();
}
function drawLogo(cx, cy, s) {
  const g = ctx;
  g.save(); g.translate(cx, cy); g.transform(1, 0, -0.18, 1, 0, 0);
  g.font = '900 italic ' + Math.round(s) + 'px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const tw = g.measureText('SUPERCAR').width;
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillText('SUPERCAR', -s * 0.45 + s * 0.06, s * 0.08);
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
  text('3D', cx + s * 2.75, cy + s * 0.71, s * 0.45, '#ffcc00', 'left', 900, true);
}
function drawCredits() {
  const s = H * 0.045;
  panel(W - s * 7.4, s * 0.5, s * 6.8, s * 1.5, 0.6);
  const g = ctx; g.fillStyle = '#ffcc00'; g.beginPath(); g.arc(W - s * 6.4, s * 1.25, s * 0.45, 0, Math.PI * 2); g.fill();
  text('₵', W - s * 6.4, s * 1.27, s * 0.6, '#7a5a00');
  text(fmtNum(save.credits), W - s * 1.1, s * 1.27, s * 0.75, '#ffe27a', 'right');
}
function drawTrackMap(ti, cx, cy, size, dots) {
  const g = ctx, pts = ti === trackIdx ? T.map : (MAPS[ti] || []);
  if (!pts.length) return;
  const N = pts.length, P = i => pts[mod(i, N)], S = size * 0.9;
  g.save(); g.lineJoin = g.lineCap = 'round';
  const path = () => { g.beginPath(); for (let i = 0; i <= N; i += 4) { const p = P(i); i ? g.lineTo(cx + p[0] * S, cy + p[1] * S) : g.moveTo(cx + p[0] * S, cy + p[1] * S); } g.closePath(); };
  path(); g.strokeStyle = 'rgba(0,0,0,0.65)'; g.lineWidth = size * 0.075; g.stroke();
  path(); g.strokeStyle = 'rgba(255,255,255,0.92)'; g.lineWidth = size * 0.03; g.stroke();
  if (ti === trackIdx) { const a = P(START_I), b = P(START_I + 6), ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2;
  g.strokeStyle = '#ff3b3b'; g.lineWidth = size * 0.025; g.beginPath();
  g.moveTo(cx + a[0] * S + Math.cos(ang) * size * 0.06, cy + a[1] * S + Math.sin(ang) * size * 0.06);
  g.lineTo(cx + a[0] * S - Math.cos(ang) * size * 0.06, cy + a[1] * S - Math.sin(ang) * size * 0.06); g.stroke(); }
  if (dots) for (const d of dots) {
    const p = P(Math.floor(mod(d.prog + S0(), T.L) / DS)), r = size * (d.me ? 0.055 : 0.038);
    if (d.me) { g.shadowColor = '#fff'; g.shadowBlur = size * 0.08; }
    g.fillStyle = d.color; g.beginPath(); g.arc(cx + p[0] * S, cy + p[1] * S, r, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0; g.strokeStyle = '#000'; g.lineWidth = size * 0.012; g.stroke();
  }
  g.restore();
}
const MAPS = {};
function precomputeMaps() { // formas de todos los circuitos para las tarjetas
  for (let i = 0; i < TRACKS.length; i++) {
    const t = TRACKS[i]; let pts = t.shape.map(p => new THREE.Vector3(p[0], 0, p[1]));
    const c = new THREE.CatmullRomCurve3(pts, true, 'centripetal'), sp = c.getSpacedPoints(300);
    let minX = 1e9, minZ = 1e9, maxX = -1e9, maxZ = -1e9;
    for (const p of sp) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
    const sz = Math.max(maxX - minX, maxZ - minZ);
    MAPS[i] = sp.slice(0, 300).map(p => [(p.x - (minX + maxX) / 2) / sz, (p.z - (minZ + maxZ) / 2) / sz]);
  }
}

/* ---------- Marcador de carrera ---------- */
function drawHUD() {
  const g = ctx, p = player, s = H * 0.05;
  const st = standings(), pos = st.indexOf(p) + 1;
  if (mode !== 'trial') {
    panel(s * 0.4, s * 0.4, s * 5.2, s * 3, 0.5);
    text(pos + '', s * 1.9, s * 2.15, s * 2.2, pos === 1 ? '#ffd24a' : '#ffffff', 'center', 900, true);
    text('/' + racers.length, s * 3.3, s * 2.5, s * 0.9, '#bbbbbb', 'left', 900, true);
    text('POSICIÓN', s * 3, s * 0.85, s * 0.42, '#9fb3c8');
  }
  const tx = mode === 'trial' ? s * 0.4 : s * 5.9;
  panel(tx, s * 0.4, s * 6.2, s * 3, 0.5);
  text('VUELTA ' + Math.min(p.lap, track.laps) + '/' + track.laps, tx + s * 3.1, s * 1.05, s * 0.6, '#ffd24a', 'center', 900, true);
  text(fmtTime(Math.max(0, raceT - p.lapStart)), tx + s * 3.1, s * 1.95, s * 0.8, '#ffffff', 'center', 800);
  const bl = mode === 'trial' && save.ghosts[String(trackIdx)] ? save.ghosts[String(trackIdx)].t : save.bestLap[String(trackIdx)];
  text('Récord ' + (bl ? fmtTime(bl) : '--'), tx + s * 3.1, s * 2.75, s * 0.45, '#9fb3c8', 'center', 700);
  // mapa
  const ms = H * 0.3, mx = s * 0.4, my = s * 3.7;
  panel(mx, my, ms, ms, 0.4);
  drawTrackMap(trackIdx, mx + ms / 2, my + ms / 2, ms * 0.92, racers.filter(r => r !== p).map(r => ({ prog: r.prog, color: r.color })).concat([{ prog: p.prog, color: '#ffffff', me: true }]));
  // velocímetro
  const kmh = Math.round(p.v * 3.6), cx = W - s * 3.3, cy = s * 2.7, R = s * 2.05;
  g.save(); g.lineCap = 'round';
  g.fillStyle = 'rgba(10,12,22,0.55)'; g.beginPath(); g.arc(cx, cy, R * 1.12, 0, Math.PI * 2); g.fill();
  g.lineWidth = s * 0.3; g.strokeStyle = 'rgba(255,255,255,0.15)'; g.beginPath(); g.arc(cx, cy, R * 0.85, Math.PI * 0.75, Math.PI * 2.25); g.stroke();
  const f = clamp(kmh / 380, 0, 1), sg = g.createLinearGradient(cx - R, 0, cx + R, 0);
  sg.addColorStop(0, '#3dd6ff'); sg.addColorStop(0.7, '#ffd24a'); sg.addColorStop(1, '#ff3b3b');
  g.strokeStyle = sg; g.beginPath(); g.arc(cx, cy, R * 0.85, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * f)); g.stroke();
  g.restore();
  text(kmh + '', cx, cy - s * 0.15, s * 1.1, '#ffffff', 'center', 900, true);
  text('km/h', cx, cy + s * 0.65, s * 0.42, '#9fb3c8');
  text((p.gear || 1) + 'ª', cx, cy + s * 1.35, s * 0.55, '#ffd24a', 'center', 900, true);
  // nitro
  const nw = s * 4.2, nx = cx - nw / 2, ny = cy + R * 1.25;
  g.fillStyle = 'rgba(10,12,22,0.6)'; rr(g, nx, ny, nw, s * 0.45, s * 0.2); g.fill();
  const ng = g.createLinearGradient(nx, 0, nx + nw, 0); ng.addColorStop(0, '#2b6bff'); ng.addColorStop(1, '#5ff2ff');
  g.fillStyle = ng; rr(g, nx, ny, Math.max(s * 0.2, nw * p.nitro / p.stats.nitro), s * 0.45, s * 0.2); g.fill();
  text('NITRO', cx, ny + s * 0.9, s * 0.38, '#7fe8ff');
  if (p.draft && raceT > 0) text('REBUFO', W / 2, H * 0.2, H * 0.04, '#7fe8ff', 'center', 900, true);
  if (p.wrong > 0.6) text('¡SENTIDO CONTRARIO!', W / 2, H * 0.3, H * 0.06, '#ff4d4d', 'center', 900, true);
  // pausa
  const pb = BTN.pause; g.fillStyle = 'rgba(10,12,22,0.55)'; g.beginPath(); g.arc(pb.x, pb.y, pb.r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.fillRect(pb.x - pb.r * 0.35, pb.y - pb.r * 0.4, pb.r * 0.25, pb.r * 0.8); g.fillRect(pb.x + pb.r * 0.1, pb.y - pb.r * 0.4, pb.r * 0.25, pb.r * 0.8);
  const cb = BTN.cam; g.fillStyle = 'rgba(10,12,22,0.55)'; g.beginPath(); g.arc(cb.x, cb.y, cb.r, 0, Math.PI * 2); g.fill();
  text('CAM', cb.x, cb.y, cb.r * 0.55, '#fff', 'center', 900);
  // semáforo
  if (raceT < 0.8) {
    const n = raceT < 0 ? clamp(Math.floor((raceT + 4.2) / 0.7), 0, 5) : 0, lx = W / 2, ly = H * 0.22, ls = H * 0.055;
    panel(lx - ls * 4, ly - ls * 0.85, ls * 8, ls * 1.7, 0.8);
    for (let i = 0; i < 5; i++) {
      const on = n > i, green = raceT >= 0;
      g.fillStyle = green ? '#2bff6a' : on ? '#ff2a2a' : '#331111';
      if (on || green) { g.save(); g.shadowColor = g.fillStyle; g.shadowBlur = ls; }
      g.beginPath(); g.arc(lx + (i - 2) * ls * 1.5, ly, ls * 0.55, 0, Math.PI * 2); g.fill();
      if (on || green) g.restore();
    }
  }
  if (msg) {
    const a = Math.min(1, msg.life * 3), sc = 1 + (1 - Math.min(1, (msg.max - msg.life) * 5)) * 0.4;
    g.globalAlpha = a; text(msg.t, W / 2, H * 0.4, H * 0.1 * sc, msg.c, 'center', 900, true); g.globalAlpha = 1;
  }
  drawControls();
}

/* ---------- Botones táctiles ---------- */
const BTN = {};
function layoutButtons() {
  const r = H * 0.115;
  BTN.pause = { x: W * 0.62, y: H * 0.11, r: H * 0.055 };
  BTN.cam = { x: W * 0.62 - H * 0.15, y: H * 0.11, r: H * 0.055 };
  BTN.left = { x: H * 0.2, y: H * 0.8, r };
  BTN.right = { x: H * 0.2 + r * 2.5, y: H * 0.8, r };
  if (save.autoGas) { BTN.brake = { x: W - H * 0.2, y: H * 0.8, r }; BTN.nitro = { x: W - H * 0.2 - r * 2.5, y: H * 0.82, r: r * 0.9 }; BTN.gas = null; }
  else { BTN.gas = { x: W - H * 0.2, y: H * 0.78, r: r * 1.1 }; BTN.brake = { x: W - H * 0.2 - r * 2.5, y: H * 0.84, r: r * 0.9 }; BTN.nitro = { x: W - H * 0.2, y: H * 0.5, r: r * 0.8 }; }
}
function roundBtn(b, label, col, on) {
  if (!b) return;
  const g = ctx;
  g.fillStyle = on ? rgba(col, 0.55) : 'rgba(10,12,22,0.3)'; g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = rgba(col, on ? 1 : 0.7); g.lineWidth = b.r * 0.08; g.stroke();
  if (label === '◀' || label === '▶') {
    const s = label === '◀' ? -1 : 1; g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(b.x + s * b.r * 0.42, b.y); g.lineTo(b.x - s * b.r * 0.28, b.y - b.r * 0.42); g.lineTo(b.x - s * b.r * 0.28, b.y + b.r * 0.42); g.closePath(); g.fill();
  } else text(label, b.x, b.y + b.r * 0.03, b.r * 0.36, '#fff', 'center', 900, true);
}
function drawControls() {
  if (!save.tilt) { roundBtn(BTN.left, '◀', '#ffffff', input.steer < -0.2); roundBtn(BTN.right, '▶', '#ffffff', input.steer > 0.2); }
  roundBtn(BTN.brake, 'FRENO', '#ff4d4d', input.brake);
  roundBtn(BTN.gas, 'GAS', '#3dff7a', input.gas);
  roundBtn(BTN.nitro, 'NITRO', '#3dd6ff', input.nitro);
}

/* ---------- Escena del garaje ---------- */
let garage = null, garageIdx = 0, garageCarKey = '';
function buildGarage() {
  if (garage) return garage;
  const gs = new THREE.Scene();
  gs.background = new THREE.Color('#0b0d14');
  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#15171d', roughness: 0.18, metalness: 0.6 }));
  floor.receiveShadow = true; gs.add(floor);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.7, 0.12, 64), new THREE.MeshStandardMaterial({ color: '#2a2d35', roughness: 0.3, metalness: 0.8 }));
  disc.position.y = 0.06; disc.receiveShadow = true; gs.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.65, 0.03, 8, 96).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffcc00' })); ring.position.y = 0.12; gs.add(ring);
  gs.add(new THREE.HemisphereLight('#c8d4ff', '#202020', 0.5));
  const key = new THREE.SpotLight('#ffffff', 400, 40, 0.5, 0.6, 1.2); key.position.set(4, 9, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); gs.add(key); gs.add(key.target);
  const rim = new THREE.SpotLight('#9fc4ff', 160, 40, 0.6, 0.7, 1.2); rim.position.set(-6, 6, -6); gs.add(rim); gs.add(rim.target);
  // entorno de estudio para los reflejos de la pintura
  const es = new THREE.Scene(); es.background = new THREE.Color('#111');
  for (const [x, y, z, w, h] of [[0, 10, 0, 16, 4], [12, 4, 0, 3, 10], [-12, 4, 0, 3, 10], [0, 4, 12, 10, 3], [0, 4, -12, 10, 3]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide })); p.position.set(x, y, z); p.lookAt(0, 0, 0); es.add(p);
  }
  gs.environment = pmrem.fromScene(es, 0.02).texture;
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  garage = { scene: gs, cam, holder: new THREE.Group() };
  gs.add(garage.holder);
  return garage;
}
function garageCar() {
  const m = garageIdx, color = PAINT[save.colors[m] ?? CARS[m].paint], k = m + color;
  if (k === garageCarKey) return;
  garageCarKey = k;
  while (garage.holder.children.length) garage.holder.remove(garage.holder.children[0]);
  const car = buildCar(m, color); car.position.y = 0.12; garage.holder.add(car);
}
function renderGarage(dt) {
  buildGarage(); garageCar();
  garage.holder.rotation.y += dt * 0.35;
  const c = garage.cam, a = window.innerWidth / window.innerHeight; c.aspect = a; c.updateProjectionMatrix();
  c.position.set(3.4, 2.1, 9.2); c.lookAt(3.1, 0.55, 0);
  renderer.render(garage.scene, c);
}

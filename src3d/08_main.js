/* ===== MENÚS, CONTROLES Y BUCLE PRINCIPAL ===== */
function setState(s) {
  state = s; stateT = 0;
  if (s === 'title' || s === 'tracks' || s === 'garage' || s === 'settings' || s === 'champ') {
    AU.engineOff(); AU.playSong(0);
    if (updatePending) { applyUpdate(); return; }
    if (s !== 'garage') startDemo();
  }
}
/* ---------- carrera de exhibición de fondo ---------- */
let demo = null;
function startDemo() {
  if (demo && demo.ti === (save.lastTrack < save.unlocked ? save.lastTrack : 0) && racers.length && player && !player.isPlayer) return;
  const ti = save.lastTrack < save.unlocked ? save.lastTrack : 0;
  buildTracks(ti); clearCars();
  player = { finished: true, prog: -1e9, d: 0, v: 0, isPlayer: false };
  const field = makeField().slice(0, 5); field[0].m = save.car; field[0].color = PAINT[save.colors[save.car] ?? CARS[save.car].paint];
  field.forEach((f, k) => { const r = makeRacer(f.m, f.color, f.name, k, false, carStats(f.m, { motor: 0, grip: 0, nitro: 0 })); setupRival(r, 0.95, k); r.basePow = r.powMul = 0.85; rivals.push(r); racers.push(r); });
  raceT = 5; demo = { ti }; camInit = false;
}
function updateDemo(dt) {
  raceT += dt; physicsStep(dt);
  for (const r of racers) poseCar(r, dt);
  const lead = rivals[0];
  updateCamera(dt, lead, true);
  updateWorldFx(dt, lead.car.position);
  updateFx(dt);
}

/* ---------- pantallas ---------- */
function shadeTop() { const g = ctx, gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
function drawTitle() {
  shadeTop(); uiButtons = [];
  const s = H * 0.12 * Math.min(1, W / (H * 1.9));
  drawLogo(W / 2, H * 0.17, s);
  const bw = H * 0.6, bh = H * 0.11, x = W / 2 - bw / 2;
  uiButton('champ', x, H * 0.36, bw, bh, '🏆  CAMPEONATO', { fs: 0.4 });
  uiButton('quick', x, H * 0.5, bw * 0.49, bh, 'CARRERA', { c1: '#ff8a3d', c2: '#b34700', fs: 0.36 });
  uiButton('trial', x + bw * 0.51, H * 0.5, bw * 0.49, bh, 'CONTRARRELOJ', { c1: '#3d9bff', c2: '#0b4fa8', fs: 0.3 });
  uiButton('garage', x, H * 0.64, bw * 0.49, bh * 0.85, 'GARAJE', Object.assign({ fs: 0.4 }, GREY));
  uiButton('settings', x + bw * 0.51, H * 0.64, bw * 0.49, bh * 0.85, 'AJUSTES', Object.assign({ fs: 0.4 }, GREY));
  drawCredits();
  text('Coche: ' + CARS[save.car].name + (save.trophies ? '   ·   🏆 x' + save.trophies : ''), W / 2, H * 0.83, H * 0.033, '#ffe27a', 'center', 800, true);
  if (GAME_VERSION) text('v' + GAME_VERSION, H * 0.06, H * 0.95, H * 0.03, 'rgba(255,255,255,0.8)', 'left');
}
let trackMode = 'quick';
function drawTracks() {
  const g = ctx; g.fillStyle = 'rgba(5,8,18,0.7)'; g.fillRect(0, 0, W, H);
  uiButtons = [];
  text(trackMode === 'trial' ? 'CONTRARRELOJ · ELIGE CIRCUITO' : 'CARRERA · ELIGE CIRCUITO', W / 2, H * 0.09, H * 0.06, '#ffffff', 'center', 900, true);
  drawCredits();
  const cols = 3, gap = H * 0.035, cw = Math.min((W - H * 0.3 - gap * (cols - 1)) / cols, H * 0.75), ch = H * 0.34;
  const x0 = W / 2 - (cols * cw + (cols - 1) * gap) / 2, y0 = H * 0.17;
  TRACKS.forEach((t, i) => {
    const x = x0 + (i % cols) * (cw + gap), y = y0 + Math.floor(i / cols) * (ch + gap), th = THEMES[t.theme];
    const locked = i >= save.unlocked && trackMode !== 'trial';
    uiButtons.push({ id: 'track:' + i, x, y, w: cw, h: ch });
    g.save(); rr(g, x, y, cw, ch, H * 0.025); g.clip();
    const sg = g.createLinearGradient(0, y, 0, y + ch); sg.addColorStop(0, th.sky[0]); sg.addColorStop(0.55, th.sky[1]); sg.addColorStop(0.56, th.grass); sg.addColorStop(1, shade(th.grass, -0.4));
    g.fillStyle = sg; g.fillRect(x, y, cw, ch);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y, cw, ch);
    drawTrackMap(i, x + cw * 0.5, y + ch * 0.33, ch * 0.5, null);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, y + ch * 0.62, cw, ch * 0.38);
    if (locked) { g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x, y, cw, ch); }
    g.restore();
    g.strokeStyle = locked ? 'rgba(255,255,255,0.2)' : '#ffcc00'; g.lineWidth = PX * 2; rr(g, x, y, cw, ch, H * 0.025); g.stroke();
    text(t.name.toUpperCase(), x + cw / 2, y + ch * 0.72, ch * 0.14, '#ffffff', 'center', 900, true);
    text(t.country + ' · ' + (t.len / 1000).toFixed(1) + ' km', x + cw / 2, y + ch * 0.85, ch * 0.075, '#cfd8e3', 'center', 700);
    if (locked) { text('🔒', x + cw * 0.9, y + ch * 0.13, ch * 0.13, '#fff'); text('Sube al podio en ' + TRACKS[i - 1].name, x + cw / 2, y + ch * 0.94, ch * 0.065, '#ffb3b3', 'center', 700); }
    else {
      const b = trackMode === 'trial' ? (save.ghosts[String(i)] || {}).t : save.bestLap[String(i)], pd = save.podiums[String(i)];
      text(b ? 'Vuelta rápida: ' + fmtTime(b) : 'Sin tiempo', x + cw / 2, y + ch * 0.94, ch * 0.065, '#ffe27a', 'center', 700);
      if (pd && trackMode !== 'trial') text(['🥇', '🥈', '🥉'][pd - 1], x + cw * 0.9, y + ch * 0.13, ch * 0.13, '#fff');
    }
  });
  uiButton('back', H * 0.05, H * 0.035, H * 0.3, H * 0.1, '◀ VOLVER', Object.assign({ fs: 0.36 }, GREY));
  text('Dificultad: ' + ['Fácil', 'Normal', 'Difícil'][save.diff], W / 2, H * 0.965, H * 0.033, '#9fb3c8', 'center', 700);
}
function champTable() { const c = save.champ; return Object.entries(c.pts).sort((a, b) => b[1] - a[1]); }
function drawChamp() {
  const g = ctx; g.fillStyle = 'rgba(5,8,18,0.72)'; g.fillRect(0, 0, W, H);
  uiButtons = [];
  if (!save.champ || save.champ.final) {
    text('CAMPEONATO SUPERCAR GP', W / 2, H * 0.12, H * 0.065, '#ffd24a', 'center', 900, true);
    if (save.champ && save.champ.final) text('Último campeonato: ' + save.champ.final + 'º puesto', W / 2, H * 0.22, H * 0.04, '#ffffff', 'center', 800);
    text('6 carreras, una en cada circuito. Puntos: 25-18-15-12-10-8-6-4.', W / 2, H * 0.35, H * 0.035, '#cfd8e3', 'center', 700);
    text('Premio final: ₵ 8.000 al campeón, ₵ 5.000 al 2º y ₵ 3.000 al 3º.', W / 2, H * 0.42, H * 0.035, '#cfd8e3', 'center', 700);
    uiButton('champNew', W / 2 - H * 0.35, H * 0.55, H * 0.7, H * 0.12, '▶ EMPEZAR CAMPEONATO', { fs: 0.36 });
  } else {
    const c = save.champ, nx = TRACKS[c.round];
    text('CAMPEONATO · CARRERA ' + (c.round + 1) + ' DE ' + TRACKS.length, W / 2, H * 0.09, H * 0.055, '#ffd24a', 'center', 900, true);
    const px = W * 0.08, pw = W * 0.46, py = H * 0.17, ph = H * 0.74; panel(px, py, pw, ph, 0.7);
    champTable().forEach(([n, pts], k) => {
      const y = py + ph * 0.07 + k * ph * 0.113, me = n === 'TÚ';
      if (me) { g.fillStyle = 'rgba(255,204,0,0.22)'; rr(g, px + pw * 0.03, y - ph * 0.05, pw * 0.94, ph * 0.1, H * 0.015); g.fill(); }
      text((k + 1) + 'º', px + pw * 0.1, y, H * 0.042, k < 3 ? ['#ffd24a', '#dfe6ee', '#e0a060'][k] : '#fff', 'center', 900, true);
      text(n, px + pw * 0.22, y, H * 0.038, me ? '#ffe27a' : '#fff', 'left', me ? 900 : 700);
      text(pts + ' pts', px + pw * 0.94, y, H * 0.038, '#cfd8e3', 'right', 800);
    });
    const qx = W * 0.58, qw = W * 0.36;
    panel(qx, py, qw, ph * 0.55, 0.7);
    text('Siguiente carrera', qx + qw / 2, py + ph * 0.08, H * 0.035, '#9fb3c8', 'center', 700);
    text(nx.name.toUpperCase(), qx + qw / 2, py + ph * 0.18, H * 0.065, '#fff', 'center', 900, true);
    drawTrackMap(c.round, qx + qw / 2, py + ph * 0.38, H * 0.2, null);
    uiButton('champGo', qx, py + ph * 0.62, qw, H * 0.11, '▶ CORRER', { fs: 0.42 });
    uiButton('champQuit', qx, py + ph * 0.62 + H * 0.14, qw, H * 0.09, 'ABANDONAR', Object.assign({ fs: 0.34 }, GREY));
  }
  uiButton('back', H * 0.05, H * 0.035, H * 0.3, H * 0.1, '◀ VOLVER', Object.assign({ fs: 0.36 }, GREY));
  drawCredits();
}
function statBar(label, v, x, y, w, extra) {
  const g = ctx, h = H * 0.02;
  text(label, x, y - h * 1.2, H * 0.028, '#cfd8e3', 'left', 700);
  g.fillStyle = 'rgba(255,255,255,0.12)'; rr(g, x, y, w, h, h / 2); g.fill();
  if (extra) { g.fillStyle = 'rgba(61,255,122,0.6)'; rr(g, x, y, Math.max(h, w * clamp(v + extra, 0, 1)), h, h / 2); g.fill(); }
  const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#ffcc00'); gr.addColorStop(1, '#ff4d4d');
  g.fillStyle = gr; rr(g, x, y, Math.max(h, w * clamp(v, 0, 1)), h, h / 2); g.fill();
}
let garageTab = 0;
function drawGarageUI() {
  const g = ctx; uiButtons = [];
  const m = garageIdx, c = CARS[m], owned = save.owned.includes(m), st = carStats(m), base = carStats(m, { motor: 0, grip: 0, nitro: 0 });
  const color = PAINT[save.colors[m] ?? c.paint];
  uiButton('gprev', H * 0.05, H * 0.45, H * 0.12, H * 0.15, '◀', Object.assign({ fs: 0.5 }, GREY));
  uiButton('gnext', W * 0.6 - H * 0.17, H * 0.45, H * 0.12, H * 0.15, '▶', Object.assign({ fs: 0.5 }, GREY));
  text((m + 1) + ' / ' + CARS.length, W * 0.3, H * 0.93, H * 0.035, '#9fb3c8', 'center', 700);
  const px = W * 0.62, pw = W - px - H * 0.05;
  panel(px, H * 0.14, pw, H * 0.83, 0.78);
  text(c.name.toUpperCase(), px + pw / 2, H * 0.21, H * 0.055, '#ffffff', 'center', 900, true);
  text(c.tag, px + pw / 2, H * 0.27, H * 0.03, '#ffcc00', 'center', 700, true);
  const sx = px + pw * 0.08, sw = pw * 0.84;
  if (!owned || garageTab === 0) {
    statBar('Velocidad  ' + Math.round(st.top) + ' km/h', (base.top - 290) / 90, sx, H * 0.36, sw, (st.top - base.top) / 90);
    statBar('Aceleración', (base.acc - 0.85) / 0.65, sx, H * 0.44, sw, (st.acc - base.acc) / 0.65);
    statBar('Agarre', (base.grip - 0.85) / 0.5, sx, H * 0.52, sw, (st.grip - base.grip) / 0.5);
    statBar('Nitro', (base.nitro - 2.5) / 4, sx, H * 0.6, sw, (st.nitro - base.nitro) / 4);
    const ps = Math.min(sw / PAINT.length * 0.82, H * 0.05), pg = (sw - ps * PAINT.length) / (PAINT.length - 1);
    PAINT.forEach((p, i) => {
      const x = sx + i * (ps + pg), y = H * 0.66;
      g.fillStyle = p; rr(g, x, y, ps, ps, ps * 0.3); g.fill();
      if (p === color) { g.strokeStyle = '#fff'; g.lineWidth = PX * 2.5; rr(g, x - PX * 2, y - PX * 2, ps + PX * 4, ps + PX * 4, ps * 0.35); g.stroke(); }
      uiButtons.push({ id: 'paint:' + i, x, y, w: ps, h: ps });
    });
  } else {
    UPG.forEach((u, k) => {
      const y = H * 0.35 + k * H * 0.13, lv = upLevel(m, u.key), cost = upCost(m, u.key);
      text(u.name, sx, y, H * 0.036, '#fff', 'left', 900);
      text(u.desc, sx, y + H * 0.04, H * 0.026, '#9fb3c8', 'left', 600);
      for (let q = 0; q < 3; q++) { g.fillStyle = q < lv ? '#3dff7a' : 'rgba(255,255,255,0.15)'; rr(g, sx + q * H * 0.05, y + H * 0.065, H * 0.042, H * 0.018, H * 0.009); g.fill(); }
      if (lv < 3) uiButton('upg:' + k, px + pw * 0.56, y - H * 0.025, pw * 0.38, H * 0.08, '₵ ' + fmtNum(cost), { c1: save.credits >= cost ? '#2fbf5b' : '#666', c2: save.credits >= cost ? '#167a35' : '#444', fs: 0.36 });
      else text('MÁXIMO', px + pw * 0.75, y + H * 0.015, H * 0.03, '#3dff7a', 'center', 900);
    });
  }
  if (owned) {
    uiButton('gtab:0', sx, H * 0.75, sw * 0.48, H * 0.075, 'PINTURA', garageTab === 0 ? { fs: 0.36 } : Object.assign({ fs: 0.36 }, GREY));
    uiButton('gtab:1', sx + sw * 0.52, H * 0.75, sw * 0.48, H * 0.075, 'MEJORAS', garageTab === 1 ? { fs: 0.36 } : Object.assign({ fs: 0.36 }, GREY));
  }
  const inUse = save.car === m, label = inUse ? '✓ EN USO' : owned ? 'ELEGIR' : '₵ ' + fmtNum(c.price);
  uiButton('gbuy', sx, H * 0.85, sw, H * 0.09, label, inUse ? { c1: '#2fbf5b', c2: '#167a35', fs: 0.42 } : owned ? { fs: 0.42 } : { c1: save.credits >= c.price ? '#ffcc00' : '#777', c2: save.credits >= c.price ? '#c98a00' : '#444', tc: '#1a1200', fs: 0.42 });
  if (!owned && save.credits < c.price) text('Te faltan ₵ ' + fmtNum(c.price - save.credits), W * 0.3, H * 0.86, H * 0.034, '#ffb3b3', 'center', 700);
  uiButton('back', H * 0.05, H * 0.035, H * 0.3, H * 0.1, '◀ VOLVER', Object.assign({ fs: 0.36 }, GREY));
  drawCredits();
}
function drawSettings() {
  const g = ctx; g.fillStyle = 'rgba(5,8,18,0.75)'; g.fillRect(0, 0, W, H);
  uiButtons = [];
  text('AJUSTES', W / 2, H * 0.1, H * 0.07, '#ffffff', 'center', 900, true);
  const rows = [
    ['music', 'Música: ' + (save.music ? 'Sí' : 'No')], ['sfx', 'Efectos y motor: ' + (save.sfx ? 'Sí' : 'No')],
    ['autoGas', 'Acelerador: ' + (save.autoGas ? 'Automático' : 'Botón GAS')], ['tilt', 'Dirección: ' + (save.tilt ? 'Inclinar el móvil' : 'Botones')],
    ['diff', 'Dificultad: ' + ['Fácil', 'Normal', 'Difícil'][save.diff]], ['cam', 'Cámara: ' + ['Detrás', 'Lejos', 'Capó'][save.cam]],
    ['q', 'Gráficos: ' + ['Bajos', 'Medios', 'Altos'][save.q]], ['vib', 'Vibración: ' + (save.vib ? 'Sí' : 'No')],
    ['guide', 'Guía de trazada: ' + (save.guide ? 'Sí' : 'No')]
  ];
  const bw = Math.min(W * 0.4, H * 0.9), bh = H * 0.08, gap = H * 0.02;
  rows.forEach(([k, l], i) => {
    const col = i % 2, row = Math.floor(i / 2), x = rows.length % 2 && i === rows.length - 1 ? W / 2 - bw / 2 : W / 2 + (col ? gap / 2 : -bw - gap / 2), y = H * 0.18 + row * (bh + gap);
    uiButton('toggle:' + k, x, y, bw, bh, l, { c1: '#3b4a63', c2: '#1b2333', fs: 0.36 });
  });
  text('Guía: verde = bien · amarillo = afloja · rojo = frena. Derrapa o ve a rebufo para recargar el nitro.', W / 2, H * 0.87, H * 0.03, '#cfd8e3', 'center', 600);
  uiButton('back', H * 0.05, H * 0.035, H * 0.3, H * 0.1, '◀ VOLVER', Object.assign({ fs: 0.36 }, GREY));
}
function drawPause() {
  const g = ctx; g.fillStyle = 'rgba(5,8,18,0.7)'; g.fillRect(0, 0, W, H);
  uiButtons = [];
  text('PAUSA', W / 2, H * 0.17, H * 0.1, '#ffffff', 'center', 900, true);
  const bw = H * 0.62, bh = H * 0.11;
  uiButton('resume', W / 2 - bw / 2, H * 0.3, bw, bh, '▶ CONTINUAR', { c1: '#2fbf5b', c2: '#167a35' });
  uiButton('restart', W / 2 - bw / 2, H * 0.44, bw, bh, '↻ REPETIR CARRERA', GREY);
  uiButton('toggle:cam', W / 2 - bw / 2, H * 0.58, bw * 0.49, bh, 'CÁMARA: ' + ['DETRÁS', 'LEJOS', 'CAPÓ'][save.cam], Object.assign({ fs: 0.3 }, GREY));
  uiButton('toggle:guide', W / 2 + bw * 0.01, H * 0.58, bw * 0.49, bh, 'GUÍA: ' + (save.guide ? 'SÍ' : 'NO'), Object.assign({ fs: 0.3 }, save.guide ? { c1: '#2fbf5b', c2: '#167a35' } : GREY));
  uiButton('quit', W / 2 - bw / 2, H * 0.72, bw, bh, 'SALIR AL MENÚ', GREY);
}
function drawResults() {
  const g = ctx; g.fillStyle = 'rgba(5,8,18,0.7)'; g.fillRect(0, 0, W, H);
  uiButtons = [];
  const R = results, pos = R.pos;
  const title = mode === 'trial' ? 'CONTRARRELOJ TERMINADA' : pos === 1 ? '¡VICTORIA!' : pos <= 3 ? '¡PODIO!' : 'CARRERA TERMINADA';
  text(title, W / 2, H * 0.09, H * 0.07, pos === 1 && mode !== 'trial' ? '#ffd24a' : '#ffffff', 'center', 900, true);
  const px = W * 0.06, pw = W * 0.52, py = H * 0.17, ph = H * 0.7;
  panel(px, py, pw, ph, 0.7);
  if (mode === 'trial') {
    player.lapTimes.forEach((t, k) => text('Vuelta ' + (k + 1) + ':  ' + fmtTime(t), px + pw / 2, py + ph * (0.15 + k * 0.14), H * 0.05, t === R.bestLap ? '#3dff7a' : '#fff', 'center', 800));
    text('Total: ' + fmtTime(player.time), px + pw / 2, py + ph * 0.7, H * 0.05, '#ffe27a', 'center', 900);
  } else R.order.forEach((c, i) => {
    const y = py + ph * 0.08 + i * ph * 0.112, me = c === player;
    if (me) { g.fillStyle = 'rgba(255,204,0,0.22)'; rr(g, px + pw * 0.03, y - ph * 0.05, pw * 0.94, ph * 0.1, H * 0.015); g.fill(); }
    text((i + 1) + 'º', px + pw * 0.08, y, H * 0.042, i < 3 ? ['#ffd24a', '#dfe6ee', '#e0a060'][i] : '#ffffff', 'center', 900, true);
    g.fillStyle = c.color; rr(g, px + pw * 0.15, y - H * 0.015, H * 0.05, H * 0.03, H * 0.01); g.fill();
    text((me ? 'TÚ' : c.name) + ' · ' + CARS[c.m].name, px + pw * 0.25, y, H * 0.034, me ? '#ffe27a' : '#ffffff', 'left', me ? 900 : 700);
    text(fmtTime(c.time), px + pw * 0.96, y, H * 0.034, '#cfd8e3', 'right', 700);
  });
  const qx = W * 0.61, qw = W * 0.33;
  panel(qx, py, qw, ph * 0.52, 0.7);
  text('Premio', qx + qw / 2, py + ph * 0.08, H * 0.034, '#9fb3c8', 'center', 700);
  text('+ ₵ ' + fmtNum(R.prize), qx + qw / 2, py + ph * 0.18, H * 0.065, '#ffe27a', 'center', 900, true);
  text('Vuelta rápida: ' + fmtTime(R.bestLap), qx + qw / 2, py + ph * 0.29, H * 0.032, '#ffffff', 'center', 700);
  if (R.rec) text('¡Récord del circuito!', qx + qw / 2, py + ph * 0.37, H * 0.03, '#3dff7a', 'center', 800);
  if (R.champ) text(R.champ.final ? 'Campeonato terminado: ' + R.champ.final + 'º' : 'Campeonato: ' + (champTable().findIndex(e => e[0] === 'TÚ') + 1) + 'º provisional', qx + qw / 2, py + ph * 0.45, H * 0.03, '#ffd24a', 'center', 800);
  else if (R.newTrack && save.unlocked > trackIdx + 1) text('Desbloqueado: ' + TRACKS[trackIdx + 1].name, qx + qw / 2, py + ph * 0.45, H * 0.03, '#3dd6ff', 'center', 800);
  const bh = H * 0.095;
  if (mode === 'champ') uiButton(save.champ && !save.champ.final ? 'champHub' : 'menu', qx, py + ph * 0.58, qw, bh, save.champ && !save.champ.final ? 'CLASIFICACIÓN ▶' : 'MENÚ', { fs: 0.38 });
  else {
    uiButton('again', qx, py + ph * 0.58, qw, bh, '↻ REPETIR', Object.assign({ fs: 0.38 }, GREY));
    if (mode === 'quick' && trackIdx + 1 < save.unlocked) uiButton('nextTrack', qx, py + ph * 0.58 + bh * 1.2, qw, bh, 'SIGUIENTE ▶', { fs: 0.38 });
    uiButton('menu', qx, py + ph * 0.58 + bh * 2.4, qw, bh, 'MENÚ', Object.assign({ fs: 0.38 }, GREY));
  }
  drawCredits();
}

/* ---------- acciones ---------- */
function onTap(x, y) {
  if (state === 'race' && !paused) {
    if (Math.hypot(x - BTN.pause.x, y - BTN.pause.y) < BTN.pause.r * 1.5) setPause(true);
    else if (Math.hypot(x - BTN.cam.x, y - BTN.cam.y) < BTN.cam.r * 1.5) { save.cam = (save.cam + 1) % 3; persist(); camInit = false; }
    return;
  }
  if (stateT < 0.25) return;
  for (let i = uiButtons.length - 1; i >= 0; i--) {
    const b = uiButtons[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { AU.click(); doAction(b.id); return; }
  }
}
function doAction(id) {
  const [a, v] = id.split(':'), n = Number(v);
  switch (a) {
    case 'champ': case 'champHub': setState('champ'); break;
    case 'champNew': save.champ = { round: 0, pts: { 'TÚ': 0 }, field: makeField(), final: 0 }; save.champ.field.forEach(f => save.champ.pts[f.name] = 0); persist(); setState('champ'); break;
    case 'champGo': startRace(save.champ.round, 'champ'); break;
    case 'champQuit': save.champ = null; persist(); break;
    case 'quick': trackMode = 'quick'; setState('tracks'); break;
    case 'trial': trackMode = 'trial'; setState('tracks'); break;
    case 'garage': garageIdx = save.car; garageTab = 0; setState('garage'); break;
    case 'settings': setState('settings'); break;
    case 'back': case 'menu': setState('title'); break;
    case 'track': if (n < save.unlocked || trackMode === 'trial') startRace(n, trackMode); else AU.bump(); break;
    case 'gprev': garageIdx = mod(garageIdx - 1, CARS.length); garageTab = 0; break;
    case 'gnext': garageIdx = mod(garageIdx + 1, CARS.length); garageTab = 0; break;
    case 'gtab': garageTab = n; break;
    case 'gbuy': {
      const c = CARS[garageIdx];
      if (save.owned.includes(garageIdx)) { save.car = garageIdx; persist(); AU.coin(); }
      else if (save.credits >= c.price) { save.credits -= c.price; save.owned.push(garageIdx); save.car = garageIdx; persist(); AU.win(); vibrate(100); }
      else AU.bump();
      break;
    }
    case 'upg': {
      const k = UPG[n].key, cost = upCost(garageIdx, k);
      if (upLevel(garageIdx, k) < 3 && save.credits >= cost) { save.credits -= cost; save.up[garageIdx] = Object.assign({}, save.up[garageIdx], { [k]: upLevel(garageIdx, k) + 1 }); persist(); AU.coin(); vibrate(60); }
      else AU.bump();
      break;
    }
    case 'paint': save.colors[garageIdx] = n; persist(); break;
    case 'toggle': {
      AU.init();
      if (v === 'diff') save.diff = (save.diff + 1) % 3;
      else if (v === 'q') { save.q = (save.q + 2) % 3; applyQuality(); }
      else if (v === 'cam') { save.cam = (save.cam + 1) % 3; camInit = false; }
      else save[v] = !save[v];
      persist(); AU.setVol(); layoutButtons(); break;
    }
    case 'resume': setPause(false); break;
    case 'restart': paused = false; startRace(trackIdx, mode); break;
    case 'quit': paused = false; setState('title'); break;
    case 'again': startRace(trackIdx, mode); break;
    case 'nextTrack': startRace(Math.min(trackIdx + 1, save.unlocked - 1), 'quick'); break;
  }
}
function setPause(on) {
  if (state !== 'race') return;
  paused = on; stateT = 0.3;
  if (on) { AU.engineSet(0, 0, 0, 0, 0); if (AU.ac) AU.ac.suspend(); } else AU.init();
}
window.onBack = () => {
  if (state === 'race') setPause(!paused);
  else if (state === 'title') { if (window.Android && Android.exit) Android.exit(); }
  else if (state === 'results') setState('title');
  else setState('title');
};
window.onAppPause = () => { if (state === 'race' && !paused) setPause(true); else if (AU.ac) AU.ac.suspend(); };
window.onAppResume = () => { if (!(state === 'race' && paused) && AU.ac) AU.ac.resume(); };
let updatePending = false;
const GAME_VERSION = (() => { try { return (window.Android && Android.gameVersion) ? Android.gameVersion() : 0; } catch (e) { return 0; } })();
window.onUpdateReady = () => { updatePending = true; if (state !== 'race' && state !== 'results') applyUpdate(); };
function applyUpdate() { if (updatePending && window.Android && Android.reload) { updatePending = false; Android.reload(); } }

/* ---------- entrada ---------- */
const input = { steer: 0, gas: false, brake: false, nitro: false };
const pointers = new Map(), keys = {};
let tiltVal = 0;
window.addEventListener('devicemotion', e => {
  const a = e.accelerationIncludingGravity; if (!a || a.y === null) return;
  const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 90;
  const v = (ang === 90 ? a.y : -a.y) / 4.2; tiltVal = Math.abs(v) < 0.07 ? 0 : clamp(v, -1, 1);
});
function near(p, b, k) { return b && Math.hypot(p.x - b.x, p.y - b.y) < b.r * (k || 1.35); }
function readInput() {
  let st = 0, gas = false, br = false, ni = false;
  if (state === 'race' && !paused) for (const p of pointers.values()) {
    if (!save.tilt && p.x < W * 0.42 && p.y > H * 0.45) { st += p.x < (BTN.left.x + BTN.right.x) / 2 ? -1 : 1; continue; }
    if (near(p, BTN.nitro)) ni = true; else if (near(p, BTN.brake)) br = true; else if (near(p, BTN.gas, 1.6)) gas = true;
  }
  if (keys.ArrowLeft || keys.KeyA) st -= 1; if (keys.ArrowRight || keys.KeyD) st += 1;
  if (keys.ArrowUp || keys.KeyW) gas = true; if (keys.ArrowDown || keys.KeyS) br = true;
  if (keys.Space || keys.ShiftLeft || keys.KeyN) ni = true;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of pads) {
    if (!gp) continue;
    const ax = gp.axes[0] || 0; if (Math.abs(ax) > 0.15) st += ax;
    const b = i => gp.buttons[i] && gp.buttons[i].pressed;
    if (b(14)) st -= 1; if (b(15)) st += 1; if (b(0) || b(7)) gas = true; if (b(1) || b(6)) br = true; if (b(2) || b(5)) ni = true;
  }
  if (save.tilt && state === 'race') st += tiltVal;
  input.steer = clamp(st, -1, 1); input.gas = gas; input.brake = br; input.nitro = ni;
}
function cxy(e) { return { x: e.clientX * W / window.innerWidth, y: e.clientY * H / window.innerHeight }; }
ui.addEventListener('pointerdown', e => { e.preventDefault(); AU.init(); const p = cxy(e); pointers.set(e.pointerId, p); try { ui.setPointerCapture(e.pointerId); } catch (er) {} onTap(p.x, p.y); }, { passive: false });
ui.addEventListener('pointermove', e => { if (pointers.has(e.pointerId)) pointers.set(e.pointerId, cxy(e)); }, { passive: false });
const endP = e => pointers.delete(e.pointerId);
ui.addEventListener('pointerup', endP); ui.addEventListener('pointercancel', endP);
window.addEventListener('keydown', e => { AU.init(); keys[e.code] = true; if (e.code === 'Escape' || e.code === 'KeyP') window.onBack(); if (e.code === 'KeyC' && state === 'race') { save.cam = (save.cam + 1) % 3; camInit = false; } });
window.addEventListener('keyup', e => { keys[e.code] = false; });

/* ---------- bucle ---------- */
let lastT = performance.now(), errMsg = null, frameAvg = 16, qT = 0;
window.addEventListener('error', e => { errMsg = String(e.message || e); });
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - lastT) / 1000; lastT = now;
  if (dt > 0.1) dt = 0.1; if (dt <= 0) return;
  stateT += dt;
  try {
    readInput(); AU.tick();
    ctx.clearRect(0, 0, W, H);
    if (state === 'race') {
      if (!paused) { const n = dt > 0.025 ? 2 : 1; for (let i = 0; i < n; i++) updateRace(dt / n); }
      for (const r of racers) poseCar(r, dt);
      updateCamera(dt, player, false);
      updateGuide();
      updateWorldFx(dt, player.car.position);
      updateFx(paused ? 0 : dt);
      renderer.render(scene, camera);
      if (state === 'race') { drawHUD(); if (paused) drawPause(); }
      if (!paused && raceT > 3 && !window.__noq) {
        frameAvg = lerp(frameAvg, dt * 1000, 0.03); qT += dt;
        if (qT > 6 && frameAvg > 30 && save.q > 0) { save.q--; persist(); applyQuality(); qT = 0; frameAvg = 16; showMsg('Gráficos ajustados', '#ffffff', 1.5); }
      }
    } else if (state === 'garage') { renderGarage(dt); drawGarageUI(); }
    else {
      if (state === 'results') { updateRace(dt); for (const r of racers) poseCar(r, dt); updateCamera(dt, player, true); updateWorldFx(dt, player.car.position); updateFx(dt); }
      else updateDemo(dt);
      renderer.render(scene, camera);
      if (state === 'title') drawTitle(); else if (state === 'tracks') drawTracks(); else if (state === 'champ') drawChamp();
      else if (state === 'settings') drawSettings(); else if (state === 'results') drawResults();
    }
  } catch (e) { errMsg = String(e && e.stack || e); }
  if (errMsg) { ctx.fillStyle = 'rgba(120,0,0,0.85)'; ctx.fillRect(0, H * 0.9, W, H * 0.1); text('Error: ' + errMsg.slice(0, 140), W / 2, H * 0.95, H * 0.026, '#fff', 'center', 600); }
}
function boot() {
  initRenderer(); resize(); fxInit(); precomputeMaps();
  window.addEventListener('resize', resize);
  AU.playSong(0);
  setState('title');
  requestAnimationFrame(t => { lastT = t; frame(t); });
}
boot();
if (/[?&]debug/.test(location.search) || !window.Android) window.__g = { aiInputs, physicsStep, updateRace, input, sampleAt, headingOf, get mode() { return mode; }, startRace, setState, doAction, save, T, get player() { return player; }, get state() { return state; }, get racers() { return racers; }, get raceT() { return raceT; }, set raceT(v) { raceT = v; }, get fps() { return frameAvg; }, standings };

/* ===== CARRERA: física, rivales, cámara y efectos ===== */
let state = 'title', stateT = 0, raceT = 0, paused = false, mode = 'quick';
let player = null, rivals = [], racers = [], results = null, msg = null, shake = 0, ghost = null, ghostRec = null;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let camYaw = 0, camInit = false;
const WHEELBASE = 2.7;

function sampleAt(s) {   // posición interpolada en la pista para una distancia s (m)
  const u = mod(s, T.L) / DS, i = Math.floor(u) % T.N, j = (i + 1) % T.N, f = u - Math.floor(u);
  return { i, x: lerp(T.px[i], T.px[j], f), y: lerp(T.py[i], T.py[j], f), z: lerp(T.pz[i], T.pz[j], f), tx: lerp(T.tx[i], T.tx[j], f), tz: lerp(T.tz[i], T.tz[j], f) };
}
const S0 = () => START_I * DS;
function headingOf(tx, tz) { return Math.atan2(-tz, tx); }

function clearCars() { if (guide) { scene.remove(guide.m); guide.m.geometry.dispose(); guide = null; } for (const r of racers) if (r.car) scene.remove(r.car); if (ghost && ghost.car) scene.remove(ghost.car); racers = []; rivals = []; ghost = null; }
function makeRacer(m, color, name, slot, isPlayer, stats) {
  const car = buildCar(m, color); scene.add(car);
  const row = Math.floor(slot / 2), prog = -(6 + row * 5 + (slot % 2) * 2) * DS;
  const r = { car, m, color, name, prog, d: slot % 2 ? 3 : -3, v: 0, finished: false, time: 0, isPlayer, lap: 1, stats };
  const p = sampleAt(prog + S0());
  r.x = p.x - p.tz * r.d; r.z = p.z + p.tx * r.d; r.y = p.y; r.yaw = headingOf(p.tx, p.tz);
  return r;
}
function startRace(ti, md) {
  mode = md || 'quick';
  buildTracks(ti);
  save.lastTrack = ti; persist();
  clearCars();
  const pm = save.car, st = carStats(pm);
  const pslot = mode === 'trial' ? 0 : 6;
  player = makeRacer(pm, PAINT[save.colors[pm] ?? CARS[pm].paint], 'TÚ', pslot, true, st);
  Object.assign(player, { vx: 0, vy: 0, r: 0, ax: 0, steer: 0, drift: 0, nitro: st.nitro, boost: false, lapStart: 0, lapTimes: [], idx: 0, sLast: 0, base: 0, stuck: 0, draft: 0, wrong: 0, crashCD: 0, latA: 0, lonA: 0, rough: 0 });
  initPlayerProgress();
  racers = [player];
  if (mode !== 'trial') {
    const field = mode === 'champ' && save.champ ? save.champ.field : makeField();
    const slots = [0, 1, 2, 3, 4, 5, 7];
    field.forEach((f, k) => {
      const r = makeRacer(f.m, f.color, f.name, slots[k], false);
      const baseTop = ([300, 318, 334][save.diff] + ti * 3) / 3.6;
      r.top = baseTop * f.skill; r.grip = [1.15, 1.28, 1.4][save.diff] * (0.97 + (f.skill - 0.95) * 1.0); if (theme.rain) r.grip *= 0.82; r.lane = (k % 3 - 1) * 1.6; r.idx = 0;
      rivals.push(r); racers.push(r);
    });
  } else setupGhost(ti);
  makeGuide();
  raceT = -4.2; results = null; msg = null; paused = false; lastCount = 5; camInit = false;
  setState('race');
  AU.playSong(1); AU.engineOn();
}
function makeField() {
  const names = RIVAL_NAMES.slice().sort(() => Math.random() - 0.5), out = [];
  const cols = PAINT.slice().sort(() => Math.random() - 0.5);
  for (let k = 0; k < 7; k++) out.push({ name: names[k], m: Math.floor(Math.random() * CARS.length), color: cols[k], skill: 1.0 - k * 0.013 + (Math.random() - 0.5) * 0.01 });
  return out;
}
let lastCount = 5;
function showMsg(t, c, dur) { msg = { t, c: c || '#ffffff', life: dur || 1.6, max: dur || 1.6 }; }

/* ---------- progreso del jugador sobre la pista ---------- */
function locate(r) {
  let bi = r.idx || 0, bd = 1e18;
  const search = (a, b) => { for (let k = a; k <= b; k++) { const j = mod(k, T.N), d = (T.px[j] - r.x) ** 2 + (T.pz[j] - r.z) ** 2; if (d < bd) { bd = d; bi = j; } } };
  search(bi - 25, bi + 25);
  if (bd > 400) { const [j] = nearestTrack(r.x, r.z, 200); if (j >= 0) { bi = j; bd = 0; search(j - 10, j + 10); } }
  r.idx = bi;
  const dx = r.x - T.px[bi], dz = r.z - T.pz[bi];
  r.d = dx * -T.tz[bi] + dz * T.tx[bi];
  const along = dx * T.tx[bi] + dz * T.tz[bi];
  return bi * DS + along;
}
function initPlayerProgress() {
  const p = player; p.idx = Math.floor(mod(p.prog + S0(), T.L) / DS);
  const s = locate(p); p.sLast = s; p.base = p.prog + S0() - s;
}
function updateProgress(r) {
  const s = locate(r);
  let ds = s - r.sLast; if (ds < -T.L / 2) r.base += T.L; else if (ds > T.L / 2) r.base -= T.L;
  r.sLast = s; r.prog = r.base + s - S0();
}

/* ---------- física del jugador: modelo de bicicleta con neumáticos ---------- */
const PHY = { m: 1450, Iz: 2350, a: 1.22, b: 1.48, h: 0.46, g: 9.81, rho: 1.2, ClA: 2.6, B: 14, C: 1.6 };
function tireF(alpha, Fz, mu) { return mu * Fz * Math.sin(PHY.C * Math.atan(PHY.B * alpha)); }
function updatePlayer(dt) {
  const p = player, st = p.stats, go = raceT >= 0 && !p.finished;
  let steerIn = input.steer, gas, brake = input.brake, nit = input.nitro;
  if (p.finished) { // conducción automática tras la meta
    const ah = sampleAt(p.prog + S0() + 25), want = headingOf(ah.tx, ah.tz) + p.d * 0.02;
    steerIn = clamp(-angDiff(p.yaw, want) * 3, -1, 1); gas = p.vx < 30; brake = p.vx > 35; nit = false;
  } else gas = save.autoGas ? !brake : input.gas;
  if (!go && !p.finished) { gas = false; brake = true; }
  const onRoad = Math.abs(p.d) < ROAD_W / 2 + KERB_W * 0.7;
  const wet = theme.rain ? 0.8 : 1, mu = 1.45 * st.grip * wet * (onRoad ? 1 : 0.55);
  // rebufo
  p.draft = 0;
  for (const r of rivals) { const ds = r.prog - p.prog; if (ds > 5 && ds < 32 && Math.abs(r.d - p.d) < 1.7) p.draft = 1; }
  // nitro
  p.boost = false;
  if (go && nit && p.nitro > 0.05 && gas && p.vx > 5) {
    if (!p.wasBoost) { AU.nitro(); vibrate(40); }
    p.boost = true; p.nitro = Math.max(0, p.nitro - dt);
  }
  p.wasBoost = p.boost;
  const vtop = st.top / 3.6, P = 440e3 * st.acc * (p.boost ? 1.45 * st.boost : 1);
  const CdA = 2 * 440e3 * st.acc / (PHY.rho * vtop * vtop * vtop) * (p.draft ? 0.82 : 1);
  // dirección con límite según velocidad y suavizado (el volante no gira de golpe)
  const dMax = 0.55 / (1 + Math.max(0, p.vx) / 17);
  const target = steerIn * dMax, rate = 2.6;
  p.steer += clamp(target - p.steer, -rate * dt, rate * dt);
  const n = 4, h = dt / n;
  let slipMax = 0, crashV = 0;
  for (let it = 0; it < n; it++) {
    const vx = p.vx, vy = p.vy, r = p.r, spd = Math.hypot(vx, vy);
    const down = 0.5 * PHY.rho * PHY.ClA * vx * vx, L = PHY.a + PHY.b;
    let Fzf = PHY.m * PHY.g * PHY.b / L + down * 0.45 - PHY.m * (p.ax || 0) * PHY.h / L;
    let Fzr = PHY.m * PHY.g * PHY.a / L + down * 0.55 + PHY.m * (p.ax || 0) * PHY.h / L;
    Fzf = Math.max(500, Fzf); Fzr = Math.max(500, Fzr);
    // fuerzas longitudinales
    let Fx = 0, Fxr = 0, Fxf = 0;
    if (go || p.finished) {
      if (brake && vx > 0.5) { const Fb = mu * (Fzf + Fzr) * 0.92; Fxf = -Fb * 0.62; Fxr = -Fb * 0.38; }
      else if (brake && vx <= 0.5 && go) { Fxr = -PHY.m * 4; }                   // marcha atrás
      else if (gas) { const Fd = Math.min(P / Math.max(vx, 6), PHY.m * 8.5 * st.acc * (p.boost ? 1.3 : 1)); Fxf = Fd * 0.35; Fxr = Fd * 0.65; }
      else Fxr = -Math.sign(vx) * 700;                                           // freno motor
    } else if (Math.abs(vx) > 0.1) Fxr = -Math.sign(vx) * PHY.m * 6;
    // fuerzas laterales primero (ABS y control de tracción dan prioridad al giro)
    let Fyf = 0, Fyr = 0;
    const lowV = Math.abs(vx) <= 1.5;
    if (!lowV) {
      const af = p.steer - Math.atan2(vy + PHY.a * r, Math.abs(vx)), ar = -Math.atan2(vy - PHY.b * r, Math.abs(vx));
      Fyf = clamp(tireF(af, Fzf, mu), -mu * Fzf, mu * Fzf); Fyr = clamp(tireF(ar, Fzr, mu * 1.1), -mu * 1.1 * Fzr, mu * 1.1 * Fzr);
    }
    const remF = Math.max(0.45 * mu * Fzf, Math.sqrt(Math.max(0, (mu * Fzf) ** 2 - Fyf * Fyf)));
    const remR = Math.max(0.45 * mu * Fzr, Math.sqrt(Math.max(0, (mu * 1.1 * Fzr) ** 2 - Fyr * Fyr)));
    Fxf = clamp(Fxf, -remF, remF); Fxr = clamp(Fxr, -remR, remR);
    Fx = Fxf + Fxr - Math.sign(vx) * (0.5 * PHY.rho * CdA * vx * vx + 160 + (onRoad ? 0 : 0.22 * PHY.m * PHY.g * Math.min(1, Math.abs(vx) / 5)));
    if (!lowV) {
      const ax = (Fx - Fyf * Math.sin(p.steer)) / PHY.m + vy * r;
      const ay = (Fyr + Fyf * Math.cos(p.steer)) / PHY.m - vx * r;
      let dr = (PHY.a * Fyf * Math.cos(p.steer) - PHY.b * Fyr) / PHY.Iz;
      // control de estabilidad suave: deja derrapar pero evita trompos
      const beta = Math.atan2(vy, Math.max(1, vx)), bLim = 0.13;
      if (beta * r < 0 && Math.abs(beta) > bLim) dr -= Math.sign(r) * 30 * (Math.abs(beta) - bLim);
      dr -= r * 0.6;   // amortiguación de guiñada (estabilidad)
      p.vx += ax * h; p.vy += ay * h; p.r += dr * h; p.ax = lerp(p.ax || 0, ax, 0.1);
      if (Math.abs(p.vy) > 0.45 * Math.abs(p.vx) && Math.abs(p.vx) > 5) p.vy = Math.sign(p.vy) * 0.45 * Math.abs(p.vx);
      p.latA = ay + vx * r;
    } else { // muy despacio: giro cinemático
      p.r = p.vx * Math.tan(p.steer) / L; p.vy *= 0.8; p.vx += Fx / PHY.m * h; p.ax = Fx / PHY.m; p.latA = 0;
    }
    if (!(go || p.finished) && Math.abs(p.vx) < 0.3) { p.vx = 0; p.vy = 0; p.r = 0; }
    if (p.vx < -9) p.vx = -9;
    // integrar posición (guiñada positiva = izquierda; r positiva = derecha)
    p.yaw -= p.r * h;
    const fx = Math.cos(p.yaw), fz = -Math.sin(p.yaw), rx = Math.sin(p.yaw), rz = Math.cos(p.yaw);
    p.x += (fx * p.vx + rx * p.vy) * h; p.z += (fz * p.vx + rz * p.vy) * h;
    updateProgress(p);
    // muros
    const ii = p.idx, wl = T.wall[ii] - 1.05;
    if (Math.abs(p.d) > wl) {
      const sd = Math.sign(p.d), over = Math.abs(p.d) - wl, nx = -T.tz[ii] * sd, nz = T.tx[ii] * sd;
      p.x -= nx * over; p.z -= nz * over; p.d = sd * wl;
      let Vx = fx * p.vx + rx * p.vy, Vz = fz * p.vx + rz * p.vy;
      const vn = Vx * nx + Vz * nz;
      if (vn > 0) {
        Vx -= 1.25 * vn * nx; Vz -= 1.25 * vn * nz;
        const tf = 1 - Math.min(0.35, vn * 0.025); Vx *= tf; Vz *= tf;
        p.vx = Vx * fx + Vz * fz; p.vy = Vx * rx + Vz * rz;
        if (vn > 3) { p.r *= 0.5; const th = headingOf(T.tx[ii], T.tz[ii]); p.yaw += angDiff(p.yaw, th) * Math.min(0.5, vn * 0.03); }
        crashV = Math.max(crashV, vn); p.wallSide = sd;
      }
    }
  }
  p.v = Math.hypot(p.vx, p.vy);
  p.crashCD -= dt;
  if (crashV > 0) {
    if (crashV > 6 && p.crashCD <= 0) { AU.crash(); vibrate(160); shake = Math.min(1, crashV / 15); p.crashCD = 0.5; sparks(p, p.wallSide); }
    else if (p.crashCD <= 0) { AU.bump(); p.crashCD = 0.25; }
  }
  // derrape: ángulo entre hacia dónde apunta el coche y hacia dónde va
  const beta = Math.atan2(p.vy, Math.max(1, p.vx));
  p.drift = p.vx > 15 ? beta : 0;
  p.slip = clamp((slipMax - 0.1) * 6, 0, 1);
  if (Math.abs(beta) > 0.09 && p.vx > 18 && go) { p.nitro = Math.min(st.nitro, p.nitro + dt * 0.5 * Math.min(1, Math.abs(beta) / 0.25)); if (!p.driftMsg) { p.driftMsg = 1; showMsg('¡DERRAPE! +NITRO', '#7fe8ff', 0.9); } } else p.driftMsg = 0;
  if (p.draft && go) p.nitro = Math.min(st.nitro, p.nitro + dt * 0.18);
  if (go && !p.boost) p.nitro = Math.min(st.nitro, p.nitro + dt * 0.035);
  p.lonA = p.ax || 0;
  // contacto con rivales
  for (const r of rivals) {
    const ds = r.prog - p.prog, dd = r.d - p.d;
    if (Math.abs(ds) < 4.5 && Math.abs(dd) < 1.95) {
      const ox = 4.5 - Math.abs(ds), oy = 1.95 - Math.abs(dd), rx = -T.tz[p.idx], rz = T.tx[p.idx];
      if (oy < ox * 0.7) {
        const sd = Math.sign(dd) || 1; p.x -= rx * sd * oy * 0.6; p.z -= rz * sd * oy * 0.6; r.d += sd * oy * 0.4;
        p.vy -= sd * 1.2; p.vx *= 0.99; r.v *= 0.985;
        if (p.crashCD <= 0) { AU.bump(); vibrate(40); p.crashCD = 0.3; shake = 0.3; }
      } else if (ds > 0 && p.vx > r.v) {
        const rel = p.vx - r.v; p.vx = r.v * 0.97; r.v += rel * 0.3; p.x -= T.tx[p.idx] * ox; p.z -= T.tz[p.idx] * ox;
        if (p.crashCD <= 0) { AU.bump(); vibrate(60); p.crashCD = 0.3; shake = Math.min(1, rel / 10); }
      } else if (ds < 0 && r.v > p.vx) { r.v = Math.max(0, p.vx) * 0.97; r.prog -= ox; }
    }
  }
  // atasco o dirección contraria: recolocar
  const rel = Math.abs(angDiff(headingOf(T.tx[p.idx], T.tz[p.idx]), p.yaw));
  p.wrong = rel > 1.9 && p.v > 4 ? p.wrong + dt : 0;
  p.stuck = go && (p.v < 3 && (Math.abs(p.d) > ROAD_W / 2 || rel > 1.2)) ? p.stuck + dt : 0;
  if (p.stuck > 3 || p.wrong > 3) respawn(p);
  const a0 = p.idx, a1 = (a0 + 1) % T.N;
  p.y = T.py[a0] + (T.py[a1] - T.py[a0]) * clamp((p.sLast - a0 * DS) / DS, 0, 1);
  p.pitch = Math.atan((T.py[a1] - T.py[mod(a0 - 1, T.N)]) / (2 * DS));
  p.rough = !onRoad ? 1 : (Math.abs(p.d) > ROAD_W / 2 - 0.3 ? 0.4 : 0);
  if (!onRoad && p.v > 8) shake = Math.max(shake, 0.12);
  // vueltas
  if (!p.finished && p.prog >= p.lap * T.L) {
    const lt = raceT - p.lapStart; p.lapTimes.push(lt); p.lapStart = raceT; p.lap++;
    if (mode === 'trial') ghostLap(lt);
    if (p.lap > track.laps) { p.finished = true; p.time = raceT; finishRace(); }
    else { AU.lap(); showMsg(p.lap === track.laps ? '¡VUELTA FINAL!' : 'VUELTA ' + p.lap, '#ffd24a', 1.8); }
  }
  if (mode === 'trial' && ghostRec && go) recordGhost();
}
function respawn(p) {
  const s = sampleAt(p.prog + S0());
  p.x = s.x; p.z = s.z; p.yaw = headingOf(s.tx, s.tz); p.v = p.vx = p.vy = p.r = 0; p.steer = 0; p.stuck = 0; p.wrong = 0; p.drift = 0; p.d = 0;
  showMsg('RECOLOCADO', '#ffffff', 1.2);
}

/* ---------- rivales ---------- */
function updateRivals(dt) {
  const go = raceT >= 0;
  for (const r of rivals) {
    const s = r.prog + S0(), idx = Math.floor(mod(s, T.L) / DS);
    // velocidad objetivo según las curvas que vienen
    let vt = r.top;
    const cAero = 0.5 * PHY.rho * PHY.ClA / PHY.m, vcAt = k => { const den = k - r.grip * cAero; return den <= 1e-6 ? 999 : Math.sqrt(r.grip * PHY.g / den); };
    for (let j = 2; j < 120; j += 2) {
      const vc = vcAt(Math.abs(T.k[(idx + j) % T.N]) + 1e-5);
      vt = Math.min(vt, Math.sqrt(vc * vc + 2 * r.grip * PHY.g * 0.85 * j * DS));
    }
    vt = Math.min(vt, vcAt(Math.abs(T.k[idx]) + 1e-5) * 1.01);
    if (!player.finished) { const gap = r.prog - player.prog; if (gap > 60) vt *= 0.965; else if (gap < -90) vt *= 1.035; }
    if (!go) vt = 0;
    // evitar a los coches de delante
    let blocker = null;
    for (const o of racers) { if (o === r) continue; const ds = o.prog - r.prog; if (ds > 0 && ds < 22 && Math.abs(o.d - r.d) < 2.2 && o.v < r.v + 1) { if (!blocker || ds < blocker.ds) blocker = { o, ds }; } }
    let kA = 0; for (let j = 8; j < 36; j += 4) kA += T.k[(idx + j) % T.N]; kA /= 7;
    let td = clamp(kA * 650, -4.2, 4.2) + r.lane * (1 - Math.min(1, Math.abs(kA) * 300));
    if (blocker) {
      const o = blocker.o, left = o.d - 3.2, right = o.d + 3.2, lim = ROAD_W / 2 - 1.4;
      td = Math.abs(left - r.d) < Math.abs(right - r.d) ? (left > -lim ? left : right) : (right < lim ? right : left);
      if (blocker.ds < 8) vt = Math.min(vt, o.v - 0.5);
    }
    r.td = go ? clamp(td, -ROAD_W / 2 + 1.3, ROAD_W / 2 - 1.3) : r.d;
    if (go) r.d += clamp(r.td - r.d, -3.2 * dt, 3.2 * dt);
    const acc = r.v < vt ? 8 * (1 - r.v / (r.top * 1.05)) + 0.8 : -r.grip * PHY.g * 0.9;
    r.v = Math.max(0, Math.min(r.v + acc * dt, Math.max(vt, r.v - 20 * dt)));
    if (go) r.prog += r.v * dt;
    if (!r.finished && r.prog >= track.laps * T.L) { r.finished = true; r.time = raceT; }
    const p = sampleAt(r.prog + S0());
    r.x = p.x - p.tz * r.d; r.z = p.z + p.tx * r.d; r.y = p.y; r.idx = p.i;
    r.yaw = headingOf(p.tx, p.tz) - (r.td - r.d) * 0.03;
    r.pitch = Math.atan((T.py[(p.i + 1) % T.N] - T.py[mod(p.i - 1, T.N)]) / (2 * DS));
    r.brk = acc < 0 && r.v > 10;
    r.latA = r.v * r.v * T.k[p.i];
  }
}

/* ---------- guía de trazada: verde (bien), amarillo (afloja), rojo (frena) ---------- */
let guide = null;
const G_COL = [new THREE.Color('#2bff6a'), new THREE.Color('#ffd21a'), new THREE.Color('#ff2a2a')], _gc = new THREE.Color();
function makeGuide() {
  const n = 90, pos = new Float32Array(n * 12), col = new Float32Array(n * 12), idx = [];
  for (let k = 0; k < n; k++) { const a = k * 4; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.78, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8, toneMapped: false }));
  m.frustumCulled = false; m.renderOrder = 2; scene.add(m);
  guide = { m, n };
}
function lineAt(s) { const u = mod(s, T.L) / DS, i = Math.floor(u) % T.N, f = u - Math.floor(u); return lerp(T.line[i], T.line[(i + 1) % T.N], f); }
function updateGuide() {
  if (!guide) return;
  const p = player, on = save.guide && !p.finished && state === 'race';
  guide.m.visible = on; if (!on) return;
  const st = p.stats, wet = theme.rain ? 0.8 : 1, mu = 1.45 * st.grip * wet * 0.9, c = 0.5 * PHY.rho * PHY.ClA / PHY.m, g0 = PHY.g;
  const v = Math.max(0, p.vx), decMax = mu * (g0 + c * v * v) * 0.85;
  const s0 = p.prog + S0(), range = 60 + v * 3.4, step = 4, n = Math.min(guide.n, Math.floor(range / step));
  const pos = guide.m.geometry.attributes.position.array, col = guide.m.geometry.attributes.color.array;
  const vcAt = kk => { const den = kk - mu * c; return den <= 1e-6 ? 999 : Math.sqrt(mu * g0 / den); };
  const ratio = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const sa = s0 + 6 + k * step;
    let kk = 0; for (let q = 0; q < 3; q++) kk = Math.max(kk, Math.abs(T.k[Math.floor(mod(sa + q * 2, T.L) / DS) % T.N]));
    const vc = vcAt(kk + 1e-5), dist = Math.max(1, sa - s0);
    ratio[k] = v > vc ? (v * v - vc * vc) / (2 * dist) / decMax : 0;
  }
  // cada tramo avisa de la curva más exigente que tiene por delante
  for (let k = n - 2; k >= 0; k--) ratio[k] = Math.max(ratio[k], ratio[k + 1]);
  for (let k = 0; k < n; k++) {
    const sa = s0 + 6 + k * step, sb = sa + step * 0.62, t = ratio[k];
    if (t < 0.35) _gc.copy(G_COL[0]); else if (t < 0.7) _gc.copy(G_COL[0]).lerp(G_COL[1], clamp((t - 0.35) / 0.15, 0, 1)); else _gc.copy(G_COL[1]).lerp(G_COL[2], clamp((t - 0.7) / 0.15, 0, 1));
    for (const [sx, o] of [[sa, 0], [sb, 6]]) {
      const P = sampleAt(sx), d = lineAt(sx), rx = -P.tz, rz = P.tx, w = 0.75;
      pos.set([P.x + rx * (d - w), P.y + 0.06, P.z + rz * (d - w), P.x + rx * (d + w), P.y + 0.06, P.z + rz * (d + w)], k * 12 + o);
      col.set([_gc.r, _gc.g, _gc.b, _gc.r, _gc.g, _gc.b], k * 12 + o);
    }
  }
  guide.m.geometry.setDrawRange(0, n * 6);
  guide.m.geometry.attributes.position.needsUpdate = true; guide.m.geometry.attributes.color.needsUpdate = true;
}

/* ---------- colocar los coches en la escena ---------- */
function poseCar(r, dt) {
  const c = r.car, u = c.userData;
  c.position.set(r.x, r.y, r.z);
  c.rotation.set(0, r.yaw, r.pitch || 0);
  u.body.rotation.x = damp(u.body.rotation.x, clamp(-(r.latA || 0) * 0.0045, -0.06, 0.06), 6, dt);
  u.body.rotation.z = damp(u.body.rotation.z, clamp(-(r.lonA || 0) * 0.0018, -0.035, 0.035), 6, dt);
  u.body.rotation.y = 0;
  for (const w of u.wheels) { w.spin.rotation.z -= (r.isPlayer ? r.vx : r.v) * dt / 0.37; if (w.front) w.pivot.rotation.y = r.isPlayer ? -r.steer * 2.2 : clamp(-(r.td - r.d) * 0.08, -0.3, 0.3); }
  setBrake(c, r.isPlayer ? (input.brake && r.v > 1) : r.brk, theme.night);
}

/* ---------- cámara ---------- */
const _v = new THREE.Vector3();
function updateCamera(dt, r, cine) {
  const fx = Math.cos(r.yaw), fz = -Math.sin(r.yaw);
  if (cine) { // cámara de exhibición en los menús
    const a = stateT * 0.18;
    _v.set(r.x + Math.cos(a) * 11, r.y + 3.2 + Math.sin(stateT * 0.3) * 0.8, r.z + Math.sin(a) * 11);
    camPos.lerp(_v, camInit ? 1 - Math.exp(-dt * 3) : 1); camInit = true;
    camera.position.copy(camPos); camera.lookAt(r.x, r.y + 0.8, r.z);
    camera.fov = 50; camera.updateProjectionMatrix(); return;
  }
  camYaw = camInit ? camYaw + angDiff(camYaw, r.yaw - (r.drift || 0) * 0.55) * (1 - Math.exp(-dt * 7)) : r.yaw;
  const cfx = Math.cos(camYaw), cfz = -Math.sin(camYaw), v = r.v;
  const modeC = save.cam;
  let back = 5.8 + v * 0.012, up = 1.95 + v * 0.004, ahead = 7;
  if (modeC === 1) { back = 9 + v * 0.015; up = 3.4; ahead = 10; }
  if (modeC === 2) { back = -0.6; up = 1.22; ahead = 30; }
  _v.set(r.x - cfx * back, r.y + up, r.z - cfz * back);
  if (modeC === 2) camPos.copy(_v); else camPos.lerp(_v, camInit ? 1 - Math.exp(-dt * 12) : 1);
  camInit = true;
  camLook.set(r.x + fx * ahead, r.y + (modeC === 2 ? 1.0 : 0.9), r.z + fz * ahead);
  camera.position.copy(camPos);
  if (shake > 0) camera.position.add(_v.set((Math.random() - 0.5) * shake * 0.35, (Math.random() - 0.5) * shake * 0.25, (Math.random() - 0.5) * shake * 0.35));
  camera.lookAt(camLook);
  camera.rotation.z += clamp((r.latA || 0) * 0.0007, -0.025, 0.025);
  const fov = 58 + Math.min(v, 100) * 0.13 + (r.boost ? 7 : 0);
  camera.fov = damp(camera.fov, fov, 4, dt); camera.updateProjectionMatrix();
  if (headLight && headLight.visible) { headLight.position.set(r.x + fx * 1.5, r.y + 1.1, r.z + fz * 1.5); headLight.target.position.set(r.x + fx * 40, r.y, r.z + fz * 40); }
}

/* ---------- partículas: humo, polvo, chispas y nitro ---------- */
const FX = { pool: [], tex: null, flames: [] };
function fxInit() {
  if (FX.tex) return;
  FX.tex = new THREE.CanvasTexture((() => { const c = mkCanvas(64, 64), g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c; })());
  for (let i = 0; i < 70; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.tex, transparent: true, depthWrite: false })); s.visible = false; scene.add(s); FX.pool.push({ s, life: 0, max: 1, vx: 0, vy: 0, vz: 0, grow: 1 }); }
  for (let i = 0; i < 4; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.tex, color: '#7fc8ff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.visible = false; scene.add(s); FX.flames.push(s); }
}
function emit(x, y, z, color, size, life, vx, vy, vz, additive) {
  const p = FX.pool.find(q => q.life <= 0); if (!p) return;
  p.s.visible = true; p.s.position.set(x, y, z); p.s.material.color.set(color); p.s.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
  p.s.scale.set(size, size, 1); p.life = p.max = life; p.vx = vx; p.vy = vy; p.vz = vz; p.size = size;
}
function sparks(p, sd) { const rx = -T.tz[p.idx], rz = T.tx[p.idx]; for (let k = 0; k < 14; k++) emit(p.x + rx * sd, p.y + 0.5, p.z + rz * sd, '#ffcc66', 0.25, 0.45, (Math.random() - 0.5) * 8, Math.random() * 4, (Math.random() - 0.5) * 8, true); }
function updateFx(dt) {
  const p = player;
  if (p && state === 'race') {
    const fx = Math.cos(p.yaw), fz = -Math.sin(p.yaw), rx = -fz, rz = fx;
    const smoke = Math.abs(p.drift) > 0.1 || p.slip > 0.4, dust = Math.abs(p.d) > ROAD_W / 2 + KERB_W && p.v > 6;
    if ((smoke || dust) && Math.random() < 0.8) for (const sd of [-1, 1]) {
      const x = p.x - fx * 1.4 + rx * sd * 0.85, z = p.z - fz * 1.4 + rz * sd * 0.85;
      emit(x, p.y + 0.3, z, dust ? (theme.grass === '#b49456' ? '#d8c08a' : '#8a7a55') : '#e8e8e8', 1.0, 1.0, -fx * 2 + (Math.random() - 0.5), 0.8 + Math.random(), -fz * 2 + (Math.random() - 0.5));
    }
    if (theme.rain) for (const r of racers) if (r.v > 20 && Math.random() < 0.6) { const f2x = Math.cos(r.yaw), f2z = -Math.sin(r.yaw); emit(r.x - f2x * 2.6, r.y + 0.4, r.z - f2z * 2.6, '#d8e0e8', 1.6, 0.6, -f2x * 3, 0.6, -f2z * 3); }
    // llama del nitro
    FX.flames.forEach((f, k) => {
      f.visible = p.boost && k < 2;
      if (!f.visible) return;
      const sd = k ? 0.35 : -0.35, L = CARS[p.m].st.len / 2;
      f.position.set(p.x - fx * (L + 0.5) + rx * sd, p.y + 0.36, p.z - fz * (L + 0.5) + rz * sd);
      const s = 0.7 + Math.random() * 0.5; f.scale.set(s, s, 1);
    });
  }
  for (const q of FX.pool) {
    if (q.life <= 0) continue;
    q.life -= dt; if (q.life <= 0) { q.s.visible = false; continue; }
    q.s.position.x += q.vx * dt; q.s.position.y += q.vy * dt; q.s.position.z += q.vz * dt;
    const t = 1 - q.life / q.max, s = q.size * (1 + t * 2.5); q.s.scale.set(s, s, 1); q.s.material.opacity = (1 - t) * 0.55;
  }
}

/* ---------- fantasma de la contrarreloj ---------- */
function setupGhost(ti) {
  ghostRec = { f: [], t0: 0 };
  const gd = save.ghosts[ti];
  if (gd && gd.f && gd.f.length > 10) {
    const car = buildCar(save.car, '#9fd8ff');
    car.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.32; o.material.depthWrite = false; o.castShadow = false; } });
    scene.add(car); ghost = { car, data: gd };
  }
}
function recordGhost() {
  const p = player, t = raceT - p.lapStart, f = ghostRec.f;
  if (!f.length || t - f[f.length - 1][0] >= 0.05) f.push([+t.toFixed(2), +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +p.yaw.toFixed(3)]);
}
function ghostLap(lt) {
  const ti = String(trackIdx), old = save.ghosts[ti];
  if (ghostRec.f.length > 10 && (!old || lt < old.t)) { save.ghosts[ti] = { t: lt, f: ghostRec.f }; persist(); showMsg('¡NUEVO FANTASMA!', '#7fe8ff', 1.5); if (!ghost) setupGhost(trackIdx); else ghost.data = save.ghosts[ti]; }
  ghostRec.f = [];
}
function updateGhost() {
  if (!ghost || raceT < 0) return;
  const f = ghost.data.f, t = raceT - player.lapStart;
  let lo = 0, hi = f.length - 1; if (t >= f[hi][0]) { ghost.car.visible = false; return; }
  ghost.car.visible = true;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (f[m][0] <= t) lo = m; else hi = m; }
  const a = f[lo], b = f[hi], u = clamp((t - a[0]) / ((b[0] - a[0]) || 1), 0, 1);
  ghost.car.position.set(lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u));
  ghost.car.rotation.set(0, a[4] + angDiff(a[4], b[4]) * u, 0);
}

/* ---------- bucle de la carrera ---------- */
function updateRace(dt) {
  raceT += dt;
  if (raceT < 0) {
    const n = clamp(Math.floor((raceT + 4.2) / 0.7), 0, 5);
    START_LIGHTS.forEach((m, k) => m.emissiveIntensity = k < n ? 5 : 0);
    if (n > 5 - lastCount) { lastCount = 5 - n; if (n > 0) AU.beep(false); }
  } else if (lastCount >= 0) { lastCount = -1; START_LIGHTS.forEach(m => m.emissiveIntensity = 0); AU.beep(true); showMsg('¡YA!', '#3dff7a', 1); vibrate(80); }
  updatePlayer(dt);
  updateRivals(dt);
  updateGhost();
  const p = player, sp = p.v / (p.stats.top / 3.6);
  const g7 = Math.min(6.99, sp * 6.4), gear = Math.floor(g7), frac = g7 - gear;
  const rpm = raceT >= 0 || p.finished ? (gear === 0 ? 0.2 + frac * 0.8 : 0.5 + frac * 0.5) : (input.brake ? 0.15 : 0.55 + Math.random() * 0.08);
  p.gear = gear + 1;
  AU.engineSet(rpm, (raceT >= 0 && !input.brake) ? 1 : 0.15, clamp(Math.abs(p.drift) * 2.5 + (p.slip || 0) * 0.5, 0, 1), p.boost ? 1 : sp * sp * 0.6, p.rough * Math.min(1, sp * 2), raceT >= 0 ? gear : 0);
  if (msg) { msg.life -= dt; if (msg.life <= 0) msg = null; }
  shake = Math.max(0, shake - dt * 2.5);
  if (p.finished && state === 'race' && raceT - p.time > 3.5) showResults();
}
function standings() {
  return racers.slice().sort((a, b) => {
    if (a.finished && b.finished) return a.time - b.time;
    if (a.finished) return -1; if (b.finished) return 1;
    return b.prog - a.prog;
  });
}
function finishRace() {
  const pos = standings().indexOf(player) + 1;
  if (mode === 'trial') { showMsg('¡META!', '#ffffff', 3); }
  else if (pos === 1) { AU.win(); showMsg('¡VICTORIA!', '#ffd24a', 3); } else showMsg('META · ' + pos + 'º', '#ffffff', 3);
  vibrate(200);
}
const POINTS = [25, 18, 15, 12, 10, 8, 6, 4];
function showResults() {
  const Ltot = T.L * track.laps;
  for (const r of rivals) if (!r.finished) r.time = raceT + (Ltot - r.prog) / Math.max(20, r.v);
  const order = racers.slice().sort((a, b) => a.time - b.time), pos = order.indexOf(player) + 1;
  const key = String(trackIdx), bestLap = Math.min(...player.lapTimes);
  let rec = false;
  if (!save.bestLap[key] || bestLap < save.bestLap[key]) { save.bestLap[key] = bestLap; rec = true; }
  if (!save.best[key] || player.time < save.best[key]) save.best[key] = player.time;
  let prize = 0, champ = null;
  if (mode === 'trial') prize = 300 + (rec ? 700 : 0);
  else {
    prize = Math.round([2500, 1800, 1300, 900, 700, 500, 400, 300][pos - 1] * [0.7, 1, 1.4][save.diff] * (mode === 'champ' ? 1.2 : 1));
    if (pos <= 3) { save.podiums[key] = Math.min(save.podiums[key] || 9, pos); if (trackIdx + 2 > save.unlocked) save.unlocked = Math.min(TRACKS.length, trackIdx + 2); }
    if (mode === 'champ' && save.champ) {
      const c = save.champ; order.forEach((r, k) => { c.pts[r.name] = (c.pts[r.name] || 0) + POINTS[k]; });
      c.round++; champ = c;
      if (c.round >= TRACKS.length) {
        const tab = Object.entries(c.pts).sort((a, b) => b[1] - a[1]), cp = tab.findIndex(e => e[0] === 'TÚ') + 1;
        c.final = cp; const bonus = [8000, 5000, 3000][cp - 1] || 0; prize += Math.round(bonus * [0.7, 1, 1.4][save.diff]);
        if (cp === 1) save.trophies++;
      }
    }
  }
  save.credits += prize; persist();
  results = { order, pos, prize, rec, bestLap, champ, newTrack: mode !== 'trial' && pos <= 3 && trackIdx + 1 < TRACKS.length };
  AU.engineOff(); AU.playSong(2); AU.coin();
  setState('results');
}

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
  initCarState(player);
  Object.assign(player, { nitro: st.nitro, lapStart: 0, lapTimes: [] });
  racers = [player];
  if (mode !== 'trial') {
    const field = mode === 'champ' && save.champ ? save.champ.field : makeField();
    const slots = [0, 1, 2, 3, 4, 5, 7];
    field.forEach((f, k) => {
      const r = makeRacer(f.m, f.color, f.name, slots[k], false, carStats(f.m, { motor: save.diff, grip: 1, nitro: 0 }));
      setupRival(r, f.skill, k);
      rivals.push(r); racers.push(r);
    });
  } else setupGhost(ti);
  makeGuide();
  raceT = -4.2; results = null; msg = null; paused = false; lastCount = 5; camInit = false;
  setState('race');
  AU.playSong(1); AU.engineOn();
}
function setupRival(r, skill, k) {
  const d = save.diff, sk = 0.97 + (skill - 0.95) * 0.8;
  r.muMul = [0.9, 0.955, 1.0][d] * sk; r.basePow = r.powMul = [0.9, 0.98, 1.04][d] * sk; r.planMul = [0.93, 0.97, 1.0][d];
  r.lane = (k % 3 - 1) * 1.5; r.lap = 1;
  initCarState(r);
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

/* ---------- FÍSICA DE COCHE: la misma para el jugador y los rivales ---------- */
const PHY = { m: 1450, Iz: 2400, a: 1.25, b: 1.45, h: 0.3, g: 9.81, rho: 1.2, ClA: 2.6, kf: 14, kr: 21 };
const MU = 1.6;                                    // agarre del neumático en seco
const C_AERO = 0.5 * PHY.rho * PHY.ClA / PHY.m;    // carga aerodinámica por (m/s)²
const GRIP_BASE = MU;
function carMu(r) { return MU * r.stats.grip * (theme.rain ? 0.8 : 1) * (r.onRoad === false ? 0.6 : 1) * (r.muMul || 1); }
function steerLimit(r) {   // ángulo de volante máximo: a fondo = algo más de lo que permite el agarre
  const v = Math.max(Math.abs(r.vx), 1), mu = carMu(r);
  return Math.min(0.55, Math.atan(WHEELBASE * mu * (PHY.g + C_AERO * v * v) / (v * v)) + 0.075);
}
function initCarState(r) {
  Object.assign(r, { vx: 0, vy: 0, r: 0, axF: 0, ay: 0, steer: 0, drift: 0, slip: 0, boost: false, draft: 0, onRoad: true,
    roll: 0, rollV: 0, pitchB: 0, pitchV: 0, heave: 0, crashCD: 0, stuck: 0, wrong: 0, idx: 0, sLast: 0, base: 0, rough: 0 });
  r.idx = Math.floor(mod(r.prog + S0(), T.L) / DS);
  const s = locate(r); r.sLast = s; r.base = r.prog + S0() - s;
}
function carStep(r, inp, dt) {
  const st = r.stats, go = raceT >= 0, wet = theme.rain ? 0.8 : 1;
  r.onRoad = Math.abs(r.d) < ROAD_W / 2 + KERB_W * 0.7;
  const mu = carMu(r), muR = mu * 1.12;
  // volante con velocidad de giro limitada
  r.steer += clamp(inp.steer * steerLimit(r) - r.steer, -3.2 * dt, 3.2 * dt);
  // nitro
  const wantBoost = go && inp.nitro && r.nitro > 0.05 && inp.throttle > 0.5 && r.vx > 5;
  if (wantBoost && !r.boost && r.isPlayer) { AU.nitro(); vibrate(40); }
  r.boost = wantBoost; if (r.boost) r.nitro = Math.max(0, r.nitro - dt);
  const vtop = st.top / 3.6, Pw = 440e3 * st.acc * (r.powMul || 1) * (r.boost ? 1.45 * st.boost : 1);
  const CdA = 2 * 440e3 * st.acc / (PHY.rho * vtop * vtop * vtop) * (r.draft ? 0.82 : 1);
  const n = 4, h = dt / n, L = WHEELBASE;
  let crash = 0;
  for (let it = 0; it < n; it++) {
    const vx = r.vx, vy = r.vy, w = r.r, down = 0.5 * PHY.rho * PHY.ClA * vx * vx;
    const axT = clamp(r.axF, -10, 8);
    const Fzf = Math.max(800, PHY.m * PHY.g * PHY.b / L + down * 0.45 - PHY.m * axT * PHY.h / L);
    const Fzr = Math.max(800, PHY.m * PHY.g * PHY.a / L + down * 0.55 + PHY.m * axT * PHY.h / L);
    // fuerzas longitudinales pedidas
    let Fxf = 0, Fxr = 0;
    if (go || r.finished) {
      if (inp.brake > 0 && vx > 0.5) { const Fb = inp.brake * mu * (Fzf + Fzr) * 0.95; Fxf = -Fb * 0.6; Fxr = -Fb * 0.4; }
      else if (inp.brake > 0 && vx <= 0.5 && r.isPlayer) Fxr = -PHY.m * 4;               // marcha atrás
      else if (inp.throttle > 0) { const tcs = (r.slipR || 0) > 0.07 ? clamp(1 - ((r.slipR || 0) - 0.07) * 12, 0.25, 1) : 1; const Fd = inp.throttle * tcs * Math.min(Pw / Math.max(vx, 6), PHY.m * 8.5 * st.acc * (r.boost ? 1.3 : 1)); Fxf = Fd * 0.4; Fxr = Fd * 0.6; }
      else Fxr = -Math.sign(vx) * 800;                                                    // freno motor
    } else if (Math.abs(vx) > 0.05) Fxr = -Math.sign(vx) * PHY.m * 6;
    // fuerzas laterales: curva suave (agarre progresivo, sin latigazos)
    let Fyf = 0, Fyr = 0;
    const slow = Math.abs(vx) < 4;
    if (!slow) {
      const af = r.steer - Math.atan2(vy + PHY.a * w, Math.abs(vx)), ar = -Math.atan2(vy - PHY.b * w, Math.abs(vx));
      Fyf = mu * Fzf * Math.tanh(PHY.kf * af); Fyr = muR * Fzr * Math.tanh(PHY.kr * ar);
      r.slipA = Math.max(Math.abs(af), Math.abs(ar)); r.slipR = Math.abs(ar);
    } else r.slipA = 0;
    // círculo de fricción: ABS y control de tracción
    const remF = Math.sqrt(Math.max((0.3 * mu * Fzf) ** 2, (mu * Fzf) ** 2 - Fyf * Fyf)), remR = Math.sqrt(Math.max((0.3 * muR * Fzr) ** 2, (muR * Fzr) ** 2 - Fyr * Fyr));
    Fxf = clamp(Fxf, -remF, remF); Fxr = clamp(Fxr, -remR, remR);
    const cF = Math.sqrt(Math.max(0, (mu * Fzf) ** 2 - Fxf * Fxf)), cR = Math.sqrt(Math.max(0, (muR * Fzr) ** 2 - Fxr * Fxr));
    Fyf = clamp(Fyf, -cF, cF); Fyr = clamp(Fyr, -cR, cR);
    const av = Math.abs(vx);
    const res = Math.sign(vx) * (0.5 * PHY.rho * CdA * vx * vx + 160 + (r.onRoad ? 0 : PHY.m * (2.2 * Math.min(1, av / 5) + av * 0.25)));
    const cs = Math.cos(r.steer), sn = Math.sin(r.steer);
    if (slow) {   // a poca velocidad, giro geométrico
      const ax = (Fxf * cs + Fxr - res) / PHY.m;
      r.vx += ax * h; r.r = r.vx * Math.tan(r.steer) / L; r.vy *= 0.85; r.axF = lerp(r.axF, ax, 0.1); r.ay = lerp(r.ay, r.vx * r.r, 0.2);
    } else {
      const ax = (Fxf * cs - Fyf * sn + Fxr - res) / PHY.m + vy * w;
      const ay = (Fyf * cs + Fxf * sn + Fyr) / PHY.m - vx * w;
      let dr = (PHY.a * (Fyf * cs + Fxf * sn) - PHY.b * Fyr) / PHY.Iz;
      const beta = Math.atan2(vy, av);
      if (beta * w < 0 && Math.abs(beta) > 0.06) dr -= Math.sign(w) * 40 * (Math.abs(beta) - 0.06);   // control de estabilidad
      dr -= w * 0.25;
      r.vx += ax * h; r.vy += ay * h; r.r += dr * h;
      r.axF = lerp(r.axF, ax - vy * w, 0.05); r.ay = lerp(r.ay, ay + vx * w, 0.2);
    }
    if (r.vx < -9) r.vx = -9;
    if (!(go || r.finished) && Math.abs(r.vx) < 0.2) { r.vx = 0; r.vy = 0; r.r = 0; }
    r.yaw -= r.r * h;
    const fx = Math.cos(r.yaw), fz = -Math.sin(r.yaw), rx = Math.sin(r.yaw), rz = Math.cos(r.yaw);
    r.x += (fx * r.vx + rx * r.vy) * h; r.z += (fz * r.vx + rz * r.vy) * h;
    updateProgress(r);
    // muros: rebote con el vector velocidad
    const ii = r.idx, wl = (r.d > 0 ? T.wallR[ii] : T.wallL[ii]) - 1.05;
    if (Math.abs(r.d) > wl) {
      const sd = Math.sign(r.d), ov = Math.abs(r.d) - wl, nx = -T.tz[ii] * sd, nz = T.tx[ii] * sd;
      r.x -= nx * ov; r.z -= nz * ov; r.d = sd * wl;
      let Vx = fx * r.vx + rx * r.vy, Vz = fz * r.vx + rz * r.vy;
      const vn = Vx * nx + Vz * nz;
      if (vn > 0) {
        Vx -= 1.25 * vn * nx; Vz -= 1.25 * vn * nz;
        const tf = 1 - Math.min(0.3, vn * 0.02); Vx *= tf; Vz *= tf;
        r.vx = Vx * fx + Vz * fz; r.vy = Vx * rx + Vz * rz;
        if (vn > 3) { r.r = r.r * 0.5 - sd * vn * 0.04; }
        crash = Math.max(crash, vn); r.wallSide = sd;
      }
    }
  }
  r.v = Math.hypot(r.vx, r.vy);
  r.drift = r.vx > 12 ? Math.atan2(r.vy, r.vx) : 0;
  r.slip = clamp(((r.slipA || 0) - 0.08) * 6, 0, 1);
  const a0 = r.idx, a1 = (a0 + 1) % T.N;
  r.y = T.py[a0] + (T.py[a1] - T.py[a0]) * clamp((r.sLast - a0 * DS) / DS, 0, 1);
  r.pitch = Math.atan((T.py[a1] - T.py[mod(a0 - 1, T.N)]) / (2 * DS));
  r.rough = !r.onRoad ? 1 : (Math.abs(r.d) > ROAD_W / 2 - 0.3 ? 0.4 : 0);
  r.brk = inp.brake > 0 && r.vx > 1;
  r.latA = r.ay;
  r.lonA = r.axF;
  return crash;
}

/* ---------- piloto de los rivales: gira, acelera y frena como una persona ---------- */
function aiInputs(r, dt) {
  const go = raceT >= 0, s = r.prog + S0(), v = Math.max(r.vx, 0), idx = r.idx;
  const lim = ROAD_W / 2 - 1.8;
  // trazada ideal + carril propio en recta
  let td = clamp(lineAt(s + 10), -3.6, 3.6) + (r.lane || 0) * (1 - Math.min(1, Math.abs(T.k[idx]) * 250));
  // coche delante en su carril: elegir un lado para adelantar y mantenerlo
  let blocker = null;
  for (const o of racers) { if (o === r) continue; const ds = o.prog - r.prog; if (ds > 0 && ds < 28 && Math.abs(o.d - r.d) < 2.4) { if (!blocker || ds < blocker.ds) blocker = { o, ds }; } }
  let vCap = 999;
  if (blocker && blocker.o.v < v + 3) {
    const o = blocker.o;
    if (r.blk !== o) { r.blk = o; const roomL = (o.d - 3.3) > -lim, roomR = (o.d + 3.3) < lim; r.side = roomL && roomR ? (r.d < o.d ? -1 : 1) : (roomL ? -1 : 1); }
    td = clamp(o.d + r.side * 3.3, -lim, lim);
    if (blocker.ds < 12 && Math.abs(r.d - o.d) < 1.9) vCap = o.v - 1;
    r.blkT = 0;
  } else if (r.blk && (r.blkT = (r.blkT || 0) + dt) > 1.5) r.blk = null;
  r.td = clamp(td, -lim, lim);
  // punto al que mira (persecución pura)
  const Ld = 6 + v * 0.3, P = sampleAt(s + Ld), tdl = clamp(r.td, -lim, lim);
  const tx = P.x - P.tz * tdl, tz = P.z + P.tx * tdl;
  const fx = Math.cos(r.yaw), fz = -Math.sin(r.yaw), rx = Math.sin(r.yaw), rz = Math.cos(r.yaw);
  const dx = tx - r.x, dz = tz - r.z, lx = dx * fx + dz * fz, ly = dx * rx + dz * rz;
  const alpha = Math.atan2(ly, Math.max(lx, 1)), kappa = 2 * Math.sin(alpha) / Ld;
  // persecución + corrección si se separa de su línea
  const delta = Math.atan(WHEELBASE * kappa) + Math.atan2(r.vy, Math.max(v, 5)) * 0.6 + clamp((r.d - r.td) * -0.004, -0.03, 0.03);
  let steer = clamp(delta / steerLimit(r), -1, 1);
  // velocidad: frena a tiempo para las curvas que vienen
  const mu = carMu(r) * 0.82 * (r.planMul || 1) * (theme.rain ? 0.93 : 1);
  let vt = r.stats.top / 3.6 * (r.powMul || 1) * 1.1;
  for (let j = 2; j < 160; j += 2) {
    const k = T.kp[(idx + j) % T.N] + 1e-5, den = k - mu * C_AERO, vc = den <= 1e-6 ? 999 : Math.sqrt(mu * PHY.g / den);
    const dec = mu * (PHY.g + C_AERO * vc * vc) * 0.8;
    vt = Math.min(vt, Math.sqrt(vc * vc + 2 * dec * j * DS));
  }
  vt = Math.min(vt, vCap);
  let throttle = 0, brake = 0;
  if (!go) brake = 1;
  else if (v < vt - 0.3) throttle = clamp((vt - v) / 2, 0.3, 1);
  else if (v > vt + 0.3) brake = clamp((v - vt) / 1.5, 0.5, 1);
  // si va derrapando, suelta gas
  if (Math.abs(r.drift) > 0.15) throttle *= 0.5;
  return { steer, throttle, brake, nitro: false };
}
function playerInputs(p) {
  if (p.finished) { const a = aiInputs(p, 0); a.throttle = Math.min(a.throttle, p.vx < 28 ? 1 : 0); return a; }
  const brake = input.brake ? 1 : 0, gas = save.autoGas ? !input.brake : input.gas;
  return { steer: input.steer, throttle: gas ? 1 : 0, brake, nitro: input.nitro };
}
/* ---------- choques entre coches: impulsos con rebote y giro ---------- */
const CIRC = [-1.55, 0, 1.55], CR = 0.98;
function collideCars() {
  for (let i = 0; i < racers.length; i++) for (let j = i + 1; j < racers.length; j++) {
    const A = racers[i], B = racers[j];
    if (Math.abs(A.x - B.x) > 7 || Math.abs(A.z - B.z) > 7) continue;
    let hit = null;
    const afx = Math.cos(A.yaw), afz = -Math.sin(A.yaw), bfx = Math.cos(B.yaw), bfz = -Math.sin(B.yaw);
    for (const oa of CIRC) for (const ob of CIRC) {
      const ax = A.x + afx * oa, az = A.z + afz * oa, bx = B.x + bfx * ob, bz = B.z + bfz * ob;
      const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz);
      if (d < CR * 2 && (!hit || d < hit.d)) hit = { d, nx: dx / (d || 1), nz: dz / (d || 1), cx: (ax + bx) / 2, cz: (az + bz) / 2 };
    }
    if (!hit) continue;
    const ov = CR * 2 - hit.d;
    A.x -= hit.nx * ov / 2; A.z -= hit.nz * ov / 2; B.x += hit.nx * ov / 2; B.z += hit.nz * ov / 2;
    const vel = c => { const fx = Math.cos(c.yaw), fz = -Math.sin(c.yaw), rx = Math.sin(c.yaw), rz = Math.cos(c.yaw); return [fx * c.vx + rx * c.vy, fz * c.vx + rz * c.vy]; };
    const setVel = (c, Vx, Vz) => { const fx = Math.cos(c.yaw), fz = -Math.sin(c.yaw), rx = Math.sin(c.yaw), rz = Math.cos(c.yaw); c.vx = Vx * fx + Vz * fz; c.vy = Vx * rx + Vz * rz; };
    const [ax, az] = vel(A), [bx, bz] = vel(B);
    const rel = (bx - ax) * hit.nx + (bz - az) * hit.nz;
    if (rel < 0) {
      const jn = -(1 + 0.3) * rel / 2;
      // rozamiento lateral entre carrocerías
      const tx = -hit.nz, tz = hit.nx, relT = (bx - ax) * tx + (bz - az) * tz, jt = clamp(-relT / 2, -jn * 0.3, jn * 0.3);
      const Jx = hit.nx * jn + tx * jt, Jz = hit.nz * jn + tz * jt;
      setVel(A, ax - Jx, az - Jz); setVel(B, bx + Jx, bz + Jz);
      // el golpe hace girar el coche según dónde le den
      const torque = (c, sgn) => { const rxw = hit.cx - c.x, rzw = hit.cz - c.z, ty = rzw * (Jx * sgn) - rxw * (Jz * sgn); c.r -= ty * PHY.m / PHY.Iz * 0.6; };
      torque(A, -1); torque(B, 1);
      const pl = A.isPlayer ? A : B.isPlayer ? B : null;
      if (pl && pl.crashCD <= 0 && -rel > 1.5) { AU.bump(); vibrate(Math.min(150, 30 - rel * 8)); shake = Math.min(1, -rel / 10); pl.crashCD = 0.3; }
    }
  }
}
function respawn(p) {
  const s = sampleAt(p.prog + S0());
  p.x = s.x; p.z = s.z; p.yaw = headingOf(s.tx, s.tz); p.v = p.vx = p.vy = p.r = 0; p.steer = 0; p.stuck = 0; p.wrong = 0; p.drift = 0; p.d = 0; p.axF = 0;
  if (p.isPlayer) showMsg('RECOLOCADO', '#ffffff', 1.2);
}
/* ---------- un paso de simulación para todos los coches ---------- */
function physicsStep(dt) {
  const go = raceT >= 0;
  for (const r of racers) {
    // rebufo: coche delante y cerca
    r.draft = 0;
    for (const o of racers) { if (o === r) continue; const ds = o.prog - r.prog; if (ds > 5 && ds < 32 && Math.abs(o.d - r.d) < 1.7) { r.draft = 1; break; } }
    const inp = r.isPlayer ? playerInputs(r) : aiInputs(r, dt);
    r.inp = inp;
    const crash = carStep(r, inp, dt);
    r.crashCD -= dt;
    if (r.isPlayer && crash > 0 && r.crashCD <= 0) {
      if (crash > 6) { AU.crash(); vibrate(160); shake = Math.min(1, crash / 15); r.crashCD = 0.5; sparks(r, r.wallSide); }
      else { AU.bump(); r.crashCD = 0.25; }
    }
    // atasco o sentido contrario: recolocar
    const rel = Math.abs(angDiff(headingOf(T.tx[r.idx], T.tz[r.idx]), r.yaw));
    r.wrong = rel > 1.9 && r.v > 4 ? r.wrong + dt : 0;
    r.stuck = go && !r.finished && r.v < 3 && (Math.abs(r.d) > ROAD_W / 2 || rel > 1.0 || !r.isPlayer) ? r.stuck + dt : 0;
    if (r.stuck > (r.isPlayer ? 3 : 2) || r.wrong > 3) respawn(r);
    // nitro: derrapar y rebufo lo recargan
    if (r.isPlayer && go && !r.finished) {
      const st = r.stats;
      if (Math.abs(r.drift) > 0.09 && r.vx > 18) { r.nitro = Math.min(st.nitro, r.nitro + dt * 0.5 * Math.min(1, Math.abs(r.drift) / 0.22)); if (!r.driftMsg) { r.driftMsg = 1; showMsg('¡DERRAPE! +NITRO', '#7fe8ff', 0.9); } } else r.driftMsg = 0;
      if (r.draft) r.nitro = Math.min(st.nitro, r.nitro + dt * 0.18);
      if (!r.boost) r.nitro = Math.min(st.nitro, r.nitro + dt * 0.035);
    }
    // ajuste suave de ritmo de los rivales según la distancia contigo
    if (!r.isPlayer && player && player.isPlayer && !player.finished) {
      const gap = r.prog - player.prog, f = gap > 80 ? 0.97 : gap < -120 ? 1.03 : 1;
      r.powMul = damp(r.powMul || 1, (r.basePow || 1) * f, 0.5, dt);
    }
    if (!r.finished && r.prog >= r.lap * T.L) {
      if (r.isPlayer) {
        const lt = raceT - r.lapStart; r.lapTimes.push(lt); r.lapStart = raceT; r.lap++;
        if (mode === 'trial') ghostLap(lt);
        if (r.lap > track.laps) { r.finished = true; r.time = raceT; finishRace(); }
        else { AU.lap(); showMsg(r.lap === track.laps ? '¡VUELTA FINAL!' : 'VUELTA ' + r.lap, '#ffd24a', 1.8); }
      } else { r.lap++; if (r.lap > track.laps) { r.finished = true; r.time = raceT; } }
    }
  }
  collideCars();
  if (mode === 'trial' && ghostRec && go && player.isPlayer) recordGhost();
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
  const st = p.stats, wet = theme.rain ? 0.8 : 1, mu = GRIP_BASE * st.grip * wet * 0.88, c = 0.5 * PHY.rho * PHY.ClA / PHY.m, g0 = PHY.g;
  const v = Math.max(0, p.vx), decMax = 1.4 * wet * (g0 + c * v * v) * 0.85;
  const s0 = p.prog + S0(), range = 60 + v * 3.4, step = 4, n = Math.min(guide.n, Math.floor(range / step));
  const pos = guide.m.geometry.attributes.position.array, col = guide.m.geometry.attributes.color.array;
  const vcAt = kk => { const den = kk - mu * c; return den <= 1e-6 ? 999 : Math.sqrt(mu * g0 / den); };
  const ratio = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const sa = s0 + 6 + k * step;
    let kk = 0; for (let q = 0; q < 3; q++) kk = Math.max(kk, T.kp[Math.floor(mod(sa + q * 2, T.L) / DS) % T.N]);
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

/* ---------- colocar los coches: suspensión con muelle y amortiguador ---------- */
function poseCar(r, dt) {
  const c = r.car, u = c.userData;
  c.position.set(r.x, r.y, r.z);
  c.rotation.set(0, r.yaw, r.pitch || 0);
  // balanceo en curva y cabeceo al frenar/acelerar, con su pequeño rebote
  const rollT = clamp(-(r.latA || 0) * 0.0032, -0.065, 0.065), pitchT = clamp((r.lonA || 0) * 0.0024, -0.05, 0.03);
  const k = 70, cdamp = 9, h = Math.min(dt, 0.05);
  r.rollV = (r.rollV || 0) + ((rollT - (r.roll || 0)) * k - (r.rollV || 0) * cdamp) * h; r.roll = (r.roll || 0) + r.rollV * h;
  r.pitchV = (r.pitchV || 0) + ((pitchT - (r.pitchB || 0)) * k - (r.pitchV || 0) * cdamp) * h; r.pitchB = (r.pitchB || 0) + r.pitchV * h;
  u.body.rotation.x = r.roll; u.body.rotation.z = r.pitchB; u.body.rotation.y = 0;
  // vibración del asfalto / la hierba
  const bump = (r.rough > 0.5 ? 0.025 : 0.004) * Math.min(1, (r.v || 0) / 30);
  u.body.position.y = 0.02 * Math.min(1, Math.abs(r.lonA || 0) / 20) * (r.lonA < 0 ? -1 : 0.5) + (Math.random() - 0.5) * bump;
  const vx = r.vx !== undefined ? r.vx : r.v;
  for (const w of u.wheels) { w.spin.rotation.z -= vx * dt / 0.37; if (w.front) w.pivot.rotation.y = -(r.steer || 0) * 1.6; }
  setBrake(c, r.brk, theme.night);
}

/* ---------- cámara de retransmisión ---------- */
const _v = new THREE.Vector3();
let camH = 0, camBob = 0;
function updateCamera(dt, r, cine) {
  const fx = Math.cos(r.yaw), fz = -Math.sin(r.yaw);
  if (cine) { // cámara de exhibición en los menús
    const a = stateT * 0.18;
    _v.set(r.x + Math.cos(a) * 11, r.y + 3.2 + Math.sin(stateT * 0.3) * 0.8, r.z + Math.sin(a) * 11);
    camPos.lerp(_v, camInit ? 1 - Math.exp(-dt * 3) : 1); camInit = true;
    camera.position.copy(camPos); camera.lookAt(r.x, r.y + 0.8, r.z);
    camera.fov = 50; camera.updateProjectionMatrix(); return;
  }
  const v = r.v || 0, beta = r.vx > 5 ? Math.atan2(r.vy || 0, r.vx) : 0;
  // la cámara sigue la dirección en la que se mueve el coche, con retraso: así se ve girar y derrapar
  const target = r.yaw - beta * 0.75;
  camYaw = camInit ? camYaw + angDiff(camYaw, target) * (1 - Math.exp(-dt * 4.5)) : target;
  const cfx = Math.cos(camYaw), cfz = -Math.sin(camYaw), modeC = save.cam;
  let back = 5.4 + v * 0.018, up = 1.65 + v * 0.003, ahead = 4, lookUp = 1.05;
  if (modeC === 1) { back = 8.5 + v * 0.02; up = 3.0; ahead = 6; lookUp = 1.2; }
  if (modeC === 2) { back = -0.55; up = 1.18; ahead = 30; lookUp = 1.0; }
  camH = camInit ? damp(camH, r.y, 6, dt) : r.y;
  _v.set(r.x - cfx * back, camH + up, r.z - cfz * back);
  if (modeC === 2) camPos.copy(_v).setY(r.y + up);
  else camPos.lerp(_v, camInit ? 1 - Math.exp(-dt * 9) : 1);
  camInit = true;
  camLook.set(r.x + fx * ahead, r.y + lookUp, r.z + fz * ahead);
  camera.position.copy(camPos);
  // vibración: baches según velocidad, más fuerte fuera de pista y en choques
  camBob += dt * (8 + v * 0.4);
  const vib = Math.min(1, v / 80) * 0.012 + (r.rough > 0.5 ? 0.05 : 0) * Math.min(1, v / 20);
  camera.position.y += Math.sin(camBob) * vib + (Math.random() - 0.5) * vib;
  if (shake > 0) camera.position.add(_v.set((Math.random() - 0.5) * shake * 0.35, (Math.random() - 0.5) * shake * 0.25, (Math.random() - 0.5) * shake * 0.35));
  camera.lookAt(camLook);
  camera.rotation.z += (modeC === 2 ? (r.roll || 0) * 0.8 : (r.roll || 0) * 0.35) + clamp(-(r.latA || 0) * 0.0006, -0.02, 0.02);
  const fov = 60 + Math.min(v, 100) * 0.14 + (r.boost ? 7 : 0);
  camera.fov = damp(camera.fov, fov, 3, dt); camera.updateProjectionMatrix();
  updateLamps(r.x, r.z);
  if (headLight && headLight.visible) { headLight.position.set(r.x + fx * 1.5, r.y + 1.1, r.z + fz * 1.5); headLight.target.position.set(r.x + fx * 40, r.y, r.z + fz * 40); }
  if (window.__camOverride) { const o = window.__camOverride; camera.position.set(o.p[0], o.p[1], o.p[2]); if (o.top) camera.up.set(0, 0, -1); camera.lookAt(o.l[0], o.l[1], o.l[2]); camera.up.set(0, 1, 0); camera.fov = o.fov || 50; camera.updateProjectionMatrix(); }
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
  physicsStep(dt);
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

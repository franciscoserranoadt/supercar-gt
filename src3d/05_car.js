/* ===== COCHES 3D generados por código ===== */
const MAT = {};
function baseMats() {
  if (MAT.glass) return MAT;
  MAT.glass = new THREE.MeshPhysicalMaterial({ color: '#0b0f15', metalness: 0.1, roughness: 0.04, clearcoat: 1, envMapIntensity: 1.6 });
  MAT.black = new THREE.MeshStandardMaterial({ color: '#101010', roughness: 0.55, metalness: 0.2 });
  const cc = mkCanvas(64, 64), cg = cc.getContext('2d');
  for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) { cg.fillStyle = (x + y) % 2 ? '#1c1c1c' : '#2e2e2e'; cg.fillRect(x * 8, y * 8, 8, 8); }
  const ct = new THREE.CanvasTexture(cc); ct.wrapS = ct.wrapT = THREE.RepeatWrapping; ct.repeat.set(4, 4); ct.colorSpace = THREE.SRGBColorSpace;
  MAT.carbon = new THREE.MeshStandardMaterial({ map: ct, roughness: 0.35, metalness: 0.4 });
  MAT.rubber = new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.92 });
  MAT.rim = new THREE.MeshStandardMaterial({ color: '#c8ccd2', metalness: 1, roughness: 0.22 });
  MAT.rimDark = new THREE.MeshStandardMaterial({ color: '#2a2c30', metalness: 0.9, roughness: 0.3 });
  MAT.chrome = new THREE.MeshStandardMaterial({ color: '#e8e8e8', metalness: 1, roughness: 0.08 });
  MAT.head = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#e8f2ff', emissiveIntensity: 1.6, roughness: 0.2 });
  MAT.caliper = new THREE.MeshStandardMaterial({ color: '#d4141c', roughness: 0.5 });
  const pc = mkCanvas(256, 56), pg = pc.getContext('2d');
  pg.fillStyle = '#f4f4f0'; pg.fillRect(0, 0, 256, 56); pg.fillStyle = '#1d4fb8'; pg.fillRect(0, 0, 26, 56);
  pg.fillStyle = '#111'; pg.font = '700 38px system-ui, sans-serif'; pg.textAlign = 'center'; pg.textBaseline = 'middle'; pg.fillText('2026 GPX', 141, 30);
  const pt = new THREE.CanvasTexture(pc); pt.colorSpace = THREE.SRGBColorSpace;
  MAT.plate = new THREE.MeshStandardMaterial({ map: pt, roughness: 0.5 });
  MAT.blob = new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  return MAT;
}
const paintCache = {};
function paintMat(color) {
  return paintCache[color] || (paintCache[color] = new THREE.MeshPhysicalMaterial({ color, metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }));
}
// une varias piezas con el mismo material en una sola malla (menos trabajo para el móvil)
function mergeParts(parts) {
  let n = 0; for (const p of parts) n += (p.g.index ? p.g.index.count : p.g.attributes.position.count);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const p of parts) {
    const g = (p.g.index ? p.g.toNonIndexed() : p.g.clone()); g.applyMatrix4(p.m);
    const P = g.attributes.position, Nn = g.attributes.normal, U = g.attributes.uv;
    pos.set(P.array, o * 3); if (Nn) nor.set(Nn.array, o * 3); if (U) uv.set(U.array, o * 2);
    o += P.count; g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
const carGeoCache = {};
function carGeometry(m) {
  if (carGeoCache[m]) return carGeoCache[m];
  const st = CARS[m].st, L = st.len, hL = L / 2, Wd = st.wid, nose = st.nose, roof = st.roof;
  const rx = -hL + 1.08, fx = hL - 1.2, wr = 0.37, bs = st.angular ? 0.06 : 0.1, xr = -hL - bs, xf = hL + bs;
  const parts = { paint: [], glass: [], black: [], carbon: [], chrome: [], head: [], plate: [], light: [] };
  const M = (x, y, z, ry, rz, rxx) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rxx || 0, ry || 0, rz || 0)), new THREE.Vector3(1, 1, 1));
  const add = (k, g, m) => parts[k].push({ g, m: m || new THREE.Matrix4() });
  // perfil lateral de la carrocería con pasos de rueda
  const s = new THREE.Shape(), q = st.angular;
  s.moveTo(-hL + 0.12, 0.22);
  s.lineTo(rx - 0.52, 0.22); s.lineTo(rx - 0.52, 0.36); s.absarc(rx, 0.36, 0.52, Math.PI, 0, true); s.lineTo(rx + 0.52, 0.22);
  s.lineTo(fx - 0.5, 0.22); s.lineTo(fx - 0.5, 0.36); s.absarc(fx, 0.36, 0.5, Math.PI, 0, true); s.lineTo(fx + 0.5, 0.22);
  s.lineTo(hL - 0.12, 0.24);
  if (q) { s.lineTo(hL, nose - 0.06); s.lineTo(hL - 0.06, nose + 0.04); s.lineTo(hL - 0.9, nose + 0.2); s.lineTo(0.72, 0.78); s.lineTo(-0.5, 0.84); s.lineTo(-hL + 0.45, 0.79); s.lineTo(-hL + 0.02, 0.76); s.lineTo(-hL - 0.02, 0.48); }
  else { s.quadraticCurveTo(hL + 0.04, 0.26, hL, nose - 0.04); s.quadraticCurveTo(hL - 0.02, nose + 0.06, hL - 0.25, nose + 0.08); s.quadraticCurveTo(hL - 1.0, nose + 0.24, 0.72, 0.78); s.quadraticCurveTo(0.0, 0.86, -0.6, 0.86); s.quadraticCurveTo(-hL + 0.4, 0.85, -hL + 0.04, 0.77); s.quadraticCurveTo(-hL - 0.06, 0.64, -hL - 0.02, 0.46); }
  s.lineTo(-hL + 0.03, 0.3); s.lineTo(-hL + 0.12, 0.22);
  const depth = Wd - 0.26;
  const body = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.13, bevelSize: bs, bevelSegments: q ? 2 : 5, curveSegments: 14 });
  body.translate(0, 0, -depth / 2);
  add('paint', body);
  // habitáculo (cristal)
  const c = new THREE.Shape();
  c.moveTo(0.8, 0.74); c.lineTo(0.64, 0.8);
  if (q) { c.lineTo(-0.05, roof); c.lineTo(-0.75, roof - 0.03); c.lineTo(-hL + 0.95, 0.82); }
  else { c.quadraticCurveTo(0.2, roof + 0.02, -0.15, roof); c.quadraticCurveTo(-0.8, roof - 0.01, -hL + 0.95, 0.82); }
  c.lineTo(-hL + 0.95, 0.74); c.lineTo(0.8, 0.74);
  const cd = Wd * 0.6;
  const cab = new THREE.ExtrudeGeometry(c, { depth: cd, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.1, bevelSegments: 4, curveSegments: 12 });
  cab.translate(0, 0, -cd / 2); add('glass', cab);
  // techo pintado
  const r = new THREE.Shape(); r.moveTo(0.15, roof + 0.005); r.lineTo(-0.7, roof - 0.02); r.lineTo(-0.7, roof - 0.07); r.lineTo(0.15, roof - 0.05);
  const rd = cd * 0.92, rg = new THREE.ExtrudeGeometry(r, { depth: rd, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.05, bevelSegments: 3 });
  rg.translate(0, 0.045, -rd / 2); add('paint', rg);
  // tomas de aire laterales, retrovisores
  for (const sd of [-1, 1]) {
    add('black', new THREE.BoxGeometry(0.7, 0.16, 0.05), M(-0.55, 0.55, sd * (Wd / 2 - 0.035)));
    add('paint', new THREE.BoxGeometry(0.16, 0.11, 0.24), M(0.5, 0.9, sd * (cd / 2 + 0.3)));
    add('black', new THREE.BoxGeometry(0.06, 0.04, 0.2), M(0.52, 0.84, sd * (cd / 2 + 0.17)));
  }
  // trasera: difusor, rejilla, escapes, matrícula
  add('carbon', new THREE.BoxGeometry(0.5, 0.14, Wd * 0.84), M(xr + 0.2, 0.25, 0));
  for (let f = -3; f <= 3; f++) add('carbon', new THREE.BoxGeometry(0.45, 0.18, 0.025), M(xr + 0.18, 0.3, f * Wd * 0.11));
  add('black', new THREE.BoxGeometry(0.06, 0.2, Wd * 0.72), M(xr - 0.005, 0.44, 0));
  add('plate', new THREE.PlaneGeometry(0.52, 0.11).rotateY(-Math.PI / 2), M(xr - 0.04, 0.45, 0));
  const ex = st.exh === 'quad' ? [-0.3, -0.18, 0.18, 0.3] : st.exh === 'twin' ? [-0.6, 0.6] : [-0.08, 0.08];
  for (const e of ex) add('chrome', new THREE.CylinderGeometry(0.055, 0.055, 0.22, 14, 1, true).rotateZ(Math.PI / 2), M(xr - 0.06, 0.32, e));
  // pilotos traseros
  const lz = Wd / 2 - 0.25;
  if (st.lights === 'strip') { add('light', new THREE.BoxGeometry(0.05, 0.055, Wd * 0.86), M(xr, 0.64, 0)); }
  else if (st.lights === 'quad') { for (const z of [-lz, -lz + 0.22, lz - 0.22, lz]) add('light', new THREE.CylinderGeometry(0.075, 0.075, 0.05, 18).rotateZ(Math.PI / 2), M(xr, 0.62, z)); }
  else if (st.lights === 'ring') { for (const z of [-lz + 0.05, lz - 0.05]) add('light', new THREE.TorusGeometry(0.095, 0.022, 8, 22).rotateY(Math.PI / 2), M(xr - 0.01, 0.62, z)); }
  else { for (const sd of [-1, 1]) { add('light', new THREE.BoxGeometry(0.05, 0.045, 0.5), M(xr, 0.66, sd * (lz - 0.12), sd * 0.12)); add('light', new THREE.BoxGeometry(0.05, 0.035, 0.28), M(xr, 0.58, sd * (lz - 0.05))); } }
  add('light', new THREE.BoxGeometry(0.03, 0.025, 0.36), M(-0.78, roof - 0.04, 0));
  // faros delanteros
  for (const sd of [-1, 1]) add('head', new THREE.BoxGeometry(0.32, 0.05, 0.42), M(xf - 0.28, nose + 0.08 + bs * 0.5, sd * (Wd / 2 - 0.33), sd * -0.12, -0.18));
  add('black', new THREE.BoxGeometry(0.1, 0.18, Wd * 0.55), M(xf - 0.02, 0.33, 0));
  // alerón
  if (st.wing) {
    add('carbon', new THREE.BoxGeometry(0.36, 0.045, Wd * 0.96), M(-hL + 0.28, 1.12, 0, 0, 0.06));
    for (const sd of [-1, 1]) { add('carbon', new THREE.BoxGeometry(0.07, 0.36, 0.04), M(-hL + 0.32, 0.94, sd * 0.45)); add('paint', new THREE.BoxGeometry(0.42, 0.18, 0.025), M(-hL + 0.28, 1.12, sd * Wd * 0.48)); }
  } else add('carbon', new THREE.BoxGeometry(0.2, 0.03, Wd * 0.8), M(xr + 0.1, 0.8, 0, 0, 0.12));
  const out = {};
  for (const k in parts) if (parts[k].length) out[k] = mergeParts(parts[k]);
  out.wheel = { rx, fx, r: wr, z: Wd / 2 - 0.2 };
  out.tire = new THREE.CylinderGeometry(wr, wr, 0.3, 26).rotateX(Math.PI / 2);
  const rim = [{ g: new THREE.CylinderGeometry(wr * 0.68, wr * 0.68, 0.06, 22).rotateX(Math.PI / 2), m: new THREE.Matrix4().makeTranslation(0, 0, 0.13) }];
  for (let k = 0; k < 5; k++) rim.push({ g: new THREE.BoxGeometry(0.05, wr * 1.25, 0.04), m: new THREE.Matrix4().makeRotationZ(k * Math.PI * 2 / 5).setPosition(0, 0, 0.165) });
  rim.push({ g: new THREE.CylinderGeometry(0.06, 0.06, 0.06, 10).rotateX(Math.PI / 2), m: new THREE.Matrix4().makeTranslation(0, 0, 0.17) });
  out.rim = mergeParts(rim);
  out.caliper = new THREE.BoxGeometry(0.16, 0.22, 0.06).translate(0.16, 0.14, 0.11);
  return (carGeoCache[m] = out);
}
function buildCar(m, color, opts) {
  baseMats();
  const G = carGeometry(m), car = new THREE.Group(), body = new THREE.Group(); car.add(body);
  const lightMat = new THREE.MeshStandardMaterial({ color: '#5a0006', emissive: '#ff1010', emissiveIntensity: 1.2, roughness: 0.3 });
  const mats = { paint: paintMat(color), glass: MAT.glass, black: MAT.black, carbon: MAT.carbon, chrome: MAT.chrome, head: MAT.head, plate: MAT.plate, light: lightMat };
  for (const k in mats) if (G[k]) { const me = new THREE.Mesh(G[k], mats[k]); me.castShadow = k !== 'light' && k !== 'plate' && k !== 'head'; me.receiveShadow = k === 'paint'; body.add(me); }
  const wheels = [], dark = CARS[m].st.angular;
  for (const [x, front] of [[G.wheel.rx, false], [G.wheel.fx, true]]) for (const sd of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(x, G.wheel.r, sd * G.wheel.z);
    const spin = new THREE.Group(); pivot.add(spin);
    const t = new THREE.Mesh(G.tire, MAT.rubber); t.castShadow = true; spin.add(t);
    const rm = new THREE.Mesh(G.rim, dark ? MAT.rimDark : MAT.rim); if (sd < 0) rm.rotation.y = Math.PI; spin.add(rm);
    const cal = new THREE.Mesh(G.caliper, MAT.caliper); if (sd < 0) cal.rotation.y = Math.PI; pivot.add(cal);
    car.add(pivot); wheels.push({ pivot, spin, front });
  }
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(CARS[m].st.len + 0.9, CARS[m].st.wid + 0.8).rotateX(-Math.PI / 2), MAT.blob);
  blob.position.y = 0.04; blob.renderOrder = 1; car.add(blob);
  car.userData = { body, wheels, lightMat, m };
  return car;
}
function setBrake(car, on, night) { car.userData.lightMat.emissiveIntensity = on ? 5 : (night ? 2 : 1.2); }

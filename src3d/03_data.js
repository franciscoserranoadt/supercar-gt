/* ===== DATOS: coches, circuitos y ambientes ===== */
const PAINT = ['#c8101a', '#f2f2f2', '#f5c400', '#1d5fe0', '#9aa4ae', '#141414', '#ff4fa3', '#14934a', '#ff7a00', '#6b2cff'];
// top: km/h · acc: aceleración · grip: agarre en curva · nitro: segundos
const CARS = [
  { name: 'Rosso Furia',  tag: 'V12 italiano',           top: 318, acc: 1.00, grip: 1.00, nitro: 3.0, price: 0,     paint: 0,
    st: { len: 4.55, wid: 1.98, roof: 1.18, nose: 0.42, wing: false, lights: 'quad',  angular: false, exh: 'quad' } },
  { name: 'Toro Veleno',  tag: 'V10 de ataque',          top: 330, acc: 1.06, grip: 0.97, nitro: 3.2, price: 3000,  paint: 2,
    st: { len: 4.6, wid: 2.03, roof: 1.12, nose: 0.36, wing: false, lights: 'slash', angular: true,  exh: 'center' } },
  { name: 'Silber Pfeil', tag: 'GT alemán',              top: 314, acc: 1.10, grip: 1.10, nitro: 3.4, price: 5500,  paint: 4,
    st: { len: 4.5, wid: 1.96, roof: 1.27, nose: 0.48, wing: true,  lights: 'strip', angular: false, exh: 'twin' } },
  { name: 'Blue Vortex',  tag: 'Biturbo británico',      top: 334, acc: 1.16, grip: 1.06, nitro: 3.7, price: 8500,  paint: 3,
    st: { len: 4.6, wid: 1.99, roof: 1.17, nose: 0.4, wing: false, lights: 'ring',  angular: false, exh: 'twin' } },
  { name: 'Nero Hyper',   tag: 'Hiperdeportivo híbrido', top: 350, acc: 1.24, grip: 1.14, nitro: 4.2, price: 13000, paint: 5,
    st: { len: 4.75, wid: 2.06, roof: 1.12, nose: 0.36, wing: true,  lights: 'strip', angular: true,  exh: 'center' } },
  { name: 'Piruleta GT',  tag: 'Edición La Piruleta',    top: 362, acc: 1.3, grip: 1.2, nitro: 5.0, price: 20000, paint: 6,
    st: { len: 4.7, wid: 2.04, roof: 1.15, nose: 0.38, wing: true,  lights: 'ring',  angular: false, exh: 'quad' } }
];
const UPG = [
  { key: 'motor', name: 'Motor', desc: '+velocidad y aceleración' },
  { key: 'grip', name: 'Neumáticos', desc: '+agarre en curva' },
  { key: 'nitro', name: 'Nitro', desc: '+duración y empuje' }
];
function upLevel(m, k) { return ((save.up[m] || {})[k]) || 0; }
function upCost(m, k) { return Math.round((1200 + CARS[m].price * 0.18) * (upLevel(m, k) + 1) / 100) * 100; }
function carStats(m, lv) {
  const c = CARS[m], L = lv || { motor: upLevel(m, 'motor'), grip: upLevel(m, 'grip'), nitro: upLevel(m, 'nitro') };
  return { top: c.top * (1 + 0.025 * L.motor), acc: c.acc * (1 + 0.06 * L.motor), grip: c.grip * (1 + 0.045 * L.grip), nitro: c.nitro * (1 + 0.15 * L.nitro), boost: 1 + 0.06 * L.nitro };
}
const RIVAL_NAMES = ['L. Vega', 'M. Bellini', 'K. Sato', 'A. Ruiz', 'T. Becker', 'É. Moreau', 'D. Paz', 'S. Lund', 'R. Costa', 'J. Hart', 'N. Silva', 'P. Novak'];

const THEMES = {
  park:   { sky: ['#1f6fd1', '#b9e1ff'], sun: { dir: [0.5, 0.8, 0.35], c: '#fff6e0', i: 2.6 }, hemi: ['#cfe8ff', '#4d7a33', 0.9],
            fog: ['#bfe0f5', 250, 2600], grass: '#4f8f30', grass2: '#5d9e39', mount: '#6f8fae', trees: ['pine', 'round'], wall: 'armco', gap: 11, exposure: 1.0 },
  coast:  { sky: ['#2b86e0', '#cfefff'], sun: { dir: [-0.4, 0.75, 0.5], c: '#fff8e8', i: 2.7 }, hemi: ['#d8efff', '#9b8f7a', 0.95],
            fog: ['#cdeaff', 300, 2800], grass: '#b9b1a1', grass2: '#c4bcad', mount: '#6f9a72', trees: ['palm'], wall: 'tecpro', gap: 3.2, buildings: 'pastel', sea: true, exposure: 1.0 },
  sakura: { sky: ['#30205e', '#ff9a6a'], sun: { dir: [-0.75, 0.22, 0.4], c: '#ffb070', i: 2.4 }, hemi: ['#ffc8a8', '#3c5a3a', 0.8],
            fog: ['#f2a27c', 200, 2300], grass: '#4d8a3a', grass2: '#57954a', mount: '#6a5a8c', trees: ['cherry', 'pine'], wall: 'armco', gap: 10, fuji: true, exposure: 1.05 },
  rain:   { sky: ['#4e5964', '#9aa5ae'], sun: { dir: [0.3, 0.9, 0.3], c: '#dfe6ee', i: 1.1 }, hemi: ['#b7c3cf', '#2f4a33', 1.1],
            fog: ['#97a2ab', 90, 1300], grass: '#3a7032', grass2: '#427a39', mount: '#56705f', trees: ['pine'], wall: 'armco', gap: 8, rain: true, exposure: 1.0 },
  neon:   { sky: ['#03020a', '#24104a'], sun: { dir: [0.3, 0.7, -0.5], c: '#8fa0ff', i: 0.35 }, hemi: ['#3a2a6a', '#0c0c14', 0.55],
            fog: ['#1b0d38', 150, 1800], grass: '#18171f', grass2: '#1c1b24', mount: '#140c2a', trees: [], wall: 'tecpro', gap: 4, buildings: 'neon', night: true, exposure: 1.15 },
  dry:    { sky: ['#3a92de', '#ffe2ad'], sun: { dir: [0.35, 0.85, -0.3], c: '#fff1d6', i: 2.8 }, hemi: ['#ffe9c4', '#9a7a42', 0.9],
            fog: ['#f3dcb0', 250, 2600], grass: '#b49456', grass2: '#bf9f60', mount: '#b47a4c', trees: ['olive', 'bush'], wall: 'armco', gap: 12, exposure: 1.0 }
};

// Forma del circuito vista desde arriba (sentido de la marcha), longitud en metros y lomas [inicio, largo, altura m]
const TRACKS = [
  { name: 'Monza', country: 'Italia', theme: 'park', laps: 3, len: 3400,
    shape: [[0,0],[560,0],[600,8],[625,-8],[660,0],[800,10],[900,50],[970,120],[1010,220],[1020,300],[1034,318],[1012,338],[1030,358],[1042,420],[1020,470],[975,500],[900,520],[760,545],[680,558],[655,580],[625,558],[595,582],[560,570],[200,570],[110,565],[45,530],[5,470],[-15,380],[-20,250],[-15,120],[-8,40]],
    hills: [[0.3, 0.12, 4], [0.62, 0.1, -3]] },
  { name: 'Montecarlo', country: 'Mónaco', theme: 'coast', laps: 3, len: 2500,
    shape: [[0,0],[130,0],[160,-15],[175,-45],[230,-120],[270,-150],[300,-145],[320,-125],[330,-100],[345,-82],[362,-92],[376,-76],[362,-56],[340,-40],[332,-15],[350,10],[420,40],[520,70],[560,90],[575,110],[565,126],[545,120],[522,140],[482,150],[445,145],[422,166],[396,170],[380,150],[340,140],[300,150],[250,140],[200,135],[150,122],[100,110],[60,95],[28,70],[6,38]],
    hills: [[0.06, 0.3, 14], [0.62, 0.12, -4]] },
  { name: 'Suzuka', country: 'Japón', theme: 'sakura', laps: 3, len: 3300,
    shape: [[0,0],[300,0],[350,12],[380,45],[372,85],[340,105],[310,96],[285,118],[255,106],[228,126],[205,145],[195,175],[215,205],[250,222],[262,250],[240,268],[195,262],[150,245],[95,244],[62,266],[70,298],[108,304],[160,325],[215,352],[240,385],[215,415],[160,410],[105,382],[40,330],[-30,250],[-70,190],[-80,140],[-60,110],[-75,80],[-60,40],[-35,10]],
    hills: [[0.05, 0.18, 8], [0.45, 0.25, -7], [0.75, 0.12, 5]] },
  { name: 'Spa', country: 'Bélgica', theme: 'rain', laps: 3, len: 3800,
    shape: [[0,0],[140,0],[170,15],[165,45],[135,52],[110,62],[95,90],[110,115],[104,140],[106,300],[110,420],[125,440],[150,435],[170,455],[230,520],[252,558],[232,585],[195,582],[150,600],[110,630],[60,640],[20,622],[-10,600],[-42,612],[-70,500],[-80,300],[-72,120],[-62,62],[-45,46],[-56,30],[-40,14],[-20,2]],
    hills: [[0.04, 0.07, -8], [0.09, 0.1, 12], [0.35, 0.25, -12], [0.7, 0.2, 7]] },
  { name: 'Las Vegas', country: 'EE. UU.', theme: 'neon', laps: 3, len: 3000,
    shape: [[0,0],[300,0],[320,-20],[330,-60],[350,-80],[600,-80],[620,-60],[620,300],[600,320],[400,320],[380,340],[360,360],[100,360],[80,340],[80,300],[60,280],[-40,280],[-60,260],[-60,40],[-40,0]],
    hills: [] },
  { name: 'Jarama', country: 'España', theme: 'dry', laps: 3, len: 2600,
    shape: [[0,0],[260,0],[300,20],[310,60],[280,90],[240,95],[215,120],[230,160],[275,185],[320,200],[350,240],[330,275],[280,280],[240,260],[190,265],[150,300],[110,320],[70,305],[60,260],[90,220],[80,180],[40,160],[0,170],[-40,150],[-55,110],[-40,60],[-25,20]],
    hills: [[0.1, 0.2, 9], [0.45, 0.2, -7], [0.72, 0.15, 5]] }
];
const ROAD_W = 13;         // ancho de la pista (m)
const KERB_W = 1.4;
const DS = 2;              // separación entre muestras de la pista (m)
const START_I = 40;        // muestra de la línea de meta

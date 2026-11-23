/* ===== SONIDO (sintetizado) ===== */
const mf = n => 440 * Math.pow(2, (n - 69) / 12);
// Canciones synthwave: acordes (MIDI), bajo y melodía por compás
const SONGS = [
  { bpm: 96, prog: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65]],
    mel: [76, -1, 74, 72, -1, 69, -1, -1, 72, -1, 74, -1, 76, -1, 79, -1] },                 // menú
  { bpm: 118, prog: [[50, 53, 57, 60], [46, 50, 53, 57], [48, 52, 55, 59], [45, 49, 52, 57]],
    mel: [74, -1, 77, -1, 76, 74, -1, 72, -1, 69, -1, 72, 74, -1, -1, -1] },                 // carrera
  { bpm: 104, prog: [[52, 55, 59, 62], [48, 52, 55, 59], [55, 59, 62, 66], [50, 54, 57, 62]],
    mel: [83, -1, 81, -1, 79, -1, 78, 79, -1, -1, 74, -1, 76, -1, -1, -1] }                  // resultados
];
const AU = {
  ac: null, master: null, musG: null, sfxG: null, nb: null, song: null, want: null, nextT: 0, step: 0, eng: null, gear: 0,
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const a = this.ac = new AC();
      // compresor final para que nada sature ni suene chillón
      const comp = a.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
      this.master = a.createGain(); this.master.gain.value = 0.85;
      this.master.connect(comp); comp.connect(a.destination);
      const n = a.sampleRate * 2;
      this.nb = a.createBuffer(1, n, a.sampleRate);
      const d = this.nb.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      // reverberación sintética
      const len = Math.floor(a.sampleRate * 2.2), ir = a.createBuffer(2, len, a.sampleRate);
      for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
      this.rev = a.createConvolver(); this.rev.buffer = ir;
      const revG = a.createGain(); revG.gain.value = 0.35; this.rev.connect(revG); revG.connect(this.master);
      // música: volumen, eco y reverb
      this.musG = a.createGain(); this.musG.connect(this.master);
      this.musBus = a.createGain(); this.musBus.connect(this.musG);
      const send = a.createGain(); send.gain.value = 0.3; this.musBus.connect(send); send.connect(this.rev);
      this.dly = a.createDelay(1); this.dly.delayTime.value = 0.375;
      const fb = a.createGain(); fb.gain.value = 0.32; const dl = a.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2200;
      this.dly.connect(dl); dl.connect(fb); fb.connect(this.dly); dl.connect(this.musBus);
      this.sfxG = a.createGain(); this.sfxG.connect(this.master);
      const sfxSend = a.createGain(); sfxSend.gain.value = 0.12; this.sfxG.connect(sfxSend); sfxSend.connect(this.rev);
      // curva de saturación suave para el motor
      const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 2.2); }
      this.curve = curve;
      this.setVol();
      if (this.want !== null) { const w = this.want; this.song = null; this.playSong(w); }
    } catch (e) { this.ac = null; }
  },
  setVol() {
    if (!this.ac) return;
    const race = this.song === 1;
    this.musG.gain.setTargetAtTime(save.music ? (race ? 0.16 : 0.3) : 0, this.ac.currentTime, 0.3);
    this.sfxG.gain.value = save.sfx ? 0.9 : 0;
  },
  _env(g, at, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(peak, at + a);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  },
  _tone(at, f, dur, type, vol, slide, dest, atk) {
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, at);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), at + dur);
    this._env(g, at, atk || 0.005, vol, dur);
    o.connect(g); g.connect(dest || this.sfxG); o.start(at); o.stop(at + dur + 0.05);
  },
  _noise(at, dur, vol, ft, fq, dest, q) {
    const s = this.ac.createBufferSource(); s.buffer = this.nb;
    const f = this.ac.createBiquadFilter(); f.type = ft; f.frequency.value = fq; if (q) f.Q.value = q;
    const g = this.ac.createGain(); this._env(g, at, 0.003, vol, dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxG); s.start(at, Math.random() * 1.5); s.stop(at + dur + 0.05);
  },
  tone(f, dur, type, vol, slide, delay) { if (this.ac) this._tone(this.ac.currentTime + (delay || 0), f, dur, type, vol, slide); },
  noise(dur, vol, ft, fq, q) { if (this.ac) this._noise(this.ac.currentTime, dur, vol, ft, fq, null, q); },
  click() { this.tone(1200, 0.05, 'sine', 0.12); this.tone(1800, 0.04, 'sine', 0.05, 0, 0.01); },
  beep(hi) {
    if (!this.ac) return;
    const f = hi ? 1318 : 659, t = this.ac.currentTime;
    this._tone(t, f, hi ? 0.9 : 0.35, 'sine', 0.3); this._tone(t, f * 2, hi ? 0.6 : 0.2, 'sine', 0.06);
  },
  crash() {
    if (!this.ac) return; const t = this.ac.currentTime;
    this._noise(t, 0.5, 0.8, 'lowpass', 500); this._noise(t, 0.25, 0.35, 'bandpass', 2500, null, 1.5);
    this._tone(t, 70, 0.4, 'sine', 0.6, -35);
    for (let i = 0; i < 4; i++) this._noise(t + 0.05 + i * 0.07, 0.08, 0.15, 'highpass', 4000);
  },
  bump() { if (!this.ac) return; const t = this.ac.currentTime; this._noise(t, 0.18, 0.5, 'lowpass', 400); this._tone(t, 110, 0.15, 'sine', 0.35, -50); },
  coin() { this.tone(1568, 0.12, 'sine', 0.16); this.tone(2093, 0.4, 'sine', 0.14, 0, 0.09); },
  nitro() {
    if (!this.ac) return; const t = this.ac.currentTime;
    this._noise(t, 0.9, 0.35, 'bandpass', 1200, null, 0.8);
    this._tone(t, 120, 0.8, 'sawtooth', 0.05, 260);
  },
  lap() { [880, 1108, 1318].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.16, 0, i * 0.1)); },
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => { this.tone(f, 0.5, 'triangle', 0.14, 0, i * 0.13); this.tone(f / 2, 0.5, 'sine', 0.1, 0, i * 0.13); }); },
  pop() {   // petardeo del escape al soltar gas
    if (!this.ac) return; const t = this.ac.currentTime;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) { const at = t + i * (0.05 + Math.random() * 0.06); this._noise(at, 0.06, 0.4, 'lowpass', 900); this._tone(at, 60 + Math.random() * 40, 0.05, 'sine', 0.3); }
  },
  shift() {  // cambio de marcha: corte breve de potencia
    const e = this.eng; if (!e) return; const t = this.ac.currentTime;
    e.cut.gain.cancelScheduledValues(t); e.cut.gain.setValueAtTime(0.35, t); e.cut.gain.linearRampToValueAtTime(1, t + 0.12);
  },
  engineOn() {
    if (!this.ac || this.eng) return;
    const a = this.ac, e = {};
    // motor: fundamental, subarmónico y armónicos, saturación y filtro
    e.oscs = [['sawtooth', 1, 0.5], ['sine', 0.5, 0.8], ['sawtooth', 2.003, 0.18], ['square', 1.498, 0.08]].map(([type, mul, vol]) => {
      const o = a.createOscillator(); o.type = type; const g = a.createGain(); g.gain.value = vol; o.connect(g); return { o, g, mul };
    });
    e.mix = a.createGain(); e.mix.gain.value = 0.6;
    for (const x of e.oscs) x.g.connect(e.mix);
    // modulación de amplitud = pulsos de combustión
    e.am = a.createGain(); e.am.gain.value = 0.75;
    e.lfo = a.createOscillator(); e.lfo.type = 'sine'; const lfoG = a.createGain(); lfoG.gain.value = 0.25;
    e.lfo.connect(lfoG); lfoG.connect(e.am.gain);
    e.shp = a.createWaveShaper(); e.shp.curve = this.curve; e.shp.oversample = '2x';
    e.f = a.createBiquadFilter(); e.f.type = 'lowpass'; e.f.frequency.value = 600; e.f.Q.value = 0.9;
    e.body = a.createBiquadFilter(); e.body.type = 'peaking'; e.body.frequency.value = 160; e.body.gain.value = 6; e.body.Q.value = 1;
    e.cut = a.createGain(); e.cut.gain.value = 1;
    e.g = a.createGain(); e.g.gain.value = 0;
    e.mix.connect(e.am); e.am.connect(e.shp); e.shp.connect(e.f); e.f.connect(e.body); e.body.connect(e.cut); e.cut.connect(e.g); e.g.connect(this.sfxG);
    // silbido del turbo
    e.tb = a.createOscillator(); e.tb.type = 'sine'; e.tg = a.createGain(); e.tg.gain.value = 0; e.tb.connect(e.tg); e.tg.connect(this.sfxG);
    const mkN = (type, fq, q) => {
      const s = a.createBufferSource(); s.buffer = this.nb; s.loop = true;
      const f = a.createBiquadFilter(); f.type = type; f.frequency.value = fq; f.Q.value = q;
      const g = a.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.sfxG); s.start(); return [s, g, f];
    };
    [e.ns, e.ng, e.nf] = mkN('bandpass', 1900, 7);    // derrape de neumáticos
    [e.ws, e.wg] = mkN('lowpass', 700, 0.5);          // viento
    [e.rs, e.rg] = mkN('lowpass', 180, 1);            // traqueteo fuera de pista
    for (const x of e.oscs) x.o.start(); e.lfo.start(); e.tb.start();
    this.eng = e; this.gear = 0; this.lastLoad = 0;
  },
  engineSet(rpm, load, skid, wind, rough, gear) {
    const e = this.eng; if (!e) return;
    const t = this.ac.currentTime, f = 32 + rpm * 118;
    for (const x of e.oscs) x.o.frequency.setTargetAtTime(f * x.mul, t, 0.03);
    e.lfo.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    e.f.frequency.setTargetAtTime(320 + rpm * (900 + load * 1600), t, 0.05);
    e.g.gain.setTargetAtTime(0.1 + load * 0.07 + rpm * 0.04, t, 0.06);
    e.tb.frequency.setTargetAtTime(1800 + rpm * 2600, t, 0.08);
    e.tg.gain.setTargetAtTime(load * rpm * 0.012, t, 0.1);
    e.nf.frequency.setTargetAtTime(1700 + Math.random() * 500, t, 0.05);
    e.ng.gain.setTargetAtTime(skid * 0.13, t, 0.06);
    e.wg.gain.setTargetAtTime(wind * 0.18, t, 0.15);
    e.rg.gain.setTargetAtTime((rough || 0) * 0.5, t, 0.05);
    if (gear !== undefined && gear > this.gear) this.shift();
    if (gear !== undefined) this.gear = gear;
    if (this.lastLoad > 0.8 && load < 0.5 && rpm > 0.6 && Math.random() < 0.7) this.pop();
    this.lastLoad = load;
  },
  engineOff() {
    const e = this.eng; if (!e) return; this.eng = null;
    const t = this.ac.currentTime;
    for (const g of [e.g, e.ng, e.wg, e.rg, e.tg]) g.gain.setTargetAtTime(0, t, 0.06);
    setTimeout(() => { try { for (const x of e.oscs) x.o.stop(); e.lfo.stop(); e.tb.stop(); e.ns.stop(); e.ws.stop(); e.rs.stop(); } catch (x) {} }, 500);
  },
  playSong(i) {
    this.want = i;
    if (!this.ac || this.song === i) return;
    this.song = i; this.step = 0; this.nextT = this.ac.currentTime + 0.08;
    this.dly.delayTime.value = 60 / SONGS[i].bpm * 0.75;
    this.setVol();
  },
  stopSong() { this.song = null; this.want = null; },
  _kick(t) {
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g); g.connect(this.musG); o.start(t); o.stop(t + 0.32);
  },
  _snare(t) { this._noise(t, 0.22, 0.32, 'bandpass', 1800, this.musBus, 0.7); this._tone(t, 190, 0.1, 'triangle', 0.25, -60, this.musBus); },
  _pad(t, notes, dur) {
    const f = this.ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1500, t + dur * 0.5); f.frequency.linearRampToValueAtTime(700, t + dur);
    const g = this.ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + dur * 0.25); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    f.connect(g); g.connect(this.musBus);
    for (const n of notes) for (const det of [-7, 7]) {
      const o = this.ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mf(n); o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + dur + 0.05);
    }
  },
  _bass(t, n, dur) {
    const o = this.ac.createOscillator(), o2 = this.ac.createOscillator(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
    o.type = 'sawtooth'; o2.type = 'sine'; o.frequency.value = o2.frequency.value = mf(n);
    f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(220, t + dur);
    // "sidechain": entra suave tras el bombo
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22, t + 0.04); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(this.musG); o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  },
  tick() {
    if (!this.ac || this.song === null || this.ac.state !== 'running') return;
    const s = SONGS[this.song], sp = 60 / s.bpm / 4;
    if (this.nextT < this.ac.currentTime - 0.5) this.nextT = this.ac.currentTime + 0.05;
    while (this.nextT < this.ac.currentTime + 0.25) {
      const st = this.step, i = st % 16, bar = Math.floor(st / 16), ch = s.prog[bar % s.prog.length], t = this.nextT;
      const intro = bar < 2;
      if (i % 4 === 0 && !intro) this._kick(t);
      if ((i === 4 || i === 12) && !intro) this._snare(t);
      if (i % 2 === 1 && !intro) this._noise(t, 0.04, 0.035, 'highpass', 8000, this.musBus);
      if (i % 2 === 0) this._bass(t, ch[0] - 24 + (i % 8 === 6 ? 12 : 0), sp * 1.8);
      if (i === 0) this._pad(t, ch, sp * 16);
      const arp = [0, 1, 2, 3, 2, 1, 2, 3];
      if (i % 2 === 0) { const at = t; this._tone(at, mf(ch[arp[(i / 2) % 8]] + 12), sp * 1.6, 'triangle', 0.035, 0, this.musBus); this._tone(at, mf(ch[arp[(i / 2) % 8]] + 12), sp * 1.6, 'triangle', 0.02, 0, this.dly); }
      if (bar % 4 >= 2 || this.song !== 1) {
        const m = s.mel[i];
        if (m > 0) { this._tone(t, mf(m), sp * 3, 'square', 0.022, 0, this.musBus, 0.02); this._tone(t, mf(m), sp * 3, 'sine', 0.04, 0, this.dly, 0.02); }
      }
      this.nextT += sp; this.step++;
    }
  }
};


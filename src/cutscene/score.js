// Sound for "Die letzte Wacht", synthesised live with WebAudio (no files): a D minor score – drone, pads,
// a low ostinato and war drums for the duel, a lament at the end – and the sounds of the scene: wind, the
// fire, crows, steps, blades. Everything is scheduled on the audio clock against the film clock.
const NOTE = n => 440 * 2 ** ((n - 69) / 12);
const M = { D2: 38, F2: 41, G2: 43, A2: 45, Bb2: 46, C3: 48, D3: 50, E3: 52, F3: 53, G3: 55, A3: 57, Bb3: 58, C4: 60, Cs4: 61, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, Bb4: 70, C5: 72, D5: 74, E5: 76, F5: 77 };

export function createScore({ events, camAt, fire }) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const out = ctx.createDynamicsCompressor(); out.threshold.value = -14; out.ratio.value = 3; out.connect(ctx.destination);
  const master = ctx.createGain(); master.gain.value = .9; master.connect(out);
  const music = ctx.createGain(); music.gain.value = .55; music.connect(master);
  const sfx = ctx.createGain(); sfx.gain.value = .9; sfx.connect(master);
  // a long, dark hall of a reverb
  const verb = ctx.createConvolver(), len = ctx.sampleRate * 3.4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6; }
  verb.buffer = ir; const verbOut = ctx.createGain(); verbOut.gain.value = .5; verb.connect(verbOut); verbOut.connect(master);
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  let T0 = 0, from = 0, bedNodes = [];
  const at = t => T0 + t - from;
  const live = t => t >= from;
  const env = (g, t, a, peak, hold, rel) => { g.gain.setValueAtTime(0, at(t)); g.gain.linearRampToValueAtTime(peak, at(t + a)); g.gain.setValueAtTime(peak, at(t + a + hold)); g.gain.exponentialRampToValueAtTime(.0001, at(t + a + hold + rel)); };
  const src = (t, dur) => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(at(t), Math.random()); s.stop(at(t + dur)); return s; };
  const send = (node, amount) => { const g = ctx.createGain(); g.gain.value = amount; node.connect(g); g.connect(verb); };

  function pad(t, dur, notes, gain = .05, cutoff = 750) {
    if (!live(t + dur)) return; t = Math.max(t, from);
    const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = .6;
    f.connect(g); g.connect(music); send(g, .7);
    env(g, t, Math.min(2.2, dur * .4), gain, Math.max(0, dur - 4), 2.4);
    for (const n of notes) for (const d of [-7, 0, 7]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(M[n]); o.detune.value = d; o.connect(f); o.start(at(t)); o.stop(at(t + dur + 2.6)); }
  }
  function choir(t, dur, notes, gain = .035) {
    if (!live(t + dur)) return; t = Math.max(t, from);
    const g = ctx.createGain(); g.connect(music); send(g, 1); env(g, t, 2.5, gain, Math.max(0, dur - 5), 3);
    for (const [fq, q] of [[700, 6], [1150, 8]]) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = q; bp.connect(g);
      for (const n of notes) for (const d of [-9, 4, 11]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(M[n]); o.detune.value = d; o.connect(bp); o.start(at(t)); o.stop(at(t + dur + 3.2)); }
    }
  }
  function drone(t, dur, n, gain = .06) {
    if (!live(t + dur)) return; t = Math.max(t, from);
    const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260; f.connect(g); g.connect(music);
    env(g, t, 3, gain, Math.max(0, dur - 6), 3);
    for (const [type, mul, d] of [['sawtooth', 1, -4], ['sine', .5, 0], ['sawtooth', 1.5, 5]]) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = NOTE(M[n]) * mul; o.detune.value = d; o.connect(f); o.start(at(t)); o.stop(at(t + dur + 3.5)); }
  }
  function pluck(t, n, gain = .07, dur = .32) {   // the low string ostinato
    if (!live(t)) return;
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = NOTE(M[n]);
    f.type = 'lowpass'; f.frequency.setValueAtTime(1300, at(t)); f.frequency.exponentialRampToValueAtTime(260, at(t + dur));
    o.connect(f); f.connect(g); g.connect(music); send(g, .2); env(g, t, .01, gain, .02, dur); o.start(at(t)); o.stop(at(t + dur + .1));
  }
  function drum(t, gain = .5, pitch = 1) {
    if (!live(t)) return;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(115 * pitch, at(t)); o.frequency.exponentialRampToValueAtTime(42 * pitch, at(t + .3));
    o.connect(g); g.connect(music); send(g, .35); env(g, t, .004, gain, 0, .75); o.start(at(t)); o.stop(at(t + .9));
    const n = src(t, .25), f = ctx.createBiquadFilter(), gn = ctx.createGain(); f.type = 'lowpass'; f.frequency.value = 700; n.connect(f); f.connect(gn); gn.connect(music); env(gn, t, .002, gain * .5, 0, .16);
  }
  function melody(t0, line, gain = .055) {   // flute-like lament: sine + soft triangle, slow vibrato
    for (const [dt, n, dur] of line) {
      const t = t0 + dt; if (!live(t)) continue;
      const g = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5.1; vg.gain.value = 4.5; vib.connect(vg);
      g.connect(music); send(g, 1.1); env(g, t, .35, gain, Math.max(0, dur - .8), .9);
      for (const [type, mul, gg] of [['sine', 1, 1], ['triangle', 2, .18]]) { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = NOTE(M[n]) * mul; vg.connect(o.frequency); og.gain.value = gg; o.connect(og); og.connect(g); o.start(at(t)); o.stop(at(t + dur + 1.2)); }
      vib.start(at(t)); vib.stop(at(t + dur + 1.2));
    }
  }
  function swell(t, dur, gain = .12) {    // a rising cymbal before the last blow
    if (!live(t)) return;
    const n = src(t, dur + .1), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'highpass'; f.frequency.setValueAtTime(2500, at(t)); f.frequency.exponentialRampToValueAtTime(6000, at(t + dur));
    n.connect(f); f.connect(g); g.connect(music); send(g, .6); g.gain.setValueAtTime(0, at(t)); g.gain.linearRampToValueAtTime(gain, at(t + dur)); g.gain.linearRampToValueAtTime(0, at(t + dur + .08));
  }
  // --- scene sounds; their loudness follows the camera's distance to the source
  const near = (pos, t, k = 5) => { if (!pos) return 1; const c = camAt(t); return Math.min(1, Math.max(.12, k / (k + Math.hypot(c.x - pos[0], c.y - pos[1], c.z - pos[2])))); };
  function clang(t, gain) {
    if (!live(t)) return;
    const g = ctx.createGain(); g.connect(sfx); send(g, .9); g.gain.value = gain;
    [1, 2.76, 5.4, 8.93, 13.3].forEach((m, i) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = 540 * m * (1 + (Math.random() - .5) * .01); o.connect(og); og.connect(g); env(og, t, .001, .35 / (i + 1), 0, 1.6 / (1 + i * .5)); o.start(at(t)); o.stop(at(t + 1.8)); });
    const n = src(t, .1), f = ctx.createBiquadFilter(), gn = ctx.createGain(); f.type = 'highpass'; f.frequency.value = 2200; n.connect(f); f.connect(gn); gn.connect(g); env(gn, t, .001, .7, 0, .07);
  }
  function whoosh(t, gain = .3) {
    if (!live(t)) return;
    const n = src(t, .5), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(280, at(t)); f.frequency.exponentialRampToValueAtTime(1900, at(t + .18)); f.frequency.exponentialRampToValueAtTime(500, at(t + .42));
    n.connect(f); f.connect(g); g.connect(sfx); env(g, t, .12, gain, .05, .25);
  }
  function thud(t, gain = .5, freq = 80, len = .35) {
    if (!live(t)) return;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(freq, at(t)); o.frequency.exponentialRampToValueAtTime(freq * .5, at(t + len)); o.connect(g); g.connect(sfx); env(g, t, .004, gain, 0, len); o.start(at(t)); o.stop(at(t + len + .1));
    const n = src(t, .3), f = ctx.createBiquadFilter(), gn = ctx.createGain(); f.type = 'lowpass'; f.frequency.value = 420; n.connect(f); f.connect(gn); gn.connect(sfx); env(gn, t, .004, gain * .7, 0, .22);
  }
  function step(t, gain) {
    if (!live(t)) return;
    const n = src(t, .12), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'lowpass'; f.frequency.value = 520 + Math.random() * 300; n.connect(f); f.connect(g); g.connect(sfx); env(g, t, .003, gain, 0, .085);
  }
  function wet(t, gain) {
    if (!live(t)) return;
    const n = src(t, .4), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.frequency.setValueAtTime(900, at(t)); f.frequency.exponentialRampToValueAtTime(260, at(t + .3)); f.Q.value = 2;
    n.connect(f); f.connect(g); g.connect(sfx); env(g, t, .005, gain, .02, .3);
  }
  function shing(t, gain = .25) {
    if (!live(t)) return;
    const n = src(t, .9), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'highpass'; f.frequency.setValueAtTime(1800, at(t)); f.frequency.exponentialRampToValueAtTime(7000, at(t + .55));
    n.connect(f); f.connect(g); g.connect(sfx); env(g, t, .25, gain * .5, .1, .25);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = 2650; o.connect(og); og.connect(sfx); send(og, .8); env(og, t + .55, .002, gain * .3, 0, 1.4); o.start(at(t + .5)); o.stop(at(t + 2.1));
  }
  function caw(t, gain = .08) {
    for (let i = 0; i < 3; i++) {
      const s = t + i * .38; if (!live(s)) continue;
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(760, at(s)); o.frequency.exponentialRampToValueAtTime(520, at(s + .22)); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 3;
      o.connect(f); f.connect(g); g.connect(sfx); send(g, 1.2); env(g, s, .02, gain, .08, .14); o.start(at(s)); o.stop(at(s + .35));
    }
  }
  function heartbeat(t, gain = .4) { thud(t, gain, 52, .22); thud(t + .28, gain * .7, 48, .22); }

  // wind and fire are endless beds; fire loudness follows the camera every frame
  function beds() {
    const w = src(from, 200), wf = ctx.createBiquadFilter(), wg = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    wf.type = 'lowpass'; wf.frequency.value = 480; lfo.frequency.value = .07; lg.gain.value = 260; lfo.connect(lg); lg.connect(wf.frequency); lfo.start(at(from));
    w.connect(wf); wf.connect(wg); wg.connect(sfx); wg.gain.value = .09;
    const crack = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), d = crack.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * .05;
    for (let k = 0; k < 70; k++) { const p = Math.floor(Math.random() * (d.length - 800)), a = .3 + Math.random() * .7; for (let i = 0; i < 400; i++) d[p + i] += (Math.random() * 2 - 1) * a * Math.exp(-i / 60); }
    const c = ctx.createBufferSource(); c.buffer = crack; c.loop = true; const cf = ctx.createBiquadFilter(); cf.type = 'highpass'; cf.frequency.value = 600;
    const cg = ctx.createGain(); cg.gain.value = 0; c.connect(cf); cf.connect(cg); cg.connect(sfx); c.start(at(from));
    bedNodes = [w, c, lfo]; return cg;
  }
  let fireGain = null;

  function schedule() {
    // I · the wait: drone and slow pads, a few notes of the lament
    drone(0, 41, 'D2', .05);
    pad(0, 10.5, ['D3', 'F3', 'A3'], .035); pad(10, 7.5, ['Bb2', 'D3', 'F3'], .035); pad(17, 7, ['F2', 'C3', 'A3'], .035); pad(24, 6.5, ['C3', 'E3', 'G3'], .03);
    melody(3, [[0, 'A4', 1.6], [1.7, 'D5', 2.2], [4.1, 'C5', 1.1], [5.3, 'A4', 1.4], [6.8, 'G4', 1], [7.9, 'A4', 3]], .04);
    caw(4.2); caw(8.6, .06);
    // II · the meeting: the ostinato starts and grows
    pad(30, 11, ['D3', 'G3', 'A3'], .03, 520);
    const beat = 60 / 92;
    const riff = ['D2', 'D2', 'A2', 'D2', 'D2', 'F2', 'D2', 'A2'];
    for (let t = 30, i = 0; t < 66; t += beat / 2, i++) pluck(t, riff[i % 8], Math.min(.08, .025 + (t - 30) * .004));
    // III · the duel: drums, darker harmony, a stab on every clash
    for (let t = 41; t < 66; t += beat * 2) { drum(t, .55); drum(t + beat * .75, .3, 1.15); drum(t + beat * 1.5, .38); if (t > 47) drum(t + beat * 1.75, .22, 1.3); }
    pad(41, 6, ['D3', 'F3', 'A3'], .04, 600); pad(47, 6, ['G2', 'Bb2', 'D3'], .045, 650); pad(53, 6, ['Bb2', 'D3', 'F3'], .045, 700); pad(59, 7, ['A2', 'Cs4', 'E3'], .05, 800);
    drone(41, 25, 'D2', .06);
    swell(66.5, 2.5, .1); pad(66, 3, ['D3', 'F3', 'Bb3'], .05, 900);
    heartbeat(57.2, .35); heartbeat(58.1, .3); heartbeat(68.6, .4); heartbeat(69.6, .32); heartbeat(70.7, .25);
    // IV · after: silence, then sorrow
    pad(71, 8, ['D3', 'F3', 'A3'], .03, 500); pad(79, 7, ['Bb2', 'D3', 'F3'], .035, 550);
    choir(86, 14, ['D3', 'A3', 'F4'], .03); choir(100, 10, ['Bb2', 'F3', 'D4'], .028); choir(110, 10, ['D3', 'A3', 'E4'], .026);
    drone(84, 36, 'D2', .045);
    melody(88, [[0, 'D5', 2.4], [2.6, 'C5', 1.2], [3.9, 'A4', 1.6], [5.6, 'Bb4', 1.2], [6.9, 'A4', 2.6], [10, 'G4', 1.4], [11.5, 'F4', 1.2], [12.8, 'E4', 1.4], [14.4, 'D4', 3.6],
      [19, 'A4', 1.4], [20.5, 'D5', 2.4], [23.1, 'E5', 1.3], [24.5, 'F5', 2.2], [26.9, 'E5', 1.2], [28.2, 'D5', 4.5]], .05);
    caw(80.6, .07);
    // V · the scene
    for (const e of events) {
      const g = near(e.pos, e.t);
      if (e.type === 'clash') { clang(e.t, .55 * Math.max(.5, g)); thud(e.t, .2, 140, .2); }
      else if (e.type === 'whoosh') whoosh(e.t, .3 * Math.max(.4, g));
      else if (e.type === 'hit') { thud(e.t, .45, 90); wet(e.t + .02, .25); }
      else if (e.type === 'kill') { thud(e.t, .6, 70, .5); wet(e.t + .02, .35); }
      else if (e.type === 'draw') shing(e.t, .3);
      else if (e.type === 'drop') { clang(e.t, .12); thud(e.t + .05, .15, 160, .15); }
      else if (e.type === 'fall') thud(e.t, .7, 60, .5);
      else if (e.type === 'kneel') thud(e.t, .25, 70, .25);
      else if (e.type === 'step') step(e.t, .16 * g);
    }
  }

  return {
    start(t = 0) { from = t; T0 = ctx.currentTime + .08; if (ctx.state === 'suspended') ctx.resume(); fireGain = beds().gain; schedule(); },
    /** Per frame: the fire's loudness from where the camera stands. */
    update(t, cam) { if (!fireGain) return; const d = cam.distanceTo(fire); fireGain.setTargetAtTime(Math.min(.9, 3.2 / (1 + d * d * .08)) * (t > 86 ? Math.max(.25, 1 - (t - 86) / 30) : 1), ctx.currentTime, .1); },
    get state() { return ctx.state; },
    fadeOut(seconds = 1.2) { master.gain.setTargetAtTime(0, ctx.currentTime, seconds / 4); },
    stop() { bedNodes.forEach(b => { try { b.stop(); } catch { /* already stopped */ } }); ctx.close().catch(() => {}); },
  };
}

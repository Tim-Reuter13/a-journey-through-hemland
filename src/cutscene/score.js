// Sound for "Die letzte Wacht": real recordings (CC0, found through Openverse, see public/audio/film/CREDITS.json),
// placed on the film clock: three pieces of music, wind and fire beds, and every step, clash, hit and fall on
// the beats the bake measured. Loudness of scene sounds follows the camera's distance to the source.
const FILES = ['music_wait', 'music_duel', 'music_end', 'wind_bed', 'fire_bed', 'crows', 'heartbeat', 'cloth',
  'clash_1', 'clash_2', 'impact_1', 'impact_2', 'draw_1', 'draw_2', 'swing_1', 'swing_2', 'swing_3', 'stab_1', 'stab_2',
  'fall_1', 'fall_2', 'drop_1', 'drop_2', 'step_knight_1', 'step_knight_2', 'step_knight_3', 'step_knight_4', 'step_knight_5', 'step_dirt'];

/** Fetch the encoded files early (during the film's loading) so decoding is all that is left at the start. */
export function preloadScore(base) {
  return Promise.all(FILES.map(name => fetch(`${base}audio/film/${name}.ogg`).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null)
    .then(data => [name, data])));
}

export function createScore({ events, camAt, fire, files }) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const out = ctx.createDynamicsCompressor(); out.threshold.value = -12; out.ratio.value = 3; out.connect(ctx.destination);
  const master = ctx.createGain(); master.gain.value = .95; master.connect(out);
  const music = ctx.createGain(); music.gain.value = .7; music.connect(master);
  const sfx = ctx.createGain(); sfx.gain.value = 1; sfx.connect(master);
  // a short, open forest reverb for blades and bodies
  const verb = ctx.createConvolver(), len = ctx.sampleRate * 1.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
  verb.buffer = ir; const verbOut = ctx.createGain(); verbOut.gain.value = .35; verb.connect(verbOut); verbOut.connect(master);
  const buf = {};
  let T0 = 0, from = 0, fireGain = null, sources = [];
  const at = t => T0 + t - from;
  const near = (pos, t, k = 6) => { if (!pos) return 1; const c = camAt(t); return Math.min(1, Math.max(.15, k / (k + Math.hypot(c.x - pos[0], c.y - pos[1], c.z - pos[2])))); };

  /** Play buffer `name` at film time t; offset/duration in the file, gain, rate, reverb send, fades. */
  function play(name, t, { gain = 1, rate = 1, offset = 0, dur, send = 0, bus = sfx, fadeIn = 0, fadeOut = 0, loop = false } = {}) {
    const b = buf[name];
    if (!b) return null;
    const end = t + (dur ?? (b.duration - offset) / rate);
    if (end < from) return null;                 // already over when the film (re)starts here
    const startAt = Math.max(t, from), skip = (startAt - t) * rate;
    const s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate; s.loop = loop;
    const g = ctx.createGain(); s.connect(g); g.connect(bus);
    if (send) { const v = ctx.createGain(); v.gain.value = send; g.connect(v); v.connect(verb); }
    g.gain.setValueAtTime(fadeIn ? 0 : gain, at(startAt));
    if (fadeIn) g.gain.linearRampToValueAtTime(gain, at(Math.max(startAt + .01, t + fadeIn)));
    if (fadeOut) { g.gain.setValueAtTime(gain, at(Math.max(startAt, end - fadeOut))); g.gain.linearRampToValueAtTime(0, at(end)); }
    s.start(at(startAt), loop ? (offset + skip) % b.duration : offset + skip);
    s.stop(at(end) + .05);
    sources.push(s);
    return g;
  }

  function schedule() {
    // music: the wait, the duel (cut off by the killing blow), the lament
    play('music_wait', 0, { bus: music, gain: .9, dur: 44, fadeOut: 3 });
    play('music_duel', 41, { bus: music, gain: 1, dur: 30.2, fadeIn: .4, fadeOut: .6 });
    play('music_end', 79.5, { bus: music, gain: .85, fadeIn: 4, dur: Math.min(56.5, 130 - 79.5), fadeOut: 4 });
    // beds
    play('wind_bed', 0, { gain: .55, dur: 130, loop: true, fadeIn: 2, fadeOut: 4 });
    fireGain = play('fire_bed', 0, { gain: 0, dur: 130, loop: true });
    play('crows', 3.6, { gain: .45, offset: 0, dur: 6, fadeOut: 1.5 });
    play('crows', 80.2, { gain: .35, offset: 12, dur: 5, fadeIn: .2, fadeOut: 1.5 });
    // the heart in the slow motion
    for (const t of [57.2, 58.1, 68.6, 69.6, 70.7]) play('heartbeat', t, { gain: .7 });
    let clash = 0, swing = 0, step = 0;
    for (const e of events) {
      const g = near(e.pos, e.t);
      switch (e.type) {
        case 'clash': play(`clash_${1 + (clash++ % 2)}`, e.t, { gain: Math.max(.55, g), send: .5 }); play('impact_2', e.t, { gain: .35 * g }); break;
        case 'whoosh': play(`swing_${1 + (swing++ % 3)}`, e.t, { gain: .75 * Math.max(.5, g), send: .15 }); break;
        case 'hit': play('impact_1', e.t, { gain: .8 * Math.max(.5, g), send: .3 }); play('stab_1', e.t + .02, { gain: .7 }); break;
        case 'kill': play('stab_2', e.t, { gain: .9, send: .2 }); play('impact_2', e.t, { gain: .5 }); break;
        case 'draw': play(e.t > 35 ? 'draw_1' : 'draw_2', e.t, { gain: .8, send: .2 }); break;
        case 'drop': play('drop_1', e.t, { gain: .7, send: .2 }); play('drop_2', e.t + .12, { gain: .35 }); break;
        case 'fall': play('fall_1', e.t, { gain: .9, send: .25 }); play('cloth', e.t + .05, { gain: .5 }); break;
        case 'kneel': play('cloth', e.t, { gain: .7 }); play('fall_2', e.t + .15, { gain: .35 }); break;
        case 'rise': play('cloth', e.t, { gain: .6 }); break;
        case 'step': {
          const heavy = e.who === 'captain';
          play(`step_knight_${1 + (step++ % 5)}`, e.t, { gain: (heavy ? .75 : .45) * g, rate: heavy ? .95 : 1.12 });
          break;
        }
      }
    }
  }

  let ready = null;
  return {
    /** Decode, then start in sync with the film clock (getTime() at the moment the sounds are ready). */
    start(getTime) {
      if (ctx.state === 'suspended') ctx.resume();
      ready = Promise.all((files || []).map(async ([name, data]) => { if (data) try { buf[name] = await ctx.decodeAudioData(data.slice(0)); } catch { /* skip a broken file */ } }))
        .then(() => { from = getTime(); T0 = ctx.currentTime + .05; schedule(); });
      return ready;
    },
    /** Per frame: the fire's loudness from where the camera stands. */
    update(t, cam) {
      if (!fireGain) return;
      const d = cam.distanceTo(fire);
      fireGain.gain.setTargetAtTime(Math.min(1, 4 / (1 + d * d * .07)) * (t > 79 ? Math.max(.25, 1 - (t - 79) / 30) : 1), ctx.currentTime, .1);
    },
    get state() { return ctx.state; },
    fadeOut(seconds = 1.2) { master.gain.setTargetAtTime(0, ctx.currentTime, seconds / 4); },
    stop() { sources.forEach(s => { try { s.stop(); } catch { /* already stopped */ } }); ctx.close().catch(() => {}); },
  };
}

// Procedural audio only. Import and construction are silent, including in Node.
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const random = (low, high) => low + Math.random() * (high - low);
const midiHz = (note) => 440 * 2 ** ((note - 69) / 12);
const VOICE_LIMIT = 24; // Transient sources; three extra sources form wind/crickets.

/** Half-hour fades inside the day [06,19) and night [21,05) windows. */
export function timeOfDayWeights(hour) {
  const h = ((finite(hour, 12) % 24) + 24) % 24;
  const day = clamp(Math.min((h - 6) * 2, (19 - h) * 2));
  const nightHour = h < 5 ? h + 24 : h;
  const night = clamp(Math.min((nightHour - 21) * 2, (29 - nightHour) * 2));
  return { day, night };
}

/** Squared distance attenuation, exactly silent at and beyond radius. */
export function distanceFalloff(distance, radius = 14) {
  if (!Number.isFinite(distance) || !Number.isFinite(radius) || radius <= 0) return 0;
  return (1 - clamp(Math.max(0, distance) / radius)) ** 2;
}

export function nearestFireGain(position, fires = []) {
  let nearest = Infinity;
  for (const fire of fires ?? []) {
    if (!fire || !Number.isFinite(fire.x) || !Number.isFinite(fire.z)) continue;
    nearest = Math.min(nearest, Math.hypot(
      fire.x - finite(position?.x), finite(fire.y) - finite(position?.y), fire.z - finite(position?.z),
    ));
  }
  return distanceFalloff(nearest);
}

/** Fresh MIDI triads, so callers can transpose/voice them without shared mutation. */
export function pickChordProgression(index = 0, mode = 'dorian') {
  const dorian = mode !== 'aeolian';
  const chords = [
    [50, 57, 65], // D minor, open voicing
    [48, 55, 64], // C major
    [43, 50, dorian ? 59 : 58], // G major / minor
    [45, 52, 60], // A minor
    [dorian ? 52 : 46, dorian ? 59 : 53, dorian ? 67 : 62], // E minor / Bb major
    [41, 48, 57], // F major
  ];
  const orders = [[0, 1, 2, 0], [0, 5, 3, 1], [0, 4, 2, 3]];
  const order = orders[((Math.floor(finite(index)) % orders.length) + orders.length) % orders.length];
  return order.map((i) => [...chords[i]]);
}

/** Pure mix envelope: 2-second attack, 4-second release, including reversals. */
export function combatMixAt(time, startTime, startValue, combat) {
  const target = combat ? 1 : 0;
  const amount = clamp((finite(time) - finite(startTime)) / (combat ? 2 : 4));
  const start = clamp(finite(startValue));
  return start + (target - start) * amount;
}

export function createAmbience() {
  let context = null;
  let graph = null;
  let noise = null;
  let pendingResume = null;
  let unavailable = false;
  let paused = false;
  let combat = false;
  let transition = { time: 0, value: 0 };
  let piece = null;
  let nextPiece = Infinity;
  let nextTick = 0;
  let nextBird = 0;
  let nextOwl = 0;
  let nextFire = 0;
  let nextBeat = 0;
  let beat = 0;
  let lastStep = -Infinity;
  let weights = { day: 0, night: 0 };
  let fireLevel = 0;
  const volumes = { master: 0.6, music: 0.45, effects: 0.7 };
  const voices = new Set();
  const persistent = [];

  // Each public audio method fails silently if a browser/device loses Web Audio.
  function safely(action) {
    try { return action(); } catch { return undefined; }
  }
  function smooth(param, value, now, seconds = 0.12) {
    // These parameters only use target automation; cancelling prevents event growth.
    param.cancelScheduledValues(now);
    param.setTargetAtTime(value, now, seconds);
  }
  function gain(value, output) {
    const node = context.createGain();
    node.gain.value = value;
    node.connect(output);
    return node;
  }
  function filter(type, frequency, output, q = 0.7) {
    const node = context.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    node.connect(output);
    return node;
  }
  function cleanupVoice(voice) {
    voices.delete(voice);
    for (const node of voice.nodes) safely(() => node.disconnect());
  }

  // One source per voice, automatically disconnected on completion; no timers.
  function voice({ layer, at, duration, volume, frequency = 220, endFrequency,
    type = 'sine', cutoff = 1800, filterType = 'lowpass', pan = 0,
    attack = 0.01, release = 0.1, noisy = false, detune = 0 }) {
    if (voices.size >= VOICE_LIMIT || volume <= 0 || context.state !== 'running') return;
    const nodes = [];
    let source;
    let record;
    try {
      const bus = layer === 'ambient' ? graph.ambient : layer === 'combat' ? graph.combat : graph.nature;
      let output = bus;
      if (typeof context.createStereoPanner === 'function') {
        output = context.createStereoPanner();
        output.pan.value = clamp(pan, -1, 1);
        output.connect(bus);
        nodes.push(output);
      }
      const envelope = gain(0, output);
      nodes.push(envelope);
      const colour = filter(filterType, cutoff, envelope);
      nodes.push(colour);
      source = noisy ? context.createBufferSource() : context.createOscillator();
      nodes.push(source);
      if (noisy) {
        source.buffer = noise;
        source.loop = true;
        source.playbackRate.value = random(0.85, 1.15);
      } else {
        source.type = type;
        source.frequency.setValueAtTime(frequency, at);
        source.detune.value = detune;
        if (endFrequency) source.frequency.exponentialRampToValueAtTime(endFrequency, at + duration * 0.8);
      }
      source.connect(colour);
      const end = at + duration;
      const attackEnd = at + Math.min(attack, duration * 0.4);
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(volume, attackEnd);
      envelope.gain.setValueAtTime(volume, Math.max(attackEnd, end - release));
      envelope.gain.linearRampToValueAtTime(0, end);
      record = { nodes, source, layer, end };
      voices.add(record);
      source.onended = () => cleanupVoice(record);
      if (noisy) source.start(at, random(0, 1));
      else source.start(at);
      source.stop(end + 0.02);
    } catch {
      if (source) safely(() => source.stop());
      if (record) cleanupVoice(record);
      else for (const node of nodes) safely(() => node.disconnect());
    }
  }

  function initialize() {
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (typeof AudioContext !== 'function') { unavailable = true; return; }
    context = new AudioContext();
    graph = {};
    // Build from the output back, retaining nodes for explicit teardown.
    graph.master = gain(volumes.master, context.destination);
    graph.music = gain(volumes.music, graph.master);
    graph.effects = gain(volumes.effects, graph.master);
    graph.nature = gain(1, graph.effects);
    graph.ambient = gain(1, graph.music);
    graph.combat = gain(0, graph.music);
    noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    graph.wind = gain(0, graph.nature);
    graph.windFilter = filter('lowpass', 500, graph.wind);
    graph.windHighpass = filter('highpass', 70, graph.windFilter);
    const wind = context.createBufferSource();
    persistent.push(wind);
    wind.buffer = noise;
    wind.loop = true;
    wind.connect(graph.windHighpass);
    wind.start();

    graph.crickets = gain(0, graph.nature);
    graph.cricketPulse = gain(0.5, graph.crickets);
    const cricket = context.createOscillator();
    persistent.push(cricket);
    cricket.frequency.value = 4600;
    cricket.connect(graph.cricketPulse);
    cricket.start();
    const pulse = context.createOscillator();
    persistent.push(pulse);
    pulse.type = 'square';
    pulse.frequency.value = 28;
    graph.pulseDepth = gain(0.5, graph.cricketPulse.gain);
    pulse.connect(graph.pulseDepth);
    pulse.start();
    const now = context.currentTime;
    nextPiece = now + random(8, 16);
    nextBird = now + random(2, 7);
    nextOwl = now + random(12, 30);
    nextFire = now;
    nextTick = now;
  }

  function dispose() {
    for (const record of voices) {
      safely(() => record.source.stop());
      cleanupVoice(record);
    }
    for (const source of persistent) {
      safely(() => source.stop());
      safely(() => source.disconnect());
    }
    persistent.length = 0;
    if (graph) for (const node of Object.values(graph)) safely(() => node.disconnect());
    if (context && context.state !== 'closed') safely(() => { context.close()?.catch(() => {}); });
    context = null;
    graph = null;
    noise = null;
    piece = null;
    paused = combat = false;
    transition = { time: 0, value: 0 };
    weights = { day: 0, night: 0 };
    fireLevel = 0;
    lastStep = -Infinity;
  }

  function resume() {
    if (pendingResume) return pendingResume;
    try {
      if (!context || context.state === 'closed') {
        if (context) dispose();
        initialize();
      }
      if (!context) return Promise.resolve();
      // Called synchronously from the gesture before the first promise boundary.
      pendingResume = Promise.resolve(context.resume()).catch(() => {}).finally(() => { pendingResume = null; });
      return pendingResume;
    } catch {
      dispose();
      unavailable = true;
      return Promise.resolve();
    }
  }

  function beginPiece(now) {
    const mode = Math.random() < 0.55 ? 'dorian' : 'aeolian';
    piece = {
      chords: pickChordProgression(Math.floor(random(0, 3)), mode),
      index: 0, nextChord: now, end: Infinity, nextSolo: now + random(5, 10),
      currentChord: [50, 57, 65],
    };
  }

  function music(now) {
    const mix = combatMixAt(now, transition.time, transition.value, combat);
    if (piece && now >= piece.end) {
      piece = null;
      nextPiece = now + random(30, 90);
    }
    if (!combat && !piece && now >= nextPiece) beginPiece(now);
    // Ambient phrases continue underneath crossfades, using only a few sources.
    if (piece && now + 0.1 >= piece.nextChord && piece.index < piece.chords.length) {
      const at = Math.max(now, piece.nextChord);
      const duration = random(8, 16);
      const chord = piece.chords[piece.index++];
      piece.currentChord = chord;
      for (let i = 0; i < chord.length; i++) voice({
        layer: 'ambient', at, duration: duration + 2, volume: 0.035,
        frequency: midiHz(chord[i]), type: 'triangle', cutoff: 850,
        attack: 2.5, release: 3.5, detune: random(-5, 5), pan: (i - 1) * 0.35,
      });
      piece.nextChord = at + duration;
      if (piece.index === piece.chords.length) piece.end = at + duration + 2;
    }
    if (piece && !combat && now >= piece.nextSolo && now + 4 < piece.end) {
      const note = piece.currentChord[Math.floor(random(0, 3))] + 12;
      voice({ layer: 'ambient', at: now, duration: random(2.5, 4), volume: 0.025,
        frequency: midiHz(note), endFrequency: midiHz(note) * 1.003,
        type: 'sine', cutoff: 1600, attack: 0.5, release: 1.4, pan: random(-0.3, 0.3) });
      piece.nextSolo = now + random(9, 17);
    }
    if ((combat || mix > 0.001) && now + 0.1 >= nextBeat) {
      // Audio-clock lookahead without catch-up loops after a long hidden tab.
      const at = Math.max(now, nextBeat);
      const notes = [38, 38, 45, 41, 38, 48, 45, 41];
      if (beat % 2 === 0) {
        voice({ layer: 'combat', at, duration: 0.65, volume: 0.18,
          frequency: beat % 4 === 0 ? 90 : 72, endFrequency: 35, cutoff: 400, release: 0.61 });
        voice({ layer: 'combat', at, duration: 0.23, volume: 0.12,
          noisy: true, cutoff: 210, release: 0.21 });
      }
      voice({ layer: 'combat', at, duration: 0.36, volume: 0.055,
        frequency: midiHz(notes[beat % notes.length]), type: 'triangle', cutoff: 600,
        attack: 0.025, release: 0.28, pan: beat % 2 ? 0.12 : -0.12 });
      beat++;
      nextBeat = at + 0.42;
    }
  }

  function setCombat(value, now) {
    if (value === combat) return;
    const current = combatMixAt(now, transition.time, transition.value, combat);
    transition = { time: now, value: current };
    combat = value;
    const duration = combat ? 2 : 4;
    for (const [node, from, to] of [[graph.combat, current, combat ? 1 : 0], [graph.ambient, 1 - current, combat ? 0 : 1]]) {
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(from, now);
      node.gain.linearRampToValueAtTime(to, now + duration);
    }
    if (combat) { nextBeat = now; beat = 0; }
    else if (!piece || now >= piece.end) beginPiece(now);
  }

  function wildlife(now) {
    if (weights.day > 0 && now >= nextBird) {
      const pan = random(-0.85, 0.85);
      const base = random(2000, 3000);
      const count = Math.floor(random(2, 5));
      for (let i = 0; i < count; i++) voice({
        layer: 'birds', at: now + i * 0.17, duration: random(0.08, 0.14),
        volume: 0.023 * weights.day, frequency: base * random(0.9, 1.1),
        endFrequency: base * random(1.25, 1.65), cutoff: 6500,
        pan, attack: 0.015, release: 0.06,
      });
      nextBird = now + random(6, 19);
    }
    if (weights.night > 0 && now >= nextOwl) {
      const pan = random(-0.8, 0.8);
      for (let i = 0; i < 2; i++) voice({
        layer: 'owl', at: now + i * 0.65, duration: i ? 0.65 : 0.4,
        volume: 0.038 * weights.night, frequency: i ? 420 : 460,
        endFrequency: i ? 350 : 410, cutoff: 850, pan, attack: 0.1, release: 0.25,
      });
      nextOwl = now + random(22, 55);
    }
    if (fireLevel > 0 && now >= nextFire) {
      voice({ layer: 'fire', at: now, duration: random(0.025, 0.12),
        volume: fireLevel * random(0.08, 0.22), noisy: true,
        cutoff: random(900, 4500), filterType: 'bandpass', pan: random(-0.25, 0.25),
        attack: 0.002, release: 0.1 });
      nextFire = now + random(0.08, 0.45);
    }
  }

  function update(dt, input = {}) {
    // Audio time is authoritative; dt deliberately cannot advance queued sounds.
    safely(() => {
      if (!graph || context?.state !== 'running') return;
      const now = context.currentTime;
      const nextPaused = Boolean(input.paused);
      if (paused !== nextPaused) {
        paused = nextPaused;
        smooth(graph.master.gain, volumes.master * (paused ? 0.25 : 1), now);
        smooth(graph.nature.gain, paused ? 0 : 1, now, 0.04);
        if (paused) {
          // Cancel queued wildlife/steps as well as gating the continuous beds.
          for (const record of voices) if (record.layer !== 'ambient' && record.layer !== 'combat') {
            safely(() => record.source.stop(now));
            cleanupVoice(record);
          }
        } else {
          nextBird = now + random(2, 7);
          nextOwl = now + random(10, 25);
          nextFire = now;
        }
      }
      setCombat(Boolean(input.combat), now);
      if (now < nextTick) return;
      nextTick = now + 0.08; // ~12.5 Hz control rate, independent of render FPS.
      weights = timeOfDayWeights(input.hour);
      fireLevel = nearestFireGain(input.position, input.fires);
      const altitude = 1 + clamp((finite(input.position?.y) - 15) / 45) * 1.7;
      const gust = 0.72 + 0.18 * Math.sin(now * 0.29) + 0.1 * Math.sin(now * 0.071);
      smooth(graph.wind.gain, 0.16 * altitude * gust, now, 0.6);
      smooth(graph.windFilter.frequency, 420 + 480 * gust, now, 0.8);
      const cricketPhrase = Math.sin(now * 1.7) > -0.35 ? 1 : 0.12;
      smooth(graph.crickets.gain, 0.012 * weights.night * cricketPhrase, now, 0.03);
      music(now); // Music keeps playing (ducked) while paused.
      if (!paused) wildlife(now);
    });
  }

  function footstep(surface = 'grass', intensity = 0.5) {
    safely(() => {
      if (!graph || context?.state !== 'running' || paused) return;
      const strength = clamp(finite(intensity));
      const now = context.currentTime;
      if (!strength || now - lastStep < 0.09) return;
      lastStep = now;
      const surfaces = {
        grass: { cutoff: 1400, duration: 0.16, filterType: 'lowpass', tone: 90, volume: 0.16 },
        path: { cutoff: 2400, duration: 0.12, filterType: 'lowpass', tone: 110, volume: 0.19 },
        stone: { cutoff: 3500, duration: 0.085, filterType: 'highpass', tone: 210, volume: 0.16 },
        wood: { cutoff: 850, duration: 0.13, filterType: 'bandpass', tone: 150, volume: 0.21 },
      };
      const settings = Object.hasOwn(surfaces, surface) ? surfaces[surface] : surfaces.grass;
      voice({ layer: 'footsteps', at: now, duration: settings.duration,
        volume: settings.volume * strength, noisy: true, cutoff: settings.cutoff * random(0.8, 1.2),
        filterType: settings.filterType, attack: 0.003, release: settings.duration * 0.85 });
      voice({ layer: 'footsteps', at: now, duration: 0.1,
        volume: (surface === 'wood' ? 0.11 : 0.055) * strength,
        frequency: settings.tone * random(0.88, 1.12), endFrequency: settings.tone * 0.6,
        type: 'sine', cutoff: 650, attack: 0.003, release: 0.09 });
    });
  }

  function setVolume(settings = {}) {
    safely(() => {
      for (const key of Object.keys(volumes)) {
        if (Number.isFinite(settings[key])) volumes[key] = clamp(settings[key]);
      }
      if (!graph) return;
      const now = context.currentTime;
      smooth(graph.master.gain, volumes.master * (paused ? 0.25 : 1), now);
      smooth(graph.music.gain, volumes.music, now);
      smooth(graph.effects.gain, volumes.effects, now);
    });
  }

  function state() {
    const contextState = context?.state ?? (unavailable ? 'unavailable' : 'uninitialized');
    const now = context?.currentTime ?? 0;
    const mix = combatMixAt(now, transition.time, transition.value, combat);
    const running = contextState === 'running';
    const ambientActive = running && piece !== null && now < piece.end;
    const combatActive = running && (combat || mix > 0.001);
    const musicMode = combatActive ? 'combat' : ambientActive ? 'ambient' : 'silence';
    const layers = new Set();
    if (running && !paused) {
      layers.add('wind');
      if (weights.night > 0) layers.add('crickets');
      for (const record of voices) if (record.end > now && record.layer !== 'ambient' && record.layer !== 'combat') layers.add(record.layer);
    }
    if (ambientActive && mix < 1) layers.add('ambient');
    if (combatActive) layers.add('combat');
    return { contextState, musicMode, activeLayers: [...layers], volumes: { ...volumes },
      paused, combatMix: mix, activeVoices: voices.size, voiceLimit: VOICE_LIMIT };
  }

  return { resume, update, footstep, setVolume, state, dispose };
}

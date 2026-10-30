// Liquid in a box bottle (the potion in the hand). Pure numbers, no rendering:
// - The surface tilts toward the felt gravity (gravity minus the bottle's own acceleration) on a lightly
//   damped spring, so after a jolt it swings past level and sloshes back and forth for a while.
// - A small wave grid rides on that plane: quick shakes push ripples across, crests run up the walls.
// - Agitation builds while the bottle is shaken and decays slowly; it sets how many bubbles rise (more the
//   harder you shake) and how much foam floats on top. Bubbles pop at the surface and dimple it.
// Coordinates are the bottle's own: x and z across, y up, the inside spanning ±half; heights are offsets
// from the resting level.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createLiquid({ cells = 6, half = .17, bubbles: bubbleCount = 48, random = Math.random } = {}) {
  const n = cells + 1, step = 2 * half / cells;
  const h = new Float32Array(n * n), v = new Float32Array(n * n), lap = new Float32Array(n * n);
  const state = { x: 0, z: 0, vx: 0, vz: 0, tx: 0, tz: 0, agitation: 0, cue: 0 };
  const shake = { ax: 0, az: 0 }, slow = { ax: 0, az: 0 };
  const bubbles = Array.from({ length: bubbleCount }, () => ({ alive: false, x: 0, y: 0, z: 0, vy: 0, size: 0, phase: 0 }));
  let spawn = 0, lastVx = 0, lastVz = 0;
  const K = 190, C = 1.5;          // sloshing at about 2.2 Hz, lightly damped: it keeps swinging a while
  const WAVE = 1.8, DAMP = 2.2;    // ripple speed (units/s) and how fast ripples die
  const index = (i, j) => clamp(j, 0, cells) * n + clamp(i, 0, cells);

  /** Surface offset at (x, z) from the tilt plane and the ripples. */
  function surface(x, z) {
    const ny = Math.sqrt(Math.max(.2, 1 - state.x * state.x - state.z * state.z));
    const fi = clamp((x + half) / step, 0, cells), fj = clamp((z + half) / step, 0, cells);
    const i = Math.min(cells - 1, Math.floor(fi)), j = Math.min(cells - 1, Math.floor(fj)), u = fi - i, w = fj - j;
    const wave = (h[index(i, j)] * (1 - u) + h[index(i + 1, j)] * u) * (1 - w) + (h[index(i, j + 1)] * (1 - u) + h[index(i + 1, j + 1)] * u) * w;
    return -(state.x * x + state.z * z) / ny + wave;
  }

  function substep(dt, level, bottom) {
    // Tilt spring toward the felt gravity.
    state.vx += (K * (state.tx - state.x) - C * state.vx) * dt; state.vz += (K * (state.tz - state.z) - C * state.vz) * dt;
    state.x = clamp(state.x + state.vx * dt, -.75, .75); state.z = clamp(state.z + state.vz * dt, -.75, .75);
    // Ripples: the wave equation with walls that reflect, driven by the quick part of the acceleration
    // (a shake tilts the water back and forth faster than the spring alone follows).
    const c2 = WAVE * WAVE / (step * step);
    for (let j = 0; j <= cells; j++) for (let i = 0; i <= cells; i++) {
      const k = j * n + i;
      lap[k] = h[index(i - 1, j)] + h[index(i + 1, j)] + h[index(i, j - 1)] + h[index(i, j + 1)] - 4 * h[k];
    }
    let mean = 0;
    for (let j = 0; j <= cells; j++) for (let i = 0; i <= cells; i++) {
      const k = j * n + i, x = -half + i * step, z = -half + j * step;
      v[k] += (c2 * lap[k] - DAMP * v[k] - (shake.ax * x + shake.az * z) * 2.2) * dt;
      h[k] = clamp(h[k] + v[k] * dt, -.07, .07); mean += h[k];
    }
    mean /= n * n; for (let k = 0; k < h.length; k++) h[k] -= mean; // the water neither grows nor shrinks
    // Bubbles: more of them the more agitated the water is; they wobble up and pop at the surface.
    const depth = level - bottom;
    if (depth > .01) {
      spawn += dt * (1.2 + state.agitation * 70);
      while (spawn > 1) {
        spawn--;
        const b = bubbles.find(o => !o.alive); if (!b) break;
        const churned = random() < Math.min(.85, state.agitation);
        b.alive = true; b.size = .004 + random() * (.008 + state.agitation * .006); b.phase = random() * 6.28;
        b.x = (random() * 2 - 1) * half * .8; b.z = (random() * 2 - 1) * half * .8;
        b.y = churned ? bottom + random() * depth * .9 : bottom + .01; b.vy = churned ? .05 + random() * .1 : .01;
      }
    }
    for (const b of bubbles) {
      if (!b.alive) continue;
      b.vy = Math.min(.09 + b.size * 14, b.vy + .55 * dt); b.y += b.vy * dt; b.phase += dt * (9 + b.size * 300);
      b.x = clamp(b.x + Math.sin(b.phase) * .025 * dt - state.vx * .01 * dt, -half * .9, half * .9);
      b.z = clamp(b.z + Math.cos(b.phase * .8) * .025 * dt - state.vz * .01 * dt, -half * .9, half * .9);
      if (depth <= .01 || b.y + b.size > level + surface(b.x, b.z)) {
        b.alive = false;
        const k = index(Math.round((b.x + half) / step), Math.round((b.z + half) / step));
        v[k] -= .6 * b.size * 30;
      }
    }
  }

  return {
    state, bubbles, cells, half, heights: h,
    /**
     * dt: seconds; felt: the surface normal the liquid wants (bottle-local "up" of gravity minus the
     * bottle's acceleration, unit length); quick: the quick, shaking part of the acceleration in the
     * bottle's x and z (m/s²); level, bottom: the resting surface and the floor (bottle-local y).
     */
    update(dt, { felt = { x: 0, y: 1, z: 0 }, quick = { x: 0, z: 0 }, level = 0, bottom = -.2 } = {}) {
      let remaining = Math.min(.1, Math.max(0, dt));
      state.tx = clamp(felt.x, -.7, .7); state.tz = clamp(felt.z, -.7, .7);
      slow.ax += (quick.x - slow.ax) * Math.min(1, dt * 6); slow.az += (quick.z - slow.az) * Math.min(1, dt * 6);
      shake.ax = clamp(quick.x - slow.ax, -60, 60); shake.az = clamp(quick.z - slow.az, -60, 60);
      // Agitation: what the shaking puts in (and big sloshes), lost over a few seconds.
      const input = (Math.hypot(shake.ax, shake.az) / 40 + Math.hypot(state.vx, state.vz) * .05) * dt;
      state.agitation = clamp(state.agitation * Math.exp(-dt / 2.8) + input, 0, 1.5);
      // A cue for the sound: the swing turns round at the wall with some force.
      if (Math.sign(state.vx) !== Math.sign(lastVx) && Math.abs(state.x) > .14 || Math.sign(state.vz) !== Math.sign(lastVz) && Math.abs(state.z) > .14) state.cue = Math.min(1, Math.hypot(state.x, state.z) * 2);
      lastVx = state.vx; lastVz = state.vz;
      while (remaining > 0) { const h = Math.min(1 / 240, remaining); remaining -= h; substep(h, level, bottom); }
      return state;
    },
    surface,
    /** A push on the surface (old slosh API, kept for scripted jolts). */
    impulse(x, z) { state.vx += clamp(x, -3, 3); state.vz += clamp(z, -3, 3); },
    /** Takes the sound cue (0 when nothing to play). */
    takeCue() { const c = state.cue; state.cue = 0; return c; },
    reset() {
      Object.assign(state, { x: 0, z: 0, vx: 0, vz: 0, tx: 0, tz: 0, agitation: 0, cue: 0 });
      h.fill(0); v.fill(0); for (const b of bubbles) b.alive = false; spawn = 0;
    },
  };
}

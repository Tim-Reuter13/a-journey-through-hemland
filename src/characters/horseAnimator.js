import * as THREE from 'three';

// HORSES · procedural animation for the Blockbench horses (art/blockbench/models.js horse()). The gaits are
// driven by distance travelled, each leg on its own beat in the stride: the walk in four beats, the trot in
// diagonal pairs, the canter in three with the right fore leading, the gallop in four with a moment of flight.
// A leg sweeps back while its hoof stands and folds as it swings forward; the body bobs, rocks or stretches
// with the gait and the neck pumps with it. Standing, the horse breathes, flicks its ears, swishes its tail,
// rests a hind leg, paws, shakes itself or grazes. Mane, forelock, tail and stirrups hang on springs that the
// body's motion, its turns and the wind swing about. Angles in radians; the rig faces −Z, a positive X turn
// swings a hanging limb forward and lifts a neck.
const TAU = Math.PI * 2, clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp, smooth = THREE.MathUtils.smoothstep;
const damp = (current, target, rate, dt) => lerp(current, target, 1 - Math.exp(-rate * dt));
const wrap = a => THREE.MathUtils.euclideanModulo(a + Math.PI, TAU) - Math.PI;

// Legs in the order the gaits list their beats: left hind, left fore, right hind, right fore.
export const LEGS = [['rear', 'left'], ['front', 'left'], ['rear', 'right'], ['front', 'right']];
// speed: where the gait is at home (units/s); stride: ground covered by one cycle of all four legs; duty: share
// of the cycle a hoof carries weight; start: when each leg's hoof comes down. fore/hind: sweep, fold and flick
// of a leg. bob/pitch/roll: the body; nod: the neck's pump; neck/head: carriage; ears: laid back at speed.
export const GAITS = {
  walk: { speed: 2.4, stride: 2.6, duty: .64, start: [0, .25, .5, .75], fore: [.36, .55, .4], hind: [.32, .42, .35], bob: .03, pitch: .012, roll: .03, nod: .07, beats: 2, neck: 0, head: 0, ears: 0 },
  trot: { speed: 5.2, stride: 3.5, duty: .42, start: [0, .5, .5, 0], fore: [.4, .85, .55], hind: [.38, .65, .45], bob: .06, pitch: .015, roll: .015, nod: .03, beats: 2, neck: -.06, head: .04, ears: .1 },
  canter: { speed: 8.6, stride: 4.3, duty: .36, start: [0, .32, .32, .62], fore: [.44, .95, .6], hind: [.42, .72, .5], bob: .08, pitch: .075, roll: .01, nod: .13, beats: 1, neck: -.15, head: .1, ears: .25 },
  gallop: { speed: 13.5, stride: 6.4, duty: .3, start: [0, .38, .1, .48], fore: [.52, 1.1, .65], hind: [.5, .82, .55], bob: .07, pitch: .06, roll: .01, nod: .17, beats: 1, neck: -.32, head: .26, ears: .45 },
};
export const GAIT_ORDER = ['walk', 'trot', 'canter', 'gallop'];
/** The gait a horse falls into at a speed, with some hysteresis around the current one. */
export function gaitFor(speed, current = 'walk') {
  const bounds = { walk: [0, 3.9], trot: [3.3, 7.2], canter: [6.4, 11.2], gallop: [10.4, Infinity] }[current];
  if (bounds && speed >= bounds[0] && speed < bounds[1]) return current;
  return speed < 3.6 ? 'walk' : speed < 6.8 ? 'trot' : speed < 10.8 ? 'canter' : 'gallop';
}

/** One leg's turns at u, its own place in the stride (0 = the hoof comes down): [upper, lower, hoof]. */
export function legAngles(front, u, duty, [sweep, fold, flick], out = [0, 0, 0]) {
  if (u < duty) {
    // Stance: the straight leg sweeps from forward to back under the body; the fetlock gives a little under the
    // weight and toward the end the hoof starts to roll over its toe.
    const s = u / duty;
    out[0] = lerp(sweep, -sweep, s);
    out[1] = front ? 0 : .08 * Math.sin(Math.PI * s);
    out[2] = .1 * Math.sin(Math.PI * s) - .25 * smooth(s, .7, 1);
  } else {
    // Swing: the joints fold quickly as the hoof leaves the ground (the fore knee back, the hock forward) and hold,
    // then the leg straightens and reaches forward well before it lands, the toe a little up.
    const q = (u - duty) / (1 - duty), bend = smooth(q, 0, .3) * (1 - smooth(q, .55, .88));
    out[0] = lerp(-sweep, sweep * 1.06, smooth(q, .08, .82)) - sweep * .06 * smooth(q, .85, 1);
    out[1] = (front ? -fold : fold) * bend;
    out[2] = lerp(-.25, -flick, smooth(q, 0, .25)) * (1 - smooth(q, .5, .85)) + .12 * Math.sin(Math.PI * smooth(q, .75, 1));
  }
  return out;
}

// A hanging chain of bones on springs (tail, mane): each link pulls toward its target turn about X and Z and
// is dragged by its parent's swing, so a whip travels down the chain.
function chain(rig, names, { stiffness, damping, drag = .5 }) {
  const links = names.map((name, i) => ({ bone: rig[name], x: 0, z: 0, vx: 0, vz: 0, k: stiffness[i], c: damping[i] })).filter(l => l.bone);
  return {
    links,
    step(dt, targets) {
      let ax0 = 0, az0 = 0;
      links.forEach((l, i) => {
        const [tx, tz] = targets[i];
        const ax = l.k * (tx - l.x) - l.c * l.vx - drag * ax0, az = l.k * (tz - l.z) - l.c * l.vz - drag * az0;
        l.vx += ax * dt; l.vz += az * dt; l.x = clamp(l.x + l.vx * dt, -1.6, 1.6); l.z = clamp(l.z + l.vz * dt, -1.4, 1.4);
        ax0 = ax; az0 = az;
      });
    },
  };
}

class Pose {
  constructor() { this.bones = new Map(); }
  reset() { for (const v of this.bones.values()) { v[0] = 0; v[1] = 0; v[2] = 0; } this.bodyY = 0; this.rootY = 0; this.rootZ = 0; this.rootPitch = 0; this.rootRoll = 0; }
  add(name, x = 0, y = 0, z = 0, w = 1) { let v = this.bones.get(name); if (!v) { v = [0, 0, 0]; this.bones.set(name, v); } v[0] += x * w; v[1] += y * w; v[2] += z * w; return this; }
}
const IDLES = ['look', 'ears', 'swish', 'rest', 'paw', 'shake', 'graze', 'snort'];
const _target = new THREE.Vector3(), _leg = [0, 0, 0];

/**
 * Animates one horse model (createCharacter('horse_*')). update(dt, input) with input:
 *   gait: hold this gait instead of choosing by speed; look: point to turn the head to (or null);
 *   wind: [x, z] world wind; mode: 'free' | 'tied' | 'ridden' | 'led'; airborne, vy: a jump; rear: 0..1;
 *   slope: ground pitch along the body (radians, nose up > 0); calm: never graze or rest (busy horses).
 * Read back speed, phase, gait, gaits (weights) and footfalls (legs whose hoof came down this frame).
 */
export function createHorseAnimator(model) {
  const rig = model.userData.rig;
  const last = new THREE.Vector3().copy(model.position);
  const state = { speed: 0, phase: Math.random(), move: 0, time: Math.random() * 30, gait: 'walk', weights: { walk: 1, trot: 0, canter: 0, gallop: 0 },
    dirF: 1, prevF: 0, accF: 0, yawRate: 0, lastYaw: model.rotation.y, bodyY: 0, bodyVy: 0, bodyAy: 0, idle: null, idleT: 0, idleLen: 0, nextIdle: 2 + Math.random() * 4,
    restSide: Math.random() < .5 ? 'left' : 'right', look: 0, lookPitch: 0, graze: 0, rest: 0, pawLeg: 'right', lastU: [0, 0, 0, 0], ears: [0, 0], earT: [0, 0], swish: 0, chew: 0 };
  const footfalls = [];
  const tail = chain(rig, ['tail_1', 'tail_2', 'tail_3', 'tail_4'], { stiffness: [70, 55, 42, 32], damping: [9, 7, 6, 5], drag: .45 });
  const mane = chain(rig, ['mane_4', 'mane_3', 'mane_2', 'mane_1'], { stiffness: [80, 70, 62, 55], damping: [8, 7, 7, 6], drag: .35 });
  const loose = chain(rig, ['forelock', 'stirrup_right', 'stirrup_left'], { stiffness: [90, 60, 60], damping: [8, 5, 5], drag: 0 });
  const pose = new Pose();
  const tailTargets = [[0, 0], [0, 0], [0, 0], [0, 0]], maneTargets = [[0, 0], [0, 0], [0, 0], [0, 0]], looseTargets = [[0, 0], [0, 0], [0, 0]];

  function chooseIdle(input) {
    // What a standing horse does next: grazing only when free, resting more when tied, pawing when kept waiting.
    const free = input.mode === 'free' && !input.calm, tied = input.mode === 'tied';
    const weights = { look: 3, ears: 2, swish: 3, rest: tied ? 2.5 : free ? 1.2 : .4, paw: tied ? 1 : .3, shake: .5, graze: free ? 3.5 : 0, snort: 1 };
    let roll = Math.random() * Object.values(weights).reduce((a, b) => a + b, 0);
    for (const kind of IDLES) { roll -= weights[kind]; if (roll <= 0) return kind; }
    return 'look';
  }
  const IDLE_LENGTH = { look: [2, 4], ears: [1, 2], swish: [1.2, 1.8], rest: [8, 20], paw: [1.4, 2.4], shake: [.9, 1.1], graze: [6, 16], snort: [.7, .9] };

  function update(dt, input = {}) {
    if (dt <= 0) return;
    state.time += dt;
    const t = state.time;
    footfalls.length = 0;
    // Speed and direction from the model's actual displacement keep the hooves on the ground.
    const vx = model.position.x - last.x, vz = model.position.z - last.z, moved = Math.hypot(vx, vz);
    last.copy(model.position);
    const raw = moved / dt > 40 ? 0 : moved / dt;
    state.speed = damp(state.speed, raw, 9, dt);
    const yaw = model.rotation.y, f = (-vx * Math.sin(yaw) - vz * Math.cos(yaw)) / dt;
    if (raw > .3 && raw < 40) state.dirF = damp(state.dirF, Math.sign(f) || 1, 6, dt);
    const accel = raw < 40 ? (f - state.prevF) / dt : 0; state.prevF = raw < 40 ? f : 0;
    state.accF = damp(state.accF, clamp(accel, -20, 20), 5, dt);
    const yawDelta = wrap(yaw - state.lastYaw); state.lastYaw = yaw;
    state.yawRate = damp(state.yawRate, clamp(yawDelta / dt, -4, 4), 6, dt);

    // Gait: held by the rider or chosen by speed; the legs blend over a few tenths of a second.
    const turning = Math.abs(state.yawRate) > .45 && state.speed < 1.2;
    const pace = Math.max(state.speed, turning ? 1.4 : 0);
    state.gait = input.gait || gaitFor(state.speed, state.gait);
    let total = 0;
    for (const g of GAIT_ORDER) { state.weights[g] = damp(state.weights[g], g === state.gait ? 1 : 0, 6.5, dt); total += state.weights[g]; }
    for (const g of GAIT_ORDER) state.weights[g] /= total;
    const W = state.weights, mix = key => W.walk * GAITS.walk[key] + W.trot * GAITS.trot[key] + W.canter * GAITS.canter[key] + W.gallop * GAITS.gallop[key];
    state.move = damp(state.move, clamp(pace / .9, 0, 1), 7, dt);
    const stride = mix('stride');
    state.phase = THREE.MathUtils.euclideanModulo(state.phase + pace * dt / stride * (state.dirF < 0 ? -1 : 1), 1);
    const w = state.move, idle = 1 - w, p = state.phase * TAU;
    pose.reset();

    // ── Legs: every gait's angles for this leg on the shared phase, weighted.
    LEGS.forEach(([set, side], i) => {
      let a0 = 0, a1 = 0, a2 = 0;
      for (const g of GAIT_ORDER) {
        const k = W[g]; if (k < .01) continue;
        const G = GAITS[g], u = THREE.MathUtils.euclideanModulo(state.phase - G.start[i], 1);
        legAngles(set === 'front', u, G.duty, set === 'front' ? G.fore : G.hind, _leg);
        a0 += _leg[0] * k; a1 += _leg[1] * k; a2 += _leg[2] * k;
      }
      pose.add(`${set}_upper_${side}`, a0 * w); pose.add(`${set}_lower_${side}`, a1 * w); pose.add(`${set}_hoof_${side}`, a2 * w);
      // A footfall when this leg's hoof comes down in the gait that leads now.
      const G = GAITS[state.gait], u = THREE.MathUtils.euclideanModulo(state.phase - G.start[i], 1);
      if (w > .3 && !input.airborne && u < state.lastU[i] && state.lastU[i] - u > .5) footfalls.push(i);
      state.lastU[i] = u;
    });

    // ── Body: the walk sways and nods twice a stride, the trot bounces on its diagonals, the canter rocks like
    // a rocking horse, the gallop stretches and gathers.
    const twice = W.walk + W.trot, once = W.canter + W.gallop;
    const bob = -mix('bob') * w * (twice * (.5 - .5 * Math.cos(2 * p)) + once * (.5 - .5 * Math.cos(p - .6)));
    pose.bodyY += bob;
    pose.add('body', (mix('pitch') * Math.sin(p + .4) * once + mix('pitch') * Math.sin(2 * p) * twice) * w, 0, mix('roll') * Math.sin(p) * w);
    pose.add('hips', 0, 0, -mix('roll') * .8 * Math.sin(p) * w);
    const nod = mix('nod') * w * (twice * Math.sin(2 * p + 1.2) + once * Math.sin(p + 1.7));
    pose.add('neck_1', mix('neck') * w + nod * .6 - clamp(state.accF * .012, -.12, .12));
    pose.add('neck_2', nod * .4 + mix('neck') * .3 * w);
    pose.add('head', mix('head') * w - nod * .5);
    // Hard braking sits the horse back on its hocks, head up; driving on it reaches forward.
    const brake = clamp(-state.accF / 10, 0, 1) * clamp(state.speed / 5, 0, 1);
    if (brake > .01) { pose.add('body', -.08 * brake); pose.add('neck_1', .2 * brake); pose.add('head', -.1 * brake);
      for (const side of ['right', 'left']) { pose.add(`rear_upper_${side}`, .28 * brake); pose.add(`front_upper_${side}`, .22 * brake); } }
    // Leaning into turns at speed; the ground's slope tilts the whole horse.
    pose.rootRoll += clamp(-state.yawRate * state.speed * .012, -.14, .14);
    pose.rootPitch += clamp(input.slope || 0, -.35, .35);

    // ── Standing: breath, the idle repertoire.
    const breath = Math.sin(t * 1.5) * idle;
    pose.add('chest', breath * .012); pose.add('neck_1', breath * .015);
    if (w > .4 || input.mode === 'ridden' && state.idle === 'graze') state.idle = null;
    state.nextIdle -= dt * idle;
    if (!state.idle && state.nextIdle <= 0 && idle > .8) {
      state.idle = chooseIdle(input); state.idleT = 0;
      const [a, b] = IDLE_LENGTH[state.idle]; state.idleLen = a + Math.random() * (b - a);
      state.nextIdle = 1.5 + Math.random() * 4;
      if (state.idle === 'paw') state.pawLeg = Math.random() < .5 ? 'left' : 'right';
      if (state.idle === 'rest') state.restSide = Math.random() < .5 ? 'left' : 'right';
      if (state.idle === 'swish') state.swish = (Math.random() < .5 ? -1 : 1) * (.7 + Math.random() * .4);
      if (state.idle === 'look') { state.lookYaw = (Math.random() - .5) * 1.4; state.lookUp = (Math.random() - .3) * .3; }
    }
    if (state.idle) { state.idleT += dt; if (state.idleT > state.idleLen) state.idle = null; }
    const k = state.idle ? smooth(state.idleT, 0, .45) * (1 - smooth(state.idleT, state.idleLen - .5, state.idleLen)) * idle : 0;
    state.graze = damp(state.graze, state.idle === 'graze' ? idle : 0, 2.2, dt);
    state.rest = damp(state.rest, state.idle === 'rest' ? idle : 0, 2.5, dt);
    switch (state.idle) {
      case 'look': pose.add('neck_1', state.lookUp * k, state.lookYaw * .5 * k); pose.add('head', state.lookUp * .5 * k, state.lookYaw * .5 * k); break;
      case 'paw': { const s = state.pawLeg, beat = Math.sin(state.idleT * 7.5);
        pose.add(`front_upper_${s}`, (.45 + .3 * beat) * k); pose.add(`front_lower_${s}`, (-1.1 + .5 * beat) * k); pose.add(`front_hoof_${s}`, -.3 * k); pose.add('neck_1', -.1 * k); break; }
      case 'shake': { const s = Math.sin(state.idleT * 22) * Math.sin(Math.PI * state.idleT / state.idleLen);
        pose.add('neck_1', 0, s * .22); pose.add('neck_2', 0, s * .18, s * .15); pose.add('head', 0, s * .2, s * .3); pose.add('body', 0, 0, s * .04); break; }
      case 'snort': pose.add('neck_1', .14 * Math.sin(Math.PI * state.idleT / state.idleLen)); pose.add('head', -.2 * Math.sin(Math.PI * state.idleT / state.idleLen)); break;
    }
    // Grazing: the neck goes down to the grass, the head tears and chews, a front leg steps forward.
    if (state.graze > .01) {
      const g = state.graze, chew = Math.max(0, Math.sin(t * 5.5));
      pose.add('neck_1', -1.05 * g); pose.add('neck_2', -.42 * g); pose.add('head', (.18 + chew * .1) * g, Math.sin(t * .7) * .12 * g);
      pose.add('front_upper_left', .16 * g); pose.add('front_lower_left', -.05 * g); pose.add('front_upper_right', -.08 * g); pose.bodyY -= .03 * g;
    }
    // Resting a hind leg: the hock bends, the hoof stands on its toe, the hip on that side drops, the head sinks.
    if (state.rest > .01) {
      const r = state.rest, s = state.restSide;
      pose.add(`rear_upper_${s}`, .08 * r); pose.add(`rear_lower_${s}`, .42 * r); pose.add(`rear_hoof_${s}`, -.62 * r);
      pose.add('hips', 0, 0, (s === 'left' ? .05 : -.05) * r); pose.add('neck_1', -.22 * r); pose.add('head', -.12 * r);
    }

    // ── Rearing (a spooked horse): up on the hind legs, forelegs folded and pawing the air.
    const rear = clamp(input.rear || 0, 0, 1);
    if (rear > .01) {
      const lift = .82 * rear;
      pose.rootPitch += lift;
      for (const side of ['right', 'left']) {
        const kick = Math.sin(t * 9 + (side === 'left' ? 1.5 : 0)) * rear;
        pose.add(`front_upper_${side}`, (.85 + kick * .35) * rear); pose.add(`front_lower_${side}`, (-1.55 + kick * .3) * rear); pose.add(`front_hoof_${side}`, -.5 * rear);
        pose.add(`rear_upper_${side}`, -.55 * rear); pose.add(`rear_lower_${side}`, .35 * rear);
      }
      pose.add('neck_1', .35 * rear); pose.add('head', -.25 * rear);
    }
    // ── A jump: forelegs tucked on the way up, hind legs trailing; landing reaches for the ground.
    if (input.airborne) {
      const up = clamp((input.vy || 0) / 6, -1, 1);
      pose.rootPitch += up * .18;
      for (const side of ['right', 'left']) {
        pose.add(`front_upper_${side}`, .75 - .35 * Math.max(0, -up)); pose.add(`front_lower_${side}`, -1.5 + Math.max(0, -up)); pose.add(`front_hoof_${side}`, -.5);
        pose.add(`rear_upper_${side}`, -.45 - .2 * up); pose.add(`rear_lower_${side}`, .2); pose.add(`rear_hoof_${side}`, -.3);
      }
      pose.add('neck_1', -.15 * up);
    }

    // ── Head toward what holds its interest (the rider's hand, someone close), ears after it.
    let lookYaw = 0, lookPitch = 0;
    if (input.look && state.graze < .3) {
      model.getWorldPosition(_target);
      const dx = input.look.x - _target.x, dz = input.look.z - _target.z;
      lookYaw = clamp(wrap(Math.atan2(-dx, -dz) - yaw), -1.1, 1.1);
      lookPitch = clamp(Math.atan2(input.look.y - _target.y - 3, Math.hypot(dx, dz)), -.35, .3);
    }
    state.look = damp(state.look, lookYaw, 3, dt); state.lookPitch = damp(state.lookPitch, lookPitch, 3, dt);
    pose.add('neck_1', state.lookPitch * .4, state.look * .3); pose.add('neck_2', 0, state.look * .3); pose.add('head', state.lookPitch * .4, state.look * .35);
    // Ears: forward toward what it looks at, laid back at speed, flicking now and then one at a time.
    for (const [e, side] of [[0, 'right'], [1, 'left']]) {
      state.earT[e] -= dt;
      if (state.earT[e] <= 0) { state.earT[e] = .6 + Math.random() * (state.idle === 'ears' ? .8 : 3.5); state.ears[e] = Math.random() < .35 ? .7 : Math.random() < .5 ? -.15 : .15; }
      const back = mix('ears') * w + (state.idle === 'rest' ? .35 : 0), turn = (side === 'right' ? -1 : 1) * state.look * .4;
      pose.add(`ear_${side}`, back + state.ears[e] * .6, (side === 'right' ? -1 : 1) * state.ears[e] * .5 + turn, 0);
    }

    // ── Springs: tail, mane, forelock, stirrups. Inertia against the body's acceleration, out of turns, the
    // bounce of the gait, the wind; at speed the tail streams and the mane lifts and flaps.
    const prevVy = state.bodyVy; state.bodyVy = (pose.bodyY - state.bodyY) / dt; state.bodyY = pose.bodyY;
    state.bodyAy = damp(state.bodyAy, clamp((state.bodyVy - prevVy) / dt, -30, 30), 20, dt);
    const windX = input.wind?.[0] || 0, windZ = input.wind?.[1] || 0;
    const windSide = windX * Math.cos(yaw) - windZ * Math.sin(yaw), gust = Math.sin(t * 2.3) * .5 + Math.sin(t * 5.7) * .25;
    const run = clamp((state.speed - 3) / 9, 0, 1), fly = clamp(state.speed / 13, 0, 1);
    if (state.idle === 'swish' && state.idleT < .15) tail.links[0].vz += state.swish * 9;
    if (idle > .8 && Math.random() < dt * .08) tail.links[0].vz += (Math.random() - .5) * 8;
    const side = -state.yawRate * state.speed * .03 + windSide * (.12 + .06 * gust);
    tail.links.forEach((l, i) => { tailTargets[i][0] = -(.12 + .35 * run + .25 * fly) * (i ? .55 : 1) + state.bodyAy * .006 + state.accF * .01; tailTargets[i][1] = side * (1 + i * .3) + Math.sin(t * 9 - i * .9) * .08 * fly; });
    tail.step(dt, tailTargets);
    mane.links.forEach((l, i) => { maneTargets[i][0] = state.accF * .004 + state.bodyAy * .004; maneTargets[i][1] = .12 * run + .22 * fly * (.6 + .4 * Math.sin(t * 13 - i * 1.1)) + windSide * .1 * (1 + gust) - state.yawRate * state.speed * .01; });
    mane.step(dt, maneTargets);
    looseTargets[0][0] = state.bodyAy * .008 - .2 * fly; looseTargets[0][1] = windSide * .1;
    for (const s of [1, 2]) { looseTargets[s][0] = -state.accF * .02 + state.bodyAy * .004; looseTargets[s][1] = (s === 1 ? 1 : -1) * (Math.abs(state.bodyAy) * .004 + .02 * run) - state.yawRate * state.speed * .01; }
    loose.step(dt, looseTargets);
    for (const c of [tail, mane, loose]) for (const l of c.links) pose.add(l.bone.name, l.x, 0, l.z);

    apply();
  }

  function apply() {
    for (const [name, bone] of Object.entries(rig)) {
      const rest = bone.userData.rest; if (!rest) continue;
      const v = pose.bones.get(name);
      if (v && (v[0] || v[1] || v[2])) { bone.rotation.set(v[0], v[1], v[2]); bone.quaternion.premultiply(rest.quaternion); }
      else bone.quaternion.copy(rest.quaternion);
    }
    if (rig.body) rig.body.position.y = rig.body.userData.rest.position.y + pose.bodyY;
    // The root turns about the hind hooves when the horse rears (so they stay on the ground), about its middle
    // on a slope.
    const root = rig.root;
    if (root) {
      const pitch = pose.rootPitch, hind = pitch > 0 ? 1.15 : 0;
      root.rotation.set(pitch, 0, pose.rootRoll);
      root.position.set(0, root.userData.rest.position.y + hind * Math.sin(pitch), hind * (1 - Math.cos(pitch)));
    }
  }

  return {
    update, footfalls,
    get speed() { return state.speed; }, get phase() { return state.phase; }, get gait() { return state.gait; }, get weights() { return state.weights; },
    get idle() { return state.idle; }, get grazing() { return state.graze; },
  };
}

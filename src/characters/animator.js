import * as THREE from 'three';

// Procedural animation for the Blockbench rigs. Principles: the gait is driven
// by distance travelled (no foot sliding), knees and elbows bend, hips and
// shoulders counter-rotate, cloth lags behind, attacks have anticipation, a
// fast strike and follow-through. Angles in radians; the rigs face -Z, so a
// positive X rotation swings a hanging limb forward and tilts a head up.
const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const HAMMER_RATE = .55;
const ease = {
  linear: t => t,
  in: t => t * t * t,
  out: t => 1 - (1 - t) ** 3,
  inOut: t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2,
  snap: t => 1 - (1 - t) ** 5,
};
const damp = (current, target, rate, dt) => lerp(current, target, 1 - Math.exp(-rate * dt));
const wrapAngle = a => THREE.MathUtils.euclideanModulo(a + Math.PI, TAU) - Math.PI;

// Held swords are aimed, not just parented: the blade (model +Y) points where the stance wants it
// and the cutting edge (model ±X, the blade's width) faces the target, so nobody fights with the
// flat. Directions in body space (front −Z, right +X). In a swing the blade continues the forearm
// and the edge leads along the path of the hand.
const BLADE = { rest: [.04, -.93, -.36], ready: [-.14, .4, -.9], guard: [-.36, .66, -.66] };
const _body = new THREE.Quaternion(), _grip = new THREE.Quaternion(), _arm = new THREE.Quaternion(), _target = new THREE.Quaternion();
const _blade = new THREE.Vector3(), _edge = new THREE.Vector3(), _side = new THREE.Vector3(), _hand = new THREE.Vector3(), _basis = new THREE.Matrix4();
function aimSword(character, input, state, dt) {
  const weapon = character.userData.weapon, rig = character.userData.rig;
  if (!weapon || !character.userData.weaponName?.startsWith('sword') || !rig.arm_lower_right) return;
  character.updateMatrixWorld(true);
  character.getWorldQuaternion(_body);
  rig.hand_right.getWorldPosition(_hand);
  const swinging = input.action?.kind === 'sword' || input.windup > 0 || input.strike > 0;
  if (swinging) {
    rig.arm_lower_right.getWorldQuaternion(_arm);
    _blade.set(0, -1, 0).applyQuaternion(_arm).addScaledVector(_side.set(0, 1, 0), .2).normalize();
    if (state.hand && dt > 0) _edge.subVectors(_hand, state.hand); else _edge.set(0, 0, 0);
  } else {
    _blade.fromArray(BLADE[input.guard ? 'guard' : input.combat ? 'ready' : 'rest']).applyQuaternion(_body).normalize();
    _edge.set(0, 0, -1).applyQuaternion(_body);
  }
  (state.hand ??= new THREE.Vector3()).copy(_hand);
  _edge.addScaledVector(_blade, -_edge.dot(_blade));
  if (_edge.lengthSq() < 1e-6) { if (!state.edge) return; _edge.copy(state.edge).addScaledVector(_blade, -state.edge.dot(_blade)); }
  _edge.normalize();
  // A two-edged blade: keep whichever edge is nearer, so it never spins half a turn.
  if (state.edge && _edge.dot(state.edge) < 0) _edge.negate();
  (state.edge ??= new THREE.Vector3()).lerp(_edge, swinging ? .5 : 1).normalize();
  _side.crossVectors(state.edge, _blade);
  _basis.makeBasis(state.edge, _blade, _side);
  _target.setFromRotationMatrix(_basis);
  weapon.parent.getWorldQuaternion(_grip).invert();
  _target.premultiply(_grip);
  if (state.aimed) weapon.quaternion.slerp(_target, 1 - Math.exp(-(swinging ? 30 : 12) * dt)); else weapon.quaternion.copy(_target);
  state.aimed = true;
}

// Two-bone arm IK for holds that must meet a point (the bow grip, the drawn string): turns the upper
// arm and the forearm so the grip reaches `target`, the elbow bending toward `pole`. Runs after the
// pose is applied, so every frame starts from the animated arm and never accumulates twist.
const _s = new THREE.Vector3(), _e = new THREE.Vector3(), _h = new THREE.Vector3(), _d = new THREE.Vector3(), _bend = new THREE.Vector3(), _elbow = new THREE.Vector3();
const _from = new THREE.Vector3(), _to = new THREE.Vector3(), _turn = new THREE.Quaternion(), _world = new THREE.Quaternion(), _parent = new THREE.Quaternion();
function turnBone(bone, from, to) {
  _turn.setFromUnitVectors(from, to);
  bone.getWorldQuaternion(_world).premultiply(_turn);
  bone.parent.getWorldQuaternion(_parent).invert();
  bone.quaternion.copy(_parent.multiply(_world));
  bone.updateMatrixWorld(true);
}
export function solveArm(character, side, target, pole) {
  const rig = character.userData.rig, upper = rig[`arm_upper_${side}`], lower = rig[`arm_lower_${side}`], grip = rig[`grip_${side}`] || rig[`hand_${side}`];
  if (!upper || !lower || !grip) return;
  upper.updateWorldMatrix(true, true);
  upper.getWorldPosition(_s); lower.getWorldPosition(_e); grip.getWorldPosition(_h);
  const l1 = _s.distanceTo(_e), l2 = _e.distanceTo(_h);
  _d.subVectors(target, _s);
  const reach = clamp(_d.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3); _d.normalize();
  const cos = clamp((l1 * l1 + reach * reach - l2 * l2) / (2 * l1 * reach), -1, 1);
  _bend.subVectors(pole, _s); _bend.addScaledVector(_d, -_bend.dot(_d)).normalize();
  _elbow.copy(_s).addScaledVector(_d, cos * l1).addScaledVector(_bend, Math.sqrt(1 - cos * cos) * l1);
  turnBone(upper, _from.subVectors(_e, _s).normalize(), _to.subVectors(_elbow, _s).normalize());
  lower.getWorldPosition(_e); grip.getWorldPosition(_h);
  turnBone(lower, _from.subVectors(_h, _e).normalize(), _to.subVectors(target, _e).normalize());
}

class Pose {
  constructor() { this.bones = new Map(); this.hipsY = 0; this.hipsX = 0; this.rootZ = 0; this.rootY = 0; this.rootX = 0; }
  get(name) { let v = this.bones.get(name); if (!v) { v = [0, 0, 0]; this.bones.set(name, v); } return v; }
  add(name, x = 0, y = 0, z = 0, w = 1) { const v = this.get(name); v[0] += x * w; v[1] += y * w; v[2] += z * w; return this; }
}

// Keyframed upper-body poses: [time, {bone: [x, y, z], hipsY}, easing into this key].
const SWORD = [
  [ // 0: forehand slash, right to left
    [0, {}],
    [.3, { arm_upper_right: [.35, -.65, 1.35], arm_lower_right: [1.5, 0, 0], hand_right: [.25, 0, .6], chest: [.05, -.55, 0], torso: [0, -.2, 0], head: [0, .45, 0], arm_upper_left: [.4, 0, -.25], arm_lower_left: [.6, 0, 0] }, 'inOut'],
    [.47, { arm_upper_right: [1.25, .95, .7], arm_lower_right: [.2, 0, 0], hand_right: [-1.05, 0, -.2], chest: [-.05, .55, 0], torso: [-.12, .22, 0], head: [0, -.35, 0], arm_upper_left: [.1, 0, -.35], arm_lower_left: [.4, 0, 0], hipsY: -.04 }, 'snap'],
    [.66, { arm_upper_right: [.95, 1.35, .35], arm_lower_right: [.45, 0, 0], hand_right: [-.95, 0, -.3], chest: [-.06, .75, 0], torso: [-.1, .3, 0], head: [0, -.4, 0], arm_upper_left: [.05, 0, -.3], arm_lower_left: [.35, 0, 0], hipsY: -.05 }, 'out'],
    [1, {}, 'inOut'],
  ],
  [ // 1: backhand, left to right
    [0, {}],
    [.28, { arm_upper_right: [1.05, 1.15, .1], arm_lower_right: [1.65, 0, 0], hand_right: [.3, 0, -.6], chest: [0, .6, 0], torso: [0, .2, 0], head: [0, -.4, 0], arm_upper_left: [.3, 0, -.3] }, 'inOut'],
    [.46, { arm_upper_right: [1.05, -.45, 1.1], arm_lower_right: [.2, 0, 0], hand_right: [-1.05, 0, .3], chest: [-.05, -.55, 0], torso: [-.1, -.25, 0], head: [0, .4, 0], arm_upper_left: [.15, 0, -.45], hipsY: -.04 }, 'snap'],
    [.66, { arm_upper_right: [.75, -.85, 1.35], arm_lower_right: [.35, 0, 0], hand_right: [-.95, 0, .4], chest: [-.05, -.7, 0], torso: [-.08, -.3, 0], head: [0, .45, 0], hipsY: -.05 }, 'out'],
    [1, {}, 'inOut'],
  ],
  [ // 2: heavy overhead chop
    [0, {}],
    [.36, { arm_upper_right: [2.75, .25, .25], arm_lower_right: [1.35, 0, 0], hand_right: [.45, 0, 0], arm_upper_left: [2.55, -.35, -.2], arm_lower_left: [1.25, 0, 0], chest: [.12, -.15, 0], torso: [.14, 0, 0], head: [.15, 0, 0], hipsY: .03 }, 'inOut'],
    [.5, { arm_upper_right: [.9, .3, .1], arm_lower_right: [.1, 0, 0], hand_right: [-.95, 0, 0], arm_upper_left: [.85, -.3, -.1], arm_lower_left: [.3, 0, 0], chest: [-.2, 0, 0], torso: [-.32, 0, 0], head: [-.15, 0, 0], hipsY: -.12 }, 'snap'],
    [.7, { arm_upper_right: [.55, .25, .1], arm_lower_right: [.2, 0, 0], hand_right: [-.85, 0, 0], arm_upper_left: [.5, -.2, -.1], arm_lower_left: [.3, 0, 0], chest: [-.24, 0, 0], torso: [-.38, 0, 0], head: [-.1, 0, 0], hipsY: -.14 }, 'out'],
    [1, {}, 'inOut'],
  ],
];
const CAST = [
  [0, {}],
  [.3, { arm_upper_left: [.4, .3, -.2], arm_lower_left: [1.6, 0, 0], chest: [0, .25, 0], head: [0, -.15, 0] }, 'inOut'],
  [.45, { arm_upper_left: [1.5, .15, -.05], arm_lower_left: [.1, 0, 0], hand_left: [-.4, 0, 0], chest: [-.05, -.4, 0], torso: [-.08, -.15, 0], head: [0, .25, 0] }, 'snap'],
  [.7, { arm_upper_left: [1.4, .1, -.05], arm_lower_left: [.15, 0, 0], chest: [-.03, -.35, 0], head: [0, .2, 0] }, 'out'],
  [1, {}, 'inOut'],
];
const DRINK = [
  [0, {}],
  [.25, { arm_upper_right: [1.1, .7, -.1], arm_lower_right: [2.2, 0, 0], hand_right: [0, 0, 0] }, 'inOut'],
  [.45, { arm_upper_right: [1.35, .8, -.15], arm_lower_right: [2.45, 0, 0], hand_right: [.6, 0, 0], head: [.35, 0, 0], chest: [.06, 0, 0] }, 'inOut'],
  [.75, { arm_upper_right: [1.35, .8, -.15], arm_lower_right: [2.45, 0, 0], hand_right: [.8, 0, 0], head: [.4, 0, 0], chest: [.08, 0, 0] }, 'linear'],
  [1, {}, 'inOut'],
];
// Getting up (HUMANITY MOTION): from the back (legs forward, torso flat behind the hips) or face down
// (legs trailing, torso flat in front). The hips stay the pivot; the body comes up over the feet.
const GETUP_BACK = [
  [0, { hipsY: -.93, leg_upper_right: [1.52, 0, .05], leg_upper_left: [1.52, 0, -.05], torso: [1.45, 0, 0], chest: [.1, 0, 0], head: [-.3, 0, 0], arm_upper_right: [0, 0, .2], arm_upper_left: [0, 0, -.2] }],
  [.25, { hipsY: -.93, leg_upper_right: [1.5, 0, .05], leg_upper_left: [1.5, 0, -.05], torso: [.9, 0, 0], head: [-.4, 0, 0], arm_upper_right: [-.9, 0, .25], arm_upper_left: [-.9, 0, -.25], arm_lower_right: [.9, 0, 0], arm_lower_left: [.9, 0, 0] }, 'inOut'],
  [.45, { hipsY: -.93, leg_upper_right: [1.45, 0, .05], leg_upper_left: [1.45, 0, -.05], leg_lower_right: [-.4, 0, 0], leg_lower_left: [-.4, 0, 0], torso: [.05, 0, 0], chest: [-.1, 0, 0], arm_upper_right: [-.5, 0, .3], arm_upper_left: [-.5, 0, -.3], arm_lower_right: [.2, 0, 0], arm_lower_left: [.2, 0, 0] }, 'inOut'],
  [.62, { hipsY: -.85, leg_upper_right: [2.1, 0, .05], leg_lower_right: [-2.3, 0, 0], foot_right: [.4, 0, 0], leg_upper_left: [1.5, 0, -.05], leg_lower_left: [-.9, 0, 0], torso: [-.45, 0, 0], arm_upper_right: [.6, 0, .1], arm_upper_left: [.3, 0, -.2], arm_lower_right: [.3, 0, 0] }, 'inOut'],
  [.78, { hipsY: -.55, leg_upper_right: [1.5, 0, .06], leg_upper_left: [1.5, 0, -.06], leg_lower_right: [-2.0, 0, 0], leg_lower_left: [-2.0, 0, 0], foot_right: [.5, 0, 0], foot_left: [.5, 0, 0], torso: [-.55, 0, 0], arm_upper_right: [.5, 0, .1], arm_lower_right: [.4, 0, 0], arm_upper_left: [.4, 0, -.1] }, 'inOut'],
  [.9, { hipsY: -.2, leg_upper_right: [.6, 0, 0], leg_upper_left: [.6, 0, 0], leg_lower_right: [-.9, 0, 0], leg_lower_left: [-.9, 0, 0], foot_right: [.3, 0, 0], foot_left: [.3, 0, 0], torso: [-.25, 0, 0], arm_upper_right: [.15, 0, .1], arm_upper_left: [.15, 0, -.1] }, 'inOut'],
  [1, {}, 'out'],
];
const GETUP_FRONT = [
  [0, { hipsY: -.93, leg_upper_right: [-1.45, 0, .05], leg_upper_left: [-1.45, 0, -.05], torso: [-1.45, 0, 0], head: [.35, 0, 0], arm_upper_right: [.2, 0, .3], arm_upper_left: [.2, 0, -.3] }],
  [.22, { hipsY: -.93, leg_upper_right: [-1.4, 0, .05], leg_upper_left: [-1.4, 0, -.05], torso: [-1.3, 0, 0], head: [.4, 0, 0], arm_upper_right: [1.0, 0, .3], arm_upper_left: [1.0, 0, -.3], arm_lower_right: [1.3, 0, 0], arm_lower_left: [1.3, 0, 0] }, 'inOut'],
  [.4, { hipsY: -.9, leg_upper_right: [-1.2, 0, .05], leg_upper_left: [-1.2, 0, -.05], torso: [-.9, 0, 0], head: [.3, 0, 0], arm_upper_right: [1.3, 0, .15], arm_upper_left: [1.3, 0, -.15], arm_lower_right: [.2, 0, 0], arm_lower_left: [.2, 0, 0] }, 'inOut'],
  [.58, { hipsY: -.62, leg_upper_right: [.25, 0, .05], leg_upper_left: [.25, 0, -.05], leg_lower_right: [-1.75, 0, 0], leg_lower_left: [-1.75, 0, 0], torso: [-.6, 0, 0], head: [.2, 0, 0], arm_upper_right: [1.1, 0, .1], arm_upper_left: [1.1, 0, -.1] }, 'inOut'],
  [.74, { hipsY: -.5, leg_upper_right: [1.45, 0, .05], leg_lower_right: [-1.5, 0, 0], foot_right: [.1, 0, 0], leg_upper_left: [.1, 0, -.05], leg_lower_left: [-1.6, 0, 0], torso: [-.35, 0, 0], arm_upper_right: [.6, 0, .1], arm_lower_right: [.3, 0, 0], arm_upper_left: [.3, 0, -.15] }, 'inOut'],
  [.9, { hipsY: -.18, leg_upper_right: [.7, 0, 0], leg_lower_right: [-.9, 0, 0], leg_upper_left: [-.1, 0, 0], leg_lower_left: [-.6, 0, 0], foot_right: [.25, 0, 0], torso: [-.2, 0, 0], arm_upper_right: [.2, 0, .1] }, 'inOut'],
  [1, {}, 'out'],
];
const GETUP = { back: [GETUP_BACK, 0], front: [GETUP_FRONT, 0], sitting: [GETUP_BACK, .45], kneeling: [GETUP_FRONT, .58] };
const GUARD = { arm_upper_right: [1.05, .55, .35], arm_lower_right: [1.25, 0, 0], hand_right: [.2, .3, -.9], arm_upper_left: [1.15, -.6, -.25], arm_lower_left: [1.45, 0, 0], chest: [0, -.12, 0], torso: [-.1, 0, 0], head: [-.05, .12, 0], leg_upper_right: [.18, 0, .04], leg_lower_right: [-.32, 0, 0], leg_upper_left: [-.1, 0, -.04], leg_lower_left: [-.2, 0, 0], hipsY: -.06 };

// Looping work and life activities (NPC daily routines), layered over idle.
function activityPose(pose, activity, t) {
  const swing = Math.sin(t * 2.6), beat = Math.max(0, Math.sin(t * 2.6));
  switch (activity) {
    case 'work_hammer': {
      // Slow lift, short hard strike: the hammer head lands on an anvil at hip height in front of the
      // body. The left hand holds the workpiece on the anvil.
      const cycle = (t * HAMMER_RATE) % 1, up = cycle < .7 ? ease.inOut(cycle / .7) : 1 - ((cycle - .7) / .3) ** 2;
      pose.add('arm_upper_right', .55 + up * 2, .12, .18); pose.add('arm_lower_right', .2 + up * 1.2); pose.add('hand_right', .8 - up * .95);
      pose.add('arm_upper_left', .85, -.2, -.05); pose.add('arm_lower_left', .55); pose.add('hand_left', .3);
      pose.add('torso', -.34 - (1 - up) * .1); pose.add('chest', .05 * up, -.1 * up, 0); pose.add('head', -.4); pose.hipsY -= .04; break;
    }
    case 'work_chop': {
      const lift = ease.inOut((Math.sin(t * 2.2) + 1) / 2);
      for (const side of ['right', 'left']) { pose.add(`arm_upper_${side}`, .5 + lift * 2.2, side === 'right' ? .3 : -.3, 0); pose.add(`arm_lower_${side}`, .3 + lift * .9); }
      pose.add('torso', -.35 + lift * .45); pose.hipsY -= .05 * (1 - lift); break;
    }
    case 'work_sweep': pose.add('arm_upper_right', .7, .4 + swing * .35, .1); pose.add('arm_upper_left', .5, -.2 + swing * .35, -.1); pose.add('arm_lower_right', .5); pose.add('arm_lower_left', .7); pose.add('torso', -.2, swing * .15); break;
    case 'work_farm': pose.add('torso', -.75 - beat * .2); pose.add('arm_upper_right', 1 + beat * .4); pose.add('arm_upper_left', .9); pose.add('head', .3); pose.hipsY -= .1; break;
    case 'work_cook': pose.add('arm_upper_right', .9 + swing * .1, .3, 0); pose.add('arm_lower_right', 1 + Math.sin(t * 5) * .3); pose.add('torso', -.15); pose.add('head', -.25); break;
    case 'work_read': case 'read': pose.add('arm_upper_right', .5, .35, 0); pose.add('arm_upper_left', .5, -.35, 0); pose.add('arm_lower_right', 1.4); pose.add('arm_lower_left', 1.4); pose.add('head', -.45 + Math.sin(t * .4) * .05); break;
    case 'eat': case 'drink': { const sip = Math.max(0, Math.sin(t * 1.3)); pose.add('arm_upper_right', .5 + sip * .8, .5 * sip, 0); pose.add('arm_lower_right', .8 + sip * 1.5); pose.add('head', sip * (activity === 'drink' ? .3 : -.1)); break; }
    case 'draw_water': pose.add('arm_upper_right', 1.2 - beat * .5); pose.add('arm_upper_left', 1.2 - beat * .5); pose.add('arm_lower_right', .3 + beat); pose.add('arm_lower_left', .3 + beat); pose.add('torso', -.25); break;
    case 'pray': pose.add('arm_upper_right', .7, .55, 0); pose.add('arm_upper_left', .7, -.55, 0); pose.add('arm_lower_right', 1.6); pose.add('arm_lower_left', 1.6); pose.add('head', -.5); pose.add('torso', -.1); break;
    // Greetings fit the person (main.js picks one): a nod, a guard's fist to the chest, or a wave.
    case 'greet': case 'nod': pose.add('head', .25 * Math.max(0, Math.sin(t * 4.2)), 0, 0); pose.add('chest', .04); break;
    case 'salute': pose.add('arm_upper_right', .95, .55, 0); pose.add('arm_lower_right', 1.9); pose.add('hand_right', .2); pose.add('head', .12); pose.add('chest', -.04); break;
    case 'wave': pose.add('arm_upper_right', 2.5, 0, .4 + swing * .25); pose.add('arm_lower_right', .5 + swing * .3); break;
    case 'lean': pose.add('hips', 0, 0, .06); pose.add('torso', 0, 0, -.05); pose.add('arm_upper_right', -.1, 0, .2); pose.add('leg_upper_left', .15, 0, -.08); break;
    case 'sit':
      for (const side of ['right', 'left']) { pose.add(`leg_upper_${side}`, 1.5, 0, side === 'right' ? .06 : -.06); pose.add(`leg_lower_${side}`, -1.45); pose.add(`foot_${side}`, -.05); pose.add(`arm_upper_${side}`, .35); pose.add(`arm_lower_${side}`, .6); }
      pose.hipsY -= .27; break;
    case 'sleep': pose.rootX = Math.PI / 2; pose.rootY = .22; pose.add('head', .1); for (const side of ['right', 'left']) pose.add(`arm_upper_${side}`, .1, 0, side === 'right' ? .12 : -.12); break;
    // Cutscene poses (src/systems/director.js scripts).
    case 'pull': for (const side of ['right', 'left']) { pose.add(`arm_upper_${side}`, -.45, 0, side === 'right' ? .18 : -.18); pose.add(`arm_lower_${side}`, .25); } pose.add('torso', -.28); pose.add('head', .2); break;
    case 'point': pose.add('arm_upper_right', 1.45, .25, .25); pose.add('arm_lower_right', .1); pose.add('head', .1, .2); break;
    case 'aim': pose.add('arm_upper_right', 1.35, .35, 0); pose.add('arm_lower_right', .5); pose.add('arm_upper_left', 1.5, -.15, 0); pose.add('arm_lower_left', .2); pose.add('head', .05, .15); break;
    case 'aim_low': pose.add('arm_upper_right', .55, .3, 0); pose.add('arm_lower_right', .6); pose.add('arm_upper_left', .7, -.2, 0); pose.add('arm_lower_left', .4); break;
    case 'draw_bow': pose.add('arm_upper_left', 1.55, -.1, -.1); pose.add('arm_lower_left', .05); pose.add('arm_upper_right', 1.5, .9, .2); pose.add('arm_lower_right', 2.3); pose.add('head', 0, .7); pose.add('chest', 0, .5); break;
    case 'carry': for (const side of ['right', 'left']) { pose.add(`arm_upper_${side}`, 1.05, 0, side === 'right' ? .2 : -.2); pose.add(`arm_lower_${side}`, 1.25); } pose.add('torso', .14); pose.add('head', -.25); break;
    case 'kneel': case 'press': case 'wash': {
      pose.add('leg_upper_right', 1.5); pose.add('leg_lower_right', -1.5); pose.add('foot_right', .1);
      pose.add('leg_upper_left', .05); pose.add('leg_lower_left', -1.55); pose.add('foot_left', 1.2); pose.hipsY -= .48;
      if (activity === 'press') { for (const side of ['right', 'left']) { pose.add(`arm_upper_${side}`, 1.05 + beat * .05, 0, side === 'right' ? -.15 : .15); pose.add(`arm_lower_${side}`, .25); } pose.add('torso', -.55); pose.add('head', -.4); }
      else if (activity === 'wash') { for (const side of ['right', 'left']) { pose.add(`arm_upper_${side}`, .85 + Math.sin(t * 4 + (side === 'right' ? 0 : 1.5)) * .1, 0, side === 'right' ? -.25 : .25); pose.add(`arm_lower_${side}`, .9); } pose.add('torso', -.35); pose.add('head', -.55); }
      else { pose.add('torso', -.1); pose.add('head', -.35); pose.add('arm_upper_right', .2); pose.add('arm_lower_right', .5); }
      break;
    }
    case 'slump':
      for (const side of ['right', 'left']) { pose.add(`leg_upper_${side}`, 1.45, 0, side === 'right' ? .12 : -.12); pose.add(`leg_lower_${side}`, -.25); pose.add(`arm_upper_${side}`, .15, 0, side === 'right' ? .2 : -.2); pose.add(`arm_lower_${side}`, .4); }
      pose.add('arm_upper_left', .55); pose.add('arm_lower_left', 1.4); pose.add('torso', -.2 + Math.sin(t * 1.1) * .03); pose.add('head', -.3); pose.hipsY -= .82; break;
    case 'swim': {
      const stroke = Math.sin(t * 3.4);
      pose.add('torso', -.75); pose.add('head', .9); pose.hipsY -= .1;
      pose.add('arm_upper_right', 1.6 + stroke * 1.1, .2, .4); pose.add('arm_upper_left', 1.6 - stroke * 1.1, -.2, -.4); pose.add('arm_lower_right', .4); pose.add('arm_lower_left', .4);
      pose.add('leg_upper_right', -.35 + Math.sin(t * 6) * .35); pose.add('leg_upper_left', -.35 - Math.sin(t * 6) * .35); break;
    }
    // Working a road barrier: both hands on the counterweight, leaning in, one foot set back.
    case 'operate':
      for (const side of ['right', 'left']) { pose.add(`arm_upper_${side}`, .95 + Math.sin(t * 3) * .05, 0, side === 'right' ? -.12 : .12); pose.add(`arm_lower_${side}`, .5); }
      pose.add('torso', -.32); pose.add('head', -.15); pose.add('leg_upper_right', -.35); pose.add('leg_lower_right', -.2); pose.add('leg_upper_left', .25); pose.hipsY -= .06; break;
    // Creeping: knees bent, body low and forward, head up to keep watching.
    case 'sneak':
      for (const side of ['right', 'left']) { pose.add(`leg_upper_${side}`, .6); pose.add(`leg_lower_${side}`, -.95); pose.add(`foot_${side}`, .3); }
      pose.add('torso', -.32); pose.add('head', .26); pose.hipsY -= .32; break;
    case 'flinch': pose.add('torso', .18); pose.add('head', .2); pose.add('arm_upper_right', .9, 0, .3); pose.add('arm_upper_left', .9, 0, -.3); pose.add('arm_lower_right', 1.3); pose.add('arm_lower_left', 1.3); break;
    // HUMANITY AI body language (systems/ai): readable intentions.
    // Yielding: both hands up and open, shoulders drawn in, a small nervous sway.
    case 'surrender':
      for (const side of ['right', 'left']) { pose.add(`arm_upper_${side}`, 2.55, 0, side === 'right' ? .35 : -.35); pose.add(`arm_lower_${side}`, .5); pose.add(`hand_${side}`, -.3); }
      pose.add('head', .1 + Math.sin(t * 1.7) * .04, Math.sin(t * .9) * .15); pose.add('chest', -.06); pose.add('torso', .05); pose.hipsY -= .03; break;
    // The tell before a feigned surrender breaks: hands sinking, head turned down to the dropped weapon,
    // weight on the back foot.
    case 'tense':
      for (const side of ['right', 'left']) { pose.add(`arm_upper_${side}`, 1.6, 0, side === 'right' ? .3 : -.3); pose.add(`arm_lower_${side}`, .9); }
      pose.add('head', -.5, .55); pose.add('neck', -.1, .2); pose.add('torso', -.12); pose.add('leg_upper_left', -.25); pose.add('leg_lower_left', -.3); pose.hipsY -= .06; break;
    // A raised palm: halt, or let us talk.
    case 'warn': pose.add('arm_upper_left', 1.45, -.25, -.1); pose.add('arm_lower_left', .25); pose.add('hand_left', -1); pose.add('head', .05); pose.add('chest', .04); break;
    case 'parley': pose.add('arm_upper_left', 1.2, -.3, -.2); pose.add('arm_lower_left', .7); pose.add('hand_left', -.9); pose.add('arm_upper_right', .5, .2, .3); pose.add('head', .08, Math.sin(t * 1.1) * .1); break;
    // Searching: half crouched, head sweeping slowly from side to side.
    case 'search': pose.add('head', .05, Math.sin(t * 1.3) * .75); pose.add('neck', 0, Math.sin(t * 1.3) * .3); pose.add('torso', -.12); pose.add('arm_upper_right', .4, 0, .15); pose.add('arm_lower_right', .6); pose.hipsY -= .05; break;
    // Ready: weight low, blade hand forward, off hand up.
    case 'guardReady':
      pose.add('arm_upper_right', .75, .3, .25); pose.add('arm_lower_right', .9); pose.add('arm_upper_left', .7, -.3, -.2); pose.add('arm_lower_left', 1.1);
      pose.add('leg_upper_right', .15); pose.add('leg_lower_right', -.25); pose.add('leg_upper_left', -.1); pose.add('torso', -.08); pose.hipsY -= .05; break;
    // Shield up: the left forearm across the chest, the body a little turned behind it, weight low.
    case 'shieldUp':
      pose.add('arm_upper_left', 1.35, -.55, -.35); pose.add('arm_lower_left', 1.45); pose.add('hand_left', 0, 0, .3);
      pose.add('arm_upper_right', .6, .35, .3); pose.add('arm_lower_right', 1); pose.add('chest', 0, -.2); pose.add('head', -.08, .15);
      pose.add('leg_upper_right', .2); pose.add('leg_lower_right', -.3); pose.add('leg_upper_left', -.1); pose.hipsY -= .06; break;
    case 'cower':
      for (const side of ['right', 'left']) { pose.add(`arm_upper_${side}`, 1.9, 0, side === 'right' ? .5 : -.5); pose.add(`arm_lower_${side}`, 1.8); pose.add(`leg_upper_${side}`, .8); pose.add(`leg_lower_${side}`, -1.2); }
      pose.add('torso', -.45); pose.add('head', -.4); pose.hipsY -= .45; break;
  }
}

function sample(track, p, pose, weight = 1) {
  let i = 1; while (i < track.length - 1 && track[i][0] < p) i++;
  const [t0, a] = track[i - 1], [t1, b, curve] = track[i];
  const t = ease[curve || 'inOut'](clamp((p - t0) / Math.max(1e-4, t1 - t0), 0, 1));
  const names = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const name of names) {
    if (name === 'hipsY') { pose.hipsY += lerp(a.hipsY || 0, b.hipsY || 0, t) * weight; continue; }
    const va = a[name] || [0, 0, 0], vb = b[name] || [0, 0, 0];
    pose.add(name, lerp(va[0], vb[0], t), lerp(va[1], vb[1], t), lerp(va[2], vb[2], t), weight);
  }
}
function addStatic(values, pose, weight) {
  for (const [name, v] of Object.entries(values)) name === 'hipsY' ? pose.hipsY += v * weight : pose.add(name, v[0], v[1], v[2], weight);
}

export function createAnimator(character) {
  const quadruped = character.userData.kind === 'wolf';
  const last = new THREE.Vector3().copy(character.position);
  const state = { phase: Math.random(), speed: 0, move: 0, run: 0, guard: 0, look: 0, lookPitch: 0, time: Math.random() * 20, capeLag: 0, lastYaw: character.rotation.y, talk: 0,
    dirF: 1, dirS: 0, accF: 0, prevF: 0, lean: 0, roll: 0, contact: [1, 1], sprint: 0 };
  const target = new THREE.Vector3();

  function locomotion(pose, input) {
    const w = state.move, r = state.run, t = state.time, p = state.phase * TAU;
    // Direction of travel in the body's frame: forward, backward, sideways or anything between
    // (HUMANITY MOTION). Legs swing along it, so a backpedal steps back and a strafe steps sideways.
    const F = state.dirF, S = state.dirS, along = Math.abs(F);
    const heavy = input.heavy || 0, slope = input.slope || 0, inj = input.injury || {}, fatigue = clamp((input.fatigue || 0) - .35, 0, 1) / .65;
    // Idle: breathing (deeper and faster when spent), weight shift, relaxed arms.
    const breath = Math.sin(t * (1.7 + 2.4 * fatigue)) * (1 + 2.2 * fatigue), idle = 1 - w;
    pose.add('chest', breath * .025 * idle - .1 * fatigue); pose.add('head', -breath * .02 * idle);
    pose.add('hips', 0, 0, Math.sin(t * .43) * .03 * idle); pose.add('torso', 0, 0, -Math.sin(t * .43) * .02 * idle);
    // Three gaits with their own shape (walk, run, sprint), blended by speed. A walk is calm and heavy:
    // short arm swing, the body highest when the legs pass, lowest with the feet apart. A run pumps the
    // arms with bent elbows and leans in; its body is lowest in mid-stance and floats between steps. A
    // sprint drives the knees up, kicks the heels back and leans hard.
    const sp = state.sprint, G = (a, b, c) => a + (b - a) * r + (c - b) * sp;
    const thighFwd = G(.34, .62, .86), thighBack = G(.3, .42, .52), kneeSwing = G(.55, 1.25, 1.8), kneeStance = G(.05, .14, .2);
    const armSwing = G(.24, .55, .85), elbow = G(.2, 1.25, 1.45), elbowSwing = G(.25, .25, .12), toeOff = G(.22, .32, .38);
    const swingArms = (1 - heavy * .3) * (.4 + .6 * along);
    for (const [side, s] of [['right', 1], ['left', -1]]) {
      const legPhase = p + (s > 0 ? Math.PI : 0), hurt = inj[`leg_${side}`] || 0, armHurt = inj[`arm_${side}`] || 0;
      const reach = Math.sin(legPhase), thigh = reach * (reach > 0 ? thighFwd : thighBack) * w * (1 - heavy * .08) * (1 - Math.abs(slope) * .2);
      const swing = Math.max(0, Math.cos(legPhase));
      // A wounded leg stays stiff in the swing; downhill the knees stay soft.
      const knee = -(Math.pow(swing, 1.3) * kneeSwing * (1 - hurt * .5) + kneeStance + Math.max(0, -slope) * .25) * w;
      // Sideways the hip swings the leg out and back; it never crosses through the other leg.
      const out = clamp(reach * .34 * S * w * s, -.06, .36) * s;
      pose.add(`leg_upper_${side}`, thigh * F + Math.max(0, slope) * .15 * w + .06 * sp, 0, out);
      pose.add(`leg_lower_${side}`, knee);
      pose.add(`foot_${side}`, -(thigh * F + knee) * .75 + Math.max(0, -reach) * toeOff * w * along);
      // Opposite arm swings with each leg; elbows flex more when the arm swings forward. A wounded
      // arm is held bent against the body instead.
      const arm = -reach * armSwing * w * swingArms * (1 - armHurt);
      pose.add(`arm_upper_${side}`, arm + G(.02, .1, .18) * w + armHurt * .3, 0, s * (.07 + .03 * sp + breath * .012 * idle) - s * armHurt * .1);
      pose.add(`arm_lower_${side}`, .12 + elbow * w + Math.max(0, arm) * elbowSwing + armHurt * 1.0);
      // Limp: the body sinks and leans off the wounded leg while it carries the weight.
      if (hurt > .05) { const stance = clamp(-Math.cos(legPhase) * 2, 0, 1) * w; pose.hipsY -= .08 * hurt * stance; pose.add('torso', 0, 0, s * .12 * hurt * stance); }
    }
    // Walking: lowest with the feet apart. Running: lowest in mid-stance, up between steps.
    pose.hipsY += (-Math.abs(Math.sin(p)) * (.028 + .02 * heavy) * (1 - r) - Math.abs(Math.cos(p)) * G(0, .055, .065) * r) * w
      - G(0, .04, .08) * w - Math.max(0, -slope) * .05 * w;
    pose.add('hips', -.04 * r - .05 * sp, Math.sin(p) * G(.07, .08, .06) * w * along, Math.cos(p) * .025 * w * (1 - r * .5));
    pose.add('chest', 0, -Math.sin(p) * G(.1, .12, .14) * w * along, 0);
    // Lean: into speed and acceleration, against braking, into turns; forward uphill, back downhill.
    const lean = G(.03, .14, .3) * w;
    pose.add('torso', -lean - state.lean - Math.max(0, slope) * .22 * w + Math.max(0, -slope) * .12 * w - (inj.torso || 0) * .3, 0, -state.roll);
    pose.add('chest', -(inj.torso || 0) * .15);
    // The head keeps the gaze level: it counters the lean and the bob.
    pose.add('head', lean * .75 + state.lean * .5 + Math.max(0, slope) * .1 * w, Math.sin(p) * .05 * w * (1 - r * .6), 0);
    // Spent and standing: hands on the knees to get the breath back.
    if (fatigue > .6 && idle > .6) { const k = (fatigue - .6) / .4 * idle; pose.add('torso', -.5 * k); pose.add('head', .35 * k); pose.hipsY -= .08 * k;
      for (const side of ['right', 'left']) { pose.add(`leg_upper_${side}`, .3 * k); pose.add(`leg_lower_${side}`, -.45 * k); pose.add(`arm_upper_${side}`, .65 * k); pose.add(`arm_lower_${side}`, .25 * k); } }
    // A gut wound: one hand pressed to the belly while standing.
    if ((inj.torso || 0) > .3 && idle > .5) { const k = inj.torso * idle; pose.add('arm_upper_left', .45 * k, 0, .35 * k); pose.add('arm_lower_left', 1.5 * k); }
    // Cloak: lifts with speed, lags behind turns, flutters at the hem.
    const lag = state.capeLag;
    pose.add('cape_1', -(.06 + .22 * w + .42 * r) + Math.sin(t * 2.1) * .02, 0, lag * .4);
    pose.add('cape_2', -(.04 + .16 * w + .3 * r) + Math.sin(t * 2.1 - .9) * (.03 + .05 * w), 0, lag * .3);
    pose.add('cape_3', -(.03 + .12 * w + .25 * r) + Math.sin(t * 2.1 - 1.8) * (.04 + .08 * w + .1 * r), 0, lag * .2);
    // In the air: rising, the legs tuck and the arms lift; falling, the arms go up and out for balance and
    // the legs reach for the ground. Landing squashes the body into the knees, harder the faster the fall.
    if (input.airborne) {
      const fall = clamp(-(input.vy ?? 0) / 9, 0, 1), rise = clamp((input.vy ?? 0) / 7, 0, 1);
      pose.add('leg_upper_right', .5 + .2 * rise - .2 * fall); pose.add('leg_lower_right', -.9 - .3 * rise + .4 * fall); pose.add('leg_upper_left', -.15 + .25 * fall); pose.add('leg_lower_left', -.5 + .1 * fall);
      pose.add('arm_upper_right', .3 + .5 * fall, 0, .25 + .7 * fall); pose.add('arm_upper_left', .3 + .5 * fall, 0, -.25 - .7 * fall); pose.add('arm_lower_right', .3); pose.add('arm_lower_left', .3);
      pose.add('torso', .06 * fall - .1 * rise); pose.add('head', -.15 * fall);
    }
    if (state.land > .01) { const k = state.land; pose.hipsY -= .28 * k; pose.add('torso', -.35 * k); pose.add('head', .25 * k);
      for (const side of ['right', 'left']) { pose.add(`leg_upper_${side}`, .55 * k); pose.add(`leg_lower_${side}`, -1.05 * k); pose.add(`foot_${side}`, .45 * k); pose.add(`arm_upper_${side}`, .35 * k, 0, (side === 'right' ? .3 : -.3) * k); } }
    // Turning drags the body: the head leads, the chest lags behind, the arms swing out a little.
    const td = state.turnDrag;
    pose.add('head', 0, td * .35); pose.add('chest', 0, -td * .25); pose.add('arm_upper_right', 0, 0, Math.abs(td) * .25); pose.add('arm_upper_left', 0, 0, -Math.abs(td) * .25);
    // Sidestepping leans into the step.
    pose.add('torso', 0, 0, -state.dirS * .1 * w);
  }

  function humanoid(pose, input) {
    if (input.getup) {
      const [track, start] = GETUP[input.getup.kind] || GETUP.back;
      sample(track, start + (1 - start) * clamp(input.getup.progress, 0, 1), pose);
      pose.add('chest', Math.sin(state.time * 3.2) * .03);
      return;
    }
    locomotion(pose, input);
    // Holding something (a cart, a body, a bow) keeps the pose while walking.
    if (input.activity && (state.move < .3 || ['pull', 'carry', 'aim_low', 'aim', 'draw_bow', 'swim', 'sneak', 'guardReady', 'search', 'warn', 'shieldUp'].includes(input.activity))) activityPose(pose, input.activity, state.time);
    const upper = new Pose();
    let actionWeight = 0;
    const action = input.action;
    if (action) {
      const p = clamp(action.progress, 0, 1);
      actionWeight = Math.min(1, p / .06, (1 - p) / .08 + .15);
      const track = action.kind === 'sword' ? SWORD[action.combo % 3] : action.kind === 'cast' ? CAST : DRINK;
      sample(track, p, upper);
    } else if (input.windup > 0) {
      // Enemy telegraph: slow, readable overhead wind-up.
      actionWeight = 1; sample(SWORD[2], .36 * ease.out(input.windup), upper);
    } else if (input.strike > 0) {
      actionWeight = 1; sample(SWORD[2], .36 + .64 * (1 - input.strike), upper);
    }
    // Archer's stance: the body turns side-on so the bow shoulder points at the target, the head turns
    // back to look along the arrow and the chest leans with the aim. The arms meet bow and string by IK.
    if (input.bow > 0) {
      const k = input.bow, pitch = input.bowPitch || 0;
      pose.add('torso', 0, -.45 * k, 0); pose.add('chest', pitch * .35 * k, -.6 * k, 0);
      pose.add('neck', 0, .45 * k, 0); pose.add('head', -pitch * .2 * k, .55 * k, 0);
      pose.add('leg_upper_left', -.12 * k, 0, -.08 * k); pose.add('leg_upper_right', .1 * k, 0, .06 * k);
    }
    state.guard = damp(state.guard, input.guard ? 1 : 0, 14, input.dt);
    if (state.guard > .01) addStatic(GUARD, upper, state.guard * (1 - actionWeight));
    // Upper-body layers replace locomotion on the arms in proportion to their weight.
    const layer = Math.max(actionWeight, state.guard);
    if (layer > 0) {
      for (const name of ['arm_upper_right', 'arm_lower_right', 'hand_right', 'arm_upper_left', 'arm_lower_left', 'hand_left']) {
        const base = pose.get(name), over = upper.get(name);
        for (let k = 0; k < 3; k++) base[k] = lerp(base[k], over[k], layer);
      }
      for (const name of ['chest', 'torso', 'head', 'leg_upper_right', 'leg_lower_right', 'leg_upper_left', 'leg_lower_left']) {
        const over = upper.bones.get(name); if (over) pose.add(name, over[0], over[1], over[2]);
      }
      pose.hipsY += upper.hipsY;
    }
    // Talking: small nods and hand gestures.
    state.talk = damp(state.talk, input.speaking ? 1 : 0, 6, input.dt);
    if (state.talk > .01) {
      const t = state.time;
      pose.add('head', Math.sin(t * 7.3) * .05 * state.talk + Math.sin(t * 2.1) * .03 * state.talk, Math.sin(t * 1.3) * .06 * state.talk);
      pose.add('arm_upper_right', (.35 + Math.sin(t * 2.4) * .12) * state.talk, .25 * state.talk, .1 * state.talk);
      pose.add('arm_lower_right', (.75 + Math.sin(t * 3.1) * .2) * state.talk);
    }
    // HUMANITY MOTION reactions: the upper body gives in the direction of the force, the arms come
    // out for balance in a stagger, a struck leg buckles, the shield arm yields to a blow.
    const re = input.reaction;
    if (re) {
      pose.add('torso', -re.pitch * .9, 0, -re.roll * .9); pose.add('chest', -re.pitch * .4, 0, -re.roll * .3); pose.add('head', re.pitch * .3);
      if (re.arms > .01) { pose.add('arm_upper_right', -.2 * re.arms, 0, 1.0 * re.arms); pose.add('arm_upper_left', -.2 * re.arms, 0, -1.0 * re.arms); pose.add('arm_lower_right', .4 * re.arms); pose.add('arm_lower_left', .4 * re.arms); }
      for (const side of ['right', 'left']) if (re.knee[side] > .01) { pose.add(`leg_upper_${side}`, .45 * re.knee[side]); pose.add(`leg_lower_${side}`, -.95 * re.knee[side]); }
      if (re.guardArm > .01) { pose.add('arm_upper_left', -.45 * re.guardArm, 0, -.15 * re.guardArm); pose.add('chest', 0, .2 * re.guardArm, 0); }
      pose.hipsY += re.hipsY;
    }
    const gr = input.grapple;
    if (gr) {
      const t = state.time;
      if (gr.role === 'holder' && (gr.state === 'GroundControl' || gr.state === 'Takedown')) {
        // Kneeling over someone held down: right foot planted, left knee on the ground.
        pose.hipsY -= .6; pose.add('torso', -.55); pose.add('head', .3);
        pose.add('leg_upper_right', 1.45, 0, .1); pose.add('leg_lower_right', -1.5); pose.add('leg_upper_left', .15, 0, -.1); pose.add('leg_lower_left', -1.65);
      } else if (gr.role === 'holder') {
        // Braced: feet wide, knees soft, leaning into the hold.
        pose.add('leg_upper_right', .15, 0, .12); pose.add('leg_upper_left', -.12, 0, -.12); pose.add('leg_lower_right', -.3); pose.add('leg_lower_left', -.25);
        pose.add('torso', -.14 - gr.jerk * .3, gr.jerk * .3 * Math.sin(t * 20)); pose.hipsY -= .05;
      } else {
        // Held: twisting against the hand, head toward the holder, the weight thrown back.
        const k = gr.state === 'Struggling' || gr.state === 'OffBalance' ? 1 : .4;
        pose.add('torso', .08 * k + gr.pinned * .1, Math.sin(t * 7.3) * .18 * k + gr.jerk * .5, Math.sin(t * 5.1) * .06 * k);
        pose.add('chest', 0, Math.sin(t * 7.3 + 1) * .12 * k);
        pose.add('leg_upper_right', -.2 * k); pose.add('leg_upper_left', .15 * k); pose.add('leg_lower_left', -.3 * k);
      }
    }
    // At a fire: hands held out to the warmth.
    if (input.warm && state.move < .2) { pose.add('arm_upper_right', 1.0, -.1, .2); pose.add('arm_upper_left', 1.0, .1, -.2); pose.add('arm_lower_right', .55); pose.add('arm_lower_left', .55); pose.add('hand_right', -.6); pose.add('hand_left', -.6); pose.add('torso', -.06); }
    // Weight on one leg: the hips slide over it and drop on the other side.
    if (Math.abs(input.shift || 0) > .01) { const k = input.shift * (1 - state.move); pose.hipsX += k * .06; pose.add('hips', 0, 0, -k * .07); pose.add('torso', 0, 0, k * .06); pose.add('head', 0, 0, -k * .03); }
    // Hit reaction: recoil, then a damped wobble.
    if (input.stagger > 0) {
      const s = clamp(input.stagger / .45, 0, 1), wobble = Math.sin((1 - s) * 18) * s;
      pose.add('torso', .3 * s + wobble * .05); pose.add('chest', .15 * s, wobble * .12); pose.add('head', .35 * s, -wobble * .2);
      pose.add('arm_upper_right', -.2 * s, 0, .45 * s); pose.add('arm_upper_left', -.2 * s, 0, -.45 * s);
      pose.hipsY -= .04 * s;
    }
  }

  function wolf(pose, input) {
    const w = state.move, r = state.run, t = state.time, p = state.phase * TAU, idle = 1 - w;
    for (const [leg, offset] of [['front_right', 0], ['rear_left', 0], ['front_left', Math.PI], ['rear_right', Math.PI]]) {
      const lp = p + offset, front = leg.startsWith('front');
      const upper = Math.sin(lp) * (.5 + .35 * r) * w, swing = Math.max(0, Math.cos(lp));
      const lower = (front ? -1 : 1) * (swing * (.8 + .4 * r) + .05) * w;
      const side = leg.endsWith('right') ? 'right' : 'left';
      pose.add(`${front ? 'front' : 'rear'}_upper_${side}`, upper);
      pose.add(`${front ? 'front' : 'rear'}_lower_${side}`, lower);
      pose.add(`${front ? 'front' : 'rear'}_paw_${side}`, -(upper + lower) * .7);
    }
    pose.hipsY += -Math.abs(Math.sin(p)) * (.04 + .06 * r) * w;
    pose.add('body', Math.sin(p * 2) * .03 * w, 0, Math.sin(p) * .03 * w);
    pose.add('chest', Math.sin(t * 2) * .025 * idle);
    pose.add('neck', -.05 * r + Math.sin(p * 2) * .06 * w + Math.max(0, Math.sin(t * .7) - .7) * -.9 * idle);
    pose.add('head', Math.sin(p * 2 + .5) * .05 * w, Math.sin(t * .5) * .25 * idle);
    pose.add('tail_1', .15 * r - .1 * idle, Math.sin(t * (idle > .5 ? 3 : 9)) * (.25 * idle + .1), 0);
    pose.add('tail_2', -.1, Math.sin(t * 9 - .6) * .15, 0);
    pose.add('tail_3', -.05, Math.sin(t * 9 - 1.2) * .2, 0);
    for (const side of ['right', 'left']) pose.add(`ear_${side}`, Math.max(0, Math.sin(t * 1.3 + (side === 'left' ? 2 : 0)) - .85) * 2, 0, 0);
    if (input.windup > 0) {
      const k = ease.out(input.windup);
      pose.hipsY -= .12 * k; pose.add('body', -.08 * k); pose.add('neck', -.35 * k); pose.add('head', .15 * k); pose.add('jaw', -.35 * k);
      for (const side of ['right', 'left']) { pose.add(`front_upper_${side}`, -.25 * k); pose.add(`front_lower_${side}`, .45 * k); pose.add(`rear_upper_${side}`, .3 * k); pose.add(`rear_lower_${side}`, .5 * k); }
      pose.add('tail_1', -.4 * k);
    } else if (input.strike > 0) {
      const k = Math.sin(clamp(input.strike / .3, 0, 1) * Math.PI);
      pose.add('body', .22 * k); pose.add('neck', .25 * k); pose.add('jaw', -.55 * k);
      for (const side of ['right', 'left']) { pose.add(`front_upper_${side}`, 1.0 * k); pose.add(`front_lower_${side}`, -.3 * k); pose.add(`rear_upper_${side}`, -.6 * k); }
    } else pose.add('jaw', -Math.max(0, Math.sin(t * 3.2)) * .08 * (r + .2));
    if (input.stagger > 0) { const s = clamp(input.stagger / .45, 0, 1); pose.add('neck', .3 * s, Math.sin((1 - s) * 16) * .3 * s); pose.add('body', 0, 0, Math.sin((1 - s) * 14) * .12 * s); }
  }

  function death(pose, k) {
    // Knees give way first, then the body topples onto its side.
    const buckle = ease.out(clamp(k / .35, 0, 1)), fall = ease.in(clamp((k - .25) / .75, 0, 1));
    if (quadruped) {
      pose.hipsY -= .2 * buckle; pose.add('neck', -.3 * buckle); pose.add('jaw', -.3 * buckle);
      for (const side of ['right', 'left']) { pose.add(`front_lower_${side}`, -.5 * buckle); pose.add(`rear_lower_${side}`, .5 * buckle); }
      pose.rootZ = fall * Math.PI / 2; pose.rootY = fall * .32;
      return;
    }
    for (const side of ['right', 'left']) { pose.add(`leg_upper_${side}`, .95 * buckle); pose.add(`leg_lower_${side}`, -1.6 * buckle); pose.add(`foot_${side}`, .5 * buckle); pose.add(`arm_upper_${side}`, .25 * buckle, 0, (side === 'right' ? 1 : -1) * .3 * fall); }
    pose.add('torso', -.45 * buckle); pose.add('head', -.4 * buckle + .3 * fall);
    pose.hipsY -= .48 * buckle;
    pose.rootZ = fall * Math.PI / 2 * .96; pose.rootY = fall * .3;
  }

  function apply(pose) {
    // Read the rig every frame: modular characters rebuild it when they change clothes.
    const rig = character.userData.rig;
    for (const [name, bone] of Object.entries(rig)) {
      const rest = bone.userData.rest;
      if (!rest) continue;
      const v = pose.bones.get(name);
      if (v) bone.rotation.set(v[0], v[1], v[2]); else bone.quaternion.copy(rest.quaternion);
    }
    const hips = rig.hips || rig.body;
    if (hips) { hips.position.y = hips.userData.rest.position.y + pose.hipsY; hips.position.x = hips.userData.rest.position.x + pose.hipsX; }
    if (rig.root) { rig.root.rotation.set(pose.rootX, 0, pose.rootZ); rig.root.position.y = rig.root.userData.rest.position.y + pose.rootY; }
  }

  /**
   * input: { dt, action, guard, windup (0..1 build-up), strike (s remaining), stagger (s), dead, death (0..1),
   *          speaking, lookAt (Vector3|null), airborne, stride (gait length override) }
   */
  function update(dt, input = {}) {
    if (dt <= 0) return;
    input.dt = dt;
    state.time += dt;
    // Each hammer blow that lands bumps a counter the game reads for sparks and sound.
    if (input.activity === 'work_hammer') { const blow = Math.floor(state.time * HAMMER_RATE); if (blow !== state.blow) { state.blow = blow; character.userData.blows = (character.userData.blows || 0) + 1; } }
    // Speed from actual displacement keeps the gait locked to the ground.
    const vx = character.position.x - last.x, vz = character.position.z - last.z, moved = Math.hypot(vx, vz);
    last.copy(character.position);
    const speed = moved / dt > 30 ? 0 : moved / dt;
    state.speed = damp(state.speed, speed, 10, dt);
    // Travel in the body's frame (front −Z): f forward/back, side right/left.
    const yaw = character.rotation.y, f = (-vx * Math.sin(yaw) - vz * Math.cos(yaw)) / dt, side = (vx * Math.cos(yaw) - vz * Math.sin(yaw)) / dt;
    if (speed > .3 && speed < 30) { state.dirF = damp(state.dirF, f / speed, 9, dt); state.dirS = damp(state.dirS, side / speed, 9, dt); }
    else { state.dirF = damp(state.dirF, 1, 3, dt); state.dirS = damp(state.dirS, 0, 3, dt); }
    const accel = speed < 30 ? (f - state.prevF) / dt : 0; state.prevF = speed < 30 ? f : 0;
    state.accF = damp(state.accF, clamp(accel, -25, 25), 6, dt);
    state.lean = damp(state.lean, quadruped ? 0 : clamp(state.accF * .012, -.16, .2), 8, dt);
    const backwards = state.dirF < 0 ? .78 : 1, sideways = 1 - Math.abs(state.dirS) * .2;
    const shape = backwards * sideways * (1 - Math.abs(input.slope || 0) * .22) * (1 - (input.heavy || 0) * .08);
    // One gait cycle (two steps): humans lengthen the stride with speed more than they quicken it.
    const cycle = quadruped || input.stride ? (input.stride || 2.3 * character.scale.x) * (1 + state.run * 1.55) : Math.max(1.25, .65 + .58 * state.speed) * character.scale.x;
    state.phase = (state.phase + state.speed * dt / (cycle * shape)) % 1;
    state.move = damp(state.move, clamp(state.speed / 1.4, 0, 1), 8, dt);
    state.run = damp(state.run, clamp((state.speed - 2.4) / 2.6, 0, 1), 6, dt);
    state.sprint = damp(state.sprint, clamp((state.speed - 5.8) / 2.4, 0, 1), 5, dt);
    const yawDelta = wrapAngle(character.rotation.y - state.lastYaw); state.lastYaw = character.rotation.y;
    state.capeLag = damp(state.capeLag, clamp(-yawDelta / dt * .08, -.5, .5), 5, dt);
    state.roll = damp(state.roll, quadruped ? 0 : clamp(yawDelta / dt * state.speed * .012, -.14, .14), 6, dt);
    state.turnDrag = damp(state.turnDrag || 0, quadruped ? 0 : clamp(yawDelta / dt * .09, -.5, .5), 7, dt);
    // A landing: the faster the body came down, the deeper it sinks into the knees.
    if (state.wasAirborne && !input.airborne) state.land = Math.max(state.land || 0, clamp(-(state.lastVy ?? 0) / 11, .15, 1));
    state.wasAirborne = !!input.airborne; state.lastVy = input.vy ?? 0;
    state.land = Math.max(0, (state.land || 0) - dt * 3.2);
    // Which feet carry weight: a foot stands while its leg moves against the direction of travel.
    for (const [i, offset] of [[0, Math.PI], [1, 0]]) {
      const c = Math.cos(state.phase * TAU + offset);
      state.contact[i] = input.airborne || input.dead || input.getup ? 0 : state.move < .15 ? 1 : clamp(.5 - c * (3 + 3 * state.run) - state.run * .35, 0, 1);
    }
    const pose = new Pose();
    if (input.dead) death(pose, clamp(input.death ?? 1, 0, 1));
    else if (quadruped) wolf(pose, input);
    else humanoid(pose, input);
    // Head tracking toward a point of interest, split between neck and head.
    let lookYaw = 0, lookPitch = 0;
    if (input.lookAt && !input.dead) {
      character.getWorldPosition(target);
      const dx = input.lookAt.x - target.x, dz = input.lookAt.z - target.z;
      lookYaw = clamp(wrapAngle(Math.atan2(-dx, -dz) - character.rotation.y), -1.1, 1.1);
      lookPitch = clamp(Math.atan2(input.lookAt.y - target.y - 2.2 * character.scale.y, Math.hypot(dx, dz)), -.4, .4);
    }
    state.look = damp(state.look, lookYaw, 5, dt); state.lookPitch = damp(state.lookPitch, lookPitch, 5, dt);
    if (!quadruped) { pose.add('neck', state.lookPitch * .4, state.look * .4); pose.add('head', state.lookPitch * .6, state.look * .6); }
    else { pose.add('neck', 0, state.look * .5); pose.add('head', state.lookPitch * .5, state.look * .4); }
    apply(pose);
    // A drawn blade hangs tip-down at the side, comes up ready in combat, rises in guard.
    aimSword(character, input, state, dt);
  }
  return { update, get speed() { return state.speed; }, get phase() { return state.phase; }, get contact() { return state.contact; }, get direction() { return [state.dirF, state.dirS]; } };
}

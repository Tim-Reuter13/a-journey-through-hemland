import * as THREE from 'three';
import { applyTwoBone } from './ik.js';
import { ANKLE } from './rig.js';

// HUMANITY MOTION · foot IK (top priority: no floating feet). Runs after the animator: the gait
// still decides where a foot swings and how high it lifts, the ground decides where it lands.
// · each foot finds the real ground under it (terrain, steps, floors, crates: the same
//   ground function the controllers stand on), smoothed so a changing hit never makes it jump;
// · a foot in its contact phase is locked where it landed and released softly when the gait lifts
//   it or the body has turned too far away (that release is a small step: turning in place);
// · the pelvis drops when a leg cannot reach its ground (one foot on a stone, stairs, slopes) and the
//   other knee bends; the planted foot tilts to the ground (limited to 30°).
const SIDES = ['right', 'left'];
const MAX_TILT = Math.cos(THREE.MathUtils.degToRad(30));
const _a = new THREE.Vector3(), _hip = new THREE.Vector3(), _knee = new THREE.Vector3(), _pole = new THREE.Vector3(), _fwd = new THREE.Vector3();
const _n = new THREE.Vector3(), _up = new THREE.Vector3(), _q = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _r = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

export function createFootState() {
  return { locked: false, lock: new THREE.Vector3(), from: new THREE.Vector3(), release: 0, ground: null, target: new THREE.Vector3(), contact: 0, lift: 0 };
}

/**
 * One foot, pure planning (testable without a rig). animated: where the gait puts the ankle (world);
 * rootY: the height the body stands at; groundY(x, z): ground height; contact: 0..1 stance weight.
 * Writes and returns f.target (ankle position to reach).
 */
export function planFoot(f, animated, rootY, groundY, contact, dt, { ankle = ANKLE, maxDrift = .3, lift: liftScale = 1, lock = true } = {}) {
  const lift = Math.max(0, animated.y - (rootY + ankle));
  const g = groundY(animated.x, animated.z);
  if (f.ground === null || Math.abs(g - f.ground) > 1.2) f.ground = g;
  else f.ground += (g - f.ground) * (1 - Math.exp(-dt * 28));
  f.contact = contact; f.lift = lift;
  // Walking, the gait already keeps a standing foot still; locks are for standing and turning on the spot.
  if (!lock && f.locked) { f.locked = false; f.release = 1; f.from.copy(f.lock); }
  if (lock && !f.locked && contact > .85 && lift < .04) { f.locked = true; f.lock.set(animated.x, f.ground + ankle, animated.z); }
  if (f.locked) {
    const drift = Math.hypot(f.lock.x - animated.x, f.lock.z - animated.z);
    if (contact < .5 || drift > maxDrift) { f.locked = false; f.release = 1; f.from.copy(f.lock); }
  }
  if (f.locked) return f.target.copy(f.lock);
  f.target.set(animated.x, f.ground + ankle + lift * liftScale, animated.z);
  if (f.release > 0) {
    // Leaving a lock: travel from where the foot stood to the gait's foot, lifting a little on the way.
    const k = 1 - f.release;
    f.target.lerpVectors(f.from, f.target, k * k * (3 - 2 * k)).y += Math.sin(Math.PI * k) * .09;
    f.release = Math.max(0, f.release - dt / .16);
  }
  return f.target;
}

/** How far the pelvis must come down so a leg of `length` reaches `target` from `hip`. */
export function pelvisDrop(hip, target, length) {
  const h = Math.hypot(hip.x - target.x, hip.z - target.z), v = hip.y - target.y;
  if (h >= length) return Math.max(0, v);
  return Math.max(0, v - Math.sqrt(length * length - h * h));
}

export function createFootIK(character, adapter) {
  const feet = { right: createFootState(), left: createFootState() };
  let drop = 0, active = 0;
  const debug = { feet, drop: 0, reached: [true, true] };

  function reset() { for (const s of SIDES) Object.assign(feet[s], createFootState()); drop = 0; }

  /**
   * ctx: { groundY(x, z), normal(x, z, out), contact: [right, left], weight 0..1, moving 0..1 }.
   * Call after the animator (and anything else that poses the body) has run this frame.
   */
  function update(dt, ctx) {
    const rig = character.userData.rig;
    active += ((ctx.weight ?? 1) - active) * (1 - Math.exp(-dt * 10));
    if (!rig?.hips || !adapter.ok || active < .02) { if (active < .02) reset(); return debug; }
    character.updateMatrixWorld(true);
    const scale = rig.leg_upper_right.parent.getWorldScale(_a).y;
    const { thigh, shin } = adapter.lengths(), length = (thigh + shin) * scale * .995, ankle = ANKLE * scale;
    const rootY = character.position.y;
    const maxDrift = .16 * scale;
    // 1. Plan both feet from the animated pose.
    const qa = {};
    for (const [i, side] of SIDES.entries()) {
      const foot = rig[`foot_${side}`];
      foot.getWorldPosition(_a); qa[side] = foot.getWorldQuaternion(new THREE.Quaternion());
      planFoot(feet[side], _a, rootY, ctx.groundY, ctx.contact?.[i] ?? 1, dt, { ankle, maxDrift, lock: (ctx.moving ?? 0) < .35 });
    }
    // 2. Pelvis: come down as far as the lower foot needs (never more than half a leg).
    let need = 0;
    for (const side of SIDES) { rig[`leg_upper_${side}`].getWorldPosition(_hip); need = Math.max(need, pelvisDrop(_hip, feet[side].target, length)); }
    need = Math.min(need, .5 * scale);
    drop += (need - drop) * (1 - Math.exp(-dt * (need > drop ? 16 : 9)));
    const hipsScale = rig.hips.parent.getWorldScale(_a).y || 1;
    rig.hips.position.y -= drop * active / hipsScale;
    rig.hips.updateMatrixWorld(true);
    // 3. Legs: knees bend forward (pole in front of the knee), never past their limit.
    _fwd.set(0, 0, -1).applyQuaternion(rig.hips.getWorldQuaternion(_q)); _fwd.y = 0; _fwd.normalize();
    for (const [i, side] of SIDES.entries()) {
      const upper = rig[`leg_upper_${side}`], lower = rig[`leg_lower_${side}`], foot = rig[`foot_${side}`];
      lower.getWorldPosition(_knee);
      _pole.copy(_knee).addScaledVector(_fwd, 1.5 * scale).y += .2 * scale;
      const r = applyTwoBone(upper, lower, foot, feet[side].target, _pole, { weight: active, maxFlex: 2.5 });
      debug.reached[i] = r.reached;
      // 4. The foot keeps its animated swing but lies flat on the ground while it stands.
      const f = feet[side], plant = Math.max(f.locked ? 1 : 0, f.contact) * active;
      ctx.normal(f.target.x, f.target.z, _n);
      if (_n.dot(UP) < MAX_TILT) _n.lerp(UP, .5).normalize();
      _up.set(0, 1, 0).applyQuaternion(qa[side]);
      _r.setFromUnitVectors(_up, _n);
      _q.copy(qa[side]).premultiply(_r);
      _qa.copy(qa[side]).slerp(_q, plant);
      foot.parent.getWorldQuaternion(_qp).invert();
      foot.quaternion.copy(_qp.multiply(_qa));
      foot.updateMatrixWorld(true);
    }
    debug.drop = drop;
    return debug;
  }
  return { update, reset, feet, debug };
}

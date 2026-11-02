import * as THREE from 'three';
import { applyTwoBone } from '../systems/motion/ik.js';

// HORSES · a person on a horse (systems/horses.js). After the horse is posed for the frame, the rider is put
// on its saddle (or partway there, mounting and dismounting from the side they stand on), posed by the
// humanoid animator's riding pose, and then the boots are set into the stirrups and the hands onto the reins
// by IK, so any rider sits any horse at any gait.
const clamp = THREE.MathUtils.clamp, smooth = THREE.MathUtils.smoothstep;
const PX = 1 / 16;
// In the saddle bone's frame (pivot 0, 38.6, -1 px): the top of the seat; in a stirrup bone's frame: where a
// boot's ankle sits when its sole rests on the iron; in the saddle's frame: the hands on the reins.
const SEAT = new THREE.Vector3(0, 1 * PX, 1 * PX), IRON = new THREE.Vector3(0, -7 * PX, -.4 * PX), REINS = new THREE.Vector3(0, 7 * PX, -6.5 * PX);
const HIPS = 15.5 * PX; // root to the seat of the trousers on a Hemland humanoid (hips pivot 17 px)
const _pos = new THREE.Vector3(), _q = new THREE.Quaternion(), _yawQ = new THREE.Quaternion(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const _right = new THREE.Vector3(), _fwd = new THREE.Vector3(), _up = new THREE.Vector3(), _pole = new THREE.Vector3(), _target = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Where a rider's root goes when seated on the horse, and which way the seat faces (out params). */
export function seatOf(horseModel, scale, outPos, outQuat) {
  const saddle = horseModel.userData.rig.saddle;
  outPos.copy(SEAT); outPos.y -= HIPS * scale;
  saddle.localToWorld(outPos);
  saddle.getWorldQuaternion(outQuat);
}
/** The spot beside the horse a rider mounts from or steps down to (side −1: the horse's left). */
export function sideSpot(horse, side, out) {
  const yaw = horse.model.rotation.y;
  return out.set(horse.model.position.x + Math.cos(yaw) * side * 1.2 + Math.sin(yaw) * .1, horse.model.position.y, horse.model.position.z - Math.sin(yaw) * side * 1.2 + Math.cos(yaw) * .1);
}

/**
 * Puts the rider where `ride` says and poses them. ride: { kind: 'mount' | 'ride' | 'dismount', t (0..1 of the
 * move), side, from / fromYaw (where a mount started), to (the ground spot a dismount ends on), lean }.
 * groundAt(x, z) gives the height to step down to. Call after the horse's animator ran this frame.
 */
export function seatRider(rider, animator, horse, ride, dt, { groundAt, lookAt = null, input = {}, busy = 0, armed = false } = {}) {
  const scale = rider.scale.y, hm = horse.model;
  hm.updateMatrixWorld(true);
  seatOf(hm, scale, _pos, _q);
  const yaw = hm.rotation.y, t = clamp(ride.t ?? 1, 0, 1);
  if (ride.kind === 'mount') {
    // Step to the stirrup, then up and over into the seat; the body turns from facing the horse to forward.
    sideSpot(horse, ride.side, _a); _a.y = groundAt ? groundAt(_a.x, _a.z) : _a.y;
    _b.copy(ride.from).lerp(_a, smooth(t, 0, .22));
    const up = smooth(t, .18, .74);
    rider.position.copy(_b).lerp(_pos, up); rider.position.y += Math.sin(Math.PI * up) * .28;
    const facing = yaw + ride.side * Math.PI / 2, turn = smooth(t, .45, .95);
    const start = facing + THREE.MathUtils.euclideanModulo(ride.fromYaw - facing + Math.PI, Math.PI * 2) - Math.PI;
    _yawQ.setFromAxisAngle(UP, THREE.MathUtils.lerp(THREE.MathUtils.lerp(start, facing, smooth(t, 0, .2)), yaw, turn));
    rider.quaternion.copy(_yawQ).slerp(_q, smooth(t, .8, 1));
  } else if (ride.kind === 'dismount') {
    // Over the croup with the far leg, down beside the horse, standing.
    const down = smooth(t, .22, .85), to = ride.to;
    rider.position.copy(_pos).lerp(to, down); rider.position.y += Math.sin(Math.PI * down) * .2;
    _yawQ.setFromAxisAngle(UP, yaw);
    rider.quaternion.copy(_q).slerp(_yawQ, smooth(t, .2, .6));
  } else { rider.position.copy(_pos); rider.quaternion.copy(_q); }
  rider.updateMatrixWorld(true);
  const W = horse.animator.weights;
  animator.update(dt, { ...input, ride: { kind: ride.kind, t, side: ride.side, weights: W, phase: horse.animator.phase, move: clamp(horse.animator.speed / 1.5, 0, 1), lean: ride.lean || 0, time: performance.now() / 1000 }, lookAt });
  rider.updateMatrixWorld(true);
  // Boots into the stirrups and hands to the reins: fully when seated, the near boot early in a mount and late
  // in a dismount, the hands on the saddle while climbing.
  const rig = rider.userData.rig, hrig = hm.userData.rig;
  _right.set(1, 0, 0).applyQuaternion(_q); _fwd.set(0, 0, -1).applyQuaternion(_q); _up.set(0, 1, 0).applyQuaternion(_q);
  const seated = ride.kind === 'ride' ? 1 : ride.kind === 'mount' ? smooth(t, .78, 1) : 1 - smooth(t, .05, .3);
  for (const [side, s] of [['right', 1], ['left', -1]]) {
    const near = s === ride.side, w = Math.max(seated, near && ride.kind === 'mount' ? 1 - smooth(t, .55, .7) : 0, near && ride.kind === 'dismount' ? 1 - smooth(t, .6, .8) : 0);
    const stirrup = hrig[`stirrup_${side}`];
    if (w > .01 && stirrup && rig[`leg_upper_${side}`]) {
      stirrup.localToWorld(_target.copy(IRON));
      rig[`leg_upper_${side}`].getWorldPosition(_pole).addScaledVector(_fwd, 1.2).addScaledVector(_right, s * .5);
      applyTwoBone(rig[`leg_upper_${side}`], rig[`leg_lower_${side}`], rig[`foot_${side}`], _target, _pole, { weight: w, maxFlex: 2.5 });
    }
    // A sword, a bow, a flask or a spell takes the hand (both, for the bow) off the reins.
    const hands = (ride.kind === 'ride' ? 1 : ride.kind === 'mount' ? smooth(t, .7, 1) : 1 - smooth(t, 0, .35)) * (1 - busy) * (side === 'right' && armed ? 0 : 1);
    if (hands > .01 && rig[`arm_upper_${side}`] && hrig.saddle) {
      _target.copy(REINS); _target.x += s * 1.6 * PX; hrig.saddle.localToWorld(_target);
      rig[`arm_upper_${side}`].getWorldPosition(_pole).addScaledVector(_fwd, -.5).addScaledVector(_right, s * .45).addScaledVector(_up, -.3);
      applyTwoBone(rig[`arm_upper_${side}`], rig[`arm_lower_${side}`], rig[`grip_${side}`] || rig[`hand_${side}`], _target, _pole, { weight: hands, maxFlex: 2.4 });
    }
  }
}

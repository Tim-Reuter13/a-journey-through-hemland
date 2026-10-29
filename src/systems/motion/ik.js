import * as THREE from 'three';

// HUMANITY MOTION · layer D, inverse kinematics. Works on whatever pose the animator produced this
// frame (never accumulates): two-bone chains for arms and legs with a pole for the bend direction,
// a maximum flexion (no knee folds through the thigh) and a reach limit (no stretched limbs). An
// unreachable target is reported so the caller can lean, step or refuse instead. FABRIK serves
// longer chains (the spine leaning toward something the arm cannot reach).
const clamp = THREE.MathUtils.clamp;
const _d = new THREE.Vector3(), _b = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Vector3(), _h = new THREE.Vector3();
const _from = new THREE.Vector3(), _to = new THREE.Vector3(), _goal = new THREE.Vector3(), _joint = new THREE.Vector3();
const _q = new THREE.Quaternion(), _w = new THREE.Quaternion(), _p = new THREE.Quaternion(), _id = new THREE.Quaternion();

/**
 * Pure two-bone solve. root/joint/end: current positions (lengths come from them), target and pole
 * in the same space. maxFlex: largest bend at the joint (radians from straight).
 * Returns { joint, end, reached, stretch } (joint/end written into out vectors).
 */
export function solveTwoBone(root, joint, end, target, pole, { maxFlex = 2.6, out = {} } = {}) {
  const l1 = root.distanceTo(joint), l2 = joint.distanceTo(end);
  _d.subVectors(target, root);
  const dist = _d.length();
  const longest = l1 + l2, shortest = Math.sqrt(Math.max(0, l1 * l1 + l2 * l2 - 2 * l1 * l2 * Math.cos(Math.PI - maxFlex)));
  const reached = dist <= longest * .999 && dist >= shortest * .999;
  const reach = clamp(dist, Math.max(shortest, 1e-4), longest * .999);
  if (dist < 1e-6) _d.set(0, -1, 0); else _d.divideScalar(dist);
  const cos = clamp((l1 * l1 + reach * reach - l2 * l2) / (2 * l1 * reach), -1, 1);
  _b.subVectors(pole, root); _b.addScaledVector(_d, -_b.dot(_d));
  if (_b.lengthSq() < 1e-8) _b.set(0, 0, -1).addScaledVector(_d, -_d.z);
  _b.normalize();
  out.joint = (out.joint || new THREE.Vector3()).copy(root).addScaledVector(_d, cos * l1).addScaledVector(_b, Math.sqrt(1 - cos * cos) * l1);
  out.end = (out.end || new THREE.Vector3()).copy(root).addScaledVector(_d, reach);
  out.reached = reached; out.stretch = dist / longest; out.distance = dist;
  return out;
}

/** Rotates a bone (in world space) so its direction `from` becomes `to`, by `weight`. */
export function turnBone(bone, from, to, weight = 1) {
  if (from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) return;
  _q.setFromUnitVectors(from.normalize(), to.normalize());
  if (weight < 1) _q.slerpQuaternions(_id, _q, weight);
  bone.getWorldQuaternion(_w).premultiply(_q);
  bone.parent.getWorldQuaternion(_p).invert();
  bone.quaternion.copy(_p.multiply(_w));
  bone.updateMatrixWorld(true);
}

/**
 * Bends a rig chain upper → lower → end so `end` meets `target` (world), bending toward `pole`.
 * weight blends from the animated pose. Returns the solve result (reached, stretch).
 */
export function applyTwoBone(upper, lower, end, target, pole, { weight = 1, maxFlex = 2.6 } = {}) {
  upper.updateWorldMatrix(true, true);
  upper.getWorldPosition(_s); lower.getWorldPosition(_e); end.getWorldPosition(_h);
  _goal.copy(_h).lerp(target, clamp(weight, 0, 1));
  const r = solveTwoBone(_s, _e, _h, _goal, pole, { maxFlex, out: _solved });
  _joint.copy(r.joint);
  turnBone(upper, _from.subVectors(_e, _s), _to.subVectors(_joint, _s));
  lower.getWorldPosition(_e); end.getWorldPosition(_h);
  turnBone(lower, _from.subVectors(_h, _e), _to.subVectors(r.end, _e));
  return r;
}
const _solved = {};

/** Keeps a point out of a vertical capsule (the torso), so no hand target lies inside the body. */
export function keepOutside(point, centre, radius, halfHeight) {
  if (Math.abs(point.y - centre.y) > halfHeight) return false;
  const dx = point.x - centre.x, dz = point.z - centre.z, d = Math.hypot(dx, dz);
  if (d >= radius) return false;
  if (d < 1e-5) { point.x = centre.x + radius; return true; }
  point.x = centre.x + dx / d * radius; point.z = centre.z + dz / d * radius;
  return true;
}

/** FABRIK on a chain of points (array of Vector3, root first); fixed lengths; returns reached. */
export function fabrik(points, target, { iterations = 8, tolerance = 1e-3 } = {}) {
  const n = points.length, lengths = [];
  for (let i = 0; i < n - 1; i++) lengths.push(points[i].distanceTo(points[i + 1]));
  const total = lengths.reduce((a, b) => a + b, 0), root = points[0].clone();
  if (root.distanceTo(target) > total) {
    for (let i = 0; i < n - 1; i++) { const dir = _d.subVectors(target, points[i]).normalize(); points[i + 1].copy(points[i]).addScaledVector(dir, lengths[i]); }
    return false;
  }
  for (let k = 0; k < iterations && points[n - 1].distanceTo(target) > tolerance; k++) {
    points[n - 1].copy(target);
    for (let i = n - 2; i >= 0; i--) { const dir = _d.subVectors(points[i], points[i + 1]).normalize(); points[i].copy(points[i + 1]).addScaledVector(dir, lengths[i]); }
    points[0].copy(root);
    for (let i = 0; i < n - 1; i++) { const dir = _d.subVectors(points[i + 1], points[i]).normalize(); points[i + 1].copy(points[i]).addScaledVector(dir, lengths[i]); }
  }
  return points[n - 1].distanceTo(target) <= tolerance * 10;
}

// ── Pose snapshots: a ragdoll's last pose is captured in world space and faded into the animated
// get-up, so standing up starts exactly where the body lies (no pop).
export function capturePose(rig, names) {
  const pose = new Map();
  for (const name of names) { const b = rig[name]; if (!b) continue; b.updateWorldMatrix(true, false);
    pose.set(name, { q: b.getWorldQuaternion(new THREE.Quaternion()), p: b.getWorldPosition(new THREE.Vector3()) }); }
  return pose;
}
/** Blends bones (parents first in `names`) toward a captured pose by weight w (1 = captured). */
export function blendToPose(rig, pose, w, names) {
  if (w <= 0) return;
  for (const name of names) {
    const b = rig[name], c = pose.get(name); if (!b || !c) continue;
    b.parent.updateWorldMatrix(true, false);
    b.getWorldQuaternion(_w).slerp(c.q, w);
    b.parent.getWorldQuaternion(_p).invert();
    b.quaternion.copy(_p.multiply(_w));
    if (name === 'hips') { b.getWorldPosition(_s).lerp(c.p, w); b.position.copy(b.parent.worldToLocal(_s)); }
    b.updateMatrixWorld(true);
  }
}

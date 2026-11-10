import * as THREE from 'three';
import { sampleTrack, PIVOT_Y } from './combatRules.js';

// Combat 2.0 — where a weapon really is, and what it really touches (docs/COMBAT_2.md).
// Pure geometry: a blade is a segment from the grip to the point, sampled from the attack's track at simulation
// time, pitched about the shoulders, turned and moved with the body. Bodies are capsules round the bones of their
// animated rig (a snapshot taken each rendered frame, carried along with the body's simulated position), shields
// are boxes. A sweep between two simulation times takes as many sub-steps as the point of the blade needs to
// move at most SUBSTEP, bisects to the first touch, and reports contacts in the order they happened; a shield, a
// wall or the ground ends the sweep. Same answer at any frame rate: only simulation time is sampled.

export const SUBSTEP = .08;
const V = () => new THREE.Vector3();

// ── Frames. { x, y, z, yaw, scale, pitch }: feet position, facing (rotation.y, front −Z), model scale, and the
// pitch the track is tilted by about the shoulder line (positive: up).
export function toWorld(frame, p, out) {
  const a = frame.pitch || 0, c = Math.cos(a), s = Math.sin(a), s0 = frame.scale ?? 1;
  const y0 = p[1] - PIVOT_Y, z0 = p[2];
  const y = PIVOT_Y + y0 * c - z0 * s, z = y0 * s + z0 * c, x = p[0];
  const cy = Math.cos(frame.yaw), sy = Math.sin(frame.yaw);
  return out.set(frame.x + (x * cy + z * sy) * s0, frame.y + y * s0, frame.z + (-x * sy + z * cy) * s0);
}
export function dirToWorld(frame, d, out) {
  const a = frame.pitch || 0, c = Math.cos(a), s = Math.sin(a);
  const y = d[1] * c - d[2] * s, z = d[1] * s + d[2] * c, x = d[0];
  const cy = Math.cos(frame.yaw), sy = Math.sin(frame.yaw);
  return out.set(x * cy + z * sy, y, -x * sy + z * cy).normalize();
}
const _sample = { hilt: [0, 0, 0], dir: [0, 0, 0] };
/** The blade at phase time `time` (0–3) in world space: out.hilt, out.tip, out.dir. */
export function bladeAt(def, weapon, time, frame, out = { hilt: V(), tip: V(), dir: V() }) {
  sampleTrack(def, time, _sample);
  toWorld(frame, _sample.hilt, out.hilt); dirToWorld(frame, _sample.dir, out.dir);
  out.tip.copy(out.hilt).addScaledVector(out.dir, weapon.length * (frame.scale ?? 1));
  return out;
}

// ── Closest points between segments p1q1 and p2q2 (Ericson, Real-Time Collision Detection 5.1.9).
const _d1 = V(), _d2 = V(), _r = V(), _c1 = V(), _c2 = V();
export function closestSegments(p1, q1, p2, q2, out = { s: 0, t: 0, dist2: 0 }) {
  _d1.subVectors(q1, p1); _d2.subVectors(q2, p2); _r.subVectors(p1, p2);
  const a = _d1.lengthSq(), e = _d2.lengthSq(), f = _d2.dot(_r);
  let s, t;
  if (a <= 1e-9 && e <= 1e-9) { s = t = 0; }
  else if (a <= 1e-9) { s = 0; t = Math.min(1, Math.max(0, f / e)); }
  else {
    const c = _d1.dot(_r);
    if (e <= 1e-9) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
    else {
      const b = _d1.dot(_d2), den = a * e - b * b;
      s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
      else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    }
  }
  _c1.copy(p1).addScaledVector(_d1, s); _c2.copy(p2).addScaledVector(_d2, t);
  out.s = s; out.t = t; out.dist2 = _c1.distanceToSquared(_c2);
  return out;
}
/** Segment p→q against an oriented box { center, axes: [3 unit Vector3], half: [3] } grown by `margin`: entry
 *  parameter along the segment (0–1) or -1. */
const _lp = V(), _lq = V(), _tmp = V();
export function segmentBox(p, q, box, margin = 0) {
  _tmp.subVectors(p, box.center); _lp.set(_tmp.dot(box.axes[0]), _tmp.dot(box.axes[1]), _tmp.dot(box.axes[2]));
  _tmp.subVectors(q, box.center); _lq.set(_tmp.dot(box.axes[0]), _tmp.dot(box.axes[1]), _tmp.dot(box.axes[2]));
  let t0 = 0, t1 = 1;
  for (let k = 0; k < 3; k++) {
    const a = _lp.getComponent(k), d = _lq.getComponent(k) - a, h = box.half[k] + margin;
    if (Math.abs(d) < 1e-9) { if (a < -h || a > h) return -1; continue; }
    let ta = (-h - a) / d, tb = (h - a) / d; if (ta > tb) { const x = ta; ta = tb; tb = x; }
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return -1;
  }
  return t0;
}

// ── Bodies. A rig snapshot holds model-space points of the bones that bound a person (see RIG_POINTS); a body's
// colliders are built from it at the body's current simulated position and facing.
export const RIG_POINTS = ['head', 'neck', 'chest', 'hips', 'arm_upper_right', 'arm_lower_right', 'hand_right', 'grip_right',
  'arm_upper_left', 'arm_lower_left', 'hand_left', 'grip_left', 'leg_upper_right', 'leg_lower_right', 'foot_right', 'leg_upper_left', 'leg_lower_left', 'foot_left'];
const P = Object.fromEntries(RIG_POINTS.map((n, i) => [n, i]));
/** A person standing at ease (measured from the Blockbench rigs), for bodies without a snapshot and for tests. */
export const STANDING = [[0, 2.32, 0], [0, 1.98, 0], [0, 1.53, 0], [0, 1.08, 0], [.43, 1.92, 0], [.45, 1.56, -.05], [.45, 1.22, -.08], [.43, 1.12, -.1],
  [-.43, 1.92, 0], [-.45, 1.56, -.05], [-.45, 1.22, -.08], [-.43, 1.12, -.1], [.13, 1.09, 0], [.15, .58, 0], [.17, .13, 0], [-.13, 1.08, 0], [-.12, .57, 0], [-.1, .12, 0]];
const _m = new THREE.Matrix4(), _w = V(), _head = V();
/** Model-space positions of RIG_POINTS from the posed model (call after the animator / ragdoll moved the bones). */
export function snapshotRig(model, out = new Float32Array(RIG_POINTS.length * 3)) {
  const rig = model.userData.rig; if (!rig?.chest || !rig.hips) return null;
  model.updateMatrixWorld(true); _m.copy(model.matrixWorld).invert();
  RIG_POINTS.forEach((name, i) => {
    const bone = rig[name];
    if (name === 'head') { if (!bone) { out.set([0, 2.32, 0], 0); return; } bone.localToWorld(_head.set(0, .25, 0)); _w.copy(_head); }
    else if (!bone) { out.set(STANDING[i], i * 3); return; }
    else bone.getWorldPosition(_w);
    _w.applyMatrix4(_m); out[i * 3] = _w.x; out[i * 3 + 1] = _w.y; out[i * 3 + 2] = _w.z;
  });
  return out;
}
/** A held shield's box in model space (Matrix4 elements + half size), or null. */
export function snapshotShield(model, mesh, out = { matrix: new THREE.Matrix4(), half: [0, 0, 0], center: V() }) {
  if (!mesh?.visible) return null;
  const box = mesh.userData.shieldBox ??= (() => { const b = new THREE.Box3(); mesh.traverse(o => { if (o.geometry) { o.geometry.computeBoundingBox(); const g = o.geometry.boundingBox.clone(); if (o !== mesh) g.applyMatrix4(_m.copy(o.matrixWorld).premultiply(new THREE.Matrix4().copy(mesh.matrixWorld).invert())); b.union(g); } }); return b; })();
  model.updateMatrixWorld(true);
  out.matrix.copy(model.matrixWorld).invert().multiply(mesh.matrixWorld);
  box.getCenter(out.center); const size = box.getSize(_w); out.half[0] = size.x / 2; out.half[1] = size.y / 2; out.half[2] = size.z / 2;
  return out;
}
const lateral = (points, a, b, out) => out.set(points[a * 3] - points[b * 3], 0, points[a * 3 + 2] - points[b * 3 + 2]).normalize();
const point = (points, i, out) => out.set(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]);
const _lat = V(), _latH = V(), _pa = V(), _pb = V();
function capsule(list, owner, frame, a, b, r, region, part = 'body') {
  const c = list.pool.length > list.n ? list.pool[list.n] : (list.pool[list.n] = { kind: 'capsule', a: V(), b: V(), r: 0, owner: null, region: '', part: '' });
  list.n++;
  localToWorld(frame, a, c.a); localToWorld(frame, b, c.b); c.r = r * (frame.scale ?? 1); c.owner = owner; c.region = region; c.part = part; c.kind = 'capsule';
  return c;
}
/** Model-space point (unpitched) → world for a body frame. */
export function localToWorld(frame, p, out) {
  const cy = Math.cos(frame.yaw), sy = Math.sin(frame.yaw), s = frame.scale ?? 1;
  return out.set(frame.x + (p.x * cy + p.z * sy) * s, frame.y + p.y * s, frame.z + (-p.x * sy + p.z * cy) * s);
}
const _q1 = V(), _q2 = V();
/** Capsules of a person (15) from a snapshot (or STANDING), appended to `list` ({ pool, n }). */
export function humanColliders(list, owner, frame, points = null) {
  const pts = points || STANDING_FLAT;
  lateral(pts, P.arm_upper_right, P.arm_upper_left, _lat); lateral(pts, P.leg_upper_right, P.leg_upper_left, _latH);
  point(pts, P.head, _pa); capsule(list, owner, frame, _pa, _pa, .27, 'head');
  for (const side of [1, -1]) {
    // The trunk is two capsules side by side: as wide as the body, only as deep as it.
    point(pts, P.chest, _q1).addScaledVector(_lat, .12 * side); point(pts, P.neck, _q2).addScaledVector(_lat, .12 * side);
    capsule(list, owner, frame, _q1, _q2, .15, 'chest');
    point(pts, P.hips, _q2).addScaledVector(_latH, .12 * side);
    capsule(list, owner, frame, _q2, _q1, .15, 'belly');
  }
  for (const s of ['right', 'left']) {
    capsule(list, owner, frame, point(pts, P[`arm_upper_${s}`], _pa), point(pts, P[`arm_lower_${s}`], _pb), .12, `upper_arm_${s}`);
    capsule(list, owner, frame, _pb, point(pts, P[`hand_${s}`], _pa), .11, `forearm_${s}`);
    capsule(list, owner, frame, _pa, point(pts, P[`grip_${s}`], _pb), .09, `hand_${s}`);
    capsule(list, owner, frame, point(pts, P[`leg_upper_${s}`], _pa), point(pts, P[`leg_lower_${s}`], _pb), .15, `thigh_${s}`);
    capsule(list, owner, frame, _pb, point(pts, P[`foot_${s}`], _pa), .13, `shin_${s}`);
  }
  return list;
}
const STANDING_FLAT = new Float32Array(STANDING.flat());
/** A four-legged body (wolves, game): a trunk along the facing at `height`, a head in front. */
export function beastColliders(list, owner, frame, height = .9, radius = .45, length = 1.3) {
  capsule(list, owner, frame, _pa.set(0, height, length * .45), _pb.set(0, height, -length * .4), radius, 'chest');
  capsule(list, owner, frame, _pa.set(0, height + .1, -length * .55), _pa, radius * .6, 'head');
  capsule(list, owner, frame, _pa.set(0, height * .55, length * .3), _pb.set(0, .05, length * .3), radius * .4, 'thigh_right');
  capsule(list, owner, frame, _pa.set(0, height * .55, -length * .3), _pb.set(0, .05, -length * .3), radius * .4, 'shin_right');
  return list;
}
/** A shield box at the body's frame from snapshotShield(). */
export function shieldCollider(list, owner, frame, snap) {
  const c = list.pool.length > list.n ? list.pool[list.n] : (list.pool[list.n] = { kind: 'box', a: V(), b: V(), r: 0, owner: null, region: '', part: '' });
  list.n++;
  c.kind = 'box'; c.owner = owner; c.region = 'shield'; c.part = 'shield';
  c.box ??= { center: V(), axes: [V(), V(), V()], half: [0, 0, 0] };
  const s = frame.scale ?? 1, cy = Math.cos(frame.yaw), sy = Math.sin(frame.yaw), e = snap.matrix.elements;
  // world = T(frame) · R(yaw) · S(scale) · M(local); centre and axes through it.
  _pa.copy(snap.center).applyMatrix4(snap.matrix); localToWorld(frame, _pa, c.box.center);
  for (let k = 0; k < 3; k++) {
    const ax = _pb.set(e[k * 4], e[k * 4 + 1], e[k * 4 + 2]), len = ax.length();
    c.box.half[k] = snap.half[k] * len * s; ax.divideScalar(len || 1);
    c.box.axes[k].set(ax.x * cy + ax.z * sy, ax.y, -ax.x * sy + ax.z * cy);
  }
  c.a.copy(c.box.center); c.b.copy(c.box.center); c.r = Math.max(...c.box.half);
  return c;
}

// ── The sweep.
const _blade = { hilt: V(), tip: V(), dir: V() }, _seg = { s: 0, t: 0, dist2: 0 }, _probe = V(), _cp = V(), _tipA = V(), _tipB = V();
function touch(collider, hilt, tip, bladeR) {
  if (collider.kind === 'box') { const t = segmentBox(hilt, tip, collider.box, bladeR); return t >= 0 ? { s: t, at: t } : null; }
  closestSegments(hilt, tip, collider.a, collider.b, _seg);
  const reach = collider.r + bladeR;
  return _seg.dist2 <= reach * reach ? { s: _seg.s, at: _seg.t } : null;
}
/** Where the blade first meets the world at this pose: a wall (world.solidAt) or the ground. */
function worldTouch(world, hilt, tip, weapon) {
  if (!world) return null;
  const len = weapon.length, from = Math.max(.25, weapon.edge[0] * .5);
  for (let d = from; d <= len + 1e-6; d += .15) {
    const k = Math.min(1, d / len); _probe.lerpVectors(hilt, tip, k);
    const ground = world.groundAt?.(_probe.x, _probe.z);
    if (ground !== undefined && _probe.y < ground - .03) return { s: k, surface: 'ground', point: _probe.clone() };
    const solid = world.solidAt?.(_probe.x, _probe.y, _probe.z);
    if (solid) return { s: k, surface: solid, point: _probe.clone() };
  }
  return null;
}
/**
 * Sweeps an attack's blade from phase time `from` to `to` (clamped to the active phase 1–2).
 * opts: { def, weapon, frame (attacker's body frame; frame.scale for its size), colliders (array of capsule/box),
 *   ignore (Set of owners already struck or not to be struck), world ({ solidAt(x,y,z) → surface|null, groundAt(x,z) }),
 *   stopAt (owner → true when touching it ends the sweep: allies) }
 * Returns contacts in time order: { time, owner, collider, part, region, point, along (m from the grip), edge (bool),
 *   hilt, tip (blade at that moment), velocity (m/s of the blade there, needs opts.seconds per phase unit) }, the last
 *   one a stopper (shield, world, ally) when the blade was stopped.
 */
export function sweep(opts) {
  const { def, weapon, frame, colliders, ignore = null, world = null, stopAt = null, unitSeconds = def.active } = opts;
  const t0 = Math.max(1, opts.from), t1 = Math.min(2, opts.to);
  if (!(t1 > t0)) return [];
  const scale = frame.scale ?? 1, bladeR = weapon.radius * scale;
  // Broad phase: who can the blade reach at all this step?
  bladeAt(def, weapon, t0, frame, _blade); _tipA.copy(_blade.tip); const hiltA = _blade.hilt.clone();
  bladeAt(def, weapon, t1, frame, _blade); _tipB.copy(_blade.tip);
  const centre = V().addVectors(hiltA, _blade.hilt).add(_tipA).add(_tipB).multiplyScalar(.25);
  const span = Math.max(hiltA.distanceTo(_tipA), _tipA.distanceTo(_tipB), hiltA.distanceTo(_tipB)) + weapon.length * scale;
  const near = colliders.filter(c => !(ignore && ignore.has(c.owner)) && Math.min(c.a.distanceTo(centre), c.b.distanceTo(centre)) - c.r - (c.kind === 'capsule' ? c.a.distanceTo(c.b) : 0) < span);
  const steps = Math.min(32, Math.max(1, Math.ceil(_tipA.distanceTo(_tipB) / SUBSTEP)));
  const contacts = [], seen = new Set();
  let prevTime = t0;
  for (let k = 0; k <= steps; k++) {
    const time = t0 + (t1 - t0) * k / steps;
    bladeAt(def, weapon, time, frame, _blade);
    const found = [];
    for (const c of near) {
      if (seen.has(c.owner)) continue;
      if (!touch(c, _blade.hilt, _blade.tip, bladeR)) continue;
      // Bisect back to the first moment of contact between the last clear sample and this one.
      let lo = k ? prevTime : time, hi = time;
      if (k) for (let i = 0; i < 5; i++) { const mid = (lo + hi) / 2; bladeAt(def, weapon, mid, frame, _blade); if (touch(c, _blade.hilt, _blade.tip, bladeR)) hi = mid; else lo = mid; }
      bladeAt(def, weapon, hi, frame, _blade);
      const t = touch(c, _blade.hilt, _blade.tip, bladeR) || { s: 1, at: .5 };
      found.push({ time: hi, collider: c, s: t.s, at: t.at, hilt: _blade.hilt.clone(), tip: _blade.tip.clone(), dir: _blade.dir.clone() });
    }
    const wall = k ? worldTouch(world, (bladeAt(def, weapon, time, frame, _blade), _blade.hilt), _blade.tip, weapon) : null;
    if (wall) found.push({ time, collider: null, s: wall.s, wall, hilt: _blade.hilt.clone(), tip: _blade.tip.clone(), dir: _blade.dir.clone() });
    found.sort((a, b) => a.time - b.time || (a.collider?.part === 'shield' ? -1 : 0));
    for (const f of found) {
      const c = f.collider, stop = !c || c.part === 'shield' || stopAt?.(c.owner);
      if (c && seen.has(c.owner)) continue;
      const pt = c ? contactPoint(c, f) : f.wall.point;
      const along = f.s * weapon.length * scale;
      contacts.push({ time: f.time, owner: c?.owner ?? null, collider: c, part: c ? c.part : 'world', region: c?.region ?? 'world', surface: f.wall?.surface ?? null,
        point: pt, along, edge: along >= weapon.edge[0] * scale - 1e-6, hilt: f.hilt, tip: f.tip, dir: f.dir, stopped: !!stop,
        speed: bladeSpeed(def, weapon, frame, f.time, f.s, unitSeconds) });
      if (c) seen.add(c.owner);
      if (stop) return contacts;
      // A blade that does not cleave stops in the first body it meets.
      if (!weapon.cleave) { contacts[contacts.length - 1].stopped = true; return contacts; }
    }
    prevTime = time;
  }
  return contacts;
}
function contactPoint(c, f) {
  _cp.copy(f.hilt).lerp(f.tip, f.s);
  if (c.kind === 'box') return _cp.clone();
  const axis = V().lerpVectors(c.a, c.b, f.at), out = _cp.clone().sub(axis);
  const l = out.length(); if (l > 1e-6) out.multiplyScalar(Math.min(1, c.r / l));
  return out.add(axis);
}
const _sp1 = { hilt: V(), tip: V(), dir: V() }, _sp2 = { hilt: V(), tip: V(), dir: V() };
/** Speed (m/s) of the point at fraction s along the blade at phase time `time`. */
export function bladeSpeed(def, weapon, frame, time, s = 1, unitSeconds = def.active) {
  const h = .02;
  bladeAt(def, weapon, Math.max(1, time - h), frame, _sp1); bladeAt(def, weapon, Math.min(2, time + h), frame, _sp2);
  const a = _sp1.hilt.lerp(_sp1.tip, s), b = _sp2.hilt.lerp(_sp2.tip, s);
  const dt = (Math.min(2, time + h) - Math.max(1, time - h)) * unitSeconds;
  return dt > 0 ? a.distanceTo(b) / dt : 0;
}
/** Map a collider region to the damage model's region. */
export const regionOf = region => region === 'head' ? 'head' : region === 'neck' ? 'neck' : /^(chest|belly)$/.test(region) ? 'torso'
  : /^hand/.test(region) ? 'hand' : /arm/.test(region) ? 'arm' : /^(thigh|shin)/.test(region) ? 'leg' : /^foot/.test(region) ? 'foot' : region === 'shield' ? 'shield' : 'torso';
/** The side (left/right) a collider region belongs to, or null. */
export const sideOf = region => /right$/.test(region) ? 'right' : /left$/.test(region) ? 'left' : null;
/** A fresh collider list ({ pool, n, items() }). */
export function colliderList() { const l = { pool: [], n: 0, reset() { this.n = 0; return this; }, items() { return this.pool.slice(0, this.n); } }; return l; }

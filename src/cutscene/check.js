import * as THREE from 'three';
import { SHOTS, frameCamera } from './shots.js';
import { trunks } from './stage.js';

// Checks for the film, run in the engine on the real poses and the real cut:
// - the camera never stands inside a stone, the altar, a prop, a tree trunk or under the ground,
// - the people a shot is about are not hidden behind something and not cut off by the frame,
// plus a camera solver: a shot that fails is orbited / lifted / pulled until it passes (smallest change wins).
// Together with the bake's report (letzte_wacht_report.json) this is the film's automatic review.

const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Vector3(), _ndc = new THREE.Vector3();

export function makeBoxes(set) {
  return set.colliders.map(b => ({ name: b.name, c: new THREE.Vector3(...b.c), h: new THREE.Vector3(...b.h), cos: Math.cos(b.yaw), sin: Math.sin(b.yaw) }));
}
// world → box local (three.js rotation.y = yaw)
function local(b, p, out) {
  const x = p.x - b.c.x, z = p.z - b.c.z;
  return out.set(x * b.cos - z * b.sin, p.y - b.c.y, x * b.sin + z * b.cos);
}
function insideBox(b, p, pad = 0) {
  local(b, p, _q);
  return Math.abs(_q.x) < b.h.x + pad && Math.abs(_q.y) < b.h.y + pad && Math.abs(_q.z) < b.h.z + pad;
}
function segBox(b, p, q) {          // slab test in box space
  local(b, p, _a); local(b, q, _b);
  let t0 = 0, t1 = 1;
  for (const k of ['x', 'y', 'z']) {
    const d = _b[k] - _a[k], h = b.h[k];
    if (Math.abs(d) < 1e-9) { if (Math.abs(_a[k]) > h) return false; continue; }
    let u = (-h - _a[k]) / d, w = (h - _a[k]) / d;
    if (u > w) [u, w] = [w, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, w);
    if (t0 > t1) return false;
  }
  return true;
}
function segTrunk(c, p, q) {
  // 2D distance of the segment to the trunk axis, and the height there
  const dx = q.x - p.x, dz = q.z - p.z, L = dx * dx + dz * dz;
  const t = L > 1e-9 ? Math.max(0, Math.min(1, ((c.x - p.x) * dx + (c.z - p.z) * dz) / L)) : 0;
  const x = p.x + dx * t, z = p.z + dz * t, y = p.y + (q.y - p.y) * t;
  return (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r && y > c.y - .2 && y < c.y + c.h;
}

export function createChecker(film, set) {
  const boxes = makeBoxes(set);
  const cam = film.camera;
  const near = (p, list, r) => list.filter(c => Math.hypot(c.x - p.x, c.z - p.z) < r);

  // the other people are obstacles too: a capsule from hips to head per actor
  function bodyBlocks(from, to, skip) {
    for (const a of Object.values(film.actors)) {
      if (a === skip || !a.root.visible) continue;
      a.rig.hips.getWorldPosition(_a); a.rig.head.getWorldPosition(_b); _b.y += .35;
      // closest distance between segment from→to and the body axis
      const d1 = _v.subVectors(to, from), d2 = new THREE.Vector3().subVectors(_b, _a), r = new THREE.Vector3().subVectors(from, _a);
      const A = d1.dot(d1), E = d2.dot(d2), F = d2.dot(r), C = d1.dot(r), B = d1.dot(d2), den = A * E - B * B;
      let sc = den > 1e-9 ? THREE.MathUtils.clamp((B * F - C * E) / den, 0, 1) : 0;
      let tc = (B * sc + F) / E;
      if (tc < 0) { tc = 0; sc = THREE.MathUtils.clamp(-C / A, 0, 1); } else if (tc > 1) { tc = 1; sc = THREE.MathUtils.clamp((B - C) / A, 0, 1); }
      const p1 = from.clone().addScaledVector(d1, sc), p2 = _a.clone().addScaledVector(d2, tc);
      if (sc < .97 && p1.distanceTo(p2) < .32) return a.key;
    }
    return null;
  }
  function blocked(from, to, skip) {
    const body = bodyBlocks(from, to, skip); if (body) return body;
    for (const b of boxes) if (segBox(b, from, to)) return b.name;
    const span = from.distanceTo(to) + 1;
    for (const c of near(from, trunks, span)) if (segTrunk(c, from, to)) return 'tree';
    return null;
  }
  function cameraInside(p) {
    if (p.y < .15) return 'ground';
    for (const b of boxes) if (insideBox(b, p, .12)) return b.name;
    for (const c of near(p, trunks, 3)) if (Math.hypot(c.x - p.x, c.z - p.z) < c.r + .15 && p.y < c.y + c.h) return 'tree';
    return null;
  }
  function points(a) {
    const r = a.rig, out = [];
    for (const k of ['head', 'chest', 'hips', 'hand_right', 'foot_left', 'foot_right']) if (r[k]) out.push(r[k].getWorldPosition(new THREE.Vector3()));
    out[0]?.add(new THREE.Vector3(0, .35, 0));   // middle of the big head, not the neck pivot
    return out;
  }
  /** Who this shot is about: shot.who, else every visible actor in front of the camera. */
  function subjects(shot) {
    return Object.values(film.actors).filter(a => a.root.visible && (shot.who ? shot.who.includes(a.key) : (() => {
      a.rig.hips.getWorldPosition(_v); _ndc.copy(_v).project(cam);
      return Math.abs(_ndc.x) < 1 && Math.abs(_ndc.y) < 1 && _ndc.z < 1 && _v.distanceTo(cam.position) < 25;
    })()));
  }
  /** Problems of one frame (pose and camera must already be set). */
  function frame(t, shot) {
    const issues = [];
    const inside = cameraInside(cam.position);
    if (inside) issues.push({ type: 'camera_inside', what: inside, severity: 'high' });
    if (shot.wide) return issues;
    // nobody may fill the lens: a body closer than 1.3 m to the camera
    for (const a of Object.values(film.actors)) {
      if (!a.root.visible) continue;
      a.rig.hips.getWorldPosition(_a); a.rig.head.getWorldPosition(_b);
      const d = Math.min(_a.distanceTo(cam.position), _b.distanceTo(cam.position), _a.lerp(_b, .5).distanceTo(cam.position));
      if (d < 1.3) issues.push({ type: 'too_close', who: a.key, severity: d < .9 ? 'high' : 'medium' });
    }
    for (const a of subjects(shot)) {
      const pts = points(a);
      let hidden = 0, out = 0;
      const by = new Set();
      for (const p of pts) {
        const b = blocked(cam.position, p, a); if (b) { hidden++; by.add(b); }
        _ndc.copy(p).project(cam); if (Math.abs(_ndc.x) > 1.02 || Math.abs(_ndc.y) > 1.02) out++;
      }
      // head out of the picture or more than half the body hidden
      _ndc.copy(pts[0]).project(cam);
      const headOut = Math.abs(_ndc.x) > 1 || Math.abs(_ndc.y) > 1;
      if (hidden / pts.length > .5) issues.push({ type: 'hidden', who: a.key, by: [...by].join(', '), severity: hidden === pts.length ? 'high' : 'medium' });
      if (headOut && !shot.close) issues.push({ type: 'head_cut', who: a.key, severity: 'medium' });
      if (out / pts.length > .5 && !shot.close) issues.push({ type: 'out_of_frame', who: a.key, severity: 'medium' });
    }
    return issues;
  }
  function at(t) {
    for (const a of Object.values(film.actors)) film.pose(a, t);
    for (const a of Object.values(film.actors)) a.root.updateMatrixWorld(true);
    const shot = frameCamera(cam, t, { at: film.at, events: film.header.events });
    cam.updateMatrixWorld(true);
    return shot;
  }
  function shotCost(shot, step = .5) {
    let cost = 0, n = 0;
    for (let t = shot.t0 + .1; t < shot.t1; t += step) {
      at(t);
      for (const i of frame(t, shot)) cost += i.severity === 'high' ? 3 : 1;
      n++;
    }
    return cost / Math.max(1, n);
  }
  /** For every failing shot try small camera changes and keep the cheapest that passes. */
  function solveCameras(log = []) {
    for (const shot of SHOTS) {
      shot.fix = null;
      const base = shotCost(shot);
      if (base < .05) continue;
      let best = { cost: base, fix: null };
      for (const yaw of [0, 15, -15, 30, -30, 45, -45, 60, -60, 90, -90]) for (const dh of [0, .5, 1, 1.6]) for (const k of [1, .85, 1.2, .7]) {
        if (!yaw && !dh && k === 1) continue;
        shot.fix = { yaw: THREE.MathUtils.degToRad(yaw), dh, k };
        const c = shotCost(shot, .75) + Math.abs(yaw) / 400 + dh / 20 + Math.abs(1 - k) / 10;
        if (c < best.cost) best = { cost: c, fix: { ...shot.fix } };
        if (best.cost < .02) break;
      }
      shot.fix = best.fix;
      log.push({ shot: SHOTS.indexOf(shot) + 1, t0: shot.t0, before: +base.toFixed(2), after: +best.cost.toFixed(2), fix: best.fix && { yaw: Math.round(THREE.MathUtils.radToDeg(best.fix.yaw)), dh: best.fix.dh, k: best.fix.k } });
    }
    return log;
  }
  /** Every problem of the whole film, grouped into time spans. */
  function validate(step = .25) {
    const found = [];
    for (let t = 0; t < film.header.duration; t += step) {
      const shot = at(t);
      for (const i of frame(t, shot)) {
        const last = found.findLast?.(f => f.type === i.type && f.who === i.who && f.what === i.what && f.by === i.by && t - f.t_end <= step * 1.5);
        if (last) last.t_end = +t.toFixed(2);
        else found.push({ ...i, shot: SHOTS.indexOf(shot) + 1, t: +t.toFixed(2), t_end: +t.toFixed(2) });
      }
    }
    return found;
  }
  return { validate, solveCameras, frame, at };
}

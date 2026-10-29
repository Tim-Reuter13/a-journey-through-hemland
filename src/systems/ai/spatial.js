import * as THREE from 'three';

// Spatial tactics: places worth going to, scored instead of simply walking at the target. Every query
// samples a handful of candidates and checks them against the collision world (blocked ground, lines
// of sight), so it costs a few dozen tests and runs only when a plan needs it (brains cache results).

const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
const TAU = Math.PI * 2;
const angleDiff = (x, y) => Math.abs(THREE.MathUtils.euclideanModulo(x - y + Math.PI, TAU) - Math.PI);

/** Can a person walk from `from` toward `to` (in 1.5 m steps, first `len` metres)? */
export function walkable(world, from, to, len = Infinity) {
  const d = Math.hypot(to.x - from.x, to.z - from.z), n = Math.max(1, Math.ceil(Math.min(d, len) / 1.5));
  for (let i = 1; i <= n; i++) {
    const t = Math.min(d, i * 1.5) / d, x = from.x + (to.x - from.x) * t, z = from.z + (to.z - from.z) * t;
    if (world.blocked(x, z, .4)) return false;
  }
  return true;
}

/** Is the line from→to free of allies (anyone closer than `radius` to it)? */
export function lineClear(from, to, others, radius = .7) {
  a.subVectors(to, from); const len2 = a.lengthSq();
  for (const o of others) {
    b.subVectors(o, from); const t = THREE.MathUtils.clamp(b.dot(a) / len2, 0, 1);
    if (t > .04 && t < .96 && c.copy(from).addScaledVector(a, t).setY(o.y).distanceTo(o) < radius) return false;
  }
  return true;
}

/** A spot beside or behind the target, away from where allies already stand and reachable. */
export function flankPoint(world, self, target, targetYaw, allies, radius = 3.4) {
  const taken = allies.map(p => Math.atan2(p.x - target.x, p.z - target.z));
  // The way the target faces (front −Z): behind is facing + π.
  const front = Math.atan2(-Math.sin(targetYaw), -Math.cos(targetYaw));
  let best = null, score = -Infinity;
  for (let k = 0; k < 12; k++) {
    const ang = k / 12 * TAU, p = new THREE.Vector3(target.x + Math.sin(ang) * radius, 0, target.z + Math.cos(ang) * radius);
    if (world.blocked(p.x, p.z, .4)) continue;
    const behind = angleDiff(ang, front) / Math.PI;               // 0 in front, 1 behind
    const spread = taken.length ? Math.min(...taken.map(t => angleDiff(ang, t))) / Math.PI : 1;
    const s = behind * .9 + spread * .8 - self.distanceTo(p) * .03;
    if (s > score) { score = s; best = p; }
  }
  if (best) best.y = world.heightAt(best.x, best.z);
  return best;
}

/** Somewhere to run to, away from the threat; null when every way out is blocked (cornered). */
export function escapePoint(world, self, threat, distance = 20) {
  const away = Math.atan2(self.x - threat.x, self.z - threat.z);
  let best = null, score = -Infinity;
  for (const off of [0, .5, -.5, 1, -1, 1.5, -1.5]) {
    const ang = away + off, p = new THREE.Vector3(self.x + Math.sin(ang) * distance, 0, self.z + Math.cos(ang) * distance);
    if (!walkable(world, self, p, 9)) continue;
    const s = p.distanceTo(threat) - Math.abs(off) * 3;
    if (s > score) { score = s; best = p; }
  }
  if (best) best.y = world.heightAt(best.x, best.z);
  return best;
}

/** Behind something solid, out of the threat's line of sight, as near as possible. */
export function coverPoint(world, self, threat, colliders) {
  let best = null, score = Infinity;
  for (const o of colliders) {
    if (o.top - o.bottom < 1.1 || o.disabled) continue;
    const r = o.radius ?? Math.hypot(o.halfWidth, o.halfDepth);
    if (r > 6) continue;
    const dir = a.set(o.x - threat.x, 0, o.z - threat.z).normalize();
    const p = new THREE.Vector3(o.x + dir.x * (r + .8), 0, o.z + dir.z * (r + .8));
    if (world.blocked(p.x, p.z, .4)) continue;
    p.y = world.heightAt(p.x, p.z);
    const d = self.distanceTo(p);
    if (d > 16 || d >= score) continue;
    b.copy(threat).setY(threat.y + 1.6); c.copy(p).setY(p.y + 1.2);
    if (!world.segmentBlocked(b, c, .05)) continue;
    score = d; best = p;
  }
  return best;
}

/** A place to shoot from: about `range` from the target, a clear line to it, no ally in the way. */
export function archerSpot(world, self, target, allies, range = 14) {
  const here = Math.atan2(self.x - target.x, self.z - target.z);
  let best = null, score = -Infinity;
  for (const off of [0, .35, -.35, .7, -.7, 1.1, -1.1]) {
    for (const r of [range, range * .75, range * 1.25]) {
      const ang = here + off, p = new THREE.Vector3(target.x + Math.sin(ang) * r, 0, target.z + Math.cos(ang) * r);
      if (world.blocked(p.x, p.z, .4)) continue;
      p.y = world.heightAt(p.x, p.z);
      b.copy(p).setY(p.y + 1.6); c.copy(target).setY(target.y + 1.4);
      if (world.segmentBlocked(b, c, .03) || !lineClear(b, c, allies)) continue;
      const s = -self.distanceTo(p) * .15 - Math.abs(off) * .6 - Math.abs(r - range) * .05;
      if (s > score) { score = s; best = p; }
    }
  }
  return best;
}

/** A point on a ring round `centre` at `radius`, `orbit` turning it sideways (pressure, circling). */
export function ringPoint(world, self, centre, radius, orbit) {
  const ang = Math.atan2(self.x - centre.x, self.z - centre.z) + orbit * .55;
  const p = new THREE.Vector3(centre.x + Math.sin(ang) * radius, 0, centre.z + Math.cos(ang) * radius);
  p.y = world.heightAt(p.x, p.z);
  return p;
}

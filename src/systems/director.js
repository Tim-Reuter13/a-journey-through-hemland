// In-engine film director for cutscenes. A script is a list of shots; each shot has a camera
// move (Catmull-Rom path of positions and look targets, eased, with optional handheld shake)
// and timed events that drive actors (walk/run along paths, face, attack, die), effects, sound,
// subtitles, fades and title cards. The director only computes; the host applies the results
// through the callbacks, so this module stays testable without WebGL.
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const EASE = {
  linear: t => t,
  inOut: t => t * t * (3 - 2 * t),
  out: t => 1 - (1 - t) ** 3,
  in: t => t ** 3,
};

/** Catmull-Rom through points [[x,y,z], ...] at u ∈ [0, 1] (centripetal-free, uniform). */
export function spline(points, u) {
  if (points.length === 1) return [...points[0]];
  const n = points.length - 1, f = clamp(u) * n, i = Math.min(n - 1, Math.floor(f)), t = f - i;
  const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(n, i + 2)];
  return p1.map((_, k) => .5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t));
}
/** Point on a ground path [[x,z], ...] by arc length, with the heading (model convention: front is -z). */
export function along(points, u) {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  let d = clamp(u) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (d <= lengths[i] || i === lengths.length - 1) {
      const k = lengths[i] ? clamp(d / lengths[i]) : 1, a = points[i], b = points[i + 1];
      return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, yaw: Math.atan2(a[0] - b[0], a[1] - b[1]) };
    }
    d -= lengths[i];
  }
  return { x: points[0][0], z: points[0][1], yaw: 0 };
}

export function createDirector(script, host = {}) {
  const shots = script.shots, total = shots.reduce((sum, s) => sum + s.duration, 0);
  const fired = new Set(), moves = new Map();
  let time = 0, done = false;

  function shotAt(t) {
    let start = 0;
    for (const [index, shot] of shots.entries()) {
      if (t < start + shot.duration || index === shots.length - 1) return { index, shot, local: t - start, start };
      start += shot.duration;
    }
  }
  function fire(event, absolute) {
    switch (event.do) {
      // Movement keeps running across shots until it finishes.
      case 'walk': case 'run': moves.set(event.actor, { ...event, from: absolute, duration: event.duration ?? 3 }); break;
      case 'place': moves.delete(event.actor); host.place?.(event.actor, { x: event.pos[0], z: event.pos[1], yaw: event.yaw ?? 0 }); break;
      default: host.event?.(event);
    }
  }
  function update(dt) {
    if (done) return null;
    time += dt;
    if (time >= total) { done = true; host.end?.(); return null; }
    const { index, shot, local, start } = shotAt(time);
    // Fire every event whose time has come (also those skipped by a long frame).
    for (const [i, s] of shots.entries()) {
      if (i > index) break;
      const offset = shots.slice(0, i).reduce((sum, x) => sum + x.duration, 0);
      for (const [j, event] of (s.events || []).entries()) {
        const key = `${i}:${j}`;
        if (!fired.has(key) && offset + (event.at ?? 0) <= time) { fired.add(key); fire(event, offset + (event.at ?? 0)); }
      }
    }
    for (const [actor, m] of moves) {
      const u = clamp((time - m.from) / m.duration), p = along(m.path, EASE[m.ease || 'linear'](u));
      host.place?.(actor, { ...p, yaw: m.face ?? p.yaw, gait: m.do, moving: u < 1 });
      if (u >= 1) moves.delete(actor);
    }
    const cam = shot.camera, k = (EASE[cam.ease || 'inOut'])(clamp(local / shot.duration));
    const position = spline(cam.from ? [cam.from, ...(cam.via || []), cam.to] : cam.path, k);
    const target = spline(cam.lookFrom ? [cam.lookFrom, ...(cam.lookVia || []), cam.lookTo] : cam.look, k);
    // Handheld: two incommensurate sines per axis, a few centimetres, never a jitter.
    if (cam.shake) for (let a = 0; a < 3; a++) position[a] += Math.sin(time * (1.3 + a * .7)) * cam.shake * .05 + Math.sin(time * (3.1 + a)) * cam.shake * .02;
    return { shot: index, local, fov: cam.fov, position, target, roll: cam.roll ?? 0, startOfShot: local === time - start };
  }
  return { update, total, get time() { return time; }, get done() { return done; }, skip() { done = true; host.end?.(); } };
}

import * as THREE from 'three';
import { FIRE } from './stage.js';

// The cut. Each shot maps its own progress u (0..1) to a camera; actor positions come from the baked
// motion (ctx.at(actor, t) = hips in world space), so tracking shots follow the performance exactly and
// every frame is a pure function of the film clock.
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = u => u * u * (3 - 2 * u);
const easeOut = u => 1 - (1 - u) ** 3;
const mix = (a, b, u) => a.clone().lerp(b, u);
const up = (p, y) => p.clone().setY(p.y + y);

export const SHOTS = [
  // 1 · Over the treetops, the low sun beyond the forest's gap; the crane sinks to the stone circle.
  { t0: 0, t1: 11, wide: true, cam: (u) => { const k = easeOut(u), p = mix(v(14, 0, -10.5), v(7.8, 0, -4.6), k); p.y = 24 - 20.3 * ease(u) ** 1.5; return { pos: p, look: mix(v(-12, 3.5, 3), v(0, .8, -.2), ease(u)), fov: 46 }; } },
  // 2 · Through the flames: the masked man at his fire.
  { t0: 11, t1: 17, who: ['bandit'], cam: (u, c) => ({ pos: mix(v(1.05, .95, 3.2), v(1.4, .9, 2.8), ease(u)), look: up(c.at('bandit', c.t), .35), fov: 32 }) },
  // 3 · The captain on the path, the sun behind him; the camera backs away ahead of him.
  { t0: 17, t1: 26, who: ['captain'], cam: (u, c) => { const p = c.at('captain', c.t); return { pos: v(p.x + 7.2 - u * .8, .6, p.z - 1.4), look: up(p, .45), fov: 28 }; } },
  // 4 · The bandit lifts his head.
  { t0: 26, t1: 30, who: ['bandit'], close: true, cam: (u, c) => ({ pos: mix(v(3.75, 1.2, 2.75), v(3.65, 1.25, 2.5), u), look: up(c.at('bandit', c.t), .55), fov: 28 }) },
  // 5 · Over the captain's shoulder, across the altar: the man at the fire gets up.
  { t0: 30, t1: 36, cam: (u, c) => { const p = c.at('captain', c.t); return { pos: v(p.x - 1.0, 2.55, p.z - .55), look: mix(up(c.at('bandit', c.t), .6), v(2.6, 1.2, .6), .3), fov: 30 }; } },
  // 6 · Low, beside the captain as he draws, the sun behind the blade.
  { t0: 36, t1: 41, who: ['captain'], cam: (u, c) => { const p = c.at('captain', c.t); return { pos: v(p.x + 3.2 - u * .25, .7 + u * .12, p.z - 2.4), look: up(p, .9), fov: 30 }; } },
  // 7 · The circling: a slow arc above the altar.
  { t0: 41, t1: 47, cam: (u, c) => { const m = c.at('captain', c.t).lerp(c.at('bandit', c.t), .5), a = THREE.MathUtils.degToRad(62 + u * 52); return { pos: v(m.x + Math.cos(a) * 3.7, 2.45, m.z + Math.sin(a) * 3.7), look: up(m, .7), fov: 50 }; } },
  // 8 · First exchange, from over the altar's edge.
  { t0: 47, t1: 51, cam: (u, c) => { const m = c.at('captain', c.t).lerp(c.at('bandit', c.t), .5); return { pos: v(m.x + .3 - u * .4, 1.78, m.z + 3.1), look: up(m, .95), fov: 42 }; } },
  // 9 · Behind the bandit as the captain cuts, the sun behind the captain.
  { t0: 51, t1: 55, who: ['captain', 'bandit'], cam: (u, c) => { const m = c.at('captain', c.t).lerp(c.at('bandit', c.t), .5); return { pos: v(m.x + 1.2 - u * .4, 1.75, m.z + 3.7), look: up(m, .85), fov: 40 }; } },
  // 10 · Thrust and parry, low between two stones (slow motion inside).
  { t0: 55, t1: 61, cam: (u, c) => { const m = c.at('captain', c.t).lerp(c.at('bandit', c.t), .5); return { pos: v(m.x - .6 + u * .3, 1.6, m.z + 3.4), look: up(m, .95), fov: 38 }; } },
  // 11 · The captain takes the cut.
  { t0: 61, t1: 66, who: ['captain', 'bandit'], cam: (u, c) => { const m = c.at('captain', c.t).lerp(c.at('bandit', c.t), .5); return { pos: v(m.x - 1.6, 1.7, m.z + 3.6), look: up(m, .85), fov: 38 }; } },
  // 12 · The answer: low, side on, against the sun – slow motion.
  { t0: 66, t1: 71, cam: (u, c) => { const m = c.at('captain', c.t).lerp(c.at('bandit', c.t), .5); return { pos: v(m.x + 1.2, 2.15, m.z + 3.8 - u * .3), look: up(m, .85), fov: 36 }; } },
  // 13 · He goes down.
  { t0: 71, t1: 79, who: ['bandit'], cam: (u, c) => { const b = c.at('bandit', c.t); return { pos: mix(v(4.3, 2.7, -1.2), v(3.9, 2.4, -1.5), easeOut(u)), look: up(b, .55 - u * .2), fov: 46 }; } },
  // 14 · From above: the stones, the fire burning low, one man standing.
  { t0: 79, t1: 86, wide: true, cam: (u) => ({ pos: mix(v(5.2, 8.6, 3.6), v(4.6, 8.0, 3.1), u), look: v(.6, .2, -1.6), fov: 38 }) },
  // 15 · He kneels by the dead: a slow half orbit, the sun breaking through behind him.
  { t0: 86, t1: 102.2, who: ['captain', 'bandit'], cam: (u, c) => { const p = c.at('captain', c.t), m = p.clone().lerp(c.at('bandit', c.t), .4); return { pos: mix(v(-3.9, 3.1, -4.7), v(-3.4, 2.6, -4.3), ease(u)), look: up(m, .1), fov: 38 }; } },
  // 16 · He walks out through the gap into the light; the camera stays.
  { t0: 102.2, t1: 112, who: ['captain'], cam: (u, c) => { const p = c.at('captain', c.t); return { pos: v(3.2, 1.5, -1.0), look: mix(up(p, .7), v(-14, 2.2, -1.5), u * .5), fov: 32 - u * 5 }; } },
  // 17 · The crane rises over the circle while the light goes.
  { t0: 112, t1: 120, wide: true, cam: (u) => ({ pos: mix(v(3.2, 1.7, -1.0), v(7.5, 11, 5.5), ease(u)), look: mix(v(-8, 1.6, -1.2), v(-2, 0, -1), ease(u)), fov: 32 + u * 12 }) },
];

export function shotAt(t) {
  for (let i = SHOTS.length - 1; i >= 0; i--) if (t >= SHOTS[i].t0) return SHOTS[i];
  return SHOTS[0];
}

const _pos = new THREE.Vector3();
/** Places the camera for film time t. */
export function frameCamera(camera, t, ctx) {
  const shot = shotAt(t), u = Math.min(1, Math.max(0, (t - shot.t0) / (shot.t1 - shot.t0)));
  const c = shot.cam(u, { ...ctx, t });
  if (shot.fix) applyFix(c, shot.fix);   // the camera solver's correction for this shot (check.js)
  // a breath of handheld drift, and a short kick on every impact
  let kick = 0;
  for (const e of ctx.events) if ((e.type === 'clash' || e.type === 'hit' || e.type === 'kill') && t >= e.t && t < e.t + .6) kick += Math.exp(-(t - e.t) * 9) * (e.type === 'clash' ? .045 : .06);
  _pos.set(Math.sin(t * .71) * .025 + Math.sin(t * 31) * kick, Math.sin(t * .53 + 1) * .02 + Math.sin(t * 27 + 2) * kick, Math.cos(t * .61) * .02);
  camera.position.copy(c.pos).add(_pos);
  camera.fov = c.fov; camera.updateProjectionMatrix();
  camera.lookAt(c.look);
  return shot;
}
export { FIRE };

const _o = new THREE.Vector3();
/** Orbit the camera round what it looks at (yaw), lift it (dh) and pull it in or out (k). */
export function applyFix(c, fix) {
  _o.subVectors(c.pos, c.look);
  _o.applyAxisAngle(new THREE.Vector3(0, 1, 0), fix.yaw || 0).multiplyScalar(fix.k || 1);
  c.pos = c.look.clone().add(_o); c.pos.y += fix.dh || 0;
  return c;
}

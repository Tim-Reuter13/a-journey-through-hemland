import * as THREE from 'three';
import { createFireSim, CELL, TREE } from '../world/fireSim.js';
import { setGround, getGround, setTree, recentre, flushBurnMap, resetBurnMap, burnUniforms, burnState } from '../world/burnMap.js';
import { canopiesNear } from '../world/trees.js';
import { biomeWeights, WATER_LEVEL } from '../world/hemland.js';
import { FLAME_RAMP } from './spellFx.js';
import { createHeightCache } from '../world/heightCache.js';

// HUMANITY WILDFIRE — fire that behaves like fire.
//  • fireSim.js decides who burns: grass and litter in 2 m cells, spreading faster downwind and uphill,
//    never over water, barely through snow; trees climb from the foot to the crown, throw brands that start
//    new fires downwind, smoulder and stay black. Fire needs no scripts: a fireball, an ember, a burning
//    man in dry grass are all the same thing — a cell that catches.
//  • The look is pixel blocks like the rest of the game: flames hug the ground and lean uphill and
//    downwind, trees burn along the trunk and through the crown, thick smoke climbs and drifts, embers
//    carry, big fires spin a fire whirl, lakes hiss steam, snow melts to bare earth, burnt ground chars.
//  • burnMap.js keeps what burnt, and the terrain, tree and grass shaders draw it, so nothing is replaced.
const FLAMES = 900, EMBERS = 240, SMOKE = 300, ASH = 140, STEAM = 80, NEAR = 52;
const ramp = FLAME_RAMP.map(([at, hex]) => [at, new THREE.Color(hex)]);
const _c = new THREE.Color(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _p = new THREE.Vector3();
function rampColor(k) {
  for (let i = 1; i < ramp.length; i++) if (k >= ramp[i][0]) return _c.copy(ramp[i][1]).lerp(ramp[i - 1][1], (k - ramp[i][0]) / (ramp[i - 1][0] - ramp[i][0]));
  return _c.copy(ramp.at(-1)[1]);
}
function pool(parent, count, material, name) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, count);
  mesh.name = name; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < count; i++) { mesh.setMatrixAt(i, hidden); mesh.setColorAt(i, _c.setRGB(0, 0, 0)); }
  parent.add(mesh);
  const items = Array.from({ length: count }, () => ({ life: 0, duration: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), size: 1, swirl: 0, spin: 0, brand: false, orbit: null }));
  let cursor = 0, live = 0;
  return { mesh, items, hidden, get live() { return live; }, set live(v) { live = v; },
    take() { for (let n = 0; n < count; n++) { const i = (cursor + n) % count; if (items[i].life <= 0) { cursor = (i + 1) % count; items[i].orbit = null; items[i].brand = false; return items[i]; } } return null; } };
}

export function createWildfire({ scene, world, sound = () => {} }) {
  const root = new THREE.Group(); root.name = 'Wildfire'; scene.add(root);
  const flames = pool(root, FLAMES, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 'Wildfire flames');
  const embers = pool(root, EMBERS, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 'Wildfire embers');
  // Lambert alone turns grey smoke sky-blue; a warm emissive floor keeps it sooty by day and still dark at night.
  const smoke = pool(root, SMOKE, new THREE.MeshLambertMaterial({ color: 0x1e1b19, emissive: 0x1a1512, emissiveIntensity: .8, transparent: true, opacity: .5, depthWrite: false }), 'Wildfire smoke');
  const ash = pool(root, ASH, new THREE.MeshLambertMaterial({ color: 0x2a2724 }), 'Wildfire ash');
  const steam = pool(root, STEAM, new THREE.MeshBasicMaterial({ color: 0xdfe6ea, transparent: true, opacity: .34, depthWrite: false }), 'Wildfire steam');
  // Terrain height costs ~13 µs a call; flames and fuel ask hundreds of times a frame, so they read a cache.
  const heights = createHeightCache((x, z) => world.terrainHeightAt(x, z), .5), groundY = (x, z) => heights.at(x, z);
  const wind = { x: .8, z: .25, speed: .6 };
  let time = 0, sinceLights = 9, burnWrite = 0, audioGain = null, audioCtx = null;

  // ── What the world offers to burn.
  function fuelAt(x, z) {
    const h = groundY(x, z);
    if (h < WATER_LEVEL + .1) return { kind: 'water', fuel: 0, wet: 1 };
    if (world.indoorAt?.(x, z)) return { kind: 'none', fuel: 0, wet: 0 };
    const ground = world.groundAt(x, z), slope = Math.hypot(groundY(x + 1.5, z) - groundY(x - 1.5, z), groundY(x, z + 1.5) - groundY(x, z - 1.5)) / 3;
    if (ground === 'snow') return { kind: 'snow', fuel: .5, wet: .3 };
    if (ground === 'sand' || ground === 'wetsand' || ground === 'path' || slope > 1.3) return { kind: 'none', fuel: 0, wet: 0 };
    const w = biomeWeights(x, z);
    let fuel = .32 + w.plains * .5 + w.forest * .4 + w.autumn * .55 + w.taiga * .25 - w.marsh * .3, wet = ground === 'mud' ? .8 : w.marsh * .5;
    // The shore stays damp.
    if (Math.min(groundY(x + 3, z), groundY(x - 3, z), groundY(x, z + 3), groundY(x, z - 3)) < WATER_LEVEL + .4) wet = Math.max(wet, .55);
    return { kind: w.forest > .5 || w.autumn > .5 || w.taiga > .5 ? 'litter' : 'grass', fuel: Math.max(.1, Math.min(1.4, fuel)), wet };
  }

  // ── Ground and tree state for the shaders.
  const afterglow = [];
  function onCell(c, what) {
    const f = c.state === 1 ? Math.min(1, c.t / 1.2) * (c.t > c.dur - 1.5 ? Math.max(0, (c.dur - c.t) / 1.5) : 1) : 0;
    const scorch = c.state === 1 ? Math.min(1, c.t / Math.max(1, c.dur * .45)) * (c.kind === 'snow' ? .35 : 1) : c.scorch;
    if (what === 'burn' && Math.abs(scorch - (c.written ?? -1)) < .08) return;
    c.written = scorch;
    const g = getGround(c.cx, c.cz), melt = c.kind === 'snow' ? (c.state === 1 ? Math.min(.9, c.t / c.dur) : .9) : 0;
    setGround(c.cx, c.cz, scorch, c.state === 1 ? .35 + .65 * f : 0, melt, g?.age || 0);
    if (what === 'out') afterglow.push({ c, t: 0 });
    if (what === 'doused') onSteam(c.x, c.z, 2);
  }
  function onTree(t, what) {
    const r = Math.ceil((t.radius + .5) / CELL);
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const cx = Math.floor(t.x / CELL) + dx, cz = Math.floor(t.z / CELL) + dz;
      if (Math.hypot((cx + .5) * CELL - t.x, (cz + .5) * CELL - t.z) > t.radius + .9) continue;
      setTree(cx, cz, t);
      const g = getGround(cx, cz);
      setGround(cx, cz, Math.max(g?.scorch || 0, t.state >= 1 ? .6 : 0), g?.glow || 0, g?.melt || 0, t.age);
    }
    if (what === 'ignite') sound('fireImpact');
  }
  function onBrand(t) {
    // A burning tree throws a glowing brand downwind; where it lands it can start a new fire.
    const b = embers.take(); if (!b) return;
    const wl = Math.hypot(wind.x, wind.z) || 1, k = 3 + Math.random() * 7 * (.4 + wind.speed);
    b.p.set(t.x + (Math.random() - .5) * t.radius, t.base + t.height * (.5 + Math.random() * .5), t.z + (Math.random() - .5) * t.radius);
    b.v.set(wind.x / wl * k + (Math.random() - .5) * 2, 2 + Math.random() * 4, wind.z / wl * k + (Math.random() - .5) * 2);
    b.duration = b.life = 3.5; b.size = .1; b.swirl = Math.random() * 6; b.brand = true;
  }
  function onSteam(x, z, n = 1) {
    for (let i = 0; i < n * 2; i++) {
      const b = steam.take(); if (!b) return;
      b.p.set(x + (Math.random() - .5) * 1.4, Math.max(groundY(x, z), WATER_LEVEL) + .15, z + (Math.random() - .5) * 1.4);
      b.v.set((Math.random() - .5) * .3 + wind.x * .3, .5 + Math.random() * .7, (Math.random() - .5) * .3 + wind.z * .3);
      b.duration = b.life = 1.4 + Math.random() * 1.2; b.size = .25 + Math.random() * .3; b.swirl = Math.random() * 6;
    }
  }
  const sim = createFireSim({ fuelAt, canopiesNear, heightAt: (x, z) => groundY(x, z), wind, onCell, onTree, onBrand, onSteam });

  // ── Emission.
  const slope = new THREE.Vector3();
  function emitFlame(x, y, z, size, rise, lean, life = .45) {
    const b = flames.take(); if (!b) return;
    b.p.set(x, y, z); b.duration = b.life = life * (.7 + Math.random() * .6);
    b.v.set((Math.random() - .5) * .35 + wind.x * .22 * wind.speed + lean.x, rise * (.8 + Math.random() * .5), (Math.random() - .5) * .35 + wind.z * .22 * wind.speed + lean.z);
    b.size = size * (.7 + Math.random() * .6); b.swirl = Math.random() * 6.3; b.spin = (Math.random() - .5) * 4;
  }
  function emitSmoke(x, y, z, size, rise, life = 3.5) {
    const b = smoke.take(); if (!b) return;
    b.p.set(x, y, z); b.duration = b.life = life * (.8 + Math.random() * .5);
    b.v.set(wind.x * .8 * wind.speed + (Math.random() - .5) * .3, rise, wind.z * .8 * wind.speed + (Math.random() - .5) * .3);
    b.size = size; b.swirl = Math.random() * 6.3; b.spin = (Math.random() - .5);
  }
  function emitEmber(x, y, z, up = 1.5) {
    const b = embers.take(); if (!b) return;
    b.p.set(x, y, z); b.duration = b.life = .9 + Math.random() * 1.6;
    b.v.set((Math.random() - .5) * .8 + wind.x * 1.3, up * (.6 + Math.random()), (Math.random() - .5) * .8 + wind.z * 1.3);
    b.size = .04 + Math.random() * .03; b.swirl = Math.random() * 6; b.brand = false;
  }
  function emitAsh(x, y, z) {
    const b = ash.take(); if (!b) return;
    b.p.set(x, y, z); b.duration = b.life = 4 + Math.random() * 3;
    b.v.set(wind.x * .9 + (Math.random() - .5), -.15 - Math.random() * .2, wind.z * .9 + (Math.random() - .5));
    b.size = .035 + Math.random() * .025; b.swirl = Math.random() * 6;
  }
  const accumulators = new WeakMap();
  const acc = (obj, name, rate, dt) => { const a = accumulators.get(obj) || {}; a[name] = (a[name] ?? Math.random()) + rate * dt; const n = Math.floor(a[name]); a[name] -= n; accumulators.set(obj, a); return n; };

  // A fire whirl, for blazes big enough to make their own wind.
  let whirl = null;
  function updateWhirl(dt, camera) {
    const big = sim.active.length > 55 || [...sim.trees.values()].filter(t => t.state === 1).length > 3;
    if (!whirl && big && Math.random() < dt * .04) {
      const c = sim.active[Math.floor(Math.random() * sim.active.length)];
      if (c && Math.hypot(c.x - camera.position.x, c.z - camera.position.z) < 110) whirl = { x: c.x, z: c.z, life: 9 + Math.random() * 9, angle: 0 };
    }
    if (!whirl) return;
    whirl.life -= dt; whirl.angle += dt * 5.5;
    whirl.x += wind.x * .9 * dt; whirl.z += wind.z * .9 * dt;
    if (whirl.life <= 0 || Math.hypot(whirl.x - camera.position.x, whirl.z - camera.position.z) > 120) { whirl = null; return; }
    const y0 = groundY(whirl.x, whirl.z), grow = Math.min(1, whirl.life / 2, (18 - Math.min(18, whirl.life)) / 3 + .4);
    for (let n = acc(whirl, 'f', 60 * grow, dt); n > 0; n--) {
      const b = flames.take(); if (!b) break;
      const h = Math.random() * 7 * grow, r = .35 + h * .22;
      b.orbit = { x: whirl.x, z: whirl.z, a: Math.random() * 6.28, r, w: 7 - h * .4 };
      b.p.set(whirl.x + Math.cos(b.orbit.a) * r, y0 + h * .3, whirl.z + Math.sin(b.orbit.a) * r);
      b.duration = b.life = .8 + Math.random() * .6; b.v.set(0, 3.2 + Math.random() * 2, 0); b.size = .22 + Math.random() * .25; b.swirl = 0; b.spin = 0;
    }
    for (let n = acc(whirl, 'e', 20 * grow, dt); n > 0; n--) emitEmber(whirl.x + (Math.random() - .5), y0 + 1 + Math.random() * 4, whirl.z + (Math.random() - .5), 4);
  }

  function emitFire(dt, camera) {
    const cam = camera.position, occ = flames.live / FLAMES, scale = Math.max(.15, 1 - occ * 1.1);
    for (const c of sim.active) {
      const d2 = (c.x - cam.x) ** 2 + (c.z - cam.z) ** 2, near = d2 < NEAR * NEAR;
      const f = Math.min(1, c.t / 1.2) * (c.t > c.dur - 1.5 ? Math.max(0, (c.dur - c.t) / 1.5) : 1);
      if (!near) {
        // Far fires are only seen as plumes.
        for (let n = acc(c, 's', (c.kind === 'snow' ? 0 : .35) * f, dt); n > 0; n--) emitSmoke(c.x + (Math.random() - .5) * 2, groundY(c.x, c.z) + 1, c.z + (Math.random() - .5) * 2, 1.4 + Math.random(), 1.4, 6);
        continue;
      }
      const tall = c.kind === 'litter' ? 1.2 : c.kind === 'snow' ? .35 : 1;
      // Flames lean uphill (heat rises along the slope), like the fire does. Read once per cell.
      const lean = c.lean ??= { x: (groundY(c.x - 1, c.z) - groundY(c.x + 1, c.z)) * -.45, z: (groundY(c.x, c.z - 1) - groundY(c.x, c.z + 1)) * -.45 };
      for (let n = acc(c, 'f', 18 * f * scale * (c.kind === 'snow' ? .5 : 1), dt); n > 0; n--) {
        const x = c.x + (Math.random() - .5) * CELL, z = c.z + (Math.random() - .5) * CELL;
        emitFlame(x, groundY(x, z) + .04, z, .2 + .08 * tall, (1 + Math.random() * .9) * tall * (.5 + f * .5), lean, .55);
      }
      for (let n = acc(c, 's', (c.kind === 'snow' ? 0 : .55) * f, dt); n > 0; n--) emitSmoke(c.x + (Math.random() - .5) * 1.6, groundY(c.x, c.z) + .9 * tall, c.z + (Math.random() - .5) * 1.6, .38 + Math.random() * .3, .9, 3.2);
      for (let n = acc(c, 'e', .5 * f, dt); n > 0; n--) emitEmber(c.x + (Math.random() - .5) * CELL, groundY(c.x, c.z) + .5, c.z + (Math.random() - .5) * CELL, 1.6);
      if (c.kind === 'snow') for (let n = acc(c, 'w', 1.4 * f, dt); n > 0; n--) onSteam(c.x, c.z, 1);
    }
    for (const t of sim.trees.values()) {
      if (t.state === 0) continue;
      if (t.state === 3) {
        // A burnt tree gives off a last thin smoke for half a minute, then stands cold.
        t.cool = (t.cool || 0) + dt;
        if (t.cool < 30 && Math.random() < dt * .6 && (t.x - cam.x) ** 2 + (t.z - cam.z) ** 2 < 45 * 45) emitSmoke(t.x, t.base + t.height * .6, t.z, .6, .7, 3);
        continue;
      }
      const d2 = (t.x - cam.x) ** 2 + (t.z - cam.z) ** 2, near = d2 < NEAR * NEAR;
      // How far the fire has spread from each ignition point (as a share of the tree's height), and how lively it is:
      // full while the front is still moving, then fading as the foliage is consumed; a smouldering tree only glows.
      const w1 = Math.max(0, t.progress * 1.45 - .3), w2 = t.progress > t.d2 ? Math.max(0, (t.progress - t.d2) * 1.6 - .3) : 0;
      const activity = t.state === 1 ? (t.progress < 1 ? 1 : Math.max(.15, 1 - t.age * .9)) : .12 * (1 - t.age);
      const top = Math.min(1, Math.max(t.o1 + w1, w2 ? t.o2 + w2 : 0));
      // The plume: a column of dark smoke over the burning part of the crown, seen from afar.
      for (let n = acc(t, 's', (near ? 3 : 1.2) * activity, dt); n > 0; n--) emitSmoke(t.x + (Math.random() - .5) * t.radius, t.base + top * t.height + .4, t.z + (Math.random() - .5) * t.radius, .35 + Math.random() * .45, 1.8 + Math.random(), 6.5);
      if (!near) continue;
      for (let n = acc(t, 'f', (9 + t.height * 2.2) * Math.min(1.8, t.radius / 2.2) * activity * scale, dt); n > 0; n--) {
        // Flames sit along the moving front of an ignition point (above and below it), not over the whole tree.
        const second = w2 > 0 && Math.random() < .45, o = second ? t.o2 : t.o1, w = second ? w2 : w1;
        const yf = Math.min(1, Math.max(0, o + (Math.random() < .5 ? -1 : 1) * w * (.5 + Math.random() * .5))), y = yf * t.height;
        const crown = yf > .38, r = crown ? t.radius * Math.sqrt(Math.random()) * (1 - ((yf - .38) / .62) ** 2 * .55) : .22;
        const a = Math.random() * 6.28;
        emitFlame(t.x + Math.cos(a) * r, t.base + y, t.z + Math.sin(a) * r, crown ? .2 : .14, (1.1 + Math.random() * 1.3) * (crown ? 1.25 : 1), { x: 0, z: 0 }, crown ? .55 : .4);
      }
      for (let n = acc(t, 'e', 5 * activity, dt); n > 0; n--) emitEmber(t.x + (Math.random() - .5) * t.radius * 1.6, t.base + Math.random() * top * t.height, t.z + (Math.random() - .5) * t.radius * 1.6, 3);
      for (let n = acc(t, 'a', 3 * activity * (t.age + .3), dt); n > 0; n--) emitAsh(t.x + (Math.random() - .5) * t.radius * 2, t.base + t.height * (.4 + Math.random() * .6), t.z + (Math.random() - .5) * t.radius * 2);
    }
    // Afterglow: burnt ground keeps a few red embers for a while, then goes cold.
    for (let i = afterglow.length - 1; i >= 0; i--) {
      const a = afterglow[i]; a.t += dt;
      const k = 1 - a.t / 14;
      if (Math.floor(a.t * 2) !== Math.floor((a.t - dt) * 2)) { const g = getGround(a.c.cx, a.c.cz); if (g) setGround(a.c.cx, a.c.cz, g.scorch, Math.max(0, k) * .8, g.melt, g.age); }
      if (a.t > 14) { afterglow.splice(i, 1); continue; }
      if (k > .3 && (a.c.x - cam.x) ** 2 + (a.c.z - cam.z) ** 2 < 30 * 30 && Math.random() < dt * 1.2) emitEmber(a.c.x + (Math.random() - .5) * CELL, groundY(a.c.x, a.c.z) + .05, a.c.z + (Math.random() - .5) * CELL, .6);
    }
  }

  // ── Particles.
  function updatePool(P, dt, fn) {
    let live = 0, dirty = false;
    P.items.forEach((b, i) => {
      if (b.life <= 0) return;
      b.life -= dt; dirty = true;
      if (b.life <= 0) { P.mesh.setMatrixAt(i, P.hidden); return; }
      live++; fn(b, i, b.life / b.duration);
    });
    P.live = live;
    if (dirty) { P.mesh.instanceMatrix.needsUpdate = true; if (P.mesh.instanceColor) P.mesh.instanceColor.needsUpdate = true; }
  }
  function updateParticles(dt) {
    const gust = [wind.x * wind.speed, wind.z * wind.speed];
    updatePool(flames, dt, (b, i, k) => {
      if (b.orbit) { b.orbit.a += b.orbit.w * dt; b.orbit.r *= 1 + dt * .35; b.p.x = b.orbit.x + Math.cos(b.orbit.a) * b.orbit.r; b.p.z = b.orbit.z + Math.sin(b.orbit.a) * b.orbit.r; b.p.y += b.v.y * dt; }
      else { b.swirl += dt * 9; b.v.y += dt * .9; b.v.x += Math.cos(b.swirl) * dt * .3 + gust[0] * dt * .25; b.v.z += Math.sin(b.swirl) * dt * .3 + gust[1] * dt * .25; b.p.addScaledVector(b.v, dt); }
      // Flames are upright tongues of blocks, thin and tall, burning down from yellow to deep red.
      const grow = k > .72 ? .6 + (1 - k) * 1.45 : Math.max(.18, k * 1.4), sz = b.size * grow;
      flames.mesh.setMatrixAt(i, _m.compose(b.p, _q.setFromEuler(_e.set(0, b.swirl * .5, 0)), _s.set(sz * .85, sz * (1.05 + (1 - k) * .55), sz * .85)));
      flames.mesh.setColorAt(i, rampColor(Math.pow(k, 1.8)).multiplyScalar(.58 * Math.min(1, k * 2.6)));
    });
    updatePool(embers, dt, (b, i, k) => {
      b.swirl += dt * 6; b.v.x += Math.cos(b.swirl) * dt * 1.1 + gust[0] * dt * .6; b.v.z += Math.sin(b.swirl) * dt * 1.1 + gust[1] * dt * .6; b.v.y -= dt * (b.brand ? 3.2 : .5);
      b.p.addScaledVector(b.v, dt);
      const ground = groundY(b.p.x, b.p.z);
      if (b.p.y < ground + .03) {
        b.life = 0; embers.mesh.setMatrixAt(i, embers.hidden);
        // A brand that lands on something dry starts a fire; on water it dies with a hiss.
        if (b.brand) { if (world.water?.at(b.p.x, b.p.z)) onSteam(b.p.x, b.p.z, 1); else sim.ignite(b.p.x, b.p.z, { power: .55, radius: 1 }); }
        return;
      }
      // A brand that comes down inside a crown sets the tree alight from above.
      if (b.brand && b.v.y < 0) {
        for (const canopy of canopiesNear(b.p.x, b.p.z, 1.2)) {
          if (Math.hypot(canopy.x - b.p.x, canopy.z - b.p.z) < canopy.radius * .85 && b.p.y > canopy.bottom && b.p.y < canopy.top) {
            b.life = 0; embers.mesh.setMatrixAt(i, embers.hidden);
            if (Math.random() < .5) sim.brandHit(canopy);
            return;
          }
        }
      }
      embers.mesh.setMatrixAt(i, _m.compose(b.p, _q.identity(), _s.setScalar(b.size * (b.brand ? 1.6 : 1))));
      embers.mesh.setColorAt(i, rampColor(.35 + k * .55).multiplyScalar(k > .15 ? 1 : k / .15));
    });
    updatePool(smoke, dt, (b, i, k) => {
      b.swirl += dt; b.v.x += (gust[0] * 1.4 - b.v.x) * dt * .4; b.v.z += (gust[1] * 1.4 - b.v.z) * dt * .4; b.v.y *= 1 - dt * .12;
      b.p.addScaledVector(b.v, dt);
      const grow = (1 + (1 - k) * 1.2) * Math.min(1, k * 3);
      smoke.mesh.setMatrixAt(i, _m.compose(b.p, _q.setFromEuler(_e.set(b.swirl * .3, b.spin * (1 - k) * 2, b.swirl * .2)), _s.setScalar(b.size * grow)));
      smoke.mesh.setColorAt(i, _c.setRGB(.12 + k * .14, .115 + k * .13, .11 + k * .12));
    });
    updatePool(ash, dt, (b, i, k) => {
      b.swirl += dt * 3; b.v.x += Math.cos(b.swirl) * dt * .6; b.v.z += Math.sin(b.swirl) * dt * .6; b.p.addScaledVector(b.v, dt);
      if (b.p.y < groundY(b.p.x, b.p.z)) { b.life = 0; ash.mesh.setMatrixAt(i, ash.hidden); return; }
      ash.mesh.setMatrixAt(i, _m.compose(b.p, _q.setFromEuler(_e.set(b.swirl, b.swirl * .7, 0)), _s.setScalar(b.size * Math.min(1, k * 4))));
      ash.mesh.setColorAt(i, _c.setRGB(.13 + .08 * Math.sin(i), .12 + .07 * Math.sin(i), .11 + .06 * Math.sin(i)));
    });
    updatePool(steam, dt, (b, i, k) => {
      b.swirl += dt * 2; b.v.x += Math.cos(b.swirl) * dt * .3; b.v.z += Math.sin(b.swirl) * dt * .3; b.p.addScaledVector(b.v, dt);
      steam.mesh.setMatrixAt(i, _m.compose(b.p, _q.identity(), _s.setScalar(b.size * (1 + (1 - k) * 2.2) * Math.min(1, k * 2.5))));
      steam.mesh.setColorAt(i, _c.setRGB(.86, .9, .92));
    });
  }

  // ── Light and sound: the three nearest blazes light their surroundings; a roar and crackling by how much burns nearby.
  const anchors = Array.from({ length: 3 }, () => { const o = new THREE.Object3D(); o.position.set(0, -2000, 0); root.add(o); world.lights?.follow(o, { color: 0xff7a2a, intensity: 3.4, distance: 15 }); return o; });
  function updateLights(camera) {
    const cam = camera.position, spots = [];
    for (const t of sim.trees.values()) if (t.state === 1) spots.push({ d: Math.hypot(t.x - cam.x, t.z - cam.z), x: t.x, y: t.base + t.height * .55, z: t.z });
    for (const c of sim.active) { const d = Math.hypot(c.x - cam.x, c.z - cam.z); if (d < 40) spots.push({ d: d + 6, x: c.x, y: groundY(c.x, c.z) + 1.2, z: c.z }); }
    spots.sort((a, b) => a.d - b.d);
    // Spread the lights: skip spots within 8 m of one already chosen.
    const chosen = [];
    for (const s of spots) { if (chosen.length >= 3) break; if (chosen.every(o => Math.hypot(o.x - s.x, o.z - s.z) > 8)) chosen.push(s); }
    anchors.forEach((a, i) => { const s = chosen[i]; if (s) a.position.set(s.x, s.y, s.z); else a.position.set(0, -2000, 0); });
  }
  function updateSound(dt, camera) {
    try {
      let near = 0;
      for (const c of sim.active) { const d = Math.hypot(c.x - camera.position.x, c.z - camera.position.z); if (d < 40) near += (1 - d / 40) * (1 - d / 40); }
      for (const t of sim.trees.values()) if (t.state === 1) { const d = Math.hypot(t.x - camera.position.x, t.z - camera.position.z); if (d < 55) near += 2.5 * (1 - d / 55) ** 2; }
      if (near < .02 && !audioGain) return;
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate), data = buffer.getChannelData(0);
        let last = 0; for (let i = 0; i < data.length; i++) { last = (last + (Math.random() * 2 - 1) * .08) * .985; data[i] = last * 4; }
        const src = audioCtx.createBufferSource(); src.buffer = buffer; src.loop = true;
        const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
        audioGain = audioCtx.createGain(); audioGain.gain.value = 0;
        src.connect(lp); lp.connect(audioGain); audioGain.connect(audioCtx.destination); src.start();
      }
      void audioCtx.resume();
      audioGain.gain.setTargetAtTime(Math.min(.16, near * .012), audioCtx.currentTime, .3);
      if (near > .05 && Math.random() < dt * Math.min(14, 3 + near * 2)) sound('crackle');
    } catch { /* audio is optional */ }
  }

  function update(dt, camera) {
    if (dt <= 0) return;
    time += dt; burnUniforms.uBurnTime.value = time;
    // The wind drifts slowly round and swells and drops.
    const a = .35 + Math.sin(time * .05) * .6 + Math.sin(time * .021) * .3;
    wind.x = Math.cos(a); wind.z = Math.sin(a) * .6; wind.speed = .55 + Math.sin(time * .11) * .25 + Math.sin(time * .37) * .1;
    recentre(camera.position.x, camera.position.z);
    sim.step(dt);
    emitFire(dt, camera);
    updateWhirl(dt, camera);
    updateParticles(dt);
    sinceLights += dt; if (sinceLights > .4) { sinceLights = 0; updateLights(camera); }
    burnWrite += dt; if (burnWrite > .18) { burnWrite = 0; flushBurnMap(); }
    updateSound(dt, camera);
  }
  function reset() {
    sim.reset(); resetBurnMap(); afterglow.length = 0; whirl = null;
    for (const P of [flames, embers, smoke, ash, steam]) { for (const b of P.items) b.life = 0; for (let i = 0; i < P.items.length; i++) P.mesh.setMatrixAt(i, P.hidden); P.mesh.instanceMatrix.needsUpdate = true; }
    anchors.forEach(a => a.position.set(0, -2000, 0));
  }
  return {
    update, reset, sim,
    /** Fire at a point (spells, brands, torches): power 0..1, radius in metres. */
    ignite: (point, opts) => sim.ignite(point.x, point.z, opts),
    extinguish: (x, z, r) => { const n = sim.extinguish(x, z, r); if (n) sound('slosh'); return n; },
    heatAt: (x, z) => sim.heatAt(x, z), steam: onSteam, treesNear: (x, z, r) => canopiesNear(x, z, r),
    state: () => ({ ...sim.state(), flames: flames.live, smoke: smoke.live, embers: embers.live, whirl: !!whirl, burnMap: burnState(), wind: { ...wind } }),
  };
}

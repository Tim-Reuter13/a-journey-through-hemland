import * as THREE from 'three';
import { FLAME_RAMP } from '../systems/spellFx.js';

// Every fire in the world burns like Funken (systems/spellFx.js): flames are glowing blocks that rise on
// their own heat, swirl, swell and burn down from white-yellow through orange to a dull red; sparks pop
// out and climb higher; outdoors grey blocks of smoke drift off with the wind. Camp and cook fires,
// hearths, braziers, wall torches, candles and the forge's coals all share one instanced pool of flame
// blocks, spent on the fires nearest the viewer; farther off the old flame sprite stands in, which costs
// almost nothing. The sizes come from the sprites themselves, so a candle burns small and a camp fire big.
const NEAR = 38, FLAMES = 720, SPARKS = 140, SMOKE = 150;
const ramp = FLAME_RAMP.map(([at, hex]) => [at, new THREE.Color(hex)]);
const _color = new THREE.Color();
function rampColor(k) {
  for (let i = 1; i < ramp.length; i++) if (k >= ramp[i][0]) return _color.copy(ramp[i][1]).lerp(ramp[i - 1][1], (k - ramp[i][0]) / (ramp[i - 1][0] - ramp[i][0]));
  return _color.copy(ramp.at(-1)[1]);
}

/** A pool of blocks drawn as one instanced mesh; dead ones are parked out of sight. */
function pool(scene, count, material, name) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, count);
  mesh.name = name; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < count; i++) { mesh.setMatrixAt(i, hidden); mesh.setColorAt(i, _color.setRGB(0, 0, 0)); }
  scene.add(mesh);
  const items = Array.from({ length: count }, () => ({ life: 0, duration: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), size: 1, swirl: 0, spin: 0 }));
  let cursor = 0;
  return {
    mesh, items, hidden,
    take() { for (let n = 0; n < count; n++) { const i = (cursor + n) % count; if (items[i].life <= 0) { cursor = (i + 1) % count; return items[i]; } } return null; },
  };
}

/**
 * sources: [{ sprite, outdoors }] — each sprite is an existing flame mesh (its bounding box gives the
 * fire's size) or a marker whose userData.fire = { width, height, kind } (kind 'coals': a forge bed that
 * burns low and wide). Near the viewer the sprite is hidden while the blocks burn in its place.
 */
export function createFires(scene, sources, { wind = [.5, .15] } = {}) {
  const root = new THREE.Group(); root.name = 'fires'; scene.add(root);
  const flames = pool(root, FLAMES, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 'Fire flames');
  const sparks = pool(root, SPARKS, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 'Fire sparks');
  const smoke = pool(root, SMOKE, new THREE.MeshLambertMaterial({ color: 0x5a5654, transparent: true, opacity: .32, depthWrite: false }), 'Fire smoke');
  const box = new THREE.Box3(), size = new THREE.Vector3(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), e = new THREE.Euler();
  const fires = sources.map(({ sprite, outdoors = false }) => {
    sprite.updateWorldMatrix(true, false);
    // A marker (userData.fire) gives its size; a sprite's own bounding box does otherwise.
    const marked = sprite.userData.fire, base = new THREE.Vector3();
    let width, height;
    if (marked) { width = marked.width; height = marked.height; sprite.getWorldPosition(base); }
    else { box.setFromObject(sprite).getSize(size); width = Math.max(.06, Math.max(size.x, size.z)); height = Math.max(.1, size.y); box.getCenter(base); base.y = box.min.y; }
    return { sprite, base, width, height, outdoors, coals: marked?.kind === 'coals', near: false, flameAcc: Math.random(), sparkAcc: Math.random(), smokeAcc: Math.random(), phase: Math.random() * 10 };
  });
  let time = 0;

  function emitFlame(f, gust) {
    const b = flames.take(); if (!b) return;
    const r = f.width * (f.coals ? .45 : .3), a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
    b.p.set(f.base.x + Math.cos(a) * d, f.base.y + (f.coals ? .02 : f.height * .04), f.base.z + Math.sin(a) * d);
    // Rise to about the flame's height in its lifetime; the middle burns tallest.
    const centre = 1 - d / Math.max(1e-3, r) * .6;
    b.duration = b.life = (f.coals ? .25 : .32) + Math.random() * (f.coals ? .25 : .42) * Math.min(1.6, .6 + f.height);
    b.v.set((Math.random() - .5) * f.width * .25 + gust[0] * .3, f.height * (f.coals ? .7 : 1.15) * centre / b.duration * 1.05, (Math.random() - .5) * f.width * .25 + gust[1] * .3);
    b.size = f.width * (f.coals ? .15 : .22) * (.75 + Math.random() * .6); b.swirl = Math.random() * 6.3; b.spin = (Math.random() - .5) * 4;
  }
  function emitSpark(f) {
    const b = sparks.take(); if (!b) return;
    b.p.set(f.base.x + (Math.random() - .5) * f.width * .4, f.base.y + f.height * .3, f.base.z + (Math.random() - .5) * f.width * .4);
    b.duration = b.life = .7 + Math.random() * 1.1;
    b.v.set((Math.random() - .5) * .8, 1 + Math.random() * 1.8 * Math.min(1.5, f.height + .4), (Math.random() - .5) * .8);
    b.size = .035 + Math.random() * .025; b.swirl = Math.random() * 6.3; b.spin = 0;
  }
  function emitSmoke(f) {
    const b = smoke.take(); if (!b) return;
    b.p.set(f.base.x + (Math.random() - .5) * f.width * .3, f.base.y + f.height * .85, f.base.z + (Math.random() - .5) * f.width * .3);
    b.duration = b.life = 2.2 + Math.random() * 1.6;
    b.v.set(wind[0] * .5 + (Math.random() - .5) * .2, .55 + Math.random() * .35, wind[1] * .5 + (Math.random() - .5) * .2);
    b.size = f.width * .3 + .12; b.swirl = Math.random() * 6.3; b.spin = (Math.random() - .5);
  }

  function update(dt, camera) {
    if (dt <= 0) return;
    time += dt;
    const viewer = camera.position;
    const gust = [wind[0] * (.6 + Math.sin(time * .7) * .4), wind[1] * (.6 + Math.cos(time * .53) * .4)];
    for (const f of fires) {
      const near = Math.abs(f.base.x - viewer.x) < NEAR && Math.abs(f.base.z - viewer.z) < NEAR && f.base.distanceToSquared(viewer) < NEAR * NEAR;
      if (near !== f.near) { f.near = near; f.sprite.visible = !near; }
      if (!near) continue;
      // Fires breathe: the rate swells and sinks a little, each at its own pace.
      const breath = .8 + Math.sin(time * 2.3 + f.phase) * .12 + Math.sin(time * 5.1 + f.phase * 2) * .08;
      f.flameAcc += dt * Math.min(48, Math.max(5, f.width * (f.coals ? 22 : 34))) * breath;
      while (f.flameAcc > 1) { f.flameAcc--; emitFlame(f, gust); }
      f.sparkAcc += dt * (f.width > .2 ? f.width * (f.coals ? 6 : 3.5) : 0);
      while (f.sparkAcc > 1) { f.sparkAcc--; emitSpark(f); }
      f.smokeAcc += dt * (f.outdoors && f.width > .45 && !f.coals ? 2.6 : 0);
      while (f.smokeAcc > 1) { f.smokeAcc--; emitSmoke(f); }
    }
    // Flames: they rise faster as they go, swirl, swell in their first moments, then burn down.
    let dirty = false;
    flames.items.forEach((b, i) => {
      if (b.life <= 0) return;
      b.life -= dt; dirty = true;
      if (b.life <= 0) { flames.mesh.setMatrixAt(i, flames.hidden); return; }
      const k = b.life / b.duration;
      b.swirl += dt * 9; b.v.y += dt * .9; b.v.x += Math.cos(b.swirl) * dt * .35; b.v.z += Math.sin(b.swirl) * dt * .35;
      b.p.addScaledVector(b.v, dt);
      const grow = k > .72 ? .6 + (1 - k) * 1.45 : Math.max(.18, k * 1.4);
      e.set(b.swirl * .2, b.spin * (1 - k), b.swirl * .13);
      flames.mesh.setMatrixAt(i, m.compose(b.p, q.setFromEuler(e), s.setScalar(b.size * grow)));
      // Most of a flame's life is orange and red; only the newest blocks burn white-yellow. Additive blocks
      // add up, so each stays a little dim on its own.
      flames.mesh.setColorAt(i, rampColor(Math.pow(k, 1.35)).multiplyScalar(.72 * Math.min(1, k * 2.6)));
    });
    if (dirty) { flames.mesh.instanceMatrix.needsUpdate = true; flames.mesh.instanceColor.needsUpdate = true; }
    dirty = false;
    sparks.items.forEach((b, i) => {
      if (b.life <= 0) return;
      b.life -= dt; dirty = true;
      if (b.life <= 0) { sparks.mesh.setMatrixAt(i, sparks.hidden); return; }
      const k = b.life / b.duration;
      b.swirl += dt * 6; b.v.x += Math.cos(b.swirl) * dt * 1.2 + gust[0] * dt * .4; b.v.z += Math.sin(b.swirl) * dt * 1.2 + gust[1] * dt * .4; b.v.y -= dt * .35;
      b.p.addScaledVector(b.v, dt);
      sparks.mesh.setMatrixAt(i, m.compose(b.p, q.identity(), s.setScalar(b.size)));
      sparks.mesh.setColorAt(i, rampColor(.35 + k * .55).multiplyScalar(k > .15 ? 1 : k / .15));
    });
    if (dirty) { sparks.mesh.instanceMatrix.needsUpdate = true; sparks.mesh.instanceColor.needsUpdate = true; }
    dirty = false;
    smoke.items.forEach((b, i) => {
      if (b.life <= 0) return;
      b.life -= dt; dirty = true;
      if (b.life <= 0) { smoke.mesh.setMatrixAt(i, smoke.hidden); return; }
      const k = b.life / b.duration;
      b.swirl += dt; b.v.x += (gust[0] - b.v.x) * dt * .4; b.v.z += (gust[1] - b.v.z) * dt * .4; b.v.y *= 1 - dt * .15;
      b.p.addScaledVector(b.v, dt);
      // Swells as it rises and thins away (shrinks) at the end.
      const grow = (1 + (1 - k) * 2.2) * Math.min(1, k * 3);
      e.set(b.swirl * .3, b.spin * (1 - k) * 2, b.swirl * .2);
      smoke.mesh.setMatrixAt(i, m.compose(b.p, q.setFromEuler(e), s.setScalar(b.size * grow)));
      smoke.mesh.setColorAt(i, _color.setRGB(.42 + k * .1, .4 + k * .1, .39 + k * .1));
    });
    if (dirty) { smoke.mesh.instanceMatrix.needsUpdate = true; smoke.mesh.instanceColor.needsUpdate = true; }
  }
  return { root, update, state: () => ({ fires: fires.length, near: fires.filter(f => f.near).length, flames: flames.items.filter(b => b.life > 0).length, sparks: sparks.items.filter(b => b.life > 0).length, smoke: smoke.items.filter(b => b.life > 0).length }) };
}

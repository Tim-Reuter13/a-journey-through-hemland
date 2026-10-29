import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SITES, ROADS } from '../src/world/hemland.js';

// CanvasTexture only needs an image container for these CPU geometry tests.
globalThis.ImageData ??= class { constructor(data, width, height) { Object.assign(this, { data, width, height }); } };
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ({ putImageData() {} }) }) };
const { buildCastle } = await import('../src/world/sites/city.js');

function fixture(builder, siteId) {
  let seed = 43;
  const ctx = {
    root: new THREE.Group(), buildings: [], colliders: [], floors: [], lights: [], markers: [], pois: [],
    heightAt: (x, z) => siteId === 'city' ? 10 : z > -1117 ? 34 - (z + 1117) * .1 : 34,
    random: () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296),
    site: id => SITES[id], road: id => ROADS.find(r => r.id === id),
    roadAt: (x, z) => ({ x: 1000, z, distance: Math.abs(x - 1000), line: ROADS.find(r => r.id === 'king') }),
    registerBuilding(b) { this.buildings.push(b); }, registerFloor(f) { this.floors.push(f); },
    addCollider(c) { this.colliders.push(c); }, addLight(l) { this.lights.push(l); },
    marker(m) { this.markers.push(m); }, poi(p) { this.pois.push(p); },
  };
  const api = builder(ctx); assert.equal(typeof api, 'object');
  ctx.root.updateMatrixWorld(true);
  ctx.meshes = []; ctx.footprints = []; ctx.streets = []; ctx.gates = []; ctx.ground = []; ctx.yards = [];
  ctx.root.traverse(o => {
    if (o.userData.siteBuilding) ctx.footprints.push(o.userData.siteBuilding);
    if (o.userData.street) ctx.streets.push(o.userData.street);
    if (o.userData.gate) ctx.gates.push(o.userData.gate);
    if (o.userData.cityGround) ctx.ground.push(o.userData.cityGround);
    if (o.userData.courtyard) ctx.yards.push(o.userData.courtyard);
    if (o.isMesh) ctx.meshes.push(o);
    if (!o.isMesh || !o.userData.solid) return;
    const box = new THREE.Box3().setFromObject(o), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    let parent = o.parent;
    while (parent && !parent.userData.siteBuilding) parent = parent.parent;
    ctx.colliders.push({ x: center.x, z: center.z, rotation: 0, halfWidth: size.x / 2, halfDepth: size.z / 2,
      bottom: box.min.y, top: box.max.y, name: o.parent.name, house: parent?.name });
  });
  return ctx;
}

const castle = fixture(buildCastle, 'castle'), city = castle;
function contains(b, x, z, radius = 0) {
  const c = Math.cos(b.rotation ?? 0), s = Math.sin(b.rotation ?? 0), dx = x - b.x, dz = z - b.z;
  return Math.abs(c * dx - s * dz) < b.halfWidth + radius - 1e-6 && Math.abs(s * dx + c * dz) < b.halfDepth + radius - 1e-6;
}
const blocked = (ctx, x, z, y) => ctx.colliders.find(c => c.bottom < y + 2.45 && c.top > y + .2 && contains(c, x, z, .32));
function corners(b) {
  const c = Math.cos(b.rotation), s = Math.sin(b.rotation);
  return [-1, 1].flatMap(a => [-1, 1].map(v => ({ x: b.x + c * a * b.halfWidth + s * v * b.halfDepth,
    z: b.z - s * a * b.halfWidth + c * v * b.halfDepth })));
}
function overlap(a, b) {
  const ca = corners(a), cb = corners(b);
  for (const angle of [a.rotation, b.rotation]) for (const axis of [[Math.cos(angle), -Math.sin(angle)], [Math.sin(angle), Math.cos(angle)]]) {
    const pa = ca.map(p => p.x * axis[0] + p.z * axis[1]), pb = cb.map(p => p.x * axis[0] + p.z * axis[1]);
    if (Math.max(...pa) <= Math.min(...pb) + 1e-6 || Math.max(...pb) <= Math.min(...pa) + 1e-6) return false;
  }
  return true;
}

test('gate passages clear a character across their full depth', () => {
  for (const ctx of [city, castle]) for (const gate of ctx.gates) {
    assert.ok(gate.width >= 6);
    for (let dx = -2.5; dx <= 2.5; dx += .5) for (let dz = -5; dz <= 5; dz += .5) {
      assert.ok(!blocked(ctx, gate.x + dx, gate.z + dz, ctx.heightAt(gate.x + dx, gate.z + dz) + .12), `gate blocked at ${gate.x + dx},${gate.z + dz}`);
    }
  }
});

test('mesh, material and light budgets hold; all geometry is boxes or crossed quads', t => {
  t.diagnostic(`City: ${city.footprints.length} buildings, ${city.buildings.length} enterable, ${city.meshes.length} meshes. Castle: ${castle.meshes.length} meshes. Lights: ${city.lights.length + castle.lights.length}.`);
  for (const ctx of [city, castle]) {
    assert.ok(ctx.meshes.length < (ctx === city ? 9000 : 2500), `${ctx.meshes.length} meshes`);
    for (const mesh of ctx.meshes) {
      // The castle rock uses the faceted landscape rocks (rocks.js) with their own master material.
      if (mesh.name.startsWith('rock:')) { assert.ok(mesh.material.name.startsWith('rock:')); continue; }
      assert.ok(mesh.geometry.type === 'BoxGeometry' || mesh.name === 'flame', mesh.geometry.type);
      assert.ok(mesh.material.name.startsWith('pixel:'));
      assert.equal(mesh.material.map.magFilter, THREE.NearestFilter);
    }
    let lightCount = 0; ctx.root.traverse(o => { if (o.isPointLight) { lightCount++; assert.ok(ctx.lights.includes(o)); } });
    assert.equal(lightCount, ctx.lights.length);
  }
  assert.ok(city.lights.length + castle.lights.length <= 12);
});


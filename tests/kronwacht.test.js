import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SITES, ROADS, KRONWACHT, kronwachtLevel, kronwachtTerrace, kronwachtPaving } from '../src/world/hemland.js';

globalThis.ImageData ??= class { constructor(data, width, height) { Object.assign(this, { data, width, height }); } };
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ({ putImageData() {} }) }) };
const { buildKronwacht } = await import('../src/world/sites/kronwacht.js');

let seed = 7;
const ctx = {
  root: new THREE.Group(), buildings: [], floors: [], colliders: [], pois: [], markers: [],
  heightAt: kronwachtLevel, random: () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296),
  site: id => SITES[id], road: id => ROADS.find(r => r.id === id), roadAt: () => null,
  registerBuilding(b, kind) { this.buildings.push({ ...b, kind }); }, registerFloor(f) { this.floors.push(f); },
  addCollider(c) { this.colliders.push(c); }, addLight() {}, marker(m) { this.markers.push(m); }, poi(p) { this.pois.push(p); },
};
buildKronwacht(ctx);
ctx.root.updateMatrixWorld(true);
const houses = [];
let meshes = 0;
ctx.root.traverse(o => { if (o.userData.siteBuilding) houses.push(o.userData.siteBuilding); if (o.isMesh) meshes++; });

test('terraces climb from the gate to the castle ramp', () => {
  assert.ok(kronwachtLevel(1000, -750) < 12 && kronwachtLevel(1040, -920) > 15 && kronwachtLevel(990, -1035) > 22);
  for (const r of KRONWACHT.ramps) assert.ok(kronwachtLevel(...r.b) - kronwachtLevel(...r.a) > 4, 'each ramp climbs a terrace');
  assert.equal(kronwachtPaving(995, -823), 1, 'the market is paved');
});

test('a dense city: many row houses, none overlapping, none straddling a terrace wall', () => {
  assert.ok(houses.length > 140, `${houses.length} houses`);
  for (let i = 0; i < houses.length; i++) {
    const a = houses[i], c = Math.cos(a.rotation), s = Math.sin(a.rotation);
    const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [a.x + u * a.halfWidth * .95 * c + v * a.halfDepth * .95 * s, a.z - u * a.halfWidth * .95 * s + v * a.halfDepth * .95 * c]);
    assert.ok(pts.every(([x, z]) => kronwachtTerrace(x, z) === kronwachtTerrace(a.x, a.z)), `${a.id} sits on one terrace`);
    for (let j = i + 1; j < houses.length; j++) {
      const b = houses[j];
      assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > Math.min(a.halfWidth, a.halfDepth) + Math.min(b.halfWidth, b.halfDepth) - .1, `${a.id} and ${b.id} overlap`);
    }
  }
  const districts = new Set(houses.map(h => h.district));
  assert.ok(['rich', 'poor', 'town'].every(d => districts.has(d)));
});

test('homes, shops, tavern, temple, barracks and smithy can be entered and are furnished', () => {
  const kinds = new Set(ctx.buildings.map(b => b.kind));
  for (const k of ['home', 'shop', 'tavern', 'temple', 'barracks', 'smithy']) assert.ok(kinds.has(k), k);
  assert.ok(ctx.buildings.length >= 14, `${ctx.buildings.length} enterable`);
  for (const b of ctx.buildings) assert.ok(b.interior.pois.length > 1 && b.door, `${b.root.name} furnished with a door`);
  assert.ok(ctx.pois.some(p => p.kind === 'shrine' && p.house === 'kronentempel'), 'the temple has an altar');
});

test('market stalls, wells, patrols and walls give the citizens somewhere to be', () => {
  assert.ok(ctx.pois.filter(p => p.kind === 'market').length >= 10);
  assert.ok(ctx.pois.filter(p => p.kind === 'well').length >= 2);
  assert.ok(ctx.pois.filter(p => p.kind === 'patrol').length >= 8);
  assert.ok(ctx.colliders.length > 150, 'walls and terrace walls collide');
  assert.ok(meshes < 62000, `${meshes} meshes before batching (they are merged per material and cell)`);
});

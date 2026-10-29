import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SITES, ROADS, RIVERS, BRIDGES, WATER_LEVEL } from '../src/world/hemland.js';
import { createHeightfield } from '../src/world/heightfield.js';
import { batchScenery } from '../src/world/batching.js';

globalThis.ImageData ??= class { constructor(data, width, height) { Object.assign(this, { data, width, height }); } };
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ({ putImageData() {} }) }) };
const { buildCountryside } = await import('../src/world/sites/countryside.js');
const { point, nearestLine, overlaps, groundRange, clearOfRoads } = await import('../src/world/sites/countrysideProps.js');

function fixture(heightAt = () => 1, configure = () => {}) {
  let seed = 123;
  const ctx = {
    root: new THREE.Group(), buildings: [], floors: [], colliders: [], lights: [], markers: [], pois: [],
    heightAt, site: id => SITES[id], road: id => ROADS.find(r => r.id === id),
    random: () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296),
    roadAt: (x, z) => ROADS.map(r => nearestLine(r, x, z)).sort((a, b) => a.distance - b.distance)[0],
    registerBuilding(b) { this.buildings.push(b); }, registerFloor(f) { this.floors.push(f); },
    addCollider(c) { this.colliders.push(c); }, addLight(l) { this.lights.push(l); },
    marker(m) { this.markers.push(m); }, poi(p) { this.pois.push(p); },
  };
  configure(ctx);
  ctx.api = buildCountryside(ctx); ctx.root.updateMatrixWorld(true);
  ctx.meshes = []; ctx.footprints = []; ctx.fields = []; ctx.foundations = [];
  ctx.root.traverse(o => {
    if (o.userData.siteBuilding) ctx.footprints.push(o.userData.siteBuilding);
    if (o.userData.field) ctx.fields.push(o.userData.field);
    if (o.userData.foundation) ctx.foundations.push(o.userData.foundation);
    if (o.userData.solidFootprint) {
      const f = o.userData.solidFootprint, p = o.getWorldPosition(new THREE.Vector3()), q = o.getWorldQuaternion(new THREE.Quaternion());
      ctx.colliders.push({ x: p.x, z: p.z, rotation: new THREE.Euler().setFromQuaternion(q, 'YXZ').y,
        halfWidth: f.width / 2, halfDepth: f.depth / 2, bottom: p.y, top: p.y + f.height, mesh: o });
    }
    if (!o.isMesh) return;
    ctx.meshes.push(o);
    if (!o.userData.solid) return;
    const size = new THREE.Vector3(), pos = new THREE.Vector3(), q = new THREE.Quaternion();
    o.matrixWorld.decompose(pos, q, size);
    const euler = new THREE.Euler().setFromQuaternion(q, 'YXZ'), p = o.geometry.parameters;
    let collider;
    if (Math.abs(euler.x) < .001 && Math.abs(euler.z) < .001) {
      collider = { x: pos.x, z: pos.z, halfWidth: p.width * size.x / 2, halfDepth: p.depth * size.z / 2,
        bottom: pos.y - p.height * size.y / 2, top: pos.y + p.height * size.y / 2, rotation: euler.y };
    } else {
      const bounds = new THREE.Box3().setFromObject(o), center = bounds.getCenter(new THREE.Vector3()), extent = bounds.getSize(new THREE.Vector3());
      collider = { x: center.x, z: center.z, halfWidth: extent.x / 2, halfDepth: extent.z / 2, bottom: bounds.min.y, top: bounds.max.y, rotation: 0 };
    }
    collider.mesh = o; ctx.colliders.push(collider);
  });
  return ctx;
}
function vertices(r) {
  const c = Math.cos(r.rotation || 0), s = Math.sin(r.rotation || 0);
  return [-1, 1].flatMap(x => [-1, 1].map(z => ({ x: r.x + x * r.halfWidth * c + z * r.halfDepth * s,
    z: r.z - x * r.halfWidth * s + z * r.halfDepth * c })));
}
function intersects(a, b) {
  for (const angle of [a.rotation || 0, b.rotation || 0]) for (const axis of [[Math.cos(angle), -Math.sin(angle)], [Math.sin(angle), Math.cos(angle)]]) {
    const ap = vertices(a).map(p => p.x * axis[0] + p.z * axis[1]), bp = vertices(b).map(p => p.x * axis[0] + p.z * axis[1]);
    if (Math.max(...ap) <= Math.min(...bp) + 1e-6 || Math.max(...bp) <= Math.min(...ap) + 1e-6) return false;
  }
  return true;
}
function contains(r, x, z, radius = 0) {
  if (Number.isFinite(r.radius)) return Math.hypot(x - r.x, z - r.z) < r.radius + radius;
  const c = Math.cos(r.rotation || 0), s = Math.sin(r.rotation || 0), dx = x - r.x, dz = z - r.z;
  return Math.abs(c * dx - s * dz) < r.halfWidth + radius - 1e-5 && Math.abs(s * dx + c * dz) < r.halfDepth + radius - 1e-5;
}
function blocked(ctx, p, radius = .3, keep = () => true) {
  return ctx.colliders.find(c => keep(c) && c.bottom < p.y + 2.45 && c.top > p.y + .2 && contains(c, p.x, p.z, radius));
}
const flat = fixture(), terrain = createHeightfield(), real = fixture(terrain.heightAt);

test('countryside buildings fit authored sites and all building footprints are separate', () => {
  assert.equal(flat.buildings.length, 4);
  assert.equal(flat.footprints.length, 14);
  for (const ctx of [flat, real]) {
    for (const b of ctx.footprints) {
      const site = SITES[b.site];
      assert.ok(vertices(b).every(p => Math.hypot(p.x - site.x, p.z - site.z) <= site.radius + 1e-6), b.id);
    }
    for (let i = 0; i < ctx.footprints.length; i++) for (const b of ctx.footprints.slice(i + 1)) {
      assert.ok(!intersects(ctx.footprints[i], b), `${ctx.footprints[i].id} overlaps ${b.id}`);
    }
  }
});

test('enterable buildings have complete registration, furnished rooms and reachable doors', () => {
  for (const ctx of [flat, real]) for (const b of ctx.buildings) {
    assert.deepEqual(Object.keys(b).filter(k => k !== 'steps').sort(), ['door', 'floor', 'interior', 'root']);
    // Door steps, where a house has them, are walkable floors at or below the house floor.
    for (const step of b.steps || []) assert.ok(step.y <= b.floor.y && Number.isFinite(step.z));
    assert.ok(b.root.parent); assert.equal(b.door.open, 0); assert.equal(b.door.target, 0);
    assert.ok(b.door.leaf.geometry.parameters.height * b.root.scale.y >= 2.9);
    assert.ok(b.interior.pois.length); assert.ok(b.interior.interactables.length); assert.ok(b.interior.loose.length);
    for (let z = b.root.userData.doorInside.z; z < b.root.userData.doorOutside.z + .01; z += .15) {
      const p = b.root.localToWorld(new THREE.Vector3(0, b.floor.y, z));
      const collider = blocked(ctx, p);
      assert.ok(!collider, `${b.root.name}: door path blocked at local z=${z.toFixed(2)} by ${collider?.mesh?.parent.name}`);
    }
    if (b.root.name !== 'Zum Grauen Krug') {
      const beams = b.root.children.filter(o => o.isMesh && o.material.name.startsWith('pixel:timber:') && o.position.z > 3 && o.position.y < 2);
      assert.ok(beams.every(o => Math.abs(o.position.x) - o.geometry.parameters.width / 2 >= .85), b.root.name);
    }
    // Continue across the yard to the site's street, rather than checking one point.
    const p = b.root.localToWorld(new THREE.Vector3(0, b.floor.y, b.root.userData.doorOutside.z));
    const target = ctx.roadAt(p.x, p.z);
    for (let i = 0; i <= 20; i++) {
      const t = i / 20, q = { x: p.x + (target.x - p.x) * t, z: p.z + (target.z - p.z) * t };
      q.y = ctx.heightAt(q.x, q.z) + .15;
      const collider = blocked(ctx, q);
      assert.ok(!collider, `${b.root.name}: approach blocked at ${q.x},${q.z} by ${collider?.mesh?.parent.name}`);
    }
  }
});

test('four disjoint fields per farm plus gardens stay off all roads and water', () => {
  for (const ctx of [flat, real]) {
    for (const id of ['farm_bridge', 'farm_east', 'farm_north']) {
      const fields = ctx.fields.filter(f => f.site === id && f.id.includes('_field_'));
      assert.equal(fields.length, 4, id);
    }
    for (let i = 0; i < ctx.fields.length; i++) {
      const f = ctx.fields[i];
      assert.ok(clearOfRoads(ctx, f), f.id);
      const lane = ctx.road({ farm_bridge: 'lane_bridge_farm', farm_east: 'lane_farm_east', farm_north: 'lane_farm_north' }[f.site]);
      assert.ok(Math.abs(Math.sin(f.rotation - nearestLine(lane, SITES[f.site].x, SITES[f.site].z).rotation)) < 1e-8, f.id);
      assert.ok(vertices(f).every(p => Math.hypot(p.x - SITES[f.site].x, p.z - SITES[f.site].z) <= SITES[f.site].radius), f.id);
      for (const p of [f, ...vertices(f)]) {
        assert.ok(ctx.heightAt(p.x, p.z) > WATER_LEVEL + .6, `${f.id} underwater`);
        assert.ok(RIVERS.every(r => nearestLine(r, p.x, p.z).distance > r.width / 2 + 2), `${f.id} river`);
      }
      for (const b of ctx.footprints) assert.ok(!intersects(f, b), `${f.id} overlaps ${b.id}`);
      for (const b of ctx.fields.slice(i + 1)) assert.ok(!intersects(f, b), `${f.id} overlaps ${b.id}`);
    }
  }
});

test('buildings and blocking props leave every road corridor clear', () => {
  assert.deepEqual(real.footprints.filter(b => !clearOfRoads(real, b, .1)).map(b => b.id), []);
  for (const road of ROADS) for (let i = 1; i < road.points.length; i++) {
    const [ax, az] = road.points[i - 1], [bx, bz] = road.points[i], length = Math.hypot(bx - ax, bz - az);
    for (let n = 0; n <= Math.ceil(length); n++) for (const side of [-1, 0, 1]) {
      const t = n / Math.ceil(length), offset = side * (road.width / 2 - .65);
      const p = { x: ax + (bx - ax) * t + (bz - az) / length * offset, z: az + (bz - az) * t - (bx - ax) / length * offset };
      p.y = real.heightAt(p.x, p.z) + .12;
      for (const f of real.floors) if (contains(f, p.x, p.z)) p.y = Math.max(p.y, f.y);
      // Road barriers are doors: a guard lifts them for whoever comes along.
      const collider = blocked(real, p, .25, c => c.kind !== 'door');
      // The 6.5-unit bridge includes parapets; its carriageway narrows at the bend.
      if (collider?.kind === 'parapet' && side !== 0 && road.id === BRIDGES[0].road) continue;
      assert.ok(!collider, `${road.id} blocked at ${p.x.toFixed(1)},${p.z.toFixed(1)} by ${collider?.mesh?.parent.name} (${collider?.x}, ${collider?.z}; ${collider?.halfWidth}, ${collider?.halfDepth})`);
    }
  }
});

test('bridge floor spans the river, has parapet colliders and connected shallow bank ramps', () => {
  const b = BRIDGES[0], deck = real.floors.find(f => f.x === b.x && f.z === b.z && f.y === b.height);
  assert.ok(deck); assert.equal(deck.halfWidth, b.width / 2); assert.equal(deck.halfDepth, b.length / 2);
  const ends = [-1, 1].map(s => point(deck, 0, s * deck.halfDepth));
  const river = RIVERS[0];
  assert.ok(ends.every(p => nearestLine(river, p.x, p.z).distance >= river.width / 2));
  assert.ok((ends[0].x - b.x) * (ends[1].x - b.x) < 0);
  assert.equal(real.colliders.filter(c => c.kind === 'parapet').length, 2);
  for (const side of [-1, 1]) {
    const ramps = real.floors.filter(f => f.halfWidth === deck.halfWidth && f.halfDepth < 1 && ((f.x - b.x) * Math.sin(deck.rotation) + (f.z - b.z) * Math.cos(deck.rotation)) * side > 15)
      .sort((a, c) => Math.hypot(a.x - b.x, a.z - b.z) - Math.hypot(c.x - b.x, c.z - b.z));
    assert.ok(ramps.length > 10);
    let lastY = deck.y;
    for (const r of ramps) { assert.ok(Math.abs(r.y - lastY) <= .23); lastY = r.y; }
    const end = ramps.at(-1); assert.ok(Math.abs(end.y - real.heightAt(end.x, end.z)) < .3);
  }
});

test('foundations meet the terrain at their footprint corners', () => {
  for (const ctx of [real, fixture((x, z) => 2 + x * .001 + z * .002)]) for (const f of ctx.foundations) {
    const range = groundRange(ctx, f);
    assert.ok(f.bottom <= range.low + .001, `foundation bottom at ${f.x},${f.z}`);
    assert.ok(f.top >= range.high - .001, `foundation top at ${f.x},${f.z}`);
  }
});

test('site mesh budgets, textures, POIs, lights and deterministic windmill animation', t => {
  for (const site of real.root.children) {
    let count = 0; site.traverse(o => { if (o.isMesh) count++; });
    assert.ok(count < 2500, `${site.name}: ${count}`); t.diagnostic(`${site.name}: ${count} meshes`);
  }
  for (const mesh of real.meshes) {
    assert.ok(['BoxGeometry', 'BufferGeometry'].includes(mesh.geometry.type));
    assert.ok(mesh.material.name.startsWith('pixel:'));
    assert.equal(mesh.material.map.magFilter, THREE.NearestFilter);
    // 16 texels per world unit, whether the canvas is one 16×16 tile or a larger surface.
    assert.equal(mesh.material.map.image.width * mesh.material.map.repeat.x, 16); assert.equal(mesh.material.map.image.height * mesh.material.map.repeat.y, 16);
  }
  const lights = []; real.root.traverse(o => { if (o.isPointLight) lights.push(o); });
  assert.deepEqual(lights, real.lights); assert.ok(lights.length <= 8);
  assert.equal(real.markers.length, 7); assert.equal(new Set(real.pois.map(p => p.id)).size, real.pois.length);
  for (const kind of ['field', 'workstation', 'counter', 'tavern_seat', 'patrol', 'bed', 'door']) assert.ok(real.pois.some(p => p.kind === kind), kind);
  for (const p of real.pois) assert.ok(Number.isFinite(p.x + p.y + p.z + p.facing), p.id);
  const sails = real.root.getObjectByName('mill_sails'), angle = sails.rotation.z;
  real.api.update(1, 12, new THREE.Vector3()); assert.ok(Math.abs(sails.rotation.z - angle - .11) < 1e-8);
  real.api.update(NaN); real.api.update(-1); assert.ok(Number.isFinite(sails.rotation.z));
  const labels = []; real.root.traverse(o => { if (o.userData.label) labels.push(o.userData.label); });
  for (const name of ['Dämmerwald', 'Kronwacht', 'Glutschrein', 'Westlager', SITES.inn.name]) assert.ok(labels.includes(name), name);
});

test('placement helpers handle rotated rectangles and clamped road endpoints', () => {
  assert.deepEqual(point({ x: 3, z: 4, rotation: 0 }, 2, 5), { x: 5, z: 9 });
  const line = { points: [[0, 0], [0, 10]] };
  assert.equal(nearestLine(line, 4, -2).distance, Math.hypot(4, 2));
  const a = { x: 0, z: 0, halfWidth: 2, halfDepth: 1, rotation: Math.PI / 4 };
  assert.equal(overlaps(a, { ...a, x: 1 }), true);
  assert.equal(overlaps(a, { ...a, x: 8 }), false);
});

test('box UVs retain sixteen texels per world unit, including enlarged shared houses', () => {
  for (const b of flat.buildings) assert.deepEqual(b.root.scale.toArray(), [1, 1, 1]);
  for (const mesh of flat.meshes) {
    if (mesh.geometry.type !== 'BoxGeometry') continue;
    const { width: w, height: h, depth: d } = mesh.geometry.parameters, uv = mesh.geometry.attributes.uv;
    for (const [face, [u, v]] of [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]].entries()) {
      const us = [0, 1, 2, 3].map(i => uv.getX(face * 4 + i)), vs = [0, 1, 2, 3].map(i => uv.getY(face * 4 + i));
      assert.ok(Math.abs(Math.max(...us) - Math.min(...us) - u) < 1e-5, `${mesh.parent.name}: u ${Math.max(...us) - Math.min(...us)} expected ${u}`);
      assert.ok(Math.abs(Math.max(...vs) - Math.min(...vs) - v) < 1e-5, `${mesh.parent.name}: v ${Math.max(...vs) - Math.min(...vs)} expected ${v}`);
    }
  }
});

test('light registration tolerates reparenting and leaves pre-existing scenery alone', () => {
  const expected = []; let existing;
  const ctx = fixture(() => 1, ctx => {
    existing = new THREE.PointLight(); existing.position.set(4, 5, 6); ctx.root.add(existing);
    ctx.addLight = function(light) {
      expected.push(light.getWorldPosition(new THREE.Vector3())); this.lights.push(light); this.root.add(light);
    };
  });
  assert.ok(!ctx.lights.includes(existing)); assert.equal(ctx.lights.length, 7);
  assert.deepEqual(existing.position.toArray(), [4, 5, 6]);
  ctx.lights.forEach((light, i) => assert.ok(light.getWorldPosition(new THREE.Vector3()).distanceTo(expected[i]) < 1e-8));
});

test('the windmill keeps its four moving sails after the lead batches static scenery', () => {
  const ctx = fixture(), keep = new Set(), sails = ctx.root.getObjectByName('mill_sails'), children = [...sails.children];
  for (const b of ctx.buildings) {
    b.door.hinge.traverse(o => { if (o.isMesh) keep.add(o); });
    for (const p of b.interior.loose) p.traverse(o => { if (o.isMesh) keep.add(o); });
  }
  const result = batchScenery(ctx.root, keep, 64);
  assert.ok(result.batches > 0); assert.equal(children.length, 4);
  assert.deepEqual(sails.children, children); assert.ok(children.every(o => o.isInstancedMesh));
  assert.deepEqual(children.map(o => o.count), [1, 4, 4, 32]);
  const before = sails.rotation.z; ctx.api.update(2); assert.ok(Math.abs(sails.rotation.z - before - .22) < 1e-8);
});

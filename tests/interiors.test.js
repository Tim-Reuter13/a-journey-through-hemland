import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.ImageData ??= class { constructor(data, width, height) { Object.assign(this, { data, width, height }); } };
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ({ putImageData() {} }) }) };
const F = await import('../src/world/furniture.js');
const { createHousehold, planInterior, furnishInterior } = await import('../src/world/interiors.js');
const roles = ['elder', 'smith', 'farmer_family', 'widow', 'ranger', 'merchant', 'priest', 'guard_bunks',
  'innkeeper', 'poor_labourer', 'rich_burgher', 'noble'];
const kinds = ['home', 'elder', 'smithy', 'farmer', 'tavern', 'temple', 'chapel', 'barracks', 'keep', 'shop', 'carpenter'];
const eps = 1e-6;
function footprint(p) {
  const f = F.furnitureFootprint(p.type, p.options), c = Math.abs(Math.cos(p.rotation)), s = Math.abs(Math.sin(p.rotation));
  return { x: p.x, z: p.z, width: f.width * c + f.depth * s, depth: f.depth * c + f.width * s };
}
const overlap = (a, b, radius = 0) => Math.abs(a.x - b.x) < (a.width + b.width) / 2 + radius - eps &&
  Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 + radius - eps;
function checkPlan(plan) {
  const { bounds: b, door, pieces } = plan, footprints = pieces.map(footprint);
  for (let i = 0; i < footprints.length; i++) {
    const a = footprints[i];
    assert.ok(Math.abs(a.x - b.x) + a.width / 2 <= b.width / 2 + eps);
    assert.ok(Math.abs(a.z - b.z) + a.depth / 2 <= b.depth / 2 + eps);
    assert.ok(!overlap(a, { x: door.x, z: door.z - .7, width: 2.8, depth: 1.6 }), `${pieces[i].type} blocks door swing`);
    for (const other of footprints.slice(i + 1)) assert.ok(!overlap(a, other), `${pieces[i].type} overlaps furniture`);
  }
  // Independent flood fill: .2-unit grid, square character clearance of .6 on each side.
  const step = .2, nx = Math.ceil((b.width - 1.2) / step) + 1, nz = Math.ceil((b.depth - 1.2) / step) + 1;
  const sx = (b.width - 1.2) / (nx - 1), sz = (b.depth - 1.2) / (nz - 1);
  const x0 = b.x - b.width / 2 + .6, z0 = b.z - b.depth / 2 + .6;
  const index = p => Math.round((p.z - z0) / sz) * nx + Math.round((p.x - x0) / sx);
  const point = i => ({ x: x0 + (i % nx) * sx, z: z0 + Math.floor(i / nx) * sz, width: 0, depth: 0 });
  const blocked = i => footprints.some(r => overlap(r, point(i), .6));
  const start = index({ x: door.x, z: Math.min(door.z, b.z + b.depth / 2 - .6) });
  const seen = new Set([start]), queue = [start]; assert.ok(!blocked(start));
  for (let i = 0; i < queue.length; i++) {
    const a = queue[i], x = a % nx, z = Math.floor(a / nx);
    for (const [xx, zz] of [[x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1]]) {
      const next = zz * nx + xx;
      if (xx < 0 || zz < 0 || xx >= nx || zz >= nz || seen.has(next) || blocked(next)) continue;
      seen.add(next); queue.push(next);
    }
  }
  for (const piece of pieces) {
    const approach = piece.approach;
    assert.ok(!footprints.some(r => overlap(r, { ...approach, width: 0, depth: 0 }, .6)), `${piece.type} approach blocked`);
    assert.ok([...seen].some(i => Math.hypot(point(i).x - approach.x, point(i).z - approach.z) <= .3), `${piece.type} unreachable`);
  }
}
function checkSurfaces(root) {
  root.updateWorldMatrix(true, true);
  const surfaces = new Map(), meshes = [], ray = new THREE.Raycaster();
  root.traverse(o => { if (o.isMesh) meshes.push(o); });
  root.traverse(item => {
    const s = item.userData.surface;
    if (!s) return;
    assert.ok(Math.abs(s.offsetX) + s.widthUsed / 2 <= s.width / 2 + eps);
    assert.ok(Math.abs(s.offsetZ) + s.depthUsed / 2 <= s.depth / 2 + eps);
    assert.equal(item.rotation.x, 0); assert.equal(item.rotation.z, 0);
    assert.ok(Math.abs(item.rotation.y - s.rotation) <= .09 + eps);
    const box = new THREE.Box3().setFromObject(item);
    const worldTop = item.parent.localToWorld(new THREE.Vector3(0, s.topY, 0)).y;
    assert.ok(Math.abs(box.min.y - worldTop) < eps, `${item.name} bottom ${box.min.y} != ${worldTop}`);
    const own = new Set(); item.traverse(o => own.add(o));
    for (const [dx, dz] of [[0, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const x = s.offsetX + dx * s.widthUsed / 2, z = s.offsetZ + dz * s.depthUsed / 2;
      const c = Math.cos(s.rotation), sn = Math.sin(s.rotation);
      const origin = item.parent.localToWorld(new THREE.Vector3(s.x + x * c + z * sn, s.topY + .002, s.z - x * sn + z * c));
      ray.set(origin, new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObjects(meshes.filter(m => !own.has(m)), false)[0];
      assert.ok(hit && Math.abs(hit.distance - .002) < eps, `${item.name} has no physical surface below it`);
    }
    const key = `${item.parent.uuid}/${s.x}/${s.z}/${s.topY}/${s.rotation}`, others = surfaces.get(key) ?? [];
    const r = { x: s.offsetX, z: s.offsetZ, width: s.widthUsed, depth: s.depthUsed };
    assert.ok(others.every(other => !overlap(r, other)), `${item.name} overlaps surface clutter`);
    others.push(r); surfaces.set(key, others);
  });
}

test('household and layout are deterministic for each seed and vary between households', () => {
  const layouts = new Set();
  for (let seed = 0; seed < 24; seed++) {
    assert.deepEqual(createHousehold('home', seed), createHousehold('home', seed));
    const a = planInterior('home', { seed }), b = planInterior('home', { seed });
    assert.deepEqual(a, b); layouts.add(JSON.stringify(a.pieces));
    assert.ok(a.household.details.length >= 1 && a.household.details.length <= 2);
    assert.ok(a.household.size >= 1);
  }
  assert.ok(layouts.size >= 16);
  for (const role of roles) assert.equal(createHousehold('home', 4, { role }).role, role);
});

test('every role and room kind keeps a 1.2-unit door-to-POI route and disjoint footprints', () => {
  for (const role of roles) for (const seed of [1, 17, 430]) checkPlan(planInterior('home', { seed, household: { role } }));
  for (const kind of kinds) for (const seed of [1, 17, 430]) {
    checkPlan(planInterior(kind, { seed, width: kind === 'home' ? 5.3 : 13.3, depth: 9.3 }));
  }
  checkPlan(planInterior('inn', { seed: 'rear', width: 13.44, depth: 3.58, centerZ: -3.43,
    door: { x: -4.55, z: -1.64 }, work: false, eating: false, household: { size: 4 } }));
});

test('rendered rooms retain POIs, colliders, exact surface contact, and one lamp per room', () => {
  for (const role of roles) for (const seed of [1, 17]) {
    const root = new THREE.Group(); root.rotation.y = .71; root.position.set(12, 3, -5);
    const room = furnishInterior(root, 'home', { seed, household: { role } });
    assert.ok(room.pois.length); assert.ok(room.interactables.length); assert.ok(room.loose.length);
    assert.ok(room.pois.some(p => p.kind === 'bed'));
    assert.ok(room.pois.every(p => p.approach));
    assert.ok(room.plan.pieces.every(p => root.children.some(o => o.name === p.type && o.userData.solidFootprint)));
    let lights = 0; root.traverse(o => { if (o.isPointLight) lights++; });
    assert.ok(lights <= 1); assert.equal(room.lightAnchors.length, 1);
    checkSurfaces(root);
  }
});

test('loose item collider matches its natural visual pose, including upright shelf books', () => {
  for (const type of ['plate', 'cup', 'bottle', 'bread', 'apple', 'cheeseWheel', 'bowl', 'jar', 'book', 'bucket', 'broom']) {
    for (const options of type === 'book' ? [{}, { upright: true }, { upright: true, spine: true }] : [{}]) {
      const root = new THREE.Group(), surface = { x: 0, z: 0, topY: 2.75, width: 4, depth: 4, rotation: PI / 2 };
      // A real tabletop under the items, so the surface check has something to hit.
      const slab = new THREE.Mesh(new THREE.BoxGeometry(4, .1, 4), new THREE.MeshBasicMaterial()); slab.position.y = 2.7; root.add(slab);
      const item = F.placeOnSurface(root, type, surface, { options });
      assert.ok(item); checkSurfaces(root);
      const originalY = item.position.y, { half, center } = item.userData.physics;
      item.rotation.y = 0; item.position.set(0, 0, 0);
      const box = new THREE.Box3().setFromObject(item), size = box.getSize(new THREE.Vector3());
      half.forEach((v, i) => assert.ok(Math.abs(v * 2 - size.getComponent(i)) < eps, `${type} collider axis ${i}`));
      assert.ok(Math.abs(box.min.y) < eps); assert.ok(Math.abs(box.getCenter(new THREE.Vector3()).x) < eps);
      // Simulate the lead's existing bottom-origin -> body-centre conversion.
      for (const child of item.children) child.position.y -= center[1];
      item.position.y = originalY + center[1];
      assert.ok(Math.abs(new THREE.Box3().setFromObject(item).min.y - originalY) < eps);
    }
  }
});
const PI = Math.PI;

test('surface placement rejects overlap and out-of-bounds items without disturbing shared assets', () => {
  const root = new THREE.Group(), s = { topY: 1.1, width: 1, depth: 1, rotation: .7 };
  const first = F.placeOnSurface(root, 'cup', s);
  assert.ok(first); assert.equal(F.placeOnSurface(root, 'bread', s), null);
  assert.equal(F.placeOnSurface(root, 'jar', s, { x: .48 }), null);
  assert.equal(root.children.length, 1);
  assert.ok(F.placeOnSurface(root, 'jar', s, { x: -.3, z: -.3 }));
});

test('rich and poor rooms have distinct visible furnishings; public POI kinds survive', () => {
  const rich = furnishInterior(new THREE.Group(), 'home', { width: 12, depth: 10, household: { role: 'rich_burgher' } });
  const poor = furnishInterior(new THREE.Group(), 'home', { width: 12, depth: 10, household: { role: 'poor_labourer' } });
  assert.ok(rich.plan.pieces.some(p => p.type === 'wardrobe'));
  assert.ok(rich.plan.pieces.some(p => p.type === 'bookshelf'));
  assert.ok(poor.plan.pieces.some(p => p.type === 'crate'));
  assert.ok(poor.plan.pieces.some(p => p.type === 'loom'));
  const poiKinds = new Set();
  for (const kind of kinds) {
    const root = new THREE.Group(), room = furnishInterior(root, kind, { width: 16, depth: 18, light: false });
    room.pois.forEach(p => poiKinds.add(p.kind)); checkSurfaces(root);
    assert.equal(room.lightAnchors.length, 1);
  }
  for (const kind of ['bed', 'seat', 'table', 'hearth', 'shelf', 'counter', 'workstation', 'tavern_seat', 'shrine']) assert.ok(poiKinds.has(kind), kind);
});

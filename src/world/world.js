import * as THREE from 'three';
import { createLightPool } from './lightPool.js';
import { batchScenery } from './batching.js';
import { createAtmosphere } from './atmosphere.js';
import { createCollisionWorld, collidersFrom } from './navigation.js';
import { buildFarTerrain, buildWater } from './terrain.js';
import { createWater } from './water.js';
import { createFires } from './fire.js';
import { createHeightfield } from './heightfield.js';
import { createChunkStreamer } from './chunks.js';
import { createChimneySmoke } from './smoke.js';
import { createCritters } from './critters.js';
import { boulder, wind, setGroundDensity } from './flora.js';
import { BOUNDS, SITES, ROADS, WATER_LEVEL } from './hemland.js';
import { makeHouse, makeLantern, makeWell, makeShrine, makeWatchtower, makeCamp, makeCart, makeFence, makeChest, makeForge, makeAnvil, glowMaterials } from './buildings.js';

/* Hemland, region Aschmark: a streamed heightfield world (hemland.js, heightfield.js,
   chunks.js) with authored sites. Dämmerwald is built here; larger sites come from
   src/world/sites/*.js modules through a small builder context. Every surface uses
   the 16-texel pixel library (see ART_DIRECTION.md). */
const PI = Math.PI;
const rand = (seed) => { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const rng = rand(61389);
const smoothstep = (a, b, v) => { const t = THREE.MathUtils.clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// Vite resolves this at build time; every builder exported by src/world/sites/*.js is run below.
const siteModules = import.meta.glob('./sites/*.js', { eager: true });

export function createWorld(scene) {
  const field = createHeightfield(), heightAt = field.heightAt;
  const SHRINE = SITES.shrine;
  // Walkable surfaces above the terrain: house floors, bridge decks, platforms.
  // Bucketed by 16-unit cells: this runs for every step of every character, so no full scans.
  const floors = [], floorCells = new Map(), FLOOR_CELL = 16;
  const floorKey = (gx, gz) => gx * 65536 + gz;
  function addFloor(floor) {
    const f = { rotation: 0, ...floor };
    f.cos = Math.cos(f.rotation); f.sin = Math.sin(f.rotation);
    const r = Math.hypot(f.halfWidth, f.halfDepth) + .5;
    for (let gx = Math.floor((f.x - r) / FLOOR_CELL); gx <= Math.floor((f.x + r) / FLOOR_CELL); gx++)
      for (let gz = Math.floor((f.z - r) / FLOOR_CELL); gz <= Math.floor((f.z + r) / FLOOR_CELL); gz++) {
        const key = floorKey(gx, gz);
        if (!floorCells.has(key)) floorCells.set(key, []);
        floorCells.get(key).push(f);
      }
    floors.push(f);
  }
  function floorAt(x, z, below = Infinity) {
    const list = floorCells.get(floorKey(Math.floor(x / FLOOR_CELL), Math.floor(z / FLOOR_CELL)));
    let best = -Infinity;
    if (list) for (const f of list) {
      const dx = x - f.x, dz = z - f.z;
      if (Math.abs(dx * f.cos - dz * f.sin) < f.halfWidth + .45 && Math.abs(dx * f.sin + dz * f.cos) < f.halfDepth + .45 && f.y > best && f.y <= below) best = f.y;
    }
    return best;
  }
  /** What the ground keeps prints of (tracks.js): sand, wet sand by the water, a dirt road or bare earth,
   *  mud, snow — or null for grass, rock, paving and water. Read from the terrain's own layer weights. */
  function groundAt(x, z) {
    const h = heightAt(x, z);
    if (h < WATER_LEVEL + .02) return null;
    const slope = Math.hypot(heightAt(x + 1, z) - heightAt(x - 1, z), heightAt(x, z + 1) - heightAt(x, z - 1)) / 2;
    const { a, b } = field.surface(x, z, h, slope);
    if (a[3] > .5) return 'snow';
    if (b[3] > .35 || a[2] > .55) return null;
    if (b[2] > .3) return h < WATER_LEVEL + .8 ? 'wetsand' : 'sand';
    if (b[1] > .45) return 'mud';
    if (a[0] > .45 || a[1] > .78) return 'path';
    return null;
  }
  /** Standing on a building's floor, under its roof (for light that should not reach in). */
  function indoorAt(x, z) {
    const list = floorCells.get(floorKey(Math.floor(x / FLOOR_CELL), Math.floor(z / FLOOR_CELL)));
    if (list) for (const f of list) {
      const dx = x - f.x, dz = z - f.z;
      if (f.indoor && Math.abs(dx * f.cos - dz * f.sin) < f.halfWidth && Math.abs(dx * f.sin + dz * f.cos) < f.halfDepth) return true;
    }
    return false;
  }
  // The shrine platform is three square steps (see makeShrine).
  function walkHeightAt(x, z) {
    const d = Math.max(Math.abs(x - SHRINE.x), Math.abs(z - SHRINE.z));
    const platform = d < 2.8 ? 1.015 : d < 3.4 ? .615 : d < 4 ? .215 : 0;
    return Math.max(heightAt(x, z) + platform, floorAt(x, z));
  }

  const ambient = new THREE.HemisphereLight(0xcbdce5, 0x6d715e, 2.2); scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffe7ca, 2.75);
  sun.position.set(-48, 85, 37); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 230; sun.shadow.bias = -.0004; sun.shadow.normalBias = .04;
  scene.add(sun); scene.fog = new THREE.FogExp2(0xa1b4bd, .0067);
  const atmosphere = createAtmosphere(scene, sun, ambient);
  scene.add(buildFarTerrain(field));
  // Near water is built per chunk (water.js); the big plane only fills in beyond the streamed rings.
  const water = buildWater(), waters = createWater(field); scene.add(water.mesh, waters.root);
  waters.useSky(atmosphere.uniforms, sun);

  // Building registry shared by the village and the site modules.
  const doors = [], interiors = [], loose = [], markers = [], pois = [], extraColliders = [], updaters = [];
  function registerBuilding(home, kind = home.root.userData.siteBuilding?.kind ?? 'home') {
    const { root } = home, index = doors.length;
    root.updateMatrixWorld(true);
    if (home.floor) addFloor({ x: root.position.x, z: root.position.z, rotation: root.rotation.y, halfWidth: home.floor.halfWidth, halfDepth: home.floor.halfDepth, y: root.position.y + home.floor.y, indoor: true });
    // Door steps, in the house's own frame.
    const c = Math.cos(root.rotation.y), s = Math.sin(root.rotation.y);
    for (const step of home.steps || []) addFloor({ ...step, x: root.position.x + step.x * c + step.z * s, z: root.position.z - step.x * s + step.z * c, rotation: root.rotation.y, y: root.position.y + step.y });
    if (home.door) {
      // The door leaf hangs off its hinge along local +x; its centre gives the doorway.
      const leaf = home.door.leaf.geometry.parameters, hinge = home.door.hinge;
      const doorPos = hinge.localToWorld(new THREE.Vector3(leaf.width / 2, 0, 0)), base = doorPos.y;
      const local = (point, fallbackZ) => root.localToWorld(point ? new THREE.Vector3(point.x, point.y ?? 0, point.z) : new THREE.Vector3(0, 0, fallbackZ));
      const door = { ...home.door, house: index, position: doorPos, outside: local(root.userData.doorOutside, 4.3), inside: local(root.userData.doorInside, 1.8) };
      door.collider = { kind: 'door', x: doorPos.x, z: doorPos.z, rotation: root.rotation.y, halfWidth: leaf.width / 2 + .01, halfDepth: .16, bottom: base, top: base + leaf.height };
      doors.push(door); extraColliders.push(door.collider);
      // Village houses: everything above the ceiling blocks the camera, so it never pokes into the attic.
      if (!root.userData.siteBuilding) extraColliders.push({ kind: 'roof', x: root.position.x, z: root.position.z, rotation: root.rotation.y, halfWidth: 4.3, halfDepth: 3.7, bottom: root.position.y + 4.26, top: root.position.y + 7.9 });
      const toWorld = poi => { const w = root.localToWorld(new THREE.Vector3(poi.x, poi.y ?? 0, poi.z)); return { ...poi, x: w.x, y: w.y, z: w.z, facing: (poi.facing || 0) + root.rotation.y, house: index }; };
      interiors.push({ house: index, kind, pois: (home.interior?.pois || []).map(toWorld), interactables: home.interior?.interactables || [], door });
    }
    loose.push(...(home.interior?.loose || []));
  }

  // ── Dämmerwald.
  const village = new THREE.Group(); village.name = 'Dämmerwald'; scene.add(village);
  // [x, z, rotation, scale, type, interior] — full size, so doorways fit a grown-up.
  // Every door faces the square by the well (a little jitter keeps the rows from looking drawn with a ruler).
  const square = { x: -3, z: 9 };
  const houses = [[-19.5, -4, .08, 1, 0, 'home'], [15, 14, -.1, 1, 1, 'smithy'], [18, -12, .06, 1, 0, 'home'], [-15, 22, -.05, 1, 1, 'elder'], [5, 28.5, .1, 1, 0, 'home']]
    .map(([x, z, jitter, ...rest]) => [x, z, Math.atan2(square.x - x, square.z - z) + jitter, ...rest]);
  houses.forEach(([x, z, r, s, t, kind], i) => registerBuilding(makeHouse(village, heightAt, x, z, r, s, t, { interior: kind, seed: i + 1 }), kind));
  makeWell(village, heightAt, -3, 9);
  for (const [x, z] of [[-8, 3], [9, 10], [-8.8, 17.9], [15, -2]]) makeLantern(village, heightAt, x, z);
  const forge = makeForge(village, heightAt, 4.6, 9.8, 2.43);
  const anvil = makeAnvil(village, heightAt, 6, 8.3, .5);
  makeChest(village, heightAt, -1, 13, -2.68);
  makeCart(village, heightAt, 6, 20, .4);
  makeFence(village, heightAt, Array.from({ length: 12 }, (_, i) => [-29 + i * 2.4, -19 + Math.sin(i * .5) * 2]));
  extraColliders.push({ kind: 'well', x: -3, z: 9, radius: 1.55, bottom: heightAt(-3, 9), top: heightAt(-3, 9) + 1.42 },
    { kind: 'cart', x: 6, z: 20, rotation: .4, halfWidth: 1.8, halfDepth: 1.05, bottom: heightAt(6, 20), top: heightAt(6, 20) + 2.2 });

  // ── Landmarks of the Aschmark wilderness, each in its own group so it can be hidden when far away.
  const landmark = (name, site) => { const g = new THREE.Group(); g.name = name; g.userData.site = site; scene.add(g); return g; };
  const shrineGroup = landmark('Glutschrein', SHRINE), shrine = makeShrine(shrineGroup, heightAt, SHRINE.x, SHRINE.z);
  for (let i = 0; i < 18; i++) {
    const a = i * .35, r = 6 + i * .37, x = SHRINE.x + Math.cos(a) * r, z = SHRINE.z + Math.sin(a) * r;
    if (i % 2 && field.roadClearance(x, z) > 3) boulder(shrineGroup, x, heightAt(x, z), z, .8 + rng() * .7, rng, i % 3 === 0);
  }
  const campGroup = landmark('Westlager', SITES.camp), camp = makeCamp(campGroup, heightAt, SITES.camp.x, SITES.camp.z);
  const towerGroup = landmark('Alter Wachturm', SITES.tower);
  makeWatchtower(towerGroup, heightAt, SITES.tower.x, SITES.tower.z);
  extraColliders.push({ kind: 'tower', x: SITES.tower.x, z: SITES.tower.z, rotation: .3, halfWidth: 3.3, halfDepth: 3.3, bottom: heightAt(SITES.tower.x, SITES.tower.z) - 2, top: heightAt(SITES.tower.x, SITES.tower.z) + 14 });

  // ── Site modules (city, castle, countryside …).
  const siteGroups = [shrineGroup, campGroup, towerGroup];
  // Sites ask for the nearest road from anywhere; the bucketed lookup only covers the roadside.
  function roadNear(x, z) {
    const near = field.roadAt(x, z);
    if (near) return near;
    let best = null;
    for (const line of ROADS) for (let i = 1; i < line.points.length; i++) {
      const [ax, az] = line.points[i - 1], [bx, bz] = line.points[i], dx = bx - ax, dz = bz - az;
      const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
      const px = ax + dx * t, pz = az + dz * t, distance = Math.hypot(x - px, z - pz);
      if (!best || distance < best.distance) best = { line, distance, t, x: px, z: pz };
    }
    return best;
  }
  for (const [file, module] of Object.entries(siteModules)) {
    for (const [name, build] of Object.entries(module)) {
      if (!name.startsWith('build') || typeof build !== 'function') continue;
      const root = new THREE.Group(); root.name = `${file} ${name}`; scene.add(root);
      const random = rand(name.length * 7919 + file.length);
      const ctx = {
        root, heightAt, random, site: id => SITES[id], road: id => ROADS.find(r => r.id === id), roadAt: roadNear,
        registerBuilding: (home, kind) => registerBuilding(home, kind), registerFloor: addFloor,
        addCollider: c => extraColliders.push(c), addLight: light => { const at = light.getWorldPosition(new THREE.Vector3()); root.add(light); light.position.copy(root.worldToLocal(at)); },
        marker: m => markers.push(m), poi: p => pois.push(p),
      };
      try {
        const result = build(ctx);
        if (result?.update) updaters.push(result.update);
        // Distance culling uses the site's bounding sphere.
        const sphere = new THREE.Box3().setFromObject(root).getBoundingSphere(new THREE.Sphere());
        root.userData.cull = sphere;
        siteGroups.push(root);
      } catch (error) { console.error(`Site ${name} in ${file} failed to build:`, error); scene.remove(root); }
    }
  }

  // ── Collision: everything static so far, then the streamed chunks add and remove their own.
  const collision = createCollisionWorld({ bounds: BOUNDS });
  for (const c of extraColliders) collision.add(c);
  scene.updateMatrixWorld(true);
  for (const c of collidersFrom(village)) collision.add(c);
  for (const g of siteGroups) for (const c of collidersFrom(g)) collision.add(c);
  function blocked(x, z, radius = .43, y = walkHeightAt(x, z), height = 2.65) { return collision.blocked(x, z, radius, y, height); }
  // NPC path planning treats doors as open; walking still bumps into closed ones.
  function navBlocked(x, z, radius = .34, y = walkHeightAt(x, z)) {
    // Steep ground is no path either (cliffs, terrace walls without stairs).
    const steep = Math.max(Math.abs(heightAt(x + .5, z) - heightAt(x - .5, z)), Math.abs(heightAt(x, z + .5) - heightAt(x, z - .5))) > 1.1;
    return steep || collision.blocked(x, z, radius, y, 2.65, 'door');
  }

  // Animated or physical things must stay separate meshes; each group batches on its own.
  // Fires (fire.js): flame sprites and coal beds stay out of the static batches, so near the viewer the
  // block flames can take a sprite's place and far off the sprite can stand in again.
  const fireSources = [];
  for (const g of [village, ...siteGroups]) g.traverse(o => { if (o.name === 'flame' && o.isMesh || o.name === 'coals' && o.userData.fire) fireSources.push(o); });
  const keep = new Set([...shrine.crystal.children, camp.fire, ...fireSources]);
  for (const door of doors) door.hinge.traverse(o => o.isMesh && keep.add(o));
  for (const item of loose) item.traverse(o => o.isMesh && keep.add(o));
  // Road barrier poles swing (main.js updateBarriers), so they stay separate meshes.
  scene.traverse(o => { if (o.userData.barrier) o.traverse(m => m.isMesh && keep.add(m)); });
  // The dense city merges into bigger cells: far fewer draw calls, still culled by district.
  const batching = [village, ...siteGroups].map(g => batchScenery(g, keep, /kronwacht/.test(g.name) ? 176 : 64));
  scene.updateMatrixWorld(true);
  const fires = createFires(scene, fireSources.map(sprite => { const p = sprite.getWorldPosition(new THREE.Vector3()); return { sprite, outdoors: !indoorAt(p.x, p.z) }; }));

  // Scenery avoids the village core, houses and every authored site.
  const occupied = (x, z) => houses.some(([hx, hz]) => Math.hypot(x - hx, z - hz) < 6) ||
    Math.hypot(x + 3, z - 9) < 3.2 || Math.hypot(x - 4.6, z - 9.8) < 2.6 || Math.hypot(x - 6, z - 20) < 2.6;
  const siteIds = Object.keys(SITES).filter(id => id !== 'village');
  const inSite = (x, z, margin) => siteIds.some(id => field.siteDistance(id, x, z) < margin);
  const streamer = createChunkStreamer({ scene, field, collision, water: waters,
    avoidTrees: (x, z) => Math.hypot(x, z - 6) < 34 || occupied(x, z) || inSite(x, z, 8),
    // No grass on city paving, and none poking through any site building's floor.
    avoidGround: (x, z) => occupied(x, z) || field.siteDistance('city', x, z) <= 0 || field.siteDistance('castle', x, z) <= 0 ||
      inSite(x, z, 1) && floorAt(x, z) > -Infinity });

  atmosphere.collectLights();
  // Smoke from every chimney the buildings marked (smoke.js).
  const mouths = []; scene.updateMatrixWorld(true);
  scene.traverse(o => { if (o.userData.chimney) mouths.push(o.getWorldPosition(new THREE.Vector3())); });
  const smoke = createChimneySmoke(scene, mouths);
  const critters = createCritters(scene, heightAt);
  // Every placed light becomes an anchor of the fixed-size pool, so the light count never changes.
  const placed = []; scene.traverse(o => { if (o.isPointLight) placed.push(o); });
  const lights = createLightPool(scene);
  for (const light of placed) lights.adopt(light);

  let elapsed = 0;
  const cullPoint = new THREE.Vector3();
  const profile = {};
  function update(dt, hour, camera, focus) {
    let t = performance.now();
    const mark = name => { const now = performance.now(); profile[name] = +(now - t).toFixed(1); t = now; };
    elapsed += dt;
    atmosphere.update(dt, hour, camera, focus); mark('atmosphere');
    streamer.update(focus); mark('streamer');
    wind.value += dt; water.update(dt, focus); fires.update(dt, camera);
    for (const g of siteGroups) { const s = g.userData.cull; if (s) g.visible = cullPoint.copy(s.center).distanceTo(focus) < s.radius + 520; }
    for (const fn of updaters) fn(dt, hour, focus);
    mark('sites');
    const daylight = smoothstep(-.16, .3, Math.sin((hour - 6) / 24 * PI * 2));
    waters.update(dt, .22 + daylight * .78, focus);
    glowMaterials.window.emissiveIntensity = .3 + (1 - daylight) * 1.1;
    smoke.update(dt, daylight); critters.update(dt, hour, focus);
    shrine.crystal.rotation.y += dt * .72; shrine.crystal.position.y = 3.7 + Math.sin(elapsed * 1.8) * .18;
    // Fire flickers in whole steps, like a sprite animation.
    const flicker = Math.floor(elapsed * 9);
    camp.fire.scale.set(1 + (flicker % 3) * .08, 1 + ((flicker * 7) % 4) * .06, 1);
    camp.fire.rotation.y = (flicker % 2) * .4;
    forge.light.intensity = 5 + (flicker % 3);
    for (const door of doors) {
      door.open += (door.target - door.open) * (1 - Math.exp(-dt * 5));
      door.hinge.rotation.y = door.open * 1.75;
      door.collider.disabled = door.open > .25;
    }
    lights.update(camera.position); mark('rest');
  }
  const at = (x, z, y = 0) => new THREE.Vector3(x, y, z);
  const routePoints = ROADS.filter(r => ['village_east', 'village_west', 'king', 'camp', 'tower', 'shrine'].includes(r.id))
    .map(r => r.points.filter(([x, z]) => Math.hypot(x, z) < 140).map(([x, z]) => at(x, z))).filter(r => r.length > 1);
  return {
    lights, fires, profile, navBlocked, water: waters, supportAt: (x, z, radius, y) => collision.supportAt(x, z, radius, y), heightAt: walkHeightAt, terrainHeightAt: heightAt, groundAt, field, routePoints, colliders: collision.colliders, segmentBlocked: collision.segmentBlocked,
    // What a struck point is made of: 'stone', 'wood', 'soft', or 'earth' for open ground.
    surfaceAt: point => collision.colliderAt(point.x, point.z, point.y)?.surface ?? 'earth',
    collidersNear: (x, z, r) => collision.near(x, z, r),
    blocked, update, batching, sun, ambient, moon: atmosphere.moon, indoorAt, streamer, setQuality: setGroundDensity, doors, interiors, floors, loose, markers, pois,
    nearRoad: (x, z, margin = 2.5) => field.roadClearance(x, z) < margin - 2,
    landmarks: { village: at(-3, 9), shrine: at(SHRINE.x, SHRINE.z), tower: at(SITES.tower.x, SITES.tower.z), camp: at(SITES.camp.x, SITES.camp.z),
      anvil: anvil.userData.work, city: at(SITES.city.x, SITES.city.z), castle: at(SITES.castle.x, SITES.castle.z), inn: at(SITES.inn.x, SITES.inn.z), chest: at(-1, 13),
      fires: [at(SITES.camp.x, SITES.camp.z, heightAt(SITES.camp.x, SITES.camp.z)), at(4.6, 9.8, heightAt(4.6, 9.8))] },
  };
}

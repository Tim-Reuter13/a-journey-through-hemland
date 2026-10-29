import * as THREE from 'three';
import { block, blockOn, beam, boxGeometry, crossGeometry } from '../../art/blocks.js';
import { pixelMaterial } from '../../art/pixelTextures.js';
import { makeHouse, makeCart, makeWell, makeFence, makeLantern } from '../buildings.js';
import * as F from '../furniture.js';
import { furnishInterior } from '../interiors.js';
import { BRIDGES, WATER_LEVEL } from '../hemland.js';
import { point, corners, overlaps, nearestLine, clearOfRoads, dryFootprint, group, groundRange,
  foundation, resizeHouse, pitchedRoof, makeBarn, haystack, scarecrow, cropField, chicken, royalBanner, signpost,
  registerLights, furniture } from './countrysideProps.js';

const PI = Math.PI;
function siteContext(ctx, id) {
  const root = group(ctx.root); root.name = id; root.userData.countrysideSite = id;
  const local = Object.create(ctx); local.root = root; return local;
}
function facingRoad(ctx, site) {
  const near = ctx.roadAt(site.x, site.z);
  return Math.atan2(near.x - site.x, near.z - site.z);
}
function poi(ctx, frame, id, kind, x, z, y, facing = 0, job) {
  const p = point(frame, x, z);
  ctx.poi({ id, kind, ...p, y: y ?? ctx.heightAt(p.x, p.z), facing: (frame.rotation || 0) + facing, ...(job ? { job } : {}) });
}
function buildingPois(ctx, building, id) {
  building.root.updateWorldMatrix(true, true);
  for (const [i, p] of building.interior.pois.entries()) {
    const world = building.root.localToWorld(new THREE.Vector3(p.x, p.y, p.z));
    ctx.poi({ ...p, id: `${id}_${p.kind}_${i}`, x: world.x, y: world.y, z: world.z,
      facing: (p.facing || 0) + building.root.rotation.y, house: id });
  }
  const outside = building.root.userData.doorOutside;
  const p = building.root.localToWorld(new THREE.Vector3(outside.x, outside.y, outside.z));
  ctx.poi({ id: `${id}_door`, kind: 'door', x: p.x, y: p.y, z: p.z, facing: building.root.rotation.y, house: id });
}
function floor(ctx, frame, x, z, width, depth, y) {
  ctx.registerFloor({ ...point(frame, x, z), rotation: frame.rotation || 0, halfWidth: width / 2, halfDepth: depth / 2, y });
}
function fence(ctx, points) {
  makeFence(ctx.root, ctx.heightAt, points);
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i], a = ctx.heightAt(ax, az), b = ctx.heightAt(bx, bz);
    ctx.addCollider({ kind: 'fence', x: (ax + bx) / 2, z: (az + bz) / 2, rotation: Math.atan2(bx - ax, bz - az),
      halfWidth: .12, halfDepth: Math.hypot(bx - ax, bz - az) / 2, bottom: Math.min(a, b) - .15, top: Math.max(a, b) + 1.25 });
  }
}
function railing(ctx, root, width, depth, x, y, z) {
  blockOn(root, width, 1.25, depth, 'ashlar', x, y, z);
  blockOn(root, width + .08, .15, depth + .08, 'stoneLight', x, y + 1.25, z);
  ctx.addCollider({ kind: 'parapet', ...point({ x: root.position.x, z: root.position.z, rotation: root.rotation.y }, x, z),
    rotation: root.rotation.y, halfWidth: width / 2, halfDepth: depth / 2, bottom: root.position.y + y, top: root.position.y + y + 1.4 });
}

function buildBridge(ctx) {
  const b = BRIDGES[0], road = ctx.road(b.road), index = road.points.findIndex(p => p[0] === b.x && p[1] === b.z);
  const before = road.points[Math.max(0, index - 1)], after = road.points[Math.min(road.points.length - 1, index + 1)];
  const rotation = Math.atan2(after[0] - before[0], after[1] - before[1]);
  const root = group(ctx.root, b.x, b.height, b.z, rotation), frame = { ...b, rotation };
  root.name = b.id; root.userData.bridge = { ...frame, halfWidth: b.width / 2, halfDepth: b.length / 2 };
  blockOn(root, b.width, .4, b.length, 'cobble', 0, -.4, 0);
  floor(ctx, frame, 0, 0, b.width, b.length, b.height);
  // A stepped barrel vault leaves the river channel open below its crown.
  for (let z = -13; z <= 13; z++) {
    const archBottom = -1.15 - 5.1 * (Math.abs(z) / 13) ** 2;
    blockOn(root, b.width, -.4 - archBottom, 1.02, 'ashlar', 0, archBottom, z);
  }
  for (const z of [-14, 14]) {
    const p = point(frame, 0, z), rect = { ...p, rotation, halfWidth: b.width / 2 + .5, halfDepth: 1.5 };
    const bottom = Math.min(-1.2, groundRange(ctx, rect).low - b.height - .7);
    blockOn(root, b.width + 1, -bottom - .35, 3, 'ashlarMossy', 0, bottom, z);
  }
  for (const x of [-1, 1]) railing(ctx, root, .5, b.length, x * (b.width / 2 - .25), 0, 0);
  // Many shallow, supported treads also handle a bank higher than the deck.
  for (const side of [-1, 1]) {
    let length = 8;
    while (length < 42) {
      const p = point(frame, 0, side * (b.length / 2 + length));
      const h = ctx.heightAt(p.x, p.z);
      if (h > WATER_LEVEL + 1 && Math.abs(h - b.height) / length < .28) break;
      length += 2;
    }
    const end = point(frame, 0, side * (b.length / 2 + length));
    const endY = ctx.heightAt(end.x, end.z), count = Math.max(Math.ceil(length / .5), Math.ceil(Math.abs(endY - b.height) / .22));
    for (let i = 0; i < count; i++) {
      const run = length / count, z = side * (b.length / 2 + (i + .5) * run);
      const y = b.height + (endY - b.height) * (i + 1) / count, p = point(frame, 0, z);
      const low = groundRange(ctx, { ...p, rotation, halfWidth: b.width / 2, halfDepth: run / 2 }).low - .4;
      blockOn(root, b.width, Math.max(.08, y - low), run + .01, 'cobble', 0, Math.min(low, y - .08) - b.height, z);
      floor(ctx, frame, 0, z, b.width, run + .01, y);
    }
  }
  return root;
}

function makeInn(ctx, site, frame) {
  const root = group(ctx.root, frame.x, ctx.heightAt(frame.x, frame.z), frame.z, frame.rotation);
  root.name = 'Zum Grauen Krug';
  root.userData.siteBuilding = { ...frame, id: 'inn_house', site: 'inn', kind: 'inn', halfWidth: 7.7, halfDepth: 6.3, enterable: true };
  const w = 14, d = 11, y = foundation(ctx, root, w + .3, d + .3), eave = y + 4.4;
  blockOn(root, w - .5, .06, d - .5, 'planks', 0, y, 0);
  for (const x of [-1, 1]) blockOn(root, .28, 4.4, d, 'plaster', x * (w / 2 - .14), y, 0, 0, { solid: true });
  blockOn(root, w, 4.4, .28, 'plaster', 0, y, -d / 2 + .14, 0, { solid: true });
  for (const x of [-1, 1]) {
    blockOn(root, 6.15, 4.4, .28, 'plaster', x * 3.925, y, d / 2 - .14, 0, { solid: true });
    blockOn(root, .18, 3.25, .4, 'timber', x * .94, y, d / 2 - .14);
    for (const z of [-d / 2, d / 2]) blockOn(root, .32, 4.5, .32, 'timber', x * w / 2, y, z);
    for (const z of [-d / 2 - .02, d / 2 + .02]) blockOn(root, w + .3, .22, .12, 'timber', 0, eave - .3, z);
  }
  blockOn(root, 1.7, 1.25, .28, 'plaster', 0, y + 3.15, d / 2 - .14, 0, { solid: true });
  blockOn(root, 2.15, .22, .42, 'timber', 0, y + 3.15, d / 2 - .14);
  const hinge = group(root, -.85, y, d / 2 - .14), leaf = blockOn(hinge, 1.7, 3.12, .14, 'door', .85, 0, 0);
  blockOn(hinge, .1, .16, .12, 'iron', 1.47, 1.25, .12);
  // Rear sleeping room: real partition, with a 1.8-unit open doorway on the left.
  for (const [x, width] of [[-6.15, 1.4], [1.6, 10.5]]) blockOn(root, width, 4.15, .22, 'planksVertical', x, y, -1.5, 0, { solid: true });
  blockOn(root, 1.8, 1, .22, 'planksVertical', -4.55, y + 3.15, -1.5, 0, { solid: true });
  blockOn(root, w - .5, .16, d - .5, 'darkPlanks', 0, eave - .16, 0);
  for (const x of [-4, 0, 4]) blockOn(root, .24, .26, d - .5, 'timber', x, eave - .42, 0);
  pitchedRoof(root, w, d, eave, 'slate');
  for (const x of [-5, 5]) {
    blockOn(root, 1.05, 1.25, .08, pixelMaterial('windowWarm', { emissive: .35 }), x, y + 1.7, d / 2 + .02);
    blockOn(root, 1.3, .18, .22, 'timber', x, y + 2.95, d / 2 + .1);
  }
  blockOn(root, 1.15, 5.2, 1.1, 'bricks', 5.25, y + 3, -3.8);
  const fy = y + .06, seed = site.id ?? site.name ?? 'grauer_krug';
  const sleeping = furnishInterior(root, 'inn', { seed: `${seed}/family`, floorY: fy,
    width: 13.44, depth: 3.58, centerZ: -3.43, door: { x: -4.55, z: -1.64 },
    work: false, eating: false, household: { size: 4, details: ['travel_chest'] } });
  const interior = furnishInterior(root, 'inn', { seed, floorY: fy, width: 13.44, depth: 6.48, centerZ: 1.8,
    sleeping: false, cooking: false, light: false,
    clearances: [{ x: -4.55, z: -.85, width: 1.8, depth: 1.3 }],
    household: { details: ['uneaten_meal', 'ledger'] } });
  for (const key of ['pois', 'interactables', 'loose', 'surfaces', 'lightAnchors']) interior[key].push(...sleeping[key]);
  interior.rooms = [interior.plan, sleeping.plan];
  const sign = group(root, -5.5, y + 3.8, d / 2 + .8); sign.userData.label = site.name;
  blockOn(sign, .15, .8, .15, 'iron', 0, -.8, 0);
  blockOn(sign, 2.2, 1, .16, 'darkPlanks', 0, -1.8, 0);
  blockOn(sign, .6, .55, .06, 'stoneLight', 0, -1.6, .12);
  blockOn(sign, .16, .36, .06, 'stoneLight', .4, -1.5, .12);
  root.userData.doorOutside = { x: 0, y: fy, z: d / 2 + 1.3 };
  root.userData.doorInside = { x: 0, y: fy, z: d / 2 - 1.5 };
  // Entry treads have their own walkable rectangles and supports down to ground.
  const outside = point(frame, 0, d / 2 + 1.2), ground = ctx.heightAt(outside.x, outside.z);
  const steps = Math.max(1, Math.ceil((root.position.y + fy - ground) / .23));
  for (let i = 0; i < steps; i++) {
    const z = d / 2 + .25 + i * .4, top = fy * (1 - i / steps), p = point(frame, 0, z), low = ctx.heightAt(p.x, p.z) - root.position.y - .3;
    blockOn(root, 2.2, Math.max(.1, top - low), .42, 'stone', 0, Math.min(low, top - .1), z);
    floor(ctx, frame, 0, z, 2.2, .42, root.position.y + top);
  }
  const building = { root, door: { hinge, leaf, open: 0, target: 0 },
    floor: { halfWidth: w / 2 - .28, halfDepth: d / 2 - .28, y: fy }, interior };
  ctx.registerBuilding(building); buildingPois(ctx, building, 'inn_house');
  return root;
}
function buildInn(ctx) {
  const s = ctx.site('inn'), rotation = facingRoad(ctx, s), frame = { ...point({ ...s, rotation }, 0, -5), rotation };
  makeInn(ctx, s, frame);
  const stable = { ...point(frame, 12.5, -5), rotation: rotation - PI / 2, id: 'inn_stable', site: 'inn', stable: true };
  makeBarn(ctx, stable);
  const well = point(frame, -12, -2); makeWell(ctx.root, ctx.heightAt, well.x, well.z);
  const wellY = ctx.heightAt(well.x, well.z);
  ctx.addCollider({ kind: 'well', ...well, radius: 1.55, bottom: wellY, top: wellY + 1.42 });
  poi(ctx, { ...well, rotation }, 'inn_well', 'well', 0, 2.4);
  const cart = point(frame, 13, 3); makeCart(ctx.root, ctx.heightAt, cart.x, cart.z, rotation + PI / 2);
  for (const x of [-4, 4]) {
    const p = point(frame, x, 6.7); F.bench(ctx.root, p.x, ctx.heightAt(p.x, p.z), p.z, rotation + PI);
    poi(ctx, frame, `inn_outside_${x}`, 'tavern_seat', x, 6.7, ctx.heightAt(p.x, p.z) + .8, PI);
  }
  const lamp = point(frame, -8.8, 6); makeLantern(ctx.root, ctx.heightAt, lamp.x, lamp.z);
  const hay = point(frame, 12.5, -11); haystack(ctx, hay.x, hay.z, rotation);
  ctx.marker({ id: 'inn', kind: 'inn', label: s.name, x: s.x, z: s.z });
}

// Command post of the royal road watch: a stone tower with a timber watch room under a tiled roof,
// an outside stair, a walled yard (lean-to, tent, cookfire, mess table, weapon rack, training
// dummy, notice board) and a sentry box with a striped barrier pole at the edge of the king's road.
// Local +z faces the road; the yard ends a little short of the road edge, wherever that lies.
function buildOutpost(ctx, id) {
  const s = ctx.site(id), rotation = facingRoad(ctx, s), frame = { x: s.x, z: s.z, rotation };
  const king = ctx.road('king'), near = nearestLine(king, s.x, s.z);
  const toRoad = Math.hypot(near.x - s.x, near.z - s.z) - king.width / 2;
  const front = Math.min(toRoad - 1.4, 5), back = front - 15;
  const root = group(ctx.root, s.x, ctx.heightAt(s.x, s.z), s.z, rotation), y = root.position.y;
  root.name = s.name;
  const slit = pixelMaterial('stone', { tint: 0x1c1e20 });
  const at = (x, z) => point(frame, x, z);
  // Yard furniture is scenery: what lies on the table stays there.
  const yard = { pois: [], interactables: [], loose: [] };

  // ── Tower: battered plinth, ashlar shaft with light quoins and a string course, arrow slits.
  const tx = -3.4, tz = back + 4, T = 5, H = 5.4;
  const tower = group(root, tx, 0, tz);
  blockOn(tower, T + .6, 1, T + .6, 'cobbleMossy', 0, -.6, 0);
  blockOn(tower, T, H - .4, T, 'ashlar', 0, .4, 0, 0, { solid: true });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) blockOn(tower, .62, H - .4, .62, 'stoneLight', sx * (T / 2 - .26), .4, sz * (T / 2 - .26));
  blockOn(tower, T + .14, .2, T + .14, 'stoneLight', 0, 2.8, 0);
  for (const [fx, fz, ry] of [[0, 1, 0], [0, -1, 0], [1, 0, PI / 2], [-1, 0, PI / 2]]) for (const [o, h] of [[-1.15, 1.4], [1.15, 3.3]]) {
    if (fz === 1 && h < 2) continue;
    blockOn(tower, .18, .85, .06, slit, fx * (T / 2 + .02) + (fz ? o : 0), h, fz * (T / 2 + .02) + (fx ? o : 0), ry);
  }
  // Door with a stone lintel and a worn step; the ring and studs are iron.
  blockOn(tower, 1.2, 2.2, .1, 'door', .4, .4, T / 2 + .03);
  blockOn(tower, 1.7, .32, .24, 'stoneLight', .4, 2.6, T / 2 + .06);
  blockOn(tower, 1.8, .22, .8, 'cobble', .4, .18, T / 2 + .4);
  blockOn(tower, .12, .12, .06, 'iron', .8, 1.4, T / 2 + .1);
  // Watch room: corbelled floor, parapet, timber posts, a tiled roof with a flag.
  for (const side of [-1, 1]) for (const k of [-1.8, -.6, .6, 1.8]) {
    blockOn(tower, .26, .34, .7, 'timber', side * (T / 2 + .2), H - .6, k);
    blockOn(tower, .7, .34, .26, 'timber', k, H - .6, side * (T / 2 + .2));
  }
  blockOn(tower, T + .9, .26, T + .9, 'darkPlanks', 0, H - .26, 0);
  floor(ctx, frame, tx, tz, T + .9, T + .9, y + H);
  const W = T + .9, stairZ = -T / 2 + .9;
  for (const side of [-1, 1]) {
    if (side > 0) blockOn(tower, .16, 1.05, W, 'planksVertical', W / 2 - .08, H, 0, 0, { solid: true });
    else for (const [z0p, z1p] of [[-W / 2, stairZ - 1], [stairZ + .5, W / 2]]) blockOn(tower, .16, 1.05, z1p - z0p, 'planksVertical', -W / 2 + .08, H, (z0p + z1p) / 2);
    blockOn(tower, W, 1.05, .16, 'planksVertical', 0, H, side * (W / 2 - .08), 0, { solid: true });
    for (const sz of [-1, 1]) blockOn(tower, .3, 2.75, .3, 'timber', side * (W / 2 - .15), H, sz * (W / 2 - .15));
    blockOn(tower, .3, 2.75, .3, 'timber', side * (W / 2 - .15), H, 0);
    blockOn(tower, .3, 2.75, .3, 'timber', 0, H, side * (W / 2 - .15));
  }
  // The west parapet stays open where the stair arrives; elsewhere it is a wall to lean on.
  ctx.addCollider({ kind: 'rail', ...at(tx - W / 2 + .08, tz + (stairZ + .5 + W / 2) / 2), rotation, halfWidth: .1, halfDepth: (W / 2 - stairZ - .5) / 2, bottom: y + H, top: y + H + 1.05 });
  ctx.addCollider({ kind: 'rail', ...at(tx - W / 2 + .08, tz + (stairZ - 1 - W / 2) / 2), rotation, halfWidth: .1, halfDepth: (stairZ - 1 + W / 2) / 2, bottom: y + H, top: y + H + 1.05 });
  blockOn(tower, W + .2, .22, W + .2, 'darkPlanks', 0, H + 2.75, 0);
  pitchedRoof(tower, W, W, H + 2.95, 'redRoof');
  blockOn(tower, .14, 2.6, .14, 'timber', 0, H + 4.4, 0);
  blockOn(tower, 1.25, .7, .05, 'clothBlue', .66, H + 6.25, 0);
  blockOn(tower, 1.25, .1, .06, 'brass', .66, H + 6.05, 0);
  royalBanner(tower, 0, H - 1.4, T / 2 + .06);
  // Outside stair up the west face: stringers, posts, a rope rail; every tread is a floor.
  const xs = -T / 2 - .95, z0 = T / 2 + 1.7, z1 = stairZ, steps = 18, rise = H / steps, run = (z0 - z1) / steps;
  for (let i = 0; i < steps; i++) {
    const z = z0 - (i + .5) * run, top = (i + 1) * rise;
    blockOn(tower, 1.1, .14, run + .03, 'planks', xs, top - .14, z);
    floor(ctx, frame, tx + xs, tz + z, 1.1, run + .03, y + top);
  }
  for (const dx of [-.58, .58]) beam(tower, [xs + dx, -.05, z0], [xs + dx, H - .05, z1], .16, 'timber');
  for (const t of [.35, .7]) blockOn(tower, .2, H * t, .2, 'timber', xs - .55, 0, z0 - (z0 - z1) * t);
  beam(tower, [xs - .62, 1, z0], [xs - .62, H + 1, z1], .07, 'clothLinen');
  blockOn(tower, 1.2, .26, 1.4, 'darkPlanks', xs, H - .26, z1 - .2);
  floor(ctx, frame, tx + xs, tz + z1 - .2, 1.2, 1.4, y + H);
  ctx.addCollider({ kind: 'stair', ...at(tx + xs - .62, tz + (z0 + z1) / 2), rotation, halfWidth: .08, halfDepth: (z0 - z1) / 2, bottom: y, top: y + H + 1 });
  root.userData.siteBuilding = { ...at(tx, tz), rotation, id: `${id}_tower`, site: id, kind: 'tower', halfWidth: T / 2 + .3, halfDepth: T / 2 + .3, enterable: false };

  // ── Yard wall: rubble stone with a light coping, a gate with piers and a lintel toward the road.
  const wall = (x0, z0w, x1, z1w) => {
    const len = Math.hypot(x1 - x0, z1w - z0w), ry = Math.atan2(x1 - x0, z1w - z0w), n = Math.max(1, Math.round(len / 3.2));
    for (let i = 0; i < n; i++) {
      const t = (i + .5) / n, x = x0 + (x1 - x0) * t, z = z0w + (z1w - z0w) * t, h = 1.25 + ((i * 7 + Math.round(x * 3)) % 3) * .08;
      blockOn(root, .55, h, len / n + .02, i % 2 ? 'cobble' : 'cobbleMossy', x, -.2, z, ry, { solid: true });
      blockOn(root, .68, .14, len / n + .04, 'stoneLight', x, h - .2, z, ry);
    }
  };
  const L = -8, R = 8, gate = [-.6, 3.2];
  wall(L, back, R, back); wall(L, back, L, front); wall(R, back, R, front);
  wall(L, front, gate[0] - .5, front); wall(gate[1] + .5, front, R, front);
  for (const x of [gate[0] - .45, gate[1] + .45]) {
    blockOn(root, .9, 2.5, .9, 'ashlar', x, -.2, front, 0, { solid: true });
    blockOn(root, 1.04, .2, 1.04, 'stoneLight', x, 2.3, front);
  }
  blockOn(root, gate[1] - gate[0] + 1.8, .32, .32, 'timber', (gate[0] + gate[1]) / 2, 3.1, front);
  const sign = group(root, (gate[0] + gate[1]) / 2, 2.35, front + .2);
  blockOn(sign, 1.6, .62, .08, 'darkPlanks', 0, 0, 0); blockOn(sign, .5, .3, .1, 'clothBlue', 0, .16, .02);
  for (const x of [-.6, .6]) blockOn(sign, .04, .2, .04, 'iron', x, .62, 0);
  for (let i = 0; i < 4; i++) blockOn(root, 1.3 + (i % 2) * .3, .08, .9, 'cobble', (gate[0] + gate[1]) / 2 + (i % 3 - 1) * .3, -.02, front - .6 - i * 1.25, (i % 2) * .2);

  // ── Lean-to with hay and a trough along the back wall.
  const sx = 4.6, sz = back + 2.1;
  for (const x of [-2.4, 0, 2.4]) { blockOn(root, .26, 2.9, .26, 'timber', sx + x, 0, sz - 1.6, 0, { solid: true }); blockOn(root, .26, 2.15, .26, 'timber', sx + x, 0, sz + 1.6, 0, { solid: true }); }
  block(root, 5.6, .18, 3.9, 'thatch', sx, 2.6, sz, .19, 0, 0);
  blockOn(root, 5.2, .9, .12, 'planksVertical', sx, 0, sz - 1.72);
  for (const [x, z, r] of [[-1.6, -.9, 0], [-.4, -.9, .1], [-1.1, -.9, -.05]]) blockOn(root, 1.15, .62, .72, 'hay', sx + x, z === -.9 && x === -1.1 ? .62 : 0, sz + z, r);
  blockOn(root, 2, .55, .62, 'planks', sx + 1.2, 0, sz + .2, 0, { solid: true }); blockOn(root, 1.8, .04, .44, 'water', sx + 1.2, .5, sz + .2);
  furniture(root, yard, 'grainSack', sx + 1.9, 0, sz - .9, .3);

  // ── Soldier's tent, cookfire with a pot on a tripod, mess table.
  const tent = group(root, 4.8, 0, back + 7.4, .25);
  for (const side of [-1, 1]) { const flap = block(tent, 1.75, .07, 3.1, 'clothBlue', side * .62, .95, 0, 0, 0, side * .82); flap.userData.solid = true; }
  blockOn(tent, .1, 1.95, .1, 'timber', 0, 0, 1.6); blockOn(tent, .1, 1.95, .1, 'timber', 0, 0, -1.6);
  blockOn(tent, .08, .08, 3.3, 'timber', 0, 1.9, 0);
  for (let k = 0; k < 3; k++) blockOn(tent, 2.2 - k * .7, .62, .05, 'clothLinen', 0, k * .62, -1.55);
  blockOn(tent, 1.3, .12, 2.2, 'clothLinen', 0, 0, .1);
  const fx = .6, fz = back + 8.2;
  for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 2; blockOn(root, .34, .24, .34, i % 3 ? 'stone' : 'cobbleMossy', fx + Math.cos(a) * .72, 0, fz + Math.sin(a) * .72, a); }
  for (const r of [.4, -.5, 1.4]) block(root, .2, .2, 1.1, 'bark', fx, .14, fz, 0, r, 0);
  const flame = new THREE.Mesh(crossGeometry(.8, .9, 3), pixelMaterial('flame', { emissive: 1 }));
  flame.position.set(fx, .14, fz); flame.castShadow = false; root.add(flame);
  for (const a of [0, 2.1, 4.2]) beam(root, [fx + Math.cos(a) * .75, 0, fz + Math.sin(a) * .75], [fx, 1.55, fz], .07, 'iron');
  blockOn(root, .42, .34, .42, 'iron', fx, .95, fz); blockOn(root, .3, .05, .3, 'darkPlanks', fx, 1.29, fz);
  const fire = new THREE.PointLight(0xff9a48, 6, 11, 2); fire.position.set(fx, 1, fz); root.add(fire);
  furniture(root, yard, 'table', -1.4, 0, back + 10.6, PI / 2);
  for (const z of [-.95, .95]) furniture(root, yard, 'bench', -1.4 + z, 0, back + 10.6, PI / 2);
  for (const [x, z, kind] of [[-1.5, back + 10.3, 'cup'], [-1.2, back + 10.9, 'bowl'], [-1.5, back + 11.1, 'bread']]) furniture(root, yard, kind, x, .9, z, 0);

  // ── By the tower door: weapon rack, armour stand, firewood; along the walls barrels and crates.
  furniture(root, yard, 'weaponRack', tx + 2.2, 0, tz + T / 2 + 1.4, PI);
  furniture(root, yard, 'armourStand', tx - 1.4, 0, tz + T / 2 + .9, PI);
  furniture(root, yard, 'firewoodStack', 1, 0, back + .6, 0);
  for (const [x, z, kind, r] of [[R - .8, front - 1.2, 'barrel', 0], [R - .8, front - 2.2, 'barrel', .4], [R - 1.7, front - 1.1, 'crate', .2], [R - .9, front - 3.3, 'crate', -.1],
    [L + .8, front - 1.1, 'barrel', .2], [L + .8, back + 9.2, 'crate', 0], [L + .8, back + 10.1, 'bucket', 0]]) furniture(root, yard, kind, x, 0, z, r);
  blockOn(root, .72, .72, .72, 'planks', R - 1.7, .72, front - 1.1, .5);
  // Training dummy: a stuffed sack on a post with a cross arm, a little battered.
  const dummy = group(root, 3.6, 0, back + 11.4, -.4);
  blockOn(dummy, .2, 1.9, .2, 'timber', 0, 0, 0, 0, { solid: true }); blockOn(dummy, .62, .8, .4, 'clothLinen', 0, .95, 0);
  blockOn(dummy, 1.3, .12, .12, 'timber', 0, 1.45, 0); blockOn(dummy, .34, .34, .3, 'hay', 0, 1.78, 0);
  block(dummy, .1, .1, .6, 'iron', .2, 1.25, .12, .3, .2, 0);
  // Notice board inside the gate: wanted notices and orders.
  const board = group(root, gate[1] + 1.8, 0, front - .8, PI);
  for (const x of [-.75, .75]) blockOn(board, .16, 2.1, .16, 'timber', x, 0, 0, 0, { solid: true });
  blockOn(board, 1.7, 1, .1, 'planks', 0, .95, 0); blockOn(board, 1.9, .14, .3, 'darkPlanks', 0, 2.05, 0);
  for (const [x, yy, w, h] of [[-.5, 1.45, .36, .44], [0, 1.25, .4, .5], [.5, 1.5, .32, .36], [.3, 1.05, .28, .22]]) blockOn(board, w, h, .03, 'clothLinen', x, yy - h / 2, -.07);
  F.brazier(root, gate[0] - 1.4, 0, front - 1.2, 0, { light: false });

  // ── Road barrier: post with a counterweighted, striped pole raised over the road, a sentry box.
  // On the post's own side of the road; the arm (local +x) reaches across toward the far side.
  const roadFrame = { ...near, rotation: near.rotation };
  const side = Math.sign((s.x - near.x) * Math.cos(near.rotation) - (s.z - near.z) * Math.sin(near.rotation)) || -1;
  const anchor = point(roadFrame, side * (king.width / 2 + .6), 0), gy = ctx.heightAt(anchor.x, anchor.z);
  const barrier = group(ctx.root, anchor.x, gy, anchor.z, near.rotation + (side > 0 ? PI : 0)); barrier.name = `${id}_barrier`; barrier.userData.roadside = true;
  // The pole pivots at waist height and lies across the road until the post's guard swings it up
  // (main.js updateBarriers). While it is down it is a door-kind collider: walking respects it,
  // path planning does not, so nobody plans a detour round a gate that will open for them.
  blockOn(barrier, .7, .5, .7, 'cobble', 0, -.3, 0);
  blockOn(barrier, .36, 1.45, .36, 'timber', 0, -.1, 0, 0, { solid: true });
  const arm = group(barrier, 0, 1.2, 0);
  for (let i = 0; i < 8; i++) blockOn(arm, .95, .2, .2, i % 2 ? 'clothLinen' : 'clothBlue', .55 + i * .95, -.1, 0);
  blockOn(arm, .55, .55, .5, 'stone', -.55, -.3, 0);
  blockOn(arm, .12, .12, .26, 'iron', 0, -.06, 0);
  blockOn(barrier, .24, 1.05, .24, 'timber', 7.35, -.1, 0);
  for (const dz of [-.15, .15]) blockOn(barrier, .08, .32, .08, 'timber', 7.35, .95, dz);
  const turn = barrier.rotation.y, barrierFrame = { x: anchor.x, z: anchor.z, rotation: turn };
  const collider = { kind: 'door', ...point(barrierFrame, 3.85, 0), rotation: turn, halfWidth: 3.85, halfDepth: .16, bottom: gy, top: gy + 1.45 };
  ctx.addCollider(collider);
  // Where the guard waits (by the sentry box) and works (at the counterweight), in barrier space.
  arm.userData.barrier = { site: id, idle: [-1.7, .95], work: [-.85, .55] }; arm.userData.collider = collider;
  const box = group(barrier, -1.7, 0, 0);
  blockOn(box, 1.4, 2.4, .1, 'planksVertical', 0, -.1, -.68, 0, { solid: true });
  for (const sx2 of [-.68, .68]) blockOn(box, .1, 2.4, 1.4, 'planksVertical', sx2, -.1, 0, 0, { solid: true });
  for (const sx2 of [-.7, .7]) for (const sz2 of [-.7, .7]) blockOn(box, .16, 2.45, .16, 'timber', sx2, -.1, sz2);
  block(box, 1.7, .14, 1.8, 'redRoof', 0, 2.48, .05, .18, 0, 0);
  blockOn(box, 1.1, .1, .5, 'planks', 0, .55, -.35);
  // Only the cookfire casts light (the world has a small light budget); lanterns just glow.
  const lamp = makeLantern(barrier, () => 0, -.7, 1.1, false); lamp.position.y = -.1;
  makeLantern(root, () => 0, gate[1] + .8, front + .8, false);
  for (const piece of yard.loose) delete piece.userData.physics;
  poi(ctx, frame, `${id}_patrol`, 'patrol', tx, tz, y + H, 0, 'guard');
  poi(ctx, frame, `${id}_gate`, 'patrol', (gate[0] + gate[1]) / 2, front + 1.2, undefined, 0, 'guard');
  ctx.marker({ id, kind: 'tower', label: s.name, x: s.x, z: s.z });
}

function farmHouse(ctx, frame, siteId) {
  const p = point(frame, -7.5, -2), rotation = frame.rotation + PI / 2;
  // The shared house needs a little extra height for a character-sized doorway.
  const house = makeHouse(ctx.root, ctx.heightAt, p.x, p.z, rotation, 1, siteId === 'farm_east' ? 1 : 0, { interior: 'farmer', seed: Math.floor(ctx.random() * 100000) });
  for (const o of [...house.root.children]) {
    const g = o.geometry?.parameters;
    if (g?.width === 8.1 && g.height === .26 && g.depth === .1 && o.position.z > 0 && o.position.y < 2) {
      o.removeFromParent();
      for (const x of [-1, 1]) blockOn(house.root, 3.15, .26, .1, 'timber', x * 2.475, 1.59, o.position.z);
    }
  }
  resizeHouse(house, 1.06);
  house.root.name = `${siteId}_house`;
  house.root.userData.siteBuilding = { ...p, rotation, id: house.root.name, site: siteId, kind: 'home', halfWidth: 5.6, halfDepth: 4.8, enterable: true };
  house.root.userData.doorOutside = { x: 0, y: house.floor.y, z: 4.3 };
  house.root.userData.doorInside = { x: 0, y: house.floor.y, z: 2 };
  const f = groundRange(ctx, { ...p, rotation, halfWidth: 4.4, halfDepth: 3.8 });
  house.root.userData.foundation = { ...p, rotation, halfWidth: 4.4, halfDepth: 3.8, bottom: f.low - .9, top: house.root.position.y + .53 };
  const houseFrame = { ...p, rotation };
  for (const o of house.root.children) if (o.isMesh && [1.9, 1.6].some(w => Math.abs(o.geometry.parameters.width - w * 1.06) < .001)) {
    const g = o.geometry.parameters;
    floor(ctx, houseFrame, o.position.x, o.position.z, g.width, g.depth, house.root.position.y + o.position.y + g.height / 2);
  }
  floor(ctx, houseFrame, 0, 3.4, 1.4, .65, house.root.position.y + house.floor.y);
  ctx.registerBuilding(house); buildingPois(ctx, house, house.root.name);
}
function buildFarm(ctx, id) {
  const s = ctx.site(id), lane = ctx.road({ farm_bridge: 'lane_bridge_farm', farm_east: 'lane_farm_east', farm_north: 'lane_farm_north' }[id]);
  const frame = { ...s, rotation: nearestLine(lane, s.x, s.z).rotation + PI };
  for (let z = -23; z < 24; z += 1.5) {
    const p = point(frame, 0, z), r = groundRange(ctx, { ...p, rotation: frame.rotation, halfWidth: 1.9, halfDepth: .75 });
    blockOn(ctx.root, 3.8, r.high - r.low + .1, 1.5, 'path', p.x, r.low - .08, p.z, frame.rotation, { shadow: false });
  }
  farmHouse(ctx, frame, id);
  const barn = { ...point(frame, 7.5, -2), rotation: frame.rotation - PI / 2, id: `${id}_barn`, site: id };
  makeBarn(ctx, barn);
  poi(ctx, barn, `${id}_work`, 'workstation', 0, 5, undefined, PI, 'farmer');
  const coop = point(frame, -7.5, 8), cr = group(ctx.root, coop.x, ctx.heightAt(coop.x, coop.z), coop.z, frame.rotation);
  cr.name = `${id}_coop`; cr.userData.siteBuilding = { ...coop, rotation: frame.rotation, id: cr.name, site: id, kind: 'coop', halfWidth: 2.3, halfDepth: 2, enterable: false };
  const cy = foundation(ctx, cr, 4, 3.2, .06);
  blockOn(cr, 4, 1.65, 3.2, 'planksVertical', 0, cy, 0, 0, { solid: true });
  blockOn(cr, .65, .8, .12, 'door', 0, cy, 1.65);
  pitchedRoof(cr, 4, 3.2, cy + 1.65);
  const pen = [[-11, 6], [-11, 11], [-4.8, 11], [-4.8, 6]].map(([x, z]) => { const p = point(frame, x, z); return [p.x, p.z]; });
  fence(ctx, pen);
  for (const [x, z] of [[-8.5, 10.4], [-5.8, 10.3]]) {
    const p = point(frame, x, z); chicken(ctx, p.x, p.z, frame.rotation + ctx.random() * PI * 2);
  }
  // Yard boundaries have broad openings at both ends of the field lane.
  for (const x of [-18, 18]) {
    const pts = [-10, 0, 10].map(z => { const p = point(frame, x, z); return [p.x, p.z]; });
    fence(ctx, pts);
  }
  const garden = { ...point(frame, 8, 8), rotation: frame.rotation, halfWidth: 3, halfDepth: 2.4, id: `${id}_garden`, site: id };
  cropField(ctx, garden, 'cabbage', 1);
  for (const z of [-2.5, 2.5]) {
    const a = point(garden, -3.2, z), b = point(garden, 3.2, z);
    fence(ctx, [[a.x, a.z], [b.x, b.z]]);
  }
  const fields = [];
  for (const [i, [x, z]] of [[-12, -18], [12, -18], [-12, 18], [12, 18]].entries()) {
    let rect;
    // Search a small neighbourhood if a lane clips a corner of the field.
    for (const shift of [0, -2, 2, -4, 4]) {
      const candidate = { ...point(frame, x + shift, z), rotation: frame.rotation, halfWidth: 4.5, halfDepth: 4, id: `${id}_field_${i}`, site: id };
      if (clearOfRoads(ctx, candidate) && dryFootprint(ctx, candidate)
        && !fields.some(f => overlaps(f, candidate, 1))
        && corners(candidate).every(p => Math.hypot(p.x - s.x, p.z - s.z) <= s.radius)) { rect = candidate; break; }
    }
    if (!rect) continue;
    fields.push(rect); cropField(ctx, rect, ['wheat', 'barley', 'cabbage', 'wheat'][i]);
    poi(ctx, rect, `${rect.id}_poi`, 'field', 0, rect.halfDepth + 1, undefined, PI, 'farmer');
  }
  const scare = point(frame, -1.7, -17); scarecrow(ctx, scare.x, scare.z, frame.rotation);
  const cart = point(frame, 2.7, 9.5); makeCart(ctx.root, ctx.heightAt, cart.x, cart.z, frame.rotation + PI / 2);
  for (const z of [-7, 6]) { const h = point(frame, 13, z); haystack(ctx, h.x, h.z, frame.rotation); }
  ctx.marker({ id, kind: 'farm', label: s.name, x: s.x, z: s.z });
}

function buildMill(ctx) {
  const s = ctx.site('mill'), rotation = facingRoad(ctx, s), frame = { ...point({ ...s, rotation }, 0, -2.5), rotation };
  const root = group(ctx.root, frame.x, ctx.heightAt(frame.x, frame.z), frame.z, rotation);
  root.name = s.name; root.userData.siteBuilding = { ...frame, id: 'mill_tower', site: 'mill', kind: 'mill', halfWidth: 4.7, halfDepth: 4.7, enterable: false };
  const y = foundation(ctx, root, 7.2, 7.2), base = y + 7.8;
  blockOn(root, 7, 7.8, 7, 'ashlarMossy', 0, y, 0, 0, { solid: true });
  blockOn(root, 5.8, 3.6, 5.8, 'planksVertical', 0, base, 0, 0, { solid: true });
  pitchedRoof(root, 6.1, 6.1, base + 3.6, 'slate');
  blockOn(root, 1.7, 3.2, .16, 'door', 0, y, 3.58);
  for (const x of [-2.1, 2.1]) blockOn(root, .7, 1.2, .12, 'windowDark', x, y + 4.5, 3.55);
  // Turn on the rear facade, away from the entrance, cart and NPC work area.
  const sails = group(root, 0, base + 2.2, -3.6); sails.name = 'mill_sails';
  // Instancing the four repeated sails also keeps them out of static batching.
  const sailBox = (w, h, d, mat, positions) => {
    const mesh = new THREE.InstancedMesh(boxGeometry(w, h, d), pixelMaterial(mat), positions.length);
    const matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), axis = new THREE.Vector3(0, 0, 1);
    for (const [i, [x, y, z, angle]] of positions.entries()) {
      const c = Math.cos(angle), s = Math.sin(angle);
      matrix.compose(new THREE.Vector3(x * c - y * s, x * s + y * c, z), q.setFromAxisAngle(axis, angle), new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = mesh.receiveShadow = true; mesh.userData.animated = true; sails.add(mesh);
  };
  sailBox(.7, .7, 1.1, 'timber', [[0, 0, 0, 0]]);
  const spokes = [], cloth = [], battens = [];
  for (let i = 0; i < 4; i++) {
    const angle = i * PI / 2;
    spokes.push([0, 3.65, -.4, angle]); cloth.push([.65, 4.55, -.4, angle]);
    for (let h = 2; h < 7.4; h += .7) battens.push([.65, h + .045, -.44, angle]);
  }
  sailBox(.22, 7.3, .24, 'timber', spokes); sailBox(1.35, 5.5, .08, 'clothLinen', cloth); sailBox(1.5, .09, .14, 'timber', battens);
  for (const [x, z] of [[-4.8, 0], [-4.7, 1], [-4.5, 2]]) {
    const p = point(frame, x, z); F.grainSack(ctx.root, p.x, ctx.heightAt(p.x, p.z), p.z, rotation);
  }
  const p = point(frame, 7, -2); makeCart(ctx.root, ctx.heightAt, p.x, p.z, rotation);
  poi(ctx, frame, 'mill_work', 'workstation', 0, 5, undefined, PI);
  ctx.marker({ id: 'mill', kind: 'mill', label: s.name, x: s.x, z: s.z });
  return sails;
}

function buildRoadside(ctx) {
  const road = ctx.road('king'); let distance = 0, next = 150;
  for (let i = 1; i < road.points.length; i++) {
    const [ax, az] = road.points[i - 1], [bx, bz] = road.points[i], length = Math.hypot(bx - ax, bz - az), rotation = Math.atan2(bx - ax, bz - az);
    while (next <= distance + length) {
      const t = (next - distance) / length, frame = { x: ax + (bx - ax) * t, z: az + (bz - az) * t, rotation };
      let p = point(frame, road.width / 2 + 2, 0);
      if (!dryFootprint(ctx, { ...p, rotation, halfWidth: .4, halfDepth: .4 })) p = point(frame, -road.width / 2 - 2, 0);
      if (dryFootprint(ctx, { ...p, rotation, halfWidth: .4, halfDepth: .4 })) {
        const root = group(ctx.root, p.x, ctx.heightAt(p.x, p.z), p.z, rotation); root.name = `Meilenstein ${next}`;
        root.userData.milestone = next;
        blockOn(root, .7, 1.5, .7, 'ashlar', 0, -.25, 0, 0, { solid: true });
        blockOn(root, .85, .2, .85, 'stoneLight', 0, 1.25, 0);
        for (let n = 0; n < next / 150; n++) blockOn(root, .06, .15, .025, 'darkPlanks', -.22 + n % 4 * .13, .65 + Math.floor(n / 4) * .22, .36);
      }
      next += 150;
    }
    distance += length;
  }
  const destinations = [
    { label: 'Dämmerwald', x: 0, z: 6 }, { label: 'Kronwacht', x: 1000, z: -900 },
    { label: 'Glutschrein', x: 230, z: -60 }, { label: 'Westlager', x: -330, z: 150 },
  ];
  for (const [x, z] of [[60, -20], [520, -418], [610, -500], [700, -600], [790, -688], [-24, 15]]) {
    const near = nearestLine(road, x, z), p = point({ x, z, rotation: near.rotation }, 7, 5);
    signpost(ctx, p.x, p.z, destinations);
  }
  const near = nearestLine(road, 570, -460), shrine = point(near, -10, 0), sy = ctx.heightAt(shrine.x, shrine.z);
  const root = group(ctx.root, shrine.x, sy, shrine.z, near.rotation); root.name = 'Wegschrein';
  const fy = foundation(ctx, root, 2.8, 2);
  blockOn(root, 2, 1.3, 1.3, 'ashlarMossy', 0, fy, 0, 0, { solid: true });
  blockOn(root, .25, 1.8, .25, 'stoneLight', 0, fy + 1.3, 0);
  blockOn(root, 1.1, .22, .25, 'stoneLight', 0, fy + 2.4, 0);
  F.placeOnSurface(root, 'candle', { x: 0, z: 0, topY: fy + 1.3, rotation: 0, width: 2.2, depth: 1.4 }, { x: .65 }); poi(ctx, { ...shrine, rotation: near.rotation }, 'road_shrine', 'shrine', 0, 2.2);
  const gallows = { x: 930, z: -795, rotation: -.25 }, g = group(ctx.root, gallows.x, ctx.heightAt(gallows.x, gallows.z), gallows.z, gallows.rotation);
  g.name = 'Südgalgen';
  const gy = foundation(ctx, g, 5.5, 4.2, .2);
  blockOn(g, 5.2, .2, 4, 'darkPlanks', 0, gy, 0);
  for (const x of [-2, 2]) blockOn(g, .36, 5.8, .36, 'timber', x, gy, -.8, 0, { solid: true });
  blockOn(g, 5, .4, .4, 'timber', 0, gy + 5.4, -.8);
  beam(g, [-2, gy + 4.2, -.8], [-.7, gy + 5.4, -.8], .18, 'timber');
  blockOn(g, .055, 1.6, .055, 'hay', 0, gy + 3.8, -.8);
  for (const x of [-.23, .23]) blockOn(g, .055, .5, .055, 'hay', x, gy + 3.3, -.8);
  for (const h of [3.25, 3.8]) blockOn(g, .5, .055, .055, 'hay', 0, gy + h, -.8);
  const crow = group(g, 1.65, gy + 5.8, -.8); crow.name = 'Krähe';
  blockOn(crow, .28, .4, .5, 'darkPlanks', 0, .12, 0);
  blockOn(crow, .25, .25, .25, 'darkPlanks', 0, .44, .16);
  blockOn(crow, .12, .08, .2, 'iron', 0, .49, .35);
  for (const x of [-.09, .09]) blockOn(crow, .04, .14, .04, 'iron', x, 0, .05);
}

/** Build once into a world-space root. Keep the returned update in the site's tick list. */
export function buildCountryside(ctx) {
  const first = ctx.root.children.length;
  buildBridge(siteContext(ctx, 'grauwasser'));
  buildInn(siteContext(ctx, 'inn'));
  for (const id of ['outpost_west', 'outpost_east']) buildOutpost(siteContext(ctx, id), id);
  for (const id of ['farm_bridge', 'farm_east', 'farm_north']) buildFarm(siteContext(ctx, id), id);
  const sails = buildMill(siteContext(ctx, 'mill'));
  buildRoadside(siteContext(ctx, 'king_road'));
  for (const root of ctx.root.children.slice(first)) registerLights(ctx, root);
  return { update(dt) {
    if (Number.isFinite(dt) && dt > 0) sails.rotation.z = (sails.rotation.z + dt * .11) % (2 * PI);
  } };
}

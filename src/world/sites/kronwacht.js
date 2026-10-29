import * as THREE from 'three';
import { block, blockOn, beam } from '../../art/blocks.js';
import { pixelMaterial } from '../../art/pixelTextures.js';
import { KRONWACHT, kronwachtTerrace, kronwachtLevel } from '../hemland.js';
import { roofSide, gable, glowMaterials, makeLantern, makeWell, makeCart, makeAnvil } from '../buildings.js';
import { roundTower } from './city.js';
import { broadleaf } from '../flora.js';
import * as F from '../furniture.js';
import { furnishInterior } from '../interiors.js';
import { siteGroup, royalBanner, pyramidRoof } from './cityBuildings.js';
import { chimneyMarker } from '../smoke.js';
import { propClone, propBounds, propsLoaded } from '../props.js';

// Kronwacht, the royal city: a hill town on three terraces (hemland.js KRONWACHT), held by an irregular
// wall that climbs the castle rock to join Burg Kronwacht (city.js). The streets wind up from the south
// gate over the market and the temple square to the upper town and the castle ramp. Gable-fronted
// houses of two to four storeys stand shoulder to shoulder along every street with back houses in the
// plots behind; the town keeps its town hall, bell tower, forge, bakehouse, tannery, stables and
// granary, wells and a market cross, gallows outside the gate, and the clutter of daily work outside
// every door.
const PI = Math.PI;
const WALL = { minX: 826, maxX: 1174, minZ: -1054, maxZ: -738 };
// Lime plaster in pale washes (tints multiply the texture, so they stay close to white).
const PLASTER = [0xffffff, 0xfff4e0, 0xffeadf, 0xeef6f6, 0xfffaee, 0xf8e6c8, 0xf0f0e4];
const SHUTTERS = [0x3f5f3a, 0x8a3328, 0x35537a, 0x6f5d2c, 0x4a3a2c];
const AWNINGS = [0xb8463a, 0x3b5e8c, 0xd0a23c, 0x4d7a3e, 0x8a4a7a, 0xe0d8c0];
const tinted = (name, tint) => pixelMaterial(name, { tint });

// ── Geometry helpers ───────────────────────────────────────────────────────────────────────────
const streetDistance = (x, z) => {
  let best = Infinity, width = 0;
  for (const st of KRONWACHT.streets) for (let i = 1; i < st.points.length; i++) {
    const [ax, az] = st.points[i - 1], [bx, bz] = st.points[i], dx = bx - ax, dz = bz - az;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t) - st.width / 2;
    if (d < best) { best = d; width = st.width; }
  }
  return { d: best, width };
};
const plazaDistance = (x, z) => Math.min(...KRONWACHT.plazas.map(p => {
  const c = Math.cos(p.rotation), s = Math.sin(p.rotation), lx = (x - p.x) * c - (z - p.z) * s, lz = (x - p.x) * s + (z - p.z) * c;
  return Math.max(Math.abs(lx) - p.w / 2, Math.abs(lz) - p.d / 2);
}));
const rampDistance = (x, z) => Math.min(...KRONWACHT.ramps.map(r => {
  const [ax, az] = r.a, [bx, bz] = r.b, dx = bx - ax, dz = bz - az, t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - ax - dx * t, z - az - dz * t) - r.width / 2;
}));
/** Corners and edge points of a rotated rectangle (local +z is the front). */
function outline({ x, z, rotation, w, d }, inset = 0) {
  const c = Math.cos(rotation), s = Math.sin(rotation), pts = [];
  for (const u of [-1, -.5, 0, .5, 1]) for (const v of [-1, -.5, 0, .5, 1]) {
    if (Math.abs(u) < 1 && Math.abs(v) < 1 && (u || v)) continue;
    const lx = u * (w / 2 - inset), lz = v * (d / 2 - inset);
    pts.push([x + lx * c + lz * s, z - lx * s + lz * c]);
  }
  return pts;
}
const corners = ({ x, z, rotation, w, d }) => {
  const c = Math.cos(rotation), s = Math.sin(rotation);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [x + u * w / 2 * c + v * d / 2 * s, z - u * w / 2 * s + v * d / 2 * c]);
};
function overlapsRect(a, b, margin = 0) {
  if (Math.hypot(a.x - b.x, a.z - b.z) > (Math.hypot(a.w, a.d) + Math.hypot(b.w, b.d)) / 2) return false;
  const axes = [a.rotation, a.rotation + PI / 2, b.rotation, b.rotation + PI / 2];
  for (const angle of axes) {
    const ax = Math.sin(angle), az = Math.cos(angle), proj = pts => pts.map(([x, z]) => x * ax + z * az);
    const pa = proj(corners(a)), pb = proj(corners(b));
    if (Math.max(...pa) <= Math.min(...pb) + margin || Math.max(...pb) <= Math.min(...pa) + margin) return false;
  }
  return true;
}
function* along(points, step) {
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i], len = Math.hypot(bx - ax, bz - az);
    for (let s = carry; s < len; s += step) yield { x: ax + (bx - ax) * s / len, z: az + (bz - az) * s / len, tx: (bx - ax) / len, tz: (bz - az) / len };
    carry = (carry - len) % step; if (carry < 0) carry += step;
  }
}

// ── Row house ───────────────────────────────────────────────────────────────────────────────────
// Local frame: front (street) is +z, the root stands on the street-side ground. Ground floor in
// stone or plaster, jettied timber-framed upper floors, a steep roof either along the street or
// gable-front, windows with shutters and flower boxes, a chimney; shops get signs and awnings.
function rowHouse(ctx, h) {
  const r = ctx.random, { w, d, storeys, district, kind } = h, hw = w / 2, hd = d / 2;
  const root = siteGroup(ctx.root, h.x, h.y, h.z, h.rotation);
  root.name = h.id;
  const rich = district === 'rich', poor = district === 'poor';
  // Each house is built from what its owner could afford: dressed stone, brick, fieldstone or boards.
  const any = list => list[Math.floor(r() * list.length)];
  const groundMat = rich ? any(['ashlar', 'sandstone', 'granite', 'ashlar']) : poor ? any(['planksVertical', 'fieldstone', 'planksWeathered', 'cobble']) : any(['stoneLight', 'cobble', 'plaster', 'ashlar', 'brickRed', 'fieldstone', 'sandstone', 'plasterRough']);
  const plaster = tinted('plaster', PLASTER[Math.floor(r() * PLASTER.length)]);
  const upperMat = rich && r() < .45 ? any(['ashlar', 'sandstone', 'brickRed']) : poor && r() < .5 ? any(['planks', 'planksWeathered']) : r() < .18 ? any(['plasterRough', 'brickRed']) : plaster;
  const shutter = r() < .3 ? 'planksPainted' : tinted('planks', SHUTTERS[Math.floor(r() * SHUTTERS.length)]);
  const roofTex = poor ? any(['thatch', 'thatch', 'woodShingle', 'redRoof']) : rich ? any(['slate', 'slate', 'clayTile', 'redRoof']) : any(['redRoof', 'redRoof', 'slate', 'clayTile', 'woodShingle']);
  const timber = r() < .3 ? 'darkPlanks' : 'timber';
  const G = 3.6, U = 3.2, jetty = storeys > 1 && !rich ? .45 : 0, floorY = .15;
  const top = G + (storeys - 1) * U;
  // Foundation down to the lowest corner so slopes never show a gap.
  const ground = (lx, lz) => { const p = root.localToWorld(new THREE.Vector3(lx, 0, lz)); return ctx.heightAt(p.x, p.z) - h.y; };
  root.updateMatrixWorld(true);
  const lowest = Math.min(ground(-hw, -hd), ground(hw, -hd), ground(-hw, hd), ground(hw, hd), 0);
  blockOn(root, w + .1, floorY - lowest + .6, d + .1, 'cobble', 0, lowest - .6, 0);
  const solid = { solid: true };
  // Ground floor: a solid core, or hollow walls with a door for the houses you can enter.
  let door = null;
  const doorX = kind === 'home' ? (r() - .5) * Math.max(0, w - 4.5) : 0, doorW = kind === 'tavern' || kind === 'temple' ? 2.2 : 1.6, doorH = 3.0;
  if (h.enterable) {
    const t = .3;
    blockOn(root, w, G, t, groundMat, 0, floorY, -hd + t / 2, 0, solid);
    for (const sx of [-1, 1]) blockOn(root, t, G, d - 2 * t, groundMat, sx * (hw - t / 2), floorY, 0, 0, solid);
    const left = doorX - doorW / 2, right = doorX + doorW / 2;
    blockOn(root, left + hw, G, t, groundMat, (left - hw) / 2, floorY, hd - t / 2, 0, solid);
    blockOn(root, hw - right, G, t, groundMat, (hw + right) / 2, floorY, hd - t / 2, 0, solid);
    blockOn(root, doorW + .04, G - doorH, t, groundMat, doorX, floorY + doorH, hd - t / 2, 0, solid);
    blockOn(root, w - .6, .04, d - .6, 'planks', 0, floorY - .02, 0, 0, { shadow: false });
    blockOn(root, w - .6, .16, d - .6, 'darkPlanks', 0, G - .05, 0, 0, { shadow: false });
    for (let bx = -hw + 1.5; bx < hw - 1; bx += 2.2) blockOn(root, .22, .22, d - .6, timber, bx, G - .27, 0);
    const hinge = siteGroup(root, doorX - doorW / 2, floorY, hd - .16);
    door = { hinge, leaf: blockOn(hinge, doorW, doorH - .04, .12, 'door', doorW / 2, 0, 0), open: 0, target: 0 };
  } else {
    blockOn(root, w - .02, G, d - .02, groundMat, 0, floorY, 0, 0, solid);
    blockOn(root, doorW, doorH, .1, 'door', doorX, floorY, hd + .03);
  }
  // Door frame and a step where the street falls away.
  for (const sx of [-1, 1]) blockOn(root, .2, doorH + .1, .26, timber, doorX + sx * (doorW / 2 + .1), floorY, hd + .04);
  blockOn(root, doorW + .6, .22, .3, timber, doorX, floorY + doorH, hd + .05);
  const front = ground(doorX, hd + .7);
  if (front < floorY - .1) blockOn(root, doorW + .6, floorY - front + .2, .8, 'stoneLight', doorX, front - .2, hd + .4);
  // Ground-floor windows (or a shop front with an awning).
  const windowAt = (lx, y, z, wide, glow, upper) => {
    const g = siteGroup(root, lx, y, z);
    blockOn(g, wide, 1.15, .08, glow ? glowMaterials.window : 'windowDark', 0, 0, .02);
    blockOn(g, wide + .3, .14, .16, timber, 0, 1.15, .06); blockOn(g, wide + .36, .12, .26, timber, 0, -.12, .1);
    if (r() < .8) for (const sx of [-1, 1]) { const sh = blockOn(g, wide / 2 + .05, 1.15, .06, shutter, sx * (wide * .75 + .05), 0, .18); sh.rotation.y = sx * .35; }
    if (upper && r() < .55) {
      blockOn(g, wide + .3, .26, .32, 'planks', 0, -.42, .2);
      blockOn(g, wide + .1, .2, .22, r() < .5 ? 'flowerRed' : r() < .5 ? 'flowerYellow' : 'oakLeaves', 0, -.16, .2);
    }
  };
  const shop = ['shop', 'tavern', 'smithy'].includes(kind);
  // Side walls get windows too: where a neighbour stands they simply disappear into its wall.
  for (const sx of [-1, 1]) {
    const g = siteGroup(root, sx * (hw + .01), floorY + 1.25, 0, sx * PI / 2);
    blockOn(g, 1, 1.1, .06, 'windowDark', 0, 0, 0); blockOn(g, 1.3, .12, .2, timber, 0, -.12, .06);
  }
  for (const sx of [-1, 1]) {
    const lx = sx * Math.max(doorW / 2 + 1.1, hw * .55) + (kind === 'home' ? doorX * .4 : 0);
    if (Math.abs(lx) > hw - .8 || Math.abs(lx - doorX) < doorW / 2 + .9) continue;
    windowAt(lx, floorY + 1.25, hd, shop ? 1.6 : 1.05, false, false);
  }
  if (shop) {
    const awning = tinted('clothRed', AWNINGS[Math.floor(r() * AWNINGS.length)]);
    const a = blockOn(root, w - .4, .1, 1.3, awning, 0, floorY + doorH + .45, hd + .6); a.rotation.x = .3;
    for (let i = -hw + .6; i < hw - .4; i += .8) { const fringe = blockOn(root, .4, .22, .05, awning, i + .2, floorY + doorH + .02, hd + 1.22); fringe.rotation.x = .1; }
  }
  // Upper floors: jettied, timber-framed, windows with warm light at night.
  for (let level = 1; level < storeys; level++) {
    const y = G + (level - 1) * U, dz = jetty * level;
    if (h.enterable) blockOn(root, w, U, d + dz, upperMat, 0, y, dz / 2, 0, solid);
    else blockOn(root, w - .02, U, d - .02 + dz, upperMat, 0, y, dz / 2, 0, solid);
    blockOn(root, w + .1, .24, .18, timber, 0, y - .05, hd + dz + .02);
    if (upperMat === plaster) {
      const posts = Math.max(2, Math.round(w / 1.7));
      for (let i = 0; i <= posts; i++) blockOn(root, .18, U, .1, timber, -hw + .09 + i * (w - .18) / posts, y, hd + dz + .03);
      blockOn(root, w + .1, .16, .1, timber, 0, y + U * .42, hd + dz + .03);
      if (r() < .6) for (let i = 0; i < posts; i += 2) {
        const x0 = -hw + .09 + i * (w - .18) / posts, x1 = -hw + .09 + (i + 1) * (w - .18) / posts;
        beam(root, [x0, y + .1, hd + dz + .05], [x1, y + U * .42, hd + dz + .05], .1, timber);
      }
    }
    const count = Math.max(1, Math.floor(w / 3));
    for (let i = 0; i < count; i++) windowAt(-hw + (i + .5) * w / count, y + 1.1, hd + dz, .95, true, true);
    // Gable-end windows where the side might be seen.
    for (const sx of [-1, 1]) if (r() < .85) { const g = siteGroup(root, sx * (hw + .02), y + 1.1, 0, sx * PI / 2); blockOn(g, .8, 1, .06, glowMaterials.window, 0, 0, 0); blockOn(g, 1, .12, .14, timber, 0, -.1, .04); }
  }
  // Roof: along the street or gable-front, steep, with a chimney (and a dormer on rich houses).
  const roofAngle = .72 + r() * .14, front2 = jetty * (storeys - 1);
  const alongStreet = h.gableFront ? false : w > d * .85 || r() < .55;
  const roof = siteGroup(root, 0, top, front2 / 2, alongStreet ? PI / 2 : 0);
  const span = alongStreet ? (d + front2) / 2 : hw, run = alongStreet ? w : d + front2;
  roofSide(roof, -1, { eaveX: span + .5, eaveY: -.1, ridgeDepth: run + .45, angle: roofAngle, texture: roofTex });
  roofSide(roof, 1, { eaveX: span + .5, eaveY: -.1, ridgeDepth: run + .45, angle: roofAngle, texture: roofTex });
  const gableMat = ['planks', 'planksWeathered'].includes(upperMat) ? 'planksVertical' : upperMat;
  gable(roof, span, 0, run - .1, roofAngle, gableMat);
  if (!alongStreet) {
    const ridge = (span + .5) * Math.tan(roofAngle);
    blockOn(root, .7, .7, .1, glowMaterials.window, 0, top + ridge * .3, hd + front2 + .02);
    beam(root, [-span + .3, top + .1, hd + front2 + .06], [0, top + ridge * .85, hd + front2 + .06], .14, timber);
    beam(root, [span - .3, top + .1, hd + front2 + .06], [0, top + ridge * .85, hd + front2 + .06], .14, timber);
  }
  const chimneyX = (r() - .5) * (w - 2), chimneyZ = -hd * .45;
  blockOn(root, .8, (span + .5) * Math.tan(roofAngle) + 1.4, .8, rich ? any(['bricks', 'brickRed']) : any(['bricks', 'brickRed', 'fieldstone', 'cobble']), chimneyX, top, chimneyZ);
  blockOn(root, 1, .2, 1, 'stone', chimneyX, top + (span + .5) * Math.tan(roofAngle) + 1.4, chimneyZ);
  chimneyMarker(root, chimneyX, top + (span + .5) * Math.tan(roofAngle) + 1.7, chimneyZ);
  if (rich && alongStreet && r() < .7) {
    const dm = siteGroup(root, (r() - .5) * (w - 3), top + .4, hd * .25 + front2 / 2);
    blockOn(dm, 1.5, 1.3, 1.6, upperMat, 0, 0, 0); blockOn(dm, .9, .8, .06, glowMaterials.window, 0, .25, .82);
    pyramidRoof(dm, 1.9, 2, 1.3, .9, roofTex, 3);
  }
  // Life at the door: barrels, crates, a bench, a lantern bracket, a shop sign.
  if (r() < .45) F[r() < .5 ? 'barrel' : 'crate'](root, hw - .7, floorY, hd + .55, r() * PI);
  if (!poor && r() < .25) F.bench(root, -hw + 1.4, floorY, hd + .55, PI);
  if (r() < .3 || shop) { blockOn(root, .12, .12, .7, 'iron', hw - .55, floorY + 2.9, hd + .35); blockOn(root, .34, .45, .34, glowMaterials.lantern, hw - .55, floorY + 2.45, hd + .7); }
  if (h.sign) {
    blockOn(root, .12, .12, 1.1, timber, -hw + .8, floorY + 3.35, hd + .55);
    const s = blockOn(root, .08, .7, .9, tinted('planks', 0xc9b48a), -hw + .8, floorY + 2.6, hd + .95);
    s.userData.label = h.sign;
  }
  root.userData.siteBuilding = { id: h.id, kind, district, storeys, x: h.x, z: h.z, rotation: h.rotation, halfWidth: hw, halfDepth: hd, enterable: !!h.enterable };
  root.userData.doorOutside = { x: doorX, y: floorY, z: hd + 1.3 };
  root.userData.doorInside = { x: doorX, y: floorY, z: hd - 1.6 };
  if (!h.enterable) return { root };
  // The rooms you can enter are furnished for who lives or works there.
  const household = kind === 'home' ? (rich ? { role: 'rich_burgher', wealth: 'rich' } : poor ? { role: 'poor_labourer', wealth: 'poor' } : {}) : {};
  const publicRoom = ['temple', 'tavern'].includes(kind);
  const interior = furnishInterior(root, kind, { width: w - .8, depth: d - .8, floorY, seed: h.id, household,
    sleeping: !publicRoom, cooking: kind !== 'temple', light: false, door: { x: doorX, z: hd - .4 } });
  if (kind === 'temple') {
    blockOn(root, 3.4, .4, 2, 'stoneLight', 0, floorY, -hd + 1.6); blockOn(root, 2.4, 1.1, 1.1, 'ashlar', 0, floorY + .4, -hd + 1.6);
    for (const sx of [-1, 1]) F.candle(root, sx * .9, floorY + 1.5, -hd + 1.6);
    interior.pois.push({ kind: 'shrine', x: 0, y: floorY, z: -hd + 3.2, facing: PI });
  }
  // The door step is walkable too (world.js registerBuilding); floors reach .45 past their edges.
  const steps = front < floorY - .1 ? [{ x: doorX, z: hd + .4, halfWidth: Math.max(0, (doorW + .6) / 2 - .45), halfDepth: 0, y: floorY }] : [];
  const building = { root, door, floor: { halfWidth: hw - .35, halfDepth: hd - .35, y: floorY }, steps, interior };
  ctx.registerBuilding(building, kind);
  root.updateWorldMatrix(true, true);
  for (const [i, p] of interior.pois.entries()) {
    const pos = root.localToWorld(new THREE.Vector3(p.x, p.y ?? floorY, p.z));
    ctx.poi({ ...p, id: `${h.id}_${i}`, x: pos.x, y: pos.y, z: pos.z, facing: (p.facing ?? 0) + h.rotation, house: h.id, ...(kind === 'smithy' ? { job: 'smith' } : {}) });
  }
  const outside = root.localToWorld(new THREE.Vector3(doorX, floorY, hd + 1.3));
  ctx.poi({ id: `${h.id}_door`, kind: 'door', x: outside.x, y: outside.y, z: outside.z, facing: h.rotation, house: h.id });
  return building;
}

// ── Walls, gates, terraces ──────────────────────────────────────────────────────────────────────
function wallRun(ctx, ax, az, bx, bz, height = 9, thickness = 2.6) {
  const len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 9), rot = Math.atan2(bx - ax, bz - az) + PI / 2;
  for (let i = 0; i < n; i++) {
    const t = (i + .5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ctx.heightAt(x, z), seg = len / n + .05;
    const g = siteGroup(ctx.root, x, y, z, rot);
    blockOn(g, seg, height + 4, thickness, 'ashlar', 0, -4, 0);
    blockOn(g, seg, .4, thickness + .3, 'stoneLight', 0, height - .4, 0);
    for (let k = -seg / 2 + .9; k < seg / 2; k += 2.2) blockOn(g, 1.2, 1.1, thickness * .5, 'ashlar', k, height, thickness * .25);
    ctx.addCollider({ x, z, rotation: rot, halfWidth: seg / 2, halfDepth: thickness / 2, bottom: y - 4, top: y + height + 1 });
  }
}
function tower(ctx, x, z, size = 7, height = 13) {
  const y = ctx.heightAt(x, z), g = siteGroup(ctx.root, x, y, z);
  blockOn(g, size, height + 4, size, 'ashlar', 0, -4, 0, 0, { solid: true });
  blockOn(g, size + .5, .5, size + .5, 'stoneLight', 0, height, 0);
  pyramidRoof(g, size + .6, size + .6, height + .5, 4.5, 'slate', 6);
  for (const a of [0, PI / 2, PI, -PI / 2]) { const w = siteGroup(g, Math.sin(a) * (size / 2 + .02), height - 4, Math.cos(a) * (size / 2 + .02), a); blockOn(w, .5, 1.6, .06, 'windowDark', 0, 0, 0); }
}
function gate(ctx, id, x, z, rotation, width = 9, height = 12) {
  const y = ctx.heightAt(x, z), g = siteGroup(ctx.root, x, y, z, rotation), depth = 7, wing = 5;
  g.name = id;
  for (const sx of [-1, 1]) {
    blockOn(g, wing, height + 4, depth, 'ashlar', sx * (width + wing) / 2, -4, 0, 0, { solid: true });
    pyramidRoof(siteGroup(g, sx * (width + wing) / 2, height, 0), wing + .5, depth + .5, 0, 4, 'slate', 5);
    royalBanner(g, sx * (width / 2 + wing / 2), 5.5, depth / 2 + .06);
  }
  blockOn(g, width, height - 6, depth, 'ashlar', 0, 6, 0, 0, { solid: true });
  for (let px = -width / 2 + .5; px < width / 2; px += 1) blockOn(g, .12, 2.6, .12, 'iron', px, 6 - 2.6, depth / 2 + .1);
  ctx.poi({ id: `${id}_patrol`, kind: 'patrol', x: x - Math.sin(rotation) * 6, z: z - Math.cos(rotation) * 6, y, job: 'guard', facing: rotation });
}
// Retaining walls along the terrace steps, open where ramps and stairs climb through.
function terraceWalls(ctx) {
  for (const [i, stepZ] of KRONWACHT.steps.entries()) {
    for (let x = WALL.minX + 3; x < WALL.maxX - 3; x += 4) {
      // A 4-unit piece from (x, step(x)) to (x + 4, step(x + 4)); local x runs along the wall.
      const cx = x + 2, cz = stepZ(cx);
      if (rampDistance(cx, cz) < 1.5 || !insideRing(cx, cz)) continue;
      const low = kronwachtLevel(cx, cz + 3.5), high = kronwachtLevel(cx, cz - 3.5), rot = -Math.atan2(stepZ(x + 4) - stepZ(x), 4);
      const g = siteGroup(ctx.root, cx, low, cz, rot);
      blockOn(g, 4.15, high - low + 1.1, 3, i ? 'ashlarMossy' : 'cobbleMossy', 0, -.6, 0);
      blockOn(g, 4.15, .3, 3.2, 'stoneLight', 0, high - low + .5, 0);
      if ((x | 0) % 12 < 4) for (const k of [-1.3, 1.3]) blockOn(g, .9, .5, .5, 'stoneLight', k, high - low + .8, 0);
      ctx.addCollider({ x: cx, z: cz, rotation: rot, halfWidth: 2.1, halfDepth: 1.5, bottom: low - .6, top: high + .9 });
    }
  }
  // Stairs: steps over the ramp ground, each step walkable.
  for (const r of KRONWACHT.ramps.filter(r => r.stairs)) {
    const [ax, az] = r.a, [bx, bz] = r.b, len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / .8), rot = Math.atan2(bx - ax, bz - az);
    for (let i = 0; i < n; i++) {
      const t = (i + .5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = kronwachtLevel(x, z);
      blockOn(ctx.root, r.width, .45, len / n + .05, 'stone', x, y - .3, z, rot);
      ctx.registerFloor({ x, z, rotation: rot, halfWidth: r.width / 2, halfDepth: len / n / 2, y: y + .15 });
    }
    for (const sx of [-1, 1]) { const ox = Math.cos(rot) * sx * (r.width / 2 + .25), oz = -Math.sin(rot) * sx * (r.width / 2 + .25); beam(ctx.root, [ax + ox, kronwachtLevel(ax, az) + 1, az + oz], [bx + ox, kronwachtLevel(bx, bz) + 1, bz + oz], .16, 'timber'); }
  }
  // Low parapets along the street ramps.
  for (const r of KRONWACHT.ramps.filter(r => !r.stairs)) {
    const [ax, az] = r.a, [bx, bz] = r.b, rot = Math.atan2(bx - ax, bz - az), len = Math.hypot(bx - ax, bz - az);
    for (const sx of [-1, 1]) for (let s = 4; s < len - 4; s += 2) {
      const t = s / len, x = ax + (bx - ax) * t + Math.cos(rot) * sx * (r.width / 2 + .4), z = az + (bz - az) * t - Math.sin(rot) * sx * (r.width / 2 + .4);
      blockOn(ctx.root, .6, .9, 2.05, 'stoneLight', x, ctx.heightAt(x, z) - .2, z, rot);
    }
  }
}

// ── The market and the life in the streets ──────────────────────────────────────────────────────
function stall(ctx, x, z, rotation, id) {
  const r = ctx.random, y = ctx.heightAt(x, z), g = siteGroup(ctx.root, x, y, z, rotation), cloth = tinted('clothRed', AWNINGS[Math.floor(r() * AWNINGS.length)]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) blockOn(g, .16, sz > 0 ? 2.5 : 2.9, .16, 'timber', sx * 1.45, 0, sz * .9);
  blockOn(g, 3.2, .9, 1.1, 'planks', 0, 0, .55, 0, { solid: true });
  const roof = blockOn(g, 3.6, .1, 2.6, cloth, 0, 2.75, 0); roof.rotation.x = -.18;
  for (let i = -1.6; i < 1.7; i += .8) blockOn(g, .4, .25, .05, cloth, i + .2, 2.38, 1.3);
  // Goods on the counter: produce crates, bread, pots, cloth, fish.
  const goods = [['apple', 0xc8443a], ['cabbage', 0x5f9a42], ['carrot', 0xd8822c], ['cloth', AWNINGS[Math.floor(r() * 6)]], ['bread', 0xc8955a], ['fish', 0x9aa8b0]];
  for (let i = 0; i < 3; i++) {
    const [type, color] = goods[Math.floor(r() * goods.length)], gx = -1 + i;
    blockOn(g, .8, .22, .6, 'darkPlanks', gx, .9, .5);
    for (let k = 0; k < 6; k++) blockOn(g, .2, .16, .2, type === 'cloth' ? tinted('clothLinen', color) : tinted('clothLinen', color), gx - .27 + (k % 3) * .27, 1.1, .35 + Math.floor(k / 3) * .27);
  }
  if (propsLoaded()) { // stock behind the counter, a basket display in front of it
    placeProp(g, ['crates', 'barrels', 'sacks'][Math.floor(r() * 3)], -.9, -.9, r() * PI);
    if (r() < .55) placeProp(g, 'produce', .4, 1.7, (r() - .5) * .5);
    else if (r() < .4) placeProp(g, 'pottery', .8, 1.6, r() * PI);
  } else { F.crate(g, -1.2, 0, -.6, r()); F.barrel(g, 1.1, 0, -.5, 0); if (r() < .5) F.grainSack(g, .1, 0, -.7, r()); }
  ctx.poi({ id, kind: 'market', x: x - Math.sin(rotation) * 1.6, z: z - Math.cos(rotation) * 1.6, y, facing: rotation + PI, job: 'merchant', capacity: 1 });
}
function fountain(ctx, x, z) {
  const y = ctx.heightAt(x, z), g = siteGroup(ctx.root, x, y, z);
  for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2, s = siteGroup(g, Math.sin(a) * 2.6, 0, Math.cos(a) * 2.6, a); blockOn(s, 2.3, .9, .5, 'stoneLight', 0, -.1, 0, 0, { solid: true }); }
  blockOn(g, 4.8, .06, 4.8, pixelMaterial('water', { emissive: .15 }), 0, .55, 0, 0, { shadow: false });
  blockOn(g, .8, 2.6, .8, 'ashlar', 0, -.1, 0, 0, { solid: true });
  blockOn(g, 1.6, .3, 1.6, 'stoneLight', 0, 2.3, 0);
  for (const a of [0, PI / 2, PI, -PI / 2]) blockOn(g, .12, .9, .12, pixelMaterial('water', { emissive: .25 }), Math.sin(a) * .7, 1.5, Math.cos(a) * .7);
  ctx.addCollider({ x, z, radius: 2.9, bottom: y - .2, top: y + .9 });
  ctx.poi({ id: `fountain_${x | 0}`, kind: 'well', x: x + 3.4, z, y, facing: -PI / 2 });
}
// Strings of pennants across a street, laundry between houses in the poor quarter.
function lineAcross(ctx, a, b, y, kind) {
  const r = ctx.random, len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.floor(len / .9);
  beam(ctx.root, [a[0], y, a[1]], [b[0], y - .5, b[1]], .05, 'darkPlanks');
  for (let i = 1; i < n; i++) {
    const t = i / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, sag = Math.sin(t * PI) * .7 + t * .5;
    const color = kind === 'laundry' ? [0xe8e2d0, 0xb8c4c8, 0xc9a882, 0x8a9a7a][Math.floor(r() * 4)] : AWNINGS[i % AWNINGS.length];
    const piece = blockOn(ctx.root, kind === 'laundry' ? .7 : .4, kind === 'laundry' ? .8 : .5, .04, tinted('clothLinen', color), x, y - sag - (kind === 'laundry' ? .8 : .5), z);
    piece.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]) + PI / 2;
  }
}

// ── Town wall: an irregular ring that follows the edge of the terraces and climbs the castle rock on
// both sides, where it joins the castle's south towers (city.js). Towers where it turns, three gates.
// The south front bends with the slope: the main gate sits set back between two wall arms that
// stand forward on either side, so anyone at the gate is under fire from both flanks.
const RING = [[1000, -749], [1034, -742], [1068, -740], [1104, -753], [1136, -776], [1163, -806], [1171, -850], [1172, -880], [1168, -930], [1160, -982],
  [1142, -1026], [1110, -1052], [1084, -1080], [1066, -1112], [992, -1116], [966, -1086], [934, -1060], [884, -1048], [852, -1034], [836, -998],
  [830, -950], [829, -905], [832, -860], [834, -822], [843, -790], [870, -766], [902, -751], [936, -741], [968, -743]];
const GATES = { 0: 'kronwacht_suedtor', 7: 'kronwacht_osttor', 21: 'kronwacht_westtor' };
const CASTLE = [13, 14]; // RING[13] → RING[14] is the castle's own south wall
function insideRing(x, z) {
  let inside = false;
  for (let i = 0, j = RING.length - 1; i < RING.length; j = i++) {
    const [xi, zi] = RING[i], [xj, zj] = RING[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
function ringDistance(x, z) {
  let best = Infinity;
  for (let i = 0; i < RING.length; i++) {
    const [ax, az] = RING[i], [bx, bz] = RING[(i + 1) % RING.length], dx = bx - ax, dz = bz - az;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
/** Outward unit normal of the ring at vertex i (average of its two edges). */
function outwardAt(i) {
  const n = RING.length, [px, pz] = RING[(i - 1 + n) % n], [x, z] = RING[i], [qx, qz] = RING[(i + 1) % n];
  let ox = (pz - z) + (z - qz), oz = (x - px) + (qx - x); // perpendicular to the path, pointing out for a clockwise ring
  const cx = 1000, cz = -930;
  if (ox * (x - cx) + oz * (z - cz) < 0) { ox = -ox; oz = -oz; }
  const l = Math.hypot(ox, oz) || 1; return [ox / l, oz / l];
}
function townWall(ctx) {
  const n = RING.length, trim = 9.6;
  for (let i = 0; i < n; i++) {
    if (i === CASTLE[0]) continue;
    let [ax, az] = RING[i], [bx, bz] = RING[(i + 1) % n];
    const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
    // Leave the gate openings free; the gate's wings fill them.
    if (GATES[i]) { ax += ux * trim; az += uz * trim; }
    if (GATES[(i + 1) % n]) { bx -= ux * trim; bz -= uz * trim; }
    wallRun(ctx, ax, az, bx, bz);
    // A flanking tower halfway along a long stretch.
    if (len > 52) { const mx = (RING[i][0] + RING[(i + 1) % n][0]) / 2, mz = (RING[i][1] + RING[(i + 1) % n][1]) / 2; roundTower(ctx, mx, mz, 6.4, 13, true); }
  }
  RING.forEach(([x, z], i) => {
    if (CASTLE.includes(i)) return;
    if (GATES[i]) { const [ox, oz] = outwardAt(i); gate(ctx, GATES[i], x, z, Math.atan2(ox, oz)); return; }
    i % 2 ? tower(ctx, x, z) : roundTower(ctx, x, z, 7.2, 14, true, i % 4 === 0);
  });
}

// ── Places of the town: each finds itself a free plot near where it wants to be.
/** Free rectangle near (x, z): inside the wall, off streets and squares, on one terrace, fairly flat. */
function findPlot(ctx, want, free, inside) {
  for (let ring = 0; ring < 9; ring++) for (let k = 0; k < Math.max(1, ring * 6); k++) {
    const a = k / Math.max(1, ring * 6) * PI * 2, x = want.x + Math.cos(a) * ring * 4, z = want.z + Math.sin(a) * ring * 4;
    const rect = { x, z, rotation: want.rotation, w: want.w, d: want.d };
    if (!inside(x, z, Math.max(want.w, want.d) / 2) || !free(rect, .3)) continue;
    const pts = outline(rect, .1);
    if (pts.some(([px, pz]) => streetDistance(px, pz).d < .3 || plazaDistance(px, pz) < (want.onSquare ? -.2 : .3) || rampDistance(px, pz) < 1)) continue;
    const level = kronwachtTerrace(x, z);
    if (outline(rect).some(([px, pz]) => kronwachtTerrace(px, pz) !== level)) continue;
    const hs = pts.map(([px, pz]) => ctx.heightAt(px, pz));
    if (Math.max(...hs) - Math.min(...hs) > 1.8) continue;
    return { ...rect, y: Math.min(...hs) };
  }
  return null;
}
const stoneMat = name => pixelMaterial(name);
/** Town hall: an open arcade for the market below, two timbered floors, a stepped gable, a bell turret. */
function townHall(ctx, p) {
  const g = siteGroup(ctx.root, p.x, p.y, p.z, p.rotation), w = p.w, d = p.d, hw = w / 2, hd = d / 2;
  g.name = 'kronwacht_rathaus';
  blockOn(g, w + .2, .7, d + .2, 'cobble', 0, -.5, 0);
  blockOn(g, w - 1.4, 4, d - 3, 'ashlar', 0, .2, -1.4, 0, { solid: true });
  for (let x = -hw + .5; x <= hw - .5; x += (w - 1) / 5) { blockOn(g, .9, 4, .9, 'ashlar', x, .2, hd - .6, 0, { solid: true }); blockOn(g, 1.2, .4, 1.2, 'stoneLight', x, 3.8, hd - .6); }
  blockOn(g, w, .5, d, 'stoneLight', 0, 4.2, 0);
  blockOn(g, w + .6, 6.4, d + .6, tinted('plaster', 0xfff4e0), 0, 4.7, 0, 0, { solid: true });
  for (let x = -hw; x <= hw; x += 2) blockOn(g, .22, 6.4, .12, 'timber', x, 4.7, hd + .32);
  for (const y of [4.7, 7.9, 11]) blockOn(g, w + .7, .24, .14, 'timber', 0, y, hd + .33);
  for (let x = -hw + 2; x < hw - 1; x += 3) for (const y of [5.6, 8.8]) blockOn(g, 1.1, 1.6, .08, 'windowWarm', x, y, hd + .36);
  // Stepped gable toward the square and a bell turret on the ridge.
  for (let k = 0; k < 6; k++) blockOn(g, w + .6 - k * (w / 6), 1.1, .7, 'brickRed', 0, 11.1 + k * 1.1, hd + .1);
  const roof = siteGroup(g, 0, 11.1, 0);
  for (const side of [-1, 1]) roofSide(roof, side, { eaveX: hw + .3, eaveY: -.1, ridgeDepth: d + .6, angle: .78, texture: 'slate' });
  gable(roof, hw, 0, d - .1, .78, tinted('plaster', 0xfff4e0));
  const turret = siteGroup(g, 0, 11.1 + hw * .95, 0);
  blockOn(turret, 2.2, 3, 2.2, 'darkPlanks', 0, 0, 0); for (const r of [0, PI / 4]) { const t = siteGroup(turret, 0, 0, 0, r); pyramidRoof(t, 2.8, 2.8, 3, 3.4, 'slate', 5); }
  blockOn(turret, .7, .7, .7, 'brass', 0, 1.2, 0);
  blockOn(g, 1.8, 1.8, .1, 'brass', 0, 9.2, hd + .4); blockOn(g, 1.3, 1.3, .12, tinted('plaster', 0xf0e8d8), 0, 9.45, hd + .42); blockOn(g, .1, .55, .14, 'iron', 0, 9.9, hd + .46);
  royalBanner(g, -hw + 1.5, 6, hd + .42); royalBanner(g, hw - 1.5, 6, hd + .42);
  ctx.poi({ id: 'kw_rathaus', kind: 'market', x: p.x + Math.sin(p.rotation) * (hd + 1.5), z: p.z + Math.cos(p.rotation) * (hd + 1.5), y: p.y, facing: p.rotation + PI, job: 'merchant', capacity: 1 });
}
/** Bell tower beside the temple: tall square shaft, louvred bell openings, an eight-sided spire. */
function bellTower(ctx, p) {
  const g = siteGroup(ctx.root, p.x, p.y, p.z, p.rotation), s = p.w;
  blockOn(g, s + .8, 1.4, s + .8, 'cobbleMossy', 0, -1, 0);
  blockOn(g, s, 22, s, 'ashlar', 0, .2, 0, 0, { solid: true });
  for (const y of [7, 14]) blockOn(g, s + .3, .35, s + .3, 'stoneLight', 0, y, 0);
  for (let k = 0; k < 4; k++) { const a = k * PI / 2, o = siteGroup(g, Math.sin(a) * (s / 2 + .03), 17.5, Math.cos(a) * (s / 2 + .03), a); blockOn(o, 1.6, 2.6, .08, 'windowDark', 0, 0, 0); for (let j = 0; j < 4; j++) blockOn(o, 1.6, .12, .14, 'darkPlanks', 0, .4 + j * .6, .05); }
  blockOn(g, 1.2, 1.2, 1.2, 'brass', 0, 18, 0);
  for (const r of [0, PI / 4]) { const t = siteGroup(g, 0, 0, 0, r); pyramidRoof(t, s + 1, s + 1, 22.2, 11, 'slate', 9); }
  blockOn(g, .2, 2.4, .2, 'iron', 0, 33, 0); blockOn(g, 1.2, .2, .2, 'iron', 0, 34.4, 0);
}
/** The smithy's open forge on the street: hearth with glowing coals, bellows, anvil, quench tub, tools. */
function forgeShed(ctx, p) {
  const g = siteGroup(ctx.root, p.x, p.y, p.z, p.rotation);
  blockOn(g, p.w, .2, p.d, 'cobble', 0, -.05, 0);
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) blockOn(g, .3, 3.3, .3, 'timber', sx * (p.w / 2 - .2), 0, sz * (p.d / 2 - .2), 0, { solid: true });
  block(g, p.w + .8, .2, p.d + .8, 'woodShingle', 0, 3.45, 0, -.18, 0, 0);
  const hearth = siteGroup(g, -p.w / 2 + 1.4, 0, -p.d / 2 + 1.1);
  blockOn(hearth, 2.2, 1, 1.6, 'bricks', 0, 0, 0, 0, { solid: true }); blockOn(hearth, 1.6, .12, 1, pixelMaterial('ember', { emissive: .9 }), 0, 1, 0);
  blockOn(hearth, 1, 4.6, 1, 'bricks', 0, 1, -.3); blockOn(hearth, 1.8, .6, 1.4, 'bricks', 0, 2.2, -.1);
  blockOn(hearth, 1.2, .5, .8, tinted('clothLinen', 0x6a4a32), 1.6, .6, .2, .3);
  makeAnvil(g, () => 0, .6, .4, .4);
  blockOn(g, 1, .7, 1, 'planksVertical', p.w / 2 - .9, 0, -p.d / 2 + 1, 0, { solid: true }); blockOn(g, .8, .05, .8, 'water', p.w / 2 - .9, .66, -p.d / 2 + 1);
  for (let k = 0; k < 5; k++) blockOn(g, .08, .55, .08, 'iron', -p.w / 2 + .9 + k * .35, 1.4, p.d / 2 - .25);
  blockOn(g, 1.9, .12, .12, 'timber', -p.w / 2 + 1.6, 2, p.d / 2 - .25);
  for (let k = 0; k < 3; k++) blockOn(g, .5, .4 - k * .1, .5, tinted('stone', 0x2a2a2a), p.w / 2 - .8 + k * .2, k * .3, p.d / 2 - .8);
}
/** A bakehouse oven: a brick dome against the house, a chimney, bread racks and a stack of faggots. */
function bakeOven(ctx, p) {
  const g = siteGroup(ctx.root, p.x, p.y, p.z, p.rotation);
  for (let k = 0; k < 4; k++) blockOn(g, 3 - k * .6, .55, 3 - k * .6, 'bricks', 0, k * .55, 0, 0, { solid: k === 0 });
  blockOn(g, .9, .8, .1, pixelMaterial('ember', { emissive: .8 }), 0, .2, 1.52); blockOn(g, .7, 3.8, .7, 'bricks', .6, 1.4, -.8); chimneyMarker(g, .6, 5.3, -.8);
  for (const sx of [-1, 1]) { const rack = siteGroup(g, sx * 2.6, 0, .4); for (let y = .5; y < 2; y += .5) { blockOn(rack, 1, .06, .5, 'planks', 0, y, 0); for (let k = -1; k <= 1; k++) blockOn(rack, .26, .14, .2, tinted('hay', 0xc8955a), k * .3, y + .06, 0); } blockOn(rack, .08, 2, .08, 'timber', -.45, 0, 0); blockOn(rack, .08, 2, .08, 'timber', .45, 0, 0); }
  F.firewoodStack(g, 0, 0, -2.2, 0);
}
/** Tanners' yard: open vats of liquor in earth colours, hides stretched on frames, a hide-scraping beam. */
function tannery(ctx, p) {
  const g = siteGroup(ctx.root, p.x, p.y, p.z, p.rotation), liquor = [0x6a4a2a, 0x8a6a3a, 0x4a5a3a, 0x7a3a2a];
  for (let k = 0; k < 6; k++) {
    const vx = -p.w / 2 + 1.4 + (k % 3) * 2, vz = -1.5 + Math.floor(k / 3) * 2.2;
    for (const r of [0, PI / 4]) blockOn(g, 1.5, .8, 1.5, 'planksVertical', vx, 0, vz, r, { solid: r === 0 });
    blockOn(g, 1.3, .05, 1.3, pixelMaterial('water', { tint: liquor[k % 4] }), vx, .72, vz, PI / 8);
  }
  for (let k = 0; k < 3; k++) {
    const fx = p.w / 2 - 1.6, fz = -2 + k * 1.8, frame = siteGroup(g, fx, 0, fz);
    for (const sx of [-.8, .8]) blockOn(frame, .12, 2.2, .12, 'timber', sx, 0, 0); blockOn(frame, 1.8, .12, .12, 'timber', 0, 2.1, 0);
    blockOn(frame, 1.3, 1.5, .05, tinted('clothLinen', [0x9a7a5a, 0x7a5a3a, 0xb89a7a][k]), 0, .5, 0);
  }
  beam(g, [-1, 0, 2.8], [0, .9, 2.8], .25, 'bark');
}
/** Stables by the gate: open stalls under a long roof, hay, troughs, a cart waiting. */
function stables(ctx, p) {
  const g = siteGroup(ctx.root, p.x, p.y, p.z, p.rotation), hw = p.w / 2, hd = p.d / 2;
  blockOn(g, p.w, 3.4, .3, 'planksVertical', 0, 0, -hd + .15, 0, { solid: true });
  for (const sx of [-1, 1]) blockOn(g, .3, 3.4, p.d, 'planksVertical', sx * (hw - .15), 0, 0, 0, { solid: true });
  for (let x = -hw + 3; x < hw; x += 3) { blockOn(g, .2, 1.4, p.d - 1.2, 'planks', x, 0, -.5); blockOn(g, .3, 3.2, .3, 'timber', x, 0, hd - .2); }
  const roof = siteGroup(g, 0, 3.4, 0, PI / 2);
  for (const side of [-1, 1]) roofSide(roof, side, { eaveX: hd + .4, eaveY: -.1, ridgeDepth: p.w + .5, angle: .5, texture: 'thatch' });
  for (let x = -hw + 1.5; x < hw; x += 3) { blockOn(g, 1.6, .5, .6, 'planks', x, 0, -hd + .7); blockOn(g, 1.4, .05, .4, 'water', x, .45, -hd + .7); blockOn(g, 1, .5, .8, 'hay', x + .3, 0, -.2, .3); }
  makeCart(ctx.root, ctx.heightAt, p.x + Math.sin(p.rotation) * (hd + 2.2), p.z + Math.cos(p.rotation) * (hd + 2.2), p.rotation + .4);
}
/** Granary: a tall boarded store with a hoist beam, a pulley and sacks waiting to go up. */
function granary(ctx, p) {
  const g = siteGroup(ctx.root, p.x, p.y, p.z, p.rotation), hd = p.d / 2;
  blockOn(g, p.w + .3, 1, p.d + .3, 'fieldstone', 0, -.4, 0);
  blockOn(g, p.w, 9, p.d, 'planksWeathered', 0, .6, 0, 0, { solid: true });
  for (const y of [3.6, 6.6]) blockOn(g, p.w + .1, .25, p.d + .1, 'timber', 0, y, 0);
  for (const y of [1.2, 4.2, 7.2]) blockOn(g, 1.6, 2, .1, 'door', 0, y, hd + .03);
  const roof = siteGroup(g, 0, 9.6, 0);
  for (const side of [-1, 1]) roofSide(roof, side, { eaveX: p.w / 2 + .3, eaveY: -.1, ridgeDepth: p.d + .6, angle: .8, texture: 'redRoof' });
  gable(roof, p.w / 2, 0, p.d - .1, .8, 'planksWeathered');
  blockOn(g, .3, .3, 2.2, 'timber', 0, 10.4, hd + .9); blockOn(g, .4, .4, .2, 'darkPlanks', 0, 10.1, hd + 1.8);
  beam(g, [0, 10.1, hd + 1.9], [0, 2.2, hd + 1.9], .04, 'clothLinen');
  for (let k = 0; k < 5; k++) F.grainSack(g, -1.4 + (k % 3) * .7, Math.floor(k / 3) * .6, hd + 1.2 + (k % 2) * .4, k);
}
/** Pillory and market cross for the square. */
function pillory(ctx, x, z, rotation) {
  const y = ctx.heightAt(x, z), g = siteGroup(ctx.root, x, y, z, rotation);
  blockOn(g, 2.4, .5, 2.4, 'stoneLight', 0, 0, 0); blockOn(g, .3, 2.6, .3, 'darkPlanks', 0, .5, 0, 0, { solid: true });
  blockOn(g, 1.6, .5, .25, 'darkPlanks', 0, 2.1, 0); for (const k of [-.45, 0, .45]) blockOn(g, .2, .2, .3, 'iron', k, 2.25, 0);
}
function marketCross(ctx, x, z) {
  const y = ctx.heightAt(x, z), g = siteGroup(ctx.root, x, y, z);
  for (let k = 0; k < 3; k++) blockOn(g, 3.4 - k * .9, .4, 3.4 - k * .9, 'stoneLight', 0, k * .4, 0, 0, { solid: k === 0 });
  blockOn(g, .55, 4.2, .55, 'ashlar', 0, 1.2, 0); blockOn(g, 1.9, .5, .5, 'ashlar', 0, 4.2, 0); blockOn(g, .7, .7, .7, 'stoneLight', 0, 5.4, 0);
}
/** Gallows on the rise outside the south gate: the king's justice where every traveller sees it. */
function gallows(ctx, x, z, rotation) {
  const y = ctx.heightAt(x, z), g = siteGroup(ctx.root, x, y, z, rotation);
  blockOn(g, 4, .5, 2.4, 'fieldstone', 0, -.2, 0);
  for (const sx of [-1.6, 1.6]) blockOn(g, .35, 4.6, .35, 'darkPlanks', sx, .3, 0, 0, { solid: true });
  blockOn(g, 4, .35, .35, 'darkPlanks', 0, 4.6, 0); beam(g, [-1.6, 3.6, 0], [-.8, 4.6, 0], .2, 'darkPlanks');
  for (const sx of [-.6, .7]) { beam(g, [sx, 4.6, 0], [sx, 3.5, 0], .05, 'clothLinen'); blockOn(g, .3, .25, .1, 'clothLinen', sx, 3.3, 0); }
  blockOn(g, .9, .9, .9, 'planks', 1.2, .3, .6);
  // The town's notice of the king's justice, nailed to a post by the path up the hill.
  blockOn(g, .15, 1.5, .15, 'timber', -2.8, 0, 1.4, 0, { solid: true }); blockOn(g, .8, .5, .05, 'planksWeathered', -2.8, 1.05, 1.47);
  const c = Math.cos(rotation), s = Math.sin(rotation);
  ctx.marker({ id: 'rabenstein', kind: 'tower', label: 'Rabenstein', x, z, discover: true, radius: 12, xp: 10, readLabel: 'Anschlag lesen',
    read: { x: x - 2.8 * c + 2 * s, z: z + 2.8 * s + 2 * c }, lore: '„Des Königs Recht. Wer hier hängt, hat es gebrochen — oder stand ihm im Weg.“' });
}

// ── Things in the street: what people leave outside their doors and the carts of the day.
// Blockbench props (src/world/props.js); the block-built versions below stay for the Node tests.
function placeProp(g, name, x, z, rotation = 0, solid = true) {
  const prop = propClone(name, { solid });
  if (prop) { prop.position.set(x, -.03, z); prop.rotation.y = rotation; g.add(prop); }
  return prop;
}
// Set flush against the house front: in a clutter group local −z is the wall, +z the street.
function wallProp(g, name, x, rotation = 0, gap = .05) {
  const b = propBounds(name, rotation);
  return b && placeProp(g, name, x, -.5 + gap - b.minZ, rotation);
}
// Leaning on the house front, its top tipped back against the wall.
function leaning(g, name, x, tilt, turn = 0) {
  const prop = propClone(name, { solid: false }), lean = new THREE.Group();
  if (!prop) return null;
  prop.rotation.y = turn; lean.add(prop); g.add(lean);
  lean.rotation.x = -tilt; lean.position.set(x, -.03, -.45 + Math.sin(tilt) * propBounds(name, turn).height);
  return prop;
}
const TAU = PI * 2, along90 = r => (r() < .5 ? 1 : -1) * PI / 2;
const PROP_CLUTTER = {
  0: (g, r) => wallProp(g, 'barrels', 0, r() * TAU),
  1: (g, r) => { wallProp(g, 'crates', 0, (r() - .5) * .5); if (r() < .4) wallProp(g, 'sacks', 1.5, (r() - .5) * .4); },
  2: (g, r) => { wallProp(g, 'sacks', 0, (r() - .5) * .4); if (r() < .3) wallProp(g, 'barrels', 1.6, r() * TAU); },
  3: (g, r) => wallProp(g, 'woodpile', 0, r() < .5 ? 0 : PI),
  4: (g, r) => { wallProp(g, 'bench', 0, 0); if (r() < .5) wallProp(g, 'pottery', 1.5, r() * TAU); },
  5: (g, r) => wallProp(g, 'handcart', 0, along90(r) + (r() - .5) * .25, .15),
  7: (g, r) => { wallProp(g, 'trough', 0, 0, .1); if (r() < .5) wallProp(g, 'barrels', 1.8, r() * TAU); },
  9: (g, r) => { leaning(g, 'ladder', -.4, .26); if (r() < .6) wallProp(g, 'hay', 1.3, (r() - .5) * .3); },
  11: (g, r) => wallProp(g, 'produce', 0, (r() - .5) * .4, .1),
  12: (g, r) => wallProp(g, 'wheelbarrow', 0, along90(r) + (r() - .5) * .3, .1),
  13: (g, r) => wallProp(g, 'hay', 0, (r() - .5) * .3),
  14: (g, r) => wallProp(g, 'pottery', 0, r() * TAU),
  15: (g, r) => wallProp(g, 'sign', 0, (r() - .5) * .4, .6),
  16: (g, r) => { leaning(g, 'cartwheel', 0, .18, PI / 2); if (r() < .5) wallProp(g, 'crates', 1.4, (r() - .5) * .4); },
};
// Without the props the newer kinds fall back to the nearest block-built one.
const BLOCK_KIND = { 11: 1, 12: 5, 13: 9, 14: 8, 15: 4, 16: 0 };
function streetClutter(ctx, x, z, rotation, kind) {
  const r = ctx.random, y = ctx.heightAt(x, z), g = siteGroup(ctx.root, x, y, z, rotation);
  if (propsLoaded() && PROP_CLUTTER[kind]) return PROP_CLUTTER[kind](g, r);
  switch (BLOCK_KIND[kind] ?? kind) {
    case 0: for (let k = 0; k < 2 + Math.floor(r() * 3); k++) F.barrel(g, (k % 2) * .85 - .4, 0, Math.floor(k / 2) * .85, r()); break;
    case 1: F.crate(g, 0, 0, 0, r()); if (r() < .6) F.crate(g, .15, .72, .05, r()); if (r() < .5) F.crate(g, .85, 0, .1, r()); break;
    case 2: for (let k = 0; k < 3 + Math.floor(r() * 3); k++) F.grainSack(g, (k % 3) * .62 - .6, Math.floor(k / 3) * .55, (r() - .5) * .3, r()); break;
    case 3: F.firewoodStack(g, 0, 0, 0, 0); break;
    case 4: F.bench(g, 0, 0, 0, 0); if (r() < .5) F.bucket(g, 1.2, 0, .2, 0); break;
    case 5: { // handcart with a load of turnips or cabbages
      blockOn(g, 1.2, .14, 1.8, 'planks', 0, .55, 0); for (const sx of [-.6, .6]) blockOn(g, .06, .35, 1.8, 'darkPlanks', sx, .69, 0);
      for (const sx of [-.66, .66]) { const wheel = blockOn(g, .1, .7, .7, 'darkPlanks', sx, .05, .3); wheel.rotation.x = .785; }
      for (const sx of [-.4, .4]) beam(g, [sx, .6, -.9], [sx * 1.2, .9, -2], .08, 'timber');
      const load = tinted('clothLinen', [0xd8822c, 0x5f9a42, 0xc8443a, 0xe0d0a0][Math.floor(r() * 4)]);
      for (let k = 0; k < 9; k++) blockOn(g, .26, .2, .26, load, -.36 + (k % 3) * .36, .7, -.5 + Math.floor(k / 3) * .4);
      break;
    }
    case 6: makeCart(ctx.root, ctx.heightAt, x, z, rotation); break;
    case 7: { // trough and bucket
      blockOn(g, 2, .6, .7, 'planksVertical', 0, 0, 0, 0, { solid: true }); blockOn(g, 1.8, .05, .5, 'water', 0, .55, 0); F.bucket(g, 1.3, 0, 0, 0); break;
    }
    case 8: { // flower pots and a broom by the door
      for (let k = 0; k < 3; k++) { blockOn(g, .35, .35, .35, 'bricks', k * .45 - .45, 0, 0); blockOn(g, .3, .25, .3, pixelMaterial(['flowerRed', 'flowerYellow', 'flowerBlue'][k]), k * .45 - .45, .35, 0); }
      F.broom(g, .9, 0, 0, .2); break;
    }
    case 9: { // a ladder leaning on the wall and a basket
      const ladder = siteGroup(g, 0, 0, -.2); ladder.rotation.x = -.25;
      for (const sx of [-.3, .3]) blockOn(ladder, .08, 3.4, .08, 'timber', sx, 0, 0); for (let k = .3; k < 3.3; k += .4) blockOn(ladder, .6, .06, .06, 'timber', 0, k, 0);
      blockOn(g, .55, .4, .55, 'hay', .8, 0, .2); break;
    }
    default: { // a dungheap and straw where a beast stood
      blockOn(g, 1.1, .3, .9, tinted('mud', 0x6a5a3a), 0, -.05, 0); blockOn(g, .6, .2, .5, tinted('mud', 0x5a4a2a), .2, .2, .1); blockOn(g, 1.4, .05, 1.2, 'hay', -.4, 0, .5, .4);
    }
  }
}

export function buildKronwacht(ctx) {
  const r = ctx.random, houses = [], taken = [];
  const inside = (x, z, m = 0) => insideRing(x, z) && ringDistance(x, z) > 4 + m;
  const free = (rect, margin = .02) => taken.every(o => !overlapsRect(rect, o, margin));
  // Who lives where: rich below the castle, the poor quarter in the west of the lower town, the guard
  // district east of the gate, craftsmen on the middle terrace.
  const districtOf = (x, z) => kronwachtTerrace(x, z) === 2 ? 'rich' : kronwachtTerrace(x, z) === 0 && x < 960 ? 'poor' : 'town';
  // Fixed buildings first: they claim the best spots on the squares and streets.
  const specials = [
    { id: 'zur_krone', kind: 'tavern', x: 963, z: -826, rotation: PI / 2 + .06, w: 13, d: 11, storeys: 3, enterable: true, sign: 'Zur Krone' },
    { id: 'kronentempel', kind: 'temple', x: 1063, z: -918, rotation: -PI / 2 - .12, w: 14, d: 16, storeys: 1, enterable: true, gableFront: true },
    { id: 'koenigswache', kind: 'barracks', x: 1048, z: -780, rotation: PI + .2, w: 14, d: 10, storeys: 2, enterable: true, sign: 'Königswache' },
    { id: 'kronenschmiede', kind: 'smithy', x: 1010, z: -953, rotation: PI - .35, w: 10, d: 9, storeys: 2, enterable: true, sign: 'Kronenschmiede' },
    { id: 'handelshaus', kind: 'shop', x: 1023, z: -822, rotation: -PI / 2 + .06, w: 11, d: 10, storeys: 3, enterable: true, sign: 'Handelshaus' },
    { id: 'tuchhaendler', kind: 'shop', x: 1000, z: -845, rotation: -.6, w: 8, d: 9, storeys: 2, enterable: true, sign: 'Tuche' },
  ];
  for (const s of specials) {
    const rect = { x: s.x, z: s.z, rotation: s.rotation, w: s.w, d: s.d };
    taken.push(rect);
    houses.push({ ...s, district: districtOf(s.x, s.z) });
  }
  // The town's working places, each on the free plot nearest to where it belongs.
  const smithy = specials.find(s => s.id === 'kronenschmiede'), beside = (s, lx, lz) => ({ x: s.x + lx * Math.cos(s.rotation) + lz * Math.sin(s.rotation), z: s.z - lx * Math.sin(s.rotation) + lz * Math.cos(s.rotation) });
  const places = [
    { build: townHall, x: 975, z: -849, rotation: .06, w: 16, d: 11 },
    { build: bellTower, x: 1080, z: -906, rotation: -.12, w: 6.5, d: 6.5 },
    { build: forgeShed, ...beside(smithy, 7.6, 1.5), rotation: smithy.rotation, w: 5, d: 4.4 },
    { build: bakeOven, x: 1030, z: -846, rotation: -.6, w: 6.4, d: 5 },
    { build: tannery, x: 884, z: -842, rotation: .4, w: 10, d: 8 },
    { build: stables, x: 1072, z: -778, rotation: PI + .1, w: 15, d: 7 },
    { build: granary, x: 932, z: -778, rotation: PI - .06, w: 8, d: 8 },
  ];
  const placed = [];
  for (const want of places) { const plot = findPlot(ctx, want, free, inside); if (plot) { taken.push(plot); placed.push([want.build, plot]); } }
  const wells = [[1082, -800], [985, -1024], [1112, -846], [905, -820], [1050, -930]].map(([x, z]) => findPlot(ctx, { x, z, rotation: 0, w: 3.4, d: 3.4 }, free, inside)).filter(Boolean);
  wells.forEach(w => taken.push(w));
  // Row houses along every street, both sides, fronts on the street edge.
  for (const st of KRONWACHT.streets) {
    for (const side of [-1, 1]) {
      for (const p of along(st.points, 1)) {
        const district = districtOf(p.x, p.z);
        // Burgage plots: narrow fronts on the street, deep houses behind them.
        const w = district === 'rich' ? 7.4 + r() * 3 : district === 'poor' ? 5.2 + r() * 2.2 : 5.6 + r() * 3, d = 8.2 + r() * 3;
        const nx = -p.tz * side, nz = p.tx * side, off = st.width / 2 + .7 + d / 2;
        const x = p.x + nx * off, z = p.z + nz * off, rotation = Math.atan2(-nx, -nz);
        const rect = { x, z, rotation, w, d };
        if (!inside(x, z, Math.max(w, d) / 2) || !free(rect)) continue;
        const pts = outline(rect, .2);
        if (pts.some(([px, pz]) => { const s = streetDistance(px, pz); return s.d < .25 || plazaDistance(px, pz) < .3 || rampDistance(px, pz) < 1; })) continue;
        // The terrace test takes the true corners: an inset one lets a house hang over the retaining wall.
        const level = kronwachtTerrace(x, z);
        if (outline(rect).some(([px, pz]) => kronwachtTerrace(px, pz) !== level)) continue;
        const heights = pts.map(([px, pz]) => ctx.heightAt(px, pz));
        if (Math.max(...heights) - Math.min(...heights) > 1.6) continue;
        taken.push(rect);
        houses.push({ id: `kw_${houses.length}`, kind: 'home', x, z, rotation, w, d, district,
          storeys: district === 'rich' ? 3 + (r() < .5 ? 1 : 0) : district === 'poor' ? 2 - (r() < .12 ? 1 : 0) : 2 + (r() < .55 ? 1 : 0) + (r() < .1 ? 1 : 0) });
      }
    }
  }
  // Back houses: the plots behind the street rows fill with smaller houses and workshops facing
  // the nearest street, so no block is an empty meadow.
  for (let gx = WALL.minX + 6; gx < WALL.maxX - 6; gx += 6.5) for (let gz = WALL.maxZ - 6; gz > WALL.minZ + 6; gz -= 6.5) {
    const x = gx + (r() - .5) * 3, z = gz + (r() - .5) * 3, sd = streetDistance(x, z);
    if (sd.d < 9 || sd.d > 26 || !inside(x, z, 5) || plazaDistance(x, z) < 4 || rampDistance(x, z) < 4) continue;
    // Face the nearest street point.
    let best = null;
    for (const st of KRONWACHT.streets) for (let i = 1; i < st.points.length; i++) {
      const [ax, az] = st.points[i - 1], [bx, bz] = st.points[i], dx = bx - ax, dz = bz - az, t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      const px = ax + dx * t, pz = az + dz * t, dd = Math.hypot(x - px, z - pz);
      if (!best || dd < best.d) best = { d: dd, px, pz };
    }
    const rotation = Math.atan2(best.px - x, best.pz - z), district = districtOf(x, z);
    const rect = { x, z, rotation, w: 5 + r() * 2.4, d: 6 + r() * 2.2 };
    if (!free(rect, .5) || houses.some(o => Math.hypot(o.x - x, o.z - z) < Math.min(rect.w, rect.d) / 2 + Math.min(o.w, o.d) / 2 + .3)) continue;
    const pts = outline(rect, .2), level = kronwachtTerrace(x, z);
    if (pts.some(([px, pz]) => streetDistance(px, pz).d < 2) || outline(rect).some(([px, pz]) => kronwachtTerrace(px, pz) !== level)) continue;
    const hs = pts.map(([px, pz]) => ctx.heightAt(px, pz));
    if (Math.max(...hs) - Math.min(...hs) > 1.4) continue;
    taken.push(rect);
    houses.push({ id: `kw_${houses.length}`, kind: 'home', back: true, ...rect, district, storeys: district === 'rich' ? 2 + (r() < .5 ? 1 : 0) : 2 });
  }
  // Some ordinary houses can be entered: homes in every quarter, shops along the market streets.
  const homes = houses.filter(h => h.kind === 'home' && !h.back);
  // Only rooms big enough to furnish (the planner needs ~5 × 3.5 inside the walls).
  const roomy = homes.filter(h => h.w >= 6.4 && h.d >= 7.6);
  for (let i = 0; i < roomy.length; i += Math.max(1, Math.floor(roomy.length / 12))) roomy[i].enterable = true;
  for (const h of homes.filter(h => !h.enterable && streetDistance(h.x, h.z).width >= 7 && r() < .22).slice(0, 8)) { h.kind = 'shop'; h.sign = ['Bäckerei', 'Töpferei', 'Kerzen', 'Leder', 'Gewürze', 'Fleischer', 'Seiler', 'Kräuter'][Math.floor(r() * 8)]; }
  for (const h of houses) {
    // Each house stands on the ground at the middle of its street front.
    const fx = h.x + Math.sin(h.rotation) * h.d / 2, fz = h.z + Math.cos(h.rotation) * h.d / 2;
    if (h.back) { try { rowHouse(ctx, { ...h, y: Math.min(...outline(h, .2).map(([px, pz]) => ctx.heightAt(px, pz))) }); } catch (error) { console.warn(`Kronwacht: ${h.id}`, error); } continue; }
    // One odd house must never cost the whole city: it falls back to a closed facade.
    try { rowHouse(ctx, { ...h, y: ctx.heightAt(fx, fz) }); }
    catch (error) { console.warn(`Kronwacht: ${h.id} rebuilt closed`, error); ctx.root.getObjectByName(h.id)?.removeFromParent(); rowHouse(ctx, { ...h, enterable: false, y: ctx.heightAt(fx, fz) }); }
  }
  // The wall ring with its towers and gates, then the terrace walls inside it.
  townWall(ctx);
  terraceWalls(ctx);
  for (const [build, plot] of placed) build(ctx, plot);
  for (const w of wells) makeWell(ctx.root, ctx.heightAt, w.x, w.z);
  gallows(ctx, 962, -714, .4);
  // The market: stalls in a ring and two rows, the fountain, carts, pennants across the square.
  const m = KRONWACHT.plazas[0], mc = Math.cos(m.rotation), ms = Math.sin(m.rotation);
  const local = (lx, lz) => [m.x + lx * mc + lz * ms, m.z - lx * ms + lz * mc];
  let n = 0;
  // Every stall faces the fountain in the middle.
  for (const [lx, lz, rot] of [[-14, -10, 0], [-6, -10, 0], [6, -10, 0], [14, -10, 0], [-14, 11, PI], [-6, 11, PI], [6, 11, PI], [14, 11, PI], [-19, 0, PI / 2], [19, 0, -PI / 2], [-9, 2, PI / 2], [9, -2, -PI / 2]]) {
    const [x, z] = local(lx, lz); stall(ctx, x, z, rot + m.rotation, `markt_${n++}`);
  }
  { const [x, z] = local(0, 1); fountain(ctx, x, z);
    ctx.marker({ id: 'koenigsbrunnen', kind: 'village', label: 'Königsbrunnen', x, z, discover: true, radius: 10, xp: 10, readLabel: 'Brunneninschrift lesen',
      read: { x, z: z + 2.8 }, lore: '„Gestiftet, als das Wasser in die Stadt kam und die Seuche ging. Trink, Fremder — der König zahlt.“' }); }
  { const [x, z] = local(-15, 4.5); marketCross(ctx, x, z); }
  { const [x, z] = local(15, -5); pillory(ctx, x, z, m.rotation); }
  for (const [lx, lz, rot] of [[-21, -15, .4], [20, 14, 2.1]]) {
    const [x, z] = local(lx, lz);
    if (propsLoaded()) { const g = siteGroup(ctx.root, x, ctx.heightAt(x, z), z, rot); placeProp(g, 'handcart', 0, 0, .3); placeProp(g, 'barrels', 1.8, -.4, r() * TAU); placeProp(g, 'sacks', -1.6, .6, r()); }
    else { F.crate(ctx.root, x, ctx.heightAt(x, z), z, rot); F.barrel(ctx.root, x + 1, ctx.heightAt(x + 1, z), z + .6, 0); }
  }
  for (const [a, b] of [[[-22, -17], [22, -17]], [[-22, 17], [22, 17]], [[-22, -17], [22, 17]]]) {
    const pa = local(...a), pb = local(...b); lineAcross(ctx, pa, pb, ctx.heightAt(m.x, m.z) + 6.4, 'pennants');
  }
  // Temple square: trees, benches, the old well.
  const t = KRONWACHT.plazas[1];
  for (const [ox, oz] of [[-9, -7], [-9, 7], [5, -9], [5, 9]]) broadleaf(ctx.root, t.x + ox, ctx.heightAt(t.x + ox, t.z + oz), t.z + oz, .7 + r() * .2, r, r() < .5 ? 'oak' : 'birch');
  fountain(ctx, t.x - 4, t.z);
  for (const oz of [-4, 4]) F.bench(ctx.root, t.x - 10, ctx.heightAt(t.x - 10, t.z + oz), t.z + oz, PI / 2);
  // Herrenplatz below the castle: a statue on a plinth, trees.
  const hp = KRONWACHT.plazas[2], hy = ctx.heightAt(hp.x, hp.z);
  blockOn(ctx.root, 2.4, 1.2, 2.4, 'ashlar', hp.x, hy, hp.z, 0, { solid: true }); blockOn(ctx.root, .9, 2.6, .7, 'stoneLight', hp.x, hy + 1.2, hp.z);
  blockOn(ctx.root, 1.3, .7, .9, 'stoneLight', hp.x, hy + 2.9, hp.z); blockOn(ctx.root, .6, .6, .6, 'stoneLight', hp.x, hy + 3.6, hp.z);
  for (const ox of [-7, 7]) broadleaf(ctx.root, hp.x + ox, ctx.heightAt(hp.x + ox, hp.z), hp.z, .65, r, 'oak');
  // Lanterns along the main way (every other one lit); pennants and laundry across lanes.
  let lanterns = 0;
  for (const st of KRONWACHT.streets.filter(s => s.main)) for (const p of along(st.points, 26)) {
    const x = p.x - p.tz * (st.width / 2 - .3), z = p.z + p.tx * (st.width / 2 - .3);
    if (plazaDistance(x, z) > 1 && inside(x, z)) makeLantern(ctx.root, ctx.heightAt, x, z, (lanterns++ & 1) === 0);
  }
  for (const st of KRONWACHT.streets.filter(s => !s.main)) for (const p of along(st.points, 17)) {
    if (r() < .55) continue;
    const nx = -p.tz, nz = p.tx, half = st.width / 2 + .5, y = ctx.heightAt(p.x, p.z) + 5.2;
    lineAcross(ctx, [p.x + nx * half, p.z + nz * half], [p.x - nx * half, p.z - nz * half], y, districtOf(p.x, p.z) === 'poor' ? 'laundry' : 'pennants');
  }
  // Vineyard terraces on the castle hill below the curtain: dry-stone walls along the contour and
  // rows of vines on stakes, so the slope between the upper town and the castle is worked land.
  for (let z = -1062; z > -1104; z -= 3.4) {
    let run = [];
    const flush = () => {
      if (run.length > 3) for (const x of run) {
        const y = ctx.heightAt(x, z);
        blockOn(ctx.root, 1.75, .7, .4, 'fieldstone', x, ctx.heightAt(x, z + 1.5) - .45, z + 1.5);
        blockOn(ctx.root, .08, 1.4, .08, 'timber', x, y, z);
        blockOn(ctx.root, 1.7, .6 + r() * .15, .4, 'oakLeaves', x, y + .5, z); // touching: one leafy row on the wires
        if (r() < .3) blockOn(ctx.root, .2, .25, .12, tinted('clothLinen', 0x4a2458), x + (r() - .5) * .8, y + .5, z + .2);
        taken.push({ x, z, rotation: 0, w: 1.7, d: 3.4 });
      }
      run = [];
    };
    for (let x = 958; x < 1044; x += 1.7) {
      const ok = inside(x, z, 6) && streetDistance(x, z).d > 4.5 && plazaDistance(x, z) > 3 && free({ x, z, rotation: 0, w: 1.7, d: 3.4 }, .3);
      if (ok) run.push(x); else flush();
    }
    flush();
  }
  // Yards behind the rows: gardens, trees, woodpiles, sheds, carts. Never on a street or in a house.
  for (let x = WALL.minX + 8; x < WALL.maxX - 8; x += 7) for (let z = WALL.maxZ - 8; z > WALL.minZ + 8; z -= 7) {
    const px = x + (r() - .5) * 4, pz = z + (r() - .5) * 4;
    if (streetDistance(px, pz).d < 2.5 || plazaDistance(px, pz) < 2 || rampDistance(px, pz) < 2 || !inside(px, pz, 2)) continue;
    const rect = { x: px, z: pz, rotation: r() * PI, w: 2.4, d: 2.4 };
    if (!free(rect, .4) || Math.abs(KRONWACHT.steps[0](px) - pz) < 3 || Math.abs(KRONWACHT.steps[1](px) - pz) < 3) continue;
    const roll = r(), y = ctx.heightAt(px, pz);
    if (roll < .3) broadleaf(ctx.root, px, y, pz, .55 + r() * .3, r, r() < .7 ? 'oak' : 'birch');
    else if (roll < .45) { for (let k = 0; k < 3; k++) blockOn(ctx.root, 2.2, .18, .5, tinted('dirt', 0x8a6a4a), px, y - .05, pz - .8 + k * .8, rect.rotation); for (let k = 0; k < 6; k++) blockOn(ctx.root, .3, .3, .3, 'oakLeaves', px - .8 + (k % 3) * .8, y + .05, pz - .8 + Math.floor(k / 3) * 1.6, rect.rotation); }
    else if (roll < .55) F.firewoodStack(ctx.root, px, y, pz, rect.rotation);
    else if (roll < .62) { blockOn(ctx.root, 2.4, 2.2, 2, 'planksVertical', px, y, pz, rect.rotation, { solid: true }); blockOn(ctx.root, 2.8, .2, 2.4, 'thatch', px, y + 2.2, pz, rect.rotation); }
    else if (roll < .68) {
      if (propsLoaded()) placeProp(siteGroup(ctx.root, px, y, pz, rect.rotation), ['barrels', 'crates', 'hay', 'wheelbarrow', 'sacks', 'woodpile', 'handcart'][Math.floor(r() * 7)], 0, 0);
      else { F.barrel(ctx.root, px, y, pz, 0); F.crate(ctx.root, px + .9, y, pz + .3, rect.rotation); }
    }
    else continue;
    taken.push(rect);
  }
  // Clutter along the house fronts: barrels, crates, sacks, firewood, benches, handcarts, troughs, pots.
  const doors = houses.filter(h => h.enterable).map(h => [h.x + Math.sin(h.rotation) * (h.d / 2 + 1), h.z + Math.cos(h.rotation) * (h.d / 2 + 1)]);
  for (const st of KRONWACHT.streets) for (const pnt of along(st.points, 5.5)) {
    if (r() < .38) continue;
    const side = r() < .5 ? -1 : 1, nx = -pnt.tz * side, nz = pnt.tx * side, off = st.width / 2 - .55;
    const x = pnt.x + nx * off, z = pnt.z + nz * off;
    if (!inside(x, z, 1) || plazaDistance(x, z) < 1 || rampDistance(x, z) < 2 || doors.some(([dx, dz]) => Math.hypot(dx - x, dz - z) < 2.6)) continue;
    const kind = st.main ? [0, 1, 2, 4, 5, 7, 8, 11, 11, 14, 15][Math.floor(r() * 11)] : Math.floor(r() * 17);
    streetClutter(ctx, x, z, Math.atan2(-nx, -nz), kind === 6 && st.width < 6 ? 5 : kind);
  }
  // Watch on the walls and in the streets.
  for (const [x, z] of [[1000, -760], [994, -805], [1030, -896], [957, -960], [1000, -1046], [1082, -794], [1116, -946], [900, -820]]) ctx.poi({ id: `kw_patrol_${x}_${z}`, kind: 'patrol', x, z, y: ctx.heightAt(x, z), job: 'guard' });
  ctx.marker({ id: 'kronwacht', kind: 'city', label: 'Kronwacht', x: 1000, z: -900 });
  return {};
}

import * as THREE from 'three';
import { block, blockOn, beam } from '../../art/blocks.js';
import { pixelMaterial } from '../../art/pixelTextures.js';
import { makeWell, makeForge, makeAnvil, makeCart, makeLantern } from '../buildings.js';
import { broadleaf } from '../flora.js';
import * as F from '../furniture.js';
import { makeCityBuilding, pyramidRoof, royalBanner, siteGroup } from './cityBuildings.js';
import { rockModule, scree } from '../rocks.js';
import { CASTLE_RING as RING } from '../hemland.js';
import { propClone } from '../props.js';

// Burg Kronwacht crowns the rock at the north end of the city, and its curtain is part of the town
// fortification: the town wall (kronwacht.js) climbs the slope on both sides and joins its south
// towers. An irregular ring of wall follows the edge of the rock, with round towers where it turns;
// the gatehouse faces the city ramp. Inside: the keep, the great hall along the east wall, the chapel,
// stables, the castle forge, the well, a guardhouse, a training yard and a kitchen garden. Crags of
// the castle rock break out of the slope all round below the walls.
const PI = Math.PI;
const tinted = (name, tint) => pixelMaterial(name, { tint });
// The curtain (hemland.js CASTLE_RING) is in castle-local metres, x east, z south toward the town.

function pave(ctx, x, z, width, depth, rotation = 0, y = ctx.heightAt(x, z), material = 'cobble') {
  const slab = blockOn(ctx.root, width, .08, depth, material, x, y - .04, z, rotation, { shadow: false });
  slab.userData.street = { x, z, rotation, halfWidth: width / 2, halfDepth: depth / 2, y: y + .04 };
  return slab;
}
/** Curtain wall from a to b: a battered plinth, the wall, a walkway on top behind merlons on the outer side. */
function curtain(ctx, a, b, outward, height = 11, thickness = 3.2) {
  const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(len / 6)), rot = Math.atan2(b.x - a.x, b.z - a.z) + PI / 2;
  // Which local side (±z) faces out of the castle.
  const side = Math.sign(Math.cos(rot) * outward.z + Math.sin(rot) * outward.x) || 1;
  for (let i = 0; i < n; i++) {
    const t = (i + .5) / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = ctx.heightAt(x, z), seg = len / n + .06;
    const g = siteGroup(ctx.root, x, y, z, rot);
    blockOn(g, seg, 2.2, thickness + 1.2, 'cobbleMossy', 0, -1.6, side * .4);
    blockOn(g, seg, height + 1.6, thickness, i % 3 ? 'ashlar' : 'ashlarMossy', 0, -1, 0);
    blockOn(g, seg, .35, thickness + .4, 'stoneLight', 0, height - .35, 0);
    for (let k = -seg / 2 + .7; k < seg / 2 - .3; k += 2) blockOn(g, 1.1, 1.3, .7, 'ashlar', k, height, side * (thickness / 2 - .35));
    if (i % 2 === 0) blockOn(g, .18, 1, .06, pixelMaterial('stone', { tint: 0x1c1e20 }), 0, height * .55, side * (thickness / 2 + .03));
    ctx.addCollider({ x, z, rotation: rot, halfWidth: seg / 2, halfDepth: thickness / 2, bottom: y - 2, top: y + height + 1.3 });
    ctx.registerFloor({ x, z, rotation: rot, halfWidth: seg / 2, halfDepth: thickness / 2 - .3, y: y + height });
  }
}
/** A round tower: two squared blocks turned against each other, a band, slits, and a cone of slate or a crenellated top. */
export function roundTower(ctx, x, z, size = 7.5, height = 15, roofed = true, flag = false) {
  const y = ctx.heightAt(x, z), g = siteGroup(ctx.root, x, y, z);
  for (const r of [0, PI / 4]) {
    blockOn(g, size + 1.4, 2.4, size + 1.4, 'cobbleMossy', 0, -1.8, 0, r);
    blockOn(g, size, height + 1, size, 'ashlar', 0, -1, 0, r, { solid: r === 0 });
    blockOn(g, size + .5, .4, size + .5, 'stoneLight', 0, height, 0, r);
  }
  for (let k = 0; k < 4; k++) { const a = k * PI / 2 + PI / 8, w = siteGroup(g, Math.sin(a) * size * .53, height * (.35 + (k % 2) * .3), Math.cos(a) * size * .53, a); blockOn(w, .2, 1.3, .06, pixelMaterial('stone', { tint: 0x1c1e20 }), 0, 0, 0); }
  if (roofed) {
    for (const r of [0, PI / 4]) { const roof = siteGroup(g, 0, 0, 0, r); pyramidRoof(roof, size + 1, size + 1, height + .4, size * .85, 'slate', 7); }
    blockOn(g, .14, 3, .14, 'timber', 0, height + size * .8, 0);
    if (flag) { blockOn(g, 1.6, .9, .05, 'clothBlue', .8, height + size * .8 + 2, 0); blockOn(g, 1.6, .12, .06, 'brass', .8, height + size * .8 + 1.9, 0); }
  } else {
    for (let k = 0; k < 8; k++) { const a = k * PI / 4, m = siteGroup(g, Math.sin(a) * (size / 2 - .3), height + .4, Math.cos(a) * (size / 2 - .3), a); blockOn(m, 1.5, 1.2, .8, 'ashlar', 0, 0, 0); }
    ctx.registerFloor({ x, z, rotation: 0, halfWidth: size / 2 - .6, halfDepth: size / 2 - .6, y: y + height + .4 });
  }
  ctx.addCollider({ x, z, radius: size / 2 + .3, bottom: y - 2, top: y + height + 1 });
  return g;
}
/** Twin-towered gatehouse: passage with an iron portcullis half raised, open doors, a room above. */
function gatehouse(ctx, x, z, rotation) {
  const y = ctx.heightAt(x, z), g = siteGroup(ctx.root, x, y, z, rotation), W = 6.4, D = 8;
  g.name = 'kronwacht_castle_gate';
  for (const sx of [-1, 1]) {
    const local = new THREE.Vector3(sx * (W / 2 + 3.4), 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
    roundTower(ctx, x + local.x, z + local.z, 6.8, 15, true, sx > 0);
  }
  blockOn(g, W + .4, 8, D, 'ashlar', 0, 6.2, 0, 0, { solid: true });
  blockOn(g, W + 1, .4, D + .4, 'stoneLight', 0, 14.2, 0);
  for (let k = -W / 2; k <= W / 2; k += 1.6) blockOn(g, .9, 1.1, .7, 'ashlar', k, 14.6, D / 2 - .3);
  // Machicolations over the gate, the portcullis half up, the leaves open against the walls.
  for (let k = -2.4; k <= 2.4; k += 1.2) blockOn(g, .9, .8, .9, 'ashlar', k, 10.2, D / 2 + .3);
  for (let px = -W / 2 + .5; px < W / 2; px += .8) blockOn(g, .12, 3.2, .12, 'iron', px, 3.4, D / 2 - .5);
  for (const py of [3.6, 5.2]) blockOn(g, W - .4, .12, .12, 'iron', 0, py, D / 2 - .5);
  for (const sx of [-1, 1]) { const leaf = blockOn(g, 2.9, 5.4, .2, 'door', sx * (W / 2 - .3), 0, D / 2 - 1.8 - 1.4); leaf.rotation.y = sx * PI / 2; }
  for (const sx of [-1, 1]) blockOn(g, .5, 1.4, .06, 'windowWarm', sx * 1.5, 9.4, D / 2 + .02);
  royalBanner(g, 0, 7.2, D / 2 + .06);
  pave(ctx, x, z, W, D + 2, rotation, y, 'cobble');
  ctx.poi({ id: 'kronwacht_castle_gate_patrol', kind: 'patrol', x: x + Math.sin(rotation) * 6, z: z + Math.cos(rotation) * 6, y, job: 'guard', facing: rotation });
}
/** Open-fronted building against a wall: posts, a sloping roof, a back wall. */
function leanTo(ctx, x, z, rotation, w, d, h, roof = 'redRoof') {
  const y = ctx.heightAt(x, z), g = siteGroup(ctx.root, x, y, z, rotation);
  blockOn(g, w, h + .6, .3, 'planksVertical', 0, -.2, -d / 2, 0, { solid: true });
  for (let k = -w / 2 + .3; k <= w / 2 - .3; k += w / Math.round(w / 3)) blockOn(g, .3, h - .3, .3, 'timber', k, 0, d / 2 - .2, 0, { solid: true });
  block(g, w + .6, .22, d + 1, roof, 0, h + .1, .1, .2, 0, 0);
  return g;
}

/** The Bergfried: tall and slender, the last refuge, entered eight metres up by a timber stair, a
 *  timber hoarding under its steep roof. It is what the town sees of the castle from everywhere. */
function bergfried(ctx, x, z, rotation) {
  const y = ctx.heightAt(x, z), g = siteGroup(ctx.root, x, y, z, rotation), S = 8, H = 30, F = S / 2 + .03;
  blockOn(g, S + 1.6, 3.4, S + 1.6, 'cobbleMossy', 0, -1.8, 0, 0, { solid: true });
  blockOn(g, S, H, S, 'ashlar', 0, 0, 0, 0, { solid: true });
  for (let k = 0; k < 4; k++) { const side = siteGroup(g, 0, 0, 0, k * PI / 2); for (const [hx, hy] of [[-1.6, 12], [1.4, 17], [-1.2, 22], [.6, 26]]) blockOn(side, .3, 1.3, .06, 'windowDark', hx, hy, F); }
  blockOn(g, 1.3, 2.3, .06, 'darkPlanks', 0, 8, F); blockOn(g, 1.7, .3, .2, 'stoneLight', 0, 10.3, F + .08);
  blockOn(g, 2.6, .25, 1.8, 'planks', 0, 7.75, F + .9);
  for (let k = 0; k < 14; k++) { const t = k / 13; blockOn(g, 1.1, .2, .6, 'planks', 4.6 - t * 3.2, t * 7.6, F + 2.2 - t * .9); }
  for (const sx of [.1, 1.2]) beam(g, [4.9 - sx, 0, F + 2.3], [1.6 - sx, 7.75, F + 1.3], .16, 'timber');
  beam(g, [5.3, 1, F + 2.6], [1.9, 8.8, F + 1.7], .08, 'timber');
  // Hoarding on corbels, shutters in each face, the roof and the king's banner on a tall pole.
  for (let k = 0; k < 4; k++) { const side = siteGroup(g, 0, 0, 0, k * PI / 2); for (let c = -3; c <= 3; c += 1.5) blockOn(side, .35, .6, 1.2, 'stoneLight', c, H - .6, F + .3); for (const c of [-2.4, 0, 2.4]) blockOn(side, .9, .9, .06, 'windowDark', c, H + 1.1, S / 2 + 1.04); }
  blockOn(g, S + 2, 3, S + 2, 'darkPlanks', 0, H, 0);
  pyramidRoof(g, S + 2.8, S + 2.8, H + 3, 10, 'slate', 8);
  blockOn(g, .22, 5, .22, 'timber', 0, H + 12, 0); royalBanner(g, 1.15, H + 13.6, 0, PI / 2);
}
// A Blockbench prop if the models are loaded (src/world/props.js), else the block version.
function prop(ctx, name, x, z, rotation, fallback) {
  const p = propClone(name), y = ctx.heightAt(x, z);
  if (!p) return fallback?.(x, y, z);
  p.position.set(x, y - .03, z); p.rotation.y = rotation; ctx.root.add(p);
  return p;
}

export function buildCastle(ctx) {
  const s = ctx.site('castle'), cx = s.x, cz = s.z, r = ctx.random;
  const at = ([lx, lz]) => ({ x: cx + lx, z: cz + lz });
  // ── Castle rock: crags all round below the walls, the town side left open for the ramp.
  for (let k = 0; k < 22; k++) {
    const a = k / 22 * PI * 2 + r() * .12, dist = 51 + r() * 6, x = cx + Math.sin(a) * dist, z = cz + Math.cos(a) * dist;
    if (Math.abs(Math.sin(a) * dist - 16) < 14 && Math.cos(a) > .5) continue; // the ramp climbs here
    const y = ctx.heightAt(x, z), out = a;
    rockModule(ctx.root, r() < .5 ? 'cliffTall' : r() < .5 ? 'cliffWide' : 'cliffCorner', x, y - 1.5, z, out, 1.4 + r() * .7, r, null, false, r() < .5);
    if (r() < .5) scree(ctx.root, x + Math.sin(out) * 4, 0, z + Math.cos(out) * 4, out, 8, r, ctx.heightAt);
  }
  // ── Curtain and towers.
  const pts = RING.map(at);
  for (let i = 0; i < pts.length; i++) {
    if (i === 1) continue; // the gatehouse fills this gap
    const a = pts[i], b = pts[(i + 1) % pts.length], mid = { x: (a.x + b.x) / 2 - cx, z: (a.z + b.z) / 2 - cz }, len = Math.hypot(mid.x, mid.z) || 1;
    curtain(ctx, a, b, { x: mid.x / len, z: mid.z / len });
  }
  pts.forEach((p, i) => { if (i !== 1 && i !== 2) roundTower(ctx, p.x, p.z, i === 6 ? 9 : 7.5, i === 6 ? 19 : 15, i !== 4, i === 0 || i === 3 || i === 6); });
  gatehouse(ctx, cx + 16, cz + 39, 0);
  // ── The keep and the chapel (both entered; story and NPCs know them by these ids).
  const keep = makeCityBuilding(ctx, { id: 'kronwacht_keep', x: cx - 3, z: cz - 12, width: 26, depth: 24, height: 19, kind: 'keep', enterable: true, variant: 2 });
  royalBanner(keep.root, 0, 13, 12.2);
  for (const [px, pz] of [[-11, -10], [11, -10], [-11, 10], [11, 10]]) {
    const t = siteGroup(keep.root, px, 19.2, pz);
    for (const rr of [0, PI / 4]) blockOn(t, 4.2, 5, 4.2, 'ashlar', 0, -2, 0, rr);
    for (const rr of [0, PI / 4]) { const roof = siteGroup(t, 0, 0, 0, rr); pyramidRoof(roof, 4.8, 4.8, 3, 4, 'slate', 6); }
  }
  for (let k = -12; k <= 12; k += 2) for (const side of [-1, 1]) { blockOn(keep.root, 1.1, 1.2, .8, 'ashlar', k, 19.2, side * 11.6); blockOn(keep.root, .8, 1.2, 1.1, 'ashlar', side * 12.6, 19.2, k); }
  blockOn(keep.root, .2, 6, .2, 'timber', 0, 19.2, 0); blockOn(keep.root, 2.4, 1.4, .06, 'clothBlue', 1.2, 23.4, 0); blockOn(keep.root, 2.4, .16, .08, 'brass', 1.2, 23.3, 0);
  for (const [px, pz, rr] of [[0, 12.06, 0], [-6, 12.06, 0], [6, 12.06, 0]]) blockOn(keep.root, 1, 2.2, .06, 'windowWarm', px, 9, pz, rr);
  const chapel = makeCityBuilding(ctx, { id: 'kronwacht_chapel', x: cx - 18, z: cz + 14, width: 12, depth: 14, height: 7, kind: 'chapel', enterable: true, rotation: PI / 2 });
  royalBanner(chapel.root, 3, 3.5, 7.2);
  { const bell = siteGroup(chapel.root, -4, 7, -5); blockOn(bell, 3, 5, 3, 'ashlar', 0, 0, 0); for (const sx of [-1, 1]) blockOn(bell, .3, 1.6, 3.1, 'stoneLight', sx * 1, 5, 0); blockOn(bell, .8, .8, .8, 'brass', 0, 5.2, 0); pyramidRoof(bell, 3.6, 3.6, 6.6, 3.4, 'slate', 5); }
  // ── Great hall along the east wall: tall, many-windowed, a steep slate roof and two chimneys.
  const hall = makeCityBuilding(ctx, { id: 'kronwacht_palas', x: cx + 31, z: cz - 6, width: 24, depth: 11, height: 11, kind: 'hall', rotation: -PI / 2, variant: 2 });
  for (let k = -9; k <= 9; k += 3) { blockOn(hall.root, 1.1, 3.4, .06, 'windowWarm', k, 5.8, 5.56); blockOn(hall.root, 1.5, .3, .3, 'stoneLight', k, 5.6, 5.6); }
  for (const k of [-8, 8]) blockOn(hall.root, 1.4, 5, 1.4, 'bricks', k, 11, -2);
  royalBanner(hall.root, 0, 4, 5.62);
  // ── Stables along the west wall, the forge by the gate, the well, a guardhouse.
  const stable = leanTo(ctx, cx - 39, cz + 8, PI / 2 + .1, 16, 5, 3.4, 'thatch');
  for (let k = -6; k <= 6; k += 4) { blockOn(stable, .2, 1.3, 4.4, 'planks', k + 2, 0, 0); blockOn(stable, 1.8, .5, .7, 'planks', k, 0, -1.8); blockOn(stable, 1.6, .05, .5, 'water', k, .45, -1.8); }
  for (let k = 0; k < 4; k++) blockOn(stable, 1.1, .6, .7, 'hay', -7 + k * .3, k % 2 ? .6 : 0, 1.4, k * .2);
  // The forge glows; its light joins the pool like every other.
  ctx.addLight(makeForge(ctx.root, ctx.heightAt, cx - 6, cz + 29, PI).light);
  makeAnvil(ctx.root, ctx.heightAt, cx - 2.5, cz + 26.5, PI + .3);
  makeWell(ctx.root, ctx.heightAt, cx + 8, cz + 16);
  makeCityBuilding(ctx, { id: 'kronwacht_wachstube', x: cx + 28, z: cz + 27, width: 9, depth: 6, height: 5.5, kind: 'guardhouse', rotation: PI + .1, variant: 1 });
  // ── Bergfried in the north-west corner; the castle kitchen by the great hall; the servants' house on
  // the south wall.
  bergfried(ctx, cx - 35, cz - 15, PI / 2 - .3);
  makeCityBuilding(ctx, { id: 'kronwacht_burgkueche', x: cx + 18, z: cz - 28, width: 10, depth: 7, storeys: 2, kind: 'home', district: 'rich', rotation: .37, variant: 1 });
  makeCityBuilding(ctx, { id: 'kronwacht_gesinde', x: cx - 26, z: cz + 29.5, width: 9, depth: 6, storeys: 3, kind: 'home', district: 'town', rotation: PI + .1 });
  for (const [name, lx, lz, rot] of [['trough', -35, 13, PI / 2], ['hay', -35, 1, PI / 2 + .2], ['wheelbarrow', -33, -3, .4], ['barrels', -10, 25.5, 0], ['woodpile', 8, -32, .37],
    ['sacks', 13, -24, .4], ['produce', 15.5, -22, .2], ['crates', 24, -24.5, .6], ['barrels', 25.5, -21, 0], ['handcart', 8, 31, 1.3], ['pottery', 21, -23, 0], ['bench', 4, 12, .1]]) prop(ctx, name, cx + lx, cz + lz, rot);
  // ── Training yard: dummies and straw targets; a kitchen garden behind the chapel.
  for (const [lx, lz] of [[10, -2], [14, 2], [18, -2]]) {
    const g = siteGroup(ctx.root, cx + lx, ctx.heightAt(cx + lx, cz + lz), cz + lz, r() * .6);
    blockOn(g, .22, 2, .22, 'timber', 0, 0, 0, 0, { solid: true }); blockOn(g, .7, .85, .42, 'clothLinen', 0, 1, 0); blockOn(g, 1.4, .12, .12, 'timber', 0, 1.55, 0); blockOn(g, .36, .36, .3, 'hay', 0, 1.9, 0);
  }
  for (const lz of [-20, -14]) {
    const g = siteGroup(ctx.root, cx + 22, ctx.heightAt(cx + 22, cz + lz), cz + lz, -PI / 2);
    for (const sx of [-.5, .5]) beam(g, [sx, 0, -.3], [sx * .3, 1.9, 0], .1, 'timber');
    blockOn(g, 1.3, 1.3, .3, 'hay', 0, .9, 0); blockOn(g, .8, .8, .06, tinted('clothLinen', 0xd8d0b8), 0, 1.15, .16); blockOn(g, .4, .4, .07, 'clothRed', 0, 1.35, .17);
  }
  for (let k = 0; k < 4; k++) {
    const x = cx - 24 + k * 3.2, z = cz - 30, y = ctx.heightAt(x, z);
    blockOn(ctx.root, 2.4, .2, 5, tinted('dirt', 0x8a6a4a), x, y - .08, z);
    for (let m = 0; m < 6; m++) blockOn(ctx.root, .34, .34, .34, 'oakLeaves', x - .6 + (m % 2) * 1.2, y + .1, z - 2 + Math.floor(m / 2) * 2);
  }
  broadleaf(ctx.root, cx - 30, ctx.heightAt(cx - 30, cz - 22), cz - 22, .8, r, 'oak');
  // ── Life in the ward: carts, barrels, firewood, a cobbled way from the gate to the keep.
  makeCart(ctx.root, ctx.heightAt, cx - 30, cz + 24, .5);
  for (const [lx, lz, kind] of [[-34, 18, 'barrel'], [-33, 19.2, 'barrel'], [-31, 17.6, 'crate'], [24, 31, 'barrel'], [-12, 30, 'crate'], [-10, 31, 'barrel']]) F[kind](ctx.root, cx + lx, ctx.heightAt(cx + lx, cz + lz), cz + lz, r());
  F.firewoodStack(ctx.root, cx - 14, ctx.heightAt(cx - 14, cz + 31), cz + 31, 0);
  for (let k = 0; k < 9; k++) { const t = k / 8, x = cx + 16 - 15 * t, z = cz + 34 - 32 * t; pave(ctx, x, z, 4.2, 4.4, -.44, undefined, 'setts'); }
  // Two lanterns at the gate are the only lights; braziers in the keep add their own.
  for (const [lx, lz] of [[10, 33], [22, 33]]) makeLantern(ctx.root, ctx.heightAt, cx + lx, cz + lz, false);
  keep.root.traverse(o => {
    if (o.userData.furniture !== 'brazier') return;
    const light = new THREE.PointLight(0xffb36a, 5, 16, 2); light.position.y = 2; o.add(light); ctx.addLight(light);
  });
  for (const [i, [lx, lz]] of [[16, 30], [22, -15], [-20, -26]].entries()) ctx.poi({ id: `castle_patrol_${i}`, kind: 'patrol', x: cx + lx, z: cz + lz, y: ctx.heightAt(cx + lx, cz + lz), job: 'guard' });
  // Approach from the end of the city ramp to the gate.
  const road = ctx.road('castle_ramp'), end = road.points[road.points.length - 1];
  const start = [cx + 16, cz + 43.5], length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const rotation = Math.atan2(end[0] - start[0], end[1] - start[1]), count = Math.max(1, Math.ceil(length / .5));
  for (let i = 0; i < count; i++) {
    const t = (i + .5) / count, px = start[0] + (end[0] - start[0]) * t, pz = start[1] + (end[1] - start[1]) * t, y = ctx.heightAt(px, pz);
    pave(ctx, px, pz, 5, length / count, rotation, y);
    ctx.registerFloor({ x: px, z: pz, rotation, halfWidth: 2.5, halfDepth: length / count / 2, y: y + .04 });
  }
  ctx.marker({ id: 'burg_kronwacht', kind: 'castle', label: 'Burg Kronwacht', x: cx, z: cz });
  return {};
}

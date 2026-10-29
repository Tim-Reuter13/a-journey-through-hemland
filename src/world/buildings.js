import * as THREE from 'three';
import { block, blockOn, beam, crossGeometry } from '../art/blocks.js';
import { pixelMaterial, pixelTexture } from '../art/pixelTextures.js';
import { furnishInterior } from './interiors.js';
import { chimneyMarker } from './smoke.js';
import { propClone, propsLoaded } from './props.js';

// Architecture and props, built like Blockbench models: rotated boxes,
// pixel textures, no curved primitives. Every builder returns its root group.
const PI = Math.PI;
const group = (parent, x, y, z, ry = 0, scale = 1) => {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(scale); parent.add(g); return g;
};

// Window glass is shared so the atmosphere can brighten every window at night.
export const glowMaterials = {
  window: pixelMaterial('windowWarm', { emissive: .35 }),
  lantern: pixelMaterial('windowWarm', { emissive: 1.4, tint: 0xffe0b0 }),
};

/** A pitched roof slab whose shingle rows run along the ridge. side = -1 (left) or 1 (right). */
export function roofSide(parent, side, { eaveX, eaveY, ridgeDepth, angle, texture, thickness = .32 }) {
  const length = eaveX / Math.cos(angle) + .25;
  const pivot = new THREE.Group();
  pivot.position.set(side * eaveX / 2, eaveY + eaveX / 2 * Math.tan(angle) + thickness / 2, 0);
  pivot.rotation.z = -side * angle;
  parent.add(pivot);
  block(pivot, ridgeDepth, thickness, length, texture, 0, 0, 0, 0, -side * PI / 2, 0);
  // Fascia board along the eave breaks the slab silhouette.
  block(pivot, .16, .5, ridgeDepth, 'darkPlanks', side * length / 2, -.12, 0);
  return pivot;
}

/** Stepped gable fill: stacked boxes under the roof, Blockbench style. */
export function gable(parent, halfWidth, baseY, depth, angle, texture) {
  const rise = halfWidth * Math.tan(angle), step = .4;
  for (let y = 0; y < rise - .1; y += step) {
    const w = 2 * (halfWidth - (y + step) / Math.tan(angle));
    if (w < .3) break;
    blockOn(parent, w + .2, step, depth, texture, 0, baseY + y, 0);
  }
}

function barrel(parent, x, y, z, scale = 1) {
  const g = group(parent, x, y, z, 0, scale);
  for (const r of [0, PI / 4]) blockOn(g, .78, 1.1, .78, 'planksVertical', 0, 0, 0, r, { solid: r === 0 });
  for (const h of [.2, .82]) for (const r of [0, PI / 4]) blockOn(g, .84, .1, .84, 'iron', 0, h, 0, r);
  blockOn(g, .7, .04, .7, 'planks', 0, 1.1, 0, PI / 8);
  return g;
}

function crate(parent, x, y, z, ry = 0, size = .85) {
  const g = group(parent, x, y, z, ry);
  blockOn(g, size, size, size, 'planks', 0, 0, 0, 0, { solid: true });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) blockOn(g, .12, size + .02, .12, 'darkPlanks', sx * (size / 2 - .04), -.01, sz * (size / 2 - .04));
  return g;
}

function woodpile(parent, x, y, z, ry = 0) {
  const g = group(parent, x, y, z, ry);
  for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) {
    const log = block(g, .34, .34, 1.3, 'bark', (i - (3 - row) / 2) * .36, .17 + row * .32, 0, 0, 0, PI / 4);
    log.userData.solid = row === 0 && i === 0;
  }
  return g;
}

// A wall along local X (length L, centred), split into boxes around rectangular
// openings so doors and windows are real holes. bands: [[y0, y1, texture], …].
function wallWithOpenings(parent, L, T, bands, openings, x, z, ry) {
  const g = group(parent, x, 0, z, ry);
  const cuts = [-L / 2, L / 2, ...openings.flatMap(o => [o.u - o.w / 2, o.u + o.w / 2])].sort((a, b) => a - b);
  for (let i = 0; i < cuts.length - 1; i++) {
    const u0 = cuts[i], u1 = cuts[i + 1], w = u1 - u0;
    if (w < .01) continue;
    const hole = openings.find(o => o.u - o.w / 2 < u0 + .001 && o.u + o.w / 2 > u1 - .001);
    for (const [y0, y1, tex] of bands) {
      const spans = hole ? [[y0, Math.min(y1, hole.y0)], [Math.max(y0, hole.y1), y1]] : [[y0, y1]];
      for (const [a, b] of spans) if (b - a > .01) blockOn(g, w, b - a, T, tex, (u0 + u1) / 2, a, 0, 0, { solid: true });
    }
  }
  return g;
}

// Enterable house: real walls with door and window holes, plank floor, ceiling,
// a hinged door, an interior furnished by interiors.js, and outdoor clutter that
// sits on the actual terrain. Returns { root, door, floor, interior }.
export function makeHouse(scene, heightAt, x, z, rotation = 0, scale = 1, type = 0, { interior = 'home', seed = 1 } = {}) {
  const root = group(scene, x, heightAt(x, z), z, rotation, scale);
  const W = 7.8, D = 6.6, hw = W / 2, hd = D / 2, eave = 4.4, angle = .66, T = .3, floorY = .5;
  // Village houses vary by seed: roof, stone band and plaster are not the same on every house.
  const vary = (list, k) => list[Math.abs(Math.floor(seed * 7.31 + k * 13.7)) % list.length];
  const roofTex = type ? vary(['redRoof', 'clayTile', 'woodShingle'], 1) : vary(['slate', 'woodShingle', 'slate', 'thatch'], 1), base = type ? vary(['cobble', 'fieldstone'], 2) : vary(['ashlar', 'fieldstone', 'sandstone'], 2);
  const wallPlaster = vary(['plaster', 'plaster', 'plasterRough'], 3);
  // Height of the terrain under a local point, relative to the house floor origin.
  const ground = (lx, lz) => { const p = root.localToWorld(new THREE.Vector3(lx, 0, lz)); return heightAt(p.x, p.z) - root.position.y; };
  root.updateMatrixWorld(true);
  // Foundation reaches below the terrain so slopes never show a gap; its top is the floor.
  const lowest = Math.min(ground(-hw, -hd), ground(hw, -hd), ground(-hw, hd), ground(hw, hd), 0);
  blockOn(root, W + .5, floorY - lowest + .9, D + .5, 'cobble', 0, lowest - .9, 0);
  blockOn(root, W - 2 * T, .04, D - 2 * T, 'planks', 0, floorY, 0, 0, { shadow: false });
  // Walls: stone band below, plaster above; door and window holes.
  const bands = [[floorY, 1.7, base], [1.7, eave, wallPlaster]];
  const win = u => ({ u, w: 1.05, y0: 2.25, y1: 3.3 });
  wallWithOpenings(root, W, T, bands, [{ u: 0, w: 1.3, y0: floorY, y1: 3.35 }, win(-2.6), win(2.6)], 0, hd - T / 2, 0);
  wallWithOpenings(root, W, T, bands, [win(0)], 0, -hd + T / 2, PI);
  for (const sx of [-1, 1]) wallWithOpenings(root, D - 2 * T, T, bands, [win(-1.5), win(1.5)], sx * (hw - T / 2), 0, sx * PI / 2);
  // Ceiling with beams; the attic above stays closed.
  blockOn(root, W - 2 * T, .14, D - 2 * T, 'darkPlanks', 0, eave - .14, 0, 0, { shadow: false });
  for (const bx of [-2.4, 0, 2.4]) blockOn(root, .26, .26, D - 2 * T, 'timber', bx, eave - .4, 0);
  // Timber frame outside.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) blockOn(root, .34, eave - floorY + .1, .34, 'timber', sx * hw, floorY - .1, sz * hd);
  for (const y of [1.72, eave - .1]) {
    for (const sz of [-1, 1]) {
      if (sz < 0 || y > 3.5) { blockOn(root, W + .3, .26, .1, 'timber', 0, y - .13, sz * (hd + .05)); continue; }
      for (const sx of [-1, 1]) blockOn(root, hw + .15 - .9, .26, .1, 'timber', sx * (.9 + (hw + .15 - .9) / 2), y - .13, hd + .05);
    }
    for (const sx of [-1, 1]) blockOn(root, .1, .26, D + .3, 'timber', sx * (hw + .05), y - .13, 0);
  }
  for (const sz of [-1, 1]) for (const sx of [-1.45, 1.45]) blockOn(root, .26, eave - 1.85, .1, 'timber', sx, 1.72, sz * (hd + .05));
  for (const sx of [-1, 1]) {
    beam(root, [sx * (hw + .06), 1.85, -hd + .25], [sx * (hw + .06), eave - .25, -2.25], .1, 'timber');
    beam(root, [sx * (hw + .06), 1.85, hd - .25], [sx * (hw + .06), eave - .25, 2.25], .1, 'timber');
  }
  // Windows: glass in the hole, frame and flower box outside.
  const windowAt = (px, pz, ry) => {
    const g = group(root, px, 2.25, pz, ry);
    blockOn(g, 1.05, 1.05, .06, glowMaterials.window, 0, 0, 0);
    blockOn(g, 1.3, .16, .14, 'timber', 0, 1.05, T / 2 + .04); blockOn(g, 1.36, .14, .24, 'timber', 0, -.14, T / 2 + .08);
    blockOn(g, 1.1, .28, .32, 'planks', 0, -.42, T / 2 + .16);
    blockOn(g, 1, .18, .24, type ? 'autumnLeaves' : 'oakLeaves', 0, -.14, T / 2 + .16);
  };
  for (const sx of [-2.6, 2.6]) windowAt(sx, hd - T / 2, 0);
  windowAt(0, -hd + T / 2, PI);
  for (const sx of [-1, 1]) for (const sz of [-1.5, 1.5]) windowAt(sx * (hw - T / 2), sz, sx * PI / 2);
  // Door frame, hinged door, steps down to the actual ground.
  blockOn(root, .22, 2.83, T + .14, 'timber', -.74, floorY, hd - T / 2); blockOn(root, .22, 2.83, T + .14, 'timber', .74, floorY, hd - T / 2);
  blockOn(root, 1.8, .26, T + .16, 'timber', 0, 3.33, hd - T / 2);
  const hinge = group(root, -.65, floorY, hd - T / 2);
  const leaf = blockOn(hinge, 1.3, 2.84, .12, 'door', .65, 0, 0);
  blockOn(hinge, .1, .12, .1, 'iron', 1.12, 1.15, .1);
  const front = ground(0, hd + .8), steps = [];
  // Each step is also a walkable floor (world.js), so feet stand on it instead of sinking through.
  // Floors reach .45 past their edges, hence the smaller halves.
  if (front < floorY - .05) {
    blockOn(root, 1.9, floorY - front + .3, .9, 'stoneLight', 0, front - .3, hd + .45);
    steps.push({ x: 0, z: hd + .45, halfWidth: .5, halfDepth: 0, y: floorY });
    if (floorY - front > .45) {
      blockOn(root, 1.6, (floorY - front) / 2 + .3, .6, 'stone', 0, front - .3, hd + 1.15);
      steps.push({ x: 0, z: hd + 1.15, halfWidth: .35, halfDepth: 0, y: (floorY + front) / 2 });
    }
  }
  // Roof, gables, ridge beam and chimney (above the hearth inside).
  gable(root, hw, eave, D - .2, angle, type ? wallPlaster : 'planksVertical');
  blockOn(root, .7, .7, .14, glowMaterials.window, 0, eave + .9, hd - .04);
  blockOn(root, .7, .7, .14, glowMaterials.window, 0, eave + .9, -hd + .04);
  for (const side of [-1, 1]) roofSide(root, side, { eaveX: hw + .75, eaveY: eave - .5, ridgeDepth: D + 1.2, angle, texture: roofTex });
  const ridgeY = eave - .5 + (hw + .75) * Math.tan(angle);
  blockOn(root, .42, .42, D + 1.3, 'timber', 0, ridgeY + .05, 0);
  blockOn(root, 1, 3.4, 1, 'cobble', 2.2, eave + .4, -2.5);
  blockOn(root, 1.25, .25, 1.25, 'stone', 2.2, eave + 3.8, -2.5);
  chimneyMarker(root, 2.2, eave + 4.15, -2.5);
  // Outdoor clutter, each piece placed on the terrain under it: the Blockbench street props when they
  // are loaded (a woodpile, barrels and crates on the walls, and two of the house's own odds and ends),
  // block-built stand-ins otherwise (Node tests).
  if (propsLoaded()) {
    const put = (name, px, pz, ry) => { const prop = propClone(name); prop.position.set(px, ground(px, pz), pz); prop.rotation.y = ry; root.add(prop); };
    put('woodpile', -hw - .8, -1.2, PI / 2);
    put('barrels', hw + .85, -2.2, -PI / 2);
    put('crates', hw + .9, -.4, -PI / 2 + .15);
    const extras = [['bench', 2.3, hd + .75, PI], ['sacks', -hw - .7, 1.5, PI / 2], ['produce', -2.2, hd + .9, PI], ['wheelbarrow', -hw - 1.3, -3.4, 2.4],
      ['hay', hw + 1.3, 1.6, -PI / 2], ['pottery', hw + .75, 1.2, -PI / 2], ['handcart', -1.2, -hd - 1.7, .25]];
    const first = Math.abs(Math.floor(seed * 3.7)) % extras.length, second = (first + 2 + Math.abs(Math.floor(seed * 1.3)) % 4) % extras.length;
    for (const [name, px, pz, ry] of [extras[first], extras[second]]) put(name, px, pz, ry);
  } else {
    woodpile(root, -hw - .9, ground(-hw - .9, -1.2), -1.2, PI / 2);
    barrel(root, hw + .7, ground(hw + .7, -2.2), -2.2);
    const crateY = ground(hw + .8, -1.1);
    crate(root, hw + .8, crateY, -1.1, .3); crate(root, hw + .75, crateY + .85, -1.25, .9, .6);
  }
  const sign = group(root, hw - .4, 3.4, hd + .6);
  blockOn(sign, .14, .14, 1, 'timber', 0, .5, -.2);
  for (const sz of [-.25, .2]) blockOn(sign, .06, .28, .06, 'iron', 0, .22, sz);
  blockOn(sign, .1, .62, .8, type ? 'clothRed' : 'planks', 0, -.4, -.02);
  const contents = furnishInterior(root, interior, { width: W - 2 * T, depth: D - 2 * T, floorY: floorY + .04, seed });
  return { root, door: { hinge, leaf, open: 0, target: 0 }, floor: { halfWidth: hw - T, halfDepth: hd - T, y: floorY + .04 }, steps, interior: contents };
}

export function makeLantern(scene, heightAt, x, z, bright = true) {
  const g = group(scene, x, heightAt(x, z), z);
  blockOn(g, .3, 3.9, .3, 'timber', 0, -.2, 0, 0, { solid: true });
  blockOn(g, .5, .3, .5, 'cobble', 0, -.1, 0);
  blockOn(g, 1.05, .2, .2, 'timber', .42, 3.45, 0);
  beam(g, [0, 2.9, 0], [.6, 3.45, 0], .14, 'timber');
  blockOn(g, .06, .3, .06, 'iron', .85, 3.15, 0);
  const cage = group(g, .85, 2.55, 0);
  blockOn(cage, .5, .08, .5, 'iron', 0, 0, 0); blockOn(cage, .56, .1, .56, 'iron', 0, .58, 0); blockOn(cage, .3, .12, .3, 'iron', 0, .68, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) blockOn(cage, .06, .58, .06, 'iron', sx * .22, .02, sz * .22);
  blockOn(cage, .36, .48, .36, glowMaterials.lantern, 0, .06, 0, 0, { shadow: false });
  if (bright) { const light = new THREE.PointLight(0xffa853, 7, 13, 2); light.position.set(.85, 2.85, 0); g.add(light); }
  return g;
}

export function makeWell(scene, heightAt, x, z) {
  const g = group(scene, x, heightAt(x, z), z);
  blockOn(g, 3.1, .5, 3.1, 'stone', 0, -.3, 0);
  for (const [w, d, px, pz] of [[2.8, .4, 0, 1.2], [2.8, .4, 0, -1.2], [.4, 2.0, 1.2, 0], [.4, 2.0, -1.2, 0]]) blockOn(g, w, 1.25, d, 'cobble', px, 0, pz);
  for (const [w, d, px, pz] of [[3, .5, 0, 1.2], [3, .5, 0, -1.2], [.5, 2.0, 1.2, 0], [.5, 2.0, -1.2, 0]]) blockOn(g, w, .16, d, 'stoneLight', px, 1.25, pz);
  const water = blockOn(g, 2, .1, 2, pixelMaterial('water', { emissive: .15 }), 0, .7, 0, 0, { shadow: false });
  for (const sz of [-1, 1]) blockOn(g, .3, 4.3, .3, 'timber', 0, .1, sz * 1.2, 0, { solid: true });
  blockOn(g, .22, .22, 2.8, 'timber', 0, 2.75, 0);
  blockOn(g, .5, .5, .5, 'planksVertical', 0, 1.55, .35);
  blockOn(g, .06, 1.1, .06, 'iron', 0, 2.05, .35);
  const roofHalf = 1.25, angle = .6;
  for (const side of [-1, 1]) roofSide(g, side, { eaveX: roofHalf + .35, eaveY: 3.4, ridgeDepth: 3.2, angle, texture: 'redRoof', thickness: .22 });
  blockOn(g, .26, .26, 3.3, 'timber', 0, 3.4 + (roofHalf + .35) * Math.tan(angle) + .05, 0);
  return { root: g, water };
}

export function makeShrine(scene, heightAt, x, z) {
  // Ruined open temple (reference: overgrown stone mausoleum). Platform tops
  // match walkHeightAt in world.js: .215, .615, 1.015.
  const g = group(scene, x, heightAt(x, z), z);
  blockOn(g, 8, 1.215, 8, 'ashlar', 0, -1, 0);
  blockOn(g, 6.8, .4, 6.8, 'ashlarMossy', 0, .215, 0);
  blockOn(g, 5.6, .4, 5.6, 'ashlar', 0, .615, 0);
  const columns = [[-3.1, -3.1], [0, -3.1], [3.1, -3.1], [-3.1, 0], [3.1, 0], [-3.1, 3.1], [3.1, 3.1]];
  columns.forEach(([cx, cz], i) => {
    const broken = i === 4 || i === 5, h = broken ? 2.2 + i * .1 : 4.6;
    blockOn(g, .95, .35, .95, 'stoneLight', cx, .615, cz);
    blockOn(g, .7, h, .7, i % 2 ? 'ashlarMossy' : 'ashlar', cx, .95, cz, 0, { solid: true });
    if (!broken) { blockOn(g, 1, .3, 1, 'stoneLight', cx, .95 + h, cz); blockOn(g, .82, .18, .82, 'stone', cx, 1.25 + h, cz); }
    else block(g, .6, .5, .6, 'stone', cx + .9, .4, cz + .6, .3, .5, .2);
  });
  // Architrave fragments on the back row.
  blockOn(g, 7.2, .5, .9, 'ashlar', 0, 6, -3.1);
  blockOn(g, .9, .5, 3.6, 'ashlarMossy', -3.1, 6, -1.6);
  for (let i = -3; i <= 3; i += 2) blockOn(g, .5, .4, .5, 'stoneLight', i, 6.5, -3.1);
  block(g, 3, .5, .9, 'ashlarMossy', 5.3, .3, 1.4, 0, .9, .08);
  // Altar and the dormant ember crystal.
  blockOn(g, 2.2, 1.3, 1.5, 'stoneLight', 0, 1.015, 0, 0, { solid: true });
  blockOn(g, 2.5, .25, 1.8, 'ashlar', 0, 2.3, 0);
  for (const sx of [-1, 1]) blockOn(g, .3, .5, .3, 'brass', sx * 1, 2.55, 0);
  const crystalMat = pixelMaterial('crystal', { emissive: 1.6 });
  const crystal = new THREE.Group(); crystal.position.set(0, 3.7, 0); g.add(crystal);
  block(crystal, .7, 1.5, .7, crystalMat, 0, 0, 0, 0, PI / 4, 0, { shadow: false });
  block(crystal, .45, .9, .45, crystalMat, .32, -.3, .1, .3, 0, -.4, { shadow: false });
  block(crystal, .4, .8, .4, crystalMat, -.3, -.35, -.1, -.2, .3, .4, { shadow: false });
  const light = new THREE.PointLight(0x58bdda, 15, 17, 2); light.position.set(0, 4, 0); g.add(light);
  // Fallen masonry around the platform.
  for (const [rx, rz, s] of [[4.6, 2.5, .8], [-4.8, -1.4, 1], [3.9, -4.6, .7], [-2.6, 4.9, .6]]) block(g, s, s * .6, s * .8, 'ashlarMossy', rx, s * .2, rz, .2, rx, .15);
  return { root: g, crystal, light };
}

export function makeWatchtower(scene, heightAt, x, z) {
  const g = group(scene, x, heightAt(x, z), z, .3);
  blockOn(g, 6.6, 2, 6.6, 'cobble', 0, -1.4, 0);
  blockOn(g, 6, 7, 6, 'cobbleMossy', 0, .2, 0);
  blockOn(g, 5.6, 4.4, 5.6, 'ashlar', 0, 7.2, 0);
  blockOn(g, 6.4, .5, 6.4, 'stoneLight', 0, 11.5, 0);
  for (let i = -2; i <= 2; i++) for (const side of [-1, 1]) {
    if ((i + side * 3) % 3 === 0) continue;
    blockOn(g, .8, 1.1, .6, 'ashlar', i * 1.3, 12, side * 2.9);
    blockOn(g, .6, 1.1, .8, 'ashlar', side * 2.9, 12, i * 1.3);
  }
  blockOn(g, 1.6, 2.6, .3, pixelMaterial('windowDark'), 0, .2, 3.05);
  for (const [wy, wz] of [[4.6, 3.05], [8.4, -2.85]]) blockOn(g, .5, 1.2, .2, pixelMaterial('windowDark'), 0, wy, wz);
  for (let i = 0; i < 4; i++) block(g, .3, .3, 2.2, 'darkPlanks', -2 + i * 1.3, 11.3, 3.3, .2 * (i % 2), 0, 0);
  for (const [rx, rz, s] of [[3.8, 2.6, 1], [-3.6, 3.4, .8], [2.6, -4, 1.2], [4.4, -1, .7]]) block(g, s, s * .7, s, 'cobble', rx, s * .25, rz, .3, rx, .2, { solid: true });
  return g;
}

export function makeCamp(scene, heightAt, x, z) {
  const g = group(scene, x, heightAt(x, z), z);
  for (let i = 0; i < 8; i++) { const a = i * PI / 4; block(g, .45, .32, .45, 'stone', Math.cos(a) * .95, .1, Math.sin(a) * .95, 0, a, 0); }
  for (let i = 0; i < 4; i++) { const a = i * PI / 2 + .3; block(g, 1.5, .28, .28, 'bark', Math.cos(a) * .25, .3, Math.sin(a) * .25, 0, a, .35); }
  blockOn(g, .9, .1, .9, pixelMaterial('ember', { emissive: 1.2 }), 0, .05, 0, 0, { shadow: false });
  const flameMaterial = new THREE.MeshBasicMaterial({ map: pixelTexture('flame'), alphaTest: .5, side: THREE.DoubleSide, color: 0xffd9a0 });
  const fire = new THREE.Mesh(crossGeometry(1.3, 1.5, 3), flameMaterial); fire.position.y = .1; g.add(fire);
  const light = new THREE.PointLight(0xff8a37, 8, 15, 2); light.position.y = 1.5; g.add(light);
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + .4; block(g, 1.6, .38, .38, 'bark', Math.cos(a) * 2.6, .2, Math.sin(a) * 2.6, 0, -a + PI / 2, 0); }
  // A-frame tents with cloth slabs and a ridge pole.
  for (const [tx, tz, ry] of [[4.2, -4.5, .5], [-5, 2.6, -1.9]]) {
    const tent = group(g, tx, heightAt(x + tx, z + tz) - heightAt(x, z), tz, ry);
    for (const side of [-1, 1]) block(tent, 2.3, .1, 3.2, side < 0 ? 'clothLinen' : pixelMaterial('clothLinen', { tint: 0xd8d0c0 }), side * .8, 1.05, 0, 0, 0, side * -.92, { solid: side < 0 });
    blockOn(tent, .14, 2.2, .14, 'timber', 0, 0, 1.65); blockOn(tent, .14, 2.2, .14, 'timber', 0, 0, -1.65);
    blockOn(tent, .12, .12, 3.6, 'timber', 0, 2.1, 0);
  }
  barrel(g, -2.2, 0, -3.3); crate(g, -3.1, 0, -2.6, .4); crate(g, 3.4, 0, 1.6, -.3, .7);
  const banner = group(g, 1.8, 0, 3.6);
  blockOn(banner, .16, 3.4, .16, 'timber', 0, 0, 0, 0, { solid: true });
  blockOn(banner, .9, .12, .12, 'timber', .35, 3.1, 0);
  blockOn(banner, .7, 1.3, .06, 'clothRed', .4, 1.75, 0);
  return { root: g, fire, light };
}

export function makeCart(scene, heightAt, x, z, ry) {
  const g = group(scene, x, heightAt(x, z), z, ry);
  blockOn(g, 3.3, .3, 1.65, 'planks', 0, 1.1, 0, 0, { solid: true });
  for (const sz of [-1, 1]) blockOn(g, 3.3, .55, .14, 'darkPlanks', 0, 1.4, sz * .78);
  blockOn(g, .14, .55, 1.6, 'darkPlanks', 1.6, 1.4, 0);
  for (const sx of [-1.15, 1.15]) for (const sz of [-1, 1]) {
    const wheel = group(g, sx, .7, sz * .98);
    for (const r of [0, PI / 4]) block(wheel, 1.25, 1.25, .16, 'darkPlanks', 0, 0, 0, 0, 0, r);
    block(wheel, .34, .34, .24, 'iron', 0, 0, 0);
  }
  for (const sz of [-1, 1]) block(g, 2.4, .16, .16, 'timber', -2.6, 1.05, sz * .55, 0, 0, -.12);
  for (let i = 0; i < 3; i++) block(g, .7, .5, .6, 'hay', -.9 + i * .9, 1.5, (i % 2 - .5) * .4, 0, i * .4, 0);
  return g;
}

export function makeFence(scene, heightAt, points) {
  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i], y = heightAt(x, z);
    blockOn(scene, .24, 1.5, .24, 'timber', x, y - .2, z, 0, { solid: true });
    if (!i) continue;
    const [px, pz] = points[i - 1], py = heightAt(px, pz);
    for (const h of [.55, 1.05]) beam(scene, [px, py + h, pz], [x, y + h, z], .14, 'planks');
  }
}

export function makeChest(scene, heightAt, x, z, ry) {
  const g = group(scene, x, heightAt(x, z), z, ry);
  blockOn(g, 1.2, .6, .75, 'darkPlanks', 0, 0, 0, 0, { solid: true });
  blockOn(g, 1.24, .3, .79, 'planks', 0, .6, 0);
  for (const sx of [-.45, .45]) blockOn(g, .1, .92, .82, 'iron', sx, -.01, 0);
  blockOn(g, .2, .26, .06, 'brass', 0, .45, .4);
  return g;
}

export function makeForge(scene, heightAt, x, z, ry) {
  const g = group(scene, x, heightAt(x, z), z, ry);
  blockOn(g, 2.4, 1.2, 1.8, 'cobble', 0, -.2, 0, 0, { solid: true });
  blockOn(g, 1.4, .12, 1, pixelMaterial('ember', { emissive: 1.3 }), 0, 1, 0, 0, { shadow: false });
  blockOn(g, 1.2, 2.6, 1, 'bricks', 0, 1, -.5);
  blockOn(g, .8, 1.4, .8, 'bricks', 0, 3.6, -.5);
  const light = new THREE.PointLight(0xff7a2e, 5, 9, 2); light.position.set(0, 1.6, .3); g.add(light);
  barrel(g, -1.8, 0, .7, .85);
  for (let i = 0; i < 3; i++) block(g, .12, 1.1, .12, 'timber', -1.3 + i * .25, 1.6, -1.15, .2, 0, (i - 1) * .15);
  return { root: g, light };
}

export function makeAnvil(scene, heightAt, x, z, ry) {
  const anvil = group(scene, x, heightAt(x, z), z, ry);
  blockOn(anvil, .6, .5, .5, 'darkPlanks', 0, 0, 0, 0, { solid: true });
  blockOn(anvil, .3, .3, .3, 'iron', 0, .5, 0);
  blockOn(anvil, .9, .26, .36, 'iron', .05, .8, 0);
  block(anvil, .3, .18, .2, 'iron', .58, .92, 0, 0, 0, .3);
  // Where the smith stands: in front of the face, close enough that the hammer lands on it.
  anvil.userData.work = { x: x + Math.sin(ry) * .72, z: z + Math.cos(ry) * .72, facing: ry };
  return anvil;
}

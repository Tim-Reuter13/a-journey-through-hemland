import * as THREE from 'three';
import { block, blockOn, beam, boxGeometry, crossGeometry } from '../../art/blocks.js';
import { pixelMaterial, registerPixelTexture, RAMPS } from '../../art/pixelTextures.js';
import * as F from '../furniture.js';
import { ROADS, RIVERS, LAKES, WATER_LEVEL } from '../hemland.js';

for (const [name, barley] of [['farm_wheat', false], ['farm_barley', true]]) {
  registerPixelTexture(name, p => {
    p.clear();
    for (const x of [2, 6, 10, 14]) {
      const top = barley ? 4 + x % 3 : 2 + x % 3;
      for (let y = top; y < 16; y++) p.set(x, y, RAMPS.thatch[(x + y) % 3]);
      for (let y = top; y < top + 5; y++) {
        p.set(x - 1, y, RAMPS.thatch[3]); p.set(x + 1, y + 1, RAMPS.thatch[2]);
        if (barley) p.set(x - 2, y - 2, RAMPS.thatch[1]);
      }
      p.set(x + 1, 11, '#666b37'); p.set(x + 2, 10, '#666b37');
    }
  }, { cutout: true });
}
registerPixelTexture('farm_cabbage', p => {
  p.clear();
  for (let y = 9; y < 16; y++) for (let x = 2; x < 15; x++) {
    const d = Math.abs(x - 8) + Math.abs(y - 12);
    if (d < 8) p.set(x, y, ['#39472b', '#53623b', '#718053', '#879369'][(x + y * 3) % 4]);
    if (d < 4 && (x === 8 || y === 11)) p.set(x, y, '#9aab78');
  }
}, { cutout: true });

export function point(frame, x, z) {
  const c = Math.cos(frame.rotation || 0), s = Math.sin(frame.rotation || 0);
  return { x: frame.x + x * c + z * s, z: frame.z - x * s + z * c };
}
export function corners(r) {
  return [-1, 1].flatMap(x => [-1, 1].map(z => point(r, x * r.halfWidth, z * r.halfDepth)));
}
export function overlaps(a, b, margin = 0) {
  const aa = corners(a), bb = corners(b);
  for (const angle of [a.rotation || 0, b.rotation || 0]) for (const [x, z] of [[Math.cos(angle), -Math.sin(angle)], [Math.sin(angle), Math.cos(angle)]]) {
    const ap = aa.map(p => p.x * x + p.z * z), bp = bb.map(p => p.x * x + p.z * z);
    if (Math.max(...ap) + margin <= Math.min(...bp) || Math.max(...bp) + margin <= Math.min(...ap)) return false;
  }
  return true;
}
export function nearestLine(line, x, z) {
  let best = { distance: Infinity };
  for (let i = 1; i < line.points.length; i++) {
    const [ax, az] = line.points[i - 1], [bx, bz] = line.points[i], dx = bx - ax, dz = bz - az;
    const length = Math.hypot(dx, dz), t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (length * length || 1)));
    const px = ax + dx * t, pz = az + dz * t, distance = Math.hypot(x - px, z - pz);
    if (distance < best.distance) best = { x: px, z: pz, distance, rotation: Math.atan2(dx, dz), line };
  }
  return best;
}
export function clearOfRoads(ctx, rect, margin = .5) {
  return ROADS.every(authored => {
    const road = ctx.road(authored.id) || authored;
    return road.points.slice(1).every(([bx, bz], i) => {
      const [ax, az] = road.points[i];
      return !overlaps(rect, { x: (ax + bx) / 2, z: (az + bz) / 2, rotation: Math.atan2(bx - ax, bz - az),
        halfWidth: road.width / 2 + margin, halfDepth: Math.hypot(bx - ax, bz - az) / 2 + margin });
    });
  });
}
export function dryFootprint(ctx, rect) {
  return [rect, ...corners(rect)].every(p => ctx.heightAt(p.x, p.z) > WATER_LEVEL + .6
    && RIVERS.every(r => nearestLine(r, p.x, p.z).distance > r.width / 2 + 2)
    && LAKES.every(l => Math.hypot(l.x - p.x, l.z - p.z) > l.radius + 2));
}
export function group(parent, x = 0, y = 0, z = 0, rotation = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotation; parent.add(g); return g;
}
export function groundRange(ctx, rect) {
  const heights = [rect, ...corners(rect)].map(p => ctx.heightAt(p.x, p.z));
  return { low: Math.min(...heights), high: Math.max(...heights) };
}
export function foundation(ctx, root, width, depth, floorY = .15) {
  const rect = { x: root.position.x, z: root.position.z, rotation: root.rotation.y, halfWidth: width / 2, halfDepth: depth / 2 };
  const { low, high } = groundRange(ctx, rect), bottom = low - root.position.y - .45;
  const top = Math.max(floorY, high - root.position.y + .1);
  blockOn(root, width, top - bottom, depth, 'cobble', 0, bottom, 0);
  root.userData.foundation = { ...rect, bottom: bottom + root.position.y, top: top + root.position.y };
  return top;
}
const resizedSprites = new WeakMap();
export function resizeHouse(house, scale) {
  // Bake the size: the shared building registry expects an unscaled local floor.
  const pois = new Set(house.interior.pois);
  house.root.scale.setScalar(1);
  house.root.traverse(o => {
    if (o !== house.root) o.position.multiplyScalar(scale);
    if (o.userData.poi) pois.add(o.userData.poi);
    for (const key of ['footprint', 'solidFootprint']) if (o.userData[key]) {
      const f = o.userData[key];
      o.userData[key] = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === 'number' ? v * scale : v]));
    }
    if (o.userData.physics) for (const key of ['half', 'center']) {
      if (o.userData.physics[key]) o.userData.physics[key] = o.userData.physics[key].map(v => v * scale);
    }
    if (!o.isMesh) return;
    const p = o.geometry.parameters;
    if (o.geometry.type === 'BoxGeometry') o.geometry = boxGeometry(p.width * scale, p.height * scale, p.depth * scale);
    else {
      if (!resizedSprites.has(o.geometry)) resizedSprites.set(o.geometry, new Map());
      const variants = resizedSprites.get(o.geometry);
      if (!variants.has(scale)) variants.set(scale, o.geometry.clone().scale(scale, scale, scale));
      o.geometry = variants.get(scale);
    }
  });
  for (const p of pois) for (const key of ['x', 'y', 'z']) if (Number.isFinite(p[key])) p[key] *= scale;
  for (const key of ['halfWidth', 'halfDepth', 'y']) house.floor[key] *= scale;
  house.root.updateMatrixWorld(true);
}
export function pitchedRoof(root, width, depth, y, texture = 'thatch') {
  const angle = .48, half = width / 2 + .45, rise = half * Math.tan(angle);
  for (const side of [-1, 1]) block(root, half / Math.cos(angle), .25, depth + .9, texture,
    side * half / 2, y + rise / 2, 0, 0, 0, -side * angle);
  for (let h = 0; h < rise; h += .3) {
    const w = Math.max(.1, width - 2 * h / Math.tan(angle));
    for (const z of [-depth / 2, depth / 2]) blockOn(root, w, .3, .2, 'planksVertical', 0, y - .1 + h, z);
  }
  blockOn(root, .25, .25, depth + 1, 'timber', 0, y + rise - .05, 0);
}

export function makeBarn(ctx, { id, site, x, z, rotation, stable = false }) {
  const root = group(ctx.root, x, ctx.heightAt(x, z), z, rotation), w = 7.2, d = 7;
  root.name = id; root.userData.siteBuilding = { id, site, kind: stable ? 'stable' : 'barn', x, z, rotation, halfWidth: 4.1, halfDepth: 4, enterable: false };
  const y = foundation(ctx, root, w, d);
  blockOn(root, w, .08, d, 'planks', 0, y, 0);
  for (const side of [-1, 1]) blockOn(root, .22, 4.4, d, 'planksVertical', side * (w / 2 - .11), y, 0, 0, { solid: true });
  blockOn(root, w, 4.4, .22, 'planksVertical', 0, y, -d / 2 + .11, 0, { solid: true });
  // Closed, unregistered double doors keep the barn out of the house-door system.
  for (const side of [-1, 1]) {
    blockOn(root, 1.8, 4.4, .22, 'planksVertical', side * 2.7, y, d / 2, 0, { solid: true });
    blockOn(root, 1.75, 3.3, .18, 'door', side * .89, y, d / 2 + .02, 0, { solid: true });
    beam(root, [side * .12, y + .3, d / 2 + .13], [side * 1.62, y + 3, d / 2 + .13], .12, 'timber');
    blockOn(root, .1, .35, .12, 'iron', side * .17, y + 1.3, d / 2 + .17);
  }
  blockOn(root, w, 1.1, .25, 'planksVertical', 0, y + 3.3, d / 2);
  for (const a of [-1, 1]) for (const b of [-1, 1]) blockOn(root, .32, 4.55, .32, 'timber', a * w / 2, y, b * d / 2);
  for (let i = 0; i < 4; i++) blockOn(root, 1.65, .9, 1.3, 'hay', -2.4 + i * 1.6, y + .08, -2.4);
  // Fodder piled outside the doors, leaving the centre of the approach clear.
  blockOn(root, 2.8, .8, .7, 'hay', -1.6, y + .08, d / 2 + .7);
  pitchedRoof(root, w + .25, d, y + 4.4);
  return root;
}
export function haystack(ctx, x, z, rotation = 0) {
  const root = group(ctx.root, x, ctx.heightAt(x, z), z, rotation), y = foundation(ctx, root, 2.8, 2.2, .02);
  blockOn(root, 2.8, 1.1, 2.2, 'hay', 0, y, 0, 0, { solid: true });
  blockOn(root, 2.2, .7, 1.7, 'hay', 0, y + 1.1, 0);
  blockOn(root, 1.4, .45, 1.1, 'hay', 0, y + 1.8, 0);
  blockOn(root, .1, 2.8, .1, 'timber', 0, y, 0);
  return root;
}
export function scarecrow(ctx, x, z, rotation = 0) {
  const root = group(ctx.root, x, ctx.heightAt(x, z), z, rotation);
  blockOn(root, .18, 3.2, .18, 'timber', 0, -.3, 0);
  blockOn(root, 2.5, .18, .18, 'timber', 0, 2, 0);
  blockOn(root, .8, .9, .45, 'clothLinen', 0, 1.35, 0);
  for (const s of [-1, 1]) blockOn(root, .7, .32, .38, 'clothLinen', s * .65, 1.85, 0);
  blockOn(root, .5, .55, .5, 'hay', 0, 2.3, 0);
  blockOn(root, .9, .12, .8, 'darkPlanks', 0, 2.85, 0);
  blockOn(root, .5, .3, .5, 'darkPlanks', 0, 2.97, 0);
  return root;
}
const cropGeometry = crossGeometry(1, 1);
export function cropField(ctx, rect, crop = 'wheat', spacing = 1.2) {
  const root = group(ctx.root); root.name = rect.id; root.userData.field = { ...rect, crop };
  for (let x = -rect.halfWidth + .6; x < rect.halfWidth; x += spacing) for (let z = -rect.halfDepth + .6; z < rect.halfDepth; z += 1.1) {
    const p = point(rect, x, z), range = groundRange(ctx, { ...p, rotation: rect.rotation, halfWidth: .425, halfDepth: .45 });
    // Small soil tiles follow the sampled terrain instead of bridging a whole hill.
    const soil = blockOn(root, .85, range.high - range.low + .14, .9, 'dirt', p.x, range.low - .12, p.z, rect.rotation, { shadow: false });
    soil.userData.cropSoil = true;
    const cropMesh = new THREE.Mesh(cropGeometry, pixelMaterial(`farm_${crop}`));
    cropMesh.position.set(p.x, range.high + .025, p.z); cropMesh.rotation.y = rect.rotation;
    cropMesh.receiveShadow = true; root.add(cropMesh);
  }
  return root;
}
export function royalBanner(root, x, y, z, rotation = 0) {
  const banner = F.banner(root, x, y, z, rotation, { cloth: 'clothBlue', mountHeight: 0 });
  blockOn(banner, .56, .12, .04, 'brass', 0, .53, .09);
  for (const s of [-1, 0, 1]) blockOn(banner, .12, s === 0 ? .42 : .3, .04, 'brass', s * .21, .65, .09);
  return banner;
}
export function chicken(ctx, x, z, rotation = 0) {
  const root = group(ctx.root, x, ctx.heightAt(x, z), z, rotation); root.name = 'Huhn';
  for (const x of [-.1, .1]) blockOn(root, .045, .18, .045, 'brass', x, 0, 0);
  blockOn(root, .4, .36, .5, 'clothLinen', 0, .18, 0);
  blockOn(root, .22, .25, .22, 'clothLinen', 0, .48, .23);
  blockOn(root, .12, .09, .18, 'brass', 0, .53, .4);
  blockOn(root, .08, .13, .2, 'clothRed', 0, .73, .23);
  block(root, .25, .25, .18, 'clothLinen', 0, .47, -.3, -.5);
  return root;
}
export function signpost(ctx, x, z, destinations) {
  const root = group(ctx.root, x, ctx.heightAt(x, z), z); root.name = 'Wegweiser';
  blockOn(root, .24, 4.1, .24, 'timber', 0, -.25, 0, 0, { solid: true });
  destinations.forEach(({ label, x: tx, z: tz }, i) => {
    const rotation = Math.atan2(-(tz - z), tx - x), g = group(root, 0, 3.25 - i * .55, 0, rotation);
    g.userData.label = label; g.userData.destination = { x: tx, z: tz };
    blockOn(g, 2, .4, .16, 'planks', .65, 0, 0);
    for (let n = 0; n < 3; n++) blockOn(g, .15, .4 - n * .12, .16, 'planks', 1.72 + n * .15, n * .06, 0);
  });
  root.userData.roadside = true; return root;
}
export function registerLights(ctx, root) {
  const lights = []; root.traverse(o => { if (o.isPointLight) lights.push(o); });
  for (const light of lights) {
    const world = light.getWorldPosition(new THREE.Vector3());
    ctx.addLight(light);
    if (light.parent) light.position.copy(light.parent.worldToLocal(world));
  }
}
export function furniture(root, interior, type, x, y, z, rotation = 0, options = {}) {
  const piece = F[type](root, x, y, z, rotation, { light: false, ...options });
  // Shelf decorations are static; only the explicit loose pieces get physics.
  piece.traverse(o => {
    if (o !== piece && o.userData.physics) {
      delete o.userData.physics; delete o.userData.item; delete o.userData.interact;
    }
  });
  if (piece.userData.poi) {
    const poi = { ...piece.userData.poi };
    if (poi.kind === 'seat') poi.kind = 'tavern_seat';
    if (['tavern_seat', 'table', 'counter', 'hearth', 'bed', 'workstation'].includes(poi.kind)) interior.pois.push(poi);
  }
  if (piece.userData.interact) interior.interactables.push(piece);
  if (piece.userData.physics) interior.loose.push(piece);
  return piece;
}

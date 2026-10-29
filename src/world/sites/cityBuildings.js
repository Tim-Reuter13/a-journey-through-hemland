import * as THREE from 'three';
import { blockOn } from '../../art/blocks.js';
import { pixelMaterial } from '../../art/pixelTextures.js';
import * as F from '../furniture.js';
import { furnishInterior } from '../interiors.js';

const PI = Math.PI;
export function siteGroup(parent, x, y, z, rotation = 0) {
  const root = new THREE.Group(); root.position.set(x, y, z); root.rotation.y = rotation;
  parent.add(root); return root;
}

export function royalBanner(parent, x, y, z, rotation = 0) {
  const g = siteGroup(parent, x, y, z, rotation);
  blockOn(g, 2, 3.2, .08, pixelMaterial('clothBlue', { tint: 0x53699c }), 0, 0, 0);
  blockOn(g, 2.4, .14, .2, 'timber', 0, 3.2, 0);
  blockOn(g, 1.25, .25, .06, 'brass', 0, 1, .08);
  for (const x of [-.5, 0, .5]) blockOn(g, .25, x === 0 ? .85 : .65, .06, 'brass', x, 1.25, .08);
  return g;
}

export function pyramidRoof(parent, width, depth, y, height, texture = 'slate', steps = 6) {
  for (let i = 0; i < steps; i++) {
    const f = 1 - i / steps;
    blockOn(parent, width * f, height / steps, depth * f, texture, 0, y + i * height / steps, 0);
  }
}

// Furniture metadata stays in the building's local frame, as in furnishInterior.
function furnish(root, kind, w, d) {
  const info = root.userData.siteBuilding ?? {};
  const publicRoom = ['temple', 'chapel', 'tavern', 'keep'].includes(kind);
  const household = kind === 'home' && info.district === 'rich' ? { role: 'rich_burgher', wealth: 'rich' } :
    kind === 'home' && info.district === 'poor' ? { role: 'poor_labourer', wealth: 'poor' } : {};
  return furnishInterior(root, kind, { width: w - .7, depth: d - .7, floorY: .12,
    seed: root.name || `${kind}/${root.position.x}/${root.position.z}`, household,
    sleeping: !publicRoom, cooking: !['temple', 'chapel', 'barracks', 'keep'].includes(kind), light: false });
}
/** City shell; door is local +z. Root metadata describes its full footprint and approach. */
export function makeCityBuilding(ctx, { id, x, z, width = 14, depth = 12, rotation = 0,
  storeys = 1, variant = 0, kind = 'home', enterable = false, height, district = 'town' }) {
  const root = siteGroup(ctx.root, x, ctx.heightAt(x, z), z, rotation);
  const w = width, d = depth, hw = w / 2, hd = d / 2, eave = height ?? (storeys * 4 + .5);
  const facade = district === 'rich' ? 'ashlar' : district === 'poor' ? 'planksVertical' : ['plaster', 'planksVertical', 'ashlar'][variant % 3];
  const roof = district === 'poor' && variant % 2 ? 'thatch' : variant % 2 ? 'redRoof' : 'slate';
  const workshop = ['smithy', 'carpenter', 'dyer', 'tanner'].includes(kind) && w >= 10;
  root.name = id;
  root.userData.siteBuilding = { id, kind, district, storeys, x, z, rotation, halfWidth: hw, halfDepth: hd, enterable, workshop };
  root.userData.doorOutside = { x: 0, y: .12, z: hd + 1.2 };
  root.userData.doorInside = { x: 0, y: .12, z: hd - 2 };
  blockOn(root, w, .6, d, 'cobble', 0, -.5, 0);
  let door;
  if (enterable || workshop) {
    const solid = { solid: true }, doorWidth = 2.2, doorHeight = 3.25, t = .35;
    blockOn(root, w, eave, t, facade, 0, .1, -hd + t / 2, 0, solid);
    for (const sx of [-1, 1]) {
      blockOn(root, t, eave, d - t * 2, facade, sx * (hw - t / 2), .1, 0, 0, solid);
    }
    const openings = workshop ? [[-hw + .5, -1.7], [-doorWidth / 2, doorWidth / 2]] : [[-doorWidth / 2, doorWidth / 2]];
    let edge = -hw;
    for (const [a, b] of openings) {
      blockOn(root, a - edge, eave, t, facade, (a + edge) / 2, .1, hd - t / 2, 0, solid);
      blockOn(root, b - a, eave - doorHeight, t, facade, (a + b) / 2, .1 + doorHeight, hd - t / 2, 0, solid);
      edge = b;
    }
    blockOn(root, hw - edge, eave, t, facade, (hw + edge) / 2, .1, hd - t / 2, 0, solid);
    const hinge = siteGroup(root, -doorWidth / 2, .12, hd - .18);
    const leaf = blockOn(hinge, doorWidth, doorHeight - .03, .14, 'door', doorWidth / 2, 0, 0);
    if (!enterable) leaf.userData.solid = true;
    door = { hinge, leaf, open: 0, target: 0 };
    blockOn(root, w - .7, .02, d - .7, 'planks', 0, .1, 0);
    blockOn(root, w, .2, d, 'timber', 0, eave, 0, 0, solid);
    if (workshop) {
      const bay = (-hw + .5 - 1.7) / 2;
      blockOn(root, hw - 2.2, 1.05, .8, 'planks', bay, .12, hd - .7, 0, solid);
      F[kind === 'smithy' ? 'anvil' : 'bucket'](root, bay, 1.17, hd - .7);
      blockOn(root, hw - 1.7, .12, 1.5, roof, bay, 3.5, hd + .2);
    }
  } else {
    blockOn(root, w, eave, d, facade, 0, .1, 0, 0, { solid: true });
    blockOn(root, 2, 3.2, .12, 'door', 0, .12, hd + .06);
  }
  // Front jetty stops at the party walls; neighbouring row houses share roof edges.
  for (let level = 1; level < storeys; level++) {
    blockOn(root, w, .28, d + .5, 'timber', 0, level * 4 + .1, .25);
    blockOn(root, w, 3.72, .5, facade, 0, level * 4 + .38, hd + .25);
    blockOn(root, w, .18, .15, 'timber', 0, level * 4 + 3.9, hd + .56);
  }
  for (const sx of [-1, 1]) blockOn(root, .22, eave, .2, 'timber', sx * (hw - .14), .1, hd + .1);
  blockOn(root, w, .22, .2, 'timber', 0, eave - .15, hd + .1);
  for (const sx of [-1, 1]) {
    if (!workshop || sx > 0) blockOn(root, 1.1, 1.3, .1, 'windowDark', sx * w * .28, 2, hd + .06);
    for (let level = 1; level < storeys; level++) blockOn(root, 1.2, 1.5, .1,
      pixelMaterial('windowWarm', { emissive: .35 }), sx * w * .28, level * 4 + 1.4, hd + .56);
  }
  // Pitched silhouette made entirely from abutting box courses.
  for (let i = 0; i < 5; i++) {
    const sag = district === 'poor' ? .08 * i : 0;
    blockOn(root, w * (1 - i / 5), .6, d + (storeys > 1 ? .5 : 0), roof, sag, eave + .1 + i * (.6 - (district === 'poor' ? .07 : 0)), storeys > 1 ? .25 : 0);
  }
  blockOn(root, .7, 4.1, .8, 'bricks', hw - 1.5, eave - .2, -hd + 1.4);
  blockOn(root, .9, .18, 1, 'stone', hw - 1.5, eave + 3.9, -hd + 1.4);
  if (district !== 'town') {
    blockOn(root, .12, .12, 1, 'iron', hw - .9, 3.5, hd + .5);
    blockOn(root, .35, .5, .35, pixelMaterial('windowWarm', { emissive: .8 }), hw - .9, 2.95, hd + .85);
    F[variant % 2 ? 'crate' : 'barrel'](root, -hw + 1, .12, hd + .65);
    if (district === 'rich') {
      blockOn(root, 1.6, .25, .45, 'planks', w * .28, 5.15, hd + .7);
      blockOn(root, 1.4, .25, .35, 'oakLeaves', w * .28, 5.4, hd + .7);
    }
  }
  if (kind !== 'home') {
    blockOn(root, .14, .8, .14, 'iron', hw - 1.4, 3.3, hd + .7);
    const sign = blockOn(root, 1.6, .7, .12, 'clothBlue', hw - 1.4, 2.6, hd + .7);
    sign.userData.label = { tavern: 'Zur Krone', temple: 'Kronentempel', barracks: 'Königswache', stables: 'Stallungen',
      smithy: 'Kronenschmiede', carpenter: 'Zimmerei', dyer: 'Färberei', tanner: 'Gerberei', shop: 'Handelshaus', keep: 'Königshalle', chapel: 'Burgkapelle' }[kind] ?? kind;
  }
  if (!enterable) return { root };
  const interior = furnish(root, kind, w, d);
  const building = { root, door, floor: { halfWidth: hw - .35, halfDepth: hd - .35, y: .12 }, interior };
  ctx.registerBuilding(building);
  root.updateWorldMatrix(true, true);
  for (const [i, p] of interior.pois.entries()) {
    const pos = root.localToWorld(new THREE.Vector3(p.x, p.y ?? .12, p.z));
    ctx.poi({ ...p, id: `${id}_${i}`, x: pos.x, y: pos.y, z: pos.z, facing: (p.facing ?? 0) + rotation, house: id,
      ...(kind === 'smithy' ? { job: 'smith' } : {}) });
  }
  const outside = root.localToWorld(new THREE.Vector3(0, .12, hd + 1.2));
  ctx.poi({ id: `${id}_door`, kind: 'door', x: outside.x, y: outside.y, z: outside.z, facing: rotation, house: id });
  return building;
}

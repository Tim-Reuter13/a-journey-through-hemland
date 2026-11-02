// Hitbox audit: builds the sites the way the world does (without a browser) and lists every solid-looking part that
// nothing collides with — something you can see standing on the ground, knee-high or taller, not foliage, cloth or a
// roof — grouped by site and material. Run: node scripts/audit_hitboxes.mjs [site]
import * as THREE from 'three';
import { SITES, ROADS, kronwachtLevel } from '../src/world/hemland.js';
import { createHeightfield } from '../src/world/heightfield.js';

globalThis.ImageData ??= class { constructor(data, width, height) { Object.assign(this, { data, width, height }); } };
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ({ putImageData() {} }) }) };
const { collidersFrom } = await import('../src/world/navigation.js');
const field = createHeightfield();
const SOFT = /Leaves|Grass|fern|reeds|flower|thatch|clothLinen|cloth|water|glass|window|flame|ember|smoke|hay|rope|straw|carpet|rug|banner|curtain|leaf|moss|Pine/i;

const BUILDERS = {
  kronwacht: ['./sites/kronwacht.js', 'buildKronwacht', kronwachtLevel],
  castle: ['./sites/city.js', 'buildCastle', field.heightAt],
  countryside: ['./sites/countryside.js', 'buildCountryside', field.heightAt],
  landmarks: ['./sites/landmarks.js', 'buildLandmarks', field.heightAt],
  caveMouths: ['./sites/caveMouths.js', 'buildCaveMouths', field.heightAt],
};
const only = process.argv[2];
for (const [site, [file, fn, heightAt]] of Object.entries(BUILDERS)) {
  if (only && only !== site) continue;
  let seed = 7;
  const ctx = {
    root: new THREE.Group(), buildings: [], floors: [], colliders: [], pois: [], markers: [], lights: [],
    heightAt, random: () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296),
    site: id => SITES[id], road: id => ROADS.find(r => r.id === id), roadAt: () => null, field,
    registerBuilding(b, kind) { this.buildings.push({ ...b, kind }); }, registerFloor(f) { this.floors.push(f); },
    addCollider(c) { this.colliders.push(c); }, addLight(l) { this.lights.push(l); }, marker(m) { this.markers.push(m); }, poi(p) { this.pois.push(p); }, tie() {},
  };
  const mod = await import(new URL(`../src/world/${file.slice(2)}`, import.meta.url));
  try { mod[fn](ctx); } catch (error) { console.log(`${site}: failed to build (${error.message})`); continue; }
  ctx.root.updateMatrixWorld(true);
  const colliders = [...ctx.colliders, ...collidersFrom(ctx.root)];
  const houses = [];
  ctx.root.traverse(o => { if (o.userData.siteBuilding) houses.push(o.userData.siteBuilding); });
  const inside = (c, x, z, y0, y1) => {
    if (c.bottom !== undefined && (y1 < c.bottom || y0 > c.top)) return false;
    if (c.radius !== undefined) return Math.hypot(x - c.x, z - c.z) < c.radius + .05;
    const cos = Math.cos(c.rotation || 0), sin = Math.sin(c.rotation || 0), dx = x - c.x, dz = z - c.z;
    return Math.abs(dx * cos - dz * sin) < c.halfWidth + .05 && Math.abs(dx * sin + dz * cos) < c.halfDepth + .05;
  };
  const box = new THREE.Box3(), size = new THREE.Vector3(), mid = new THREE.Vector3(), groups = new Map();
  let solidLooking = 0;
  ctx.root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material, name = m?.name || '';
    if (!m || m.transparent || m.alphaTest > 0 || SOFT.test(name) || SOFT.test(o.name)) return;
    box.setFromObject(o); box.getSize(size); box.getCenter(mid);
    if (size.y < .5 || size.x > 8 || size.z > 8 || Math.max(size.x, size.z) < .2) return;
    const ground = heightAt(mid.x, mid.z);
    if (box.min.y > ground + 1.6 || box.max.y < ground + .45) return; // overhead (a roof, a sign) or flat on the ground
    if (houses.some(h => inside({ ...h, bottom: undefined }, mid.x, mid.z))) return; // part of a building (its walls collide)
    solidLooking++;
    const y0 = Math.max(box.min.y, ground), y1 = Math.min(box.max.y, ground + 2.4);
    // Covered if a collider takes the middle, or at least two of the four quarter points.
    const pts = [[0, 0], [-.25, -.25], [.25, -.25], [-.25, .25], [.25, .25]].map(([u, v]) => [mid.x + u * size.x, mid.z + v * size.z]);
    const hit = pts.map(([x, z]) => colliders.some(c => inside(c, x, z, y0, y1)));
    if (hit[0] || hit.filter(Boolean).length >= 2) return;
    let owner = ''; for (let p = o; p && p !== ctx.root; p = p.parent) if (p.name && !p.name.startsWith('pixel')) { owner = p.name; break; }
    const key = `${owner || '?'} · ${name.replace(/^pixel:/, '').split(':')[0]} · ${size.x.toFixed(1)}×${size.y.toFixed(1)}×${size.z.toFixed(1)}`;
    const g = groups.get(key) || { count: 0, at: [mid.x.toFixed(0), mid.z.toFixed(0)] }; g.count++; groups.set(key, g);
  });
  const list = [...groups.entries()].sort((a, b) => b[1].count - a[1].count);
  console.log(`\n${site}: ${solidLooking} solid-looking parts, ${list.reduce((s, [, g]) => s + g.count, 0)} without a collider`);
  for (const [key, g] of list.slice(0, 40)) console.log(`  ${String(g.count).padStart(4)}  ${key}  (e.g. ${g.at.join(', ')})`);
}

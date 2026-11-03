import * as THREE from 'three';

// The burn map: what fire has done to the world, as two small textures over a 512 m window that follows the
// viewer (the full state lives in sparse maps, so nothing is lost when the window moves).
//   tree texture   (nearest)  per 2 m cell under a burning tree: r = how far the fire has spread (0..1),
//                             g = tree height / 0.1 m, b+a = height of its foot as 16 bit ((y + 64) · 256)
//   origin texture (nearest)  the same cells: r, g = the two heights (fractions of the tree) where it catches,
//                             b = when the second one joins (as a share of the spread), a = the tree's own noise seed
//   ground texture (bilinear) r = scorch, g = glow of embers, b = melted snow, a = how long the tree above has burnt (0..1)
// The terrain, the tree material and the grass sprites read them in their shaders (see BURN_GLSL), so a burnt
// forest stays burnt without a single object being replaced.
export const BURN_CELL = 2, BURN_SIZE = 256, BURN_SPAN = BURN_CELL * BURN_SIZE;
const treeData = new Uint8Array(BURN_SIZE * BURN_SIZE * 4), groundData = new Uint8Array(BURN_SIZE * BURN_SIZE * 4), originData = new Uint8Array(BURN_SIZE * BURN_SIZE * 4);
function dataTexture(data, filter) {
  const t = new THREE.DataTexture(data, BURN_SIZE, BURN_SIZE, THREE.RGBAFormat);
  t.magFilter = t.minFilter = filter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  return t;
}
const treeTexture = dataTexture(treeData, THREE.NearestFilter), groundTexture = dataTexture(groundData, THREE.LinearFilter), originTexture = dataTexture(originData, THREE.NearestFilter);
/** Shared uniform objects: every patched material points at these same ones. */
export const burnUniforms = {
  uBurnT: { value: treeTexture }, uBurnG: { value: groundTexture }, uBurnO: { value: originTexture }, uBurn: { value: new THREE.Vector3(-1e6, -1e6, 1 / BURN_SPAN) }, uBurnTime: { value: 0 },
};

const sparseTree = new Map(), sparseGround = new Map();
let originX = -1e6, originZ = -1e6, dirty = false;
const key = (cx, cz) => cx * 65536 + cz;
const inWindow = (cx, cz) => { const i = cx - originX / BURN_CELL, j = cz - originZ / BURN_CELL; return i >= 0 && j >= 0 && i < BURN_SIZE && j < BURN_SIZE ? j * BURN_SIZE + i : -1; };
const byte = v => Math.max(0, Math.min(255, Math.round(v * 255)));

function writeGround(cx, cz, g) {
  const at = inWindow(cx, cz); if (at < 0) return;
  groundData[at * 4] = byte(g.scorch); groundData[at * 4 + 1] = byte(g.glow); groundData[at * 4 + 2] = byte(g.melt); groundData[at * 4 + 3] = byte(g.age);
  dirty = true;
}
function writeTree(cx, cz, t) {
  const at = inWindow(cx, cz); if (at < 0) return;
  const base = Math.max(0, Math.min(65535, Math.round((t.base + 64) * 256)));
  treeData[at * 4] = byte(t.progress); treeData[at * 4 + 1] = Math.max(0, Math.min(255, Math.round(t.height * 10))); treeData[at * 4 + 2] = base >> 8; treeData[at * 4 + 3] = base & 255;
  originData[at * 4] = byte(t.o1 ?? 0); originData[at * 4 + 1] = byte(t.o2 ?? 0); originData[at * 4 + 2] = byte(t.d2 ?? .3); originData[at * 4 + 3] = byte(t.seed ?? 0);
  dirty = true;
}
/** Sets the ground state of one cell (absolute cell coordinates = floor(x / 2)). */
export function setGround(cx, cz, scorch, glow = 0, melt = 0, age = 0) {
  const k = key(cx, cz), g = sparseGround.get(k) || { scorch: 0, glow: 0, melt: 0, age: 0 };
  g.scorch = scorch; g.glow = glow; g.melt = melt; g.age = age; sparseGround.set(k, g); g.cx = cx; g.cz = cz; writeGround(cx, cz, g);
}
export function getGround(cx, cz) { return sparseGround.get(key(cx, cz)) || null; }
/** Writes a tree's state ({ progress, height, base, o1, o2, d2, seed }) into one cell under it. */
export function setTree(cx, cz, tree) {
  const k = key(cx, cz), t = sparseTree.get(k) || {};
  Object.assign(t, { progress: tree.progress, height: tree.height, base: tree.base, o1: tree.o1, o2: tree.o2, d2: tree.d2, seed: tree.seed, cx, cz }); sparseTree.set(k, t); writeTree(cx, cz, t);
}
/** Keeps the window centred on the viewer; returns true when it moved and was rebuilt. */
export function recentre(x, z) {
  const ox = Math.floor((x - BURN_SPAN / 2) / 64) * 64, oz = Math.floor((z - BURN_SPAN / 2) / 64) * 64;
  const near = Math.abs(x - (originX + BURN_SPAN / 2)) < 96 && Math.abs(z - (originZ + BURN_SPAN / 2)) < 96;
  if (near) return false;
  originX = ox; originZ = oz; treeData.fill(0); groundData.fill(0); originData.fill(0);
  for (const g of sparseGround.values()) writeGround(g.cx, g.cz, g);
  for (const t of sparseTree.values()) writeTree(t.cx, t.cz, t);
  burnUniforms.uBurn.value.set(originX, originZ, 1 / BURN_SPAN); dirty = true;
  return true;
}
export function flushBurnMap() { if (!dirty) return; treeTexture.needsUpdate = groundTexture.needsUpdate = originTexture.needsUpdate = true; dirty = false; }
export function resetBurnMap() { sparseTree.clear(); sparseGround.clear(); treeData.fill(0); groundData.fill(0); originData.fill(0); dirty = true; }
export const burnState = () => ({ ground: sparseGround.size, trees: sparseTree.size, origin: [originX, originZ] });

/** GLSL shared by the patched materials. `burnGround` and `burnTree` read the maps at a world position. */
export const BURN_GLSL = `
uniform sampler2D uBurnT; uniform sampler2D uBurnG; uniform sampler2D uBurnO; uniform vec3 uBurn; uniform float uBurnTime;
vec3 gBurnEmit = vec3(0.);
float burnHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec4 burnGround(vec3 wp) { vec2 q = (wp.xz - uBurn.xy) * uBurn.z; if (q.x <= 0. || q.y <= 0. || q.x >= 1. || q.y >= 1.) return vec4(0.); return texture2D(uBurnG, q); }
vec4 burnOrigin(vec3 wp) { vec2 q = (wp.xz - uBurn.xy) * uBurn.z; if (q.x <= 0. || q.y <= 0. || q.x >= 1. || q.y >= 1.) return vec4(0.); return texture2D(uBurnO, q); }
float burnNoise(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); float a = burnHash(i.xz + i.y * 7.1), b = burnHash(i.xz + vec2(1., 0.) + i.y * 7.1), c = burnHash(i.xz + vec2(0., 1.) + i.y * 7.1), d = burnHash(i.xz + vec2(1., 1.) + i.y * 7.1); float a2 = burnHash(i.xz + (i.y + 1.) * 7.1), b2 = burnHash(i.xz + vec2(1., 0.) + (i.y + 1.) * 7.1), c2 = burnHash(i.xz + vec2(0., 1.) + (i.y + 1.) * 7.1), d2 = burnHash(i.xz + vec2(1., 1.) + (i.y + 1.) * 7.1); return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.z), mix(mix(a2, b2, f.x), mix(c2, d2, f.x), f.z), f.y); }
vec4 burnTree(vec3 wp) { vec2 q = (wp.xz - uBurn.xy) * uBurn.z; if (q.x <= 0. || q.y <= 0. || q.x >= 1. || q.y >= 1.) return vec4(0.); return texture2D(uBurnT, q); }
`;

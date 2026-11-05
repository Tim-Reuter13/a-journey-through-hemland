import * as THREE from 'three';
import { burnUniforms, BURN_GLSL } from './burnMap.js';

// Trees and bushes built in Blockbench (art/blockbench/models.js › trees → public/models/trees.gltf).
// Every cube of a tree is baked into one geometry around the foot of its trunk. Foliage gets rounded
// crown normals, so a crown shades as one soft mass instead of a heap of boxes, and a sway weight the
// wind moves. Each tree also gets a cheap far version (trunk, limbs and the biggest clumps) that
// chunks.js shows two rings out. Node tests load none; flora.js keeps its block trees then.
export const TREES = ['oak_1', 'oak_2', 'oak_3', 'autumn_1', 'autumn_2', 'birch_1', 'birch_2', 'spruce_1', 'spruce_2',
  'pine_1', 'pine_2', 'pine_snow_1', 'pine_snow_2', 'dead_1', 'bush_1', 'bush_2', 'maple_1', 'maple_2', 'birch_gold_1', 'birch_gold_2',
  'dead_2', 'oak_4', 'oak_5', 'oak_6', 'autumn_3', 'maple_3', 'birch_3', 'spruce_3', 'pine_3', 'pine_snow_3',
  'redwood_1', 'redwood_2', 'willow_1', 'willow_2', 'acacia_1', 'acacia_2', 'palm_1', 'palm_2', 'cypress_1', 'cypress_2', 'jade_1', 'jade_2',
  'heath_1', 'heath_2', 'blossom_1', 'blossom_2', 'olive_1', 'olive_2', 'charred_1', 'charred_2',
  'cactus_1', 'cactus_2', 'cactus_3', 'mangrove_1', 'mangrove_2'];
// How much taller a placed tree stands than the model: the old species were stretched when trees were made bigger, the new ones
// were modelled at their size (a redwood is already 15 units).
const GROWTH = { redwood: 1, willow: 1.2, acacia: 1.2, palm: 1.15, cypress: 1.2, jade: 1.2, heath: 1.25, blossom: 1.3, olive: 1.25, charred: 1.3, cactus: 1.1, mangrove: 1.2 };
const growthOf = name => name.startsWith('bush') ? 1 : GROWTH[name.replace(/_(snow_)?\d+$/, '')] ?? 1.38;
export const wind = { value: 0 };
const templates = new Map();
const materials = {};
let farTrees = false;

function treeMaterial(map, lod) {
  // A floor of self-illumination, like the characters', keeps trees against the sun from going black.
  const material = new THREE.MeshLambertMaterial({ map, alphaTest: .5, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: .12 });
  material.name = `trees:${lod}`;
  material.userData.atlas = true; // one shared atlas: batching.js must not shift its UVs
  material.userData.lod = lod;
  material.onBeforeCompile = shader => {
    shader.uniforms.uWind = wind;
    // Inner faces seen through the holes keep the outward crown normal instead of a flipped one,
    // or every crown would look hollow and black inside.
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>',
      THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'));
    // Fire (world/burnMap.js, systems/wildfire.js): the burn map says how far a flame front has climbed a tree.
    // Below the front bark chars black and foliage dissolves, ragged and glowing at the edge; once burnt the
    // crown is gone and the trunk stands black.
    Object.assign(shader.uniforms, burnUniforms);
    shader.fragmentShader = 'varying vec3 vBurnWorld;\nvarying float vLeaf;\n' + BURN_GLSL + shader.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec4 bt = burnTree(vBurnWorld);
        if (bt.r > .004) {
          vec4 bo = burnOrigin(vBurnWorld);
          float treeH = bt.g * 25.5, by = (bt.b * 255. * 256. + bt.a * 255.) / 256. - 64.;
          float rel = (vBurnWorld.y - by) / max(treeH, 1.);
          float n = burnHash(floor(vBurnWorld.xz * 16.) + floor(vBurnWorld.y * 16.) * 1.7);
          // The fire creeps outward from where it caught, lumpily: broad noise makes it flare up in one limb and
          // lag in another; a second ignition point in the crown joins after a while.
          float lump = burnNoise(vBurnWorld * .55 + bo.a * 31.) * .5 + burnNoise(vBurnWorld * 1.7 + bo.a * 17.) * .25;
          float reach1 = bt.r * 1.45 - abs(rel - bo.r) - lump;
          float reach2 = (bt.r - bo.b) * 1.6 - abs(rel - bo.g) - lump;
          float age = burnGround(vBurnWorld).a;
          // Whatever the front missed smoulders and goes later (age grows long after the front has passed).
          float front = max(reach1, bt.r > bo.b ? reach2 : -1.) + age * 1.2;
          float below = front * (treeH * .55 + .6);   // roughly metres behind the flame front
          if (below > 0.) {
            if (vLeaf > .5) {
              // Leaves go patchily: scorched brown first, then gone, long after the front has passed.
              float gone = clamp((below - .8) * .22 + age * 1.6 - lump * .6, 0., 1.);
              if (n < gone) discard;
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.12, .075, .04) * (.7 + n * .6), clamp(below * .9, 0., 1.) * .8);
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.05, .043, .038) * (.7 + n * .6), clamp((below - 1.2) * .5 + age, 0., 1.));
            } else diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.055, .048, .042) * (.6 + n * .8), clamp(below * 1.3, 0., 1.));
          }
          float band = smoothstep(-.05, .35, below) * (1. - smoothstep(.4, 2.2, below)), live = 1. - age * .85, flick = .65 + .35 * sin(uBurnTime * 9. + n * 40. + bo.a * 20.);
          gBurnEmit += vec3(1., .4, .08) * band * live * flick * (.45 + n * .9);
          // Embers glow in cracks of burnt wood and under half-burnt leaves for a long time.
          if (below > .3 && n > .88) gBurnEmit += vec3(1., .26, .05) * live * flick * (vLeaf > .5 ? .5 : .85);
        }
      }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n      totalEmissiveRadiance += gBurnEmit;');
    shader.vertexShader = 'uniform float uWind;\nattribute float sway;\nattribute float leaf;\nvarying vec3 vBurnWorld;\nvarying float vLeaf;\n' + shader.vertexShader.replace('#include <begin_vertex>', [
      '#include <begin_vertex>',
      'vec3 treeWorld = (modelMatrix * vec4(position, 1.)).xyz;',
      'vBurnWorld = treeWorld; vLeaf = leaf;',
      '// A slow gust leans the whole crown, a quicker flutter rustles each part of it.',
      'float gust = sin(uWind * .9 + treeWorld.x * .05 + treeWorld.z * .04) * .5 + .5;',
      'transformed.x += sway * (gust * .09 + sin(uWind * 2.1 + treeWorld.x * .4 + treeWorld.y * .3) * .035);',
      'transformed.z += sway * (gust * .04 + cos(uWind * 1.7 + treeWorld.z * .4 + treeWorld.y * .2) * .035);'].join('\n'));
  };
  material.customProgramCacheKey = () => 'trees-sway-burn';
  return material;
}

export async function loadTreeModels(base = `${import.meta.env.BASE_URL}models/`) {
  const [{ GLTFLoader }, { mergeGeometries }] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/utils/BufferGeometryUtils.js')]);
  const scene = (await new GLTFLoader().loadAsync(`${base}trees.gltf`)).scene;
  scene.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4(), size = new THREE.Vector3(), centre = new THREE.Vector3(), radial = new THREE.Vector3(), n = new THREE.Vector3();
  for (const name of TREES) {
    const node = scene.getObjectByName(name);
    if (!node) continue;
    inverse.copy(node.matrixWorld).invert();
    const parts = [];
    node.traverse(object => { if (object.isMesh) parts.push(object); });
    if (!parts.length) continue;
    materials.hi ??= treeMaterial(prepareMap(parts[0].material.map), 'hi');
    materials.lo ??= treeMaterial(materials.hi.map, 'lo');
    // Each cube in tree space, with its own size (unrotated) to rank it for the far version.
    const pieces = parts.map(part => {
      const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
      for (const key of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(key)) geometry.deleteAttribute(key);
      geometry.computeBoundingBox(); geometry.boundingBox.getSize(size);
      const dims = [size.x, size.y, size.z].sort((a, b) => a - b);
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, part.matrixWorld));
      geometry.computeBoundingBox();
      return { geometry, leaf: part.name.includes('_leaf'), root: part.name.includes('_root'), thin: dims[0], height: size.y, volume: size.x * size.y * size.z, box: geometry.boundingBox.clone() };
    });
    // Roots and the collar round the trunk's foot are kept apart: each placed tree gets its own copy laid on the ground under it.
    const rootPieces = pieces.filter(p => p.root), body = pieces.filter(p => !p.root), rigid = name.startsWith('cactus');
    const all = new THREE.Box3(), crown = new THREE.Box3();
    body.forEach(p => { all.union(p.box); if (p.leaf) crown.union(p.box); });
    const height = all.max.y, conifer = /spruce|pine/.test(name);
    if (!crown.isEmpty()) crown.getCenter(centre);
    for (const p of pieces) {
      const pos = p.geometry.attributes.position, normal = p.geometry.attributes.normal, sway = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), up = Math.max(0, y / height);
        if (p.root || rigid) continue;
        if (!p.leaf) { sway[i] = up > .45 ? (up - .45) ** 2 * .8 : 0; continue; }
        sway[i] = Math.min(1, up ** 1.3 * 1.1);
        // Rounded crown: conifers round about the trunk, broadleaf crowns about their middle.
        if (conifer) { const h = Math.hypot(x, z); radial.set(x, h * .45 + .15, z); }
        else radial.set(x - centre.x, (y - centre.y) * 1.25, z - centre.z);
        if (radial.lengthSq() < 1e-6) radial.set(0, 1, 0);
        n.set(normal.getX(i), normal.getY(i), normal.getZ(i)).multiplyScalar(.35).addScaledVector(radial.normalize(), .65).normalize();
        normal.setXYZ(i, n.x, n.y, n.z);
      }
      p.geometry.setAttribute('sway', new THREE.BufferAttribute(sway, 1));
      p.geometry.setAttribute('leaf', new THREE.BufferAttribute(new Float32Array(pos.count).fill(p.leaf ? 1 : 0), 1));
    }
    if (!rootPieces.length) { /* trees without roots (bushes) place nothing extra */ }
    // The far version: trunk and limbs (no twigs), and the bigger half of the foliage, a little
    // swollen to close the gaps the small clumps leave.
    const leaves = body.filter(p => p.leaf).sort((a, b) => b.volume - a.volume);
    const keep = new Set([...body.filter(p => !p.leaf && p.thin >= .2), ...leaves.slice(0, Math.ceil(leaves.length * .45))]);
    const far = [...keep].map(p => {
      const g = p.geometry.clone();
      if (p.leaf) { p.box.getCenter(radial); g.translate(-radial.x, -radial.y, -radial.z).scale(1.15, 1.15, 1.15).translate(radial.x, radial.y, radial.z); }
      return g;
    });
    const hi = mergeGeometries(body.map(p => p.geometry), false), lo = mergeGeometries(far, false), roots = rootPieces.length ? mergeGeometries(rootPieces.map(p => p.geometry), false) : null;
    pieces.forEach(p => p.geometry.dispose()); far.forEach(g => g.dispose());
    for (const g of [hi, lo, roots]) if (g) { g.computeBoundingBox(); g.computeBoundingSphere(); }
    // Trunk width from the base segment (the tall wood piece standing on the ground).
    const trunk = body.filter(p => !p.leaf && p.box.min.y < .2 && p.height > 1).reduce((w, p) => Math.max(w, Math.min(p.box.max.x - p.box.min.x, p.box.max.z - p.box.min.z)), .3);
    templates.set(name, { hi, lo, roots, trunk, height, crown: crown.isEmpty() ? null : crown.clone() });
  }
  return templates.size;
}

function prepareMap(map) {
  if (map) { map.magFilter = map.minFilter = THREE.NearestFilter; map.generateMipmaps = false; map.colorSpace = THREE.SRGBColorSpace; map.needsUpdate = true; }
  return map;
}

export const treesLoaded = () => templates.size > 0;
/** While on, placed trees also carry their far version (chunk scatter; chunks.js switches them). */
export function setFarTrees(on) { farTrees = on; }

/** Places a tree: foot of the trunk at (x, y, z), turned at random; a trunk footprint blocks walking. */
// Crowns of the placed trees, on a 16 m grid, for effects that need them (falling leaves, light shafts).
const canopyGrid = new Map(), CANOPY_CELL = 16;
function registerCanopy(name, crown, x, y, z, scale) {
  if (!crown || name.startsWith('bush') || name.startsWith('dead')) return;
  const key = `${Math.floor(x / CANOPY_CELL)},${Math.floor(z / CANOPY_CELL)}`, list = canopyGrid.get(key) || [];
  if (list.some(c => Math.abs(c.x - x) < .05 && Math.abs(c.z - z) < .05)) return;
  list.push({ x, z, bottom: y + crown.min.y * scale, top: y + crown.max.y * scale, radius: Math.max(crown.max.x - crown.min.x, crown.max.z - crown.min.z) * .5 * scale,
    kind: /autumn|maple|gold/.test(name) ? 'autumn' : /pine|spruce/.test(name) ? 'conifer' : 'broadleaf' });
  canopyGrid.set(key, list);
}
/** Tree crowns within r of (x, z). */
export function canopiesNear(x, z, r) {
  const out = [];
  for (let i = Math.floor((x - r) / CANOPY_CELL); i <= Math.floor((x + r) / CANOPY_CELL); i++)
    for (let j = Math.floor((z - r) / CANOPY_CELL); j <= Math.floor((z + r) / CANOPY_CELL); j++)
      for (const c of canopyGrid.get(`${i},${j}`) || []) if ((c.x - x) ** 2 + (c.z - z) ** 2 < r * r) out.push(c);
  return out;
}
// The ground under the trees (set by the chunk scatter): roots are bent over it, vertex by vertex, so they follow a slope.
let treeGround = null;
export function setTreeGround(heightAt) { treeGround = heightAt; }
/** How steep the ground is at (x, z), 0 on the level (0 without terrain): things set on it sink by it on the downhill side. */
export function groundSlope(x, z) { return treeGround ? Math.hypot(treeGround(x + 1.2, z) - treeGround(x - 1.2, z), treeGround(x, z + 1.2) - treeGround(x, z - 1.2)) / 2.4 : 0; }
/** The root flare of a tree standing at (x, baseY, z), laid on the terrain: every vertex keeps its height above the ground
 *  under it, not above the trunk's foot. Uphill roots climb, downhill ones grip the drop; the collar sinks to the lowest side. */
function groundedRoots(template, x, baseY, z, scale, yaw) {
  const src = template.roots, pos = src.attributes.position, out = new Float32Array(pos.array.length), c = Math.cos(yaw), s = Math.sin(yaw);
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i), ly = pos.getY(i), lz = pos.getZ(i);
    const ground = treeGround(x + (c * lx + s * lz) * scale, z + (-s * lx + c * lz) * scale);
    out[i * 3] = lx; out[i * 3 + 1] = ly + (ground - baseY) / scale; out[i * 3 + 2] = lz;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  for (const name of ['normal', 'uv', 'sway', 'leaf']) if (src.attributes[name]) g.setAttribute(name, src.attributes[name]);
  g.boundingBox = src.boundingBox.clone(); g.boundingBox.min.y -= 6; g.boundingBox.max.y += 6; g.computeBoundingSphere(); g.boundingSphere.radius += 6;
  return g;
}
export function placeTree(parent, name, x, y, z, scale, random, { solid = true } = {}) {
  const template = templates.get(name);
  if (!template) return null;
  scale *= growthOf(name);
  const yaw = random() * Math.PI * 2;
  const root = new THREE.Group(); root.name = name;
  const hi = new THREE.Mesh(template.hi, materials.hi);
  hi.name = 'tree:hi'; hi.castShadow = hi.receiveShadow = true; root.add(hi);
  if (template.roots) {
    const roots = new THREE.Mesh(treeGround ? groundedRoots(template, x, y - .12 * scale, z, scale, yaw) : template.roots, materials.hi);
    roots.name = 'tree:roots'; roots.castShadow = false; roots.receiveShadow = true; root.add(roots);
  }
  if (farTrees) { const lo = new THREE.Mesh(template.lo, materials.lo); lo.name = 'tree:lo'; lo.castShadow = lo.receiveShadow = true; root.add(lo); }
  if (solid) {
    const footprint = new THREE.Object3D(), w = template.trunk * scale * .9;
    footprint.userData.solidFootprint = { width: w, depth: w, height: Math.min(template.height, 3.2) * scale };
    footprint.userData.surface = 'wood';
    root.add(footprint);
  }
  root.position.set(x, y - .12 * scale, z); root.scale.setScalar(scale); root.rotation.y = yaw;
  registerCanopy(name, template.crown, x, y - .12 * scale, z, scale);
  parent.add(root);
  return root;
}

/** Shows the near or the far version of the trees in a baked chunk group. */
export function showTreeDetail(meshes, near) {
  for (const mesh of meshes.hi) mesh.visible = near;
  for (const mesh of meshes.lo) mesh.visible = !near;
}
export function treeMeshes(group) {
  const out = { hi: [], lo: [] };
  group.traverse(o => { const lod = o.isMesh && o.material?.userData?.lod; if (lod) out[lod].push(o); });
  return out;
}

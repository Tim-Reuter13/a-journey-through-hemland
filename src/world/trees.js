import * as THREE from 'three';
import { burnUniforms, BURN_GLSL } from './burnMap.js';

// Trees and bushes built in Blockbench (art/blockbench/models.js › trees → public/models/trees.gltf).
// Every cube of a tree is baked into one geometry around the foot of its trunk. Foliage gets rounded
// crown normals, so a crown shades as one soft mass instead of a heap of boxes, and a sway weight the
// wind moves. Each tree also gets a cheap far version (trunk, limbs and the biggest clumps) that
// chunks.js shows two rings out. Node tests load none; flora.js keeps its block trees then.
export const TREES = ['oak_1', 'oak_2', 'oak_3', 'autumn_1', 'autumn_2', 'birch_1', 'birch_2', 'spruce_1', 'spruce_2',
  'pine_1', 'pine_2', 'pine_snow_1', 'pine_snow_2', 'dead_1', 'bush_1', 'bush_2', 'maple_1', 'maple_2', 'birch_gold_1', 'birch_gold_2'];
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
      return { geometry, leaf: part.name.includes('_leaf'), thin: dims[0], height: size.y, volume: size.x * size.y * size.z, box: geometry.boundingBox.clone() };
    });
    const all = new THREE.Box3(), crown = new THREE.Box3();
    pieces.forEach(p => { all.union(p.box); if (p.leaf) crown.union(p.box); });
    const height = all.max.y, conifer = /spruce|pine/.test(name);
    if (!crown.isEmpty()) crown.getCenter(centre);
    for (const p of pieces) {
      const pos = p.geometry.attributes.position, normal = p.geometry.attributes.normal, sway = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), up = Math.max(0, y / height);
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
    // The far version: trunk and limbs (no twigs), and the bigger half of the foliage, a little
    // swollen to close the gaps the small clumps leave.
    const leaves = pieces.filter(p => p.leaf).sort((a, b) => b.volume - a.volume);
    const keep = new Set([...pieces.filter(p => !p.leaf && p.thin >= .2), ...leaves.slice(0, Math.ceil(leaves.length * .45))]);
    const far = [...keep].map(p => {
      const g = p.geometry.clone();
      if (p.leaf) { p.box.getCenter(radial); g.translate(-radial.x, -radial.y, -radial.z).scale(1.15, 1.15, 1.15).translate(radial.x, radial.y, radial.z); }
      return g;
    });
    const hi = mergeGeometries(pieces.map(p => p.geometry), false), lo = mergeGeometries(far, false);
    pieces.forEach(p => p.geometry.dispose()); far.forEach(g => g.dispose());
    for (const g of [hi, lo]) { g.computeBoundingBox(); g.computeBoundingSphere(); }
    // Trunk width from the base segment (the tall wood piece standing on the ground).
    const trunk = pieces.filter(p => !p.leaf && p.box.min.y < .2 && p.height > 1).reduce((w, p) => Math.max(w, Math.min(p.box.max.x - p.box.min.x, p.box.max.z - p.box.min.z)), .3);
    templates.set(name, { hi, lo, trunk, height, crown: crown.isEmpty() ? null : crown.clone() });
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
export function placeTree(parent, name, x, y, z, scale, random, { solid = true } = {}) {
  const template = templates.get(name);
  if (!template) return null;
  if (!name.startsWith('bush')) scale *= 1.18; // a little taller than the block trees they replaced
  const root = new THREE.Group(); root.name = name;
  const hi = new THREE.Mesh(template.hi, materials.hi);
  hi.name = 'tree:hi'; hi.castShadow = hi.receiveShadow = true; root.add(hi);
  if (farTrees) { const lo = new THREE.Mesh(template.lo, materials.lo); lo.name = 'tree:lo'; lo.castShadow = lo.receiveShadow = true; root.add(lo); }
  if (solid) {
    const footprint = new THREE.Object3D(), w = template.trunk * scale * .9;
    footprint.userData.solidFootprint = { width: w, depth: w, height: Math.min(template.height, 3.2) * scale };
    footprint.userData.surface = 'wood';
    root.add(footprint);
  }
  root.position.set(x, y - .12 * scale, z); root.scale.setScalar(scale); root.rotation.y = random() * Math.PI * 2;
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

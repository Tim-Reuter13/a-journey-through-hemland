import * as THREE from 'three';
import { wind } from './trees.js';
import { burnUniforms, BURN_GLSL } from './burnMap.js';

// Street props built in Blockbench (art/blockbench/models.js › props → public/models/props.gltf):
// carts, barrels, crates, sacks, produce, troughs, woodpiles, benches, hay, pottery, signs, ladders.
// The goblin caves have their own set (› cave_props → public/models/cave_props.gltf): bones, totems, cages, drums,
// stake gates, torches, filth, meat racks and the puzzle pieces.
// The world is generated before the characters load, so main.js awaits these first; without them
// (Node tests) propClone returns null and the sites keep their block-built clutter.
export const PROPS = ['handcart', 'wheelbarrow', 'barrels', 'crates', 'sacks', 'produce', 'trough', 'woodpile', 'bench', 'hay', 'pottery', 'sign', 'ladder', 'cartwheel'];
export const CAVE_PROPS = ['torch_wall', 'fire_pit', 'mushrooms', 'bone_pile', 'totem', 'altar', 'drums', 'banner', 'bed', 'junk', 'cart', 'rails', 'scrap', 'carving', 'chest', 'key', 'cage',
  'gate_wood', 'gate_iron', 'lever_base', 'lever_handle', 'chain_pull', 'pillar', 'brazier', 'plate', 'idol', 'socket', 'skull_stake', 'mushroom_giant', 'filth', 'spikes', 'meat_rack', 'stew_pot'];
// Plants of the landform regions (› plants → plants.gltf) and the points of interest of the wild regions (› pois → pois.gltf).
export const PLANTS = ['heather_1', 'heather_2', 'pampas_1', 'pampas_2', 'dry_shrub_1', 'dry_shrub_2', 'agave_1', 'agave_2',
  'fern_big_1', 'fern_big_2', 'mushroom_red_1', 'mushroom_red_2', 'mushroom_brown_1', 'mushroom_brown_2', 'mushroom_glow_1'];
export const POIS = ['mine_headframe', 'ribcage', 'obelisk', 'caravan_camp', 'obsidian_altar', 'burned_hut', 'stone_circle', 'peat_hut', 'jade_shrine', 'hollow_log'];
const templates = new Map();

function atlasMaterial(source) {
  const map = source.map;
  if (map) { map.magFilter = map.minFilter = THREE.NearestFilter; map.generateMipmaps = false; map.colorSpace = THREE.SRGBColorSpace; map.needsUpdate = true; }
  const material = new THREE.MeshLambertMaterial({ map, alphaTest: .5 });
  material.name = 'props:atlas';
  material.userData.atlas = true; // one shared atlas: batching.js must not shift its UVs
  return material;
}

// Plants stand in the wind: a weight from foot (0) to tip (1) per vertex moves the top, and ground the fire has scorched takes them.
function plantMaterial(source) {
  const map = source.map;
  if (map) { map.magFilter = map.minFilter = THREE.NearestFilter; map.generateMipmaps = false; map.colorSpace = THREE.SRGBColorSpace; map.needsUpdate = true; }
  const material = new THREE.MeshLambertMaterial({ map, alphaTest: .5, side: THREE.DoubleSide });
  material.name = 'plants:atlas'; material.userData.atlas = true;
  material.customProgramCacheKey = () => 'plants-sway-burn';
  material.onBeforeCompile = shader => {
    shader.uniforms.uWind = wind; Object.assign(shader.uniforms, burnUniforms);
    shader.fragmentShader = 'varying vec3 vPlantWorld;\n' + BURN_GLSL + shader.fragmentShader
      .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'))
      .replace('#include <map_fragment>', `#include <map_fragment>
      { vec4 bg = burnGround(vPlantWorld); if (bg.r > .02) { float n = burnHash(floor(vPlantWorld.xz * 3.)); if (bg.r > .3 + n * .45) discard; diffuseColor.rgb *= 1. - smoothstep(.04, .26, bg.r) * .88; gBurnEmit += vec3(1., .4, .08) * bg.g * step(.55, n) * (.6 + .4 * sin(uBurnTime * 13. + n * 50.)); } }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n      totalEmissiveRadiance += gBurnEmit;');
    shader.vertexShader = 'uniform float uWind;\nattribute float sway;\nvarying vec3 vPlantWorld;\n' + shader.vertexShader.replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);').replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvec3 plantWorld = (modelMatrix * vec4(position, 1.)).xyz; vPlantWorld = plantWorld;\nfloat gust = sin(uWind * 1.6 + plantWorld.x * .31 + plantWorld.z * .23) + .45 * sin(uWind * 3.1 + plantWorld.z * .7);\ntransformed.x += sway * gust * .06; transformed.z += sway * cos(uWind * 1.3 + plantWorld.x * .2) * .045;');
  };
  return material;
}

export async function loadPropModels(base = `${import.meta.env.BASE_URL}models/`) {
  const [{ GLTFLoader }, { mergeGeometries }] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/utils/BufferGeometryUtils.js')]);
  const inverse = new THREE.Matrix4();
  async function load(file, names, { plants = false } = {}) {
    const scene = (await new GLTFLoader().loadAsync(`${base}${file}`)).scene;
    scene.updateMatrixWorld(true);
    let material = null;
    for (const name of names) {
      const node = scene.getObjectByName(name);
      if (!node) continue;
      // Every cube of a prop is baked into one mesh around the prop's pivot (its footprint centre).
      inverse.copy(node.matrixWorld).invert();
      const parts = [];
      node.traverse(object => { if (object.isMesh) parts.push(object); });
      const geometries = parts.map(part => {
        const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
        for (const key of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(key)) geometry.deleteAttribute(key);
        return geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, part.matrixWorld));
      });
      material ??= plants ? plantMaterial(parts[0].material) : atlasMaterial(parts[0].material);
      const geometry = mergeGeometries(geometries, false);
      geometries.forEach(g => g.dispose());
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      if (plants) {
        const pos = geometry.attributes.position, height = Math.max(.5, geometry.boundingBox.max.y), sway = new Float32Array(pos.count);
        for (let i = 0; i < pos.count; i++) sway[i] = Math.min(1, Math.max(0, pos.getY(i) / height)) ** 1.4;
        geometry.setAttribute('sway', new THREE.BufferAttribute(sway, 1));
      }
      templates.set(name, { geometry, material, bounds: geometry.boundingBox });
    }
  }
  await Promise.all([load('props.gltf', PROPS), load('cave_props.gltf', CAVE_PROPS).catch(error => console.warn('Cave props not loaded', error)),
    load('plants.gltf', PLANTS, { plants: true }).catch(error => console.warn('Plants not loaded', error)), load('pois.gltf', POIS).catch(error => console.warn('Points of interest not loaded', error))]);
  return templates.size;
}

export const propsLoaded = () => templates.size > 0;
export const plantsLoaded = () => templates.has('heather_1');

const UP = new THREE.Vector3(0, 1, 0), _n = new THREE.Vector3(), _q = new THREE.Quaternion(), _yaw = new THREE.Quaternion();
/** A plant at (x, y, z), adapted to the slope: it leans towards the way the ground faces (not all the way: plants grow up
 *  against the pull of the slope), and sinks a little on the uphill side so its foot never hangs in the air on the downhill one. */
export function placePlant(parent, name, x, y, z, scale, random, heightAt) {
  const template = templates.get(name);
  if (!template) return null;
  const mesh = new THREE.Mesh(template.geometry, template.material);
  mesh.name = `plant:${name}`; mesh.castShadow = false; mesh.receiveShadow = true;
  const dx = (heightAt(x + 1, z) - heightAt(x - 1, z)) / 2, dz = (heightAt(x, z + 1) - heightAt(x, z - 1)) / 2, slope = Math.hypot(dx, dz);
  _n.set(-dx * .55, 1, -dz * .55).normalize();
  _q.setFromUnitVectors(UP, _n); _yaw.setFromAxisAngle(UP, random() * Math.PI * 2);
  mesh.quaternion.copy(_q).multiply(_yaw);
  mesh.position.set(x, y - .03 - Math.min(.35, slope * .3) * scale, z); mesh.scale.setScalar(scale);
  parent.add(mesh);
  return mesh;
}

/** A placed copy of a prop: pivot on the ground at its footprint centre, front −z. Null before loading. */
export function propClone(name, { solid = true } = {}) {
  const template = templates.get(name);
  if (!template) return null;
  const root = new THREE.Group(), mesh = new THREE.Mesh(template.geometry, template.material);
  mesh.name = `prop:${name}`; mesh.castShadow = mesh.receiveShadow = true;
  root.add(mesh); root.name = name;
  if (solid) {
    const b = template.bounds, footprint = new THREE.Object3D();
    footprint.position.set((b.min.x + b.max.x) / 2, 0, (b.min.z + b.max.z) / 2);
    footprint.userData.solidFootprint = { width: (b.max.x - b.min.x) * .85, depth: (b.max.z - b.min.z) * .85, height: b.max.y };
    footprint.userData.surface = name === 'pottery' ? 'stone' : name === 'sacks' || name === 'hay' ? 'soft' : 'wood';
    root.add(footprint);
  }
  return root;
}

/** The prop's footprint turned by `rotation` about y, for setting it flush against a wall. */
export function propBounds(name, rotation = 0) {
  const b = templates.get(name)?.bounds;
  if (!b) return null;
  const c = Math.cos(rotation), s = Math.sin(rotation), out = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, height: b.max.y };
  for (const x of [b.min.x, b.max.x]) for (const z of [b.min.z, b.max.z]) {
    const rx = x * c + z * s, rz = -x * s + z * c;
    out.minX = Math.min(out.minX, rx); out.maxX = Math.max(out.maxX, rx); out.minZ = Math.min(out.minZ, rz); out.maxZ = Math.max(out.maxZ, rz);
  }
  return out;
}

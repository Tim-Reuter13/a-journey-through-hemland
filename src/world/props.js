import * as THREE from 'three';

// Street props built in Blockbench (art/blockbench/models.js › props → public/models/props.gltf):
// carts, barrels, crates, sacks, produce, troughs, woodpiles, benches, hay, pottery, signs, ladders.
// The world is generated before the characters load, so main.js awaits these first; without them
// (Node tests) propClone returns null and the sites keep their block-built clutter.
export const PROPS = ['handcart', 'wheelbarrow', 'barrels', 'crates', 'sacks', 'produce', 'trough', 'woodpile', 'bench', 'hay', 'pottery', 'sign', 'ladder', 'cartwheel'];
const templates = new Map();

function atlasMaterial(source) {
  const map = source.map;
  if (map) { map.magFilter = map.minFilter = THREE.NearestFilter; map.generateMipmaps = false; map.colorSpace = THREE.SRGBColorSpace; map.needsUpdate = true; }
  const material = new THREE.MeshLambertMaterial({ map, alphaTest: .5 });
  material.name = 'props:atlas';
  material.userData.atlas = true; // one shared atlas: batching.js must not shift its UVs
  return material;
}

export async function loadPropModels(base = `${import.meta.env.BASE_URL}models/`) {
  const [{ GLTFLoader }, { mergeGeometries }] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/utils/BufferGeometryUtils.js')]);
  const scene = (await new GLTFLoader().loadAsync(`${base}props.gltf`)).scene;
  scene.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4();
  let material = null;
  for (const name of PROPS) {
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
    material ??= atlasMaterial(parts[0].material);
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach(g => g.dispose());
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    templates.set(name, { geometry, material, bounds: geometry.boundingBox });
  }
  return templates.size;
}

export const propsLoaded = () => templates.size > 0;

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

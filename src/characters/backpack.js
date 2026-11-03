import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The wanderer's backpack, built in Blockbench (art/blockbench/models.js › backpack → public/models/backpack.gltf).
// Bones: pack › flap › buckle, strap_left / strap_right, pocket_left / pocket_right. It faces −Z (the outer side with
// the buckles); the flap hinges at the back of the rim and opens by turning +X. inventoryAccess.js animates it.
let template = null;

function mergeBone(bone, material) {
  const parts = bone.children.filter(c => c.isMesh);
  if (!parts.length) return;
  const geometries = parts.map(part => {
    part.updateMatrix();
    const g = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    return g.applyMatrix4(part.matrix);
  });
  const merged = new THREE.Mesh(mergeGeometries(geometries, false), material);
  geometries.forEach(g => g.dispose());
  merged.name = `${bone.name}:mesh`; merged.castShadow = merged.receiveShadow = true;
  parts.forEach(p => p.removeFromParent());
  bone.add(merged);
}

export async function loadBackpack(base = `${import.meta.env.BASE_URL}models/`) {
  const gltf = await new GLTFLoader().loadAsync(`${base}backpack.gltf`);
  let map = null;
  gltf.scene.traverse(o => { if (o.isMesh && !map) map = o.material.map; });
  if (map) { map.magFilter = map.minFilter = THREE.NearestFilter; map.generateMipmaps = false; map.colorSpace = THREE.SRGBColorSpace; map.needsUpdate = true; }
  // The same low floor of self-illumination as the characters: the pack stays readable in shade.
  const material = new THREE.MeshLambertMaterial({ map, alphaTest: .5, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: .22 });
  const bones = [];
  gltf.scene.traverse(o => { if (!o.isMesh && o.children.some(c => c.isMesh)) bones.push(o); });
  bones.forEach(b => mergeBone(b, material));
  template = gltf.scene;
  return true;
}
export const backpackLoaded = () => !!template;

/** A fresh pack: { root, bones, set(open, slack) }. `open` 0..1 swings the flap up and back, `slack` loosens the straps. */
export function createBackpack() {
  if (!template) return null;
  const root = new THREE.Group(); root.name = 'Backpack';
  const model = template.clone(true);
  root.add(model);
  const bones = {};
  for (const name of ['pack', 'flap', 'buckle', 'strap_left', 'strap_right', 'pocket_left', 'pocket_right']) bones[name] = model.getObjectByName(name);
  // An open flap swings further than 90° and settles back a hair; the buckle hangs from it.
  function set(open = 0, slack = 0) {
    bones.flap.rotation.x = open * 2.12;
    bones.buckle.rotation.x = -open * .85 + Math.sin(open * Math.PI) * .22;
    bones.strap_left.rotation.set(slack * .1, 0, slack * .16); bones.strap_right.rotation.set(slack * .1, 0, -slack * .16);
    bones.pocket_left.rotation.z = -open * .06; bones.pocket_right.rotation.z = open * .06;
  }
  set(0, 0);
  return { root, bones, set, dispose() { root.removeFromParent(); } };
}

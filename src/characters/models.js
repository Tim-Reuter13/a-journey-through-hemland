import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Blockbench characters (art/blockbench → public/models/*.gltf). Blockbench
// exports one mesh per cube; on load every bone's rigid cubes are merged into a
// single mesh so a character costs one draw call per moving part.
const MODELS = ['wanderer', 'elder', 'smith', 'ranger', 'bandit', 'captain', 'wolf', 'weapons', 'deer', 'fox', 'hare', 'crow'];
const templates = new Map();
const materials = new Map();

function pixelMaterial(source) {
  if (materials.has(source)) return materials.get(source);
  const map = source.map;
  if (map) { map.magFilter = map.minFilter = THREE.NearestFilter; map.generateMipmaps = false; map.colorSpace = THREE.SRGBColorSpace; map.needsUpdate = true; }
  // A floor of self-illumination, like PS1 vertex lighting, keeps characters readable in shade.
  const material = new THREE.MeshLambertMaterial({ map, alphaTest: .5, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: .2 });
  materials.set(source, material);
  return material;
}

function mergeBone(bone) {
  const parts = bone.children.filter(child => child.isMesh && !child.children.length);
  if (!parts.length) return;
  const geometries = parts.map(part => {
    part.updateMatrix();
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
    return geometry.applyMatrix4(part.matrix);
  });
  const merged = new THREE.Mesh(mergeGeometries(geometries, false), pixelMaterial(parts[0].material));
  geometries.forEach(g => g.dispose());
  merged.name = `${bone.name}:mesh`; merged.castShadow = true; merged.receiveShadow = true;
  parts.forEach(part => part.removeFromParent());
  bone.add(merged);
}

function prepare(scene) {
  const bones = [];
  scene.traverse(object => { if (!object.isMesh) bones.push(object); });
  bones.forEach(mergeBone);
  return scene;
}

export async function loadCharacterModels(base = `${import.meta.env.BASE_URL}models/`) {
  const loader = new GLTFLoader();
  await Promise.all(MODELS.map(async name => templates.set(name, prepare((await loader.loadAsync(`${base}${name}.gltf`)).scene))));
}

/** Clones a character template. Returns a root group whose userData.rig maps bone names to nodes. */
export function createCharacter(name, { scale = 1 } = {}) {
  const template = templates.get(name);
  if (!template) throw new Error(`Character model not loaded: ${name}`);
  const root = new THREE.Group();
  const body = template.clone(true);
  root.add(body); root.scale.setScalar(scale);
  const rig = {};
  body.traverse(object => { if (!object.isMesh && object.name) rig[object.name] = object; });
  for (const bone of Object.values(rig)) bone.userData.rest = { position: bone.position.clone(), quaternion: bone.quaternion.clone() };
  root.userData.rig = rig; root.userData.kind = name; root.userData.phase = Math.random() * 10;
  return root;
}

// Blade points forward and down from a hanging hand; arm poses rotate it from there.
const WEAPON_POSE = new THREE.Euler(-2.0, 0, 0);
/** Puts a held item (sword_rusty, sword_guard, sword_ash, hammer) into the right hand. */
export function equipItem(character, item) {
  const rig = character.userData.rig, grip = rig.grip_right;
  if (!grip) return null;
  character.userData.weapon?.removeFromParent();
  if (!item) { character.userData.weapon = null; return null; }
  const source = templates.get('weapons')?.getObjectByName(item);
  if (!source) return null;
  const weapon = source.clone(true);
  weapon.position.set(0, 0, 0); weapon.rotation.copy(WEAPON_POSE); weapon.scale.setScalar(.9);
  grip.add(weapon);
  character.userData.weapon = weapon; character.userData.weaponName = item;
  return weapon;
}

export const WEAPON_MODELS = { rostiges_schwert: 'sword_rusty', waechterklinge: 'sword_guard', aschenklinge: 'sword_ash' };

/** A free copy of a held item (the bow, an arrow) at held scale, or null before the models load. */
export function heldItem(name) {
  const source = templates.get('weapons')?.getObjectByName(name);
  if (!source) return null;
  const item = source.clone(true);
  item.position.set(0, 0, 0); item.rotation.set(0, 0, 0); item.scale.setScalar(.8);
  return item;
}

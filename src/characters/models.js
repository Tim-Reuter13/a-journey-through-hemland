import { buildSpear, isSpearModel } from './spear.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Blockbench characters (art/blockbench → public/models/*.gltf). Blockbench
// exports one mesh per cube; on load every bone's rigid cubes are merged into a
// single mesh so a character costs one draw call per moving part. Horses, with
// thirty-odd moving parts, become one rigidly skinned mesh instead: one draw call.
export const HORSE_VARIANTS = ['bay', 'black', 'grey', 'chestnut', 'palomino', 'paint'];
export const GOBLIN_MODELS = ['goblin_schaedel', 'goblin_pilz', 'goblin_ketten', 'goblin_schleicher', 'goblin_speier', 'goblin_wuerger', 'goblin_brecher', 'goblin_trommler', 'goblin_vosh', 'goblin_ghast', 'goblin_ulgrak'];
const MODELS = ['wanderer', 'elder', 'smith', 'ranger', 'bandit', 'captain', 'wolf', 'weapons', 'deer', 'fox', 'hare', 'crow', ...HORSE_VARIANTS.map(v => `horse_${v}`), ...GOBLIN_MODELS];
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

// Every cube into one mesh, each vertex bound wholly to the bone that carried its cube; the bones stay the
// rig the animator turns. Bone inverses come from the rest pose with the model at the origin.
function prepareSkinned(scene) {
  scene.updateMatrixWorld(true);
  const bones = [], cubes = [];
  scene.traverse(object => { if (object.isMesh) cubes.push(object); else if (object !== scene) bones.push(object); });
  const index = new Map(bones.map((bone, i) => [bone, i]));
  const geometries = cubes.map(cube => {
    const geometry = cube.geometry.index ? cube.geometry.toNonIndexed() : cube.geometry.clone();
    for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
    geometry.applyMatrix4(cube.matrixWorld);
    const n = geometry.attributes.position.count, bone = index.get(cube.parent) ?? 0, skinIndex = new Uint16Array(n * 4), skinWeight = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { skinIndex[i * 4] = bone; skinWeight[i * 4] = 1; }
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
    return geometry;
  });
  const material = pixelMaterial(cubes[0].material);
  cubes.forEach(cube => cube.removeFromParent());
  const mesh = new THREE.SkinnedMesh(mergeGeometries(geometries, false), material);
  geometries.forEach(g => g.dispose());
  mesh.name = 'skin'; mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh); mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.userData.boneNames = bones.map(bone => bone.name);
  // Rearing and grazing reach past the rest pose's bounds.
  mesh.computeBoundingSphere(); mesh.boundingSphere.radius *= 1.35;
  return scene;
}

export async function loadCharacterModels(base = `${import.meta.env.BASE_URL}models/`) {
  const loader = new GLTFLoader();
  await Promise.all(MODELS.map(async name => { const scene = (await loader.loadAsync(`${base}${name}.gltf`)).scene; templates.set(name, name.startsWith('horse_') || name.startsWith('goblin_') ? prepareSkinned(scene) : prepare(scene)); }));
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
  // A cloned skinned mesh still points at the template's bones: bind it to this copy's own.
  body.traverse(object => { if (object.isSkinnedMesh) object.bind(new THREE.Skeleton(object.userData.boneNames.map(n => rig[n]), object.skeleton.boneInverses), object.bindMatrix); });
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
  // The spear is built in code (characters/spear.js) until it comes out of Blockbench.
  const source = isSpearModel(item) ? null : templates.get('weapons')?.getObjectByName(item);
  if (!source && !isSpearModel(item)) return null;
  const weapon = source ? source.clone(true) : buildSpear(item);
  weapon.position.set(0, 0, 0); weapon.rotation.copy(WEAPON_POSE); weapon.scale.setScalar(.9);
  grip.add(weapon);
  character.userData.weapon = weapon; character.userData.weaponName = item;
  return weapon;
}

export const WEAPON_MODELS = { rostiges_schwert: 'sword_rusty', waechterklinge: 'sword_guard', aschenklinge: 'sword_ash', jagdspeer: 'spear_hunt' };
/** How a weapon is used: 'spear' thrusts with a long reach, everything else cuts like a sword. */
export const weaponStyle = id => isSpearModel(WEAPON_MODELS[id]) ? 'spear' : 'sword';

/** A free copy of a held item (the bow, an arrow) at held scale, or null before the models load. */
export function heldItem(name) {
  if (isSpearModel(name)) { const spear = buildSpear(name); spear.scale.setScalar(.8); return spear; }
  const source = templates.get('weapons')?.getObjectByName(name);
  if (!source) return null;
  const item = source.clone(true);
  item.position.set(0, 0, 0); item.rotation.set(0, 0, 0); item.scale.setScalar(.8);
  return item;
}

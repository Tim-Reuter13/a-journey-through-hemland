import * as THREE from 'three';
import { pixelMaterial } from '../art/pixelTextures.js';
import { createPreviewModel } from './itemPreview.js';

// Little pictures of the items for the inventory grid: each item's own preview model (itemPreview.js) rendered
// once, turned three-quarters and lit from the upper left, at 40 px and shown pixelated. One small offscreen
// renderer for all of them, a picture per item id kept for the session.
const SIZE = 40;
let renderer = null, scene, camera, rig, failed = false;
const cache = new Map(), materials = new Map(), textures = new Map();
const box = new THREE.Box3(), size = new THREE.Vector3(), center = new THREE.Vector3();

function setup() {
  if (renderer || failed) return !!renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, preserveDrawingBuffer: true }); }
  catch { failed = true; return false; }
  renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(30, 1, .01, 30);
  scene.add(new THREE.HemisphereLight(0xe6eef4, 0x3a3229, 2.1));
  const key = new THREE.DirectionalLight(0xfff0d0, 2.4); key.position.set(-2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc0ff, 1.1); rim.position.set(3, 1, -3); scene.add(rim);
  rig = new THREE.Group(); scene.add(rig);
  return true;
}
function material(name, tint = 0xffffff) {
  const k = `${name}:${tint}`; if (materials.has(k)) return materials.get(k);
  const shared = pixelMaterial(name, { tint }), copy = shared.clone();
  if (!textures.has(name)) { const map = shared.map.clone(); map.magFilter = map.minFilter = THREE.NearestFilter; map.generateMipmaps = false; map.needsUpdate = true; textures.set(name, map); }
  copy.map = textures.get(name); materials.set(k, copy); return copy;
}

/** A data URL picture of the item, or null without WebGL. */
export function itemThumb(item) {
  if (!item) return null;
  if (cache.has(item.id)) return cache.get(item.id);
  if (!setup()) return null;
  rig.clear(); rig.rotation.set(0, 0, 0);
  const model = createPreviewModel(item, material);
  // Long things lie across the diagonal; everything else turns three-quarters toward the light.
  const flat = item.type === 'weapon' || item.slot === 'ranged' || item.type === 'ammo';
  model.rotation.y += flat ? .2 : -.62; model.rotation.x += flat ? 0 : .22;
  rig.add(model); rig.updateMatrixWorld(true);
  box.setFromObject(rig); box.getSize(size); box.getCenter(center);
  rig.position.sub(center);
  const radius = Math.max(size.x, size.y, size.z * .6) * .5 + .06, distance = radius / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.04;
  camera.position.set(0, radius * .08, distance); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
  renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  rig.position.set(0, 0, 0); rig.clear();
  cache.set(item.id, url);
  return url;
}

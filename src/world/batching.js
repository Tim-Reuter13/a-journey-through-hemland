import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Bake immovable props in small spatial cells. Each cell remains independently
// culled, while repeated timber, stone and foliage share one draw call.
export function batchScenery(root, excluded = new Set(), cellSize = 28) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const position = new THREE.Vector3();
  root.traverse(object => {
    if (!object.isMesh || object.isInstancedMesh || excluded.has(object) ||
        Array.isArray(object.material) || object.material.transparent || object.material.isShaderMaterial) return;
    object.getWorldPosition(position);
    const attributes = Object.keys(object.geometry.attributes).sort().join(',');
    const key = `${Math.floor(position.x / cellSize)},${Math.floor(position.z / cellSize)}:${object.material.uuid}:${object.castShadow}:${object.receiveShadow}:${attributes}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(object);
  });
  let sourceMeshes = 0, batches = 0;
  for (const objects of buckets.values()) {
    if (objects.length < 2) continue;
    const geometries = objects.map(object => {
      const copy = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      copy.applyMatrix4(object.matrixWorld);
      shiftUVs(copy, object);
      return copy;
    });
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach(g => g.dispose());
    if (!geometry) continue;
    geometry.computeBoundingSphere();
    const batch = new THREE.Mesh(geometry, objects[0].material);
    batch.castShadow = objects[0].castShadow;
    batch.receiveShadow = objects[0].receiveShadow;
    batch.name = 'Static scenery cell';
    root.add(batch);
    objects.forEach(object => object.removeFromParent());
    sourceMeshes += objects.length;
    batches++;
  }
  return { sourceMeshes, batches };
}

// Boxes all start their UVs at the same corner, so every wall piece would show the same patch of a
// large surface canvas (surfaces.js). Each baked piece reads its own window instead: shifted by whole
// texels sideways and by whole courses (half units) upward, so brick and shingle rows stay level.
function shiftUVs(geometry, object) {
  const size = object.material.map?.image?.width, uv = geometry.attributes.uv;
  if (!uv || !(size > 16) || object.material.userData.atlas) return;
  const p = object.getWorldPosition(new THREE.Vector3()), hash = k => { const s = Math.sin(p.x * 12.9898 + p.z * 78.233 + p.y * 37.719 + k) * 43758.5453; return s - Math.floor(s); };
  const du = Math.floor(hash(1) * size) / 16, dv = Math.floor(hash(2) * size / 8) * .5;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + du, uv.getY(i) + dv);
}

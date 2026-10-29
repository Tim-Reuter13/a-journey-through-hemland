import * as THREE from 'three';
import { pixelMaterial } from './pixelTextures.js';

// Blockbench-style building blocks. Box faces get UVs measured in world units,
// so a 16×16 texture always covers exactly one unit: 16 texels per unit on
// every face of every box, whatever its size.
const geometryCache = new Map();
// BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 vertices each).
const faceSize = (w, h, d) => [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
const snap = v => Math.round(v * 1000) / 1000;

export function boxGeometry(w, h, d, tile = 1) {
  const key = `${snap(w)}/${snap(h)}/${snap(d)}/${tile}`;
  if (geometryCache.has(key)) return geometryCache.get(key);
  const geometry = new THREE.BoxGeometry(w, h, d);
  const uv = geometry.attributes.uv, sizes = faceSize(w, h, d);
  for (let face = 0; face < 6; face++) for (let i = 0; i < 4; i++) {
    const k = face * 4 + i;
    uv.setXY(k, uv.getX(k) * sizes[face][0] / tile, uv.getY(k) * sizes[face][1] / tile);
  }
  geometryCache.set(key, geometry);
  return geometry;
}

const material = value => typeof value === 'string' ? pixelMaterial(value) : value;

/** Adds a textured box. `material` is a pixel texture name or a Material. */
export function block(parent, w, h, d, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, { tile = 1, shadow = true, solid = false } = {}) {
  const mesh = new THREE.Mesh(boxGeometry(w, h, d, tile), material(mat));
  mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = shadow; mesh.receiveShadow = true;
  if (solid) mesh.userData.solid = true;
  parent.add(mesh);
  return mesh;
}

/** Box resting on y (bottom face at y) — the common case when stacking. */
export function blockOn(parent, w, h, d, mat, x, y, z, ry = 0, options) {
  return block(parent, w, h, d, mat, x, y + h / 2, z, 0, ry, 0, options);
}

/** Beam between two points, square in section. */
export function beam(parent, a, b, size, mat, options) {
  const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
  const mesh = block(parent, size, from.distanceTo(to), size, mat, 0, 0, 0, 0, 0, 0, options);
  mesh.position.copy(from).add(to).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize());
  return mesh;
}

/** Two crossed vertical quads with their base at y = 0, UVs 0..1 — sprite foliage. */
export function crossGeometry(width = 1, height = 1, planes = 2) {
  const positions = [], uvs = [], indices = [];
  for (let p = 0; p < planes; p++) {
    const a = p * Math.PI / planes + Math.PI / 4, dx = Math.cos(a) * width / 2, dz = Math.sin(a) * width / 2, start = positions.length / 3;
    positions.push(-dx, 0, -dz, dx, 0, dz, dx, height, dz, -dx, height, -dz);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  // Up-facing normals light sprites like the ground they stand on.
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(positions.map((_, i) => i % 3 === 1 ? 1 : 0), 3));
  return geometry;
}

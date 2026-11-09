import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { boxGeometry } from '../art/blocks.js';
import { pixelMaterial } from '../art/pixelTextures.js';

// The hunting spear (Jagdspeer), in the same box language as the Blockbench weapons (art/blockbench/models.js
// weapons()): units are pixels, 16 to a world unit; the pivot (0, 0, 0) is where the hand closes and the weapon
// runs up +Y, like the swords, so it is held and aimed the same way. Built here until it is modelled and exported
// from Blockbench: an ash shaft with a leather grip and a brass ferrule, a socket, a leaf-shaped iron head with a
// darker middle ridge, two lugs under the head and a red cloth tassel.
const PX = 1 / 16;
// [from, to, material, tint] in pixels (x, y, z).
const CUBES = [
  // Shaft: from the butt behind the hand to the socket.
  [[-.55, -15, -.55], [.55, 23, .55], 'planks', 0xe8c090],
  [[-.7, -16.2, -.7], [.7, -14.6, .7], 'brass', 0xffffff],           // butt cap
  [[-.75, -3.2, -.75], [.75, 3.4, .75], 'darkPlanks', 0x8a6a4a],     // leather grip
  [[-.85, -3.4, -.85], [.85, -2.8, .85], 'brass', 0xffffff],         // grip rings
  [[-.85, 3.0, -.85], [.85, 3.6, .85], 'brass', 0xffffff],
  [[-.8, 8.5, -.8], [.8, 9.3, .8], 'darkPlanks', 0x7a5236],          // binding
  // Socket and lugs.
  [[-.85, 22.4, -.85], [.85, 26, .85], 'iron', 0x9a9a9a],
  [[-1.9, 23.4, -.35], [1.9, 24.3, .35], 'iron', 0x8a8a8a],
  // Head: a leaf, widest low, tapering to the point in steps.
  [[-1.6, 26, -.32], [1.6, 29, .32], 'iron', 0xd8d8d8],
  [[-1.25, 29, -.3], [1.25, 32, .3], 'iron', 0xd8d8d8],
  [[-.85, 32, -.26], [.85, 34.4, .26], 'iron', 0xe0e0e0],
  [[-.45, 34.4, -.22], [.45, 36.2, .22], 'iron', 0xe8e8e8],
  [[-.18, 36.2, -.16], [.18, 37.3, .16], 'iron', 0xf0f0f0],
  [[-.32, 26, -.42], [.32, 34, .42], 'iron', 0x8a8a8a],              // the ridge down its middle
  // Tassel under the head.
  [[-.4, 20.5, .55], [.4, 22.6, 1.1], 'clothRed', 0xb03a2a],
  [[-.25, 17.6, .6], [.25, 20.5, 1.0], 'clothRed', 0x9a2e22],
];

/** A fresh spear model (a Group, merged per material), sized like the Blockbench weapons before their scale. */
export function buildSpear(name = 'spear_hunt', material = (mat, tint) => pixelMaterial(mat, { tint })) {
  const root = new THREE.Group(); root.name = name;
  const byMat = new Map();
  for (const [from, to, mat, tint] of CUBES) {
    const w = (to[0] - from[0]) * PX, h = (to[1] - from[1]) * PX, d = (to[2] - from[2]) * PX;
    const g = boxGeometry(w, h, d).clone();
    g.translate((from[0] + to[0]) / 2 * PX, (from[1] + to[1]) / 2 * PX, (from[2] + to[2]) / 2 * PX);
    const key = `${mat}:${tint}`; if (!byMat.has(key)) byMat.set(key, { mat, tint, parts: [] });
    byMat.get(key).parts.push(g);
  }
  for (const { mat, tint, parts } of byMat.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(parts, false), material(mat, tint));
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = `${name}:${mat}`; root.add(mesh);
    parts.forEach(p => p.dispose());
  }
  root.userData.spear = true;
  return root;
}
export const isSpearModel = name => typeof name === 'string' && name.startsWith('spear');

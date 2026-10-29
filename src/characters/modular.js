import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { APPEARANCE_OPTIONS, normalizeAppearance } from './appearance.js';

// Modular characters: one Blockbench library per body type (art/blockbench/parts.js)
// holds the base body rig plus every hair style, beard and outfit part. A
// character is assembled from an appearance and a list of parts; its texture is
// composed once (skin, hair and cloth tinted into a private copy of the atlas)
// so every bone still renders as a single merged mesh.
const BODIES = ['male', 'female'];
const libraries = {};
const HIDES_HAIR = new Set(['hood', 'iron_helmet', 'great_helm', 'guard_helmet']);
const FLATTENS_HAIR = new Set(['straw_hat', 'crown']);
const HIDES_BEARD = new Set(['great_helm', 'mask']);
export const DEFAULT_TINTS = {
  shirt: '#8a7f6a', tunic: '#3a5066', robe: '#6a2a2a', dress: '#4a5a3a', pants: '#4a3f35', cloak: '#2f3d4a',
  hood: '#33452f', tabard: '#7a2626', shawl: '#9a8f7a', headband: '#7a2626', mask: '#3c3833',
};

export async function loadModularLibrary(base = `${import.meta.env.BASE_URL}models/`) {
  const loader = new GLTFLoader();
  await Promise.all(BODIES.map(async body => {
    const [gltf, meta] = await Promise.all([loader.loadAsync(`${base}parts_${body}.gltf`), fetch(`${base}parts_${body}.json`).then(r => r.json())]);
    let map = null;
    gltf.scene.traverse(o => { if (o.isMesh && !map) map = o.material.map; });
    const parts = {};
    gltf.scene.traverse(o => { if (o.name.includes('|')) { const [part, bone] = o.name.split('|'); (parts[part] ??= []).push({ bone, node: o }); } });
    libraries[body] = { rig: gltf.scene.getObjectByName('root'), parts, meta, image: map.image };
  }));
}

// ── Face: brows, eyes and mouth are frames painted into the atlas' reserved
// strip and shown on three quads in front of the head; animation swaps UVs.
const EYE = { open: 0, out: 1, closed: 2, squint: 3 }, BROW = { neutral: 0, angry: 1, sad: 2, raised: 3 };
const MOUTH = ['closed', 'small', 'wide', 'smile', 'frown', 'grimace', 'o', 'smirk'];
const shadeHex = (hex, f) => '#' + new THREE.Color(hex).multiplyScalar(f).getHexString();

function paintFace(ctx, r, appearance) {
  const skin = APPEARANCE_OPTIONS.skins[appearance.skin], hair = APPEARANCE_OPTIONS.hairColors[appearance.hairColor];
  const C = { skin: shadeHex(skin, .92), lash: shadeHex(skin, .42), brow: shadeHex(hair, .72), white: '#d8d2c4', iris: APPEARANCE_OPTIONS.eyeColors[appearance.eyes],
    lip: shadeHex(skin, .62), dark: '#3a1c1a', inner: '#24100f', teeth: '#d8d2c4' };
  const px = (x, y, c) => { ctx.fillStyle = C[c] || c; ctx.fillRect(r.u + x, r.v + y, 1, 1); };
  ctx.fillStyle = C.skin; ctx.fillRect(r.u, r.v, r.w, r.h);
  // Eye frames: 16 cells of 4×4 in row 0 = brow variant × eye variant; pixels [inner, outer], rows [brow, eye].
  for (let brow = 0; brow < 4; brow++) for (let eye = 0; eye < 4; eye++) {
    const x = (brow * 4 + eye) * 4;
    if (brow === 0) { px(x, 0, 'brow'); px(x + 1, 0, 'brow'); }
    if (brow === 1) px(x, 0, 'brow');
    if (brow === 2) px(x + 1, 0, 'brow');
    if (eye === 0) { px(x, 1, 'iris'); px(x + 1, 1, 'white'); }
    if (eye === 1) { px(x, 1, 'white'); px(x + 1, 1, 'iris'); }
    if (eye === 2) { px(x, 1, 'lash'); px(x + 1, 1, 'lash'); }
    if (eye === 3) { px(x, 1, 'lash'); px(x + 1, 1, 'iris'); }
  }
  // Mouth frames: row 1 (y 4..7), 3×2 pixels each.
  const mouths = {
    closed: ['lll', '...'], small: ['ldl', '.d.'], wide: ['ddd', 'ddd'], smile: ['l.l', '.l.'], frown: ['.l.', 'l.l'],
    grimace: ['ttt', 'ddd'], o: ['.d.', '.d.'], smirk: ['..l', 'll.'],
  };
  MOUTH.forEach((name, i) => mouths[name].forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') px(i * 4 + x, 4 + y, ch === 'l' ? 'lip' : ch === 'd' ? (y ? 'inner' : 'dark') : 'teeth');
  })));
}

function createFace(head, atlas, reserved) {
  const S = 1 / 16, z = -3.5 * S - .004, y0 = -32.5;
  // [x from, x to] (u runs inner → outer for the eyes), y from/to in pixels.
  const quads = [[.5, 2.5, 36, 38], [-.5, -2.5, 36, 38], [-1.5, 1.5, 33, 35]];
  const positions = [], uvs = [], index = [];
  quads.forEach(([x0, x1, ya, yb]) => {
    const s = positions.length / 3;
    positions.push(x0 * S, (yb + y0) * S, z, x1 * S, (yb + y0) * S, z, x1 * S, (ya + y0) * S, z, x0 * S, (ya + y0) * S, z);
    uvs.push(0, 0, 0, 0, 0, 0, 0, 0);
    // Seen from the front (-Z) +X is on the viewer's left, so quads running toward
    // +X are counter-clockwise as written; the mirrored eye needs reversed winding.
    x1 > x0 ? index.push(s, s + 1, s + 2, s, s + 2, s + 3) : index.push(s, s + 2, s + 1, s, s + 3, s + 2);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(Array(12).fill(0).flatMap(() => [0, 0, -1]), 3));
  geometry.setIndex(index);
  const material = new THREE.MeshLambertMaterial({ map: atlas.map, emissive: 0xffffff, emissiveMap: atlas.map, emissiveIntensity: .2, polygonOffset: true, polygonOffsetFactor: -2 });
  const mesh = new THREE.Mesh(geometry, material); mesh.name = 'face'; head.add(mesh);
  const [W, H] = atlas.size, uv = geometry.attributes.uv;
  const setCell = (q, cellX, cellY, w, h) => {
    const u0 = (reserved.u + cellX) / W, u1 = (reserved.u + cellX + w) / W, v0 = (reserved.v + cellY) / H, v1 = (reserved.v + cellY + h) / H;
    const k = q * 4; uv.setXY(k, u0, v0); uv.setXY(k + 1, u1, v0); uv.setXY(k + 2, u1, v1); uv.setXY(k + 3, u0, v1);
  };
  let blinkIn = 1 + Math.random() * 3, blinkT = 0, mouthT = 0, mouthFrame = 'closed', last = '';
  const state = { mouth: 'closed', eyes: 'open' };
  function update(dt, { speaking = 0, expression = 'neutral', look = 0 } = {}) {
    blinkIn -= dt; if (blinkIn <= 0) { blinkT = .12; blinkIn = 2 + Math.random() * 4.5; }
    blinkT = Math.max(0, blinkT - dt);
    const brow = { angry: 'angry', sad: 'sad', surprised: 'raised', pain: 'angry' }[expression] || 'neutral';
    let eyes = expression === 'sleep' || expression === 'dead' ? 'closed' : expression === 'pain' ? 'squint' : 'open';
    if (blinkT > 0 && eyes === 'open') eyes = 'closed';
    mouthT -= dt;
    if (speaking > .08) {
      // Three openings from the voice loudness, each held at least ~90 ms so the mouth never flickers.
      const next = speaking > .5 ? 'wide' : speaking > .2 ? 'small' : 'closed';
      if (next !== mouthFrame && mouthT <= 0) { mouthFrame = next; mouthT = .09; }
    } else mouthFrame = { happy: 'smile', sad: 'frown', angry: 'grimace', surprised: 'o', pain: 'grimace', dead: 'small', smirk: 'smirk' }[expression] || 'closed';
    // Gaze: looking toward the model's right moves the right iris outward and the left one inward.
    const rightEye = eyes === 'open' ? (look > .4 ? 'out' : 'open') : eyes, leftEye = eyes === 'open' ? (look < -.4 ? 'out' : 'open') : eyes;
    const key = `${brow}${rightEye}${leftEye}${mouthFrame}`;
    if (key === last) return;
    last = key; state.mouth = mouthFrame; state.eyes = eyes;
    setCell(0, (BROW[brow] * 4 + EYE[rightEye]) * 4, 0, 2, 2);
    setCell(1, (BROW[brow] * 4 + EYE[leftEye]) * 4, 0, 2, 2);
    setCell(2, MOUTH.indexOf(mouthFrame) * 4, 4, 3, 2);
    uv.needsUpdate = true;
  }
  update(0);
  return { mesh, update, state };
}

function composeAtlas(lib, appearance, partIds, tints) {
  const [W, H] = lib.meta.atlas, canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(lib.image, 0, 0, W, H);
  ctx.globalCompositeOperation = 'multiply';
  for (const part of partIds) {
    const meta = lib.meta.parts[part]; if (!meta?.tint) continue;
    ctx.fillStyle = meta.tint === 'skin' ? APPEARANCE_OPTIONS.skins[appearance.skin] : meta.tint === 'hair' ? APPEARANCE_OPTIONS.hairColors[appearance.hairColor] : tints[part] || DEFAULT_TINTS[part] || '#888888';
    for (const [u, v, w, h] of meta.rects) ctx.fillRect(u, v, w, h);
  }
  ctx.globalCompositeOperation = 'source-over';
  paintFace(ctx, lib.meta.reserved, appearance);
  const map = new THREE.CanvasTexture(canvas);
  map.flipY = false; map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = map.minFilter = THREE.NearestFilter; map.generateMipmaps = false;
  return { map, size: [W, H] };
}

function resolveParts(appearance, outfit) {
  const parts = ['body', 'underwear', ...outfit];
  const headgear = outfit.find(p => HIDES_HAIR.has(p) || FLATTENS_HAIR.has(p));
  let hair = `hair_${appearance.hair}`;
  if (HIDES_HAIR.has(headgear)) hair = null;
  else if (FLATTENS_HAIR.has(headgear) && ['tousled', 'bun', 'long'].includes(appearance.hair)) hair = 'hair_short';
  if (hair) parts.push(hair);
  if (appearance.beard && appearance.body === 'male' && !outfit.some(p => HIDES_BEARD.has(p))) parts.push(`beard_${appearance.beard}`);
  return [...new Set(parts)];
}

function mergeBone(bone, material) {
  const meshes = bone.children.filter(c => c.isMesh && c.name !== 'face');
  if (meshes.length < 1) return;
  const geometries = meshes.map(m => {
    m.updateMatrix();
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    return g.applyMatrix4(m.matrix);
  });
  const mesh = new THREE.Mesh(mergeGeometries(geometries, false), material);
  geometries.forEach(g => g.dispose());
  mesh.name = `${bone.name}:mesh`; mesh.castShadow = mesh.receiveShadow = true;
  meshes.forEach(m => m.removeFromParent());
  bone.add(mesh);
}

/** Builds the visual body inside `root` (replacing an old one). */
function build(root, def) {
  const appearance = normalizeAppearance(def.appearance);
  const lib = libraries[appearance.body];
  root.userData.body?.removeFromParent();
  root.userData.material?.map.dispose(); root.userData.material?.dispose();
  const body = lib.rig.clone(true);
  const rig = {};
  body.traverse(o => { if (!o.isMesh && o.name) rig[o.name] = o; });
  rig.root = body;
  const partIds = resolveParts(appearance, def.outfit || []);
  for (const part of partIds) for (const { bone, node } of lib.parts[part] || []) {
    const target = rig[bone]; if (!target) continue;
    for (const mesh of node.children) if (mesh.isMesh) target.add(mesh.clone());
  }
  const atlas = composeAtlas(lib, appearance, partIds, def.tints || {});
  const material = new THREE.MeshLambertMaterial({ map: atlas.map, alphaTest: .5, emissive: 0xffffff, emissiveMap: atlas.map, emissiveIntensity: .2 });
  for (const bone of Object.values(rig)) mergeBone(bone, material);
  for (const bone of Object.values(rig)) bone.userData.rest = { position: bone.position.clone(), quaternion: bone.quaternion.clone() };
  const face = createFace(rig.head, atlas, lib.meta.reserved);
  root.add(body);
  const build = { slim: [.93, 1, .93], normal: [1, 1, 1], strong: [1.08, 1.02, 1.08] }[appearance.build];
  body.scale.set(...build);
  Object.assign(root.userData, { body, rig, face, material, appearance, outfit: [...(def.outfit || [])], tints: { ...(def.tints || {}) }, parts: partIds, kind: 'humanoid' });
  // Held items follow the new grip bone; arrows stuck in the body (systems/archery.js) their bones.
  if (root.userData.weapon) rig.grip_right.add(root.userData.weapon);
  for (const { object, bone } of root.userData.attached || []) (rig[bone] || body).add(object);
  return root;
}

/** def: { appearance, outfit: [part ids], tints: { part: '#hex' }, scale } */
export function createModularCharacter(def) {
  const root = new THREE.Group();
  root.scale.setScalar(def.scale || 1);
  root.userData.phase = Math.random() * 10;
  return build(root, def);
}

/** Swaps appearance and/or outfit on an existing character without replacing its root. */
export function restyleCharacter(root, changes) {
  const { appearance, outfit, tints } = root.userData;
  return build(root, { appearance: { ...appearance, ...(changes.appearance || {}) }, outfit: changes.outfit || outfit, tints: { ...tints, ...(changes.tints || {}) } });
}

export const modularLibraryLoaded = () => BODIES.every(b => libraries[b]);

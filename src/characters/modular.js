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
const TALL_HAIR = ['tousled', 'bun', 'long', 'mane', 'undercut', 'warrior'];
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
  paintOverlay(ctx, r, appearance, skin);
}

// ── Face details (character editor 2.0): one 7×7 cell (reserved strip, from row 8) laid over the whole front of the head, in front
// of the eye and mouth quads and transparent wherever nothing is painted. Rows run from the brow line down (0 forehead, 1 brows,
// 2 eyes, 3 under the eyes, 4–5 mouth, 6 chin), columns from the viewer's left. The eye row is kept clear so the eyes still show.
export const OVERLAY = { u: 0, v: 8, size: 7 };
export const OVERLAYS = {
  // Scars
  brow: ['.s.....', '.s.....', '.......', '.s.....', '.......', '.......', '.......'],
  cheek: ['.......', '.......', '.......', '......s', '.....s.', '.....s.', '.......'],
  lip: ['.......', '.......', '.......', '...s...', '.......', '.......', '...s...'],
  cross: ['.s.....', '.s.....', '.......', '.s....s', '.....s.', '.....s.', '.......'],
  // War paint
  ash: ['.......', '.......', 'a.....a', 'aaa.aaa', '.......', '.......', '.......'],
  claw: ['....c.c', '......c', '.......', '....c.c', '.....c.', '......c', '.......'],
  ochre: ['.......', '.......', '.......', '.......', '.......', '.o...o.', '.ooooo.'],
  woad: ['bb.....', 'b......', '.......', 'bbb....', 'bb.....', 'b......', '.......'],
  // Marks
  freckles: ['.......', '.......', '.......', 'f.f.f.f', '.f...f.', '.......', '.......'],
  mole: ['.......', '.......', '.......', '.......', '.....m.', '.......', '.......'],
  flush: ['.......', '.......', '.......', 'rr...rr', 'r.....r', '.......', '.......'],
  tired: ['.......', '.......', '.......', '.tt.tt.', '.......', '.......', '.......'],
  // The weathered face: lines on the brow and at the eyes' corners.
  weathered: ['.w.w.w.', '.......', '.......', 'w.....w', '.......', '.......', '.......'],
};
function paintOverlay(ctx, r, appearance, skin) {
  const x0 = r.u + OVERLAY.u, y0 = r.v + OVERLAY.v, base = new THREE.Color(skin);
  const mix = (hex, k) => '#' + base.clone().lerp(new THREE.Color(hex), k).getHexString();
  const colours = { s: shadeHex(mix('#f2d2c4', .5), 1.06), a: '#211d1a', c: '#3a2420', o: '#7a3a22', b: '#43586a', w: shadeHex(skin, .8), f: shadeHex(skin, .74),
    m: '#4a2e22', r: mix('#b0503c', .38), t: shadeHex(mix('#6a5a70', .25), .8) };
  ctx.clearRect(x0, y0, OVERLAY.size, OVERLAY.size);
  for (const id of [appearance.mark, appearance.face === 'weathered' ? 'weathered' : null, appearance.paint, appearance.scar || null]) {
    const map = OVERLAYS[id]; if (!map) continue;
    map.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { ctx.fillStyle = colours[ch]; ctx.fillRect(x0 + x, y0 + y, 1, 1); } }));
  }
}
// The resting look of each face: the brows and mouth it falls back to when nothing else moves them.
const REST = { calm: ['neutral', 'closed'], stern: ['angry', 'closed'], soft: ['neutral', 'smile'], weathered: ['sad', 'closed'] };

function createFace(head, atlas, reserved, look = 'calm') {
  const [restBrow, restMouth] = REST[look] || REST.calm;
  const S = 1 / 16, z = -3.5 * S - .004, y0 = -32.5;
  // [x from, x to] (u runs inner → outer for the eyes), y from/to in pixels.
  // The fourth quad is the details cell over the whole head front, a hair in front of the others.
  const quads = [[.5, 2.5, 36, 38], [-.5, -2.5, 36, 38], [-1.5, 1.5, 33, 35], [3.5, -3.5, 32, 39, -.002]];
  const positions = [], uvs = [], index = [];
  quads.forEach(([x0, x1, ya, yb, dz = 0]) => {
    const s = positions.length / 3, zq = z + dz;
    positions.push(x0 * S, (yb + y0) * S, zq, x1 * S, (yb + y0) * S, zq, x1 * S, (ya + y0) * S, zq, x0 * S, (ya + y0) * S, zq);
    uvs.push(0, 0, 0, 0, 0, 0, 0, 0);
    // Seen from the front (-Z) +X is on the viewer's left, so quads running toward
    // +X are counter-clockwise as written; the mirrored eye needs reversed winding.
    x1 > x0 ? index.push(s, s + 1, s + 2, s, s + 2, s + 3) : index.push(s, s + 2, s + 1, s, s + 3, s + 2);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(Array(16).fill(0).flatMap(() => [0, 0, -1]), 3));
  geometry.setIndex(index);
  const material = new THREE.MeshLambertMaterial({ map: atlas.map, emissive: 0xffffff, emissiveMap: atlas.map, emissiveIntensity: .2, polygonOffset: true, polygonOffsetFactor: -2, alphaTest: .5 });
  const mesh = new THREE.Mesh(geometry, material); mesh.name = 'face'; head.add(mesh);
  const [W, H] = atlas.size, uv = geometry.attributes.uv;
  const setCell = (q, cellX, cellY, w, h) => {
    const u0 = (reserved.u + cellX) / W, u1 = (reserved.u + cellX + w) / W, v0 = (reserved.v + cellY) / H, v1 = (reserved.v + cellY + h) / H;
    const k = q * 4; uv.setXY(k, u0, v0); uv.setXY(k + 1, u1, v0); uv.setXY(k + 2, u1, v1); uv.setXY(k + 3, u0, v1);
  };
  setCell(3, OVERLAY.u, OVERLAY.v, OVERLAY.size, OVERLAY.size);
  let blinkIn = 1 + Math.random() * 3, blinkT = 0, mouthT = 0, mouthFrame = 'closed', last = '';
  const state = { mouth: 'closed', eyes: 'open' };
  function update(dt, { speaking = 0, expression = 'neutral', look = 0 } = {}) {
    blinkIn -= dt; if (blinkIn <= 0) { blinkT = .12; blinkIn = 2 + Math.random() * 4.5; }
    blinkT = Math.max(0, blinkT - dt);
    const brow = { angry: 'angry', sad: 'sad', surprised: 'raised', pain: 'angry' }[expression] || restBrow;
    let eyes = expression === 'sleep' || expression === 'dead' ? 'closed' : expression === 'pain' ? 'squint' : 'open';
    if (blinkT > 0 && eyes === 'open') eyes = 'closed';
    mouthT -= dt;
    if (speaking > .08) {
      // Three openings from the voice loudness, each held at least ~90 ms so the mouth never flickers.
      const next = speaking > .5 ? 'wide' : speaking > .2 ? 'small' : 'closed';
      if (next !== mouthFrame && mouthT <= 0) { mouthFrame = next; mouthT = .09; }
    } else mouthFrame = { happy: 'smile', sad: 'frown', angry: 'grimace', surprised: 'o', pain: 'grimace', dead: 'small', smirk: 'smirk' }[expression] || restMouth;
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
  else if (FLATTENS_HAIR.has(headgear) && TALL_HAIR.includes(appearance.hair)) hair = 'hair_short';
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
  const face = createFace(rig.head, atlas, lib.meta.reserved, appearance.face);
  root.add(body);
  // Build widens, height (editor 2.0) stretches: three per cent a step, a little width with it.
  const build = { slim: [.93, 1, .93], normal: [1, 1, 1], strong: [1.08, 1.02, 1.08] }[appearance.build], tall = 1 + appearance.height * .03, wide = 1 + appearance.height * .015;
  body.scale.set(build[0] * wide, build[1] * tall, build[2] * wide);
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

// ── What a pixel of the atlas is: skin, hair, cloth, leather, mail or plate, and which face island it sits on.
// Blood (systems/blood.js) paints into the atlas copy of a character, so it needs to know whether a blow
// landed on bare skin, on a tunic or on a breastplate, and to stay inside the one face it hit.
const PART_CLASS = {
  body: 'skin', underwear: 'cloth',
  chainmail: 'mail', plate: 'plate', iron_helmet: 'plate', great_helm: 'plate', guard_helmet: 'plate', crown: 'plate',
  leather_armor: 'leather', vest: 'leather', bracers: 'leather', gloves: 'leather', boots: 'leather', shoes: 'leather', belt: 'leather', apron: 'leather',
  quiver: 'gear', scabbard: 'gear', satchel: 'gear', straw_hat: 'cloth',
};
const classOf = part => PART_CLASS[part] || (part.startsWith('hair_') || part.startsWith('beard_') ? 'hair' : 'cloth');
const atlasMaps = {};
/** { width, height, classes: ['skin', …], classAt: Uint8Array (class index + 1, 0 = none), islandAt: Int16Array (face island id, −1 = none), islands: [[u, v, w, h]] } */
export function atlasMapFor(root) {
  const body = root.userData.appearance?.body, lib = libraries[body];
  if (!lib) return null;
  if (atlasMaps[body]) return atlasMaps[body];
  const [width, height] = lib.meta.atlas, classes = ['skin', 'hair', 'cloth', 'leather', 'mail', 'plate', 'gear'];
  const classAt = new Uint8Array(width * height), islandAt = new Int16Array(width * height).fill(-1), islands = [];
  for (const [part, meta] of Object.entries(lib.meta.parts)) {
    const cls = classes.indexOf(classOf(part)) + 1;
    for (const [u, v, w, h] of meta.rects) {
      const id = islands.push([u, v, w, h]) - 1;
      for (let y = v; y < v + h && y < height; y++) for (let x = u; x < u + w && x < width; x++) { classAt[y * width + x] = cls; islandAt[y * width + x] = id; }
    }
  }
  return atlasMaps[body] = { width, height, classes, classAt, islandAt, islands };
}

import * as THREE from 'three';
import { block, blockOn, beam, crossGeometry } from '../art/blocks.js';
import { registerPixelTexture, pixelCanvas, pixelMaterial } from '../art/pixelTextures.js';
import { landscapeChunk } from './rocks.js';
import { wind, treesLoaded, placeTree, setFarTrees } from './trees.js';
export { wind };

// Blockbench-style vegetation: trunks and crowns are boxes, leaves are cutout
// pixel textures (both faces drawn, like fancy Minecraft leaves). Once the Blockbench trees are
// loaded (trees.js) every species below places one of those; the block versions remain for Node.
const PI = Math.PI;
const pick = (random, names) => names[Math.floor(random() * names.length) % names.length];

export function spruce(parent, x, y, z, scale, random) {
  if (treesLoaded()) return placeTree(parent, pick(random, ['spruce_1', 'spruce_2']), x, y, z, scale, random);
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(scale); g.rotation.y = random() * PI; parent.add(g);
  blockOn(g, .5, 6.6, .5, 'bark', 0, -.4, 0, 0, { solid: true });
  const leaves = random() < .12 ? pixelMaterial('spruceLeaves', { tint: 0xc9d8c4 }) : 'spruceLeaves';
  const layers = [[1.6, 4.4], [2.3, 3.1], [2.9, 3.7], [3.6, 2.6], [4.2, 3.0], [4.9, 2.0], [5.5, 2.3], [6.2, 1.4], [6.8, 1.0]];
  layers.forEach(([height, size], i) => {
    const s = size * (.92 + random() * .16);
    block(g, s, .62, s, leaves, (random() - .5) * .2, height, (random() - .5) * .2, 0, i % 2 ? PI / 4 : 0, 0);
  });
  block(g, .4, .9, .4, leaves, 0, 7.45, 0);
  return g;
}

export function broadleaf(parent, x, y, z, scale, random, kind = 'oak') {
  const names = { birch: ['birch_1', 'birch_2'], autumn: ['autumn_1', 'autumn_2'], maple: ['maple_1', 'maple_2'], birchGold: ['birch_gold_1', 'birch_gold_2'] }[kind] || ['oak_1', 'oak_2', 'oak_3'];
  if (treesLoaded()) return placeTree(parent, pick(random, names), x, y, z, scale, random);
  if (kind === 'maple') kind = 'autumn'; else if (kind === 'birchGold') kind = 'birch';
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(scale); g.rotation.y = random() * PI * 2; parent.add(g);
  const birch = kind === 'birch';
  const height = birch ? 5.6 : 4.4;
  blockOn(g, birch ? .45 : .7, height, birch ? .45 : .7, birch ? 'birch' : 'bark', 0, -.4, 0, 0, { solid: true });
  for (const side of [-1, 1]) beam(g, [0, height * .62, 0], [side * 1.4, height + .2, (random() - .5) * .8], birch ? .26 : .34, birch ? 'birch' : 'bark');
  const leaves = kind === 'autumn' ? 'autumnLeaves' : birch ? pixelMaterial('oakLeaves', { tint: 0xd6e8a8 }) : 'oakLeaves';
  const clusters = birch ? [[0, height + 1.2, 0, 2.4, 2.6], [-.9, height + .2, .3, 1.8, 1.6], [.9, height + .5, -.4, 1.8, 1.8]]
    : [[0, height + 1.3, 0, 3.6, 2.2], [-1.4, height + .5, .5, 2.4, 1.8], [1.4, height + .7, -.3, 2.6, 1.9], [.3, height + .3, 1.4, 2.2, 1.6], [-.2, height + 2.4, -.2, 2.2, 1.2]];
  for (const [cx, cy, cz, size, tall] of clusters) {
    const s = size * (.9 + random() * .2);
    block(g, s, tall, s, leaves, cx, cy, cz, 0, (random() - .5) * .5, 0);
  }
  return g;
}

export function deadTree(parent, x, y, z, scale, random) {
  if (treesLoaded()) return placeTree(parent, 'dead_1', x, y, z, scale, random);
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(scale); g.rotation.y = random() * PI * 2; parent.add(g);
  blockOn(g, .55, 4.8, .55, 'bark', 0, -.3, 0, 0, { solid: true });
  beam(g, [0, 2.6, 0], [1.3, 4.0, .2], .28, 'bark');
  beam(g, [1.3, 4.0, .2], [1.7, 4.9, .6], .2, 'bark');
  beam(g, [0, 3.4, 0], [-1.1, 4.6, -.4], .24, 'bark');
  beam(g, [0, 4.2, 0], [.3, 5.4, -.9], .2, 'bark');
  return g;
}

export function boulder(parent, x, y, z, size, random, mossy = false) {
  const g = new THREE.Group(); g.position.set(x, y - size * .25, z); g.rotation.y = random() * PI * 2; parent.add(g);
  const pieces = size > 1.1 ? 3 : 2;
  for (let i = 0; i < pieces; i++) {
    const w = size * (1.1 - i * .25) * (.85 + random() * .3), h = size * (.7 - i * .12) * (.8 + random() * .4), d = size * (.9 - i * .2) * (.85 + random() * .3);
    const tex = mossy && i === pieces - 1 ? 'cobbleMossy' : i ? 'stone' : 'stoneLight';
    block(g, w, h, d, tex, (random() - .5) * size * .5, h * .4 + i * size * .18, (random() - .5) * size * .5,
      (random() - .5) * .35, random() * PI, (random() - .5) * .35, { solid: size > .5 });
  }
  return g;
}

export function bush(parent, x, y, z, size, random) {
  if (treesLoaded()) return placeTree(parent, random() < .7 ? 'bush_1' : 'bush_2', x, y, z, size * .65, random, { solid: false });
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = random() * PI; parent.add(g);
  block(g, size, size * .75, size, 'oakLeaves', 0, size * .3, 0);
  if (size > .9) block(g, size * .7, size * .6, size * .7, 'oakLeaves', size * .3, size * .55, -size * .2, 0, .4, 0);
  return g;
}

/** Tall, narrow taiga conifer; above the snow line its boughs carry snow. */
export function pine(parent, x, y, z, scale, random, snowy = false) {
  if (treesLoaded()) return placeTree(parent, pick(random, snowy ? ['pine_snow_1', 'pine_snow_2'] : ['pine_1', 'pine_2']), x, y, z, scale, random);
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(scale); g.rotation.y = random() * PI; parent.add(g);
  blockOn(g, .55, 9.5, .55, 'bark', 0, -.4, 0, 0, { solid: true });
  const leaves = snowy ? 'snowyPine' : 'pineLeaves';
  for (let i = 0; i < 9; i++) {
    const s = (3.1 - i * .3) * (.92 + random() * .16);
    block(g, s, .7, s, leaves, (random() - .5) * .15, 2.2 + i * .85, (random() - .5) * .15, 0, i % 2 ? PI / 4 : 0, 0);
  }
  block(g, .45, 1.1, .45, leaves, 0, 10.2, 0);
  return g;
}

// ── Ground sprites: eight sprites in one atlas, one instanced mesh per chunk.
// Extra meadow sprites: short grass, lavender, pink campion and daisies.
registerPixelTexture('grassShort', p => {
  p.clear();
  for (let i = 0; i < 14; i++) {
    let x = 1 + Math.floor(p.random() * 14); const h = 3 + Math.floor(p.random() * 5), lean = p.random() < .5 ? -1 : 1;
    const ramp = p.random() < .3 ? ['#4f6a2e', '#647e36', '#7a9040', '#8ea44a', '#a0b452'] : ['#3a5a2c', '#476a33', '#55793b', '#638944', '#72984c'];
    for (let j = 0; j < h; j++) { p.set(x, 15 - j, ramp[Math.min(4, Math.floor(j / h * 5))]); if (j > h * .6 && p.random() < .35) x += lean; }
  }
}, { cutout: true });
const bloom = (p, petal, centre, stems = 4) => {
  p.clear();
  for (let i = 0; i < stems; i++) {
    const x = 2 + Math.floor(p.random() * 12), top = 3 + Math.floor(p.random() * 7);
    for (let y = top + 2; y < 16; y++) p.set(x, y, ['#3f6230', '#4c7238', '#5a8240'][(y + x) % 3]);
    for (const [dx, dy] of [[0, 0], [-1, 1], [1, 1], [0, 2], [0, 1]]) p.set(x + dx, top + dy, petal[(dx + dy + 3) % petal.length]);
    if (centre) p.set(x, top + 1, centre);
  }
};
registerPixelTexture('flowerPurple', p => {
  p.clear();
  for (let i = 0; i < 5; i++) { const x = 2 + Math.floor(p.random() * 12), top = 2 + Math.floor(p.random() * 6); for (let y = top; y < 16; y++) p.set(x, y, y < top + 5 ? ['#7a5aa8', '#8f6ec0', '#a585d4'][(y + i) % 3] : '#4c6a38'); }
}, { cutout: true });
registerPixelTexture('flowerPink', p => bloom(p, ['#c25a86', '#d873a0', '#e88fb6'], '#f2d24a', 4), { cutout: true });
registerPixelTexture('daisy', p => bloom(p, ['#f2f0e8', '#e6e2d6', '#ffffff'], '#f0c23a', 5), { cutout: true });
const SPRITES = ['tallGrass', 'fern', 'flowerRed', 'flowerYellow', 'flowerBlue', 'flowerWhite', 'reeds', 'deadGrass', 'grassShort', 'flowerPurple', 'flowerPink', 'daisy'];
const FLOWERS = ['flowerRed', 'flowerYellow', 'flowerBlue', 'flowerWhite', 'flowerPurple', 'flowerPink', 'daisy'];
const SPRITE = Object.fromEntries(SPRITES.map((n, i) => [n, i]));
let atlasTexture = null;
function spriteAtlas() {
  if (atlasTexture) return atlasTexture;
  const canvas = document.createElement('canvas'); canvas.width = 16 * SPRITES.length; canvas.height = 16;
  const ctx = canvas.getContext('2d');
  SPRITES.forEach((name, i) => ctx.drawImage(pixelCanvas(name), i * 16, 0));
  atlasTexture = new THREE.CanvasTexture(canvas);
  atlasTexture.colorSpace = THREE.SRGBColorSpace;
  atlasTexture.magFilter = atlasTexture.minFilter = THREE.NearestFilter;
  atlasTexture.generateMipmaps = false;
  return atlasTexture;
}
let spriteMaterial = null, spriteGeometry = null;
function groundMaterial() {
  if (spriteMaterial) return spriteMaterial;
  spriteMaterial = new THREE.MeshLambertMaterial({ map: spriteAtlas(), alphaTest: .5, side: THREE.DoubleSide });
  spriteMaterial.onBeforeCompile = shader => {
    shader.uniforms.uWind = wind;
    // Sprites carry up-facing normals; never flip them on back faces, or half of
    // every crossed quad renders unlit.
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>',
      THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'));
    shader.vertexShader = 'uniform float uWind;\nattribute float aSprite;\n' + shader.vertexShader
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv.x = (vMapUv.x + aSprite) / ' + SPRITES.length + '.;')
      .replace('#include <begin_vertex>', [
        '#include <begin_vertex>',
        'vec3 spriteWorld = (modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.)).xyz;',
        'float sway = sin(uWind * 1.7 + spriteWorld.x * .31 + spriteWorld.z * .23) + .45 * sin(uWind * 3.1 + spriteWorld.z * .7);',
        '// Snap the sway to 1/16 steps so tips move in whole texels.',
        'transformed.x += floor(sway * uv.y * 2.4 + .5) / 16.;',
        'transformed.z += floor(cos(uWind * 1.3 + spriteWorld.x * .2) * uv.y * 1.6 + .5) / 16.;'].join('\n'));
  };
  spriteGeometry = crossGeometry(1, 1);
  return spriteMaterial;
}
export let groundDensity = .75;
export function setGroundDensity(quality) { groundDensity = quality === 'low' ? .4 : quality === 'medium' ? .75 : 1; }

/** Grass, ferns, flowers and reeds for one chunk, chosen by biome. */
export function groundCoverChunk(field, biomeWeights, waterLevel, x0, z0, size, random, avoid) {
  const material = groundMaterial(), items = [];
  const target = Math.round(1250 * groundDensity);
  // Meadows bloom in patches, each with a leading colour; between them grass of two heights.
  const patch = (x, z, k) => .5 + .25 * Math.sin(x * .043 + k) * Math.cos(z * .051 - k * 1.7) + .25 * Math.sin((x + z) * .11 + k * 3.1);
  for (let i = 0; i < target; i++) {
    const x = x0 + random() * size, z = z0 + random() * size, h = field.heightAt(x, z);
    if (h > 44 || field.roadClearance(x, z) < 1 || avoid(x, z)) continue;
    const w = biomeWeights(x, z), roll = random();
    const shore = h < waterLevel + 1.1 && h > waterLevel - .5;
    if (h < waterLevel + .2 && !shore) continue;
    if (Math.abs(field.heightAt(x + 1, z) - h) + Math.abs(field.heightAt(x, z + 1) - h) > 1.2) continue;
    let sprite;
    if (shore || (w.marsh > .5 && roll < .5)) sprite = SPRITE.reeds;
    else if (w.taiga > .5) sprite = roll < .35 ? SPRITE.fern : roll < .6 ? SPRITE.deadGrass : SPRITE.tallGrass;
    else if (w.autumn > .5) sprite = roll < .4 ? SPRITE.deadGrass : roll < .55 ? SPRITE.fern : roll < .6 ? SPRITE.flowerYellow : SPRITE.tallGrass;
    else if (w.forest > .6 && roll < .3) sprite = SPRITE.fern;
    else if (roll < .05 + w.plains * .08 + Math.max(0, patch(x, z, 0) - .62) * 2.2 * (1 - w.taiga)) {
      const lead = FLOWERS[Math.floor(patch(x, z, 5) * 7) % FLOWERS.length];
      sprite = SPRITE[random() < .7 ? lead : FLOWERS[Math.floor(random() * FLOWERS.length)]];
    } else sprite = random() < .45 ? SPRITE.grassShort : SPRITE.tallGrass;
    if (sprite === SPRITE.tallGrass && random() > .55 + w.plains * .3 - w.taiga * .2) continue;
    items.push([x, h, z, sprite, w]);
  }
  if (!items.length) return null;
  const mesh = new THREE.InstancedMesh(spriteGeometry.clone(), material, items.length);
  const sprites = new Float32Array(items.length), dummy = new THREE.Object3D(), tint = new THREE.Color();
  items.forEach(([x, y, z, sprite, w], i) => {
    const flower = FLOWERS.includes(SPRITES[sprite]);
    dummy.position.set(x, y - .04, z); dummy.rotation.set(0, random() * PI, 0);
    const s = flower ? .7 + random() * .25 : sprite === SPRITE.reeds ? 1.2 + random() * .5 : sprite === SPRITE.fern ? 1 + random() * .3 : sprite === SPRITE.grassShort ? .6 + random() * .3 : .75 + random() * .45;
    dummy.scale.set(s, s * (flower ? 1 : .85 + random() * .3), s); dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    const v = .86 + random() * .2;
    if (flower) tint.setScalar(1);
    // Autumn ferns turn rust-brown.
    else if (sprite === SPRITE.fern && w.autumn > .5) tint.setRGB(v * 1.3, v * .72, v * .38);
    else tint.setRGB(v * (1 + w.autumn * .08), v * (1 - w.autumn * .1), v * (1 - w.autumn * .3 - w.plains * .1));
    mesh.setColorAt(i, tint); sprites[i] = sprite;
  });
  mesh.geometry.setAttribute('aSprite', new THREE.InstancedBufferAttribute(sprites, 1));
  mesh.receiveShadow = true; mesh.castShadow = false;
  mesh.computeBoundingSphere(); mesh.boundingSphere.radius += 1.5;
  mesh.name = 'Ground sprites';
  return mesh;
}

/** Trees, rocks and bushes for one chunk, chosen by biome and terrain. */
// ── Small things that make a walk worth looking around: stumps, fallen trunks, mushrooms, rock
// groups at slope breaks, and wayside finds along the roads.
const grp = (parent, x, y, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g); return g; };
export function stump(parent, x, y, z, s, random) {
  const g = grp(parent, x, y, z, random() * PI);
  blockOn(g, .75 * s, .5 * s, .75 * s, 'bark', 0, -.05, 0, 0, { solid: true });
  blockOn(g, .62 * s, .04, .62 * s, 'logTop', 0, .45 * s, 0);
  for (const a of [0, 2.1, 4.2]) { const r = block(g, .2 * s, .2 * s, .55 * s, 'bark', Math.sin(a) * .45 * s, .05, Math.cos(a) * .45 * s, -.35, a, 0); r.castShadow = false; }
  if (random() < .5) blockOn(g, .3 * s, .1, .3 * s, 'oakLeaves', .15 * s, .47 * s, -.1 * s);
  return g;
}
export function fallenLog(parent, x, y, z, s, random) {
  const g = grp(parent, x, y, z, random() * PI), len = (3 + random() * 2.5) * s;
  const log = block(g, len, .6 * s, .6 * s, 'bark', 0, .28 * s, 0, 0, 0, .04, { solid: true }); log.userData.solid = true;
  for (const sx of [-1, 1]) block(g, .04, .5 * s, .5 * s, 'logTop', sx * (len / 2 + .02), .28 * s, 0);
  if (random() < .6) block(g, len * .4, .1, .5 * s, 'oakLeaves', (random() - .5) * len * .4, .6 * s, 0);
  if (random() < .5) block(g, .16, .9 * s, .16, 'bark', len * .3, .7 * s, .1, .3, 0, .6);
  return g;
}
export function mushrooms(parent, x, y, z, random) {
  const g = grp(parent, x, y, z, random() * PI), cap = pixelMaterial('clothRed', { tint: random() < .5 ? 0xc8503a : 0x9a6a44 });
  for (let i = 0, n = 3 + Math.floor(random() * 4); i < n; i++) {
    const px = (random() - .5) * .9, pz = (random() - .5) * .9, h = .12 + random() * .2;
    blockOn(g, .06, h, .06, 'clothLinen', px, 0, pz); blockOn(g, .18 + random() * .1, .07, .18 + random() * .1, cap, px, h, pz);
  }
  return g;
}
export function rockGroup(parent, x, y, z, s, random) {
  const g = grp(parent, x, y, z, random() * PI);
  for (let i = 0, n = 3 + Math.floor(random() * 3); i < n; i++) boulder(g, (random() - .5) * 3 * s, 0, (random() - .5) * 3 * s, (.5 + random() * 1.4) * s, random, random() < .5);
  return g;
}
// Autumn woods: drifts of fallen leaves, fairy rings of mushrooms, and now and then a hunter's
// raised hide at the edge of a clearing.
export function leafPile(parent, x, y, z, s, random) {
  const g = grp(parent, x, y, z, random() * PI);
  const tints = [0xffffff, 0xf0c080, 0xd06040, 0xe8a050];
  for (let i = 0, n = 3 + Math.floor(random() * 3); i < n; i++) {
    const w = (.7 + random() * .7) * s, d = (.6 + random() * .6) * s;
    blockOn(g, w, (.18 + random() * .2) * s, d, pixelMaterial('autumnLeaves', { tint: tints[Math.floor(random() * tints.length)] }), (random() - .5) * 1.2 * s, -.05, (random() - .5) * 1.2 * s, random() * PI);
  }
  return g;
}
export function mushroomRing(parent, x, y, z, field, random) {
  const g = grp(parent, x, y, z), radius = 1.1 + random() * 1.2, n = 9 + Math.floor(random() * 6);
  const cap = pixelMaterial('clothRed', { tint: random() < .6 ? 0xc8503a : 0xc8b48c }), stem = pixelMaterial('clothLinen');
  for (let i = 0; i < n; i++) {
    const a = i / n * PI * 2 + random() * .3, px = Math.cos(a) * radius, pz = Math.sin(a) * radius, py = field.heightAt(x + px, z + pz) - y, h = .1 + random() * .16;
    blockOn(g, .06, h, .06, stem, px, py, pz); blockOn(g, .16 + random() * .08, .06, .16 + random() * .08, cap, px, py + h, pz);
  }
  return g;
}
export function hunterStand(parent, x, y, z, ry, random) {
  const g = grp(parent, x, y, z, ry), deck = 2.6;
  for (const [px, pz] of [[-.8, -.8], [.8, -.8], [-.8, .8], [.8, .8]]) blockOn(g, .16, deck + 1.1, .16, 'darkPlanks', px, 0, pz, 0, { solid: true });
  blockOn(g, 1.9, .12, 1.9, 'planks', 0, deck, 0);
  for (const side of [-1, 1]) { blockOn(g, 1.9, .1, .08, 'darkPlanks', 0, deck + .8, side * .9); blockOn(g, .08, .1, 1.9, 'darkPlanks', side * .9, deck + .8, 0); }
  blockOn(g, 2.1, .1, 2.1, 'thatch', 0, deck + 1.6, 0);
  for (const [px, pz] of [[-.8, -.8], [.8, -.8], [-.8, .8], [.8, .8]]) blockOn(g, .1, .5, .1, 'darkPlanks', px, deck + 1.1, pz);
  // A ladder leaning against the front.
  const ladder = grp(g, 0, 0, 1.4); ladder.rotation.x = -.32;
  for (const sx of [-.25, .25]) blockOn(ladder, .07, 2.9, .07, 'planks', sx, 0, 0);
  for (let k = .35; k < 2.8; k += .42) blockOn(ladder, .5, .05, .06, 'planks', 0, k, 0);
  return g;
}
// Wayside finds: a cairn, a broken cart with spilled sacks, a weathered wayside cross.
export function waysideFind(parent, x, y, z, ry, random) {
  const g = grp(parent, x, y, z, ry), roll = random();
  if (roll < .4) for (let i = 0; i < 5; i++) blockOn(g, .5 - i * .07, .22, .45 - i * .06, i % 2 ? 'stone' : 'stoneLight', (random() - .5) * .08, i * .21, 0, random());
  else if (roll < .7) {
    blockOn(g, 1.3, .4, 2.1, 'planks', 0, .3, 0, 0, { solid: true }).rotation.z = .25;
    const wheel = blockOn(g, .14, .9, .9, 'darkPlanks', .8, 0, .4); wheel.rotation.x = .3; wheel.rotation.z = 1.3;
    for (let i = 0; i < 3; i++) blockOn(g, .5, .35, .4, 'clothLinen', -.9 - random() * .5, 0, -.6 + i * .5, random());
  } else {
    blockOn(g, .16, 1.9, .16, 'darkPlanks', 0, 0, 0); blockOn(g, .9, .14, .14, 'darkPlanks', 0, 1.35, 0);
    blockOn(g, .3, .22, .24, 'stoneLight', 0, -.05, 0); blockOn(g, .2, .2, .06, pixelMaterial('flowerYellow'), .12, .1, .12);
  }
  return g;
}
function details(parent, field, biomeWeights, waterLevel, x0, z0, size, random, avoid) {
  let standPlaced = false;
  for (let i = 0; i < 26; i++) {
    const x = x0 + random() * size, z = z0 + random() * size, h = field.heightAt(x, z);
    if (h < waterLevel + .6 || h > 60 || avoid(x, z)) continue;
    const road = field.roadClearance(x, z);
    if (road < 1.5) continue;
    const slope = Math.abs(field.heightAt(x + 1.5, z) - h) + Math.abs(field.heightAt(x, z + 1.5) - h), w = biomeWeights(x, z), roll = random();
    const wooded = Math.min(1, w.taiga + w.autumn + w.forest);
    if (road < 7 && roll < .1) { const r = field.roadAt(x, z); waysideFind(parent, x, h, z, r ? Math.atan2(r.x - x, r.z - z) : 0, random); }
    else if (w.autumn > .5 && slope < 1.2 && roll < .32) {
      if (roll < .24) leafPile(parent, x, h, z, .8 + random() * .6, random);
      else if (roll < .31) mushroomRing(parent, x, h, z, field, random);
      else if (!standPlaced && road > 10) { standPlaced = true; hunterStand(parent, x, h, z, random() * PI * 2, random); }
    }
    else if (slope > 1.6 && slope < 3.5 && roll < .45) rockGroup(parent, x, h, z, .7 + random() * .5, random);
    else if (wooded > .3 && roll < .38) stump(parent, x, h, z, .8 + random() * .5, random);
    else if (wooded > .3 && roll < .58) fallenLog(parent, x, h, z, .8 + random() * .4, random);
    else if (wooded > .2 && roll < .8) mushrooms(parent, x, h, z, random);
    else if (roll < .86) stump(parent, x, h, z, .7 + random() * .4, random);
  }
}

export function scatterChunk(parent, field, biomeWeights, waterLevel, x0, z0, size, random, avoid) {
  setFarTrees(true);
  try { scatterTrees(parent, field, biomeWeights, waterLevel, x0, z0, size, random, avoid); } finally { setFarTrees(false); }
}
function scatterTrees(parent, field, biomeWeights, waterLevel, x0, z0, size, random, avoid) {
  // Cliffs, stamps and landmarks first (rocks.js); trees and small things keep out of what they claim.
  const claimed = landscapeChunk(parent, field, biomeWeights, waterLevel, x0, z0, size, random, avoid);
  const outer = avoid;
  avoid = (x, z) => outer(x, z) || claimed.some(p => Math.hypot(p.x - x, p.z - z) < p.r);
  for (let i = 0; i < 95; i++) {
    const x = x0 + random() * size, z = z0 + random() * size, h = field.heightAt(x, z);
    if (h < waterLevel + .8 || field.roadClearance(x, z) < 4 || avoid(x, z)) continue;
    const slope = Math.abs(field.heightAt(x + 1.5, z) - h) + Math.abs(field.heightAt(x, z + 1.5) - h);
    const w = biomeWeights(x, z), roll = random();
    if (h > 40 || slope > 2.2) {
      // High ground and steep slopes: a few half-sunk boulders, not a field of loose slabs.
      if (roll < .06) { const size = 1 + random() * 1.6; boulder(parent, x, h - .3 * size, z, size, random, random() < .3); }
      else if (h < 70 && slope < 2.2 && roll < .55) pine(parent, x, h, z, .8 + random() * .4, random, h > 46);
      continue;
    }
    if (w.marsh > .5) { if (roll < .1) deadTree(parent, x, h, z, .8 + random() * .5, random); else if (roll < .22) bush(parent, x, h, z, .6 + random() * .6, random); continue; }
    const wooded = Math.min(1, w.taiga + w.autumn + w.forest);
    const density = w.taiga + w.autumn * .85 + w.forest * .85 + (1 - wooded) * (.18 - w.plains * .14);
    if (roll > density) {
      if (random() < .08) boulder(parent, x, h, z, .4 + random() * .9, random, random() < .3);
      else if (random() < .06) bush(parent, x, h, z, .7 + random() * .6, random);
      continue;
    }
    const s = .75 + random() * .6;
    if (w.taiga > .5) random() < .85 ? pine(parent, x, h, z, s, random) : spruce(parent, x, h, z, s, random);
    // Autumn woods: orange oaks, red maples, golden birches, a few dark spruces and dead trees.
    else if (w.autumn > .5) { const k = random(); k < .9 ? broadleaf(parent, x, h, z, s, random, k < .34 ? 'autumn' : k < .56 ? 'maple' : k < .76 ? 'birchGold' : k < .82 ? 'oak' : 'autumn') : k < .96 ? spruce(parent, x, h, z, s, random) : deadTree(parent, x, h, z, s, random); }
    else if (w.forest > .5) random() < .75 ? spruce(parent, x, h, z, s, random) : broadleaf(parent, x, h, z, s, random, random() < .5 ? 'birch' : 'oak');
    else if (random() < .04) deadTree(parent, x, h, z, s, random);
    else broadleaf(parent, x, h, z, s, random, random() < .5 ? 'birch' : random() < .7 ? 'oak' : 'autumn');
  }
  details(parent, field, biomeWeights, waterLevel, x0, z0, size, random, avoid);
}

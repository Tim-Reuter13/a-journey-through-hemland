import * as THREE from 'three';
import { blockOn, beam, crossGeometry } from '../art/blocks.js';
import { pixelMaterial } from '../art/pixelTextures.js';

// Origins are floor/surface centres; +z is the usable front. Wall props have
// their mounting face at -depth/2. POIs use the group's parent coordinates.
const sizes = {
  bed: [1.45, 2.8], bunk: [1.65, 2.8], table: [1.8, 1.1], chair: [.7, .75],
  stool: [.6, .6], bench: [1.8, .55], shelf: [1.5, .55], bookshelf: [1.5, .55],
  wardrobe: [1.35, .7], chest: [1.15, .65], barrel: [.85, .85], crate: [.8, .8],
  fireplace: [2, 1.1], cauldron: [.8, .7], candle: [.22, .22], rug: [1.8, 2.4],
  counter: [2.8, .85], kegRack: [2, .85], weaponRack: [1.6, .65],
  armourStand: [1, .7], anvil: [1.2, .7], workbench: [2, .85], loom: [1.6, .8],
  plate: [.38, .38], cup: [.24, .2], bottle: [.2, .2], bread: [.4, .26],
  apple: [.2, .2], cheeseWheel: [.38, .38], bowl: [.32, .32], jar: [.28, .28],
  book: [.3, .38], hangingHerbs: [.7, .25], banner: [1, .18], bucket: [.45, .45],
  broom: [.42, .18], firewoodStack: [1.2, .75], grainSack: [.65, .65],
  wallTorch: [.32, .4], throne: [2, 1.8], brazier: [.7, .7], bardCorner: [1.5, 1.2],
};

export function furnitureFootprint(kind, options = {}) {
  if (!Object.hasOwn(sizes, kind)) throw new RangeError(`Unknown furniture: ${kind}`);
  let [width, depth] = sizes[kind];
  if (kind === 'table' && options.variant === 'long') [width, depth] = [3, 1.1];
  if (kind === 'table' && options.variant === 'round') [width, depth] = [1.5, 1.5];
  if (kind === 'rug') { width = options.width ?? width; depth = options.depth ?? depth; }
  if (!(width > 0 && depth > 0 && Number.isFinite(width + depth))) throw new RangeError('Invalid furniture size');
  return { width, depth };
}

const put = (g, w, h, d, mat, x = 0, y = 0, z = 0, solid = true) => blockOn(g, w, h, d, mat, x, y, z, 0, { solid });
const tint = (name, color) => pixelMaterial(name, { tint: color });
function poi(g, kind, y = 0, z = 0, x = 0) {
  const a = g.rotation.y, c = Math.cos(a), s = Math.sin(a);
  g.userData.poi = { kind, x: g.position.x + x * c + z * s, y: g.position.y + y,
    z: g.position.z - x * s + z * c, facing: a };
}
const interact = (g, kind, label) => { g.userData.interact = { kind, label }; };
function loose(g, item, half, mass) {
  // Keep a bottom origin for placement and a centred, visual-sized physics box.
  const bounds = new THREE.Box3();
  for (const child of g.children) {
    if (!child.isMesh) continue;
    child.geometry.computeBoundingBox(); child.updateMatrix();
    bounds.union(child.geometry.boundingBox.clone().applyMatrix4(child.matrix));
  }
  const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
  for (const child of g.children) { child.position.x -= center.x; child.position.z -= center.z; child.position.y -= bounds.min.y; }
  half = size.toArray().map(v => v / 2);
  g.userData.footprint = { width: size.x, depth: size.z };
  g.userData.item = item;
  g.userData.physics = { shape: 'box', half, mass, center: [0, half[1], 0] };
  g.userData.restPose = 'upright';
  interact(g, 'take', 'Nehmen');
}

/** Surface coordinates are in parent space; offsets and jitter are surface-local. */
export function placeOnSurface(parent, kind, surface, { x = 0, z = 0, yaw = 0, options = {}, dynamic = true } = {}) {
  if (!builders[kind] || !Number.isFinite(surface.topY)) throw new RangeError('Invalid surface item');
  const rotation = surface.rotation ?? 0, c = Math.cos(rotation), s = Math.sin(rotation);
  yaw = Math.max(-.09, Math.min(.09, yaw));
  const g = factory(kind)(parent, (surface.x ?? 0) + x * c + z * s, surface.topY,
    (surface.z ?? 0) - x * s + z * c, rotation + yaw, { light: false, ...options });
  const f = g.userData.footprint, a = Math.abs(Math.cos(yaw)), b = Math.abs(Math.sin(yaw));
  const width = a * f.width + b * f.depth, depth = b * f.width + a * f.depth;
  const occupied = surface.occupied ??= [];
  if (Math.abs(x) + width / 2 > surface.width / 2 + 1e-7 || Math.abs(z) + depth / 2 > surface.depth / 2 + 1e-7 ||
      occupied.some(p => Math.abs(p.x - x) < (p.width + width) / 2 + .025 && Math.abs(p.z - z) < (p.depth + depth) / 2 + .025)) {
    parent.remove(g); return null;
  }
  occupied.push({ x, z, width, depth });
  g.rotation.x = g.rotation.z = 0;
  g.userData.surface = { x: surface.x ?? 0, z: surface.z ?? 0, topY: surface.topY,
    width: surface.width, depth: surface.depth, rotation, offsetX: x, offsetZ: z, widthUsed: width, depthUsed: depth };
  if (!dynamic) { delete g.userData.physics; delete g.userData.item; delete g.userData.interact; g.userData.display = true; }
  return g;
}
function legs(g, w, d, height, size = .14, y = 0) {
  for (const x of [-1, 1]) for (const z of [-1, 1]) put(g, size, height, size, 'timber', x * (w - size) / 2, y, z * (d - size) / 2);
}
const flames = new Map();
function fire(g, y, width = .65, height = .8, light = true, z = 0) {
  const key = `${width}/${height}`;
  if (!flames.has(key)) flames.set(key, crossGeometry(width, height));
  const mesh = new THREE.Mesh(flames.get(key), pixelMaterial('flame', { emissive: 1 }));
  mesh.position.set(0, y, z); mesh.name = 'flame'; g.add(mesh);
  const anchor = new THREE.Object3D(); anchor.name = 'lamp_anchor'; anchor.position.set(0, y + height / 2, z);
  anchor.userData.lightAnchor = { color: 0xffae61, intensity: typeof light === 'number' ? light : 2.5, distance: 7, decay: 2 };
  g.add(anchor);
  if (light) { const lamp = new THREE.PointLight(0xffae61, typeof light === 'number' ? light : 2.5, 7, 2); lamp.position.set(0, y + height / 2, z); g.add(lamp); }
}
function mattress(g, y, o) {
  put(g, 1.17, .22, 2.5, 'hay', 0, y);
  put(g, 1.17, .06, 1.65, o.cloth ?? 'clothBlue', 0, y + .22, .425, false);
  put(g, .85, .14, .5, 'clothLinen', 0, y + .22, -.91, false);
}
function bedFrame(g, y, o) {
  put(g, 1.45, .16, 2.5, 'planks', 0, y);
  for (const z of [-1.325, 1.325]) put(g, 1.17, .5, .15, 'planksVertical', 0, y, z);
  mattress(g, y + .16, o);
}
function tableTop(g, o, height = 1.1) {
  const { width: w, depth: d } = furnitureFootprint('table', o);
  if (o.variant === 'round') {
    // A stepped octagonal outline, made from three adjacent boxes.
    put(g, 1.5, .14, .75, 'planks', 0, height - .14);
    for (const z of [-.5625, .5625]) put(g, .75, .14, .375, 'planks', 0, height - .14, z);
    put(g, .32, height - .14, .32, 'timber');
    put(g, 1.05, .12, .65, 'darkPlanks', 0, 0, 0);
  } else { legs(g, w - .12, d - .12, height - .14); put(g, w, .14, d, 'planks', 0, height - .14); }
}
function cabinet(g, books, o) {
  for (const x of [-.69, .69]) put(g, .12, 2.25, .55, 'timber', x);
  put(g, 1.26, 2.25, .06, 'darkPlanks', 0, 0, -.245);
  for (const y of [0, .7, 1.4, 2.13]) {
    put(g, 1.26, .12, .49, 'planks', 0, y, .03);
    if (y > 2) continue;
    const surface = { topY: y + .12, width: 1.26, depth: .43, x: 0, z: .03 };
    if (books) {
      for (let i = 0; i < (o.sparse ? 1 : 6); i++) {
        placeOnSurface(g, 'book', surface, { x: -.5 + i * .2, options: { upright: true, spine: true, cloth: i % 2 ? 'clothRed' : 'clothBlue' }, dynamic: false });
      }
    } else {
      const goods = o.sparse ? [[y === .7 ? 'bowl' : 'jar', 0]] : [['jar', -.43], ['bowl', 0], [o.goods ? 'apple' : 'bottle', .43]];
      for (const [type, x] of goods)
        placeOnSurface(g, type, surface, { x, dynamic: false });
    }
  }
  poi(g, 'shelf', 0, .85); interact(g, books ? 'read' : 'open', books ? 'Bücher lesen' : 'Regal durchsuchen');
}
function vessel(g, w, h, material, wall = .05) {
  put(g, w, wall, w, material, 0, 0, 0, false);
  for (const x of [-1, 1]) put(g, wall, h - wall, w, material, x * (w - wall) / 2, wall, 0, false);
  for (const z of [-1, 1]) put(g, w - wall * 2, h - wall, wall, material, 0, wall, z * (w - wall) / 2, false);
}

const builders = {
  bed(g, o) {
    legs(g, 1.45, 2.8, 1.05); bedFrame(g, .42, o);
    poi(g, 'bed', .86); interact(g, 'sleep', 'Schlafen');
  },
  bunk(g, o) {
    legs(g, 1.45, 2.8, 3.15); bedFrame(g, .42, o); bedFrame(g, 2.03, o);
    for (const z of [-.65, .65]) put(g, .1, 2.25, .1, 'timber', .775, 0, z);
    for (let y = .3; y < 2.3; y += .36) put(g, .1, .08, 1.2, 'planks', .775, y);
    poi(g, 'bed', .86); interact(g, 'sleep', 'Schlafen');
    const upper = new THREE.Group(); g.add(upper); upper.name = 'upperBunk';
    poi(upper, 'bed', 2.47); interact(upper, 'sleep', 'Oben schlafen');
  },
  table(g, o) {
    tableTop(g, o); poi(g, 'table', 0, furnitureFootprint('table', o).depth / 2 + .55);
    if (o.desk) {
      const surface = { topY: 1.1, width: 1.8, depth: 1.1 };
      placeOnSurface(g, 'book', surface, { x: -.4, dynamic: false });
      placeOnSurface(g, 'candle', surface, { x: .55, z: -.25, options: { light: o.light }, dynamic: false });
      poi(g, 'workstation', 0, 1.05); interact(g, 'read', 'Schriften lesen');
    }
  },
  chair(g, o) {
    legs(g, .7, .7, .7); put(g, .7, .12, .7, 'planks', 0, .7);
    for (const x of [-.28, .28]) put(g, .14, .95, .12, 'timber', x, .82, -.315);
    put(g, .42, .45, .12, o.cloth ?? 'planks', 0, 1.25, -.315);
    poi(g, 'seat', .82); interact(g, 'sit', 'Sitzen');
  },
  stool(g) { legs(g, .55, .55, .68); put(g, .6, .12, .6, 'planks', 0, .68); poi(g, 'seat', .8); interact(g, 'sit', 'Sitzen'); },
  bench(g) { for (const x of [-.65, .65]) put(g, .16, .68, .5, 'timber', x); put(g, 1.8, .12, .55, 'planks', 0, .68); poi(g, 'seat', .8); interact(g, 'sit', 'Sitzen'); },
  shelf(g, o) { cabinet(g, false, o); },
  bookshelf(g, o) { cabinet(g, true, o); },
  wardrobe(g) {
    put(g, 1.35, 2.25, .64, 'planksVertical', 0, 0, -.03);
    for (const x of [-.3375, .3375]) { put(g, .65, 2.1, .06, 'darkPlanks', x, .08, .32); put(g, .05, .13, .04, 'brass', x * .2, 1.05, .37, false); }
    interact(g, 'open', 'Schrank öffnen');
  },
  chest(g, o) {
    put(g, 1.15, .55, .65, 'darkPlanks');
    if (o.packed) {
      const lid = put(g, 1.15, .65, .12, 'planks', 0, .55, -.265);
      lid.userData.furniturePart = 'chestLid';
      put(g, 1.15, .025, .65, 'clothLinen', 0, .55);
    } else put(g, 1.15, .13, .65, 'planks', 0, .55);
    for (const x of [-.4, .4]) put(g, .07, .48, .035, 'iron', x, .04, .33, false);
    put(g, .13, .18, .04, 'brass', 0, .43, .345, false); interact(g, 'loot', 'Truhe plündern');
  },
  barrel(g, o) {
    put(g, .72, 1.05, .72, 'planksVertical');
    for (const y of [.12, .78]) {
      for (const x of [-.3925, .3925]) put(g, .065, .1, .85, 'iron', x, y);
      for (const z of [-.3925, .3925]) put(g, .72, .1, .065, 'iron', 0, y, z);
    }
    put(g, .72, .06, .72, o.ore ? 'iron' : 'logTop', 0, 1.05);
    if (o.ore) for (const x of [-.2, .16]) put(g, .25, .18, .3, 'stone', x, 1.11, x, false);
    interact(g, 'open', o.ore ? 'Erzfass durchsuchen' : 'Fass öffnen');
  },
  crate(g) { put(g, .72, .72, .72, 'planks'); for (const x of [-.36, .36]) put(g, .08, .8, .8, 'timber', x); interact(g, 'open', 'Kiste öffnen'); },
  fireplace(g, o) {
    put(g, 2, .18, 1.1, 'stone'); put(g, 2, 2.9, .2, 'bricks', 0, .18, -.45);
    for (const x of [-.85, .85]) put(g, .3, 1.35, .9, 'stone', x, .18, .1);
    put(g, 1.4, 1.55, .9, 'bricks', 0, 1.53, .1);
    for (const x of [-.28, .28]) put(g, .2, .2, .65, 'bark', x, .18, .1, false);
    fire(g, .38, .7, o.pot ? .45 : .85, o.light !== false, .1);
    if (o.pot) {
      for (const x of [-.47, .47]) put(g, .06, .75, .06, 'iron', x, .18, .1);
      put(g, .88, .06, .06, 'iron', 0, .87, .1);
      put(g, .04, .13, .04, 'iron', 0, .74, .1);
      cauldron(g, 0, .42, .1, 0, { suspended: true });
    }
    poi(g, 'hearth', 0, 1.2); interact(g, 'cook', 'Kochen');
  },
  cauldron(g, o) {
    if (!o.suspended) for (const x of [-.22, .22]) put(g, .08, .12, .45, 'iron', x);
    const base = o.suspended ? 0 : .12;
    const bowlGroup = new THREE.Group(); bowlGroup.position.y = base; g.add(bowlGroup); vessel(bowlGroup, .6, .32, 'iron', .06);
    put(g, .48, .02, .48, tint('water', 0x8b9960), 0, base + .22, 0, false);
    for (const x of [-.35, .35]) put(g, .1, .06, .12, 'iron', x, base + .24, 0, false);
    interact(g, 'cook', 'Eintopf kochen');
  },
  candle(g, o) {
    put(g, .22, .04, .22, 'brass', 0, 0, 0, false); put(g, .08, .08, .08, 'brass', 0, .04, 0, false);
    put(g, .09, .22, .09, 'clothLinen', 0, .12, 0, false); fire(g, .34, .09, .16, o.light ? .35 : false);
  },
  rug(g, o) {
    const { width, depth } = furnitureFootprint('rug', o);
    put(g, width, .018, depth, o.cloth ?? 'clothRed', 0, 0, 0, false);
    for (const z of [-1, 1]) put(g, width, .006, .08, 'clothLinen', 0, .018, z * (depth / 2 - .04), false);
  },
  counter(g) { put(g, 2.6, 1.18, .7, 'planksVertical'); put(g, 2.8, .14, .85, 'darkPlanks', 0, 1.18); poi(g, 'counter', 0, 1); interact(g, 'open', 'Waren ansehen'); },
  kegRack(g) {
    for (const x of [-.94, .94]) put(g, .12, 1.65, .85, 'timber', x);
    put(g, 1.76, .14, .85, 'planks', 0, .25);
    for (const x of [-.46, .46]) {
      put(g, .72, .76, .74, 'planksVertical', x, .39);
      put(g, .72, .76, .05, 'logTop', x, .39, .395);
      put(g, .1, .1, .08, 'brass', x, .58, .46, false);
    }
    poi(g, 'shelf', 0, 1); interact(g, 'open', 'Zapfen');
  },
  weaponRack(g) {
    for (const x of [-.72, .72]) { put(g, .16, .12, .65, 'timber', x); put(g, .12, 2.05, .12, 'timber', x, .12, -.2); }
    for (const y of [.5, 1.5]) put(g, 1.32, .12, .12, 'planks', 0, y, -.2);
    for (const [i, x] of [-.48, 0, .48].entries()) {
      put(g, .08, .75, .09, 'timber', x, .62, -.095, false);
      put(g, i === 2 ? .34 : .12, i === 2 ? .4 : .9, .08, 'iron', x, 1.37, -.095, false);
      if (i < 2) put(g, .35, .07, .1, 'brass', x, 1.3, -.095, false);
    }
    poi(g, 'shelf', 0, .9); interact(g, 'loot', 'Waffen nehmen');
  },
  armourStand(g) {
    put(g, 1, .12, .7, 'darkPlanks'); put(g, .16, 2.25, .16, 'timber', 0, .12);
    put(g, .8, .12, .2, 'timber', 0, 1.9);
    put(g, .64, .75, .14, 'iron', 0, 1.15, .15, false);
    for (const x of [-.42, .42]) put(g, .2, .24, .36, 'iron', x, 1.66, 0, false);
    put(g, .38, .34, .38, 'iron', 0, 2.37, 0, false); interact(g, 'loot', 'Rüstung nehmen');
  },
  anvil(g) {
    put(g, .7, .65, .7, 'logTop'); put(g, .65, .12, .55, 'iron', 0, .65);
    put(g, .4, .3, .4, 'iron', 0, .77); put(g, .9, .2, .55, 'iron', -.15, 1.07);
    put(g, .3, .1, .25, 'iron', .45, 1.07); poi(g, 'workstation', 0, .9); interact(g, 'craft', 'Schmieden');
  },
  workbench(g) {
    legs(g, 1.9, .75, 1.05); put(g, 2, .18, .85, 'planks', 0, 1.05);
    put(g, .55, .06, .09, 'timber', -.35, 1.23, .1, false); put(g, .18, .12, .28, 'iron', -.7, 1.23, .1, false);
    put(g, .5, .04, .14, 'iron', .35, 1.23, -.15, false); put(g, .2, .08, .14, 'timber', .7, 1.23, -.15, false);
    poi(g, 'workstation', 0, 1); interact(g, 'craft', 'Herstellen');
  },
  loom(g) {
    for (const x of [-.7, .7]) { put(g, .2, .12, .8, 'timber', x); put(g, .14, 2, .14, 'timber', x, .12); }
    for (const y of [.45, 1.9]) put(g, 1.26, .14, .14, 'planks', 0, y);
    for (let x = -.55; x < .6; x += .11) put(g, .025, 1.31, .025, 'clothLinen', x, .59, 0, false);
    put(g, 1.15, .65, .035, 'clothBlue', 0, .59, .03, false);
    poi(g, 'workstation', 0, .95); interact(g, 'craft', 'Weben');
  },
  plate(g) { put(g, .38, .035, .38, 'stoneLight', 0, 0, 0, false); loose(g, 'tonteller', [.19, .0175, .19], .25); },
  cup(g) {
    vessel(g, .18, .22, 'darkPlanks', .035); put(g, .06, .12, .06, 'timber', .12, .05, 0, false);
    loose(g, 'holzbecher', [.15, .11, .1], .15);
  },
  bottle(g) { put(g, .2, .29, .2, tint('stone', 0x607747), 0, 0, 0, false); put(g, .08, .15, .08, 'brass', 0, .29, 0, false); loose(g, 'weinflasche', [.1, .22, .1], .6); },
  bread(g) { put(g, .4, .12, .26, 'hay', 0, 0, 0, false); loose(g, 'reisefladen', [.2, .06, .13], .2); },
  apple(g) { put(g, .2, .18, .2, tint('clothRed', 0xd5a687), 0, 0, 0, false); put(g, .035, .045, .035, 'timber', 0, .18, 0, false); loose(g, 'waldapfel', [.1, .1125, .1], .2); },
  cheeseWheel(g) {
    put(g, .38, .17, .2, tint('hay', 0xffdb86), 0, 0, 0, false);
    for (const z of [-.145, .145]) put(g, .2, .17, .09, tint('hay', 0xffdb86), 0, 0, z, false);
    loose(g, 'kaeselaib', [.19, .085, .19], .8);
  },
  bowl(g) { vessel(g, .32, .14, 'planks', .04); loose(g, 'holzschale', [.16, .07, .16], .2); },
  jar(g) { put(g, .28, .3, .28, 'bricks', 0, 0, 0, false); put(g, .2, .05, .2, 'planks', 0, .3, 0, false); loose(g, 'tonkrug', [.14, .175, .14], .45); },
  book(g, o) {
    const w = o.spine ? .08 : .3, h = o.upright ? .38 : .08, d = o.spine ? .3 : o.upright ? .08 : .38;
    put(g, w, h, d, 'clothLinen', 0, 0, 0, false);
    if (o.upright) for (const z of [-1, 1]) put(g, w, h, .015, o.cloth ?? 'clothRed', 0, 0, z * (d / 2 + .0075), false);
    else for (const y of [0, h - .015]) put(g, w, .015, d, o.cloth ?? 'clothRed', 0, y, 0, false);
    loose(g, 'reisetagebuch', [w / 2, h / 2, d / 2 + (o.upright ? .015 : 0)], .3); interact(g, 'read', 'Lesen');
    g.userData.restPose = o.upright ? 'upright' : 'flat';
  },
  hangingHerbs(g, o) {
    const y = o.mountHeight ?? 1.8;
    put(g, .7, .08, .25, 'timber', 0, y + .65, 0, false);
    for (const x of [-.22, 0, .22]) {
      put(g, .035, .22, .035, 'clothLinen', x, y + .43, .08, false);
      put(g, .16, .43, .12, tint('hay', 0x6e8851), x, y, .06, false);
    }
    g.userData.item = 'kraeuter'; interact(g, 'take', 'Kräuter nehmen');
  },
  banner(g, o) {
    const y = o.mountHeight ?? 1.25;
    put(g, 1, .08, .18, 'timber', 0, y + 1.5, 0, false);
    put(g, .85, 1.5, .04, o.cloth ?? 'clothRed', 0, y, .05, false);
    put(g, .12, .65, .02, 'brass', 0, y + .45, .08, false);
  },
  bucket(g) {
    vessel(g, .45, .4, 'planksVertical');
    for (const x of [-.2, .2]) put(g, .04, .27, .04, 'iron', x, .4, 0, false);
    put(g, .36, .04, .04, 'iron', 0, .63, 0, false); loose(g, 'holzeimer', [.225, .335, .225], 1);
  },
  broom(g) { put(g, .42, .3, .18, 'hay', 0, 0, 0, false); put(g, .065, 1.55, .065, 'timber', 0, .3, 0, false); loose(g, 'reisigbesen', [.21, .925, .09], .8); },
  firewoodStack(g) {
    for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) {
      const x = (i - (3 - row) / 2) * .3;
      put(g, .3, .25, .69, 'bark', x, row * .25, 0);
      for (const z of [-.36, .36]) put(g, .3, .25, .03, 'logTop', x, row * .25, z, false);
    }
    g.userData.item = 'holz'; interact(g, 'take', 'Brennholz nehmen');
  },
  grainSack(g) { put(g, .65, .6, .65, 'clothLinen'); put(g, .45, .2, .45, 'hay', 0, .6); put(g, .3, .08, .3, 'timber', 0, .8); interact(g, 'open', 'Getreidesack öffnen'); },
  wallTorch(g, o) {
    const y = o.mountHeight ?? 1.8;
    put(g, .18, .45, .08, 'iron', 0, y, -.16, false);
    put(g, .07, .07, .25, 'iron', 0, y + .1, .005, false);
    put(g, .1, .55, .1, 'timber', 0, y + .1, .15, false); fire(g, y + .65, .3, .5, o.light !== false, .15);
  },
  throne(g) {
    put(g, 2, .22, 1.8, 'ashlar'); put(g, 1.55, .18, 1.35, 'ashlar', 0, .22, -.15);
    const seat = chair(g, 0, .4, -.2, 0, { cloth: 'clothRed' });
    for (const x of [-.45, .45]) { put(g, .14, .8, .65, 'darkPlanks', x, .4, -.2); put(g, .18, .1, .8, 'brass', x, 1.2, -.15); }
    put(g, .7, .5, .12, 'darkPlanks', 0, 2.17, -.515);
    g.userData.throne = true; poi(g, 'seat', 1.22, -.2); interact(g, 'sit', 'Thron besteigen'); delete seat.userData.poi; delete seat.userData.interact;
  },
  brazier(g, o) {
    put(g, .7, .13, .7, 'stone'); put(g, .25, .75, .25, 'iron', 0, .13);
    put(g, .65, .12, .65, 'iron', 0, .88); fire(g, 1, .6, .7, o.light !== false);
    poi(g, 'hearth', 0, 1);
  },
  bardCorner(g) {
    put(g, 1.5, .15, 1.2, 'planks'); stool(g, -.35, .15, 0);
    // Box lyre, supported by a short instrument stand.
    put(g, .5, .08, .5, 'timber', .4, .15);
    put(g, .1, .55, .1, 'timber', .4, .23);
    put(g, .5, .16, .18, 'planks', .4, .78);
    for (const x of [.19, .61]) put(g, .08, .6, .14, 'timber', x, .94);
    put(g, .5, .08, .14, 'timber', .4, 1.54);
    for (const x of [.3, .4, .5]) put(g, .018, .6, .025, 'brass', x, .94, 0, false);
    poi(g, 'workstation', .15, .35); interact(g, 'craft', 'Musizieren');
  },
};

function factory(kind) {
  return (parent, x, y, z, ry = 0, options = {}) => {
    const footprint = furnitureFootprint(kind, options), g = new THREE.Group();
    g.name = kind; g.position.set(x, y, z); g.rotation.y = ry;
    g.userData.furniture = kind; g.userData.footprint = footprint;
    builders[kind](g, options); parent.add(g); return g;
  };
}

export const bed = factory('bed'), bunk = factory('bunk'), table = factory('table');
export const chair = factory('chair'), stool = factory('stool'), bench = factory('bench');
export const shelf = factory('shelf'), bookshelf = factory('bookshelf'), wardrobe = factory('wardrobe');
export const chest = factory('chest'), barrel = factory('barrel'), crate = factory('crate');
export const fireplace = factory('fireplace'), cauldron = factory('cauldron'), candle = factory('candle');
export const rug = factory('rug'), counter = factory('counter'), kegRack = factory('kegRack');
export const weaponRack = factory('weaponRack'), armourStand = factory('armourStand');
export const anvil = factory('anvil'), workbench = factory('workbench'), loom = factory('loom');
export const plate = factory('plate'), cup = factory('cup'), bottle = factory('bottle');
export const bread = factory('bread'), apple = factory('apple'), cheeseWheel = factory('cheeseWheel');
export const bowl = factory('bowl'), jar = factory('jar'), book = factory('book');
export const hangingHerbs = factory('hangingHerbs'), banner = factory('banner'), bucket = factory('bucket');
export const broom = factory('broom'), firewoodStack = factory('firewoodStack'), grainSack = factory('grainSack');
export const wallTorch = factory('wallTorch'), throne = factory('throne'), brazier = factory('brazier'), bardCorner = factory('bardCorner');

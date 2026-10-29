import * as F from './furniture.js';
import { blockOn } from '../art/blocks.js';

const PI = Math.PI, CLEAR = .6;
const HEIGHTS = { bed: 1.08, bunk: 3.15, table: 1.1, chair: 1.77, stool: .8, bench: .8, wardrobe: 2.25,
  chest: .68, barrel: 1.11, crate: .8, fireplace: 3.08, counter: 1.32, kegRack: 1.65, weaponRack: 2.27,
  armourStand: 2.71, anvil: 1.27, workbench: 1.23, loom: 2.12, bookshelf: 2.25, shelf: 2.25, throne: 2.67,
  brazier: 1.7, grainSack: .88, firewoodStack: .75 };
const PROFILES = {
  elder: ['modest', 1, ['sick_bed', 'ledger']], smith: ['modest', 2, ['hearth_weapon', 'travel_chest']],
  farmer_family: ['modest', 4, ['child_corner', 'drying_herbs']], widow: ['poor', 1, ['sick_bed', 'shrine_corner']],
  ranger: ['poor', 1, ['hearth_weapon', 'travel_chest']], merchant: ['rich', 3, ['ledger', 'travel_chest']],
  priest: ['modest', 1, ['shrine_corner', 'ledger']], guard_bunks: ['modest', 4, ['hearth_weapon', 'uneaten_meal']],
  innkeeper: ['modest', 3, ['uneaten_meal', 'travel_chest']], poor_labourer: ['poor', 2, ['unfinished_cloth', 'uneaten_meal']],
  rich_burgher: ['rich', 3, ['ledger', 'child_corner']], noble: ['rich', 2, ['shrine_corner', 'ledger']],
};
const ROLES = Object.keys(PROFILES);
function random(seed) {
  let state = 2166136261;
  for (const char of String(seed)) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}
export function createHousehold(kind = 'home', seed = 1, overrides = {}) {
  const rng = random(seed), pick = list => list[Math.floor(rng() * list.length)];
  const role = overrides.role ?? ({ smithy: 'smith', farmer: 'farmer_family', tavern: 'innkeeper', inn: 'innkeeper',
    barracks: 'guard_bunks', temple: 'priest', chapel: 'priest', keep: 'noble', shop: 'merchant', carpenter: 'poor_labourer',
    hunter: 'ranger' }[kind] ?? (PROFILES[kind] ? kind : pick(ROLES)));
  if (!PROFILES[role]) throw new RangeError(`Unknown household role: ${role}`);
  const [wealth, size, stories] = PROFILES[role];
  const details = rng() < .45 ? [...stories] : [pick(stories)];
  return { role, wealth: overrides.wealth ?? wealth, size: overrides.size ?? size, details: overrides.details ?? details };
}
function rect(piece) {
  const f = F.furnitureFootprint(piece.type, piece.options), c = Math.abs(Math.cos(piece.rotation)), s = Math.abs(Math.sin(piece.rotation));
  return { x: piece.x, z: piece.z, width: f.width * c + f.depth * s, depth: f.depth * c + f.width * s };
}
const overlaps = (a, b, gap = 0) => Math.abs(a.x - b.x) < (a.width + b.width) / 2 + gap - 1e-7 &&
  Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 + gap - 1e-7;
function inside(bounds, r) {
  return Math.abs(r.x - bounds.x) + r.width / 2 <= bounds.width / 2 + 1e-7 &&
    Math.abs(r.z - bounds.z) + r.depth / 2 <= bounds.depth / 2 + 1e-7;
}
// Rasterise a 1.2-unit-wide person, including the wall clearance.
// Stricter walkway check for filler furniture: a .2-unit grid with .6 clearance must still reach
// every piece's approach from the door.
function roomy(bounds, door, pieces) {
  const step = .2, nx = Math.ceil((bounds.width - 1.2) / step) + 1, nz = Math.ceil((bounds.depth - 1.2) / step) + 1;
  const sx = (bounds.width - 1.2) / (nx - 1), sz = (bounds.depth - 1.2) / (nz - 1), x0 = bounds.x - bounds.width / 2 + .6, z0 = bounds.z - bounds.depth / 2 + .6;
  const rects = pieces.map(rect), point = i => ({ x: x0 + (i % nx) * sx, z: z0 + Math.floor(i / nx) * sz, width: 0, depth: 0 });
  const blocked = i => rects.some(r => overlaps(r, point(i), .6));
  const start = Math.round((Math.min(door.z, bounds.z + bounds.depth / 2 - .6) - z0) / sz) * nx + Math.round((door.x - x0) / sx);
  if (start < 0 || start >= nx * nz || blocked(start)) return false;
  const seen = new Set([start]), queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const a = queue[i], x = a % nx, z = Math.floor(a / nx);
    for (const [xx, zz] of [[x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1]]) {
      const next = zz * nx + xx;
      if (xx < 0 || zz < 0 || xx >= nx || zz >= nz || seen.has(next) || blocked(next)) continue;
      seen.add(next); queue.push(next);
    }
  }
  return pieces.every(p => !p.approach || [...seen].some(i => { const q = point(i); return Math.hypot(q.x - p.approach.x, q.z - p.approach.z) <= .3; }));
}
function connected(bounds, door, pieces) {
  const step = .25, nx = Math.ceil((bounds.width - 2 * CLEAR) / step) + 1, nz = Math.ceil((bounds.depth - 2 * CLEAR) / step) + 1;
  const dx = (bounds.width - 2 * CLEAR) / (nx - 1), dz = (bounds.depth - 2 * CLEAR) / (nz - 1);
  const x0 = bounds.x - bounds.width / 2 + CLEAR, z0 = bounds.z - bounds.depth / 2 + CLEAR;
  const footprints = pieces.map(rect), visited = new Uint8Array(nx * nz);
  if (pieces.some(p => p.approach && footprints.some(r => overlaps(r, { ...p.approach, width: 0, depth: 0 }, CLEAR)))) return false;
  const index = p => Math.round((p.z - z0) / dz) * nx + Math.round((p.x - x0) / dx);
  const free = i => !footprints.some(r => overlaps(r, { x: x0 + i % nx * dx, z: z0 + Math.floor(i / nx) * dz, width: 0, depth: 0 }, CLEAR));
  const start = index({ x: door.x, z: Math.min(door.z, bounds.z + bounds.depth / 2 - CLEAR) });
  if (start < 0 || start >= visited.length || !free(start)) return false;
  const queue = [start]; visited[start] = 1;
  for (let i = 0; i < queue.length; i++) {
    const a = queue[i], x = a % nx, z = Math.floor(a / nx);
    for (const [xx, zz] of [[x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1]]) {
      const next = zz * nx + xx;
      if (xx < 0 || zz < 0 || xx >= nx || zz >= nz || visited[next] || !free(next)) continue;
      visited[next] = 1; queue.push(next);
    }
  }
  return pieces.every(p => !p.approach || visited[index(p.approach)] === 1);
}

/** Pure seeded layout. Bounds and door use the building's local coordinates. */
export function planInterior(kind = 'home', { seed = 1, width = 7.2, depth = 6, centerX = 0, centerZ = 0,
  household: overrides = {}, door, clearances = [], sleeping = true, cooking = true, work = true, storage = true, eating = true } = {}) {
  if (width < 4.8 || depth < 3.2 || !Number.isFinite(width + depth)) throw new RangeError('Room is too small');
  const rng = random(`${seed}/layout`), household = createHousehold(kind, seed, overrides);
  const bounds = { x: centerX, z: centerZ, width, depth }, pieces = [], decorations = [];
  door ??= { x: centerX, z: centerZ + depth / 2 };
  const swing = { x: door.x, z: door.z - .7, width: 2.8, depth: 1.6 };
  // Half of the houses are laid out mirrored, and every household tries its wall bays in its own order,
  // so two homes of the same kind still read differently from the doorway.
  const mirror = rng() < .5, side = wall => mirror ? ({ left: 'right', right: 'left' }[wall] ?? wall) : wall;
  const shuffle = values => values.map(v => [v, rng()]).sort((a, b) => a[1] - b[1]).map(([v]) => v);
  const shuffleWalls = () => shuffle(['back', 'left', 'right']);
  const add = (type, zone, walls, options = {}, extra = {}) => {
    const f = F.furnitureFootprint(type, options);
    for (const wall of walls.map(side)) {
      const rotation = wall === 'left' ? PI / 2 : wall === 'right' ? -PI / 2 : wall === 'front' ? PI : 0;
      const sideBed = ['bed', 'bunk'].includes(type);
      const angle = sideBed ? (rng() < .5 ? 0 : PI) : rotation;
      const sample = { type, options, rotation: angle, x: 0, z: 0 }, r = rect(sample);
      const horizontal = wall === 'back' || wall === 'front', span = horizontal ? width - r.width : depth - r.depth;
      // The hearth stays under the chimney (back right outside).
      const values = zone === 'cooking' ? [1, 0, .5] : shuffle(zone === 'sleeping' ? [0, 1, .5] : [.5, 0, 1, .25, .75]);
      // More wall bays in public rooms; a compact house deliberately stays sparse.
      if (span > 6) for (let n = .12; n < 1; n += .12) values.push(n);
      for (const t of values) {
        const x = horizontal ? centerX + (t - .5) * Math.max(0, span - .16) : centerX + (wall === 'left' ? -1 : 1) * (width / 2 - r.width / 2 - .08);
        const z = horizontal ? centerZ + (wall === 'back' ? -1 : 1) * (depth / 2 - r.depth / 2 - .08) : centerZ + (t - .5) * Math.max(0, span - .16);
        const a = sideBed ? { x: x + (wall === 'left' ? 1 : -1) * (r.width / 2 + .7), z } :
          { x: x + Math.sin(rotation) * (f.depth / 2 + .7), z: z + Math.cos(rotation) * (f.depth / 2 + .7) };
        const piece = { type, x, z, rotation: angle, options, zone, approach: a, ...extra }, footprint = rect(piece);
        if (!inside(bounds, footprint) || !inside(bounds, { ...a, width: 1.2, depth: 1.2 }) || overlaps(footprint, swing) || clearances.some(r => overlaps(footprint, r)) ||
            pieces.some(p => overlaps(rect(p), footprint, .08))) continue;
        if (!connected(bounds, door, [...pieces, piece])) continue;
        pieces.push(piece); return piece;
      }
    }
    return null;
  };
  const cloth = household.wealth === 'poor' ? 'clothLinen' : rng() < .5 ? 'clothBlue' : 'clothRed';
  const publicRoom = ['tavern', 'inn', 'temple', 'chapel', 'keep'].includes(kind);
  if (cooking) add('fireplace', 'cooking', ['back'], { pot: ['farmer_family', 'innkeeper'].includes(household.role), light: false });
  if (sleeping) {
    const beds = household.role === 'guard_bunks' ? Math.ceil(household.size / 2) : household.size > 2 && width > 10 ? 2 : 1;
    for (let i = 0; i < beds; i++) add(household.role === 'guard_bunks' || household.size > 2 && width < 10 ? 'bunk' : 'bed', 'sleeping',
      i % 2 ? ['right', 'left', 'back'] : ['left', 'right', 'back'], { cloth: household.details.includes('sick_bed') ? 'clothLinen' : cloth });
  }
  if (kind === 'keep') add('throne', 'eating', ['back']);
  if (['temple', 'chapel'].includes(kind)) add('table', 'work', ['back'], {}, { poiKind: 'shrine', story: 'shrine_corner' });
  if (['shop', 'tavern', 'inn'].includes(kind)) add('counter', 'work', ['right', 'back']);
  if (work && !['temple', 'chapel'].includes(kind)) {
    const type = ['smith', 'poor_labourer', 'farmer_family', 'ranger', 'guard_bunks'].includes(household.role) ?
      ({ smith: 'workbench', poor_labourer: 'loom', farmer_family: 'loom', ranger: 'weaponRack', guard_bunks: 'weaponRack' }[household.role]) : 'table';
    add(type, 'work', ['back', 'right', 'left'], {}, type === 'table' ? { poiKind: household.role === 'priest' ? 'shrine' : 'workstation' } : {});
  }
  if (eating) {
    const tableCount = publicRoom ? Math.min(4, Math.max(1, Math.floor(depth / 6))) : 1;
    for (let i = 0; i < tableCount; i++) {
      if (!['temple', 'chapel'].includes(kind)) add('table', 'eating', i % 2 ? ['left', 'right', 'front'] : ['right', 'left', 'front']);
      add(['temple', 'chapel', 'tavern', 'inn'].includes(kind) ? 'bench' : household.wealth === 'poor' ? 'stool' : 'chair', 'eating',
        rng() < .5 ? ['front', 'left', 'right'] : ['left', 'front', 'right'], { cloth });
    }
  }
  if (storage) {
    add(household.details.includes('travel_chest') ? 'chest' : household.wealth === 'rich' ? 'wardrobe' : household.wealth === 'poor' ? 'crate' : 'chest', 'storage', ['front', 'left', 'right', 'back'], { packed: household.details.includes('travel_chest') });
    if (household.wealth !== 'poor') add(household.wealth === 'rich' || household.role === 'elder' ? 'bookshelf' : 'shelf', 'storage', ['back', 'left', 'right'], { sparse: true });
    if (kind === 'tavern' || kind === 'inn') add('kegRack', 'storage', ['right', 'back', 'left']);
  }
  if (household.details.includes('travel_chest') && !pieces.some(p => p.type === 'chest')) add('chest', 'storage', ['front', 'left', 'right'], { packed: true });
  // Fill the remaining wall bays with the household's everyday things so no room stands empty:
  // about one piece per five square units, chosen by trade and wealth.
  const everyday = {
    smith: ['barrel', 'crate', 'weaponRack', 'grainSack', 'bucket'], innkeeper: ['barrel', 'barrel', 'kegRack', 'crate', 'bench'],
    priest: ['bench', 'bench', 'bookshelf', 'chest'], guard_bunks: ['weaponRack', 'armourStand', 'chest', 'barrel', 'bench'],
    farmer_family: ['grainSack', 'barrel', 'crate', 'firewoodStack', 'bucket', 'stool'], poor_labourer: ['crate', 'grainSack', 'bucket', 'firewoodStack', 'stool'],
    rich_burgher: ['wardrobe', 'bookshelf', 'chest', 'bench', 'shelf'], elder: ['bookshelf', 'chest', 'shelf', 'bench', 'barrel'],
  }[household.role] ?? ['shelf', 'barrel', 'crate', 'chest', 'stool', 'firewoodStack'];
  const target = Math.min(pieces.length + 4, Math.round(width * depth / 5.5));
  for (let i = 0; pieces.length < target && i < everyday.length * 2; i++) {
    const before = pieces.length, piece = add(everyday[(i + Math.floor(rng() * 3)) % everyday.length], 'storage', shuffleWalls(), {});
    // Keep a wider walkway than the planner's minimum: a filler must not pinch any route.
    if (piece && !roomy(bounds, door, pieces)) pieces.length = before;
  }
  if (household.wealth === 'rich') decorations.push({ type: 'rug', x: centerX, z: centerZ, rotation: 0,
    options: { width: Math.min(2.2, width - 2.8), depth: Math.min(3.6, depth - 1.6), cloth } });
  if (household.wealth === 'poor') decorations.push({ type: 'rug', x: centerX - width / 2 + 1.4, z: centerZ, rotation: 0,
    options: { width: .8, depth: 1.6, cloth: 'hay' } });
  decorations.push({ type: household.details.includes('drying_herbs') || household.wealth === 'poor' ? 'hangingHerbs' : 'banner',
    x: centerX, z: centerZ - depth / 2 + .15, rotation: 0,
    options: { cloth, mountHeight: household.details.includes('drying_herbs') || household.wealth === 'poor' ? 2.6 : 1.75 } });
  return { seed, household, bounds, door, pieces, decorations };
}

function surfaceFor(piece, type, options) {
  const tops = { table: 1.1, counter: 1.32, chest: .68 };
  if (type === 'shelf' || type === 'bookshelf') return { x: piece.position.x + Math.sin(piece.rotation.y) * .03,
    z: piece.position.z + Math.cos(piece.rotation.y) * .03, topY: piece.position.y + 2.25, rotation: piece.rotation.y,
    width: 1.26, depth: .43 };
  if (type === 'chest' && options.packed) return { x: piece.position.x + Math.sin(piece.rotation.y) * .1,
    z: piece.position.z + Math.cos(piece.rotation.y) * .1, topY: piece.position.y + .575, rotation: piece.rotation.y,
    width: 1.03, depth: .4 };
  if (!(type in tops)) return null;
  const f = piece.userData.footprint;
  return { x: piece.position.x, z: piece.position.z, topY: piece.position.y + tops[type], rotation: piece.rotation.y,
    width: f.width - .12, depth: f.depth - .12 };
}

export function furnishInterior(root, kind = 'home', { floorY = .54, light = true, ...options } = {}) {
  const plan = planInterior(kind, options), { household } = plan, rng = random(`${plan.seed}/clutter`);
  const interior = { pois: [], interactables: [], loose: [], household, plan, surfaces: [], lightAnchors: [] };
  let lamp = false, hearthAnchor;
  for (const entry of [...plan.pieces, ...plan.decorations]) {
    const { type, x, z, rotation, options: settings = {} } = entry;
    const piece = F[type](root, x, floorY, z, rotation, { ...settings, light: light && !lamp && type === 'fireplace' });
    piece.userData.zone = entry.zone;
    if (type === 'fireplace') hearthAnchor = piece.getObjectByName('lamp_anchor');
    piece.traverse(o => {
      if (o.userData.furniturePart !== 'chestLid') delete o.userData.solid;
      if (o !== piece && o.userData.physics) { delete o.userData.physics; delete o.userData.item; delete o.userData.interact; }
      if (o.isPointLight) { lamp = true; o.userData.poolAnchor = true;
        interior.lightAnchors.push({ object: hearthAnchor ?? o, source: o, ...(hearthAnchor?.userData.lightAnchor ?? {}) }); }
    });
    if (HEIGHTS[type]) piece.userData.solidFootprint = { ...piece.userData.footprint, height: type === 'chest' && settings.packed ? .575 : HEIGHTS[type] };
    if (piece.userData.poi) {
      const p = piece.userData.poi;
      if (entry.poiKind) p.kind = entry.poiKind;
      if (['tavern', 'inn'].includes(kind) && p.kind === 'seat') p.kind = 'tavern_seat';
      p.approach = entry.approach; interior.pois.push(p);
      if (entry.zone === 'work' && !['workstation', 'shrine', 'counter'].includes(p.kind))
        interior.pois.push({ ...p, kind: 'workstation' });
    }
    if (piece.userData.interact) interior.interactables.push(piece);
    const surface = ['shelf', 'bookshelf'].includes(type) && interior.loose.length ? null : surfaceFor(piece, type, settings);
    if (surface) {
      interior.surfaces.push(surface);
      const story = entry.story ?? (entry.zone === 'work' ? household.details.includes('shrine_corner') ? 'shrine_corner' : 'ledger' :
        type === 'chest' ? household.details.includes('sick_bed') ? 'sick_bed' : 'travel_chest' : 'uneaten_meal');
      piece.userData.story = story;
      const props = ['shelf', 'bookshelf'].includes(type) ? ['book', 'cup'] : story === 'ledger' ? ['book', 'candle', 'jar'] : story === 'shrine_corner' ? ['candle', 'book', 'candle'] :
        story === 'sick_bed' ? ['bowl', 'jar'] : story === 'travel_chest' ? ['book', 'bread'] :
        household.wealth === 'poor' ? ['bread', 'cup'] : ['plate', 'bread', 'cup', 'bottle'];
      const positions = ['shelf', 'bookshelf'].includes(type) ? [[-.42, 0], [.43, 0]] : type === 'chest' ? [[-.28, 0], [.26, 0]] :
        [[-.42, 0], [.15, -.12], [.52, .1], [-.1, .25]];
      props.forEach((prop, i) => {
        const [px, pz] = positions[i], item = F.placeOnSurface(root, prop, surface,
          { x: px, z: pz, yaw: (rng() - .5) * .12, options: { light: false } });
        if (!item) return;
        if (item.userData.physics) interior.loose.push(item);
        if (item.userData.interact) interior.interactables.push(item);
      });
    }
    if (['bed', 'bunk'].includes(type)) {
      piece.userData.story = household.details.includes('sick_bed') ? 'sick_bed' : household.size > 2 ? 'family_bed' : 'single_bed';
      if (household.details.includes('sick_bed')) blockOn(piece, .9, .035, 1, 'clothLinen', 0, .86, .25, 0, { solid: false });
    }
    if (type === 'fireplace' && household.details.includes('hearth_weapon')) {
      blockOn(piece, 1.1, .09, .09, 'iron', 0, 2.42, -.29);
      blockOn(piece, .1, .4, .12, 'brass', -.3, 2.27, -.25);
    }
    if (household.details.includes('child_corner') && ['chest', 'crate', 'wardrobe'].includes(type)) {
      for (let i = 0; i < 3; i++) blockOn(piece, .13, .13, .13, i % 2 ? 'clothBlue' : 'clothRed', -.25 + i * .2, HEIGHTS[type], -.12);
      piece.userData.story = 'child_corner';
    }
  }
  // Unlit city lamps expose a movable anchor for lightPool.follow without adding shader lights.
  if (!lamp) {
    const hearth = plan.pieces.find(p => p.type === 'fireplace') ?? plan.pieces[0];
    if (hearth) {
      const object = hearthAnchor ?? F.wallTorch(root, plan.bounds.x + plan.bounds.width / 2 - .2, floorY,
        plan.bounds.z, -PI / 2, { light: false, mountHeight: 2.2 }).getObjectByName('lamp_anchor');
      interior.lightAnchors.push({ object, ...object.userData.lightAnchor });
    }
  }
  return interior;
}

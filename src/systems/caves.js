import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAVES, CAVE_CELL, CAVE_STOREY } from '../data/goblins/caves.js';
import { boxGeometry } from '../art/blocks.js';
import { pixelMaterial, pixelTexture } from '../art/pixelTextures.js';
import { buildCaveRock, caveRockMaterial, vnoise } from './caveRock.js';
import { propClone, propBounds } from '../world/props.js';

// CAVES — the goblin dungeons. Each cave is built from its multi-storey floor plan (data/goblins/caves.js, drawn by
// Codex at the owner's request): rock walls round every open cell, floors of earth, mud, rubble and shallow water,
// rough ceilings with stalactites, stairs between the storeys, drops, and the plan's furniture — torches, fires,
// bones, totems, drums, cages, chests, notes. Its puzzles work: portcullises opened by levers, pressure plates held
// down by you or a carried idol, idols set into sockets, symbol pillars turned to the right sign, braziers lit in the
// right order, pull chains that slide rock aside, traps. Like Skyrim's dungeons a cave lies behind a door: its mouth is
// on the land (sites/caveMouths.js), the inside is built far above it in the sky where nothing else is (out of sight of
// the land, and the land out of sight of it), and going in fades over. Its walls and floors are colliders, so the
// wanderer walks it like anywhere else; goblins get a nav over the plan's grid (paths, ground, walls, sight).
const clamp = THREE.MathUtils.clamp, v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const CAVE_SKY = 640;
const CELL = CAVE_CELL, STOREY = CAVE_STOREY;
const ARROWS = { '>': [1, 0], '<': [-1, 0], v: [0, 1], '^': [0, -1] };
const FLAT = new Set(['.', ',', ':', '~', 'E']);
// Each cave's look: its textures (src/art/caveSurfaces.js, painted by Codex) with dirty tints and a grime colour, the
// baked ambient (linear RGB: low, so it is gloomy, but never zero — dungeons in most games never go fully black and
// the torches make pools of light in the murk), the fog (a dark coloured haze, so a hall's far end sinks into murk),
// and whether you walk in or climb down. The owner wants them filthy and gloomy, not bright or clean.
export const CAVE_STYLE = {
  klagende_grube: { wall: ['caveChalk', 0xb2a796], wall2: ['caveChalk', 0x968b7b], floor: ['caveChalkFloor', 0xa69a86], ceil: ['caveChalk', 0x7d7366], grime: 0x2c2218, ambient: [.1, .09, .08], fog: 0x15120e, torch: 0xffa860, glow: null, walkIn: true },
  moderhoehle: { wall: ['caveMoss', 0xa8b4a0], wall2: ['caveMoss', 0x8e9a86], floor: ['caveMossFloor', 0xa09a88], ceil: ['caveMoss', 0x76826e], grime: 0x1c2416, ambient: [.05, .1, .09], fog: 0x0a1714, torch: 0x9cf0d8, glow: 0x6fd2c0, walkIn: true },
  eisengrube: { wall: ['caveIron', 0xa89688], wall2: ['caveIron', 0x8e7c6e], floor: ['caveIronFloor', 0xa09284], ceil: ['caveIron', 0x766658], grime: 0x24180f, ambient: [.1, .075, .055], fog: 0x150e09, torch: 0xffa050, glow: null, walkIn: false },
};
const IRON_DARK = pixelMaterial('iron', { tint: 0x5a5e62 });
const SYMBOL = { ohr: 0xb88a86, auge: 0xe8ecec, kette: 0x6a6e72, pilz: 0x5cc4ae, knochen: 0xdcd2bc, mond: 0xe8d48a };

/** Small deterministic random per cave. */
function rng(seed) { let s = seed >>> 0; return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/**
 * mouths: { caveId: { x, z } } where each cave's inside is built (above its mouth). world: addColliders, removeColliders,
 * lights; physics: addStaticColliders. Returns the caves with build(id) (once, lazily), nav and interactions.
 */
export function createCaves({ scene, world, physics, mouths }) {
  const built = new Map();

  function build(id) {
    if (built.has(id)) return built.get(id);
    const index = CAVES.findIndex(c => c.id === id), plan = CAVES[index], style = CAVE_STYLE[id], random = rng(index * 7919 + 17);
    const W = plan.floors[0].grid[0].length, H = plan.floors[0].grid.length, base = v3(mouths[id].x, CAVE_SKY, mouths[id].z);
    const floors = new Map(plan.floors.map(f => [f.level, f.grid]));
    const levels = plan.floors.map(f => f.level).sort((a, b) => b - a);
    const group = new THREE.Group(); group.name = `Höhle ${plan.name}`; scene.add(group);
    const levelY = L => base.y + L * STOREY, cx = i => base.x + (i - W / 2 + .5) * CELL, cz = j => base.z + (j - H / 2 + .5) * CELL;
    const cellOf = (x, z) => [Math.floor((x - base.x) / CELL + W / 2), Math.floor((z - base.z) / CELL + H / 2)];
    const raw = (L, i, j) => floors.get(L)?.[j]?.[i] ?? '#';
    const opened = new Set(), closedGates = new Map(), secretCells = new Map(), bridgeCells = new Map();
    // A cell as it is now: secrets slid open become floor, lowered bridges become floor.
    const char = (L, i, j) => { const k = `${L},${i},${j}`; if (secretCells.has(k)) return secretCells.get(k).open ? '.' : '#'; if (bridgeCells.has(k)) return bridgeCells.get(k).open ? '.' : 'O'; return raw(L, i, j); };
    const walk = c => FLAT.has(c) || c in ARROWS;
    const rooms = plan.rooms || [];
    const roomAt = (L, i, j) => rooms.find(r => r.level === L && i >= r.x0 && i <= r.x1 && j >= r.y0 && j <= r.y1);
    const ceilingAt = (L, i, j) => {
      const above = levels.includes(L + 1) && (walk(raw(L + 1, i, j)) || raw(L + 1, i, j) === '=' || raw(L + 1, i, j) === 'O');
      const want = roomAt(L, i, j)?.ceiling ?? 5;
      return above ? Math.min(want, STOREY - 1.6) : want;
    };
    // Stairs: the step index along a run of five arrows (0 = top).
    function stairStep(L, i, j) {
      const c = raw(L, i, j), d = ARROWS[c]; if (!d) return -1;
      let k = 0; while (raw(L, i - d[0] * (k + 1), j - d[1] * (k + 1)) === c && k < 5) k++;
      return k;
    }
    /** The floor surface at a point of cell (L, i, j), or null where there is none. */
    function surface(L, i, j, x, z) {
      const c = char(L, i, j);
      if (c in ARROWS) {
        const [di, dj] = ARROWS[c], k = stairStep(L, i, j);
        const along = k + clamp(di ? (x - (cx(i) - di * CELL / 2)) * di / CELL : (z - (cz(j) - dj * CELL / 2)) * dj / CELL, 0, 1);
        return levelY(L) - STOREY * along / 5;
      }
      return FLAT.has(c) ? levelY(L) : null;
    }
    function ground(x, z, y) {
      const [i, j] = cellOf(x, z); let best = null;
      for (const L of levels) { const s = surface(L, i, j, x, z); if (s !== null && s <= y + .95 && (best === null || s > best)) best = s; }
      return best;
    }
    const levelOf = y => levels.reduce((b, L) => Math.abs(levelY(L) - y + 1) < Math.abs(levelY(b) - y + 1) ? L : b, levels[0]);
    const gateClosed = (L, i, j) => closedGates.get(`${L},${i},${j}`)?.closed;

    for (const e of plan.entities) {
      if (e.type === 'secret') for (const [si, sj] of e.cells) secretCells.set(`${e.level},${si},${sj}`, { open: false, id: e.id });
      if (e.type === 'bridge') for (const [bi, bj] of e.cells) bridgeCells.set(`${e.level},${bi},${bj}`, { open: false, id: e.id });
    }
    const secretAt = (L, i, j) => secretCells.has(`${L},${i},${j}`);
    let mouthCell = null;
    for (const [L, grid] of floors) grid.forEach((row, j) => { const i = row.indexOf('E'); if (i >= 0) mouthCell = { L, i, j }; });
    const shaft = (L, i, j) => L === mouthCell.L && i === mouthCell.i && j === mouthCell.j;
    // ── Geometry, merged per material.
    const buckets = new Map(), colliders = [];
    const mat = (name, tint, emissive = 0) => { const key = `${name}|${tint}|${emissive}`; if (!buckets.has(key)) buckets.set(key, { material: pixelMaterial(name, { tint, emissive }), parts: [] }); return buckets.get(key); };
    function box(m, w, h, d, x, y, z, ry = 0) { const g = boxGeometry(w, h, d).clone(); if (ry) g.rotateY(ry); g.translate(x, y, z); m.parts.push(g); }
    const collide = (x, z, hw, hd, bottom, top, extra = {}) => { const c = { kind: 'cave', surface: 'stone', x, z, rotation: 0, halfWidth: hw, halfDepth: hd, bottom, top, ...extra }; colliders.push(c); return c; };
    const waterM = mat('water', 0x6a8a90, .1), walkIn = style.walkIn;
    for (const L of levels) {
      const y = levelY(L);
      // Floors, walls and ceilings in runs along each row (colliders), boxes per cell (looks).
      for (let j = 0; j < H; j++) {
        let run = null;
        const flush = (endI, kind) => { if (!run) return; const n = endI - run.i, x = (cx(run.i) + cx(endI - 1)) / 2;
          if (kind === 'floor') collide(x, cz(j), n * CELL / 2, CELL / 2, y - 1, y);
          else if (kind === 'wall') collide(x, cz(j), n * CELL / 2, CELL / 2, y - 1, y + run.top, { surface: 'stone' });
          run = null; };
        // Floor runs (flat walkable cells; secret and bridge cells get their own).
        for (let i = 0; i <= W; i++) {
          const c = i < W ? raw(L, i, j) : '#', isFloor = FLAT.has(c) && !secretCells.has(`${L},${i},${j}`);
          if (isFloor && !run) run = { i }; else if (!isFloor && run) flush(i, 'floor');
        }
        // Walls: rock next to anything open on this storey, as high as the ceilings round it.
        for (let i = 0; i <= W; i++) {
          const c = i < W ? raw(L, i, j) : '.';
          let edge = false, top = 0;
          if (c === '#' && i < W && !secretAt(L, i, j)) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const n = raw(L, i + di, j + dj); if (walk(n) || n === 'O' || secretAt(L, i + di, j + dj)) { edge = true; top = Math.max(top, ceilingAt(L, i + di, j + dj) + 1.2); } }
          if (edge && !run) run = { i, top }; else if (edge) run.top = Math.max(run.top, top); else if (!edge && run) flush(i, 'wall');
        }
        // Ceilings over open cells (they also stop the camera).
        for (let i = 0; i < W; i++) {
          const c = raw(L, i, j); if (!(walk(c) || c === 'O' || secretAt(L, i, j))) continue;
          if (levels.includes(L + 1) && raw(L + 1, i, j) === 'O') continue;
          const ceil = ceilingAt(L, i, j);
          collide(cx(i), cz(j), CELL / 2, CELL / 2, y + ceil, y + ceil + 1.2);
        }
      }
      // Shallow water over its floor; stairs walk as steps (the rock draws them as a ramp).
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const c = raw(L, i, j), x = cx(i), z = cz(j);
        if (c === '~') box(waterM, CELL, .06, CELL, x, y + .32, z);
        if (c in ARROWS) {
          const [di, dj] = ARROWS[c], k = stairStep(L, i, j);
          for (let s = 0; s < 4; s++) {
            const t = (k * 4 + s + 1) / 20, top = y - STOREY * t + STOREY / 20, along = -CELL / 2 + (s + .5) * CELL / 4;
            const sx = x + di * along, sz = z + dj * along, w = di ? CELL / 4 : CELL, d = dj ? CELL / 4 : CELL, bottom = levelY(L - 1) - 1;
            collide(sx, sz, w / 2, d / 2, bottom, top);
          }
        }
      }
      // Floors under drops' rims: the hole itself is open down to the storey below.
    }
    const isOpen = (L, i, j) => { const c = raw(L, i, j); return walk(c) || c === 'O' || secretAt(L, i, j); };
    // ── The plan's things: lights, furniture, puzzle pieces, goblins.
    const at = (e, lift = 0) => v3(cx(e.x), surface(e.level, e.x, e.y, cx(e.x), cz(e.y)) ?? levelY(e.level), cz(e.y)).add(v3(0, lift, 0));
    const byId = new Map(plan.entities.map(e => [e.id, e]));
    const things = [], interact = [], animated = [];
    const solid = (m, w, h, d, x, y, z, ry = 0, name = 'cave prop') => { const mesh = new THREE.Mesh(boxGeometry(w, h, d), typeof m === 'string' ? pixelMaterial(m) : m); mesh.position.set(x, y, z); mesh.rotation.y = ry; mesh.name = name; group.add(mesh); return mesh; };
    const pm = (name, tint, emissive = 0) => pixelMaterial(name, { tint, emissive });
    // The wall next to a cell (for torches and levers): direction toward the nearest rock.
    const wallSide = e => { for (const [di, dj] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) if (raw(e.level, e.x + di, e.y + dj) === '#') return [di, dj]; return [0, -1]; };
    // A Blockbench prop (world/props.js CAVE_PROPS). `lift` puts the group's origin that high above the ground, so the
    // puzzle code moves it about its middle as it did the old blocks.
    const place = (name, x, y, z, ry = 0, lift = 0) => {
      const g = new THREE.Group(); g.position.set(x, y + lift, z); g.rotation.y = ry; g.name = `cave ${name}`; group.add(g);
      const prop = propClone(name, { solid: false }); if (prop) { prop.position.y = -lift; g.add(prop); }
      return g;
    };
    /** A collider round a prop's footprint (turned to the nearest quarter, the colliders here are axis-aligned). */
    const solidProp = (name, x, z, y, ry = 0, shrink = .8) => {
      const b = propBounds(name, Math.round(ry / (Math.PI / 2)) * Math.PI / 2); if (!b) return;
      collide(x + (b.minX + b.maxX) / 2, z + (b.minZ + b.maxZ) / 2, (b.maxX - b.minX) / 2 * shrink, (b.maxZ - b.minZ) / 2 * shrink, y, y + b.height, { surface: 'wood' });
    };
    const flameAt = (x, y, z, size) => { const flame = solid(pm('ember', 0xffb060, 1.8), size, size * 1.15, size, x, y, z, .4); animated.push({ kind: 'flame', mesh: flame, t: random() * 9 }); return flame; };
    /** Is a spot on open floor with nothing of the plan's on it? */
    const taken = new Set(plan.entities.map(e => `${e.level},${e.x},${e.y}`));
    const free2 = (x, z, y) => { const [i, j] = cellOf(x, z), L = levelOf(y); return FLAT.has(raw(L, i, j)) && !taken.has(`${L},${i},${j}`) && !secretAt(L, i, j); };
    const bakeLights = [];
    const lightAt = (position, color, intensity = 6, distance = 11, bake = 1.4) => {
      const light = new THREE.PointLight(color, intensity, distance, 2); light.position.copy(position); group.add(light); world.lights.adopt(light);
      if (bake) bakeLights.push({ x: position.x, y: position.y, z: position.z, color: new THREE.Color(color).multiplyScalar(bake), range: distance * 1.15, L: levelOf(position.y) });
      return light;
    };
    for (const e of plan.entities) {
      const p = at(e);
      switch (e.type) {
        case 'torch': { const [di, dj] = wallSide(e), x = p.x + di * .85, z = p.z + dj * .85;
          place('torch_wall', x, p.y, z, Math.atan2(di, dj)); flameAt(x - di * .1, p.y + 2.62, z - dj * .1, .2);
          lightAt(v3(x - di * .4, p.y + 2.5, z - dj * .4), style.torch, 6, 12, 1.7); break; }
        case 'fire': {
          place('fire_pit', p.x, p.y, p.z, random() * 6); flameAt(p.x, p.y + .45, p.z, .55);
          lightAt(v3(p.x, p.y + 1.6, p.z), 0xff9040, 8, 14, 2.3); things.push({ kind: 'fire', at: p });
          // Where they eat: a stew pot or a meat rack beside the fire.
          const side = random() * Math.PI * 2, sx = p.x + Math.cos(side) * 1.9, sz = p.z + Math.sin(side) * 1.9;
          if (free2(sx, sz, p.y)) { const kind = random() < .5 ? 'stew_pot' : 'meat_rack'; place(kind, sx, p.y, sz, side + Math.PI / 2); solidProp(kind, sx, sz, p.y, side + Math.PI / 2); }
          break; }
        case 'mushrooms': place('mushrooms', p.x, p.y, p.z, random() * 6); lightAt(v3(p.x, p.y + 1, p.z), 0x6fd2c0, 2.5, 8, .9); break;
        case 'bones': place('bone_pile', p.x, p.y, p.z, random() * 6); break;
        case 'totem': place('totem', p.x, p.y, p.z, random() * 6); collide(p.x, p.z, .25, .25, p.y, p.y + 3.5, { surface: 'wood' }); break;
        case 'altar': { const ry = random() < .5 ? 0 : Math.PI / 2; place('altar', p.x, p.y, p.z, ry); solidProp('altar', p.x, p.z, p.y, ry); break; }
        case 'drums': place('drums', p.x, p.y, p.z, random() * 6); collide(p.x, p.z, .55, .55, p.y, p.y + .8, { surface: 'wood' }); break;
        case 'banner': { const [di, dj] = wallSide(e); place('banner', p.x + di * .62, p.y, p.z + dj * .62, Math.atan2(di, dj)); break; }
        case 'bedroll': place('bed', p.x, p.y, p.z, random() * 6); break;
        case 'crate': { const ry = random() * 6; place('junk', p.x, p.y, p.z, ry); solidProp('junk', p.x, p.z, p.y, ry, .7); break; }
        case 'cart': { const ry = random() * .4; place('cart', p.x, p.y, p.z, ry); solidProp('cart', p.x, p.z, p.y, ry); break; }
        case 'rails': for (const [ri, rj] of e.cells) place('rails', cx(ri), levelY(e.level), cz(rj), 0); break;
        case 'note': place('scrap', p.x, p.y, p.z, random() * 6); interact.push({ e, at: p, label: `${e.title} lesen`, act: () => ({ toast: `${e.title} — ${e.text}`, lore: true }) }); break;
        case 'clue': { const [di, dj] = wallSide(e); place('carving', p.x + di * .55, p.y, p.z + dj * .55, Math.atan2(di, dj)); interact.push({ e, at: p, label: 'Zeichen betrachten', act: () => ({ toast: e.text, lore: true }) }); break; }
        case 'chest': { const ry = (random() - .5) * .8; place('chest', p.x, p.y, p.z, ry); collide(p.x, p.z, .55, .4, p.y, p.y + .75, { surface: 'wood' });
          interact.push({ e, at: p, label: e.locked ? 'Verschlossene Truhe' : 'Truhe öffnen', needsKey: e.locked ? e.key : null, act: () => ({ loot: e.tier || 1, open: e.id }) }); break; }
        case 'key': { const mesh = place('key', p.x, p.y, p.z, random() * 6); interact.push({ e, at: p, label: 'Schlüssel nehmen', mesh, act: () => ({ take: e.id }) }); break; }
        case 'cage': { place('cage', p.x, p.y, p.z, random() * 6);
          for (const [ox, oz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) collide(p.x + ox * .9, p.z + oz * .9, ox ? .1 : .9, oz ? .1 : .9, p.y, p.y + 2.5, { surface: 'wood' });
          interact.push({ e, at: p, label: 'Käfig öffnen', act: () => ({ free: e.id, prisoner: e.prisoner }) }); things.push({ kind: 'cage', e, at: p }); break; }
        case 'gate': {
          const bars = new THREE.Group(); bars.position.set(p.x, levelY(e.level), p.z); group.add(bars);
          const along = e.orientation === 'ew', model = propClone(id === 'eisengrube' ? 'gate_iron' : 'gate_wood', { solid: false });
          if (model) { model.rotation.y = along ? 0 : Math.PI / 2; bars.add(model); }
          const col = collide(p.x, p.z, along ? CELL / 2 : .3, along ? .3 : CELL / 2, levelY(e.level), levelY(e.level) + 5, { surface: 'wood', moving: true });
          const gate = { e, bars, col, closed: true, lift: 0 };
          closedGates.set(`${e.level},${e.x},${e.y}`, gate); animated.push({ kind: 'gate', gate }); break; }
        case 'lever': { const [di, dj] = wallSide(e), x = p.x + di * .8, z = p.z + dj * .8;
          place('lever_base', x, p.y, z, Math.atan2(di, dj)); const handle = place('lever_handle', x, p.y + .85, z, Math.atan2(di, dj)); handle.rotation.x = .6;
          collide(x, z, .3, .3, p.y, p.y + .9, { surface: 'stone' });
          interact.push({ e, at: p, label: 'Hebel ziehen', handle, act: () => ({ pull: e }) }); break; }
        case 'chain': { const [di, dj] = wallSide(e); place('chain_pull', p.x + di * .55, p.y, p.z + dj * .55, Math.atan2(di, dj));
          interact.push({ e, at: p, label: 'An der Kette ziehen', act: () => ({ pull: e }) }); break; }
        case 'pillar': {
          const col = place('pillar', p.x, p.y, p.z, 0, 1.2); col.userData.symbol = e.start;
          collide(p.x, p.z, .5, .5, p.y, p.y + 2.4, { surface: 'stone' });
          const faces = []; for (const [fx, fz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) faces.push(solid(pm('clothLinen', SYMBOL[e.symbols[e.start]], .35), fx ? .04 : .5, .5, fz ? .04 : .5, p.x + fx * .47, p.y + 1.6, p.z + fz * .47));
          const pillar = { e, col, faces, index: e.start, turn: 0 }; things.push({ kind: 'pillar', pillar });
          interact.push({ e, at: p, label: () => `Säule drehen (${pillar.symbolName()})`, act: () => ({ turn: pillar }) });
          pillar.symbolName = () => ({ ohr: 'Ohr', auge: 'Auge', kette: 'Kette', pilz: 'Pilz', knochen: 'Knochen', mond: 'Mond' })[e.symbols[pillar.index]];
          animated.push({ kind: 'pillar', pillar }); break; }
        case 'brazier': { place('brazier', p.x, p.y, p.z, random() * 6); collide(p.x, p.z, .45, .45, p.y, p.y + 1.3, { surface: 'metal' });
          const flame = flameAt(p.x, p.y + 1.6, p.z, .55); flame.visible = false;
          const brazier = { e, flame, lit: false, at: p, light: lightAt(v3(p.x, p.y + 2, p.z), 0xff9a50, 0, 12, 0) }; things.push({ kind: 'brazier', brazier });
          interact.push({ e, at: p, label: () => brazier.lit ? null : `Schale ${e.label ? `„${e.label}“ ` : ''}entzünden`, act: () => ({ light: brazier }) }); break; }
        case 'plate': { const plate = place('plate', p.x, p.y, p.z, 0, .03); things.push({ kind: 'plate', plate: { e, mesh: plate, at: p, down: false } }); break; }
        case 'idol': { const mesh = place('idol', p.x, p.y, p.z, random() * 6, .35); const idol = { e, mesh, at: p.clone(), held: false }; things.push({ kind: 'idol', idol });
          interact.push({ e, at: p, label: () => idol.held ? null : `${e.label || 'Götzenbild'} nehmen`, idol, act: () => ({ pickIdol: idol }) }); break; }
        case 'socket': { const [di, dj] = wallSide(e); const x = p.x + di * .8, z = p.z + dj * .8; place('socket', x, p.y, z, Math.atan2(di, dj)); collide(x, z, .45, .45, p.y, p.y + 1.4, { surface: 'stone' });
          const socket = { e, at: p, filled: false, x, z }; things.push({ kind: 'socket', socket }); interact.push({ e, at: p, label: () => socket.filled ? null : 'Götzenbild einsetzen', act: () => ({ socket }) }); break; }
        case 'secret': for (const [si, sj] of e.cells) { const k = `${e.level},${si},${sj}`, sp = v3(cx(si), levelY(e.level), cz(sj)), top = ceilingAt(e.level, si, sj) + 1;
          const rock = solid(pm(...style.wall2), CELL, top + 1, CELL, sp.x, sp.y + top / 2 - .5, sp.z);
          const col = collide(sp.x, sp.z, CELL / 2, CELL / 2, sp.y - 1, sp.y + top, { moving: true }), floor = collide(sp.x, sp.z, CELL / 2, CELL / 2, sp.y - 1, sp.y, { disabled: true, moving: true });
          Object.assign(secretCells.get(k), { rock, col, floor }); }
          break;
        case 'bridge': for (const [bi, bj] of e.cells) { const k = `${e.level},${bi},${bj}`, bp = v3(cx(bi), levelY(e.level), cz(bj));
          const deck = solid('planks', CELL, .25, CELL * .95, bp.x, bp.y - .12, bp.z); deck.visible = false; const floor = collide(bp.x, bp.z, CELL / 2, CELL / 2, bp.y - 1, bp.y, { disabled: true, moving: true });
          Object.assign(bridgeCells.get(k), { deck, floor }); }
          break;
        case 'trap': things.push({ kind: 'trap', trap: { e, cells: e.trigger.map(([ti, tj]) => v3(cx(ti), levelY(e.level), cz(tj))), armed: true, t: 0 } }); break;
      }
    }
    // Filth in every room: dung and slime, gnawed bones, junk heaps, against the walls where nobody walks through.
    for (const room of rooms) {
      const spots = [];
      for (let j = room.y0; j <= room.y1; j++) for (let i = room.x0; i <= room.x1; i++) if (FLAT.has(raw(room.level, i, j)) && !taken.has(`${room.level},${i},${j}`)) {
        const wall = [[0, -1], [1, 0], [0, 1], [-1, 0]].find(([di, dj]) => raw(room.level, i + di, j + dj) === '#');
        if (wall) spots.push([i, j, wall]);
      }
      const n = Math.min(spots.length, 1 + Math.floor((room.x1 - room.x0 + 1) * (room.y1 - room.y0 + 1) / 14));
      for (let k = 0; k < n; k++) {
        const [i, j, [di, dj]] = spots[Math.floor(random() * spots.length)], key = `${room.level},${i},${j}`;
        if (taken.has(key)) continue; taken.add(key);
        const kind = ['filth', 'filth', 'bone_pile', 'junk', 'filth'][Math.floor(random() * 5)], x = cx(i) + di * .45, z = cz(j) + dj * .45;
        place(kind, x, levelY(room.level), z, random() * 6);
        if (kind === 'junk') solidProp('junk', x, z, levelY(room.level), 0, .6);
      }
    }
    // Rooms the plan calls lit or dim get wall torches of their own (two or one), spread along their walls.
    for (const room of rooms) {
      const want = room.light === 'lit' ? 2 : room.light === 'dim' ? 1 : 0, spots = [];
      for (let j = room.y0; j <= room.y1; j++) for (let i = room.x0; i <= room.x1; i++) if (FLAT.has(raw(room.level, i, j))) for (const [di, dj] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) if (raw(room.level, i + di, j + dj) === '#') spots.push([i, j, di, dj]);
      for (let k = 0; k < want && spots.length; k++) {
        const [i, j, di, dj] = spots[Math.floor((k + .5) / want * spots.length)], y = levelY(room.level), x = cx(i) + di * .85, z = cz(j) + dj * .85;
        place('torch_wall', x, y, z, Math.atan2(di, dj)); flameAt(x - di * .1, y + 2.62, z - dj * .1, .2);
        lightAt(v3(x - di * .4, y + 2.5, z - dj * .4), style.torch, 6, 12, 1.7);
      }
    }
    // ── The way in and out: a tunnel climbing to the daylight in the walk-in caves; the old mine's shaft, a rope down it.
    const exitAt = v3(cx(mouthCell.i), levelY(mouthCell.L), cz(mouthCell.j));
    let inward = [0, 1]; for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (walk(raw(mouthCell.L, mouthCell.i + d[0], mouthCell.j + d[1]))) { inward = d; break; }
    const spawnAt = exitAt.clone().add(v3(inward[0] * CELL * 1.2, 0, inward[1] * CELL * 1.2)), spawnYaw = Math.atan2(-inward[0], -inward[1]);
    interact.push({ e: { id: 'exit', type: 'exit' }, at: exitAt, label: walkIn ? 'Ins Freie' : 'Am Seil hinaufklettern', act: () => ({ exit: true }) });
    const out = v3(-inward[0], 0, -inward[1]), tubes = [];
    if (walkIn) {
      const a = exitAt.clone().add(v3(0, 1.4, 0)), b = exitAt.clone().addScaledVector(out, 13).add(v3(0, 5.5, 0)), along = b.clone().sub(a).normalize();
      tubes.push({ a: a.toArray(), b: b.toArray(), r: 1.75 });
      const day = solid(pm('stoneLight', 0xeef4f8, 2), 3.2, 3.2, .1, b.x - along.x * 1.1, b.y - along.y * 1.1, b.z - along.z * 1.1, Math.atan2(out.x, out.z));
      day.rotation.x = -Math.atan2(along.y, Math.hypot(along.x, along.z));
      lightAt(exitAt.clone().addScaledVector(out, 3.5).add(v3(0, 2.8, 0)), 0xd8e6f0, 4, 15, 2.4);
    } else {
      const shaftTop = levelY(mouthCell.L) + ceilingAt(mouthCell.L, mouthCell.i, mouthCell.j) + 8.5;
      solid(pm('stoneLight', 0xd8e4ec, 1.6), CELL * .9, .1, CELL * .9, exitAt.x, shaftTop, exitAt.z);
      solid(pm('clothLinen', 0x8a7a5c), .09, shaftTop - exitAt.y, .09, exitAt.x - inward[0] * .55 + inward[1] * .4, (shaftTop + exitAt.y) / 2, exitAt.z - inward[1] * .55 + inward[0] * .4);
      solid(pm('clothLinen', 0x8a7a5c), .5, .12, .5, exitAt.x - inward[0] * .55 + inward[1] * .4, exitAt.y + .06, exitAt.z - inward[1] * .55 + inward[0] * .4, .4);
      lightAt(exitAt.clone().add(v3(0, 4.5, 0)), 0xc8dce8, 4, 13, 2.2);
    }
    /** Walking out along the tunnel from the mouth cell leaves the cave. */
    const walkOut = q => walkIn && Math.abs(q.y - exitAt.y) < 1.5 && cellOf(q.x, q.z).join() === `${mouthCell.i},${mouthCell.j}` && (q.x - exitAt.x) * out.x + (q.z - exitAt.z) * out.z > .45;

    // ── The rock itself (systems/caveRock.js), lit by every light placed above.
    const rockMaterial = ([name, tint]) => caveRockMaterial(pixelTexture(name), tint, style.grime);
    const materials = { floor: rockMaterial(style.floor), mud: caveRockMaterial(pixelTexture('mud'), 0x7a6c56, style.grime), rubble: rockMaterial([style.floor[0], 0x8e867a]),
      wall: rockMaterial(style.wall), wall2: rockMaterial(style.wall2), ceil: rockMaterial(style.ceil) };
    const floorFor = (L, i, j, x, z) => { const c = raw(L, i, j); return c in ARROWS ? surface(L, i, j, x, z) : c === 'O' ? levelY(L) - STOREY : levelY(L); };
    const classify = (x, y, z, nx, ny) => {
      if (ny > .6) {
        const [i, j] = cellOf(x, z), L = levels.find(l => Math.abs(y - levelY(l)) < .4), c = L === undefined ? '.' : raw(L, i, j);
        return c === ',' || c === '~' ? 'mud' : c === ':' ? 'rubble' : 'floor';
      }
      if (ny < -.45) return 'ceil';
      return vnoise(x * .13, y * .11, z * .13) > .15 ? 'wall2' : 'wall';
    };
    group.add(buildCaveRock({
      cells: { W, H, CELL, x0: base.x - W * CELL / 2, z0: base.z - H * CELL / 2 }, tubes, lights: bakeLights, ambient: new THREE.Color(...style.ambient), classify, materials,
      levels: levels.map(L => ({ L, y: levelY(L), open: (i, j) => isOpen(L, i, j), floor: (i, j, x, z) => floorFor(L, i, j, x, z),
        top: (i, j) => levelY(L) + ceilingAt(L, i, j) + (!walkIn && shaft(L, i, j) ? 9 : 0) })),
    }));
    for (const { material, parts } of buckets.values()) {
      if (!parts.length) continue;
      const mesh = new THREE.Mesh(mergeGeometries(parts, false), material); parts.forEach(p => p.dispose());
      mesh.name = 'cave water'; mesh.receiveShadow = false; mesh.castShadow = false; group.add(mesh);
    }

    world.addColliders(colliders);
    physics?.addStaticColliders(colliders.filter(c => !c.disabled && !c.moving));

    // ── Goblin navigation over the grid: A* across cells and stairs, ground, walls, sight.
    const key = (L, i, j) => ((L + 4) * H + j) * W + i;
    function neighbours(L, i, j, out) {
      out.length = 0;
      const c = char(L, i, j);
      if (c in ARROWS) {
        const [di, dj] = ARROWS[c], k = stairStep(L, i, j);
        out.push(k < 4 ? [L, i + di, j + dj] : [L - 1, i + di, j + dj]);
        out.push([L, i - di, j - dj]);
        return out;
      }
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const ni = i + di, nj = j + dj, n = char(L, ni, nj);
        if (!(walk(n) || n === 'O') || gateClosed(L, ni, nj)) continue;
        if (n in ARROWS && (ARROWS[n][0] !== di || ARROWS[n][1] !== dj || stairStep(L, ni, nj) !== 0)) continue;
        if (di && dj && (!walk(char(L, i + di, j)) || !walk(char(L, i, j + dj)))) continue;
        if (n === 'O') { if (walk(char(L - 1, ni, nj))) out.push([L - 1, ni, nj]); continue; }
        out.push([L, ni, nj]);
      }
      // Arriving at the foot of a stair from the storey below: walk back up it.
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ui = i - di, uj = j - dj, u = raw(L + 1, ui, uj);
        if (ARROWS[u] && ARROWS[u][0] === di && ARROWS[u][1] === dj && stairStep(L + 1, ui, uj) === 4) out.push([L + 1, ui, uj]);
      }
      return out;
    }
    const scratch = [];
    function path(from, to) {
      const [fi, fj] = cellOf(from.x, from.z), [ti, tj] = cellOf(to.x, to.z), fL = levelOf(from.y), tL = levelOf(to.y);
      const start = key(fL, fi, fj), goal = key(tL, ti, tj);
      if (start === goal) return [to.clone()];
      // A binary heap on the estimate: with a dozen goblins asking for paths, a linear scan of the open list stalled frames.
      const open = [[0, fL, fi, fj]], came = new Map([[start, null]]), cost = new Map([[start, 0]]), done = new Set();
      const push = n => { open.push(n); for (let c = open.length - 1; c > 0;) { const p = (c - 1) >> 1; if (open[p][0] <= open[c][0]) break; [open[p], open[c]] = [open[c], open[p]]; c = p; } };
      const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; for (let c = 0; ;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === c) break; [open[m], open[c]] = [open[c], open[m]]; c = m; } } return top; };
      let steps = 0;
      while (open.length && steps++ < 2500) {
        const [, L, i, j] = pop(), kk = key(L, i, j);
        if (done.has(kk)) continue; done.add(kk);
        if (kk === goal) break;
        for (const [nL, ni, nj] of neighbours(L, i, j, scratch)) {
          const nk = key(nL, ni, nj), c = cost.get(kk) + Math.hypot(ni - i, nj - j) + (nL !== L ? 1 : 0);
          if (c < (cost.get(nk) ?? Infinity)) { cost.set(nk, c); came.set(nk, kk); push([c + Math.hypot(ti - ni, tj - nj) + Math.abs(tL - nL) * 4, nL, ni, nj]); }
        }
      }
      if (!came.has(goal)) return null;
      const out = []; for (let k = goal; k !== null && k !== start; k = came.get(k)) { const i = k % W, j = Math.floor(k / W) % H, L = Math.floor(k / (W * H)) - 4; out.push(v3(cx(i), surface(L, i, j, cx(i), cz(j)) ?? levelY(L), cz(j))); }
      out.reverse(); if (out.length) out[out.length - 1] = to.clone();
      return out;
    }
    function free(x, z, y, r) {
      for (const [ox, oz] of [[r, r], [-r, r], [r, -r], [-r, -r]]) {
        const g = ground(x + ox, z + oz, y); if (g === null || Math.abs(g - y) > 1) return false;
        const [i, j] = cellOf(x + ox, z + oz); if (gateClosed(levelOf(y), i, j)) return false;
      }
      return true;
    }
    function los(a, b) {
      const d = a.distanceTo(b), n = Math.ceil(d / .5);
      for (let k = 1; k < n; k++) {
        const t = k / n, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t, g = ground(x, z, y);
        if (g === null || y < g - .2) return false;
        const [i, j] = cellOf(x, z), L = levelOf(g); if (y > g + ceilingAt(L, i, j) || gateClosed(L, i, j)) return false;
      }
      return true;
    }
    const nav = { ground, free, path, los, level: levelOf };

    // ── Puzzles at work.
    function setOpen(targetId, how = true) {
      const target = byId.get(targetId); if (!target) return;
      if (target.type === 'gate') { const g = closedGates.get(`${target.level},${target.x},${target.y}`); if (g) g.closed = !how; }
      if (target.type === 'secret') for (const s of secretCells.values()) if (s.id === targetId && how && !s.open) { s.open = true; s.col.disabled = true; s.floor.disabled = false; s.sinking = 0; animated.push({ kind: 'secret', s }); }
      if (target.type === 'bridge') for (const b of bridgeCells.values()) if (b.id === targetId && how) { b.open = true; b.floor.disabled = false; b.deck.visible = true; }
      if (how) opened.add(targetId); else opened.delete(targetId);
    }
    const groups = new Map();
    function check(groupId) {
      const pillars = things.filter(t => t.kind === 'pillar' && t.pillar.e.group === groupId).map(t => t.pillar);
      if (pillars.length && pillars.every(p => p.index === p.e.solution)) { const door = plan.entities.find(e => e.type === 'pillarDoor' && e.group === groupId); door?.targets.forEach(t => setOpen(t)); return 'solved'; }
      return null;
    }
    const state = { carrying: null, keys: new Set() };
    /** What the wanderer can do at a spot, and doing it: returns what main.js should show or hand out. */
    function nearest(pos) {
      let best = null, bd = 2.2;
      for (const it of interact) {
        if (Math.abs(it.at.y - pos.y) > 2.2) continue;
        const d = Math.hypot(it.at.x - pos.x, it.at.z - pos.z), label = typeof it.label === 'function' ? it.label() : it.label;
        if (!label || it.done) continue;
        if (d < bd) { bd = d; best = { it, label: it.needsKey && state.keys.has(it.needsKey) ? 'Truhe aufschließen' : label }; }
      }
      // Carrying an idol: put it down on a plate or into a socket here.
      if (state.carrying) {
        const plate = things.find(t => t.kind === 'plate' && Math.hypot(t.plate.at.x - pos.x, t.plate.at.z - pos.z) < 1.8);
        if (plate) best = { it: { act: () => ({ dropIdol: plate.plate }) }, label: `${state.carrying.e.label || 'Götzenbild'} auf die Platte stellen` };
        else if (!best || best.label !== 'Götzenbild einsetzen') best = best?.label === 'Götzenbild einsetzen' ? best : { it: { act: () => ({ dropIdol: null }) }, label: `${state.carrying.e.label || 'Götzenbild'} abstellen` };
      }
      return best;
    }
    function use(choice, player) {
      const r = choice.it.act(); const it = choice.it;
      if (r.pull) {
        const e = r.pull; if (opened.has(e.id) && e.oneWay) return { toast: 'Der Hebel rührt sich nicht mehr.' };
        if (it.needsKey) return {};
        const now = !opened.has(e.id); (e.targets || []).forEach(t => setOpen(t, e.type === 'chain' ? true : e.oneWay ? true : now)); if (now) opened.add(e.id); else opened.delete(e.id);
        if (it.handle) it.handle.rotation.x = now ? -.6 : .6;
        if (e.type === 'chain') it.done = true;
        return { sound: 'lever', toast: e.type === 'chain' ? 'Etwas Schweres gleitet im Fels.' : 'Ein Zug rasselt durch die Wände.' };
      }
      if (r.turn) { const p = r.turn; p.index = (p.index + 1) % p.e.symbols.length; p.turn = 1; const solved = check(p.e.group); if (solved) { for (const t of things) if (t.kind === 'pillar' && t.pillar.e.group === p.e.group) interact.find(x => x.e === t.pillar.e).done = true; return { sound: 'lever', toast: 'Die Säulen rasten ein. Ein Tor hebt sich.', solved: true }; } return { sound: 'stone' }; }
      if (r.light) {
        const b = r.light, group = b.e.group, list = things.filter(t => t.kind === 'brazier' && t.brazier.e.group === group).map(t => t.brazier);
        const next = list.filter(x => x.lit).length + 1;
        if (b.e.order !== next) { for (const x of list) { x.lit = false; x.flame.visible = false; } return { sound: 'hiss', toast: 'Die Flammen ersticken. Die Reihenfolge war falsch.' }; }
        b.lit = true; b.flame.visible = true; b.light.intensity = 7; things.push({ kind: 'fire', at: b.at });
        if (list.every(x => x.lit)) { const door = plan.entities.find(e => e.type === 'brazierDoor' && e.group === group); door?.targets.forEach(t => setOpen(t)); opened.add(`lit:${group}`); return { sound: 'fire', toast: 'Die Totenfeuer brennen. Irgendwo öffnet sich ein Tor.', solved: true }; }
        return { sound: 'fire' };
      }
      if (r.pickIdol) { const idol = r.pickIdol; idol.held = true; idol.mesh.visible = false; state.carrying = idol; for (const t of things) if (t.kind === 'plate' && t.plate.idol === idol) t.plate.idol = null; return { toast: `${idol.e.label || 'Götzenbild'} genommen` }; }
      if (r.dropIdol !== undefined) {
        const idol = state.carrying; if (!idol) return {}; state.carrying = null; idol.held = false;
        const spot = r.dropIdol ? r.dropIdol.at : player.position; idol.mesh.position.set(spot.x, (r.dropIdol ? r.dropIdol.at.y + .12 : player.position.y) + .35, spot.z); idol.mesh.visible = true;
        idol.at.copy(idol.mesh.position).y -= .35; interact.find(x => x.idol === idol).at = idol.at;
        if (r.dropIdol) r.dropIdol.idol = idol;
        return { toast: r.dropIdol ? 'Die Platte senkt sich unter dem Gewicht.' : null };
      }
      if (r.socket) {
        const s = r.socket; if (!state.carrying || state.carrying.e.id !== s.e.needs) return { toast: state.carrying ? 'Das passt nicht in diese Nische.' : 'Eine leere Nische. Hier fehlt ein Götzenbild.' };
        const idol = state.carrying; state.carrying = null; idol.mesh.position.set(s.x, s.at.y + 1.75, s.z); idol.mesh.visible = true; s.filled = true;
        (s.e.targets || []).forEach(t => setOpen(t)); opened.add(s.e.id); return { sound: 'stone', toast: 'Das Götzenbild rastet ein.', solved: true };
      }
      if (r.loot) { if (it.needsKey && !state.keys.has(it.needsKey)) return { toast: 'Verschlossen. Irgendwo muss der Schlüssel sein.' }; it.done = true; opened.add(r.open); return { loot: r.loot, sound: 'chest' }; }
      if (r.take) { state.keys.add(byId.get(r.take).opens); it.done = true; it.mesh.visible = false; opened.add(r.take); return { toast: 'Schlüssel genommen' }; }
      if (r.free) { it.done = true; opened.add(r.free); return { free: r.prisoner, sound: 'lever' }; }
      return r;
    }

    // ── Per step: gates lifting, secrets sinking, flames, pillars turning, plates, traps.
    function update(dt, player, hurt) {
      for (const a of animated) {
        if (a.kind === 'gate') { const g = a.gate; g.lift += ((g.closed ? 0 : 1) - g.lift) * Math.min(1, dt * 2.5); g.bars.position.y = levelY(g.e.level) + g.lift * 4.4; g.col.disabled = g.lift > .5; }
        else if (a.kind === 'flame') { if (!a.mesh.visible) continue; a.t += dt; const f = Math.floor(a.t * 9); a.mesh.scale.set(1 + (f % 3) * .1, 1 + ((f * 7) % 4) * .08, 1); a.mesh.rotation.y = (f % 2) * .4; }
        else if (a.kind === 'secret') { a.s.sinking = Math.min(1, a.s.sinking + dt * .5); a.s.rock.position.y -= dt * .5 * 6; if (a.s.sinking >= 1) a.s.rock.visible = false; }
        else if (a.kind === 'pillar') { const p = a.pillar; if (p.turn > 0) { p.turn = Math.max(0, p.turn - dt * 3); p.col.rotation.y += dt * 3 * Math.PI / 2; if (p.turn === 0) p.faces.forEach(f => f.material = pixelMaterial('clothLinen', { tint: SYMBOL[p.e.symbols[p.index]], emissive: .35 })); } }
      }
      for (const t of things) {
        if (t.kind === 'plate') {
          const pl = t.plate, onIt = Math.hypot(player.position.x - pl.at.x, player.position.z - pl.at.z) < 1 && Math.abs(player.position.y - pl.at.y) < .6;
          const down = onIt || !!pl.idol;
          if (down !== pl.down) { pl.down = down; pl.mesh.position.y = pl.at.y + (down ? -.02 : .03); for (const target of pl.e.targets) setOpen(target, down); }
        } else if (t.kind === 'trap') {
          const tr = t.trap; tr.t = Math.max(0, tr.t - dt);
          const on = tr.cells.some(c => Math.hypot(player.position.x - c.x, player.position.z - c.z) < 1.1 && Math.abs(player.position.y - c.y) < .8);
          if (on && tr.armed) { tr.armed = false; tr.fire = .4; tr.t = 4; }
          if (tr.fire > 0 && (tr.fire -= dt) <= 0) { const still = tr.cells.some(c => Math.hypot(player.position.x - c.x, player.position.z - c.z) < 1.4); if (still) hurt(tr.e.kind === 'darts' ? 14 : tr.e.kind === 'spikes' ? 20 : 24); tr.sprung = performance.now(); }
          if (!tr.armed && tr.t <= 0) tr.armed = true;
        }
      }
    }
    // Saved state: what is open, what is taken.
    function restore(ids) { for (const idRestored of ids) { const e = byId.get(idRestored); if (!e) { if (idRestored.startsWith('lit:')) { const g = idRestored.slice(4); for (const t of things) if (t.kind === 'brazier' && t.brazier.e.group === g) { t.brazier.lit = true; t.brazier.flame.visible = true; t.brazier.light.intensity = 7; } } continue; }
      if (e.type === 'lever' || e.type === 'chain') { (e.targets || []).forEach(t => setOpen(t)); opened.add(e.id); const it = interact.find(x => x.e === e); if (it?.handle) it.handle.rotation.x = -.6; if (e.type === 'chain' && it) it.done = true; }
      else if (e.type === 'chest' || e.type === 'cage' || e.type === 'key') { opened.add(e.id); const it = interact.find(x => x.e === e); if (it) { it.done = true; if (it.mesh) it.mesh.visible = false; } if (e.type === 'key') state.keys.add(e.opens); }
      else setOpen(e.id); }
      for (const [gid] of groups) check(gid);
    }
    const cave = { id, index, plan, base, group, nav, levels, levelY, spawnAt, spawnYaw, exitAt, walkOut, nearest, use, update, restore, opened, state, colliders,
      fires: () => things.filter(t => t.kind === 'fire').map(t => t.at), goblins: plan.entities.filter(e => e.type === 'goblin' || e.type === 'chief').map(e => ({ ...e, at: at(e), patrol: e.patrol?.map(([px, py]) => v3(cx(px), levelY(e.level), cz(py))) })),
      cages: () => things.filter(t => t.kind === 'cage'),
      softAt: (x, z, y) => { const [i, j] = cellOf(x, z); const L = levelOf(y); return char(L, i, j) === ',' ? 'mud' : char(L, i, j) === '~' ? null : null; },
      contains: p => Math.abs(p.y - base.y) < 40 && Math.abs(p.x - base.x) < W * CELL / 2 + 6 && Math.abs(p.z - base.z) < H * CELL / 2 + 6 };
    built.set(id, cave);
    return cave;
  }
  return { build, built, caves: CAVES };
}

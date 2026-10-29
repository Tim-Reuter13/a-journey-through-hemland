import * as THREE from 'three';
import { BOUNDS, CHUNK, WATER_LEVEL, biomeWeights } from './hemland.js';
import { buildChunkMesh } from './terrain.js';
import { scatterChunk, groundCoverChunk } from './flora.js';
import { batchScenery } from './batching.js';
import { collidersFrom } from './navigation.js';
import { treeMeshes, showTreeDetail } from './trees.js';

// Streams the region around the player in 128-unit chunks. Rings (Chebyshev
// distance in chunks): 0–1 full detail + grass + colliders + physics terrain,
// 2 medium terrain + trees, 3 coarse terrain only. Work is spread over frames
// with a time budget so walking never hitches; chunks far behind are freed.
const seeded = seed => { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const inside = (cx, cz) => cx * CHUNK + CHUNK > BOUNDS.minX && cx * CHUNK < BOUNDS.maxX && cz * CHUNK + CHUNK > BOUNDS.minZ && cz * CHUNK < BOUNDS.maxZ;

export function createChunkStreamer({ scene, field, collision, water = null, avoidTrees = () => false, avoidGround = () => false, radius = 3 }) {
  const chunks = new Map();
  let physics = null;
  const root = new THREE.Group(); root.name = 'streamed terrain'; scene.add(root);
  const key = (cx, cz) => `${cx},${cz}`;
  let center = null;
  const timing = {};

  function chunk(cx, cz) {
    const k = key(cx, cz);
    if (!chunks.has(k)) chunks.set(k, { cx, cz, lod: -1, mesh: null, water: null, scatter: null, trees: null, near: null, ground: null, colliders: [], physicsBodies: [], terrainCollider: null });
    return chunks.get(k);
  }
  const jobs = {
    terrain(c, lod) {
      const mesh = buildChunkMesh(field, c.cx, c.cz, lod);
      if (c.mesh) { root.remove(c.mesh); c.mesh.geometry.dispose(); }
      c.mesh = mesh; c.lod = lod; root.add(mesh);
    },
    scatter(c) {
      const group = new THREE.Group(); group.name = `scatter ${c.cx},${c.cz}`;
      scatterChunk(group, field, biomeWeights, WATER_LEVEL, c.cx * CHUNK, c.cz * CHUNK, CHUNK, seeded(c.cx * 7919 + c.cz * 104729 + 17), avoidTrees);
      c.colliders = collidersFrom(group);
      batchScenery(group, new Set(), 64);
      c.trees = treeMeshes(group); c.near = !center || Math.max(Math.abs(c.cx - center[0]), Math.abs(c.cz - center[1])) <= 1;
      showTreeDetail(c.trees, c.near);
      root.add(group); c.scatter = group;
      for (const col of c.colliders) collision.add(col);
    },
    water(c) {
      const mesh = water.chunkMesh(c.cx, c.cz);
      c.water = mesh || 'dry'; if (mesh) root.add(mesh);
    },
    ground(c) {
      const mesh = groundCoverChunk(field, biomeWeights, WATER_LEVEL, c.cx * CHUNK, c.cz * CHUNK, CHUNK, seeded(c.cx * 15485863 + c.cz * 32452843 + 5), avoidGround);
      if (mesh) { root.add(mesh); c.ground = mesh; } else c.ground = 'empty';
    },
    physics(c) {
      if (!physics) return;
      const g = field.grid(c.cx, c.cz);
      c.terrainCollider = physics.addTerrainChunk(g.x0, g.z0, CHUNK, field.CELLS, g.heights);
      c.physicsBodies = physics.addStaticColliders(c.colliders);
    },
  };
  function dropScatter(c) {
    if (!c.scatter) return;
    root.remove(c.scatter);
    c.scatter.traverse(o => { if (o.isMesh && o.name === 'Static scenery cell') o.geometry.dispose(); });
    collision.remove(c.colliders); c.colliders = []; c.scatter = null; c.trees = null;
  }
  function dropGround(c) { if (c.ground && c.ground !== 'empty') { root.remove(c.ground); c.ground.geometry.dispose(); c.ground.dispose(); } c.ground = null; }
  function dropPhysics(c) {
    if (c.terrainCollider) physics.removeCollider(c.terrainCollider);
    c.physicsBodies.forEach(b => physics.removeCollider(b));
    c.terrainCollider = null; c.physicsBodies = [];
  }
  function drop(c) {
    dropScatter(c); dropGround(c); if (physics) dropPhysics(c);
    if (c.mesh) { root.remove(c.mesh); c.mesh.geometry.dispose(); }
    if (c.water && c.water !== 'dry') { root.remove(c.water); c.water.geometry.dispose(); c.water.userData.dispose?.(); }
    chunks.delete(key(c.cx, c.cz));
  }

  /** Brings chunks around `focus` up to date, spending at most `budget` ms (Infinity to load everything now). */
  function update(focus, budget = 5) {
    const fcx = Math.floor(focus.x / CHUNK), fcz = Math.floor(focus.z / CHUNK);
    center = [fcx, fcz];
    for (const c of [...chunks.values()]) if (Math.max(Math.abs(c.cx - fcx), Math.abs(c.cz - fcz)) > radius + 1) drop(c);
    const todo = [];
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
      const cx = fcx + dx, cz = fcz + dz;
      if (!inside(cx, cz)) continue;
      const ring = Math.max(Math.abs(dx), Math.abs(dz)), c = chunk(cx, cz);
      const lod = ring <= 1 ? 0 : ring === 2 ? 1 : 2;
      if (c.lod !== lod) todo.push([ring, () => jobs.terrain(c, lod), `terrain${lod}`]);
      if (water && !c.water) todo.push([ring + .2, () => jobs.water(c), 'water']);
      if (ring <= 2 && !c.scatter) todo.push([ring + .3, () => jobs.scatter(c), 'scatter']);
      if (ring > 3 && c.scatter) dropScatter(c);
      // Blockbench trees: full detail in the near rings, their far version two rings out.
      if (c.trees && c.near !== (ring <= 1)) { c.near = ring <= 1; showTreeDetail(c.trees, c.near); }
      if (ring <= 1 && !c.ground) todo.push([ring + .5, () => jobs.ground(c), 'ground']);
      if (ring > 1 && c.ground) dropGround(c);
      if (physics && ring <= 1 && !c.terrainCollider && c.scatter) todo.push([ring + .6, () => jobs.physics(c), 'physics']);
      if (physics && ring > 2 && c.terrainCollider) dropPhysics(c);
    }
    todo.sort((a, b) => a[0] - b[0]);
    const start = performance.now();
    for (const [, job, name] of todo) {
      const t = performance.now(); job();
      const ms = performance.now() - t, s = timing[name] ??= { count: 0, total: 0, max: 0 };
      s.count++; s.total += ms; s.max = Math.max(s.max, ms);
      if (performance.now() - start > budget) break;
    }
    return todo.length;
  }
  /** Loads everything the player needs right now (before the first frame / after a teleport). */
  function prime(focus) { while (update(focus, Infinity) > 0 && chunks.size < 100) { /* until settled */ } }
  /** Physics is created after the world; from then on chunks near the player get terrain tiles and static bodies. */
  function attachPhysics(p) { physics = p; }
  return { update, prime, attachPhysics, root, state: () => ({ timing: Object.fromEntries(Object.entries(timing).map(([k, v]) => [k, { n: v.count, avg: +(v.total / v.count).toFixed(1), max: +v.max.toFixed(1) }])), chunks: chunks.size, center, loaded: [...chunks.values()].filter(c => c.mesh).length }) };
}

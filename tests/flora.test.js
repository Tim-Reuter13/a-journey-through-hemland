import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GROUND, GROUND_INDEX } from '../src/world/groundNames.js';
import { createHeightfield } from '../src/world/heightfield.js';
import { ZONES, ZONE_IDS } from '../src/world/landforms.js';
import { SITES } from '../src/world/hemland.js';
import { TREES } from '../src/world/trees.js';
import { PLANTS, POIS } from '../src/world/props.js';

// The flora rework: the Blockbench specs (trees, plants, points of interest) build, every picture they and the terrain use is there,
// the terrain gives each region its grounds, and every place the game names has a model.

const read = f => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const lib = new Function(read('art/blockbench/builder.js') + '\n' + read('art/blockbench/models.js') + '\nreturn { AshenModels };')();
const specs = lib.AshenModels();

test('trees, plants and places are specs that build, and every model the game names exists in them', () => {
  const trees = specs.trees(), plants = specs.plants(), pois = specs.pois();
  const names = spec => new Set(spec.bones.map(b => b[0]));
  for (const t of TREES) assert.ok(names(trees).has(t), `tree ${t} is not in the spec`);
  for (const p of PLANTS) assert.ok(names(plants).has(p), `plant ${p} is not in the spec`);
  for (const p of POIS) assert.ok(names(pois).has(p), `place ${p} is not in the spec`);
  for (const spec of [trees, plants, pois]) for (const cube of spec.cubes) {
    for (const mat of [cube.mat, ...Object.values(cube.faceMat || {})]) assert.ok(spec.materials[mat], `${spec.name}: material ${mat} is missing`);
    for (const k of [0, 1, 2]) assert.ok(Number.isFinite(cube.from[k]) && Number.isFinite(cube.to[k]), `${cube.name} has a bad corner`);
  }
});

test('trees have roots and a collar kept apart from their wood, bigger trees have forking limbs', () => {
  const trees = specs.trees();
  for (const t of TREES.filter(n => !n.startsWith('bush') && !n.startsWith('cactus') && !n.startsWith('palm') && !n.startsWith('mangrove'))) {
    const mine = trees.cubes.filter(c => c.bone === t);
    assert.ok(mine.some(c => c.name.includes('_root')), `${t} has no roots`);
    assert.ok(mine.some(c => c.name.includes('_root') && c.from[1] <= -12), `${t} has no sunk collar`);
  }
  const oak = trees.cubes.filter(c => c.bone === 'oak_4'), old = trees.cubes.filter(c => c.bone === 'oak_1');
  assert.ok(oak.filter(c => c.name.includes('_wood')).length > old.filter(c => c.name.includes('_wood')).length, 'the new oaks have more wood than the old');
});

test('every picture the models and the terrain use has been made', () => {
  const images = new Set();
  for (const spec of [specs.trees(), specs.plants(), specs.pois()]) for (const m of Object.values(spec.materials)) if (m.image) images.add(m.image);
  assert.ok(images.size >= 20);
  for (const name of images) assert.ok(fs.existsSync(new URL(`../art/textures/codex/${name}.png`, import.meta.url)), `art/textures/codex/${name}.png is missing`);
  for (const name of GROUND) assert.ok(fs.existsSync(new URL(`../public/textures/ground/${name}.png`, import.meta.url)), `public/textures/ground/${name}.png is missing`);
  for (const f of ['trees', 'plants', 'pois']) assert.ok(fs.statSync(new URL(`../public/models/${f}.gltf`, import.meta.url)).size > 100000, `${f}.gltf was not exported`);
});

test('the terrain gives each region its own grounds', () => {
  const field = createHeightfield(), at = (id, h = 40, slope = .3) => { const s = field.surface(ZONES[id].x, ZONES[id].z, h, slope); return [...s.c, ...s.d, ...s.e, ...s.f]; };
  const has = (weights, ...names) => names.every(n => weights[GROUND_INDEX[n]] > .3);
  assert.ok(has(at('badlands', 50), 'red_clay'), 'mesa tops are red clay');
  assert.ok(has(at('badlands', 50, 1.4), 'red_rock'), 'mesa walls are red rock');
  assert.ok(has(at('dunes'), 'dune_sand'));
  assert.ok(has(at('volcanic', 30), 'ash_ground') && has(at('volcanic', 30, 1), 'basalt'));
  assert.ok(has(at('highland', 30), 'heather'));
  assert.ok(has(at('pillars', 6, .1), 'jade_grass') && has(at('pillars', 40, 1.5), 'moss_rock'));
  const open = field.surface(0, 0, 3, .1);
  assert.equal(open.c.length + open.d.length + open.e.length + open.f.length, 16);
  for (const w of [...open.c, ...open.d, ...open.e, ...open.f]) assert.ok(w >= 0 && w <= 1.41);
  assert.ok(open.c.every(w => w === 0) && open.d.every(w => w === 0) && open.e.every(w => w === 0), 'the village keeps its plain grass');
});

test('every wild point of interest has a place on the map, a model and ground flattened for it', () => {
  const ids = ['mine', 'ribs', 'obelisk', 'caravan', 'altar', 'burnt_hut', 'circle', 'peat_hut', 'jade_shrine', 'hollow_log'];
  assert.equal(ids.length, POIS.length);
  for (const id of ids) { assert.ok(SITES[id], id); assert.equal(SITES[id].mode, 'flatten'); assert.ok(SITES[id].radius >= 12, `${id} is flat over too little`); }
  const field = createHeightfield();
  for (const id of ids) {
    const s = SITES[id], c = field.heightAt(s.x, s.z);
    for (const [dx, dz] of [[s.radius * .7, 0], [-s.radius * .7, 0], [0, s.radius * .7], [0, -s.radius * .7]]) assert.ok(Math.abs(field.heightAt(s.x + dx, s.z + dz) - c) < 1, `${id} stands on sloping ground`);
  }
  assert.ok(ZONE_IDS.length === 5);
});

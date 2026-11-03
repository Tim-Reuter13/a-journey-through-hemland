import test from 'node:test';
import assert from 'node:assert/strict';
import { createFireSim } from '../src/world/fireSim.js';

const seeded = seed => () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// A 100 m square of dry grass: nothing burns beyond it, so the tests stay small.
const grass = (x = 0, z = 0) => (Math.abs(x) < 50 && Math.abs(z) < 50 ? { kind: 'grass', fuel: 1, wet: 0 } : { kind: 'none', fuel: 0, wet: 0 });
const burnedCells = sim => [...sim.cells.values()].filter(c => c.state !== 0);
const run = (sim, seconds) => { for (let t = 0; t < seconds; t += .1) sim.step(.1); };

test('a grass fire spreads and burns out, leaving scorch', () => {
  const sim = createFireSim({ fuelAt: grass, random: seeded(1) });
  sim.ignite(0, 0, { radius: 2, energy: 40 });
  run(sim, 30);
  assert.ok(burnedCells(sim).length > 40, `${burnedCells(sim).length} cells`);
  run(sim, 150);
  assert.equal(sim.state().burning, 0);
  assert.ok([...sim.cells.values()].some(c => c.state === 2 && c.scorch > .9));
});

test('wind drives the front: far more ground burns downwind than upwind', () => {
  const sim = createFireSim({ fuelAt: grass, random: seeded(7), wind: { x: 1, z: 0, speed: 1 } });
  sim.ignite(0, 0, { radius: 2, energy: 40 });
  run(sim, 14);
  const cells = burnedCells(sim);
  const down = cells.filter(c => c.x > 4).length, up = cells.filter(c => c.x < -4).length;
  assert.ok(down > up * 1.5 && down > 8, `downwind ${down}, upwind ${up}`);
});

test('water stops fire, burnt ground cannot burn again', () => {
  const sim = createFireSim({ fuelAt: (x, z) => (x > 8 && x < 16 ? { kind: 'water', fuel: 0, wet: 1 } : grass(x, z)), random: seeded(3), wind: { x: 1, z: 0, speed: 1 } });
  sim.ignite(0, 0, { radius: 2, energy: 40 });
  run(sim, 60);
  assert.ok(![...sim.cells.values()].some(c => c.x > 8 && c.state !== 0), 'nothing burns in the water');
  assert.ok(![...sim.cells.values()].some(c => c.x > 17 && c.state !== 0), 'the front does not jump the lake');
  assert.equal(sim.ignite(0, 0, { radius: 2 }), 0);
});

test('damp ground and snow resist', () => {
  const dry = createFireSim({ fuelAt: grass, random: seeded(5) }), snow = createFireSim({ fuelAt: () => ({ kind: 'snow', fuel: .5, wet: .4 }), random: seeded(5) });
  dry.ignite(0, 0, { radius: 1, energy: 40 }); snow.ignite(0, 0, { radius: 1, energy: 40 });
  run(dry, 20); run(snow, 20);
  assert.ok(burnedCells(dry).length > burnedCells(snow).length * 4, `${burnedCells(dry).length} vs ${burnedCells(snow).length}`);
});

test('a tree burns for minutes: it creeps, takes time to lose its crown and stays black', () => {
  const canopy = { x: 3, z: 3, top: 9, bottom: 3, radius: 2.4, kind: 'broadleaf' };
  const events = [];
  const sim = createFireSim({ fuelAt: grass, canopiesNear: (x, z, r) => (Math.hypot(canopy.x - x, canopy.z - z) < r + canopy.radius ? [canopy] : []), random: seeded(11), onTree: (t, what) => events.push(what) });
  sim.ignite(3, 3, { radius: 2, energy: 6 });
  run(sim, 6);
  const tree = [...sim.trees.values()][0];
  assert.equal(tree.state, 1, 'burning');
  assert.ok(tree.climb > 40, `the front needs ${tree.climb.toFixed(0)} s to cover the tree`);
  run(sim, 14);
  assert.ok(tree.progress < .45, `after 20 s the fire has covered ${(tree.progress * 100).toFixed(0)} %`);
  run(sim, tree.climb);
  assert.equal(tree.progress, 1);
  assert.equal(tree.state, 1, 'still burning when the front is through');
  run(sim, tree.burnEnd);
  assert.ok(tree.state >= 2, 'the crown is gone');
  run(sim, tree.end);
  assert.equal(tree.state, 3);
  assert.equal(tree.age, 1);
  assert.ok(tree.end > 150, `a tree takes ${tree.end.toFixed(0)} s to burn out`);
  assert.ok(events.includes('ignite') && events.includes('burnt'));
});

test('where a tree catches decides where it burns: the foot after a grass fire, the crown after a brand', () => {
  const canopy = { x: 0, z: 0, top: 10, bottom: 3, radius: 2.5, kind: 'broadleaf' };
  const sim = createFireSim({ fuelAt: grass, canopiesNear: () => [canopy], random: seeded(4) });
  sim.ignite(0, 0, { radius: 1 });
  const ground = [...sim.trees.values()][0];
  assert.ok(ground.o1 < .1, 'from the foot');
  const other = createFireSim({ fuelAt: grass, canopiesNear: () => [canopy], random: seeded(4) });
  other.brandHit(canopy); other.brandHit(canopy);
  const brand = [...other.trees.values()][0];
  assert.equal(brand.state, 1);
  assert.ok(brand.o1 > .55, `from the crown (${brand.o1.toFixed(2)})`);
});

test('a burning tree lights its neighbour downwind before the one upwind', () => {
  const canopies = [{ x: 0, z: 0, top: 10, bottom: 3, radius: 2.5, kind: 'broadleaf' }, { x: 6, z: 0, top: 10, bottom: 3, radius: 2.5, kind: 'broadleaf' }, { x: -6, z: 0, top: 10, bottom: 3, radius: 2.5, kind: 'broadleaf' }];
  const sim = createFireSim({ fuelAt: () => ({ kind: 'none', fuel: 0 }), canopiesNear: (x, z, r) => canopies.filter(c => Math.hypot(c.x - x, c.z - z) < r + c.radius), random: seeded(2), wind: { x: 1, z: 0, speed: 1 } });
  sim.ignite(0, 0, { radius: 1, energy: 6 });
  const by = x => [...sim.trees.values()].find(t => t.x === x);
  let first = null;
  for (let s = 0; s < 400 && !first; s += .1) { sim.step(.1); if (by(6)?.state === 1) first = 'down'; else if (by(-6)?.state === 1) first = 'up'; }
  assert.equal(first, 'down');
});

test('extinguish puts out cells and burning trees in reach', () => {
  const sim = createFireSim({ fuelAt: grass, random: seeded(9) });
  sim.ignite(0, 0, { radius: 3, energy: 30 });
  run(sim, 1);
  const before = sim.state().burning;
  assert.ok(before > 0);
  sim.extinguish(0, 0, 4);
  assert.ok(sim.state().burning < before, 'some fire is out');
  assert.ok(sim.active.every(c => Math.hypot(c.x, c.z) > 4), 'none left inside the doused circle');
  sim.extinguish(0, 0, 60);
  assert.equal(sim.state().burning, 0);
});

test('one fireball scorches a few metres of meadow, not the world', () => {
  const sim = createFireSim({ fuelAt: grass, random: seeded(21), wind: { x: 1, z: 0, speed: 1 } });
  sim.ignite(0, 0, { power: 1, radius: 2.4 });
  run(sim, 200);
  const burnt = burnedCells(sim);
  assert.ok(burnt.length > 5, `${burnt.length} cells`);
  assert.ok(burnt.length < 70, `${burnt.length} cells is too many for one spell`);
  assert.ok(burnt.every(c => Math.hypot(c.x, c.z) < 16), 'nothing beyond about 16 m');
  assert.equal(sim.state().burning, 0);
});

test('a chain of trees stops after a few: one spell does not burn the forest', () => {
  const canopies = Array.from({ length: 14 }, (_, i) => ({ x: i * 5, z: 0, top: 10, bottom: 3, radius: 2.5, kind: 'broadleaf' }));
  const sim = createFireSim({ fuelAt: () => ({ kind: 'none', fuel: 0 }), canopiesNear: (x, z, r) => canopies.filter(c => Math.hypot(c.x - x, c.z - z) < r + c.radius), random: seeded(8), wind: { x: 1, z: 0, speed: 1 } });
  sim.ignite(0, 0, { power: 1, radius: 1.5 });
  run(sim, 1400);
  const burning = [...sim.trees.values()].filter(t => t.state > 0).length;
  assert.ok(burning >= 2 && burning <= 6, `${burning} trees caught`);
});

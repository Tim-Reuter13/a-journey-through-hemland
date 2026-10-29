import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcLife } from '../src/systems/npcLife.js';

function village() {
  const walls = [{ x: 20, z: 0, hw: 3, hd: 3 }];
  const blocked = (x, z, r = .3) => walls.some(w => Math.abs(x - w.x) < w.hw + r && Math.abs(z - w.z) < w.hd + r);
  const life = createNpcLife({ blocked, heightAt: () => 0, routes: [[{ x: -20, z: 0 }, { x: 0, z: 0 }, { x: 15, z: 0 }]], seed: 7 });
  life.addPOIs([
    { id: 'smith_bed', kind: 'bed', x: -10, z: 6, facing: 0, owner: 'bryn', house: 'h1' },
    { id: 'smith_table', kind: 'table', x: -8, z: 6, facing: 0, house: 'h1' },
    { id: 'h1_door', kind: 'door', x: -9, z: 3, facing: 0, house: 'h1' },
    { id: 'anvil', kind: 'workstation', x: 5, z: -3, facing: 0, job: 'smith' },
    { id: 'well', kind: 'well', x: 0, z: 4, facing: 0 },
    { id: 'bench', kind: 'bench', x: 2, z: 6, facing: 0 },
    { id: 'elder_bed', kind: 'bed', x: -14, z: -6, facing: 0, owner: 'elira', house: 'h2' },
    { id: 'h2_door', kind: 'door', x: -14, z: -3, facing: 0, house: 'h2' },
  ]);
  life.addNPC({ id: 'bryn', job: 'smith', home: 'h1', workplace: 'anvil' });
  life.addNPC({ id: 'elira', job: 'elder', home: 'h2' });
  return { life, blocked };
}
const run = (life, fromHour, hours, player = { x: 50, z: 50 }) => {
  const steps = hours * 60;
  for (let i = 0; i < steps; i++) life.update(1, { hour: (fromHour + i / 60) % 24, player });
};

test('the smith works at the anvil during work hours and sleeps at night', () => {
  const { life } = village();
  life.skipTo(9); run(life, 9, 1);
  const day = life.get('bryn');
  assert.ok(Math.hypot(day.x - 5, day.z + 3) < 2.5, `smith near the anvil at 10:00, got ${day.x.toFixed(1)},${day.z.toFixed(1)} doing ${day.activity}`);
  life.skipTo(2); run(life, 2, .5);
  assert.equal(life.get('bryn').activity, 'sleep');
  assert.equal(life.get('elira').activity, 'sleep');
});

test('NPCs never stand inside blocked space and greet a nearby player', () => {
  const { life, blocked } = village();
  life.skipTo(12);
  let greeted = false;
  for (let i = 0; i < 600; i++) {
    const b = life.get('bryn');
    life.update(.5, { hour: 12 + i / 1200, player: { x: b.x + 2, z: b.z } });
    const now = life.get('bryn');
    assert.ok(!blocked(now.x, now.z, .2), 'smith inside a wall');
    if (now.activity === 'greet' || now.bark) greeted = true;
  }
  assert.ok(greeted, 'a nearby player gets greeted');
});

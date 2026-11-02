import test from 'node:test';
import assert from 'node:assert/strict';
import { createHeightfield } from '../src/world/heightfield.js';
import { SITES } from '../src/world/hemland.js';
import { validateCaves } from '../scripts/check_caves.mjs';
import { CAVES } from '../src/data/goblins/caves.js';
import { GUILD, TRIBES, UKHAI_CALLS } from '../src/data/goblins/lore.js';
import { GOBLIN_STATS } from '../src/systems/goblins.js';
import { GOBLIN_KINDS } from '../src/data/goblins/lore.js';
import { ITEMS } from '../src/systems/items.js';
import { buildCaveRock } from '../src/systems/caveRock.js';

// GOBLINS: the holes their caves open from, the cave plans, the tribes and the Grubenwacht that pays for their ears.
const field = createHeightfield();

test('each goblin hole is cut into the land itself, on the flank of a low rise', () => {
  assert.equal(field.burrows.length, 3);
  for (const b of field.burrows) {
    assert.equal(SITES[b.id].mode, 'burrow');
    const ground = field.gridHeightAt(b.x, b.z);
    // A shaft dropping well below the ground round it, black at the bottom and not darkened at the rim.
    assert.ok(field.heightAt(b.x, b.z) < ground - 4, `${b.id} is not deep enough`);
    assert.ok(field.pit(b.x, b.z).shade > .9);
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2, x = b.x + Math.sin(a) * (b.reach + .05), z = b.z + Math.cos(a) * (b.reach + .05);
      // Beyond its reach the hole leaves the ground exactly as the 2-unit grid has it, so the fine patch meets it.
      assert.equal(field.pit(x, z), null);
      assert.equal(field.heightAt(x, z), field.gridHeightAt(x, z));
    }
    // Every point the hole changes lies in a cell the chunk mesh draws on the finer grid.
    for (let x = b.x - b.reach; x <= b.x + b.reach; x += .37) for (let z = b.z - b.reach; z <= b.z + b.reach; z += .37)
      if (field.pit(x, z)) assert.ok(field.pitCell(Math.floor(x / field.STEP), Math.floor(z / field.STEP)), `${b.id}: (${x}, ${z}) outside the patch`);
    assert.equal(field.pitCell(Math.floor((b.x + 40) / field.STEP), Math.floor(b.z / field.STEP)), false);
    // The rise sits uphill of the hole, so the rim above it stands higher than the rim below it.
    const up = field.heightAt(b.x - Math.sin(b.facing) * (b.R + .9), b.z - Math.cos(b.facing) * (b.R + .9));
    const down = field.heightAt(b.x + Math.sin(b.facing) * (b.R + .9), b.z + Math.cos(b.facing) * (b.R + .9));
    assert.ok(up > down, `${b.id}: the uphill rim is not higher`);
  }
});

test('the cave plans pass the structure, reference and path checks', () => {
  const { problems } = validateCaves(CAVES);
  assert.deepEqual(problems, []);
  for (const cave of CAVES) {
    assert.ok(TRIBES[cave.tribe], `${cave.id} has no tribe`);
    assert.equal(TRIBES[cave.tribe].cave, cave.id);
    // Each cave has its way out and a chief.
    assert.ok(cave.floors.some(f => f.grid.some(row => row.includes('E'))), `${cave.id} has no mouth`);
    assert.ok(cave.entities.some(e => e.type === 'chief'), `${cave.id} has no chief`);
  }
});

test('every goblin kind fights with real stats and every call has its gloss', () => {
  for (const [kind, s] of Object.entries(GOBLIN_STATS)) {
    assert.ok(s.speed > 0 && s.reach > 0 && s.damage > 0 && s.windup > 0, kind);
    for (const weapon of s.weapon || []) assert.match(weapon, /^gob_/);
  }
  for (const [situation, calls] of Object.entries(UKHAI_CALLS)) for (const call of [calls].flat()) assert.ok(call, situation);
});

test('the Grubenwacht pays for real things', () => {
  assert.equal(ITEMS.goblinohr.value, GUILD.earPrice);
  for (const id of ['voshs_horn', 'ghasts_krone', 'ulgraks_kette']) assert.equal(ITEMS[id]?.type, 'quest', id);
  const chiefs = GUILD.contracts.filter(c => c.chief);
  assert.deepEqual(chiefs.map(c => c.chief).sort(), Object.keys(TRIBES).sort());
  for (const c of GUILD.contracts) assert.ok(c.reward > 0 && c.title && c.objective, c.id);
});

test('two holes are sunken ways you can walk down; the old mine stays a shaft', () => {
  for (const b of field.burrows) {
    const fx = Math.sin(b.facing), fz = Math.cos(b.facing), down = u => field.heightAt(b.x + fx * u, b.z + fz * u);
    assert.equal(b.walkIn, b.id !== 'cave_eisen', b.id);
    if (!b.walkIn) continue;
    // From the land at its mouth to the black end the floor is never steeper than about 35°.
    for (let u = b.length; u > .5; u -= .25) assert.ok(Math.abs(down(u) - down(u - .25)) < .25 * .72, `${b.id} at ${u}`);
    assert.ok(down(.5) < field.gridHeightAt(b.x, b.z) - 4, `${b.id} ends deep in the dark`);
    assert.ok(field.pit(b.x + fx, b.z + fz).shade > .9 && (field.pit(b.x + fx * 9, b.z + fz * 9)?.shade ?? 0) < .4);
  }
});

test('no goblin dies to a single blow of the best sword', () => {
  const best = Math.max(...Object.values(ITEMS).filter(i => i.type === 'weapon').map(i => i.damage || 0));
  for (const [kind, k] of Object.entries(GOBLIN_KINDS)) assert.ok(k.hp > best * 1.2, `${kind}: ${k.hp} hp against ${best}`);
});

test('cave rock: a round tunnel with a flat floor, lit only where a light can see', () => {
  // Two rooms on one storey joined by nothing: a 6×1-cell tunnel in the north, a 2×2 room in the south, rock between.
  const W = 10, H = 10, open = (i, j) => j === 2 && i >= 2 && i <= 7 || (j === 6 || j === 7) && (i === 4 || i === 5);
  const key = () => 'rock', material = {};
  const mesh = buildCaveRock({ cells: { W, H, CELL: 2, x0: 0, z0: 0 }, ambient: { r: .1, g: .1, b: .1 }, classify: key, materials: { rock: material },
    levels: [{ L: 0, y: 0, open, floor: () => 0, top: () => 4 }], lights: [{ x: 6, y: 2.5, z: 5, color: { r: 2, g: 2, b: 2 }, range: 10, L: 0 }] });
  const pos = mesh.geometry.attributes.position.array, baked = mesh.geometry.attributes.baked.array;
  assert.ok(pos.length > 300, 'a surface was built');
  let inTunnel = 0, floor = 0, litTunnel = 0, litRoom = 0;
  for (let k = 0; k < pos.length; k += 3) {
    const [x, y, z] = [pos[k], pos[k + 1], pos[k + 2]];
    // Nothing of the rock inside the space you walk through (a body .43 wide, 2.4 tall, in the middle of the tunnel).
    if (x > 6 && x < 14 && Math.abs(z - 5) < .35 && y > .1 && y < 2.4) inTunnel++;
    if (x > 5 && x < 15 && Math.abs(z - 5) < .4 && Math.abs(y) < .05) floor++;
    if (z < 7 && x > 4 && x < 8) litTunnel = Math.max(litTunnel, baked[k]);
    if (z > 12 && x > 8 && x < 12) litRoom = Math.max(litRoom, baked[k]);
  }
  assert.equal(inTunnel, 0, 'the tunnel is clear');
  assert.ok(floor > 4, 'its floor is flat at floor height');
  assert.ok(litTunnel > .5, 'the light lights its own tunnel');
  assert.ok(litRoom < .2, 'and not the room behind the rock');
});

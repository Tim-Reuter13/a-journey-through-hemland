import test from 'node:test';
import assert from 'node:assert/strict';
import { SPELLS, SPELL_IDS, ELEMENTS, CHAPTERS, HAND_SLOTS, defaultLoadout, normalizeLoadout, equipSpell, unequipSpell, cycleSpell, keepActive,
  spellCost, magickaRegen, boltPath, chainTargets, inCone } from '../src/data/spells.js';
import { GLYPH_NAMES } from '../src/ui/sigils.js';
import { normalizeSave } from '../src/systems/saveState.js';

test('nine spells: Funken and eight new ones, each with an element, a chapter, a sigil and a word on the world', () => {
  assert.equal(SPELL_IDS.length, 9);
  assert.ok(SPELL_IDS.includes('funken'));
  const elements = new Set(SPELL_IDS.map(id => SPELLS[id].element));
  assert.equal(elements.size, 9, 'every spell its own element');
  const uses = new Set(SPELL_IDS.map(id => SPELLS[id].use));
  assert.ok(uses.size >= 7, 'different uses');
  for (const id of SPELL_IDS) {
    const s = SPELLS[id];
    assert.ok(ELEMENTS[s.element], `${id} element`);
    assert.ok(CHAPTERS.some(c => c.id === s.chapter), `${id} chapter`);
    assert.ok(GLYPH_NAMES.includes(s.sigil), `${id} sigil ${s.sigil}`);
    assert.ok(s.cost > 0 && s.desc && s.world, `${id} cost and text`);
    assert.equal(ELEMENTS[s.element].ramp.length, 5);
  }
  for (const c of CHAPTERS) assert.ok(SPELL_IDS.some(id => SPELLS[id].chapter === c.id), `${c.name} has spells`);
});

test('the hand holds four spells: equip swaps, cycling skips gaps, a loadout from a save is cleaned', () => {
  const hand = defaultLoadout();
  assert.equal(hand.length, HAND_SLOTS);
  // Laying a new spell into a slot replaces what lay there.
  const a = equipSpell(hand, 'sturmstoss', 1);
  assert.deepEqual(a, ['funken', 'sturmstoss', 'kettenblitz', 'lebensquell']);
  // A spell already in the hand trades places.
  const b = equipSpell(a, 'funken', 2);
  assert.deepEqual(b, ['kettenblitz', 'sturmstoss', 'funken', 'lebensquell']);
  assert.deepEqual(equipSpell(b, 'nonsense', 0), b);
  const c = unequipSpell(b, 1);
  assert.deepEqual(c, ['kettenblitz', null, 'funken', 'lebensquell']);
  assert.equal(cycleSpell(c, 'kettenblitz'), 'funken');
  assert.equal(cycleSpell(c, 'lebensquell'), 'kettenblitz');
  assert.equal(cycleSpell(c, 'kettenblitz', -1), 'lebensquell');
  assert.equal(cycleSpell(c, 'irrlicht'), 'kettenblitz', 'an active spell not in the hand starts at the first');
  assert.equal(keepActive(c, 'sturmstoss'), 'kettenblitz');
  assert.equal(keepActive(c, 'funken'), 'funken');
  // The last spell cannot be taken out.
  assert.deepEqual(unequipSpell(['funken', null, null, null], 0), ['funken', null, null, null]);
  assert.deepEqual(normalizeLoadout(['funken', 'funken', 'bogus', 'irrlicht', 'erdstachel']), ['funken', null, null, 'irrlicht']);
  assert.deepEqual(normalizeLoadout(null), defaultLoadout());
  assert.deepEqual(normalizeLoadout([null, null]), defaultLoadout());
});

test('magicka: costs fall a little with skill and Arkaner Fokus, it comes back faster when the hand rests', () => {
  assert.equal(spellCost('funken'), SPELLS.funken.cost);
  assert.ok(spellCost('erdstachel', { skill: 80 }) < spellCost('erdstachel'));
  assert.ok(spellCost('erdstachel', { perks: ['arkaner_fokus'] }) < spellCost('erdstachel'));
  assert.ok(spellCost('irrlicht', { skill: 100, perks: ['arkaner_fokus'] }) >= 1);
  assert.ok(magickaRegen(100, 5) > magickaRegen(100, .5));
});

test('the bolt runs from hand to target with a jagged middle, the chain jumps to the nearest not yet struck', () => {
  const a = { x: 0, y: 1, z: 0 }, b = { x: 10, y: 1, z: 0 };
  const path = boltPath(a, b, 8, .6, () => .9);
  assert.equal(path.length, 9);
  assert.deepEqual([path[0].x, path[0].y, path[0].z], [0, 1, 0]);
  assert.ok(Math.abs(path[8].x - 10) < 1e-9 && Math.abs(path[8].z) < 1e-9);
  assert.ok(path.slice(1, -1).some(p => Math.abs(p.z) > .05 || Math.abs(p.y - 1) > .05), 'jagged');
  const at = (x, z) => ({ position: { x, y: 0, z } });
  const first = at(0, 0), near = at(3, 0), far = at(20, 0), next = at(6, 1), back = at(-2, 0);
  const chain = chainTargets(first, [first, far, near, next, back], { jumps: 3, reach: 7 });
  assert.equal(chain[0], first);
  assert.equal(chain[1], back, 'nearest first');
  assert.ok(!chain.includes(far), 'out of reach');
  assert.equal(new Set(chain).size, chain.length, 'no target twice');
  assert.ok(chain.length <= 4);
  assert.deepEqual(chainTargets(null, [first]), []);
});

test('the gust sweeps a cone in front, not behind', () => {
  const apex = { x: 0, z: 0 }, dir = { x: 0, z: -1 };
  assert.equal(inCone(apex, dir, { x: 0, z: -5 }, 10, .6), true);
  assert.equal(inCone(apex, dir, { x: 2, z: -5 }, 10, .6), true);
  assert.equal(inCone(apex, dir, { x: 6, z: -2 }, 10, .6), false);
  assert.equal(inCone(apex, dir, { x: 0, z: 5 }, 10, .6), false);
  assert.equal(inCone(apex, dir, { x: 0, z: -12 }, 10, .6), false);
});

test('a save keeps the hand and the magicka, and repairs what does not fit', () => {
  const base = { version: 6, position: [0, 0, 0], level: 3 };
  const fresh = normalizeSave(base);
  assert.equal(fresh.player.maxMagicka, 110);
  assert.deepEqual(fresh.player.spells, { loadout: defaultLoadout(), active: 'funken' });
  const kept = normalizeSave({ ...base, magicka: 40, maxMagicka: 120, spells: { loadout: ['irrlicht', 'seuchennebel', null, 'funken'], active: 'seuchennebel' } });
  assert.equal(kept.player.magicka, 40);
  assert.deepEqual(kept.player.spells, { loadout: ['irrlicht', 'seuchennebel', null, 'funken'], active: 'seuchennebel' });
  const broken = normalizeSave({ ...base, magicka: 9999, spells: { loadout: ['x', 'y'], active: 'z' } });
  assert.equal(broken.player.magicka, broken.player.maxMagicka);
  assert.deepEqual(broken.player.spells.loadout, defaultLoadout());
  assert.equal(broken.player.spells.active, 'funken');
});

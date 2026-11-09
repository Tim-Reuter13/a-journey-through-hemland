import test from 'node:test';
import assert from 'node:assert/strict';
import { trainSkill, skillCost, skillProgress, lockLevel, lockRings, inNotch, LOCKS, pocketsFor, pocketKind, pickpocketChance, detection, unaware, sneakFactor, bountyFor, pickSurvives } from '../src/systems/thievery.js';
import { PATHS, PERK_IDS, canUnlock, findNode } from '../src/data/skillTrees.js';
import { GLYPH_NAMES, EMBLEM_NAMES, pixelPath } from '../src/ui/sigils.js';

test('skills rise with practice, each level costing a little more, and stop at 100', () => {
  const player = { skills: { sneak: 1 }, skillXp: {} };
  assert.equal(trainSkill(player, 'sneak', skillCost(1) - .01), 0);
  assert.equal(trainSkill(player, 'sneak', .02), 1);
  assert.equal(player.skills.sneak, 2);
  assert.ok(skillCost(50) > skillCost(10));
  assert.ok(skillProgress(player, 'sneak') >= 0 && skillProgress(player, 'sneak') < 1);
  trainSkill(player, 'sneak', 1e9);
  assert.equal(player.skills.sneak, 100);
  assert.equal(skillProgress(player, 'sneak'), 1);
  assert.equal(trainSkill(player, 'thievery', 0), 0);
  assert.equal(trainSkill(player, 'thievery', -5), 0);
});

test('locks are fixed per thing, about half the chests are locked, harder locks have more and faster rings', () => {
  assert.equal(lockLevel('chest:7'), lockLevel('chest:7'));
  const counts = { none: 0, einfach: 0, mittel: 0, schwer: 0, meister: 0 };
  for (let i = 0; i < 4000; i++) counts[lockLevel(`chest:${i}`) ?? 'none']++;
  assert.ok(counts.none > 1700 && counts.none < 2300, JSON.stringify(counts));
  assert.ok(counts.einfach > counts.mittel && counts.mittel > counts.schwer && counts.schwer > counts.meister && counts.meister > 0);
  const easy = lockRings('einfach', { seed: 'a' }), hard = lockRings('meister', { seed: 'a' });
  assert.equal(easy.length, LOCKS.einfach.rings); assert.equal(hard.length, LOCKS.meister.rings);
  assert.ok(hard[0].speed > easy[0].speed && hard[0].notch < easy[0].notch);
  assert.ok(hard.some(r => r.flips) && !easy.some(r => r.flips));
  const novice = lockRings('mittel', { seed: 'b', skill: 1 }), master = lockRings('mittel', { seed: 'b', skill: 100, perks: ['feine_dietriche'] });
  master.forEach((r, i) => assert.ok(r.notch > novice[i].notch, 'skill and the perk widen every notch'));
  const ring = { ...easy[0] };
  ring.angle = -ring.target; assert.equal(inNotch(ring), true);
  ring.angle = -ring.target + Math.PI; assert.equal(inNotch(ring), false);
  assert.equal(pickSurvives([], 0), false); assert.equal(pickSurvives(['unzerbrechlich'], .1), true); assert.equal(pickSurvives(['unzerbrechlich'], .9), false);
});

test('pockets fit the person, stay the same all day and refill the next', () => {
  assert.equal(pocketKind({ role: 'HAUPTMANN DER KÖNIGSWACHE' }), 'guard');
  assert.equal(pocketKind({ job: 'innkeeper' }), 'innkeeper');
  assert.equal(pocketKind({ role: 'KÖNIG' }), 'noble');
  assert.equal(pocketKind({ id: 'x' }), 'common');
  const npc = { id: 'innkeeper', job: 'innkeeper' };
  assert.deepEqual(pocketsFor(npc, 3), pocketsFor(npc, 3));
  const days = new Set(Array.from({ length: 6 }, (_, d) => JSON.stringify(pocketsFor(npc, d))));
  assert.ok(days.size > 1, 'the pockets change from day to day');
  const king = pocketsFor({ id: 'king', role: 'KÖNIG' }, 1), farmer = pocketsFor({ id: 'grete', job: 'farmer' }, 1);
  assert.ok(king.gold > farmer.gold);
  assert.ok(!('dietrich' in pocketsFor({ id: 'g', role: 'WACHE' }, 2, id => id !== 'dietrich').items), 'unknown items are left out');
});

test('the chance to lift something follows skill, weight, worth, the mark facing you and the moment', () => {
  const base = { skill: 20, weight: .5, value: 10, calm: .5 };
  const p = pickpocketChance(base);
  assert.ok(p > .05 && p < .95);
  assert.ok(pickpocketChance({ ...base, skill: 80 }) > p);
  assert.ok(pickpocketChance({ ...base, weight: 6 }) < p);
  assert.ok(pickpocketChance({ ...base, value: 400 }) < p);
  assert.ok(pickpocketChance({ ...base, facing: true }) < p);
  assert.ok(pickpocketChance({ ...base, calm: 1 }) > pickpocketChance({ ...base, calm: 0 }));
  assert.ok(pickpocketChance({ ...base, perks: ['flinke_finger'] }) > p);
  assert.equal(pickpocketChance({ skill: 1, weight: 30, value: 9999, facing: true, calm: 0 }), .05);
  assert.equal(pickpocketChance({ skill: 100, weight: 0, value: 0, calm: 1, perks: ['flinke_finger'] }), .95);
  assert.ok(bountyFor(3) >= 10 && bountyFor(50) === 100);
});

test('the veil reads hidden, noticed and detected from those nearby; blows from hiding count double or triple', () => {
  assert.deepEqual(detection([]), { state: 'hidden', level: 0 });
  assert.equal(detection([{ awareness: .2 }]).state, 'hidden');
  assert.equal(detection([{ awareness: .2 }, { awareness: .6 }]).state, 'noticed');
  assert.equal(detection([{ awareness: 1.1, sees: true }]).state, 'detected');
  assert.equal(unaware({ ai: { awareness: .1, sees: false, hostility: 'unaware' } }), true);
  assert.equal(unaware({ ai: { awareness: .1, sees: true, hostility: 'unaware' } }), false);
  assert.equal(unaware({ ai: { awareness: .1, sees: false, hostility: 'hostile' } }), false);
  assert.equal(unaware({ engaged: false }), true);
  assert.equal(sneakFactor([]), 2); assert.equal(sneakFactor(['meuchelstoss']), 3);
});

test('six paths of eight nodes, every node reachable from its core, every sigil drawn', () => {
  assert.deepEqual(PATHS.map(p => p.name), ['Krieger', 'Magier', 'Assassine', 'Dieb', 'Schmied', 'Hexer']);
  assert.equal(new Set(PERK_IDS).size, PERK_IDS.length, 'perk ids are unique');
  for (const path of PATHS) {
    assert.equal(path.nodes.length, 8);
    assert.ok(EMBLEM_NAMES.includes(path.emblem));
    const lit = new Set([path.id]);
    let grew = true;
    while (grew) { grew = false; for (const n of path.nodes) if (!lit.has(n.id) && n.from.some(f => lit.has(f))) { lit.add(n.id); grew = true; } }
    assert.equal(lit.size, 9, `${path.name}: every node can be reached`);
    for (const n of path.nodes) {
      assert.ok(GLYPH_NAMES.includes(n.glyph), `${n.id} glyph ${n.glyph}`);
      assert.ok(n.effect || n.desc, `${n.id} says what it does`);
      assert.ok(n.x >= -1 && n.x <= 1 && n.y > 0 && n.y <= 1);
    }
    assert.ok(path.nodes.some(n => n.capstone));
  }
  // The old perks live on in the paths.
  for (const id of ['schwertmeister', 'arkaner_fokus', 'eisernes_herz', 'meisterschuetze', 'ruhige_hand']) assert.ok(findNode(id)?.node.effect, id);
  assert.equal(canUnlock('schwertmeister', [], 1).ok, true);
  assert.equal(canUnlock('schwertmeister', [], 0).ok, false);
  assert.equal(canUnlock('klingenwall', [], 3).ok, false);
  assert.equal(canUnlock('klingenwall', ['schwertmeister'], 1).ok, true);
  assert.equal(canUnlock('meister_der_klinge', ['schwertmeister', 'klingenwall', 'kriegsschrei'], 1).ok, true, 'one lit parent is enough');
  assert.equal(canUnlock('schwertmeister', ['schwertmeister'], 4).ok, false);
  assert.match(pixelPath(['#.#']), /^M0 0h1v1h-1zM2 0h1v1h-1z$/);
});

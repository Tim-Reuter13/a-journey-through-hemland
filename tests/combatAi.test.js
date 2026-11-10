import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatMemory, observe, readMemory, TAU } from '../src/systems/ai/combatMemory.js';
import { chooseTactic, shouldAbort, TACTICS } from '../src/systems/ai/combatTactics.js';
import { injuryEffects } from '../src/systems/damageModel.js';

const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const fine = injuryEffects({});
const base = { skill: .75, traits: { aggression: .5 }, archetype: 'veteran', stamina: 80, posture: .9, hp: 1, fear: .1, inj: fine, random: seq(.5) };

test('memory: habits seen are counted, fade, and a guess on two blows is weak', () => {
  const m = createCombatMemory();
  observe(m, 'attack', 1, { key: 'slash_r' }); observe(m, 'parried', 1.5);
  const early = readMemory(m, 2);
  assert.ok(early.certainty < .5, `certainty ${early.certainty}`);
  for (let i = 0; i < 8; i++) { observe(m, 'attack', 3 + i, { key: 'chop', heavy: true }); observe(m, 'parried', 3.4 + i); observe(m, 'watch', 3.5 + i, { dt: 1, guard: true }); }
  const r = readMemory(m, 12);
  assert.ok(r.certainty > .85); assert.ok(r.parry > .9); assert.equal(r.favourite, 'chop'); assert.ok(r.heavy > .7); assert.ok(r.guarding > .9);
  assert.ok(r.rhythm > .5 && r.rhythm < 1.5, `rhythm ${r.rhythm}`);
  const later = readMemory(m, 12 + TAU * 3);
  assert.ok(later.certainty < .3, 'old habits are forgotten');
});

test('tactics: a novice presses or probes whatever he has seen', () => {
  const m = createCombatMemory(); for (let i = 0; i < 10; i++) { observe(m, 'attack', i); observe(m, 'parried', i + .3); }
  for (const r of [.1, .5, .9]) {
    const t = chooseTactic({ ...base, skill: .35, archetype: 'rogue', mem: readMemory(m, 10), random: seq(r) });
    assert.ok(['press', 'probe'].includes(t.id), t.id);
  }
});
test('tactics: a veteran answers what he has seen', () => {
  const parrier = createCombatMemory(); for (let i = 0; i < 10; i++) { observe(parrier, 'attack', i); observe(parrier, 'parried', i + .3); }
  assert.equal(chooseTactic({ ...base, mem: readMemory(parrier, 10), random: seq(.01) }).id, 'bait');
  const turtle = createCombatMemory(); for (let i = 0; i < 10; i++) { observe(turtle, 'blocked', i); observe(turtle, 'watch', i, { dt: 1, guard: true }); }
  assert.equal(chooseTactic({ ...base, mem: readMemory(turtle, 10), random: seq(.01) }).id, 'crush');
  const flailer = createCombatMemory(); for (let i = 0; i < 10; i++) { observe(flailer, 'attack', i); observe(flailer, 'whiff', i + .2); observe(flailer, 'watch', i, { dt: 1 }); }
  assert.equal(chooseTactic({ ...base, mem: readMemory(flailer, 10), random: seq(.01) }).id, 'punish');
});
test('tactics: the body decides first — out of breath, a ruined arm, a cut leg', () => {
  assert.equal(chooseTactic({ ...base, stamina: 15 }).id, 'recover');
  assert.equal(chooseTactic({ ...base, posture: .2 }).id, 'recover');
  assert.equal(chooseTactic({ ...base, inj: injuryEffects({ arm_right: .9 }) }).reason, 'Schwertarm verletzt');
  assert.equal(chooseTactic({ ...base, inj: injuryEffects({ leg_left: .9 }) }).id, 'punish');
});
test('commitments end for a reason', () => {
  const now = 5;
  assert.equal(shouldAbort({ id: 'recover' }, { ...base, stamina: 80, posture: .9 }, now), 'erholt');
  assert.equal(shouldAbort({ id: 'press', hits: 2 }, base, now), 'zu viele Treffer eingesteckt');
  assert.equal(shouldAbort({ id: 'bait', hits: 0, feints: 2, bitten: false }, base, now), 'Finte wirkt nicht');
  assert.equal(shouldAbort({ id: 'press', hits: 0 }, { ...base, fear: .7 }, now), 'Mut verloren');
  assert.equal(shouldAbort({ id: 'probe', hits: 0 }, base, now), null);
  for (const t of Object.values(TACTICS)) assert.ok(t.min > 1 && ['ready', 'opening', 'never'].includes(t.attack));
});

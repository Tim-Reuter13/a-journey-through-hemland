import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAIManager } from '../src/systems/ai/manager.js';
import { reflex, persistBrain, restoreBrain } from '../src/systems/ai/brain.js';
import { escapePoint, flankPoint } from '../src/systems/ai/spatial.js';
import { campSchedule } from '../src/systems/ai/camp.js';
import { makePersonality } from '../src/systems/ai/config.js';

// HUMANITY AI scenario tests: a flat test world with walls (boxes 3 m tall), people as Object3Ds, the
// wanderer as the perceptible state main.js builds, and a minimal executor that walks intents.
const v = (x, y, z) => new THREE.Vector3(x, y, z);
function testWorld(walls = []) {
  const inWall = (x, z, r = 0, y = 0) => walls.some(w => y < 3 && x > w.x0 - r && x < w.x1 + r && z > w.z0 - r && z < w.z1 + r);
  const colliders = walls.map(w => ({ x: (w.x0 + w.x1) / 2, z: (w.z0 + w.z1) / 2, halfWidth: (w.x1 - w.x0) / 2, halfDepth: (w.z1 - w.z0) / 2, bottom: 0, top: 3 }));
  return {
    heightAt: () => 0, blocked: (x, z, r = .43) => inWall(x, z, r),
    segmentBlocked: (a, b) => { for (let i = 1; i < 40; i++) { const t = i / 40; if (inWall(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0, a.y + (b.y - a.y) * t)) return true; } return false; },
    near: () => colliders,
  };
}
function wanderer(at = v(0, 0, 0)) {
  return { position: at.clone(), yaw: 0, stance: 'walk', noise: 5, swinging: false, casting: false, drawn: false, armor: 2,
    bow: { drawing: false, draw: 0, dir: v(0, 0, -1), eye: v(0, 2, 0) } };
}
function person(x, z, { calm = false, hp = 80 } = {}) {
  const model = new THREE.Object3D(); model.position.set(x, 0, z);
  return { model, hp, maxHp: 80, calm, kind: 'bandit', dead: false };
}
const face = (npc, target) => { npc.model.rotation.y = Math.atan2(-(target.x - npc.model.position.x), -(target.z - npc.model.position.z)); };
function aimAt(P, npc) {
  P.bow.drawing = true; P.bow.draw = 1; P.bow.eye.copy(P.position).setY(2);
  P.bow.dir.copy(npc.model.position).setY(1.3).sub(P.bow.eye).normalize(); P.yaw = Math.atan2(-P.bow.dir.x, -P.bow.dir.z);
}
function setup({ walls = [], faction = {} } = {}) {
  const world = testWorld(walls), said = [], provoked = [];
  const ai = createAIManager({ world, hooks: { say: (npc, text, line) => said.push({ npc, text, line }), provoke: (b, why) => provoked.push(why), faction: () => faction, enemyOf: b => !b.npc.calm } });
  const env = { daylight: 1, hour: 12, truce: false };
  const step = (P, npcs, seconds, { walk = true } = {}) => {
    for (let t = 0; t < seconds; t += 1 / 30) {
      ai.update(1 / 30, P, env);
      if (walk) for (const n of npcs) {
        if (n.dead) continue;
        const it = n.ai.intent, p = n.model.position;
        if (it.goal) { const d = v(it.goal.x - p.x, 0, it.goal.z - p.z), L = d.length(); if (L > it.tolerance) { d.multiplyScalar(Math.min(L, it.speed / 30) / L); if (!world.blocked(p.x + d.x, p.z + d.z)) p.add(d); } }
        if (it.face) face(n, it.face);
      }
    }
  };
  return { ai, world, said, provoked, env, step, faction };
}
const hostile = (ai, npc, opts) => { const b = ai.attach(npc, { group: 'g', ...opts }); return b; };

test('1 · a camp member who sees an unarmed stranger watches or warns, never attacks', () => {
  const { ai, step } = setup(), P = wanderer(v(0, 0, -10)), npc = person(0, 0, { calm: true });
  face(npc, P.position);
  const b = ai.attach(npc, { group: 'camp', territorial: true, seed: 5, archetype: 'rogue' });
  const seen = new Set();
  for (let i = 0; i < 40; i++) { step(P, [npc], .25); seen.add(b.action.id); }
  assert.ok(!seen.has('engage') && !seen.has('desperate'), [...seen].join());
  assert.equal(b.hostility, 'territorial');
});

test('2 · a territorial guard calls a halt, and a bow kept on the camp after the warnings starts a fight', () => {
  const { ai, step, said, provoked } = setup(), P = wanderer(v(0, 0, -11)), npc = person(0, 0, { calm: true });
  face(npc, P.position);
  const b = ai.attach(npc, { group: 'camp', territorial: true, seed: 7, archetype: 'veteran' });
  step(P, [npc], 3);
  assert.ok(said.some(s => s.line === 'halt'), 'halt');
  assert.equal(b.action.id, 'warn');
  aimAt(P, npc); step(P, [npc], 4);
  assert.ok(said.some(s => s.line === 'lowerBow'), 'lower the bow');
  assert.ok(provoked.length >= 1, 'provoked');
});

test('3 · a lone, outmatched bandit held at bow-point usually yields', () => {
  let yielded = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const { ai, step } = setup(), P = wanderer(), npc = person(0, -6);
    face(npc, P.position);
    const b = hostile(ai, npc, { seed, archetype: 'rogue' });
    step(P, [npc], .6, { walk: false }); aimAt(P, npc); step(P, [npc], 5, { walk: false });
    if (b.hostility === 'surrendered') yielded++;
  }
  assert.ok(yielded >= 7, `${yielded}/12 yielded`);
});

test('4 · an armoured veteran with two friends does not simply give up to a bow', () => {
  let yielded = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const { ai, step } = setup(), P = wanderer(), npcs = [person(0, -6), person(2, -7), person(-2, -7)];
    npcs.forEach(n => face(n, P.position));
    const [b] = npcs.map((n, i) => hostile(ai, n, { seed: seed * 10 + i, archetype: i ? 'rogue' : 'veteran' }));
    step(P, npcs, .6, { walk: false }); aimAt(P, npcs[0]); step(P, npcs, 4, { walk: false });
    if (b.hostility === 'surrendered') yielded++;
  }
  assert.ok(yielded <= 2, `${yielded}/10 yielded`);
});

test('5, 22 · a yielded bandit leaves the attack slots and stays yielded while watched', () => {
  const { ai, step } = setup(), P = wanderer(), npc = person(0, -5);
  face(npc, P.position);
  const b = hostile(ai, npc, { seed: 3, archetype: 'rogue' });
  b.emotion.fear = 1; b.hostility = 'hostile'; b.memory.see(P.position, 0); aimAt(P, npc);
  step(P, [npc], 2, { walk: false });
  assert.equal(b.hostility, 'surrendered');
  for (let i = 0; i < 20; i++) { step(P, [npc], 1, { walk: false }); assert.equal(b.hostility, 'surrendered'); assert.equal(b.token, false); assert.equal(b.intent.attack, false); }
});

test('6 · a feigned surrender only breaks when the bow is lowered and the back is turned, with a visible tell', () => {
  const { ai, step } = setup(), P = wanderer(), npc = person(0, -5);
  face(npc, P.position);
  const b = hostile(ai, npc, { seed: 3, archetype: 'rogue' });
  b.memory.see(P.position, 0); b.hostility = 'surrendered'; b.disarmed = true; b.action = { id: 'yield', since: 0, reason: '' }; b.feigning = true;
  aimAt(P, npc); step(P, [npc], 6, { walk: false });
  assert.equal(b.hostility, 'surrendered', 'watched: no attack');
  P.bow.drawing = false; P.yaw += Math.PI; // turns away
  let tell = false;
  for (let i = 0; i < 40 && b.hostility === 'surrendered'; i++) { step(P, [npc], .1, { walk: false }); tell ||= b.intent.pose === 'tense'; }
  assert.ok(tell, 'a tell before the attack');
  assert.equal(b.hostility, 'hostile');
  assert.match(b.action.reason, /Täuschung/);
});

test('7, 8 · behind a wall nobody knows the sneaking wanderer is there, and nobody strikes through it', () => {
  const { ai, step } = setup({ walls: [{ x0: -4, x1: 4, z0: -2.5, z1: -1.5 }] }), P = wanderer(), npc = person(0, -3.5);
  P.stance = 'sneakStill'; P.noise = 0; face(npc, P.position);
  const b = hostile(ai, npc, { seed: 9, archetype: 'rogue' });
  step(P, [npc], 3, { walk: false });
  assert.equal(b.memory.knows(ai.time), false);
  // Told where the wanderer is, still no blow through the wall.
  b.memory.see(P.position, ai.time); b.hostility = 'hostile'; b.token = true;
  step(P, [npc], 2);
  assert.equal(b.intent.attack, false);
});

test('9, 10 · a near miss frightens and sends a careful bandit to cover; an unseen archer is only guessed', () => {
  const walls = [{ x0: 3, x1: 4, z0: -12, z1: -10 }];
  const { ai, step } = setup({ walls }), P = wanderer(v(0, 0, 25)), npc = person(0, -10);
  npc.model.rotation.y = 0; // facing away from the archer (front −Z)
  const b = hostile(ai, npc, { seed: 21, archetype: 'veteran' });
  b.traits.caution = .9; b.traits.aggression = .2;
  step(P, [npc], .5, { walk: false });
  const fear = b.emotion.fear;
  ai.nearMiss(npc, v(.6, 1.4, -10), v(0, 0, -1));
  // Unseen: only a guess along the arrow's path, not the archer's real place.
  assert.equal(b.memory.player.source, 'pfeil');
  assert.ok(b.memory.player.pos.distanceTo(P.position) > 2, 'the guess is not the truth');
  step(P, [npc], 1);
  assert.ok(b.emotion.fear > fear + .05, 'fear rises');
  assert.ok(['cover', 'search', 'investigate'].includes(b.action.id), b.action.id);
});

test('11, 15 · plans respect walls: no flank or escape point inside a wall, a dead end means cornered', () => {
  const box = [{ x0: -6, x1: 6, z0: -14, z1: -13 }, { x0: -6, x1: -5, z0: -14, z1: -6 }, { x0: 5, x1: 6, z0: -14, z1: -6 }];
  const world = testWorld(box);
  const self = v(0, 0, -11), threat = v(0, 0, -7);
  assert.equal(escapePoint(world, self, threat), null, 'cornered in a dead end');
  const open = testWorld([]);
  assert.ok(escapePoint(open, self, threat));
  const flank = flankPoint(world, v(0, 0, -3), v(0, 0, -9), 0, []);
  assert.ok(flank && !world.blocked(flank.x, flank.z, .4));
});

test('12, 13 · four fighters do not clump: at most two hold an attack slot, the others press and still defend', () => {
  const { ai, step } = setup(), P = wanderer(), npcs = [0, 1, 2, 3].map(i => person(Math.sin(i * 1.6) * 7, Math.cos(i * 1.6) * 7));
  npcs.forEach(n => face(n, P.position));
  const brains = npcs.map((n, i) => hostile(ai, n, { seed: 40 + i, archetype: i ? 'rogue' : 'leader' }));
  let most = 0; const actions = new Set();
  for (let i = 0; i < 60; i++) { step(P, npcs, .25); most = Math.max(most, brains.filter(b => b.token).length); brains.forEach(b => actions.add(b.action.id)); }
  assert.ok(most >= 1 && most <= 2, `slots ${most}`);
  assert.ok(actions.has('pressure') || actions.has('flank'), [...actions].join());
  const waiting = brains.find(b => !b.token);
  let defended = 0;
  for (let k = 0; k < 20; k++) if (reflex(waiting, 2)) defended++;
  assert.ok(defended >= 6, `defends ${defended}/20`);
});

test('14 · an archer with a friend in the line of fire holds the shot and moves', () => {
  const { ai, step } = setup(), P = wanderer(), archer = person(0, -16), friend = person(0, -8);
  [archer, friend].forEach(n => face(n, P.position));
  const a = hostile(ai, archer, { seed: 51, archetype: 'archer' }); hostile(ai, friend, { seed: 52, archetype: 'veteran' });
  step(P, [archer, friend], 2, { walk: false });
  assert.notEqual(a.action.id, 'shoot');
  assert.equal(a.intent.attack, false);
});

test('15 · a callout informs only those in earshot', () => {
  const walls = [{ x0: -30, x1: 30, z0: 5, z1: 6 }];
  const { ai, step } = setup({ walls }), P = wanderer(v(0, 0, -12));
  const spotter = person(0, 0), nearby = person(4, 9), faraway = person(0, 90);
  face(spotter, P.position); nearby.model.rotation.y = 0; faraway.model.rotation.y = 0;
  const [s, n, f] = [spotter, nearby, faraway].map((x, i) => hostile(ai, x, { seed: 60 + i, archetype: 'rogue' }));
  step(P, [spotter, nearby, faraway], 3, { walk: false });
  assert.ok(s.sees);
  assert.ok(n.memory.knows(ai.time) && n.memory.player.source.startsWith('ruf'), `near: ${n.memory.player.source}`);
  assert.equal(f.memory.knows(ai.time), false);
});

test('16, 17 · an ally dying out of sight changes nothing; seen, it frightens', () => {
  const walls = [{ x0: -10, x1: 10, z0: -1, z1: 0 }];
  const { ai, step } = setup({ walls }), P = wanderer(v(0, 0, 40));
  const watcher = person(0, -5), hidden = person(0, 6), visible = person(3, -9);
  watcher.model.rotation.y = Math.PI; // facing +Z, toward the wall
  const [w, h, vis] = [watcher, hidden, visible].map((x, i) => hostile(ai, x, { seed: 70 + i, archetype: 'rogue' }));
  step(P, [watcher], .5, { walk: false });
  const fear = w.emotion.fear;
  hidden.dead = true; ai.died(hidden);
  assert.ok(Math.abs(w.emotion.fear - fear) < .001, 'unseen death');
  watcher.model.rotation.y = 0; // facing −Z toward the visible friend
  visible.dead = true; ai.died(visible);
  assert.ok(w.emotion.fear > fear + .03, 'witnessed death');
});

test('18 · the leader\'s death loosens the group until a steady fighter takes command', () => {
  const { ai, step } = setup(), P = wanderer(), npcs = [person(0, -6), person(3, -7), person(-3, -7)];
  npcs.forEach(n => face(n, P.position));
  const [leader, a, b] = npcs.map((n, i) => hostile(ai, n, { seed: 80 + i, archetype: i ? 'veteran' : 'leader' }));
  [a, b].forEach(x => { x.traits.experience = .8; x.traits.discipline = .8; });
  step(P, npcs, 1);
  const g = ai.groups.of('g'), before = g.coordination;
  npcs[0].dead = true; ai.died(npcs[0]);
  step(P, npcs, .5);
  assert.ok(g.coordination < before, 'coordination drops');
  step(P, npcs, 5);
  assert.ok(g.leader && g.leader !== leader, 'a new leader');
});

test('19, 21 · the badly wounded back off or run; a frightened one with open ground flees', () => {
  let away = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const { ai, step } = setup(), P = wanderer(), npc = person(0, -5, { hp: 14 });
    face(npc, P.position);
    const b = hostile(ai, npc, { seed: 90 + seed, archetype: 'rogue' });
    ai.hurt(npc, 50, P.position); step(P, [npc], 3);
    if (['retreat', 'flee', 'yield', 'cover'].includes(b.action.id) || b.hostility === 'fleeing' || b.hostility === 'surrendered') away++;
  }
  assert.ok(away >= 8, `${away}/10`);
});

test('20 · burning ground is registered as a hazard and frightens those beside it', () => {
  const { ai, step } = setup(), P = wanderer(), npc = person(0, -6);
  face(npc, P.position);
  const b = hostile(ai, npc, { seed: 101, archetype: 'rogue' });
  step(P, [npc], .5); const fear = b.emotion.fear;
  ai.fireAt(v(0, 0, -5), 2.6);
  assert.equal(ai.hazards.length, 1);
  assert.ok(b.emotion.fear > fear);
});

test('23, 24 · camp days: watches, meals and sleep take turns, the patrol leaves the camp and comes back', () => {
  const centre = v(0, 0, 0), plan = campSchedule(centre, () => 0, 'melee');
  const at = hour => plan({ nervous: 0 }, { hour });
  assert.equal(at(4).pose, 'sleep');
  assert.equal(at(8).pose, 'sit');
  assert.equal(at(23).label, 'hält Wache');
  const out = Math.max(...[9.5, 10.5, 11.5, 12.5, 13.5].map(h => at(h).goal.length()));
  assert.ok(out > 11, `patrol reaches ${out.toFixed(1)} m out`);
  assert.ok(at(16).goal.length() < 9, 'back to chop wood');
  const archer = campSchedule(centre, () => 0, 'archer');
  assert.ok(archer({ nervous: 0 }, { hour: 16.5 }).goal.length() > 30, 'the hunter goes far');
  assert.ok([10, 13, 20].some(h => archer({ nervous: 0 }, { hour: h }).label === 'hält Wache' || at(h).label === 'hält Wache'), 'a watch by day');
});

test('25 · a camp nobody watches is where its day says when you come back', () => {
  const { ai, step, env } = setup(), P = wanderer(v(0, 0, 400)), npc = person(0, 0, { calm: true });
  ai.attach(npc, { group: 'camp', territorial: true, seed: 5, schedule: campSchedule(v(0, 0, 0), () => 0, 'melee') });
  env.hour = 8;
  step(P, [npc], 3);
  const expected = campSchedule(v(0, 0, 0), () => 0, 'melee')({ nervous: 0 }, { hour: 8 }).goal;
  assert.ok(npc.model.position.distanceTo(expected) < .01);
});

test('26 · yielding, mercy and memories survive a save', () => {
  const { ai } = setup(), npc = person(0, -5);
  const b = hostile(ai, npc, { seed: 3, archetype: 'rogue' });
  b.hostility = 'pacified'; b.spared = true; b.memory.remember('friendKilled');
  const data = JSON.parse(JSON.stringify(persistBrain(b)));
  const fresh = setup().ai, npc2 = person(0, -5), c = fresh.attach(npc2, { group: 'g', seed: 3, archetype: 'rogue' });
  restoreBrain(c, data);
  assert.equal(c.hostility, 'pacified'); assert.equal(c.spared, true); assert.ok(c.memory.has('friendKilled'));
  assert.deepEqual(makePersonality(3, 'rogue').traits, c.traits, 'the same person again');
});

test('28, 29 · a long melee with six people never deadlocks, never makes NaN, and never thinks more than its budget', () => {
  const { ai, world } = setup(), P = wanderer(), npcs = Array.from({ length: 20 }, (_, i) => person(Math.sin(i) * 12, Math.cos(i) * 12));
  npcs.forEach((n, i) => { face(n, P.position); hostile(ai, n, { group: `g${i % 4}`, seed: 200 + i, archetype: ['rogue', 'veteran', 'berserker', 'archer'][i % 4] }); });
  const env = { daylight: .8, hour: 15 };
  let worst = 0, total = 0;
  const changes = new Map(npcs.map(n => [n, new Set()]));
  for (let f = 0; f < 900; f++) {
    P.position.set(Math.sin(f / 90) * 4, 0, Math.cos(f / 70) * 4);
    const t0 = performance.now(), thinking = ai.update(1 / 30, P, env), ms = performance.now() - t0;
    worst = Math.max(worst, thinking); total += ms;
    for (const n of npcs) {
      const it = n.ai.intent, p = n.model.position; changes.get(n).add(n.ai.action.id);
      if (it.goal) { const d = v(it.goal.x - p.x, 0, it.goal.z - p.z), L = d.length(); if (L > it.tolerance) { d.multiplyScalar(Math.min(L, it.speed / 30) / L); if (!world.blocked(p.x + d.x, p.z + d.z)) p.add(d); } }
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z));
    }
  }
  assert.ok(worst <= 6, `thinking ${worst} > budget`);
  assert.ok([...changes.values()].every(s => s.size >= 2), 'everyone changes what they do');
  assert.ok(total / 900 < 2, `avg ${(total / 900).toFixed(2)} ms per frame for 20 people`);
});

test('26 · through the real save: yielded and spared people, robbed purses and the faction\'s memory come back', async () => {
  const { encodeSave, normalizeSave } = await import('../src/systems/saveState.js');
  const { resetCharacter } = await import('../src/systems/progression.js');
  const { createRPGSystems } = await import('../src/systems/rpgSystems.js');
  const player = { position: v(3, 0, 0), yaw: 0, pitch: 0, mode: 'third' }; resetCharacter(player);
  const game = { quest: 'm_elira', flags: { ai_spared: 2, ai_fire: 1, ai_sp0: 'Tamo|3|42' } };
  const { ai } = setup(), a = person(0, -5), b = person(2, -5);
  const ba = hostile(ai, a, { seed: 1, archetype: 'rogue' }), bb = hostile(ai, b, { seed: 2, archetype: 'rogue' });
  ba.hostility = 'pacified'; ba.spared = true; bb.hostility = 'surrendered'; bb.robbed = true; bb.memory.remember('allyKilled');
  const data = normalizeSave(JSON.parse(encodeSave(player, game, [a, b], {}, 12, createRPGSystems().state)));
  assert.deepEqual(data.enemies.map(e => e.ai.s), ['pacified', 'surrendered']);
  assert.equal(data.enemies[0].ai.sp, true); assert.equal(data.enemies[1].ai.rb, true);
  assert.deepEqual(data.enemies[1].ai.m, ['allyKilled']);
  assert.equal(data.flags.ai_sp0, 'Tamo|3|42'); assert.equal(data.flags.ai_spared, 2);
  // Junk in a save is dropped, not trusted.
  const bad = normalizeSave({ ...JSON.parse(encodeSave(player, game, [a], {}, 12, createRPGSystems().state)), enemies: [{ hp: 10, ai: { s: 'boss', m: ['<script>', 'ok'] } }] });
  assert.equal(bad.enemies[0].ai.s, undefined); assert.deepEqual(bad.enemies[0].ai.m, ['ok']);
});

test('30 · a hedge-witch heals a hurt friend when not pressed, and casts only with mana left', () => {
  const { ai, step } = setup(), P = wanderer(), witch = person(0, -14), friend = person(2, -9, { hp: 20 });
  [witch, friend].forEach(n => face(n, P.position));
  const w = hostile(ai, witch, { seed: 301, archetype: 'mage' }); hostile(ai, friend, { seed: 302, archetype: 'veteran' });
  step(P, [witch, friend], 2);
  assert.equal(w.action.id, 'heal');
  assert.equal(w.healTarget?.npc, friend);
  w.mana = 0; friend.hp = 80;
  step(P, [witch, friend], 1, { walk: false });
  assert.ok(!['heal', 'shoot'].includes(w.action.id), w.action.id);
});

test('31 · a shield bearer under a drawn bow raises the shield and comes on instead of yielding', () => {
  let yielded = 0, walled = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const { ai, step } = setup(), P = wanderer(), npc = person(0, -9);
    face(npc, P.position);
    const b = hostile(ai, npc, { seed: 400 + seed, archetype: 'shieldbearer' });
    step(P, [npc], .6, { walk: false }); aimAt(P, npc);
    let wall = false;
    for (let i = 0; i < 16; i++) { step(P, [npc], .25); aimAt(P, npc); wall ||= b.action.id === 'shieldwall' && b.intent.guard; }
    if (wall) walled++;
    if (b.hostility === 'surrendered') yielded++;
  }
  assert.ok(walled >= 6, `${walled}/8 raised the shield`);
  assert.ok(yielded <= 1, `${yielded}/8 yielded`);
});

test('32 · when the trail goes cold the leader sends a search party; the rest stay', () => {
  const walls = [{ x0: -20, x1: 20, z0: -3, z1: -2 }];
  const { ai, step, said } = setup({ walls }), P = wanderer(v(0, 0, 0)), npcs = [person(0, -10), person(3, -11), person(-3, -11)];
  npcs.forEach(n => face(n, P.position));
  const [leader, a, b] = npcs.map((n, i) => hostile(ai, n, { seed: 500 + i, archetype: i ? 'veteran' : 'leader' }));
  [leader, a, b].forEach(x => { x.memory.see(v(0, 0, 1), 0); x.hostility = 'searching'; x.traits.obedience = .9; });
  P.stance = 'sneakStill'; P.noise = 0;
  step(P, npcs, 10);
  assert.ok(said.some(s => s.line === 'orderSearch'), 'order given');
  const sent = [a, b].filter(x => x.errand);
  assert.ok(sent.length >= 1, 'someone went');
  assert.equal(leader.errand, null, 'the leader stays');
});

test('33 · a comrade killed unseen is first missing, then searched for, then found — and that frightens', () => {
  const { ai, step, said } = setup(), P = wanderer(v(0, 0, -80));
  // The hunter dies behind their backs, out of earshot.
  const camp = [person(0, 0), person(3, 1), person(-2, 2)], hunter = person(0, 30);
  [...camp, hunter].forEach(n => { n.calm = true; n.model.rotation.y = 0; });
  const brains = [...camp, hunter].map((n, i) => ai.attach(n, { group: 'camp', territorial: true, seed: 600 + i, archetype: i ? 'veteran' : 'leader' }));
  brains.forEach(x => { x.traits.obedience = .9; });
  hunter.dead = true; ai.died(hunter);
  const fear = brains[1].emotion.fear;
  assert.equal(ai.groups.of('camp').missing.length, 1, 'missing, not mourned');
  step(P, camp, 50);
  assert.ok(said.some(s => s.line === 'missing'), 'someone asks where he is');
  // The searchers walk out to where he went and find him.
  step(P, camp, 60);
  assert.ok(said.some(s => s.line === 'found'), 'found');
  assert.equal(ai.groups.of('camp').missing.length, 0);
  assert.ok(brains.slice(1).some(x => x.emotion.fear > fear), 'and it frightens');
});

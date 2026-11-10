import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ATTACKS, WEAPONS, reachOf, sampleTrack, phaseAt, weaponFor } from '../src/systems/combatRules.js';
import { sweep, bladeAt, humanColliders, colliderList, closestSegments, segmentBox, regionOf } from '../src/systems/meleeCollision.js';
import { defend, strike, injuryEffects } from '../src/systems/damageModel.js';
import { createFighter, startAttack, stepAttack, rebound, hurtPosture, firstStrike, tick } from '../src/systems/combatState.js';

const frameOf = (x, z, yaw = 0, pitch = 0) => ({ x, y: 0, z, yaw, pitch, scale: 1 });
/** Runs one attack from start to end at a fixed step and collects every contact. */
function run(key, { targets = [], dt = 1 / 60, pitch = 0, weapon = WEAPONS[ATTACKS[key].weapon], world = null, stopAt = null, shields = [] } = {}) {
  const f = createFighter('a'), contacts = [], hit = new Set();
  startAttack(f, key, 0, { weapon });
  const list = colliderList();
  while (f.attack) {
    const a = f.attack, step = stepAttack(f, dt);
    list.reset();
    for (const t of targets) humanColliders(list, t.id, frameOf(t.x, t.z, t.yaw ?? Math.PI));
    for (const s of shields) list.pool[list.n++] = s;
    const found = sweep({ def: a.def, weapon, frame: frameOf(0, 0, 0, pitch), from: step.from, to: step.to, colliders: list.items(), ignore: hit, world, stopAt });
    for (const c of found) { contacts.push(c); if (c.owner) hit.add(c.owner); if (c.stopped) { f.attack = null; break; } }
  }
  return contacts;
}

test('tracks are continuous and the blade stays a unit direction', () => {
  for (const [key, def] of Object.entries(ATTACKS)) {
    const s = { hilt: [0, 0, 0], dir: [0, 0, 0] }, prev = { hilt: [0, 0, 0], dir: [0, 0, 0] };
    sampleTrack(def, 0, prev);
    for (let k = 1; k <= 300; k++) {
      sampleTrack(def, k / 100, s);
      assert.ok(Math.abs(Math.hypot(...s.dir) - 1) < 1e-6, `${key} dir unit`);
      const jump = Math.hypot(s.hilt[0] - prev.hilt[0], s.hilt[1] - prev.hilt[1], s.hilt[2] - prev.hilt[2]);
      assert.ok(jump < .08, `${key} hilt jumps ${jump.toFixed(3)} at ${k / 100}`);
      prev.hilt = [...s.hilt]; prev.dir = [...s.dir];
    }
  }
});
test('reach comes from the blade: a sword reaches about 2–2.6, a spear further', () => {
  const sword = reachOf(ATTACKS.slash_r), spear = reachOf(ATTACKS.thrust);
  assert.ok(sword > 1.9 && sword < 2.7, `sword ${sword}`);
  assert.ok(spear > sword + .5, `spear ${spear}`);
  assert.equal(weaponFor('rostiges_schwert').length, 1.26);
});
test('phases: prepare → active → recover → done', () => {
  const d = { prepare: .3, active: .15, recover: .3 };
  assert.equal(phaseAt(d, .1).phase, 'prepare'); assert.equal(phaseAt(d, .35).phase, 'active'); assert.equal(phaseAt(d, .6).phase, 'recover'); assert.equal(phaseAt(d, .8).phase, 'done');
  assert.ok(Math.abs(phaseAt(d, .375).time - 1.5) < 1e-9);
});

test('A real miss: a foe out of reach, beside, or under a blade swung high is not struck', () => {
  assert.equal(run('slash_r', { targets: [{ id: 'far', x: 0, z: -3.4 }] }).length, 0, 'out of reach');
  assert.equal(run('slash_r', { targets: [{ id: 'beside', x: -2.6, z: .9 }] }).length, 0, 'behind and beside');
  assert.equal(run('slash_r', { targets: [{ id: 'under', x: 0, z: -2 }], pitch: .75 }).length, 0, 'blade over the head');
  assert.equal(run('slash_r', { targets: [{ id: 'under', x: 0, z: -2 }], pitch: -.95 }).filter(c => c.region === 'head').length, 0, 'blade low: no head hit');
});
test('a foe the blade crosses is struck once, where the blade met the body', () => {
  const c = run('slash_r', { targets: [{ id: 'foe', x: 0, z: -2 }] });
  assert.equal(c.length, 1); assert.equal(c[0].owner, 'foe');
  assert.ok(['torso', 'arm', 'hand', 'neck', 'head'].includes(regionOf(c[0].region)), c[0].region);
  assert.ok(c[0].point.distanceTo(new THREE.Vector3(0, 1.6, -2)) < .9);
  assert.ok(c[0].edge, 'the edge struck');
  assert.ok(c[0].speed > 3, `speed ${c[0].speed}`);
});
test('a chop comes down on the head of someone in front; a thrust only reaches straight ahead', () => {
  const chop = run('chop', { targets: [{ id: 'foe', x: .1, z: -1.9 }] });
  assert.equal(chop.length, 1); assert.ok(['head', 'neck', 'chest'].includes(chop[0].region), chop[0].region);
  assert.equal(run('thrust', { targets: [{ id: 'side', x: 1.6, z: -1.4 }] }).length, 0);
  assert.equal(run('thrust', { targets: [{ id: 'front', x: .2, z: -2.6 }] }).length, 1);
});
test('the sword cleaves two side by side; the spear stops in the first body', () => {
  const two = run('slash_r', { targets: [{ id: 'r', x: .7, z: -1.8 }, { id: 'l', x: -.8, z: -1.8 }] });
  assert.deepEqual(two.map(c => c.owner).sort(), ['l', 'r']);
  assert.equal(two[0].owner, 'r', 'forehand: right side first');
  const spear = run('thrust', { targets: [{ id: 'a', x: .2, z: -1.6 }, { id: 'b', x: .2, z: -2.4 }] });
  assert.equal(spear.length, 1); assert.equal(spear[0].owner, 'a'); assert.ok(spear[0].stopped);
});
test('a shield stops the blade before the body behind it', () => {
  const shield = { kind: 'box', owner: 'foe', part: 'shield', region: 'shield', a: new THREE.Vector3(.25, 1.5, -1.62), b: new THREE.Vector3(.25, 1.5, -1.62), r: .5,
    box: { center: new THREE.Vector3(.25, 1.5, -1.62), axes: [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)], half: [.45, .42, .05] } };
  const c = run('slash_r', { targets: [{ id: 'foe', x: 0, z: -2 }], shields: [shield] });
  assert.equal(c.length, 1); assert.equal(c[0].part, 'shield'); assert.ok(c[0].stopped);
});
test('a wall stops the swing; an ally in the way stops it too', () => {
  const world = { solidAt: x => x < -.35 ? 'stone' : null };
  const c = run('slash_r', { targets: [{ id: 'left', x: -1.2, z: -1.4 }], world });
  assert.equal(c.length, 1); assert.equal(c[0].part, 'world'); assert.equal(c[0].surface, 'stone');
  const ally = run('slash_r', { targets: [{ id: 'friend', x: .6, z: -1.7 }, { id: 'foe', x: -.7, z: -1.9 }], stopAt: o => o === 'friend' });
  assert.equal(ally.length, 1); assert.equal(ally[0].owner, 'friend'); assert.ok(ally[0].stopped);
});
test('L: the same attack gives the same contact at 30, 60 and 144 steps a second', () => {
  const results = [1 / 30, 1 / 60, 1 / 144].map(dt => run('slash_l', { dt, targets: [{ id: 'foe', x: .3, z: -2.1 }] }));
  for (const r of results) { assert.equal(r.length, 1); assert.equal(r[0].region, results[0][0].region); }
  const times = results.map(r => r[0].time);
  assert.ok(Math.max(...times) - Math.min(...times) < .02, times.join(' '));
  const points = results.map(r => r[0].point);
  assert.ok(points[0].distanceTo(points[2]) < .12);
});
test('segment helpers', () => {
  const r = closestSegments(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 1), new THREE.Vector3(0, 1, 1));
  assert.ok(Math.abs(r.dist2 - 1) < 1e-9);
  const box = { center: new THREE.Vector3(), axes: [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)], half: [.5, .5, .5] };
  assert.ok(segmentBox(new THREE.Vector3(-2, 0, 0), new THREE.Vector3(2, 0, 0), box) > 0);
  assert.equal(segmentBox(new THREE.Vector3(-2, 1, 0), new THREE.Vector3(2, 1, 0), box), -1);
});

test('defence: parry, block, bad defence, none from behind, shield', () => {
  const base = { guard: true, now: 1, stamina: 80, posture: 1, force: 1, attackPosture: .16, skill: .5 };
  assert.equal(defend({ ...base, guardAt: .88, cos: .9 }).outcome, 'parry');
  assert.equal(defend({ ...base, guardAt: .2, cos: .9 }).outcome, 'block');
  assert.equal(defend({ ...base, guardAt: .99, cos: .9 }).outcome, 'bad', 'raised too late');
  assert.equal(defend({ ...base, guardAt: .2, cos: .2 }).outcome, 'bad', 'wrong side');
  assert.equal(defend({ ...base, guardAt: .2, cos: -.7 }).outcome, 'none', 'from behind');
  assert.equal(defend({ ...base, guardAt: .2, cos: .9, stamina: 3 }).outcome, 'bad', 'too tired');
  assert.equal(defend({ ...base, guard: false, cos: .9 }).outcome, 'none');
  const shield = defend({ ...base, guard: false, shield: true, cos: .9 });
  assert.equal(shield.outcome, 'shield'); assert.equal(shield.damage, 0);
  // A guard is not broken by a count of blows but by what it has left: one heavy blow on a worn-down guard breaks it.
  assert.equal(defend({ ...base, guardAt: .2, cos: .9, posture: .5, heavy: true, attackPosture: .38 }).broken, false);
  assert.equal(defend({ ...base, guardAt: .2, cos: .9, posture: .3, heavy: true, attackPosture: .38 }).broken, true);
});
test('damage by place, armour, speed and edge', () => {
  const h = { base: 30, kind: 'cut', speed: 28, edge: true, armor: 'none' };
  assert.ok(strike({ ...h, region: 'head' }).damage > strike({ ...h, region: 'torso' }).damage);
  assert.ok(strike({ ...h, region: 'torso' }).damage > strike({ ...h, region: 'arm' }).damage);
  assert.ok(strike({ ...h, region: 'torso', armor: 'plate' }).damage < strike({ ...h, region: 'torso', armor: 'leather' }).damage);
  assert.ok(strike({ ...h, region: 'torso', speed: 6 }).damage < strike({ ...h, region: 'torso' }).damage * .5);
  assert.ok(strike({ ...h, region: 'torso', edge: false }).damage < strike({ ...h, region: 'torso' }).damage * .35);
  assert.ok(strike({ ...h, kind: 'blunt', region: 'torso', armor: 'plate' }).damage > strike({ ...h, region: 'torso', armor: 'plate' }).damage);
});
test('injuries change what a body can do', () => {
  const fine = injuryEffects({}), arm = injuryEffects({ arm_right: .8 }), leg = injuryEffects({ leg_left: .7 });
  assert.equal(fine.attack, 1); assert.ok(arm.attack < .7 && arm.guard < .8 && arm.dropRisk);
  assert.ok(leg.move < .7 && leg.limp && leg.lunge < .5);
});
test('fighter: phases, rebound into recovery, posture breaks, one strike per attack id', () => {
  const f = createFighter('x');
  const a = startAttack(f, 'slash_r', 0, {});
  let entered = [];
  while (f.attack && f.attack.phase !== 'active') { const s = stepAttack(f, 1 / 60); if (s.entered) entered.push(s.entered); }
  assert.deepEqual(entered, ['active']);
  rebound(f, 'shield', 1); assert.equal(f.attack.phase, 'recover'); assert.equal(a.stopped, 'shield');
  assert.equal(hurtPosture(f, .5, 1), false); assert.equal(hurtPosture(f, .6, 1), true); assert.ok(f.broken > 0);
  for (let i = 0; i < 200; i++) tick(f, 1 / 60, 1 + i / 60);
  assert.equal(f.broken, 0); assert.ok(f.posture >= .35);
  assert.equal(firstStrike(f, 7, 0), true); assert.equal(firstStrike(f, 7, .1), false); assert.equal(firstStrike(f, 8, .1), true);
});
test('blade sampling is the same at any step: bladeAt is a function of phase time only', () => {
  const w = WEAPONS.sword, f = frameOf(2, 3, .7, .2);
  const a = bladeAt(ATTACKS.slash_r, w, 1.37, f), b = bladeAt(ATTACKS.slash_r, w, 1.37, f);
  assert.ok(a.tip.distanceTo(b.tip) < 1e-9);
  assert.ok(Math.abs(a.tip.distanceTo(a.hilt) - w.length) < 1e-6);
});

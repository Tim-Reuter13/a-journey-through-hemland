import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { solveTwoBone, fabrik, keepOutside } from '../src/systems/motion/ik.js';
import { createFootState, planFoot, pelvisDrop } from '../src/systems/motion/feet.js';
import { createBalance, push, stepBalance, resistance, stageFor, hitZone, lyingPose } from '../src/systems/motion/balance.js';
import { GRIP, canGrab, createGrapple, stepGrapple, gripStrength } from '../src/systems/motion/grapple.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);

test('two-bone IK reaches a reachable target and bends toward the pole', () => {
  const root = v(0, 1, 0), joint = v(0, .5, 0), end = v(0, 0, 0);
  const r = solveTwoBone(root, joint, end, v(0, .3, -.2), v(0, .5, -2));
  assert.ok(r.reached);
  assert.ok(r.end.distanceTo(v(0, .3, -.2)) < 1e-6);
  assert.ok(Math.abs(r.joint.distanceTo(root) - .5) < 1e-6 && Math.abs(r.joint.distanceTo(r.end) - .5) < 1e-6, 'bone lengths kept');
  assert.ok(r.joint.z < -.1, 'knee bends forward, toward the pole');
});

test('two-bone IK reports unreachable targets and never stretches or folds past its limit', () => {
  const root = v(0, 1, 0), joint = v(0, .5, 0), end = v(0, 0, 0);
  const far = solveTwoBone(root, joint, end, v(0, -1, 0), v(0, .5, -2));
  assert.equal(far.reached, false);
  assert.ok(far.end.distanceTo(root) <= 1.0 + 1e-6, 'never longer than the limb');
  const close = solveTwoBone(root, joint, end, v(0, .98, -.01), v(0, .5, -2), { maxFlex: 2.5 });
  assert.equal(close.reached, false, 'a fold beyond the joint limit is refused');
  const inner = Math.acos(new THREE.Vector3().subVectors(root, close.joint).normalize().dot(new THREE.Vector3().subVectors(close.end, close.joint).normalize()));
  assert.ok(inner >= Math.PI - 2.5 - 1e-3, 'inner angle respects the limit');
});

test('FABRIK keeps segment lengths and reaches within the chain', () => {
  const pts = [v(0, 0, 0), v(0, 1, 0), v(0, 2, 0), v(0, 3, 0)];
  assert.ok(fabrik(pts, v(1.5, 2, 0)));
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(pts[i].distanceTo(pts[i + 1]) - 1) < 1e-3);
  assert.equal(fabrik([v(0, 0, 0), v(0, 1, 0)], v(0, 5, 0)), false);
});

test('a hand target inside the torso is pushed out of it', () => {
  const p = v(.05, 1.4, 0);
  assert.ok(keepOutside(p, v(0, 1.4, 0), .3, .4));
  assert.ok(Math.hypot(p.x, p.z) >= .3 - 1e-6);
});

test('a planted foot stays where it landed while the body moves on, then releases softly', () => {
  const f = createFootState(), ground = () => 0;
  planFoot(f, v(0, .125, 0), 0, ground, 1, 1 / 60, { maxDrift: .3 });
  assert.ok(f.locked);
  const t = planFoot(f, v(.1, .125, 0), 0, ground, 1, 1 / 60, { maxDrift: .3 });
  assert.equal(t.x, 0, 'no foot sliding while locked');
  planFoot(f, v(.4, .125, 0), 0, ground, 1, 1 / 60, { maxDrift: .3 });
  assert.equal(f.locked, false, 'released when the body has moved too far');
  const mid = planFoot(f, v(.4, .125, 0), 0, ground, .2, 1 / 60, { maxDrift: .3 });
  assert.ok(mid.x > 0 && mid.x < .4, 'travels from the old spot instead of popping');
});

test('feet land on the real ground (a step) and the pelvis drops for the lower foot', () => {
  const step = (x) => x > 0 ? .4 : 0;
  const high = createFootState(), low = createFootState();
  for (let i = 0; i < 40; i++) { planFoot(high, v(.12, .4 + .125, 0), .4, step, 1, 1 / 60); planFoot(low, v(-.12, .4 + .125, 0), .4, step, 1, 1 / 60); }
  assert.ok(Math.abs(high.target.y - .525) < .01, 'upper foot on the step');
  assert.ok(Math.abs(low.target.y - .125) < .01, 'lower foot on the ground below');
  const drop = pelvisDrop(v(-.12, .4 + 1.0625, 0), low.target, .9375 * .995);
  assert.ok(drop > .3 && drop < .45, `pelvis comes down (${drop.toFixed(2)})`);
});

test('an ordinary cut staggers at most; a heavy blow on someone already staggering topples them', () => {
  assert.equal(stageFor(.5), 'minor');
  const b = createBalance();
  assert.notEqual(push(b, { dir: { x: 1, z: 0 }, force: 1.15, resist: resistance() }), 'fall');
  const armoured = createBalance();
  assert.equal(push(armoured, { dir: { x: 1, z: 0 }, force: 1.15, resist: resistance({ armor: .9, guard: true }) }), 'minor');
  const c = createBalance();
  push(c, { dir: { x: 1, z: 0 }, force: 2.2, resist: 1 });
  assert.equal(push(c, { dir: { x: 1, z: 0 }, force: 2.3, resist: 1 }), 'fall');
});

test('a stagger steps the body in the direction of the force, then it recovers', () => {
  const b = createBalance();
  push(b, { dir: { x: 0, z: 1 }, force: 1.5, resist: 1 });
  let dz = 0, dx = 0;
  for (let i = 0; i < 120; i++) { const m = stepBalance(b, 1 / 60); dz += m.dz; dx += m.dx; }
  assert.ok(Math.abs(dz - .45) < .01 && Math.abs(dx) < 1e-9);
  assert.equal(b.stage, 'steady');
  for (let i = 0; i < 300; i++) stepBalance(b, 1 / 60);
  assert.ok(b.stability > .95, 'balance comes back');
  assert.ok(Math.hypot(b.sway.x, b.sway.z) < .01, 'upper body springs back without wobbling on');
});

test('hit zones follow the struck bone and the side', () => {
  assert.equal(hitZone('leg_lower_left'), 'shin_left');
  assert.equal(hitZone('chest', { behind: true }), 'back');
  assert.equal(hitZone('arm_upper_right', { nearJoint: true }), 'shoulder_right');
  const b = createBalance();
  push(b, { dir: { x: 1, z: 0 }, force: .5, location: 'thigh_right' });
  assert.equal(b.knee.right, 1, 'a struck leg buckles');
});

test('lying pose is read from the chest', () => {
  assert.equal(lyingPose(.9, .1, .1), 'back');
  assert.equal(lyingPose(-.9, .1, .1), 'front');
  assert.equal(lyingPose(.1, .1, .1), 'side');
  assert.equal(lyingPose(.1, .9, .3), 'sitting');
  assert.equal(lyingPose(.1, .9, .6), 'kneeling');
});

test('grabs need reach, a free hand and the target in front', () => {
  const h = { x: 0, z: 0, y: 0, yaw: 0, handFree: true };
  assert.ok(canGrab(h, { x: 0, z: -1, y: 0 }).ok);
  assert.equal(canGrab(h, { x: 0, z: -2, y: 0 }).ok, false);
  assert.equal(canGrab(h, { x: 0, z: 1, y: 0 }).reason, 'nicht vor dir');
  assert.equal(canGrab({ ...h, handFree: false }, { x: 0, z: -1, y: 0 }).reason, 'keine Hand frei');
  assert.equal(canGrab(h, { x: 0, z: -1, y: 0, held: true }).ok, false);
  assert.equal(canGrab(h, { x: 0, z: -1, y: 1.5 }).ok, false, 'not someone on a roof');
});

function run(g, seconds, input) { const events = []; for (let t = 0; t < seconds && g.state !== 'Done'; t += 1 / 60) events.push(...stepGrapple(g, 1 / 60, { rand: () => .5, ...input })); return events; }

test('a grip goes through contact to holding, and a struggling target breaks free eventually', () => {
  const g = createGrapple({}, {}, { holderStrength: 1, targetStrength: 1 });
  run(g, .5, {});
  assert.equal(g.state, 'Holding');
  const events = run(g, 15, { targetWantsFree: 1, targetStability: 1 });
  assert.ok(events.some(e => e.type === 'escaped'), 'no endless grip');
  const strong = createGrapple({}, {}, { holderStrength: 1, targetStrength: 1.8 }), weak = createGrapple({}, {}, { holderStrength: 1, targetStrength: .6 });
  run(strong, .5, {}); run(weak, .5, {});
  let ts = 0, tw = 0;
  for (; strong.state !== 'Escaping' && ts < 20; ts += 1 / 60) stepGrapple(strong, 1 / 60, { targetWantsFree: 1, rand: () => .5 });
  for (; weak.state !== 'Escaping' && tw < 20; tw += 1 / 60) stepGrapple(weak, 1 / 60, { targetWantsFree: 1, rand: () => .5 });
  assert.ok(ts < tw, 'a stronger body breaks free sooner');
});

test('takedowns need the target off balance; holding is never endless', () => {
  const g = createGrapple({}, {}, {});
  run(g, .5, {});
  const refused = stepGrapple(g, 1 / 60, { takedown: true, targetStability: 1 });
  assert.ok(refused.some(e => e.type === 'refused'));
  stepGrapple(g, 1 / 60, { targetStability: .2 });
  assert.equal(g.state, 'OffBalance');
  stepGrapple(g, 1 / 60, { takedown: true, targetStability: .2 });
  assert.equal(g.state, 'Takedown');
  run(g, 1, { targetStability: .2 });
  assert.equal(g.state, 'GroundControl');
  const idle = createGrapple({}, {}, {});
  run(idle, GRIP.maxHold + 2, { targetStability: 1 });
  assert.ok(['Releasing', 'Recovering', 'Done'].includes(idle.state), 'a quiet hold also ends');
  const hit = createGrapple({}, {}, {}); run(hit, .5, {});
  stepGrapple(hit, 1 / 60, { interrupt: true });
  assert.equal(hit.state, 'Interrupted', 'a holder who is struck lets go');
});

test('grip strength follows armour, stamina, balance and wounded arms', () => {
  assert.ok(gripStrength({ armor: .9 }) > gripStrength({}));
  assert.ok(gripStrength({ stamina: .1 }) < gripStrength({}));
  assert.ok(gripStrength({ arms: 1 }) < gripStrength({}));
});

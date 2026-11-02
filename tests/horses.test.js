import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GAITS, GAIT_ORDER, LEGS, gaitFor, legAngles, createHorseAnimator } from '../src/characters/horseAnimator.js';
import { createHorses, rideStep, ropePoints, RIDE_SPEEDS, MOUNT_TIME, DISMOUNT_TIME } from '../src/systems/horses.js';

// HORSES: gaits and their footfalls, the rider's aids, reins, and the horse system on a flat test field.
const BONES = ['root', 'body', 'chest', 'hips', 'neck_1', 'neck_2', 'head', 'bit', 'ear_right', 'ear_left', 'forelock', 'mane_1', 'mane_2', 'mane_3', 'mane_4',
  'tail_1', 'tail_2', 'tail_3', 'tail_4', 'saddle', 'stirrup_right', 'stirrup_left',
  ...['right', 'left'].flatMap(s => ['front_upper', 'front_lower', 'front_hoof', 'rear_upper', 'rear_lower', 'rear_hoof'].map(b => `${b}_${s}`))];
/** A stand-in for createCharacter('horse_*'): named bones with rest poses, nothing to draw. */
function fakeHorse() {
  const root = new THREE.Group(), rig = {};
  for (const name of BONES) { const b = new THREE.Object3D(); b.name = name; b.userData.rest = { position: b.position.clone(), quaternion: b.quaternion.clone() }; rig[name] = b; root.add(b); }
  rig.saddle.position.set(0, 38.6 / 16, -1 / 16); rig.bit.position.set(0, 36.5 / 16, -30.8 / 16);
  root.userData.rig = rig;
  return root;
}
const flatWorld = (walls = []) => ({
  heightAt: () => 0, terrainHeightAt: () => 0, nearRoad: () => false,
  blocked: (x, z, r = .43) => walls.some(w => x > w.x0 - r && x < w.x1 + r && z > w.z0 - r && z < w.z1 + r),
});
const steps = (n, fn, dt = 1 / 60) => { for (let i = 0; i < n; i++) fn(dt); };

test('gaits: speed picks walk, trot, canter, gallop, with hysteresis around the current one', () => {
  assert.equal(gaitFor(1.5), 'walk'); assert.equal(gaitFor(5.2), 'trot'); assert.equal(gaitFor(8.6), 'canter'); assert.equal(gaitFor(13.5), 'gallop');
  // A trot slowing to 3.5 stays a trot, a walk speeding to 3.7 stays a walk.
  assert.equal(gaitFor(3.5, 'trot'), 'trot'); assert.equal(gaitFor(3.7, 'walk'), 'walk');
  for (const g of GAIT_ORDER) assert.equal(gaitFor(GAITS[g].speed), g, `${g} is at home at its own speed`);
});

test('gaits: each has its footfall pattern (walk four-beat lateral, trot diagonal pairs, canter and gallop leading right)', () => {
  const order = g => LEGS.map(([set, side], i) => [GAITS[g].start[i], `${side[0]}${set[0]}`]).sort((a, b) => a[0] - b[0]);
  assert.deepEqual(order('walk').map(x => x[1]), ['lr', 'lf', 'rr', 'rf']);
  const trot = Object.fromEntries(order('trot').map(([t, leg]) => [leg, t]));
  assert.equal(trot.lr, trot.rf); assert.equal(trot.rr, trot.lf); assert.equal(Math.abs(trot.lr - trot.rr), .5);
  const canter = Object.fromEntries(order('canter').map(([t, leg]) => [leg, t]));
  assert.equal(canter.rr, canter.lf, 'the canter\'s middle beat is a diagonal pair'); assert.ok(canter.rf > canter.lf && canter.lr < canter.rr, 'the right fore leads, last');
  const gallop = order('gallop').map(x => x[1]);
  assert.deepEqual(gallop, ['lr', 'rr', 'lf', 'rf']);
});

test('legs: a leg sweeps back while it stands and comes forward through the swing, without jumps', () => {
  for (const g of GAIT_ORDER) for (const front of [true, false]) {
    const G = GAITS[g], amp = front ? G.fore : G.hind, at = u => legAngles(front, u, G.duty, amp, [0, 0, 0]);
    assert.ok(at(0)[0] > 0 && at(G.duty - 1e-4)[0] < 0, `${g}: forward at touchdown, back at lift-off`);
    // Continuity at lift-off and at touchdown (u wraps from 1 to 0).
    for (const [a, b] of [[G.duty - 1e-4, G.duty + 1e-4], [1 - 1e-4, 0]]) for (let k = 0; k < 3; k++) assert.ok(Math.abs(at(a)[k] - at(b)[k]) < .05, `${g} ${front ? 'fore' : 'hind'} joint ${k} continuous`);
    // The knee folds back on a foreleg, the hock forward on a hind leg, most in mid-swing.
    const mid = at(G.duty + (1 - G.duty) * .4)[1];
    assert.ok(front ? mid < -.4 : mid > .3, `${g}: the ${front ? 'knee' : 'hock'} folds in the swing`);
  }
});

test('horse animator: moving the model at a trot gives a trot and diagonal footfalls', () => {
  const horse = fakeHorse(), anim = createHorseAnimator(horse), falls = [];
  steps(200, dt => { horse.position.z -= 5.2 * dt; anim.update(dt, { mode: 'ridden' }); for (const f of anim.footfalls) falls.push([anim.phase, f]); });
  assert.equal(anim.gait, 'trot');
  assert.ok(anim.speed > 4.8 && anim.speed < 5.6);
  assert.ok(falls.length > 8, 'hooves come down');
  // Diagonal pairs land within the same frame or two: left hind with right fore.
  const lh = falls.filter(f => f[1] === 0).length, rf = falls.filter(f => f[1] === 3).length;
  assert.ok(Math.abs(lh - rf) <= 1);
  // Standing still the legs come to rest and the idle repertoire starts.
  steps(600, dt => anim.update(dt, { mode: 'tied' }));
  assert.ok(anim.speed < .05);
  assert.ok(Math.abs(horse.userData.rig.front_upper_left.rotation.x) < .7);
});

test('rider\'s aids: Shift taps step the pace up, it falls back without the spur held, a tired horse refuses', () => {
  const ride = { level: 1, decay: 0, stamina: 100 }, go = { moving: true, spur: false, hold: false, walk: false };
  assert.equal(rideStep(ride, go, .1), RIDE_SPEEDS[1], 'W alone is a trot');
  assert.equal(rideStep(ride, { ...go, spur: true }, .1), RIDE_SPEEDS[2]);
  assert.equal(rideStep(ride, { ...go, spur: true }, .1), RIDE_SPEEDS[3]);
  assert.equal(rideStep(ride, { ...go, spur: true }, .1), RIDE_SPEEDS[3], 'no faster than a gallop');
  // Holding Shift keeps the gallop (and costs stamina); letting go it drops a step every few seconds.
  const before = ride.stamina;
  for (let i = 0; i < 30; i++) rideStep(ride, { ...go, hold: true }, .1);
  assert.equal(ride.level, 3); assert.ok(ride.stamina < before);
  let t = 0; while (ride.level > 1 && t < 20) { rideStep(ride, go, .1); t += .1; }
  assert.equal(ride.level, 1); assert.ok(t > 4 && t < 6, `back to a trot after ${t.toFixed(1)} s`);
  // Caps Lock: a walk; spent: the spur is refused.
  assert.equal(rideStep({ level: 1, decay: 0, stamina: 100 }, { ...go, walk: true }, .1), RIDE_SPEEDS[0]);
  const spent = { level: 1, decay: 0, stamina: 5 };
  rideStep(spent, { ...go, spur: true }, .1);
  assert.equal(spent.level, 1); assert.ok(spent.refused > 0);
  // Standing, it gets its breath back.
  const resting = { level: 1, decay: 0, stamina: 40 };
  for (let i = 0; i < 50; i++) rideStep(resting, { ...go, moving: false }, .1);
  assert.ok(resting.stamina > 70);
});

test('reins: a rope sags with its slack and meets both ends', () => {
  const a = new THREE.Vector3(0, 2, 0), b = new THREE.Vector3(2, 2, 0), out = Array.from({ length: 9 }, () => new THREE.Vector3());
  ropePoints(a, b, .6, out);
  assert.ok(out[0].equals(a) && out[8].equals(b));
  assert.ok(out[4].y < 1.6, 'slack hangs down');
  ropePoints(a, b, 0, out);
  assert.ok(out[4].y > 1.95, 'taut, it is nearly straight');
});

function field(walls = []) {
  const scene = new THREE.Scene(), world = flatWorld(walls), sounds = [];
  const horses = createHorses({ scene, world, createCharacter: fakeHorse, sound: kind => sounds.push(kind) });
  const player = { position: new THREE.Vector3(0, 0, 0), yaw: 0, modelYaw: 0, mode: 'third' };
  return { horses, world, player, sounds, step: (n = 1) => steps(n, dt => { horses.capture(); horses.update(dt, player); }) };
}

test('horses: led by the reins it follows at their length, tied it goes to the rail and stays', () => {
  const { horses, player, step } = field();
  const rail = horses.addTie({ id: 'rail', kind: 'rail', x: -2, z: 10, x2: 2, z2: 10, y: 1.1 });
  const h = horses.add({ name: 'Asche', variant: 'grey', owner: 'player', x: 0, z: 4 });
  player.position.set(0, 0, 1.5);
  horses.lead(h);
  assert.equal(horses.led, h);
  // Walk away: the horse comes after, stopping a couple of metres short.
  for (let i = 0; i < 300; i++) { player.position.z -= .05; step(); }
  const gap = h.pos.distanceTo(player.position);
  assert.ok(gap > 1.6 && gap < 3.4, `follows at the reins' length (${gap.toFixed(2)})`);
  assert.ok(h.pos.z < -6, 'it came along');
  // Tie it to the rail: it walks over and stands square to it, head at the bar.
  horses.tie(h, horses.tieNear(0, 9.5));
  assert.equal(h.mode, 'tied'); assert.equal(horses.led, null);
  step(60 * 12);
  assert.ok(Math.abs(Math.abs(h.pos.z - 10) - 2.2) < .4, `stands 2.2 off the rail (${h.pos.z.toFixed(2)})`);
  assert.ok(Math.abs(h.pos.x) < 2.2);
  // Facing the rail.
  const fz = -Math.cos(h.yaw);
  assert.ok(Math.sign(fz) === Math.sign(10 - h.pos.z));
  assert.ok(rail);
});

test('horses: mount from your side, ride (trot, spur to a gallop, walls stop it), dismount beside it', () => {
  const { horses, player, step } = field([{ x0: -3, x1: 3, z0: -160, z1: -158 }]);
  const h = horses.add({ name: 'Asche', variant: 'grey', owner: 'player', x: 0, z: 0, yaw: 0 });
  player.position.set(-1.2, 0, 0); // the horse's left
  assert.ok(horses.mount(h, player));
  assert.equal(horses.ride.side, -1, 'mounts from the left where you stand');
  const ride = (controls, n) => steps(n, dt => { horses.capture(); horses.control({ forward: 0, strafe: 0, cameraYaw: 0, spur: false, hold: false, walk: false, jump: false, mouseMoved: true, ...controls }, dt, player); horses.update(dt, player); });
  ride({}, Math.ceil(MOUNT_TIME * 60) + 2);
  assert.equal(horses.ride.kind, 'ride');
  ride({ forward: 1 }, 120);
  assert.ok(Math.abs(h.speed - RIDE_SPEEDS[1]) < .2, `trots (${h.speed.toFixed(2)})`);
  ride({ forward: 1, spur: true }, 1); ride({ forward: 1, hold: true }, 30); ride({ forward: 1, spur: true, hold: true }, 1); ride({ forward: 1, hold: true }, 240);
  assert.ok(h.speed > RIDE_SPEEDS[3] - .5, `gallops (${h.speed.toFixed(2)})`);
  assert.ok(player.position.distanceTo(h.pos) < 1e-6, 'the wanderer goes where the horse goes');
  // The wall ahead: it pulls up instead of passing through.
  ride({ forward: 1, hold: true }, 900);
  assert.ok(h.pos.z > -158 + .5 && h.pos.z < -150, `stopped short of the wall (${h.pos.z.toFixed(2)})`);
  // Turning: camera-relative, the horse comes round toward where you look.
  ride({ forward: 1, cameraYaw: Math.PI / 2 }, 240);
  assert.ok(Math.abs(THREE.MathUtils.euclideanModulo(h.yaw - Math.PI / 2 + Math.PI, Math.PI * 2) - Math.PI) < .3, 'turned to the view');
  // Down again: to the left of the horse, standing.
  ride({}, 120);
  assert.ok(horses.dismount(player));
  ride({}, Math.ceil(DISMOUNT_TIME * 60) + 2);
  assert.equal(horses.ride, null); assert.equal(h.rider, null); assert.equal(h.mode, 'free');
  const right = Math.cos(h.yaw) * (player.position.x - h.pos.x) - Math.sin(h.yaw) * (player.position.z - h.pos.z);
  assert.ok(right < -.8, 'stands on its left');
});

test('horses: a whistle brings it from afar; tied, it only answers', () => {
  const { horses, player, step, sounds } = field();
  const h = horses.add({ name: 'Asche', variant: 'grey', owner: 'player', x: 40, z: 0 });
  assert.equal(horses.whistle(player), 'come');
  step(60 * 15);
  assert.equal(h.mode, 'free');
  assert.ok(h.pos.distanceTo(player.position) < 4.5, `came over (${h.pos.distanceTo(player.position).toFixed(1)})`);
  horses.tie(h, horses.addTie({ id: 'post', kind: 'post', x: 3, z: 3, y: 1.1 }));
  assert.equal(horses.whistle(player), 'tied');
  assert.ok(sounds.includes('whistle') && sounds.includes('neigh'));
});

test('road riders: a column keeps right and its spacing, stops for someone in the way, turns at the end', () => {
  const { horses, player, step } = field();
  const route = [[0, 0], [0, -200]];
  const members = [0, 1, 2].map(i => ({ id: `r${i}`, model: new THREE.Object3D(), horse: horses.add({ variant: 'bay', x: 0, z: 0 }) }));
  const g = horses.addGroup({ route, members, pace: RIDE_SPEEDS[1], start: .5, dir: 1, spacing: 4 });
  player.position.set(500, 0, 500);
  step(60 * 3);
  // Riding toward −z (models face −z, their right is +x): right of the road's middle is +x.
  for (const m of members) assert.ok(m.horse.pos.x > 1, `keeps right (${m.horse.pos.x.toFixed(2)})`);
  const gaps = [0, 1].map(i => members[i].horse.pos.distanceTo(members[i + 1].horse.pos));
  for (const gap of gaps) assert.ok(Math.abs(gap - 4) < .8, `spacing ${gap.toFixed(2)}`);
  // Someone on the road ahead of the leader: the column stops short.
  const lead = members[0].horse;
  player.position.set(lead.pos.x, 0, lead.pos.z - 4.5);
  step(60 * 4);
  assert.ok(g.speed < .3, `stopped (${g.speed.toFixed(2)})`);
  assert.ok(lead.pos.distanceTo(player.position) > 1.5);
  // The road's end: they turn back after a rest.
  player.position.set(500, 0, 500);
  g.s = g.total - 1; step(60 * 2);
  assert.equal(g.dir, -1); assert.ok(g.rest > 0);
});

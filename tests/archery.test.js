import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createArchery, BOW } from '../src/systems/archery.js';

// Flat ground at height 0; `wall` (z) is a stone wall across the range when given. Arrows leave the bow
// at `from` toward `to`.
function setup({ from = [0, 1.45, 0], to = [0, 1.45, -1], target = null, arrows = 5, wall = null } = {}) {
  const crosses = (a, b) => wall !== null && (a.z - wall) * (b.z - wall) <= 0 && a.z !== b.z;
  const world = { heightAt: () => 0, segmentBlocked: (a, b) => crosses(a, b), surfaceAt: () => 'stone', loose: [] };
  const player = { position: new THREE.Vector3(), stamina: 100, maxStamina: 100, sneaking: false };
  const hits = [], toasts = [], ammo = { n: arrows, count: () => ammo.n, use: () => { ammo.n--; }, add: n => { ammo.n += n; } };
  const archery = createArchery({ scene: new THREE.Scene(), world, player, ammo, toast: m => toasts.push(m), sound: () => {}, alert: () => {},
    targets: () => target ? [target] : [], strike: (t, amount) => { hits.push(amount); t.hp -= amount; },
    damage: power => 30 * power, arrowModel: () => new THREE.Group(),
    aim: (origin, direction) => { origin.fromArray(from); direction.fromArray(to).sub(origin).normalize(); origin.addScaledVector(direction, -BOW.length); } });
  const run = seconds => { for (let t = 0; t < seconds; t += 1 / 60) archery.update(1 / 60); };
  const shoot = (hold = BOW.drawTime + .05) => { archery.draw(); run(hold); return archery.release(); };
  return { archery, player, ammo, hits, toasts, run, shoot };
}
// A blocky person: legs, chest and head on their own bones, as the Blockbench rigs have them.
function person(z) {
  const model = new THREE.Group(), rig = {};
  for (const [name, y, size] of [['leg_upper_left', .7, [.5, 1, .3]], ['chest', 1.45, [.6, .9, .4]], ['head', 2.1, [.4, .4, .4]]]) {
    const bone = new THREE.Object3D(); bone.name = name; bone.position.y = y; model.add(bone); rig[name] = bone;
    bone.add(new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial()));
  }
  model.position.z = z; model.userData.rig = rig; model.updateMatrixWorld(true);
  return { kind: 'bandit', hp: 80, dead: false, model };
}

test('a full draw flies, drops a little and sticks in the chest where it struck, on the chest bone', () => {
  const target = person(-20), { archery, ammo, hits, run, shoot } = setup({ target });
  assert.equal(shoot(), true);
  assert.equal(ammo.n, 4);
  run(1);
  assert.deepEqual(hits, [30]);
  const arrow = target.model.userData.attached[0];
  assert.equal(arrow.bone, 'chest');
  assert.equal(arrow.object.parent, target.model.userData.rig.chest);
  assert.equal(archery.state().inBodies, 1);
});

test('the head counts more and the legs less than the chest', () => {
  const head = setup({ target: person(-6), from: [0, 2.1, 0], to: [0, 2.1, -1] });
  head.shoot(); head.run(.5);
  assert.ok(Math.abs(head.hits[0] - 30 * BOW.headshot) < 1e-9);
  const legs = setup({ target: person(-6), from: [0, .7, 0], to: [0, .7, -1] });
  legs.shoot(); legs.run(.5);
  assert.ok(Math.abs(legs.hits[0] - 30 * BOW.legs) < 1e-9);
});

test('an arrow passing beside a body does not hit it', () => {
  const { hits, run, shoot } = setup({ target: person(-12), from: [.9, 1.45, 0], to: [.9, 1.45, -1] });
  shoot(); run(1);
  assert.deepEqual(hits, []);
});

test('a barely drawn arrow is let down again and costs nothing; no arrows, no draw', () => {
  const { archery, ammo, run } = setup();
  archery.draw(); run(.05);
  assert.equal(archery.release(), false);
  assert.equal(ammo.n, 5);
  const empty = setup({ arrows: 0 });
  assert.equal(empty.archery.draw(), false);
  assert.match(empty.toasts[0], /KEINE PFEILE/);
});

test('stone throws an arrow back; it lands spent and harmless on the ground', () => {
  const target = person(4), { archery, hits, run, shoot } = setup({ wall: -6, target });
  shoot(); run(2);
  assert.deepEqual(hits, []);
  assert.equal(archery.state().flying, 0);
  assert.equal(archery.state().stuck, 1);
});

test('arrows in the ground are pulled out by hand, not by walking over them', () => {
  const { archery, ammo, player, run, shoot } = setup({ to: [0, 0, -6] });
  shoot(); run(.5);
  assert.equal(ammo.n, 4);
  player.position.set(0, 0, -5); run(.1);
  assert.equal(ammo.n, 4);
  const eye = new THREE.Vector3(0, 2, -4.2), view = new THREE.Vector3(0, -2, -1.6).normalize();
  const arrow = archery.nearestArrow(player.position, eye, view);
  assert.ok(arrow);
  const whole = archery.pull(arrow);
  assert.equal(ammo.n, whole ? 5 : 4);
  assert.equal(archery.state().stuck, 0);
  assert.equal(archery.nearestArrow(player.position, eye, view), null);
});

test('an arrow in a living body cannot be pulled; in a corpse it can', () => {
  const target = person(-5), { archery, player, run, shoot } = setup({ target });
  shoot(); run(.5);
  player.position.set(0, 0, -4);
  const eye = new THREE.Vector3(0, 2, -3.6), view = new THREE.Vector3(0, -.4, -1).normalize();
  assert.equal(archery.nearestArrow(player.position, eye, view), null);
  target.dead = true;
  assert.ok(archery.nearestArrow(player.position, eye, view));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPhysics } from '../src/systems/physics.js';
import { createRagdoll, RAGDOLL_BONES } from '../src/systems/ragdoll.js';

const heightAt = (x, z) => 2 + x * .05 + Math.sin(z * .2) * .5;
const settle = (physics, seconds = 4) => { for (let i = 0; i < seconds * 60; i++) physics.step(1 / 60); };

test('props come to rest on the heightfield where the terrain is', async () => {
  const physics = await createPhysics({ heightAt, bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 } });
  for (const [x, z] of [[-11, 4], [0, 0], [9.5, -13]]) {
    const object = new THREE.Object3D(); object.position.set(x, heightAt(x, z) + 3, z);
    physics.addProp(object, { half: [.2, .2, .2], mass: 2 });
    settle(physics, 3);
    assert.ok(Math.abs(object.position.y - (heightAt(x, z) + .2)) < .12, `prop at ${x},${z} rests at ${object.position.y} not ${heightAt(x, z) + .2}`);
  }
});

test('grabbing carries a prop to the hold point and throwing launches it', async () => {
  const physics = await createPhysics({ heightAt: () => 0, bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 } });
  const object = new THREE.Object3D(); object.position.set(0, .2, 0);
  physics.addProp(object, { half: [.2, .2, .2], mass: 1 });
  settle(physics, 1);
  const hit = physics.raycast(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, -1, 0), 5);
  assert.equal(hit?.kind, 'prop');
  physics.grab(hit, new THREE.Vector3(1, 1.5, 0));
  settle(physics, 1);
  assert.ok(object.position.distanceTo(new THREE.Vector3(1, 1.5, 0)) < .25, 'held prop follows the hold point');
  physics.release(new THREE.Vector3(6, 2, 0));
  settle(physics, .5);
  assert.ok(object.position.x > 2.5, 'thrown prop flies');
});

test('a ragdoll falls from its pose, stays connected and comes to rest', async () => {
  const physics = await createPhysics({ heightAt: () => 0, bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 } });
  const pivots = { root: [0, 0, 0], hips: [0, 17, 0], torso: [0, 20, 0], chest: [0, 24, 0], neck: [0, 31, 0], head: [0, 32.5, 0],
    arm_upper_right: [6.5, 30, 0], arm_lower_right: [6.5, 24, 0], arm_upper_left: [-6.5, 30, 0], arm_lower_left: [-6.5, 24, 0],
    leg_upper_right: [2, 17, 0], leg_lower_right: [2, 9, 0], leg_upper_left: [-2, 17, 0], leg_lower_left: [-2, 9, 0] };
  const parents = { hips: 'root', torso: 'hips', chest: 'torso', neck: 'chest', head: 'neck', arm_upper_right: 'chest', arm_lower_right: 'arm_upper_right',
    arm_upper_left: 'chest', arm_lower_left: 'arm_upper_left', leg_upper_right: 'hips', leg_lower_right: 'leg_upper_right', leg_upper_left: 'hips', leg_lower_left: 'leg_upper_left' };
  const character = new THREE.Group(), rig = {};
  for (const [name, p] of Object.entries(pivots)) {
    const bone = new THREE.Group(); bone.name = name; rig[name] = bone;
    const parent = rig[parents[name]] || character, pp = pivots[parents[name]] || [0, 0, 0];
    bone.position.set((p[0] - pp[0]) / 16, (p[1] - pp[1]) / 16, (p[2] - pp[2]) / 16); parent.add(bone);
  }
  character.userData.rig = rig;
  const ragdoll = createRagdoll(physics, character, { impulse: new THREE.Vector3(0, 0, -40) });
  assert.equal(ragdoll.parts.length, RAGDOLL_BONES.length);
  settle(physics, 6);
  const hips = ragdoll.position();
  assert.ok(hips.y < .6, `ragdoll lies on the ground (hips at ${hips.y.toFixed(2)})`);
  const head = rig.head.getWorldPosition(new THREE.Vector3()), chest = rig.chest.getWorldPosition(new THREE.Vector3());
  assert.ok(head.distanceTo(chest) < .9, 'head stays attached to the chest');
  assert.ok(ragdoll.resting(), 'ragdoll falls asleep');
});

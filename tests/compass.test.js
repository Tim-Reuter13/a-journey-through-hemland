import test from 'node:test';
import assert from 'node:assert/strict';
import { headingFromYaw, bearingTo, relativeAngle, projectMarker } from '../src/ui/compass.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const origin = { x: 0, z: 0 };

test('yaw matches the world convention and wraps through complete rotations', () => {
  assert.equal(headingFromYaw(0), 0);
  assert.equal(headingFromYaw(-Math.PI / 2), 90);
  assert.equal(headingFromYaw(Math.PI), 180);
  assert.equal(headingFromYaw(Math.PI / 2), 270);
  close(headingFromYaw(-Math.PI * 4.5), 90);
  close(headingFromYaw(Math.PI * 4), 0);
  assert.equal(headingFromYaw(NaN), 0);
});

test('bearings identify all eight German compass directions from translated origins', () => {
  const from = { x: 10, z: -23 };
  for (const [dx, dz, expected] of [
    [0, -1, 0], [1, -1, 45], [1, 0, 90], [1, 1, 135],
    [0, 1, 180], [-1, 1, 225], [-1, 0, 270], [-1, -1, 315],
  ]) close(bearingTo(from, { x: from.x + dx, z: from.z + dz }), expected);
  assert.equal(bearingTo(from, from), 0);
});

test('signed relative angles cross north continuously and have a deterministic opposite edge', () => {
  assert.equal(relativeAngle(1, 359), 2);
  assert.equal(relativeAngle(359, 1), -2);
  assert.equal(relativeAngle(90, 0), 90);
  assert.equal(relativeAngle(0, 90), -90);
  assert.equal(relativeAngle(180, 0), -180);
  assert.equal(relativeAngle(0, 180), -180);
  assert.equal(relativeAngle(720, -720), 0);
  for (let a = -720; a <= 720; a += 13) {
    for (let b = -360; b <= 360; b += 47) {
      const angle = relativeAngle(a, b);
      assert.ok(angle >= -180 && angle < 180);
      close(relativeAngle(a + 360, b - 360), angle);
    }
  }
});

test('strip projects forward to centre, hides offscreen places, and clamps quests', () => {
  const ahead = projectMarker(0, origin, { x: 0, z: -20, kind: 'village' });
  assert.equal(ahead.fraction, 0.5);
  assert.equal(ahead.opacity, 1);
  assert.equal(ahead.distance, 20);
  const east = { x: 20, z: 0, kind: 'camp' };
  assert.equal(projectMarker(0, origin, east).opacity, 0);
  assert.equal(projectMarker(0, origin, { ...east, kind: 'quest' }).fraction, 1);
  assert.equal(projectMarker(0, origin, { ...east, kind: 'quest' }).opacity, 1);
  assert.equal(projectMarker(0, origin, { x: -20, z: 0, kind: 'quest' }).fraction, 0);
  assert.equal(projectMarker(90, origin, east).fraction, 0.5);
  const edge = { x: Math.sin(75 * Math.PI / 180), z: -Math.cos(75 * Math.PI / 180), kind: 'tower' };
  close(projectMarker(0, origin, edge).fraction, 1);
  assert.equal(projectMarker(0, origin, edge).opacity, 1);
});

test('ordinary markers fade only after 120 units; distant quests remain visible', () => {
  for (const [distance, opacity] of [[0, 1], [120, 1], [150, 0.5], [180, 0], [1000, 0]]) {
    assert.equal(projectMarker(0, origin, { x: 0, z: -distance, kind: 'shrine' }).opacity, opacity);
    assert.equal(projectMarker(0, origin, { x: 0, z: -distance, kind: 'quest' }).opacity, 1);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { stickVector, ringSpot, prefersTouch } from '../src/ui/touchControls.js';
import { normalizeSettings, DEFAULT_SETTINGS } from '../src/ui/menu.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('the stick reads forward as +y, has a dead zone and saturates at its ring', () => {
  assert.deepEqual(stickVector(0, 0, 50), { x: 0, y: 0, mag: 0, sprint: false });
  assert.equal(stickVector(3, 0, 50).mag, 0, 'a resting thumb does not creep');
  const up = stickVector(0, -50, 50);
  near(up.y, 1); near(up.x, 0); assert.equal(up.sprint, false);
  const right = stickVector(80, 0, 50);
  near(right.x, 1); near(right.mag, 1); assert.equal(right.sprint, true, 'pushed well past the ring sprints');
  const half = stickVector(0, 28, 50);
  assert.ok(half.y < 0 && half.mag > .3 && half.mag < .6, 'a light push walks backwards');
  const diagonal = stickVector(30, -30, 50);
  near(Math.hypot(diagonal.x, diagonal.y), diagonal.mag);
});

test('cluster buttons sit on rings round the attack button', () => {
  const center = { right: 60, bottom: 60 };
  const left = ringSpot(center, 80, 180, 40), above = ringSpot(center, 80, 90, 40);
  near(left.right, 60 + 80 - 20); near(left.bottom, 60 - 20);
  near(above.right, 60 - 20); near(above.bottom, 60 + 80 - 20);
  const diagonal = ringSpot(center, 80, 135, 40);
  assert.ok(diagonal.right > above.right && diagonal.bottom > left.bottom);
});

test('touch is preferred for coarse pointers only', () => {
  const win = (coarse, fine, points) => ({ matchMedia: q => ({ matches: q.includes('coarse') ? coarse : fine }), navigator: { maxTouchPoints: points } });
  assert.equal(prefersTouch(win(true, false, 5)), true, 'phone');
  assert.equal(prefersTouch(win(false, true, 0)), false, 'desktop with a mouse');
  assert.equal(prefersTouch(win(false, true, 10)), false, 'touch screen laptop used with a mouse');
  assert.equal(prefersTouch({}), false, 'no window features at all');
});

test('the touch setting accepts auto, on and off only', () => {
  assert.equal(DEFAULT_SETTINGS.touchControls, 'auto');
  assert.equal(normalizeSettings({ touchControls: 'on' }).touchControls, 'on');
  assert.equal(normalizeSettings({ touchControls: 'off' }).touchControls, 'off');
  assert.equal(normalizeSettings({ touchControls: 'always' }).touchControls, 'auto');
});

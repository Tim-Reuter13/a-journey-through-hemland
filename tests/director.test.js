import test from 'node:test';
import assert from 'node:assert/strict';
import { createDirector, spline, along } from '../src/systems/director.js';

test('spline passes through its control points and along() follows arc length with a heading', () => {
  const pts = [[0, 0, 0], [10, 0, 0], [10, 10, 0]];
  assert.deepEqual(spline(pts, 0), [0, 0, 0]);
  assert.deepEqual(spline(pts, .5).map(Math.round), [10, 0, 0]);
  assert.deepEqual(spline(pts, 1), [10, 10, 0]);
  const mid = along([[0, 0], [0, -10]], .5);
  assert.equal(mid.x, 0); assert.equal(mid.z, -5);
  // Walking toward -z: the model's front (-z) leads, so yaw is 0.
  assert.ok(Math.abs(mid.yaw) < 1e-9);
});

test('director fires events once, keeps actors moving across shots and ends on time', () => {
  const events = [], placed = [];
  let ended = false;
  const director = createDirector({ shots: [
    { duration: 2, camera: { path: [[0, 2, 5], [0, 2, 3]], look: [[0, 1, 0]] },
      events: [{ at: .5, do: 'subtitle', text: 'A' }, { at: 1, do: 'run', actor: 'hero', path: [[0, 0], [0, -6]], duration: 2 }] },
    { duration: 2, camera: { from: [5, 2, 0], to: [5, 3, 0], lookFrom: [0, 1, 0], lookTo: [0, 1, -4], shake: 1 },
      events: [{ at: .2, do: 'die', actor: 'guard' }] },
  ] }, { event: e => events.push(e.do), place: (id, p) => placed.push([id, p]), end: () => { ended = true; } });
  for (let i = 0; i < 15; i++) director.update(.1);
  assert.deepEqual(events, ['subtitle']);
  let frame;
  for (let i = 0; i < 10; i++) frame = director.update(.1);
  assert.equal(frame.shot, 1);
  assert.deepEqual(events, ['subtitle', 'die']);
  const last = placed.at(-1)[1];
  assert.ok(last.z < -4 && last.gait === 'run', 'the run continues into the next shot');
  for (let i = 0; i < 20; i++) director.update(.1);
  assert.ok(ended && director.done);
});

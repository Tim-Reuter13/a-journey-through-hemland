import test from 'node:test';
import assert from 'node:assert/strict';
import { createHeightCache } from '../src/world/heightCache.js';

test('the cache returns the function at grid points and a smooth blend between them', () => {
  let calls = 0;
  const cache = createHeightCache((x, z) => { calls++; return x * .2 + z * .1; });
  assert.ok(Math.abs(cache.at(3, 4) - (3 * .2 + 4 * .1)) < 1e-9);
  assert.ok(Math.abs(cache.at(3.3, 4.1) - (3.3 * .2 + 4.1 * .1)) < 1e-9, 'a plane is reproduced exactly');
  const before = calls;
  for (let i = 0; i < 200; i++) cache.at(3.3, 4.1);
  assert.equal(calls, before, 'repeat lookups cost no new samples');
});

test('negative coordinates work and the cache stays bounded', () => {
  const cache = createHeightCache((x, z) => Math.sin(x) + Math.cos(z), .5, 50);
  assert.ok(Number.isFinite(cache.at(-120.3, -77.7)));
  for (let i = 0; i < 400; i++) cache.at(i * .7, i * .3);
  assert.ok(cache.size <= 60);
});

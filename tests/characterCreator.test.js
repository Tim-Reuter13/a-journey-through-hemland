import test from 'node:test';
import assert from 'node:assert/strict';
import { cycleOption, randomAppearance } from '../src/ui/characterCreator.js';
import { APPEARANCE_OPTIONS as o, DEFAULT_APPEARANCE, normalizeAppearance } from '../src/characters/appearance.js';

test('cycleOption wraps both directions, arbitrary steps, and singleton lists', () => {
  assert.equal(cycleOption(['a', 'b', 'c'], 'c', 1), 'a');
  assert.equal(cycleOption(['a', 'b', 'c'], 'a', -1), 'c');
  assert.equal(cycleOption(['a', 'b', 'c'], 'b', 7), 'c');
  assert.equal(cycleOption(['a', 'b', 'c'], 'b', -7), 'a');
  assert.equal(cycleOption(['a'], 'a', 999), 'a');
  assert.equal(cycleOption(['a', 'b'], 'a'), 'b');
});

test('cycleOption uses appearance ids, including null and false, without mutation', () => {
  const options = Object.freeze([Object.freeze({ id: null }), Object.freeze({ id: false }), Object.freeze({ id: 'short' })]);
  assert.equal(cycleOption(options, 'short', 1), null);
  assert.equal(cycleOption(options, null, 1), false);
  assert.equal(cycleOption(options, false, -1), null);
  assert.equal(cycleOption(o.beards, 'moustache', 1), null);
  assert.equal(cycleOption(o.bodies, 'male', 1), 'female');
});

test('cycleOption handles empty lists, unknown values and invalid steps predictably', () => {
  assert.equal(cycleOption([], 'keep', 1), 'keep');
  assert.equal(cycleOption(null, null, 1), null);
  assert.equal(cycleOption(['a', 'b'], 'missing', 1), 'a');
  assert.equal(cycleOption(['a', 'b'], 'missing', -1), 'b');
  assert.equal(cycleOption(['a', 'b'], 'b', NaN), 'b');
  assert.equal(cycleOption(['a', 'b'], 'b', Infinity), 'b');
  assert.equal(cycleOption(['a', 'b'], 'b', 0), 'b');
  assert.equal(cycleOption(['a', 'b'], 'a', 1.8), 'b');
});

test('seeded random appearances are repeatable, diverse and independent objects', () => {
  for (const seed of [0, 1, -25, 42, 1.5, '', 'Aschenwanderer', 'Äö🔥']) {
    assert.deepEqual(randomAppearance(seed), randomAppearance(seed));
    assert.notEqual(randomAppearance(seed), randomAppearance(seed));
  }
  assert.ok(new Set(Array.from({ length: 50 }, (_, seed) => JSON.stringify(randomAppearance(seed)))).size > 40);
  const result = randomAppearance(42), expected = randomAppearance(42);
  result.name = 'Changed'; result.skin = -1;
  assert.deepEqual(randomAppearance(42), expected);
});

test('every generated appearance obeys the normalizer and covers every supported option', () => {
  const seen = {};
  for (let seed = 0; seed < 1000; seed++) {
    const value = randomAppearance(seed);
    assert.deepEqual(value, normalizeAppearance(value));
    assert.equal(value.name, DEFAULT_APPEARANCE.name);
    for (const [key, option] of Object.entries(value)) (seen[key] ??= new Set()).add(option);
  }
  for (const [key, list] of [['body', o.bodies], ['build', o.builds], ['hair', o.hairStyles], ['face', o.faces], ['beard', o.beards]]) {
    for (const option of list) assert.ok(seen[key].has(normalizeAppearance({ [key]: option.id })[key]), `${key}: ${option.id}`);
  }
  for (const [key, list] of [['skin', o.skins], ['eyes', o.eyeColors], ['hairColor', o.hairColors]]) {
    assert.equal(seen[key].size, list.length);
  }
  assert.deepEqual(seen.scar, new Set([false, true]));
});

test('injected random functions select the first/last options and clamp bad draws', () => {
  const first = normalizeAppearance({ ...DEFAULT_APPEARANCE, body: o.bodies[0].id, build: o.builds[0].id, skin: 0, face: o.faces[0].id, eyes: 0, scar: false, hair: o.hairStyles[0].id, hairColor: 0, beard: o.beards[0].id });
  assert.deepEqual(randomAppearance(() => 0), first);
  assert.deepEqual(randomAppearance(() => -1), first);
  assert.deepEqual(randomAppearance(() => NaN), first);
  const last = randomAppearance(() => 1);
  assert.equal(last.skin, o.skins.length - 1);
  assert.equal(last.hairColor, o.hairColors.length - 1);
  assert.equal(last.eyes, o.eyeColors.length - 1);
  assert.equal(last.body, o.bodies.at(-1).id);
  assert.equal(last.build, o.builds.at(-1).id);
  assert.equal(last.hair, o.hairStyles.at(-1).id);
  assert.equal(last.face, o.faces.at(-1).id);
  assert.equal(last.beard, o.beards.at(-1).id);
  assert.equal(last.scar, true);
  assert.deepEqual(randomAppearance(() => 10), last);
});

test('randomAppearance validates seed types and leaves shared defaults and options intact', () => {
  const before = JSON.stringify({ o, DEFAULT_APPEARANCE });
  for (const seed of [null, {}, [], true, NaN, Infinity]) assert.throws(() => randomAppearance(seed), TypeError);
  const sample = randomAppearance(() => .5);
  assert.deepEqual(sample, normalizeAppearance(sample), 'random appearances are already normalized');
  assert.equal(JSON.stringify({ o, DEFAULT_APPEARANCE }), before);
});

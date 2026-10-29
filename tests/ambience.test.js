import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAmbience, timeOfDayWeights, distanceFalloff, nearestFireGain,
  pickChordProgression, combatMixAt,
} from '../src/audio/ambience.js';

test('wildlife follows day/night windows with twilight silence and midnight wrap', () => {
  assert.deepEqual(timeOfDayWeights(12), { day: 1, night: 0 });
  assert.deepEqual(timeOfDayWeights(0), { day: 0, night: 1 });
  assert.deepEqual(timeOfDayWeights(23), timeOfDayWeights(-1));
  assert.deepEqual(timeOfDayWeights(36), timeOfDayWeights(12));
  for (const hour of [5, 5.9, 19, 20, 20.9]) {
    assert.deepEqual(timeOfDayWeights(hour), { day: 0, night: 0 });
  }
  assert.equal(timeOfDayWeights(6.25).day, 0.5);
  assert.equal(timeOfDayWeights(18.75).day, 0.5);
  assert.equal(timeOfDayWeights(21.25).night, 0.5);
  assert.equal(timeOfDayWeights(4.75).night, 0.5);
  for (let hour = -48; hour <= 48; hour += 0.125) {
    const { day, night } = timeOfDayWeights(hour);
    assert.ok(day >= 0 && day <= 1 && night >= 0 && night <= 1);
    assert.equal(day * night, 0);
  }
  assert.deepEqual(timeOfDayWeights(NaN), timeOfDayWeights(12));
});

test('campfire attenuation is bounded, monotonic and silent beyond fourteen units', () => {
  assert.equal(distanceFalloff(0), 1);
  assert.equal(distanceFalloff(7), 0.25);
  assert.equal(distanceFalloff(14), 0);
  assert.equal(distanceFalloff(100), 0);
  assert.equal(distanceFalloff(Infinity), 0);
  assert.equal(distanceFalloff(NaN), 0);
  assert.equal(distanceFalloff(-2), 1);
  assert.equal(distanceFalloff(1, 0), 0);
  let previous = 1;
  for (let distance = 0; distance <= 20; distance += 0.25) {
    const level = distanceFalloff(distance);
    assert.ok(level <= previous && level >= 0);
    previous = level;
  }
});

test('nearest campfire uses three-dimensional distance and does not sum sources', () => {
  const position = { x: 10, y: 2, z: -10 };
  const near = { x: 13, y: 6, z: -10 };
  const far = { x: 100, y: 2, z: -10 };
  assert.equal(nearestFireGain(position, [far, near]), distanceFalloff(5));
  assert.equal(nearestFireGain(position, [near, near]), distanceFalloff(5));
  assert.equal(nearestFireGain(position, []), 0);
  assert.equal(nearestFireGain(position, [null, { x: NaN, z: 0 }]), 0);
  assert.equal(nearestFireGain(position, [{ ...position, y: 17 }]), 0);
});

test('chord selections stay in D Dorian or D Aeolian and return independent voicings', () => {
  const scales = { dorian: new Set([2, 4, 5, 7, 9, 11, 0]), aeolian: new Set([2, 4, 5, 7, 9, 10, 0]) };
  for (const [mode, scale] of Object.entries(scales)) {
    for (let seed = -3; seed < 6; seed++) {
      const progression = pickChordProgression(seed, mode);
      assert.equal(progression.length, 4);
      assert.deepEqual(progression[0], [50, 57, 65]);
      for (const chord of progression) {
        assert.equal(chord.length, 3);
        for (const note of chord) assert.ok(scale.has(note % 12));
      }
    }
  }
  const first = pickChordProgression(0);
  first[0][0] = -999;
  assert.equal(first[3][0], 50);
  assert.equal(pickChordProgression(0)[0][0], 50);
  assert.deepEqual(pickChordProgression(0), pickChordProgression(3));
  assert.notDeepEqual(pickChordProgression(0), pickChordProgression(0, 'aeolian'));
});

test('combat crossfade reaches full strength in two seconds and returns over four', () => {
  assert.equal(combatMixAt(10, 10, 0, true), 0);
  assert.equal(combatMixAt(11, 10, 0, true), 0.5);
  assert.equal(combatMixAt(12, 10, 0, true), 1);
  assert.equal(combatMixAt(100, 10, 0, true), 1);
  assert.equal(combatMixAt(21, 20, 1, false), 0.75);
  assert.equal(combatMixAt(24, 20, 1, false), 0);
  // Rapid combat toggles start at the current level, avoiding a gain discontinuity.
  const reversed = combatMixAt(11, 10, 0, true);
  assert.equal(combatMixAt(11, 11, reversed, false), reversed);
  assert.equal(combatMixAt(13, 11, reversed, false), 0.25);
  assert.equal(combatMixAt(15, 11, reversed, false), 0);
});

test('factory and pre-gesture API stay inert without browser globals', () => {
  const audio = createAmbience();
  const initial = audio.state();
  assert.equal(initial.contextState, 'uninitialized');
  assert.deepEqual(initial.volumes, { master: 0.6, music: 0.45, effects: 0.7 });
  audio.update(100, { hour: 12, combat: true, paused: true, fires: [{ x: 0, y: 0, z: 0 }] });
  audio.footstep('stone', 1);
  assert.deepEqual(audio.state(), initial);
  audio.setVolume({ master: 10, music: -1, effects: NaN });
  assert.deepEqual(audio.state().volumes, { master: 1, music: 0, effects: 0.7 });
  initial.volumes.effects = 0;
  assert.equal(audio.state().volumes.effects, 0.7);
  audio.dispose();
  audio.dispose();
});

test('resume safely resolves when Web Audio is unavailable', async () => {
  const audio = createAmbience();
  await audio.resume();
  await audio.resume();
  audio.update(1, { hour: 0, combat: true });
  audio.footstep('wood', 0.5);
  assert.equal(audio.state().contextState, 'unavailable');
  assert.equal(audio.state().musicMode, 'silence');
  assert.equal(audio.state().activeVoices, 0);
  assert.deepEqual(audio.state().activeLayers, []);
});

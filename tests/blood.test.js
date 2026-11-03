import test from 'node:test';
import assert from 'node:assert/strict';
import { TILE, FILM, flowStep, absorb, poolPixel, bodyPixel, uvFrame, pixelStep, linePixels, regionOf, REGIONS, KIND, CORE } from '../src/systems/bloodSim.js';

const sum = a => a.reduce((s, v) => s + v, 0);
const fresh = () => ({ vol: new Float32Array(TILE * TILE), out: new Float32Array(TILE * TILE), ground: new Float32Array(TILE * TILE), spill: new Float32Array(TILE * 4) });

test('a blot of blood spreads into a pool and keeps its volume', () => {
  const t = fresh(); t.vol[16 * TILE + 16] = 40;
  const before = sum(t.vol);
  for (let n = 0; n < 160; n++) { t.spill.fill(0); flowStep(t.vol, t.ground, t.out, t.spill); t.vol.set(t.out); }
  assert.ok(Math.abs(sum(t.vol) + sum(t.spill) - before) < 1e-2 || Math.abs(sum(t.vol) - before) < 1e-2);
  const covered = [...t.vol].filter(v => v > .1).length;
  assert.ok(covered > 60 && covered < 400, `pool covers ${covered} cells`);
  // The thick middle ends no deeper than a few film thicknesses once it has settled.
  assert.ok(Math.max(...t.vol) < FILM * 6);
});

test('blood runs downhill and not uphill', () => {
  const t = fresh();
  for (let z = 0; z < TILE; z++) for (let x = 0; x < TILE; x++) t.ground[z * TILE + x] = x * .02; // falls toward x = 0
  t.vol[16 * TILE + 16] = 30;
  for (let n = 0; n < 200; n++) { t.spill.fill(0); flowStep(t.vol, t.ground, t.out, t.spill); t.vol.set(t.out); }
  let low = 0, high = 0;
  for (let z = 0; z < TILE; z++) for (let x = 0; x < TILE; x++) { if (x < 16) low += t.vol[z * TILE + x]; if (x > 16) high += t.vol[z * TILE + x]; }
  assert.ok(low > high * 2, `downhill ${low.toFixed(1)} vs uphill ${high.toFixed(1)}`);
});

test('what leaves the tile edge is reported as spill', () => {
  const t = fresh(); t.vol[0] = 20; // the north-west corner cell
  let spilled = 0;
  for (let n = 0; n < 60; n++) { t.spill.fill(0); flowStep(t.vol, t.ground, t.out, t.spill); t.vol.set(t.out); spilled += sum(t.spill); }
  assert.ok(spilled > 1);
  assert.ok(Math.abs(sum(t.vol) + spilled - 20) < 1e-2);
});

test('thin film soaks in quickly, deep pools slowly', () => {
  const v = new Float32Array([.25, 3]);
  absorb(v, .05, 4);
  assert.ok(v[0] < .25 && v[1] > 2.8);
});

test('pool pixels: nothing where dry, dark rim, wet blood is brighter than dried', () => {
  assert.equal(poolPixel(0, 0, false, 3, 3), null);
  const wet = poolPixel(1.2, 0, false, 4, 4), dry = poolPixel(1.2, 200, false, 4, 4), rim = poolPixel(1.2, 0, true, 4, 4);
  assert.ok(wet[0] > dry[0]);
  assert.ok(rim[0] < wet[0]);
});

test('body pixels: armour scratches show metal, cloth is darker than skin, thin blood is dithered', () => {
  const base = [100, 100, 110];
  const scratch = bodyPixel(0, KIND.scratch, 255, 3, 3, base);
  assert.ok(scratch[0] > 150);
  const skin = bodyPixel(255, KIND.skin, 255, 2, 2, base), cloth = bodyPixel(255, KIND.cloth, 255, 2, 2, base);
  assert.ok(skin[0] > cloth[0]);
  const core = bodyPixel(255, KIND.skin | CORE, 255, 2, 2, base);
  assert.ok(core[0] < skin[0]);
  assert.equal(bodyPixel(255, KIND.skin, 60, 1, 0, base), null);
  assert.ok(bodyPixel(255, KIND.skin, 60, 1, 1, base));
});

test('uvFrame turns a world direction into pixel steps on a rotated face', () => {
  // A wall facing +Z whose texture is turned a quarter: world up runs along +u.
  const p = [[0, 0, 0], [1, 0, 0], [0, 1, 0]], t = [[10, 10], [10, 26], [26, 10]];
  const frame = uvFrame(...p, ...t);
  const [du, dv] = pixelStep(frame, [0, -1, 0]);
  assert.ok(du < -10 && Math.abs(dv) < 1e-6, `${du}, ${dv}`);
  const [eu, ev] = pixelStep(frame, [1, 0, 0]);
  assert.ok(Math.abs(eu) < 1e-6 && ev > 10);
  assert.equal(uvFrame([0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 0], [1, 0], [2, 0]), null);
});

test('linePixels walks a connected line', () => {
  const line = linePixels(0, 0, 5, 2);
  assert.deepEqual(line[0], [0, 0]); assert.deepEqual(line.at(-1), [5, 2]);
  for (let i = 1; i < line.length; i++) assert.ok(Math.abs(line[i][0] - line[i - 1][0]) <= 1 && Math.abs(line[i][1] - line[i - 1][1]) <= 1);
});

test('regions know where a body bleeds hard', () => {
  assert.equal(regionOf('neck:mesh'), REGIONS.neck);
  assert.equal(REGIONS.neck.bleed, 'artery');
  assert.equal(regionOf('arm_lower_left:mesh'), REGIONS.arm);
  assert.equal(regionOf('leg_upper_right:mesh'), REGIONS.leg);
  assert.equal(regionOf('foot_left:mesh'), REGIONS.foot);
  assert.ok(REGIONS.neck.severity > REGIONS.chest.severity && REGIONS.chest.severity > REGIONS.hand.severity);
});

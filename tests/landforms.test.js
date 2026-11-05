import test from 'node:test';
import assert from 'node:assert/strict';
import { pn, ridged, terrace, zoneWeights, ZONES, ZONE_IDS, relief, ravines, crags, alpine, mountains, badlands, dunes, volcano, highland, pillars, groundLook } from '../src/world/landforms.js';
import { createHeightfield, CELLS } from '../src/world/heightfield.js';
import { BOUNDS, SITES, ROADS, WATER_LEVEL, biomeWeights } from '../src/world/hemland.js';

// The shapes of the land (landforms.js) and how they sit in the heightfield: determinism, ranges, no cracks between
// chunks, flat sites, roads you can walk, every region really different from open country.

const field = createHeightfield();
const grid = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const zeroZones = Object.fromEntries(ZONE_IDS.map(id => [id, 0]));
const open = { autumn: 0, taiga: 0, marsh: 0, plains: 0, forest: 0, ...zeroZones };

test('noise is deterministic, bounded and smooth', () => {
  for (let i = 0; i < 200; i++) {
    const x = Math.sin(i * 12.9898) * 500, z = Math.cos(i * 78.233) * 500;
    assert.equal(pn(x, z, 3), pn(x, z, 3));
    assert.ok(Math.abs(pn(x, z, 3)) <= 1.0001);
    const r = ridged(x * .01, z * .01, 4, 5);
    assert.ok(r >= 0 && r <= 1.0001, `ridged ${r}`);
    assert.ok(Math.abs(pn(x, z, 3) - pn(x + .01, z, 3)) < .05, 'noise has no jumps');
  }
});

test('terrace makes flat treads with short risers', () => {
  assert.ok(Math.abs(terrace(5, 10, .2) - terrace(6, 10, .2)) < 1e-9);
  assert.ok(terrace(9.5, 10, .2) > terrace(8, 10, .2) + .5);
});

test('region weights stay in 0..1 and each region is full at its centre', () => {
  for (const id of ZONE_IDS) {
    const w = zoneWeights(ZONES[id].x, ZONES[id].z);
    assert.ok(w[id] > .9, `${id} centre ${w[id]}`);
    for (const other of ZONE_IDS) assert.ok(w[other] >= 0 && w[other] <= 1);
  }
  const w = biomeWeights(0, 0);
  for (const k of ['autumn', 'taiga', 'marsh', 'plains', 'forest', ...ZONE_IDS]) assert.ok(Number.isFinite(w[k]) && w[k] >= 0 && w[k] <= 1.0001, k);
  assert.ok(Math.max(...ZONE_IDS.map(id => w[id])) < .05, 'the village lies in no landform region');
});

test('the authored places keep to their own biomes, the wild points of interest stand in theirs', () => {
  const wild = { mine: 'badlands', ribs: 'dunes', obelisk: 'dunes', caravan: 'dunes', altar: 'volcanic', burnt_hut: 'volcanic', circle: 'highland', peat_hut: 'highland', jade_shrine: 'pillars' };
  for (const [id, s] of Object.entries(SITES)) {
    const w = zoneWeights(s.x, s.z);
    if (wild[id]) assert.ok(w[wild[id]] > .6, `${id} should lie in ${wild[id]} (${JSON.stringify(w)})`);
    else assert.ok(Math.max(...ZONE_IDS.map(z => w[z])) < .35, `${id} is inside a region (${JSON.stringify(w)})`);
  }
});

test('each region has a landform of its own, unlike open country', () => {
  const sample = (id, f) => grid(300, i => { const a = i * 2.399, r = Math.sqrt(i / 300) * ZONES[id].r * .55; return f(ZONES[id].x + Math.cos(a) * r, ZONES[id].z + Math.sin(a) * r); });
  const range = a => Math.max(...a) - Math.min(...a);
  assert.ok(range(sample('badlands', badlands)) > 40, 'mesas and canyons span a big drop');
  assert.ok(range(sample('dunes', dunes)) > 25, 'dunes roll');
  assert.ok(range(sample('volcanic', volcano)) > 60, 'the volcano rises');
  assert.ok(range(sample('highland', (x, z) => highland(x, z, WATER_LEVEL))) > 25, 'the moor undulates');
  assert.ok(range(sample('pillars', pillars)) > 40, 'towers stand on the lowland');
  const v = ZONES.volcanic;
  assert.ok(volcano(v.x + 6, v.z) < volcano(v.x + 55, v.z) - 6, 'the volcano has a crater: its middle lies below its rim');
  assert.ok(volcano(v.x + 55, v.z) > volcano(v.x + 200, v.z) + 40, 'and its flanks fall away');
});

test('open country is never a plane: hills, belts, ravines', () => {
  const heights = grid(900, i => relief(-300 + (i % 30) * 60, -200 + Math.floor(i / 30) * 60));
  const range = Math.max(...heights) - Math.min(...heights);
  assert.ok(range > 45, `relief spans ${range.toFixed(0)}`);
  const cuts = grid(900, i => ravines(-300 + (i % 30) * 60, -200 + Math.floor(i / 30) * 60));
  assert.ok(cuts.some(v => v > .9) && cuts.every(v => v >= 0 && v <= 1), 'ravines exist and are a share');
});

test('mountains ring the map and close its edge, the interior stays free of them', () => {
  assert.ok(alpine(BOUNDS.minX + 20, 0, 20, zeroZones) > .95);
  assert.ok(alpine(300, 0, 900, zeroZones) < .01);
  assert.ok(alpine(0, -1500, 40, zeroZones) > .95, 'the Nordkamm');
  assert.ok(mountains(0, -1450, 1) > 90, 'a range is high');
});

test('the heightfield is seamless across chunk borders', () => {
  for (const [cx, cz] of [[0, 0], [3, -5], [-6, 2], [8, -3]]) {
    const a = field.grid(cx, cz), b = field.grid(cx + 1, cz), c = field.grid(cx, cz + 1), N = CELLS + 1;
    for (let k = 0; k <= CELLS; k++) {
      assert.equal(a.heights[k * N + CELLS], b.heights[k * N], `x border ${cx},${cz} row ${k}`);
      assert.equal(a.heights[CELLS * N + k], c.heights[k], `z border ${cx},${cz} col ${k}`);
    }
  }
  for (let i = 0; i < 40; i++) assert.ok(Number.isFinite(field.heightAt(-900 + i * 55, -1400 + i * 50)));
});

test('no water by accident in the open, but the lake is a lake', () => {
  let dry = 0, total = 0;
  for (let i = 0; i < 1500; i++) {
    const x = -400 + (i % 50) * 30, z = -300 + Math.floor(i / 50) * 20, w = biomeWeights(x, z);
    if (w.marsh > .1 || w.highland > .1) continue;
    total++; if (field.heightAt(x, z) > WATER_LEVEL + .2) dry++;
  }
  assert.ok(dry / total > .93, `${(100 * dry / total).toFixed(1)}% dry`);
  assert.ok(field.heightAt(575, 450) < WATER_LEVEL - 3, 'Grausee');
});

test('sites stay level and roads stay walkable', () => {
  for (const [id, s] of Object.entries(SITES)) {
    if (s.mode === 'burrow' || id === 'jetty' || id === 'wayshrine') continue;
    const c = field.heightAt(s.x, s.z);
    for (const [dx, dz] of [[6, 0], [-6, 0], [0, 6], [0, -6]]) assert.ok(Math.abs(field.heightAt(s.x + dx, s.z + dz) - c) < 1.2, `${id} is not level`);
  }
  for (const road of ROADS) {
    if (road.id === 'castle_ramp') continue;
    for (let i = 1; i < road.points.length; i++) {
      const [ax, az] = road.points[i - 1], [bx, bz] = road.points[i], len = Math.hypot(bx - ax, bz - az);
      for (let d = 0; d < len; d += 4) {
        const t = d / len, t2 = Math.min(1, (d + 4) / len), x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        const grade = Math.abs(field.heightAt(ax + (bx - ax) * t2, az + (bz - az) * t2) - field.heightAt(x, z)) / 4;
        assert.ok(grade < .75, `${road.id} is too steep at ${x.toFixed(0)},${z.toFixed(0)}: ${grade.toFixed(2)}`);
      }
    }
  }
});

test('steep ground gets rock detail, gentle ground gets none', () => {
  assert.equal(crags(10, 10, 20, .2), 0);
  assert.ok(Math.abs(crags(10, 10, 20, 1.6)) > 0 || Math.abs(crags(14, 12, 20, 1.6)) > 0);
});

test('regions colour ground and stone of their own; open country is untouched', () => {
  assert.deepEqual(groundLook(open).stone, [1, 1, 1]);
  const mesa = groundLook({ ...open, badlands: 1 });
  assert.ok(mesa.stone[0] > mesa.stone[2] * 2, 'red stone');
  const ash = groundLook({ ...open, volcanic: 1 });
  assert.ok(ash.stone.every(v => v < .5), 'black stone');
  const s = field.surface(ZONES.badlands.x, ZONES.badlands.z, 40, .3);
  assert.equal(s.rock.length, 3); assert.equal(s.tint.length, 3);
  assert.ok(s.rock[0] > 1.1, 'the terrain carries the same red');
});

test('a chunk of terrain is cheap to build', () => {
  const t0 = performance.now();
  for (let k = 0; k < 8; k++) field.grid(-5 - k, 3);
  const per = (performance.now() - t0) / 8;
  assert.ok(per < 60, `${per.toFixed(1)} ms per chunk grid`);
});

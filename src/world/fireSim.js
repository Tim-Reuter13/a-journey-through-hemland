// The rules of wildfire, without graphics, so node tests can run them (visuals: systems/wildfire.js).
// The world is read lazily in 2 m cells: grass and litter burn quickly and spread to their neighbours,
// faster downwind and uphill, slower on damp ground; snow barely burns (and melts); water never does.
// Every fire carries an `energy`: a fireball starts with 2, each generation of spread passes on one less and a fire
// with 1 burns but spreads no further — so one spell scorches a few metres of meadow, not the world.
// Trees are their own things: they catch from burning ground beside them or from a burning neighbour's heat
// and flying brands, burn up from the foot to the crown, smoulder and stand black.
export const CELL = 2;
export const STEP = .45;                // seconds between a fire's spreading attempts
export const MAX_ACTIVE = 160;          // cells burning at once; a bigger blaze simply stops growing
const BASE = { grass: .058, litter: .075, snow: .005, tree: .08 };
const DURATION = { grass: [5, 10], litter: [7, 13], snow: [1.5, 3], tree: [6, 10] };
/**
 * A tree's own clock, in seconds. A tree burns for minutes, not seconds: the fire creeps out from where it
 * started (the foot after a grass fire, the crown after a flying brand, a side after a neighbour's heat),
 * takes a second ignition point in the crown a while later, consumes the foliage patch by patch, then
 * smoulders. `climb` is how long the front needs to cover the whole tree.
 */
export function treeClock(height, random = Math.random) {
  const climb = (38 + height * 5) * (.8 + random() * .5);
  return { climb, burnEnd: climb * 2.2, end: climb * 4.2 };
}
export const TREE = { minClimb: 38 };

export function createFireSim({ fuelAt, canopiesNear = () => [], heightAt = () => 0, random = Math.random, wind = { x: .8, z: .25, speed: .6 }, onCell = () => {}, onTree = () => {}, onBrand = () => {}, onSteam = () => {} } = {}) {
  const cells = new Map(), trees = new Map(), active = [];
  const key = (cx, cz) => cx * 65536 + cz;
  const centre = c => (c + .5) * CELL;
  let fresh = 0;                         // cells read from the world this step (each costs height and ground lookups)
  function cellAt(cx, cz, create = true) {
    const k = key(cx, cz);
    let c = cells.get(k);
    if (c || !create) return c || null;
    if (fresh >= 60) return null;        // a runaway front is read in instalments, so a step never takes long
    fresh++;
    const x = centre(cx), z = centre(cz), f = fuelAt(x, z) || { kind: 'none', fuel: 0, wet: 0 };
    c = { cx, cz, x, z, kind: f.kind, fuel: f.fuel, wet: f.wet || 0, state: 0, t: 0, dur: 0, acc: random() * STEP, scorch: 0, heat: 0, trees: null };
    cells.set(k, c);
    return c;
  }
  const burnable = c => c.state === 0 && c.kind !== 'none' && c.kind !== 'water' && c.fuel > .05;
  function lightCell(c, power = 1, energy = 1) {
    if (!burnable(c) || active.length >= MAX_ACTIVE) { if (c.kind === 'water' && c.state === 0) onSteam(c.x, c.z, 1); return false; }
    c.state = 1; c.t = 0; c.energy = energy;
    const [lo, hi] = DURATION[c.kind] || DURATION.grass;
    c.dur = (lo + random() * (hi - lo)) * (.6 + c.fuel * .5) * (.8 + power * .2);
    active.push(c); onCell(c, 'ignite');
    return true;
  }
  /** Fire at a point: every cell within `radius` metres catches (power 0..1 scales how readily). */
  function ignite(x, z, { power = 1, radius = 1.5, energy = Math.max(1, Math.round(power * 2)) } = {}) {
    let lit = 0;
    const r = Math.ceil(radius / CELL);
    fresh = 0;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const cx = Math.floor(x / CELL) + dx, cz = Math.floor(z / CELL) + dz, c = cellAt(cx, cz);
      if (!c) continue;
      const d = Math.hypot(centre(cx) - x, centre(cz) - z);
      if (d > radius + CELL * .5 || random() > Math.min(1, power * 1.4 - d / Math.max(radius, 1) * .4)) continue;
      if (lightCell(c, power, energy)) lit++;
    }
    // A fire lit right at a tree's foot starts it too.
    for (const canopy of canopiesNear(x, z, 4)) heatTree(canopy, 2.2 * power, 1, 'ground', energy + 1);
    return lit;
  }
  function treeFor(canopy) {
    const id = `${Math.round(canopy.x * 4)},${Math.round(canopy.z * 4)}`;
    let t = trees.get(id);
    if (!t) {
      const base = heightAt(canopy.x, canopy.z), f = fuelAt(canopy.x, canopy.z), height = Math.max(2, canopy.top - base);
      t = { id, x: canopy.x, z: canopy.z, base, height, radius: Math.max(1.2, canopy.radius), heat: 0, state: 0, t: 0, progress: 0, age: 0, kind: canopy.kind, resist: f?.kind === 'snow' ? 3 : canopy.kind === 'autumn' ? .8 : 1, brand: 2 + random() * 4, written: -1,
        ...treeClock(height, random), o1: .02, o2: .6, d2: .3, seed: random() };
      trees.set(id, t);
    }
    return t;
  }
  /** Where a tree's fire starts depends on how it caught: the foot, the crown or a side. */
  function origins(t, cause) {
    if (cause === 'brand') { t.o1 = .6 + random() * .35; t.o2 = .05; t.d2 = .3 + random() * .2; }
    else if (cause === 'neighbor') { t.o1 = .2 + random() * .55; t.o2 = random() < .5 ? .78 + random() * .18 : .04; t.d2 = .2 + random() * .3; }
    else { t.o1 = .02; t.o2 = .45 + random() * .45; t.d2 = .22 + random() * .35; }
  }
  function heatTree(canopy, amount, dt, cause = 'ground', energy = 2) {
    const t = treeFor(canopy);
    if (t.state !== 0) return t;
    t.heat += amount * dt / t.resist;
    if (t.heat >= 2) { t.state = 1; t.t = 0; t.energy = energy; origins(t, cause); onTree(t, 'ignite'); }
    return t;
  }
  /** A glowing brand lands in a crown: the tree catches high up and burns downwards. */
  function brandHit(canopy, energy = 2) { return heatTree(canopy, 4, 1, 'brand', energy); }
  function spreadFrom(c) {
    const wl = Math.hypot(wind.x, wind.z) || 1, wx = wind.x / wl, wz = wind.z / wl, h0 = c.h ??= heightAt(c.x, c.z), passOn = c.energy - 1;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (!dx && !dz) continue;
      const dist = Math.hypot(dx, dz), ux = dx / dist, uz = dz / dist, align = ux * wx + uz * wz;
      // Neighbours at 1 cell always; at 2 cells only downwind (the fast front).
      if (dist > 1.5 && align < .55) continue;
      const n = cellAt(c.cx + dx, c.cz + dz);
      if (!n || !burnable(n)) continue;
      const rise = ((n.h ??= heightAt(n.x, n.z)) - h0) / (dist * CELL);
      const chance = BASE[n.kind] * (c.kind === 'snow' ? .3 : 1) * (1 + wind.speed * 1.7 * Math.max(0, align) - .5 * Math.max(0, -align)) * (1 + Math.max(-.4, Math.min(1.2, rise * 1.6)))
        * (1 - n.wet * .85) * (dist > 1.5 ? .35 : 1 / dist) * (.5 + n.fuel * .5);
      if (passOn > 0 && random() < chance) lightCell(n, 1, passOn);
    }
    // Burning ground heats the trees standing in it.
    for (const canopy of canopiesNear(c.x, c.z, 4.5)) {
      const d = Math.hypot(canopy.x - c.x, canopy.z - c.z);
      if (d < canopy.radius * .7 + 1.9) heatTree(canopy, (c.kind === 'litter' ? 1.1 : .9) * (1 + wind.speed * .5), STEP, 'ground', c.energy + 1);
    }
  }
  function stepTree(t, dt) {
    if (t.state === 0) { t.heat = Math.max(0, t.heat - dt * .3); return; }
    if (t.state === 3) return;
    t.t += dt;
    // The front creeps: it covers the whole tree only after `climb` seconds. The foliage is lost patch by patch
    // while the front passes and afterwards, the trunk and limbs smoulder for minutes.
    t.progress = Math.min(1, t.t / t.climb);
    t.age = Math.max(0, Math.min(1, (t.t - t.climb * .35) / (t.end - t.climb * .35)));
    if (t.state === 1 && t.t > t.burnEnd) { t.state = 2; onTree(t, 'smoulder'); }
    if (t.t > t.end) { t.state = 3; t.progress = 1; t.age = 1; onTree(t, 'burnt'); return; }
    // A burning tree heats its neighbours, most of all downwind, and now and then throws a brand.
    if (t.progress > .25 && t.state === 1 && t.energy > 1) {
      t.brand -= dt * (.5 + wind.speed);
      if (t.brand <= 0) { t.brand = 4 + random() * 5; onBrand(t); }
      t.warm = (t.warm || 0) + dt;
      if (t.warm >= STEP) {
        t.warm -= STEP;
        const wl = Math.hypot(wind.x, wind.z) || 1;
        for (const other of canopiesNear(t.x, t.z, 9)) {
          const d = Math.hypot(other.x - t.x, other.z - t.z);
          if (d < .5) continue;
          const align = ((other.x - t.x) * wind.x + (other.z - t.z) * wind.z) / (d * wl);
          heatTree(other, (.5 + t.progress * .5) * 2.6 / (1 + d * d * .09) * (1 + wind.speed * 1.3 * Math.max(0, align)) * (align < -.3 ? .5 : 1), STEP, 'neighbor', t.energy - 1);
        }
        // Burning litter falls beneath the crown, now and then.
        { const drop = random() < .3 && cellAt(Math.floor((t.x + (random() - .5) * t.radius * 1.6) / CELL), Math.floor((t.z + (random() - .5) * t.radius * 1.6) / CELL)); if (drop) lightCell(drop, .8, Math.max(1, t.energy - 1)); }
      }
    }
    if (Math.abs(t.progress - t.written) > .004 || Math.abs(t.age - (t.writtenAge ?? -1)) > .004) { t.written = t.progress; t.writtenAge = t.age; onTree(t, 'progress'); }
  }
  let acc = 0;
  /** Advances the fire by dt seconds (call every frame; it works in .1 s steps). */
  function step(dt) {
    acc += Math.min(dt, .5);
    while (acc >= .1) {
      acc -= .1; fresh = 0;
      for (let i = active.length - 1; i >= 0; i--) {
        const c = active[i];
        c.t += .1; c.acc += .1;
        if (c.acc >= STEP) { c.acc -= STEP; spreadFrom(c); }
        if (c.t >= c.dur) {
          c.state = 2; active.splice(i, 1); c.scorch = c.kind === 'snow' ? .35 : 1; onCell(c, 'out');
        } else onCell(c, 'burn');
      }
      for (const t of trees.values()) stepTree(t, .1);
    }
  }
  /** Water on fire: cells and trees within r are put out (a steaming scorch is left). */
  function extinguish(x, z, r = 2) {
    let out = 0;
    for (let i = active.length - 1; i >= 0; i--) {
      const c = active[i];
      if (Math.hypot(c.x - x, c.z - z) > r + CELL * .5) continue;
      c.state = 2; c.scorch = .7; active.splice(i, 1); onCell(c, 'doused'); onSteam(c.x, c.z, 3); out++;
    }
    for (const t of trees.values()) if (t.state === 1 && Math.hypot(t.x - x, t.z - z) < r + t.radius) { t.state = 2; t.t = Math.max(t.t, t.burnEnd); out++; onTree(t, 'smoulder'); }
    return out;
  }
  /** How hot the ground is at a point, 0..1 (for burning whoever stands there). */
  function heatAt(x, z) {
    const c = cells.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    let h = c && c.state === 1 ? (c.kind === 'snow' ? .3 : .85) : 0;
    for (const canopy of canopiesNear(x, z, 3)) { const t = trees.get(`${Math.round(canopy.x * 4)},${Math.round(canopy.z * 4)}`); if (t && t.state === 1 && Math.hypot(t.x - x, t.z - z) < t.radius * .8) h = Math.max(h, .95); }
    return h;
  }
  function reset() { cells.clear(); trees.clear(); active.length = 0; acc = 0; }
  return { ignite, extinguish, step, heatAt, reset, brandHit, cells, trees, active, cellAt, wind, state: () => ({ cells: cells.size, burning: active.length, trees: trees.size, treesBurning: [...trees.values()].filter(t => t.state === 1).length, treesBurnt: [...trees.values()].filter(t => t.state >= 2).length }) };
}

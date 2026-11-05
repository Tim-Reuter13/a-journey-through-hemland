// Pure maths for the blood system (systems/blood.js): the pixel fluid on the ground, the colours of fresh and
// dried blood, and the UV frame that turns "down" or "along the blade" into pixel steps on a character's atlas.
// No three.js here, so node tests can run it.

export const TILE = 32;            // cells per side of one ground tile
export const CELL = 1 / 16;        // metres per cell: one ground texel
export const FILM = .3;            // thinnest layer that still flows (surface tension holds the rest in place)
const K = .04;                     // metres of depth per unit of blood
const SLOPE = 2.6;                 // the ground's tilt counts this much more than in metres: blood visibly runs downhill
const RATE = 14;                   // how fast a level difference drains
const NEIGHBOURS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, .7], [-1, 1, .7], [1, -1, .7], [-1, -1, .7]];

export const cellHash = i => { let h = Math.imul(i + 374761393, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/**
 * One relaxation step of a thin film of blood on uneven ground. Every cell thicker than its (slightly ragged)
 * film threshold hands part of its excess to lower neighbours, in proportion to the drop in surface level.
 * Writes the result into `out`; what leaves the tile is added to `spill` (north, south, west, east edges,
 * TILE values each) for the caller to pass on. Returns the volume that moved, to tell when a pool has settled.
 */
export function flowStep(vol, ground, out, spill) {
  out.set(vol);
  let moved = 0;
  for (let z = 0; z < TILE; z++) for (let x = 0; x < TILE; x++) {
    const i = z * TILE + x, v = vol[i], film = FILM * (.82 + cellHash(i) * .36);
    if (v <= film) continue;
    const level = ground[i] * SLOPE + v * K, weights = [];
    let sum = 0;
    for (let n = 0; n < 8; n++) {
      const nx = x + NEIGHBOURS[n][0], nz = z + NEIGHBOURS[n][1], f = NEIGHBOURS[n][2];
      const outside = nx < 0 || nz < 0 || nx >= TILE || nz >= TILE;
      const other = outside ? ground[i] * SLOPE : ground[nz * TILE + nx] * SLOPE + vol[nz * TILE + nx] * K;
      const w = Math.max(0, level - other) * f;
      weights.push(w); sum += w;
    }
    if (sum < 1e-6) continue;
    const give = Math.min((v - film) * .45, sum * RATE);
    for (let n = 0; n < 8; n++) {
      if (weights[n] <= 0) continue;
      const part = give * weights[n] / sum, nx = x + NEIGHBOURS[n][0], nz = z + NEIGHBOURS[n][1];
      out[i] -= part; moved += part;
      if (nx < 0 || nz < 0 || nx >= TILE || nz >= TILE) {
        // Diagonal exits leave through the edge they cross first.
        if (nz < 0) spill[0 * TILE + Math.min(TILE - 1, Math.max(0, nx))] += part;
        else if (nz >= TILE) spill[1 * TILE + Math.min(TILE - 1, Math.max(0, nx))] += part;
        else if (nx < 0) spill[2 * TILE + nz] += part;
        else spill[3 * TILE + nz] += part;
      } else out[nz * TILE + nx] += part;
    }
  }
  return moved;
}

/** Soaks blood into the ground: thin film first, thick pools slowly. */
export function absorb(vol, rate, dt) {
  const drop = rate * dt;
  for (let i = 0; i < vol.length; i++) {
    const v = vol[i];
    if (v <= 0) continue;
    const next = v - drop * (v < FILM * 1.4 ? 1.3 : .3);
    vol[i] = next < .06 ? 0 : next;
  }
}

// ── Colours (0-255). `fresh` is 1 for blood a moment old and sinks to 0 as it dries and darkens.
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const FRESH = [174, 16, 28], WET = [128, 11, 22], DRY = [78, 12, 16], CLOT = [46, 8, 11], SHINE = [222, 62, 68];

/**
 * Colour of one ground cell, or null where there is no blood. Pixel-art rules: no soft alpha, a darker
 * rim where the pool ends, a few stepped glints while it is wet, a dithered edge where the film is thin.
 */
export function poolPixel(v, age, rim, x, z) {
  if (v < .1) return null;
  if (((x + z) & 1) && v < FILM * .55) return null; // a thin fringe is dithered, the body of a pool is solid
  const fresh = Math.max(0, 1 - age / 70), step = Math.round(fresh * 3) / 3;
  let c = mix(CLOT, step > .5 ? mix(WET, FRESH, (step - .5) * 2) : mix(DRY, WET, step * 2), Math.min(1, .35 + v * .5));
  if (v > 1.6) c = mix(c, CLOT, Math.min(.5, (v - 1.6) * .12)); // deep blood is nearly black
  if (rim) c = mix(c, CLOT, .55);
  else if (step > .6 && v > 1 && (x * 7 + z * 13) % 11 === 0) c = SHINE; // a wet glint
  return [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])];
}

// ── Characters. Per atlas pixel the blood layer keeps: r = wetness, g = kind | core flag, a = thickness.
export const KIND = { skin: 0, cloth: 1, metal: 2, scratch: 3 };
export const CORE = 16;

/** Colour of blood on a character's atlas pixel, or null (no blood / dithered away). `base` is the pixel beneath. */
export function bodyPixel(wet, kindBits, thick, x, y, base) {
  const kind = kindBits & 15, core = (kindBits & CORE) !== 0;
  if (kind === KIND.scratch) {
    // A nick in armour: the metal underneath shows bright.
    if (thick < 40) return null;
    return [Math.min(255, base[0] * 1.45 + 36), Math.min(255, base[1] * 1.45 + 36), Math.min(255, base[2] * 1.4 + 38)];
  }
  if (thick < 36) return null;
  if (thick < 110 && ((x + y) & 1)) return null;
  const level = wet >> 6; // 3 fresh .. 0 dry
  const palette = kind === KIND.cloth ? [[36, 8, 12], [54, 10, 15], [84, 12, 20], [106, 14, 24]]
    : kind === KIND.metal ? [[46, 10, 14], [88, 12, 20], [150, 16, 28], [190, 28, 42]]
      : [[56, 9, 13], [94, 10, 18], [138, 14, 24], [172, 18, 30]];
  let c = palette[level];
  if (core) c = [c[0] * .55, c[1] * .55, c[2] * .55];
  else if (level === 3 && thick > 200 && kind !== KIND.cloth && (x * 7 + y * 13) % 9 === 0) c = [226, 70, 76];
  return [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])];
}

/**
 * Directions on a triangle's texture: given the three corners (any space) and their pixel UVs, how a world
 * vector moves across the texture. Returns { tu, tv } (world vectors along which u / v grow, per pixel) or null.
 */
export function uvFrame(p0, p1, p2, t0, t1, t2) {
  const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
  const d1u = t1[0] - t0[0], d1v = t1[1] - t0[1], d2u = t2[0] - t0[0], d2v = t2[1] - t0[1];
  const det = d1u * d2v - d2u * d1v;
  if (Math.abs(det) < 1e-9) return null;
  const tu = [0, 1, 2].map(k => (e1[k] * d2v - e2[k] * d1v) / det), tv = [0, 1, 2].map(k => (e2[k] * d1u - e1[k] * d2u) / det);
  return { tu, tv };
}

/** A world vector as a step across the texture, in pixels: [du, dv]. */
export function pixelStep(frame, w) {
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const uu = dot(frame.tu, frame.tu), vv = dot(frame.tv, frame.tv);
  return [uu > 1e-12 ? dot(w, frame.tu) / uu : 0, vv > 1e-12 ? dot(w, frame.tv) / vv : 0];
}

/** Pixels on a line from (x0, y0) to (x1, y1), Bresenham. */
export function linePixels(x0, y0, x1, y1) {
  const out = [];
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy, x = x0, y = y0;
  for (let guard = 0; guard < 256; guard++) {
    out.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  return out;
}

/** Where a hit lands on the body: bleeding behaviour per region (bone name). */
export const REGIONS = {
  head: { name: 'head', severity: 1.5, bleed: 'heavy', after: 28 },
  neck: { name: 'neck', severity: 2.2, bleed: 'artery', after: 45 },
  chest: { name: 'chest', severity: 1.15, bleed: 'heavy', after: 36 },
  torso: { name: 'torso', severity: 1, bleed: 'heavy', after: 32 },
  hips: { name: 'hips', severity: .9, bleed: 'heavy', after: 28 },
  arm: { name: 'arm', severity: .6, bleed: 'light', after: 14 },
  hand: { name: 'hand', severity: .4, bleed: 'light', after: 10 },
  leg: { name: 'leg', severity: .8, bleed: 'light', after: 20 },
  foot: { name: 'foot', severity: .4, bleed: 'light', after: 10 },
};
export function regionOf(boneName) {
  const b = boneName.replace(':mesh', '');
  if (b === 'head' || b === 'neck' || b === 'chest' || b === 'torso' || b === 'hips') return REGIONS[b];
  if (b.startsWith('arm_')) return REGIONS.arm;
  if (b.startsWith('hand_')) return REGIONS.hand;
  if (b.startsWith('leg_')) return REGIONS.leg;
  if (b.startsWith('foot_')) return REGIONS.foot;
  return REGIONS.torso;
}

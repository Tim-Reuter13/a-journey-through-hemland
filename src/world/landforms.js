// Landforms of Hemland: the shapes behind the heightfield. Pure functions of (x, z), no three.js, so node tests can run them.
//
// Ideas taken from Tectonic and Biomes O' Plenty, rebuilt for a 2-unit heightfield:
//  · gradient noise folded into ridges and warped by other noise ("noise shift"), so ranges run in lines with passes and
//    valleys between them instead of lying in round blobs;
//  · regions that each own one kind of landform: stepped mesas and canyons (Tectonic's spade tiers and badlands ridges),
//    wind-drawn dunes (the diamond region), rolling moors with bogs (BoP's moor and highland), sheer pillars standing
//    in green lowland (Tectonic's jungle pillars, BoP's jade cliffs), a volcano with a crater (BoP's volcano);
//  · broad swells and belts of hills everywhere else, so the ground is never a plane.
// Everything is smooth and cheap: a chunk of 65x65 vertices asks for it once and the heightfield caches the result.

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
export const ss = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const smax = (a, b, k) => { const h = clamp01(.5 + .5 * (a - b) / k); return lerp(b, a, h) + k * h * (1 - h); };

// ── Gradient noise (about -1..1) with eight gradient directions; fbm turns the plane a little each octave so the grid never shows.
const GX = new Float32Array([1, -1, 0, 0, .7071, -.7071, .7071, -.7071]);
const GZ = new Float32Array([0, 0, 1, -1, .7071, .7071, -.7071, -.7071]);
export function hashi(ix, iz, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
const unit = (ix, iz, seed) => hashi(ix, iz, seed) / 4294967296;
export function pn(x, z, seed = 0) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const g00 = hashi(ix, iz, seed) & 7, g10 = hashi(ix + 1, iz, seed) & 7, g01 = hashi(ix, iz + 1, seed) & 7, g11 = hashi(ix + 1, iz + 1, seed) & 7;
  const n00 = GX[g00] * fx + GZ[g00] * fz, n10 = GX[g10] * (fx - 1) + GZ[g10] * fz, n01 = GX[g01] * fx + GZ[g01] * (fz - 1), n11 = GX[g11] * (fx - 1) + GZ[g11] * (fz - 1);
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const a = n00 + (n10 - n00) * u, b = n01 + (n11 - n01) * u;
  return (a + (b - a) * v) * 1.4142;
}
export function fbm2(x, z, octaves = 4, seed = 0) {
  let sum = 0, amp = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += pn(x, z, seed + i * 31) * amp; norm += amp; amp *= .5;
    const nx = x * 1.6 - z * 1.2, nz = x * 1.2 + z * 1.6; x = nx; z = nz;
  }
  return sum / norm;
}
/** Ridged multifractal, about 0..1: sharp crests where the noise crosses zero, each octave leaning on the one before. */
export function ridged(x, z, octaves = 4, seed = 0, soft = 0) {
  let sum = 0, amp = .5, norm = 0, prev = 1;
  for (let i = 0; i < octaves; i++) {
    // `soft` rounds the crease along each crest: 0 for the knife edges of mountains, about .03 for hills you can walk over.
    const p = pn(x, z, seed + i * 37);
    let n = 1 - (soft ? Math.sqrt(p * p + soft) : Math.abs(p)); n *= n;
    sum += n * amp * (i ? Math.min(1, prev * 1.6) : 1); norm += amp; prev = n; amp *= .46;
    const nx = x * 1.6 - z * 1.2, nz = x * 1.2 + z * 1.6; x = nx; z = nz;
  }
  return sum / norm;
}
/** Steps: flat treads with short risers, `edge` being the share of each step that is riser (smaller is sheerer). */
export const terrace = (v, step, edge) => { const t = v / step, f = t - Math.floor(t); return (Math.floor(t) + ss(1 - edge, 1, f)) * step; };

// ── Regions. Each owns a landform; borders are ragged (the radius is bent by noise), weights fall off over the outer half.
export const ZONES = {
  badlands: { x: -600, z: 400, r: 340 },   // Rotfelsen: stepped mesas and deep canyons, red rock
  dunes: { x: -120, z: 770, r: 310 },      // Sandmark: wind-drawn dunes in the south-west
  volcanic: { x: 1180, z: 470, r: 310 },   // Aschenkrone: a volcano with a crater in the south-east
  highland: { x: -540, z: -830, r: 400 },  // Heidemoor: rolling moor, tors and bog pools in the north-west
  pillars: { x: 1300, z: -300, r: 290 },   // Jadegrat: sheer stone pillars over green lowland in the east
};
const ZONE_LIST = Object.entries(ZONES).map(([id, z], i) => ({ id, ...z, seed: 100 + i * 7 }));
export const ZONE_IDS = ZONE_LIST.map(z => z.id);
/** Weight of each region at a point (0..1). Writes into `out` when given (hot paths), else a fresh object. */
export function zoneWeights(x, z, out = {}) {
  for (const s of ZONE_LIST) {
    const dx = x - s.x, dz = z - s.z;
    if (dx > s.r * 1.5 || dx < -s.r * 1.5 || dz > s.r * 1.5 || dz < -s.r * 1.5) { out[s.id] = 0; continue; }
    const wx = pn(x * .0042, z * .0042, s.seed), wz = pn(x * .0042 + 9, z * .0042 - 4, s.seed + 1);
    const d = Math.hypot(dx + wx * s.r * .34, dz + wz * s.r * .34) / s.r;
    out[s.id] = d >= 1 ? 0 : ss(1, .5, d);
  }
  return out;
}

// ── Open country: broad swells, belts of hills with long valleys between, small lumps. Metres-ish of height: about -25..+45.
export function relief(x, z) {
  const swell = pn(x * .0014, z * .0014, 11) * 22 + pn(x * .0034 + 4, z * .0034, 12) * 11;
  const belt = ss(-.3, .28, pn(x * .0022 + 30, z * .0022 - 7, 13));
  let hills = (ridged(x * .0046, z * .0046, 4, 14, .035) - .4) * 128;
  // Cuestas: on some belts the hillsides break into bands of cliff with flat treads between.
  hills = lerp(hills, terrace(hills, 13, .2), ss(.0, .45, pn(x * .0031 + 90, z * .0031, 19)) * .85);
  const knolls = ss(.12, .58, pn(x * .0075 + 50, z * .0075, 18)) * 16;    // isolated rounded rises
  return swell + hills * belt + knolls + pn(x * .02, z * .02, 15) * 2.4;
}

/** Narrow, steep-sided ravines cut through the belts of hills (0..1 where the cut is deepest), bent by a second noise. */
export function ravines(x, z) {
  const wx = x + pn(x * .004, z * .004, 22) * 55, wz = z + pn(x * .004 + 5, z * .004, 23) * 55;
  return ss(.1, 0, Math.abs(pn(wx * .0062, wz * .0062, 24))) * ss(-.05, .35, pn(x * .0022 + 30, z * .0022 - 7, 13));
}
/**
 * Rock detail on steep ground, added to the 2-unit grid once its slope is known: ribs and gullies running down a face,
 * and faint ledges. Nothing on gentle ground, so meadows, roads and sites stay as they are.
 */
export function crags(x, z, h, slope) {
  const s = ss(.55, 1.5, slope);
  if (s <= 0) return 0;
  const rib = pn(x * .085, z * .085, 201) * 1.6 + pn(x * .19, z * .19 + 7, 202) * .75;
  const ledge = (terrace(h, 8, .35) - h) * .35 * ss(2.4, 1.3, slope);
  return (rib + ledge) * s;
}

// ── Mountains: a ring round the region that varies in depth, the Nordkamm in the north, ridges bent by a second noise.
/** Share of mountain at a point (0..1): the ring (thick here, thin there) or the northern range, less where a region has its own wall. */
export function alpine(x, z, edge, zw) {
  const north = ss(-940, -1400, z);
  const depth = 150 + 170 * ss(-.35, .55, pn(x * .0031 + 17, z * .0031, 21));
  const own = Math.min(.94, zw.volcanic * .95 + zw.badlands * .85 + zw.dunes * .9 + zw.pillars * .55);
  return Math.max(ss(depth, depth * .22, edge), north) * (1 - own);
}
/** Height of the ranges for a mountain share `a`: crests in warped lines, passes between them, massifs and lesser ridges. */
export function mountains(x, z, a) {
  if (a < .004) return 0;
  const wx = x + pn(x * .0019, z * .0019, 31) * 150, wz = z + pn(x * .0019 + 8, z * .0019, 32) * 150;
  const r = ridged(wx * .0052, wz * .0052, 5, 33), massif = .5 + .5 * pn(x * .0017 + 2, z * .0017, 34);
  return Math.pow(a, 1.45) * (26 + r * 135 + massif * 55);
}
/** The sheer wall at the very edge of the map that keeps everyone in (and a rim of crags on it). */
export function edgeWall(x, z, edge) {
  if (edge > 130) return 0;
  return ss(130, 70, edge) * (48 + ridged(x * .006 + 11, z * .006, 3, 35) * 26);
}

// ── Rotfelsen: mesas whose sides step down in ledges, cut by narrow winding canyons with flat floors.
export function badlands(x, z) {
  const wx = x + pn(x * .005, z * .005, 41) * 60, wz = z + pn(x * .005 + 3, z * .005, 42) * 60;
  const plateau = 26 + (pn(x * .0032, z * .0032, 43) * .5 + .5) * 58 + ridged(wx * .009, wz * .009, 3, 44) * 18;
  const gorge = ss(.17, .02, Math.abs(pn(wx * .0058, wz * .0058, 45)));
  const floor = 3 + pn(x * .02, z * .02, 47) * 1.4;
  let v = smax(plateau - gorge * 82 + pn(x * .045, z * .045, 46) * 1.2, floor, 8);
  return terrace(v, 13, .15) - 2;
}
// ── Sandmark: dunes with a gentle windward side and a steep slip face, bent by noise, riding on broad sand hills.
export function dunes(x, z) {
  const wx = x + pn(x * .006, z * .006, 71) * 64, wz = z + pn(x * .006 + 9, z * .006, 72) * 64;
  const phase = (wx * .9 + wz * .43) * .0125, f = phase - Math.floor(phase);
  const prof = f < .68 ? f / .68 : (1 - f) / .32, shaped = prof * prof * (3 - 2 * prof) * (.7 + .3 * prof);
  const amp = 9 + 17 * (.5 + .5 * pn(x * .004, z * .004, 73)), big = (.5 + .5 * pn(x * .0018 + 5, z * .0018, 74)) * 34;
  const small = pn(x * .09 + wz * .02, z * .09, 75) * .45;
  // Mega-dunes: long ridges four times the size of the small ones, which the small ones ride on.
  const p2 = (wx * .8 + wz * .6) * .0042, f2 = p2 - Math.floor(p2), q = f2 < .7 ? f2 / .7 : (1 - f2) / .3;
  const mega = q * q * (3 - 2 * q) * 22 * (.55 + .45 * pn(x * .003, z * .003, 76));
  return 5 + big + mega + shaped * amp + small;
}
// ── Aschenkrone: a cone with ragged flanks, lava gullies running down it and a crater bowl at the top.
export const VOLCANO = { H: 128, rim: .17 };
export function volcano(x, z) {
  const c = ZONES.volcanic, dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
  const wob = 1 + .16 * pn(Math.cos(a) * 1.7 + 7, Math.sin(a) * 1.7, 81) + .07 * pn(Math.cos(a) * 4.1, Math.sin(a) * 4.1 + 3, 82);
  const R = c.r * .82 * wob, r = d / R;
  const ash = 8 + pn(x * .012, z * .012, 83) * 5 + pn(x * .05, z * .05, 84) * 1.2;
  if (r >= 1.25) return ash;
  const gully = 1 + (.15 * Math.sin(a * 11 + pn(d * .03, a * 2, 85) * 3.5) + .07 * Math.sin(a * 26 + pn(d * .05, a * 3, 88) * 4)) * ss(.12, .4, r) * (1 - ss(.75, 1, r));
  const flank = Math.pow(Math.max(0, 1 - r), 1.7) * VOLCANO.H * gully;
  const rimH = Math.pow(1 - VOLCANO.rim, 1.7) * VOLCANO.H;
  let h = r < VOLCANO.rim ? rimH + (VOLCANO.rim - r) * 20 : flank;
  // The bowl: floor well under the rim, with a lip of heaped ash on the edge.
  if (r < VOLCANO.rim * 1.05) h = lerp(rimH - VOLCANO.H * .22 + pn(x * .08, z * .08, 86) * 1.5, rimH + 3, ss(VOLCANO.rim * .4, VOLCANO.rim * 1.02, r));
  return Math.max(ash, h) + pn(x * .03, z * .03, 87) * 1.6 * ss(1.2, .6, r);
}
// Granite tors: rounded knobs of bare stone, one to a jittered cell, steep-sided. They are part of the ground; the terrain
// shader turns their flanks to rock, so they grow out of the moor instead of standing on it.
function graniteTors(x, z) {
  const cell = 64, ix = Math.floor(x / cell), iz = Math.floor(z / cell);
  let best = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cz = iz + j;
    if (unit(cx, cz, 61) > .45) continue;
    const px = (cx + .15 + .7 * unit(cx, cz, 62)) * cell, pz = (cz + .15 + .7 * unit(cx, cz, 63)) * cell, R = 6 + 10 * unit(cx, cz, 64), H = 5 + 12 * unit(cx, cz, 65);
    const ax = x - px, az = z - pz, dist = Math.hypot(ax, az) || 1;
    const d = dist / (R * (1 + .24 * pn(ax / dist * 2.6 + px * .02, az / dist * 2.6 + pz * .02, 66)));
    if (d < 1.2) best = Math.max(best, H * (ss(1.05, .4, d) * .88 + ss(.6, 0, d) * .12));
  }
  return best;
}
// ── Heidemoor: round moor hills with rocky crests, boggy hollows that hold water.
export function highland(x, z, waterLevel) {
  const hills = pn(x * .0046, z * .0046, 91) * .5 + .5, tors = ridged(x * .0068, z * .0068, 3, 92, .04);
  // Hollows: the moor sinks gently towards a wet floor, and only the lowest of it holds a pool, so a bog is a shallow dish, not a pit.
  const bn = pn(x * .0079 + 3, z * .0079, 94), hollow = ss(-.05, -.5, bn), pool = ss(-.4, -.58, bn);
  let h = 22 + hills * 28 + (tors - .4) * 30 + pn(x * .03, z * .03, 93) * 1.1 + graniteTors(x, z) * (1 - hollow);
  h = lerp(h, waterLevel + 3.5 + pn(x * .05, z * .05, 96) * 1.4, hollow);
  return lerp(h, waterLevel - 2.2 + pn(x * .06, z * .06, 95) * .5, pool);
}
// ── Jadegrat: soft green lowland with sheer towers of stone standing on it (a jittered cell each, merging where they touch).
export function pillars(x, z) {
  const cell = 96, ix = Math.floor(x / cell), iz = Math.floor(z / cell);
  let tower = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cz = iz + j;
    if (unit(cx, cz, 51) > .74) continue;
    const px = (cx + .1 + .8 * unit(cx, cz, 52)) * cell, pz = (cz + .1 + .8 * unit(cx, cz, 53)) * cell, big = unit(cx, cz, 59) > .86 ? 1.7 : 1;
    const R = (10 + 18 * unit(cx, cz, 54) * unit(cx, cz, 60)) * big + 5, H = (30 + 70 * unit(cx, cz, 55)) * (big > 1 ? .8 : 1);
    // The outline is bent by noise of the angle round the tower, so its flanks are ribbed and its section is never round.
    const ax = x - px, az = z - pz, dist = Math.hypot(ax, az) || 1, ca = ax / dist, sa = az / dist;
    const d = dist / (R * (1 + .17 * pn(ca * 2.3 + px * .013, sa * 2.3 + pz * .013, 56) + .09 * pn(ca * 5.6 - pz * .011, sa * 5.6 + px * .011, 57)));
    if (d >= 1.3) continue;
    // A sheer wall, a rounded cap, a skirt of fallen stone at the foot.
    tower = Math.max(tower, H * (ss(1, .78, d) * .94 + ss(1.3, .9, d) * .14) + (d < .78 ? (1 - d / .78) * 6 : 0));
  }
  return 6 + pn(x * .01, z * .01, 57) * 4 + pn(x * .035, z * .035, 58) * 1.6 + tower;
}

// ── Look: the tint a region gives living ground (grass) and stone. Multipliers on the textures, shared by the terrain
// (heightfield.js) and the rocks standing on it (rocks.js), so a red mesa and the boulders at its foot match.
export const LOOK = {
  badlands: { grass: [1.06, .96, .7], stone: [1.1, .86, .7] },
  dunes: { grass: [1.2, 1.08, .7], stone: [1.3, 1.12, .82] },
  volcanic: { grass: [.52, .47, .44], stone: [.42, .4, .42] },
  highland: { grass: [.98, .92, .76], stone: [.95, .93, .92], grassK: .8 },
  pillars: { grass: [.86, 1.06, .86], stone: [.9, 1.0, .9] },
};
/** { grass, stone } tints at biome weights `w` (the old regions' own tints plus the landform regions'). */
export function groundLook(w) {
  const grass = [1 - w.taiga * .1 + w.autumn * .05 + w.plains * .03, 1 - w.autumn * .12 - w.marsh * .08, 1 - w.autumn * .35 - w.plains * .12 + w.taiga * .02], stone = [1, 1, 1];
  for (const id of ZONE_IDS) {
    const k = w[id] || 0;
    if (k <= 0) continue;
    const look = LOOK[id], kg = k * (look.grassK ?? 1);
    for (let c = 0; c < 3; c++) { grass[c] += (look.grass[c] - grass[c]) * kg; stone[c] += (look.stone[c] - stone[c]) * k; }
  }
  return { grass, stone };
}

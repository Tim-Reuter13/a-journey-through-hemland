import { BOUNDS, CHUNK, WATER_LEVEL, SITES, ROADS, RIVERS, LAKES, biomeWeights, kronwachtLevel, kronwachtPaving, castleWardPaving } from './hemland.js';

// The Aschmark heightfield: noise hills shaped by authored features (mountains,
// lake, marsh, river bed, flattened sites, roads). Heights are evaluated once per
// chunk on a 2-unit grid and cached; heightAt() samples the cached triangles
// exactly like the rendered terrain mesh, so feet never float or sink.
export const STEP = 2, CELLS = CHUNK / STEP; // 64 cells, 65 vertices per side
const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

function hash(ix, iz, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x, z, seed = 0) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(hash(ix, iz, seed), hash(ix + 1, iz, seed), u), lerp(hash(ix, iz + 1, seed), hash(ix + 1, iz + 1, seed), u), v) * 2 - 1;
}
export function fbm(x, z, octaves = 4, seed = 0) {
  let sum = 0, amp = 1, norm = 0;
  for (let i = 0; i < octaves; i++) { sum += noise(x, z, seed + i * 17) * amp; norm += amp; amp *= .5; x *= 2.03; z *= 2.03; }
  return sum / norm;
}

// ── Segment buckets for roads and rivers (distance queries stay local).
function polylineSegments(list, kind) {
  const segments = [];
  for (const line of list) {
    let along = 0;
    line.points.forEach((p, i) => {
      if (!i) return;
      const [ax, az] = line.points[i - 1], [bx, bz] = p, length = Math.hypot(bx - ax, bz - az);
      segments.push({ kind, line, ax, az, bx, bz, length, along });
      along += length;
    });
    line.length = along;
  }
  return segments;
}
const BUCKET = 64;
function bucketize(segments, margin) {
  const map = new Map();
  for (const s of segments) {
    const r = (s.line.width || 0) / 2 + margin;
    for (let gx = Math.floor((Math.min(s.ax, s.bx) - r) / BUCKET); gx <= Math.floor((Math.max(s.ax, s.bx) + r) / BUCKET); gx++)
      for (let gz = Math.floor((Math.min(s.az, s.bz) - r) / BUCKET); gz <= Math.floor((Math.max(s.az, s.bz) + r) / BUCKET); gz++) {
        const key = gx * 100000 + gz;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(s);
      }
  }
  return map;
}
function nearest(buckets, x, z) {
  const list = buckets.get(Math.floor(x / BUCKET) * 100000 + Math.floor(z / BUCKET));
  let best = null, bestD = Infinity;
  for (const s of list || []) {
    const dx = s.bx - s.ax, dz = s.bz - s.az, t = Math.min(1, Math.max(0, ((x - s.ax) * dx + (z - s.az) * dz) / (s.length * s.length || 1)));
    const px = s.ax + dx * t, pz = s.az + dz * t, d = Math.hypot(x - px, z - pz);
    if (d < bestD) { bestD = d; best = { segment: s, line: s.line, distance: d, t, x: px, z: pz, along: s.along + s.length * t }; }
  }
  return best;
}

export function createHeightfield() {
  const roadSegments = polylineSegments(ROADS, 'road'), riverSegments = polylineSegments(RIVERS, 'river');
  const roadBuckets = bucketize(roadSegments, 9), riverBuckets = bucketize(riverSegments, 22);
  const siteList = Object.entries(SITES).map(([id, s]) => ({ id, ...s }));

  // Natural terrain before any authored feature.
  function natural(x, z) {
    let h = fbm(x * .0045, z * .0045, 4) * 22 + fbm(x * .018, z * .018, 3, 9) * 5 + 4;
    const peaks = (1 - Math.abs(fbm(x * .006 + 11, z * .006, 4, 31))) ** 2;
    h += ss(-1030, -1360, z) * (46 + peaks * 58);                       // Nordkamm
    const edge = Math.min(x - BOUNDS.minX, BOUNDS.maxX - x, z - BOUNDS.minZ, BOUNDS.maxZ - z);
    h += ss(300, 40, edge) * (38 + peaks * 44);                         // ring of mountains around the region
    h += ss(120, 70, edge) * (48 + peaks * 20);                         // and a cliff wall you cannot climb
    const w = biomeWeights(x, z);
    // Ledges: in some hills the ground breaks into steps a few units high, with rocky faces.
    const ledges = ss(.12, .42, fbm(x * .0035 + 40, z * .0035 - 13, 2, 61)) * (1 - w.plains) * (1 - w.marsh);
    if (ledges > 0) {
      const v = (fbm(x * .013, z * .013, 2, 23) + 1) * 8, t = v / 4, f = t - Math.floor(t);
      h += (Math.floor(t) + ss(.9, .985, f)) * 4 * ledges * .85;
    }
    h = lerp(h, 3 + fbm(x * .01, z * .01, 3, 5) * 4, w.plains * .72);  // Königsfeld lies open and gentle
    const marshD = Math.hypot(x - 300, z - 430);
    h = lerp(h, WATER_LEVEL + .5 + fbm(x * .04, z * .04, 3, 77) * 1.6, ss(250, 110, marshD) * .9);
    for (const lake of LAKES) h = lerp(h, WATER_LEVEL - 7, ss(lake.radius + 45, lake.radius - 25, Math.hypot(x - lake.x, z - lake.z) + fbm(x * .02, z * .02, 2, 3) * 20));
    return h;
  }
  const siteCentres = new Map();
  const siteDistance = (s, x, z) => s.halfX ? Math.hypot(Math.max(0, Math.abs(x - s.x) - s.halfX), Math.max(0, Math.abs(z - s.z) - s.halfZ)) : Math.max(0, Math.hypot(x - s.x, z - s.z) - s.radius);
  // Terrain with sites and the river bed, but without roads.
  function shaped(x, z) {
    let h = natural(x, z);
    for (const s of siteList) {
      const d = siteDistance(s, x, z);
      if (d > s.blend) continue;
      const w = 1 - ss(0, s.blend, d);
      if (s.mode === 'soften') h = lerp(h, 1 + fbm(x * .02, z * .02, 3, 13) * 2.6, w);
      else if (s.mode === 'terraces') h = lerp(h, kronwachtLevel(Math.max(s.x - s.halfX, Math.min(s.x + s.halfX, x)), Math.max(s.z - s.halfZ, Math.min(s.z + s.halfZ, z))), w);
      else {
        if (!siteCentres.has(s.id)) siteCentres.set(s.id, s.mode === 'level' ? s.height : natural(s.x, s.z) + (s.offset || 0));
        h = lerp(h, siteCentres.get(s.id), w);
      }
    }
    const river = nearest(riverBuckets, x, z);
    if (river) {
      const half = river.line.width / 2;
      // Bed inside the banks, then a long grassy slope (no steeper than ~1:2) up to the land.
      if (river.distance < half + 34) {
        const u = Math.min(1, river.distance / half), bed = WATER_LEVEL - .35 - (1 - u * u) * 3.4;
        h = Math.min(h, river.distance < half ? bed : lerp(WATER_LEVEL - .35, h, ss(half, half + 34, river.distance)));
      }
    }
    return h;
  }
  // Roads follow a smoothed centre-line height (or a straight ramp) and blend into the land.
  const rampEnds = new Map();
  function roadTarget(hit) {
    const line = hit.line;
    if (line.ramp) {
      if (!rampEnds.has(line.id)) rampEnds.set(line.id, [shaped(...line.points[0]), shaped(...line.points[line.points.length - 1])]);
      const [a, b] = rampEnds.get(line.id);
      return lerp(a, b, hit.along / line.length);
    }
    const s = hit.segment, dx = (s.bx - s.ax) / (s.length || 1), dz = (s.bz - s.az) / (s.length || 1);
    let sum = 0;
    for (const o of [-6, 0, 6]) sum += shaped(hit.x + dx * o, hit.z + dz * o);
    return sum / 3;
  }
  function computeHeight(x, z) {
    let h = shaped(x, z);
    const road = nearest(roadBuckets, x, z);
    if (road && road.distance < road.line.width / 2 + 6) {
      const river = nearest(riverBuckets, x, z);
      const keepRiver = river ? 1 - ss(river.line.width / 2, river.line.width / 2 + 4, river.distance) : 0;
      const w = (1 - ss(road.line.width / 2, road.line.width / 2 + 6, road.distance)) * (1 - keepRiver);
      h = lerp(h, roadTarget(road), w);
    }
    return h;
  }

  // ── Chunk grids.
  const grids = new Map();
  const key = (cx, cz) => cx * 1000 + cz;
  function grid(cx, cz) {
    const k = key(cx, cz);
    let g = grids.get(k);
    if (g) return g;
    const heights = new Float32Array((CELLS + 1) ** 2), x0 = cx * CHUNK, z0 = cz * CHUNK;
    for (let j = 0; j <= CELLS; j++) for (let i = 0; i <= CELLS; i++) heights[j * (CELLS + 1) + i] = computeHeight(x0 + i * STEP, z0 + j * STEP);
    g = { cx, cz, x0, z0, heights };
    grids.set(k, g);
    return g;
  }
  const vertex = (g, i, j) => g.heights[j * (CELLS + 1) + i];
  /** Height of the rendered terrain surface (same triangle split as the chunk mesh). */
  function heightAt(x, z) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK), g = grid(cx, cz);
    const fx = (x - g.x0) / STEP, fz = (z - g.z0) / STEP;
    const i = Math.min(CELLS - 1, Math.max(0, Math.floor(fx))), j = Math.min(CELLS - 1, Math.max(0, Math.floor(fz)));
    const u = fx - i, v = fz - j;
    const a = vertex(g, i, j), b = vertex(g, i + 1, j), c = vertex(g, i, j + 1), d = vertex(g, i + 1, j + 1);
    return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }
  /** Per-vertex surface data for the terrain shader. */
  function surface(x, z, h, slope) {
    const road = nearest(roadBuckets, x, z), river = nearest(riverBuckets, x, z), w = biomeWeights(x, z);
    const roadW = road ? ss(road.line.width / 2 + 1.3, road.line.width / 2 - .9, road.distance) : 0;
    const city = SITES.city, nearCity = Math.hypot(Math.max(0, Math.abs(x - city.x) - city.halfX), Math.max(0, Math.abs(z - city.z) - city.halfZ));
    const paved = road && road.line.type === 'king' ? ss(260, 120, nearCity) : 0;
    // Inside Kronwacht: cobbled streets and squares, trodden earth and grass in the yards.
    const streets = Math.max(nearCity < 1 ? kronwachtPaving(x, z) : 0, castleWardPaving(x, z));
    const shore = ss(WATER_LEVEL + 2.2, WATER_LEVEL + .3, h);
    // Sand only where moving or open water washes the bank; the marsh gets mud instead.
    const riverBank = river ? ss(river.line.width / 2 + 9, river.line.width / 2 + 2, river.distance) : 0;
    const lakeBank = Math.max(...LAKES.map(l => ss(l.radius + 40, l.radius + 5, Math.hypot(x - l.x, z - l.z))));
    const patches = .5 + .5 * fbm(x * .05, z * .05, 2, 41);
    // A narrow gravel bank frayed by grass, and a dark wet line right at the water's edge.
    // River and lake slopes stay green instead of turning to bare rock.
    const grassy = Math.max(river ? ss(river.line.width / 2 + 40, river.line.width / 2 + 30, river.distance) : 0, lakeBank);
    const bank = Math.max(riverBank, lakeBank), wet = ss(WATER_LEVEL + .75, WATER_LEVEL + .1, h) * bank;
    const sand = ss(WATER_LEVEL + 1.7, WATER_LEVEL + .25, h) * bank * (.5 + patches * .7) * (1 - wet);
    return {
      a: [roadW * (1 - paved) * (1 - streets), Math.max(ss(.72, .95, patches) * .7 + w.plains * ss(.5, .7, patches) * .5, nearCity < 1 ? .35 + patches * .3 : 0) * (1 - streets), Math.min(1, ss(18, 34, h) * .7 + ss(.55, 1.05, slope) * (1 - grassy * .75)), ss(46, 58, h + fbm(x * .03, z * .03, 2, 8) * 5)],
      b: [(w.autumn * .8 * (.72 + patches * .38) + w.taiga * .3 * (.55 + patches * .6)) * (1 - streets), w.marsh * .95 * ss(WATER_LEVEL + 3, WATER_LEVEL + .5, h) + shore * .25 + wet * .85, sand, Math.max(roadW * paved, streets)],
      tint: [1 - w.taiga * .1 + w.autumn * .05 + w.plains * .03, 1 - w.autumn * .12 - w.marsh * .08, 1 - w.autumn * .35 - w.plains * .12 + w.taiga * .02],
    };
  }
  const roadAt = (x, z) => nearest(roadBuckets, x, z);
  const riverAt = (x, z) => nearest(riverBuckets, x, z);
  /** Distance to the nearest road edge (negative on the road). */
  function roadClearance(x, z) { const r = roadAt(x, z); return r ? r.distance - r.line.width / 2 : Infinity; }
  return { heightAt, computeHeight, grid, surface, roadAt, riverAt, roadClearance, natural, siteDistance: (id, x, z) => siteDistance({ ...SITES[id] }, x, z), STEP, CELLS };
}

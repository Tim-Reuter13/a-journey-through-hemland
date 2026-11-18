import * as THREE from 'three';
import { vnoise } from './caveRock.js';

// CAVE MASONRY — dungeons that were built, not dug (the Bruchwacht's customs cellar, data/hemland/zollkeller.js). The same
// plans as the goblin caves (systems/caves.js: cells, storeys, stairs, drops into the storey below), but drawn as cut stone:
// flagged floors, coursed walls standing on the cell borders, flat stone ceilings with transverse ribs, piers along the
// longer walls, square steps, the edges of a walkway over a sunken floor. Light is baked into the vertices the way
// caveRock.js does it (an ambient that never goes black, every torch with a sight check over the plan) and grime follows
// its causes: a wet band at the foot of every wall, a water line in the cistern, soot over the torches.

const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (i, j, k = 0) => { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const ARROWS = { '>': [1, 0], '<': [-1, 0], v: [0, 1], '^': [0, -1] };
const FLAT = new Set(['.', ',', ':', '~', 'E']);

/**
 * cells: { W, H, CELL, x0, z0 }. levels: [{ L, y, char(i, j), ceiling(i, j) (height above y), stairStep(i, j) }], highest first.
 * storey: height between levels. lights: as caveRock.js. ambient: THREE.Color. materials: { floor, wall, wall2, ceil, trim }.
 * tunnel: { at: Vector3, out: [dx, dz], rise, length } for the stair up to the daylight. Returns a mesh.
 */
export function buildCaveMasonry({ cells, levels, storey, lights = [], ambient, materials, tunnel = null }) {
  const { W, H, CELL, x0, z0 } = cells;
  const byL = new Map(levels.map(l => [l.L, l]));
  const ch = (L, i, j) => byL.get(L)?.char(i, j) ?? '#';
  const isStair = c => c in ARROWS;
  const isWalk = c => FLAT.has(c) || isStair(c);
  // Open on this storey: floor, stairs, a drop into the storey below. '=' (the space under a stair from above) counts below.
  const open = (L, i, j) => { const c = ch(L, i, j); return isWalk(c) || c === 'O' || c === '='; };
  const quads = new Map(); // material key → { pos: [], nrm: [] }
  const out = key => { if (!quads.has(key)) quads.set(key, { pos: [], nrm: [] }); return quads.get(key); };
  /** A quad from corner `o` along U (nu pieces) and V (nv pieces), facing n. Subdivided so the baked light has vertices to sit on. */
  function quad(key, o, U, V, n, nu = 1, nv = 1) {
    const q = out(key);
    for (let a = 0; a < nu; a++) for (let b = 0; b < nv; b++) {
      const p = (s, t) => [o[0] + U[0] * s + V[0] * t, o[1] + U[1] * s + V[1] * t, o[2] + U[2] * s + V[2] * t];
      const s0 = a / nu, s1 = (a + 1) / nu, t0 = b / nv, t1 = (b + 1) / nv, A = p(s0, t0), B = p(s1, t0), C = p(s1, t1), D = p(s0, t1);
      // Winding so the front faces along n.
      const cross = [U[1] * V[2] - U[2] * V[1], U[2] * V[0] - U[0] * V[2], U[0] * V[1] - U[1] * V[0]];
      const flip = cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2] < 0;
      for (const v of flip ? [A, C, B, A, D, C] : [A, B, C, A, C, D]) { q.pos.push(...v); q.nrm.push(...n); }
    }
  }
  const seg = len => Math.max(1, Math.round(len / 1.1));
  /** A box (piers, ribs, steps): its six faces, all facing out. */
  function box(key, x, y, z, w, h, d, faces = 'all') {
    const hx = w / 2, hz = d / 2;
    const want = f => faces === 'all' || faces.includes(f);
    if (want('u')) quad(key, [x - hx, y + h, z - hz], [w, 0, 0], [0, 0, d], [0, 1, 0], seg(w), seg(d));
    if (want('d')) quad(key, [x - hx, y, z - hz], [w, 0, 0], [0, 0, d], [0, -1, 0], seg(w), seg(d));
    if (want('n')) quad(key, [x - hx, y, z - hz], [w, 0, 0], [0, h, 0], [0, 0, -1], seg(w), seg(h));
    if (want('s')) quad(key, [x - hx, y, z + hz], [w, 0, 0], [0, h, 0], [0, 0, 1], seg(w), seg(h));
    if (want('w')) quad(key, [x - hx, y, z - hz], [0, 0, d], [0, h, 0], [-1, 0, 0], seg(d), seg(h));
    if (want('e')) quad(key, [x + hx, y, z - hz], [0, 0, d], [0, h, 0], [1, 0, 0], seg(d), seg(h));
  }
  const cx = i => x0 + (i + .5) * CELL, cz = j => z0 + (j + .5) * CELL;
  const SIDES = [[1, 0, 'e'], [-1, 0, 'w'], [0, 1, 's'], [0, -1, 'n']];

  for (const lv of levels) {
    const { L, y } = lv, below = byL.get(L - 1), above = byL.get(L + 1);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const c = ch(L, i, j); if (!open(L, i, j)) continue;
      const x = cx(i), z = cz(j), up = above ? ch(L + 1, i, j) : '#';
      // ── Floors and steps.
      if (FLAT.has(c)) quad(c === '~' ? 'floorWet' : 'floor', [x - CELL / 2, y, z - CELL / 2], [CELL, 0, 0], [0, 0, CELL], [0, 1, 0], 2, 2);
      if (isStair(c)) {
        const [di, dj] = ARROWS[c], k = lv.stairStep(i, j);
        for (let s = 0; s < 4; s++) {
          const top = y - storey * (k * 4 + s) / 20, along = -CELL / 2 + (s + .5) * CELL / 4, sx = x + di * along, sz = z + dj * along;
          const w = di ? CELL / 4 : CELL, d = dj ? CELL / 4 : CELL;
          box('trim', sx, top - .35, sz, w, .35, d, ['u', di > 0 ? 'e' : di < 0 ? 'w' : dj > 0 ? 's' : 'n']);
        }
      }
      // ── Ceilings: none under a drop from the storey above (that is open to its own ceiling) or over a stair space.
      if (up !== 'O' && c !== '=' && !(isStair(up))) {
        const top = y + lv.ceiling(i, j);
        quad('ceil', [x - CELL / 2, top, z - CELL / 2], [CELL, 0, 0], [0, 0, CELL], [0, -1, 0], 2, 2);
      }
      // ── Walls on the borders to rock.
      for (const [di, dj, face] of SIDES) {
        const ni = i + di, nj = j + dj, n = ch(L, ni, nj);
        const fx = x + di * CELL / 2, fz = z + dj * CELL / 2, normal = [-di, 0, -dj];
        const span = (bottom, top) => {
          if (top - bottom < .05) return;
          const key = hash(ni * 3 + (dj ? 1 : 0), nj * 7 + (di ? 1 : 0), L + 9) > .55 ? 'wall2' : 'wall';
          const o = dj ? [fx - CELL / 2, bottom, fz] : [fx, bottom, fz - CELL / 2], U = dj ? [CELL, 0, 0] : [0, 0, CELL];
          quad(key, o, U, [0, top - bottom, 0], normal, 2, seg(top - bottom));
        };
        if (open(L, ni, nj)) {
          // The edge of a floor above a drop: a face down to the storey below (or to the underside of a walkway).
          if (c === 'O' || !below || ch(L, ni, nj) !== 'O') continue;
          continue;
        }
        if (n === '=' ) continue;
        const myTop = y + (up === 'O' ? storey : lv.ceiling(i, j));
        let bottom = y - (isStair(c) ? storey : 0);
        if (c === 'O') bottom = y;            // below a drop the storey underneath draws its own walls
        if (c === '=') continue;              // a stair's space: the stair cell above draws these walls
        // Under a drop, a border against rock that carries a floor of the storey above is drawn by that floor's edge.
        if (above && up === 'O' && isWalk(ch(L + 1, ni, nj))) continue;
        span(bottom, myTop + .05);
      }
      // ── A floor next to a drop: its edge face, down to the floor below (or the underside of a walkway over it).
      if (isWalk(c) && below) for (const [di, dj] of SIDES) {
        if (ch(L, i + di, j + dj) !== 'O') continue;
        const fx = x + di * CELL / 2, fz = z + dj * CELL / 2, lowOpen = open(L - 1, i, j);
        const bottom = lowOpen ? y - (storey - below.ceiling(i, j)) : below.y - .05;
        const o = dj ? [fx - CELL / 2, bottom, fz] : [fx, bottom, fz - CELL / 2], U = dj ? [CELL, 0, 0] : [0, 0, CELL];
        quad('trim', o, U, [0, y - bottom, 0], [di, 0, dj], 2, seg(y - bottom));
        // A low parapet of cut stone along the edge (a step to look over, not a wall).
        box('trim', fx - di * .15, y, fz - dj * .15, dj ? CELL : .3, .45, di ? CELL : .3);
      }
      // ── Piers along the walls (every third cell) and transverse ribs under the ceiling (every second row).
      for (const [di, dj] of SIDES) {
        if (open(L, i + di, j + dj) || c === 'O' || isStair(c) || c === '=') continue;
        if ((dj ? i : j) % 3 !== 0) continue;
        const fx = x + di * (CELL / 2 - .22), fz = z + dj * (CELL / 2 - .22), top = y + (up === 'O' ? storey : lv.ceiling(i, j));
        box('trim', fx + (dj ? -CELL / 2 + .35 : 0), y, fz + (di ? -CELL / 2 + .35 : 0), dj ? .7 : .44, top - y, di ? .7 : .44);
      }
      if (up !== 'O' && FLAT.has(c) && j % 2 === 0 && !isStair(up)) {
        const top = y + lv.ceiling(i, j);
        box('trim', x, top - .32, z - CELL / 2 + .2, CELL, .32, .4, ['d', 'n', 's']);
      }
    }
  }
  // ── The stair up to the daylight from the mouth.
  if (tunnel) {
    const { at, out: [ox, oz], rise, length } = tunnel, n = 13, run = length / n, side = [oz, -ox];
    for (let s = 0; s < n; s++) {
      const top = at.y + rise * (s + 1) / n, along = (s + .5) * run, x = at.x + ox * (CELL / 2 + along), z = at.z + oz * (CELL / 2 + along);
      box('trim', x, top - .4, z, ox ? run : CELL + .2, .4, oz ? run : CELL + .2, ['u', ox > 0 ? 'w' : ox < 0 ? 'e' : oz > 0 ? 'n' : 's']);
      for (const sv of [-1, 1]) box(s % 4 === 0 ? 'wall2' : 'wall', x + side[0] * sv * (CELL / 2 + .25), top - 1.5, z + side[1] * sv * (CELL / 2 + .25), ox ? run : .5, 5, oz ? run : .5);
      box('ceil', x, top + 3.1, z, ox ? run : CELL + 1, .5, oz ? run : CELL + 1, ['d']);
    }
  }

  // ── Bake the light into the vertices.
  const levelAt = yy => levels.reduce((best, lv) => lv.y <= yy + 1 && (!best || lv.y > best.y) ? lv : best, null) || levels[levels.length - 1];
  const cellI = x => Math.floor((x - x0) / CELL), cellJ = z => Math.floor((z - z0) / CELL);
  const sees = (lv, x, z, tx, tz) => {
    const d = Math.hypot(tx - x, tz - z), steps = Math.ceil(d / .5);
    for (let s = 1; s < steps; s++) { const px = x + (tx - x) * s / steps, pz = z + (tz - z) * s / steps, i = cellI(px), j = cellJ(pz); if (i < 0 || j < 0 || i >= W || j >= H) continue; if (!open(lv.L, i, j) && !(byL.get(lv.L + 1) && ch(lv.L + 1, i, j) === 'O')) return false; }
    return true;
  };
  const all = [], index = [], groups = [], mats = [];
  const P = [], N = [];
  for (const [key, q] of quads) { if (!q.pos.length) continue; groups.push([P.length / 3, q.pos.length / 3, mats.length]); mats.push(materials[key] || materials.wall); P.push(...q.pos); N.push(...q.nrm); }
  const count = P.length / 3, baked = new Float32Array(count * 3), dirt = new Float32Array(count);
  for (let k = 0; k < count; k++) {
    const x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2], n0 = N[k * 3], n1 = N[k * 3 + 1], n2 = N[k * 3 + 2], lv = levelAt(y);
    // Corners darker: a little occlusion near the floor and the ceiling.
    const ao = .78 + .22 * smooth(0, 1.2, y - lv.y);
    let r = ambient.r * ao, g = ambient.g * ao, b = ambient.b * ao;
    const ox = x + n0 * .5, oz = z + n2 * .5;
    for (const Lt of lights) {
      const dx = Lt.x - x, dy = Lt.y - y, dz = Lt.z - z, d = Math.hypot(dx, dy, dz);
      if (d > Lt.range) continue;
      const lam = Math.min(1, Math.max(0, (n0 * dx + n1 * dy + n2 * dz) / (d || 1) * .8 + .2)); if (!lam) continue;
      if (Lt.L !== undefined && Lt.L !== lv.L ? d > 7 : !sees(lv, ox, oz, Lt.x, Lt.z)) continue;
      const fall = (1 - (d / Lt.range) ** 2) ** 2 * lam;
      r += Lt.color.r * fall; g += Lt.color.g * fall; b += Lt.color.b * fall;
    }
    baked[k * 3] = r; baked[k * 3 + 1] = g; baked[k * 3 + 2] = b;
    // Grime: damp blotches, the wet foot of the walls, a water line where the cistern stood full, soot over the torches.
    let grime = smooth(.15, .7, vnoise(x * .3 + 3, y * .5, z * .3)) * .35;
    if (n1 < .5) {
      grime = Math.max(grime, smooth(1.2, .1, y - lv.y) * .5);
      const i = cellI(x - n0 * .3), j = cellJ(z - n2 * .3);
      if (ch(lv.L, i, j) === '~' || ch(lv.L, i + Math.round(n0), j + Math.round(n2)) === '~') grime = Math.max(grime, smooth(2.6, 2.2, y - lv.y) * smooth(.2, .5, y - lv.y) * .8);
      for (const Lt of lights) { const upY = y - Lt.y, sd = Math.hypot(Lt.x - x, Lt.z - z); if (upY > 0 && upY < 3.5 && sd < 1.4) grime = Math.max(grime, (1 - sd / 1.4) * (1 - upY / 3.5) * .85); }
    }
    dirt[k] = Math.min(.9, grime);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  geometry.setAttribute('baked', new THREE.Float32BufferAttribute(baked, 3));
  geometry.setAttribute('grime', new THREE.Float32BufferAttribute(dirt, 1));
  for (const [start, n, m] of groups) geometry.addGroup(start, n, m);
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, mats);
  mesh.name = 'cave masonry'; mesh.receiveShadow = false; mesh.castShadow = false;
  return mesh;
}

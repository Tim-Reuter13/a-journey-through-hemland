// Walkable-cell grid for NPC paths. Cells are tested against the collision world once, in
// tiles built lazily and cached; a query is then A* (binary heap, 8-connected, no corner
// cutting) plus string-pulling by grid line of sight, so a finished path costs no collision
// queries at all. Building tiles is the expensive part, so it stops at a deadline and the
// query reports PENDING; the caller simply asks again next frame.
export const PENDING = Symbol('nav pending');
const TILE = 32, SPAN = 1 << 15;

export function createNavGrid({ blocked, heightAt = () => 0, cell = .5, radius = .34 } = {}) {
  const tiles = new Map();
  let deadline = Infinity, searchDeadline = Infinity, built = 0;
  const cellOf = v => Math.floor(v / cell);
  const id = (ix, iz) => (ix + SPAN) * 2 * SPAN + (iz + SPAN);
  const center = i => (i + .5) * cell;

  function tile(tx, tz) {
    const k = id(tx, tz);
    let t = tiles.get(k);
    if (t) return t;
    if (built && performance.now() > deadline) throw PENDING;
    built++;
    t = new Uint8Array(TILE * TILE);
    for (let j = 0; j < TILE; j++) for (let i = 0; i < TILE; i++) {
      const x = center(tx * TILE + i), z = center(tz * TILE + j);
      t[j * TILE + i] = blocked(x, z, radius, heightAt(x, z)) ? 0 : 1;
    }
    tiles.set(k, t);
    return t;
  }
  function walkable(ix, iz) {
    const tx = Math.floor(ix / TILE), tz = Math.floor(iz / TILE);
    return tile(tx, tz)[(iz - tz * TILE) * TILE + (ix - tx * TILE)] === 1;
  }
  // Diagonal moves need both orthogonal neighbours, so paths never clip wall corners.
  function step(ix, iz, dx, dz) {
    if (!walkable(ix + dx, iz + dz)) return false;
    return !dx || !dz || walkable(ix + dx, iz) && walkable(ix, iz + dz);
  }
  function nearestWalkable(ix, iz, reach = 4) {
    if (walkable(ix, iz)) return [ix, iz];
    for (let r = 1; r <= reach; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) === r && walkable(ix + dx, iz + dz)) return [ix + dx, iz + dz];
    }
    return null;
  }
  // Walks the line between cell centres in quarter-cell steps; every cell it enters must be
  // walkable, and a diagonal hop between cells needs both side cells too.
  function sight(ax, az, bx, bz) {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) * 4);
    let px = ax, pz = az;
    for (let i = 1; i <= n; i++) {
      const x = Math.round(ax + (bx - ax) * i / n), z = Math.round(az + (bz - az) * i / n);
      if (x === px && z === pz) continue;
      if (x !== px && z !== pz && (!walkable(x, pz) || !walkable(px, z))) return false;
      if (!walkable(x, z)) return false;
      px = x; pz = z;
    }
    return true;
  }

  /** Path from a to b as world points (excluding a, ending exactly at b), null if none, or PENDING. */
  // `until` bounds tile building (at least one tile per call, so it always progresses);
  // `searchUntil` bounds the A* expansions themselves.
  function find(a, b, { until = Infinity, searchUntil = until, maxNodes = 16000 } = {}) {
    deadline = until; searchDeadline = searchUntil; built = 0;
    try {
      const start = nearestWalkable(cellOf(a.x), cellOf(a.z)), goal = nearestWalkable(cellOf(b.x), cellOf(b.z));
      if (!start || !goal) return null;
      const [gx, gz] = goal, goalId = id(gx, gz);
      const h = (x, z) => { const dx = Math.abs(x - gx), dz = Math.abs(z - gz); return Math.max(dx, dz) + .4142 * Math.min(dx, dz); };
      const g = new Map([[id(...start), 0]]), from = new Map(), cells = new Map([[id(...start), start]]);
      const heap = [[h(...start), id(...start)]];
      const push = item => { heap.push(item); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= item[0]) break; heap[i] = heap[p]; i = p; } heap[i] = item; };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= heap.length) break; if (c + 1 < heap.length && heap[c + 1][0] < heap[c][0]) c++; if (heap[c][0] >= last[0]) break; heap[i] = heap[c]; i = c; } heap[i] = last; } return top; };
      let expanded = 0, found = false;
      while (heap.length) {
        const [, k] = pop();
        if (k === goalId) { found = true; break; }
        if (++expanded > maxNodes) return null;
        if ((expanded & 255) === 0 && performance.now() > searchDeadline) return PENDING;
        const [x, z] = cells.get(k), base = g.get(k);
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dz) || !step(x, z, dx, dz)) continue;
          const nx = x + dx, nz = z + dz, nk = id(nx, nz), cost = base + (dx && dz ? 1.4142 : 1);
          if (cost >= (g.get(nk) ?? Infinity)) continue;
          g.set(nk, cost); from.set(nk, k); cells.set(nk, [nx, nz]);
          push([cost + h(nx, nz), nk]);
        }
      }
      if (!found) return null;
      const chain = [];
      for (let k = goalId; k !== undefined; k = from.get(k)) chain.push(cells.get(k));
      chain.reverse();
      // String-pull: keep only corners, i.e. the farthest cell still in sight.
      const corners = [];
      for (let i = 0; i < chain.length - 1;) {
        let j = Math.min(chain.length - 1, i + 48);
        while (j > i + 1 && !sight(chain[i][0], chain[i][1], chain[j][0], chain[j][1])) j--;
        corners.push(chain[j]); i = j;
      }
      const points = corners.slice(0, -1).map(([x, z]) => ({ x: center(x), z: center(z) }));
      points.push({ x: b.x, z: b.z, ...(Number.isFinite(b.y) ? { y: b.y } : {}) });
      return points;
    } catch (error) {
      if (error === PENDING) return PENDING;
      throw error;
    } finally { deadline = searchDeadline = Infinity; }
  }
  return { find, walkable: (x, z) => walkable(cellOf(x), cellOf(z)), state: () => ({ tiles: tiles.size }) };
}

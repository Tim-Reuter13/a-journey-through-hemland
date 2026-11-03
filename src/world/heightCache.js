// A cheap stand-in for an expensive height function (terrain noise costs ~13 µs a call, and a fire or a
// spray of blood asks hundreds of times a frame). Heights are sampled once on a regular grid and
// interpolated: good to a few centimetres, which is all particles and flames need.
export function createHeightCache(fn, step = .5, limit = 90000) {
  const map = new Map(), inv = 1 / step;
  const corner = (i, j) => {
    const key = (i + 8192) * 16384 + (j + 8192);
    let v = map.get(key);
    if (v === undefined) { if (map.size > limit) map.clear(); v = fn(i * step, j * step); map.set(key, v); }
    return v;
  };
  return {
    at(x, z) {
      const gx = x * inv, gz = z * inv, i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
      return (corner(i, j) * (1 - fx) + corner(i + 1, j) * fx) * (1 - fz) + (corner(i, j + 1) * (1 - fx) + corner(i + 1, j + 1) * fx) * fz;
    },
    clear() { map.clear(); },
    get size() { return map.size; },
  };
}

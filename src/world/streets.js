import * as THREE from 'three';
import { KRONWACHT, SITES, CASTLE_RING } from './hemland.js';

// Kronwacht's street plan as a texture for the terrain shader, two texels per unit: which paving each
// street gets, where its gutter runs and where dirt gathers — finer than the 2-unit terrain vertices
// can carry. R = granite setts (main streets, borders of the squares), G = flagstones (squares),
// B = gutter down the middle of a street, A = grime by the house fronts.
export const CITY_MAP = { minX: 820, minZ: -1200, maxX: 1180, maxZ: -730, res: 2 };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
let texture = null;

export function cityGroundMap() {
  if (texture) return texture;
  const { minX, minZ, maxX, maxZ, res } = CITY_MAP, w = Math.round((maxX - minX) * res), h = Math.round((maxZ - minZ) * res);
  const data = new Uint8Array(w * h * 4);
  const put = (i, channel, v) => { data[i * 4 + channel] = Math.max(data[i * 4 + channel], Math.round(Math.min(1, Math.max(0, v)) * 255)); };
  const area = (x0, z0, x1, z1, paint) => {
    for (let j = Math.max(0, Math.floor((z0 - minZ) * res)); j < Math.min(h, Math.ceil((z1 - minZ) * res)); j++)
      for (let i = Math.max(0, Math.floor((x0 - minX) * res)); i < Math.min(w, Math.ceil((x1 - minX) * res)); i++) paint(j * w + i, minX + (i + .5) / res, minZ + (j + .5) / res);
  };
  for (const st of KRONWACHT.streets) for (let k = 1; k < st.points.length; k++) {
    const [ax, az] = st.points[k - 1], [bx, bz] = st.points[k], dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz, half = st.width / 2, m = half + 2;
    area(Math.min(ax, bx) - m, Math.min(az, bz) - m, Math.max(ax, bx) + m, Math.max(az, bz) + m, (i, x, z) => {
      const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / len2)), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
      if (d > half + 1.5) return;
      if (st.main) put(i, 0, 1 - smooth(half - .2, half + .6, d));
      put(i, 2, 1 - smooth(.22, .42, d));
      put(i, 3, smooth(half - (st.main ? 1.2 : 1.8), half - .1, d) * (st.main ? .7 : 1));
    });
  }
  for (const p of KRONWACHT.plazas) {
    const c = Math.cos(p.rotation), s = Math.sin(p.rotation), r = Math.hypot(p.w, p.d) / 2 + 2;
    area(p.x - r, p.z - r, p.x + r, p.z + r, (i, x, z) => {
      const lx = (x - p.x) * c - (z - p.z) * s, lz = (x - p.x) * s + (z - p.z) * c, edge = Math.max(Math.abs(lx) - p.w / 2, Math.abs(lz) - p.d / 2);
      if (edge > 1) return;
      // Flagstones inside a border of setts; no gutter crosses a square, and it is swept clean.
      if (edge < -1.1) { put(i, 1, 1); data[i * 4 + 2] = 0; data[i * 4 + 3] = 0; } else put(i, 0, 1);
    });
  }
  // The castle ward: setts on the way from the gate to the keep door, muck along the foot of the curtain.
  const c = SITES.castle, ring = CASTLE_RING.map(([x, z]) => [c.x + x, c.z + z]), way = [[c.x + 16, c.z + 38], [c.x + 1, c.z + 1]];
  area(c.x - 50, c.z - 48, c.x + 50, c.z + 42, (i, x, z) => {
    const [[ax, az], [bx, bz]] = way, dx = bx - ax, dz = bz - az, t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    put(i, 0, 1 - smooth(2.4, 3.2, Math.hypot(x - ax - dx * t, z - az - dz * t)));
    let edge = Infinity;
    for (let k = 0; k < ring.length; k++) {
      const [px, pz] = ring[k], [qx, qz] = ring[(k + 1) % ring.length], ex = qx - px, ez = qz - pz, u = Math.min(1, Math.max(0, ((x - px) * ex + (z - pz) * ez) / (ex * ex + ez * ez)));
      edge = Math.min(edge, Math.hypot(x - px - ex * u, z - pz - ez * u));
    }
    put(i, 3, 1 - smooth(1.5, 4.5, edge));
  });
  texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  texture.magFilter = texture.minFilter = THREE.LinearFilter; texture.generateMipmaps = false; texture.needsUpdate = true;
  return texture;
}

// Hemland, first region: the Aschmark. Authored map data — sites, roads, rivers,
// lakes and biome regions — read by the heightfield, the terrain streamer and
// the site builders. World units: 1 unit ≈ 0.73 m; north is -z.
//
// Travel times on the king's road from Dämmerwald to Kronwacht (~1300 units):
// jogging (5.1 u/s) ≈ 4.3 min, sprinting (9.2 u/s) ≈ 2.4 min.

export const BOUNDS = { minX: -1024, maxX: 1536, minZ: -1536, maxZ: 1024 };
export const CHUNK = 128;
export const WATER_LEVEL = -6;

/** Flattened or shaped areas. mode: 'soften' (gentle natural terrain), 'flatten' (to the natural height at the centre
 *  plus `offset`), 'level' (to an absolute `height`). Rectangles use halfX/halfZ, circles radius; blend is the falloff. */
export const SITES = {
  village: { name: 'Dämmerwald', x: 0, z: 6, radius: 75, blend: 120, mode: 'soften' },
  camp: { name: 'Westlager', x: -330, z: 150, radius: 24, blend: 34, mode: 'flatten' },
  shrine: { name: 'Glutschrein', x: 230, z: -60, radius: 15, blend: 14, mode: 'flatten' },
  tower: { name: 'Alter Wachturm', x: -120, z: 245, radius: 11, blend: 16, mode: 'flatten', offset: 2 },
  inn: { name: 'Zum Grauen Krug', x: 452, z: -372, radius: 22, blend: 22, mode: 'flatten' },
  outpost_west: { name: 'Wegposten', x: 268, z: -230, radius: 14, blend: 14, mode: 'flatten' },
  outpost_east: { name: 'Kronposten', x: 770, z: -700, radius: 14, blend: 14, mode: 'flatten' },
  farm_bridge: { name: 'Hof am Grauwasser', x: 530, z: -300, radius: 30, blend: 26, mode: 'flatten' },
  mill: { name: 'Königsmühle', x: 645, z: -548, radius: 14, blend: 20, mode: 'flatten', offset: 1.5 },
  farm_east: { name: 'Hof Weizengrund', x: 835, z: -575, radius: 32, blend: 28, mode: 'flatten' },
  farm_north: { name: 'Hof Krähenfeld', x: 680, z: -705, radius: 28, blend: 26, mode: 'flatten' },
  city: { name: 'Kronwacht', x: 1000, z: -900, halfX: 175, halfZ: 155, blend: 70, mode: 'terraces' },
  castle: { name: 'Burg Kronwacht', x: 1030, z: -1150, radius: 50, blend: 45, mode: 'level', height: 34 },
  // Points of interest (sites/landmarks.js), discovered on the first visit.
  barrow: { name: 'Hügelgrab der Ersten', x: 560, z: -505, radius: 13, blend: 16, mode: 'flatten' },
  chapel_ruin: { name: 'Kapelle der Stillen Glut', x: 300, z: -120, radius: 10, blend: 14, mode: 'flatten' },
  wayshrine: { name: 'Wegschrein am Krähenfeld', x: 704, z: -594, radius: 4, blend: 8, mode: 'flatten' },
  kiln: { name: 'Köhlerlager', x: 150, z: -210, radius: 11, blend: 14, mode: 'flatten' },
  quarry: { name: 'Königsbruch', x: 1235, z: -890, radius: 19, blend: 18, mode: 'flatten', offset: -1.5 },
  plague_field: { name: 'Pestacker', x: 790, z: -930, radius: 15, blend: 14, mode: 'flatten', offset: 5.5 },
};

/** Roads: type 'king' (wide, paved near the city), 'dirt', 'lane'. `ramp` interpolates height end to end. */
export const ROADS = [
  { id: 'village_east', type: 'dirt', width: 4.2, points: [[-1, 7], [5, 5], [14, 3]] },
  { id: 'king', type: 'king', width: 6, points: [[14, 3], [60, -20], [130, -76], [200, -150], [268, -222], [338, -284], [392, -330],
    [446, -360], [520, -418], [610, -500], [700, -600], [790, -688], [872, -730], [940, -722], [986, -726], [1000, -736], [1000, -745]] },
  { id: 'shrine', type: 'dirt', width: 3.6, points: [[60, -20], [140, -34], [205, -52], [222, -58]] },
  { id: 'village_west', type: 'dirt', width: 4.2, points: [[-4, 12], [-11, 15], [-24, 15]] },
  { id: 'camp', type: 'dirt', width: 3.6, points: [[-24, 15], [-55, 30], [-120, 55], [-200, 100], [-270, 135], [-312, 150]] },
  { id: 'tower', type: 'dirt', width: 3.2, points: [[-24, 15], [-32, 42], [-60, 110], [-95, 182], [-112, 234]] },
  { id: 'lane_bridge_farm', type: 'lane', width: 3.2, points: [[520, -418], [524, -360], [530, -318]] },
  { id: 'lane_mill', type: 'lane', width: 3, points: [[610, -500], [632, -526], [645, -540]] },
  { id: 'lane_farm_north', type: 'lane', width: 3.2, points: [[700, -600], [692, -650], [684, -690]] },
  { id: 'lane_farm_east', type: 'lane', width: 3.2, points: [[790, -688], [812, -630], [832, -590]] },
  { id: 'castle_ramp', type: 'king', width: 5, ramp: true, points: [[1000, -1052], [1062, -1066], [1074, -1090], [1046, -1103]] },
];

// Kronwacht climbs from the south gate to the castle rock: three terraces held by curved retaining
// walls. Ramps cut through the walls where the streets climb; stairs serve the side lanes.
const smooth01 = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
export const KRONWACHT = {
  levels: [10, 17, 24],
  steps: [x => -872 + 9 * Math.sin((x - 1000) / 55), x => -988 + 7 * Math.sin((x - 1000) / 42 + 1.2)],
  ramps: [
    { a: [1006, -852], b: [1030, -896], width: 10 },
    { a: [957, -960], b: [945, -1012], width: 9 },
    { a: [878, -858], b: [873, -888], width: 4.5, stairs: true },
    { a: [1112, -978], b: [1116, -1004], width: 4.5, stairs: true },
    { a: [1128, -860], b: [1132, -886], width: 4.5, stairs: true },
  ],
};
// Streets (centre lines, width) and squares. Order matters for nothing; houses line both sides.
KRONWACHT.streets = [
  { id: 'koenigsgasse', width: 9, main: true, points: [[1000, -744], [999, -770], [996, -793], [994, -805]] },
  { id: 'marktgasse', width: 8, main: true, points: [[995, -840], [1000, -848], [1006, -852]] },
  { id: 'rampe_unten', width: 9, main: true, points: [[1006, -852], [1030, -896]] },
  { id: 'tempelgasse', width: 8, main: true, points: [[1030, -896], [1034, -907]] },
  { id: 'handwerkergasse', width: 7, main: true, points: [[1036, -933], [1012, -943], [985, -950], [957, -960]] },
  { id: 'rampe_oben', width: 8, main: true, points: [[957, -960], [945, -1012]] },
  { id: 'herrengasse', width: 8, main: true, points: [[945, -1012], [962, -1024], [985, -1031], [1000, -1046], [1005, -1056]] },
  { id: 'torgasse_west', width: 5, points: [[996, -762], [962, -764], [925, -771], [888, -779], [850, -786]] },
  { id: 'torgasse_ost', width: 5, points: [[1004, -762], [1040, -764], [1078, -768], [1115, -773]] },
  { id: 'gerbergasse', width: 5, points: [[970, -818], [940, -811], [906, -818], [878, -832], [870, -856]] },
  { id: 'wachgasse', width: 6, points: [[1016, -813], [1046, -803], [1082, -794], [1122, -790], [1150, -800]] },
  { id: 'kesselgasse', width: 4.5, points: [[1082, -794], [1095, -822], [1112, -845], [1128, -858]] },
  { id: 'tuchergasse', width: 5, points: [[1050, -925], [1082, -934], [1116, -946], [1150, -950]] },
  { id: 'brunnengasse', width: 5, points: [[957, -960], [922, -950], [892, -934], [873, -890]] },
  { id: 'kapellengasse', width: 5, points: [[945, -1012], [912, -1018], [878, -1022], [850, -1030]] },
  { id: 'gartengasse', width: 6, points: [[985, -1031], [1028, -1026], [1070, -1020], [1114, -1004]] },
  { id: 'stiegengasse', width: 4.5, points: [[1116, -946], [1114, -978]] },
  // The castle ramp (ROADS castle_ramp) as a street, so its lower, flatter part gets houses too.
  { id: 'burgweg', width: 5, points: [[1005, -1056], [1062, -1066], [1074, -1090], [1046, -1103]] },
];
KRONWACHT.plazas = [
  { id: 'markt', x: 993, z: -823, w: 44, d: 34, rotation: .06 },
  { id: 'tempelplatz', x: 1043, z: -920, w: 28, d: 24, rotation: -.12 },
  { id: 'herrenplatz', x: 982, z: -1034, w: 20, d: 14, rotation: .25 },
];
// Burg Kronwacht's curtain in castle-local metres around SITES.castle (x east, z south toward the town),
// clockwise from the south-west tower; the gate opens between the second and third point.
export const CASTLE_RING = [[-38, 34], [10, 39], [22, 39], [36, 38], [48, 6], [38, -30], [2, -44], [-32, -36], [-46, -4]];
/** Castle ward paving (0..1): cobbled inside the curtain, the kitchen garden left green. */
export function castleWardPaving(x, z) {
  const c = SITES.castle, lx = x - c.x, lz = z - c.z;
  if (Math.abs(lx) > 50 || Math.abs(lz) > 48) return 0;
  let inside = false, edge = Infinity;
  for (let i = 0, j = CASTLE_RING.length - 1; i < CASTLE_RING.length; j = i++) {
    const [xi, zi] = CASTLE_RING[i], [xj, zj] = CASTLE_RING[j];
    if ((zi > lz) !== (zj > lz) && lx < (xj - xi) * (lz - zi) / (zj - zi) + xi) inside = !inside;
    const dx = xj - xi, dz = zj - zi, t = Math.min(1, Math.max(0, ((lx - xi) * dx + (lz - zi) * dz) / (dx * dx + dz * dz)));
    edge = Math.min(edge, Math.hypot(lx - xi - dx * t, lz - zi - dz * t));
  }
  if (!inside) return 0;
  const garden = smooth01((Math.hypot(lx + 22, lz + 27) - 7) / 3);
  return Math.min(smooth01(edge / 1.5 + .4), garden);
}
/** How much a point is street or square (0..1, soft 1.2-unit edge): paving in the terrain texture. */
export function kronwachtPaving(x, z) {
  let best = 0;
  for (const st of KRONWACHT.streets) for (let i = 1; i < st.points.length; i++) {
    const [ax, az] = st.points[i - 1], [bx, bz] = st.points[i], dx = bx - ax, dz = bz - az;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t) - st.width / 2;
    if (d < 1.2) best = Math.max(best, 1 - smooth01((d + .2) / 1.4));
  }
  for (const p of KRONWACHT.plazas) {
    const c = Math.cos(p.rotation), s = Math.sin(p.rotation), lx = (x - p.x) * c - (z - p.z) * s, lz = (x - p.x) * s + (z - p.z) * c;
    const d = Math.max(Math.abs(lx) - p.w / 2, Math.abs(lz) - p.d / 2);
    if (d < 1.2) best = Math.max(best, 1 - smooth01((d + .2) / 1.4));
  }
  return best;
}
/** Terrace index (0 lower, 1 middle, 2 upper) of a point inside the city. */
export const kronwachtTerrace = (x, z) => z > KRONWACHT.steps[0](x) ? 0 : z > KRONWACHT.steps[1](x) ? 1 : 2;
function terraceGround(x, z) {
  const level = kronwachtTerrace(x, z);
  // A little roll inside each terrace so streets are never billiard tables.
  return KRONWACHT.levels[level] + Math.sin(x / 37 + level) * Math.cos(z / 29) * .7 + (level === 0 ? (-745 - z) / 127 * 1.2 : 0);
}
/** Ground height inside Kronwacht, ramps included. */
export function kronwachtLevel(x, z) {
  let h = terraceGround(x, z);
  for (const r of KRONWACHT.ramps) {
    const [ax, az] = r.a, [bx, bz] = r.b, dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / len2));
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d > r.width / 2 + 2) continue;
    const ramp = terraceGround(ax, az) + (terraceGround(bx, bz) - terraceGround(ax, az)) * (r.stairs ? t : smooth01(t));
    h += (ramp - h) * (1 - smooth01((d - r.width / 2) / 2));
  }
  return h;
}

export const RIVERS = [
  { id: 'hemfluss', name: 'Grauwasser', width: 16, points: [[520, -1520], [470, -1220], [440, -960], [418, -720], [400, -500], [392, -332], [380, -150], [408, 60], [470, 260], [540, 400]] },
];
export const LAKES = [{ id: 'grausee', name: 'Grausee', x: 575, z: 450, radius: 175 }];
/** A road crossing water: the deck is a walkable floor and a bridge model is built there. */
export const BRIDGES = [{ id: 'grauwasser', road: 'king', x: 392, z: -330, length: 30, width: 6.5, height: WATER_LEVEL + 4.2 }];

/** Biome weights at a point (0..1 each, not normalised). Height-based snow and rock live in the terrain shader. */
export function biomeWeights(x, z) {
  const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const wobble = Math.sin(x * .011 + z * .007) * 40 + Math.sin(z * .019 - x * .005) * 25;
  const autumn = ss(-110, -260, x + wobble) * ss(-520, -380, z) * ss(620, 480, z);
  const taiga = ss(-330, -560, z + wobble) * ss(820, 640, x);
  const marsh = ss(260, 120, Math.hypot(x - 300, z - 430) + wobble * .5);
  const plains = ss(470, 300, Math.hypot((x - 720) * .8, z + 600) + wobble) * (1 - taiga);
  const forest = Math.max(0, (Math.sin(x * .021) * Math.cos(z * .017) + .25)) * (1 - plains) * (1 - marsh);
  return { autumn, taiga, marsh, plains, forest };
}

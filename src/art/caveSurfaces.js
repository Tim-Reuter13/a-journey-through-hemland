// Original cave surfaces. Only small-scale relief lives in these repeating tiles;
// the world lighting supplies broad variation. All coordinates live on a torus.
const mod = (n, size) => ((n % size) + size) % size;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rint = (p, n) => Math.floor(p.random() * n);
const pickOf = (p, list) => list[rint(p, list.length)];
const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// Seven steps per material, dark recess through upper-left highlight. Even the
// damp materials have readable midtones under the caves' dim, tinted lighting.
const CHALK = ['#777268', '#8c877c', '#9e998c', '#b0ab9e', '#c5c1b4', '#d7d3c7', '#e9e5d9'];
const CHALK_DUST = ['#514f49', '#625f57', '#736f65', '#858073', '#969082', '#a9a293', '#bdb6a6'];
const WET_ROCK = ['#384642', '#52615a', '#68796f', '#7d8e82', '#94a295', '#aab6a6', '#c0cbb7'];
const MOSS = ['#3c4d38', '#4b6042', '#5e744c', '#73875a', '#899b6c', '#9eaf80', '#b5c29a'];
const MUD = ['#34322e', '#49463e', '#5c594e', '#706c5e', '#827d6d', '#96907c', '#aaa18b'];
const IRON_ROCK = ['#584749', '#735956', '#8c6d62', '#a38170', '#b9947d', '#ccaa8e', '#ddc0a4'];
const MINE_EARTH = ['#393430', '#50483f', '#64594e', '#776b5d', '#8a7c6b', '#9f907c', '#b4a38e'];

/** Periodic value noise, deliberately only 3-5 texels across. */
function blotches(p, cell) {
  const gw = Math.max(1, Math.round(p.w / cell)), gh = Math.max(1, Math.round(p.h / cell));
  const grid = Array.from({ length: gw * gh }, () => p.random());
  const at = (x, y) => grid[mod(y, gh) * gw + mod(x, gw)];
  return (x, y) => {
    const fx = mod(x, p.w) / p.w * gw, fy = mod(y, p.h) / p.h * gh;
    const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return (at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx) * (1 - sy)
      + (at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx) * sy;
  };
}

/** Small rounded limestone/wet nodules, or angular iron-bearing fracture faces. */
function rock(p, ramp, { base = 3, stretch = 1, angular = false, moss = false } = {}) {
  const gw = Math.round(p.w / 7), gh = Math.round(p.h / (7 / stretch));
  const seeds = [];
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) seeds.push({
    x: (x + .1 + p.random() * .8) * p.w / gw,
    y: (y + .1 + p.random() * .8) * p.h / gh,
    tone: (p.random() - .5) * .7,
  });
  const ids = new Uint16Array(p.w * p.h), dxs = new Float32Array(ids.length), dys = new Float32Array(ids.length);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    let nearest = Infinity;
    seeds.forEach((s, id) => {
      const dx = mod(x - s.x + p.w / 2, p.w) - p.w / 2;
      const dy = mod(y - s.y + p.h / 2, p.h) - p.h / 2;
      const d = angular ? Math.abs(dx) + Math.abs(dy * stretch) : dx * dx + (dy * stretch) ** 2;
      if (d < nearest) { nearest = d; ids[y * p.w + x] = id; dxs[y * p.w + x] = dx; dys[y * p.w + x] = dy; }
    });
  }
  const idAt = (x, y) => ids[mod(y, p.h) * p.w + mod(x, p.w)];
  const growth = moss ? blotches(p, 3) : null;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const i = y * p.w + x, self = ids[i];
    const top = idAt(x, y - 1) !== self, left = idAt(x - 1, y) !== self;
    const bottom = idAt(x, y + 1) !== self, right = idAt(x + 1, y) !== self;
    const light = clamp(-(dxs[i] + dys[i] * stretch * 1.5) / 5, -1, 1);
    let tone = base + seeds[self].tone + light * .8 + (p.random() - .5) * .65;
    if (top || left) tone += .8;
    if (bottom || right) tone -= .95;
    let color = ramp[clamp(Math.round(tone), 0, ramp.length - 1)];
    // Moss catches on the upper lips and in moist fissures, not broad green clouds.
    if (moss && growth(x, y) > .48 && (top || ((bottom || right) && p.random() < .6))) {
      color = MOSS[clamp(Math.round(tone + (top ? .3 : -.6)), 0, MOSS.length - 1)];
    }
    p.set(x, y, color);
  }
}

function ground(p, ramp, base = 3) {
  const fine = blotches(p, 3), grit = blotches(p, 5);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const relief = (fine(x - 1, y - 1) - fine(x + 1, y + 1)) * 1.5;
    const tone = base + (fine(x, y) - .5) * 2 + (grit(x, y) - .5) * .7 + relief + (p.random() - .5) * 1.7;
    p.set(x, y, ramp[clamp(Math.round(tone), 0, ramp.length - 1)]);
  }
}

/** Tiny translucent mineral/surface deposits, never larger than five texels. */
function stains(p, count, colors, strength = .35) {
  for (let i = 0; i < count; i++) {
    const cx = rint(p, p.w), cy = rint(p, p.h), r = 1 + rint(p, 2), color = rgb(pickOf(p, colors));
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy * 1.5 > r * r || p.random() < .2) continue;
      const x = mod(cx + dx, p.w), y = mod(cy + dy, p.h);
      p.set(x, y, mix(p.get(x, y), color, strength * (.65 + p.random() * .35)));
    }
  }
}

function crack(p, x, y, length, color, dx = .5, dy = 1) {
  for (let j = 0; j < length; j++) {
    p.set(mod(Math.round(x), p.w), mod(Math.round(y), p.h), color);
    x += dx + (p.random() - .5) * .8; y += dy;
  }
}

function pebble(p, x, y, ramp) {
  const wide = p.random() < .45;
  p.set(x, y, ramp[4]);
  if (wide) p.set(x + 1, y, ramp[3]);
  p.set(x + (wide ? 1 : 0), y + 1, ramp[1]);
  if (p.random() < .3) p.set(x - 1, y, ramp[5]);
}

function mushroom(p, x, y, teal = false) {
  // Cap is only two or three texels; a single shaded stalk anchors it.
  p.set(x, y + 1, teal ? '#728f82' : '#aaa68a');
  p.set(x, y, teal ? '#a5c8b8' : '#d5d1b8');
  p.set(x + 1, y, teal ? '#7ba99c' : '#b9baa0');
  if (p.random() < .4) p.set(x - 1, y, teal ? '#bed7c5' : '#e0dac0');
}

function chalk(p) {
  rock(p, CHALK, { base: 2.15, stretch: 1.55 });
  for (let i = 0; i < 11; i++) crack(p, rint(p, p.w), rint(p, p.h), 3 + rint(p, 4), '#726e65', p.random() - .5);
  stains(p, 7, ['#ad793d', '#b58b50', '#645e54'], .4);
  stains(p, 3, ['#454441'], .45);
  for (let i = 0; i < 26; i++) {
    const x = rint(p, p.w), y = rint(p, p.h);
    p.set(x, y, pickOf(p, ['#515654', '#666960', '#7b7c70']));
    if (p.random() < .25) p.set(x + 1, y, '#96998c');
  }
  // One tiny, worn ear scratch per 4 m tile; subdued ochre, not a large emblem.
  const x = rint(p, p.w), y = rint(p, p.h);
  for (const [dx, dy] of [[0, 1], [1, 0], [2, 0], [3, 1], [3, 2], [2, 3], [2, 4], [1, 4], [1, 2]]) {
    const px = mod(x + dx, p.w), py = mod(y + dy, p.h);
    p.set(px, py, mix(p.get(px, py), rgb('#985e48'), .6));
  }
}

function chalkFloor(p) {
  ground(p, CHALK_DUST, 2.65);
  stains(p, 105, ['#c4bdac', '#b1aa99'], .28);
  for (let i = 0; i < 155; i++) pebble(p, rint(p, p.w), rint(p, p.h), CHALK_DUST);
  for (let i = 0; i < 38; i++) {
    const x = rint(p, p.w), y = rint(p, p.h), len = 2 + rint(p, 3), slope = p.random() < .5 ? 0 : 1;
    for (let j = 0; j < len; j++) {
      p.set(x + j, y + j * slope + 1, '#827969');
      p.set(x + j, y + j * slope, j === 0 ? '#d4cbb5' : '#bfb7a2');
    }
    if (p.random() < .35) p.set(x, y - 1, '#c5bca5');
  }
  // Teeth: pale crown, ochre root; sparse enough to read as finds in the dust.
  for (let i = 0; i < 19; i++) {
    const x = rint(p, p.w), y = rint(p, p.h);
    p.set(x, y, '#d7ceba'); p.set(x + 1, y, '#bcb39e'); p.set(x, y + 1, '#a5977d');
  }
}

function moss(p) {
  rock(p, WET_ROCK, { base: 2.85, moss: true });
  for (let i = 0; i < 18; i++) {
    const x = rint(p, p.w), y = rint(p, p.h), len = 2 + rint(p, 5);
    for (let j = 0; j < len; j++) {
      const px = mod(x + (j > 3 ? 1 : 0), p.w), py = mod(y + j, p.h);
      p.set(px, py, mix(p.get(px, py), rgb('#344d48'), .3));
      if (j < 2) p.shade(mod(px - 1, p.w), py, .12);
    }
  }
  for (let i = 0; i < 7; i++) mushroom(p, rint(p, p.w), rint(p, p.h), i % 3 !== 0);
}

function mossFloor(p) {
  ground(p, MUD, 3.1);
  stains(p, 100, ['#32332d', '#484333'], .35);
  // Small islands of moss, with ragged fringes and brighter upper-left tips.
  for (let i = 0; i < 95; i++) {
    const x = rint(p, p.w), y = rint(p, p.h);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dy * dy > 5 || p.random() < .3) continue;
      p.set(x + dx, y + dy, MOSS[clamp(3 - Math.sign(dx + dy) + rint(p, 2), 0, 6)]);
    }
  }
  for (let i = 0; i < 105; i++) {
    const x = rint(p, p.w), y = rint(p, p.h), dir = p.random() < .5 ? -1 : 1;
    p.set(x, y, pickOf(p, ['#908064', '#877957', '#9b8963']));
    p.set(x + dir, y + 1, '#6b6248'); p.set(x + dir * 2, y + 1, '#807451');
    p.set(x + dir, y + 2, '#484a37');
  }
  for (let i = 0; i < 17; i++) {
    const x = rint(p, p.w), y = rint(p, p.h), w = 2 + rint(p, 3);
    for (let j = 0; j < w; j++) {
      p.set(x + j, y, j === 0 ? '#9aa79b' : '#7b8b81');
      p.set(x + j, y + 1, '#4a5d56');
    }
    p.set(x + 1, y + 2, '#46514a');
  }
  for (let i = 0; i < 24; i++) mushroom(p, rint(p, p.w), rint(p, p.h));
  for (let i = 0; i < 65; i++) pebble(p, rint(p, p.w), rint(p, p.h), MUD);
}

function iron(p) {
  rock(p, IRON_ROCK, { base: 3.15, stretch: 1.1, angular: true });
  stains(p, 22, ['#a85d3d', '#b87b48', '#814a3e'], .38);
  for (let i = 0; i < 17; i++) {
    const x = rint(p, p.w), y = rint(p, p.h), len = 3 + rint(p, 4), dx = p.random() < .5 ? -.7 : .7;
    crack(p, x, y, len, '#514c4b', dx, .6);
    if (i % 4 === 0) crack(p, x, y, 3, '#6b5350', -dx, .7);
    if (i % 2 === 0) p.set(x, y, i % 4 === 0 ? '#c3bcb0' : '#d5a06a');
  }
  // Short chisel bites: straight paired light/dark pixels, varied orientations.
  for (let i = 0; i < 19; i++) {
    const x = rint(p, p.w), y = rint(p, p.h), len = 2 + rint(p, 3), slope = p.random() < .5 ? 0 : 1;
    for (let j = 0; j < len; j++) {
      p.set(x + j, y + j * slope, '#c0a087');
      p.set(x + j, y + j * slope + 1, '#786056');
    }
  }
}

function ironFloor(p) {
  ground(p, MINE_EARTH, 2.95);
  stains(p, 90, ['#a15e3c', '#b17b4d', '#874e38'], .43);
  for (let i = 0; i < 290; i++) pebble(p, rint(p, p.w), rint(p, p.h), i % 3 ? MINE_EARTH : IRON_ROCK);
  for (let i = 0; i < 68; i++) {
    const x = rint(p, p.w), y = rint(p, p.h);
    p.set(x, y, '#56514c'); p.set(x + 1, y + 1, '#443e3b');
    p.set(x + 1, y, pickOf(p, ['#a08f78', '#b99260', '#b5b2a5']));
  }
  for (let i = 0; i < 22; i++) {
    const x = rint(p, p.w), y = rint(p, p.h), len = 3 + rint(p, 4), vertical = p.random() < .5;
    for (let j = 0; j < len; j++) {
      const px = x + (vertical ? 0 : j), py = y + (vertical ? j : Math.floor(j / 3));
      p.set(px + (vertical ? 1 : 0), py + (vertical ? 0 : 1), '#51473b');
      p.set(px, py, j === len - 1 ? '#a28b67' : pickOf(p, ['#817055', '#948060', '#70604a']));
    }
  }
}

export const CAVE_SURFACES = {
  caveChalk: [64, p => chalk(p)],
  caveChalkFloor: [128, p => chalkFloor(p)],
  caveMoss: [64, p => moss(p)],
  caveMossFloor: [128, p => mossFloor(p)],
  caveIron: [64, p => iron(p)],
  caveIronFloor: [128, p => ironFloor(p)],
};

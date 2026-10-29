// Large tiling surfaces: ground, walls, roofs and wood painted on 64×64 or 128×128 canvases.
// The texel density stays 16 per world unit (pixelTextures.js sets repeat = 16 / size), but a
// tile repeats only every 4 or 8 units and carries its own small things: clover, flowers, dry
// patches, half-buried stones, pebbles, roots, puddles, fallen leaves, moss in the joints, cracked
// and replaced bricks, patched plaster, odd shingles. Every painter gets the Painter (set, get,
// random, shade) from pixelTextures.js.
const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rint = (p, n) => Math.floor(p.random() * n);
const pickOf = (p, list) => list[rint(p, list.length)];

/** Wrapping value noise over the canvas: smooth blotches about `cell` texels across, 0..1. */
function blotches(p, cell) {
  const gw = Math.max(1, Math.round(p.w / cell)), gh = Math.max(1, Math.round(p.h / cell));
  const grid = Array.from({ length: gw * gh }, () => p.random());
  const at = (i, j) => grid[((j % gh) + gh) % gh * gw + ((i % gw) + gw) % gw];
  return (x, y) => {
    const fx = x / p.w * gw, fy = y / p.h * gh, i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return (at(i, j) * (1 - sx) + at(i + 1, j) * sx) * (1 - sy) + (at(i, j + 1) * (1 - sx) + at(i + 1, j + 1) * sx) * sy;
  };
}
/** Fills the canvas from a ramp, the index driven by blotches at two scales plus pixel noise. */
// No large blotches by default: a repeating canvas must carry only fine detail, or its repeats show.
// Broad light and colour variation comes from world-space noise in the terrain shader instead.
function ground(p, ramp, { big = 32, mid = 6, wBig = 0, wMid = .4, grain = .5, alt = null, altAt = 2 } = {}) {
  const b = blotches(p, big), m = blotches(p, mid);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const bv = b(x, y), v = clamp(bv * wBig + m(x, y) * wMid + p.random() * grain - .08, 0, .999);
    const r = alt && bv > altAt ? alt : ramp;
    p.set(x, y, r[Math.floor(v * r.length)]);
  }
  return b;
}
function pebble(p, x, y, colors = ['#8e8f88', '#9d9a8e', '#77756c', '#a8a395']) {
  p.set(x, y, pickOf(p, colors)); if (p.random() < .5) p.set(x + 1, y, pickOf(p, colors));
  p.shade(x, y + 1, -.45);
}
/** A rounded stone sunk into the ground: lit from the upper left, a dark lip below, a little moss. */
function stone(p, cx, cy, r, ramp, moss = 0) {
  const ry = r * (.6 + p.random() * .25);
  for (let dy = -Math.ceil(ry) - 1; dy <= Math.ceil(ry) + 1; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) {
    const d = (dx / r) ** 2 + (dy / ry) ** 2;
    if (d > 1.15) continue;
    if (d > 1) { if (dy > 0) p.shade(cx + dx, cy + dy, -.4); continue; }
    const lit = -(dx + dy * 1.4) / (r + ry);
    let c = ramp[clamp(Math.round(2 + lit * 2.4 + (p.random() - .5) * .9), 0, ramp.length - 1)];
    if (moss && dy < 0 && p.random() < moss) c = pickOf(p, ['#4d6a36', '#5b7a3e', '#3f5a2e']);
    p.set(cx + dx, cy + dy, c);
  }
}
function blob(p, cx, cy, r, paint) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const d = Math.hypot(dx, dy * 1.3) / r + (p.random() - .5) * .35;
    if (d < 1) paint(cx + dx, cy + dy, d);
  }
}
function walk(p, x, y, length, color, { dx = 0, dy = 0, wobble = .5 } = {}) {
  if (!dx && !dy) { const a = p.random() * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a); }
  for (let i = 0; i < length; i++) {
    p.set(Math.round(x), Math.round(y), color);
    x += dx + (p.random() - .5) * wobble; y += dy + (p.random() - .5) * wobble;
  }
}

// ── Ground layers (128 × 128).
const LUSH = ['#2f4a28', '#3a5730', '#456638', '#517341', '#5d8049', '#6a8c51', '#789a5a'];
const FLOWERS = [['#e9e6d8', '#f2d24a'], ['#f0cf55', '#c48a22'], ['#9a7cc4', '#e9e6d8'], ['#d9473f', '#f2d24a'], ['#e9e6d8', '#e9e6d8'], ['#6f8fd0', '#e9e6d8']];
function grass(p) {
  const big = ground(p, LUSH, { big: 40, mid: 5 });
  // Blades: a light tip over a darker base, thicker where the grass grows lush.
  for (let i = 0; i < 640; i++) {
    const x = rint(p, p.w), y = rint(p, p.h), c = p.get(x, y);
    p.set(x, y, mix(c, [160, 196, 112], .3)); p.set(x, y + 1, mix(c, [12, 22, 8], .22));
  }
  for (let i = 0; i < 18; i++) {
    const cx = rint(p, p.w), cy = rint(p, p.h);
    for (let k = 0, n = 3 + rint(p, 6); k < n; k++) {
      const x = cx + rint(p, 9) - 4, y = cy + rint(p, 7) - 3, leaf = k % 2 ? '#5f9446' : '#6ea552';
      p.set(x, y, leaf); p.set(x + 1, y, leaf); p.set(x, y + 1, leaf); p.set(x + 1, y + 1, '#3d6230');
    }
  }
  for (let i = 0; i < 30; i++) {
    const [a, b] = pickOf(p, FLOWERS), x = rint(p, p.w), y = rint(p, p.h);
    if (big(x, y) > .8) continue;
    p.set(x, y, a); if (p.random() < .45) { p.set(x + 1, y, a); p.set(x, y + 1, b); }
  }
  for (let i = 0; i < 24; i++) pebble(p, rint(p, p.w), rint(p, p.h));
  for (let i = 0; i < 4; i++) stone(p, rint(p, p.w), rint(p, p.h), 2 + rint(p, 3), ['#4d4f4c', '#5d605c', '#6e716c', '#7f827b', '#90938b'], .35);
  for (let i = 0; i < 50; i++) p.set(rint(p, p.w), rint(p, p.h), pickOf(p, ['#4a382b', '#564132', '#3e2e24']));
}
function path(p) {
  ground(p, ['#54442f', '#5f4d36', '#6a573e', '#766246', '#826d4f', '#8e795a'], { mid: 5 });
  for (let i = 0; i < 520; i++) { const x = rint(p, p.w), y = rint(p, p.h); p.set(x, y, pickOf(p, ['#8d8676', '#9d9584', '#6e675a', '#a59a83', '#5b5246', '#b1a690'])); if (p.random() < .3) p.shade(x, y + 1, -.35); }
  for (let i = 0; i < 8; i++) stone(p, rint(p, p.w), rint(p, p.h), 2 + rint(p, 4), ['#5a554b', '#68625a', '#767065', '#857e71', '#948c7e']);
  for (let i = 0; i < 4; i++) {
    const cx = rint(p, p.w), cy = rint(p, p.h);
    blob(p, cx, cy, 3 + rint(p, 4), (x, y, d) => p.set(x, y, d > .75 ? '#4c3d2b' : d < .35 && p.random() < .4 ? '#6b7477' : '#433629'));
  }
  for (let i = 0; i < 14; i++) { const cx = rint(p, p.w), cy = rint(p, p.h); for (let k = 0; k < 4 + rint(p, 4); k++) p.set(cx + rint(p, 4), cy + rint(p, 3), pickOf(p, LUSH.slice(2, 6))); }
  for (let i = 0; i < 14; i++) { const x = rint(p, p.w), y = rint(p, p.h); for (const [dx, dy] of [[0, 0], [2, 0], [0, 1], [2, 1], [1, 2]]) p.shade(x + dx, y + dy, -.28); }
}
function dirt(p) {
  ground(p, ['#3e2e24', '#4a382b', '#564132', '#624b39', '#6e5540', '#7a6048'], { mid: 5 });
  for (let i = 0; i < 9; i++) walk(p, rint(p, p.w), rint(p, p.h), 6 + rint(p, 10), '#2e2219', { wobble: .9 });
  for (let i = 0; i < 40; i++) pebble(p, rint(p, p.w), rint(p, p.h), ['#7c776d', '#68645c', '#8a8478']);
  for (let i = 0; i < 3; i++) stone(p, rint(p, p.w), rint(p, p.h), 2 + rint(p, 2), ['#4f4c46', '#5f5c55', '#6f6b63', '#7f7a70', '#8e897e']);
  for (let i = 0; i < 60; i++) p.set(rint(p, p.w), rint(p, p.h), '#86694e');
}
function litter(p) {
  ground(p, ['#3a2a1a', '#46331f', '#523c24', '#5e4529', '#6a4e2e'], { mid: 5 });
  // A carpet of fallen leaves: mostly gold and amber, some rust and red, a little green still.
  const leaves = ['#9a4a1e', '#b45e22', '#c87a2a', '#d49a36', '#b89030', '#c8a040', '#8a6a26', '#6a7a32', '#8e4e24', '#a8682a', '#7a2a1a'];
  for (let i = 0; i < 900; i++) {
    const x = rint(p, p.w), y = rint(p, p.h), c = pickOf(p, leaves);
    p.set(x, y, c); p.set(x + 1, y, c); if (p.random() < .5) p.set(x, y + 1, c);
    if (p.random() < .5) p.set(x + 1, y + 1, mix(rgb(c), [20, 12, 6], .4));
  }
  for (let i = 0; i < 30; i++) walk(p, rint(p, p.w), rint(p, p.h), 4 + rint(p, 7), '#2a1f16', { wobble: .3 });
  for (let i = 0; i < 160; i++) { const x = rint(p, p.w), y = rint(p, p.h); p.set(x, y, '#7a6a44'); p.set(x + 1, y + 1, '#6a5a3a'); }
  for (let i = 0; i < 12; i++) blob(p, rint(p, p.w), rint(p, p.h), 2 + rint(p, 4), (x, y) => p.set(x, y, pickOf(p, ['#3a5a2a', '#466a31', '#52763a'])));
  for (let i = 0; i < 4; i++) { const x = rint(p, p.w), y = rint(p, p.h), cap = p.random() < .5 ? '#b23a2a' : '#c9b48c'; p.set(x, y, cap); p.set(x + 1, y, cap); p.set(x, y + 1, '#d8d0bc'); }
}
function mud(p) {
  ground(p, ['#272119', '#2f281f', '#382f25', '#41372b', '#4a3f31'], { mid: 5 });
  for (let i = 0; i < 5; i++) blob(p, rint(p, p.w), rint(p, p.h), 3 + rint(p, 5), (x, y, d) => p.set(x, y, d > .7 ? '#2a2620' : p.random() < .2 ? '#7d8a8c' : '#3b4245'));
  for (let i = 0; i < 90; i++) p.set(rint(p, p.w), rint(p, p.h), pickOf(p, ['#6b6a62', '#55534c', '#5f5a50']));
  for (let i = 0; i < 8; i++) { const x = rint(p, p.w), y = rint(p, p.h); for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2], [3, 4], [4, 4], [3, 5], [4, 5], [3, 6], [4, 6]]) p.set(x + dx, y + dy, '#201b15'); }
  for (let i = 0; i < 10; i++) { const x = rint(p, p.w), y = rint(p, p.h); for (let k = 0; k < 3; k++) p.set(x, y - k, pickOf(p, ['#5a5a32', '#6e6c3a'])); }
}
function sand(p) {
  ground(p, ['#665c4a', '#726753', '#7e725c', '#8a7d65', '#95886e'], { mid: 4 });
  const chips = ['#8f8d86', '#b8b3a6', '#6b5640', '#4a4640', '#a29a88', '#7a7c80'];
  for (let i = 0; i < 380; i++) pebble(p, rint(p, p.w), rint(p, p.h), [pickOf(p, chips)]);
  for (let i = 0; i < 9; i++) stone(p, rint(p, p.w), rint(p, p.h), 2 + rint(p, 3), ['#55565a', '#66676a', '#77787a', '#88898a', '#9a9b9a']);
}
function snow(p) {
  ground(p, ['#aab6bd', '#b9c4ca', '#c8d1d6', '#d6dee2', '#e3e9ec'], { mid: 5, grain: .35 });
  for (let i = 0; i < 40; i++) p.set(rint(p, p.w), rint(p, p.h), '#f6fafb');
  for (let i = 0; i < 4; i++) blob(p, rint(p, p.w), rint(p, p.h), 3 + rint(p, 4), (x, y) => p.shade(x, y, -.08));
}

// ── Stone (64 × 64).
function rock(p, ramp) {
  // Strata: bands of slightly different stone, broken by cracks and spotted with lichen.
  const b = blotches(p, 16);
  for (let y = 0; y < p.h; y++) {
    const band = Math.floor(y / (5 + (y * 7 % 3))) % 3;
    for (let x = 0; x < p.w; x++) p.set(x, y, ramp[clamp(Math.round(1 + band * .6 + b(x, y) * 1.6 + (p.random() - .5) * 1.4), 0, ramp.length - 1)]);
  }
  for (let i = 0; i < 9; i++) walk(p, rint(p, p.w), rint(p, p.h), 5 + rint(p, 9), '#2e3030', { dx: p.random() - .5, dy: 1, wobble: .8 });
  for (let i = 0; i < 14; i++) blob(p, rint(p, p.w), rint(p, p.h), 1 + rint(p, 2), (x, y) => p.set(x, y, pickOf(p, ['#9a9a52', '#a58a48', '#6e7a46', '#b0a27a'])));
  for (let i = 0; i < 40; i++) p.set(rint(p, p.w), rint(p, p.h), ramp[ramp.length - 1]);
}
const STONES = [['#4f5252', '#5c5f5f', '#696c6c', '#777a79', '#858887'], ['#55504a', '#625c55', '#6f6960', '#7c756b', '#898177'],
  ['#4a5056', '#565d63', '#636a70', '#70777c', '#7d8489'], ['#5b5a52', '#68675e', '#76746a', '#838176', '#908e82']];
const EARTH = ['#5a4a36', '#4e4232', '#6a5a40', '#463a2a'];
function cobble(p, { moss = 0, mortar = '#46443f', stoneSize = 70, vary = 0, dirt = 0, ramps = STONES, cracks = .12, stretch = 1.2 } = {}) {
  // Irregular stones of different sizes (vary) and kinds; a few cracked, a few sunk, some lost to
  // bare earth, moss or dirt in some joints.
  const seeds = Array.from({ length: Math.round(p.w * p.h / stoneSize) }, () => ({ x: p.random() * p.w, y: p.random() * p.h, ramp: pickOf(p, ramps), tone: rint(p, 3), sunk: p.random() < .08, crack: p.random() < cracks, k: 1 / (1 + (p.random() - .5) * vary) ** 2, gone: p.random() < dirt * .05 }));
  const owner = (x, y) => {
    let best = 0, d1 = Infinity;
    seeds.forEach((s, i) => { for (const ox of [-p.w, 0, p.w]) for (const oy of [-p.h, 0, p.h]) { const d = ((x - s.x - ox) ** 2 + ((y - s.y - oy) * stretch) ** 2) * s.k; if (d < d1) { d1 = d; best = i; } } });
    return best;
  };
  const ids = new Int32Array(p.w * p.h);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) ids[y * p.w + x] = owner(x + .5, y + .5);
  const id = (x, y) => ids[((y + p.h) % p.h) * p.w + ((x + p.w) % p.w)];
  const mossy = blotches(p, 20);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const self = id(x, y), s = seeds[self];
    if (s.gone) { p.set(x, y, pickOf(p, EARTH)); continue; }
    if (id(x + 1, y) !== self || id(x, y + 1) !== self) { p.set(x, y, moss && mossy(x, y) > 1 - moss && p.random() < .7 ? pickOf(p, ['#3c522f', '#4a6338']) : p.random() < dirt ? pickOf(p, EARTH) : mortar); continue; }
    // Bevel: lit along the top and left of each stone, shaded just inside the joint below and right.
    let shade = s.tone + 1 + (p.random() < .2 ? (p.random() < .5 ? -1 : 1) : 0);
    if (id(x - 1, y) !== self || id(x, y - 1) !== self) shade++;
    else if (id(x + 2, y) !== self || id(x, y + 2) !== self) shade--;
    if (s.sunk) shade -= 2;
    p.set(x, y, s.ramp[clamp(shade, 0, 4)]);
  }
  for (const s of seeds) if (s.crack) walk(p, s.x, s.y, 3 + rint(p, 3), '#2c2e2e', { wobble: 1 });
}
/** Granite setts laid in courses: every row its own offset, setts of their own widths, stones and wear. */
const SETTS = [['#4f5052', '#5d5e60', '#6b6c6e', '#7a7b7c', '#88898a'], ['#55524c', '#63605a', '#716e67', '#7f7b74', '#8d8981'],
  ['#4c5054', '#5a5e62', '#686c70', '#767a7e', '#84888c'], ['#5e584e', '#6c665b', '#7a7468', '#888175', '#958e82']];
function setts(p, { course = 5, minW = 5, maxW = 8, mortar = '#3e3b35', dirt = .25 } = {}) {
  for (let row = 0; row < p.h / course; row++) {
    const start = rint(p, maxW) - p.w;
    for (let bx = start; bx < start + p.w;) {
      const w = minW + rint(p, maxW - minW + 1), ramp = pickOf(p, SETTS), base = 1 + rint(p, 2), sunk = p.random() < .07, worn = p.random() < .3;
      for (let j = 0; j < course; j++) for (let i = 0; i < w; i++) {
        const px = bx + i, py = row * course + j, corner = (i === 0 || i === w - 2) && (j === 0 || j === course - 2);
        if (j === course - 1 || i === w - 1 || (corner && p.random() < .45)) { p.set(px, py, p.random() < dirt ? pickOf(p, EARTH) : mortar); continue; }
        let shade = base + (p.random() < .18 ? (p.random() < .5 ? -1 : 1) : 0) + (worn && j > 0 && j < course - 2 && i > 0 && i < w - 2 ? 1 : 0);
        if (j === 0 || i === 0) shade++; else if (j === course - 2 || i === w - 2) shade--;
        p.set(px, py, ramp[clamp(shade - (sunk ? 1 : 0), 0, ramp.length - 1)]);
      }
      bx += w;
    }
  }
  // Straw blown into the joints and a few dark droppings.
  for (let i = 0; i < 10; i++) walk(p, rint(p, p.w), rint(p, p.h), 2 + rint(p, 3), pickOf(p, ['#b0984e', '#9a8440']), { dx: p.random() - .5, dy: p.random() - .5, wobble: .6 });
  for (let i = 0; i < 4; i++) blob(p, rint(p, p.w), rint(p, p.h), 1, (x, y) => p.set(x, y, pickOf(p, ['#4a3a26', '#5a4630'])));
}
const FLAGS = [['#58554e', '#64615a', '#706d65', '#7c7970', '#88857b'], ['#524f49', '#5e5b54', '#6a675f', '#76736a', '#827e75'],
  ['#5c5448', '#686053', '#746b5e', '#807769', '#8c8274'], ['#4e5052', '#5a5c5e', '#66686a', '#727476', '#7e8082']];
/** Courses of blocks with their own widths and tones; chipped corners, the odd crack, moss low in joints. */
function masonry(p, ramps, { course = 8, minW = 8, maxW = 22, mortar = '#4a4843', moss = 0, chip = .35 } = {}) {
  const mossy = blotches(p, 24);
  for (let row = 0; row < p.h / course; row++) {
    let x = rint(p, maxW);
    const start = x - p.w;
    for (let bx = start; bx < start + p.w;) {
      const w = minW + rint(p, maxW - minW + 1), ramp = pickOf(p, ramps), base = 1 + rint(p, 3), cracked = p.random() < .1;
      for (let j = 0; j < course; j++) for (let i = 0; i < w; i++) {
        const px = bx + i, py = row * course + j;
        if (j === course - 1 || i === w - 1) { p.set(px, py, moss && mossy(px, py) > 1 - moss && p.random() < .6 ? pickOf(p, ['#3c522f', '#4a6338']) : mortar); continue; }
        let shade = base + (p.random() < .16 ? (p.random() < .5 ? -1 : 1) : 0);
        if (j === 0 || i === 0) shade++;
        else if (j === course - 2 || i === w - 2) shade--;
        p.set(px, py, ramp[clamp(shade, 0, ramp.length - 1)]);
      }
      if (p.random() < chip) p.set(bx + (p.random() < .5 ? 0 : w - 2), row * course + (p.random() < .5 ? 0 : course - 2), mortar);
      if (cracked) walk(p, bx + 2 + rint(p, Math.max(1, w - 4)), row * course, course - 1, '#343635', { dx: 0, dy: 1, wobble: .9 });
      bx += w;
    }
  }
}
function plaster(p, ramp, { bricks = 2 } = {}) {
  // Lime plaster: soft stains, hairline cracks, grime, and patches where it fell off to the bricks.
  ground(p, ramp, { mid: 6, wMid: .25, grain: .3 });
  const stain = blotches(p, 14);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (stain(x, y) > .82) p.shade(x, y, -.05);
  for (let i = 0; i < 6; i++) walk(p, rint(p, p.w), rint(p, p.h), 4 + rint(p, 8), mix(rgb(ramp[0]), [30, 26, 22], .35), { dx: p.random() - .5, dy: 1, wobble: 1 });
  for (let n = 0; n < bricks; n++) {
    const cx = rint(p, p.w), cy = rint(p, p.h), w = 6 + rint(p, 8), h = 4 + rint(p, 5);
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
      const edge = y < 0 || x < 0 || y === h || x === w;
      if (edge) { if (p.random() < .7) p.shade(cx + x, cy + y, -.22); continue; }
      const brick = (y % 3 === 2) || ((x + (Math.floor(y / 3) % 2) * 2) % 5 === 4);
      p.set(cx + x, cy + y, brick ? '#4a3a32' : pickOf(p, ['#7a4a3a', '#86523f', '#6e4434']));
    }
  }
  for (let i = 0; i < 60; i++) p.set(rint(p, p.w), rint(p, p.h), mix(rgb(ramp[1]), [40, 34, 28], .3));
}
/** Boards of varying length with butt joints, nails, knots and splits. */
function boards(p, ramp, { vertical = false, width = 4, weathered = 0 } = {}) {
  const W = vertical ? p.h : p.w, rows = (vertical ? p.w : p.h) / width;
  const put = (a, b, c) => vertical ? p.set(b, a, c) : p.set(a, b, c);
  const dark = mix(rgb(ramp[0]), [10, 8, 6], .35);
  for (let row = 0; row < rows; row++) {
    let a = rint(p, 24);
    const start = a - W;
    for (let x = start; x < start + W;) {
      const len = 14 + rint(p, 30), base = rint(p, ramp.length - 1), grainPhase = p.random() * 6;
      for (let i = 0; i < len; i++) for (let j = 0; j < width; j++) {
        const grain = Math.sin((x + i) * .55 + grainPhase + j * 1.9) > .65 ? -1 : 0;
        let shade = clamp(base + grain + (p.random() < .1 ? 1 : 0), 0, ramp.length - 1);
        let c = rgb(ramp[shade]);
        if (j === width - 1) c = dark; else if (j === 0) c = rgb(ramp[Math.min(ramp.length - 1, shade + 1)]);
        if (i === 0 && j < width - 1) c = mix(rgb(ramp[0]), [10, 8, 6], .25);
        if (weathered && p.random() < weathered) c = mix(c, [150, 150, 140], .35);
        put(x + i, row * width + j, c);
      }
      // Nails at the joint, a knot or a split now and then.
      put(x + 1, row * width + 1, '#2a2420'); if (width > 3) put(x + 1, row * width + width - 2, '#2a2420');
      if (p.random() < .35) { const k = x + 4 + rint(p, Math.max(1, len - 8)); put(k, row * width + 1, dark); put(k + 1, row * width + 1, rgb(ramp[0])); put(k, row * width + 2, rgb(ramp[0])); }
      if (p.random() < .2) { const k = x + 2 + rint(p, Math.max(1, len - 6)); for (let s = 0; s < 4 + rint(p, 6); s++) put(k + s, row * width + 2, dark); }
      x += len;
    }
  }
}
/** Rows of shingles or tiles with their own widths; the odd replaced, cracked or mossy one. */
function shingles(p, ramp, { row = 4, minW = 3, maxW = 6, moss = .18, curve = false } = {}) {
  const mossy = blotches(p, 18), gap = mix(rgb(ramp[0]), [6, 8, 10], .45);
  for (let r = 0; r < p.h / row; r++) {
    const start = rint(p, maxW) - p.w;
    for (let x = start; x < start + p.w;) {
      const w = curve ? 4 : minW + rint(p, maxW - minW + 1), replaced = p.random() < .07, base = clamp(rint(p, ramp.length) + (replaced ? 1 : 0), 0, ramp.length - 1);
      for (let j = 0; j < row; j++) for (let i = 0; i < w; i++) {
        let c;
        if (j === row - 1) c = gap;
        else {
          const round = curve ? Math.abs(i - (w - 1) / 2) / (w / 2) : 0;
          let shade = base + (j === 0 ? 1 : 0) - (i === w - 1 ? 1 : 0) - (round > .7 ? 1 : 0);
          c = rgb(ramp[clamp(shade, 0, ramp.length - 1)]);
          if (replaced) c = mix(c, [120, 110, 90], .18);
          if (moss && mossy(x + i + p.w, r * row + j) > 1 - moss && p.random() < .55) c = rgb(pickOf(p, ['#3c522f', '#4a6338', '#577242']));
        }
        p.set(x + i, r * row + j, c);
      }
      if (p.random() < .05) p.set(x + 1 + rint(p, Math.max(1, w - 2)), r * row + 1, gap);
      x += w;
    }
  }
}
function thatch(p, ramp) {
  ground(p, ramp, { big: 16, mid: 5, grain: .6 });
  for (let i = 0; i < 260; i++) { const x = rint(p, p.w), y = rint(p, p.h), c = p.random() < .5 ? ramp[ramp.length - 1] : ramp[0]; for (let j = 0; j < 3 + rint(p, 3); j++) p.set(x + j, y + j, c); }
  for (let y = 7; y < p.h; y += 8) for (let x = 0; x < p.w; x++) p.shade(x, y, -.2);
  const mossy = blotches(p, 20);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (mossy(x, y) > .8 && p.random() < .35) p.set(x, y, pickOf(p, ['#4d5a30', '#5a6634']));
}
function bark(p, ramp) {
  for (let x = 0; x < p.w;) {
    const w = 1 + rint(p, 3), base = rint(p, ramp.length);
    for (let i = 0; i < w; i++) for (let y = 0; y < p.h; y++) p.set(x + i, y, ramp[clamp(base + (p.random() < .25 ? (p.random() < .5 ? -1 : 1) : 0), 0, ramp.length - 1)]);
    x += w;
  }
  for (let i = 0; i < 18; i++) walk(p, rint(p, p.w), rint(p, p.h), 3 + rint(p, 6), '#211812', { dx: 0, dy: 1, wobble: .3 });
  for (let i = 0; i < 4; i++) { const x = rint(p, p.w), y = rint(p, p.h); for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) p.set(x + dx, y + dy, '#1a120d'); p.set(x - 1, y, ramp[ramp.length - 1]); }
  for (let i = 0; i < 8; i++) blob(p, rint(p, p.w), rint(p, p.h), 1 + rint(p, 2), (x, y) => p.set(x, y, pickOf(p, ['#5a6a3a', '#6e7a46', '#8a8a5a'])));
}

/** name → [size, painter(p, ramps)]. Ramps come from pixelTextures.js so palettes stay in one place. */
export const SURFACES = {
  grass: [128, p => grass(p)], path: [128, p => path(p)], dirt: [128, p => dirt(p)], litter: [128, p => litter(p)],
  mud: [128, p => mud(p)], sand: [128, p => sand(p)], snow: [64, p => snow(p)],
  stone: [64, (p, R) => rock(p, R.stone)], stoneLight: [64, (p, R) => rock(p, R.stoneLight)],
  // Street paving: rough field cobbles in the alleys, granite setts on the main streets, flagstones on squares.
  cobble: [128, p => cobble(p, { vary: .8, dirt: .35 })], cobbleMossy: [64, p => cobble(p, { moss: .35 })],
  setts: [128, p => setts(p)],
  flagstone: [128, p => cobble(p, { stoneSize: 300, stretch: 1, mortar: '#3a3732', vary: .5, dirt: .2, cracks: .4, ramps: FLAGS })],
  bricks: [64, (p, R) => masonry(p, [R.stone, STONES[2], STONES[3]], { course: 4, minW: 6, maxW: 9 })],
  ashlar: [64, (p, R) => masonry(p, [R.stoneLight, ['#7f7c72', '#8d8a7f', '#9b988c', '#a8a598', '#b5b2a4']], { course: 8, minW: 10, maxW: 24 })],
  ashlarMossy: [64, (p, R) => masonry(p, [R.stoneLight, ['#7f7c72', '#8d8a7f', '#9b988c', '#a8a598', '#b5b2a4']], { course: 8, minW: 10, maxW: 24, moss: .35 })],
  plaster: [64, (p, R) => plaster(p, R.plaster)],
  planks: [64, (p, R) => boards(p, R.oak)], darkPlanks: [64, (p, R) => boards(p, R.darkOak)], planksVertical: [64, (p, R) => boards(p, R.oak, { vertical: true })],
  bark: [64, (p, R) => bark(p, R.bark)],
  slate: [64, (p, R) => shingles(p, R.slate, { minW: 3, maxW: 5 })], redRoof: [64, (p, R) => shingles(p, R.redRoof, { minW: 4, maxW: 6 })],
  thatch: [64, (p, R) => thatch(p, R.thatch)],
  // New families so streets are not built from a handful of textures.
  brickRed: [64, p => masonry(p, [['#5a2c22', '#6c3628', '#7c402f', '#8a4a36', '#97563f'], ['#62342a', '#743e30', '#844837', '#93523f', '#a05e48'], ['#4e2a22', '#5e3329', '#6c3c30']], { course: 4, minW: 7, maxW: 9, mortar: '#7a7266', chip: .2 })],
  sandstone: [64, p => masonry(p, [['#8a7350', '#9a825c', '#a99068', '#b79e75', '#c4ab82'], ['#7e6a4c', '#8e7957', '#9d8762', '#ab956e', '#b9a37a']], { course: 8, minW: 12, maxW: 26, mortar: '#5e5240' })],
  fieldstone: [64, p => cobble(p, { mortar: '#77705f', stoneSize: 110 })],
  granite: [64, p => masonry(p, [['#5a5a5e', '#68686c', '#77777a', '#858588', '#949497'], ['#62605c', '#706e69', '#7e7c77', '#8c8a84', '#9a9892']], { course: 8, minW: 8, maxW: 18, mortar: '#2e2e30', chip: .5 })],
  clayTile: [64, p => shingles(p, ['#6e2e1a', '#82391f', '#964425', '#a6512c', '#b25d34'], { row: 4, curve: true, moss: .12 })],
  woodShingle: [64, p => shingles(p, ['#4a3f34', '#574a3d', '#645545', '#71604e', '#7d6b57'], { row: 4, minW: 2, maxW: 4, moss: .25 })],
  planksWeathered: [64, p => boards(p, ['#5a5448', '#6a6355', '#7a7262', '#89806e', '#968d7a'], { weathered: .08 })],
  planksPainted: [64, p => boards(p, ['#2f4a52', '#365560', '#3e616c', '#476d78'], { weathered: .05 })],
  plasterRough: [64, p => plaster(p, ['#a08a62', '#ad976d', '#b9a378', '#c4ae83'], { bricks: 3 })],
};

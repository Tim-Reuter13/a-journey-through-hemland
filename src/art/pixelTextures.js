import * as THREE from 'three';
import { SURFACES } from './surfaces.js';

// Procedural 16×16 pixel textures. Every surface in the world draws from this
// library so texel density and palette stay consistent (see ART_DIRECTION.md).
const SIZE = 16;
const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function seeded(seed) {
  let a = seed >>> 0;
  return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hashName = name => [...name].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;

class Painter {
  constructor(name, w = SIZE, h = SIZE) {
    this.w = w; this.h = h; this.data = new Uint8ClampedArray(w * h * 4);
    this.random = seeded(hashName(name));
  }
  wrap(x, y) { return [((x % this.w) + this.w) % this.w, ((y % this.h) + this.h) % this.h]; }
  set(x, y, color, alpha = 255) {
    [x, y] = this.wrap(x, y);
    const i = (y * this.w + x) * 4, c = typeof color === 'string' ? rgb(color) : color;
    this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = alpha;
  }
  get(x, y) { [x, y] = this.wrap(x, y); const i = (y * this.w + x) * 4; return [this.data[i], this.data[i + 1], this.data[i + 2]]; }
  alpha(x, y) { [x, y] = this.wrap(x, y); return this.data[(y * this.w + x) * 4 + 3]; }
  clear() { this.data.fill(0); }
  // Weighted pick from a dark→light ramp; bias shifts toward lighter shades.
  pick(ramp, bias = 0) {
    const v = THREE.MathUtils.clamp(this.random() * .82 + .09 + bias, 0, .999);
    return ramp[Math.floor(Math.pow(v, 1.05) * ramp.length)];
  }
  noise(ramp, bias = 0) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.set(x, y, this.pick(ramp, bias)); }
  shade(x, y, amount) {
    const c = this.get(x, y);
    this.set(x, y, amount > 0 ? mix(c, [255, 250, 235], amount) : mix(c, [8, 10, 14], -amount), this.alpha(x, y));
  }
  rect(x, y, w, h, color) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, color); }
}

const RAMPS = {
  grass: ['#3d5730', '#486638', '#537340', '#5f8047', '#6b8d4f'],
  dirt: ['#46342a', '#553f30', '#634a37', '#71553f', '#7e6148'],
  path: ['#5f4f3d', '#6d5b46', '#7a6750', '#877459', '#958164'],
  stone: ['#555858', '#626565', '#6f7272', '#7c7f7e', '#8a8d8b'],
  stoneLight: ['#7a7b76', '#888983', '#96978f', '#a3a49c', '#b1b2a9'],
  moss: ['#3c522f', '#4a6338', '#577242'],
  oak: ['#5e4029', '#6d4b30', '#7a5637', '#87613f', '#946c47'],
  darkOak: ['#33231a', '#3e2b1f', '#4a3425', '#553d2b'],
  bark: ['#2e221a', '#3a2b20', '#463427', '#523e2e'],
  birch: ['#c9c2b0', '#d6d0bf', '#e2ddcf', '#ebe7db'],
  plaster: ['#9f927b', '#ab9e86', '#b6a990', '#c1b49b'],
  slate: ['#2b3a3c', '#344546', '#3d5051', '#475b5c'],
  redRoof: ['#542b24', '#62332a', '#703b30', '#7d4537'],
  thatch: ['#6f5a31', '#7f6839', '#8f7642', '#9e844c'],
  oakLeaves: ['#2d4626', '#38542d', '#436235', '#4f703d', '#5c7f46'],
  spruceLeaves: ['#1c2f27', '#23392e', '#2b4436', '#33503e'],
  autumnLeaves: ['#6e331c', '#844124', '#9a502b', '#ad6033', '#bd733c'],
  iron: ['#4f5458', '#61676b', '#747a7e', '#899094', '#a2a8ab'],
  brass: ['#5f4722', '#7a5d2c', '#957438', '#ae8c47', '#c6a55c'],
  water: ['#1b343d', '#203e48', '#264853', '#2d535f'],
  snow: ['#bcc7cb', '#c9d3d6', '#d6dee0', '#e3e9ea'],
  ember: ['#7a2410', '#b5401a', '#e0692a', '#f59a3f', '#ffd17a'],
  crystal: ['#1f6b7a', '#2f8e9c', '#4fb7c2', '#86dde2', '#c8f6f4'],
  litter: ['#43301f', '#553b25', '#68472b', '#7a5532', '#8c6238'],
  mud: ['#2c2620', '#37302a', '#433a32', '#4f453b'],
  sand: ['#6f6551', '#7c715a', '#887c64', '#94886e'],
  pineLeaves: ['#16261f', '#1c3027', '#233a2f', '#2b4537'],
  reeds: ['#5a5a32', '#6e6c3a', '#828044', '#97934f'],
  deadGrass: ['#6a5a3a', '#7d6b44', '#8f7c4e', '#a08c58'],
};

const GENERATORS = {
  grass(p) {
    p.noise(RAMPS.grass);
    for (let i = 0; i < 9; i++) { const x = Math.floor(p.random() * 16), y = Math.floor(p.random() * 16); p.set(x, y, RAMPS.grass[4]); p.set(x, y + 1, RAMPS.grass[2]); }
    for (let i = 0; i < 5; i++) { const x = Math.floor(p.random() * 16), y = Math.floor(p.random() * 16); p.set(x, y, RAMPS.grass[0]); p.set(x + 1, y, RAMPS.grass[1]); }
  },
  dirt(p) {
    p.noise(RAMPS.dirt);
    for (let i = 0; i < 5; i++) { const x = Math.floor(p.random() * 16), y = Math.floor(p.random() * 16); p.set(x, y, '#7c776d'); p.set(x + 1, y, '#68645c'); }
  },
  path(p) {
    p.noise(RAMPS.path);
    for (let i = 0; i < 7; i++) { const x = Math.floor(p.random() * 16), y = Math.floor(p.random() * 16); p.set(x, y, '#a49a86'); p.set(x, y + 1, '#6d6455'); }
    for (let i = 0; i < 4; i++) { const x = Math.floor(p.random() * 16), y = Math.floor(p.random() * 16); p.set(x, y, RAMPS.path[0]); }
  },
  stone(p) { stoneBase(p, RAMPS.stone); },
  stoneLight(p) { stoneBase(p, RAMPS.stoneLight); },
  cobble(p) { cobble(p, RAMPS.stone, '#3a3c3c'); },
  cobbleMossy(p) { cobble(p, RAMPS.stone, '#3a3c3c'); mossOver(p, .32); },
  bricks(p) { bricks(p, RAMPS.stone, 8, 4); },
  ashlar(p) { bricks(p, RAMPS.stoneLight, 16, 8); },
  ashlarMossy(p) { bricks(p, RAMPS.stoneLight, 16, 8); mossOver(p, .22); },
  planks(p) { planks(p, RAMPS.oak, false); },
  darkPlanks(p) { planks(p, RAMPS.darkOak, false); },
  planksVertical(p) { planks(p, RAMPS.oak, true); },
  bark(p) {
    for (let x = 0; x < 16; x++) {
      const base = Math.floor(p.random() * 4);
      for (let y = 0; y < 16; y++) p.set(x, y, RAMPS.bark[THREE.MathUtils.clamp(base + (p.random() < .25 ? (p.random() < .5 ? -1 : 1) : 0), 0, 3)]);
    }
    for (let i = 0; i < 5; i++) { const x = Math.floor(p.random() * 16), y = Math.floor(p.random() * 16), len = 3 + Math.floor(p.random() * 5); for (let j = 0; j < len; j++) p.set(x, y + j, '#211812'); }
  },
  logTop(p) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      if (d > 6.5) p.set(x, y, RAMPS.bark[1 + (x + y) % 2]);
      else p.set(x, y, Math.floor(d) % 2 ? '#8a6843' : '#9e7b51');
    }
  },
  birch(p) {
    p.noise(RAMPS.birch, .1);
    for (let i = 0; i < 7; i++) { const x = Math.floor(p.random() * 16), y = Math.floor(p.random() * 16), len = 2 + Math.floor(p.random() * 3); for (let j = 0; j < len; j++) p.set(x + j, y, '#2b2925'); p.set(x, y + 1, '#8d887c'); }
  },
  plaster(p) {
    p.noise(RAMPS.plaster, .05);
    for (let i = 0; i < 3; i++) { let x = Math.floor(p.random() * 16), y = Math.floor(p.random() * 16); for (let j = 0; j < 3; j++) { p.shade(x, y, -.18); x += p.random() < .5 ? 1 : 0; y++; } }
  },
  timber(p) {
    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) p.set(x, y, RAMPS.darkOak[(Math.floor(x / 2) * 7 + (p.random() < .2 ? 1 : 0)) % 4]);
    for (let y = 0; y < 16; y++) { p.shade(0, y, .12); p.shade(15, y, -.25); }
  },
  slate(p) { shingles(p, RAMPS.slate); },
  redRoof(p) { shingles(p, RAMPS.redRoof); },
  thatch(p) {
    p.noise(RAMPS.thatch);
    for (let i = 0; i < 18; i++) { let x = Math.floor(p.random() * 16), y = Math.floor(p.random() * 16); const c = p.random() < .5 ? RAMPS.thatch[3] : RAMPS.thatch[0]; for (let j = 0; j < 4; j++) p.set(x + j, y + j, c); }
    for (let x = 0; x < 16; x++) { p.shade(x, 7, -.2); p.shade(x, 15, -.2); }
  },
  oakLeaves(p) { leaves(p, RAMPS.oakLeaves, .2); },
  spruceLeaves(p) { leaves(p, RAMPS.spruceLeaves, .12); },
  autumnLeaves(p) { leaves(p, RAMPS.autumnLeaves, .22); },
  iron(p) {
    for (let y = 0; y < 16; y++) { const row = 1 + Math.floor(p.random() * 3); for (let x = 0; x < 16; x++) p.set(x, y, RAMPS.iron[THREE.MathUtils.clamp(row + (p.random() < .15 ? 1 : 0), 0, 4)]); }
    for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) { p.set(x, y, RAMPS.iron[4]); p.set(x + 1, y + 1, RAMPS.iron[0]); }
    for (let i = 0; i < 16; i++) { p.shade(i, 0, .2); p.shade(i, 15, -.3); }
  },
  brass(p) {
    p.noise(RAMPS.brass, .1);
    for (let i = 0; i < 16; i++) { p.set(i, 0, RAMPS.brass[4]); p.set(i, 15, RAMPS.brass[0]); }
  },
  door(p) {
    planks(p, RAMPS.darkOak, true);
    for (const y of [3, 12]) for (let x = 0; x < 16; x++) p.set(x, y, x % 4 === 1 ? RAMPS.iron[4] : RAMPS.iron[1]);
  },
  windowWarm(p) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const frame = x < 2 || y < 2 || x > 13 || y > 13 || x === 7 || x === 8 || y === 7 || y === 8;
      p.set(x, y, frame ? RAMPS.darkOak[(x + y) % 2 + 1] : ['#d88f3c', '#e8a24a', '#f4b85c', '#ffcf78'][Math.min(3, Math.floor((15 - y) / 4 + p.random() * .9))]);
    }
  },
  windowDark(p) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const frame = x < 2 || y < 2 || x > 13 || y > 13 || x === 7 || x === 8 || y === 7 || y === 8;
      p.set(x, y, frame ? RAMPS.darkOak[(x + y) % 2 + 1] : (x + y) % 5 === 0 ? '#3d4d55' : '#1d272d');
    }
  },
  water(p) {
    p.noise(RAMPS.water);
    for (let i = 0; i < 6; i++) { const x = Math.floor(p.random() * 16), y = Math.floor(p.random() * 16); for (let j = 0; j < 3; j++) p.set(x + j, y, '#4a7480'); }
  },
  snow(p) { p.noise(RAMPS.snow, .1); for (let i = 0; i < 6; i++) p.set(Math.floor(p.random() * 16), Math.floor(p.random() * 16), '#a9b7c0'); },
  ember(p) { p.noise(RAMPS.ember, .2); },
  crystal(p) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, RAMPS.crystal[THREE.MathUtils.clamp(Math.floor((x + y) / 8) + (p.random() < .3 ? 1 : 0), 0, 4)]);
    for (let i = 0; i < 16; i++) p.set(i, i, RAMPS.crystal[4]);
  },
  clothRed(p) { cloth(p, ['#4d1f1d', '#5e2724', '#6d302b', '#7b3a33']); },
  clothBlue(p) { cloth(p, ['#1f2d3b', '#273748', '#304255', '#3a4d60']); },
  clothLinen(p) { cloth(p, ['#8f8470', '#9d917c', '#ab9f88', '#b8ac94']); },
  hay(p) { p.noise(RAMPS.thatch, .15); for (let y = 0; y < 16; y += 5) for (let x = 0; x < 16; x++) p.set(x, y, '#5b4a28'); },
  // Biome ground layers.
  litter(p) {
    p.noise(RAMPS.litter);
    for (let i = 0; i < 14; i++) { const x = Math.floor(p.random() * 16), y = Math.floor(p.random() * 16); p.set(x, y, RAMPS.litter[4]); p.set(x + 1, y, RAMPS.litter[3]); p.set(x, y + 1, RAMPS.dirt[1]); }
  },
  mud(p) { p.noise(RAMPS.mud); for (let i = 0; i < 6; i++) { const x = Math.floor(p.random() * 16), y = Math.floor(p.random() * 16); for (let j = 0; j < 3; j++) p.set(x + j, y, '#58503f'); } },
  sand(p) { p.noise(RAMPS.sand, .05); for (let i = 0; i < 10; i++) p.set(Math.floor(p.random() * 16), Math.floor(p.random() * 16), i % 3 ? '#5a5244' : '#a09276'); },
  pineLeaves(p) { leaves(p, RAMPS.pineLeaves, .1); },
  snowyPine(p) { leaves(p, RAMPS.pineLeaves, .1); for (let x = 0; x < 16; x++) for (let y = 0; y < 5 + (x % 3); y++) if (p.alpha(x, y) > 0) p.set(x, y, RAMPS.snow[1 + (x + y) % 3]); },
  // Cutout sprites for crossed-quad vegetation and effects.
  reeds(p) {
    p.clear();
    for (let i = 0; i < 7; i++) { const x = 1 + Math.floor(p.random() * 14), h = 9 + Math.floor(p.random() * 7); for (let j = 0; j < h; j++) p.set(x, 15 - j, RAMPS.reeds[Math.min(3, Math.floor(j / h * 4))]); if (i % 2) { p.set(x, 15 - h, '#5a3a22'); p.set(x, 16 - h, '#5a3a22'); p.set(x, 17 - h, '#4a2e1a'); } }
  },
  deadGrass(p) {
    p.clear();
    for (let i = 0; i < 9; i++) { let x = 1 + Math.floor(p.random() * 14); const h = 4 + Math.floor(p.random() * 8), lean = p.random() < .5 ? -1 : 1; for (let j = 0; j < h; j++) { p.set(x, 15 - j, RAMPS.deadGrass[Math.min(3, Math.floor(j / h * 4))]); if (j > h * .6 && p.random() < .45) x += lean; } }
  },
  tallGrass(p) {
    p.clear();
    for (let i = 0; i < 9; i++) {
      let x = 1 + Math.floor(p.random() * 14); const h = 5 + Math.floor(p.random() * 10), lean = p.random() < .5 ? -1 : 1;
      for (let j = 0; j < h; j++) { p.set(x, 15 - j, RAMPS.grass[THREE.MathUtils.clamp(Math.floor(j / h * 5), 0, 4)]); if (j > h * .55 && p.random() < .4) x += lean; }
    }
  },
  fern(p) {
    p.clear();
    for (const [sx, dir] of [[7, -1], [8, 1], [7, 0]]) {
      let x = sx;
      for (let j = 0; j < 13; j++) { p.set(x, 15 - j, RAMPS.oakLeaves[2]); if (j % 3 === 1) { p.set(x + dir * 1 || x - 1, 15 - j, RAMPS.oakLeaves[3]); p.set(x - (dir || 1), 15 - j + 1, RAMPS.oakLeaves[1]); } if (j % 4 === 3) x += dir; }
    }
  },
  flowerRed(p) { flower(p, ['#7e1f22', '#b22d2e', '#d9473f']); },
  flowerYellow(p) { flower(p, ['#a07a1d', '#d4a72c', '#f0cf55']); },
  flowerBlue(p) { flower(p, ['#2e3f80', '#4762b0', '#7894d6']); },
  flowerWhite(p) { flower(p, ['#a9a79e', '#d4d2c8', '#f2f0e8']); },
  flame(p) {
    p.clear();
    for (let y = 0; y < 16; y++) {
      const t = y / 15, half = Math.round((1 - Math.pow(1 - t, 1.6)) * 6 * (0.75 + p.random() * .35));
      for (let x = 8 - half; x < 8 + half; x++) {
        const edge = Math.abs(x - 7.5) / Math.max(1, half);
        p.set(x, y, RAMPS.ember[THREE.MathUtils.clamp(Math.floor((1 - edge) * 3 + t * 2), 0, 4)]);
      }
    }
  },
};

function stoneBase(p, ramp) {
  for (let y = 0; y < 16; y += 2) for (let x = 0; x < 16; x += 2) {
    const base = p.pick(ramp);
    for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) p.set(x + i, y + j, p.random() < .3 ? p.pick(ramp) : base);
  }
  for (let i = 0; i < 2; i++) { let x = Math.floor(p.random() * 16), y = Math.floor(p.random() * 16); for (let j = 0; j < 4; j++) { p.set(x, y, '#414443'); x += p.random() < .5 ? 1 : -1; y++; } }
}
function cobble(p, ramp, mortar) {
  const seeds = Array.from({ length: 7 }, () => [p.random() * 16, p.random() * 16, p.pick(ramp)]);
  const owner = (x, y) => {
    let best = 0, distance = Infinity;
    seeds.forEach(([sx, sy], i) => { for (const ox of [-16, 0, 16]) for (const oy of [-16, 0, 16]) { const d = (x - sx - ox) ** 2 + (y - sy - oy) ** 2; if (d < distance) { distance = d; best = i; } } });
    return best;
  };
  const ids = []; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) ids.push(owner(x + .5, y + .5));
  const id = (x, y) => ids[(((y + 16) % 16) * 16) + ((x + 16) % 16)];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const self = id(x, y);
    if (id(x + 1, y) !== self || id(x, y + 1) !== self) p.set(x, y, mortar);
    else { p.set(x, y, p.random() < .25 ? p.pick(ramp) : seeds[self][2]); if (id(x - 1, y) !== self || id(x, y - 1) !== self) p.shade(x, y, .14); }
  }
}
function bricks(p, ramp, bw, bh) {
  for (let row = 0; row < 16 / bh; row++) {
    const offset = row % 2 ? bw / 2 : 0;
    for (let col = -1; col < 16 / bw + 1; col++) {
      const base = ramp.indexOf(p.pick(ramp));
      for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
        const x = col * bw + offset + i, y = row * bh + j;
        if (x < 0 || x > 15) continue;
        let shade = base + (p.random() < .22 ? (p.random() < .5 ? -1 : 1) : 0);
        if (j === 0 || i === 0) shade++;
        p.set(x, y, ramp[THREE.MathUtils.clamp(shade, 0, ramp.length - 1)]);
        if (j === bh - 1 || i === bw - 1) p.set(x, y, '#3b3d3c');
      }
    }
  }
}
function mossOver(p, amount) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const near = (y + Math.floor(p.random() * 3)) % 8 > 5;
    if (p.random() < amount * (near ? 2.2 : .5)) p.set(x, y, p.pick(RAMPS.moss));
  }
}
function planks(p, ramp, vertical) {
  for (let board = 0; board < 4; board++) {
    const base = Math.floor(p.random() * (ramp.length - 1)), seam = Math.floor(p.random() * 16);
    for (let a = 0; a < 16; a++) for (let b = 0; b < 4; b++) {
      const grain = Math.sin(a * .7 + board * 3 + b * 2.1) > .6 ? -1 : 0;
      let shade = THREE.MathUtils.clamp(base + grain + (p.random() < .12 ? 1 : 0), 0, ramp.length - 1);
      let color = ramp[shade];
      if (b === 3) color = mix(rgb(ramp[0]), [10, 8, 6], .35);
      else if (b === 0) color = ramp[Math.min(ramp.length - 1, shade + 1)];
      if (a === seam && b < 3) color = mix(rgb(ramp[0]), [10, 8, 6], .25);
      const x = vertical ? board * 4 + b : a, y = vertical ? a : board * 4 + b;
      p.set(x, y, color);
    }
    if (p.random() < .6) { const x = (seam + 1) % 16, y = board * 4 + 1; vertical ? p.set(y, x, '#2a2420') : p.set(x, y, '#2a2420'); }
  }
}
function shingles(p, ramp) {
  for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) {
    const base = ramp.indexOf(p.pick(ramp)), offset = row % 2 ? 2 : 0;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const x = col * 4 + offset + i, y = row * 4 + j;
      let color = ramp[THREE.MathUtils.clamp(base + (j === 0 ? 1 : 0) - (i === 3 ? 1 : 0), 0, ramp.length - 1)];
      if (j === 3) color = mix(rgb(ramp[0]), [6, 8, 10], .45);
      p.set(x, y, color);
    }
  }
}
function leaves(p, ramp, holes) {
  p.noise(ramp);
  for (let i = 0; i < 10; i++) { const x = Math.floor(p.random() * 16), y = Math.floor(p.random() * 16); p.set(x, y, ramp[ramp.length - 1]); p.set(x + 1, y + 1, ramp[0]); }
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (p.random() < holes) p.set(x, y, [0, 0, 0], 0);
}
function cloth(p, ramp) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, ramp[((x + y) % 2) + (p.random() < .3 ? 1 : 0) + (y % 4 === 0 ? 1 : 0)]);
}
function flower(p, petals) {
  p.clear();
  for (const [x, top] of [[4, 6], [10, 4], [7, 9]]) {
    for (let y = top + 2; y < 16; y++) p.set(x, y, RAMPS.grass[(y + x) % 3 + 1]);
    p.set(x - 1, 12, RAMPS.grass[3]); p.set(x + 1, 13, RAMPS.grass[2]);
    for (const [i, j, c] of [[0, 0, 2], [-1, 1, 1], [1, 1, 1], [0, 2, 0], [0, 1, 2]]) p.set(x + i, top + j, petals[c]);
    p.set(x, top + 1, '#e8c25a');
  }
}

// Big tiling surfaces (surfaces.js) replace the 16×16 tiles of the same name.
const SIZES = {};
for (const [name, [size, paint]] of Object.entries(SURFACES)) { SIZES[name] = size; GENERATORS[name] = p => paint(p, RAMPS); }

const textureCache = new Map(), materialCache = new Map();
export const TEXTURE_NAMES = () => Object.keys(GENERATORS);
const CUTOUTS = new Set(['oakLeaves', 'spruceLeaves', 'autumnLeaves', 'pineLeaves', 'snowyPine', 'tallGrass', 'fern', 'reeds', 'deadGrass', 'flowerRed', 'flowerYellow', 'flowerBlue', 'flowerWhite', 'flame']);
export const isCutout = name => CUTOUTS.has(name);
/** Lets other modules add their own 16×16 textures: generator(painter) gets set/noise/pick/shade helpers and RAMPS. */
export function registerPixelTexture(name, generator, { cutout = false } = {}) {
  if (GENERATORS[name]) throw new Error(`Pixel texture already exists: ${name}`);
  GENERATORS[name] = generator;
  if (cutout) CUTOUTS.add(name);
}

export function pixelCanvas(name) {
  const generate = GENERATORS[name];
  if (!generate) throw new Error(`Unknown pixel texture: ${name}`);
  const size = SIZES[name] || SIZE, painter = new Painter(name, size, size);
  generate(painter);
  const canvas = document.createElement('canvas'); canvas.width = painter.w; canvas.height = painter.h;
  canvas.getContext('2d').putImageData(new ImageData(painter.data, painter.w, painter.h), 0, 0);
  return canvas;
}

export function pixelTexture(name) {
  if (textureCache.has(name)) return textureCache.get(name);
  const texture = new THREE.CanvasTexture(pixelCanvas(name));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  // Larger canvases still map 16 texels onto one world unit.
  texture.repeat.set(SIZE / texture.image.width, SIZE / texture.image.height);
  texture.magFilter = THREE.NearestFilter;
  // Opaque tiles keep nearest mipmaps against distant shimmer; cutouts must not
  // lose their alpha coverage to mip averaging.
  texture.minFilter = isCutout(name) ? THREE.NearestFilter : THREE.NearestMipmapLinearFilter;
  texture.generateMipmaps = !isCutout(name);
  texture.name = name;
  textureCache.set(name, texture);
  return texture;
}

/** Shared Lambert material for a pixel texture. Options: tint (hex), emissive (0–1), side. */
export function pixelMaterial(name, { tint = 0xffffff, emissive = 0, side = null } = {}) {
  const key = `${name}:${tint}:${emissive}:${side}`;
  if (materialCache.has(key)) return materialCache.get(key);
  const cutout = isCutout(name);
  const material = new THREE.MeshLambertMaterial({
    map: pixelTexture(name), color: tint,
    alphaTest: cutout ? .5 : 0, side: side ?? (cutout ? THREE.DoubleSide : THREE.FrontSide),
  });
  if (emissive) { material.emissive.setHex(0xffffff); material.emissiveMap = material.map; material.emissiveIntensity = emissive; }
  material.name = `pixel:${key}`;
  materialCache.set(key, material);
  return material;
}

/** Texels per side of a texture's canvas (16 for ordinary tiles, 64 or 128 for big surfaces). */
export const textureSize = name => SIZES[name] || SIZE;
export { RAMPS };

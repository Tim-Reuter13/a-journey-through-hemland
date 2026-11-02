// Run from any directory: node scripts/cave_texture_sheet.mjs
// Built-in Node modules only: the production Painter's buffer code runs without
// importing Three.js or creating a browser canvas. PNG is encoded below by hand.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { deflateSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { CAVE_SURFACES } from '../src/art/caveSurfaces.js';

const source = await readFile(new URL('../src/art/pixelTextures.js', import.meta.url), 'utf8');
const start = source.indexOf('const SIZE ='), end = source.indexOf('const RAMPS =');
assert(start >= 0 && end > start, 'Could not locate the production Painter and its helpers');
// Keep the real seeded RNG, name hash, wrapping and RGBA methods. Only the clamp
// used by Painter.pick needs a standalone equivalent of THREE.MathUtils.clamp.
const Painter = runInNewContext(`${source.slice(start, end).replace('export class Painter', 'class Painter')}\nPainter;`, {
  THREE: { MathUtils: { clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)) } },
}, { timeout: 1000 });

const order = ['caveChalk', 'caveChalkFloor', 'caveMoss', 'caveMossFloor', 'caveIron', 'caveIronFloor'];
const textures = order.map(name => {
  const [size, paint] = CAVE_SURFACES[name], p = new Painter(name, size, size);
  paint(p);
  const repeat = new Painter(name, size, size); paint(repeat);
  assert(Buffer.from(p.data).equals(Buffer.from(repeat.data)), `${name} must paint deterministically`);
  let sum = 0;
  for (let i = 0; i < p.data.length; i += 4) {
    assert.equal(p.data[i + 3], 255, `${name} has an unpainted texel`);
    sum += (.2126 * p.data[i] + .7152 * p.data[i + 1] + .0722 * p.data[i + 2]) / 255;
  }
  // Brightness/luma in the painted sRGB buffer, not linearized light energy.
  const luminance = sum / (size * size);
  console.log(`${name.padEnd(16)} ${size}x${size}  average luminance: ${luminance.toFixed(4)}`);
  return { name, size, p, luminance };
});

const zoom = 4, tiles = 3, margin = 24, captionHeight = 32, gap = 28;
const width = Math.max(...textures.map(t => t.size)) * zoom * tiles + margin * 2;
const height = margin * 2 + textures.reduce((sum, t) => sum + captionHeight + t.size * zoom * tiles, 0) + gap * (textures.length - 1);
const pixels = Buffer.alloc(width * height * 4);
for (let i = 0; i < pixels.length; i += 4) {
  pixels[i] = 22; pixels[i + 1] = 25; pixels[i + 2] = 27; pixels[i + 3] = 255;
}

// A small original 3x5 bitmap alphabet keeps captions independent of fonts/canvas.
const glyphs = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011',
  D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111',
  J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '101111111111101', O: '010101101101010',
  P: '110101110100100', Q: '010101101111011', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111',
  V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
  0: '111101101101111', 1: '010110010010111', 2: '110001010100111',
  3: '110001010001110', 4: '101101111001001', 5: '111100110001110',
  6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
  9: '111101111001110', '.': '000000000000010', '/': '001001010100100',
};
function label(text, x, y) {
  const scale = 3;
  for (const char of text.toUpperCase()) {
    const glyph = glyphs[char];
    if (glyph) for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) {
      if (glyph[j * 3 + i] !== '1') continue;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        const at = ((y + j * scale + dy) * width + x + i * scale + dx) * 4;
        pixels[at] = 205; pixels[at + 1] = 208; pixels[at + 2] = 198;
      }
    }
    x += 4 * scale;
  }
}

let rowY = margin;
for (const { name, size, p, luminance } of textures) {
  label(`${name} / ${size} PX / 3X3 AT 4X / LUMA ${luminance.toFixed(3)}`, margin, rowY + 3);
  rowY += captionHeight;
  const extent = size * zoom * tiles;
  for (let y = 0; y < extent; y++) for (let x = 0; x < extent; x++) {
    const src = ((Math.floor(y / zoom) % size) * size + Math.floor(x / zoom) % size) * 4;
    const dst = ((rowY + y) * width + margin + x) * 4;
    pixels[dst] = p.data[src]; pixels[dst + 1] = p.data[src + 1]; pixels[dst + 2] = p.data[src + 2];
  }
  rowY += extent + gap;
}

const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function chunk(type, data) {
  const name = Buffer.from(type, 'ascii'), content = Buffer.concat([name, data]);
  let crc = 0xffffffff;
  for (const byte of content) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0); content.copy(result, 4);
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
  return result;
}
const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
const scanlines = Buffer.alloc((width * 4 + 1) * height);
for (let y = 0; y < height; y++) {
  // PNG filter type 0; repeated nearest-neighbour pixels compress well with zlib.
  pixels.copy(scanlines, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
}
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
  chunk('IDAT', deflateSync(scanlines, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
]);
const output = new URL('../work/screens/cave_textures.png', import.meta.url);
await mkdir(new URL('.', output), { recursive: true });
await writeFile(output, png);
console.log(`Wrote ${fileURLToPath(output)} (${width}x${height})`);

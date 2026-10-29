/* global Project, Group, Cube, Texture, Canvas, Outliner, Formats, newProject */
// Runs INSIDE Blockbench (via the MCP execute_script tool), never in the game.
// Turns a model spec (bones + cubes + pixel materials) into a Blockbench
// project: groups with real joint pivots, cubes with per-face UVs packed into
// one atlas, and a procedurally painted 1-texel-per-pixel texture.
//
// Usage from execute_script (see art/blockbench/README.md):
//   fetch builder.js?raw + models.js?raw, then  AshenBuild(MODELS[name](), params)

function AshenBuild(spec, options = {}) {
  // Optional lineup placement: shift everything and prefix names.
  if (options.offset) {
    const [ox, oy, oz] = options.offset, shift = v => v && [v[0] + ox, v[1] + oy, v[2] + oz], pre = options.prefix || '';
    spec = { ...spec,
      bones: spec.bones.map(([n, p, o, r]) => [pre + n, p && pre + p, shift(o), r]),
      cubes: spec.cubes.map(c => ({ ...c, name: pre + c.name, bone: c.bone && pre + c.bone, from: shift(c.from), to: shift(c.to), origin: shift(c.origin) })) };
  }
  const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const scale = (c, f) => c.map(v => clamp(Math.round(v * f), 0, 255));
  const mixc = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  let seed = 1;
  for (const ch of spec.name) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
  const random = () => { seed += 0x6D2B79F5; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const hash2 = (a, b) => { let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  // ── Pixel material styles. Each returns an [r,g,b] for face pixel (x, y).
  const STYLES = {
    flat: (m, f, x, y) => m.ramp[random() < .78 ? 1 : random() < .5 ? 0 : 2],
    skin: (m, f, x, y) => m.ramp[random() < .86 ? 1 : random() < .5 ? 0 : 2],
    cloth: (m, f, x, y) => {
      const fold = Math.sin((x + f.cubeIndex * 3) * 1.7) > .55 ? -1 : 0;
      let i = 1 + fold + (random() < .14 ? 1 : 0);
      if (f.dir !== 'up' && f.dir !== 'down' && y === f.h - 1 && f.h > 2) i = 0;
      return m.ramp[clamp(i, 0, m.ramp.length - 1)];
    },
    leather: (m, f, x, y) => {
      // Low-contrast hide: mostly the base tone, soft scuffs, a crease every few rows.
      const v = random();
      let i = v < .1 ? 0 : v < .82 ? 1 : 2;
      if ((y + f.cubeIndex) % 5 === 4 && random() < .7) i = 0;
      let c = m.ramp[i];
      const sides = f.dir !== 'up' && f.dir !== 'down';
      if (m.stitch && sides && f.w > 4 && f.h > 4 && (y === 1 || y === f.h - 2) && x % 2 === 0) c = hex(m.stitch);
      return c;
    },
    metal: (m, f, x, y) => {
      const t = f.h > 1 ? y / (f.h - 1) : .5;
      let i = clamp(Math.round((1 - t) * (m.ramp.length - 1) * .75 + .4 + (random() < .1 ? 1 : 0)), 0, m.ramp.length - 1);
      if (y === 0 && f.dir !== 'down') i = m.ramp.length - 1;
      let c = m.ramp[i];
      if (m.rivets && f.w >= 4 && f.h >= 4 && (x === 1 || x === f.w - 2) && (y === 1 || y === f.h - 2)) c = m.ramp[m.ramp.length - 1];
      if (y === f.h - 1 && f.h > 2) c = scale(c, .72);
      return c;
    },
    chain: (m, f, x, y) => m.ramp[((x + (y % 2)) % 2 ? 1 : 2) + (random() < .08 ? -1 : 0)],
    hair: (m, f, x, y) => {
      const strand = ((x * 7 + f.cubeIndex * 3) % 5);
      return m.ramp[clamp(strand === 0 ? 0 : strand === 3 ? 2 : 1, 0, m.ramp.length - 1)];
    },
    fur: (m, f, x, y) => {
      const v = random();
      return m.ramp[clamp(v < .2 ? 0 : v < .65 ? 1 : v < .92 ? 2 : 3, 0, m.ramp.length - 1)];
    },
    // Animal coat: mostly the mid tone in short strokes, a darker line along the back on the
    // flanks, a few lighter guard hairs. Belly and markings come from faceMat and decals.
    pelt: (m, f, x, y) => {
      const sides = f.dir !== 'up' && f.dir !== 'down', v = random();
      let i = 1 + (v < .1 ? -1 : v > .92 ? 1 : 0);
      if (sides && f.h > 3 && y === 0) i -= 1;
      if (f.dir === 'up' && random() < .25) i -= 1;
      if ((x * 3 + y * 5 + f.cubeIndex) % 11 === 0) i += 1;
      return m.ramp[clamp(i, 0, m.ramp.length - 1)];
    },
    feathers: (m, f, x, y) => {
      // Overlapping rows of feathers: each row lighter at its edge, a blue-black sheen now and then.
      let i = (y % 3 === 2 ? 0 : 1) + (random() < .12 ? 1 : 0);
      if ((x + Math.floor(y / 3)) % 4 === 0 && y % 3 === 0) i = 2;
      return m.ramp[clamp(i, 0, m.ramp.length - 1)];
    },
    wood: (m, f, x, y) => m.ramp[clamp(1 + (Math.sin(y * 1.3 + f.cubeIndex) > .7 ? -1 : 0) + (random() < .1 ? 1 : 0), 0, m.ramp.length - 1)],
    glow: (m, f, x, y) => m.ramp[clamp(Math.floor(random() * m.ramp.length), 0, m.ramp.length - 1)],
    // Foliage, cut out like fancy Minecraft leaves: clumps of leaves (2×2 for broadleaf, single
    // texels for needles) with holes to see the inner leaves through, and a ragged rim so a box of
    // leaves never shows its outline. Up faces catch the sun, down faces sit in shade. null = hole.
    leaves: (m, f, x, y) => {
      const rim = Math.min(x, y, f.w - 1 - x, f.h - 1 - y), top = m.ramp.length - 1;
      if (random() < (rim === 0 ? .55 : rim === 1 ? .3 : 0)) return null;
      if (m.berries && random() < m.berries) return hex(m.berry);
      const shade = f.dir === 'up' ? 1 : f.dir === 'down' ? -1 : y < f.h * .3 ? .5 : y > f.h * .7 ? -.5 : 0;
      if (m.clump === 1) {
        // Needles: short strokes of single texels.
        if (random() < (m.holes ?? .12)) return null;
        const v = hash2(Math.floor((x + f.seed) / 2), y + f.seed * 3);
        return m.ramp[clamp(Math.round((v < .2 ? 0 : v < .6 ? 1 : v < .88 ? 2 : 3) + shade + (random() < .2 ? 1 : 0)), 0, top)];
      }
      // Broad leaves: one leaf per 3×3 cell at a jittered spot (cellular noise). Inside a leaf it is
      // lit, brighter toward its upper left; round its edge it darkens; between leaves there are holes
      // to see the inner foliage through.
      let best = 9, dx = 0, dy = 0;
      const gx = Math.floor((x + f.seed) / 3), gy = Math.floor((y + f.seed * 2) / 3);
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const cx = (gx + i) * 3 + 3 * hash2(gx + i, gy + j) - f.seed, cy = (gy + j) * 3 + 3 * hash2(gx + i + 57, gy + j + 91) - f.seed * 2;
        const d = Math.hypot(x + .5 - cx, y + .5 - cy);
        if (d < best) { best = d; dx = x + .5 - cx; dy = y + .5 - cy; }
      }
      if (best > 1.9) return random() < (m.holes ?? .5) ? null : m.ramp[0];
      let i = best < 1 ? (dx + dy < 0 ? 4 : 3) : best < 1.5 ? 2 : 1;
      return m.ramp[clamp(Math.round(i + shade - (hash2(gx, gy + 7) < .25 ? 1 : 0)), 0, top)];
    },
    // Bark in vertical furrows with a light ridge between them; birch (m.marks) is pale with dark
    // horizontal lenticels. End faces show the wood.
    bark: (m, f, x, y) => {
      if (f.dir === 'up' || f.dir === 'down') return m.ramp[clamp(1 + (hash2(x, y) < .3 ? 1 : 0), 0, m.ramp.length - 1)];
      if (m.marks) {
        const row = hash2(Math.floor((x + f.seed) / 3), y + f.seed);
        if (row < .14) return hex(m.marks);
        return m.ramp[clamp(hash2(x, y) < .15 ? 0 : hash2(x + 3, y) < .2 ? 2 : 1, 0, m.ramp.length - 1)];
      }
      const col = (x + f.seed) % 4, furrow = col === 0 || (col === 2 && hash2(x, Math.floor(y / 3) + f.seed) < .35);
      let i = furrow ? 0 : hash2(x + f.seed, y) < .18 ? 2 : 1;
      if (m.moss && y > f.h - 4 && hash2(x, y) < m.moss) return hex(m.mossColor);
      if (hash2(x + 11, y + f.seed) < .012) i = m.ramp.length - 1;
      return m.ramp[clamp(i, 0, m.ramp.length - 1)];
    },
  };
  const DIR_LIGHT = { up: 1.1, down: .62, north: 1, south: .9, east: .95, west: .95 };

  // ── Atlas packing: every face gets its own pixel rectangle.
  const FACE_SIZE = (w, h, d) => ({ north: [w, h], south: [w, h], east: [d, h], west: [d, h], up: [w, d], down: [w, d] });
  const cubes = spec.cubes.map((c, i) => {
    const size = [0, 1, 2].map(k => Math.max(1, Math.round(Math.abs(c.to[k] - c.from[k]))));
    return { ...c, index: i, size, faces: FACE_SIZE(...size) };
  });
  const atlasWidth = options.atlasWidth || spec.atlasWidth || 128;
  // Shelf packing, tallest faces first; an optional reserved rectangle (e.g. face
  // animation frames painted at runtime) is allocated before everything else.
  const slots = [], shared = new Map();
  if (spec.reserve) slots.push({ reserve: true, w: spec.reserve[0], h: spec.reserve[1] });
  // Cubes with `share` (foliage) reuse one painted rectangle per material, face kind, size and
  // variant, so hundreds of leaf boxes fit a small atlas and keep 16 texels per unit.
  for (const cube of cubes) for (const dir of Object.keys(cube.faces)) {
    if (cube.hide?.includes(dir)) continue;
    const [w, h] = cube.faces[dir];
    if (cube.share) {
      const kind = dir === 'up' || dir === 'down' ? dir : 'side', variant = (cube.index * 7 + Object.keys(cube.faces).indexOf(dir) * 3) % (cube.variants || 3);
      const key = `${cube.share}|${cube.faceMat?.[dir] || cube.mat}|${kind}|${w}x${h}|${variant}`;
      if (shared.has(key)) { shared.get(key).users.push([cube, dir]); continue; }
      const slot = { cube, dir, w, h, users: [] };
      shared.set(key, slot); slots.push(slot); continue;
    }
    slots.push({ cube, dir, w, h });
  }
  slots.sort((a, b) => (b.reserve ? 1 : 0) - (a.reserve ? 1 : 0) || b.h - a.h || b.w - a.w);
  let cx = 0, cy = 0, rowH = 0, reserved = null;
  for (const slot of slots) {
    if (cx + slot.w > atlasWidth) { cx = 0; cy += rowH; rowH = 0; }
    if (slot.reserve) reserved = { u: cx, v: cy, w: slot.w, h: slot.h };
    else slot.cube.faces[slot.dir] = { w: slot.w, h: slot.h, u: cx, v: cy };
    cx += slot.w; rowH = Math.max(rowH, slot.h);
  }
  for (const slot of slots) for (const [cube, dir] of slot.users || []) cube.faces[dir] = { ...slot.cube.faces[slot.dir], shared: true };
  let atlasHeight = 16; while (atlasHeight < cy + rowH) atlasHeight *= 2;
  // Atlas rectangles per part, so the game can tint each part's pixels.
  const partMeta = {};
  for (const cube of cubes) {
    if (!cube.part) continue;
    const meta = partMeta[cube.part] ??= { tint: spec.parts?.[cube.part]?.tint || null, slot: spec.parts?.[cube.part]?.slot || null, rects: [] };
    for (const face of Object.values(cube.faces)) if (face && face.u !== undefined) meta.rects.push([face.u, face.v, face.w, face.h]);
  }

  // ── Paint.
  const canvas = document.createElement('canvas'); canvas.width = atlasWidth; canvas.height = atlasHeight;
  const ctx = canvas.getContext('2d'), image = ctx.createImageData(atlasWidth, atlasHeight);
  const put = (x, y, c, a = 255) => { const i = (y * atlasWidth + x) * 4; image.data[i] = c[0]; image.data[i + 1] = c[1]; image.data[i + 2] = c[2]; image.data[i + 3] = a; };
  const materialOf = name => {
    const m = spec.materials[name];
    if (!m) throw new Error(`Unknown material ${name}`);
    return { ...m, ramp: m.ramp.map(hex) };
  };
  for (const cube of cubes) {
    for (const [dir, face] of Object.entries(cube.faces)) {
      if (!face || face.u === undefined || face.shared) continue;
      const matName = cube.faceMat?.[dir] || cube.mat;
      const m = materialOf(matName), style = STYLES[m.style || 'flat'];
      const info = { w: face.w, h: face.h, dir, cubeIndex: cube.index, seed: (face.u * 3 + face.v * 5) % 17 };
      for (let y = 0; y < face.h; y++) for (let x = 0; x < face.w; x++) {
        let c = style(m, info, x, y);
        if (!c) { put(face.u + x, face.v + y, [0, 0, 0], 0); continue; }
        // Foliage is lit by the game with rounded crown normals, so it bakes in only a little face light.
        let light = m.style === 'leaves' ? 1 + (DIR_LIGHT[dir] - 1) * .35 : DIR_LIGHT[dir];
        if (dir !== 'up' && dir !== 'down' && face.h > 2 && !m.unshaded) light *= 1.06 - (y / (face.h - 1)) * .14;
        if (!m.unshaded) c = scale(c, light);
        put(face.u + x, face.v + y, c);
      }
      // Decals: pixel maps painted on top, coordinates relative to the face.
      for (const decal of cube.decals?.filter(d => d.face === dir) || []) {
        decal.map.forEach((row, y) => [...row].forEach((ch, x) => {
          const color = decal.palette[ch];
          const px = (decal.x || 0) + x, py = (decal.y || 0) + y;
          if (!color || px < 0 || py < 0 || px >= face.w || py >= face.h) return;
          put(face.u + px, face.v + py, color === 'shade' ? scale(getPixel(face.u + px, face.v + py), .7) : hex(color));
        }));
      }
    }
  }
  function getPixel(x, y) { const i = (y * atlasWidth + x) * 4; return [image.data[i], image.data[i + 1], image.data[i + 2]]; }
  ctx.putImageData(image, 0, 0);

  // ── Build the Blockbench project.
  if (options.newProject !== false) newProject(Formats.free);
  Project.name = spec.name;
  Project.texture_width = atlasWidth; Project.texture_height = atlasHeight;
  const texture = new Texture({ name: `${options.prefix || ''}${spec.name}.png` }).fromDataURL(canvas.toDataURL('image/png')).add(false);
  if ('uv_width' in texture) { texture.uv_width = atlasWidth; texture.uv_height = atlasHeight; }
  const groups = {};
  for (const [name, parent, origin, rotation] of spec.bones) {
    const group = new Group({ name, origin, rotation: rotation || [0, 0, 0] }).init();
    if (parent) group.addTo(groups[parent]);
    groups[name] = group;
  }
  for (const cube of cubes) {
    const faces = {};
    for (const dir of ['north', 'south', 'east', 'west', 'up', 'down']) {
      const f = cube.faces[dir];
      faces[dir] = f && f.u !== undefined ? { uv: [f.u, f.v, f.u + f.w, f.v + f.h], texture: texture.uuid } : { texture: null };
    }
    const element = new Cube({
      name: cube.name, from: cube.from, to: cube.to, inflate: cube.inflate || 0,
      origin: cube.origin || groups[cube.bone]?.origin || [0, 0, 0], rotation: cube.rotation || [0, 0, 0],
      box_uv: false, faces,
    }).init();
    if (cube.bone) element.addTo(groups[cube.bone]);
  }
  Canvas.updateAll();
  return { name: spec.name, cubes: cubes.length, bones: spec.bones.length, atlas: [atlasWidth, atlasHeight],
    meta: { atlas: [atlasWidth, atlasHeight], reserved, parts: partMeta, pivots: Object.fromEntries(spec.bones.map(([n, , o]) => [n, o])) } };
}

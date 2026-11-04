// Blood on the lens: when the wanderer is hurt, pixel splats land on the screen, hang there and run down in thin
// drips before they dry and fade. A low-resolution canvas (192 × 108) stretched with hard pixels, so it matches the world.
const W = 192, H = 108;
const hash = (x, y) => { let h = Math.imul(x + 374761393, 668265263) ^ Math.imul(y + 1274126177, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export function createBloodScreen(parent = document.body) {
  const canvas = document.createElement('canvas');
  canvas.id = 'blood-screen'; canvas.width = W; canvas.height = H;
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', imageRendering: 'pixelated', zIndex: '4', opacity: '.92' });
  parent.append(canvas);
  const ctx = canvas.getContext('2d'), image = ctx.createImageData(W, H), data = image.data;
  const splats = [];
  let dirty = false;
  const rand = (a, b) => a + Math.random() * (b - a);

  /** `strength` 0..1 is how hard the blow was (a share of the wanderer's health): a few splats, a big one for a heavy hit. */
  function splat(strength = .3) {
    const n = 1 + Math.round(strength * 4);
    for (let i = 0; i < n; i++) {
      const edge = Math.random() < .6;
      const x = edge ? (Math.random() < .5 ? rand(0, W * .25) : rand(W * .75, W)) : rand(W * .2, W * .8), y = edge ? rand(0, H * .8) : rand(0, H * .5);
      splats.push({ x, y, r: rand(3, 5 + strength * 12), age: 0, life: rand(5, 8) + strength * 4, seed: Math.random() * 999 | 0, drips: Array.from({ length: 1 + (Math.random() * 3 | 0) }, () => ({ dx: rand(-4, 4) | 0, speed: rand(2, 7), len: 0, start: rand(.1, 1.2) })) });
    }
    if (splats.length > 14) splats.splice(0, splats.length - 14);
    dirty = true;
  }
  function draw() {
    data.fill(0);
    for (const s of splats) {
      const k = s.age / s.life, alpha = k < .6 ? 1 : 1 - (k - .6) / .4;
      if (alpha <= 0) continue;
      const fresh = k < .35;
      const put = (x, y, shade) => {
        x |= 0; y |= 0;
        if (x < 0 || y < 0 || x >= W || y >= H) return;
        // Fading is dithered: pixel by pixel, not a soft alpha.
        if (hash(x, y) > alpha) return;
        const i = (y * W + x) * 4, c = fresh ? [150 - shade * 25, 12, 22] : [92 - shade * 14, 8, 14];
        data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
      };
      for (let y = -s.r; y <= s.r; y++) for (let x = -s.r; x <= s.r; x++) {
        const d = Math.hypot(x, y), ragged = s.r * (.72 + hash(Math.round(s.x + x) + s.seed, Math.round(s.y + y)) * .5);
        if (d < ragged) put(s.x + x, s.y + y, d / s.r > .7 ? 1 : 0);
      }
      for (const dr of s.drips) {
        const len = Math.max(0, Math.min(40, (s.age - dr.start) * dr.speed * (1 - k * .6)));
        for (let j = 0; j < len; j++) put(s.x + dr.dx, s.y + s.r * .6 + j, 1);
        if (len > 0) { put(s.x + dr.dx - 1, s.y + s.r * .6 + len, 0); put(s.x + dr.dx, s.y + s.r * .6 + len + 1, 0); }
      }
    }
    ctx.putImageData(image, 0, 0);
  }
  return {
    splat,
    update(dt) {
      if (!splats.length) { if (dirty) { ctx.clearRect(0, 0, W, H); dirty = false; } return; }
      for (let i = splats.length - 1; i >= 0; i--) { splats[i].age += dt; if (splats[i].age > splats[i].life) splats.splice(i, 1); }
      draw(); dirty = true;
    },
    clear() { splats.length = 0; ctx.clearRect(0, 0, W, H); dirty = false; },
    state: () => ({ splats: splats.length }),
  };
}

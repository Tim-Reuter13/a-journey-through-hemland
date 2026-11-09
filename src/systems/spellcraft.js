import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { boxGeometry } from '../art/blocks.js';
import { pixelMaterial, pixelTexture, registerPixelTexture, TEXTURE_NAMES } from '../art/pixelTextures.js';
import { SPELLS, ELEMENTS, boltPath, chainTargets, inCone } from '../data/spells.js';
import { traceSpellSurface } from './spellFx.js';
import { createReactions } from './reactions.js';

// The spells of the Zauberbuch besides Funken (spellFx.js): Frostlanze, Kettenblitz, Sturmstoß, Erdstachel, Irrlicht,
// Lebensquell, Schattenschritt and Seuchennebel. Everything they leave in the world lives here: ice floes on the
// water you can stand on, frost and cracks on the ground, stone spikes, flowers, the wisp, clouds of rot that burst
// in fire. Particles are glowing, hazy or solid blocks in three instanced pools (three draw calls for all of them).
// combat.js casts (cast()) and steps it; main.js asks iceAt() for the ground and lightNear() for the goblins.

const T = 1 / 16, UP = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1), WHITE = new THREE.Color(0xffffff);
const paint = (name, fn) => { if (!TEXTURE_NAMES().includes(name)) registerPixelTexture(name, fn, { cutout: true }); };
// Rime: needles of frost growing out from the middle. Cracks: dark fissures from where the earth broke.
paint('rime', p => {
  p.clear();
  for (let a = 0; a < 10; a++) { const ang = a / 10 * Math.PI * 2 + (a * 7 % 3) * .2, len = 4 + (a * 5 % 4);
    for (let r = 1; r <= len; r++) { const x = Math.round(7.5 + Math.cos(ang) * r), y = Math.round(7.5 + Math.sin(ang) * r); if (x >= 0 && x < 16 && y >= 0 && y < 16) p.set(x, y, r % 3 ? '#e8f6ff' : '#bfe4fa'); } }
  for (let i = 0; i < 26; i++) { const x = (i * 37 + 3) % 16, y = (i * 53 + 11) % 16; if (Math.hypot(x - 7.5, y - 7.5) < 7.2) p.set(x, y, i % 2 ? '#f6fcff' : '#a8d8f4'); }
});
paint('crack', p => {
  p.clear();
  const lines = [[0, 7, 1], [1.3, 6, -1], [2.4, 7, 1], [3.5, 5, -1], [4.6, 7, 1], [5.5, 6, 1]];
  for (const [ang, len, bend] of lines) { let x = 7.5, y = 7.5, a = ang;
    for (let r = 0; r < len; r++) { a += bend * .18; x += Math.cos(a); y += Math.sin(a); const ix = Math.round(x), iy = Math.round(y);
      if (ix >= 0 && ix < 16 && iy >= 0 && iy < 16) p.set(ix, iy, r < 2 ? '#120e0b' : '#2a221b'); } }
  for (const [x, y] of [[7, 7], [8, 7], [7, 8], [8, 8], [6, 7], [9, 8]]) p.set(x, y, '#0c0907');
});

export function createSpellcraft({ scene, world, player, targets, enemies = [], strike, dot = () => {}, knock = () => {}, hurtPlayer = () => {}, healPlayer = () => {},
  movePlayer = () => {}, shove = () => {}, wildfire = null, spellFx = null, ai = null, toast = () => {}, magicDamage = () => 39, marks = null, shield = null }) {
  const group = new THREE.Group(); group.name = 'Spellcraft'; scene.add(group);
  const heightAt = (x, z) => world.heightAt(x, z), waterAt = (x, z) => world.water?.at?.(x, z) ?? null;
  const rand = (a, b) => a + Math.random() * (b - a), pick = list => list[Math.floor(Math.random() * list.length)];
  const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  let time = 0;

  // ── Particles: three instanced pools. Glow is additive (fades by darkening), haze is soft smoke (fades by
  // shrinking), solid is lit chunks (ice shards, stones, leaves, petals) that can bounce and lie on the ground.
  const UNIT = boxGeometry(T, T, T);
  function makePool(max, material) {
    const mesh = new THREE.InstancedMesh(UNIT, material, max);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0; mesh.frustumCulled = false; group.add(mesh);
    return { mesh, max, items: [], free: [] };
  }
  const glow = makePool(1100, new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  const haze = makePool(320, new THREE.MeshBasicMaterial({ color: 0xffffff, map: pixelTexture('stone'), transparent: true, opacity: .42, depthWrite: false }));
  const solid = makePool(360, new THREE.MeshLambertMaterial({ color: 0xffffff }));
  glow.mesh.name = 'spell glow'; haze.mesh.name = 'spell haze'; solid.mesh.name = 'spell chunks';
  const col0 = new THREE.Color(), col1 = new THREE.Color();
  /** One particle. c0: colour at birth, c1: at death. curve: how its size runs over its life. */
  function spawn(P, x, y, z, vx, vy, vz, { life = .6, size = 1, c0 = 0xffffff, c1 = c0, gravity = 0, drag = 0, swirl = 0, spin = 3, curve = 'pop', stretch = 0, floor = null, bounce = 0, rest = 0, grow = 1.6 } = {}) {
    if (P.items.length >= P.max) return null;
    const p = P.free.pop() || {};
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.life = p.dur = life; p.size = size; p.gravity = gravity; p.drag = drag;
    p.swirl = swirl; p.phase = Math.random() * 6.28; p.rx = Math.random() * 3; p.ry = Math.random() * 3; p.rz = Math.random() * 3; p.spin = spin;
    p.curve = curve; p.stretch = stretch; p.floor = floor; p.bounce = bounce; p.rest = rest; p.bounced = false; p.grow = grow; p.lying = false;
    col0.setHex(c0); col1.setHex(c1); p.r0 = col0.r; p.g0 = col0.g; p.b0 = col0.b; p.r1 = col1.r; p.g1 = col1.g; p.b1 = col1.b;
    P.items.push(p); return p;
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _d = new THREE.Vector3(), _c = new THREE.Color();
  function sizeOf(p, k) {
    const a = 1 - k;
    switch (p.curve) {
      case 'flame': return k > .7 ? .7 + a * 1.6 : Math.max(.25, k * 1.5);
      case 'shrink': return Math.max(.05, k);
      case 'grow': return (1 + a * p.grow) * Math.min(1, k * 4);
      case 'steady': return Math.min(1, k * 6);
      default: return Math.min(1, a * 9 + .15) * (.3 + .7 * k);
    }
  }
  function stepPool(P, dt) {
    const { mesh, items } = P, glowing = P === glow;
    let n = 0;
    for (let i = items.length - 1; i >= 0; i--) {
      const p = items[i];
      p.life -= dt;
      if (p.life <= 0) { items[i] = items[items.length - 1]; items.pop(); P.free.push(p); continue; }
      const k = p.life / p.dur;
      if (!p.lying) {
        p.vy -= p.gravity * dt;
        if (p.drag) { const f = Math.exp(-p.drag * dt); p.vx *= f; p.vy *= f; p.vz *= f; }
        if (p.swirl) { p.phase += dt * 6; p.vx += Math.cos(p.phase) * p.swirl * dt; p.vz += Math.sin(p.phase) * p.swirl * dt; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.rx += p.spin * dt; p.rz += p.spin * .7 * dt;
        if (p.floor !== null && p.y < p.floor) {
          p.y = p.floor;
          if (p.bounce && !p.bounced) { p.bounced = true; p.vy = Math.abs(p.vy) * p.bounce; p.vx *= .55; p.vz *= .55; }
          else if (p.rest) { p.lying = true; p.life = Math.min(p.life, p.rest); p.rx = 0; p.rz = 0; }
          else { p.life = 0; continue; }
        }
      }
      const s = p.size * sizeOf(p, k);
      _p.set(p.x, p.y, p.z);
      if (p.stretch && !p.lying) {
        const v = Math.hypot(p.vx, p.vy, p.vz);
        if (v > .01) _q.setFromUnitVectors(Z, _d.set(p.vx / v, p.vy / v, p.vz / v)); else _q.identity();
        _s.set(s, s, s * (1 + v * p.stretch));
      } else { _q.setFromEuler(_e.set(p.rx, p.ry, p.rz)); _s.set(s, s, s); }
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(n, _m);
      const r = p.r1 + (p.r0 - p.r1) * k, g = p.g1 + (p.g0 - p.g1) * k, b = p.b1 + (p.b0 - p.b1) * k;
      const env = glowing ? Math.min(1, k * 2.6) * Math.min(1, (1 - k) * 14 + .3) : 1;
      _c.setRGB(r * env, g * env, b * env); mesh.setColorAt(n, _c);
      n++;
    }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  const ramp = el => ELEMENTS[el]?.ramp ?? ELEMENTS.feuer.ramp;
  /** A burst of element light from a point (sparks, motes) in all directions. */
  function burst(point, el, count, { speed = 4, up = 1.5, life = [.3, .7], size = [1, 2.4], gravity = 4, drag = 2, stretch = 0, floor = null, bounce = 0 } = {}) {
    const R = ramp(el);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * 6.283, e = rand(-.6, 1), sp = speed * rand(.35, 1);
      spawn(glow, point.x, point.y, point.z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + up, Math.sin(a) * Math.cos(e) * sp,
        { life: rand(...life), size: rand(...size), c0: R[Math.floor(rand(0, 2))], c1: R[3], gravity, drag, stretch, floor, bounce });
    }
  }
  function puff(point, color, count, { spread = .6, speed = .6, up = .5, life = [1, 1.8], size = [3, 6], grow = 1.6, swirl = 0 } = {}) {
    for (let i = 0; i < count; i++) spawn(haze, point.x + rand(-spread, spread), point.y + rand(-spread, spread) * .4, point.z + rand(-spread, spread),
      rand(-speed, speed), rand(.1, 1) * up, rand(-speed, speed), { life: rand(...life), size: rand(...size), c0: color, c1: color, curve: 'grow', grow, swirl, drag: .8 });
  }
  function chunks(point, colors, count, { speed = 4, up = 4, size = [1, 2.6], life = [1.2, 2.2], rest = 1.2, floor = null } = {}) {
    const f = floor ?? heightAt(point.x, point.z);
    for (let i = 0; i < count; i++) { const a = Math.random() * 6.283, sp = speed * rand(.3, 1);
      spawn(solid, point.x, point.y, point.z, Math.cos(a) * sp, up * rand(.5, 1.2), Math.sin(a) * sp,
        { life: rand(...life), size: rand(...size), c0: pick(colors), gravity: 13, spin: rand(4, 12), curve: 'steady', floor: f + .03, bounce: .35, rest }); }
  }

  // ── Decals on the ground: frost, cracks, scorch marks. A small 4×4 grid that follows the terrain.
  const decals = Array.from({ length: 36 }, () => {
    const geometry = new THREE.PlaneGeometry(1, 1, 3, 3); geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshLambertMaterial({ map: pixelTexture('rime'), transparent: true, alphaTest: .05, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const mesh = new THREE.Mesh(geometry, material); mesh.visible = false; mesh.renderOrder = 1; mesh.name = 'spell decal'; group.add(mesh);
    return { mesh, base: Float32Array.from(geometry.attributes.position.array), life: 0, dur: 1 };
  });
  let decalNext = 0;
  function decal(texture, point, size, life = 12, tint = 0xffffff) {
    const d = decals[decalNext++ % decals.length], pos = d.mesh.geometry.attributes.position, ang = Math.random() * 6.283, c = Math.cos(ang), s = Math.sin(ang);
    for (let i = 0; i < pos.count; i++) {
      const bx = d.base[i * 3] * size, bz = d.base[i * 3 + 2] * size, x = point.x + bx * c - bz * s, z = point.z + bx * s + bz * c;
      pos.setXYZ(i, x, heightAt(x, z) + .03, z);
    }
    pos.needsUpdate = true; d.mesh.geometry.computeBoundingSphere();
    d.mesh.material.map = pixelTexture(texture); d.mesh.material.color.setHex(tint); d.mesh.material.opacity = 1; d.mesh.visible = true; d.life = d.dur = life;
  }

  // ── Sounds: noise through filters and a few tones, made on the spot (no files).
  let ac = null;
  const audio = () => { try { ac ??= new (window.AudioContext || window.webkitAudioContext)(); void ac.resume(); return ac; } catch { return null; } };
  function noise({ dur = .3, type = 'lowpass', f = 800, f1 = null, q = 1, gain = .06, delay = 0, attack = .005 }) {
    const a = audio(); if (!a) return;
    try {
      const t = a.currentTime + delay, buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
      src.buffer = buf; fl.type = type; fl.frequency.setValueAtTime(f, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur); fl.Q.value = q;
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      src.connect(fl); fl.connect(g); g.connect(a.destination); src.start(t); src.stop(t + dur + .02);
    } catch { /* sound is optional */ }
  }
  function tone({ type = 'sine', f = 440, f1 = null, dur = .3, gain = .05, delay = 0, attack = .005 }) {
    const a = audio(); if (!a) return;
    try {
      const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + .02);
    } catch { /* sound is optional */ }
  }
  const SFX = {
    frost: () => { noise({ dur: .35, type: 'highpass', f: 2600, f1: 6000, gain: .05 }); tone({ type: 'triangle', f: 1300, f1: 2600, dur: .25, gain: .025 }); },
    shatter: () => { noise({ dur: .3, type: 'highpass', f: 2200, gain: .08 }); for (let i = 0; i < 5; i++) tone({ type: 'square', f: 1600 + Math.random() * 2600, dur: .05, gain: .012, delay: i * .028 }); },
    freeze: () => { noise({ dur: 1, type: 'bandpass', f: 2600, f1: 700, q: 2, gain: .06 }); tone({ type: 'sine', f: 260, f1: 110, dur: .7, gain: .04 }); },
    thunder: () => { noise({ dur: .07, type: 'highpass', f: 1400, gain: .2 }); noise({ dur: 1.6, type: 'lowpass', f: 480, f1: 50, gain: .17, delay: .05, attack: .04 }); },
    zap: () => { tone({ type: 'sawtooth', f: 190, f1: 80, dur: .2, gain: .035 }); noise({ dur: .14, type: 'bandpass', f: 3200, q: 3, gain: .06 }); },
    whoosh: () => { noise({ dur: .7, type: 'bandpass', f: 380, f1: 2400, q: .7, gain: .16, attack: .08 }); noise({ dur: .5, type: 'lowpass', f: 300, f1: 90, gain: .08, delay: .1 }); },
    rumble: () => { noise({ dur: 1.3, type: 'lowpass', f: 220, f1: 45, gain: .2, attack: .05 }); tone({ type: 'sine', f: 55, f1: 32, dur: 1.1, gain: .08 }); },
    crack: () => { noise({ dur: .1, type: 'lowpass', f: 1200, gain: .07 }); tone({ type: 'triangle', f: 140, f1: 55, dur: .14, gain: .05 }); },
    wisp: () => [0, 4, 7, 12].forEach((s, i) => tone({ f: 523 * 2 ** (s / 12), dur: 1.2, gain: .022, delay: i * .07, attack: .02 })),
    heal: () => { [0, 7, 12, 16].forEach((s, i) => tone({ type: 'triangle', f: 392 * 2 ** (s / 12), dur: 1.5, gain: .02, delay: i * .12, attack: .05 })); noise({ dur: 1.4, type: 'bandpass', f: 5200, q: 4, gain: .012, attack: .3 }); },
    blink: () => { tone({ f: 240, f1: 50, dur: .45, gain: .07 }); noise({ dur: .4, type: 'lowpass', f: 1400, f1: 180, gain: .06 }); },
    glob: () => tone({ f: 150, f1: 460, dur: .22, gain: .05 }),
    splat: () => { noise({ dur: .35, type: 'lowpass', f: 800, f1: 140, gain: .11 }); tone({ f: 95, f1: 40, dur: .3, gain: .06 }); },
    boom: () => { noise({ dur: 1.8, type: 'lowpass', f: 1000, f1: 40, gain: .26, attack: .01 }); tone({ f: 85, f1: 24, dur: 1.3, gain: .16 }); },
    dismiss: () => tone({ f: 900, f1: 260, dur: .32, gain: .03 }),
    melt: () => noise({ dur: .9, type: 'bandpass', f: 1800, f1: 450, q: 1.5, gain: .045 }),
    cough: () => noise({ dur: .18, type: 'bandpass', f: 520, q: 2, gain: .05 }),
    hiss: () => { noise({ dur: 1.1, type: 'highpass', f: 3200, f1: 1200, gain: .09, attack: .02 }); noise({ dur: .5, type: 'lowpass', f: 600, f1: 200, gain: .05 }); },
    crystal: () => [0, 5, 9, 14].forEach((s2, i) => tone({ type: 'triangle', f: 880 * 2 ** (s2 / 12), dur: .5, gain: .03, delay: i * .045 })),
  };

  // ── Light flashes (a few pooled anchors in the light pool, faded by their intensity).
  const flashes = Array.from({ length: 6 }, () => { const o = new THREE.Object3D(); group.add(o); return { o, life: 0, dur: 1, peak: 0, release: null }; });
  function flash(point, color, intensity = 10, distance = 9, life = .2) {
    const f = flashes.find(x => x.life <= 0) ?? flashes.reduce((a, b) => a.life < b.life ? a : b);
    f.release?.(); f.o.position.copy(point); f.life = f.dur = life; f.peak = intensity;
    f.release = world.lights?.follow(f.o, { color, intensity, distance }) ?? null;
  }
  const lightOf = release => release?.light ?? null;

  // ── Who is in reach. Targets: foes and game; position at chest height.
  const chest = (e, out = v3()) => out.copy(e.model.position).setY(e.model.position.y + (e.aim ?? (e.kind === 'wolf' ? .9 : 1.4)));
  const alive = () => targets().filter(e => !e.dead && e.model?.visible !== false);
  const sees = (a, b) => !world.segmentBlocked(a, b);
  const playerChest = () => v3(player.position.x, player.position.y + 1.4, player.position.z);
  const inWater = p => { const w = waterAt(p.x, p.z); return w && w.depth > .3 && p.y < w.surface + .6 ? w : null; };
  // Every spell hit carries its element (systems/reactions.js, created below once all the helpers exist).
  let reactions = null, lastMarks = [];
  const hitWith = (target, amount, from, kind, opts) => reactions ? reactions.elemental(target, amount, from, kind, opts) : strike(target, amount, from, kind);

  // ── Chill (Frostlanze): a foe moves as through deep snow, frost smokes off him.
  const chilled = new Map();
  function chill(e, seconds = 4.5) { e.chill = Math.max(e.chill || 0, seconds); chilled.set(e, e.chill); spellFx?.douse?.(e); }

  // ════ Frostlanze ════
  const lanceMat = pixelMaterial('crystal', { tint: 0xd8f2ff, emissive: .9 }), lanceCore = new THREE.MeshBasicMaterial({ color: 0xf4fcff });
  const lances = Array.from({ length: 6 }, () => {
    const root = new THREE.Group(); root.visible = false; group.add(root);
    const shaft = new THREE.Mesh(boxGeometry(.16, .16, 1.35), lanceMat); root.add(shaft);
    const core = new THREE.Mesh(boxGeometry(.07, .07, 1.55), lanceCore); root.add(core);
    for (let i = 0; i < 4; i++) { const fin = new THREE.Mesh(boxGeometry(.05, .28, .5), lanceMat); fin.position.set(Math.cos(i * Math.PI / 2) * .11, Math.sin(i * Math.PI / 2) * .11, .32); fin.rotation.z = i * Math.PI / 2; root.add(fin); }
    const tip = new THREE.Mesh(boxGeometry(.1, .1, .42), lanceCore); tip.position.z = -.86; root.add(tip);
    const halo = new THREE.Mesh(boxGeometry(.34, .34, 1.7), new THREE.MeshBasicMaterial({ color: 0x5aa8e8, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false })); root.add(halo);
    return { root, active: false, dir: v3(), life: 0, trail: 0, release: null };
  });
  // Ice floes: frozen water you can stand on. Each slot has its own ragged shape, made once.
  const floeMat = pixelMaterial('snow', { tint: 0xc4def2 }), snowMat = pixelMaterial('snow', { tint: 0xf4f9ff }), clearMat = pixelMaterial('crystal', { tint: 0xa8c8d8 });
  const floes = Array.from({ length: 5 }, (_, n) => {
    const ice = [], snow = [], clear = [];
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
      const r = Math.hypot(i, j) + Math.sin(i * 3.1 + j * 1.7 + n) * .55;
      if (r > 3.15) continue;
      const h = .2 + Math.random() * .1, g = boxGeometry(.8, h, .8); const m = g.clone(); m.translate(i * .8 + rand(-.05, .05), -h / 2 + .08 + rand(-.02, .03), j * .8 + rand(-.05, .05));
      const k = Math.random(); (k < .28 ? snow : k < .42 ? clear : ice).push(m);
    }
    const root = new THREE.Group(); root.visible = false; root.name = 'ice floe'; group.add(root);
    const a = new THREE.Mesh(mergeGeometries(ice, false), floeMat); a.receiveShadow = true; root.add(a);
    if (snow.length) { const b = new THREE.Mesh(mergeGeometries(snow, false), snowMat); b.receiveShadow = true; root.add(b); }
    if (clear.length) { const c = new THREE.Mesh(mergeGeometries(clear, false), clearMat); c.receiveShadow = true; root.add(c); }
    return { root, life: 0, dur: 30, radius: 2.5, x: 0, z: 0, y: 0, melting: 0 };
  });
  function freeze(x, z, surface) {
    const near = floes.find(f => f.life > 0 && Math.hypot(f.x - x, f.z - z) < 1.6);
    if (near) { near.life = near.dur; near.melting = 0; return near; }
    const f = floes.find(q => q.life <= 0) ?? floes.reduce((a, b) => a.life < b.life ? a : b);
    f.x = x; f.z = z; f.y = surface; f.life = f.dur; f.melting = 0; f.root.visible = true; f.root.rotation.y = Math.random() * 6.28;
    f.root.position.set(x, surface - .5, z); f.root.scale.setScalar(.3);
    burst(v3(x, surface + .2, z), 'eis', 70, { speed: 6, up: 2.5, life: [.4, 1], stretch: .08 });
    puff(v3(x, surface + .3, z), 0xe8f4ff, 14, { spread: 2, speed: .8, up: .8, size: [4, 8] });
    chunks(v3(x, surface + .3, z), [0xe8f6ff, 0xbfe4fa, 0xffffff], 18, { speed: 3, up: 4, floor: surface + .1 });
    SFX.freeze();
    return f;
  }
  function melt(f) { if (f.life > 0 && !f.melting) { f.melting = 1.6; SFX.melt(); wildfire?.steam?.(f.x, f.z, 4); } }

  function castLance(origin, dir) {
    const l = lances.find(q => !q.active); if (!l) return;
    l.active = true; l.root.visible = true; l.root.position.copy(origin); l.dir.copy(dir).normalize(); l.life = 1.3; l.trail = 0;
    l.root.quaternion.setFromUnitVectors(v3(0, 0, -1), l.dir);
    l.release = world.lights?.follow(l.root, { color: 0x9fd8ff, intensity: 3.2, distance: 6 }) ?? null;
    burst(origin, 'eis', 22, { speed: 3, up: .3, life: [.2, .45] }); SFX.frost();
  }
  const segA = v3(), segB = v3(), segD = v3(), segO = v3(), segC = v3(), surf = { point: v3(), normal: v3() };
  /** First thing a segment a→b touches: a foe (sphere), the ground or a wall, or the water's surface. */
  function sweep(a, b, radiusPad = 0) {
    segD.subVectors(b, a); const len = segD.length(), lenSq = len * len;
    let best = Infinity, hit = null;
    const contact = traceSpellSurface(world, a, b, surf);
    if (contact) { best = contact.t; hit = { kind: contact.ground ? 'ground' : 'wall', point: contact.point.clone(), normal: contact.normal.clone() }; }
    for (const e of alive()) {
      chest(e, segC); segO.subVectors(a, segC);
      const r = (e.radius ?? (e.kind === 'wolf' ? .7 : .75)) + radiusPad, bb = segO.dot(segD), c = segO.lengthSq() - r * r, disc = bb * bb - lenSq * c;
      if (disc < 0 || !lenSq) continue;
      const t = c <= 0 ? 0 : (-bb - Math.sqrt(disc)) / lenSq;
      if (t >= 0 && t <= 1 && t < best) { best = t; hit = { kind: 'foe', target: e, point: v3().copy(a).addScaledVector(segD, t), normal: segD.clone().normalize().negate() }; }
    }
    // Water: the segment dips below the surface over water.
    if (a.y > -1e9) {
      const w = waterAt(b.x, b.z);
      if (w && b.y <= w.surface + .05 && a.y > w.surface - .05) {
        const t = (a.y - w.surface) / Math.max(1e-6, a.y - b.y);
        if (t >= 0 && t <= 1 && t < best) { best = t; hit = { kind: 'water', point: v3().copy(a).addScaledVector(segD, t).setY(w.surface), normal: UP.clone(), surface: w.surface }; }
      }
    }
    return hit;
  }
  function lanceImpact(l, hit) {
    const p = hit.point;
    // Into a cloud of rot: it freezes and falls as green hail.
    for (const c of clouds) if (c.life > 0 && Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < c.radius + .8 && Math.abs(c.pos.y + 1 - p.y) < 3) freezeCloud(c);
    if (hit.kind === 'foe') {
      const e = hit.target, dmg = magicDamage() * SPELLS.frostlanze.power;
      hitWith(e, dmg, l.root.position.clone(), 'frost');
      burst(p, 'eis', 40, { speed: 5, up: 1, stretch: .06 }); chunks(p, [0xe8f6ff, 0xbfe4fa, 0xa8d8f4], 12, { speed: 3.5, up: 3 });
      puff(p, 0xe8f4ff, 6, { spread: .4, size: [3, 5] });
    } else if (hit.kind === 'water') freeze(p.x, p.z, hit.surface);
    else {
      burst(p, 'eis', 46, { speed: 6, up: 2, stretch: .07, floor: heightAt(p.x, p.z), bounce: .3 });
      chunks(p, [0xe8f6ff, 0xbfe4fa, 0xffffff, 0xa8d8f4], 22, { speed: 4.5, up: 4.5 });
      puff(p, 0xeef8ff, 8, { spread: .6, size: [4, 7] });
      if (hit.kind === 'ground') { decal('rime', p, 3.2, 14); for (let i = 0; i < 3; i++) decal('rime', v3(p.x + rand(-1.6, 1.6), 0, p.z + rand(-1.6, 1.6)), rand(1.4, 2.2), 12); }
    }
    // Cold puts fire out: grass, trees and burning men round the impact.
    const n = wildfire?.extinguish?.(p.x, p.z, 3.2) || 0; if (n) wildfire?.steam?.(p.x, p.z, 6);
    for (const e of alive()) if (e.model.position.distanceTo(p) < 3) spellFx?.douse?.(e);
    flash(p, 0xbfe8ff, 6, 7, .18); SFX.shatter();
    ai?.noise?.('fireImpact', p, { source: 'player' });
  }
  function stepLances(dt) {
    for (const l of lances) {
      if (!l.active) continue;
      l.life -= dt; segA.copy(l.root.position); segB.copy(segA).addScaledVector(l.dir, 36 * Math.min(dt, .05));
      const hit = sweep(segA, segB);
      if (hit || l.life <= 0) { if (hit) { l.root.position.copy(hit.point); lanceImpact(l, hit); } l.active = false; l.root.visible = false; l.release?.(); l.release = null; continue; }
      l.root.position.copy(segB); l.root.rotateZ(dt * 9);
      l.trail += dt;
      while (l.trail > .008) { l.trail -= .008;
        const p = l.root.position;
        spawn(glow, p.x + rand(-.08, .08), p.y + rand(-.08, .08), p.z + rand(-.08, .08), rand(-.3, .3), rand(-.6, 0), rand(-.3, .3), { life: rand(.3, .7), size: rand(.8, 1.8), c0: 0xf4fcff, c1: 0x4f9ad8, gravity: 1.5, drag: 1 });
        if (Math.random() < .3) spawn(haze, p.x, p.y, p.z, rand(-.2, .2), rand(0, .2), rand(-.2, .2), { life: rand(.5, .9), size: rand(2, 3.5), c0: 0xe8f4ff, curve: 'grow', grow: 1.2 });
      }
    }
  }

  // ════ Kettenblitz ════
  const BEAM_MAX = 1100;
  const beams = new THREE.InstancedMesh(boxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }), BEAM_MAX);
  beams.instanceMatrix.setUsage(THREE.DynamicDrawUsage); beams.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(BEAM_MAX * 3), 3);
  beams.count = 0; beams.frustumCulled = false; beams.name = 'lightning'; group.add(beams);
  const bolts = [];
  function bolt(a, b, { life = .34, width = 1, branches = 2, color = 0xc8b0ff, halo = 1, jagged = 1 } = {}) {
    bolts.push({ a: a.clone(), b: b.clone(), life, dur: life, width, branches, color, halo, jagged, points: null, jitter: 0 });
  }
  function rebuildBolt(B) {
    const len = B.a.distanceTo(B.b), segs = Math.max(4, Math.min(16, Math.round(len * 1.4)));
    B.points = [boltPath(B.a, B.b, segs, Math.min(1.1, .18 + len * .06) * B.jagged)];
    for (let k = 0; k < B.branches; k++) {
      const from = B.points[0][1 + Math.floor(Math.random() * (segs - 2))], end = { x: from.x + rand(-1.4, 1.4), y: from.y + rand(-1.2, .6), z: from.z + rand(-1.4, 1.4) };
      B.points.push(boltPath(from, end, 4, .3));
    }
  }
  function stepBolts(dt) {
    let n = 0;
    for (let i = bolts.length - 1; i >= 0; i--) {
      const B = bolts[i]; B.life -= dt; if (B.life <= 0) { bolts.splice(i, 1); continue; }
      B.jitter -= dt; if (!B.points || B.jitter <= 0) { rebuildBolt(B); B.jitter = .045; }
      const k = B.life / B.dur, on = Math.random() < .85 ? 1 : .35;
      col0.setHex(B.color);
      B.points.forEach((pts, bi) => {
        for (let j = 0; j < pts.length - 1 && n < BEAM_MAX - 1; j++) {
          const p = pts[j], q = pts[j + 1]; _p.set((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2);
          _d.set(q.x - p.x, q.y - p.y, q.z - p.z); const L = _d.length(); if (L < 1e-4) continue; _d.divideScalar(L);
          _q.setFromUnitVectors(Z, _d);
          const w = (bi ? .5 : 1) * B.width;
          for (const [thick, bright] of B.halo > 1 ? [[.045 * w, 1], [.13 * w, .4], [.3 * w * B.halo, .09]] : [[.05 * w, 1], [.16 * w, .45]]) {
            if (n >= BEAM_MAX - 1) break;
            _m.compose(_p, _q, _s.set(thick, thick, L + thick)); beams.setMatrixAt(n, _m);
            _c.copy(col0).lerp(WHITE, bright === 1 ? .7 : 0).multiplyScalar(bright * k * on * (bi ? .7 : 1)); beams.setColorAt(n, _c); n++;
          }
        }
      });
    }
    beams.count = n; beams.instanceMatrix.needsUpdate = true; beams.instanceColor.needsUpdate = true;
  }
  /** Shock through the water: everyone standing in it within reach is struck, the wanderer too. */
  function electrify(point, dmg) {
    const struck = [];
    for (const e of alive()) { const p = e.model.position; if (p.distanceTo(point) < 9 && inWater(v3(p.x, p.y + .2, p.z))) { hitWith(e, dmg * .55, point, 'shock'); e.stagger = Math.max(e.stagger || 0, 1.1); struck.push(e); } }
    if (player.position.distanceTo(point) < 9 && inWater(v3(player.position.x, player.position.y + .2, player.position.z))) { hurtPlayer(14, point); toast('STROMSCHLAG · DAS WASSER LEITET', 1800); }
    // Arcs crawl over the surface.
    for (let i = 0; i < 7; i++) { const a = Math.random() * 6.28, r = rand(2, 8), end = v3(point.x + Math.cos(a) * r, point.y + .05, point.z + Math.sin(a) * r);
      if (waterAt(end.x, end.z)) bolt(v3(point.x, point.y + .05, point.z), end, { life: .5, width: .6, branches: 1 }); }
    for (let i = 0; i < 50; i++) { const a = Math.random() * 6.28, r = rand(0, 8); spawn(glow, point.x + Math.cos(a) * r, point.y + .05, point.z + Math.sin(a) * r, rand(-2, 2), rand(0, .6), rand(-2, 2), { life: rand(.2, .5), size: rand(.8, 1.6), c0: 0xffffff, c1: 0x8a62f0, stretch: .2 }); }
    return struck;
  }
  // ════ Kettenblitz as a held stream (the hand open, lightning pouring from the fingers) ════
  // While the cast is held: up to three foes in front, the nearest first, each wrapped in arcs that crawl over the
  // body; they jerk and stagger. Nobody in front: the arcs spray into the ground ahead. A buzz while it lasts.
  const STREAM = { tick: .12, cone: .42, range: 18 };
  let stream = null;
  const streamCol = () => pick([0x7aa8ff, 0x8f9cff, 0xa08cff, 0x6f9cff]);
  function streamAudio() {
    const a = audio(); if (!a) return null;
    try {
      const t = a.currentTime, out = a.createGain(); out.gain.setValueAtTime(.0001, t); out.gain.exponentialRampToValueAtTime(.09, t + .08); out.connect(a.destination);
      const osc = a.createOscillator(), og = a.createGain(); osc.type = 'sawtooth'; osc.frequency.value = 72; og.gain.value = .35; osc.connect(og); og.connect(out);
      const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = 23; lg.gain.value = 40; lfo.connect(lg); lg.connect(osc.frequency);
      const len = a.sampleRate, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < .08 ? 1 : .25);
      const src = a.createBufferSource(), bp = a.createBiquadFilter(); src.buffer = buf; src.loop = true; bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = .8;
      src.connect(bp); bp.connect(out); osc.start(t); lfo.start(t); src.start(t);
      return { stop() { const t2 = a.currentTime; out.gain.cancelScheduledValues(t2); out.gain.setValueAtTime(out.gain.value, t2); out.gain.exponentialRampToValueAtTime(.0001, t2 + .15); osc.stop(t2 + .2); lfo.stop(t2 + .2); src.stop(t2 + .2); } };
    } catch { return null; }
  }
  /** Each frame of the stream: origin (the hand), dir (the aim). Returns the foes in it. */
  function channel(origin, dir, dt) {
    if (!stream) {
      stream = { tick: 0, t: 0, sound: streamAudio(), hand: new THREE.Object3D(), far: new THREE.Object3D(), lights: [] };
      group.add(stream.hand, stream.far);
      stream.lights = [world.lights?.follow(stream.hand, { color: 0xa8c0ff, intensity: 3, distance: 6 }), world.lights?.follow(stream.far, { color: 0xb8a8ff, intensity: 5, distance: 9 })];
      SFX.thunder();
    }
    stream.t += dt; stream.tick -= dt;
    stream.hand.position.copy(origin);
    const flat = v3(dir.x, 0, dir.z).normalize(), eye = playerChest().setY(player.position.y + 1.9);
    // Who is in the stream: the nearest in a cone, then whoever stands closest to them.
    const inFront = alive().filter(e => { const d = e.model.position.distanceTo(player.position); return d < STREAM.range && inCone(player.position, flat, e.model.position, STREAM.range, STREAM.cone) && sees(eye, chest(e)); })
      .sort((a, b) => a.model.position.distanceTo(player.position) - b.model.position.distanceTo(player.position));
    const targets = inFront.length ? chainTargets(inFront[0], [...inFront, ...alive().filter(e => !inFront.includes(e))], { jumps: 2, reach: 6.5, position: e => chest(e) }) : [];
    const flick = () => (Math.random() < .2 ? .35 : 1);
    // Fingers: a little fan of starting points round the palm.
    const finger = k => v3(origin.x + rand(-.07, .07), origin.y + rand(-.05, .07), origin.z + rand(-.07, .07)).addScaledVector(dir, .08 + k * .02);
    let last = origin;
    // New arcs every 45 ms (each lives a little longer than that), so the stream flickers instead of piling up.
    stream.arc = (stream.arc || 0) - dt; const draw = stream.arc <= 0; if (draw) stream.arc = .045;
    targets.forEach((e, i) => {
      const c = chest(e).clone(), from = i === 0 ? null : chest(targets[i - 1]).clone();
      if (draw) {
        for (let k = 0; k < (i === 0 ? 4 : 2); k++) bolt(from ? v3().copy(from).add(v3(rand(-.2, .2), rand(-.3, .3), rand(-.2, .2))) : finger(k), v3(c.x + rand(-.25, .25), c.y + rand(-.5, .4), c.z + rand(-.25, .25)),
          { life: .06, width: i === 0 ? .78 : .6, branches: 2, color: streamCol(), halo: 1.4, jagged: 1.5 });
        // Arcs crawling over the body.
        for (let k = 0; k < 2; k++) bolt(v3(c.x + rand(-.35, .35), c.y + rand(-.9, .6), c.z + rand(-.35, .35)), v3(c.x + rand(-.4, .4), c.y + rand(-.9, .6), c.z + rand(-.4, .4)), { life: .05, width: .35, branches: 1, color: streamCol() });
      }
      if (Math.random() < dt * 40) spawn(glow, c.x + rand(-.3, .3), c.y + rand(-.6, .5), c.z + rand(-.3, .3), rand(-3, 3), rand(-1, 3), rand(-3, 3), { life: rand(.1, .25), size: rand(.6, 1.2), c0: 0xffffff, c1: 0x7a8aff, stretch: .3, gravity: 6 });
      // They jerk and cannot act.
      e.stagger = Math.max(e.stagger || 0, .35); e.windup = 0; e.cooldown = Math.max(e.cooldown || 0, .5);
      e.model.rotation.y += rand(-.06, .06);
      last = c;
    });
    if (!targets.length) {
      // Into the air and the ground ahead.
      for (let k = 0; k < 3; k++) {
        const a = rand(-STREAM.cone, STREAM.cone), r = rand(5, 9), cs = Math.cos(a), sn = Math.sin(a);
        const end = v3(origin.x + (flat.x * cs - flat.z * sn) * r, 0, origin.z + (flat.x * sn + flat.z * cs) * r);
        end.y = Math.min(origin.y + dir.y * r + rand(-.5, .5), heightAt(end.x, end.z) + rand(0, 1.8));
        const hit = sweep(origin, end), p = hit ? hit.point : end;
        if (draw) bolt(finger(k), p, { life: .06, width: .55, branches: 2, color: streamCol(), halo: 1.3, jagged: 1.5 });
        if (hit && Math.random() < dt * 12) { burst(p, 'blitz', 6, { speed: 4, up: 2, stretch: .2, floor: p.y, bounce: .4 }); if (hit.kind === 'ground' && Math.random() < .08) decal('scorch', p, .9, 10); }
        if (hit?.kind === 'water' && stream.tick <= 0) electrify(p, magicDamage() * .3);
        sparkClouds(p);
        last = p;
      }
    }
    stream.far.position.copy(last);
    for (const L of stream.lights) if (L?.light) L.light.intensity = (L === stream.lights[0] ? 3 : 5) * flick();
    // Damage and the element in ticks; anyone in a cloud of rot sets it off.
    if (stream.tick <= 0) {
      stream.tick = STREAM.tick;
      targets.forEach((e, i) => { hitWith(e, magicDamage() * SPELLS.kettenblitz.power * STREAM.tick * (i ? .7 : 1), origin, 'shock', { icd: 'stream' }); sparkClouds(e.model.position, 0); });
      ai?.noise?.('fireImpact', last, { source: 'player' });
    }
    return targets;
  }
  function endChannel() {
    if (!stream) return;
    stream.sound?.stop(); for (const L of stream.lights) L?.(); stream.hand.removeFromParent(); stream.far.removeFromParent(); stream = null;
  }
  const sparkClouds = (point, r = .8) => { for (const c of clouds) if (c.life > 0 && Math.hypot(c.pos.x - point.x, c.pos.z - point.z) < c.radius + r && Math.abs(c.pos.y + 1 - point.y) < 3) explode(c); };

  // ════ Sturmstoß ════
  const clouds = [];
  function castGust(origin, dir) {
    const spell = SPELLS.sturmstoss, flat = v3(dir.x, 0, dir.z).normalize(), half = .66;
    SFX.whoosh();
    // The gust itself: streaks of air, dust from the ground, leaves torn loose.
    for (let i = 0; i < 140; i++) {
      const a = rand(-half, half), c = Math.cos(a), s = Math.sin(a), d = v3(flat.x * c - flat.z * s, rand(-.05, .25), flat.x * s + flat.z * c), sp = rand(12, 24);
      spawn(glow, origin.x + rand(-.4, .4), origin.y + rand(-.6, .4), origin.z + rand(-.4, .4), d.x * sp, d.y * sp, d.z * sp, { life: rand(.45, .95), size: rand(.8, 1.6), c0: 0xffffff, c1: 0x6a8a80, drag: 1.8, stretch: .55, swirl: rand(0, 6) });
    }
    // A ring of pressure rolling out in front of the hand.
    for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283, u = v3(-flat.z, 0, flat.x);
      spawn(haze, origin.x + flat.x * .6 + u.x * Math.cos(a) * .5, origin.y + Math.sin(a) * .5, origin.z + flat.z * .6 + u.z * Math.cos(a) * .5, flat.x * 9 + u.x * Math.cos(a) * 2, Math.sin(a) * 2, flat.z * 9 + u.z * Math.cos(a) * 2, { life: rand(.5, .8), size: rand(3, 5), c0: 0xf4fbf8, curve: 'grow', grow: 2.5, drag: 2.5 }); }
    for (let i = 0; i < 44; i++) {
      const r = rand(1.5, spell.range), a = rand(-half, half), c = Math.cos(a), s = Math.sin(a), x = player.position.x + (flat.x * c - flat.z * s) * r, z = player.position.z + (flat.x * s + flat.z * c) * r, y = heightAt(x, z);
      if (waterAt(x, z)) { spawn(haze, x, y + .1, z, flat.x * 4, 1.5, flat.z * 4, { life: rand(.6, 1), size: rand(3, 5), c0: 0xe8f4f8, curve: 'grow' }); continue; }
      spawn(haze, x, y + .2, z, flat.x * rand(3, 8), rand(.6, 2.2), flat.z * rand(3, 8), { life: rand(1.1, 1.9), size: rand(4, 8), c0: pick([0xd8c8a8, 0xc8b898, 0xe0d4bc]), curve: 'grow', grow: 2.4, drag: 1.1 });
      if (i % 2 === 0) spawn(solid, x, y + .3, z, flat.x * rand(4, 9), rand(2, 5), flat.z * rand(4, 9), { life: rand(1.4, 2.4), size: rand(1, 2), c0: pick([0x6a8a3a, 0x9a7a3a, 0x8a5a2a, 0x4a6a2a]), gravity: 3, drag: 1.2, swirl: 5, spin: 9, curve: 'steady', floor: y + .03, rest: .8 });
    }
    // Foes thrown back, loose things flung, fire blown out, rot blown away.
    for (const e of alive()) {
      const p = e.model.position; if (!inCone(player.position, flat, p, spell.range, half)) continue;
      if (!sees(playerChest(), chest(e))) continue;
      const d = p.distanceTo(player.position), force = 3.2 * (1 - d / (spell.range + 2)) + 1;
      hitWith(e, magicDamage() * spell.power, origin, 'wind');
      knock(e, flat, force);
      e.stagger = Math.max(e.stagger || 0, 1.2);
    }
    for (let r = 2; r <= spell.range; r += 2.5) {
      const p = v3(player.position.x + flat.x * r, 0, player.position.z + flat.z * r); p.y = heightAt(p.x, p.z) + .6;
      shove(p, v3(flat.x, .45, flat.z), 3.4, 1.6);
      wildfire?.extinguish?.(p.x, p.z, 2 + r * .25);
    }
    for (const c of clouds) if (inCone(player.position, flat, c.pos, spell.range + c.radius, half + .2)) { c.vel.addScaledVector(flat, 5.5); c.life = Math.min(c.life, c.life * .7 + 1); }
    ai?.noise?.('swing', player.position, { source: 'player' });
  }

  // ════ Erdstachel ════
  const stoneMat = pixelMaterial('stone', { tint: 0xfff4e4 }), darkStone = pixelMaterial('fieldstone', { tint: 0xf4e8d8 });
  const spikes = Array.from({ length: 18 }, (_, n) => {
    const parts = [], dark = [];
    const tiers = [[1.05, .55], [.82, .6], [.62, .6], [.42, .55], [.24, .45]];
    let y = 0; tiers.forEach(([w, h], i) => { const g = boxGeometry(w, h, w * rand(.8, 1)).clone(); g.rotateX(rand(-.12, .12)); g.rotateY(i * .5 + n); g.translate(rand(-.06, .06), y + h / 2, rand(-.06, .06)); (i % 2 ? dark : parts).push(g); y += h * .78; });
    // Shards broken off round the foot.
    for (let k = 0; k < 3; k++) { const w = rand(.22, .36), g = boxGeometry(w, rand(.3, .55), w).clone(); g.rotateZ(rand(-.6, .6)); g.rotateY(rand(0, 6)); const a = rand(0, 6.28); g.translate(Math.cos(a) * .55, .12, Math.sin(a) * .55); dark.push(g); }
    const root = new THREE.Group(); root.visible = false; group.add(root);
    const a = new THREE.Mesh(mergeGeometries(parts, false), stoneMat); a.castShadow = true; a.receiveShadow = true; root.add(a);
    const b = new THREE.Mesh(mergeGeometries(dark, false), darkStone); b.castShadow = true; b.receiveShadow = true; root.add(b);
    return { root, life: 0, dur: 3.4, ground: 0, height: y, delay: 0, armed: false, hit: null, x: 0, z: 0, dir: v3() };
  });
  const lines = [];
  function castLine(dir) {
    const spell = SPELLS.erdstachel, flat = v3(dir.x, 0, dir.z).normalize(), hitSet = new Set();
    const points = []; let prev = v3(player.position.x, player.position.y, player.position.z), prevY = player.position.y;
    for (let i = 0; i < 11; i++) {
      const r = 1.7 + i * 1.22, x = player.position.x + flat.x * r, z = player.position.z + flat.z * r, y = heightAt(x, z);
      if (Math.abs(y - prevY) > 1.7) break;                                         // a cliff or a wall face
      if (world.segmentBlocked(v3(prev.x, prevY + .7, prev.z), v3(x, y + .7, z))) break; // a wall
      points.push({ x, y, z }); prev = v3(x, y, z); prevY = y;
    }
    if (!points.length) { toast('KEIN BODEN FÜR DIE STACHEL', 1200); return; }
    SFX.rumble();
    points.forEach((pt, i) => {
      const s = spikes.find(q => q.life <= 0 && !q.armed) ?? spikes.reduce((a, b) => a.life < b.life ? a : b);
      s.armed = true; s.delay = i * .06; s.life = 0; s.x = pt.x + rand(-.15, .15); s.z = pt.z + rand(-.15, .15); s.ground = pt.y; s.hit = hitSet; s.dir.copy(flat);
      s.scale = rand(.8, 1.25) * (1 + i * .02); s.root.rotation.set(flat.z * rand(.1, .25) * (Math.random() < .5 ? -1 : 1), rand(0, 6.28), -flat.x * rand(.1, .25));
    });
    lines.push({ hit: hitSet });
  }
  function raiseSpike(s) {
    s.armed = false; s.life = s.dur; s.root.visible = true; s.root.scale.setScalar(s.scale);
    const p = v3(s.x, s.ground + .1, s.z), w = waterAt(s.x, s.z);
    SFX.crack();
    if (w && w.depth > .2) { for (let i = 0; i < 24; i++) spawn(haze, s.x + rand(-.5, .5), w.surface + .1, s.z + rand(-.5, .5), rand(-1.5, 1.5), rand(2, 4.5), rand(-1.5, 1.5), { life: rand(.5, .9), size: rand(2, 3.5), c0: 0xdcecf4, gravity: 6, curve: 'shrink' }); }
    else { decal('crack', p, rand(1.6, 2.2), 10); puff(p, 0xa89878, 6, { spread: .5, speed: 1.4, up: 1.2, size: [3, 6], grow: 2.2 }); }
    chunks(p, [0x8a7a64, 0x6a5e50, 0x5a4a3a, 0xa89878], 9, { speed: 3.2, up: 5.5, floor: s.ground });
    // Who stands on it is thrown; loose things leap.
    for (const e of alive()) {
      if (s.hit.has(e)) continue;
      const q = e.model.position; if (Math.hypot(q.x - s.x, q.z - s.z) > 1.25 || Math.abs(q.y - s.ground) > 2) continue;
      s.hit.add(e); hitWith(e, magicDamage() * SPELLS.erdstachel.power, p, 'earth');
      knock(e, v3(s.dir.x * .6, 0, s.dir.z * .6), 2.6, 8); e.stagger = Math.max(e.stagger || 0, 1.3);
    }
    shove(v3(s.x, s.ground + .3, s.z), v3(s.dir.x * .3, 1, s.dir.z * .3), 1.8, 2.2);
    ai?.noise?.('fireImpact', p, { source: 'player' });
  }
  function stepSpikes(dt) {
    for (const s of spikes) {
      if (s.armed) { s.delay -= dt; if (s.delay <= 0) raiseSpike(s); continue; }
      if (s.life <= 0) continue;
      s.life -= dt; const age = s.dur - s.life;
      // Out of the ground fast (a little past, then settling), a long hold, then down again.
      const up = age < .12 ? age / .12 * 1.08 : age < .22 ? 1.08 - (age - .12) / .1 * .08 : s.life < .55 ? Math.max(0, s.life / .55) : 1;
      s.root.position.set(s.x, s.ground - s.height * s.scale * (1 - up) - .15, s.z);
      if (s.life < .55 && Math.random() < dt * 14) chunks(v3(s.x, s.ground + .2, s.z), [0x8a7a64, 0x6a5e50], 1, { speed: 1, up: 1.5, floor: s.ground });
      if (s.life <= 0) s.root.visible = false;
    }
  }

  // ════ Irrlicht ════
  const wisp = (() => {
    const root = new THREE.Group(); root.visible = false; root.name = 'Irrlicht'; group.add(root);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xfffbe8 }), haloMat = new THREE.MeshBasicMaterial({ color: 0xffd870, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false });
    const core = new THREE.Mesh(boxGeometry(.14, .14, .14), coreMat); root.add(core);
    const halo = new THREE.Mesh(boxGeometry(.3, .3, .3), haloMat); root.add(halo);
    const halo2 = new THREE.Mesh(boxGeometry(.46, .46, .46), new THREE.MeshBasicMaterial({ color: 0xffb840, transparent: true, opacity: .12, blending: THREE.AdditiveBlending, depthWrite: false })); root.add(halo2);
    const motes = Array.from({ length: 6 }, (_, i) => { const m = new THREE.Mesh(boxGeometry(.045, .045, .045), coreMat); root.add(m); return { m, a: i / 6 * 6.28, r: .32 + (i % 2) * .1, tilt: i * .9 }; });
    return { root, core, halo, halo2, motes, life: 0, release: null, pos: v3(), vel: v3(), emit: 0 };
  })();
  function castWisp() {
    if (wisp.life > 0) { dismissWisp(); return; }
    wisp.life = SPELLS.irrlicht.power; wisp.root.visible = true;
    wisp.pos.copy(player.position).add(v3(0, 1.6, 0)); wisp.vel.set(0, 2, 0); wisp.root.position.copy(wisp.pos);
    wisp.release = world.lights?.follow(wisp.root, { color: 0xffe6a8, intensity: 7, distance: 20, decay: 1 }) ?? null;
    burst(wisp.pos, 'licht', 60, { speed: 4, up: 1, stretch: .05 }); flash(wisp.pos, 0xfff0c0, 10, 12, .3); SFX.wisp();
    toast('IRRLICHT · ES FOLGT DIR · NOCHMAL WIRKEN ENTLÄSST ES', 2200);
  }
  function dismissWisp() {
    if (wisp.life <= 0) return;
    burst(wisp.root.position, 'licht', 40, { speed: 3, up: .5 }); SFX.dismiss();
    wisp.life = 0; wisp.root.visible = false; wisp.release?.(); wisp.release = null;
  }
  function stepWisp(dt) {
    if (wisp.life <= 0) return;
    wisp.life -= dt; if (wisp.life <= 0) { dismissWisp(); return; }
    const yaw = player.yaw ?? 0, target = v3(player.position.x + Math.cos(yaw) * .75 + Math.sin(yaw) * .35, player.position.y + 2.35 + Math.sin(time * 1.7) * .14, player.position.z - Math.sin(yaw) * .75 + Math.cos(yaw) * .35);
    // A spring, a little lazy, so it trails you and swings round corners.
    wisp.vel.addScaledVector(_d.subVectors(target, wisp.pos), dt * 18).multiplyScalar(Math.exp(-dt * 5.5));
    wisp.pos.addScaledVector(wisp.vel, dt); wisp.root.position.copy(wisp.pos);
    const fade = wisp.life < 5 ? (Math.sin(time * 24) > -.3 ? 1 : .35) * Math.max(.3, wisp.life / 5) : 1;
    wisp.core.rotation.set(time * 2, time * 3, 0); wisp.halo.rotation.set(-time, time * 1.4, time * .6); wisp.halo2.rotation.set(time * .5, -time * .8, 0);
    const pulse = 1 + Math.sin(time * 5) * .12; wisp.halo.scale.setScalar(pulse * fade); wisp.halo2.scale.setScalar((2 - pulse) * fade);
    for (const m of wisp.motes) { m.a += dt * 2.6; m.m.position.set(Math.cos(m.a) * m.r, Math.sin(m.a + m.tilt) * m.r * .6, Math.sin(m.a) * m.r); }
    const L = lightOf(wisp.release); if (L) L.intensity = 7 * fade * (.92 + Math.sin(time * 9) * .05 + Math.sin(time * 23) * .03);
    wisp.emit += dt; while (wisp.emit > .05) { wisp.emit -= .05;
      spawn(glow, wisp.pos.x + rand(-.15, .15), wisp.pos.y + rand(-.1, .1), wisp.pos.z + rand(-.15, .15), rand(-.25, .25), rand(-.4, .1), rand(-.25, .25), { life: rand(.6, 1.3), size: rand(.6, 1.3), c0: 0xfff6d0, c1: 0xe8b440, gravity: .5, drag: 1.2 }); }
  }

  // ════ Lebensquell ════
  const stemMat = new THREE.MeshLambertMaterial({ color: 0x4a8a2a }), leafMat = new THREE.MeshLambertMaterial({ color: 0x5aa83a });
  const petalMats = [0xff6a5a, 0xffe050, 0x7a9aff, 0xffffff, 0xe880e8].map(c => new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: .35 })), heartMat = new THREE.MeshLambertMaterial({ color: 0xf0c030, emissive: 0xf0c030, emissiveIntensity: .5 });
  const flowers = Array.from({ length: 56 }, (_, i) => {
    const root = new THREE.Group(); root.visible = false; group.add(root);
    const h = rand(4, 8) * T, stem = new THREE.Mesh(boxGeometry(T, h, T), stemMat); stem.position.y = h / 2; root.add(stem);
    const leaf = new THREE.Mesh(boxGeometry(T * 3, T, T), leafMat); leaf.position.set(T, h * .4, 0); leaf.rotation.z = .5; root.add(leaf);
    if (i % 4 === 3) { // a tuft of grass instead of a flower
      stem.visible = false; leaf.visible = false;
      for (let k = 0; k < 4; k++) { const bh = rand(5, 9) * T, b = new THREE.Mesh(boxGeometry(T, bh, T), k % 2 ? leafMat : stemMat); b.position.set(rand(-2, 2) * T, bh / 2, rand(-2, 2) * T); b.rotation.set(rand(-.3, .3), 0, rand(-.3, .3)); root.add(b); }
    } else {
      const petal = new THREE.Mesh(boxGeometry(T * 3, T * 1.5, T * 3), petalMats[i % petalMats.length]); petal.position.y = h + T * .5; root.add(petal);
      const heart = new THREE.Mesh(boxGeometry(T * 1.2, T * 1.6, T * 1.2), heartMat); heart.position.y = h + T * .8; root.add(heart);
    }
    return { root, life: 0, dur: 40, delay: 0, armed: false, x: 0, y: 0, z: 0, scale: 1 };
  });
  let healing = null;
  function castHeal() {
    const spell = SPELLS.lebensquell;
    healing = { left: spell.power, rate: spell.power / 4, t: 0, emit: 0 };
    SFX.heal();
    // Fire round your feet dies down; flowers come up through the ash.
    wildfire?.extinguish?.(player.position.x, player.position.z, 3.5);
    let placed = 0;
    for (let tries = 0; tries < 80 && placed < 26; tries++) {
      const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * 3.4 + .6, x = player.position.x + Math.cos(a) * r, z = player.position.z + Math.sin(a) * r;
      if (waterAt(x, z)) continue;
      const y = heightAt(x, z); if (Math.abs(y - player.position.y) > 1.4) continue;
      const f = flowers.find(q => q.life <= 0 && !q.armed) ?? flowers.reduce((a2, b) => a2.life < b.life ? a2 : b);
      f.armed = true; f.delay = .15 + r * .22 + rand(0, .2); f.x = x; f.y = y; f.z = z; f.scale = rand(1.3, 1.9); f.root.rotation.y = Math.random() * 6.28; f.root.visible = false;
      placed++;
    }
    burst(v3(player.position.x, player.position.y + .2, player.position.z), 'leben', 50, { speed: 3.5, up: 2.5, gravity: -1.5, drag: 1.5 });
    flash(v3(player.position.x, player.position.y + 1, player.position.z), 0xa8f0a0, 6, 8, 1.2);
  }
  function stepHeal(dt) {
    for (const f of flowers) {
      if (f.armed) { f.delay -= dt; if (f.delay <= 0) { f.armed = false; f.life = f.dur; f.root.visible = true; f.root.position.set(f.x, f.y, f.z);
        burst(v3(f.x, f.y + .1, f.z), 'leben', 5, { speed: 1, up: 1.4, gravity: -1, life: [.5, 1] }); } continue; }
      if (f.life <= 0) continue;
      f.life -= dt; const age = f.dur - f.life;
      const s = age < .5 ? (age / .5) ** .6 * 1.15 : age < .7 ? 1.15 - (age - .5) / .2 * .15 : f.life < 2 ? f.life / 2 : 1;
      f.root.scale.set(f.scale * Math.max(.01, s), f.scale * Math.max(.01, s), f.scale * Math.max(.01, s));
      f.root.rotation.z = Math.sin(time * 1.6 + f.x) * .06;
      if (f.life <= 0) f.root.visible = false;
    }
    if (!healing) return;
    healing.t += dt; const amount = Math.min(healing.left, healing.rate * dt * (1 + Math.sin(healing.t * 9) * .4)); healing.left -= amount; healPlayer(amount);
    healing.emit += dt;
    while (healing.emit > .02) { healing.emit -= .02;
      const a = healing.t * 4 + Math.random() * 6.28, r = rand(.3, 1.1), p = player.position;
      spawn(glow, p.x + Math.cos(a) * r, p.y + rand(0, .2), p.z + Math.sin(a) * r, -Math.sin(a) * 1.2, rand(1.4, 2.6), Math.cos(a) * 1.2, { life: rand(.7, 1.3), size: rand(.9, 2), c0: pick([0xb8ff9a, 0x9af07a, 0xd8ffc8]), c1: 0x2a6a2a, drag: .8, swirl: 3 });
      // A ring of green light on the ground round your feet.
      if (Math.random() < .5) { const b = Math.random() * 6.283; spawn(glow, p.x + Math.cos(b) * 1.3, p.y + .06, p.z + Math.sin(b) * 1.3, 0, .15, 0, { life: rand(.3, .6), size: rand(1.4, 2.4), c0: 0x7ae060, c1: 0x1a4a1a, curve: 'steady' }); }
      if (Math.random() < .12) spawn(solid, p.x + rand(-1, 1), p.y + rand(1.4, 2.4), p.z + rand(-1, 1), rand(-.4, .4), rand(-.2, .3), rand(-.4, .4), { life: rand(1.5, 2.5), size: rand(1, 1.6), c0: pick([0x6cc46a, 0x9ae88a, 0xf0d040]), gravity: .8, drag: 1.4, swirl: 4, spin: 6, curve: 'steady', floor: heightAt(p.x, p.z) + .03, rest: 1 });
    }
    if (healing.left <= .01) healing = null;
  }

  // ════ Schattenschritt ════
  function castBlink(dir) {
    const spell = SPELLS.schattenschritt, flat = v3(dir.x, 0, dir.z).normalize(), start = player.position.clone();
    let best = null, prevY = start.y;
    for (let r = .5; r <= spell.power + 1e-6; r += .35) {
      const x = start.x + flat.x * r, z = start.z + flat.z * r, y = heightAt(x, z);
      if (Math.abs(y - prevY) > 1.3) break;                                                 // cliff or ledge
      if (world.segmentBlocked(v3(start.x, start.y + 1.1, start.z), v3(x, y + 1.1, z))) break; // a wall between
      if (world.blocked?.(x, z, .35, y)) continue;                                         // a crate, a post: step past it
      best = v3(x, y, z); prevY = y;
    }
    if (!best || best.distanceTo(start) < 1.2) { toast('KEIN SCHATTEN, IN DEN DU TRETEN KÖNNTEST', 1500); return false; }
    // Smoke where you were, a trail of shadow, smoke where you come out.
    const shade = (p, n, out) => { for (let i = 0; i < n; i++) spawn(haze, p.x + rand(-.4, .4), p.y + rand(0, 1.9), p.z + rand(-.4, .4), rand(-.6, .6) * (out ? 2 : 1), rand(-.3, .6), rand(-.6, .6) * (out ? 2 : 1), { life: rand(.9, 1.7), size: rand(4, 7), c0: pick([0x3a2458, 0x2a1840, 0x4a2a68, 0x1a1028]), curve: 'grow', grow: 1.3, drag: 1.5 }); };
    shade(start, 34, true); burst(v3(start.x, start.y + 1, start.z), 'schatten', 70, { speed: 3.5, up: -.3, gravity: -.5, size: [1.2, 2.8] });
    for (let t = 0; t < 1; t += .05) { const p = v3().lerpVectors(start, best, t);
      spawn(glow, p.x + rand(-.2, .2), p.y + rand(.3, 1.8), p.z + rand(-.2, .2), rand(-.2, .2), rand(-.8, -.2), rand(-.2, .2), { life: rand(.4, .9), size: rand(1, 2), c0: 0xd8c0ff, c1: 0x2a1a4a, drag: 1 }); }
    movePlayer(best.x, best.y, best.z);
    shade(best, 24, false); burst(v3(best.x, best.y + 1, best.z), 'schatten', 50, { speed: 3, up: .3, size: [1.2, 2.6] });
    flash(v3(best.x, best.y + 1, best.z), 0x8a5ec8, 5, 6, .25);
    SFX.blink();
    // Those who watched you lose you: their eyes are on where you were.
    for (const e of enemies) { const b = e.ai; if (!b || e.dead) continue;
      if (e.model.position.distanceTo(best) < 30) { b.awareness = Math.min(b.awareness || 0, player.sneaking ? .15 : .55); b.sees = false; } }
    player.invuln = Math.max(player.invuln || 0, .35);
    return true;
  }

  // ════ Seuchennebel ════
  const globMat = new THREE.MeshBasicMaterial({ color: 0xb8f060 }), globDark = pixelMaterial('mud', { tint: 0x5a8a28, emissive: .6 });
  const globs = Array.from({ length: 4 }, () => {
    const root = new THREE.Group(); root.visible = false; group.add(root);
    root.add(new THREE.Mesh(boxGeometry(.22, .22, .22), globDark));
    const c = new THREE.Mesh(boxGeometry(.14, .14, .14), globMat); c.position.set(.06, .05, -.04); root.add(c);
    const d = new THREE.Mesh(boxGeometry(.1, .1, .1), globMat); d.position.set(-.07, -.06, .05); root.add(d);
    return { root, active: false, vel: v3(), life: 0, emit: 0, release: null };
  });
  function castGlob(origin, dir) {
    const g = globs.find(q => !q.active); if (!g) return;
    g.active = true; g.root.visible = true; g.root.position.copy(origin); g.vel.copy(dir).multiplyScalar(17).add(v3(0, 4.2, 0)); g.life = 3; g.emit = 0;
    g.release = world.lights?.follow(g.root, { color: 0xa8e050, intensity: 1.6, distance: 4 }) ?? null;
    SFX.glob();
  }
  function stepGlobs(dt) {
    for (const g of globs) {
      if (!g.active) continue;
      g.life -= dt; g.vel.y -= 15 * dt; segA.copy(g.root.position); segB.copy(segA).addScaledVector(g.vel, dt);
      const hit = g.life > 2.92 ? null : sweep(segA, segB, .2);
      if (hit || g.life <= 0) {
        const p = hit ? hit.point : g.root.position;
        g.active = false; g.root.visible = false; g.release?.(); g.release = null;
        SFX.splat(); burst(p, 'gift', 40, { speed: 5, up: 2, gravity: 8, floor: hit?.kind === 'foe' ? null : p.y, bounce: .2 });
        chunks(p, [0x5a8a28, 0x3a5a18, 0x8ac840], 10, { speed: 3, up: 3, rest: 2 });
        if (hit?.kind !== 'wall') decal('scorch', v3(p.x, 0, p.z), 2.2, 18, 0x9ad060);
        if (hit?.kind === 'foe') hitWith(hit.target, magicDamage() * .35, segA.clone(), 'poison');
        const ground = hit?.kind === 'water' ? hit.surface : hit?.kind === 'wall' ? heightAt(p.x, p.z) : Math.min(p.y, heightAt(p.x, p.z) + .1);
        clouds.push({ pos: v3(p.x, ground, p.z), vel: v3(), radius: 3.6, life: 9, dur: 9, tick: 0, emit: 0, check: 0, cough: 0 });
        if (clouds.length > 4) clouds.shift();
        continue;
      }
      g.root.position.copy(segB); g.root.rotation.x += dt * 8; g.root.rotation.y += dt * 5;
      g.emit += dt; while (g.emit > .02) { g.emit -= .02; const p = g.root.position;
        spawn(glow, p.x, p.y, p.z, rand(-.3, .3), rand(-.5, .2), rand(-.3, .3), { life: rand(.3, .6), size: rand(.8, 1.6), c0: 0xe4ff9a, c1: 0x1a3a0a, gravity: 2 });
        if (Math.random() < .4) spawn(haze, p.x, p.y, p.z, 0, .1, 0, { life: rand(.6, 1), size: rand(2, 3), c0: 0x7a9a40, curve: 'grow' }); }
    }
  }
  /** Fire at a point: a cloud of rot near it goes up, ice near it melts (Funken, burning grass, a brand). */
  function fireAt(point, radius = 2.5) {
    for (const c of clouds) if (c.life > 0 && Math.hypot(c.pos.x - point.x, c.pos.z - point.z) < c.radius + radius && Math.abs(c.pos.y - point.y) < 4) explode(c);
    for (const f of floes) if (f.life > 0 && Math.hypot(f.x - point.x, f.z - point.z) < f.radius + radius) melt(f);
  }
  function freezeCloud(c) {
    c.life = 0; c.exploded = true;
    SFX.freeze(); flash(v3(c.pos.x, c.pos.y + 1, c.pos.z), 0xd8f0ff, 8, 10, .3);
    for (let i = 0; i < 70; i++) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * c.radius;
      spawn(solid, c.pos.x + Math.cos(a) * r, c.pos.y + rand(.4, 1.8), c.pos.z + Math.sin(a) * r, rand(-.3, .3), rand(-.5, .5), rand(-.3, .3),
        { life: rand(1.5, 2.6), size: rand(.8, 1.8), c0: pick([0xc8f0b0, 0xe8f6ff, 0xa8e090]), gravity: 9, spin: 8, curve: 'steady', floor: heightAt(c.pos.x + Math.cos(a) * r, c.pos.z + Math.sin(a) * r) + .03, rest: 1.4 }); }
    decal('rime', c.pos, c.radius * 1.4, 16, 0xd8ffc8);
  }
  function explode(c) {
    if (c.exploded) return; c.exploded = true; c.life = 0;
    const p = v3(c.pos.x, c.pos.y + 1, c.pos.z), R = c.radius + 1.6;
    SFX.boom(); flash(p, 0xb8ff60, 22, 18, .45);
    for (let i = 0; i < 160; i++) { const a = Math.random() * 6.283, e = rand(-.2, 1), sp = rand(4, 13);
      spawn(glow, p.x, p.y, p.z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + 2, Math.sin(a) * Math.cos(e) * sp, { life: rand(.4, 1.1), size: rand(2, 4.5), c0: pick([0xffd060, 0xe4ff9a, 0xff8a24, 0xfff3c8]), c1: pick([0xe0451a, 0x5a9a28, 0x5a1608]), drag: 2.8, gravity: -1.5, curve: 'flame' }); }
    puff(p, 0x3a3a2a, 22, { spread: 1.8, speed: 2.5, up: 2.5, size: [5, 10], life: [1.6, 2.8], grow: 2.2 });
    chunks(p, [0x3a3028, 0x5a4a3a, 0x2a2420], 16, { speed: 7, up: 7 });
    decal('scorch', p, 4.5, 30); decal('scorch', v3(p.x + rand(-2, 2), 0, p.z + rand(-2, 2)), 2.5, 25);
    for (const e of alive()) { const d = e.model.position.distanceTo(p); if (d > R) continue;
      hitWith(e, magicDamage() * 1.25 * (1 - d / (R + 1)), p, 'blast'); spellFx?.ignite?.(e, 12);
      knock(e, v3(e.model.position.x - p.x, 0, e.model.position.z - p.z).normalize(), 3.4, 6); }
    const pd = player.position.distanceTo(p); if (pd < R) { hurtPlayer(Math.round(24 * (1 - pd / (R + 1))), p); toast('DER NEBEL IST IN FLAMMEN AUFGEGANGEN', 1800); }
    shove(p, UP, R + 1.5, 3);
    wildfire?.ignite?.(p, { power: 1, radius: 4.5 });
    ai?.fireAt?.(p, R); ai?.noise?.('fireImpact', p, { source: 'player' });
  }
  function stepClouds(dt) {
    for (let i = clouds.length - 1; i >= 0; i--) {
      const c = clouds[i];
      if (c.life <= 0) { clouds.splice(i, 1); continue; }
      c.life -= dt; c.vel.multiplyScalar(Math.exp(-dt * .7)); c.pos.addScaledVector(c.vel, dt);
      const ground = heightAt(c.pos.x, c.pos.z), w = waterAt(c.pos.x, c.pos.z); c.pos.y += ((w ? Math.max(w.surface, ground) : ground) - c.pos.y) * Math.min(1, dt * 3);
      const k = Math.min(1, c.life / 1.5) * Math.min(1, (c.dur - c.life) * 3 + .2), R = c.radius * (.6 + .4 * Math.min(1, (c.dur - c.life) * 2));
      c.emit += dt;
      while (c.emit > .045) { c.emit -= .045;
        if (k < .2) break;
        const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * R;
        spawn(haze, c.pos.x + Math.cos(a) * r, c.pos.y + rand(.1, 1.4), c.pos.z + Math.sin(a) * r, rand(-.25, .25) + c.vel.x * .5, rand(.05, .3), rand(-.25, .25) + c.vel.z * .5,
          { life: rand(1.4, 2.4), size: rand(5, 10) * k, c0: pick([0x9cc84a, 0xb4d860, 0x8ab83a, 0xc8e070]), curve: 'grow', grow: 1.1, swirl: 1.2, drag: .6 });
        if (Math.random() < .5) spawn(glow, c.pos.x + Math.cos(a) * r * .7, c.pos.y + rand(.3, 1.1), c.pos.z + Math.sin(a) * r * .7, rand(-.2, .2), rand(0, .15), rand(-.2, .2), { life: rand(1, 1.8), size: rand(6, 11) * k, c0: 0x2a4a0c, c1: 0x0a1404, curve: 'grow', grow: .5, drag: .8 });
        if (Math.random() < .35) spawn(glow, c.pos.x + Math.cos(a) * r * .8, c.pos.y + rand(0, .3), c.pos.z + Math.sin(a) * r * .8, 0, rand(.4, 1.1), 0, { life: rand(.6, 1.2), size: rand(.8, 1.6), c0: 0xe4ff9a, c1: 0x1a3a0a, curve: 'pop' });
      }
      // It eats at whoever stands in it; foes flee it like fire.
      c.tick += dt;
      if (c.tick >= .5) { c.tick -= .5;
        for (const e of alive()) { const p = e.model.position; if (Math.hypot(p.x - c.pos.x, p.z - c.pos.z) < R && Math.abs(p.y - c.pos.y) < 2.5) { dot(e, magicDamage() * SPELLS.seuchennebel.power, 'poison'); reactions.elemental(e, 0, c.pos, 'poison', { units: .7, icd: 'cloud', strikeIt: false });
          if (Math.random() < .3) burst(chest(e), 'gift', 6, { speed: 1, up: .5 }); } }
        const pp = player.position; if (Math.hypot(pp.x - c.pos.x, pp.z - c.pos.z) < R * .85 && Math.abs(pp.y - c.pos.y) < 2.5) { hurtPlayer(2, null); if ((c.cough -= .5) <= 0) { c.cough = 2.5; SFX.cough(); } }
        ai?.fireAt?.(c.pos, R);
      }
      // Fire in it: burning grass, a burning foe walking in. Then it goes up.
      c.check += dt;
      if (c.check > .25) { c.check = 0; if ((wildfire?.heatAt?.(c.pos.x, c.pos.z) || 0) > .45) explode(c); }
    }
  }

  reactions = createReactions({
    fx: { spawn, glow, haze, solid, burst, puff, chunks, flash, bolt, decal, SFX, rand, pick },
    alive, chest, rawStrike: strike, knock, dot, player, wildfire, spellFx, magicDamage, ai, world, group, marks, shield, toast, chill,
  });

  // ── Casting.
  /** Casts a spell other than Funken. origin: the hand; dir: the aim; target: the foe aim-assist picked (or null). */
  function cast(id, { origin, dir, target = null }) {
    switch (id) {
      case 'frostlanze': castLance(origin, dir); return true;
      case 'sturmstoss': castGust(origin, dir); return true;
      case 'erdstachel': castLine(dir); return true;
      case 'irrlicht': castWisp(); return true;
      case 'lebensquell': castHeal(); return true;
      case 'schattenschritt': return castBlink(dir);
      case 'seuchennebel': castGlob(origin, dir); return true;
    }
    return false;
  }
  /** The hand gathering a spell (cast wind-up): light drawn in from round the palm. progress null ends it. */
  let chargeEmit = 0;
  function charge(point, progress, dt, id) {
    if (progress === null || !SPELLS[id]) { chargeEmit = 0; return; }
    const el = SPELLS[id].element, R = ramp(el);
    chargeEmit += dt * (40 + progress * 80);
    while (chargeEmit > 1) { chargeEmit -= 1;
      const a = Math.random() * 6.283, b = rand(-1, 1), r = rand(.35, .7), ox = Math.cos(a) * Math.sqrt(1 - b * b) * r, oy = b * r, oz = Math.sin(a) * Math.sqrt(1 - b * b) * r, life = rand(.14, .26);
      spawn(glow, point.x + ox, point.y + oy, point.z + oz, -ox / life, -oy / life, -oz / life, { life, size: rand(.6, 1.4), c0: R[1], c1: R[0], stretch: .06, curve: 'steady' });
    }
  }
  /** The element burning in an empty hand while a spell is ready (third person). */
  let handEmit = 0;
  function handGlow(point, dt, id) {
    if (!point || !SPELLS[id]) return;
    const el = SPELLS[id].element, E = ELEMENTS[el], R = E.ramp;
    handEmit += dt * 34;
    while (handEmit > 1) { handEmit -= 1;
      const o = { x: point.x + rand(-.05, .05), y: point.y + rand(-.03, .05), z: point.z + rand(-.05, .05) };
      switch (E.motion) {
        case 'fall': spawn(glow, o.x, o.y, o.z, rand(-.2, .2), rand(-.5, -.1), rand(-.2, .2), { life: rand(.4, .8), size: rand(.6, 1.2), c0: R[0], c1: R[3], drag: 1 }); break;
        case 'crackle': if (Math.random() < .5) spawn(glow, o.x, o.y, o.z, rand(-1.5, 1.5), rand(-1, 1.5), rand(-1.5, 1.5), { life: rand(.06, .14), size: rand(.6, 1), c0: R[0], c1: R[2], stretch: .3 }); break;
        case 'orbit': { const a = time * 7 + Math.random() * .6, r = .14; spawn(el === 'erde' ? solid : glow, point.x + Math.cos(a) * r, point.y + rand(-.04, .08), point.z + Math.sin(a) * r, -Math.sin(a) * .9, rand(.05, .3), Math.cos(a) * .9, { life: rand(.25, .45), size: rand(.6, 1.1), c0: R[1], c1: R[3], curve: 'steady' }); break; }
        case 'sink': spawn(haze, o.x, o.y, o.z, rand(-.1, .1), rand(-.35, -.1), rand(-.1, .1), { life: rand(.5, .9), size: rand(1.2, 2.2), c0: pick([0x2a1a40, 0x1a1028]), curve: 'grow', grow: .8 }); if (Math.random() < .4) spawn(glow, o.x, o.y, o.z, 0, -.2, 0, { life: .5, size: .8, c0: R[0], c1: R[3] }); break;
        case 'bubble': spawn(glow, o.x, o.y, o.z, rand(-.1, .1), rand(.2, .5), rand(-.1, .1), { life: rand(.3, .6), size: rand(.6, 1.3), c0: R[1], c1: R[3], curve: 'pop' }); break;
        case 'spiral': { const a = time * 9 + Math.random(), r = .1; spawn(glow, point.x + Math.cos(a) * r, point.y, point.z + Math.sin(a) * r, -Math.sin(a) * .5, rand(.3, .6), Math.cos(a) * .5, { life: rand(.4, .7), size: rand(.6, 1.1), c0: R[0], c1: R[3] }); break; }
        default: spawn(glow, o.x, o.y, o.z, rand(-.1, .1), rand(.3, .7), rand(-.1, .1), { life: rand(.3, .6), size: rand(.7, 1.3), c0: R[0], c1: R[3], curve: 'flame' });
      }
    }
  }

  function update(dt) {
    time += dt;
    stepLances(dt); stepBolts(dt); stepSpikes(dt); stepWisp(dt); stepHeal(dt); stepGlobs(dt); stepClouds(dt);
    lastMarks = reactions.update(dt);
    for (const f of floes) {
      if (f.life <= 0) continue;
      f.life -= dt; const age = f.dur - f.life;
      if (f.melting) { f.melting -= dt; f.life = Math.min(f.life, Math.max(0, f.melting)); }
      const rise = Math.min(1, age / .45), sink = f.life < 1.6 ? f.life / 1.6 : 1;
      f.root.position.set(f.x, f.y - .5 * (1 - rise) - .25 * (1 - sink) + Math.sin(time * 1.3 + f.x) * .015, f.z);
      f.root.scale.setScalar((.3 + .7 * rise) * (.4 + .6 * sink));
      if (f.life < 1.6 && Math.random() < dt * 20) burst(v3(f.x + rand(-2, 2), f.y + .1, f.z + rand(-2, 2)), 'eis', 2, { speed: 1, up: .5, life: [.3, .6] });
      if (f.life <= 0) f.root.visible = false;
    }
    for (const [e, left] of chilled) {
      const now = Math.max(0, (e.chill || 0) - dt); e.chill = now;
      if (now <= 0 || e.dead) { chilled.delete(e); e.chill = 0; continue; }
      for (let k = 0; k < 2; k++) if (Math.random() < dt * 30) { const p = chest(e); spawn(Math.random() < .55 ? glow : haze, p.x + rand(-.4, .4), p.y + rand(-1.1, .5), p.z + rand(-.4, .4), rand(-.1, .1), rand(-.35, .05), rand(-.1, .1), { life: rand(.6, 1.2), size: rand(1, 3), c0: 0xe8f6ff, c1: 0x4f9ad8, curve: 'grow', grow: .6 }); }
      if (Math.random() < dt * 6) { const p = e.model.position; spawn(solid, p.x + rand(-.3, .3), p.y + rand(.3, 1.8), p.z + rand(-.3, .3), rand(-.3, .3), rand(-.5, .2), rand(-.3, .3), { life: rand(.8, 1.4), size: rand(1, 1.8), c0: pick([0xe8f6ff, 0xbfe4fa]), gravity: 9, curve: 'steady', floor: p.y + .03, rest: .6 }); }
      void left;
    }
    for (const d of decals) { if (d.life <= 0) continue; d.life -= dt; d.mesh.material.opacity = Math.min(1, d.life / 2); if (d.life <= 0) d.mesh.visible = false; }
    for (const f of flashes) { if (f.life <= 0) continue; f.life -= dt; const L = lightOf(f.release); if (L) L.intensity = f.peak * Math.max(0, f.life / f.dur) ** .7; if (f.life <= 0) { f.release?.(); f.release = null; } }
    stepPool(glow, dt); stepPool(haze, dt); stepPool(solid, dt);
  }
  /** The surface of an ice floe under (x, z), or null: the wanderer stands on it instead of swimming. */
  function iceAt(x, z) {
    for (const f of floes) if (f.life > .5 && Math.hypot(f.x - x, f.z - z) < f.radius * (.4 + .6 * Math.min(1, (f.dur - f.life) / .45))) return f.y + .08;
    return null;
  }
  const lightNear = (p, r) => wisp.life > 0 && wisp.root.position.distanceTo(p) < r;
  function reset() {
    for (const l of lances) { l.active = false; l.root.visible = false; l.release?.(); l.release = null; }
    for (const g of globs) { g.active = false; g.root.visible = false; g.release?.(); g.release = null; }
    for (const f of floes) { f.life = 0; f.root.visible = false; }
    for (const s of spikes) { s.life = 0; s.armed = false; s.root.visible = false; }
    for (const f of flowers) { f.life = 0; f.armed = false; f.root.visible = false; }
    for (const d of decals) { d.life = 0; d.mesh.visible = false; }
    for (const f of flashes) { f.life = 0; f.release?.(); f.release = null; }
    endChannel(); dismissWisp(); healing = null; clouds.length = 0; bolts.length = 0; lines.length = 0; chilled.clear(); reactions.reset();
    for (const P of [glow, haze, solid]) { P.free.push(...P.items); P.items.length = 0; P.mesh.count = 0; }
    beams.count = 0;
  }
  return {
    cast, charge, handGlow, update, iceAt, lightNear, fireAt, reset, dismissWisp,
    /** Elemental reactions (systems/reactions.js): elemental(target, amount, from, kind) and physical(target, amount). */
    get reactions() { return reactions; }, get marks() { return lastMarks; },
    /** Lightning into a cloud of rot sets it off like fire. */
    sparkClouds,
    /** Kettenblitz held: combat.js calls channel() each frame while the cast is held and endChannel() when let go. */
    channel, endChannel, get channeling() { return !!stream; },
    get wisp() { return wisp.life > 0 ? wisp.life : 0; },
    state: () => ({ t: +time.toFixed(2), glow: glow.items.length, haze: haze.items.length, solid: solid.items.length, bolts: bolts.length, floes: floes.filter(f => f.life > 0).length,
      spikes: spikes.filter(s => s.life > 0 || s.armed).length, flowers: flowers.filter(f => f.life > 0 || f.armed).length, clouds: clouds.length, wisp: wisp.life > 0, healing: !!healing,
      lances: lances.filter(l => l.active).length, globs: globs.filter(g => g.active).length, chilled: chilled.size }),
    /** Shows every pooled mesh once for a shader-compile pass, then hides them again. */
    warm(on) { for (const x of [...lances.map(l => l.root), ...floes.map(f => f.root), ...spikes.map(s => s.root), ...flowers.map(f => f.root), wisp.root, ...globs.map(g => g.root)]) x.visible = on;
      for (const d of decals) d.mesh.visible = on; for (const P of [glow, haze, solid]) P.mesh.count = on ? 1 : P.items.length; beams.count = on ? 1 : 0; },
  };
}

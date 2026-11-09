import * as THREE from 'three';
import { boxGeometry } from '../art/blocks.js';
import { pixelMaterial } from '../art/pixelTextures.js';
import { AURAS, REACTIONS, applyElement, tickAuras, shatterDamage, BRITTLE } from './elements.js';

// Elemental reactions in the world (rules: systems/elements.js). Spells leave their element on whom they hit; the
// next element reacts with it: melt, vaporize, overload, superconduct, frozen, electro-charged, swirl, crystal,
// smouldering, nerve poison, rot, shatter. Water in the world wets whoever wades in it. Every body with an aura
// shows it (particles here, sigils over the head in ui/auraMarks.js); a reaction writes its name over the body.
// spellcraft.js creates this with its own particle helpers (fx) and routes every spell hit through elemental().
const KIND_ELEMENT = { frost: 'eis', shock: 'blitz', wind: 'wind', earth: 'erde', poison: 'gift', blast: 'feuer', fire: 'feuer', water: 'nass' };
const COLOR = { feuer: [0xfff3c8, 0xffd060, 0xff8a24, 0xe0451a], eis: [0xffffff, 0xd8f2ff, 0x9fd8ff, 0x4f9ad8], blitz: [0xffffff, 0xeee4ff, 0xc39cff, 0x7a52e0],
  nass: [0xe8f6ff, 0xa8d8ff, 0x4fa3f0, 0x1c5aa0], gift: [0xf4ffc8, 0xe4ff9a, 0x9ad050, 0x3a6a18] };
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function createReactions(ctx) {
  const { fx, alive, chest, rawStrike, knock, dot, player, wildfire, spellFx, magicDamage, ai, world, group, marks, shield, toast } = ctx;
  const { spawn, glow, haze, solid, burst, puff, chunks, flash, bolt, decal, SFX, rand, pick } = fx;
  let time = 0;
  const label = (id, at) => marks?.reaction(id, at);

  // ── Ice blocks round the frozen.
  const iceMat = pixelMaterial('crystal', { tint: 0xd8f0ff, emissive: .25 });
  const iceMaterial = iceMat.clone(); iceMaterial.transparent = true; iceMaterial.opacity = .62; iceMaterial.depthWrite = false;
  const blocks = Array.from({ length: 6 }, () => {
    const root = new THREE.Group(); root.visible = false; root.name = 'frozen block'; group.add(root);
    const core = new THREE.Mesh(boxGeometry(1, 1, 1), iceMaterial); core.renderOrder = 2; root.add(core);
    const shards = Array.from({ length: 5 }, (_, i) => { const m = new THREE.Mesh(boxGeometry(.18, .5, .18), iceMat); m.position.set(Math.cos(i * 1.3) * .55, .2 + (i % 3) * .5, Math.sin(i * 1.3) * .55); m.rotation.set(rand(-.6, .6), i, rand(-.6, .6)); root.add(m); return m; });
    return { root, core, shards, target: null };
  });
  function freeze(e, seconds) {
    e.frozen = Math.max(e.frozen || 0, seconds); e.stagger = Math.max(e.stagger || 0, .3); e.windup = 0; e.casting = null;
    spellFx?.douse?.(e);
    let b = blocks.find(x => x.target === e) ?? blocks.find(x => !x.target) ?? blocks[0];
    b.target = e; b.root.visible = true;
    const h = (e.aim ?? (e.kind === 'wolf' ? .9 : 1.5)) * 1.45, w = e.kind === 'wolf' ? 1.6 : .95;
    b.core.scale.set(w, h, e.kind === 'wolf' ? .9 : .8); b.core.position.y = h / 2;
    SFX.freeze(); chunks(chest(e), COLOR.eis, 12, { speed: 3, up: 3 });
  }
  function thaw(e, shatter = false) {
    e.frozen = 0;
    const b = blocks.find(x => x.target === e); if (b) { b.target = null; b.root.visible = false; }
    const p = chest(e);
    if (shatter) { chunks(p, [0xe8f6ff, 0xbfe4fa, 0xffffff, 0xa8d8f4], 34, { speed: 6, up: 5, size: [1.2, 3] }); burst(p, 'eis', 60, { speed: 7, up: 2, stretch: .08 }); SFX.shatter(); flash(p, 0xd8f0ff, 10, 8, .2); }
    else { puff(p, 0xe8f4ff, 10, { spread: .5, size: [3, 6] }); }
  }

  // ── The reactions themselves. p: where (the body's chest); r: the rule's answer; e: the body.
  const near = (p, r, but = null) => alive().filter(o => o !== but && !o.prey && o.model.position.distanceTo(p) < r);
  function react(e, r, p, from, depth) {
    const M = magicDamage();
    label(r.reaction, p.clone().setY(p.y + .6));
    ai?.noise?.('fireImpact', p, { source: 'player' });
    switch (r.reaction) {
      case 'schmelzen': {
        if (r.thaw || e.frozen) thaw(e);
        for (let i = 0; i < 26; i++) spawn(haze, p.x + rand(-.5, .5), p.y + rand(-.6, .4), p.z + rand(-.5, .5), rand(-.6, .6), rand(1, 2.4), rand(-.6, .6), { life: rand(1, 1.8), size: rand(3, 6), c0: 0xeeeeee, curve: 'grow', grow: 1.8, drag: .8 });
        burst(p, 'feuer', 30, { speed: 4, up: 2 }); burst(p, 'eis', 30, { speed: 4, up: 2 }); SFX.melt(); break;
      }
      case 'verdampfen':
        for (let i = 0; i < 40; i++) spawn(haze, p.x + rand(-.6, .6), p.y + rand(-.8, .5), p.z + rand(-.6, .6), rand(-1.2, 1.2), rand(2, 4.5), rand(-1.2, 1.2), { life: rand(1.2, 2.2), size: rand(4, 8), c0: pick([0xffffff, 0xf0f4f8, 0xe0e8f0]), curve: 'grow', grow: 2.2, drag: 1 });
        burst(p, 'feuer', 24, { speed: 5, up: 3 }); SFX.hiss(); flash(p, 0xfff0d8, 6, 7, .2); break;
      case 'ueberladung': {
        flash(p, 0xff9a5a, 20, 14, .35); SFX.boom();
        for (let i = 0; i < 130; i++) { const a = Math.random() * 6.283, el = rand(-.3, 1), sp = rand(3, 11);
          spawn(glow, p.x, p.y, p.z, Math.cos(a) * Math.cos(el) * sp, Math.sin(el) * sp + 1.5, Math.sin(a) * Math.cos(el) * sp, { life: rand(.3, .8), size: rand(1.5, 4), c0: pick([0xfff3c8, 0xffd060, 0xeee4ff]), c1: pick([0xe0451a, 0x7a52e0]), drag: 3, gravity: -1, curve: 'flame' }); }
        for (let i = 0; i < 6; i++) bolt(p, v3(p.x + rand(-2.5, 2.5), p.y + rand(-1, 1.5), p.z + rand(-2.5, 2.5)), { life: .25, width: .7, branches: 1, color: 0xff9a5a });
        puff(p, 0x3a3030, 12, { spread: .8, speed: 2, up: 2, size: [4, 8], grow: 2 });
        for (const o of near(p, 3.8)) { const d = o.model.position.distanceTo(p); rawStrike(o, M * .75 * (1 - d / 5), p, 'blast'); knock(o, v3(o.model.position.x - p.x, 0, o.model.position.z - p.z).normalize(), 2.8); }
        wildfire?.ignite?.(v3(p.x, 0, p.z), { power: .5, radius: 1.6 });
        decal('scorch', p, 2.6, 18); break;
      }
      case 'supraleiter': {
        SFX.frost(); SFX.zap(); flash(p, 0xb0c8ff, 10, 10, .3);
        for (let i = 0; i < 90; i++) { const a = i / 90 * 6.283, sp = rand(6, 9);
          spawn(glow, p.x, p.y - .3, p.z, Math.cos(a) * sp, rand(-.2, .4), Math.sin(a) * sp, { life: rand(.35, .6), size: rand(1.2, 2.4), c0: pick([0xd8f2ff, 0xeee4ff]), c1: pick([0x4f9ad8, 0x7a52e0]), drag: 2.5, stretch: .3 }); }
        for (const o of near(p, 3.8)) { rawStrike(o, M * .3, p, 'frost'); o.brittle = 8; }
        break;
      }
      case 'gefroren': freeze(e, 3.6); break;
      case 'elektrisiert': e.charged = Math.max(e.charged || 0, 5); e.chargeTick = .1; SFX.zap(); break;
      case 'wirbel': {
        const el = r.absorbed, C = COLOR[el] || COLOR.feuer; SFX.whoosh();
        for (let i = 0; i < 120; i++) { const a = i * .35, rr = .4 + i * .03, up = i * .025;
          spawn(glow, p.x + Math.cos(a) * rr, p.y - .9 + up, p.z + Math.sin(a) * rr, -Math.sin(a) * 6, 2.5, Math.cos(a) * 6, { life: rand(.5, .9), size: rand(1, 2.4), c0: pick(C.slice(0, 2)), c1: C[3], drag: 1.8, swirl: 8, stretch: .1 }); }
        for (let i = 0; i < 14; i++) spawn(haze, p.x + rand(-1, 1), p.y - .8, p.z + rand(-1, 1), rand(-2, 2), rand(1, 3), rand(-2, 2), { life: rand(.8, 1.3), size: rand(3, 5), c0: 0xd8e8e0, curve: 'grow', grow: 1.5, swirl: 6 });
        // It carries the element to everyone near; there it may react again (once).
        rawStrike(e, M * .3, from, 'wind');
        if (depth < 1) for (const o of near(p, 5.5, e)) {
          for (let k = 0; k < 6; k++) spawn(glow, p.x, p.y, p.z, (o.model.position.x - p.x) * 1.6 + rand(-1, 1), rand(.5, 2), (o.model.position.z - p.z) * 1.6 + rand(-1, 1), { life: .6, size: 1.6, c0: C[1], c1: C[3], drag: 1 });
          elemental(o, M * .3, p, el === 'nass' ? 'water' : Object.keys(KIND_ELEMENT).find(k => KIND_ELEMENT[k] === el), { units: .8, depth: depth + 1 });
        }
        break;
      }
      case 'kristall': {
        const C = COLOR[r.absorbed] || COLOR.eis; SFX.crystal();
        chunks(p, C, 22, { speed: 4.5, up: 4.5, size: [1.2, 2.6] });
        // Shards of it fly to the wanderer and become a shield.
        const pp = v3(player.position.x, player.position.y + 1.2, player.position.z);
        for (let i = 0; i < 18; i++) { const t = rand(.45, .7); spawn(glow, p.x + rand(-.3, .3), p.y + rand(-.3, .3), p.z + rand(-.3, .3), (pp.x - p.x) / t + rand(-1, 1), (pp.y - p.y) / t + 2.5, (pp.z - p.z) / t + rand(-1, 1), { life: t, size: rand(1.4, 2.4), c0: pick(C.slice(0, 2)), c1: C[2], gravity: 5, stretch: .06 }); }
        shield?.(28); break;
      }
      case 'schwelbrand':
        spellFx?.ignite?.(e, 20); spellFx?.ignite?.(e, 20); dot(e, M * .35, 'poison');
        for (let i = 0; i < 40; i++) spawn(glow, p.x + rand(-.4, .4), p.y + rand(-.9, .4), p.z + rand(-.4, .4), rand(-.5, .5), rand(1.5, 3), rand(-.5, .5), { life: rand(.4, .9), size: rand(1.5, 3), c0: pick([0xe4ff9a, 0xffd060]), c1: pick([0x5a9a28, 0xe0451a]), curve: 'flame', swirl: 5 });
        wildfire?.ignite?.(v3(p.x, 0, p.z), { power: .4, radius: 1.2 }); SFX.hiss(); break;
      case 'nervengift':
        e.stagger = Math.max(e.stagger || 0, 2.2); e.cooldown = Math.max(e.cooldown || 0, 2.2); e.windup = 0;
        for (let i = 0; i < 6; i++) bolt(p, v3(p.x + rand(-1, 1), p.y + rand(-.8, .8), p.z + rand(-1, 1)), { life: .3, width: .5, branches: 0, color: 0x9ad050 });
        burst(p, 'gift', 40, { speed: 4, up: 1 }); SFX.zap(); break;
      case 'faeulnis': seeds.push({ at: p.clone(), t: .9, e }); SFX.glob(); break;
      case 'zerschmettern': thaw(e, true); break;
    }
  }
  // A seed of rot sits where the reaction was and bursts a breath later.
  const seeds = [];
  function stepSeeds(dt) {
    for (let i = seeds.length - 1; i >= 0; i--) {
      const s = seeds[i]; s.t -= dt;
      const k = 1 - s.t / .9;
      spawn(glow, s.at.x + rand(-.15, .15), s.at.y + rand(-.15, .15), s.at.z + rand(-.15, .15), 0, 0, 0, { life: .12, size: 2 + k * 3, c0: 0xe4ff9a, c1: 0x3a6a18, curve: 'steady' });
      if (s.t > 0) continue;
      seeds.splice(i, 1);
      const p = s.at, M = magicDamage(); SFX.splat(); flash(p, 0xb8ff60, 12, 10, .3);
      for (let k2 = 0; k2 < 80; k2++) { const a = Math.random() * 6.283, sp = rand(2, 8); spawn(glow, p.x, p.y, p.z, Math.cos(a) * sp, rand(-1, 4), Math.sin(a) * sp, { life: rand(.4, .9), size: rand(1.4, 3), c0: pick([0xe4ff9a, 0xa8e050]), c1: 0x1a3a0a, drag: 2.5, gravity: 4 }); }
      puff(p, 0x7a9a40, 14, { spread: 1, speed: 1.5, up: 1, size: [4, 7] });
      for (const o of near(p, 3.2)) rawStrike(o, M * .65, p, 'poison');
    }
  }

  /**
   * A hit carrying an element: the element meets what the body carries (maybe reacts), then the blow lands with
   * the reaction's factor, then the reaction plays out. kind: the spell's kind (frost, shock, wind, earth, poison,
   * blast, fire, water). icd: a key so a stream (a cloud, a channel) adds its element at most every 1.2 s.
   */
  function elemental(target, amount, from, kind, { units = 1, icd = null, depth = 0, strikeIt = true } = {}) {
    const el = KIND_ELEMENT[kind]; from = from || undefined;
    if (!el || target.prey || target.dead) { if (strikeIt) rawStrike(target, amount, from, kind); return null; }
    target.auras ??= {};
    let r = null;
    const ready = !icd || !((target.icd ??= {})[icd] > time);
    if (ready) {
      if (icd) target.icd[icd] = time + 1.2;
      // Stone on ice: a frozen body shatters.
      if (target.frozen > 0 && (el === 'erde')) r = { reaction: 'zerschmettern', multiplier: 1, bonus: shatterDamage(amount, magicDamage()) };
      else r = applyElement(target.auras, el, units, { frozen: target.frozen > 0 });
      if (r && !r.reaction) r = null;
    }
    if (el === 'eis' && !r) ctx.chill?.(target);
    const hit = amount * (r?.multiplier ?? 1) + (r?.bonus ?? 0);
    if (strikeIt) rawStrike(target, hit, from, kind);
    if (r) react(target, r, chest(target).clone(), from, depth);
    return r;
  }
  /** A blade, a spear, an arrow: the factor for this blow (a frozen body shatters, a brittle one breaks easier). */
  function physical(target, amount) {
    if (!target || target.prey) return amount;
    let out = amount * (target.brittle > 0 ? BRITTLE : 1);
    if (target.frozen > 0) { out += shatterDamage(amount, magicDamage()); label('zerschmettern', chest(target).clone().setY(chest(target).y + .6)); thaw(target, true); }
    return out;
  }

  // ── Every frame: auras fade, water wets, the charged crackle and jump to the wet, the frozen stay frozen.
  const _w = v3();
  function update(dt) {
    time += dt;
    stepSeeds(dt);
    for (const b of blocks) {
      const e = b.target; if (!e) continue;
      if (e.dead || !(e.frozen > 0)) { thaw(e); continue; }
      b.root.position.copy(e.model.position); b.root.rotation.y = e.model.rotation.y;
      const k = Math.min(1, e.frozen / .4); b.root.scale.setScalar(.92 + .08 * k);
      if (e.frozen < .6 && Math.random() < dt * 20) chunks(chest(e), COLOR.eis, 1, { speed: 1, up: 1 });
    }
    const list = [];
    for (const e of alive()) {
      if (e.prey) continue;
      const p = e.model.position, dPlayer = p.distanceTo(player.position);
      if (e.frozen > 0) { e.frozen -= dt; e.stagger = Math.max(e.stagger || 0, .1); e.windup = 0; }
      if (e.brittle > 0) e.brittle -= dt;
      // In water up to the knees: wet (and a fire on them goes out).
      const w = world.water?.at?.(p.x, p.z);
      if (w && w.depth > .3) { e.auras ??= {}; if (e.auras.feuer) delete e.auras.feuer; e.auras.nass = Math.max(e.auras.nass || 0, 1); }
      if (e.auras) tickAuras(e.auras, dt);
      // Electro-charged: a jolt every second while both are there; it jumps to the wet nearby.
      if (e.charged > 0) {
        e.charged -= dt; e.chargeTick -= dt;
        if (!e.auras?.nass || !e.auras?.blitz) e.charged = 0;
        else if (e.chargeTick <= 0) {
          e.chargeTick = 1; const c = chest(e).clone(), M = magicDamage();
          rawStrike(e, M * .2, c, 'shock'); e.stagger = Math.max(e.stagger || 0, .5); e.auras.nass -= .25;
          for (let i = 0; i < 3; i++) bolt(c, v3(c.x + rand(-.8, .8), c.y + rand(-1, .8), c.z + rand(-.8, .8)), { life: .2, width: .5, branches: 0 });
          for (const o of near(p, 5, e)) if (o.auras?.nass) { const oc = chest(o).clone(); bolt(c, oc, { life: .25, width: .8, branches: 1 }); rawStrike(o, M * .2, c, 'shock'); }
          SFX.zap();
        }
      }
      // What it carries shows on the body (only near the wanderer).
      if (dPlayer < 45 && e.auras) {
        const c = chest(e);
        if (e.auras.blitz && Math.random() < dt * 5) bolt(_w.set(c.x + rand(-.4, .4), c.y + rand(-.7, .5), c.z + rand(-.4, .4)), v3(c.x + rand(-.5, .5), c.y + rand(-.7, .6), c.z + rand(-.5, .5)), { life: .12, width: .35, branches: 0 });
        if (e.auras.nass && Math.random() < dt * 14) spawn(glow, c.x + rand(-.35, .35), c.y + rand(-.6, .5), c.z + rand(-.35, .35), 0, -.5, 0, { life: rand(.4, .7), size: rand(.6, 1.1), c0: 0xa8d8ff, c1: 0x1c5aa0, gravity: 9, floor: p.y + .03 });
        if (e.auras.gift && Math.random() < dt * 10) spawn(glow, c.x + rand(-.35, .35), c.y + rand(-.8, .4), c.z + rand(-.35, .35), rand(-.1, .1), rand(.3, .7), rand(-.1, .1), { life: rand(.5, .9), size: rand(.7, 1.3), c0: 0xe4ff9a, c1: 0x3a6a18 });
        if (e.auras.feuer && !spellFx?.burning?.(e) && Math.random() < dt * 10) spawn(glow, c.x + rand(-.3, .3), c.y + rand(-.6, .5), c.z + rand(-.3, .3), 0, rand(.5, 1.2), 0, { life: rand(.3, .6), size: rand(.8, 1.5), c0: 0xffd060, c1: 0xe0451a, curve: 'flame' });
        if (e.auras.eis && Math.random() < dt * 10) spawn(haze, c.x + rand(-.4, .4), c.y + rand(-.7, .4), c.z + rand(-.4, .4), 0, -.2, 0, { life: rand(.6, 1), size: rand(1.5, 2.5), c0: 0xe8f4ff, curve: 'grow', grow: .5 });
      }
      if (dPlayer < 45) list.push({ key: e, head: _headOf(e), auras: e.auras, frozen: e.frozen > 0, brittle: e.brittle > 0 });
    }
    return list;
  }
  const _headOf = e => v3(e.model.position.x, e.model.position.y + (e.kind === 'wolf' ? 1.3 : 2.35) * (e.model.scale?.y || 1), e.model.position.z);
  function reset() { seeds.length = 0; for (const b of blocks) { b.target = null; b.root.visible = false; } for (const e of alive()) { e.auras = {}; e.frozen = 0; e.brittle = 0; e.charged = 0; } }
  return { elemental, physical, update, reset, freeze, thaw, state: () => ({ seeds: seeds.length, frozen: blocks.filter(b => b.target).length }) };
}
export { KIND_ELEMENT };

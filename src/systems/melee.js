import * as THREE from 'three';
import { ATTACKS, CHAINS, DEFENSE, NEUTRAL_PITCH, PIVOT_Y, WEAPONS, weaponFor, reachOf } from './combatRules.js';
import { sweep, bladeAt, humanColliders, beastColliders, shieldCollider, snapshotRig, snapshotShield, colliderList, regionOf, sideOf } from './meleeCollision.js';
import { defend, strike, facingCos, injuryEffects } from './damageModel.js';
import { createFighter, startAttack, stepAttack, interrupt, rebound, setGuard, hurtPosture, tick, firstStrike, note } from './combatState.js';
import { createCombatEvents } from './combatEvents.js';

// Combat 2.0 runtime (docs/COMBAT_2.md): one pipeline for the wanderer and every human foe, inside the fixed step.
//   start → prepare → active: sweep the blade (simulation time) against bodies, shields, allies, walls → defence →
//   damage → reaction (rebound, stagger, posture, injury, MOTION impulse) → events (AI memory, debug view).
// A blow lands only where the blade really passed. The same attack data drives the third-person arm (IK to the hilt)
// and the first-person view (the world blade projected through the eye), so what is seen is what collides.
//
// ctx: { player, enemies, prey, world, effects, motion, ai, toast, time(), pause(s), weaponDamage(), weaponItem(),
//   weaponStyle(), playerModel(), guard() → { up, at }, breakGuard(seconds), onHurt(amount, info), wound(enemy, info) → dealt,
//   strikePrey(target, amount, point), corpseHit(corpse, point, dir), moveEnemy(e, dx, dz), turnToward(e, dx, dz, dt, rate),
//   injury(model) → MOTION injuries, onEvent(brain, type, data), cancelPlayerAction() }
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const SNAP_RANGE = 28, STRIKE_RANGE = 7;

export function createMelee(ctx) {
  const { player, enemies, world } = ctx;
  const events = createCombatEvents();
  const pf = createFighter('player', { side: 'player' });
  const list = colliderList(), hits = new Set();
  const frameA = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, scale: 1 }, frameB = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, scale: 1 };
  let chain = 0, lastEnd = -9, held = false, queued = false;
  const now = () => ctx.time();
  const fighter = e => e.fight ??= createFighter(e.ai?.id ?? e.storyId ?? `e${enemies.indexOf(e)}`);
  const solid = { solidAt: (x, y, z) => { const c = world.colliderAt?.(x, z, y, .03); return c ? c.surface || 'wood' : null; }, groundAt: (x, z) => world.terrainHeightAt ? world.terrainHeightAt(x, z) : world.heightAt(x, z) };

  // ── Rig snapshots (per rendered frame, after the animator and the ragdolls moved the bones).
  function snapshot(model) {
    if (!model?.visible && !model?.userData.ragdolled) return;
    const s = model.userData.combatSnap ??= { points: null, shield: null, at: 0 };
    s.points = snapshotRig(model, s.points || undefined);
    const shield = model.getObjectByName('shield');
    s.shield = shield?.visible ? snapshotShield(model, shield, s.shieldData ||= { matrix: new THREE.Matrix4(), half: [0, 0, 0], center: v3() }) : null;
    s.at = now();
  }
  function snapshots(playerModel) {
    snapshot(playerModel);
    const p = player.position;
    for (const e of enemies) if (!e.gone && e.model && Math.abs(e.model.position.x - p.x) < SNAP_RANGE && Math.abs(e.model.position.z - p.z) < SNAP_RANGE) snapshot(e.model);
  }
  const frameOf = (model, out, pos = model.position, yaw = model.rotation.y) => Object.assign(out, { x: pos.x, y: pos.y, z: pos.z, yaw, pitch: 0, scale: model.scale?.y || 1 });
  /** Colliders of one body (enemy, prey, the wanderer) into `list`. */
  function bodyOf(owner, model, frame, beast = null) {
    const snap = model?.userData.combatSnap;
    if (beast || !model?.userData.rig?.chest) { beastColliders(list, owner, frame, beast?.height ?? .9, beast?.radius ?? .45, beast?.length ?? 1.3); return; }
    humanColliders(list, owner, frame, snap?.points || null);
    if (snap?.shield && !owner.shieldGone) shieldCollider(list, owner, frame, snap.shield);
  }

  // ── The wanderer's attacks.
  const playerWeapon = () => weaponFor(ctx.weaponItem(), ctx.weaponStyle());
  /** Aim offset of a track: from the shoulder line to where the view ray is 2.2 m out, relative to the neutral aim. */
  function playerPitch() {
    const eyeH = 2.3 - (player.sneaking ? .66 : 0), dy = eyeH + Math.sin(player.pitch) * 2.2 - PIVOT_Y * (ctx.playerModel()?.scale.y || 1), dh = Math.max(.4, Math.cos(player.pitch) * 2.2);
    return clamp(Math.atan2(dy, dh) - NEUTRAL_PITCH, -.8, .6);
  }
  function playerFrame(out, a = pf.attack) {
    const m = ctx.playerModel();
    out.x = player.position.x; out.y = player.position.y - (player.sneaking ? .4 : 0); out.z = player.position.z;
    out.yaw = a?.yaw ?? player.yaw; out.pitch = a?.pitch ?? playerPitch(); out.scale = m?.scale.y || 1;
    return out;
  }
  /** The attack button went down: a blow starts now, or is kept for the end of this one (in rhythm). */
  function playerStart() {
    held = true;
    if (pf.stagger > 0 || pf.broken > 0) return false;
    const a = pf.attack;
    if (a) { if (a.phase === 'recover' || (a.phase === 'active' && a.u > .5)) queued = true; return false; }
    return beginPlayer();
  }
  function beginPlayer() {
    if (pf.stagger > 0 || pf.broken > 0) return false;
    const style = ctx.weaponStyle(), set = CHAINS[style] || CHAINS.sword;
    chain = now() - lastEnd < .5 ? (chain + 1) % 3 : 0;
    const key = chain === 2 ? set.heavy : set.light[chain];
    const def = ATTACKS[key];
    if (player.stamina < def.cost) { ctx.toast('ZU WENIG AUSDAUER', 1300); return false; }
    player.stamina -= def.cost;
    const inj = injuryEffects(ctx.injury(ctx.playerModel())), slow = 1 / Math.max(.45, inj.attack);
    const at = startAttack(pf, key, now(), { weapon: playerWeapon(), scale: { prepare: slow, recover: slow } });
    at.charge = 0; at.chain = chain; queued = false;
    events.emit('attackStart', { by: 'player', key, id: at.id, at: now(), chain });
    note(pf, `${key} beginnt`, now());
    return at;
  }
  function playerRelease() { held = false; }
  /** One fixed step of the wanderer's attack. Returns the attack (or null when it ended). */
  function playerStep(dt) {
    tick(pf, dt, now(), { stamina: player.stamina / (player.maxStamina || 100), injured: injuryLoad(ctx.injury(ctx.playerModel())) });
    const a = pf.attack; if (!a) return null;
    // Holding the button at the top of the wind-up holds the blow back and puts weight behind it (up to a second).
    if (a.phase === 'prepare' && held && a.t + dt >= a.d.prepare - 1e-3 && a.charge < 1) {
      a.t = a.d.prepare - 1e-3; a.charge = Math.min(1, a.charge + dt); a.time = a.prev = .999;
      if (a.charge > .22 && !a.heavy) { a.heavy = true; events.emit('charge', { by: 'player', id: a.id, at: now() }); }
      return a;
    }
    const step = stepAttack(pf, dt);
    if (step.entered === 'active') {
      // The blow is committed: its line is locked (a little steering is left), the body steps in.
      a.yaw = player.yaw; a.pitch = playerPitch(); a.steer = 0;
      if (a.charge > 0) { const k = Math.min(1, a.charge / .45); player.stamina = Math.max(0, player.stamina - 8 * k); a.power = k; }
      events.emit('attackActive', { by: 'player', key: a.key, id: a.id, at: now() });
    }
    if (a.phase === 'active' || (a.phase === 'prepare' && a.u > .6)) lungePlayer(a, dt);
    if (a.phase === 'active' || step.from < 2 && step.to >= 2) {
      // Up to 0.35 rad of steering toward where the wanderer now looks, at most 6 rad/s.
      const want = THREE.MathUtils.euclideanModulo(player.yaw - a.yaw + Math.PI, Math.PI * 2) - Math.PI, turn = clamp(want, -6 * dt, 6 * dt);
      if (Math.abs((a.steer || 0) + turn) <= .35) { a.yaw += turn; a.steer = (a.steer || 0) + turn; }
      playerSweep(a, step.from, step.to);
    }
    if (!pf.attack) {
      lastEnd = now();
      if (!a.hits.size && !a.stopped) { events.emit('miss', { by: 'player', key: a.key, id: a.id, at: now() }); note(pf, `${a.key} verfehlt`, now()); }
      if (queued) { queued = false; return beginPlayer() || null; }
    } else if (queued && a.phase === 'recover' && a.u > .45) {
      // In rhythm: the rest of the recovery is cut short by the next blow (held only if the button still is).
      pf.attack = null; lastEnd = now(); queued = false; return beginPlayer() || null;
    }
    return pf.attack;
  }
  function lungePlayer(a, dt) {
    const span = a.d.prepare * .4 + a.d.active, k = (a.def.lunge * injuryEffects(ctx.injury(ctx.playerModel())).lunge) * dt / span;
    const fx = -Math.sin(a.yaw ?? player.yaw), fz = -Math.cos(a.yaw ?? player.yaw), p = player.position;
    // Not into a foe's body: stop a step short of whoever stands in front.
    for (const e of enemies) if (!e.dead && Math.hypot(e.model.position.x - p.x - fx * .2, e.model.position.z - p.z - fz * .2) < .95) return;
    if (!world.blocked(p.x + fx * k, p.z, .4, p.y + .3)) p.x += fx * k;
    if (!world.blocked(p.x, p.z + fz * k, .4, p.y + .3)) p.z += fz * k;
  }
  function playerSweep(a, from, to) {
    const frame = playerFrame(frameA, a);
    list.reset();
    const p = player.position;
    for (const e of enemies) {
      if (e.gone || !e.model?.visible && !e.dead) continue;
      const q = e.model.position; if (Math.abs(q.x - p.x) > STRIKE_RANGE || Math.abs(q.z - p.z) > STRIKE_RANGE || Math.abs(q.y - p.y) > 3) continue;
      if (e.dead && !e.model.visible) continue;
      bodyOf(e, e.model, frameOf(e.model, frameB), e.kind === 'wolf' ? { height: (e.aim ?? .9), radius: (e.radius ?? .7) * .65 } : null);
    }
    for (const t of ctx.prey?.targets?.(STRIKE_RANGE) || []) if (!t.dead && t.model) bodyOf(t, t.model, frameOf(t.model, frameB), { height: t.aim ?? .9, radius: (t.radius ?? .6) * .7, length: t.length ?? 1.3 });
    const contacts = sweep({ def: a.def, weapon: a.weapon, frame, from, to, colliders: list.items(), ignore: a.hits, world: solid, unitSeconds: a.d.active });
    for (const c of contacts) {
      if (c.owner) a.hits.add(c.owner);
      const stop = playerContact(a, c);
      if (stop || c.stopped) { if (pf.attack === a && a.phase === 'active') rebound(pf, a.stopped || 'stopped', now()); break; }
    }
  }
  /** The wanderer's blade met something. Returns true when the blade stops there. */
  function playerContact(a, c) {
    const t = now(), weapon = a.weapon, power = a.power || 0;
    if (c.part === 'world') { wallStop(a, c, 'player'); a.stopped = 'wall'; return true; }
    const e = c.owner;
    const from = v3(player.position.x, player.position.y + 2.05, player.position.z);
    if (e.prey) {
      const s = strike({ base: ctx.weaponDamage(), mult: a.def.damage * (1 + .45 * power), kind: weapon.kind, region: regionOf(c.region), speed: c.speed, edge: c.edge });
      ctx.strikePrey(e, s.damage, c.point); events.emit('hit', { by: 'player', on: 'prey', at: t, region: c.region, damage: s.damage }); return !weapon.cleave;
    }
    if (e.dead) { ctx.corpseHit(e, c.point, c.dir); return !weapon.cleave; }
    const f = fighter(e), b = e.ai;
    if (!firstStrike(f, a.id, t)) return false;
    const cos = facingCos(e.model.rotation.y, player.position.x - e.model.position.x, player.position.z - e.model.position.z);
    const armed = !!e.model.userData.weapon || (!!e.shield && !e.shieldGone);
    const guardUp = armed && e.blocking > 0 && !b?.disarmed && !(f.broken > 0) && !(e.guardBroken > 0) && !f.attack;
    if (guardUp && !f.guard) setGuard(f, true, t - .25); // a guard held from before the blow (raised by brain intent, not timed)
    const d = defend({ guard: guardUp, guardAt: f.guard ? f.guardAt : -9, now: t, cos, stamina: b?.stamina ?? 40, posture: f.posture, shield: c.part === 'shield',
      force: a.def.force * (1 + .8 * power), attackPosture: a.def.posture * (1 + 1.3 * power), heavy: !!a.def.heavy || power > .5, skill: b?.personality.skill ?? .4, canParry: !!b && !b.personality.beast && !(e.riposteUntil > t) });
    if (b) b.stamina = Math.max(0, b.stamina - d.stamina);
    const broke = hurtPosture(f, d.posture, t);
    hurtPosture(pf, d.attackerPosture, t);
    events.emit('contact', { by: 'player', on: e.ai?.id, at: t, region: c.region, part: c.part, outcome: d.outcome, why: d.why, key: a.key, speed: +c.speed.toFixed(1) });
    note(f, `${a.key}: ${d.outcome} (${d.why}) an ${c.region}`, t);
    if (d.outcome === 'parry') {
      // Turned aside: the wanderer's blade flies off the line, they reel; the bandit has a moment to answer.
      ctx.effects.sound('parry'); ctx.effects.spray(c.point, v3(0, 1, 0), 'ember', 10); ctx.pause(.11);
      rebound(pf, 'parried', t); pf.stagger = .55; f.riposteUntil = t + 1.1;
      ctx.toast('PARIERT!', 900); ctx.motion?.playerHit?.(e, { blocked: true });
      events.emit('parried', { by: e.ai?.id, of: 'player', at: t }); if (b) ctx.onEvent(b, 'parried', {}, t);
      return true;
    }
    if (d.outcome === 'shield' || d.outcome === 'block') {
      const shield = d.outcome === 'shield';
      ctx.effects.sound(shield ? 'arrowWood' : 'parry'); ctx.effects.spray(c.point, v3(0, 1, 0), shield ? 'splinter' : 'ember', shield ? 4 : 6); ctx.pause(.04);
      if (broke || d.broken) breakGuardOf(e, c, a);
      else ctx.motion?.impact(e, { shield: true, force: a.def.force * (1 + .6 * power) * (shield ? .9 : .7), from: player.position.clone() });
      if (d.damage > 0) wound(e, a, c, d, from);
      events.emit(shield ? 'shieldBlock' : 'blocked', { by: e.ai?.id, of: 'player', at: t, broken: broke || d.broken }); if (b) ctx.onEvent(b, 'blockedPlayer', {}, t);
      ctx.ai?.noise('fight', e.model.position);
      a.stopped = shield ? 'shield' : 'blocked';
      return true;
    }
    if (d.outcome === 'bad') { ctx.effects.sound('parry'); ctx.effects.spray(c.point, v3(0, 1, 0), 'ember', 3); if (broke || d.broken) breakGuardOf(e, c, a); }
    wound(e, a, c, d, from, broke);
    return d.outcome === 'bad' || !weapon.cleave;
  }
  function breakGuardOf(e, c, a) {
    const f = fighter(e);
    e.guardBroken = 1.3; e.shieldUp = false; e.blocking = 0; e.stagger = Math.max(e.stagger || 0, .8); f.guard = false;
    ctx.effects.sound('parry'); ctx.effects.spray(c.point, v3(0, 1, 0), 'splinter', 5); ctx.pause(.07);
    ctx.toast('DECKUNG DURCHBROCHEN', 1100);
    ctx.motion?.impact(e, { shield: true, force: 2.4, from: player.position.clone() });
    if (e.ai) e.ai.stamina = Math.max(0, e.ai.stamina - 10);
    events.emit('guardBroken', { of: e.ai?.id, by: 'player', at: now(), key: a.key });
  }
  function wound(e, a, c, d, from, broke = false) {
    const t = now(), weapon = a.weapon, power = a.power || 0, f = fighter(e);
    const riposte = f.riposteUntil > t ? 0 : (e.riposteUntil > t ? DEFENSE.ripostes : 1);
    const region = regionOf(c.region);
    const s = strike({ base: ctx.weaponDamage(), mult: a.def.damage * (1 + .45 * power) * (riposte || 1), kind: weapon.kind, region, speed: c.speed, edge: c.edge,
      defence: d.damage, force: a.def.force * (1 + .8 * power), mass: weapon.mass, posture: a.def.posture * (1 + 1.3 * power), armor: null });
    const dealt = ctx.wound(e, { amount: s.damage, region, side: sideOf(c.region), zone: c.region, point: c.point, from, kind: weapon.kind, force: s.force, heavy: !!a.def.heavy || power > .5,
      attackId: a.id, riposte: riposte > 1, edge: c.edge, chain: a.chain || 0, blocked: d.outcome !== 'none' });
    if (hurtPosture(f, s.posture, t) && !broke) { e.stagger = Math.max(e.stagger || 0, .9); events.emit('postureBroken', { of: e.ai?.id, at: t }); }
    // Struck while winding up or striking: the blow is gone.
    if (f.attack && (f.attack.phase === 'prepare' || f.attack.phase === 'active') && s.force > .5) { f.lastAttack = interrupt(f, 'hit', t); e.cooldown = Math.max(e.cooldown || 0, .8); events.emit('interrupted', { of: e.ai?.id, at: t, why: 'getroffen' }); }
    events.emit('hit', { by: 'player', on: e.ai?.id, at: t, region: c.region, damage: Math.round(dealt ?? s.damage), why: s.why, outcome: d.outcome, edge: c.edge });
    if (e.riposteUntil > t) e.riposteUntil = 0;
  }
  function wallStop(a, c, who) {
    const surface = c.surface || 'wood', stone = surface === 'stone' || surface === 'ground' ? surface : surface;
    ctx.effects.sound(stone === 'wood' ? 'arrowWood' : 'parry');
    ctx.effects.spray(c.point, v3(0, 1, 0), stone === 'stone' ? 'ember' : stone === 'ground' ? 'dust' : 'splinter', 5);
    ctx.pause(.05);
    events.emit('wall', { by: who, at: now(), surface, key: a.key });
    ctx.ai?.noise('fight', c.point);
  }

  // ── A foe's attacks (people with a brain and a blade). The brain decides when; the attack runs its course here.
  /** How far this foe's blow really reaches (feet to the edge), for the brain. */
  function reachFor(e, key = 'slash_r') {
    const w = npcWeapon(e), def = ATTACKS[key] || ATTACKS.slash_r;
    return reachOf(def, w) * (e.model.scale?.y || 1);
  }
  function npcWeapon(e) {
    const item = e.look?.equipment?.weapon;
    if (item && /schwert|klinge/.test(item)) return weaponFor(item, 'sword');
    if (item === 'jagdspeer') return weaponFor(item, 'spear');
    return e.model.userData.weaponName?.startsWith('sword') ? WEAPONS.sword : WEAPONS.sword;
  }
  /** Starts a blow. opts: { key, heavy } — the brain or the tactics choose. */
  function npcStart(e, opts = {}) {
    const f = fighter(e), b = e.ai, prof = b?.personality || { skill: .4 };
    if (f.attack || f.stagger > 0 || f.broken > 0) return null;
    const w = npcWeapon(e), style = w.id === 'spear' ? 'spear' : 'sword', set = CHAINS[style];
    let key = opts.key;
    if (!key) { f.flip = !f.flip; key = opts.heavy ? set.heavy : set.light[f.flip ? 0 : 1]; }
    const def = ATTACKS[key], inj = injuryEffects(ctx.injury(e.model));
    const tired = b && b.stamina < 30 ? 1.15 : 1, riposte = f.riposteUntil > now() ? .6 : 1;
    const prepare = (1.35 - prof.skill * .55) * tired * riposte / Math.max(.45, inj.attack) * (opts.prepareScale ?? 1);
    const recover = (1.25 - prof.skill * .4) * tired / Math.max(.45, inj.attack);
    const a = startAttack(f, key, now(), { weapon: w, scale: { prepare, recover } });
    a.error = (b?.random?.() ?? Math.random()) - .5; a.errorScale = .05 + (1 - prof.skill) * .14 + inj.aim;
    a.feintAt = opts.feint ? a.d.prepare * (opts.feintAt ?? .7) : null; a.stepIn = !!opts.stepIn;
    if (b) b.stamina = Math.max(0, b.stamina - def.cost * .8);
    e.windup = 0; e.windupTotal = a.d.prepare;
    events.emit('attackStart', { by: b?.id, key, id: a.id, at: now(), heavy: !!def.heavy, prepare: +a.d.prepare.toFixed(2) });
    note(f, `${key} beginnt (Ausholen ${a.d.prepare.toFixed(2)} s)`, now());
    ctx.ai?.noise('fight', e.model.position);
    return a;
  }
  /** Cancels a foe's wind-up on purpose (a feint). */
  function npcFeint(e) {
    const f = fighter(e); if (f.attack?.phase !== 'prepare') return false;
    const a = interrupt(f, 'feint', now()); events.emit('feint', { by: e.ai?.id, key: a.key, at: now() }); note(f, `Finte (${a.key})`, now());
    return true;
  }
  /** One fixed step of a foe's attack. target: the wanderer. Returns 'done' when the attack ended this step. */
  function npcStep(e, dt) {
    const f = fighter(e), a = f.attack, b = e.ai;
    tick(f, dt, now(), { stamina: (b?.stamina ?? 60) / 100, injured: injuryLoad(ctx.injury(e.model)) });
    if (!a) return null;
    if (e.stagger > 0 && a.phase !== 'recover') { interrupt(f, 'stagger', now()); f.lastAttack = a; return 'done'; }
    const p = e.model.position, dx = player.position.x - p.x, dz = player.position.z - p.z, dist = Math.hypot(dx, dz);
    if (a.feintAt !== null && a.phase === 'prepare' && a.t >= a.feintAt) { npcFeint(e); f.lastAttack = a; return 'done'; }
    const step = stepAttack(f, dt);
    if (a.phase === 'prepare' || step.entered === 'active') ctx.turnToward(e, dx, dz, dt, 3 + (b?.personality.skill ?? .4) * 3.5);
    // Stepping in from outside the wanderer's reach as the blow winds up (waiting for an opening, then taking it).
    if (a.stepIn && a.phase === 'prepare' && dist > reachFor(e, a.key) - .35) ctx.moveEnemy(e, dx / (dist || 1) * 3.4 * dt * injuryEffects(ctx.injury(e.model)).move, dz / (dist || 1) * 3.4 * dt * injuryEffects(ctx.injury(e.model)).move);
    if (step.entered === 'active') {
      // Committed: the line is fixed now. Pitch toward the wanderer's chest, with the hand's own error.
      a.yaw = e.model.rotation.y;
      const s = e.model.scale?.y || 1, chest = player.position.y + (player.sneaking ? 1.05 : 1.5), pivot = p.y + PIVOT_Y * s;
      a.pitch = clamp(Math.atan2(chest - pivot, Math.max(.6, dist)) - NEUTRAL_PITCH + a.error * 2 * a.errorScale, -.8, .6);
      events.emit('attackActive', { by: b?.id, key: a.key, id: a.id, at: now() });
    }
    if (a.phase === 'active' || (a.phase === 'prepare' && a.u > .6)) {
      const span = a.d.prepare * .4 + a.d.active, k = a.def.lunge * injuryEffects(ctx.injury(e.model)).lunge * dt / span;
      const yaw = a.yaw ?? e.model.rotation.y, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      if (dist > .95 + .2) ctx.moveEnemy(e, fx * k, fz * k);
    }
    if (a.phase === 'active' || step.from < 2 && step.to >= 2) npcSweep(e, a, step.from, step.to);
    if (!f.attack) {
      f.lastAttack = a;
      if (!a.hits.size && !a.stopped) { events.emit('miss', { by: b?.id, key: a.key, id: a.id, at: now(), dist: +dist.toFixed(2) }); note(f, `${a.key} verfehlt (${dist.toFixed(1)} m)`, now()); if (b) ctx.onEvent(b, 'missed', {}, now()); }
      return 'done';
    }
    return null;
  }
  function npcSweep(e, a, from, to) {
    const f = fighter(e), frame = frameOf(e.model, frameA, e.model.position, a.yaw ?? e.model.rotation.y); frame.pitch = a.pitch || 0;
    list.reset();
    const m = ctx.playerModel();
    if (player.hp > 0 && !player.fly) bodyOf(player, m, frameOf(m, frameB, player.position, m?.rotation.y ?? player.yaw));
    const p = e.model.position;
    for (const o of enemies) {
      if (o === e || o.dead || o.gone || !o.model?.visible) continue;
      const q = o.model.position; if (Math.abs(q.x - p.x) > STRIKE_RANGE || Math.abs(q.z - p.z) > STRIKE_RANGE) continue;
      bodyOf(o, o.model, frameOf(o.model, frameB), o.kind === 'wolf' ? { height: o.aim ?? .9, radius: (o.radius ?? .7) * .65 } : null);
    }
    const contacts = sweep({ def: a.def, weapon: a.weapon, frame, from, to, colliders: list.items(), ignore: a.hits, world: solid, unitSeconds: a.d.active,
      stopAt: o => o !== player });
    for (const c of contacts) {
      if (c.owner) a.hits.add(c.owner);
      if (c.part === 'world') { wallStop(a, c, e.ai?.id); a.stopped = 'wall'; rebound(f, 'wall', now()); break; }
      if (c.owner !== player) {
        // A comrade in the way: the blow is spent on him (a knock, no wound), and both know it.
        a.stopped = 'ally'; rebound(f, 'ally', now()); ctx.effects.sound('impact');
        ctx.motion?.impact(c.owner, { shield: true, force: .6, from: p.clone() });
        events.emit('allyInWay', { by: e.ai?.id, ally: c.owner.ai?.id, at: now() }); note(f, 'Kamerad im Weg', now());
        break;
      }
      if (npcContact(e, a, c)) break;
    }
  }
  /** A foe's blade met the wanderer. Returns true when the blade stops there. */
  function npcContact(e, a, c) {
    const t = now(), f = fighter(e), b = e.ai, prof = b?.personality || { damage: 14, skill: .4 };
    if (!firstStrike(pf, a.id, t)) return false;
    const g = ctx.guard(), p = e.model.position;
    const cos = facingCos(player.yaw, p.x - player.position.x, p.z - player.position.z);
    const d = defend({ guard: g.up && !(pf.broken > 0), guardAt: g.at, now: t, cos, stamina: player.stamina, posture: pf.posture, force: a.def.force, attackPosture: a.def.posture,
      heavy: !!a.def.heavy, skill: .5, canParry: true });
    player.stamina = Math.max(0, player.stamina - d.stamina);
    const broke = hurtPosture(pf, d.posture, t);
    hurtPosture(f, d.attackerPosture, t);
    events.emit('contact', { by: b?.id, on: 'player', at: t, region: c.region, part: c.part, outcome: d.outcome, why: d.why, key: a.key, speed: +c.speed.toFixed(1) });
    const eye = v3(player.position.x, player.position.y + 1.75, player.position.z);
    if (d.outcome === 'parry') {
      rebound(f, 'parried', t); e.stagger = Math.max(e.stagger || 0, 1); e.riposteUntil = t + 1.4;
      player.stamina = Math.min(player.maxStamina, player.stamina + 10); ctx.pause(.13);
      ctx.toast('PARIERT · KONTER!', 1100); ctx.effects.sound('parry'); ctx.effects.spray(c.point, v3(0, 1, 0), 'ember', 8);
      ctx.motion?.impact(e, { kind: 'parried', from: player.position.clone(), combo: 2, amount: 0 });
      ctx.motion?.playerHit?.(e, { blocked: true });
      events.emit('parried', { by: 'player', of: b?.id, at: t }); if (b) ctx.onEvent(b, 'parriedBy', {}, t);
      return true;
    }
    if (d.outcome === 'block') {
      rebound(f, 'blocked', t); ctx.effects.sound('parry'); ctx.effects.spray(c.point, v3(0, 1, 0), 'ember', 9);
      ctx.motion?.playerHit?.(e, { blocked: true });
      const s = strike({ base: prof.damage * (e.storyId ? 1.3 : 1), mult: a.def.damage, kind: a.weapon.kind, region: regionOf(c.region), speed: c.speed, edge: c.edge, defence: d.damage });
      if (s.damage >= 1) ctx.onHurt(Math.round(s.damage), { attackId: a.id, from: p, blocked: true });
      if (broke || d.broken) breakPlayerGuard(e);
      events.emit('blocked', { by: 'player', of: b?.id, at: t, broken: broke || d.broken }); if (b) ctx.onEvent(b, 'blocked', {}, t);
      return true;
    }
    if (d.outcome === 'bad') { ctx.effects.sound('parry'); ctx.effects.spray(c.point, v3(0, 1, 0), 'ember', 4); if (broke || d.broken) breakPlayerGuard(e); }
    const s = strike({ base: prof.damage * (e.storyId ? 1.3 : 1), mult: a.def.damage, kind: a.weapon.kind, region: regionOf(c.region), speed: c.speed, edge: c.edge, defence: d.damage,
      force: a.def.force, mass: a.weapon.mass, posture: a.def.posture });
    ctx.onHurt(Math.max(1, Math.round(s.damage)), { attackId: a.id, from: p, point: c.point, region: regionOf(c.region), zone: c.region });
    ctx.effects.sound('impact');
    if (!ctx.effects.hurtPlayer(p.clone().add(v3(0, 1.5, 0)), { amount: s.damage, point: c.point })) ctx.effects.spray(c.point, v3(player.position.x - p.x, 0, player.position.z - p.z).normalize(), 'blood', 14);
    ctx.motion?.playerHit?.(e, { damage: s.damage, heavy: !!a.def.heavy || !!e.storyId, point: c.point, zone: c.region });
    if (hurtPosture(pf, s.posture, t) && !broke) breakPlayerGuard(e, true);
    if (pf.attack && (pf.attack.phase === 'prepare' || pf.attack.phase === 'active') && s.force > .7) { interrupt(pf, 'hit', t); ctx.cancelPlayerAction(); events.emit('interrupted', { of: 'player', at: t, why: 'getroffen' }); }
    events.emit('hit', { by: b?.id, on: 'player', at: t, region: c.region, damage: Math.round(s.damage), why: s.why, outcome: d.outcome });
    if (b) ctx.onEvent(b, 'hitPlayer', {}, t);
    ctx.ai?.noise('fight', p);
    return d.outcome === 'bad' || !a.weapon.cleave;
  }
  function breakPlayerGuard(e, quiet = false) {
    pf.broken = Math.max(pf.broken, .9); pf.guard = false; ctx.breakGuard(.9); pf.stagger = Math.max(pf.stagger, .4);
    if (!quiet) ctx.toast('DECKUNG GEBROCHEN', 1100);
    ctx.motion?.playerHit?.(e, { damage: 0, heavy: true });
    events.emit('guardBroken', { of: 'player', by: e.ai?.id, at: now() });
  }
  const injuryLoad = inj => inj ? Math.max(inj.torso || 0, (inj.leg_left || 0) * .5, (inj.leg_right || 0) * .5) : 0;

  // ── Views of the blade (render: third-person IK, first person, debug lines).
  /** World hilt, tip and direction of a fighter's current attack (null when none), between the last two simulation
   *  steps by `alpha` (render interpolation). New vectors each call. */
  function bladeOf(who, alpha = 1) {
    const f = who === 'player' ? pf : who.fight, a = f?.attack; if (!a || !a.weapon) return null;
    const frame = who === 'player' ? playerFrame(frameA, a) : Object.assign(frameOf(who.model, frameA, who.model.position, a.yaw ?? who.model.rotation.y), { pitch: a.pitch || 0 });
    if (who !== 'player' && a.phase === 'prepare') frame.pitch = 0;
    const time = Math.min(2.999, a.prev + (a.time - a.prev) * clamp(alpha, 0, 1));
    const out = bladeAt(a.def, a.weapon, time, frame, { hilt: v3(), tip: v3(), dir: v3() });
    return { hilt: out.hilt, tip: out.tip, dir: out.dir, attack: a, weight: weightOf(a) };
  }
  /** How strongly the track takes over the arm: eased in through the wind-up, out at the end of the recovery. */
  function weightOf(a) {
    if (a.phase === 'prepare') return clamp(a.u / .35, 0, 1);
    if (a.phase === 'recover') return clamp((1 - a.u) / .4, 0, 1);
    return 1;
  }
  function setPlayerGuard(up) { setGuard(pf, up, now()); }
  const injuryOf = who => ctx.injury(who === 'player' ? ctx.playerModel() : who.model);
  function setNpcGuard(e, up) { setGuard(fighter(e), up, now()); }
  function reset() { pf.attack = null; pf.stagger = 0; pf.broken = 0; pf.posture = 1; held = false; queued = false; for (const e of enemies) if (e.fight) { e.fight.attack = null; e.fight.posture = 1; e.fight.broken = 0; } events.clear(); }
  return { get time() { return now(); }, events, player: pf, fighter, snapshots, snapshot, playerStart, playerRelease, playerStep, npcStart, npcStep, npcFeint, reachFor, npcWeapon, bladeOf, weightOf, setPlayerGuard, setNpcGuard, injuryOf, reset,
    get held() { return held; } };
}

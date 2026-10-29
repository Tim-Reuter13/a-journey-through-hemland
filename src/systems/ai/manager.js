import * as THREE from 'three';
import { AI, LINES, makePersonality } from './config.js';
import { createSoundBus, sense, eyeOf, inView } from './perception.js';
import { createBrain, think, onEvent, persistBrain, restoreBrain } from './brain.js';
import { createGroups } from './group.js';

// HUMANITY AI — the manager. Owns the sound bus, the brains and their groups, and runs the layers at
// their own rates: senses every ~160 ms, decisions every ~320 ms, groups every ~300 ms; brains are
// staggered and only `budget` think per frame; far brains (beyond lod.near) run slowly and calm ones
// beyond lod.far are simply kept where their day says they are. It also carries what the world tells
// it — deaths, wounds, near misses, fire — to the people who could actually have noticed.
//
// The faction's memory of the wanderer (fire, bow, cruelty, mercy) lives in game flags (saved) and is
// only updated by witnesses who lived to tell it.

const eye = new THREE.Vector3(), body = new THREE.Vector3();

/**
 * world: { heightAt, blocked, segmentBlocked, near(pos, r) → colliders }
 * hooks: { say(npc, text, line), provoke(brain, reason), faction() → memory object, enemyOf(brain) }
 */
export function createAIManager({ world, hooks = {} }) {
  // Far brains are placed at their schedule spot; never inside a crate or a tent standing there.
  const spot = new THREE.Vector3();
  function freeSpot(goal) {
    if (!world?.blocked || !world.blocked(goal.x, goal.z, .45, goal.y)) return goal;
    for (let r = .6; r <= 3; r += .6) for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, x = goal.x + Math.cos(a) * r, z = goal.z + Math.sin(a) * r; if (!world.blocked(x, z, .45, goal.y)) return spot.set(x, goal.y, z); }
    return goal;
  }
  const sounds = createSoundBus(), groups = createGroups(), brains = [];
  let time = 0, groupAt = 0, cursor = 0, kills = 0;
  const lastSaid = new Map(), spoken = [];
  const faction = () => hooks.faction?.() ?? {};

  function say(brain, line, cooldown = 6, vars = {}) {
    const lines = LINES[line]; if (!lines) return;
    const last = lastSaid.get(brain)?.[line] ?? -1e9;
    if (time - last < cooldown) return;
    (lastSaid.get(brain) || lastSaid.set(brain, {}).get(brain))[line] = time;
    const text = lines[Math.floor(brain.random() * lines.length)].replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
    hooks.say?.(brain.npc, text, line);
    // Everything actually said, for the debug view (warnings, orders, callouts as they went out).
    spoken.push(`${time.toFixed(1)} ${brain.id}: ${text}`); if (spoken.length > 10) spoken.shift();
    return text;
  }
  /** A shout: heard by whoever is in earshot (perception), carrying what the speaker knows. */
  function shout(brain, line, info = {}, cooldown = 6, vars = {}) {
    const text = say(brain, line, cooldown, vars);
    if (text === undefined && cooldown) return;
    const m = brain.memory, knows = m.knows(time);
    const payload = { ...info };
    if (info.player !== false && knows) { payload.player = true; payload.pos = m.player.pos.clone(); payload.q = m.quality(time); }
    sounds.emit('shout', brain.npc.model.position, { speaker: brain.npc, text, info: payload, source: 'npc' });
  }

  function attach(npc, opts) {
    const personality = makePersonality(opts.seed ?? brains.length * 977 + 13, opts.archetype);
    const brain = createBrain(npc, { ...opts, personality, id: opts.id ?? `${personality.label}_${brains.length}` });
    brain.nextSense = time + brains.length * .037 % AI.tick.sense; brain.nextThink = time + brains.length * .071 % AI.tick.think;
    npc.ai = brain; brains.push(brain); groups.add(brain);
    return brain;
  }
  function detach(npc) {
    const i = brains.indexOf(npc.ai); if (i < 0) return;
    groups.remove(npc.ai); brains.splice(i, 1); lastSaid.delete(npc.ai); npc.ai = null;
  }

  /** Can `b` see the point (a body, an event)? Light and view cone matter; loud things are also heard. */
  function witnesses(point, { group = null, radius = 40 } = {}) {
    return brains.filter(b => !b.npc.dead && (!group || b.group === group) && !b.asleep && (() => {
      eyeOf(b.npc, eye); const d = eye.distanceTo(point);
      if (d > radius) return false;
      return (d < 6 || inView(b.npc, point, AI.sight.fovAlert)) && !world.segmentBlocked(eye, body.copy(point).setY(point.y + 1), .02);
    })());
  }

  // ── What happens in the world, delivered to those who perceive it.
  function died(npc, { cruel = false } = {}) {
    const brain = npc.ai; if (!brain) return;
    const leader = groups.leaderOf(brain.group) === brain || brain.personality.leads;
    const at = npc.model.position.clone();
    sounds.emit('death', at, { speaker: npc, info: { died: true } });
    const group = groups.groups.get(brain.group), lost = group ? group.members.filter(m => m.npc.dead).length / group.members.length : 0;
    const seen = witnesses(at, { group: brain.group });
    // Nobody saw it: for now they are only missing.
    if (!seen.length && group) group.missing.push({ brain, name: npc.personName || npc.name || brain.id, at: at.clone(), t: time, noticed: false, leader });
    for (const w of seen) {
      onEvent(w, 'allyDied', { ally: brain, leader, lost }, time);
      if (groups.allies(w).length === 0) shout(w, 'fewer', {}, 8);
      if (cruel) onEvent(w, 'cruelty', {}, time);
      if (leader) shout(w, 'leaderDown', { leaderDown: true }, 0);
      else if ((w.rel.get(brain) ?? 0) > .3 && w.traits.vengeance > .5) say(w, 'revenge', 0);
    }
    brain.token = false;
    for (const b of brains) if (b.group === brain.group && b !== brain) b.nervous = Math.min(.25, b.nervous + .08);
    kills++;
  }
  /** A wound tells where it came from, roughly, even from behind; and that this is now a fight. */
  function hurt(npc, amount, from = null) {
    const b = npc.ai; if (!b) return;
    onEvent(b, 'hurt', { amount }, time);
    if (from && !b.sees) b.memory.hear(from, time, .7, 'schmerz');
    if (!npc.calm && !['surrendered', 'pacified', 'grateful', 'fleeing'].includes(b.hostility)) { b.hostility = 'hostile'; b.since = time; }
    // Struck while yielding: the bold fight back, the rest run.
    else if (b.hostility === 'surrendered') { b.hostility = b.traits.aggression > .6 ? 'hostile' : 'fleeing'; b.since = time; b.disarmed = false; b.feigning = false; }
  }
  function nearMiss(npc, point, direction) {
    const b = npc.ai; if (!b || b.npc.dead) return;
    onEvent(b, 'nearMiss', {}, time); b.observed.add('bow');
    if (!b.sees) b.memory.arrowFrom(point, direction, time);
    if (b.hostility === 'unaware' || b.hostility === 'suspicious' || b.hostility === 'territorial' && !b.npc.calm) { b.hostility = 'searching'; b.since = time; }
  }
  /** A sound in the world. kind: AI.sounds key; source 'player' marks the wanderer as its maker. */
  function noise(kind, point, opts = {}) {
    sounds.emit(kind, point, opts);
    if (kind === 'arrowHit') for (const b of brains) if (!b.npc.dead && b.npc.model.position.distanceTo(point) < 3.2) { onEvent(b, 'impactNear', {}, time); if (opts.direction && !b.sees) b.memory.arrowFrom(point, opts.direction, time); }
  }
  function fireAt(point, radius = 3) {
    for (const b of brains) if (!b.npc.dead && b.npc.model.position.distanceTo(point) < radius + 3) onEvent(b, 'fireNear', {}, time);
    hazards.push({ point: point.clone(), radius, until: time + 4 });
  }
  const hazards = [];

  /** Per frame. P: the wanderer as perceptible to others (see main.js aiPlayer). */
  function update(dt, P, env) {
    time += dt; sounds.advance(dt);
    for (let i = hazards.length - 1; i >= 0; i--) if (hazards[i].until < time) hazards.splice(i, 1);
    const ctx = { time, world, player: P, sounds, daylight: env.daylight, hour: env.hour, truce: env.truce, kills, faction: faction(), hazards,
      allies: b => groups.allies(b), near: (p, r) => world.near ? world.near(p.x, p.z, r) : [],
      shout, say: (b, line, cd, vars) => say(b, line, cd, vars), provoke: (b, reason) => hooks.provoke?.(b, reason), enemyOf: b => hooks.enemyOf ? hooks.enemyOf(b) : true };
    let thinking = 0;
    for (let k = 0; k < brains.length; k++) {
      const b = brains[(cursor + k) % brains.length];
      if (b.npc.dead) continue;
      const far = b.npc.model.position.distanceTo(P.position);
      // Nobody near: a calm camp member is simply where their day says (consistent when you return).
      if (far > AI.lod.far) {
        if (b.schedule && b.hostility === 'territorial' && time >= b.nextThink) { const r = b.schedule(b, ctx); if (r?.goal) b.npc.model.position.copy(freeSpot(r.goal)); b.nextThink = time + AI.tick.farThink; b.intent.goal = null; b.intent.pose = r?.pose ?? null; }
        continue;
      }
      const slow = far > AI.lod.near;
      if (time >= b.nextSense) { sense(b, ctx, Math.min(1, time - (b.sensedAt ?? time - AI.tick.sense))); b.sensedAt = time; b.nextSense = time + (slow ? AI.tick.farSense : AI.tick.sense); }
      if (time >= b.nextThink && thinking < AI.tick.budget) { think(b, ctx); thinking++; b.nextThink = time + (slow ? AI.tick.farThink : AI.tick.think) * (.9 + b.random() * .2); }
    }
    cursor = (cursor + thinking) % Math.max(1, brains.length);
    if (time >= groupAt) { groups.update(ctx); groupAt = time + AI.tick.group; findBodies(); }
    // Survivors who got away tell the others what the wanderer does (the faction's memory).
    for (const b of brains) if (b.observed.size && !b.npc.dead && !b.npc.gone && (b.hostility === 'unaware' || b.hostility === 'fleeing' && b.npc.model.position.distanceTo(P.position) > 40)) {
      hooks.learn?.([...b.observed]); b.observed.clear();
    }
    return thinking;
  }

  // A searcher who comes upon a missing comrade's body raises the alarm for everyone in earshot.
  function findBodies() {
    for (const g of groups.groups.values()) for (let i = g.missing.length - 1; i >= 0; i--) {
      const m = g.missing[i], finder = witnesses(m.at, { group: g.id, radius: AI.search.findRange }).find(b => !b.npc.gone);
      if (!finder) continue;
      g.missing.splice(i, 1);
      onEvent(finder, 'allyDied', { ally: m.brain, leader: m.leader }, time);
      shout(finder, 'found', { found: true, ally: m.brain, leader: m.leader, player: false }, 0, { name: m.name });
      for (const b of g.members) if (!b.npc.dead) b.nervous = Math.min(.3, b.nervous + .1);
      finder.errand = null;
    }
  }
  function debugLines(at, limit = 8) {
    return brains.filter(b => !b.npc.dead).sort((a, c) => a.npc.model.position.distanceTo(at) - c.npc.model.position.distanceTo(at)).slice(0, limit).map(b => {
      const e = b.emotion, top = Object.entries(b.scores).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ');
      const known = b.sees ? 'gesehen' : b.memory.knows(time) ? `vermutet (${b.memory.quality(time).toFixed(2)}, ${b.memory.player.source})` : 'unbekannt';
      return `${b.id} | ${b.hostility} | Furcht ${e.fear.toFixed(2)} · Mut ${e.confidence.toFixed(2)} · Wut ${e.anger.toFixed(2)} · Ausd. ${Math.round(b.stamina)} | Spieler: ${known} | `
        + `${b.action.id}${b.token ? ' [Slot]' : ''}${b.orders ? ` [Befehl ${b.orders.kind}]` : ''} | ${b.action.reason} | ${top}`;
    });
  }
  return {
    spoken, attach, detach, update, died, hurt, nearMiss, noise, fireAt, shout, say, debugLines, sounds, groups, brains, hazards,
    persist: npc => npc.ai ? persistBrain(npc.ai) : undefined,
    restore: (npc, data) => npc.ai && restoreBrain(npc.ai, data),
    get time() { return time; },
    state: () => brains.map(b => ({ id: b.id, group: b.group, hostility: b.hostility, action: b.action.id, reason: b.action.reason, fear: +b.emotion.fear.toFixed(2),
      confidence: +b.emotion.confidence.toFixed(2), sees: b.sees, knows: b.memory.knows(time), token: b.token, stamina: Math.round(b.stamina), asleep: b.asleep, dead: !!b.npc.dead })),
  };
}

import * as THREE from 'three';
import { AI, LINES, seeded } from './config.js';
import { createMemory } from './memory.js';
import * as S from './spatial.js';

// Layers C–E — psychology, goals and tactics for one person. Emotions move with what happens to them
// and around them; a hostility state says how they stand to the wanderer; every think tick scores a
// set of data-defined actions (utility) and keeps the current one unless another is clearly better
// (hysteresis, minimum durations). The chosen action writes an intent (where to go, what to face,
// how fast, which pose, attack or guard) that combat.js carries out with movement and animation.

const clamp = THREE.MathUtils.clamp;
const PEACE = new Set(['unaware', 'territorial', 'pacified', 'grateful']);
const WARY = new Set(['suspicious', 'searching']);
const FIGHT = new Set(['hostile']);
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

export function createBrain(npc, { personality, id, group = null, home = null, story = false, noSurrender = false, territorial = false, schedule = null, transient = false }) {
  const t = personality.traits;
  return {
    id, npc, personality, traits: t, group, story, noSurrender, schedule, transient,
    home: (home || npc.model.position).clone(),
    random: seeded(personality.seed * 31 + 7),
    hostility: territorial ? 'territorial' : 'unaware', since: 0,
    emotion: { fear: .06 + (1 - t.courage) * .12, anger: 0, stress: 0, confidence: .3 + t.confidence * .5, fatigue: 0, pain: 0, suspicion: 0 },
    nervous: 0, awareness: 0, sees: false, los: false, alert: false, alertUntil: -1, asleep: false,
    memory: createMemory(), perceived: { heard: [], sees: false, glimpsed: false },
    action: { id: 'routine', since: -1e9, reason: 'Ruhe' },
    intent: { id: 'routine', goal: null, face: null, speed: 0, pose: null, attack: false, guard: false, tolerance: .6 },
    scores: {}, cooldowns: {}, token: false, tokenSince: 0, tokenCooldown: 0, orders: null, flanked: false,
    stamina: 100, arrows: personality.ranged ? 14 : 0, mana: personality.caster ? AI.magic.mana : 0, errand: null, healTarget: null, warnings: 0, aimTime: 0, said: {}, cache: {},
    nextSense: 0, nextThink: 0, lastHeard: 0, lastThink: 0, nearMissAt: -1e9, fireAt: -1e9, hurtAt: -1e9,
    disarmed: false, spared: false, robbed: false, feigning: false, tellSince: -1, unwatched: 0, demandUntil: 0,
    observed: new Set(), rel: new Map(), log: [],
  };
}

// ── Emotions from discrete events (layer C). Each reaction is weighted by who this person is.
export function onEvent(b, type, data = {}, t = 0) {
  const e = b.emotion, tr = b.traits;
  switch (type) {
    case 'hurt': {
      const k = data.amount / b.npc.maxHp;
      e.pain = clamp(e.pain + k * 1.4, 0, 1); e.fear += k * (1.15 - tr.grit); e.anger += k * tr.vengeance * .8; e.confidence -= k * .4;
      b.hurtAt = t; b.alert = true; break;
    }
    case 'allyDied': {
      const rel = b.rel.get(data.ally) ?? 0, leader = data.leader;
      // The more of the group already lies on the ground, the worse each death hits.
      e.fear += .2 * (1 - tr.courage * .6) + (leader ? .22 * (1 - tr.discipline) : 0) + Math.max(0, rel) * .1 + (data.lost || 0) * .18;
      e.anger += Math.max(0, rel) * tr.vengeance * .6; e.confidence -= leader ? .2 : .1;
      b.memory.remember(rel > .3 ? 'friendKilled' : 'allyKilled', { t, ally: data.ally?.id });
      if (rel > .3 && tr.vengeance > .55) b.vengeful = true;
      break;
    }
    case 'allyFled': e.fear += .1 * (1 - tr.discipline) * (1 + (b.rel.get(data.ally) ?? 0) * .3); e.confidence -= .05; break;
    case 'allySurrendered': e.fear += .07 * (1 - tr.discipline); e.confidence -= .04; break;
    case 'leaderDown': e.fear += .18 * (1 - tr.discipline); e.confidence -= .15; break;
    case 'nearMiss': e.fear += .13 * (1 - tr.grit * .6); e.stress += .2; e.suspicion = 1; b.nearMissAt = t; b.alert = true; break;
    case 'impactNear': e.fear += .05; e.suspicion = 1; b.alert = true; break;
    case 'fireNear': e.fear += .24 * (1 - tr.courage * .7); e.stress += .25; b.fireAt = t; b.alert = true; b.observed.add('fire'); break;
    case 'cruelty': e.fear += .3 * (1 - tr.courage * .5); e.anger += .3 * tr.vengeance; b.observed.add('cruel'); break;
    case 'hitPlayer': e.confidence += .07; break;
    case 'blocked': e.confidence -= .05; e.stress += .06; break;
  }
  e.fear = clamp(e.fear, 0, 1); e.anger = clamp(e.anger, 0, 1); e.confidence = clamp(e.confidence, 0, 1); e.stress = clamp(e.stress, 0, 1);
}

// ── The situation as this person understands it (only what they know).
function situation(b, ctx, dt) {
  const npc = b.npc, p = npc.model.position, t = ctx.time, m = b.memory, P = ctx.player;
  const knows = m.knows(t), q = m.quality(t), target = m.player.pos;
  const dist = knows ? Math.hypot(target.x - p.x, target.z - p.z) : Infinity;
  const trueDist = Math.hypot(P.position.x - p.x, P.position.z - p.z);
  const allies = ctx.allies(b);
  const fighting = allies.filter(o => FIGHT.has(o.hostility) && !['flee', 'retreat'].includes(o.action.id) && o.npc.model.position.distanceTo(p) < 30);
  const sees = b.sees, aimed = sees && P.bow.drawing && aimedAt(P, npc);
  // A bow pointed at a comrade is as much a threat to a guard who sees it.
  const aimedAtAlly = sees && P.bow.drawing && !aimed && allies.some(o => o.npc.model.position.distanceTo(p) < 30 && aimedAt(P, o.npc));
  const hp = npc.hp / npc.maxHp, wounded = allies.find(o => o.npc.hp / o.npc.maxHp < .35 && (b.rel.get(o) ?? 0) > .3 && o.npc.model.position.distanceTo(p) < 12);
  // The wanderer's danger as seen by this person: what they carry and what they have done here.
  const threat = clamp(.35 + (P.armor || 0) / 40 + (ctx.kills || 0) * .12 + (aimed ? .25 : 0) + (P.casting && sees ? .2 : 0), 0, 1);
  // Ranged means arrows in the quiver, or mana enough for a bolt.
  const ranged = !b.disarmed && (b.personality.ranged && b.arrows > 0 || b.personality.caster && b.mana >= AI.magic.bolt);
  // A friend a hedge-witch could heal: hurt, near, not in the thick of it.
  const patient = b.personality.caster && b.mana >= AI.magic.heal ? allies.filter(o => o.npc.hp / o.npc.maxHp < .55 && o.npc.model.position.distanceTo(p) < 16 && o.hostility !== 'surrendered')
    .sort((x, y) => x.npc.hp / x.npc.maxHp - y.npc.hp / y.npc.maxHp)[0] ?? null : null;
  const s = { t, dt, knows, q, target, dist, trueDist, sees, aimed, aimedAtAlly, aimDraw: P.bow.draw || 0, swinging: sees && P.swinging && trueDist < 4.5,
    casting: sees && P.casting, hp, allies, fighting, wounded, threat, ranged, patient, bowSeen: sees && P.bow.drawing,
    nearMiss: t - b.nearMissAt < 3.5, fire: t - b.fireAt < 4, story: b.story,
    // HUMANITY MOTION: a comrade in the wanderer's grip, or the wanderer held by one of us.
    allyHeld: allies.find(o => o.npc.heldByPlayer && o.npc.model.position.distanceTo(p) < 20) ?? null, playerHeld: !!P.heldBy };
  // Costly spatial facts are cached per brain for a second or two.
  s.cornered = cached(b, 'cornered', t, 2, () => knows && dist < 18 ? !S.escapePoint(ctx.world, p, target) : false);
  s.clearShot = s.ranged && sees ? S.lineClear(tmp.copy(p).setY(p.y + 1.6), tmp2.copy(P.position).setY(P.position.y + 1.4), allies.map(o => o.npc.model.position.clone().setY(o.npc.model.position.y + 1.3))) : false;
  return s;
}
function cached(b, key, t, life, fn) {
  const c = b.cache[key];
  if (c && t - c.t < life) return c.v;
  const v = fn(); b.cache[key] = { t, v }; return v;
}
/** Is the wanderer's drawn bow pointed at this person? (within about a body's width of the line) */
export function aimedAt(P, npc) {
  const chest = tmp.copy(npc.model.position).setY(npc.model.position.y + 1.3), v = chest.sub(P.bow.eye), along = v.dot(P.bow.dir);
  if (along <= 0 || along > 38) return false;
  return v.addScaledVector(P.bow.dir, -along).length() < .9 + along * .02;
}

// ── Continuous emotional drift (layer C).
function feel(b, s) {
  const e = b.emotion, tr = b.traits, dt = s.dt;
  const floor = (1 - s.hp) * (.55 - tr.grit * .3), base = .06 + (1 - tr.courage) * .12 + b.nervous + floor;
  e.fear += (base - e.fear) * Math.min(1, AI.fear.decay * dt * (e.fear > base ? 1 : 6));
  if (s.aimed) e.fear += dt * .34 * s.aimDraw * (1 - tr.courage * .55) * (s.fighting.length ? .5 : 1) * clamp(1.5 - s.trueDist / 20, .2, 1.3) * (b.personality.shield ? .3 : 1);
  b.mana = Math.min(AI.magic.mana, b.mana + (b.personality.caster ? AI.magic.regen * dt : 0));
  if (FIGHT.has(b.hostility) && !s.fighting.length && s.threat > .55) e.fear += dt * .025 * (1 - tr.confidence);
  e.anger = Math.max(0, e.anger - dt * .025); e.pain = Math.max(0, e.pain - dt * .01);
  e.confidence += ((.3 + tr.confidence * .5) - e.confidence) * Math.min(1, dt * .03);
  e.fatigue = 1 - b.stamina / 100;
  e.stress = clamp(e.stress + (e.fear * .5 + e.pain * .3 + (s.aimed ? .2 : 0) - e.stress) * Math.min(1, dt * .8), 0, 1);
  e.suspicion = Math.max(0, e.suspicion - dt * .04);
  for (const k of ['fear', 'confidence']) e[k] = clamp(e[k], 0, 1);
}

// ── How they stand to the wanderer.
function relate(b, s, ctx) {
  const t = s.t, set = h => { if (b.hostility !== h) { b.hostility = h; b.since = t; } };
  if (b.npc.calm && !['pacified', 'grateful', 'surrendered'].includes(b.hostility)) { set('territorial'); return; }
  if (!b.npc.calm && b.hostility === 'territorial') set(s.knows ? 'hostile' : 'searching');
  switch (b.hostility) {
    case 'unaware':
      if (s.sees && ctx.enemyOf(b)) { set('hostile'); ctx.shout(b, 'spotted', { player: true }); }
      else if (s.knows || b.perceived.glimpsed) set('suspicious');
      break;
    case 'suspicious':
      if (s.sees && b.awareness >= 1 && ctx.enemyOf(b)) { set('hostile'); ctx.shout(b, 'spotted', { player: true }); }
      else if (!s.knows && t - b.since > 14) set('unaware');
      break;
    case 'hostile':
      if (!s.knows) set('searching');
      break;
    case 'searching':
      if (s.sees) { set('hostile'); ctx.shout(b, 'spotted', { player: true }); }
      // Lost the trail (only say so if there ever was one).
      else if (t - b.memory.player.t > AI.belief.searchFor) { if (b.memory.player.t > -1e8) ctx.say(b, 'lost'); set('unaware'); b.alertUntil = t + 60; }
      break;
    case 'demanding':
      if (t > b.demandUntil || s.trueDist > 22) set('hostile');
      break;
    case 'fleeing':
      // Run out of road: turn and face it (fight, yield or bargain). Safe and calm again: come back,
      // unless they are a passing stranger who simply keeps going.
      if (s.cornered) set('hostile');
      else if (s.trueDist > 45 && b.emotion.fear < AI.fear.fleeExit && !b.transient) set('searching');
      break;
  }
  b.alert = b.alert || t < b.alertUntil || WARY.has(b.hostility) || FIGHT.has(b.hostility);
}

// ── The actions (layer E). when: may it be chosen; score: utility 0..1+; plan: fill the intent.
const go = (b, goal, speed, extra = {}) => Object.assign(b.intent, { goal, speed, face: null, pose: null, attack: false, guard: false, tolerance: .6 }, extra);
const away = (from, threat, d) => tmp.subVectors(from, threat).setY(0).normalize().multiplyScalar(d).add(from).clone();
const fightingState = b => FIGHT.has(b.hostility) || b.hostility === 'demanding';
const RING = (ctx, base) => base + (ctx.faction.fire >= 2 ? AI.ring.fireBonus : 0);

export const ACTIONS = [
  { id: 'routine', minTime: 1, when: b => PEACE.has(b.hostility) || b.hostility === 'suspicious',
    score: (b, s) => .3 - (b.hostility === 'suspicious' && s.knows ? .2 : 0) - (b.errand && s.t < b.errand.until ? .3 : 0),
    plan(b, s, ctx) {
      const r = b.schedule?.(b, ctx) || null;
      if (b.hostility === 'pacified' || b.hostility === 'grateful') { go(b, b.cache.leaveTo?.v ?? b.home, 1.5); return; }
      if (r) { go(b, r.goal, r.speed ?? 1.4, { face: r.face || null, pose: r.pose || null, tolerance: r.tolerance ?? .6 }); b.asleep = r.pose === 'sleep' && !b.alert; }
      else go(b, b.home, 1.3);
    } },
  { id: 'watch', minTime: 1.2, when: (b, s) => (b.hostility === 'suspicious' || b.hostility === 'territorial' || b.hostility === 'grateful') && (s.sees || s.knows),
    score: (b, s) => .34 + b.traits.suspicion * .25 + (b.hostility === 'territorial' && s.trueDist < AI.warn.notice && s.trueDist >= AI.warn.halt ? .1 : 0),
    plan(b, s, ctx) {
      go(b, null, 0, { face: s.target, pose: b.hostility === 'territorial' && ctx.player.drawn ? 'guardReady' : null });
      if (!s.sees && b.perceived.heard.length) ctx.say(b, 'heard', 20);
      // Someone you once spared knows your face.
      if (b.hostility === 'grateful' && s.sees && !b.said.recognised) { b.said.recognised = s.t; ctx.say(b, 'recognised', 0); }
    } },
  { id: 'investigate', minTime: 2, when: (b, s) => (b.hostility === 'suspicious' || b.hostility === 'searching') && s.knows && !s.sees,
    score: (b, s) => .4 + b.traits.suspicion * .2 + b.traits.courage * .1 - b.emotion.fear * .3,
    plan(b, s) { go(b, s.target.clone(), 1.7, { pose: s.dist < 2.5 ? 'search' : null }); } },
  // Territorial: warn first, then warn again; a bow kept on them past the last warning starts a fight.
  { id: 'warn', minTime: 1.5, when: (b, s, ctx) => b.hostility === 'territorial' && !ctx.truce && s.sees && (s.trueDist < AI.warn.halt || s.aimed || s.aimedAtAlly),
    score: (b, s) => .64 + b.traits.discipline * .15 + (s.aimed || s.aimedAtAlly ? .3 : 0),
    plan(b, s, ctx) {
      go(b, null, 0, { face: ctx.player.position, pose: 'warn' });
      if (!b.said.halt) { b.said.halt = s.t; b.warnings = 1; ctx.say(b, 'halt', 0); }
      if (s.aimed || s.aimedAtAlly) {
        b.aimTime += s.dt;
        if (b.aimTime > .5 && b.warnings < 2) { b.warnings = 2; ctx.say(b, 'lowerBow', 0); }
        if (b.aimTime > AI.warn.aimProvokes) { ctx.say(b, 'lastWarning', 0); ctx.provoke(b, 'Bogen auf das Lager gerichtet'); }
      } else b.aimTime = Math.max(0, b.aimTime - s.dt * .5);
    } },
  { id: 'toll', minTime: 2, when: b => b.hostility === 'demanding', score: () => .8,
    plan(b, s, ctx) { go(b, s.trueDist > 5 ? ctx.player.position.clone() : null, 1.8, { face: ctx.player.position, pose: 'warn', tolerance: 4.5 }); if (!b.said.toll) { b.said.toll = s.t; ctx.say(b, 'toll', 0); } } },
  { id: 'engage', minTime: .6, when: (b, s) => fightingState(b) && s.knows && !s.ranged && b.hostility !== 'demanding',
    score: (b, s) => .42 + b.traits.aggression * .3 + b.emotion.confidence * .15 - b.emotion.fear * .55 + (b.token ? .28 : -.32) + b.emotion.anger * .15
      - (b.stamina < 25 ? .3 : 0) + (b.flanked ? .1 : 0) - (b.personality.leads && s.fighting.length >= 2 ? .12 : 0) + (b.vengeful ? .15 : 0)
      - (1 - s.hp) * .45 * (1 - b.traits.grit * .5),
    plan(b, s) {
      const reach = b.personality.reach;
      // A shield bearer comes in behind the shield whenever a bow is up or the gap is still open.
      const cover = b.personality.shield && (s.bowSeen || s.aimed || s.nearMiss || s.dist > reach + 1);
      go(b, s.target.clone(), s.dist > reach + 2 ? (cover ? 2.4 : 3.3) : 1.6, { face: s.target, attack: s.dist <= reach + .1 && s.sees, tolerance: reach - .4, guard: cover, pose: cover ? 'shieldUp' : null });
    } },
  { id: 'pressure', minTime: 1.2, when: (b, s) => FIGHT.has(b.hostility) && s.knows && !s.ranged,
    score: (b, s) => .4 + b.traits.discipline * .12 + b.traits.caution * .08 - b.emotion.fear * .1,
    plan(b, s, ctx) {
      b.orbit ??= b.random() < .5 ? -1 : 1;
      if (b.random() < s.dt * .35) b.orbit *= -1;
      // Feint: a quick step in and out, so waiting fighters stay dangerous without striking.
      if (!b.feintUntil && s.dist < 6.5 && b.random() < s.dt * .18) b.feintUntil = s.t + .45;
      if (b.feintUntil && s.t > b.feintUntil) b.feintUntil = 0;
      const goal = b.feintUntil ? s.target.clone() : S.ringPoint(ctx.world, b.npc.model.position, s.target, RING(ctx, AI.ring.waiting), b.orbit);
      const shield = b.personality.shield;
      go(b, goal, b.feintUntil ? 3.2 : 2.1, { face: s.target, guard: s.swinging || shield, pose: shield ? 'shieldUp' : 'guardReady', tolerance: b.feintUntil ? 2.2 : .8 });
    } },
  { id: 'flank', minTime: 1.5, cooldown: 4, when: (b, s) => FIGHT.has(b.hostility) && s.knows && !s.ranged && !b.token && (b.orders?.kind === 'flank' || (b.traits.cunning > .55 && s.fighting.length >= 1)),
    score: (b, s) => .4 + b.traits.cunning * .25 + (b.orders?.kind === 'flank' ? b.traits.obedience * .35 * (1 - b.emotion.fear) : 0) - b.emotion.fear * .25,
    plan(b, s, ctx) {
      const point = cached(b, 'flank', s.t, 1.2, () => S.flankPoint(ctx.world, b.npc.model.position, s.target, ctx.player.yaw, s.fighting.map(o => o.npc.model.position)));
      // The way round is blocked: the plan failed, choose again (and not this for a while).
      if (!point) { b.cooldowns.flank = s.t + 6; b.action.reason = 'Flanke blockiert'; return; }
      if (b.npc.model.position.distanceTo(point) < 1.3) { b.flanked = true; b.orders = null; }
      if (!b.said.flank && b.traits.discipline > .4) { b.said.flank = s.t; ctx.shout(b, 'flank'); }
      go(b, point, 3.2, { face: s.target, tolerance: .9 });
    } },
  { id: 'recover', minTime: 1.5, when: (b, s) => FIGHT.has(b.hostility) && s.knows && !s.ranged && b.stamina < 28 && !b.token,
    score: b => .36 + (28 - b.stamina) / 28 * .4,
    plan(b, s, ctx) { go(b, S.ringPoint(ctx.world, b.npc.model.position, s.target, 7.5, b.orbit || 1), 1.6, { face: s.target, guard: true, pose: 'guardReady' }); } },
  { id: 'retreat', minTime: 2, when: (b, s) => FIGHT.has(b.hostility) && s.knows && (b.emotion.fear > AI.fear.retreat || s.hp < .35),
    score: (b, s) => b.emotion.fear * .85 + b.emotion.pain * .25 - b.traits.courage * .25 - (s.story ? .15 : 0) - (b.vengeful ? .2 : 0) - (s.aimed ? .25 : 0) + (s.hp < .35 ? .35 : 0),
    plan(b, s, ctx) {
      // Back off toward the friends, guard up, eyes on the threat; ask for help when it is bad.
      const friends = s.fighting.length ? s.fighting[0].npc.model.position : b.home;
      const goal = away(b.npc.model.position, s.target, 5).lerp(friends, .3);
      go(b, goal, 1.7, { face: s.target, guard: true, pose: 'guardReady' });
      if (s.hp < .4 && s.allies.length) ctx.shout(b, 'help', { help: true }, 12);
    } },
  { id: 'cover', minTime: 2.2, cooldown: 1, when: (b, s) => !b.personality.beast && (FIGHT.has(b.hostility) || WARY.has(b.hostility)) && (s.nearMiss || s.aimed || s.fire),
    score: (b, s, ctx) => .4 + b.traits.caution * .3 + b.emotion.fear * .3 - b.traits.aggression * .2 + (s.nearMiss ? .2 : 0) - (s.trueDist < 5 ? .45 : 0) + Math.min(.15, (ctx.faction.bow || 0) * .04),
    plan(b, s, ctx) {
      const threat = s.knows ? s.target : b.memory.shooter.pos;
      const point = cached(b, 'cover', s.t, 2, () => S.coverPoint(ctx.world, b.npc.model.position, threat, ctx.near(b.npc.model.position, 16)));
      if (!point) { b.cooldowns.cover = s.t + 4; b.action.reason = 'keine Deckung'; return; }
      if (!b.said.cover) { b.said.cover = s.t; ctx.shout(b, s.nearMiss ? 'arrows' : s.fire ? 'magic' : 'bow', { player: s.knows }); }
      const there = b.npc.model.position.distanceTo(point) < 1;
      go(b, point, 3.8, { face: threat, pose: there ? 'sneak' : null, tolerance: .7 });
    } },
  { id: 'evade', minTime: .8, cooldown: 3, when: (b, s) => s.casting && s.trueDist < 22 && !b.personality.beast,
    score: (b, s, ctx) => .42 + b.traits.caution * .25 + b.traits.experience * .2 - b.traits.aggression * .1 + Math.min(.2, (ctx.faction.fire || 0) * .07),
    plan(b, s, ctx) {
      const side = tmp.set(ctx.player.position.z - b.npc.model.position.z, 0, b.npc.model.position.x - ctx.player.position.x).normalize().multiplyScalar((b.orbit || 1) * 3.2);
      go(b, b.npc.model.position.clone().add(side), 4.2, { face: ctx.player.position, tolerance: .5 });
    } },
  { id: 'flee', minTime: 4, when: (b, s) => (FIGHT.has(b.hostility) || b.hostility === 'fleeing') && s.knows && !s.cornered,
    score: (b, s) => (b.emotion.fear - .3) * 1.25 - b.traits.courage * .3 - b.traits.loyalty * (s.fighting.length ? .15 : 0) - b.traits.discipline * .1
      + (s.hp < .25 ? .25 : 0) + (b.orders?.kind === 'retreat' ? b.traits.obedience * .35 : 0) - (s.story ? .25 : 0) - (b.personality.beast ? .2 : 0)
      + (b.hostility === 'fleeing' ? .4 : 0)
      // A hedge-witch with the ember spent has nothing left to hold the line with.
      + (b.personality.caster && b.mana < AI.magic.bolt ? .3 : 0)
      // Running from a drawn bow across open ground: a back is an easy target.
      - (s.aimed ? .4 * clamp(1 - s.trueDist / 30, 0, 1) : 0),
    plan(b, s, ctx) {
      const goal = cached(b, 'escape', s.t, 2, () => S.escapePoint(ctx.world, b.npc.model.position, s.target, 22));
      if (!goal) { b.cache.cornered = { t: s.t, v: true }; return; }
      if (!b.said.flee) { b.said.flee = s.t; ctx.shout(b, b.orders?.kind === 'retreat' ? 'orderRetreat' : 'flee', { fled: true }); }
      if (b.hostility !== 'fleeing' && !b.personality.beast && b.orders?.kind !== 'retreat') b.hostility = 'fleeing';
      go(b, goal, b.personality.beast ? 6 : 4.4, { tolerance: 1.5 });
    } },
  // Yielding: hands up, weapon dropped. Sticky — they stay yielded unless the situation changes a lot.
  { id: 'surrender', minTime: Infinity, when: (b, s) => !b.noSurrender && !b.personality.beast && (FIGHT.has(b.hostility) || b.hostility === 'fleeing') && s.knows && s.trueDist < 16,
    score: (b, s, ctx) => b.emotion.fear * .95 + (s.aimed ? (s.fighting.length ? .2 : .38) : 0) + (s.cornered ? .22 : 0) + (s.hp < .3 ? .15 : 0) - b.traits.aggression * .3 - b.traits.vengeance * .15
      - b.emotion.confidence * .25 - s.fighting.length * .14 - (s.ranged ? .2 : 0) - (b.personality.shield ? .25 : 0) + Math.min(.15, (ctx.faction.spared || 0) * .05) - (ctx.faction.cruel ? .4 : 0) - (b.vengeful ? .3 : 0) - .2,
    plan(b, s, ctx) {
      if (b.hostility !== 'surrendered') {
        b.hostility = 'surrendered'; b.since = s.t; b.disarmed = true; b.token = false;
        // A rare few only pretend: sly, greedy and still willing to fight.
        b.feigning = b.traits.cunning > .68 && b.traits.greed > .45 && b.traits.aggression > .42 && b.random() < .45;
        ctx.shout(b, 'surrender', { surrendered: true }, 0);
      }
      b.action = { id: 'yield', since: s.t, reason: b.action.reason };
      go(b, null, 0, { face: ctx.player.position, pose: 'surrender' });
    } },
  { id: 'yield', minTime: 1, when: b => b.hostility === 'surrendered', score: () => .8,
    plan(b, s, ctx) {
      const watched = s.sees && (s.aimed || facing(ctx.player, b.npc) > .82) && s.trueDist < 12;
      b.unwatched = watched ? 0 : b.unwatched + s.dt;
      // The tell: eyes on the dropped weapon, weight shifting, before a feigned surrender breaks.
      if (b.feigning && b.unwatched > 1.2 && b.tellSince < 0) b.tellSince = s.t;
      if (b.tellSince >= 0 && watched) { b.tellSince = -1; b.feigning = b.random() < .5; }
      if (b.tellSince >= 0 && s.t - b.tellSince > 1.3) {
        b.hostility = 'hostile'; b.disarmed = false; b.feigning = false; b.tellSince = -1; b.strikeBack = true; b.token = true; b.tokenSince = s.t;
        b.action.reason = 'Täuschung: Bogen gesenkt, Rücken frei';
      }
      // Left alone long enough, a real yielder slips away.
      if (!b.feigning && (s.trueDist > 18 || b.unwatched > 10)) { b.hostility = 'fleeing'; b.since = s.t; }
      go(b, null, 0, { face: ctx.player.position, pose: b.tellSince >= 0 ? 'tense' : 'surrender' });
    } },
  { id: 'desperate', minTime: 1.5, when: (b, s) => FIGHT.has(b.hostility) && s.knows && (s.cornered && b.emotion.fear > .5 || b.strikeBack),
    score: (b, s) => .3 + b.traits.aggression * .35 + b.traits.courage * .2 + (s.cornered ? .3 : 0) + (b.strikeBack ? .6 : 0),
    plan(b, s) { go(b, s.target.clone(), 3.6, { face: s.target, attack: s.dist <= b.personality.reach + .1, tolerance: b.personality.reach - .4 }); } },
  // Shield wall: under a drawn bow or arrows, raise the shield and come on step by step (and taunt).
  { id: 'shieldwall', minTime: 1.5, when: (b, s) => FIGHT.has(b.hostility) && b.personality.shield && !b.disarmed && s.knows && s.trueDist > 3.2 && (s.aimed || s.aimedAtAlly || s.nearMiss || s.bowSeen),
    score: b => .58 + b.traits.discipline * .2 + b.traits.courage * .1 - b.emotion.fear * .3,
    plan(b, s, ctx) {
      go(b, s.target.clone(), 1.4, { face: s.target, guard: true, pose: 'shieldUp', tolerance: 2.6 });
      if (!b.said.shieldUp && s.allies.length) { b.said.shieldUp = s.t; ctx.shout(b, 'shieldUp', { player: true }); }
      else if (s.aimed && b.traits.confidence > .55) ctx.say(b, 'taunt', 12);
    } },
  // Healing: step up to a hurt friend (not into the melee) and mend them.
  { id: 'heal', minTime: 1.6, when: (b, s) => (FIGHT.has(b.hostility) || WARY.has(b.hostility)) && s.patient && s.trueDist > 4,
    score: (b, s) => .55 + b.traits.empathy * .3 + (b.rel.get(s.patient) ?? 0) * .2 - b.emotion.fear * .2 + (1 - s.patient.npc.hp / s.patient.npc.maxHp) * .2,
    plan(b, s, ctx) {
      b.healTarget = s.patient;
      const at = s.patient.npc.model.position, close = b.npc.model.position.distanceTo(at) < 6;
      go(b, close ? null : at.clone(), 2.8, { face: at, attack: close, pose: close ? null : null, tolerance: 4 });
      if (close) ctx.say(b, 'heal', 8);
    } },
  { id: 'shoot', minTime: 1, when: (b, s) => FIGHT.has(b.hostility) && s.ranged && s.sees && s.trueDist > 4.5 && s.trueDist < 36,
    score: (b, s) => .62 + b.traits.experience * .15 - b.emotion.fear * .25 + (s.clearShot ? .1 : -.5),
    plan(b, s, ctx) { go(b, null, 0, { face: ctx.player.position, attack: s.clearShot }); if (!b.said.bowSpot && s.allies.length) { b.said.bowSpot = s.t; } } },
  { id: 'kite', minTime: 1.2, when: (b, s) => FIGHT.has(b.hostility) && s.ranged && s.trueDist < 6.5,
    score: b => .66 + b.traits.caution * .2 - b.traits.aggression * .1,
    plan(b, s, ctx) { const goal = cached(b, 'kite', s.t, 1, () => S.escapePoint(ctx.world, b.npc.model.position, ctx.player.position, 10)); go(b, goal, 3.6, { face: ctx.player.position }); } },
  { id: 'reposition', minTime: 1.5, when: (b, s) => FIGHT.has(b.hostility) && s.ranged && s.knows && (!s.sees || !s.clearShot),
    score: () => .46,
    plan(b, s, ctx) {
      const point = cached(b, 'spot', s.t, 2, () => S.archerSpot(ctx.world, b.npc.model.position, s.target, s.allies.map(o => o.npc.model.position.clone().setY(o.npc.model.position.y + 1.3)), RING(ctx, AI.ring.archer)));
      if (!point) { b.cooldowns.reposition = s.t + 3; return; }
      go(b, point, 2.8, { face: s.target });
    } },
  { id: 'aid', minTime: 2, when: (b, s) => FIGHT.has(b.hostility) && s.knows && s.wounded && b.emotion.fear < .55,
    score: (b, s) => .38 + b.traits.empathy * .2 + (b.rel.get(s.wounded) ?? 0) * .3 + b.traits.loyalty * .1,
    plan(b, s) {
      // Stand between the wounded friend and the wanderer to cover their retreat.
      const friend = s.wounded.npc.model.position, goal = tmp.subVectors(s.target, friend).setY(0).normalize().multiplyScalar(1.8).add(friend).clone();
      go(b, goal, 3.2, { face: s.target, guard: true, pose: 'guardReady', attack: s.dist <= b.personality.reach + .1 && b.token });
    } },
  // Sent out: to where the wanderer was last known, or where a missing comrade should have been.
  { id: 'errand', minTime: 2, when: (b, s) => !!b.errand && s.t < b.errand.until && !s.sees && b.hostility !== 'surrendered' && b.hostility !== 'fleeing',
    score: b => .55 + b.traits.obedience * .2 + b.traits.loyalty * .1 - b.emotion.fear * .3,
    plan(b, s, ctx) {
      const e = b.errand, at = b.cache.errandSweep;
      if (!at || b.npc.model.position.distanceTo(at.v) < 1.4 || s.t - at.t > 7) {
        const r = Math.min(14, 2 + (s.t - e.since) * .35), a = b.random() * Math.PI * 2;
        const p = new THREE.Vector3(e.pos.x + Math.cos(a) * r, 0, e.pos.z + Math.sin(a) * r);
        if (!ctx.world.blocked(p.x, p.z, .4)) { p.y = ctx.world.heightAt(p.x, p.z); b.cache.errandSweep = { t: s.t, v: p }; }
      }
      const goal = b.cache.errandSweep?.v ?? e.pos.clone();
      go(b, goal, 2.2, { pose: b.npc.model.position.distanceTo(goal) < 1.6 ? 'search' : null });
    } },
  { id: 'search', minTime: 2.5, when: (b, s) => (b.hostility === 'searching' || FIGHT.has(b.hostility) && !s.sees && s.t - b.memory.player.t > AI.belief.staleSearch) && (s.knows || b.hostility === 'searching'),
    score: b => .45 + b.traits.experience * .1,
    plan(b, s, ctx) {
      // Sweep points round the last known place, the circle growing as the trail goes cold.
      const age = s.t - b.memory.player.t, at = b.cache.sweep;
      if (!at || b.npc.model.position.distanceTo(at.v) < 1.2 || s.t - at.t > 6) {
        const r = Math.min(10, 2 + age * .4), a = b.random() * Math.PI * 2, base = b.memory.player.pos;
        const p = new THREE.Vector3(base.x + Math.cos(a) * r, 0, base.z + Math.sin(a) * r);
        if (!ctx.world.blocked(p.x, p.z, .4)) { p.y = ctx.world.heightAt(p.x, p.z); b.cache.sweep = { t: s.t, v: p }; }
      }
      go(b, b.cache.sweep?.v ?? b.memory.player.pos.clone(), 1.9, { pose: b.cache.sweep && b.npc.model.position.distanceTo(b.cache.sweep.v) < 1.5 ? 'search' : null });
    } },
  // HUMANITY MOTION: hands on the wanderer. A brawler with friends about grabs to hold them for the
  // others; whoever wants distance (archers, mages, shields, the badly hurt) shoves them off; a comrade
  // in the wanderer's grip is freed by force.
  { id: 'grab', minTime: .6, cooldown: 14, when: (b, s) => FIGHT.has(b.hostility) && s.sees && s.trueDist < 1.6 && !b.disarmed && !b.personality.shield && !b.personality.ranged
      && !b.personality.caster && !b.personality.beast && s.fighting.length > 0 && !s.playerHeld && s.hp > .35,
    score: (b, s) => .3 + b.traits.aggression * .25 + b.traits.courage * .15 - b.emotion.fear * .4 + (s.fighting.length >= 2 ? .12 : 0),
    plan(b, s, ctx) { go(b, s.target.clone(), 2.6, { face: s.target, tolerance: 1.0 }); if (s.trueDist < 1.4) { b.intent.grab = true; ctx.say(b, 'grab', 10); } } },
  { id: 'shove', minTime: .5, cooldown: 7, when: (b, s) => FIGHT.has(b.hostility) && s.sees && s.trueDist < 1.4 && !b.disarmed && !b.personality.beast
      && (b.personality.ranged || b.personality.caster || b.personality.shield || s.hp < .4),
    score: b => .5 + b.traits.caution * .2 + (b.personality.shield ? .1 : 0),
    plan(b, s, ctx) { go(b, null, 0, { face: s.target }); b.intent.shove = true; ctx.say(b, 'shove', 8); } },
  { id: 'rescue', minTime: 1.2, when: (b, s) => FIGHT.has(b.hostility) && !!s.allyHeld && s.knows && !b.disarmed && !b.personality.beast,
    score: (b, s) => .55 + b.traits.loyalty * .25 + (b.rel.get(s.allyHeld) ?? 0) * .2 - b.emotion.fear * .3,
    plan(b, s, ctx) {
      go(b, s.target.clone(), 4.2, { face: s.target, attack: s.dist <= b.personality.reach + .2, pose: 'guardReady', tolerance: b.personality.reach * .8 });
      if (!b.said.rescue || s.t - b.said.rescue > 8) { b.said.rescue = s.t; ctx.shout(b, 'rescue', { player: true }); }
    } },
  { id: 'stand', minTime: 0, when: () => true, score: () => .05, plan(b) { go(b, null, 0); } },
];
const BY_ID = Object.fromEntries(ACTIONS.map(a => [a.id, a]));
const facing = (P, npc) => { const dx = npc.model.position.x - P.position.x, dz = npc.model.position.z - P.position.z, d = Math.hypot(dx, dz) || 1; return (-Math.sin(P.yaw) * dx - Math.cos(P.yaw) * dz) / d; };

/** One think tick: perceive → feel → relate → score → act. ctx: see manager.js. */
export function think(b, ctx) {
  const dt = Math.min(1.5, ctx.time - (b.lastThink || ctx.time - AI.tick.think)); b.lastThink = ctx.time;
  const s = situation(b, ctx, dt);
  feel(b, s);
  for (const h of b.perceived.heard) hearing(b, h, s, ctx);
  b.perceived.heard.length = 0;
  relate(b, s, ctx);
  b.stamina = Math.min(100, b.stamina + dt * (b.intent.guard ? 2 : 9));
  if (b.orders && s.t > b.orders.until) b.orders = null;
  if (b.errand && (s.t > b.errand.until || s.sees)) b.errand = null;
  if (s.t - (b.lastCast ?? -9) > 1) b.healTarget = b.action.id === 'heal' ? b.healTarget : null;
  if (b.strikeBack && s.t - b.since > 4) b.strikeBack = false;
  // Score every action that may be chosen now.
  const scores = b.scores; for (const k in scores) delete scores[k];
  let best = null, bestScore = -Infinity;
  for (const a of ACTIONS) {
    if (!a.when(b, s, ctx) || (b.cooldowns[a.id] || 0) > s.t) continue;
    let u = a.score(b, s, ctx);
    if (a.id === b.action.id) u += AI.hysteresis;
    scores[a.id] = +u.toFixed(2);
    if (u > bestScore) { bestScore = u; best = a; }
  }
  // A committed action runs its minimum time unless it can no longer be chosen at all, or something
  // far better turns up (an emergency: yielding to a drawn bow while backing off).
  const current = BY_ID[b.action.id];
  if (current && current !== best && scores[current.id] !== undefined && s.t - b.action.since < current.minTime && bestScore - scores[current.id] < .25) best = current;
  if (best.id !== b.action.id) {
    if (current?.cooldown) b.cooldowns[current.id] = s.t + current.cooldown;
    b.action = { id: best.id, since: s.t, reason: reasonFor(b, best.id, s) };
    b.log.push(`${s.t.toFixed(1)} ${best.id}: ${b.action.reason}`); if (b.log.length > 12) b.log.shift();
  }
  best.plan(b, s, ctx);
  b.intent.id = b.action.id;
  return b.intent;
}

// Shouts and sounds heard this tick: callouts carry knowledge, orders may be followed, a sleeper wakes.
function hearing(b, h, s, ctx) {
  const loudEnough = h.strength > .3;
  if (b.asleep && (loudEnough && ['fight', 'shout', 'death', 'arrowHit', 'fireImpact', 'scream', 'bowRelease'].includes(h.kind) || h.kind === 'step' && h.strength > .7)) {
    b.asleep = false; b.alert = true; b.alertUntil = s.t + 40; ctx.say(b, 'wake', 0);
    if (PEACE.has(b.hostility) && b.hostility !== 'territorial') { b.hostility = 'suspicious'; b.since = s.t; }
  }
  if (['fight', 'arrowHit', 'fireImpact', 'death', 'scream'].includes(h.kind) && b.hostility === 'unaware') { b.hostility = 'suspicious'; b.since = s.t; b.alert = true; }
  if (h.kind !== 'shout' || !h.info) return;
  const info = h.info, speaker = h.speaker?.ai;
  if (info.player && info.pos && b.memory.tell(info.pos, s.t, info.q ?? .7, speaker?.id ?? '?')) { if (b.hostility === 'unaware' || b.hostility === 'suspicious') { b.hostility = ctx.enemyOf(b) ? 'hostile' : b.hostility; b.since = s.t; } }
  if (!speaker || speaker.group !== b.group) return;
  if (info.fled) onEvent(b, 'allyFled', { ally: speaker }, s.t);
  if (info.surrendered) onEvent(b, 'allySurrendered', { ally: speaker }, s.t);
  if (info.leaderDown) onEvent(b, 'leaderDown', {}, s.t);
  if (info.found && info.ally) { onEvent(b, 'allyDied', { ally: info.ally, leader: info.leader }, s.t); b.alertUntil = s.t + 120; b.alert = true; }
  if (info.order === 'search' && info.to === b && info.pos) {
    const go = b.traits.obedience * (1 - b.emotion.fear * .8) > .3;
    if (go) { b.errand = { pos: info.pos.clone(), since: s.t, until: s.t + AI.search.lasts, why: info.why }; b.alert = true; }
    else b.log.push(`${s.t.toFixed(1)} will nicht suchen (Angst ${b.emotion.fear.toFixed(2)})`);
    return;
  }
  if (info.order && (!info.to || info.to === b)) {
    // Orders are only orders: the frightened, the hurt and the disobedient may not follow.
    const obey = b.traits.obedience * (1 - b.emotion.fear * .8) * (1 - b.emotion.pain * .6);
    if (obey > .32) b.orders = { kind: info.order, until: s.t + 9, from: speaker.id };
    else b.log.push(`${s.t.toFixed(1)} ignoriert Befehl ${info.order} (Angst ${b.emotion.fear.toFixed(2)})`);
  }
}

function reasonFor(b, id, s) {
  const e = b.emotion, parts = [];
  if (s.hp < .4) parts.push('LowHealth');
  if (b.memory.has('friendKilled') || b.memory.has('allyKilled')) parts.push('AllyDead');
  if (s.nearMiss) parts.push('ArrowNearMiss');
  if (s.aimed) parts.push('BowAimed');
  if (s.cornered) parts.push('Cornered');
  if (s.fire) parts.push('Fire');
  if (b.orders) parts.push(`Order:${b.orders.kind}`);
  if (id === 'engage') parts.push(b.token ? 'HasSlot' : 'NoSlot');
  if (!s.sees && s.knows) parts.push('PlayerUncertain');
  if (e.fear > .6) parts.push('Afraid');
  return parts.join(' + ') || ({ routine: 'Tagesablauf', watch: 'beobachtet', pressure: 'wartet auf Lücke', shoot: 'freie Schusslinie' }[id] ?? id);
}

/** Reflex against the wanderer's swing: block or step aside after a human reaction time, or too late. */
export function reflex(b, distance) {
  const tr = b.traits, e = b.emotion, skill = b.personality.skill;
  const delay = AI.reflex.fastest + (AI.reflex.slowest - AI.reflex.fastest) * (1 - skill) + e.stress * .08 + e.fatigue * .06 + b.random() * .08;
  const roll = b.random(), canBlock = b.stamina > 12 && !b.disarmed && !b.personality.beast;
  // Mistakes: a nervous novice flinches early and drops the guard before the blow lands.
  if (canBlock && roll < (1 - skill) * .25 * (1 + e.stress)) return { delay: Math.max(.05, delay - .12), kind: 'block', hold: .14 };
  if (canBlock && roll < skill * .7 + tr.caution * .15) return { delay, kind: 'block', hold: .5 };
  if (roll < skill * .7 + tr.caution * .15 + .18 + (b.personality.beast ? .25 : 0)) return { delay, kind: 'dodge', hold: .35 };
  return null;
}

/** What survives a save: the state of yielding/sparing and a few memories. */
export function persistBrain(b) {
  const s = ['pacified', 'grateful', 'surrendered'].includes(b.hostility) ? b.hostility : b.npc.gone ? 'gone' : undefined;
  const m = [...new Set(b.memory.events.map(e => e.kind))].slice(0, 8);
  return { s, sp: b.spared || undefined, rb: b.robbed || undefined, m: m.length ? m : undefined };
}
export function restoreBrain(b, data) {
  if (!data) return;
  if (data.s === 'gone') { b.npc.gone = true; b.npc.calm = true; b.hostility = 'pacified'; }
  else if (data.s) { b.hostility = data.s; b.since = 0; }
  b.spared = !!data.sp; b.robbed = !!data.rb;
  if (b.hostility === 'surrendered') b.disarmed = true;
  for (const kind of data.m || []) b.memory.remember(kind, { restored: true });
}

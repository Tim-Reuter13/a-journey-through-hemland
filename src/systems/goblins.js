import * as THREE from 'three';
import { GOBLIN_KINDS, UKHAI_CALLS, TRIBES } from '../data/goblins/lore.js';

// GOBLINS — the Ukhai of the caves (data/goblins/lore.js). They fight nothing like the bandits on the road:
// nearly blind, they find you by sound (creep and they walk past you; run and the whole hall turns), call to each
// other in Ukhai, come in from the sides and from behind while one keeps your eyes busy, flinch away from fire,
// drag their wounded back into the dark and come again. Plain goblins carry spears (keep their distance, thrust,
// sometimes throw) or daggers (circle, dart in, stab, leap back). The specials each break the rules in their own way,
// like the special infected in Left 4 Dead: the Lauerer stalks in the dark and pounces to pin you down; the
// Sporenbalg spits clouds of spores and bursts when it dies; the Kettenwürger hooks you from afar and drags you to
// him; the Brecher charges and throws rocks and can only be hurt properly from behind or with fire; the Trommler
// drums up more of them. Each tribe's chief leads in its own way. Goblins live in caves (systems/caves.js gives them
// a nav: ground, walls, paths over the cave grid, lines of sight).
const clamp = THREE.MathUtils.clamp, v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const wrap = a => THREE.MathUtils.euclideanModulo(a + Math.PI, Math.PI * 2) - Math.PI;
const pick = list => list[Math.floor(Math.random() * list.length)];

// Per kind: speed (run), reach, damage, windup (s), how close it wants to be (ring), what it prefers.
export const GOBLIN_STATS = {
  speer: { speed: 4.6, reach: 2.7, damage: 11, windup: .55, ring: 2.4, model: 'goblin_', weapon: ['gob_spear_bone', 'gob_spear_stone', 'gob_spear_iron'], style: 'thrust' },
  dolch: { speed: 5.6, reach: 1.7, damage: 8, windup: .32, ring: 1.4, model: 'goblin_', weapon: ['gob_dagger_bone', 'gob_dagger_obsidian', 'gob_dagger_rust'], style: 'stab' },
  schleicher: { speed: 6.2, reach: 1.8, damage: 9, windup: .4, ring: 9, model: 'goblin_schleicher', weapon: [], style: 'stab' },
  speier: { speed: 3, reach: 1.8, damage: 8, windup: .6, ring: 11, model: 'goblin_speier', weapon: [], style: 'stab' },
  wuerger: { speed: 4.2, reach: 1.8, damage: 6, windup: .8, ring: 8, model: 'goblin_wuerger', weapon: ['gob_hook'], style: 'stab' },
  brecher: { speed: 3.6, reach: 3.3, damage: 28, windup: .95, ring: 2.8, model: 'goblin_brecher', weapon: [], style: 'smash' },
  trommler: { speed: 3.8, reach: 1.8, damage: 6, windup: .5, ring: 12, model: 'goblin_trommler', weapon: [], style: 'stab' },
};
const TRIBE_MODEL = { schaedelsaenger: 'goblin_schaedel', pilzmuetter: 'goblin_pilz', kettenbrecher: 'goblin_ketten' };
const CHIEF = {
  schaedelsaenger: { model: 'goblin_vosh', name: 'Vosh der Knochenrufer', hp: 420, kind: 'speer', weapon: 'gob_staff', calls: true },
  pilzmuetter: { model: 'goblin_ghast', name: 'Mutter Ghast', hp: 450, kind: 'speier', weapon: 'gob_dagger_obsidian', heals: true },
  kettenbrecher: { model: 'goblin_ulgrak', name: 'Ulgrak Kettenfaust', hp: 650, kind: 'brecher', weapon: 'gob_flail' },
};
const NAMES = ['Krak', 'Vrish', 'Ghul', 'Skra', 'Tok', 'Ishka', 'Muurg', 'Zhet', 'Drok', 'Rasht', 'Ulk', 'Vesh', 'Graa', 'Nikh', 'Shev', 'Kroth'];
const SCALE = { speer: 1, dolch: .94, schleicher: 1, speier: 1, wuerger: 1, brecher: 1, trommler: 1 };

/**
 * enemies: the shared list (combat and damage treat goblins like any foe); createCharacter/createAnimator/equipItem
 * from the character system; player (position, yaw, stamina…), hurt(amount) and guard() for blows; noise() →
 * { noise, stance } the wanderer is making; sound(kind, at, strength) and bark(model, ukhai, gloss) for voices;
 * effects: { spray(point, dir, kind, n) } for blood and spores; knockDown(dir, force) for a Brecher's charge.
 */
export function createGoblins({ scene, enemies, createCharacter, createAnimator, equipItem, player, hurt, guard = () => false, noise = () => ({ noise: 0, stance: 'still' }),
  sound = () => {}, bark = () => {}, effects = {}, knockDown = () => {}, fireNear = () => false }) {
  const list = [], projectiles = [], clouds = [];
  const projectileRoot = new THREE.Group(); projectileRoot.name = 'goblin projectiles'; scene.add(projectileRoot);
  const chainLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([v3(), v3()]), new THREE.LineBasicMaterial({ color: 0x3a3a3c })); chainLine.visible = false; chainLine.frustumCulled = false; scene.add(chainLine);
  // What has hold of the wanderer: a Lauerer pinning, a Würger's hook dragging. Space breaks free.
  const hold = { by: null, kind: null, struggle: 0, t: 0 };
  let groupAlerts = new Map();

  function spawn(def, nav, { cave = null } = {}) {
    const chief = def.chief ? CHIEF[def.tribe] : null;
    const kind = chief ? chief.kind : def.kind || 'speer', stats = GOBLIN_STATS[kind];
    const modelName = chief ? chief.model : stats.model === 'goblin_' ? TRIBE_MODEL[def.tribe] : stats.model;
    const model = createCharacter(modelName, { scale: SCALE[kind] * (kind === 'dolch' ? .96 + Math.random() * .08 : 1) });
    const weapon = chief ? chief.weapon : stats.weapon.length ? stats.weapon[Math.floor(Math.random() * stats.weapon.length)] : null;
    if (weapon) equipItem(model, weapon);
    model.position.copy(def.at); model.rotation.y = def.facing ?? Math.random() * Math.PI * 2;
    scene.add(model);
    const name = chief ? chief.name : `${NAMES[Math.floor(Math.random() * NAMES.length)]}, ${GOBLIN_KINDS[kind].name}`;
    const hp = chief ? chief.hp : GOBLIN_KINDS[kind].hp;
    const e = { kind: 'goblin', goblin: true, gkind: kind, tribe: def.tribe, chief: !!chief, name, hp, maxHp: hp, model, animator: createAnimator(model), calm: false, dead: false,
      home: def.at.clone(), group: def.group || 'g', state: def.state === 'patrol' ? 'patrol' : 'idle', rest: def.state || 'guard', patrol: def.patrol || null, patrolIndex: 0,
      suspicion: 0, alert: 0, cooldown: 1 + Math.random(), windup: 0, windupTotal: 0, strikeT: 0, stagger: 0, nav, cave, path: null, pathAt: 0, slot: Math.random() * Math.PI * 2,
      ranged: kind === 'speer' && Math.random() < .45, special: { t: 0, phase: null }, said: {}, stride: 1.5 * SCALE[kind] * (kind === 'brecher' ? 1.6 : kind === 'schleicher' ? 1.15 : 1),
      drive: null, goblinPose: def.state === 'sleep' ? 'sleep' : def.state === 'sit' ? 'sit' : def.state === 'pray' ? 'pray' : def.state === 'work' ? 'work_farm' : def.state === 'ambush' ? 'sneak' : null };
    e.drive = (self, dt, distance, dx, dz) => think(self, dt, distance, dx, dz);
    if (chief) Object.assign(e, { calls: !!chief.calls, heals: !!chief.heals });
    enemies.push(e); list.push(e);
    return e;
  }
  function despawn(filter = () => true) {
    for (const e of [...list]) if (filter(e)) {
      e.model.removeFromParent(); e.ragdoll?.dispose?.(); e.ragdoll = null;
      const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1);
      list.splice(list.indexOf(e), 1);
      if (hold.by === e) release();
    }
  }

  // ── Voices.
  function call(e, kind, chance = 1, every = 4) {
    const now = performance.now() / 1000;
    if (Math.random() > chance || (e.said[kind] || 0) > now) return;
    e.said[kind] = now + every + Math.random() * every;
    const [ukhai, gloss] = pick(UKHAI_CALLS[kind]);
    bark(e.model, ukhai, gloss);
    sound(kind === 'death' ? 'death' : kind === 'spot' || kind === 'rally' ? 'shriek' : 'chatter', e.model.position, 1);
  }
  /** Every goblin of a group within earshot comes, after a moment for the call to travel. */
  function alertGroup(e, delay = .5) {
    for (const o of list) if (o !== e && !o.dead && o.state !== 'fight' && o.cave === e.cave && o.model.position.distanceTo(e.model.position) < (o.group === e.group ? 30 : 16))
      o.wakeIn = Math.min(o.wakeIn ?? 99, delay + o.model.position.distanceTo(e.model.position) * .04 + Math.random() * .4);
  }
  function engage(e) { if (e.state === 'fight') return; e.state = 'fight'; e.goblinPose = null; e.suspicion = 1; call(e, 'spot', .8); alertGroup(e); }

  // ── Moving through the cave: follow a path over the cave grid toward a goal, slide along walls.
  const _goal = v3(), _wp = v3();
  function moveToward(e, goal, speed, dt, { face = null } = {}) {
    const p = e.model.position, now = performance.now();
    if (!e.path || now > e.pathAt || e.pathGoal?.distanceToSquared(goal) > 4) {
      e.path = e.nav.path(p, goal); e.pathAt = now + 700 + Math.random() * 400; (e.pathGoal ??= v3()).copy(goal);
    }
    let target = goal;
    if (e.path && e.path.length) {
      while (e.path.length > 1 && Math.hypot(e.path[0].x - p.x, e.path[0].z - p.z) < .7) e.path.shift();
      target = e.path[0];
    }
    const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
    if (d > .05) step(e, dx / d * Math.min(d, speed * dt), dz / d * Math.min(d, speed * dt));
    const look = face || (d > .05 ? _wp.set(p.x + dx, p.y, p.z + dz) : null);
    if (look) turn(e, look, dt);
    return d;
  }
  function step(e, sx, sz) {
    const p = e.model.position, r = e.gkind === 'brecher' ? .7 : .38;
    for (const [mx, mz] of [[sx, sz], [sx, 0], [0, sz]]) {
      const x = p.x + mx, z = p.z + mz, y = e.nav.ground(x, z, p.y);
      if (y !== null && Math.abs(y - p.y) < .9 && e.nav.free(x, z, y, r)) { p.x = x; p.z = z; p.y = y; return true; }
    }
    return false;
  }
  function turn(e, at, dt, rate = 7) {
    const p = e.model.position, want = Math.atan2(p.x - at.x, p.z - at.z);
    e.model.rotation.y += clamp(wrap(want - e.model.rotation.y), -rate * dt, rate * dt);
  }
  const facing = (e, to) => Math.abs(wrap(Math.atan2(e.model.position.x - to.x, e.model.position.z - to.z) - e.model.rotation.y));

  // ── A blow at the wanderer: blocked if their guard faces it, otherwise it lands.
  function blow(e, damage, reach) {
    const p = e.model.position, d = Math.hypot(player.position.x - p.x, player.position.z - p.z);
    if (d > reach || Math.abs(player.position.y - p.y) > 2.2 || !e.nav.los(p, player.position)) return false;
    const toward = Math.atan2(player.position.x - p.x, player.position.z - p.z), facingIt = Math.abs(wrap(toward + Math.PI - player.yaw - Math.PI)) < 1.1;
    if (guard() && facingIt && player.stamina >= 8) { player.stamina -= damage > 20 ? 25 : 8; sound('block', p, 1); effects.spray?.(player.position.clone().add(v3(0, 1.4, 0)), v3(0, 1, 0), 'ember', 8); return 'blocked'; }
    hurt(damage); sound('hit', p, 1); effects.spray?.(player.position.clone().add(v3(0, 1.4, 0)), v3(player.position.x - p.x, 0, player.position.z - p.z).normalize(), 'blood', 12);
    return true;
  }

  // ── The mind of one goblin, each simulation step (called by combat for every living foe).
  const _to = v3(), _slot = v3();
  function think(e, dt, distance) {
    const p = e.model.position, stats = GOBLIN_STATS[e.gkind], pp = player.position, sameLevel = Math.abs(pp.y - p.y) < 3.5;
    e.special.t += dt;
    if (hold.by === e) { holding(e, dt); return; }
    // Hearing: the louder you move and the closer you are, the faster they turn; light and fire are seen far.
    if (e.state !== 'fight') {
      if (e.wakeIn !== undefined && (e.wakeIn -= dt) <= 0) { e.wakeIn = undefined; engage(e); return; }
      const heard = noise(), loud = heard.noise || 0, asleep = e.goblinPose === 'sleep' ? .35 : 1;
      const near = distance < 2.4 && sameLevel, lit = fireNear(p, 16);
      if (sameLevel && distance < 26) e.suspicion += dt * asleep * (loud * 2.2 / Math.max(2, distance) + (near ? 1.4 : 0) + (lit ? 1.6 : 0) + (distance < 6 && facing(e, pp) < 1 ? .5 : 0));
      e.suspicion = Math.max(0, e.suspicion - dt * .08);
      if (e.suspicion > .45 && !e.listening) { e.listening = true; e.goblinPose = null; call(e, 'spot', .35, 8); }
      if (e.listening) turn(e, pp, dt, 2.5);
      if (e.suspicion >= 1) { engage(e); return; }
      if (e.state === 'patrol' && e.patrol?.length) {
        const goal = e.patrol[e.patrolIndex % e.patrol.length];
        if (moveToward(e, goal, 1.3, dt) < .6) e.patrolIndex++;
      }
      if (Math.random() < dt * .02) call(e, 'idle', .5, 20);
      return;
    }
    if (!sameLevel && distance < 8) { moveToward(e, pp, stats.speed, dt); return; }
    // Wounded: back into the dark to the others, then again.
    if (!e.chief && e.gkind !== 'brecher' && e.hp < e.maxHp * .28 && e.state !== 'flee' && Math.random() < .6) { e.state = 'flee'; e.fleeT = 6; call(e, 'retreat'); }
    if (e.state === 'flee') {
      e.fleeT -= dt;
      _to.copy(p).sub(pp).setY(0).normalize().multiplyScalar(14).add(p);
      moveToward(e, _to, stats.speed * 1.1, dt);
      if (e.fleeT <= 0) { e.state = 'fight'; call(e, 'rally', .7); }
      return;
    }
    // Fire in the wanderer's hand: keep away from the front, come round the back.
    const fire = fireNear(p, 6);
    if (fire) call(e, 'fire', .9, 6);
    switch (e.gkind) {
      case 'schleicher': return lurk(e, dt, distance, stats);
      case 'speier': return spitter(e, dt, distance, stats);
      case 'wuerger': return strangler(e, dt, distance, stats);
      case 'brecher': return brute(e, dt, distance, stats);
      case 'trommler': return drummer(e, dt, distance, stats);
      default: return fighter(e, dt, distance, stats, fire);
    }
  }

  // Plain fighters: take a place in a ring round the wanderer — the free places behind them first — step in,
  // strike, step back. Spearmen keep further out and sometimes throw; dagger-goblins dart in from the sides.
  function fighter(e, dt, distance, stats, fire) {
    const p = e.model.position, pp = player.position;
    if (e.windup > 0) { turn(e, pp, dt, 9); e.windup -= dt; if (e.windup <= 0) strikeNow(e, stats); return; }
    if (e.ranged && e.cooldown <= 0 && distance > 6 && distance < 15 && e.nav.los(p.clone().setY(p.y + 1.2), pp.clone().setY(pp.y + 1.4))) {
      e.ranged = false; throwSpear(e); e.cooldown = 1.5; return;
    }
    // A place in the ring: behind the wanderer is the prize; with fire in their hand, nobody stands in front.
    const others = list.filter(o => o !== e && !o.dead && o.state === 'fight' && o.cave === e.cave);
    const back = player.yaw + Math.PI, mine = e.slot + (others.indexOf(e) + 1) * .9;
    const angle = fire ? back + Math.sin(mine) * 1.2 : back + Math.sin(mine) * (e.gkind === 'dolch' ? 1.6 : 2.4);
    const ring = (fire ? 4.2 : stats.ring) + (e.cooldown > 0 ? 1.4 : 0);
    _slot.set(pp.x - Math.sin(angle) * ring, pp.y, pp.z - Math.cos(angle) * ring);
    if (e.cooldown <= 0 && distance < stats.reach + .6 && !fire) {
      e.windup = e.windupTotal = stats.windup * (.85 + Math.random() * .3); e.style = stats.style; return;
    }
    if (e.cooldown <= 0 && distance < stats.reach + 4 && !fire) { moveToward(e, pp, stats.speed, dt, { face: pp }); return; }
    if (Math.abs(wrap(angle - player.yaw - Math.PI)) < .9 && Math.random() < dt * .3) call(e, 'flank', .5, 5);
    moveToward(e, _slot, stats.speed * (e.cooldown > 0 ? .8 : 1), dt, { face: pp });
  }
  // A thrust carries the body with it: the goblin lunges in as it strikes, so a wind-up begun at the edge of its reach
  // still lands, and stepping back during the wind-up is how you make it miss.
  function lunge(e, most) {
    const p = e.model.position, pp = player.position, d = Math.hypot(pp.x - p.x, pp.z - p.z), ux = (pp.x - p.x) / (d || 1), uz = (pp.z - p.z) / (d || 1);
    for (let left = Math.min(most, d - .9); left > 0; left -= .2) if (!step(e, ux * Math.min(.2, left), uz * Math.min(.2, left))) break;
  }
  function strikeNow(e, stats) {
    lunge(e, e.gkind === 'dolch' ? .9 : 1.1);
    e.strikeT = .35; const hit = blow(e, stats.damage * (e.frenzy ? 1.3 : 1), stats.reach);
    if (hit === true) call(e, 'attack', .3, 3);
    // Strike and away: a dagger-goblin leaps back out of reach.
    e.cooldown = (e.gkind === 'dolch' ? .9 : 1.5) + Math.random() * 1.2;
    if (e.gkind === 'dolch') e.cooldown *= e.frenzy ? .6 : 1;
  }

  // ── Lauerer: stalks at the edge of sight, crouched; then a long leap. If it lands on you it pins you down.
  function lurk(e, dt, distance, stats) {
    const p = e.model.position, pp = player.position, s = e.special;
    if (s.phase === 'leap') {
      s.t2 += dt; const k = Math.min(1, s.t2 / s.dur);
      p.lerpVectors(s.from, s.to, k); p.y += Math.sin(Math.PI * k) * 1.6; e.goblinPose = null;
      if (k >= 1) {
        s.phase = null; e.cooldown = 3;
        if (p.distanceTo(pp) < 1.6 && !hold.by) pin(e, 'pin'); else { e.stagger = .6; sound('land', p, .6); }
      }
      return;
    }
    if (s.phase === 'crouch') { turn(e, pp, dt, 9); e.goblinPose = 'sneak'; if ((s.t2 += dt) > .7) { s.phase = 'leap'; s.t2 = 0; s.from = p.clone(); s.to = pp.clone(); s.dur = Math.max(.35, distance / 14); sound('shriek', p, 1); } return; }
    if (e.cooldown <= 0 && distance > 3 && distance < 11 && e.nav.los(p.clone().setY(p.y + 1), pp.clone().setY(pp.y + 1))) { s.phase = 'crouch'; s.t2 = 0; return; }
    if (e.cooldown <= 0 && distance < 2) { e.windup = e.windupTotal = stats.windup; e.style = 'stab'; return; }
    if (e.windup > 0) { e.windup -= dt; if (e.windup <= 0) strikeNow(e, stats); return; }
    e.goblinPose = 'sneak';
    const angle = player.yaw + Math.PI + Math.sin(e.special.t * .4 + e.slot) * 1.8;
    _slot.set(pp.x - Math.sin(angle) * 9, pp.y, pp.z - Math.cos(angle) * 9);
    moveToward(e, _slot, stats.speed * .7, dt, { face: pp });
  }

  // ── Sporenbalg: keeps its distance, spits arcs of spores that leave a poisonous cloud; bursts when it dies.
  function spitter(e, dt, distance, stats) {
    const p = e.model.position, pp = player.position;
    if (e.windup > 0) { turn(e, pp, dt, 6); e.windup -= dt; if (e.windup <= 0) { spit(e); e.cooldown = 3.2 + Math.random() * 1.5; } return; }
    if (e.cooldown <= 0 && distance > 4 && distance < 18 && e.nav.los(p.clone().setY(p.y + 1.4), pp.clone().setY(pp.y + 1.4))) { e.windup = e.windupTotal = .7; e.style = 'smash'; sound('gurgle', p, 1); return; }
    if (e.heals && e.special.t > 5) { e.special.t = 0; healAllies(e); }
    const away = distance < 8 ? -1 : distance > 14 ? 1 : 0;
    _to.set(p.x + (pp.x - p.x) / Math.max(.1, distance) * away * 4, p.y, p.z + (pp.z - p.z) / Math.max(.1, distance) * away * 4);
    if (away) moveToward(e, _to, stats.speed, dt, { face: pp }); else turn(e, pp, dt, 4);
  }

  // ── Kettenwürger: throws a hooked chain; if it bites, it drags you to him and strangles you.
  function strangler(e, dt, distance, stats) {
    const p = e.model.position, pp = player.position, s = e.special;
    if (e.windup > 0) { turn(e, pp, dt, 6); e.windup -= dt; if (e.windup <= 0) hook(e); return; }
    if (e.cooldown <= 0 && distance > 3.5 && distance < 13 && !hold.by && e.nav.los(p.clone().setY(p.y + 1.3), pp.clone().setY(pp.y + 1.3))) { e.windup = e.windupTotal = stats.windup; e.style = 'smash'; sound('chain', p, 1); return; }
    _slot.set(pp.x - Math.sin(e.slot) * 8, pp.y, pp.z - Math.cos(e.slot) * 8);
    if (s.t > 4) { s.t = 0; e.slot += 1.2; }
    moveToward(e, _slot, stats.speed, dt, { face: pp });
  }

  // ── Brecher: a charge in a straight line (into a wall it stuns itself), a smash up close, rocks from afar.
  function brute(e, dt, distance, stats) {
    const p = e.model.position, pp = player.position, s = e.special;
    if (s.phase === 'stunned') { e.goblinPose = 'slump'; if ((s.t2 += dt) > 2.4) { s.phase = null; e.goblinPose = null; } return; }
    if (s.phase === 'roar') { turn(e, pp, dt, 5); if ((s.t2 += dt) > .8) { s.phase = 'charge'; s.t2 = 0; s.dir = v3(pp.x - p.x, 0, pp.z - p.z).normalize(); sound('roar', p, 1); } return; }
    if (s.phase === 'charge') {
      s.t2 += dt;
      const moved = step(e, s.dir.x * 11 * dt, s.dir.z * 11 * dt);
      e.model.rotation.y = Math.atan2(-s.dir.x, -s.dir.z);
      if (p.distanceTo(pp) < 1.8 && Math.abs(pp.y - p.y) < 2) { s.phase = null; e.cooldown = 2.2; hurt(stats.damage); knockDown(s.dir, 3); sound('hit', p, 1.2); effects.spray?.(pp.clone().add(v3(0, 1.4, 0)), s.dir, 'blood', 20); return; }
      if (!moved) { s.phase = 'stunned'; s.t2 = 0; sound('crash', p, 1.2); effects.spray?.(p.clone().add(v3(0, 1.6, 0)).addScaledVector(s.dir, 1), s.dir.clone().negate(), 'dust', 18); return; }
      if (s.t2 > 1.6) { s.phase = null; e.cooldown = 1.2; }
      return;
    }
    if (e.windup > 0) { turn(e, pp, dt, 3); e.windup -= dt; if (e.windup <= 0) { e.strikeT = .45; blow(e, stats.damage, stats.reach); e.cooldown = 2 + Math.random(); } return; }
    if (e.cooldown <= 0 && distance > 6 && distance < 16 && e.nav.los(p.clone().setY(p.y + 1.5), pp.clone().setY(pp.y + 1.5))) {
      if (Math.random() < .55) { s.phase = 'roar'; s.t2 = 0; call(e, 'attack', 1, 2); } else { throwRock(e); e.cooldown = 2.8; }
      return;
    }
    if (e.cooldown <= 0 && distance < stats.reach) { e.windup = e.windupTotal = stats.windup; e.style = 'smash'; return; }
    moveToward(e, pp, stats.speed, dt, { face: pp });
  }

  // ── Trommler: stays back and drums; every few beats more of them come out of the dark. Kill it first.
  function drummer(e, dt, distance, stats) {
    const p = e.model.position, pp = player.position, s = e.special;
    if (distance < 2.5) { e.goblinPose = null; return fighter(e, dt, distance, stats, false); }
    e.goblinPose = 'work_hammer';
    turn(e, pp, dt, 3);
    s.beat = (s.beat || 0) + dt;
    if (s.beat > .55) { s.beat = 0; sound('drum', p, 1); }
    if (s.t > 7 && (e.summoned || 0) < (e.calls ? 8 : 6)) { s.t = 0; e.summoned = (e.summoned || 0) + summon?.(e, e.calls ? 3 : 2) || 0; call(e, 'rally', 1, 3); for (const o of list) if (o.cave === e.cave && !o.dead && o.model.position.distanceTo(p) < 15) o.frenzy = true; }
    if (distance < 7) { _to.copy(p).sub(pp).setY(0).normalize().multiplyScalar(5).add(p); moveToward(e, _to, stats.speed, dt, { face: pp }); }
  }
  let summon = null;

  // ── Projectiles and their marks: thrown spears, spore globs, rocks, the hook.
  function launch(e, kind, speed, arc, { mesh, onHit }) {
    const from = e.model.position.clone().add(v3(0, 1.3 * e.model.scale.y, 0)), to = player.position.clone().add(v3(0, 1.2, 0));
    const flat = Math.hypot(to.x - from.x, to.z - from.z), t = flat / speed;
    const vel = v3((to.x - from.x) / t, (to.y - from.y) / t + 9 * t * arc, (to.z - from.z) / t);
    mesh.position.copy(from); projectileRoot.add(mesh);
    projectiles.push({ kind, mesh, vel, life: 3, gravity: 18 * arc, onHit, owner: e });
  }
  function boxMesh(w, h, d, color) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color })); }
  function throwSpear(e) { e.strikeT = .3; sound('throw', e.model.position, 1); launch(e, 'spear', 16, .5, { mesh: boxMesh(.07, .07, 1.5, 0x6a5038), onHit: () => { hurt(14); sound('hit', player.position, 1); } }); }
  function throwRock(e) { e.strikeT = .45; sound('throw', e.model.position, 1.2); launch(e, 'rock', 13, 1, { mesh: boxMesh(.6, .5, .55, 0x6b6660), onHit: () => { hurt(18); sound('hit', player.position, 1.2); } }); }
  function spit(e) {
    sound('spit', e.model.position, 1);
    launch(e, 'spore', 11, 1.2, { mesh: boxMesh(.35, .35, .35, 0xb8d660), onHit: at => cloud(at, 3.2, 6) });
  }
  function hook(e) {
    sound('chain', e.model.position, 1.2);
    launch(e, 'hook', 20, .15, { mesh: boxMesh(.25, .25, .25, 0x3a3a3c), onHit: () => pin(e, 'hook') });
  }
  /** A cloud of spores where a glob lands or a Sporenbalg bursts: it hurts to stand in it. */
  function cloud(at, radius, life) {
    clouds.push({ at: at.clone(), radius, life, t: 0 });
    for (let i = 0; i < 26; i++) effects.spray?.(at.clone().add(v3((Math.random() - .5) * radius, Math.random() * 1.5, (Math.random() - .5) * radius)), v3(0, .4, 0), 'spore', 2);
    sound('burst', at, 1);
  }
  function healAllies(e) {
    for (const o of list) if (o !== e && !o.dead && o.cave === e.cave && o.hp < o.maxHp && o.model.position.distanceTo(e.model.position) < 14) {
      o.hp = Math.min(o.maxHp, o.hp + 25); effects.spray?.(o.model.position.clone().add(v3(0, 1.2, 0)), v3(0, 1, 0), 'heal', 8);
    }
    sound('gurgle', e.model.position, .8);
  }

  // ── Held: pinned by a Lauerer or dragged by a Würger. Space (several times) breaks free; a blow on it too.
  function pin(e, kind) {
    if (hold.by) return;
    Object.assign(hold, { by: e, kind, struggle: 0, t: 0 });
    if (kind === 'pin') { knockDown(v3(player.position.x - e.model.position.x, 0, player.position.z - e.model.position.z).normalize(), 1.2); sound('shriek', e.model.position, 1.2); }
    call(e, 'attack', 1, 1);
  }
  function release(stun = 0) {
    const e = hold.by; if (!e) return;
    hold.by = null; hold.kind = null; chainLine.visible = false;
    if (stun) { e.stagger = stun; e.cooldown = 3; }
  }
  function holding(e, dt) {
    hold.t += dt;
    const p = e.model.position, pp = player.position;
    if (hold.kind === 'pin') {
      // On top of you, clawing.
      p.lerp(_to.copy(pp).add(v3(Math.sin(player.yaw) * .4, 0, Math.cos(player.yaw) * .4)), Math.min(1, dt * 10)); e.goblinPose = 'kneel';
      if ((e.special.claw = (e.special.claw || 0) - dt) <= 0) { e.special.claw = .55; hurt(5); e.strikeT = .3; sound('hit', pp, .7); effects.spray?.(pp.clone().add(v3(0, .5, 0)), v3(0, 1, 0), 'blood', 6); }
    } else {
      // Reeled in on the chain, then held by the throat.
      const d = Math.hypot(pp.x - p.x, pp.z - p.z);
      if (d > 1.4) { const k = Math.min(d - 1.4, 4.5 * dt) / d; pp.x -= (pp.x - p.x) * k; pp.z -= (pp.z - p.z) * k; }
      else if ((e.special.claw = (e.special.claw || 0) - dt) <= 0) { e.special.claw = .7; hurt(4); sound('choke', pp, .8); }
      turn(e, pp, dt, 8);
      chainLine.visible = true; chainLine.geometry.setFromPoints([p.clone().add(v3(0, 1.2, 0)), pp.clone().add(v3(0, 1.4, 0))]);
    }
    if (e.dead || hold.t > 12) release(.8);
  }

  // ── Per step: projectiles, clouds, held state. struggle(): a press of Space against whoever holds you.
  function update(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pr = projectiles[i]; pr.life -= dt;
      pr.vel.y -= pr.gravity * dt; pr.mesh.position.addScaledVector(pr.vel, dt);
      pr.mesh.lookAt(_to.copy(pr.mesh.position).add(pr.vel));
      const ground = pr.owner.nav.ground(pr.mesh.position.x, pr.mesh.position.z, pr.mesh.position.y + 1);
      const hitPlayer = pr.mesh.position.distanceTo(_wp.copy(player.position).add(v3(0, 1.1, 0))) < (pr.kind === 'rock' ? 1.1 : .8);
      const hitWall = !pr.owner.nav.free(pr.mesh.position.x, pr.mesh.position.z, pr.mesh.position.y - .2, .05) || ground !== null && pr.mesh.position.y < ground;
      if (hitPlayer || hitWall || pr.life <= 0) {
        if (hitPlayer && pr.kind !== 'spore') pr.onHit(pr.mesh.position);
        if (pr.kind === 'spore') pr.onHit(pr.mesh.position.clone().setY(ground ?? pr.mesh.position.y));
        if (pr.kind === 'hook' && !hitPlayer) chainLine.visible = false;
        pr.mesh.removeFromParent(); projectiles.splice(i, 1);
      }
    }
    for (let i = clouds.length - 1; i >= 0; i--) {
      const c = clouds[i]; c.t += dt;
      if (c.t > c.life) { clouds.splice(i, 1); continue; }
      if (Math.random() < dt * 14) effects.spray?.(c.at.clone().add(v3((Math.random() - .5) * c.radius * 1.6, Math.random() * 1.2, (Math.random() - .5) * c.radius * 1.6)), v3(0, .3, 0), 'spore', 1);
      if (player.position.distanceTo(c.at) < c.radius && (c.tick = (c.tick || 0) - dt) <= 0) { c.tick = .5; hurt(3); }
    }
    for (const e of list) if (!e.dead && e.frenzy && e.state !== 'fight') e.frenzy = false;
  }
  function struggle() {
    if (!hold.by) return false;
    hold.struggle++;
    if (hold.struggle >= (hold.kind === 'pin' ? 4 : 3)) { release(1.2); return 'free'; }
    return 'struggle';
  }
  /** A goblin was struck: it may let go of you, and the others hear it. */
  function struck(e) {
    if (hold.by === e) release(1);
    if (e.state !== 'fight') engage(e);
  }
  function died(e) {
    if (hold.by === e) release();
    call(e, 'death', .9, 1);
    if (e.gkind === 'speier') cloud(e.model.position.clone(), 3.6, 7);
    for (const o of list) if (o !== e && !o.dead && o.cave === e.cave && o.model.position.distanceTo(e.model.position) < 18 && o.state !== 'fight') engage(o);
  }
  /** Damage on this goblin is scaled: a Brecher only really feels blows from behind or fire. */
  function damageScale(e, { magic = false, from = null } = {}) {
    if (e.gkind !== 'brecher') return magic ? 1.25 : 1;
    if (magic) return 1.4;
    if (e.special.phase === 'stunned') return 1.6;
    if (!from) return .45;
    const behind = facing(e, from) > 2;
    return behind ? 1.5 : .4;
  }
  /** What the HUD says about the nearest goblin. */
  function intent(e) {
    if (hold.by === e) return hold.kind === 'pin' ? 'HÄLT DICH NIEDER · LEERTASTE MEHRMALS ODER ZUSCHLAGEN' : 'HAT DICH AM HAKEN · LEERTASTE MEHRMALS';
    if (e.gkind === 'schleicher' && e.special.phase === 'crouch') return 'SPRINGT GLEICH · AUSWEICHEN';
    if (e.gkind === 'brecher' && e.special.phase === 'roar') return 'STÜRMT GLEICH · ZUR SEITE';
    if (e.gkind === 'brecher' && e.special.phase === 'stunned') return 'BENOMMEN · JETZT ZUSCHLAGEN';
    if (e.gkind === 'brecher') return 'NUR VON HINTEN ODER MIT FEUER VERWUNDBAR';
    if (e.gkind === 'trommler') return 'TROMMELT VERSTÄRKUNG HERBEI · ZUERST TÖTEN';
    if (e.gkind === 'speier') return e.windup > 0 ? 'SPUCKT SPOREN · AUS DER WOLKE' : 'PLATZT IM TOD · AUS DER FERNE TÖTEN';
    if (e.gkind === 'wuerger') return e.windup > 0 ? 'WIRFT DIE KETTE · DECKUNG' : 'ZIEHT DICH MIT DER KETTE HERAN';
    if (e.state !== 'fight') return e.suspicion > .4 ? 'LAUSCHT · LEISE BLEIBEN' : 'BEMERKT DICH NICHT';
    return e.windup > 0 ? 'STICHT ZU · BLOCKEN' : null;
  }

  return { list, spawn, despawn, update, struggle, struck, died, damageScale, intent, setSummon: fn => { summon = fn; }, get held() { return hold.by ? hold.kind : null; }, get holder() { return hold.by; },
    clouds: () => clouds, tribes: TRIBES };
}

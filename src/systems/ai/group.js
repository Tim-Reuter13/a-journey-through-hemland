import { AI } from './config.js';

// Layer G — groups. No hive mind: a group only shares a leader, attack opportunities and what is
// shouted. Melee fighters compete for a soft number of attack slots (one, two when a disciplined
// leader coordinates three or more), scored by nerve, closeness and a free angle of approach; the
// rest press, circle and feint. A leader hands out orders by shouting them — they reach only those
// who hear them, and the frightened may ignore them. When the leader falls, coordination breaks
// until someone steady takes over.

const TAU = Math.PI * 2;
const angleTo = (b, target) => Math.atan2(b.npc.model.position.x - target.x, b.npc.model.position.z - target.z);
const gap = (x, y) => Math.abs(((x - y + Math.PI) % TAU + TAU) % TAU - Math.PI);

export function createGroups() {
  const groups = new Map();
  function of(id) {
    if (!groups.has(id)) groups.set(id, { id, members: [], leader: null, leaderLostAt: -1, nextOrder: 0, coordination: .2, start: 0, retreating: false, missing: [], nextSearch: 0, contact: -1e9 });
    return groups.get(id);
  }
  function add(brain) {
    const g = of(brain.group);
    // Relationships inside the group: some are friends, some rivals, most indifferent.
    for (const other of g.members) {
      const r = (brain.random() + other.random()) / 2, rel = r < .2 ? -.5 : r > .72 ? .7 : 0;
      brain.rel.set(other, rel); other.rel.set(brain, rel);
    }
    g.members.push(brain); g.start += brain.npc.maxHp;
    if (brain.personality.leads && !g.leader) g.leader = brain;
    return g;
  }
  function remove(brain) {
    const g = groups.get(brain.group); if (!g) return;
    g.members = g.members.filter(b => b !== brain);
    for (const o of g.members) o.rel.delete(brain);
    if (!g.members.length) groups.delete(brain.group);
  }
  const living = g => g.members.filter(b => !b.npc.dead);
  const allies = brain => (groups.get(brain.group)?.members || []).filter(b => b !== brain && !b.npc.dead);

  /** Group tick: leadership, slots, orders. ctx: { time, player, shout(b, line, info, cooldown) } */
  function update(ctx) {
    const t = ctx.time, target = ctx.player.position;
    for (const g of groups.values()) {
      const alive = living(g);
      // Leadership: lost when the leader dies (or flees, or yields); after a while a steady veteran may take over.
      if (g.leader && (g.leader.npc.dead || ['fleeing', 'surrendered', 'pacified'].includes(g.leader.hostility))) {
        g.leader = null; g.leaderLostAt = t;
      }
      if (!g.leader && g.leaderLostAt >= 0 && t - g.leaderLostAt > 3.5) {
        const heir = alive.filter(b => b.hostility === 'hostile' && b.traits.experience > .55 && b.traits.discipline > .5 && b.emotion.fear < .5)
          .sort((a, b) => (b.traits.discipline + b.traits.confidence) - (a.traits.discipline + a.traits.confidence))[0];
        if (heir) { g.leader = heir; g.leaderLostAt = -1; ctx.shout(heir, 'takeCommand', {}, 0); }
      }
      g.coordination = g.leader ? .45 + g.leader.traits.discipline * .45 : .2;
      const fighters = alive.filter(b => b.hostility === 'hostile' && b.memory.knows(t) && !(b.personality.ranged && b.arrows > 0)
        && !['flee', 'retreat', 'cover', 'recover', 'evade'].includes(b.action.id));
      const max = AI.slots.base + (g.coordination > .6 && fighters.length >= 3 ? AI.slots.coordinated - AI.slots.base : 0);
      // Release slots held too long, or by those no longer fighting.
      for (const b of alive) if (b.token && (!fighters.includes(b) || t - b.tokenSince > AI.slots.hold + b.traits.aggression * 1.5) && !b.strikeBack) { b.token = false; b.tokenCooldown = t + 1 + b.random(); }
      let held = fighters.filter(b => b.token).length;
      const taken = fighters.filter(b => b.token).map(b => angleTo(b, target));
      const candidates = fighters.filter(b => !b.token && t > b.tokenCooldown).map(b => {
        const d = b.npc.model.position.distanceTo(target), ang = angleTo(b, target);
        const free = taken.length ? Math.min(...taken.map(a => gap(a, ang))) / Math.PI : 1;
        const score = b.traits.aggression * .35 + b.traits.courage * .25 + b.emotion.confidence * .15 - b.emotion.fear * .45
          + Math.max(0, 1 - d / 12) * .35 + free * .2 + (b.flanked ? .3 : 0) + (b.vengeful ? .2 : 0);
        return { b, score };
      }).sort((x, y) => y.score - x.score);
      for (const { b } of candidates) {
        if (held < max) { b.token = true; b.tokenSince = t; held++; taken.push(angleTo(b, target)); continue; }
        // The undisciplined hothead rushes in anyway (and may get in a friend's way).
        if (b.traits.aggression > AI.slots.steal && b.traits.discipline < .35 && b.random() < .08) { b.token = true; b.tokenSince = t; b.action.reason = 'prescht ungeplant vor'; }
      }
      searchParties(g, alive, ctx);
      // Orders from a leader who knows where the wanderer is.
      const L = g.leader;
      if (L && !L.npc.dead && L.memory.knows(t) && t > g.nextOrder) {
        const strength = alive.reduce((s, b) => s + b.npc.hp, 0) / Math.max(1, g.start);
        if (strength < .35 && L.traits.discipline > .55 && alive.length > 1 && !g.retreating) {
          g.retreating = true; ctx.shout(L, 'orderRetreat', { order: 'retreat' }, 0);
        } else if (fighters.length >= 2) {
          const flanker = fighters.filter(b => b !== L && !b.token).sort((a, b) => b.traits.cunning - a.traits.cunning)[0];
          if (flanker) ctx.shout(L, 'orderFlank', { order: 'flank', to: flanker }, 0);
        }
        g.nextOrder = t + 6 + L.random() * 3;
      }
    }
  }
  // Search parties (layer G/H). Someone who leads sends one or two out — after the wanderer when the
  // trail goes cold, or after a comrade who did not come back. The order is shouted: only those who
  // hear it go, the frightened may refuse; the rest keep watch.
  function searchParties(g, alive, ctx) {
    const t = ctx.time, chief = g.leader && !g.leader.npc.dead ? g.leader : alive.find(b => !b.asleep && b.hostility !== 'fleeing') ?? null;
    // Last real contact: someone saw the wanderer (now, or when their belief was formed by sight).
    for (const b of alive) if (b.sees) g.contact = t; else if (b.memory.player.source === 'sight') g.contact = Math.max(g.contact, b.memory.player.t);
    if (!chief || alive.length < 2 || t < g.nextSearch) return;
    const send = (pos, why) => {
      const pool = alive.filter(b => b !== chief && !b.errand && !b.asleep && !['surrendered', 'fleeing', 'pacified'].includes(b.hostility) && !b.npc.gone)
        .sort((a, b) => (b.traits.courage + b.traits.obedience) - (a.traits.courage + a.traits.obedience));
      if (!pool.length) return false;
      for (const b of pool.slice(0, Math.min(2, alive.length - 1))) ctx.shout(chief, 'orderSearch', { order: 'search', to: b, pos: pos.clone(), why, player: false }, 0);
      g.nextSearch = t + AI.search.every;
      return true;
    };
    // A comrade missing: noticed after a while, by someone awake who is not fighting.
    const m = g.missing.find(x => !x.noticed && t - x.t > AI.search.missingAfter);
    if (m && !chief.sees) { m.noticed = true; ctx.say(chief, 'missing', 0, { name: m.name }); send(m.at, `vermisst: ${m.name}`); return; }
    // The trail went cold: everyone lost the wanderer a while ago, but not long ago.
    const lost = t - g.contact;
    if (lost > AI.search.after && lost < 90 && !alive.some(b => b.sees) && alive.some(b => b.hostility === 'searching' || b.hostility === 'hostile')) {
      const best = alive.map(b => b.memory.player).sort((a, b) => b.t - a.t)[0];
      if (best && best.t > -1e8) send(best.pos, 'Spur verloren');
    }
  }
  return { of, add, remove, allies, update, groups, leaderOf: id => groups.get(id)?.leader ?? null, living: id => groups.has(id) ? living(groups.get(id)) : [] };
}

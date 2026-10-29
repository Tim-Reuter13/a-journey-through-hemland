import { pickBark } from '../data/barks.js';
import { createNavGrid, PENDING } from './navGrid.js';

const TAU = Math.PI * 2, RADIUS = .32, SPACE = .72;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const valid = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);
const hourOf = h => ((h % 24) + 24) % 24;
const restful = new Set(['idle', 'sit', 'lean', 'drink']);
const privateKinds = new Set(['bed', 'seat', 'table', 'hearth', 'shelf']);
// Furniture you lie or sit on: walk to its edge, then take the exact spot (the furniture itself is solid).
const SNAP = new Set(['bed', 'seat', 'tavern_seat', 'bench']);
function snap(n, p) { if (!SNAP.has(p?.kind)) return; n.approach = { x: n.x, z: n.z, y: n.y }; n.x = p.x; n.z = p.z; if (Number.isFinite(p.y)) n.y = p.y; }
function unsnap(n) { if (n.approach) { n.x = n.approach.x; n.z = n.approach.z; n.y = n.approach.y; n.approach = null; } }

function randomSource(seed) {
  let s = 2166136261;
  for (const c of String(seed)) s = Math.imul(s ^ c.charCodeAt(0), 16777619);
  return () => {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Real seconds drive walking, needs and cooldowns; hour selects the daily plan.
export function createNpcLife({ blocked = () => false, navBlocked = blocked, heightAt = () => 0, routes = [], seed = 1 } = {}) {
  const people = new Map(), pois = new Map(), conversations = new Set();
  const roads = routes.map(r => r.filter(valid).map(p => ({ x: p.x, z: p.z }))).filter(r => r.length);
  let hour = 8, time = 0, navUntil = Infinity, navCalls = 0;
  // Doors count as open for planning (navBlocked ignores them); steering still respects them.
  const nav = createNavGrid({ blocked: navBlocked, heightAt });

  function yAt(p) { return Number.isFinite(p.y) ? p.y : (heightAt(p.x, p.z) || 0); }
  function free(p) { return valid(p) && !blocked(p.x, p.z, RADIUS, yAt(p)); }
  function clear(a, b) {
    const steps = Math.max(1, Math.ceil(distance(a, b) / .18));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!free({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t,
        ...(Number.isFinite(a.y) && Number.isFinite(b.y) ? { y: a.y + (b.y - a.y) * t } : {}) })) return false;
    }
    return true;
  }
  function separated(p, npc) {
    return [...people.values()].every(other => other === npc || distance(p, other) >= SPACE);
  }
  function safeSpot(p, npc, max = 8) {
    if (free(p) && separated(p, npc)) return { ...p, y: yAt(p) };
    for (let r = .4; r <= max; r += .4) for (let i = 0; i < Math.ceil(r * 16); i++) {
      const a = i * TAU / Math.ceil(r * 16), q = { x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r, y: p.y };
      if (free(q) && separated(q, npc)) return { ...q, y: yAt(q) };
    }
    return null;
  }
  function homeHouse(n) { return pois.get(n.home)?.house ?? n.home; }
  function belongs(p, ref) { return p.id === ref || p.house === ref; }
  function doorFor(house) { return [...pois.values()].find(p => p.kind === 'door' && (p.house === house || p.id === house)); }
  function capacity(p) { return Math.max(1, Math.floor(p.capacity ?? (['well', 'market', 'patrol', 'idle_spot', 'field'].includes(p.kind) ? 4 : 1))); }
  function available(p, n) {
    return [...people.values()].filter(o => o !== n && o.destination?.id === p.id).length < capacity(p);
  }
  function inRange(p, n) { return !n.anchor || distance(p, n.anchor) <= n.range; }
  function select(n, kinds, scope = 'any') {
    const matches = [...pois.values()].filter(p => kinds.includes(p.kind) && (!p.owner || p.owner === n.id) && inRange(p, n) && available(p, n));
    const scoped = matches.filter(p => scope === 'home' ? belongs(p, n.home) || p.house === homeHouse(n) || p.owner === n.id
      : scope === 'work' ? (!n.workplace || belongs(p, n.workplace) || p.house === pois.get(n.workplace)?.house) && (!p.job || p.job === n.job)
      : !privateKinds.has(p.kind) || !p.house || p.house === homeHouse(n));
    return scoped.sort((a, b) => kinds.indexOf(a.kind) - kinds.indexOf(b.kind) || distance(a, n) - distance(b, n) || String(a.id).localeCompare(String(b.id)))[0] || null;
  }

  function plan(n) {
    const h = hour, lazy = n.traits.lazy;
    if (h < 5.7 + n.offset + lazy * .5 || h >= 22 + n.offset - lazy * .3) return ['sleep', ['bed'], 'home'];
    if (h < 7) return ['eat', ['table', 'hearth', 'tavern_seat'], 'meal'];
    if (h >= 18 && h < 19.5) return ['eat', ['table', 'hearth', 'tavern_seat'], 'meal'];
    if (h >= 12 && h < 13) return n.needs.thirst > .55 ? ['drink', ['well', 'tavern_seat']] : ['eat', ['tavern_seat', 'table', 'hearth'], 'meal'];
    if (n.traits.pious > .7 && h >= 19.5 && h < 20.3) return ['pray', ['shrine']];
    if (h >= 7 && h < 18) {
      switch (n.job) {
        case 'smith': return ['work_hammer', ['workstation', 'hearth'], 'work'];
        case 'elder': return h < 10 || h >= 15 ? ['work_read', ['shelf', 'seat', 'table'], 'home'] : h < 11 ? ['pray', ['shrine']] : ['idle', ['well', 'bench']];
        case 'ranger': return h < 9 ? ['work_chop', ['woodpile'], 'work'] : ['patrol', ['patrol', 'idle_spot'], 'roam'];
        case 'innkeeper': return h < 11 || h >= 16 ? ['work_cook', ['hearth', 'workstation'], 'work'] : ['work_sweep', ['counter', 'door'], 'work'];
        case 'merchant': return ['work_sweep', ['market', 'counter'], 'work'];
        case 'farmer': return h >= 15 && n.needs.thirst > .5 ? ['draw_water', ['well']] : ['work_farm', ['field', 'workstation'], 'work'];
        case 'guard': return Math.floor(h) % 3 === 0 ? ['lean', ['door', 'patrol'], 'work'] : ['patrol', ['patrol'], 'roam'];
        case 'woodcutter': return ['work_chop', ['woodpile', 'workstation'], 'work'];
        case 'child': return ['idle', ['idle_spot', 'well', 'bench'], 'play'];
        case 'miller': return ['work_sweep', ['workstation'], 'work'];
        case 'townsfolk': return h < 9 ? ['draw_water', ['well']] : h >= 14 && h < 16 ? ['sit', ['tavern_seat', 'bench', 'seat']] : ['idle', ['idle_spot', 'well'], 'roam'];
        case 'priest': return h < 10 || h >= 16 ? ['pray', ['shrine'], 'work'] : ['work_read', ['shelf', 'seat'], 'work'];
      }
    }
    if (n.job === 'innkeeper' && h >= 19.5 && h < 21.5) return ['work_cook', ['counter', 'hearth'], 'work'];
    if (n.needs.thirst > .7) return ['drink', ['well', 'tavern_seat']];
    if (n.needs.hunger > .8) return ['eat', ['table', 'hearth', 'tavern_seat'], 'meal'];
    return [lazy > .65 ? 'lean' : 'sit', ['bench', 'tavern_seat', 'seat', 'well', 'idle_spot']];
  }

  function choose(n, spec) {
    const [activity, kinds, scope] = spec;
    if (scope === 'meal') return select(n, kinds.filter(k => k !== 'tavern_seat'), 'home') || select(n, ['tavern_seat']);
    if (scope === 'roam') {
      const spots = [...pois.values()].filter(p => kinds.includes(p.kind) && !p.house && (!p.owner || p.owner === n.id) && (!p.job || p.job === n.job) && inRange(p, n) && available(p, n));
      if (spots.length) return spots[n.roam % spots.length];
      const road = roads[n.route % Math.max(1, roads.length)];
      if (road?.length) return { ...road[n.roam % road.length], id: `@route:${n.route}:${n.roam % road.length}`, kind: 'patrol' };
    }
    if (scope === 'play') {
      const parent = [...people.values()].find(o => o !== n && o.job !== 'child' && homeHouse(o) === homeHouse(n));
      if (parent && n.roam % 2 === 0) {
        const p = safeSpot({ x: parent.x + 1.2, z: parent.z + 1.2 }, n, 2);
        if (p) return { ...p, id: `@follow:${parent.id}:${n.roam}`, kind: 'idle_spot', house: parent.inside };
      }
      const spots = [...pois.values()].filter(p => kinds.includes(p.kind) && !p.house && !p.owner && inRange(p, n) && available(p, n));
      if (spots.length) return spots[n.roam % spots.length];
    }
    return select(n, kinds, scope) || (activity === 'sleep' ? null : select(n, ['idle_spot', 'bench']));
  }

  // Grid paths (systems/navGrid.js); a short hop or a failed search falls back to steering.
  function route(from, to) {
    if (distance(from, to) < 1.5) return [to];
    const points = nav.find(from, to, { until: navUntil, searchUntil: navCalls++ ? navUntil : Infinity, maxNodes: 12000 });
    return points === PENDING ? PENDING : points || [to];
  }

  function setDestination(n, p, activity) {
    n.desired = activity;
    if (n.destination?.id === p?.id && (n.path.length || n.pending)) return;
    if (n.destination?.id === p?.id && n.arrived) return;
    unsnap(n);
    n.destination = p; n.poi = null; n.arrived = false; n.path = []; n.retryAt = 0; n.pending = false; n.planning = null;
    if (!p) { n.activity = 'idle'; return; }
    const spot = safeSpot(p, n, 2);
    if (!spot) { n.destination = null; n.activity = 'idle'; return; }
    // POIs are standing/interaction anchors, not the furniture's solid centre.
    n.goal = { x: spot.x, z: spot.z, y: spot.y };
    planPath(n);
  }
  // Legs end at doors: the exit/enter waypoints switch `inside` and make the game open the door.
  // Finished legs are kept while later ones wait for the grid (`pending`), so nothing is computed twice.
  function planPath(n) {
    if (!n.planning) {
      const p = n.destination, targetHouse = p.kind === 'door' ? null : p.house ?? (p.kind === 'bed' ? homeHouse(n) : null);
      const legs = [];
      if (n.inside && n.inside !== targetHouse) {
        const door = doorFor(n.inside);
        if (!door) { n.destination = null; n.activity = 'idle'; return; }
        legs.push({ to: door, marks: { exit: true } });
      }
      const door = targetHouse && targetHouse !== n.inside ? doorFor(targetHouse) : null;
      if (door) legs.push({ to: door, marks: { enter: targetHouse } });
      legs.push({ to: n.goal, marks: {} });
      n.planning = { legs, path: [], cursor: { x: n.x, z: n.z, y: n.y } };
    }
    const job = n.planning;
    while (job.legs.length) {
      const { to, marks } = job.legs[0], points = route(job.cursor, to);
      if (points === PENDING) { n.pending = true; n.path = []; n.activity = 'idle'; return; }
      job.path.push(...points.slice(0, -1), { ...to, ...marks }); job.cursor = to; job.legs.shift();
    }
    n.planning = null; n.pending = false; n.path = job.path; n.activity = n.desired === 'flee' ? 'flee' : 'walk';
  }

  function say(n, kind) {
    n.bark = pickBark({ job: n.job, activity: n.activity, hour, kind }, n.random);
    n.barkUntil = time + 3.5;
  }
  function face(n, p) { n.facing = Math.atan2(n.x - p.x, n.z - p.z); n.lookAt = { x: p.x, z: p.z }; }
  function endConversation(c, farewell = true) {
    conversations.delete(c);
    for (const n of c.pair) {
      n.conversation = null; n.socialAt = time + 35 + n.random() * 35;
      n.activity = n.arrived ? n.desired : 'idle'; n.lookAt = null;
    }
    if (farewell) say(c.pair[1], 'farewell');
  }
  function startConversation(a, b) {
    const c = { pair: [a, b], until: time + 8 + a.random() * 6, next: time + 3, turn: 1 };
    conversations.add(c);
    for (const n of c.pair) { n.conversation = c; n.activity = 'talk'; n.speed = 0; n.bark = null; }
    face(a, b); face(b, a); say(a, 'gossip');
  }

  function move(n, dt, player) {
    const target = n.path[0];
    n.speed = 0;
    if (!target) return;
    const nearDoor = n.path.find(p => p.kind === 'door' && distance(n, p) < 2.6);
    n.door = nearDoor?.id || (n.door && distance(n, pois.get(n.door) || n) < 2 ? n.door : null);
    const dist = distance(n, target);
    if (dist < .09) {
      if (target.enter) n.inside = target.enter;
      if (target.exit) n.inside = null;
      if (target.kind === 'door') n.door = target.id;
      n.path.shift();
      if (!n.path.length) {
        n.arrived = true; n.poi = n.destination.id; n.activity = n.desired; snap(n, n.destination);
        n.facing = n.destination.facing ?? n.facing; n.stayUntil = time + (n.job === 'child' ? 6 : 12);
      }
      return;
    }
    const speed = n.desired === 'flee' ? 2.8 : 1.4, step = Math.min(speed * dt, dist);
    const angle = Math.atan2(target.x - n.x, target.z - n.z);
    const oldPlayerDistance = valid(player) ? distance(n, player) : Infinity;
    let best = null, score = -Infinity;
    for (const offset of [0, .45, -.45, .9, -.9, 1.35, -1.35]) {
      const a = angle + offset, p = { x: n.x + Math.sin(a) * step, z: n.z + Math.cos(a) * step };
      p.y = n.inside ? n.y + (yAt(target) - n.y) * Math.min(1, step / dist) : yAt(p);
      if (!clear(n, p)) continue;
      if (valid(player) && distance(p, player) < 1.05 && distance(p, player) < oldPlayerDistance - .001) continue;
      if ([...people.values()].some(o => o !== n && distance(p, o) < SPACE && distance(p, o) < distance(n, o) - .001)) continue;
      const progress = dist - distance(p, target) - Math.abs(offset) * .015;
      if (progress > score) { score = progress; best = p; }
    }
    if (best) {
      n.facing = Math.atan2(n.x - best.x, n.z - best.z); n.speed = distance(n, best) / dt; n.stuck = 0; n.blockedPlans = 0;
      n.x = best.x; n.z = best.z; n.y = best.y; n.activity = n.desired === 'flee' ? 'flee' : n.desired === 'patrol' ? 'patrol' : 'walk';
    }
    // Pinned by people or a closing door for a while: plan again from here.
    if (!best && (n.stuck = (n.stuck || 0) + dt) > 1.2 && time >= n.retryAt) {
      n.retryAt = time + 3; n.stuck = 0; n.planning = null;
      // Twice re-planned and still pinned: the spot is unreachable, so stand and choose again later.
      if (++n.blockedPlans > 2) { n.blockedPlans = 0; n.destination = null; n.path = []; n.activity = 'idle'; n.replanAt = time + 15; return; }
      planPath(n);
    }
  }

  function respondToCombat(events) {
    for (const e of events || []) {
      if (e?.type !== 'combat' || !valid(e)) continue;
      for (const n of people.values()) {
        if (distance(n, e) > 25) continue;
        const fresh = time >= n.fleeUntil;
        n.fleeUntil = time + 18;
        if (!fresh) continue;
        if (n.conversation) endConversation(n.conversation, false);
        n.greetUntil = 0; n.lookAt = null; n.planKey = null;
        let shelter = select(n, ['bed', 'table', 'hearth'], 'home');
        if (!shelter) {
          const guard = [...people.values()].filter(o => o.job === 'guard' && o !== n).sort((a, b) => distance(a, n) - distance(b, n))[0];
          const d = distance(n, e) || 1;
          const p = guard ? { x: guard.x + 1.5, z: guard.z } : { x: n.x + (n.x - e.x || 1) / d * 12, z: n.z + (n.z - e.z) / d * 12 };
          shelter = { ...p, id: `@safety:${n.id}`, kind: 'idle_spot' };
        }
        setDestination(n, shelter, 'flee'); say(n, 'flee');
      }
    }
  }

  function tick(dt, player) {
    time += dt;
    for (const c of [...conversations]) {
      if (time >= c.until || c.pair.some(n => n.fleeUntil > time || !restful.has(plan(n)[0]) || distance(n, c.pair[0]) > 3)) endConversation(c);
      else if (time >= c.next) {
        c.pair[1 - c.turn].bark = null; say(c.pair[c.turn], 'gossip'); c.turn = 1 - c.turn; c.next = time + 3;
      }
    }
    for (const n of people.values()) {
      n.speed = 0; n.lookAt = null;
      if (time >= n.barkUntil) n.bark = null;
      n.needs.hunger = clamp(n.needs.hunger + dt * (n.activity === 'eat' ? -.09 : .0008), 0, 1);
      n.needs.thirst = clamp(n.needs.thirst + dt * (['drink', 'draw_water'].includes(n.activity) ? -.12 : .0012), 0, 1);
      n.needs.fatigue = clamp(n.needs.fatigue + dt * (n.activity === 'sleep' ? -.04 : .0005), 0, 1);
      n.needs.social = clamp(n.needs.social + dt * (n.activity === 'talk' ? -.07 : .001 * n.traits.sociable), 0, 1);
      if (n.conversation) { face(n, n.conversation.pair.find(o => o !== n)); continue; }
      if (n.fleeUntil <= time) {
        const spec = plan(n), key = spec.join('|');
        if (key !== n.planKey || !n.destination && time >= n.replanAt || ['roam', 'play'].includes(spec[2]) && n.arrived && time >= n.stayUntil) {
          if (key === n.planKey && n.arrived) n.roam++;
          n.planKey = key; n.replanAt = time + 5;
          setDestination(n, choose(n, spec), spec[0]);
        } else if (n.arrived) n.activity = n.desired;
      }
      const pd = valid(player) ? distance(n, player) : Infinity;
      const seesPlayer = pd < 4 && !n.inside && clear(n, player);
      if (seesPlayer && n.desired !== 'sleep' && n.fleeUntil <= time) {
        const kind = player.carriesCorpse ? 'corpse' : player.weaponDrawn ? 'weapon' : 'greeting';
        if (time >= n.greetingAt && pd >= 1.05) {
          n.greetingAt = time + 180 + n.random() * 60; n.greetUntil = time + 2.5;
          say(n, kind);
        }
        if (time < n.greetUntil || pd < 1.8) {
          n.activity = time < n.greetUntil ? 'greet' : 'idle'; face(n, player);
          if (pd < 1.05) {
            const a = Math.atan2(n.x - player.x || .01, n.z - player.z);
            const p = { x: n.x + Math.sin(a) * dt * 1.4, z: n.z + Math.cos(a) * dt * 1.4, y: n.y };
            if (clear(n, p) && separated(p, n)) { n.x = p.x; n.z = p.z; n.speed = 1.4; }
          }
          continue;
        }
      }
      if (n.pending && n.destination) planPath(n);
      if (n.path.length) move(n, dt, player);
      else if (n.arrived) {
        n.activity = n.desired;
        if (n.door && distance(n, pois.get(n.door) || n) >= 2) n.door = null;
      }
      if (n.activity !== 'sleep' && n.fleeUntil <= time && time >= n.ambientAt) { say(n); n.ambientAt = time + 35 + n.random() * 40; }
    }
    const idle = [...people.values()].filter(n => n.arrived && restful.has(n.activity) && time >= n.socialAt && n.fleeUntil <= time && n.traits.sociable > 0);
    for (let i = 0; i < idle.length; i++) {
      const a = idle[i];
      if (a.conversation) continue;
      for (let j = i + 1; j < idle.length; j++) {
        const b = idle[j];
        if (!b.conversation && a.inside === b.inside && distance(a, b) < 2.8 && clear(a, b) && a.random() < dt * (.12 + a.traits.sociable * .3 + a.needs.social * .2)) {
          startConversation(a, b); break;
        }
      }
    }
  }

  function addPOIs(list) {
    for (const p of list || []) {
      if (!p?.id || !p.kind || !valid(p)) throw new TypeError('POIs need id, kind and finite x/z.');
      pois.set(p.id, { ...p });
    }
    for (const n of people.values()) { n.planKey = null; n.destination = null; n.arrived = false; }
  }

  function addNPC({ id, job = 'villager', home, workplace, range = Infinity, traits = {} }) {
    if (!id || people.has(id)) throw new TypeError('NPC ids must be unique and non-empty.');
    const random = randomSource(`${seed}:${id}`);
    const n = { id, job, home, workplace, range, anchor: null, random,
      traits: Object.fromEntries(['sociable', 'lazy', 'pious'].map(k => [k, clamp(Number.isFinite(traits[k]) ? traits[k] : .5, 0, 1)])),
      offset: (random() - .5) * .7, route: Math.floor(random() * Math.max(1, roads.length)), roam: Math.floor(random() * 64),
      x: 0, y: 0, z: 0, facing: 0, speed: 0, activity: 'idle', desired: 'idle', destination: null,
      goal: null, path: [], poi: null, lookAt: null, bark: null, inside: null, door: null,
      arrived: false, planKey: null, replanAt: 0, blockedPlans: 0, retryAt: 0, stayUntil: 0, greetingAt: 0, greetUntil: 0,
      fleeUntil: 0, barkUntil: 0, ambientAt: time + 20 + random() * 25, socialAt: time + 3,
      conversation: null, needs: { hunger: .25, thirst: .2, fatigue: .15, social: .5 } };
    const origin = select(n, ['bed', 'idle_spot', 'table'], 'home') || pois.get(home) || doorFor(home) || [...pois.values()][0] || { x: 0, z: 0 };
    const spot = safeSpot(origin, n, 24);
    if (!spot) throw new Error(`No collision-free spawn for NPC ${id}.`);
    n.x = spot.x; n.y = spot.y; n.z = spot.z; n.inside = origin.kind === 'door' ? null : origin.house ?? null;
    if (Number.isFinite(range)) n.anchor = { x: spot.x, z: spot.z };
    people.set(id, n);
    return get(id);
  }

  function update(dt, context = {}) {
    if (Number.isFinite(context.hour)) hour = hourOf(context.hour);
    navUntil = performance.now() + 3; navCalls = 0;
    if (!Number.isFinite(dt) || dt <= 0) return;
    respondToCombat(context.events);
    // Substeps prevent tunnelling even on slow frames. Explicit skipTo handles time jumps.
    let remaining = dt;
    while (remaining > 1e-8) { const step = Math.min(.1, remaining); tick(step, context.player); remaining -= step; }
  }

  function skipTo(nextHour) {
    if (!Number.isFinite(nextHour)) return;
    hour = hourOf(nextHour);
    for (const c of [...conversations]) endConversation(c, false);
    for (const n of people.values()) { n.destination = null; n.path = []; n.poi = null; n.arrived = false; n.planning = null; n.pending = false; }
    for (const n of people.values()) {
      const spec = plan(n), p = choose(n, spec), spot = p && safeSpot(p, n, 8);
      n.speed = 0; n.bark = null; n.lookAt = null; n.door = null; n.fleeUntil = 0; n.greetUntil = 0;
      n.planKey = spec.join('|'); n.replanAt = time + 5;
      if (!spot) { n.activity = 'idle'; n.desired = 'idle'; continue; }
      n.approach = null; n.x = spot.x; n.z = spot.z; n.y = spot.y; n.facing = p.facing ?? n.facing; snap(n, p);
      n.destination = p; n.goal = { x: spot.x, y: spot.y, z: spot.z }; n.poi = p.id; n.arrived = true;
      n.desired = spec[0]; n.activity = spec[0]; n.inside = p.kind === 'door' ? null : p.house ?? (p.kind === 'bed' ? homeHouse(n) : null);
      n.stayUntil = time + 12; n.needs = { hunger: .25, thirst: .2, fatigue: spec[0] === 'sleep' ? .1 : .3, social: .5 };
    }
  }

  // Snapshots: target is the destination anchor, poi is occupied only after arrival.
  function get(id) {
    const n = people.get(id);
    if (!n) return null;
    return { x: n.x, y: n.y, z: n.z, facing: n.facing, speed: n.speed, activity: n.activity,
      target: n.destination ? { id: n.destination.id, x: n.goal?.x ?? n.destination.x, y: n.goal?.y ?? yAt(n.destination), z: n.goal?.z ?? n.destination.z } : null,
      poi: n.poi, lookAt: n.lookAt ? { ...n.lookAt } : null, bark: n.bark, inside: n.inside, door: n.door };
  }
  /** Takes an NPC out of the simulation for good (death). */
  function remove(id) { people.delete(id); }
  return { addPOIs, addNPC, remove, update, get, skipTo, nav: () => nav.state() };
}

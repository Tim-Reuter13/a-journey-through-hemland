import * as THREE from 'three';
import { AI } from './config.js';

// Layer B — beliefs and memory. What a person thinks is true: where the wanderer was last seen or
// heard, how sure they are (quality fades with time), where they suppose an unseen archer stands
// (refined with every arrow from the same quarter), and the things that happened to them.

export function createMemory() {
  const player = { pos: new THREE.Vector3(), t: -1e9, q: 0, source: null };
  const shooter = { pos: new THREE.Vector3(), samples: 0, t: -1e9 };
  const events = [];
  const m = {
    player, shooter, events,
    /** Decayed confidence in the wanderer's believed position, 0..1. */
    quality(t) { return player.q * Math.exp(-(t - player.t) / AI.belief.forget); },
    age(t) { return t - player.t; },
    knows(t) { return m.quality(t) > .12; },
    see(pos, t, source = 'sight') { player.pos.copy(pos); player.t = t; player.q = 1; player.source = source; },
    /** A sound or a glimpse; only replaces what is believed if it is at least as good. */
    hear(pos, t, q, source) {
      if (q < m.quality(t) * .9) return false;
      player.pos.copy(pos); player.t = t; player.q = q; player.source = source;
      return true;
    },
    /** Told by someone else (a shout). Second-hand knowledge counts for less. */
    tell(pos, t, q, from) { return m.hear(pos, t, q * .8, `ruf:${from}`); },
    /** An arrow came from `direction` (unit, the way it flew) through `point`: guess where it was loosed. */
    arrowFrom(point, direction, t) {
      const back = point.clone().addScaledVector(direction, -22);
      if (shooter.samples && t - shooter.t < 20) shooter.pos.lerp(back, 1 / (shooter.samples + 1));
      else { shooter.pos.copy(back); shooter.samples = 0; }
      shooter.samples = Math.min(6, shooter.samples + 1); shooter.t = t;
      // Several arrows from one quarter narrow the guess, and the guess is a place to search.
      m.hear(shooter.pos, t, Math.min(.65, .2 + shooter.samples * .12), 'pfeil');
    },
    remember(kind, data = {}) { events.push({ kind, ...data }); if (events.length > 24) events.shift(); },
    has(kind) { return events.some(e => e.kind === kind); },
    count(kind) { return events.filter(e => e.kind === kind).length; },
  };
  return m;
}

import * as THREE from 'three';

// Layer H — life in the plunderers' camp. Each member keeps a day: sleep in a tent, eat and talk at the
// fire, stand watch at a post (shifts change hands at night), walk a patrol that leaves the camp,
// chop wood, practise with the bow, go out hunting. Spots are relative to the camp centre (see
// buildings.js makeCamp). Patrol and hunting positions follow from the hour alone, so a camp nobody
// watches is where it should be when someone comes back (manager.js snaps far brains to it).

const SPOTS = {
  seats: [[2.0, 1.6], [-2.4, .9], [.6, -2.6]], fire: [0, 0],
  tents: [[4.2, -4.5], [-5, 2.6]],
  road: [9.5, .8], back: [-9, -6.5], target: [-12, 8], targetFrom: [-6, 5], wood: [6.2, 4.2], table: [-3.1, -2.2],
};
// Each member: [from, to, activity] across the day (hours, wrapping at midnight).
const DAYS = {
  // Someone always watches the road: the shifts are laid so that one of the two is at a post.
  melee: [[22, 2, 'guard_road'], [2, 7, 'sleep_1'], [7, 9, 'eat_0'], [9, 12, 'patrol'], [12, 15, 'guard_road'], [15, 17, 'chop'], [17, 19, 'guard_back'], [19, 22, 'eat_0']],
  archer: [[22, 2, 'sleep_1'], [2, 6, 'guard_road'], [6, 9, 'eat_1'], [9, 12, 'guard_road'], [12, 14, 'practice'], [14, 19, 'hunt'], [19, 22, 'guard_road']],
  leader: [[22, 6, 'sleep_0'], [6, 8, 'eat_2'], [8, 12, 'plan'], [12, 14, 'eat_2'], [14, 18, 'rounds'], [18, 22, 'eat_2']],
};
// After losses the survivors stop living and keep watch.
const ALARMED = { melee: 'guard_back', archer: 'guard_road', leader: 'rounds' };

const inside = (h, a, b) => a < b ? h >= a && h < b : h >= a || h < b;
const span = (a, b) => (b - a + 24) % 24;

function loop(radius, n = 8, wobble = .18) {
  return Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2, r = radius * (1 + Math.sin(i * 2.3) * wobble); return [Math.cos(a) * r, Math.sin(a) * r]; });
}
const PATROL = loop(15), ROUNDS = loop(7, 6, .1);
function along(points, f) {
  const n = points.length, k = ((f % 1) + 1) % 1 * n, i = Math.floor(k), u = k - i, [ax, az] = points[i], [bx, bz] = points[(i + 1) % n];
  return [ax + (bx - ax) * u, az + (bz - az) * u];
}

/** A schedule function for brain.schedule: where this camp member should be now, and doing what. */
export function campSchedule(centre, heightAt, role) {
  const day = DAYS[role] || DAYS.melee;
  const at = ([x, z], face) => ({ goal: new THREE.Vector3(centre.x + x, heightAt(centre.x + x, centre.z + z), centre.z + z), face: face ? new THREE.Vector3(centre.x + face[0], 0, centre.z + face[1]) : null });
  return (brain, ctx) => {
    const hour = ctx.hour;
    let [from, to, what] = day.find(([a, b]) => inside(hour, a, b)) || day[0];
    if (brain.nervous > .1 && what !== 'sleep_0') what = ALARMED[role];
    const f = span(from, hour) / Math.max(.01, span(from, to));
    const [kind, n] = what.split('_');
    switch (kind) {
      case 'sleep': return { ...at(SPOTS.tents[+n]), pose: 'sleep', label: 'schläft', tolerance: .5 };
      case 'eat': return { ...at(SPOTS.seats[+n], SPOTS.fire), pose: 'sit', label: 'sitzt am Feuer', tolerance: .4 };
      case 'guard': return { ...at(n === 'road' ? SPOTS.road : SPOTS.back, n === 'road' ? [30, 1] : [-30, -12]), pose: null, label: 'hält Wache', tolerance: .5 };
      case 'chop': return { ...at(SPOTS.wood, [7.2, 5]), pose: 'work_chop', label: 'hackt Holz', tolerance: .5 };
      case 'practice': return { ...at(SPOTS.targetFrom, SPOTS.target), pose: 'draw_bow', label: 'übt mit dem Bogen', tolerance: .5 };
      case 'plan': return { ...at(SPOTS.table, [-3.1, -3.4]), pose: 'read', label: 'brütet über Plänen', tolerance: .5 };
      // Walks: the target point moves with the hour; the walker follows it round the loop.
      case 'patrol': return { ...at(along(PATROL, f * 2)), speed: 1.5, pose: null, label: 'patrouilliert', tolerance: 1.2 };
      case 'rounds': return { ...at(along(ROUNDS, f * 3)), speed: 1.2, pose: null, label: 'geht die Runde', tolerance: 1 };
      case 'hunt': {
        // Out along the old trail to the hunting ground and back again.
        const out = f < .5 ? f * 2 : (1 - f) * 2, x = -14 - out * 30, z = 10 + out * 14;
        return { ...at([x, z]), speed: 1.6, pose: out > .95 ? 'aim_low' : null, label: out > .95 ? 'jagt' : 'geht jagen', tolerance: 1.2 };
      }
    }
    return { ...at(SPOTS.fire), label: 'steht herum' };
  };
}

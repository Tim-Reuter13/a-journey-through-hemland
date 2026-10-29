import { randomAppearance } from '../ui/characterCreator.js';
import { JOB_BARKS } from './barks.js';

// The people of Kronwacht: generated from the city's enterable buildings, so
// every citizen has a home (or a bunk, a temple cell, a room above the tavern),
// a job with a daily routine (systems/npcLife.js) and clothes that are real items.
const NAMES = {
  male: ['Aldric', 'Bertolt', 'Corwin', 'Falk', 'Hagen', 'Jorek', 'Kunrad', 'Merten', 'Oswin', 'Theobald', 'Wendel', 'Ansgar', 'Gerwin', 'Lothar', 'Rutger', 'Volkmar'],
  female: ['Dagmar', 'Edda', 'Gunda', 'Ilsa', 'Liesel', 'Nele', 'Ragna', 'Sieglind', 'Ulla', 'Hedwig', 'Mechthild', 'Brunhild', 'Irmgard', 'Walburg'],
};
const CLOTH = ['#5a4f40', '#3a5066', '#6a2a2a', '#4a5a3a', '#7a6a4a', '#3d3129', '#5e5a68', '#2f3d4a', '#8a7f6a'];
const ROLES = {
  guard: { label: 'STADTWACHE', homes: ['barracks'], count: 7, equipment: { weapon: 'waechterklinge', armor: 'wachpanzer', head: 'wachhelm', hands: 'lederhandschuhe', feet: 'wanderstiefel' } },
  merchant: { label: 'HÄNDLER', homes: ['shop', 'home'], count: 5, equipment: { armor: 'bauernkleidung', feet: 'lederschuhe' }, extras: ['satchel'] },
  innkeeper: { label: 'WIRT', homes: ['tavern'], count: 1, equipment: { armor: 'schmiedekluft', feet: 'lederschuhe' } },
  priest: { label: 'PRIESTER', homes: ['temple', 'chapel'], count: 2, equipment: { armor: 'aeltestenrobe', feet: 'lederschuhe' } },
  smith: { label: 'SCHMIED', homes: ['smithy'], count: 1, equipment: { armor: 'schmiedekluft', hands: 'lederhandschuhe', feet: 'wanderstiefel' }, weaponModel: 'hammer' },
  townsfolk: { label: 'BÜRGER', homes: ['home'], count: 5, equipment: { armor: 'bauernkleidung', feet: 'lederschuhe' } },
  child: { label: 'KIND', homes: ['home'], count: 3, equipment: { armor: 'bauernkleidung', feet: 'lederschuhe' }, scale: .72 },
};

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), state | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

// Shoppers and gossips need somewhere to stand: rings around the market and the wells.
export function townSpots(pois, { center, radius = 240 } = {}) {
  const near = p => Math.hypot(p.x - center.x, p.z - center.z) < radius;
  const stalls = pois.filter(p => p.kind === 'market' && near(p)), spots = [];
  const ring = (id, x, z, r, count, y) => {
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2;
      spots.push({ id: `${id}_${i}`, kind: 'idle_spot', x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, y, facing: a + Math.PI / 2, capacity: 1 });
    }
  };
  if (stalls.length) {
    const x = stalls.reduce((sum, p) => sum + p.x, 0) / stalls.length, z = stalls.reduce((sum, p) => sum + p.z, 0) / stalls.length;
    ring('market_crowd', x, z, 7, 8, stalls[0].y); ring('market_crowd_outer', x, z, 12, 10, stalls[0].y);
  }
  for (const well of pois.filter(p => p.kind === 'well' && near(p))) ring(`${well.id}_gossip`, well.x, well.z, 3.2, 3, well.y);
  return spots;
}

export function createCitizens(interiors, { center, radius = 240, seed = 1 } = {}) {
  const random = seeded(seed);
  const pick = list => list[Math.floor(random() * list.length)];
  const inTown = room => room.door && Math.hypot(room.door.position.x - center.x, room.door.position.z - center.z) < radius;
  const byKind = kind => interiors.filter(room => room.kind === kind && inTown(room) && room.pois.length);
  const citizens = [];
  for (const [job, role] of Object.entries(ROLES)) {
    const homes = role.homes.flatMap(byKind);
    if (!homes.length) continue;
    for (let i = 0; i < role.count; i++) {
      const home = homes[i % homes.length];
      const appearance = randomAppearance(random);
      if (job === 'guard' || job === 'smith') appearance.body = random() < .8 ? 'male' : 'female';
      if (job === 'child') { appearance.beard = null; appearance.build = 'slim'; }
      const equipment = { ...role.equipment };
      if (appearance.body === 'female' && ['merchant', 'townsfolk', 'child'].includes(job) && random() < .6) equipment.armor = 'leinenkleid';
      // Guards keep the city's blue livery; everyone else wears whatever they could afford.
      const tints = job === 'guard' ? {} : { shirt: pick(CLOTH), tunic: pick(CLOTH), dress: pick(CLOTH), pants: pick(CLOTH), robe: job === 'priest' ? '#d8d2c0' : pick(CLOTH) };
      const name = pick(NAMES[appearance.body]);
      const bed = home.pois.find(p => p.kind === 'bed') || home.pois[0];
      const lines = JOB_BARKS[job] || JOB_BARKS.farmer;
      citizens.push({
        id: `citizen_${job}_${i}`, name, role: role.label, job, citizen: true, home: home.house, range: 220,
        workplace: job === 'innkeeper' || job === 'priest' ? home.house : undefined, scale: role.scale || (.96 + random() * .08),
        x: bed.x, z: bed.z, facing: 0, trust: 0, mood: 'ruhig', memories: [],
        lines: [pick(lines), pick(lines)],
        look: { appearance: { ...appearance, name }, equipment, extras: role.extras || [], tints, weaponModel: role.weaponModel },
      });
    }
  }
  return citizens;
}

// HUMANITY AI — tunables and character data. Everything a designer would want to turn lives here,
// not inside the decision code (see README.md in this folder for the architecture).

export const AI = {
  // Seconds between updates per layer. Brains are staggered so they never all replan in one frame;
  // `budget` caps the thinking brains per frame. Far brains (beyond lod.near) run slower.
  tick: { sense: .16, think: .32, group: .3, farSense: 1.1, farThink: 2.2, budget: 6 },
  lod: { near: 70, far: 170 },
  sight: {
    fov: 2.3, fovAlert: 3,             // full cone angle in radians, calm and alert
    range: 40, nightRange: 15,         // metres at full daylight and at night
    rate: 1.7, glimpse: .35, decay: .16, eye: 1.62, feel: 2.4, // awareness per second; within `feel` metres anyone notices you
    stance: { still: .7, walk: 1, run: 1.3, sneak: .42, sneakStill: .26, attack: 1.45, cast: 1.65 },
  },
  hearing: { wall: .45, error: .22 },  // loudness through a wall, position error per metre
  // How far each sound carries in the open (metres).
  sounds: { step: 5, run: 13, sneak: 1.3, swing: 9, fight: 20, bowRelease: 13, arrowHit: 15, spell: 20, fireImpact: 34, shout: 32, death: 24, scream: 30 },
  belief: { forget: 9, staleSearch: 2.5, searchFor: 24 },
  fear: { decay: .05, retreat: .5, surrender: .66, flee: .74, fleeExit: .4 },
  hysteresis: .12,
  slots: { base: 1, coordinated: 2, hold: 2.8, steal: .78 },
  ring: { melee: 3.6, waiting: 5.4, archer: 14, fireBonus: 1.8 },
  reflex: { fastest: .1, slowest: .42 }, // reaction time to a swing, best and worst fighter
  warn: { notice: 22, halt: 16, close: 7, aimProvokes: 2.6 },
  toll: 20,
  // Hedge-witches: a pool of mana, fire bolts from range, healing for friends who are hurt.
  magic: { mana: 100, regen: 4.5, bolt: 26, heal: 34, castTime: 1.25, healTime: 1.5, boltSpeed: 17, boltDamage: 18, healAmount: 28, range: [5, 24] },
  // Search parties: sent after the wanderer is lost, or when a comrade does not come back.
  search: { after: 6, every: 30, lasts: 40, missingAfter: 40, findRange: 14 },
};

export const TRAITS = ['courage', 'aggression', 'caution', 'experience', 'loyalty', 'discipline', 'greed', 'empathy',
  'suspicion', 'risk', 'confidence', 'cunning', 'grit', 'obedience', 'vengeance'];

// Shared character templates. A brain is never a template: traits are rolled per person around these.
export const ARCHETYPES = {
  rogue: { label: 'Wegelagerer', skill: .35, damage: 16, reach: 2.9, windup: .66, bias: { experience: -.2, discipline: -.25, greed: .2, courage: -.06 } },
  veteran: { label: 'Söldner', skill: .72, damage: 18, reach: 3, windup: .56, bias: { experience: .3, discipline: .3, caution: .15, confidence: .15, grit: .15 } },
  berserker: { label: 'Berserker', skill: .5, damage: 21, reach: 3, windup: .6, bias: { aggression: .35, caution: -.3, courage: .25, vengeance: .25, discipline: -.2 } },
  leader: { label: 'Anführer', skill: .7, damage: 21, reach: 3.1, windup: .58, leads: true, bias: { discipline: .25, confidence: .25, experience: .25, cunning: .15, courage: .15 } },
  archer: { label: 'Bogenschütze', skill: .55, damage: 12, reach: 2.8, windup: .66, ranged: true, bias: { caution: .2, aggression: -.12, cunning: .1 } },
  shieldbearer: { label: 'Schildträger', skill: .6, damage: 16, reach: 2.8, windup: .62, shield: true, bias: { discipline: .25, caution: .1, courage: .2, grit: .2, confidence: .15 } },
  mage: { label: 'Aschenhexer', skill: .55, damage: 9, reach: 2.6, windup: .7, caster: true, bias: { caution: .25, aggression: -.1, cunning: .2, empathy: .12 } },
  wolf: { label: 'Wolf', skill: .5, damage: 10, reach: 2.4, windup: .42, beast: true, bias: { aggression: .1, loyalty: .3, discipline: .2 } },
};

// Small deterministic generator, so a person is the same person after every load.
export function seeded(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function makePersonality(seed, archetype = 'rogue') {
  const r = seeded(seed), a = ARCHETYPES[archetype] || ARCHETYPES.rogue, traits = {};
  for (const t of TRAITS) traits[t] = clamp(.5 + (r() - .5) * .6 + (a.bias[t] || 0), .02, .98);
  return { seed, archetype, label: a.label, traits, skill: clamp(a.skill + (r() - .5) * .2, .1, .95), damage: a.damage, reach: a.reach,
    windup: a.windup, ranged: !!a.ranged, leads: !!a.leads, beast: !!a.beast, shield: !!a.shield, caster: !!a.caster };
}

// Things people shout. Lines are chosen by what the speaker actually knows (see brain.js).
export const LINES = {
  halt: ['Halt! Was willst du hier?', 'Stehen bleiben!', 'Keinen Schritt weiter!'],
  lowerBow: ['Nimm den Bogen runter!', 'Senk das Ding, sofort!'],
  lastWarning: ['Letzte Warnung!', 'Ich sag es nicht noch einmal!'],
  spotted: ['Da ist er!', 'Ich seh ihn!', 'Da drüben!'],
  heard: ['Was war das?', 'Hast du das gehört?', 'Wer ist da?'],
  lost: ['Wo ist er hin?', 'Verdammt, weg ist er.', 'Sucht ihn!'],
  bow: ['Der hat einen Bogen!', 'Bogenschütze!'],
  arrows: ['Pfeile! Deckung!', 'Runter!', 'In Deckung!'],
  magic: ['Er benutzt Magie!', 'Feuer! Weg da!'],
  flank: ['Ich geh links rum!', 'Ich komm von der Seite!'],
  orderFlank: ['Kreist ihn ein!', 'Einer von der Seite!'],
  orderRetreat: ['Rückzug! Zurück!', 'Wir ziehen ab!'],
  takeCommand: ['Hört auf mich! Zusammenbleiben!'],
  leaderDown: ['Der Hauptmann ist tot!', 'Sie haben ihn erwischt!'],
  fewer: ['Wir sind zu wenige!', 'Das schaffen wir nicht!'],
  help: ['Helft mir!', 'Ich blute!'],
  flee: ['Ich hau ab!', 'Nichts wie weg!'],
  surrender: ['Nicht schießen! Ich ergebe mich!', 'Schon gut ... ich will keinen Ärger.', 'Gnade! Ich gebe auf!'],
  parley: ['Ganz ruhig ... wir können reden.', 'Langsam. Niemand muss sterben.'],
  revenge: ['Du hast ihn umgebracht!', 'Dafür bezahlst du!'],
  toll: ['Das kostet Wegzoll. Zwanzig Gold, und du gehst weiter.', 'Die Straße gehört uns. Zwanzig Gold.'],
  thanks: ['Ich ... danke.', 'Du hörst nie wieder von mir.'],
  recognised: ['Du ... du hast mich damals laufen lassen. Geh weiter.', 'Dich kenn ich. Ich halt mich raus.'],
  coward: ['Feigling!', 'Lauf nur, du Hund!'],
  wake: ['Was?! Wer da?', 'Hm ... was ist los?'],
  cruel: ['Er hat ihn abgestochen, obwohl er aufgegeben hat!'],
  shieldUp: ['Hinter mich!', 'Schilde hoch!'],
  grab: ['Hab dich!', 'Halt still!', 'Jetzt hab ich dich!'],
  shove: ['Weg da!', 'Zurück!', 'Komm mir nicht zu nah!'],
  rescue: ['Lass ihn los!', 'Finger weg von ihm!', 'Lass los, sag ich!'],
  held: ['Lass mich los!', 'Nimm die Pfoten weg!', 'Loslassen!'],
  pinned: ['Schon gut, schon gut!', 'Ich geb auf!', 'Genug, genug!'],
  heldYou: ['Jetzt! Schlagt zu!', 'Ich hab ihn! Los!'],
  taunt: ['Na los, schieß doch!', 'Mehr hast du nicht?'],
  heal: ['Halt durch!', 'Komm her, ich flick dich zusammen.'],
  cast: ['Brenne!', 'Asche zu Asche!'],
  noMana: ['Meine Kraft ist erschöpft ...', 'Die Glut ist weg ...'],
  orderSearch: ['Ihr zwei, sucht ihn!', 'Durchkämmt die Gegend!'],
  missing: ['Wo bleibt {name}?', 'Hat jemand {name} gesehen?', '{name} ist nicht zurück.'],
  found: ['Hier liegt {name}! Tot!', 'Sie haben {name} umgebracht!'],
};

// The shadow trades: sneaking, picking pockets and picking locks. Pure rules, no DOM and no rendering, so
// the game (main.js) and the menus (ui/lockpick.js, ui/pickpocket.js, ui/stealthMeter.js) share them and the
// tests can check them. Skills grow with use, like everything else in Hemland.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** A small deterministic random stream from a string (same chest, same lock, every game). */
export function seeded(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ── Skills. Each grows with use; the next level costs a little more than the last.
export const SKILL_NAMES = { sword: 'Klingenkunst', magic: 'Glutmagie', archery: 'Bogenschießen', sneak: 'Schleichen', thievery: 'Diebeskunst', smithing: 'Schmiedekunst', witchcraft: 'Hexerei' };
export const skillCost = level => Math.round(18 + level * 3.2);
/** Adds practice to a skill; returns how many levels it rose (0 when none). */
export function trainSkill(player, skill, amount) {
  if (!(amount > 0)) return 0;
  player.skills[skill] ??= 1; player.skillXp ??= {};
  let xp = (player.skillXp[skill] || 0) + amount, ups = 0;
  while (player.skills[skill] < 100 && xp >= skillCost(player.skills[skill])) { xp -= skillCost(player.skills[skill]); player.skills[skill]++; ups++; }
  player.skillXp[skill] = player.skills[skill] >= 100 ? 0 : xp;
  return ups;
}
/** How far the skill is toward its next level, 0..1. */
export const skillProgress = (player, skill) => (player.skills?.[skill] ?? 1) >= 100 ? 1 : (player.skillXp?.[skill] || 0) / skillCost(player.skills?.[skill] ?? 1);

// ── Sneaking.
/**
 * What the people round the wanderer make of them, from the brains of those near (awareness 0..1.2,
 * whether they see, how they feel). 'hidden' | 'noticed' | 'detected', with a 0..1 level for the meter.
 */
export function detection(brains) {
  let level = 0, detected = false;
  for (const b of brains) {
    if (!b) continue;
    const a = clamp(b.awareness || 0, 0, 1);
    if (b.sees && a >= 1 || ['hostile', 'fighting', 'hunting', 'attacking'].includes(b.hostility) && b.sees) detected = true;
    level = Math.max(level, a);
  }
  if (detected) return { state: 'detected', level: 1 };
  return { state: level > .35 ? 'noticed' : 'hidden', level };
}
/** Is this foe unaware of the wanderer, so a blade from the shadows counts double? */
export function unaware(enemy) {
  const b = enemy.ai;
  if (!b) return !enemy.engaged;
  return !b.sees && (b.awareness || 0) < .8 && !['hostile', 'fighting', 'attacking', 'fleeing'].includes(b.hostility);
}
/** Damage factor of a blow struck from hiding: ×2, ×3 with the perk "Meuchelstoß". */
export const sneakFactor = perks => perks.includes('meuchelstoss') ? 3 : 2;

// ── Locks. Some chests and doors are locked; each level is a lock of more rings, turning faster.
export const LOCKS = {
  einfach: { name: 'Einfach', rings: 2, speed: 1.5, notch: .58, xp: 6 },
  mittel: { name: 'Mittel', rings: 3, speed: 1.9, notch: .46, xp: 11 },
  schwer: { name: 'Schwer', rings: 4, speed: 2.35, notch: .37, xp: 18 },
  meister: { name: 'Meister', rings: 5, speed: 2.8, notch: .3, xp: 28 },
};
/** The lock on a thing with this id, or null: about half the chests are locked, few with a master's lock. */
export function lockLevel(id, odds = { none: .5, einfach: .27, mittel: .13, schwer: .07 }) {
  const r = seeded(`lock:${id}`)();
  if (r < odds.none) return null;
  if (r < odds.none + odds.einfach) return 'einfach';
  if (r < odds.none + odds.einfach + odds.mittel) return 'mittel';
  if (r < odds.none + odds.einfach + odds.mittel + odds.schwer) return 'schwer';
  return 'meister';
}
/**
 * The rings of a lock, outermost first: each turns at its own pace (alternating direction; a master's lock
 * turns back now and then) with one notch to catch. Skill and the perk "Feine Dietriche" widen the notches.
 */
export function lockRings(level, { skill = 1, perks = [], seed = level } = {}) {
  const def = LOCKS[level] ?? LOCKS.einfach, random = seeded(`rings:${seed}`);
  const widen = 1 + clamp(skill, 1, 100) / 100 * .45 + (perks.includes('feine_dietriche') ? .22 : 0);
  return Array.from({ length: def.rings }, (_, i) => ({
    notch: clamp(def.notch * widen * (1 - i * .06), .16, 1.1),
    speed: def.speed * (1 + i * .12) * (.9 + random() * .2),
    dir: i % 2 ? -1 : 1,
    angle: random() * Math.PI * 2,
    target: random() * Math.PI * 2,
    flips: level === 'meister' && i >= 2,
  }));
}
const TAU = Math.PI * 2;
/** Angular distance between two angles, 0..π. */
export const angleGap = (a, b) => { const d = ((a - b) % TAU + TAU) % TAU; return Math.min(d, TAU - d); };
/** Does the pick (at the top, angle 0) sit in this ring's notch right now? */
export const inNotch = ring => angleGap(ring.angle + ring.target, 0) <= ring.notch / 2;
/** Chance a pick survives a slip: the perk "Unzerbrechlich" saves one in three. */
export const pickSurvives = (perks, roll) => perks.includes('unzerbrechlich') && roll < .33;

// ── Pockets. What people carry, by who they are; refilled each day.
const POCKETS = {
  farmer: [['waldapfel', 1, 3], ['reisefladen', 0, 2], ['kraeuter', 0, 2]],
  smith: [['eisenerz', 0, 2], ['leder', 0, 2], ['dietrich', 0, 1]],
  innkeeper: [['reisefladen', 1, 2], ['bernstein', 0, 1], ['ausdauertrank', 0, 1]],
  guard: [['ausdauertrank', 0, 1], ['dietrich', 0, 2], ['reisefladen', 0, 1]],
  priest: [['kraeuter', 1, 3], ['heiltrank', 0, 1]],
  noble: [['bernstein', 1, 2], ['wandereramulett', 0, 1]],
  ranger: [['pfeil', 3, 8], ['wildbret', 0, 1], ['hasenfell', 0, 1]],
  common: [['waldapfel', 0, 2], ['reisefladen', 0, 1], ['kraeuter', 0, 1]],
};
const GOLD = { farmer: [2, 12], smith: [6, 22], innkeeper: [18, 55], guard: [8, 26], priest: [3, 14], noble: [60, 160], ranger: [4, 16], common: [2, 14] };
/** Which pocket table fits this person (by job or role text). */
export function pocketKind(npc) {
  const text = `${npc.job || ''} ${npc.role || ''} ${npc.id || ''}`.toLowerCase();
  if (/wache|guard|hauptmann|captain/.test(text)) return 'guard';
  if (/könig|king|vogt|steward/.test(text)) return 'noble';
  if (/schmied|smith/.test(text)) return 'smith';
  if (/wirt|innkeeper|händler|merchant|trader/.test(text)) return 'innkeeper';
  if (/priest|tempel/.test(text)) return 'priest';
  if (/waldläufer|ranger|jäger|hunter/.test(text)) return 'ranger';
  if (/bauer|farmer|müller|miller/.test(text)) return 'farmer';
  return 'common';
}
/** A person's pockets on a given day: { gold, items: { id: count } }, the same all day long. */
export function pocketsFor(npc, day, itemExists = () => true) {
  const kind = pocketKind(npc), random = seeded(`pockets:${npc.id}:${day}`), [g0, g1] = GOLD[kind];
  const items = {};
  for (const [id, lo, hi] of POCKETS[kind]) {
    if (!itemExists(id)) continue;
    const n = lo + Math.floor(random() * (hi - lo + 1));
    if (n > 0) items[id] = n;
  }
  return { kind, gold: g0 + Math.floor(random() * (g1 - g0 + 1)), items };
}

/**
 * The chance (0.05..0.95) to lift something from a pocket. Heavier and dearer things are harder; skill,
 * the perk "Flinke Finger" and a moment when the mark looks away help; a mark facing you is hard.
 * calm: the mark's attention, 1 = looking elsewhere, 0 = alert (the timing pulse of the pocket window).
 */
export function pickpocketChance({ skill = 1, weight = .2, value = 5, gold = 0, perks = [], facing = false, calm = .5 }) {
  let chance = .52 + clamp(skill, 1, 100) * .0042;
  chance -= clamp(weight, 0, 20) * .045 + Math.sqrt(Math.max(0, value)) * .028 + Math.sqrt(Math.max(0, gold)) * .022;
  chance += perks.includes('flinke_finger') ? .15 : 0;
  chance += (calm - .5) * .36;
  if (facing) chance -= .3;
  return clamp(chance, .05, .95);
}
/** What being caught costs: the bounty grows by twice the worth of what was reached for (at least 10). */
export const bountyFor = value => Math.max(10, Math.round(value * 2));

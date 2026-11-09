// Elemental auras and reactions: pure rules, no rendering (systems/reactions.js does the effects, combat.js the
// wiring, tests/elements.test.js checks them). A spell leaves its element on whom it hits as an aura that fades; the
// next element meets it and the two react. Wind and earth never stay: they swirl or crystallise what is there.
//
//   auras: { feuer: units, eis: units, … } on the target (units 0..2, one hit ≈ 1 unit, fading over `duration`).

/** Auras a body can carry. */
export const AURAS = {
  feuer: { name: 'Brennend', color: '#ff8a3a', glyph: 'flame', duration: 8 },
  eis: { name: 'Unterkühlt', color: '#9fd8ff', glyph: 'frost', duration: 10 },
  blitz: { name: 'Geladen', color: '#c39cff', glyph: 'bolt', duration: 7 },
  nass: { name: 'Nass', color: '#4fa3f0', glyph: 'drop', duration: 12 },
  gift: { name: 'Vergiftet', color: '#9ad050', glyph: 'miasma', duration: 9 },
};
export const AURA_IDS = Object.keys(AURAS);
/** Elements of the spells (data/spells.js), and the world's water, as they act on a body. */
export const SPELL_ELEMENT = { feuer: 'feuer', eis: 'eis', blitz: 'blitz', wind: 'wind', erde: 'erde', gift: 'gift', nass: 'nass' };

/**
 * The reactions. multiplier: on the damage of the hit that sets it off; forward/reverse: the trigger meets the aura
 * the strong way round (fire on ice melts twice as hard as ice on fire). keep: both auras stay (electro-charged).
 */
export const REACTIONS = {
  schmelzen: { name: 'Schmelzen', colors: ['#ff8a3a', '#9fd8ff'], about: 'Feuer trifft Eis (oder umgekehrt): doppelter Schaden, das Schmelzwasser macht nass.' },
  verdampfen: { name: 'Verdampfen', colors: ['#ff8a3a', '#4fa3f0'], about: 'Feuer trifft Nässe: eine Dampfwolke, anderthalb- bis zweifacher Schaden.' },
  ueberladung: { name: 'Überladung', colors: ['#ff8a3a', '#c39cff'], about: 'Feuer und Blitz: eine Explosion, die alle in der Nähe trifft und umwirft.' },
  supraleiter: { name: 'Supraleiter', colors: ['#9fd8ff', '#c39cff'], about: 'Eis und Blitz: ein Kältestoß ringsum, Rüstung und Knochen werden spröde.' },
  gefroren: { name: 'Gefroren', colors: ['#9fd8ff', '#4fa3f0'], about: 'Eis und Nässe: der Körper erstarrt in Eis. Ein harter Schlag zerschmettert ihn.' },
  elektrisiert: { name: 'Elektrisiert', colors: ['#c39cff', '#4fa3f0'], about: 'Blitz und Nässe: Schläge in Wellen, die auf andere Nasse überspringen.' },
  wirbel: { name: 'Wirbel', colors: ['#b8e8d4'], about: 'Wind trägt ein Element weiter: es greift auf alle in der Nähe über.' },
  kristall: { name: 'Kristall', colors: ['#f0cf8a'], about: 'Erde bindet ein Element zu Kristall: Splitter, und ein Schild für dich.' },
  schwelbrand: { name: 'Schwelbrand', colors: ['#ff8a3a', '#9ad050'], about: 'Feuer und Gift: ein langer, giftiger Brand.' },
  nervengift: { name: 'Nervengift', colors: ['#c39cff', '#9ad050'], about: 'Blitz und Gift: die Muskeln versagen, der Treffer sitzt tiefer.' },
  faeulnis: { name: 'Fäulnis', colors: ['#4fa3f0', '#9ad050'], about: 'Nässe und Gift: ein Fäulniskeim, der nach einem Atemzug platzt.' },
  zerschmettern: { name: 'Zerschmettern', colors: ['#e8f6ff'], about: 'Ein harter Schlag auf einen Gefrorenen: das Eis birst mit ihm.' },
};

// What an incoming element does with each aura it finds, in order of preference (the first present one reacts).
// [aura, reaction, multiplier for this trigger, consumes (share of the trigger's units taken from the aura)]
const TABLE = {
  feuer: [['eis', 'schmelzen', 2, 2], ['nass', 'verdampfen', 1.5, .5], ['blitz', 'ueberladung', 1, 1], ['gift', 'schwelbrand', 1, 1]],
  eis: [['feuer', 'schmelzen', 1.5, .5], ['nass', 'gefroren', 1, 1], ['blitz', 'supraleiter', 1, 1]],
  nass: [['feuer', 'verdampfen', 2, 2], ['eis', 'gefroren', 1, 1], ['blitz', 'elektrisiert', 1, 0], ['gift', 'faeulnis', 1, 1]],
  blitz: [['nass', 'elektrisiert', 1, 0], ['feuer', 'ueberladung', 1, 1], ['eis', 'supraleiter', 1, 1], ['gift', 'nervengift', 1.6, 1]],
  gift: [['feuer', 'schwelbrand', 1, 1], ['blitz', 'nervengift', 1.6, 1], ['nass', 'faeulnis', 1, 1]],
};
// Wind and earth take the strongest of these.
const SWIRLABLE = ['feuer', 'blitz', 'eis', 'nass', 'gift'], CRYSTAL = ['feuer', 'blitz', 'eis', 'nass'];

const strongest = (auras, from) => from.filter(el => (auras[el] || 0) > 0).sort((a, b) => auras[b] - auras[a])[0] ?? null;

/**
 * An element meets a body. Mutates `auras`; returns what happened:
 * { reaction: id | null, multiplier, absorbed: element taken by wind/earth (or null), aura: element that stays (or null) }.
 * `frozen`: the body is frozen (status, not an aura); fire thaws it with a melt, a hard blow shatters it (shatter()).
 */
export function applyElement(auras, element, units = 1, { frozen = false } = {}) {
  const none = { reaction: null, multiplier: 1, absorbed: null, aura: null };
  if (!(units > 0)) return none;
  if (element === 'wind' || element === 'erde') {
    const absorbed = strongest(auras, element === 'wind' ? SWIRLABLE : CRYSTAL);
    if (!absorbed) return none;
    take(auras, absorbed, .5 * units);
    return { reaction: element === 'wind' ? 'wirbel' : 'kristall', multiplier: 1, absorbed, aura: null };
  }
  if (!TABLE[element]) return none;
  // Fire on a frozen body: it melts out of the ice, and that melt hits hard.
  if (frozen && element === 'feuer') { take(auras, 'eis', 2 * units); take(auras, 'nass', units); return { reaction: 'schmelzen', multiplier: 2, absorbed: null, aura: null, thaw: true }; }
  for (const [aura, reaction, multiplier, consumes] of TABLE[element]) {
    if (!((auras[aura] || 0) > 0)) continue;
    if (consumes > 0) take(auras, aura, consumes * units);
    let stays = null;
    // Electro-charged: both stay and feed the shocks. A melt leaves meltwater behind.
    if (reaction === 'elektrisiert') { auras[element] = Math.max(auras[element] || 0, units); stays = element; }
    if (reaction === 'schmelzen') { auras.nass = Math.max(auras.nass || 0, .8); stays = 'nass'; }
    return { reaction, multiplier, absorbed: null, aura: stays };
  }
  // Nothing to react with: it stays as an aura (the same element only tops it up).
  auras[element] = Math.min(2, Math.max(auras[element] || 0, units));
  return { reaction: null, multiplier: 1, absorbed: null, aura: element };
}
function take(auras, el, amount) { if (auras[el] === undefined) return; auras[el] -= amount; if (auras[el] <= .02) delete auras[el]; }

/** Auras fade: one unit lasts its element's duration. */
export function tickAuras(auras, dt) {
  for (const el of Object.keys(auras)) { auras[el] -= dt / (AURAS[el]?.duration || 8); if (auras[el] <= 0) delete auras[el]; }
}
/** A blow on a frozen body (blade, spear, arrow, stone) shatters the ice: extra damage, the freeze ends. */
export const shatterDamage = (hit, magic) => Math.round(hit * .6 + magic * .8);
/** Damage factor while brittle (after superconduct): physical blows bite deeper. */
export const BRITTLE = 1.5;

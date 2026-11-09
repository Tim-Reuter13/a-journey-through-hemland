// The Zauberbuch: every spell the wanderer knows, by element and use, and the rules of the hand (which four are
// ready to cast). Pure data and rules, no DOM and no rendering: the game (main.js, systems/spellcraft.js), the
// book (ui/spellbook.js) and the tests share them.

/** The three chapters of the book. */
export const CHAPTERS = [
  { id: 'elemente', name: 'Die Elemente', numeral: 'I', about: 'Feuer, Eis, Blitz, Wind und Stein: was die Welt im Innersten bewegt.' },
  { id: 'geist', name: 'Licht und Leben', numeral: 'II', about: 'Was leuchtet, heilt und wächst. Leise Künste, und doch die ältesten.' },
  { id: 'hexenwerk', name: 'Hexenwerk', numeral: 'III', about: 'Schatten und Fäulnis. Man lernt sie nicht aus Büchern wie diesem, und doch stehen sie hier.' },
];

/** The elements: colour (ink and glow) and what their light in the hand does (firstPerson.js, spellcraft.js). */
export const ELEMENTS = {
  feuer: { name: 'Feuer', color: '#e8622c', glow: '#ffc46a', ramp: [0xfff3c8, 0xffd060, 0xff8a24, 0xe0451a, 0x5a1608], motion: 'rise', light: 0xff8a3a },
  eis: { name: 'Eis', color: '#5ab4e8', glow: '#d8f2ff', ramp: [0xffffff, 0xd8f2ff, 0x9fd8ff, 0x4f9ad8, 0x1c3f6a], motion: 'fall', light: 0x9fd8ff },
  blitz: { name: 'Blitz', color: '#9a7cf0', glow: '#f0e8ff', ramp: [0xffffff, 0xf0e8ff, 0xc8b0ff, 0x8a62f0, 0x2c1a6a], motion: 'crackle', light: 0xc8b0ff },
  wind: { name: 'Wind', color: '#9cc8b8', glow: '#eefaf4', ramp: [0xffffff, 0xeefaf4, 0xc8e8dc, 0x8ab8a8, 0x34584c], motion: 'orbit', light: 0xd8f0e8 },
  erde: { name: 'Erde', color: '#b0884c', glow: '#f0cf8a', ramp: [0xffe6a8, 0xf0cf8a, 0xc89a52, 0x8a6430, 0x3a2810], motion: 'orbit', light: 0xf0b860 },
  licht: { name: 'Licht', color: '#e8c04c', glow: '#fff6d0', ramp: [0xffffff, 0xfff6d0, 0xffe08a, 0xe8b440, 0x6a4a10], motion: 'rise', light: 0xffe6a8 },
  leben: { name: 'Leben', color: '#6cc46a', glow: '#d8ffc8', ramp: [0xf4ffe8, 0xd8ffc8, 0x9ae88a, 0x4ca84a, 0x1a4a1a], motion: 'spiral', light: 0xa8f0a0 },
  schatten: { name: 'Schatten', color: '#8a5ec8', glow: '#d8c0ff', ramp: [0xd8c0ff, 0x9a6ae0, 0x5a3a9a, 0x2a1a4a, 0x0a0614], motion: 'sink', light: 0x8a5ec8 },
  gift: { name: 'Gift', color: '#8cc43c', glow: '#e4ff9a', ramp: [0xf4ffc8, 0xe4ff9a, 0xa8e050, 0x5a9a28, 0x1a3a0a], motion: 'bubble', light: 0xa8e050 },
};

/**
 * The spells. cost: magicka; power: a factor of the magic damage (or the healing, the reach); cast: how it leaves
 * the hand ('ball' and 'lance' fly, 'glob' is lobbed, 'chain' strikes at once, 'cone' and 'line' sweep the ground,
 * 'self' works on the wanderer). world: what it does to the land round it, shown in the book.
 */
export const SPELLS = {
  funken: { name: 'Funken', element: 'feuer', chapter: 'elemente', use: 'Geschoss', sigil: 'flame', cost: 14, cast: 'ball', power: 1, range: 32,
    desc: 'Ein Ball aus Glut, der auf seinem Weg zischt und dort, wo er einschlägt, alles anzündet.',
    world: 'Setzt Gras, Büsche und Bäume in Brand, sprengt Schilde, lässt Seuchennebel explodieren und schmilzt Eis.' },
  frostlanze: { name: 'Frostlanze', element: 'eis', chapter: 'elemente', use: 'Geschoss', sigil: 'frost', cost: 16, cast: 'lance', power: .72, range: 40,
    desc: 'Ein Speer aus klarem Eis. Wen er trifft, dem gefriert das Blut, und er bewegt sich wie im tiefen Schnee.',
    world: 'Friert Wasser zu einer Scholle, die dich trägt. Löscht Brände und brennende Feinde. Lässt Reif auf dem Boden zurück.' },
  kettenblitz: { name: 'Kettenblitz', element: 'blitz', chapter: 'elemente', use: 'Kette', sigil: 'bolt', cost: 24, cast: 'chain', power: .8, range: 24, jumps: 3,
    desc: 'Ein Blitz, der vom ersten Feind zum nächsten springt, bis zu drei Mal. Wer getroffen wird, zuckt und taumelt.',
    world: 'Im Wasser leitet er: alle, die darin stehen, werden getroffen, auch du. Trockenes Gras fängt Feuer.' },
  sturmstoss: { name: 'Sturmstoß', element: 'wind', chapter: 'elemente', use: 'Stoß', sigil: 'gust', cost: 18, cast: 'cone', power: .3, range: 10,
    desc: 'Eine Faust aus Wind vor dir her. Sie wirft Feinde von den Füßen und alles Lose durch die Luft.',
    world: 'Bläst Feuer aus, treibt Seuchennebel davon, wirbelt Laub und Staub auf, schleudert Kisten, Fässer und Leichen.' },
  erdstachel: { name: 'Erdstachel', element: 'erde', chapter: 'elemente', use: 'Linie', sigil: 'spike', cost: 26, cast: 'line', power: .95, range: 14,
    desc: 'Der Boden bricht in einer Linie auf, Stachel aus Fels schießen empor und schleudern, wen sie treffen.',
    world: 'Folgt dem Gelände bergauf und bergab, endet an Mauern, wirft lose Dinge hoch und reißt den Boden auf.' },
  irrlicht: { name: 'Irrlicht', element: 'licht', chapter: 'geist', use: 'Licht', sigil: 'wisp', cost: 12, cast: 'self', power: 90, range: 0,
    desc: 'Ein Licht, das dir über die Schulter folgt. Neunzig Herzschläge lang, oder bis du es entlässt.',
    world: 'Erhellt Nacht, Wald und Höhle. Goblins scheuen es wie Feuer, und sie sehen es von weit.' },
  lebensquell: { name: 'Lebensquell', element: 'leben', chapter: 'geist', use: 'Heilung', sigil: 'leaf', cost: 30, cast: 'self', power: 48, range: 0,
    desc: 'Grünes Licht steigt aus dem Boden in dich auf und schließt Wunden. Die Heilung kommt in Wellen.',
    world: 'Um deine Füße sprießen Blumen und Gras, auch auf verbrannter Erde.' },
  schattenschritt: { name: 'Schattenschritt', element: 'schatten', chapter: 'hexenwerk', use: 'Bewegung', sigil: 'shade', cost: 20, cast: 'self', power: 9, range: 9,
    desc: 'Du trittst in deinen eigenen Schatten und kommst einige Schritte weiter wieder heraus.',
    world: 'Hält vor Mauern und Abgründen. Wer dich gerade sah, verliert dich aus den Augen. Bleibt beim Schleichen lautlos.' },
  seuchennebel: { name: 'Seuchennebel', element: 'gift', chapter: 'hexenwerk', use: 'Wolke', sigil: 'miasma', cost: 22, cast: 'glob', power: .12, range: 22,
    desc: 'Ein Klumpen grüner Fäulnis, geworfen, nicht gezaubert. Wo er platzt, bleibt ein Nebel, der die Lunge frisst.',
    world: 'Feinde husten und fliehen aus ihm. Feuer bringt ihn zur Explosion, Wind treibt ihn fort.' },
};
export const SPELL_IDS = Object.keys(SPELLS);
export const HAND_SLOTS = 4;
/** What a fresh wanderer has in the hand. */
export const defaultLoadout = () => ['funken', 'frostlanze', 'kettenblitz', 'lebensquell'];

/** A loadout from a save or the book: known spells only, no twins, exactly HAND_SLOTS long (null = empty). */
export function normalizeLoadout(list) {
  const seen = new Set(), out = [];
  for (const id of Array.isArray(list) ? list.slice(0, HAND_SLOTS) : []) {
    const ok = typeof id === 'string' && SPELLS[id] && !seen.has(id);
    out.push(ok ? id : null); if (ok) seen.add(id);
  }
  while (out.length < HAND_SLOTS) out.push(null);
  return out.some(Boolean) ? out : defaultLoadout();
}
/** Lays a spell into a slot of the hand. If it already lies in another slot, the two trade places. */
export function equipSpell(loadout, id, slot) {
  const out = normalizeLoadout(loadout);
  if (!SPELLS[id] || !(slot >= 0 && slot < HAND_SLOTS)) return out;
  const from = out.indexOf(id);
  if (from === slot) return out;
  if (from >= 0) out[from] = out[slot];
  out[slot] = id;
  return out;
}
/** Takes a spell out of the hand (the last one stays: an empty hand casts nothing). */
export function unequipSpell(loadout, slot) {
  const out = normalizeLoadout(loadout);
  if (out.filter(Boolean).length <= 1) return out;
  out[slot] = null; return out;
}
/** The next spell in the hand after the active one (step −1: the one before), skipping empty slots. */
export function cycleSpell(loadout, active, step = 1) {
  const ready = normalizeLoadout(loadout).filter(Boolean);
  const i = ready.indexOf(active);
  if (i < 0) return ready[0];
  return ready[((i + step) % ready.length + ready.length) % ready.length];
}
/** The active spell after the hand changed: it stays if it is still in the hand, else the first one in it. */
export const keepActive = (loadout, active) => normalizeLoadout(loadout).includes(active) ? active : normalizeLoadout(loadout).find(Boolean);

// ── Magicka.
export const BASE_MAGICKA = 100;
/** Magicka per second: quick while the hand rests, slow right after a cast. */
export const magickaRegen = (max, sinceCast) => max * (sinceCast < 1.6 ? .025 : .075);
/** The spell's price in magicka, a little lower with skill in Glutmagie and the perk "Arkaner Fokus". */
export function spellCost(id, { skill = 0, perks = [] } = {}) {
  const base = SPELLS[id]?.cost ?? 0;
  return Math.max(1, Math.round(base * (1 - Math.min(100, skill) * .0025) * (perks.includes('arkaner_fokus') ? .85 : 1)));
}

// ── Pure geometry the spells use (tested).
/** Points of a jagged bolt from a to b: `segments` + 1 points, the inner ones pushed sideways up to `jitter`. */
export function boltPath(a, b, segments = 10, jitter = .5, random = Math.random) {
  const points = [];
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, len = Math.hypot(dx, dy, dz) || 1;
  // Two directions across the bolt.
  let ux = -dz, uy = 0, uz = dx; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
  if (ul < 1e-6) { ux = 1; uz = 0; }
  const vx = dy * uz - dz * uy, vy = dz * ux - dx * uz, vz = dx * uy - dy * ux, vl = Math.hypot(vx, vy, vz) || 1;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, edge = i === 0 || i === segments ? 0 : Math.sin(t * Math.PI);
    const u = (random() - .5) * 2 * jitter * edge, v = (random() - .5) * 2 * jitter * edge;
    points.push({ x: a.x + dx * t + ux * u + vx / vl * v, y: a.y + dy * t + uy * u + vy / vl * v, z: a.z + dz * t + uz * u + vz / vl * v });
  }
  return points;
}
/** The chain of a lightning bolt: from the first target, each jump to the nearest one not yet struck. */
export function chainTargets(first, candidates, { jumps = 3, reach = 7, position = t => t.position } = {}) {
  if (!first) return [];
  const chain = [first], left = candidates.filter(c => c !== first);
  while (chain.length <= jumps) {
    const from = position(chain.at(-1));
    let best = null, bestD = reach;
    for (const c of left) { const p = position(c), d = Math.hypot(p.x - from.x, p.z - from.z, (p.y ?? 0) - (from.y ?? 0)); if (d < bestD) { best = c; bestD = d; } }
    if (!best) break;
    chain.push(best); left.splice(left.indexOf(best), 1);
  }
  return chain;
}
/** Is a point inside a cone (apex, unit direction on the ground, range, half angle in radians)? */
export function inCone(apex, dir, point, range, half) {
  const dx = point.x - apex.x, dz = point.z - apex.z, d = Math.hypot(dx, dz);
  if (d > range) return false;
  if (d < .01) return true;
  return (dx * dir.x + dz * dir.z) / d >= Math.cos(half);
}

// Combat 2.0 — how one person fights a duel (docs/COMBAT_2.md, Phase 3). The brain (brain.js) decides *whether*
// to fight (engage, retreat, flee, yield); this layer decides *how*, as a commitment held for a while: where to
// stand (relative to their own real reach), when a blow is worth it, heavy or light, feint or not, guard or not.
// A commitment ends when its time is up or a reason appears (logged, shown in the F7 view). Who they are decides
// what they can do: a novice presses or probes whatever happens and does not read the wanderer; a veteran reads
// the habits they have seen (combatMemory.js) and answers them. Pure: tests/combatAi.test.js.

/** spacing: metres beyond (+) or inside (−) the edge of their own reach; attack: 'ready' (whenever in reach),
 *  'opening' (only when the wanderer is recovering, staggered or broken), 'never'; heavy/feint: chance per blow;
 *  chain: chance to follow up at once. */
export const TACTICS = {
  probe: { label: 'Deckung testen', min: 2.2, spacing: -.05, attack: 'ready', heavy: .05, feint: 0, chain: .15 },
  press: { label: 'Druck machen', min: 2, spacing: -.35, attack: 'ready', heavy: .12, feint: 0, chain: .6 },
  punish: { label: 'Auf Lücke warten', min: 3, spacing: .75, attack: 'opening', heavy: .2, feint: 0, chain: .25 },
  bait: { label: 'Täuschen', min: 2.6, spacing: -.1, attack: 'ready', heavy: 0, feint: .65, chain: .15 },
  crush: { label: 'Deckung brechen', min: 2.6, spacing: -.2, attack: 'ready', heavy: .75, feint: 0, chain: .3 },
  recover: { label: 'Luft holen', min: 2.4, spacing: 2.4, attack: 'never', heavy: 0, feint: 0, chain: 0, guard: true },
};

/**
 * v: { skill (0–1), traits, archetype, stamina (0–100), posture (0–1), hp (0–1), fear (0–1), inj (injuryEffects),
 *      mem (readMemory or null), playerCharging (bool), random () → 0–1 }
 * → { id, reason }
 */
export function chooseTactic(v) {
  const r = v.random ?? Math.random, tr = v.traits || {}, mem = v.mem, sure = mem ? mem.certainty : 0;
  if (v.stamina < 24 || v.posture < .3) return { id: 'recover', reason: v.stamina < 24 ? 'außer Atem' : 'Haltung wankt' };
  if (v.inj && v.inj.attack < .65) return { id: v.skill > .55 ? 'punish' : 'recover', reason: 'Schwertarm verletzt' };
  if (v.inj && v.inj.move < .6) return { id: 'punish', reason: 'Bein verletzt: bleibt stehen' };
  // Who they are first: a berserker crushes and presses, a novice presses or probes and reads nothing.
  if (v.archetype === 'berserker') return r() < .5 ? { id: 'crush', reason: 'Raserei' } : { id: 'press', reason: 'Raserei' };
  if (v.skill < .5 || sure < .35) {
    const rash = (tr.aggression ?? .5) + (v.skill < .5 ? .15 : 0) - v.fear * .4;
    return r() < rash ? { id: 'press', reason: v.skill < .5 ? 'Anfänger: drauflos' : 'noch kein Bild von ihm' } : { id: 'probe', reason: sure < .35 ? 'noch kein Bild von ihm' : 'vorsichtig' };
  }
  // A veteran answers what they have seen.
  const options = [];
  if (mem.parry > .3) options.push({ id: 'bait', w: mem.parry * 1.6 * sure, reason: `er pariert oft (${Math.round(mem.parry * 100)}%)` });
  if (mem.block > .35 || mem.guarding > .45) options.push({ id: 'crush', w: Math.max(mem.block, mem.guarding) * 1.3 * sure, reason: `er verschanzt sich (Deckung ${Math.round(mem.guarding * 100)}%)` });
  if (mem.whiff > .3 || mem.rate > 3.2) options.push({ id: 'punish', w: Math.max(mem.whiff * 1.4, mem.rate / 6) * sure, reason: mem.whiff > .3 ? `er schlägt ins Leere (${Math.round(mem.whiff * 100)}%)` : 'er greift ständig an' });
  if (mem.open > .45) options.push({ id: 'press', w: mem.open * 1.2 * sure, reason: `seine Deckung ist offen (${Math.round(mem.open * 100)}%)` });
  options.push({ id: 'probe', w: .25, reason: 'Deckung testen' });
  let pick = r() * options.reduce((s, o) => s + o.w, 0);
  for (const o of options) { pick -= o.w; if (pick <= 0) return { id: o.id, reason: o.reason }; }
  return { id: 'probe', reason: 'Deckung testen' };
}

/** A reason to give the commitment up early, or null. c: the commitment ({ id, since, hits, feints, bitten }). */
export function shouldAbort(c, v, now) {
  if (c.id === 'recover') return v.stamina > 70 && v.posture > .75 ? 'erholt' : null;
  if (v.stamina < 18) return 'außer Atem';
  if (c.hits >= 2) return 'zu viele Treffer eingesteckt';
  if (c.id === 'bait' && c.feints >= 2 && !c.bitten) return 'Finte wirkt nicht';
  if (c.id === 'crush' && c.broke) return 'Deckung gebrochen';
  if (c.id === 'press' && v.fear > .55) return 'Mut verloren';
  return null;
}

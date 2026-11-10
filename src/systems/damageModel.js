import { DEFENSE } from './combatRules.js';

// Combat 2.0 — what a contact does (docs/COMBAT_2.md). Pure rules, no scene: tests/combat2.test.js.
// A contact is first met by the defence (a raised guard, a shield, a parry), then by the armour and the body.

/** How much a blow on each part of the body hurts. */
export const REGION_DAMAGE = { head: 1.5, neck: 1.6, torso: 1, arm: .72, hand: .55, leg: .82, foot: .6, shield: 0 };
/** How much each kind of weapon keeps through each armour class (blood.js probe classes). */
export const ARMOR_PASS = {
  cut: { plate: .25, mail: .5, leather: .82, none: 1 },
  chop: { plate: .45, mail: .62, leather: .88, none: 1 },
  thrust: { plate: .4, mail: .7, leather: .88, none: 1 },
  blunt: { plate: .75, mail: .85, leather: .95, none: 1 },
};
/** The speed (m/s) at which a blade's point does its full work; slower contacts (the very start of a swing, the end of
 *  a follow-through, a hilt in someone's face) hurt less. */
export const NOMINAL_SPEED = { cut: 28, chop: 30, thrust: 9, blunt: 18 };

/** Where an attack comes from, seen by the defender: cosine between their facing and the line to the attacker. */
export function facingCos(defYaw, dx, dz) {
  const d = Math.hypot(dx, dz) || 1;
  return (-Math.sin(defYaw) * dx - Math.cos(defYaw) * dz) / d;
}

/**
 * The defence against a contact. d: {
 *   guard (raised), guardAt (when it went up), now, cos (facingCos to the attacker), stamina, posture (0–1),
 *   shield (contact on a shield), force, posture of the attack (attack.posture), heavy, skill (0–1 of the defender),
 *   canParry (default true) }
 * → { outcome: 'parry'|'block'|'bad'|'shield'|'none', damage (× of the blow that still lands), stamina (cost),
 *     posture (cost to the defender), attackerPosture (cost to the attacker), broken (the guard gives way), why }
 */
export function defend(d) {
  const force = d.force ?? 1, heavy = !!d.heavy, skill = d.skill ?? .5, now = d.now ?? 0;
  const cost = force * DEFENSE.staminaPerForce * (heavy ? 1.35 : 1) * (1 - skill * .25);
  const take = (d.attackPosture ?? .15) * (heavy ? 1.2 : 1);
  if (d.shield) {
    // The shield is in the way — whatever the guard says. A tired arm or a broken stance lets it be beaten aside.
    const stamina = cost * .8, posture = take * .7 * (1 - skill * .3);
    const broken = d.stamina < stamina || d.posture - posture <= 0;
    return { outcome: 'shield', damage: broken ? .15 : 0, stamina, posture: broken ? Math.max(posture, d.posture) : posture, attackerPosture: heavy ? 0 : .04, broken, why: broken ? 'Schildarm erschöpft' : 'Schild' };
  }
  if (!d.guard) return { outcome: 'none', damage: 1, stamina: 0, posture: take * .6, attackerPosture: 0, broken: false, why: 'keine Deckung' };
  if (d.cos < DEFENSE.flank) return { outcome: 'none', damage: 1, stamina: 0, posture: take * .8, attackerPosture: 0, broken: false, why: 'von hinten' };
  const since = now - (d.guardAt ?? -9);
  // Turned the wrong way: the guard is there but cannot meet the blade square.
  if (d.cos < DEFENSE.arc) {
    const posture = take * 1.25;
    return { outcome: 'bad', damage: DEFENSE.badDamage, stamina: cost * .8, posture, attackerPosture: 0, broken: d.posture - posture <= 0, why: 'falsche Richtung' };
  }
  if (since < .03) {
    const posture = take * 1.1;
    return { outcome: 'bad', damage: DEFENSE.badDamage, stamina: cost, posture, attackerPosture: 0, broken: d.posture - posture <= 0, why: 'zu spät' };
  }
  if (since <= DEFENSE.parry && d.canParry !== false) {
    // The blade is met at the last moment and turned: the attacker is thrown off balance, the defender barely pays.
    return { outcome: 'parry', damage: 0, stamina: cost * .25, posture: take * .1, attackerPosture: heavy ? .45 : .55, broken: false, why: 'Parade im Moment des Treffers' };
  }
  if (d.stamina < cost) {
    const posture = Math.max(take * 1.5, d.posture);
    return { outcome: 'bad', damage: DEFENSE.badDamage, stamina: d.stamina, posture, attackerPosture: 0, broken: true, why: 'zu wenig Ausdauer' };
  }
  const posture = take * (1 - skill * .25);
  const broken = d.posture - posture <= 0;
  return { outcome: 'block', damage: broken ? DEFENSE.badDamage : DEFENSE.blockDamage, stamina: cost, posture, attackerPosture: heavy ? 0 : .03, broken, why: broken ? 'Haltung gebrochen' : 'Deckung gehalten' };
}

/**
 * What a blow does to a body. h: { base (weapon damage), mult (attack damage ×), kind ('cut'|'thrust'|'chop'|'blunt'),
 *   region (REGION_DAMAGE key), armor ('plate'|'mail'|'leather'|'none'), speed (m/s at the contact), edge (bool: the
 *   cutting part hit), defence (× from defend), force (attack force), mass (weapon) }
 * → { damage, posture (taken from the body's composure 0–1), force (impulse for MOTION), injury (0–1 added to the
 *   limb), bleed, why }
 */
export function strike(h) {
  const kind = h.edge === false ? 'blunt' : h.kind || 'cut';
  const speedK = Math.min(1.2, Math.max(.3, (h.speed ?? NOMINAL_SPEED[kind]) / NOMINAL_SPEED[kind]));
  const region = REGION_DAMAGE[h.region] ?? 1, armor = (ARMOR_PASS[kind] || ARMOR_PASS.cut)[h.armor || 'none'] ?? 1;
  const edgeK = h.edge === false ? .25 : 1, defence = h.defence ?? 1;
  const damage = Math.max(0, (h.base ?? 20) * (h.mult ?? 1) * speedK * region * armor * edgeK * defence);
  const weight = (h.mass ?? 1.2) * speedK;
  const posture = (h.posture ?? .15) * (.6 + weight * .35) * (h.region === 'head' ? 1.4 : 1) * (defence > 0 ? 1 : .5);
  const injury = h.region === 'head' || h.region === 'torso' || h.region === 'neck' ? damage / 120 : damage / 70;
  return { damage, posture, force: (h.force ?? 1) * (.5 + speedK * .6) * (defence > .3 ? 1 : .5), injury: Math.min(1, injury * (armor < .5 ? .5 : 1)),
    bleed: kind === 'blunt' ? 0 : damage * armor / 60, why: `${kind} · ${h.region} · ${h.armor || 'none'} · v${(h.speed ?? 0).toFixed(1)}` };
}

/**
 * What injuries do to a fighter. injury: MOTION's { leg_right, leg_left, arm_right, arm_left, torso } (0–1), head (0–1 daze).
 * → multipliers: attack (speed of attacks: their prepare/recover stretch by 1/attack), guard (strength of a block: stamina and
 *   posture cost ×1/guard), move (walking and stepping in), stamina (regeneration), reaction (+seconds), aim (radians of error),
 *   lunge, and flags: dropRisk (weapon arm ruined), limp.
 */
export function injuryEffects(injury) {
  injury = injury || {};
  const arm = injury.arm_right ?? 0, off = injury.arm_left ?? 0, leg = Math.max(injury.leg_right ?? 0, injury.leg_left ?? 0), torso = injury.torso ?? 0, head = injury.head ?? 0;
  return {
    attack: 1 - arm * .45 - torso * .15,
    guard: 1 - arm * .35 - off * .25,
    move: 1 - leg * .55 - torso * .15,
    lunge: 1 - leg * .8,
    stamina: 1 - torso * .5 - leg * .15,
    reaction: head * .25 + torso * .05,
    aim: head * .25 + arm * .12,
    dropRisk: arm > .75, limp: leg > .25,
  };
}

/** Composure comes back when nobody presses you: faster at rest, slower tired or hurt. */
export function postureRegen(posture, dt, { since = 9, guarding = false, attacking = false, stamina = 1, injured = 0 } = {}) {
  if (since < DEFENSE.postureDelay || attacking) return posture;
  const rate = DEFENSE.postureRegen * (guarding ? .6 : 1) * (.45 + stamina * .55) * (1 - injured * .5);
  return Math.min(1, posture + rate * dt);
}

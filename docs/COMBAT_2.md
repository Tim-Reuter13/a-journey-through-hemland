# Combat 2.0 — physical combat and consequence AI

Goal: one honest duel first (the wanderer against one human bandit with a sword), then scale it to groups and to every
enemy type. A blow only lands where the weapon really is; every decision of an opponent has a mechanical effect.

## Phase 0 — audit (2026-11-10, baseline: 222 tests green, build green)

### What was there

| Area | Before Combat 2.0 | Problem |
|---|---|---|
| Player sword | `combat.js resolveSword()` at one impact instant (`crossedImpact`): a crosshair ray (`blood.pick`) or a score over reach 3.2 / arc / pitch picks *one* target | Hits without the blade being there: the result never looked at the weapon. A blade that visibly passes beside the foe still hits. Walls only checked as eye→target line. |
| Player spear | the same with reach 4.5 and a narrow arc | as above |
| NPC melee | `driveAI` sets `e.windup`; when it runs out, `strikeLands()` takes HP if `distance < reach` and the eye line is free | Timer hits: the blade of the bandit never has to touch the wanderer. |
| Legacy NPC melee (no brain) | `updateEnemies` windup → `t.damage` | same |
| Player defence | RMB `guard`; any frontal blow costs 12 stamina; `time - guardStart < .32` = parry | No directional nuance besides a ±75° cone, no bad defence, stamina only. |
| NPC defence | `enemy.blocking` from a reflex roll (`brain.reflex`), `amount *= .2`; shield bearers: `inAttackArc` + `shieldUp` | Block is a flag, not a body; a shield never physically stopped a blade. |
| Guard break | the third combo blow (`combo === 2`) or `stamina < 10` breaks a shield guard | Pure counter rule. |
| Player invulnerability | `main.js hurt()` sets `player.invuln = .65` after every hit | Two foes striking within 0.65 s: the second blow is lost. |
| Stamina / posture | stamina only; HUMANITY MOTION has a physical balance (push stages) | no posture that blows can break |
| Injuries | MOTION `a.injury` (legs, arms, torso) from `impact()` zones; combat adds `limpUntil` (leg), `cooldown` (arm), stagger (head) | effects were short timers; the AI did not reason about them |
| Fixed step | `main.js animate()`: 60 Hz accumulator; `combat.update` runs inside it | enemy and player poses are animated per *rendered* frame (`animateActors`), so a weapon pose never existed in the simulation |
| AI | HUMANITY AI utility actions (engage, pressure with feints, flank, retreat, flee, surrender, …), emotions, groups, persistence of surrender | no memory of how the wanderer fights, no commitments with an abort reason, mistakes only as a reflex roll |
| Debug | F6 panel: action, reason, emotions | nothing about blows: why hit, why missed, phases |

### Subsystems kept as they are

HUMANITY AI layers A–G (perception, beliefs, emotions, utility, groups) and HUMANITY MOTION (balance, falls, get-ups,
grapples, foot IK) work and stay; Combat 2.0 feeds them real events instead of replacing them. Blood (wound decals,
`effects.probe`), blade blood, spell runtime, archery and reactions stay untouched.

## Architecture

```
combatRules.js     data: weapons (length, edge, mass, damage kinds), attacks (phases, cost, posture, lunge, blade track),
                   defence windows, stamina/posture tunables; pure helpers (phaseAt, sampleTrack)
meleeCollision.js  pure: blade segment of an attack at time t in body space → world; body colliders (capsules/spheres from
                   the animated rig snapshot, parametric fallback), shields (oriented boxes); swept test between two
                   simulation times with adaptive sub-steps and bisection to the first contact; walls/ground stop blades
combatState.js     per fighter (player and NPCs): attack lifecycle (prepare → active → recover | interrupted), guard (raised
                   at, direction), stamina, posture, stagger, dedupe of attack ids
damageModel.js     pure: defence outcome (parry / block / bad block / none) from timing, direction, stamina, force;
                   damage by weapon kind × region × armour; posture damage; injuries and what they do
combatEvents.js    event bus + ring log (attack started/missed, contact, blocked, parried, posture broken, injury, …);
                   the AI's combat memory and the debug view listen to it
ai/combatMemory.js what an NPC has seen of the wanderer (attack rhythm, favourite opener, block and parry habits,
                   retreats) — uncertain, decaying, per NPC
ai/combatTactics.js duel commitments (probe, press, bait, punish, recover, disengage) with minimum durations, abort reasons,
                   mistakes and feints; executed by combat.js through the same attack/guard pipeline as the player
```

One pipeline for both sides, inside the fixed 60 Hz step:

```
startAttack → (prepare) → active: sweep blade(t₀→t₁) vs colliders → first contact
  → shield? wall? ally? → defence(timing, direction, stamina, posture) → damageModel → apply (HP, posture, injury,
    MOTION impulse, stagger) → reaction (interrupt, recoil, riposte window) → combatEvents → AI memory/emotions
```

The blade pose is *authoritative data*: each attack has a track (hilt position + blade direction over normalised time, in
body space). The simulation samples it at simulation time; the third-person animator puts the hand on the hilt with arm IK
and lays the blade along the same line; the first-person view draws the same world blade projected through the eye, so
what you see is what collides.

## Migration plan (each phase ends green: tests, build, scenario check, docs)

1. **Physical foundation** — rules data, collision module, fighter state, events, damage model; player sword and spear
   and the human NPC's sword through it; no damage without contact; dedupe per attack id; walls stop blades; NPC
   blades through the same sweep against the wanderer's colliders; animator/FP follow the track. Tests: miss beside,
   hit across, dedupe, shield first, wall, 30/60/144 Hz equivalence.
2. **Unified reactions** — three defence outcomes for both sides, directional guard, stamina vs posture, guard break by
   posture (not combo count), injuries with mechanical effects, `player.invuln` replaced by attack-id dedupe.
3. **Tactical execution** — commitments, feints, mistakes, punishing recoveries, recovering stamina; personality
   differences (novice vs veteran) visible in a duel.
4. **Consequence AI** — combat memory, adaptation, injuries/morale decide retreat (reachable path), surrender
   (persistent), flight.
5. **Groups** — slots and roles on top of the new tactics, allies as blade obstacles, leader loss.
6. **All enemy types** — wolves (bite tracks), goblins (goblins.js thrusts and specials), mages/archers in melee.
7. **Polish** — performance budget, debug trajectories, tuning, acceptance runs.

## Status (milestone 1, 2026-11-10): the duel

Connected to the running simulation (not only in tests):

| Brief | What runs | Where |
|---|---|---|
| Continuous weapon collision | blades are tracks sampled at simulation time; swept with adaptive sub-steps (point moves ≤ 8 cm) and bisection to the first touch; body capsules from the animated rig (snapshot per rendered frame, carried with the simulated position); shields are boxes from the shield mesh | `meleeCollision.js`, `melee.js` |
| No damage without contact | the wanderer's sword/spear and every human foe's blade; `resolveSword` (crosshair + reach/angle score) and the windup timer hit (`strikeLands`) are gone for people | `combat.js`, `melee.js` |
| Walls stop weapons | a blade meeting a collider or the ground rebounds (sparks / splinters / dust, sound, recovery) | `sweep()` world probe |
| Dedupe | an attack strikes a body once (attack id); `player.invuln` is 0 for blows (0.25 s left for fire, arrows, bolts) | `combatState.firstStrike`, `main.js hurt()` |
| Region from contact | the capsule that was touched (head, chest, belly, arms, hands, thighs, shins) → damage, MOTION zone, injuries | `regionOf`, `damageModel.strike` |
| Framerate independence | only simulation time is sampled; same contact at 30/60/144 steps per second (test L) | `tests/combat2.test.js` |
| Attack phases, data-driven | prepare / active / recover / interrupted (rebound, hit, feint, stagger); 6 attacks with tracks; sword, spear (axe, mace, unarmed as weapon data, no wielders yet) | `combatRules.js` |
| Controls | LMB tap: blow (forehand → backhand → chop in rhythm); LMB held at the top of the wind-up: the blow is held back and loaded (heavier, more posture damage, readable for foes); RMB: guard, raised just before the blade arrives = parry | `melee.playerStart/Release` |
| Defence outcomes | parry (guard ≤ 0.2 s before contact: attacker thrown back, longer recovery, counter window), block (damage ×0.12, stamina and posture), bad defence (too late, wrong side, too tired: damage ×0.55), none (from behind); shields block physically | `damageModel.defend` |
| Stamina vs posture | stamina pays for blows and blocks; posture (0–1) is taken by blocked and landed blows by weight and speed, breaks the guard at 0, comes back when nobody presses | `combatState`, `damageModel.postureRegen` |
| Guard break | by posture and stamina, not by a combo counter (`combo === 2` removed) | `defend`, `breakGuardOf` |
| Injuries by region | MOTION's wounds now act: arm → slower blows, weaker guard, disarm at a ruined sword arm; leg → slower, no lunge, limp; torso → less stamina; the brain reasons with them (retreat, flee, surrender scores) | `injuryEffects`, `brain.js situation` |
| FP / TP same result | the wanderer's blade is computed from the body (position, facing, view pitch about the shoulders), not the camera; third person lays the arm on it by IK, first person draws the same blade along the same screen line | `animator.bladeArm`, `firstPerson.projectBlade` |
| Duel AI (Phase 3) | commitments `probe / press / punish / bait / crush / recover` with minimum time and logged abort reasons; spacing against their own real reach; feints (the wind-up cancelled, the real blow at once); step-in to punish a recovery; skilled foes step out of a loaded blow | `ai/combatTactics.js`, `combat.applyTactic` |
| Mistakes | novices wind up slower, misjudge distance (swing from too far), follow up into a raised guard, react late (reflex) and do not read the wanderer | `misjudge`, `afterBlow`, `chooseTactic` |
| Combat memory (Phase 4) | each foe remembers what they saw: attack rate, rhythm, favourite opener, parry/block/open rates, whiffs, heavies, time in guard — fading (30 s), with certainty | `ai/combatMemory.js` |
| Consequences | parried/missed/blocked blows move confidence and fear; disarmed fighters retreat and are more likely to yield; low health and fear lead to retreat on a reachable path (navGrid) and flight; surrender stays persistent (saved) | `brain.js` |
| Debug view | F7: per fighter action and reason, commitment and why it ended, distance goal, stamina, posture, wounds, fear/confidence, memory; the last events with reasons; the blades in the world (red active, amber wind-up/recovery) | `ui/combatDebug.js` |

Checked: 243 tests (16 collision/defence/damage/state, 5 memory/tactics), build, and in the browser a scripted
duel against a novice and a veteran (40 s each): the novice presses and probes, swings from too far, overcommits
into the guard (posture broken three times); the veteran reads "er schlägt ins Leere", "seine Deckung ist offen",
"er verschanzt sich", recovers when his posture wavers and retreats when badly hurt. Scenarios: miss out of reach,
beside, over the head; shield stops a low blade, a head-high blade passes over it; a blow from behind ignores a
raised guard; a ruined sword arm drops the blade and the fighter backs off; a badly hurt fighter retreats 9 m on a
free path.

## Limitations (named, not hidden)

- Wolves still bite on a timer (`strikeLands`, beasts only) and goblins (`goblins.js`) keep their own lunging
  thrusts: Phase 6.
- Groups use the old slot system on top of the new tactics; allies already stop a blade (no friendly wound) but
  the AI does not yet avoid swinging through a comrade: Phase 5.
- Archers and hedge-witches in melee use the sword data (no punch/staff tracks yet).
- Body capsules follow the last rendered pose (≤ one frame old); without a rendered frame (tests) a standing pose.
- The third-person arm reaches the hilt by IK; where a key is out of reach the hand stops up to ~15 cm short.
- In first person the wind-up behind the shoulder is drawn with the old strike keys (the real hilt is behind the eye).
- The wanderer cannot feint (no extra key); holding the blow back is the mix-up.

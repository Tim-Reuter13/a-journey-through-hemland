# HUMANITY AI

Enemy behaviour for Hemland: people (and wolves) who perceive, believe, fear, plan, talk to each other
and live a day. Local, deterministic per seed, no network calls.

## Phase 0 — what was there (2026-10-28)

| Area | Before | Integration point now |
|---|---|---|
| Enemy AI | `combat.js think()`: fixed plans (circle/approach/strike/flee), one attack slot, knew the player's position at all times | `combat.js driveAI()` executes brain intents; `think()` remains for enemies without a brain (tests) and as the wolves' pack hunting |
| Hostility | `enemy.calm` flag, camp hostile on any hit (`captain_hostile`) | brains map `calm` → `territorial`; `main.js provokeCamp()` keeps the quest flags |
| Story | camp dialogue with Rauk (`captain_spared`, `camp_truce`), kill quest only for wolves | Rauk never yields (`noSurrender`), wolves only retreat for a while, so every quest stays solvable |
| Encounters | `spawnEnemy()` road thieves / wolf packs, despawn at 170 m | each spawn gets a brain, a group per encounter, maybe a toll or a known face |
| Navigation | `navGrid.js` budgeted A*, `moveEnemy` side-stepping | `detour()` now plans to any goal, not only to the player |
| Saves | enemies: `hp`, `dead`, `loot` | + `ai` (state, spared, robbed, memories); faction memory in flags `ai_*` |
| Animation | procedural poses in `animator.js` | new poses: surrender, tense (the tell), warn, parley, search, guardReady, cower |

## Architecture

```
perception.js  A  sight cone · light · stance · walls → awareness; hearing via the sound bus (walls muffle,
                  far sounds are vague); the wanderer's own footsteps by stance and armour
memory.js      B  beliefs: last known position + decaying quality + source (sight, glimpse, step, ruf:<who>,
                  pfeil, schmerz); unseen archers guessed from arrows and refined; personal memories
config.js      C  15 traits · 8 archetypes (incl. shield bearer and mage) · tunables · lines; personalities are seeded (same person after a load)
brain.js     C–E  emotions (events + drift) · hostility states · 25 utility actions with hysteresis, minimum
                  durations, cooldowns and an emergency interrupt · reflexes · persist/restore
spatial.js     E  flank, cover, escape (cornered = none), archer spot, ring points, ally-free lines
group.js       G  soft attack slots (1, 2 when a disciplined leader leads 3+) · leader orders by shout ·
                  obedience · heir after the leader falls · friendships and rivalries · search parties
                  for a lost trail or a missing comrade
camp.js        H  the camp's day: shifts that always keep a watch, patrol, hunter, meals, sleep
main.js           the camp over days (updateCampDays): reinforcements, abandonment, burial, a new band
manager.js        staggered layers (sense 160 ms, think 320 ms, groups 300 ms, budget 6 brains/frame, slower
                  beyond 70 m, scheduled positions beyond 170 m) · delivers deaths, wounds, near misses, fire
combat.js      F  execution: movement round obstacles, human turning rates, reaction-time blocks and dodges,
                  stamina, strikes only in reach and in sight, archers' bow/blade switch, raised shields
                  (arrows stick in them), mage casts with wind-up (bolt, heal) and mana
ui/barks.js       shouts over heads; F6 debug panel and labels (main.js)
```

## Status — what really works (verified by tests and playtests)

- **Perception without cheating.** Behind a wall nobody knows you are there; information spreads only by
  shouts that are heard (tests 7, 8, 15). Sleepers wake on loud sounds.
- **Individuals.** Trait-driven decisions: the same bow makes most lone novices yield (≥ 7/12 in test 3), an
  armoured veteran with friends rarely (≤ 2/10, test 4); berserkers rush in without a slot.
- **De-escalation.** Camp guards call a halt, demand the bow be lowered, give a last warning, then the camp
  fights (also when you aim at a comrade). Bandits at bow-point drop their weapon at their feet and raise
  their hands; you can take their valuables and let them go; they leave, are remembered by name and may
  meet you again and step aside. Road thieves may ask for a 20-gold toll instead of fighting.
- **Feigned surrender.** Rare (sly, greedy, still aggressive), only once the bow is lowered and your back is
  turned, after a visible tell (head down to the weapon, hands sinking) — test 6.
- **Group fighting without a clump.** At most two attack at once, the rest press on a ring, feint, flank on
  order or on their own, and still block or dodge (tests 12, 13; playtest with four).
- **Morale.** Wounds, witnessed deaths (weighted by friendship and losses), leaders falling, allies fleeing
  or yielding move fear; the wounded back off, the cornered fight or yield, fleeing is penalised in the
  open under a drawn bow (tests 16–21).
- **Arrows.** Near misses frighten and send people to cover with a callout; an unseen archer is only
  guessed; archers keep range, never shoot through friends, switch to the blade when pressed (tests 9, 14).
- **Fire.** Burning ground is avoided and frightens; seen spell charges make the careful side-step.
- **Shield bearers.** Advance behind a raised shield while your bow is drawn; arrows from the front stick in
  the shield and do no harm (playtest: 3 arrows, 0 damage), so they fear the bow less and rarely yield.
  Blocks cost stamina; from the side or behind they are open (test 31).
- **Mages.** Keep 5–24 m, cast a visible, interruptible bolt (wind-up 1.25 s, guard halves it) and heal hurt
  allies (playtest: 30 → 58 hp). Mana runs dry and regrows; without it they back off and fear more (test 30).
- **Search parties and the missing.** When the trail goes cold the leader shouts two people out to comb the
  area while he stays; a comrade who dies unseen is missed after 40 s ("Wo bleibt Hilde?"), searched for,
  and found ("Hier liegt Hilde! Tot!"), which frightens the camp (tests 32, 33; playtest).
- **The camp over days.** Kill men while Rauk lives and he gets up to two more after two days (armed against
  you if you started the fight). Rauk dead and at most one left: the camp is given up, the last leave when
  you are away. Two days later a new band moves in (leader, shield bearer, archer, mercenary; a mage if you
  burned or shot them often), buries the old dead and lives by the same shifts. Survives save and load.
- **Camp life.** Watches rotate, the patrol leaves the camp, the hunter goes some 50 m out; an unwatched
  camp is where its day says (tests 23–25).
- **Faction memory.** Survivors tell the others: fire → more distance, bow → more archers and cover,
  killing the yielded → nobody yields to you; mercy → more yield. Saved in flags.
- **Saves.** Yielded, spared and robbed states and memories survive (test 26 through the real save path).
- **Performance.** In game: 23 brains, 16 near, 0.075 ms per frame on average, 0.4 ms worst. Test 29:
  20 brains for 30 s never exceed the think budget and stay finite.
- **Debug.** F6 shows per brain: state, fear, confidence, anger, stamina, what they know of the wanderer
  (and from where), action, slot, order, the reason and the top utility scores; labels over heads.

## Partial or missing

- 17 hostility states are folded into 10 (neutral = unaware/territorial, alert/kampfbereit = searching/
  hostile, disarmed = flag); "retreat" is an action, not a state.
- Magic reactions cover fire only (the wanderer's only spell). Mages cast one bolt and one heal; no wards,
  no summoning. Shield bearers have no shield bash and no true shield wall in formation.
- NPCs use no potions; no wounded posture (limp, holding the side).
- Callouts are text barks, not voiced.
- The new band is a fresh group: it does not know you, and there is no off-screen economy (supplies, raids
  on the village) beyond schedule positions and the day counter.
- Per-person long-term memory for passing strangers is limited to the four last spared people.
- The debug view is text; sight cones, hearing ranges and cover points are not drawn.

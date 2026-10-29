# HUMANITY MOTION

Physical presence for every human body in Hemland: the wanderer and every person share one ground rule,
one balance model, one grip system, one way of falling and getting up.

## Phase 0 — what was there (2026-10-29)

| Question | Answer in this repo |
| --- | --- |
| Humanoid skeleton? | Yes: Blockbench box rig `root › hips › torso › chest › neck › head`, arms `arm_upper/lower/hand/grip`, legs `leg_upper/lower/foot`, cape 1–3 (`art/blockbench/parts.js`). |
| SkinnedMesh? | No. Rigid parts merged per bone (`characters/modular.js`). IK rotates bones; nothing deforms. |
| Bone names uniform? | Yes for all humans (two bodies, male/female, same names). Wolves have their own rig. |
| Fingers, toes, twist bones, clavicles? | None. Hands are one box; shoulders are the upper-arm pivot. |
| Face? | No bones or morph targets: three quads with UV frames (blink, brows, mouth). |
| Animation clips? | None. Everything is procedural (`characters/animator.js`): distance-driven gait, keyframed upper-body tracks, poses. |
| Root motion? | No. Controllers move the root; the animator reads the displacement. |
| Weapons in hands? | Children of `grip_right` / `grip_left`. |
| NPC navigation and ground? | Grid paths (`navGrid.js`); NPCs stood on `heightAt` only, the wanderer also on collider tops (`supportAt`) — different rules. |
| Physics? | Rapier: props and death ragdolls with muscle tone (`systems/ragdoll.js`); bodies were not physical while alive. |

So: real IK is possible on this rig (two-bone limbs, a short spine), but there is no hand or finger
detail to grip with, and no mesh deformation. Nothing here claims otherwise.

## Architecture

```
rig.js      adapter: logical humanoid bones (Hips, LeftUpperLeg, …) → rig names; reports what is missing
ik.js    D  two-bone IK with pole, maximum flexion and reach limit, unreachable reported; FABRIK; turnBone;
            keep-out-of-torso for hand targets; world-space pose capture/blend (ragdoll → animation)
feet.js  D  foot IK: real ground per foot (terrain, steps, floors, crates — the controllers' rule),
            smoothed hits, foot locking in the contact phase with soft release (a small step when turning
            in place), pelvis drop for the lower foot, planted foot tilted to the ground (≤ 30°)
balance.js E  forces with direction → minor / stagger / major / fall; resistance from armour, size, guard,
            attack, sprint, stamina, wounded legs; instability accumulates; damped upper-body sway; hit zones
grapple.js F  grip state machine (AttemptingGrab … Recovering), strength model, eligibility, struggle,
            escape, takedown only off balance, holds tire and end
motion.js   coordinator: shared standY(), impacts → zones, wounds, stagger steps with walls (brace a hand,
            fall over low walls), living ragdoll falls, settle → safe spot → pose read → get-up with blend,
            grips pulling both bodies by strength, wall pins, ground control, hand IK, presence, LOD
animator.js B/C directional gait (360°, backpedal, strafe; no moonwalk), lean into acceleration and turns,
            slope (uphill/downhill), heavy armour, limp / spared arm / gut wound, fatigue, reaction poses,
            get-up tracks (back, front, sitting, kneeling), grip poses, warming hands, weight shift
```

Order per frame: movement and AI → `motion.simulate` (balance steps, grips, falls, recoveries) →
animators with `motion.animInput` → weapons/bows → `motion.afterAnimate` (feet, hands, blends).

## What works (tests/motion.test.js and playtests)

- **Feet on the ground.** On a 27° slope and the shrine steps each foot stands on its own ground (upper foot
  0.4 higher on the step); the pelvis drops when a foot cannot reach. Locked feet do not slide; a big drift
  releases them with a short lifted step. Player, bandits and townsfolk use the same rule (enemies and
  townsfolk now also stand on step tops).
- **Movement.** Gait follows the direction of travel in the body's frame: backpedalling steps back, strafing
  steps sideways, the body leans into speed-ups and turns, uphill forward, downhill back with soft knees.
- **Reactions.** Push tests on a bandit: 0.6 → minor (no step), 1.5 → stagger (0.45 m step, arms out), 2.6 on a
  shaken body → major (two steps), 4.5 → fall. An ordinary sword cut never topples a fresh opponent; the heavy
  third combo or a parry can, a struck leg buckles, arrows push lightly at the point they hit, shields give.
- **Falls and getting up.** Living ragdoll, settles, the pose is read from the chest (back / front / side /
  sitting / kneeling), a free spot is found, the get-up starts from the captured ragdoll pose (front:
  push-up → knees → stand, ≈ 1.8 s; longer with wounded legs).
- **Grips.** G grabs whoever is in front (reach, facing, free hand, line of sight checked). The left hand
  holds the collar by IK; the held one twists and pushes at the holder's forearm. Bodies pull each other by
  strength; dragging (S) and struggling wear the target's balance down; E takes them down only when off
  balance (otherwise "steht zu fest"); a bandit held on the ground mostly gives up (HUMANITY AI surrender).
  LMB shoves (over a low wall when staggering). Grips tire and end; a holder who is struck lets go.
- **NPCs grip too.** HUMANITY AI actions: brawlers grab the wanderer for their friends and throw them off
  after a few seconds; archers, mages, shields and the badly hurt shove; comrades rush to free one who is
  held ("Lass ihn los!"). Held, you break free with Space or LMB (stamina), ~5 elbows.
- **Presence.** Idle people glance at others or around, shift their weight onto one leg (feet stay planted,
  hips slide), warm their hands at the camp fire, look at whoever crowds them. Fatigue: heavy breathing,
  hands on knees.
- **Cost.** Village with 14 bodies in IK range: 0.45 ms per frame on average, 0.9 ms worst.

## Partial or missing

- No fingers, no hand closing round a collar, no mesh deformation (box rig); grips are hand-on-point IK.
- Townsfolk are not grabbable or pushable yet (their position belongs to the life simulation).
- No surface footstep sounds, footprints or mud/snow; no sliding state; jumping and landing keep the old poses.
- Catching a stumbling person, supporting a wounded ally, lifting someone from the ground: not built.
- Turning in place is foot-lock steps, not a dedicated turn animation; stairs have no step-timed gait.
- Wolves keep their own simple reactions; their ragdolls are death-only.
- Debug is numbers (`__ASHEN_TEST__.body(i)`, `.motion()`); foot targets and contact states are not drawn.

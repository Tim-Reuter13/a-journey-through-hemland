# A Journey through Hemland

Skyrim-like RPG in Three.js + Vite, German UI. Hemland is a continent that grows region by region.

## Working with the owner

- Answer in **German**. Claude leads the project and checks its own work visually (screenshots), not only by tests.
- Art direction (ART_DIRECTION.md): "Skyrim PS1 meets Minecraft/Blockbench" — boxes, 16×16 nearest pixel textures at
  16 texels per unit, low-resolution render with 15-bit dither (can be switched off in the settings: "Pixelfilter").
- Never hand art work (models, layout, look) to Codex/GPT; image generation for reference/textures is fine.
- Mods and packs the owner shares are **inspiration only**: learn the technique, never copy code or assets.
- The owner plays ultrawide (~2.6:1): check first-person items and HUD at 1600×610 too.
- First-person hands are ONE plain Minecraft arm for every item; held items must not cover the screen centre.
- Sky: plain gradient with square sun and moon, no painted clouds; clouds are 3D voxels (src/world/clouds.js).
  The owner loves the god rays (post pass in src/systems/graphics.js; the sky writes alpha 0 as open-sky mask).
- Controls: W runs (5.6 m/s), Shift sprints, Caps Lock walks, G grabs, E interacts/takes down, F first/third person,
  C sneaks (crouched, lower eye), I opens the Rucksack (drag items onto the eight gear slots; hub to B/K/J).
  Horses: T reins (lead/let go), E mount/dismount/tie at a rail or tree, H whistle; riding W trots, Shift taps spur
  (hold keeps the pace), S reins in, Caps Lock walks, Space jumps (standing: rears).
  Goblin caves: walk down the sunken way to its dark end (the Eisengrube: E at the shaft's rim climbs down); inside,
  walk up the exit tunnel (or E at the rope); held by a Lauerer or Würger, Space struggles free.
  Thief: C sneaks (veil round the reticle); sneaking E near someone picks their pocket; locked chests and doors (homes at
  night) need a Dietrich; K opens the skill tree "Pfade der Glut" (also in the pause menu).
  Magic: 2 holds the spell hand (2 again / X switches the spell, Shift+X back); B opens the Zauberbuch "Buch der Glut" to
  lay spells into the four seals of the Zauberhand; spells cost magicka. Kettenblitz is held (force lightning, drains
  magicka); elements on foes react with each other (systems/elements.js). The Jagdspeer thrusts with a long reach.
  Melee (Combat 2.0, docs/COMBAT_2.md): LMB tap strikes (forehand → backhand → chop in rhythm), LMB held at the top
  of the wind-up loads a heavy blow, RMB guards (raised just before the blade arrives = parry). F7 shows the combat
  debug view (intent, commitment, stamina, posture, wounds, memory, events, the simulated blades).
- Story tone: serious, Game-of-Thrones-level dialogue, blood, death, tragedy (src/data/hemland/story.js).
- Record new feedback and finished work in ROADMAP.md.

## Run and check

```
npm install
npm run dev -- --port 5282      # open http://localhost:5282/?timerLoop=1
npm test                         # node --test tests/*.test.js
npm run build
```

`?timerLoop=1` runs the main loop on timers, so the game also runs in a hidden tab. The game pauses on blur; the test
bridge `window.__ASHEN_TEST__` has `start()`, `skip()`, `resume()`, `move(x, z)` (refuses blocked spots), `look(yaw, pitch)`,
`setHour(h)`, `tool(i)`, `keys([...])`, `camera(pos, target)`, `snapshot(name)` (needs `node art/blockbench/receiver.mjs`
on :5299, writes work/screens/*.png), `dev()` (world, player, enemies, motion, ai, …), `ai()`, `aiDays(n)`, `motion()`,
`body(i|'player')`, `push(i, force, dx, dz)`, `grabEnemy(i)`, `grip(cmd)`, `knock(i)`, `ambient()`, `killEnemy(i)`, `save()`,
`load()`, `sim(seconds, call)` (fixed steps without rendering, bodies posed), `freeze(on)` (hold the simulation, keep
drawing), `horses()`, `mount(name)`, `dismount()`, `reins()`, `whistle()`, `spur()`, `cave(id)` (no id: leave),
`caveState()`, `give(id, n)`, `flags()`, `gold()`, `thief()` (lockpick/pickpocket/skills UIs: `state()`, `attempt()`, `calm()`, `take(id)`), `spells()` (hand, magicka, `fx` state
with game time `t`, `book`), `cast(id)` (lays the spell into the hand if needed and casts it). After `start()` call `skip()`, or the intro cinematic puts the player
back in the village. Inside a cave do not use `move()` (it drops you onto the land below); set
`dev().player.position` instead. In a hidden tab the game pauses:
call `resume()` before driving it, set `dev().camera` directly before `snapshot`. Any src edit reloads the page (HMR).

Hosting: every push to main runs .github/workflows/pages.yml (tests, `npm run build -- --base=/<repo>/`, GitHub Pages).
Asset URLs must go through `import.meta.env.BASE_URL`, never a leading `/`. Mobile check: Playwright with
`hasTouch: true, isMobile: true` at 844×390 (phone) and 1180×820 (tablet).

## Map of the code

- src/main.js — game loop, player controller, interactions, wiring of everything below.
- src/ui/touchControls.js + touch.css — phone/tablet controls (stick, swipe look, thumb cluster) and the compact
  touch HUD (body.touch-mode); buttons dispatch the same KeyboardEvents as the keyboard.
- src/characters/ — modular Blockbench characters (modular.js), procedural animator (animator.js), first-person hands
  and motion layer (firstPerson.js), bows (bow.js).
- src/systems/ai/ — HUMANITY AI (perception, beliefs, emotions, utility actions, groups, camp life); see its README.
- src/systems/motion/ — HUMANITY MOTION (rig adapter, IK, foot IK, balance, falls and get-ups, grappling); see its README.
- src/systems/combat.js, archery.js, spellFx.js, combatEffects.js — fighting, arrows, fire, particles.
- Combat 2.0 (docs/COMBAT_2.md): combatRules.js (weapons, attacks with phases and blade tracks, defence windows),
  meleeCollision.js (blades at simulation time, swept against rig capsules/shield boxes/walls), combatState.js
  (fighter: attack phases, guard timing, posture, attack-id dedupe), damageModel.js (defence outcome, damage by
  region/armour/speed, injury effects), combatEvents.js, melee.js (the one pipeline for the wanderer and human foes,
  created by combat.js); ai/combatMemory.js + ai/combatTactics.js (duel commitments); ui/combatDebug.js (F7).
  A blow only lands where the blade passed: never add hits by range/angle checks or timers.
- src/data/spells.js — the nine spells, elements, chapters, the Zauberhand rules (equip/cycle), magicka, bolt and chain
  geometry (tests/spells.test.js); src/systems/spellcraft.js — the eight new spells' runtime and world effects (ice floes
  via iceAt() in the player's ground, wisp light for goblins via lightNear(), clouds that explode on fireAt()), created by
  combat.js; src/ui/spellbook.js + spellbook.css — the "Buch der Glut" menu.
- src/systems/elements.js — auras and reactions (pure rules, tests/elements.test.js); src/systems/reactions.js — their
  effects, created by spellcraft.js (every spell hit goes through reactions.elemental(), steel through physical());
  src/ui/auraMarks.js — sigils over heads and reaction names. src/characters/spear.js — the Jagdspeer model (in code).
- src/ui/inventoryUI.js + inventory.css — the Rucksack (gear slots, item grid, detail, hub); ui/paperDoll.js (the 3D
  figure), ui/itemThumbs.js (item pictures from itemPreview.js models); systems/inventoryAccess.js — the pack swung
  round, the camera into it, mouth() for where the menu grows from, hideHead() in third person, hold()/tilt() test hooks.
- src/systems/thievery.js — pure rules for skills by use, detection, locks, pockets, pickpocket chance (tests/thievery.test.js);
  src/ui/thief.js + thief.css — lockpick and pickpocket windows and the stealth veil; src/data/skillTrees.js — the six paths
  (perks are tree nodes, canUnlock); src/ui/skillTree.js + skillTree.css — the "Pfade der Glut" menu; src/ui/sigils.js —
  pixel glyphs and path emblems. The wiring (lockOf, pickLock, startPickpocket, updateStealth) sits in main.js.
- src/systems/horses.js — horses: tie points, leading, tying, whistling, the riding controller (rideStep), road rider
  groups; src/characters/horseAnimator.js (gaits, idles, spring mane/tail) and rider.js (seating, mount/dismount, IK
  to stirrups and reins). Horse models load as one rigidly skinned mesh each (characters/models.js).
- src/systems/goblins.js — goblin AI (hearing, light, alarms, Ukhai barks, ring fighting with lunging thrusts, the
  specials: Lauerer leap and pin, Speier spores, Würger hook, Brecher charge, Trommler summons). src/systems/caves.js —
  the cave interiors built from Codex's floor plans (data/goblins/caves.js) at CAVE_SKY above each hole: grid
  colliders, stairs, drops, puzzles, nav, Blockbench props (world/props.js CAVE_PROPS); the rock itself is
  systems/caveRock.js (density field → surface nets, baked vertex light and grime). Keep caves gloomy and filthy. Lore, tribes, the Ukhai language and the
  Grubenwacht: data/goblins/lore.js; Brenna Rußhand's dialogue is guildTalk() in main.js. The holes themselves are
  terrain: heightfield.js burrows (a rise plus a pit added in heightAt), drawn on a finer grid by terrain.js pitPatch.
- src/world/ — terrain (heightfield.js), sites (hitching rails register tie points: world.ties), flora and Blockbench trees (trees.js, with a crown grid), rocks, water
  (water.js: surface on the terrain grid, mirrors the atmosphere's sky uniforms, and all shore content — reeds,
  lily colonies, stones, driftwood, leaping fish), sky (atmosphere.js, clouds.js), ambient effects (ambientFx.js:
  leaves from crowns, light shafts, fireflies), footprints (tracks.js, world.groundAt), Funken-style fires (fire.js).
- art/blockbench/ — models and characters built in Blockbench via MCP (needs the local Blockbench app; not available
  in cloud sessions). Exports land in public/models.

Rules learned the hard way: never create or remove THREE.PointLights at runtime (use `world.lights`); NPC paths go
through navGrid.js; `walkHeightAt` must stay O(1); rotation.y = atan2(self − target) faces the target (front is −Z);
shared temp vectors in motion.js must never be passed into functions that use them.

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
- Controls: W runs (5.6 m/s), Shift sprints, Caps Lock walks, G grabs, E interacts/takes down, F first/third person.
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
`load()`. In a hidden tab set `dev().camera` directly before `snapshot`. Any src edit reloads the page (HMR).

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
- src/world/ — terrain (heightfield.js), sites, flora and Blockbench trees (trees.js, with a crown grid), rocks, water
  (water.js, mirrors the atmosphere's sky uniforms), sky (atmosphere.js, clouds.js), ambient effects (ambientFx.js:
  leaves from crowns, light shafts, fireflies), footprints (tracks.js, world.groundAt), Funken-style fires (fire.js).
- art/blockbench/ — models and characters built in Blockbench via MCP (needs the local Blockbench app; not available
  in cloud sessions). Exports land in public/models.

Rules learned the hard way: never create or remove THREE.PointLights at runtime (use `world.lights`); NPC paths go
through navGrid.js; `walkHeightAt` must stay O(1); rotation.y = atan2(self − target) faces the target (front is −Z);
shared temp vectors in motion.js must never be passed into functions that use them.

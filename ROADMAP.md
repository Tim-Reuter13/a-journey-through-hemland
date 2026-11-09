# A Journey through Hemland — Roadmap

The game is being renamed from "Ashen Realms" to **A Journey through Hemland**. Hemland is the continent;
it grows region by region. The first region is the Aschmark around the village of Dämmerwald.

Lead: Claude (art direction, core systems, integration, review). Helpers: Codex on separate files
(model by difficulty: gpt-6-astra for spatial/design-heavy work, gpt-6.1-sol for most code, gpt-6-luna for data).
Rule for every task: new systems ship as modules with a small API; `src/main.js` is wired only by the lead.

## Done (Phase 2)
Modular characters (faces, hair, outfits, tinting), lootable visible equipment, smooth third-person controller,
Rapier physics (props, grab/throw, ragdolls), enterable houses with interiors, NPC daily routines, character creator,
first intro timeline.

## Phase 3 — done (2026-10-21)
| Area | Owner | Files |
|---|---|---|
| Pixel UI: main menu, HUD, dialogue, inventory, journal, settings | Codex | `index.html`, `src/ui/*` |
| Large streamed world: chunked terrain with LOD, water, biomes (meadow, autumn forest, taiga, snowy peaks, marsh, lake) | Claude | `src/world/hemland.js`, `src/world/heightfield.js`, `src/world/chunks.js` |
| Realistic kingdom infrastructure: king's road, bridge, roadside inn, farms and mills, watch posts | Codex | `src/world/sites/countryside.js` |
| Royal city with walls, gatehouse, districts, market, tavern, temple, and a castle on a rock | Codex | `src/world/sites/city.js` |
| Kronwacht citizens: guards, merchants, innkeeper, priests, smith, townsfolk, children from the modular system, with homes, routines and dialogue | Claude | `src/data/citizens.js`, `src/systems/npcLife.js` |
Distance rule: the city is 4–5 minutes on foot from Dämmerwald (not 2, not 15).
Known follow-ups: city NPCs walk mostly straight lines (street graph for npcLife belongs to the Phase 4 pathfinding rework);
~1,800 draw calls in the market (characters are 18 meshes each; merge per character later); chunk jobs can take 10–30 ms
(move terrain/scatter generation into a Web Worker); farm fields are small garden-sized beds (make real strip fields);
character creator: camera now frames the character in the free left area (drag to turn, wheel to zoom) — needs a
proper backdrop/studio spot and more options (outfit preview, voice, origin).

## Phase 4 — feedback backlog (2026-10-21) — first pass done
Debug and performance (done first, on request):
- [x] F4 debug flight (noclip, god mode, Space/C up/down, Shift ×5) and F3 overlay with position, longest frame, chunk jobs.
- [x] Multi-second freezes fixed: a fixed pool of 10 point lights (lightPool.js; light counts never change, so shaders
  never recompile), shaders precompiled at load, a nav grid with budgeted A* instead of the old detour search, and a
  spatial index for floor heights (walkHeightAt 100× faster). Worst frame flying village→city: 2324 ms → ~70 ms.
Bugs and polish:
- [x] Floating parts fixed on village houses (flower boxes, hanging sign); stand on crates/carts/walls, step up ≤ .45.
- [x] The beam through every front door is gone; door frame and lintel no longer z-fight with the opening.
- [x] Village doors face the square; interiors are planned per household (role, wealth, story details) and mirrored.
- [x] Loose items sit on real surfaces in their natural pose (interiors.js placeOnSurface).
- [x] NPCs face where they walk (one facing convention); pathfinding uses the nav grid (navGrid.js) with doors as legs.
- [x] The smith stands at the anvil's face (buildings.js anvil.userData.work).
- [x] Active ragdolls: tone fades over ~1 s, knees buckle, arms brace toward the fall, then limp; corpses are dragged by
  the collar (or an ankle when a leg is grabbed) at walking pace.
- [x] Sprint: longer strides, pumping arms, less twist. First-person hands are blocky and tinted to the player's skin.
- [x] Inventory: one line per item, compact numeric columns, nothing clipped at 1280×720. (A deeper redesign is still open.)
- [x] Bandit camp ~330 units west of the village.
Features:
- [~] Voice lines: 211 new lines rendered locally with Qwen3-TTS (scripts/generate_voices.py); missing ones use the browser voice.
- [x] Funken rework (spellFx.js): charge, fireball, ember/smoke trail, flash, sparks, persistent scorch decals, burning
  enemies, physics push on props and corpses.
- [x] Film intro (data/hemland/intro.js + systems/director.js): Hanne's death on the west road, 11 shots, 83 s.
- [x] Story rewrite (data/hemland/story.js, systems/dialogue.js): Severin's grain fraud, Elira's guilt, Soren's death,
  Rauk's bargain, the verdict in the castle; 15 main stages, 4 side quests, named NPCs at the inn, gate, temple, castle.
Open follow-ups: intro props (crossbows, a real door as bier), Bryn carrying Hanne could use a proper carry rig,
more interior layouts for city buildings, inventory 3D preview check, delete the unused src/data/story.js.

## Phase 5 — quality pass after the 2026-10-21 review (done by Claude, no art by Codex any more)
- [x] Kronwacht rebuilt by hand (sites/kronwacht.js): three terraces with curved retaining walls, ramps and stairs;
  winding streets painted into the terrain; ~270 row houses with jettied timber frames, shutters, flower boxes, varied
  roofs and chimneys; market with stalls, goods, fountain and pennants; temple square; 19 enterable buildings.
- [x] Voices: one cloned voice per character (scripts/clone_voices.py, Qwen3 Base voice clone from a designed reference);
  mouths follow the real loudness of the line; city lines and barks play the recorded voice.
- [x] Zombie corpses (re-dressing rebuilt the rig behind the ragdoll), flying corpses (velocity clamp, softer spell push).
- [x] Sleepers lie in their beds, the smith's hammer lands on the anvil with sparks, greetings fit the person
  (nod / salute / wave), dialogue names, over-the-shoulder dialogue camera and a compact dialogue panel, Bryn trades again.
- [x] Swords hang tip-down outside combat; ash motes removed.
- [x] Water per chunk (water.js): depth colour, foam at the banks, ripples along the current, glints; soft river banks;
  wading, swimming, ripple rings, splashes; props and corpses float and drift.
- [x] Ledges and cliffs in the hills, a cliff ring at the border, a slope limit for walking; stumps, fallen trunks,
  mushrooms, rock groups and wayside finds.
- [x] Wildlife (deer, foxes, hares, crows that take off), travellers on the king's road, random wolf / bandit encounters.
- [x] Combat AI: circling at fighting distance, one attacker at a time, combos, blocking and dodging, retreat, fleeing;
  wolves flank. Much more blood: sprays, ground spatter along the blow, pools under the dead, drip trails.
- [x] Interiors filled with each household's everyday things.
- [x] Live-tested with `?timerLoop` (main loop on timers while the preview pane is hidden): combat — strikes no longer
  freeze after a hit, enemies path round tents and crates (navGrid), take turns fairly and come back after fleeing;
  swimming — the current carries you, bridges overhead no longer count as ground; banks — gentle grassy slopes, a wet
  edge and a thin broken foam line instead of a white band; intro — carry shot follows Bryn clear of the house,
  the game starts with Elira and the well in view.
- [x] Hunting: deer, foxes, hares and crows can be killed by sword or spell (blood, carcass on its side, herd bolts),
  searched for Wildbret, hides, antlers and feathers; fleeing animals now actually run away; C = creep (crouched,
  slow), lets you get close to game.
Open: "brown things at the oven" not reproduced — needs a screenshot; chimney smoke.

## Phase 6 — review of 2026-10-23 (animals, posts, water, textures, life)
- [x] Deer (stag/doe), fox, hare and crow rebuilt in Blockbench (art/blockbench/models.js) on the wolf's rig; walk,
  gallop, hop, grazing, ear flicks, tail flag, crow wingbeat. Dead animals and wolves go down as ragdolls
  (ragdoll.js createCreatureRagdoll fits bodies to each bone's mesh).
- [x] Command posts (Wegposten, Kronposten) rebuilt: stone tower with jettied watch room, tiled roof, flag and outside
  stair; walled yard with lean-to, tent, cookfire, mess table, weapon rack, training dummy, notice board; sentry box.
- [x] Barrier guards Gerold and Imke walk to the counterweight and swing the pole up when someone comes along the road,
  and lower it once the road is quiet (main.js updateBarriers); the closed pole is a door-kind collider.
- [x] Textures: 29 large surface canvases (src/art/surfaces.js, 64/128 px, still 16 texels per unit) with real detail;
  new families (brick, sandstone, fieldstone, granite, clay tiles, wood shingles, weathered/painted boards, rough
  plaster) spread over Kronwacht and the village. Terrain: quarter-turned second reading chosen by world noise
  (no grid, no seams), world-space macro tint, layer transitions in coherent patches; baked blocks get their own UVs.
- [x] Water (water.js): 64 px looping pixel frames scrolling with the current, depth palette in steps, Wakes-style wave
  simulation round the player (rings, V-wakes, carried downstream), stream stones with standing wakes, drifting
  leaves, lily pads and duckweed in still water, rising fish.
- [x] Livelier day: bluer sky, blocky pixel clouds, thinner haze, warm sun and meadow bounce light, gentle grading;
  flower meadows in patches with a leading colour, short and tall grass, lavender, campion, daisies.
- [x] Held swords are aimed (animator.js aimSword, firstPerson.js rollBlade): the cutting edge leads every swing and
  faces the foe at rest and in guard, in both views; the blade hangs, readies and guards in set directions.
- [x] Landscape kit (src/world/rocks.js): faceted noise-shaped rocks (walls, spires, outcrops, boulders, slabs, scree)
  with a master material — world-space terrain stone, ground cover from the terrain's own grass/litter/snow on
  sky-facing facets and creeping up the foot, the terrain's biome tint and macro noise, smooth normals. Cliffs set
  into steep terrain breaks facing downhill; stamps (rock nose, clearing, boulder field, stone ring, ridge); one
  landmark per 320 m region (rock tower or arch). Terrain layers height-blend by their own relief.
- [x] Kronwacht and castle rework (plans by Codex in work/plans/): castle curtain joins the town wall, keep, palas,
  chapel, stables, forge, well, guardhouse; town wall as an irregular ring with round and square towers, three gates,
  the south front bent with the main gate set back between two wall arms; multi-storey burgage houses (rich 3–4,
  town 2–4, poor 1–2) with back houses filling the plots; town hall, bell tower, forge shed, bake oven, tannery,
  stables, granary, pillory, market cross, gallows; vineyard terraces on the castle hill and a burgweg street.
- [x] Street props in Blockbench (art/blockbench/models.js › props → public/models/props.gltf, src/world/props.js):
  handcart, wheelbarrow, barrels, crates, sacks, produce, trough, woodpile, bench, hay, pottery, sign, ladder,
  spare wheel — set against house fronts, at stalls, market corners and in yards; loaded before the world is built.
- [x] Street paving (2026-10-26): granite setts on the main streets, rough field cobbles with dirt joints in the alleys,
  flagstones inside a border of setts on the squares, a dark wet gutter down each street, muck by the house fronts —
  from a half-metre street-plan texture (src/world/streets.js) read by the terrain shader; castle ward paved too.
- [x] Castle: a 30 m Bergfried with timber hoarding, stair to its high door and the king's banner; castle kitchen,
  servants' house, Blockbench props at stables, forge, kitchen and gate.
- [x] Points of interest (sites/landmarks.js + markers with `discover`): Hügelgrab der Ersten, Kapelle der Stillen
  Glut, Wegschrein am Krähenfeld, Köhlerlager, Königsbruch, Pestacker, Rabenstein, Königsbrunnen. On the compass
  within 120 m until found, "Ort entdeckt" + XP on the first visit (flag poi_<id>), an inscription to read at each.
- [x] Trees in Blockbench (2026-10-26, art/blockbench/models.js › trees → public/models/trees.gltf, src/world/trees.js):
  three oaks, two autumn oaks, two birches, two spruces, two taiga firs and their snowy twins, a dead tree, two bushes
  (one with berries). Crowns are clumps spread over an ellipsoid with lobes and a dark heart; foliage is cut out (one
  leaf per 3×3 cell, holes between), shares atlas rectangles, gets rounded crown normals and sways in the wind; each
  tree has a far version (trunk, limbs, the bigger clumps) shown two chunk rings out. About 0.6 ms per frame.
- [x] Hunting bow (systems/archery.js, characters/bow.js): its own equipment slot (FERNKAMPF) and hotbar key 4; hold
  to draw, release to shoot, right click lowers it. Arrows fly with gravity toward the reticle, hit people (legs,
  chest, head ×1.6) and animals, double damage from hiding, stick in bodies and ground, are picked up by walking over
  them and come back in a corpse's loot. Archer's stance with arm IK in third person, first-person view down the
  shaft, the bow on the back while travelling, quiver with the bow. Start kit and old saves get the bow and 24 arrows;
  Bryn sells bows and arrows.
- [x] Bow review (2026-10-27): first person like Skyrim — drawn, the bow stands canted left of the reticle, the arrow
  rises from under the eye, the bow arm runs off the left edge, the string hand ends below the frame; at rest it hangs
  low at the left. One plain Minecraft arm (skin box, sleeve in the worn garment's colour) holds every item.
  Arrows: a faint trail; struck where the ray meets the model and riding on that bone (through the ragdoll fall and
  re-dressing); head ×1.6, legs ×0.7; stone throws them off with sparks, chips and a scratch, wood takes a notch and
  splinters, earth and the rest puff dust (colliders carry a surface: stone/wood/soft). Arrows are pulled with E
  (some break), never picked up by walking. The slung bow lies flat across the back, crossing the quiver.
  Trees 18 % taller. Chimney smoke from every marked chimney (world/smoke.js, one GPU-animated instanced mesh).
- [x] Review 2026-10-27 (2): first-person bow follows the screen shape (spread up to 16:9, slimmed limbs, thin string,
  bow arm straight down, string hand only while drawing); the arm shows gloves, bracers and plate vambraces from the
  equipment; village and Kronwacht door steps are walkable floors; play starts the morning after the dusk intro; the
  default hair is "Kurz". Sky in the world's style: smooth three-stop gradient, square block sun and moon, stars and a
  milky band, and real block clouds (world/clouds.js, a periodic slab grid drifting over the land). Autumn woods: red
  maples and golden birches from Blockbench, a gold-amber leaf carpet, rust ferns, leaf drifts, fairy rings and the
  odd hunter's hide.
- [x] Sky detail (2026-10-27): stepped block clouds one to three blocks tall with a faint pixel texture, a sparse high
  veil above, and pixel cloud banks along the horizon (two rows, lit rims, grey bellies, pink at dusk, dark at night).
- [x] Village houses dressed with the Blockbench street props (woodpile, barrels, crates, two of bench, sacks, produce,
  wheelbarrow, hay, pottery, handcart). Flocks of birds wheel overhead by day, butterflies tumble over the meadows
  (world/critters.js).
- [x] Enemy archers: one camp plunderer and about a third of the road thieves carry a bow and quiver, keep 9–16 m,
  back off when pressed, draw visibly (arm IK, ~1.1 s) and loose with lead and drop; their arrows use the same system
  (trail, glancing, sticking, pullable); a raised guard turns them from the front. They drop bow and arrows.
- [x] Archery grows with use (+1 every five hits, more damage per point); perks Meisterschütze (+12) and Ruhige Hand
  (30 % faster draw, no shaking when tired).
- [x] First-person hands lit by the world (2026-10-27): the view model's lights take the world's sky light, the sun or
  moon from its real direction relative to the view (dimmed behind walls, almost gone indoors) and the nearest pooled
  lamp or fire; the bow string no longer glows. First-person bow slimmer and smaller again.
- [x] HUMANITY AI (2026-10-28, src/systems/ai/, see its README.md): perception without cheating (sight cone, light,
  stance, walls; hearing through a sound bus), beliefs with decaying quality and shouted second-hand knowledge,
  15-trait personalities on 6 archetypes, emotions, 22 utility actions with hysteresis, soft attack slots, leader
  orders that must be heard, morale and flight, camp warnings, surrender to the bow (rob, let go, remembered and
  recognised), rare feigned surrender with a tell, road tolls, near-miss cover, fire avoidance, a camp day with
  rotating watches and patrols, faction memory of the wanderer's habits, F6 debug view, 21 scenario tests.
  Also fixed: talking to Rauk crashed when he had no relationship entry yet.
- [x] HUMANITY AI roles and the camp over days (2026-10-28): shield bearers (raised shield, arrows stick in it, block
  from the front only), mages (staff, bolt with a visible wind-up, healing allies, mana), search parties sent by the
  leader for a lost trail or a missing comrade (missed, searched for, found), the camp over days (reinforcements,
  abandonment, burial, a new band moving in; survives save/load), a "last shouts" log in F6. Camp members are named
  (Bodo, Hilde). 25 AI scenario tests.
- [x] HUMANITY MOTION (2026-10-29, src/systems/motion/, see its README.md): rig adapter, two-bone IK with limits,
  foot IK with foot locking and pelvis drop for everyone (one ground rule incl. steps), directional gait (backpedal,
  strafe, lean, slopes, heavy armour, limp, fatigue), balance with minor/stagger/major/fall from directed forces and
  hit zones, living ragdoll falls and pose-matched get-ups, grips (G) with struggle, drag, shove, wall pin, takedown,
  ground control and surrender; bandits grab, shove and free comrades; idle presence; 14 motion tests.
- [x] Feedback round (2026-10-29): FP bow placed in screen terms (Skyrim-like, same on ultrawide; rest low left, drawn
  left of the reticle, arrow along the line of sight); no foot locking while walking (NPC heels); RDR-style controller
  (walk by default, Shift runs, 2× Shift sprints, weight in speed and turning, head follows the camera) and three gaits
  (walk/run/sprint); shield on the forearm by IK, blocks only raised and from the front, drops while striking, heavy
  blow or empty stamina breaks the guard; enemies walk out of obstacles they stand in (Rauk), goals beside crates are
  reachable, string-pulled paths, stuck detection; sky = Codex pixel-art panoramas (day/dusk/night, public/textures)
  plus voxel heap clouds on three layers; fire particles that rise and burn down, a flame and light in the casting
  hand; impact debris by material (sparks, chips, splinters, clods, dust); moss-speckled rock tops; mountains without
  the boulder field; settings: pixel filter on/off.
- [x] Feedback round 2 (2026-10-29): sky back to the gradient (no painted clouds; the Codex panoramas were dropped);
  soft voxel clouds (overlapping, breathing cubes from a coverage noise, per-pixel sun shading, dithered fade —
  idea from the Better Clouds mod, own code); faster controllers (W runs 5.6, Shift sprints 9.2, Caps Lock walks,
  first person direct); sunlight post pass: god rays through open sky only (the sky writes alpha 0), sun glare and
  lens ghosts (idea from the "sunbathing" pack, own code); jump/fall/landing squash and turn drag in the animator
  (ideas from Fresh Animations); falling leaves, petals and fireflies (idea from Visual Effects+).
- [x] Feedback round 3 (2026-10-29): leaves only from real crowns near you (trees.js keeps a crown grid), far fewer;
  light shafts from crown edges and roof eaves along the sun (idea from Visual Effects+ light rays, own code);
  first-person motion layer: look lag, figure-eight walk bob (the stride counter never ran before), sprint drop,
  strafe tilt, jump/fall/landing bounce, sneak, tool swap, reach on E, jolt on hits and blocks (ideas from Punchy
  and Hold My Items, own code).
- [x] Souls-like swords (2026-10-29): rusty, warden and ash blades rebuilt in Blockbench with real proportions, thin
  tapering blades, fuller, ricasso, crossguard with block and bent quillons, wrapped grips, wheel or teardrop pommels
  (the ash blade with a glowing fuller and an ember gem); first person now holds the same Blockbench model, flat
  toward you at rest. Settings: "Farbstil" Standard / Dunkle Fantasy (muted, heavy, cool shadows, amber light,
  vignette, grain).
- [x] Mobile and GitHub Pages (2026-10-30): touch controls (src/ui/touchControls.js, touch.css) — a floating stick
  for the left thumb (light push walks, full push runs, past the ring sprints; faint at rest so it is found), swipe to
  look, two fingers zoom, a pixel-icon thumb cluster (Schlag/Bogen/Zauber by tool, Block, Nutzen lit when something
  can be used, Sprung, Ducken, Packen, Trank, Sicht), Inventar/Journal/Vollbild/Pause at the top, tappable quickbar.
  Buttons send the same key events as a keyboard, so every action behaves alike. Compact HUD, menus, dialogue,
  inventory and character creator for 390 px tall phones; a "please turn your device" screen upright; key hints
  hidden on touch; phones start on "Leistung" without canvas MSAA; setting "Touch-Steuerung" (auto/on/off).
  Web app manifest and icons (home screen opens full screen in landscape). Deployed by .github/workflows/pages.yml
  (tests, build with --base=/<repo>/, GitHub Pages); voice files resolve against the base path.
  Not yet measured on real phones: frame rate (draw calls, chunk jobs) and iOS memory.
- [x] Feedback round (2026-10-30, after the first mobile build):
  mobile — a thumb held on a button (Schlag/Bogen, Block, Nutzen, Sprung) can slide to turn the view, so you aim
  while drawing; the cluster is down to Schlag, Block, Nutzen, Sprung, Ducken, Packen with icons only; Sicht,
  Inventar and Menü at the top; Journal and Vollbild moved into the pause menu; the quickbar shows icons and counts;
  smaller compass, no region/level lines on touch.
  Light — the beams from roof eaves are gone (they drew bright streaked bands across houses), crown shafts are
  faint and soft-edged, lens ghosts soft and faint, god rays a little weaker.
  Swords — chunky Blockbench proportions (blade 2.5 px wide and 0.8 px thick, thicker grip longer than the fist,
  bigger guard and pommel; spec in art/blockbench/models.js, the glTF re-proportioned to match until the next
  Blockbench export). First person: the hilt sits in the fist and the wrist sets the blade, so the grip crosses
  the fist; view-space poses (rest, guard, forehand, backhand, diagonal chop) with the forearm always coming from a
  shoulder at the lower right. Third person: a little larger, at rest the blade points forward and down from the fist.
  First-person hand sway roughly halved and the springs damped close to critical.
  Potion — systems/liquid.js replaces slosh.js: the surface follows felt gravity (gravity minus the flask's real
  acceleration from walking, turning, jumping) on a lightly damped spring and sloshes for a while; a ripple grid
  rides on it; agitation from shaking makes more bubbles and foam that fade over a few seconds; a see-through
  liquid; holding Block (right mouse) with the potion shakes the flask; a slosh sound when it hits the glass.
- [x] Water, tracks and fire (2026-10-30):
  Water (water.js) — the ripple tile is read as a height field: isotropic on still water, stretched into
  streaks along the current in the river; the body darkens with depth in seven dithered steps (clear, greenish
  shallows with moving caustics on the bed, teal water, a dark channel) instead of four hard bands; the surface
  mirrors the real sky colours (atmosphere uniforms) more toward a grazing view, haze falls on the water but not
  on the mirrored sky; sun and moon glitter in single pixels; lakes swell gently (the bank line comes and goes)
  and gusts drift over them; a thinner broken foam line at the bank.
  Tracks (world/tracks.js) — boots, paws and hooves leave prints in sand, wet sand, dirt roads, mud and snow
  (world.groundAt reads the terrain's layer weights), one per stride along the way the walker moves; the
  player, townsfolk, bandits, wolves, deer, foxes and hares; prints fade (snow keeps them longest).
  Fire (world/fire.js) — every fire burns like Funken: rising, swirling block flames on the Funken colour
  ramp (FLAME_RAMP in spellFx.js), sparks, smoke outdoors; camp and cook fires, hearths, braziers, wall torches,
  candles and the forge's coal bed share one instanced pool near the viewer; the old flame sprites stand in
  beyond 38 m and are kept out of the static batches for that.
- [x] Holding items (2026-10-31): first-person sword at rest low right pointing away into the view, guard holds the
  blade across in front (no stray left fist), forearm from a lower shoulder; third-person rest blade forward and down,
  guard across the chest; potion sits in the fist, clear glass, deep red draught, small sparkling bubbles; resting FP
  bow visible at the lower left; third-person drawn bow at arm's length beside the head, not in front of it.
- [x] Water and shores (2026-10-31): the far terrain (32-unit grid) no longer draws under loaded chunks (it hid
  ponds and hollows behind straight edges — the "half pond"); water built on the terrain's own 2-unit grid with
  exact depth; new water look: slate-blue clear water in the lake and river, peaty brown-green in marsh and forest
  ponds, the bed showing through the shallows, a sky sheen even from above, darker reflections of banks and trees,
  a faint wet edge instead of white foam, no duckweed blotches; lake and river beds sand, pond and marsh beds mud,
  a dark wet rim on every bank. Shore content from water.js: reed beds with plumes, cattails, rushes, sedge, yellow
  iris, lily colonies with round notched pads and 3D blossoms, rounded stones and bleached driftwood at the
  waterline, leaping fish, dragonflies. New POI: Fischersteg am Grausee (walkable jetty, moored rowboat, drying rack
  with fish, net, upturned boat, an inscription).
- [x] Horses (2026-11-01), Red Dead Redemption 2 as the model for the feel: six coats modelled in Blockbench (bay
  with black points and a star, black with a white sock, dapple grey, chestnut with a flaxen mane and a blaze,
  palomino, tobiano paint), a heavy riding horse a little bigger than life, saddle, blanket, saddlebags, bedroll,
  bridle; the coat paints in half steps with soft light that runs on across boxes, points and socks by height,
  dapples, patches over the back; mane on the crest with locks of uneven length, a full frayed tail, eyes under a
  brow. One rigidly skinned mesh per horse (one draw call). Animation (characters/horseAnimator.js): walk, trot,
  canter, gallop with their own footfalls, legs that fold and reach crisply; standing it breathes, flicks its ears,
  swishes its tail, rests a hind leg, paws, shakes, grazes; rears; jumps; mane, forelock, tail and stirrups swing on
  springs. Play (systems/horses.js): Asche, the dapple grey at the new hitching rail by the east road, is yours —
  T takes the reins and leads her, E at a rail or a tree ties her up, E mounts from the side you stand on (keyed
  mount and dismount), H whistles her over; riding: W trots, a Shift tap spurs a step (canter, gallop), holding Shift
  keeps the pace while her stamina lasts (the stamina bar is hers while mounted), S reins in and backs up, Caps Lock
  walks, Space jumps (standing: she rears), the camera drifts back behind her at speed, a gallop widens the view;
  first person sees over her ears. Sword, bow, Funken and potions work from the saddle. Reins are leather straps
  that sag. Horses at the inn and both outposts; riders on the king's road: a patrol of three in a column, the
  king's courier at a canter, a merchant with a guard beside him; they keep right, stop for whoever blocks the road
  and call out. Hoofbeats (road or grass), snorts, whinnies, the whistle. Asche's place is saved.
  Feedback round 1 (same day): legs no longer "spaghetti" (smaller, crisper joint angles), reins as straps instead of
  lines, eyes no longer hidden by the jowls, the mane rebuilt, items usable in the saddle.
Open (horses): mounted combat feel (sword reach from the saddle, enemies reacting to riders), horse fear and injury,
buying or naming horses, brushing and feeding, more tie points (fences), riders for the shrine and camp roads, touch
buttons for reins and whistle.
### Goblins and their caves (2026-11-01)
Roads got wheel ruts, a grass ridge, mud holes and puddles, verges overhanging the edge; prints sink into soft ground
(square boots, horseshoes). Three goblin tribes (the Ukhai, data/goblins/lore.js) with chiefs, a language and lore;
models and spears/daggers by Claude in Blockbench; specials that fight differently (Lauerer, Speier, Würger, Brecher,
Trommler). Three caves from Codex's multi-storey floor plans (docs/goblin_caves/), each with its own puzzles.
Feedback 2026-11-01: the first cave mouths (rock kitbash in front of a cliff) looked awful; the owner wants small holes
in the ground with at most a slight rise, made from the world's own mesh. Done: the holes are terrain (heightfield
burrows, a finer grid in the chunk mesh, darker down the shaft), each tribe leaves only a small sign; inside, the
walls and ceilings became one rough rock skin instead of boxes, and you arrive at the foot of a daylight shaft with a
rope. Goblin thrusts now lunge (they used to miss from the edge of their reach). The Grubenwacht: Brenna Rußhand in
the king's guard barracks buys ears (5 Kronen), pays chiefs' bounties and keeps four contracts.
Feedback 2026-11-02: goblins not green enough; caves "mega ass": entrances must slope so you can walk in (the one
with the rope is cool as it is), the props round and in the caves looked awful, far too dark (look how other games do
it) but then "not too bright or clean — dirty, disgusting, gloomy", walls not round, performance in caves, goblins
died to one blow, many things in the world without (or with bad) hitboxes, and the new roads were not liked.
Done: road wear rolled back (ruts, mud holes, puddles, verge; footprints stay). Green goblin skins. Codex painted six
cave textures (src/art/caveSurfaces.js). The Klagende Grube and the Moderhöhle are sunken ways sloping into the hill
(heightfield burrows walkIn) you walk down into; at the black end you are in, and inside you walk out up a tunnel to
the daylight; the Eisengrube keeps its shaft and rope. Caves rebuilt (systems/caveRock.js): a density field (rounded
plan, vaulted tunnels, stairs as ramps, drops, the exit tunnel, rock noise) turned into one smooth surface by surface
nets, light baked into the vertices PS1-style (ambient that never goes fully black, occlusion, every torch/fire/
mushroom/daylight with a sight check over the plan) plus grime (blotches, soot above fires, a wet band at the wall
foot, muck); dark coloured fog. 33 Blockbench cave props (cave_props.gltf: totem, bones, cage, drums, altar, stake
gates, torches, meat rack, stew pot, filth, …) replace every box, filth in every room. The surface world is hidden
and not updated underground; goblin A* uses a heap. Goblins have about twice the hit points. Every solid-looking part
of the sites without a collider now gets one automatically (world.js; scripts/audit_hitboxes.mjs lists them).
Open (goblins): playtest every special and every puzzle in all three caves, saving and loading inside a cave, the
contracts in the quest journal and on the map, a contract board with ears outside the barracks, more cave light
(the dark rooms are very dark), goblin raids on the roads at night.
Open (motion): townsfolk grips, surface footsteps, catching/supporting people, drawn IK debug, wolves.
Open (AI): NPC potions, wounded posture, voiced callouts, shield bash, mage wards, an off-screen camp economy, drawn
debug overlays (cones, cover points).
Open: the lake still shows fan-shaped streaks when seen from just above the surface; "brown things at the oven" (needs
a screenshot); props in the castle ward beyond the stables and forge; the archery skill is not shown in a character
sheet yet; quarry floor patches look rectangular; crags round the castle look like stumps.

## Later
Stealth (detection, sneaking, hidden bodies), crafting, dungeons, more Hemland regions, coast and sea.


## Phase 6 — blood, fire and the backpack (2026-11-03, Claude)
Owner brief: no more combat lag; the best pixel blood that knows armour from skin; fire that behaves (trees, water, snow);
a backpack animation for the inventory in first and third person, made in Blockbench.
- [x] Lag: every sword swing cloned and disposed a material, so three.js compiled a shader per blow (80–120 ms). Slash and spell
  materials are pooled and all effect materials are compiled before the first frame. Terrain height lookups (13 µs each) are cached.
- [x] Blood (systems/blood.js, bloodSim.js): pixel drops, 2 m ground tiles of pixel fluid (flows downhill, pools, dries, soaks in by
  surface, drops leave trails on slopes), blows raycast onto the character atlas (skin / cloth / leather / mail / plate), gash along
  the blade's path, runs, wounds that stay on their bone and bleed by region (neck pulses), blood loss drains hit points and makes
  weakened fighters stumble, corpses can be cut and bleed on, dragged bodies smear the pools, blood in water clouds.
- [x] Armour: plate / mail / leather and heavy suits (Rauk) turn physical blows and arrows, but not fire; sparks toned down.
- [x] Fire (systems/wildfire.js, world/fireSim.js, world/burnMap.js): one spell burns a few metres (energy per fire), wind and slope,
  water stops it, snow melts, trees burn for minutes from foot / crown / side with patchy char, brands, smouldering, burnt ground and
  trees drawn by the shaders; burning men light grass and are put out by water; a burning shield is thrown away by its bearer.
- [x] Backpack (art/blockbench/models.js › backpack, characters/backpack.js, systems/inventoryAccess.js): swings round, flap opens,
  camera glides in, menu rises; first and third person.
- [x] Round 3 (2026-11-04): blood on the blade and the first-person hand, bloody footprints, blood on the lens, wall splats; no sparks
  that carry fire; ground and body blood share one palette; blows have a real height and arc (pitch, distance, angle), hit legs / head /
  arms with pain and a limp, shield covers the body but not the legs; heavy suits (Rauk) never bleed from physical blows; corpses
  (ragdoll position) can be cut and shoved; hurt fighters clutch the wound.
- [ ] Not built yet: fire on buildings and thatch, rain, burning arrows, animals and villagers fleeing fire, regrowth of burnt ground,
  muscle-driven ragdoll reactions beyond HUMANITY MOTION's existing zones.
- Feedback 2026-11-03 (fixed): fire spread far too fast and wide; trees burned out too fast and always bottom-up; blood sprays too
  long, too thick; Rauk took belly damage through visible armour; arrows did not always leave blood; shield particles overdone;
  first-person sword hand came in from the left; third-person backpack view was terrible.

- [x] Round 4 (2026-11-05): the blade strikes where the crosshair points (a ray through the world, bodies alive or lying down, so
  looking down hits legs and corpses); parry with a riposte (timed block turns the blow, the attacker reels and takes double damage,
  nothing blocks the counter); blood on the blade is a fluid (runs along the blade with gravity and swing, beads at the tip and
  drips, is flung off in a swing as real drops); bodies bleed for 10–45 s so dragged corpses leave trails; ragdolls weigh half
  (same fall, easier to drag: lower friction while held, the whole body follows the hand); the HUD, compass, menus and the
  inventory have a modern glass skin (ui/hudModern.css).
- [ ] Still open: ragdoll get-up is not cleaned up (the captured pose is applied to an upright root for 0.4 s), the third-person
  sword hold was only nudged (wrist bend), muscle-driven reactions beyond HUMANITY MOTION's zones.

## Phase 7 — World shape (2026-11-05): the land is no longer a plane
Inspired by Tectonic (warped ridges, plateau tiers, badlands ridges, dunes, pillars, rolling hills) and Biomes O' Plenty (volcano, crag,
jade cliffs, highland, moor, muskeg, bog pools). Everything is terrain mesh: no stacked rock modules (they read as props; see the
2026-11-01 and 2026-11-05 feedback). `world/landforms.js` holds the pure shapes, `heightfield.js` composes them.
- [x] Open country: broad swells, belts of hills with long valleys (rounded crests), cuestas (hillsides that break into cliff bands),
  narrow ravines, knolls, a few ponds; calm only close to sites and roads (the village lies in a valley, roads keep a walkable grade).
- [x] Mountains: a ring of varying depth plus the Nordkamm, ridges bent by a second noise (passes and massifs), a sheer wall at the edge.
- [x] Five landform regions, each with its own height model, ground colours and plants: Rotfelsen (south-west: mesas whose sides step
  down in ledges, flat-floored canyons, red banded strata), Sandmark (south: dunes with slip faces and mega-dunes, gold sand, dead
  trees), Aschenkrone (south-east: volcano with crater bowl and lava gullies, black ash and rock), Heidemoor (north-west: rolling moor,
  granite tors, shallow bog dishes with pools, heather), Jadegrat (east: ribbed stone towers over green lowland).
- [x] Steep ground gets rock detail in the grid itself (ribs and gullies, seamless across chunk borders), full-weight bare stone on
  walls, strata bands and weathering streaks in the terrain shader; a per-vertex stone tint (`rockTint`) carries red, black and
  gold rock; the rocks that remain (boulders, stone rings) take the tint of the place they stand on.
- [x] Removed: cliff walls, rock noses, ridges, tors, hoodoos and landmark towers/arches built from rock modules in the chunk scatter.
- [x] Tests: tests/landforms.test.js (determinism, regions differ from open country, no cracks between chunks, sites level, roads
  walkable, tints).
- [ ] Not done: smoke over the crater, ash and dust particles, cacti/palms/redwoods (needs Blockbench tree models), biome-specific
  animals, snow-capped regions that depend on temperature rather than height, a second river, fire fuel per new biome.

## Phase 8 — Flora rework (2026-11-05)
Trees, plants and places of every region, modelled in Blockbench (art/blockbench/models.js › trees / plants / pois, exported to public/models/);
the pictures on them are 47 textures made by Codex's image tool (art/textures/codex/, 32x32, cutouts transparent).
- [x] Trees: 57 models (was 20): bigger (x1.38 on the old species), roots that fork and a sunk collar round the foot; forking limbs (`ramify`) so the
  crown hangs on real wood; more variants of oak, autumn, maple, birch, spruce, pine; new species redwood (giant), willow, acacia, palm, cypress, jade
  tree, wind-bent moor pine, cherry blossom, jacaranda, olive, charred trunks, three cacti, mangrove with stilt roots.
- [x] Dynamic: every placed tree's roots are bent over the terrain under it vertex by vertex (uphill roots climb, downhill ones grip the drop; the collar
  sinks to the lowest side); plants lean with the ground and sink on slopes; ground tufts lean with the slope too; plants sway in the wind.
- [x] Biome tables: Rotfelsen (cactus, cypress, acacia on canyon floors, agave, dry shrubs), Sandmark (cactus, acacia, palms in oases, dry shrub, agave, pampas),
  Aschenkrone (burnt trunks, glowing mushrooms), Heidemoor (wind-bent pines, birches, heather everywhere), Jadegrat (jade trees, blossom, rare redwoods, ferns,
  toadstools), marsh (mangroves, willows, mushrooms), taiga (rare redwood giants, ferns), autumn woods (ferns, toadstools), shores (willows), dry south (olive, cypress, pampas, poppy).
- [x] 19 new plant models: heather x2, lavender, poppy, bluebell, thistle, pampas x2, dry shrub x2, agave x2 (one in flower), big fern x2, red / brown / glowing mushrooms.
- [x] Terrain grounds as pictures (src/world/groundLayers.js: one texture array, 16 layers, one extra sampler): red sand / clay / rock, dune sand, dry grass, ash, basalt,
  obsidian crust, heather, peat, moss rock, granite, jade grass, pine needles, cracked mud, clover; each region's `surface()` weights them; they are read on the wall's
  projection (not smeared down a cliff).
- [x] 10 points of interest (Blockbench models, sites/wilds.js, ground flattened for each, discoverable with lore): Verlassene Grube, Rippenfeld, Sonnenobelisk,
  Karawanenrast, Obsidianaltar, Brandhütte, Steinkreis, Torfstecherhütte, Jadeschrein, Hohler Stamm (with a ring of toadstools).
- [x] Tests: tests/flora.test.js (specs build, pictures exist, regions get their grounds, places are flat and named).
- [ ] Open: far terrain (32-unit grid) turns the sheer pillars into cones; the models of the new plants are placed by region, not yet by season; birds / insects per region;
  ground textures for river banks (gravel, limestone are made but unused); trees do not yet burn differently by species; chunk scatter takes ~23 ms (was ~12).

### Feedback on the flora rework (2026-11-05, same day) — fixed
- Colours too bright and too saturated, a red biome that was far too red, a purple moor, garish mixed-colour trees, one kind of rock, flat cards that showed a shifted piece of
  their picture, flower cards that duplicated the old ground sprites, toadstool cards cutting through the 3D toadstools.
- [x] Pictures are graded as they go in (saturation / gain per material in the models, per ground in groundLayers.js): sandstone is weathered brown-red, the moor is dusty brown
  peat and heather (not purple), granite is grey, grass less neon. Mesa tops are clay with dry-grass patches; the layer bands show only on walls (they were stripes on the flat).
- [x] Cards (`fit: true`) show the whole picture on their face (they used to tile it from an offset). Gone: jacaranda, blossom mixed with oak leaves (blossom trees are pure),
  lavender / poppy / bluebell / thistle cards (the old sprites are those flowers), cards inside the toadstools, sprite ferns where the 3D ferns grow.
- [x] More rock: limestone, granite and dark slate in broad areas, gravel where a slope crumbles (red sand and obsidian crust left the ground array to make room).
- [x] Colour presets (Einstellungen > Farbstil): Natürlich (new default, 'standard'), Lebendig (the old rich look), Dunkle Fantasy, Nordisch, Goldener Herbst, Filmisch.
- [x] Round 2 of the feedback (QC pass, same day): cherry blossom and jade tree removed (the Jadegrat wood is oak, birch, spruce and the odd redwood); limestone gone (the pale stone did not
  fit): bare rock outside the regions is the old grey stone, mossy rock where it is damp, dark rock in broad areas, gravel on crumbling slopes; hills no longer turn into bare stone caps
  (height-driven rock starts at the treeline); strata on canyon walls stay level (the turned reading of a picture made them vertical stripes); broad wall ribs only (the fine rib aliased
  on the 2-unit grid); footings sunk deeper (the far terrain lies 1.5 units lower than the near one); peat hut walls turf, hollow log round.
  QC walked: ten places, trees by species, plants, grounds of all regions, the six colour presets. Not checked: night; a full playthrough.
- [x] QC round 3 (same day, at player height, day and night, sprint run): birches have dark grey feet (the white root boards read as a star); no dark bush blobs in the dry lands (the dry shrubs
  are the plants there); plants are their own chunk job and keep a trunk's width from every tree; the heights of a chunk are their own job before its mesh; the reading spots of the places
  lie in front of what stands there (the caravan's and the log's were inside it); heather and peat a little lighter (the moor was pitch black at night); rock-family noise only where there is rock.
  Measured: sprint over 180 units, p50 13 ms, p95 20 ms, p99 35 ms, 5 frames over 40 ms in 22 s (worst 69 ms, a mesh job); scatter job 16 ms on average, plants 1 ms.

## Phase 9 — The shadow trades and the Pfade der Glut (2026-11-09, Claude)
Request: sneaking, pickpocketing and lockpicking in the spirit of Skyrim (not a copy), and a new skill tree with six paths
(Krieger, Magier, Assassine, Dieb, Schmied, Hexer), mostly placeholders for now, the menu a visual masterpiece.
- [x] Rules in one pure module (systems/thievery.js, tests/thievery.test.js): skills that grow with use (Klingenkunst,
  Glutmagie, Bogenschießen, Schleichen, Diebeskunst, Schmiedekunst, Hexerei; each level costs a little more, cap 100),
  detection from the AI brains (hidden / noticed / detected), sneak-attack factor, lock levels and rings, pockets by
  who someone is, the chance to lift something, bounty.
- [x] Sneaking (C): a veil round the reticle — two brackets that close in as the nearest foe grows aware, blue
  "Verborgen", amber "Bemerkt", red "Entdeckt"; practice for moving unseen near foes; a blade into an unaware foe
  counts ×2 (×3 with Meuchelstoß) with "MEUCHELANGRIFF"; Leiser Schritt halves the noise.
- [x] Pickpocketing: sneak within reach of someone and press E ("Taschen durchsuchen"). A glass card with their purse
  and a few things by trade (the steward and the king carry amber and gold, rangers arrows, guards picks); a wave of
  their attention scrolls by — reach in when they look away; each catch raises the suspicion; a mark facing you is
  hard. Caught: they turn on you, trust −25 and a memory, a bark, bounty +30. Pockets refill each day.
- [x] Lockpicking: about half the house chests carry a lock (Einfach/Mittel/Schwer/Meister, fixed per chest), home doors
  are locked from outside at night. A brass pixel lock of 2–5 rings turning at their own pace (a master's lock turns
  back now and then); set each ring when its glowing notch passes under the dietrich; a slip can break the pick
  (Unzerbrechlich saves one in three). Skill and Feine Dietriche widen the notches. Picked locks stay open; a picked
  chest gives coins and a little more by lock level. New item: Dietrich (5 to start, the trader sells them).
- [x] Pfade der Glut (K, or the pause menu): six seals, each path a tree of eight gems growing out of a glowing core,
  veins of molten light between lit nodes, a capstone crown, embers drifting in the path's colour; the detail card
  says what a node does ("Wirkt im Spiel" or "Platzhalter"); Glutsplitter (one per level) light a node whose parent
  is lit, with a flare and a burst of embers. Pixel sigils for every node and emblem (ui/sigils.js). The old perks
  live on in the paths. Checked at 1280×720, 1600×610 and on a phone (844×390, the node card and its button first).
- [ ] Open: most nodes are placeholders (the effects of Sturmlauf, Glutschild, Schmied and Hexer paths and the rest);
  guards do not yet arrest or fine for the bounty; a lit house at night does not yet notice a picked door; no
  pickpocketing from horseback or of sleeping people; NPC homes are not yet "owned" (taking from a chest is not theft).

## Phase 10 — The Zauberbuch: eight new spells and the Buch der Glut (2026-11-09, Claude)
Request: eight new spells of different elements and uses, a book menu to swap the spells in hand, spectacular to look at and
alive in the world.
- [x] Magicka: the HUD bar that was always full now counts (100, +5 a level, quicker back when the hand rests); spells cost
  magicka instead of stamina; Glutmagie and Arkaner Fokus make them cheaper; casting trains Glutmagie.
- [x] The Zauberhand: four spells ready (slot 2 of the quickbar shows the one in hand as its sigil in its element's colour);
  2 again or X switches (Shift+X back), tapping the slot again on touch. Saved with the game (data/spells.js, saveState.js).
- [x] Eight spells (systems/spellcraft.js; Funken stays in spellFx.js), each with world interaction:
  Frostlanze (ice spear; chills foes to a crawl; freezes water into an ice floe you can stand on, even lifts a swimmer;
  puts out grass fires and burning foes; rime on the ground) · Kettenblitz (strikes at once, jumps to up to three more foes,
  staggers; in water it shocks everyone standing in it, the wanderer too; dry grass catches) · Sturmstoß (a cone of wind:
  foes fall, crates, barrels and corpses fly, fires go out, rot clouds drift away, dust and leaves whirl) · Erdstachel (a
  line of stone spikes bursting out along the ground, following slopes, stopped by walls, throwing foes and loose things up)
  · Irrlicht (a light that follows over your shoulder for 90 s, lights night and caves; goblins see it from far and shy
  from it like fire) · Lebensquell (heals in waves, green light, a ring of pixel flowers and grass blooming round your feet,
  fire under you dies down) · Schattenschritt (a blink of up to 9 m that stops at walls and ledges, foes lose sight of you,
  silent) · Seuchennebel (a lobbed glob that bursts into a lingering cloud; poisons, foes flee it; fire turns it into an
  explosion that throws and burns; wind pushes it).
  Particles are three instanced pools (glow, haze, solid chunks), lightning an instanced beam set, light from the shared pool.
- [x] Buch der Glut (B, or the pause menu): an open grimoire on a dark table in candlelight — leather cover with gold
  corners, parchment pages, three chapter ribbons; the left page lists the spells by chapter (Die Elemente, Licht und Leben,
  Hexenwerk) with cost and the seal they lie in; the right page shows a living pixel plate of the element, the description
  with an initial, "In der Welt", the numbers and the Zauberhand as four wax seals (click or 1–4 lays the chosen spell in,
  swapping if needed; ✕ takes one out). Pages turn when you choose another spell; seals stamp; dust drifts in the light.
  First-person palm and third-person hand burn in the element of the spell in hand. Checked at 1280×720, 1600×610, 844×390.
- [ ] Open: spells are all known from the start (learning them from tomes, trainers or the Magier path later); Irrlicht in
  first person sits outside the view most of the time; frozen enemies only slow down (no full freeze yet); no spell
  combos on NPC allies; Schattenschritt does not yet pass through gaps narrower than a body.

## Phase 11 — Rucksack, crouching, the look into the pack (2026-11-09, Claude)
Request: crouch in first person while sneaking; the inventory was old-fashioned — make it modern with armour slots like
Minecraft; a smoother opening that looks as if the wanderer looks into the backpack; a hotkey for "Weg der Asche"
(read as the skill tree "Pfade der Glut": nothing in the game is called Weg der Asche).
- [x] Crouching: sneaking (C) lowers the eye, eased in and out (first person 2.30 → 1.64, third person a little).
- [x] Rucksack (ui/inventoryUI.js, inventory.css): left the wanderer as a living 3D figure (ui/paperDoll.js: a second
  modular character in the same outfit, idling, turned by dragging) between eight slots — Kopf, Brust, Hände, Füße on
  the left, Waffe, Bogen, Umhang, Schmuck on the right — with Rüstung, Schaden, Leben, Magicka below; the middle is the
  pack as a grid of 3D item pictures (ui/itemThumbs.js renders each item's preview model once), rarity as colour
  (grey/green/blue/gold), stack counts, worn/favourite/quest marks, names on hover; tabs with counts, search, sort
  (name, power, value, weight, rarity, count), filter; right the item turning in 3D with its numbers, a ▲/▼ comparison
  with what is worn, the action button and favourite/junk/drop. Drag an item onto its slot to put it on, a worn one back
  into the pack to take it off; double-click works too; clicking an empty slot shows what fits there. Trading (prices
  on the cells, quantity stepper) and chests use the same layout. A menu hub on top (I Rucksack, B Zauberbuch,
  K Pfade der Glut with a badge for unspent Glutsplitter, J Chronik) switches between the books; inside the pack B/K/J
  jump there too. Checked at 1280×720, 1600×610 and 844×390.
- [x] The look into the pack (systems/inventoryAccess.js): third person the camera comes over the shoulder to the
  wanderer's own eyes (the head is hidden then) and looks down into the open pack held at the chest; first person the
  pack comes up from below with its mouth tipped toward the eye, the flap standing up behind it, the hands holding it;
  the view then sinks a little toward the opening while the menu grows out of the pack's mouth (a circle opening from
  that screen point); closing folds the menu back into the mouth, pulls out, shuts the flap and shoulders the pack. The
  HUD fades away meanwhile. Re-opening while it closes carries on from where the pack is.
- [x] K for Pfade der Glut now in the key hints; the hub reaches it from the pack on touch too.
- [ ] Open: no splitting stacks by drag; no comparison for rings/amulets beyond the magic number; the figure does not
  yet show the held bow; touch has no long-press menu on cells (tap selects, the button acts).

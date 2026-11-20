# Review: Hemland cutscene "Die letzte Wacht"

You review a finished in-engine cutscene from still frames. Be strict and concrete; you are the last check
before the owner sees it. The owner's earlier complaints: animations not fitting the stocky Blockbench
figures, characters looking the wrong way, bodies stuck in stones/altar/each other, sword blows not landing.

## Material
- `qc/review/shot_XX.jpg`: one sheet per shot, 4 frames (top-left 15 %, top-right 40 %, bottom-left 65 %,
  bottom-right 90 % of the shot), letterboxed 2.39:1, the game's pixel look (low resolution + dither) is intended.
- Exception: the fight sheets show the beats instead: shot 8 = 48.4 s / 48.85 s / 49.0 s (blades meet) / 50.0 s,
  shot 10 = 56.6 / 57.4 / 57.6 s (blades meet) / 59.5 s, shot 11 = 61.8 / 62.45 / 62.6 s (hit) / 64.5 s,
  shot 12 = 67.5 / 68.8 / 69.0 s (thrust lands) / 70.4 s (order: top-left, top-right, bottom-left, bottom-right).
- `qc/review_auto.json`: the automatic checks (camera inside geometry, figures hidden or cut off, the bake's
  measurements of hits, facing, set and body overlaps). Use it, but judge the pictures yourself.

## The film (what each shot should show)
Figures: the CAPTAIN (Kronwacht knight: dark blue-grey plate, red tabard with a gold cross, helmet with gold
crest, red cape, sword with gold guard) and the BANDIT (brown/red leather, masked, rusty sword).
Set: a stone circle (standing stones, a grey altar with candles in the middle, a fallen stone), a campfire,
misty spruce forest at dusk, low sun from the west.
1. 0–11 s crane over the forest down to the stone circle (no people needed)
2. 11–17 bandit sitting at his fire, seen through the flames
3. 17–26 captain walking along the forest path towards the circle, backlit
4. 26–30 close: the bandit lifts his head
5. 30–36 over the captain's shoulder across the altar: the bandit gets up and takes his sword
6. 36–41 the captain draws his sword
7. 41–47 both circle each other in guard, facing each other
8. 47–51 bandit strikes overhead, captain blocks high: the blades meet
9. 51–55 captain slashes, bandit dodges back
10. 55–61 bandit lunges with a thrust, captain parries (slow motion): the blades meet
11. 61–66 the bandit's slash hits the captain, he staggers
12. 66–71 the captain's thrust goes into the bandit (slow motion)
13. 71–79 the bandit sinks down and falls
14. 79–86 from above: the circle, the fire, one man standing, the dead one lying
15. 86–102 the captain kneels by the dead bandit and rises
16. 102–112 the captain walks out of the circle into the mist and light
17. 112–120 the crane rises, fade to black

## Check every shot for
1. Clipping: a body inside a stone, the altar, the fire, a prop, the ground, or inside the other body.
2. Facing: in shots 5–13 and 15 the people turn towards each other / towards what they act on.
3. Contact: blows that should meet (8, 10) do meet; hits (11, 12) reach the body.
4. Body fit: arms through the torso, twisted or broken limbs, feet floating or sunk, poses that read as wrong for
   a heavy armoured knight.
5. Camera: the subject is visible, not covered by a stone or tree, not cut off badly, the frame reads.
6. Story: does the frame show what the shot list says?

## Answer
Only JSON, no prose around it:
```json
{"issues": [{"shot": 8, "frame": "top-right", "type": "clipping|facing|contact|body|camera|story",
  "severity": "high|medium|low", "what": "the bandit's blade passes through the captain's helmet",
  "fix": "move the bandit 0.3 m back / lower the strike / ..."}],
 "verdict": "pass|fail", "summary": "two sentences"}
```
`fail` if any `high` issue is left.

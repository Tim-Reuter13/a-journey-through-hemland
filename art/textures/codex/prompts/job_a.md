You are making game textures for a Minecraft-meets-Skyrim-PS1 pixel-art RPG (Three.js). Work only on the files named below.

For EACH entry in the list:
1. Use your built-in image generation tool to create ONE square image. Style: pixel art on a hard 32x32 grid of cells (every cell one flat, solid colour block, clearly visible; NO gradients, NO anti-aliasing, NO outlines, NO text, NO border or frame, NO perspective). Muted, natural, slightly desaturated palette in the spirit of Skyrim/PS1 realism with 4-7 colours per texture and gentle value steps; flat even lighting (no cast shadows, no highlights from a light source); varied, organic detail (not a plain noise, not a regular grid).
2. Convert the generated image to exactly a 32x32 PNG: split it into 32x32 equal blocks and take the median colour of each block per channel (Python with PIL and numpy if available; otherwise PowerShell System.Drawing). Never smooth or blend.
3. Save it as `art/textures/codex/<name>.png` (relative to the current directory; the folder exists).
Kinds:
- `tile`: an opaque, seamlessly tileable texture. The left edge must continue into the right edge and the top into the bottom (design it as a repeating pattern; if the generator's edges do not match, mirror-blend the 3 outermost cell columns/rows so they do). Viewed from straight above for ground, or flat-on for bark/rock.
- `cutout`: ask the generator for the motif on a flat, pure magenta (#FF00FF) background. After converting, set every cell whose colour is close to magenta (distance < 90 in RGB) to fully transparent (alpha 0) and all others to alpha 255 (save as RGBA PNG). The motif should fill most of the square, so it reads as a clump or a plant when stood upright or used on a flat card.
Do not modify any other file. If one image fails, retry it once, then continue. Final answer: one line per file written (name - what it shows), and say clearly if any entry is missing.

Entries:
- `red_sand` (tile): fine orange-red desert sand with faint wind ripples and a few darker grains
- `red_clay` (tile): terracotta clay ground, dry, with a network of thin dark polygon cracks
- `red_rock` (tile): banded red sandstone strata, horizontal layers of red, orange, rust and cream, a few dark cracks
- `dune_sand` (tile): pale golden dune sand with soft curved wind ripples
- `dry_grass` (tile): steppe ground covered with short straw-yellow and tan dry grass blades, bare earth showing between
- `ash_ground` (tile): black and dark grey volcanic ash with scattered paler grey flecks and tiny cinders
- `basalt` (tile): dark grey-black basalt rock face with fine cracks and a faint columnar structure
- `obsidian_crust` (tile): black glassy lava crust with a few thin dull-orange glowing cracks, mostly dark

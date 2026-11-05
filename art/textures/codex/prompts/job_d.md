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
- `leaves_redwood` (cutout): dense dark blue-green flat needle sprays of a giant redwood, seen from the side
- `leaves_willow` (cutout): long thin yellow-green drooping willow strands hanging down, with small leaves
- `leaves_acacia` (cutout): small feathery olive-green acacia leaflets in flat layers
- `leaves_palm` (cutout): a spread of long green palm frond blades radiating from a point
- `leaves_cypress` (cutout): dark green scaly cypress foliage spray
- `leaves_jade` (cutout): layered round blue-teal leaves of a fantasy jade tree
- `leaves_blossom` (cutout): pink cherry blossom clusters with a few green leaves
- `leaves_purple` (cutout): lilac and violet jacaranda blossom clusters with green leaves
- `leaves_olive` (cutout): grey-green narrow olive leaves in sprays
- `plant_heather_bloom` (cutout): a clump of upright heather stems with purple-pink flower spikes
- `plant_lavender` (cutout): lavender stalks with violet flower heads and grey-green leaves
- `plant_agave` (cutout): a blue-green agave rosette of thick pointed leaves
- `plant_poppy` (cutout): a few red poppies on thin green stems
- `plant_bluebell` (cutout): bluebells: arching stems with nodding blue bell flowers
- `plant_thistle` (cutout): thistle with spiky grey-green leaves and a purple flower head
- `mushroom_red` (cutout): a cluster of red fly-agaric mushrooms with white spots
- `mushroom_brown` (cutout): a cluster of brown forest mushrooms
- `mushroom_glow` (cutout): a cluster of pale teal glowing cave mushrooms
- `plant_pampas` (cutout): tall pale pampas grass tufts with feathery plumes
- `plant_dry_shrub` (cutout): a dry brown tangled desert shrub / tumbleweed

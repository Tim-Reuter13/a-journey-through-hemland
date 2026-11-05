You are redoing a few game textures for a Minecraft-meets-Skyrim-PS1 pixel-art RPG. Work only on the files named below.

For EACH entry:
1. Use your built-in image generation tool to create ONE square image: pixel art on a hard 32x32 grid of cells (each cell one flat solid colour block, clearly visible; NO gradients, NO anti-aliasing, NO outlines, NO text, NO frame), muted natural colours, 5-8 colours. The motif is drawn on a flat, pure magenta (#FF00FF) background, and the motif itself must contain NO magenta, pink-magenta or fuchsia pixels at all (flowers are purple/violet/lilac or pink-red, never #FF00FF-like).
2. Convert it to exactly a 32x32 RGBA PNG with this exact algorithm, working at the generated image's full resolution (Python with PIL and numpy): (a) a pixel is background if its RGB distance to (255,0,255) is below 110; (b) split the image into 32x32 equal blocks; (c) a block is transparent (alpha 0) if more than 45% of its pixels are background, otherwise its colour is the per-channel MEDIAN of its non-background pixels only and alpha is 255. Never blend with the background colour.
3. Save as `art/textures/codex/<name>.png` (the folder exists; overwrite the old file).
Finally verify each saved PNG has no opaque pixel with R>200, B>200 and G<90, and that 25-65% of its cells are opaque. Do not modify any other file. Final answer: one line per file written, and say clearly if any entry is missing.

Entries:
- `leaves_purple`: lilac and violet jacaranda blossom clusters (many small purple flowers, clearly purple not magenta) on green-brown twigs with some green leaves, filling most of the square
- `plant_heather_bloom`: a clump of upright heather stems with many small pink-purple (mauve, dusty rose) flower spikes and dark green needle leaves
- `plant_thistle`: a thistle with spiky grey-green leaves and a violet-purple spiky flower head on a stem
- `plant_lavender`: lavender stalks with violet-blue flower heads and grey-green leaves
- `plant_dry_shrub`: a dry brown tangled desert shrub with thin twigs, a few tiny olive leaves, tan and brown colours only

# Codex textures

47 nature textures (2026-11-05), 32x32, made with Codex's built-in image tool from the prompts in `prompts/` (job_e redid five cutouts with the color key applied before the downscale)
(one picture per texture, then reduced to the 32x32 cell grid by block medians; cutouts were drawn on magenta and have alpha 0 where it was).
Used by the Blockbench models (`style: 'image'` materials in `art/blockbench/models.js`: bark, leaves, plant cards) and, for the ground ones, copied to
`public/textures/ground/` for the terrain (`src/world/groundLayers.js`). Changing one here needs the model rebuilt (see `art/blockbench/README.md`).

# Ashen Realms — Art Direction

Reference: `C:\Users\timre\Desktop\RPG Reffernzen\Style.pdf`.
Target: **Skyrim on the PS1 meets Minecraft/Blockbench.** Not a voxel world — smooth terrain and freely
placed, rotated boxes, but every surface wears crisp 16×16 pixel textures.

## Rules
1. **Texel density is sacred: 16 texels per world unit** everywhere (terrain, buildings, props, characters).
   Boxes get per-face UVs in world units (`src/art/blocks.js`), never stretched textures.
2. **Nearest filtering only.** No smooth gradients from texture filtering, no normal/bump maps.
3. **Everything is boxes or crossed quads.** No spheres, cylinders, cones, icosahedrons. Round things are
   built from 2–4 overlapping/rotated boxes (Blockbench style).
4. **Palette:** muted, ashy, slightly cold. Greens lean olive, stone leans blue-grey, wood is warm brown,
   accents are ember orange and brass. Roofs: slate blue-green and old red.
5. **Lighting:** Lambert shading, one sun + hemisphere, heavy distance fog. Warm point lights at night.
6. **PS1 output:** scene renders to a low-res target and is upscaled with nearest filtering, then
   15-bit colour quantisation with ordered dithering (`src/systems/retroRenderer.js`).
7. **Characters (Dark Souls PS1 proportions):** ~40 px tall, head ≈ 1/5.5 of height, slim limbs,
   3-segment limbs, armour as separate proud layers. Authored in Blockbench (`art/blockbench/*.bbmodel`),
   exported to `public/models/*.gltf`.
8. **Animation:** weight and timing over flailing — anticipation, follow-through, counter-rotation of hips
   and shoulders, knees and elbows bend. Implemented in `src/characters/animator.js`.

## Where things live
- `src/art/pixelTextures.js` — all procedural 16×16 textures + shared materials (`pixelMaterial(name)`).
- `src/art/blocks.js` — box/quad helpers with world-unit UVs.
- `src/world/*` — terrain, flora, buildings using the helpers above.
- `art/blockbench/` — Blockbench sources; `public/models/` — exported glTF.

// The grounds that come as pictures (public/textures/ground/*.png, made by Codex; loaded into one texture array by groundLayers.js).
export const GROUND = ['red_clay', 'red_rock', 'dune_sand', 'dry_grass', 'ash_ground', 'heather', 'peat', 'basalt', 'moss_rock', 'jade_grass', 'pine_needles',
  'cracked_mud', 'granite', 'clover_meadow', 'limestone', 'gravel'];
export const GROUND_INDEX = Object.fromEntries(GROUND.map((n, i) => [n, i]));

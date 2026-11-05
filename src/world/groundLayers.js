import * as THREE from 'three';
import { GROUND, GROUND_INDEX } from './groundNames.js';
export { GROUND, GROUND_INDEX };

// Ground textures of the landform regions and the woods, made as pictures by Codex (32x32, seamless, public/textures/ground/*.png) and
// kept in ONE texture array: the terrain shader reads any layer by index, so many more grounds cost one sampler. Until the pictures
// have loaded each layer holds a plain colour, so the terrain always draws.
const SIZE = 32;
// The pictures are bright and rich; the land is not. Each ground is graded as it goes in: saturation, gain and a tint, so red earth reads as
// weathered brown-red sandstone, heather as dusty brown moor and not neon, granite as grey stone and not snow.
const GRADE = { red_clay: [.5, .74, [1.04, .98, .9]], red_rock: [.48, .72, [1.04, .98, .9]], dune_sand: [.78, .9, [1, .99, .95]], dry_grass: [.72, .88], ash_ground: [.85, 1], heather: [.3, .66, [1.1, 1.02, .82]],
  peat: [.8, .95], basalt: [.8, .88], moss_rock: [.78, .86], jade_grass: [.72, .82], pine_needles: [.8, .9], cracked_mud: [.7, .84, [1.02, .98, .92]], granite: [.5, .58], clover_meadow: [.75, .86],
  gravel: [.8, .84] };
const FALLBACK = [[120, 84, 66], [118, 78, 62], [190, 168, 120], [130, 116, 74], [40, 38, 40], [78, 66, 62], [48, 38, 28], [40, 40, 44], [90, 110, 80], [60, 96, 50], [84, 56, 36], [170, 154, 128], [110, 110, 108], [76, 112, 58], [104, 98, 90]];
const data = new Uint8Array(SIZE * SIZE * 4 * GROUND.length);
GROUND.forEach((_, layer) => { for (let i = 0; i < SIZE * SIZE; i++) { const o = (layer * SIZE * SIZE + i) * 4; data[o] = FALLBACK[layer][0]; data[o + 1] = FALLBACK[layer][1]; data[o + 2] = FALLBACK[layer][2]; data[o + 3] = 255; } });
export const groundTexture = new THREE.DataArrayTexture(data, SIZE, SIZE, GROUND.length);
groundTexture.format = THREE.RGBAFormat; groundTexture.type = THREE.UnsignedByteType;
groundTexture.magFilter = THREE.NearestFilter; groundTexture.minFilter = THREE.NearestMipmapLinearFilter; groundTexture.generateMipmaps = true;
groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping; groundTexture.colorSpace = THREE.SRGBColorSpace; groundTexture.needsUpdate = true;

/** Loads the pictures into the array (a missing one keeps its plain colour). Resolves with how many were found. */
export async function loadGroundLayers(base = `${import.meta.env.BASE_URL}textures/ground/`) {
  let found = 0;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  await Promise.all(GROUND.map((name, layer) => new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      ctx.clearRect(0, 0, SIZE, SIZE); ctx.drawImage(image, 0, 0, SIZE, SIZE);
      const pixels = ctx.getImageData(0, 0, SIZE, SIZE).data, [sat, gain, tint = [1, 1, 1]] = GRADE[name] ?? [1, 1];
      for (let i = 0; i < pixels.length; i += 4) {
        const o = layer * SIZE * SIZE * 4 + i, l = pixels[i] * .3 + pixels[i + 1] * .59 + pixels[i + 2] * .11;
        for (let c = 0; c < 3; c++) data[o + c] = Math.min(255, Math.max(0, (l + (pixels[i + c] - l) * sat) * gain * tint[c]));
        data[o + 3] = 255;
      }
      found++; resolve();
    };
    image.onerror = () => resolve();
    image.src = `${base}${name}.png`;
  })));
  if (found) groundTexture.needsUpdate = true;
  return found;
}

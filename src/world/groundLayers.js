import * as THREE from 'three';
import { GROUND, GROUND_INDEX } from './groundNames.js';
export { GROUND, GROUND_INDEX };

// Ground textures of the landform regions and the woods, made as pictures by Codex (32x32, seamless, public/textures/ground/*.png) and
// kept in ONE texture array: the terrain shader reads any layer by index, so many more grounds cost one sampler. Until the pictures
// have loaded each layer holds a plain colour, so the terrain always draws.
const SIZE = 32;
// A few pictures are lighter than the land round them (granite reads as snow from afar): they are darkened as they go in.
const GAIN = { granite: .66, cracked_mud: .9, dune_sand: .94 };
const FALLBACK = [[176, 96, 60], [160, 84, 52], [150, 72, 52], [212, 184, 120], [150, 130, 70], [40, 38, 40], [110, 70, 110], [48, 38, 28], [40, 40, 44], [90, 110, 80], [50, 110, 40], [84, 56, 36], [190, 170, 140], [150, 150, 148], [90, 140, 60], [24, 22, 26]];
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
      const pixels = ctx.getImageData(0, 0, SIZE, SIZE).data, gain = GAIN[name] ?? 1;
      for (let i = 0; i < pixels.length; i += 4) { const o = layer * SIZE * SIZE * 4 + i; data[o] = Math.min(255, pixels[i] * gain); data[o + 1] = Math.min(255, pixels[i + 1] * gain); data[o + 2] = Math.min(255, pixels[i + 2] * gain); data[o + 3] = 255; }
      found++; resolve();
    };
    image.onerror = () => resolve();
    image.src = `${base}${name}.png`;
  })));
  if (found) groundTexture.needsUpdate = true;
  return found;
}

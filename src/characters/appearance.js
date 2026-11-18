// Appearance data for modular characters: the character creator edits an
// appearance object, NPC definitions declare one, and the modular character
// builder turns it into body + face + hair + outfit parts.
//
// Colour lists only ever grow at their end: saves store indices. The creator shows them in its own order.
import { ORIGIN_IDS } from '../data/origins.js';

export const APPEARANCE_OPTIONS = {
  bodies: [{ id: 'male', label: 'Männlich' }, { id: 'female', label: 'Weiblich' }],
  builds: [{ id: 'slim', label: 'Schlank' }, { id: 'normal', label: 'Normal' }, { id: 'strong', label: 'Kräftig' }],
  skins: ['#f0c8a8', '#e3b08e', '#c9946f', '#a8744f', '#80553a', '#5c3b28', '#e6c29e', '#d6a17c', '#b9875e', '#45301f'],
  hairStyles: [
    { id: 'short', label: 'Kurz' }, { id: 'tousled', label: 'Zerzaust' }, { id: 'long', label: 'Lang' },
    { id: 'braid', label: 'Zopf' }, { id: 'ponytail', label: 'Pferdeschwanz' }, { id: 'bun', label: 'Knoten' },
    { id: 'shaved', label: 'Kahl' }, { id: 'undercut', label: 'Seitenschnitt' }, { id: 'warrior', label: 'Kriegerzöpfe' },
    { id: 'mane', label: 'Wilde Mähne' }, { id: 'bob', label: 'Kinnlang' },
  ],
  hairColors: ['#1c1714', '#3b2a20', '#6a4128', '#8d5a33', '#a8824c', '#cdb27a', '#8a3a24', '#9a9a94', '#d8d6cf', '#2b211b', '#a5532e', '#e0cfa2'],
  beards: [{ id: null, label: 'Keiner' }, { id: 'stubble', label: 'Stoppeln' }, { id: 'short', label: 'Kurz' }, { id: 'full', label: 'Voll' }, { id: 'moustache', label: 'Schnauzer' },
    { id: 'braided', label: 'Geflochten' }, { id: 'goatee', label: 'Spitzbart' }, { id: 'mutton', label: 'Koteletten' }],
  // The sixth was a violet; it is amber now (Hemland stays earthy).
  eyeColors: ['#3b5566', '#2c3b44', '#4a6a3a', '#5a3d26', '#7a8a96', '#8a6a2e', '#6b5a3a', '#55707a'],
  faces: [{ id: 'calm', label: 'Ruhig' }, { id: 'stern', label: 'Streng' }, { id: 'soft', label: 'Sanft' }, { id: 'weathered', label: 'Wettergegerbt' }],
  // Painted over the face (modular.js paintOverlay).
  scars: [{ id: false, label: 'Ohne Narbe' }, { id: 'brow', label: 'Durch die Braue' }, { id: 'cheek', label: 'Über die Wange' }, { id: 'lip', label: 'Gespaltene Lippe' }, { id: 'cross', label: 'Gekreuzt' }],
  paints: [{ id: null, label: 'Keine' }, { id: 'ash', label: 'Aschestreif' }, { id: 'claw', label: 'Krallenspur' }, { id: 'ochre', label: 'Ockerkinn' }, { id: 'woad', label: 'Waidblau' }],
  marks: [{ id: null, label: 'Keine' }, { id: 'freckles', label: 'Sommersprossen' }, { id: 'mole', label: 'Muttermal' }, { id: 'flush', label: 'Rote Wangen' }, { id: 'tired', label: 'Augenringe' }],
  heights: [{ id: -2, label: 'Sehr klein' }, { id: -1, label: 'Klein' }, { id: 0, label: 'Mittel' }, { id: 1, label: 'Groß' }, { id: 2, label: 'Sehr groß' }],
};

export const DEFAULT_APPEARANCE = {
  name: 'Wanderer', body: 'male', build: 'normal', skin: 2, hair: 'short', hairColor: 2, beard: 'short',
  eyes: 0, face: 'calm', scar: false, paint: null, mark: null, height: 0, origin: 'wanderer',
};

/** Clamps an untrusted appearance (save game, UI) to known options. */
export function normalizeAppearance(value = {}) {
  // Option ids may be null ("no beard"), so `??` must not be used to unwrap them.
  const o = APPEARANCE_OPTIONS, pick = (list, v, fallback) => list.some(e => (e && typeof e === 'object' ? e.id : e) === v) ? v : fallback;
  const index = (list, v, fallback) => Number.isInteger(v) && v >= 0 && v < list.length ? v : fallback;
  const d = DEFAULT_APPEARANCE;
  // Older saves stored the scar as true/false.
  const scar = value.scar === true ? 'brow' : pick(o.scars, value.scar, d.scar);
  return {
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim().slice(0, 24) : d.name,
    body: pick(o.bodies, value.body, d.body), build: pick(o.builds, value.build, d.build),
    skin: index(o.skins, value.skin, d.skin), hair: pick(o.hairStyles, value.hair, d.hair),
    hairColor: index(o.hairColors, value.hairColor, d.hairColor), beard: pick(o.beards, value.beard ?? null, d.beard),
    eyes: index(o.eyeColors, value.eyes, d.eyes), face: pick(o.faces, value.face, d.face), scar,
    paint: pick(o.paints, value.paint ?? null, d.paint), mark: pick(o.marks, value.mark ?? null, d.mark), height: pick(o.heights, value.height, d.height),
    origin: ORIGIN_IDS.includes(value.origin) ? value.origin : d.origin,
  };
}

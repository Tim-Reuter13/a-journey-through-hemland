// Character definitions for the modular system: an appearance (see
// characters/appearance.js) plus equipped item ids. Everything a character wears
// is a real item, so it can be looted and worn by the player. `extras` are purely
// cosmetic parts (quivers, satchels) that are not items.

export const PLAYER_DEFAULT = {
  appearance: { name: 'Wanderer', body: 'male', build: 'normal', skin: 2, hair: 'short', hairColor: 2, beard: 'short', eyes: 0, face: 'calm' },
};

export const NPC_LOOKS = {
  elira: { appearance: { body: 'female', build: 'slim', skin: 1, hair: 'braid', hairColor: 7, eyes: 0, face: 'weathered' },
    equipment: { armor: 'aeltestenrobe', feet: 'lederschuhe' }, extras: [] },
  bryn: { appearance: { body: 'male', build: 'strong', skin: 3, hair: 'short', hairColor: 0, beard: 'full', eyes: 3, face: 'stern' },
    equipment: { armor: 'schmiedekluft', hands: 'lederhandschuhe', feet: 'wanderstiefel' }, weaponModel: 'hammer' },
  soren: { appearance: { body: 'male', build: 'slim', skin: 2, hair: 'tousled', hairColor: 5, beard: 'stubble', eyes: 2, face: 'calm' },
    equipment: { armor: 'waldlaeuferkluft', head: 'kapuze', hands: 'armschienen', feet: 'wanderstiefel' }, extras: ['quiver'] },
};

// Bandits get varied faces from a small pool, so the camp does not look cloned.
const BANDIT_FACES = [
  { body: 'male', skin: 3, hair: 'shaved', hairColor: 0, beard: 'stubble', eyes: 3, face: 'stern' },
  { body: 'male', skin: 4, hair: 'ponytail', hairColor: 1, beard: 'moustache', eyes: 1, face: 'weathered' },
  { body: 'female', skin: 2, hair: 'long', hairColor: 6, eyes: 4, face: 'stern' },
];
export function banditLook(index, captain = false) {
  if (captain) return { appearance: { body: 'male', build: 'strong', skin: 2, hair: 'short', hairColor: 0, beard: 'full', eyes: 1, face: 'stern' },
    equipment: { weapon: 'waechterklinge', armor: 'hauptmannsplatte', head: 'topfhelm', cloak: 'roter_umhang', feet: 'wanderstiefel' } };
  return { appearance: BANDIT_FACES[index % BANDIT_FACES.length],
    equipment: { weapon: 'rostiges_schwert', armor: 'banditenkluft', head: index % 2 ? 'banditenmaske' : 'eisenhelm', hands: 'armschienen', feet: 'wanderstiefel' },
    extras: index % 3 === 1 ? ['satchel'] : [] };
}

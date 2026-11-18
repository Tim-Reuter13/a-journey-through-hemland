// Where the Wanderer comes from (character editor 2.0). Each origin is a few lines of past and a small head start: a skill a
// step further, a little more of one pool, a handful of things in the satchel. Nothing that decides a fight; it colours the
// first hours. The choice is kept with the appearance (appearance.js), so a save remembers it.

export const ORIGINS = [
  { id: 'wanderer', label: 'Wanderer', crest: '✦', lore: 'Kein Dorf hielt dich lange. Du kennst die Straßen der Aschmark besser als jedes Bett.',
    bonus: '+10 Ausdauer · 3 Reisefladen', gift: { maxStamina: 10, items: { reisefladen: 3 } } },
  { id: 'soldier', label: 'Söldner', crest: '⚔', lore: 'Zehn Winter im Sold eines Fürsten, der deinen Namen nie kannte. Die Narben kennen ihn.',
    bonus: 'Schwertkampf +1 · +10 Leben', gift: { maxHp: 10, skills: { sword: 1 } } },
  { id: 'hunter', label: 'Fallensteller', crest: '➶', lore: 'Du hast im Nordwald Fallen gestellt und Felle verkauft. Du hörst ein Reh, bevor es dich hört.',
    bonus: 'Bogenschießen +1 · 2 Hasenfelle', gift: { skills: { archery: 1 }, items: { hasenfell: 2 } } },
  { id: 'acolyte', label: 'Novize der Glut', crest: '☀', lore: 'Im Kloster am Grauen See lerntest du, dass Feuer zuhört, wenn man leise genug spricht.',
    bonus: 'Magie +1 · +15 Magicka', gift: { maxMagicka: 15, skills: { magic: 1 } } },
  { id: 'urchin', label: 'Gassenkind', crest: '☾', lore: 'Kronwachts Gassen haben dich großgezogen. Du weißt, welche Türen nachts nicht abgeschlossen sind.',
    bonus: 'Schleichen +1 · Diebeskunst +1 · 3 Dietriche', gift: { skills: { sneak: 1, thievery: 1 }, items: { dietrich: 3 } } },
  { id: 'smith', label: 'Schmiedelehrling', crest: '⚒', lore: 'Sechs Jahre am Amboss deines Onkels, bis die Esse kalt wurde und er mit ihr.',
    bonus: 'Schmieden +1 · 2 Eisenerz · Lederstreifen', gift: { skills: { smithing: 1 }, items: { eisenerz: 2, leder: 1 } } },
  { id: 'herbalist', label: 'Kräuterkundige', crest: '❦', lore: 'Moor und Waldrand waren deine Apotheke. Manche nannten dich Hexe, alle kamen, wenn das Fieber stieg.',
    bonus: 'Hexenkunst +1 · Heiltrank · 4 Waldkräuter', gift: { skills: { witchcraft: 1 }, items: { heiltrank: 1, kraeuter: 4 } } },
];
export const ORIGIN_IDS = ORIGINS.map(o => o.id);
export const originById = id => ORIGINS.find(o => o.id === id) || ORIGINS[0];

/** Gives a fresh character the head start of its origin. `give(id)` puts one item into the satchel. Returns the origin. */
export function applyOrigin(player, id, give = () => {}) {
  const origin = originById(id), g = origin.gift;
  if (g.maxHp) { player.maxHp += g.maxHp; player.hp = player.maxHp; }
  if (g.maxStamina) { player.maxStamina += g.maxStamina; player.stamina = player.maxStamina; }
  if (g.maxMagicka) { player.maxMagicka += g.maxMagicka; player.magicka = player.maxMagicka; }
  for (const [skill, n] of Object.entries(g.skills || {})) player.skills[skill] = (player.skills[skill] || 0) + n;
  for (const [item, n] of Object.entries(g.items || {})) for (let k = 0; k < n; k++) give(item);
  return origin;
}

// Ready-made faces to start from: a whole look in one click, then change what you like.
export const PRESETS = [
  { id: 'nord', label: 'Nordländerin', origin: 'hunter', look: { body: 'female', build: 'strong', height: 1, skin: 0, eyes: 0, face: 'stern', hair: 'warrior', hairColor: 5, beard: null, scar: 'cheek', paint: 'ash', mark: null } },
  { id: 'veteran', label: 'Grauer Söldner', origin: 'soldier', look: { body: 'male', build: 'strong', height: 1, skin: 1, eyes: 4, face: 'weathered', hair: 'shaved', hairColor: 7, beard: 'braided', scar: 'cross', paint: null, mark: null } },
  { id: 'witch', label: 'Moorhexe', origin: 'herbalist', look: { body: 'female', build: 'slim', height: -1, skin: 3, eyes: 2, face: 'calm', hair: 'mane', hairColor: 1, beard: null, scar: false, paint: 'woad', mark: 'tired' } },
  { id: 'thief', label: 'Junger Dieb', origin: 'urchin', look: { body: 'male', build: 'slim', height: -1, skin: 7, eyes: 5, face: 'soft', hair: 'undercut', hairColor: 10, beard: 'stubble', scar: 'lip', paint: null, mark: 'freckles' } },
  { id: 'monk', label: 'Glutnovize', origin: 'acolyte', look: { body: 'male', build: 'normal', height: 0, skin: 4, eyes: 3, face: 'calm', hair: 'bun', hairColor: 0, beard: 'goatee', scar: false, paint: 'ochre', mark: null } },
  { id: 'smith', label: 'Schmiedin', origin: 'smith', look: { body: 'female', build: 'strong', height: 0, skin: 8, eyes: 6, face: 'stern', hair: 'bob', hairColor: 6, beard: null, scar: 'brow', paint: null, mark: 'flush' } },
];

// Names for the dice beside the name field.
export const NAME_POOL = {
  male: ['Aldric', 'Ansgar', 'Bertolt', 'Corwin', 'Eckhart', 'Falk', 'Gerwin', 'Hagen', 'Ivar', 'Jorek', 'Kunrad', 'Lothar', 'Merten', 'Oswin', 'Ragnar', 'Rutger', 'Sigmar', 'Ulfric', 'Volkmar', 'Wendel'],
  female: ['Alwine', 'Brunhild', 'Dagmar', 'Edda', 'Freya', 'Gunda', 'Hedda', 'Ilsa', 'Irmgard', 'Liesel', 'Mechthild', 'Nele', 'Ragna', 'Runa', 'Sieglind', 'Svana', 'Thora', 'Ulla', 'Walburg', 'Yrsa'],
};

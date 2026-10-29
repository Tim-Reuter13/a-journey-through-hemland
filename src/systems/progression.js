import { DEFAULT_APPEARANCE } from '../characters/appearance.js';
import { INITIAL_SATCHEL, INITIAL_MERCHANT } from './items.js';

export const INITIAL_CHARACTER = {
  hp: 100, maxHp: 100, stamina: 100, maxStamina: 100, level: 1, xp: 0,
  perkPoints: 0, gold: 24, potions: 3, kills: 0,
  skills: { sword: 1, magic: 0, survival: 0, archery: 1 },
  attributes: { strength: 1, arcane: 1, endurance: 1 }, perks: [],
  appearance: { ...DEFAULT_APPEARANCE }, equipment: { weapon: 'rostiges_schwert', ranged: 'jagdbogen', armor: 'reisekleidung', head:null, hands:'armschienen', feet:'wanderstiefel', cloak:'reiseumhang', accessory:null }, loot: [],
  satchel:INITIAL_SATCHEL, favorites:['heiltrank'], junk:[], stash:{}, drops:[], merchant:INITIAL_MERCHANT,
};

export function resetCharacter(player) {
  Object.assign(player, structuredClone(INITIAL_CHARACTER));
}

export function gainExperience(player, amount) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  player.xp += amount;
  let levels = 0;
  while (player.xp >= player.level * 100 && player.level < 100) {
    player.xp -= player.level * 100;
    player.level++; player.perkPoints++;
    player.maxHp += 10 + player.attributes.endurance * 2;
    player.maxStamina += 5 + player.attributes.endurance;
    levels++;
  }
  if (levels) { player.hp = player.maxHp; player.stamina = player.maxStamina; }
  return levels;
}

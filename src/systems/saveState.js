import { INITIAL_CHARACTER } from './progression.js';
import { normalizeAppearance } from '../characters/appearance.js';
import { ITEMS, sanitizeCounts, isEquipment, equipSlot, EQUIPMENT_SLOTS } from './items.js';

export const SAVE_VERSION = 6;
const number = (value, fallback, min, max) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const integer = (value, fallback, min, max) => Math.floor(number(value, fallback, min, max));
const knownPerks = new Set(['schwertmeister', 'arkaner_fokus', 'eisernes_herz', 'meisterschuetze', 'ruhige_hand']);
const knownItems = new Set(Object.keys(ITEMS));
import { QUESTS } from '../data/hemland/story.js';
import { BOUNDS } from '../world/hemland.js';
import { persistBrain } from './ai/brain.js';
const quests = new Set(QUESTS.main.map(stage => stage.id));
const within = (v, min, max, fallback) => Number.isFinite(v) && v >= min && v <= max ? v : fallback;
// Flags are small primitives; anything else in a save is dropped.
const flagsFrom = flags => Object.fromEntries(Object.entries(flags && typeof flags === 'object' ? flags : {})
  .filter(([key, value]) => /^[a-z][a-z0-9_]{0,40}$/.test(key) && (['boolean', 'number', 'string'].includes(typeof value) || value === null))
  .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 60) : value]).slice(0, 200));

// A person's state of mind that outlives a save (systems/ai): yielded or spared, robbed, a few memories.
const AI_STATES = new Set(['pacified', 'grateful', 'surrendered', 'gone']);
function aiFrom(v) {
  if (!v || typeof v !== 'object') return undefined;
  return { s: AI_STATES.has(v.s) ? v.s : undefined, sp: v.sp === true || undefined, rb: v.rb === true || undefined,
    m: Array.isArray(v.m) ? v.m.filter(k => typeof k === 'string' && /^[a-zA-Z]{1,24}$/.test(k)).slice(0, 8) : undefined };
}
export function normalizeSave(data) {
  if (!data || ![1, 2, 3, 4, 5, 6].includes(data.version) || !Array.isArray(data.position) ||
      data.position.length !== 3 || !data.position.every(Number.isFinite)) return null;
  const player = structuredClone(INITIAL_CHARACTER);
  player.level = integer(data.level, 1, 1, 100);
  player.appearance = normalizeAppearance(data.appearance);
  player.attributes = Object.fromEntries(Object.entries(player.attributes).map(([key, value]) => [key, integer(data.attributes?.[key], value, 1, 100)]));
  player.skills = Object.fromEntries(Object.entries(player.skills).map(([key, value]) => [key, integer(data.skills?.[key], value, 0, 100)]));
  player.perks = Array.isArray(data.perks) ? [...new Set(data.perks.filter(p => knownPerks.has(p)))] : [];
  const hpDefault = 100 + (player.level - 1) * 12 + (player.perks.includes('eisernes_herz') ? 30 : 0);
  player.maxHp = integer(data.maxHp, hpDefault, 100, 10000);
  player.maxStamina = integer(data.maxStamina, 100 + (player.level - 1) * 6, 100, 10000);
  player.hp = number(data.hp, player.maxHp, 1, player.maxHp);
  player.stamina = number(data.stamina, player.maxStamina, 0, player.maxStamina);
  for (const key of ['xp', 'gold', 'potions', 'kills', 'perkPoints']) {
    const fallback = key === 'perkPoints' ? Math.max(0, player.level - 1 - player.perks.length) : player[key];
    player[key] = integer(data[key], fallback, 0, 1000000);
  }
  player.xp = Math.min(player.xp, player.level * 100 - 1);
  for(const slot of EQUIPMENT_SLOTS)if(data.equipment?.[slot]===null||equipSlot(ITEMS[data.equipment?.[slot]])===slot)player.equipment[slot]=data.equipment[slot];
  player.loot = Array.isArray(data.loot) ? data.loot.filter(id => knownItems.has(id)).slice(0, 500) : [];
  // Versions 1–3 awarded potions both to the quickbar and loot list.
  if (data.version < 4) player.loot = player.loot.filter(id => id !== 'heiltrank');
  player.satchel=Object.fromEntries(Object.entries(sanitizeCounts(data.satchel??player.satchel)).filter(([id])=>!isEquipment(ITEMS[id])&&!ITEMS[id].resource&&id!=='heiltrank'));
  // Older versions stored loose items separately. Merge them once, preserving quantity.
  for(const id of player.loot) {
    if(id==='heiltrank')player.potions++;
    else if(!isEquipment(ITEMS[id])&&!ITEMS[id].resource&&!ITEMS[id].locked)player.satchel[id]=(player.satchel[id]||0)+1;
  }
  player.loot=player.loot.filter(id=>isEquipment(ITEMS[id]));
  for(const field of ['favorites','junk'])if(Array.isArray(data[field]))player[field]=[...new Set(data[field].filter(id=>knownItems.has(id)&&!ITEMS[id].locked))];
  player.junk=player.junk.filter(id=>!player.favorites.includes(id)&&!Object.values(player.equipment).includes(id));
  player.stash=sanitizeCounts(data.stash);
  player.drops=Array.isArray(data.drops)?data.drops.filter(b=>b&&within(b.x,BOUNDS.minX,BOUNDS.maxX)!==undefined&&within(b.z,BOUNDS.minZ,BOUNDS.maxZ)!==undefined).slice(0,30).map((b,i)=>({id:i+1,x:b.x,z:b.z,items:sanitizeCounts(b.items)})).filter(b=>Object.keys(b.items).length):[];
  if(data.merchant&&typeof data.merchant==='object')player.merchant={gold:integer(data.merchant.gold,350,0,1000000),stock:sanitizeCounts(data.merchant.stock)};
  return {
    player,
    position: [within(data.position[0], BOUNDS.minX, BOUNDS.maxX, 3), number(data.position[1], 0, -20, 400), within(data.position[2], BOUNDS.minZ, BOUNDS.maxZ, 0)],
    yaw: number(data.yaw, 2.55, -100000, 100000), pitch: number(data.pitch, -.09, -1.15, 1.18),
    perspective: data.perspective === 'first' ? 'first' : 'third',
    // Saves from the old story start over at the first stage; null means the region is complete.
    quest: quests.has(data.quest) || data.quest === null && data.version >= 6 ? data.quest : 'm_elira',
    flags: flagsFrom(data.flags),
    hour: number(data.hour, 8, 0, 23.999),
    relationships: Object.fromEntries(Object.keys(data.relationships && typeof data.relationships === 'object' ? data.relationships : {}).filter(id => /^[a-z][a-z0-9_]{0,40}$/.test(id)).slice(0, 80).map(id => {
      const state = data.relationships[id];
      return [id, { trust: number(state?.trust, 0, -100, 100), met: state?.met === true,
        gifts: integer(state?.gifts, 0, 0, 10000), memories: Array.isArray(state?.memories) ? state.memories.filter(m => typeof m === 'string').map(m => m.slice(0, 240)).slice(-30) : [] }];
    })),
    enemies: Array.isArray(data.enemies) ? data.enemies.slice(0,5).map(e => ({ hp: number(e?.hp, 80, 0, 1000), dead: e?.dead === true, loot: e?.loot ? sanitizeCounts(e.loot) : undefined, ai: aiFrom(e?.ai) })) : [],
    rpg: data.rpg,
  };
}

export function encodeSave(player, game, enemies, relationships, hour, rpg) {
  const character = Object.fromEntries(Object.keys(INITIAL_CHARACTER).map(key => [key, player[key]]));
  return JSON.stringify({ ...character, version: SAVE_VERSION, position: player.position.toArray(),
    yaw: player.yaw, pitch: player.pitch, perspective: player.mode, quest: game.quest, flags: game.flags, hour,
    relationships, rpg, enemies: enemies.map(e => ({ hp: e.hp, dead: e.dead, loot: e.loot || undefined, ai: e.ai ? persistBrain(e.ai) : undefined })) });
}

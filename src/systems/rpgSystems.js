// Ashen Realms RPG Systems - progression, crafting and persistent world layer

export function createRPGSystems() {
  const state = {
    level: 1,
    xp: 0,
    skillPoints: 0,
    skills: {
      blade: 1,
      archery: 1,
      magic: 1,
      crafting: 1,
      alchemy: 1
    },
    inventory: {
      ironOre: 0,
      wood: 0,
      herbs: 0,
      leather: 0
    },
    crafted: [],
    worldFlags: {}
  };

  function gainXP(amount) {
    state.xp += amount;
    const needed = state.level * 100;
    if (state.xp >= needed) {
      state.xp -= needed;
      state.level++;
      state.skillPoints++;
      return { levelUp: true, level: state.level };
    }
    return { levelUp: false };
  }

  function improveSkill(id) {
    if (state.skillPoints <= 0 || !state.skills[id]) return false;
    state.skills[id]++;
    state.skillPoints--;
    return true;
  }

  function addResource(id, amount = 1) {
    if (state.inventory[id] !== undefined) state.inventory[id] += amount;
  }

  function craft(recipe) {
    for (const [resource, count] of Object.entries(recipe.cost)) {
      if ((state.inventory[resource] || 0) < count) return false;
    }
    for (const [resource, count] of Object.entries(recipe.cost)) {
      state.inventory[resource] -= count;
    }
    state.crafted.push(recipe.result);
    return recipe.result;
  }

  function setWorldFlag(id, value = true) {
    state.worldFlags[id] = value;
  }

  const initial = structuredClone(state);
  function reset() { Object.assign(state, structuredClone(initial)); }
  function restore(data) {
    reset();
    if (!data || typeof data !== 'object') return;
    for (const category of ['inventory', 'skills']) for (const id of Object.keys(state[category])) {
      const value = data[category]?.[id];
      if (Number.isFinite(value)) state[category][id] = Math.max(0, Math.min(100000, Math.floor(value)));
    }
    if (Array.isArray(data.crafted)) state.crafted = data.crafted.filter(v => typeof v === 'string').slice(0, 500);
    if (data.worldFlags && typeof data.worldFlags === 'object') state.worldFlags = Object.fromEntries(Object.entries(data.worldFlags).filter(([key, value]) => key.length < 100 && typeof value === 'boolean'));
  }

  return {
    state,
    gainXP,
    improveSkill,
    addResource,
    craft,
    setWorldFlag, reset, restore
  };
}

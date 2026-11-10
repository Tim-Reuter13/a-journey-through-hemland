// Combat 2.0 — what happens in a fight, as events (docs/COMBAT_2.md). The AI's combat memory and the debug view
// listen; nothing here changes the fight. Types: attackStart, attackActive, attackEnd, feint, contact, miss, hit,
// blocked, parried, badBlock, shieldBlock, wall, guardBroken, interrupted, injury, staggered, retreat, surrender, flee.

export function createCombatEvents(limit = 60) {
  const log = [], listeners = new Map();
  function emit(type, data = {}) {
    const event = { type, ...data };
    log.push(event); if (log.length > limit) log.shift();
    for (const fn of listeners.get(type) || []) fn(event);
    for (const fn of listeners.get('*') || []) fn(event);
    return event;
  }
  function on(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); return () => listeners.set(type, listeners.get(type).filter(f => f !== fn)); }
  const recent = (n = 12, filter = null) => (filter ? log.filter(filter) : log).slice(-n);
  return { emit, on, recent, clear: () => { log.length = 0; }, get log() { return log; } };
}

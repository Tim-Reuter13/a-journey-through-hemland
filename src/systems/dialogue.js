// No world, DOM or inventory ownership. The caller persists the supplied state.
export function createDialogue({ story, state }) {
  const main = story.QUESTS.main;
  const sides = story.QUESTS.side;
  const nodes = new Map();
  for (const tree of Object.values(story.DIALOGUES)) {
    for (const node of tree) {
      if (nodes.has(node.id)) throw new Error(`Duplicate dialogue node: ${node.id}`);
      nodes.set(node.id, node);
    }
  }
  const mainIds = new Set(main.map(stage => stage.id));
  for (const node of nodes.values()) {
    for (const choice of node.choices) {
      if (choice.next != null && !nodes.has(choice.next)) throw new Error(`Unknown dialogue node: ${choice.next}`);
      if (choice.quest != null && !mainIds.has(choice.quest)) throw new Error(`Unknown quest stage: ${choice.quest}`);
    }
  }
  const views = new WeakMap();
  let active = null;
  const interpolate = text => text.replaceAll('{name}', () => String(state.name() ?? ''));

  function matches(condition) {
    if (condition == null) return true;
    if (typeof condition !== 'object' || Array.isArray(condition)) return false;
    const keys = Object.keys(condition);
    if (keys.some(key => !['all', 'any', 'not', 'flag', 'equals', 'quest', 'trust', 'item'].includes(key))) return false;
    if ('equals' in condition && !('flag' in condition)) return false;
    if ('all' in condition && (!Array.isArray(condition.all) || !condition.all.every(matches))) return false;
    if ('any' in condition && (!Array.isArray(condition.any) || !condition.any.some(matches))) return false;
    if ('not' in condition && matches(condition.not)) return false;
    if ('flag' in condition) {
      const value = state.get(condition.flag);
      if ('equals' in condition ? value !== condition.equals : !value) return false;
    }
    if ('item' in condition && !state.hasItem(condition.item)) return false;
    if ('trust' in condition) {
      const rule = condition.trust;
      if (!rule || typeof rule.npc !== 'string') return false;
      const value = state.trust(rule.npc) ?? 0;
      if (!Number.isFinite(value) || value < (rule.min ?? -Infinity) || value > (rule.max ?? Infinity)) return false;
    }
    if ('quest' in condition) {
      const rule = condition.quest;
      if (typeof rule === 'string' || rule === null) {
        if (state.quest() !== rule) return false;
      } else {
        if (!rule || Array.isArray(rule) || !Object.keys(rule).length ||
            Object.keys(rule).some(key => !['atLeast', 'before'].includes(key))) return false;
        const index = main.findIndex(stage => stage.id === state.quest());
        if (index < 0) return false;
        if ('atLeast' in rule && (!mainIds.has(rule.atLeast) || index < main.findIndex(stage => stage.id === rule.atLeast))) return false;
        if ('before' in rule && (!mainIds.has(rule.before) || index >= main.findIndex(stage => stage.id === rule.before))) return false;
      }
    }
    return true;
  }

  function eligible(record) {
    if (!record || active !== record || record.quest !== state.quest() || !matches(record.source.if)) return [];
    return record.source.choices.filter(choice => matches(choice.if));
  }

  function render(source) {
    if (!source || !matches(source.if)) { active = null; return null; }
    const view = structuredClone(source);
    view.text = interpolate(source.text);
    const record = { source, quest: state.quest(), offered: [], view };
    active = record;
    views.set(view, record);
    view.choices = choices(view);
    return view;
  }

  function start(npcId) {
    active = null;
    const tree = story.DIALOGUES[npcId];
    return render(tree?.find(node => node.entry !== false && matches(node.if)));
  }

  function choices(node) {
    const record = node && views.get(node);
    if (!record || active !== record) return [];
    record.offered = eligible(record);
    return record.offered.map(choice => ({ ...structuredClone(choice), text: interpolate(choice.text) }));
  }

  function choose(node, index) {
    const record = node && views.get(node);
    if (!record || active !== record || !Number.isInteger(index) || index < 0) return null;
    const available = eligible(record);
    // Reject stale button indices instead of silently choosing a different answer.
    if (available.length !== record.offered.length || available.some((choice, i) => choice !== record.offered[i])) return null;
    const choice = available[index];
    if (!choice) return null;
    active = null;
    for (const [flag, value] of Object.entries(choice.set ?? {})) state.set(flag, structuredClone(value));
    for (const [npc, amount] of Object.entries(choice.trust ?? {})) state.addTrust(npc, amount);
    if (choice.item && !state.hasItem(choice.item)) state.giveItem(choice.item);
    if (Object.hasOwn(choice, 'quest')) state.setQuest(choice.quest);
    return choice.end ? null : render(nodes.get(choice.next));
  }

  function questForTrigger(event) {
    if (!event || typeof event !== 'object') return null;
    const track = event.track ?? 'main';
    const stages = track === 'main' ? main : sides.find(side => side.id === track)?.stages;
    if (!stages) return null;
    const current = track === 'main' ? state.quest() : state.get(`side_${track}`);
    const index = stages.findIndex(stage => stage.id === current);
    if (index < 0) return null;
    const stage = stages[index], trigger = stage.trigger;
    const key = { talk: 'npc', reach: 'site', kill: 'group', item: 'item', choice: 'flag' }[trigger.type];
    if (!key || event.type !== trigger.type || event[key] !== trigger[key] || !matches(stage.if)) return null;
    if (trigger.type === 'item' && !state.hasItem(trigger.item)) return null;
    if (trigger.type === 'choice' && !state.get(trigger.flag)) return null;
    return { track, completed: stage.id, next: structuredClone(stages[index + 1] ?? null) };
  }

  return { start, choices, choose, questForTrigger, matches };
}

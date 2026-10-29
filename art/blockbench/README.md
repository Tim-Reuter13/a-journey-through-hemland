# Blockbench pipeline

Characters, the wolf and held items are Blockbench models. Their source of truth is code:

- `models.js` — model specs (bones with joint pivots, cubes in pixels, materials, painted face decals).
  16 px = 1 world unit. Models face −Z; their right is +X.
- `builder.js` — runs **inside Blockbench**: turns a spec into groups + cubes, packs every face into one
  atlas and paints the 16-texel pixel texture.
- `*.bbmodel` — the generated Blockbench projects. Open them in Blockbench to look at or tweak a model by hand.
- `../../public/models/*.gltf` — what the game loads (`src/characters/models.js`).

## Rebuild all models

1. Dev server running (`npm run dev -- --port 5282`) — Blockbench fetches the two scripts from it.
2. Receiver running: `node art/blockbench/receiver.mjs` (writes into `public/models/` and `art/blockbench/` only).
3. Blockbench open with the MCP plugin; run this through the MCP `execute_script` tool with
   `params = { "models": ["wanderer", "elder", "smith", "ranger", "bandit", "captain", "wolf", "weapons"] }`:

```js
const base = 'http://127.0.0.1:5282/art/blockbench/';
const raw = t => JSON.parse(t.slice(t.indexOf('"'), t.lastIndexOf('"') + 1));
const post = (file, body) => fetch('http://127.0.0.1:5299/save?file=' + encodeURIComponent(file), { method: 'POST', body }).then(r => r.text());
const loaded = () => new Promise(res => { const check = () => Texture.all.length && Texture.all.every(t => t.width > 0 && t.img && t.img.complete) ? res() : setTimeout(check, 25); check(); });
return Promise.all(['builder.js', 'models.js'].map(f => fetch(base + f + '?raw&t=' + Date.now()).then(r => r.text()).then(raw))).then(async ([builder, models]) => {
  const lib = new Function(builder + '\n' + models + '\nreturn { AshenBuild, AshenModels };')();
  const specs = lib.AshenModels(), results = [];
  for (const name of params.models) {
    if (typeof Project !== 'undefined' && Project) await Project.close(true);
    lib.AshenBuild(specs[name](), { newProject: true });
    await loaded(); // the atlas loads asynchronously; exporting earlier embeds an empty texture
    const bb = Codecs.project.compile();
    results.push([name, await post('public/models/' + name + '.gltf', await Codecs.gltf.compile({})),
      await post('art/blockbench/' + name + '.bbmodel', typeof bb === 'string' ? bb : JSON.stringify(bb))]);
  }
  return results;
});
```

Edits made by hand in Blockbench are lost on the next rebuild — put lasting changes into `models.js`.

## Rig contract (used by `src/characters/animator.js`)

Humanoids: `root › hips › torso › chest › neck › head`, `arm_upper_* › arm_lower_* › hand_* › grip_*`,
`leg_upper_* › leg_lower_* › foot_*`, optional `cape_1 › cape_2 › cape_3`. Held items attach to `grip_right`.
Wolf: `root › body › chest › neck › head › jaw`, `ear_*`, `tail_1..3`, `{front,rear}_{upper,lower,paw}_*`.

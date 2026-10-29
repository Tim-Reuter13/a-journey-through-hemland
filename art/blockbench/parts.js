// Modular character library for Ashen Realms, consumed by builder.js inside
// Blockbench. One project per body type: the base body (the real rig) plus every
// hair style, beard and outfit part as a flat group "part|bone" whose origin is
// that bone's pivot, so the game can attach it to any character's skeleton.
// Tintable parts are painted in neutral greys and tinted per character at runtime.

function AshenParts() {
  const MATERIALS = {
    skinTint: { style: 'skin', ramp: ['#d6d1cc', '#e8e4df', '#f6f3ef', '#ffffff'] },
    hairTint: { style: 'hair', ramp: ['#727272', '#9c9c9c', '#c4c4c4', '#e8e8e8'] },
    clothTint: { style: 'cloth', ramp: ['#767676', '#969696', '#b8b8b8', '#d6d6d6'] },
    linen: { style: 'cloth', ramp: ['#6a6052', '#7f7465', '#938878', '#a69b8a'] },
    leather: { style: 'leather', ramp: ['#3b2619', '#4b3121', '#5c3d2a', '#6c4833'], stitch: '#7d5e42' },
    leatherDark: { style: 'leather', ramp: ['#21160f', '#2c1e15', '#37261b', '#432f21'] },
    boot: { style: 'leather', ramp: ['#1a130f', '#241b15', '#2e231b', '#382b21'] },
    iron: { style: 'metal', ramp: ['#3c4145', '#50565a', '#666d71', '#7f868a', '#a1a8ab'], rivets: true },
    steel: { style: 'metal', ramp: ['#5d676d', '#78848a', '#94a0a5', '#b3bec2', '#d6dee0'] },
    darkSteel: { style: 'metal', ramp: ['#1f2326', '#2b3034', '#373d42', '#454c51', '#5b6368'], rivets: true },
    brass: { style: 'metal', ramp: ['#5f4722', '#7a5d2c', '#957438', '#ae8c47', '#c6a55c'] },
    gold: { style: 'metal', ramp: ['#7a5a1c', '#a07a26', '#c49a34', '#dfb84a', '#f3d77a'] },
    chain: { style: 'chain', ramp: ['#25292b', '#43494d', '#646c71', '#858d92'] },
    feather: { style: 'flat', ramp: ['#c9c2b0', '#ddd6c4', '#efe9da'] },
    straw: { style: 'wood', ramp: ['#7f6839', '#8f7642', '#9e844c', '#b09358'] },
    ruby: { style: 'glow', ramp: ['#8a1c22', '#b8282c', '#e0484a'], unshaded: true },
  };
  // Part catalogue: tint category, equipment slot and what it hides.
  const PARTS = {
    body: { tint: 'skin' }, underwear: {},
    hair_short: { tint: 'hair', slot: 'hair' }, hair_tousled: { tint: 'hair', slot: 'hair' }, hair_long: { tint: 'hair', slot: 'hair' },
    hair_braid: { tint: 'hair', slot: 'hair' }, hair_ponytail: { tint: 'hair', slot: 'hair' }, hair_bun: { tint: 'hair', slot: 'hair' },
    hair_shaved: { tint: 'hair', slot: 'hair' },
    beard_stubble: { tint: 'hair', slot: 'beard' }, beard_short: { tint: 'hair', slot: 'beard' }, beard_full: { tint: 'hair', slot: 'beard' }, beard_moustache: { tint: 'hair', slot: 'beard' },
    shirt: { tint: 'cloth', slot: 'body' }, tunic: { tint: 'cloth', slot: 'body' }, robe: { tint: 'cloth', slot: 'body' }, dress: { tint: 'cloth', slot: 'body' },
    chainmail: { slot: 'body' }, pants: { tint: 'cloth', slot: 'legs' }, boots: { slot: 'feet' }, shoes: { slot: 'feet' },
    belt: { slot: 'waist' }, vest: { slot: 'torso' }, leather_armor: { slot: 'torso' }, plate: { slot: 'torso' }, apron: { slot: 'torso' },
    tabard: { tint: 'cloth', slot: 'tabard' }, bracers: { slot: 'hands' }, gloves: { slot: 'hands' },
    cloak: { tint: 'cloth', slot: 'cloak' }, shawl: { tint: 'cloth', slot: 'cloak' },
    hood: { tint: 'cloth', slot: 'head' }, iron_helmet: { slot: 'head' }, great_helm: { slot: 'head' }, guard_helmet: { slot: 'head' },
    straw_hat: { slot: 'head' }, crown: { slot: 'circlet' }, headband: { tint: 'cloth', slot: 'circlet' }, mask: { tint: 'cloth', slot: 'face' },
    quiver: { slot: 'back' }, scabbard: { slot: 'hip' }, satchel: { slot: 'bag' },
  };

  const swapEW = o => { const r = { ...o }; if ('east' in o || 'west' in o) { r.east = o.west; r.west = o.east; if (r.east === undefined) delete r.east; if (r.west === undefined) delete r.west; } return r; };
  const mirror = c => ({ ...c, name: c.name.replace('_right', '_left'), bone: c.bone.replace('_right', '_left'),
    from: [-c.to[0], c.from[1], c.from[2]], to: [-c.from[0], c.to[1], c.to[2]],
    origin: c.origin && [-c.origin[0], c.origin[1], c.origin[2]], rotation: c.rotation && [c.rotation[0], -c.rotation[1], -c.rotation[2]],
    faceMat: c.faceMat && swapEW(c.faceMat), decals: c.decals && c.decals.map(d => ({ ...d, face: d.face === 'east' ? 'west' : d.face === 'west' ? 'east' : d.face })) });
  const pair = c => [c, mirror(c)];

  function library(body) {
    const female = body === 'female';
    const D = female
      ? { cx: 4.5, cz: 2.5, ax: 3.5, az: 2, px: 4, pz: 2.5, armIn: 4.5, armOut: 7.5, pivot: 6, handIn: 5, handOut: 7, armInflate: -.2 }
      : { cx: 5, cz: 3, ax: 4, az: 2.5, px: 4, pz: 2.5, armIn: 5, armOut: 8, pivot: 6.5, handIn: 5.5, handOut: 7.5, armInflate: 0 };
    const pivots = { root: [0, 0, 0], hips: [0, 17, 0], torso: [0, 20, 0], chest: [0, 24, 0], neck: [0, 31, 0], head: [0, 32.5, 0],
      cape_1: [0, 31, D.cz + .5], cape_2: [0, 23, D.cz + 1], cape_3: [0, 15, D.cz + 1.5] };
    const parent = { hips: 'root', torso: 'hips', chest: 'torso', neck: 'chest', head: 'neck', cape_1: 'chest', cape_2: 'cape_1', cape_3: 'cape_2' };
    for (const [s, side] of [[1, 'right'], [-1, 'left']]) {
      Object.assign(pivots, { [`arm_upper_${side}`]: [s * D.pivot, 30, 0], [`arm_lower_${side}`]: [s * D.pivot, 24, 0], [`hand_${side}`]: [s * D.pivot, 19, 0],
        [`grip_${side}`]: [s * D.pivot, 17, -.5], [`leg_upper_${side}`]: [s * 2, 17, 0], [`leg_lower_${side}`]: [s * 2, 9, 0], [`foot_${side}`]: [s * 2, 2, 0] });
      Object.assign(parent, { [`arm_upper_${side}`]: 'chest', [`arm_lower_${side}`]: `arm_upper_${side}`, [`hand_${side}`]: `arm_lower_${side}`, [`grip_${side}`]: `hand_${side}`,
        [`leg_upper_${side}`]: 'hips', [`leg_lower_${side}`]: `leg_upper_${side}`, [`foot_${side}`]: `leg_lower_${side}` });
    }
    const bones = [['root', null, pivots.root]];
    for (const name of Object.keys(pivots)) if (name !== 'root') bones.push([name, parent[name], pivots[name]]);
    const cubes = [], partBones = new Set();
    // P(part, bone, from, to, material, extra): a cube of `part` riding on rig bone `bone`.
    const P = (part, bone, from, to, mat, extra = {}) => {
      const group = part === 'body' ? bone : `${part}|${bone}`;
      return { name: `${part}_${extra.n || bone}`, part, bone: group, from, to, mat, ...extra };
    };
    const add = (...c) => cubes.push(...c.flat());
    const armR = 'arm_upper_right', lowR = 'arm_lower_right', handR = 'hand_right', thighR = 'leg_upper_right', shinR = 'leg_lower_right', footR = 'foot_right';

    // ── Base body (skin, tinted) — the face is painted at runtime over the head front.
    add(P('body', 'head', [-3.5, 32, -3.5], [3.5, 39, 3.5], 'skinTint', { decals: [{ face: 'north', palette: { n: 'shade' }, x: 3, y: 3, map: ['n'] }] }),
      ...pair(P('body', 'head', [3.5, 34.5, -.5], [4, 36.5, .5], 'skinTint', { n: 'ear_right' })),
      P('body', 'neck', [-1.5, 30, -1.5], [1.5, 33, 1.5], 'skinTint'),
      P('body', 'chest', [-D.cx, 24, -D.cz], [D.cx, 31, D.cz], 'skinTint'),
      P('body', 'torso', [-D.ax, 20, -D.az], [D.ax, 24, D.az], 'skinTint'),
      P('body', 'hips', [-D.px, 16, -D.pz], [D.px, 20, D.pz], 'skinTint'),
      ...pair(P('body', armR, [D.armIn, 24, -1.5], [D.armOut, 31, 1.5], 'skinTint', { inflate: D.armInflate })),
      ...pair(P('body', lowR, [D.armIn, 19, -1.5], [D.armOut, 24, 1.5], 'skinTint', { inflate: D.armInflate })),
      ...pair(P('body', handR, [D.handIn, 16, -1], [D.handOut, 19, 1], 'skinTint', { inflate: .3 })),
      ...pair(P('body', thighR, [0, 9, -2], [4, 17, 2], 'skinTint')),
      ...pair(P('body', shinR, [0, 2, -2], [4, 9, 2], 'skinTint', { inflate: -.25 })),
      ...pair(P('body', footR, [0, 0, -3], [4, 2, 2], 'skinTint')));
    if (female) add(P('body', 'chest', [-3.5, 26, -D.cz - 1], [3.5, 29, -D.cz + .5], 'skinTint', { n: 'bust' }));
    add(P('underwear', 'hips', [-D.px, 16, -D.pz], [D.px, 20, D.pz], 'linen', { inflate: .08 }),
      ...pair(P('underwear', thighR, [0, 14, -2], [4, 17, 2], 'linen', { inflate: .08 })));
    if (female) add(P('underwear', 'chest', [-D.cx, 25.5, -D.cz], [D.cx, 29.5, D.cz], 'linen', { inflate: .08 }), P('underwear', 'chest', [-3.5, 26, -D.cz - 1], [3.5, 29, -D.cz + .5], 'linen', { inflate: .1, n: 'bust' }));

    // ── Hair. Shared cap pieces; each style layers locks, spikes and tails on top.
    const cap = (part, { top = 2, back = 33, side = 35, fringe = true } = {}) => [
      P(part, 'head', [-4, 39, -4], [4, 39 + top, 4.2], 'hairTint', { n: 'cap_top' }),
      P(part, 'head', [-4, back, 3.4], [4, 40, 4.4], 'hairTint', { n: 'cap_back' }),
      ...pair(P(part, 'head', [3.4, side, -3.4], [4.4, 40, 4.2], 'hairTint', { n: 'cap_side_right' })),
      ...(fringe ? [P(part, 'head', [-4, 38, -4.4], [4, 40, -3.4], 'hairTint', { n: 'fringe' })] : []),
    ];
    add(cap('hair_short', { top: 1, back: 34, side: 36 }),
      ...[-2, 0, 2].map((x, i) => P('hair_short', 'head', [x - 1, 39.5, -2 + i], [x + 1, 41, i], 'hairTint', { n: `tuft_${i}`, rotation: [0, 0, (i - 1) * 18], origin: [x, 40, 0] })));
    add(cap('hair_tousled', { fringe: false }),
      // Spiky bangs falling over the forehead, each rotated a little differently.
      ...[-3, -1, 1, 3].map((x, i) => P('hair_tousled', 'head', [x - 1, 37.8, -4.7 + (i % 2) * .15], [x + 1, 40.5, -3.5], 'hairTint', { n: `bang_${i}`, rotation: [-10 + (i % 2) * 6, 0, (x > 0 ? -1 : 1) * (8 + i * 3)], origin: [x, 40, -4] })),
      ...[[-2.5, -2, -28, 18], [0, -2.5, -18, 0], [2.5, -2, -28, -18], [-2.5, 1, 16, 26], [0, 1.5, 22, 0], [2.5, 1, 16, -26], [0, 3.5, 40, 0]]
        .map(([x, z, rx, rz], i) => P('hair_tousled', 'head', [x - 1, 40, z - 1], [x + 1, 43, z + 1], 'hairTint', { n: `spike_${i}`, rotation: [rx, 0, rz], origin: [x, 40.5, z] })),
      ...pair(P('hair_tousled', 'head', [3.6, 33.5, -1], [4.8, 37, 2], 'hairTint', { n: 'sidelock_right', rotation: [0, 0, 12], origin: [4, 37, 0] })),
      ...[-2.5, 0, 2.5].map((x, i) => P('hair_tousled', 'head', [x - 1.2, 31.5, 3.6], [x + 1.2, 35, 4.9], 'hairTint', { n: `nape_${i}`, rotation: [20, 0, (i - 1) * -15], origin: [x, 35, 4] })));
    add(cap('hair_long', { fringe: false }),
      P('hair_long', 'head', [-4, 26, 3.4], [4, 39, 5.2], 'hairTint', { n: 'mane' }),
      ...pair(P('hair_long', 'head', [3.4, 29, -3.4], [4.6, 39, 3.4], 'hairTint', { n: 'curtain_right' })),
      ...pair(P('hair_long', 'head', [.3, 37.5, -4.5], [4.2, 40, -3.4], 'hairTint', { n: 'part_right', rotation: [0, 0, -14], origin: [.3, 40, -4] })));
    add(cap('hair_braid', { top: 1, back: 33, side: 35 }),
      ...[0, 1, 2, 3].map(i => P('hair_braid', 'head', [-1, 31 - i * 2.6, 4.2 + i * .2], [1, 34 - i * 2.6, 5.8 + i * .2], 'hairTint', { n: `braid_${i}`, rotation: [-8, 0, i % 2 ? 6 : -6], origin: [0, 34 - i * 2.6, 5] })),
      P('hair_braid', 'head', [-1.1, 21.6, 4.6], [1.1, 22.8, 6.6], 'brass', { n: 'braid_tie' }));
    add(cap('hair_ponytail', { top: 1 }),
      P('hair_ponytail', 'head', [-1, 36, 4.3], [1, 38, 5.6], 'leatherDark', { n: 'tie' }),
      P('hair_ponytail', 'head', [-1.3, 29, 4.6], [1.3, 36.5, 6.4], 'hairTint', { n: 'tail', rotation: [-18, 0, 0], origin: [0, 37, 5] }),
      P('hair_ponytail', 'head', [-.8, 26.5, 5.6], [.8, 29.5, 6.8], 'hairTint', { n: 'tail_tip', rotation: [-12, 0, 0], origin: [0, 37, 5] }));
    add(cap('hair_bun', { top: 1 }),
      P('hair_bun', 'head', [-2, 38.5, 2.5], [2, 42, 6], 'hairTint', { n: 'bun', rotation: [-20, 0, 0], origin: [0, 39, 3] }),
      P('hair_bun', 'head', [-.4, 40, 2], [.4, 40.8, 6.8], 'wood' in MATERIALS ? 'wood' : 'leatherDark', { n: 'pin', rotation: [-20, 0, 35], origin: [0, 40.4, 4] }));
    add(P('hair_shaved', 'head', [-3.5, 35, -3.5], [3.5, 39, 3.5], 'hairTint', { inflate: .06, hide: ['north', 'down'] }));

    // ── Beards: frame the mouth (x ±1.5, y 33–35) without covering it.
    add(P('beard_stubble', 'head', [-3.5, 32, -3.62], [3.5, 33, -3.45], 'hairTint', { n: 'chin' }),
      ...pair(P('beard_stubble', 'head', [1.5, 33, -3.62], [3.5, 35, -3.45], 'hairTint', { n: 'cheek_right' })));
    add(P('beard_short', 'head', [-3.5, 31, -3.9], [3.5, 33, -3.3], 'hairTint', { n: 'chin' }),
      ...pair(P('beard_short', 'head', [1.5, 33, -3.9], [3.5, 35, -3.3], 'hairTint', { n: 'cheek_right' })),
      ...pair(P('beard_short', 'head', [3.3, 32.5, -3.2], [3.9, 36, .5], 'hairTint', { n: 'sideburn_right' })));
    add(P('beard_full', 'head', [-3.2, 28.2, -4.5], [3.2, 33, -3.2], 'hairTint', { n: 'chin', rotation: [8, 0, 0], origin: [0, 33, -3.5] }),
      ...pair(P('beard_full', 'head', [1.5, 32, -4.1], [3.7, 35.5, -3.2], 'hairTint', { n: 'cheek_right' })),
      ...pair(P('beard_full', 'head', [3.3, 32, -3.2], [4, 36.5, 1], 'hairTint', { n: 'sideburn_right' })),
      P('beard_full', 'head', [-2.2, 35, -4.1], [2.2, 35.8, -3.4], 'hairTint', { n: 'moustache' }));
    add(P('beard_moustache', 'head', [-2.3, 35, -3.95], [2.3, 35.8, -3.4], 'hairTint', { n: 'moustache' }),
      ...pair(P('beard_moustache', 'head', [1.5, 33.6, -3.95], [2.3, 35, -3.45], 'hairTint', { n: 'droop_right' })));

    // ── Clothing.
    const chest = (part, mat, inflate, extra = {}) => P(part, 'chest', [-D.cx, 24, -D.cz], [D.cx, 31, D.cz], mat, { inflate, n: 'chest', ...extra });
    const belly = (part, mat, inflate) => P(part, 'torso', [-D.ax, 20, -D.az], [D.ax, 24, D.az], mat, { inflate, n: 'belly' });
    const pelvis = (part, mat, inflate) => P(part, 'hips', [-D.px, 16, -D.pz], [D.px, 20, D.pz], mat, { inflate, n: 'pelvis' });
    const sleeves = (part, mat, inflate, long = true) => [
      ...pair(P(part, armR, [D.armIn, 24, -1.5], [D.armOut, 31, 1.5], mat, { inflate: inflate + D.armInflate, n: 'sleeve_right' })),
      ...(long ? pair(P(part, lowR, [D.armIn, 20, -1.5], [D.armOut, 24, 1.5], mat, { inflate: inflate + D.armInflate, n: 'cuff_right' })) : []),
    ];
    const neckline = { face: 'north', palette: { s: 'shade' }, x: Math.floor(D.cx) - 1, y: 0, map: ['sss', '.s.'] };
    const bust = (part, mat, inflate) => female ? [P(part, 'chest', [-3.5, 26, -D.cz - 1], [3.5, 29, -D.cz + .5], mat, { inflate, n: 'bust' })] : [];
    add(chest('shirt', 'clothTint', .22, { decals: [neckline] }), belly('shirt', 'clothTint', .2), ...sleeves('shirt', 'clothTint', .2), ...bust('shirt', 'clothTint', .24));
    add(chest('tunic', 'clothTint', .25, { decals: [neckline] }), belly('tunic', 'clothTint', .24), pelvis('tunic', 'clothTint', .3), ...sleeves('tunic', 'clothTint', .22), ...bust('tunic', 'clothTint', .27),
      ...pair(P('tunic', thighR, [0, 12, -2], [4, 17, 2], 'clothTint', { inflate: .45, n: 'skirt_right' })));
    add(chest('robe', 'clothTint', .26, { decals: [neckline] }), belly('robe', 'clothTint', .26), pelvis('robe', 'clothTint', .32), ...bust('robe', 'clothTint', .28),
      ...pair(P('robe', armR, [D.armIn, 24, -1.5], [D.armOut, 31, 1.5], 'clothTint', { inflate: .24, n: 'sleeve_right' })),
      ...pair(P('robe', lowR, [D.armIn - .2, 19, -1.8], [D.armOut + .2, 24, 1.8], 'clothTint', { inflate: .25, n: 'wide_cuff_right' })),
      ...pair(P('robe', thighR, [-.2, 5, -2.4], [4.2, 17, 2.4], 'clothTint', { inflate: .3, n: 'skirt_right' })),
      ...pair(P('robe', shinR, [-.2, 1.5, -2.4], [4.2, 5, 2.4], 'clothTint', { inflate: .45, n: 'hem_right' })));
    add(chest('dress', 'clothTint', .24, { decals: [{ face: 'north', palette: { s: 'shade' }, x: Math.floor(D.cx) - 2, y: 0, map: ['sssss', '.sss.'] }] }), belly('dress', 'clothTint', .24), pelvis('dress', 'clothTint', .35), ...bust('dress', 'clothTint', .26),
      ...sleeves('dress', 'clothTint', .2),
      ...pair(P('dress', thighR, [-.4, 4, -2.6], [4.4, 17, 2.6], 'clothTint', { inflate: .35, n: 'skirt_right' })),
      ...pair(P('dress', shinR, [-.4, .6, -2.6], [4.4, 4, 2.6], 'clothTint', { inflate: .5, n: 'hem_right' })));
    add(chest('chainmail', 'chain', .28), belly('chainmail', 'chain', .26), ...sleeves('chainmail', 'chain', .24, false),
      ...pair(P('chainmail', thighR, [0, 13, -2], [4, 17, 2], 'chain', { inflate: .42, n: 'skirt_right' })));
    add(pelvis('pants', 'clothTint', .18), ...pair(P('pants', thighR, [0, 9, -2], [4, 17, 2], 'clothTint', { inflate: .18, n: 'thigh_right' })),
      ...pair(P('pants', shinR, [0, 4, -2], [4, 9, 2], 'clothTint', { inflate: 0, n: 'shin_right' })));
    add(...pair(P('boots', shinR, [0, 2, -2], [4, 6, 2], 'boot', { inflate: .1, n: 'shaft_right' })),
      ...pair(P('boots', shinR, [0, 6, -2], [4, 7, 2], 'boot', { inflate: .32, n: 'cuff_right' })),
      ...pair(P('boots', footR, [0, 0, -3], [4, 2, 2], 'boot', { inflate: .12, n: 'foot_right' })));
    add(...pair(P('shoes', footR, [0, 0, -3], [4, 2, 2], 'leather', { inflate: .1, n: 'foot_right' })),
      ...pair(P('shoes', shinR, [0, 2, -2], [4, 3, 2], 'leather', { inflate: .06, n: 'ankle_right' })));
    add(P('belt', 'hips', [-D.px, 18, -D.pz], [D.px, 20, D.pz], 'leatherDark', { inflate: .34, n: 'strap', decals: [{ face: 'north', palette: { o: '#c6a55c', p: '#7a5d2c' }, x: 3, y: 0, map: ['oo', 'op'] }] }),
      P('belt', 'hips', [1.5, 15.4, -D.pz - 1.2], [3.5, 18, -D.pz + .1], 'leather', { n: 'pouch' }));
    add(chest('vest', 'leather', .42, { faceMat: { up: 'leatherDark' } }), belly('vest', 'leather', .38));
    add(chest('leather_armor', 'leather', .46, { decals: [{ face: 'north', palette: { s: '#2a1c13' }, x: Math.floor(D.cx), y: 0, map: ['s', 's', 's', 's', 's', 's', 's'] }] }),
      belly('leather_armor', 'leatherDark', .42),
      ...pair(P('leather_armor', armR, [D.armIn - .5, 28, -2], [D.armOut + .5, 31, 2], 'leather', { inflate: .25, n: 'pauldron_right', rotation: [0, 0, -12], origin: [D.pivot, 30, 0] })),
      ...pair(P('leather_armor', lowR, [D.armIn, 19, -1.5], [D.armOut, 22, 1.5], 'leatherDark', { inflate: .32, n: 'bracer_right' })));
    add(...pair(P('bracers', lowR, [D.armIn, 19, -1.5], [D.armOut, 22, 1.5], 'leatherDark', { inflate: .32, n: 'bracer_right' })));
    add(...pair(P('gloves', handR, [D.handIn, 16, -1], [D.handOut, 19.5, 1], 'leatherDark', { inflate: .45, n: 'glove_right' })));
    add(P('apron', 'torso', [-3.5, 11, -D.az - 1], [3.5, 24.5, -D.az - .4], 'leather', { n: 'panel', decals: [{ face: 'north', palette: { p: '#2c1e15' }, x: 1, y: 7, map: ['ppppp', 'p...p', 'ppppp'] }] }),
      P('apron', 'chest', [-3, 24.5, -D.cz - .7], [3, 30, -D.cz - .1], 'leather', { n: 'bib' }),
      ...pair(P('apron', 'chest', [2, 24.5, -D.cz - .75], [3, 31.2, D.cz + .4], 'leatherDark', { n: 'strap_right', inflate: .05 })));
    add(P('tabard', 'torso', [-2.5, 12, -D.az - .9], [2.5, 24, -D.az - .3], 'clothTint', { n: 'front', decals: [{ face: 'north', palette: { g: '#b18b4a' }, x: 1, y: 3, map: ['.g.', 'ggg', '.g.'] }] }),
      P('tabard', 'torso', [-2.5, 12, D.az + .3], [2.5, 24, D.az + .9], 'clothTint', { n: 'back' }),
      P('tabard', 'chest', [-2.5, 24, -D.cz - .6], [2.5, 31, -D.cz], 'clothTint', { n: 'chest' }));
    add(P('cloak', 'cape_1', [-D.cx - .5, 23, D.cz], [D.cx + .5, 31, D.cz + 1], 'clothTint', { n: 'top', decals: [{ face: 'south', palette: { s: 'shade' }, x: 0, y: 0, map: ['s'.repeat(11)] }] }),
      P('cloak', 'cape_2', [-D.cx - .5, 15, D.cz + .5], [D.cx + .5, 23, D.cz + 1.5], 'clothTint', { n: 'mid' }),
      P('cloak', 'cape_3', [-D.cx - .5, 8, D.cz + 1], [D.cx + .5, 15, D.cz + 2], 'clothTint', { n: 'low' }),
      ...[0, 1, 2, 3, 4].map(i => P('cloak', 'cape_3', [-D.cx - .5 + i * 2.2, 6 + (i % 2), D.cz + 1.1 + (i % 2) * .05], [-D.cx + 1.5 + i * 2.2, 8, D.cz + 1.95], 'clothTint', { n: `fringe_${i}` })),
      P('cloak', 'chest', [-D.cx - .5, 29, -1], [D.cx + .5, 32, D.cz + 1], 'clothTint', { n: 'mantle', inflate: .2 }));
    add(P('shawl', 'chest', [-D.cx - .5, 26, -D.cz - .5], [D.cx + .5, 31.5, D.cz + .5], 'clothTint', { inflate: .25, n: 'wrap' }),
      P('shawl', 'chest', [-3, 22, -D.cz - .9], [3, 26, -D.cz - .3], 'clothTint', { n: 'point' }));
    add(P('plate', 'chest', [-D.cx, 24, -D.cz], [D.cx, 31, D.cz], 'darkSteel', { inflate: .52, n: 'breastplate', decals: [{ face: 'north', palette: { r: 'shade' }, x: Math.floor(D.cx) - 1, y: 1, map: ['r', 'r', 'r', 'r', 'r'] }] }),
      belly('plate', 'chain', .36),
      ...[0, 1].map(row => P('plate', 'hips', [-D.px - .4, 14 - row * 2, -D.pz - .6 - row * .2], [D.px + .4, 17 - row * 2, -D.pz - .1 - row * .2], 'darkSteel', { n: `tasset_${row}` })),
      ...pair(P('plate', armR, [D.armIn - .5, 28, -2.5], [D.armOut + 1, 31.5, 2.5], 'darkSteel', { inflate: .2, n: 'pauldron_right', rotation: [0, 0, -14], origin: [D.pivot, 30, 0] })),
      ...pair(P('plate', armR, [D.armIn, 26, -2.2], [D.armOut + .8, 28.5, 2.2], 'darkSteel', { inflate: .1, n: 'rerebrace_right', rotation: [0, 0, -8], origin: [D.pivot, 30, 0] })),
      ...pair(P('plate', lowR, [D.armIn - .2, 22.5, -1.8], [D.armOut + .2, 24.5, 1.8], 'darkSteel', { inflate: .2, n: 'couter_right' })),
      ...pair(P('plate', lowR, [D.armIn, 19, -1.5], [D.armOut, 22.5, 1.5], 'darkSteel', { inflate: .3, n: 'vambrace_right' })),
      ...pair(P('plate', handR, [D.handIn, 16, -1], [D.handOut, 20, 1], 'darkSteel', { inflate: .5, n: 'gauntlet_right' })),
      ...pair(P('plate', shinR, [0, 2, -2], [4, 8, 2], 'darkSteel', { inflate: .3, n: 'greave_right' })),
      ...pair(P('plate', thighR, [.3, 8.5, -2.6], [3.7, 11, -1.4], 'darkSteel', { inflate: .15, n: 'poleyn_right' })),
      ...pair(P('plate', footR, [0, 0, -3], [4, 2, 2], 'darkSteel', { inflate: .26, n: 'sabaton_right' })));
    // Headgear.
    add(P('hood', 'head', [-4, 38.5, -4], [4, 40, 4.5], 'clothTint', { n: 'top' }), P('hood', 'head', [-4, 31, 3.5], [4, 39, 5], 'clothTint', { n: 'back' }),
      ...pair(P('hood', 'head', [3.5, 31.5, -4], [4.5, 39.5, 4.5], 'clothTint', { n: 'side_right' })),
      P('hood', 'head', [-4, 37.6, -4.6], [4, 39, -3.5], 'clothTint', { n: 'brim' }),
      P('hood', 'head', [-1.5, 35, 4.8], [1.5, 39, 6.5], 'clothTint', { n: 'tip', rotation: [-25, 0, 0], origin: [0, 39, 5] }),
      P('hood', 'chest', [-D.cx + .5, 28.5, -D.cz - .6], [D.cx - .5, 32, D.cz + 1], 'clothTint', { n: 'cowl', inflate: .25 }));
    add(P('iron_helmet', 'head', [-4, 38.6, -4], [4, 40.6, 4], 'iron', { n: 'dome' }), P('iron_helmet', 'head', [-4, 33, 3.4], [4, 40, 4.4], 'iron', { n: 'back' }),
      ...pair(P('iron_helmet', 'head', [3.4, 34, -3.8], [4.4, 40, 4], 'iron', { n: 'cheek_right' })),
      P('iron_helmet', 'head', [-4.2, 38.2, -4.5], [4.2, 39.2, -3.5], 'iron', { n: 'brow_band' }),
      P('iron_helmet', 'head', [-.5, 35, -4.4], [.5, 38.5, -3.6], 'iron', { n: 'nasal' }),
      P('iron_helmet', 'head', [-.5, 40.6, -3], [.5, 41.4, 3], 'iron', { n: 'ridge' }));
    add(P('great_helm', 'head', [-4, 38.5, -4], [4, 40, 4], 'darkSteel', { n: 'top' }), P('great_helm', 'head', [-4, 32, 3.4], [4, 39, 4.4], 'darkSteel', { n: 'back' }),
      ...pair(P('great_helm', 'head', [3.4, 32, -4], [4.4, 39.2, 4], 'darkSteel', { n: 'side_right' })),
      P('great_helm', 'head', [-4, 32, -4.4], [4, 39, -3.4], 'darkSteel', { n: 'visor', decals: [{ face: 'north', palette: { v: '#08090a', h: '#3d4347' }, x: 0, y: 1, map: ['........', 'vvv..vvv', '........', '...hh...', '..h..h..'] }] }),
      P('great_helm', 'head', [-.5, 40, -3.5], [.5, 41.5, 3.5], 'brass', { n: 'crest' }));
    add(P('guard_helmet', 'head', [-4, 38.5, -4], [4, 41, 4], 'iron', { n: 'dome' }), P('guard_helmet', 'head', [-5.5, 38, -5.5], [5.5, 38.8, 5.5], 'iron', { n: 'brim' }),
      P('guard_helmet', 'head', [-4, 34, 3.4], [4, 38.5, 4.2], 'chain', { n: 'aventail' }));
    add(P('straw_hat', 'head', [-6, 39, -6], [6, 39.8, 6], 'straw', { n: 'brim' }), P('straw_hat', 'head', [-3.6, 39.8, -3.6], [3.6, 42, 3.6], 'straw', { n: 'crown' }),
      P('straw_hat', 'head', [-3.7, 39.8, -3.7], [3.7, 40.4, 3.7], 'leatherDark', { n: 'band', inflate: .05 }));
    add(P('crown', 'head', [-3.9, 39, -3.9], [3.9, 40, 3.9], 'gold', { n: 'ring', hide: ['up', 'down'] }),
      ...[[-3, -4], [0, -4.1], [3, -4], [-3.9, 0], [3.9, 0]].map(([x, z], i) => P('crown', 'head', [x - .5, 40, z - .2], [x + .5, 41.4, z + .4], 'gold', { n: `point_${i}` })),
      P('crown', 'head', [-.5, 39.2, -4.15], [.5, 39.9, -3.95], 'ruby', { n: 'gem' }));
    add(P('headband', 'head', [-3.5, 36, -3.5], [3.5, 37, 3.5], 'clothTint', { inflate: .25, n: 'band' }),
      P('headband', 'head', [-.5, 32, 3.6], [1.5, 36, 4.1], 'clothTint', { n: 'tail', rotation: [-20, 0, 15], origin: [0, 36, 3.8] }));
    add(P('mask', 'head', [-3.5, 31.5, -3.5], [3.5, 35, 3.5], 'clothTint', { inflate: .3, hide: ['up', 'down'] }));
    add(P('quiver', 'chest', [-1.5, 19, D.cz + .1], [1.5, 31, D.cz + 2.4], 'leather', { n: 'case', rotation: [0, 0, 24], origin: [0, 25, D.cz + 1] }),
      ...[0, 1, 2, 3].map(i => P('quiver', 'chest', [-1.2 + i * .8, 31, D.cz + .6 + (i % 2) * .6], [-.6 + i * .8, 34, D.cz + 1.2 + (i % 2) * .6], 'feather', { n: `arrow_${i}`, rotation: [0, 0, 24], origin: [0, 25, D.cz + 1] })));
    add(P('scabbard', 'hips', [-D.px - 1.6, 7, -1], [-D.px - .4, 17, 1], 'leatherDark', { n: 'sheath', rotation: [22, 0, 0], origin: [-D.px - 1, 17, 0] }),
      P('scabbard', 'hips', [-D.px - 1.6, 6, -1], [-D.px - .4, 7, 1], 'brass', { n: 'chape', rotation: [22, 0, 0], origin: [-D.px - 1, 17, 0], inflate: .1 }),
      P('scabbard', 'hips', [-D.px - 1.5, 17, -.5], [-D.px - .5, 21, .5], 'leatherDark', { n: 'grip', rotation: [22, 0, 0], origin: [-D.px - 1, 17, 0] }),
      P('scabbard', 'hips', [-D.px - 2.5, 16.6, -1], [-D.px + .5, 17.4, 1], 'brass', { n: 'guard', rotation: [22, 0, 0], origin: [-D.px - 1, 17, 0] }));
    add(P('satchel', 'hips', [D.px + .2, 13, -1.5], [D.px + 1.6, 17.5, 2], 'leather', { n: 'bag' }),
      P('satchel', 'chest', [-1, 23.5, -D.cz - .6], [1, 31.5, -D.cz - .1], 'leatherDark', { n: 'strap', rotation: [0, 0, -38], origin: [0, 27.5, -D.cz - .3], inflate: .05 }),
      P('satchel', 'chest', [-1, 23.5, D.cz + .1], [1, 31.5, D.cz + .6], 'leatherDark', { n: 'strap_back', rotation: [0, 0, 38], origin: [0, 27.5, D.cz + .3], inflate: .05 }));

    // Part groups: flat, one per (part, bone), origin on that bone's pivot.
    for (const c of cubes) if (c.bone.includes('|')) partBones.add(c.bone);
    const groups = new Set([...partBones].map(g => g.split('|')[0]));
    for (const part of groups) bones.push([part, null, [0, 0, 0]]);
    for (const g of partBones) bones.push([g, g.split('|')[0], pivots[g.split('|')[1]]]);
    return { name: `parts_${body}`, bones, cubes, materials: MATERIALS, parts: PARTS, atlasWidth: 256, reserve: [64, 16] };
  }
  return { parts_male: () => library('male'), parts_female: () => library('female'), PARTS };
}

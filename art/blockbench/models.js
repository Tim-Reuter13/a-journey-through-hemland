// Model specs for Ashen Realms, consumed by builder.js inside Blockbench.
// Units are pixels (16 px = 1 world unit). Models face -Z; their right is +X.
// Humanoids: 40 px tall, head 8 px (~1/5), three-segment limbs, armour and
// clothing as separate layers standing proud of the body (Dark Souls PS1 look).

function AshenModels() {
  const MATERIALS = {
    skin: { style: 'skin', ramp: ['#7c5240', '#946450', '#a8765e', '#b9876d'] },
    skinPale: { style: 'skin', ramp: ['#8a6758', '#a07c6b', '#b48f7d', '#c3a08d'] },
    skinTan: { style: 'skin', ramp: ['#5f3c2c', '#74503c', '#86604a', '#966f57'] },
    hairAuburn: { style: 'hair', ramp: ['#3e2418', '#53301f', '#683d27', '#7a4a30'] },
    hairDark: { style: 'hair', ramp: ['#1a1512', '#251e19', '#30271f', '#3b3027'] },
    hairSilver: { style: 'hair', ramp: ['#6f6c66', '#8a877f', '#a5a299', '#bdbab0'] },
    hairBlond: { style: 'hair', ramp: ['#5a4426', '#735932', '#8c6e3f', '#a3834c'] },
    clothBlue: { style: 'cloth', ramp: ['#1b2631', '#253442', '#2f4255', '#3a5066'] },
    clothGreen: { style: 'cloth', ramp: ['#1c2820', '#26352a', '#304334', '#3a503e'] },
    clothCrimson: { style: 'cloth', ramp: ['#3a1718', '#4d1d1e', '#612626', '#743030'] },
    clothGrey: { style: 'cloth', ramp: ['#2e2b27', '#3c3833', '#4a4540', '#57524c'] },
    clothLinen: { style: 'cloth', ramp: ['#6a6052', '#7f7465', '#938878', '#a69b8a'] },
    clothShirt: { style: 'cloth', ramp: ['#3b3732', '#49443e', '#57524b', '#655f57'] },
    pants: { style: 'cloth', ramp: ['#271f1b', '#322822', '#3d3129', '#483a30'] },
    leather: { style: 'leather', ramp: ['#3b2619', '#4b3121', '#5c3d2a', '#6c4833'], stitch: '#7d5e42' },
    leatherDark: { style: 'leather', ramp: ['#21160f', '#2c1e15', '#37261b', '#432f21'] },
    boot: { style: 'leather', ramp: ['#1a130f', '#241b15', '#2e231b', '#382b21'] },
    iron: { style: 'metal', ramp: ['#3c4145', '#50565a', '#666d71', '#7f868a', '#a1a8ab'], rivets: true },
    ironDark: { style: 'metal', ramp: ['#1e2124', '#272b2e', '#313538', '#3b4043', '#484d50'] },
    steel: { style: 'metal', ramp: ['#5d676d', '#78848a', '#94a0a5', '#b3bec2', '#d6dee0'] },
    darkSteel: { style: 'metal', ramp: ['#1f2326', '#2b3034', '#373d42', '#454c51', '#5b6368'], rivets: true },
    brass: { style: 'metal', ramp: ['#5f4722', '#7a5d2c', '#957438', '#ae8c47', '#c6a55c'] },
    rust: { style: 'metal', ramp: ['#4a3426', '#5e4436', '#6f5a4e', '#857469', '#9a8d84'] },
    chain: { style: 'chain', ramp: ['#25292b', '#43494d', '#646c71', '#858d92'] },
    wood: { style: 'wood', ramp: ['#2e2016', '#3c2a1d', '#4a3424', '#583e2b'] },
    feather: { style: 'flat', ramp: ['#c9c2b0', '#ddd6c4', '#efe9da'] },
    furGrey: { style: 'fur', ramp: ['#33312e', '#45423d', '#58544e', '#6c6761'] },
    furLight: { style: 'fur', ramp: ['#625c53', '#787166', '#8e867a', '#a39a8d'] },
    furDark: { style: 'fur', ramp: ['#1d1b19', '#282522', '#33302c', '#3e3a35'] },
    nose: { style: 'flat', ramp: ['#141212', '#1c1918', '#26211f'] },
    teeth: { style: 'flat', ramp: ['#b9b2a0', '#cfc8b5', '#e2dccb'] },
    ember: { style: 'glow', ramp: ['#e0692a', '#f59a3f', '#ffd17a'], unshaded: true },
    // Game animals (systems/wildlife.js).
    deerCoat: { style: 'pelt', ramp: ['#5e3b24', '#764a2c', '#835333', '#925e3a'] },
    deerBelly: { style: 'pelt', ramp: ['#a8916f', '#b8a381', '#c4b08f', '#cfbd9d'] },
    deerRump: { style: 'flat', ramp: ['#cfc6b4', '#ddd5c4', '#e9e2d3'] },
    deerMuzzle: { style: 'flat', ramp: ['#2e231c', '#3a2c23', '#46362b'] },
    hoof: { style: 'flat', ramp: ['#1a1512', '#221c18', '#2b231e'] },
    antler: { style: 'wood', ramp: ['#7a6a52', '#93826a', '#ab9a80', '#c4b498'] },
    foxCoat: { style: 'pelt', ramp: ['#8a3c16', '#a94b1c', '#c05a24', '#d06d30'] },
    foxWhite: { style: 'pelt', ramp: ['#bcb4a4', '#d0c9ba', '#e2dccf', '#eee9de'] },
    foxBlack: { style: 'pelt', ramp: ['#18130f', '#211a16', '#2b231d', '#352b24'] },
    hareCoat: { style: 'pelt', ramp: ['#4f3f2e', '#64503b', '#776049', '#8a7058'] },
    hareBelly: { style: 'pelt', ramp: ['#a09380', '#b4a894', '#c6bba7', '#d4cab6'] },
    crowBody: { style: 'feathers', ramp: ['#17171c', '#23232b', '#31343f', '#464c5e'] },
    crowWing: { style: 'feathers', ramp: ['#121216', '#1d1d24', '#2b2e39', '#3d4354'] },
    crowBeak: { style: 'flat', ramp: ['#2e2e34', '#3a3a41', '#47474f'] },
    // Street props (props()).
    woodLight: { style: 'wood', ramp: ['#5e4029', '#6d4b30', '#7a5637', '#87613f'] },
    woodDark: { style: 'wood', ramp: ['#33231a', '#3e2b1f', '#4a3425', '#553d2b'] },
    barrelWood: { style: 'wood', ramp: ['#4e3420', '#5c3e27', '#6a482e', '#775235'] },
    sack: { style: 'cloth', ramp: ['#7a6c55', '#8a7b62', '#998a70', '#a8997e'] },
    sackLight: { style: 'cloth', ramp: ['#948a74', '#a49a82', '#b3a991', '#c1b8a0'] },
    sackDark: { style: 'flat', ramp: ['#4a3e2e', '#56493a', '#625444'] },
    earth: { style: 'fur', ramp: ['#3a2c20', '#46362a', '#523f31', '#5e4a3a'] },
    water: { style: 'flat', ramp: ['#2a5a6a', '#336a7a', '#3e7a8a'] },
    wicker: { style: 'hair', ramp: ['#6e5530', '#82673a', '#967a46', '#a88b52'] },
    apple: { style: 'flat', ramp: ['#8e2a20', '#b23a2a', '#c94e36'] },
    appleGreen: { style: 'flat', ramp: ['#6a8a2a', '#7e9e36', '#92b244'] },
    cabbage: { style: 'fur', ramp: ['#3f6a2a', '#4f7e34', '#5f923e', '#72a64a'] },
    carrot: { style: 'flat', ramp: ['#b05a1a', '#cc6e22', '#e0822c'] },
    logs: { style: 'wood', ramp: ['#2e221a', '#3a2b20', '#463427', '#523e2e'] },
    logEnd: { style: 'flat', ramp: ['#8a6843', '#9e7b51', '#b08c5e'] },
    hay: { style: 'hair', ramp: ['#8a7438', '#a08844', '#b49a50', '#c6ac5e'] },
    clay: { style: 'flat', ramp: ['#8a4a2e', '#a05a38', '#b46a44'] },
    clayDark: { style: 'flat', ramp: ['#6a3a24', '#7a442a', '#8a4e32'] },
    // Trees and bushes (trees()), in the world's foliage ramps (src/art/pixelTextures.js).
    bark: { style: 'bark', ramp: ['#33261b', '#4a3a2b', '#5c4a37', '#6e5a44', '#827a60'] },
    barkMoss: { style: 'bark', ramp: ['#33261b', '#4a3a2b', '#5c4a37', '#6e5a44', '#827a60'], moss: .45, mossColor: '#4a6230' },
    barkGrey: { style: 'bark', ramp: ['#3a3631', '#504b44', '#625c54', '#746d64', '#8a8378'] },
    barkPine: { style: 'bark', ramp: ['#3a2418', '#52321f', '#643f28', '#764c32', '#86644c'] },
    birchBark: { style: 'bark', ramp: ['#9c988a', '#bbb7a8', '#d0ccbe', '#e0dcd0'], marks: '#2a2622' },
    leavesOak: { style: 'leaves', ramp: ['#2a4422', '#34502a', '#405e32', '#4c6c3a', '#5a7c42', '#688c4c'] },
    leavesHeart: { style: 'leaves', ramp: ['#1c2e1e', '#233a22', '#2b4428', '#34502e'], holes: .03 },
    leavesBirch: { style: 'leaves', ramp: ['#34481e', '#425a26', '#506c2e', '#5f7e36', '#728f40', '#86a04c'], holes: .6 },
    leavesBirchHeart: { style: 'leaves', ramp: ['#22301a', '#2c3c1e', '#364824', '#40542a'], holes: .05 },
    leavesAutumn: { style: 'leaves', ramp: ['#5a2816', '#6e331c', '#844124', '#9a502b', '#ad6033', '#bd733c'] },
    leavesGold: { style: 'leaves', ramp: ['#5e4318', '#76561e', '#8e6a26', '#a47e30', '#b8923a', '#c8a448'] },
    leavesAutumnHeart: { style: 'leaves', ramp: ['#3a1c12', '#4a2416', '#5a2e1a', '#6a381e'], holes: .03 },
    leavesMaple: { style: 'leaves', ramp: ['#4a1210', '#621814', '#7c2018', '#962a1c', '#ac3a22', '#c04e2a'] },
    leavesMapleHeart: { style: 'leaves', ramp: ['#2e0c0a', '#3c100c', '#4a1610', '#581c12'], holes: .03 },
    leavesGoldHeart: { style: 'leaves', ramp: ['#3e2e12', '#4c3a16', '#5a461a', '#68521e'], holes: .05 },
    needlesSpruce: { style: 'leaves', clump: 1, ramp: ['#1e3328', '#274034', '#304c3c', '#3a5a46', '#466850', '#52765a'], holes: .1 },
    needlesPine: { style: 'leaves', clump: 1, ramp: ['#1c2c22', '#24382a', '#2e4432', '#38523c', '#446046', '#506e50'], holes: .1 },
    snowCap: { style: 'leaves', ramp: ['#8f9ba4', '#aab6be', '#c4ced4', '#d8e0e4', '#e8eef0', '#f4f8f8'], holes: .06 },
    leavesBush: { style: 'leaves', ramp: ['#1e3018', '#283e20', '#324c26', '#3e5c2e', '#4a6a36', '#56763e'] },
    leavesBerry: { style: 'leaves', ramp: ['#1e3018', '#283e20', '#324c26', '#3e5c2e', '#4a6a36', '#56763e'], berries: .05, berry: '#8e1c2a' },
    // Hunting bow and arrows (weapons()).
    bowWood: { style: 'wood', ramp: ['#4a2a14', '#62391c', '#7a4a24', '#8e5a2e'] },
    horn: { style: 'flat', ramp: ['#bcae90', '#cec0a4', '#ded2ba'] },
    arrowShaft: { style: 'wood', ramp: ['#7a5c3a', '#8e6c46', '#a07c52', '#b08c5e'] },
    fletching: { style: 'feathers', ramp: ['#b8b0a0', '#cfc8b8', '#e2dccf'] },
    fletchRed: { style: 'feathers', ramp: ['#5e1e1a', '#7a2622', '#8e2e28'] },
  };

  // ── Helpers.
  const mirrorCube = c => ({
    ...c,
    name: c.name.replace('_right', '_left'),
    bone: c.bone && c.bone.replace('_right', '_left'),
    from: [-c.to[0], c.from[1], c.from[2]], to: [-c.from[0], c.to[1], c.to[2]],
    origin: c.origin && [-c.origin[0], c.origin[1], c.origin[2]],
    rotation: c.rotation && [c.rotation[0], -c.rotation[1], -c.rotation[2]],
    faceMat: c.faceMat && swapEW(c.faceMat),
    decals: c.decals && c.decals.map(d => ({ ...d, face: d.face === 'east' ? 'west' : d.face === 'west' ? 'east' : d.face })),
  });
  const swapEW = o => { const r = { ...o }; if ('east' in o || 'west' in o) { r.east = o.west; r.west = o.east; if (r.east === undefined) delete r.east; if (r.west === undefined) delete r.west; } return r; };
  const pair = cube => [cube, mirrorCube(cube)];
  const box = (name, bone, from, to, mat, extra = {}) => ({ name, bone, from, to, mat, ...extra });

  // Face sides: on the east face the model's front is the right-hand column,
  // on the west face the left-hand column (verified in Blockbench).
  function sideHair(dir, w, h, topRows, backCols, earRow) {
    const rows = [];
    for (let y = 0; y < h; y++) {
      let row = '';
      for (let x = 0; x < w; x++) {
        const fromBack = dir === 'east' ? x : w - 1 - x;
        if (y < topRows || (fromBack < backCols && y < h - 1)) row += 'H';
        else if (y === earRow && fromBack === backCols) row += 'e';
        else row += '.';
      }
      rows.push(row);
    }
    return rows;
  }

  // ── Humanoid.
  function humanoid(look) {
    const L = { skin: 'skin', hair: 'hairDark', top: 'clothShirt', pants: 'pants', boots: 'boot', hands: 'skin', ...look };
    const strong = L.build === 'strong';
    const sw = strong ? .5 : 0; // shoulder widening
    const bones = [
      ['root', null, [0, 0, 0]],
      ['hips', 'root', [0, 17, 0]],
      ['torso', 'hips', [0, 20, 0]],
      ['chest', 'torso', [0, 24, 0]],
      ['neck', 'chest', [0, 31, 0]],
      ['head', 'neck', [0, 32.5, 0]],
    ];
    for (const [s, name] of [[1, 'right'], [-1, 'left']]) {
      const ax = s * (6.5 + sw);
      bones.push(
        [`arm_upper_${name}`, 'chest', [ax, 30, 0]],
        [`arm_lower_${name}`, `arm_upper_${name}`, [ax, 24, 0]],
        [`hand_${name}`, `arm_lower_${name}`, [ax, 19, 0]],
        [`grip_${name}`, `hand_${name}`, [ax, 17, -.5]],
        [`leg_upper_${name}`, 'hips', [s * 2, 17, 0]],
        [`leg_lower_${name}`, `leg_upper_${name}`, [s * 2, 9, 0]],
        [`foot_${name}`, `leg_lower_${name}`, [s * 2, 2, 0]],
      );
    }
    if (L.cape) bones.push(['cape_1', 'chest', [0, 31, 3.5]], ['cape_2', 'cape_1', [0, 23, 4]], ['cape_3', 'cape_2', [0, 15, 4.5]]);
    const cubes = [];
    const add = (...c) => cubes.push(...c.flat());

    // Head with painted face.
    const eye = L.eyes || '#2c3b44';
    const face = {
      face: 'north', palette: { H: L.hairColor || '#2a221c', B: L.browColor || '#241c17', W: '#d6d0c2', E: eye, N: 'shade', M: '#6a3e30', b: L.beardColor || '#2a221c', m: '#4a2a22', s: '#3a2a22' },
      map: [
        L.bald ? '.......' : 'HHHHHHH',
        L.bald ? '.......' : L.fringe === false ? 'HH...HH' : 'HHH.HHH',
        '.BB.BB.',
        '.WE.EW.',
        L.beard === 'full' ? 'b..N..b' : '...N...',
        L.beard === 'full' ? 'bbMMMbb' : L.beard === 'short' ? '.bMMMb.' : '..MMM..',
        L.beard === 'full' ? 'bbbbbbb' : L.beard === 'short' ? '.bbbbb.' : '.......',
      ],
    };
    const headDecals = [face];
    if (!L.hood && !L.helmet) for (const dir of ['east', 'west']) headDecals.push({ face: dir, palette: { H: L.hairColor || '#2a221c', e: '#6b4636' }, map: sideHair(dir, 7, 7, L.bald ? 0 : 2, L.bald ? 1 : 3, 3) });
    if (L.scar) headDecals.push({ face: 'north', palette: { x: '#8a4a3c' }, x: 1, y: 2, map: ['x', '.', '.x', '..x'] });
    add(box('head', 'head', [-3.5, 32, -3.5], [3.5, 39, 3.5], L.skin, { faceMat: L.bald ? {} : { up: L.hair, south: L.hair }, decals: headDecals }));
    add(box('neck', 'neck', [-1.5, 30, -1.5], [1.5, 33, 1.5], L.skin));
    if (L.beard === 'full') add(box('beard', 'head', [-3.5, 31, -3.9], [3.5, 34, -3], L.hair, { decals: [{ face: 'north', palette: { M: '#3a2a22' }, x: 2, y: 0, map: ['MMM'] }] }));
    if (L.longHair) add(box('hair_back', 'head', [-3.5, 29, 3], [3.5, 37, 4.5], L.hair));
    if (L.braid) add(box('braid_1', 'head', [-1, 26, 3.6], [1, 32, 5.2], L.hair, { rotation: [-12, 0, 0], origin: [0, 32, 4] }), box('braid_tie', 'head', [-1, 25, 3.8], [1, 26, 5.4], 'brass', { inflate: .15, rotation: [-12, 0, 0], origin: [0, 32, 4] }));

    // Torso.
    add(box('chest', 'chest', [-5 - sw, 24, -3], [5 + sw, 31, 3], L.top));
    add(box('abdomen', 'torso', [-4, 20, -2.5], [4, 24, 2.5], L.top));
    add(box('pelvis', 'hips', [-4, 16, -2.5], [4, 20, 2.5], L.pants));
    add(box('belt', 'hips', [-4, 18, -2.5], [4, 20, 2.5], 'leatherDark', { inflate: .3, decals: [{ face: 'north', palette: { o: '#c6a55c', p: '#7a5d2c' }, x: 3, y: 0, map: ['oo', 'op'] }] }));
    if (!L.noPouch) add(box('pouch', 'hips', [1.5, 15.5, -3.6], [3.5, 18, -2.4], 'leather'));

    // Arms.
    const sleeveLower = L.rolled ? L.skin : L.top;
    add(pair(box('arm_upper_right', 'arm_upper_right', [5 + sw, 24, -1.5], [8 + sw, 31, 1.5], L.top)));
    add(pair(box('arm_lower_right', 'arm_lower_right', [5 + sw, 19, -1.5], [8 + sw, 24, 1.5], sleeveLower)));
    add(pair(box('hand_right', 'hand_right', [5.5 + sw, 16, -1], [7.5 + sw, 19, 1], L.hands, { inflate: .3 })));
    if (L.bracers) add(pair(box('bracer_right', 'arm_lower_right', [5 + sw, 19, -1.5], [8 + sw, 22, 1.5], L.bracers, { inflate: .3 })));

    // Legs.
    add(pair(box('thigh_right', 'leg_upper_right', [0, 9, -2], [4, 17, 2], L.pants)));
    add(pair(box('shin_right', 'leg_lower_right', [0, 2, -2], [4, 9, 2], L.pants, { inflate: -.25 })));
    add(pair(box('boot_right', 'leg_lower_right', [0, 2, -2], [4, 6, 2], L.boots, { inflate: .05 })));
    add(pair(box('foot_right', 'foot_right', [0, 0, -3], [4, 2, 2], L.boots, { inflate: .05 })));
    add(pair(box('boot_cuff_right', 'leg_lower_right', [0, 6, -2], [4, 7, 2], L.boots, { inflate: .3 })));

    // ── Outfit layers.
    if (L.tunicSkirt) add(pair(box('skirt_right', 'leg_upper_right', [0, 12, -2], [4, 17, 2], L.tunicSkirt, { inflate: .4 })));
    if (L.vest) add(box('vest', 'chest', [-5 - sw, 24, -3], [5 + sw, 31, 3], L.vest, { inflate: .35, faceMat: { up: L.top } }),
      box('vest_lower', 'torso', [-4, 20, -2.5], [4, 24, 2.5], L.vest, { inflate: .3 }));
    if (L.collar) add(box('collar', 'chest', [-3.5, 30, -3.5], [3.5, 32, 3.5], L.collar, { inflate: .1 }));
    if (L.shoulderStrap) add(box('strap', 'chest', [-1, 24, -3.5], [1, 31.5, -3], 'leatherDark', { rotation: [0, 0, -38], origin: [0, 27.5, -3.2], inflate: .1 }),
      box('strap_back', 'chest', [-1, 24, 3], [1, 31.5, 3.5], 'leatherDark', { rotation: [0, 0, 38], origin: [0, 27.5, 3.2], inflate: .1 }));
    if (L.scabbard) add(box('scabbard', 'hips', [-5.6, 7, -1], [-4.4, 17, 1], 'leatherDark', { rotation: [22, 0, 0], origin: [-5, 17, 0] }),
      box('scabbard_tip', 'hips', [-5.6, 6, -1], [-4.4, 7, 1], 'brass', { rotation: [22, 0, 0], origin: [-5, 17, 0], inflate: .1 }),
      box('sheathed_grip', 'hips', [-5.5, 17, -.5], [-4.5, 21, .5], 'leatherDark', { rotation: [22, 0, 0], origin: [-5, 17, 0] }),
      box('sheathed_guard', 'hips', [-6.5, 16.6, -1], [-3.5, 17.4, 1], 'brass', { rotation: [22, 0, 0], origin: [-5, 17, 0] }));
    if (L.cape) {
      add(box('cape_top', 'cape_1', [-5.5, 23, 3], [5.5, 31, 4], L.cape, { decals: [{ face: 'south', palette: { s: 'shade' }, x: 0, y: 0, map: ['sssssssssss'] }] }),
        box('cape_mid', 'cape_2', [-5.5, 15, 3.5], [5.5, 23, 4.5], L.cape),
        box('cape_low', 'cape_3', [-5.5, 8, 4], [5.5, 15, 5], L.cape));
      for (let i = 0; i < 5; i++) add(box(`cape_fringe_${i}`, 'cape_3', [-5 + i * 2, 6 + (i % 2), 4.1 + (i % 2) * .05], [-3 + i * 2, 8, 4.95], L.cape));
      add(box('cape_mantle', 'chest', [-5.5, 29, -1], [5.5, 32, 4], L.cape, { inflate: .2 }));
      if (L.brooch) add(box('brooch', 'chest', [-5, 29.5, -3.8], [-3.5, 31, -3.1], 'brass'));
    }
    if (L.robe) {
      add(pair(box('robe_thigh_right', 'leg_upper_right', [-.2, 5, -2.4], [4.2, 17, 2.4], L.robe, { inflate: .3 })));
      add(pair(box('robe_hem_right', 'leg_lower_right', [-.2, 2, -2.4], [4.2, 5, 2.4], L.robe, { inflate: .45 })));
      add(box('robe_sash', 'hips', [-4, 16, -2.5], [4, 18, 2.5], L.robeTrim || 'brass', { inflate: .4 }));
      add(box('robe_front', 'torso', [-.5, 6, -3.2], [.5, 20, -2.6], L.robeTrim || 'brass'));
    }
    if (L.shawl) add(box('shawl', 'chest', [-5.5, 26, -3.5], [5.5, 31.5, 3.5], L.shawl, { inflate: .25 }), box('shawl_point', 'chest', [-3, 22, -3.9], [3, 26, -3.3], L.shawl));
    if (L.pendant) add(box('pendant_chain', 'chest', [-.5, 26, -3.6], [.5, 30, -3.2], 'brass'), box('pendant', 'chest', [-1, 24.5, -3.8], [1, 26.5, -3.2], 'ember'));
    if (L.apron) {
      add(box('apron', 'torso', [-3.5, 11, -3.4], [3.5, 25, -2.8], 'leather', { decals: [{ face: 'north', palette: { p: '#2c1e15' }, x: 1, y: 7, map: ['ppppp', 'p...p', 'ppppp'] }] }));
      add(box('apron_bib', 'chest', [-3, 25, -3.6], [3, 30, -3], 'leather'));
      add(pair(box('apron_strap_right', 'chest', [2, 25, -3.7], [3, 31, 3.4], 'leatherDark', { inflate: .05 })));
      add(pair(box('glove_right', 'hand_right', [5.5 + sw, 16, -1], [7.5 + sw, 20, 1], 'leatherDark', { inflate: .45 })));
    }
    if (L.hood) {
      const m = L.hood;
      add(box('hood_top', 'head', [-4, 38.5, -4], [4, 40, 4.5], m),
        box('hood_back', 'head', [-4, 31, 3.5], [4, 39, 5], m),
        ...pair(box('hood_side_right', 'head', [3.5, 31.5, -4], [4.5, 39.5, 4.5], m)),
        box('hood_brim', 'head', [-4, 37.6, -4.6], [4, 39, -3.5], m),
        box('hood_tip', 'head', [-1.5, 35, 4.8], [1.5, 39, 6.5], m, { rotation: [-25, 0, 0], origin: [0, 39, 5] }),
        box('hood_cowl', 'chest', [-4.5, 28.5, -3.6], [4.5, 32, 4], m, { inflate: .25 }));
    }
    if (L.quiver) {
      add(box('quiver', 'chest', [-1.5, 19, 3.1], [1.5, 31, 5.4], 'leather', { rotation: [0, 0, 24], origin: [0, 25, 4] }));
      for (let i = 0; i < 4; i++) add(box(`arrow_${i}`, 'chest', [-1.2 + i * .8, 31, 3.6 + (i % 2) * .6], [-.6 + i * .8, 34, 4.2 + (i % 2) * .6], 'feather', { rotation: [0, 0, 24], origin: [0, 25, 4] }));
    }
    if (L.headband) add(box('headband', 'head', [-3.5, 36, -3.5], [3.5, 37, 3.5], L.headband, { inflate: .25 }), box('headband_tail', 'head', [-.5, 32, 3.6], [1.5, 36, 4.1], L.headband, { rotation: [-20, 0, 15], origin: [0, 36, 3.8] }));
    if (L.mask) add(box('mask', 'head', [-3.5, 31.5, -3.5], [3.5, 35, 3.5], L.mask, { inflate: .3, hide: ['up', 'down'] }));
    if (L.leatherArmor) {
      add(box('cuirass', 'chest', [-5 - sw, 24, -3], [5 + sw, 31, 3], L.leatherArmor, { inflate: .4, faceMat: { up: L.top },
        decals: [{ face: 'north', palette: { s: '#2a1c13' }, x: 4, y: 0, map: ['s', 's', 's', 's', 's', 's', 's'] }] }));
      add(pair(box('pauldron_right', 'arm_upper_right', [4.5 + sw, 28, -2], [8.5 + sw, 31, 2], L.leatherArmor, { inflate: .25, rotation: [0, 0, -12], origin: [6.5 + sw, 30, 0] })));
    }
    if (L.plate) {
      const m = L.plate;
      add(box('breastplate', 'chest', [-5 - sw, 24, -3], [5 + sw, 31, 3], m, { inflate: .5, decals: [{ face: 'north', palette: { r: 'shade' }, x: 4, y: 1, map: ['r', 'r', 'r', 'r', 'r'] }] }));
      add(box('fauld', 'torso', [-4, 19, -2.5], [4, 24, 2.5], 'chain', { inflate: .35 }));
      for (let row = 0; row < 2; row++) add(box(`tasset_${row}`, 'hips', [-4.4, 14 - row * 2, -3.1 - row * .2], [4.4, 17 - row * 2, -2.6 - row * .2], m));
      add(pair(box('pauldron_right', 'arm_upper_right', [4.5 + sw, 28, -2.5], [9 + sw, 31.5, 2.5], m, { inflate: .2, rotation: [0, 0, -14], origin: [6.5 + sw, 30, 0] })));
      add(pair(box('pauldron_lower_right', 'arm_upper_right', [5 + sw, 26, -2.2], [8.8 + sw, 28.5, 2.2], m, { inflate: .1, rotation: [0, 0, -8], origin: [6.5 + sw, 30, 0] })));
      add(pair(box('couter_right', 'arm_lower_right', [4.8 + sw, 22.5, -1.8], [8.2 + sw, 24.5, 1.8], m, { inflate: .2 })));
      add(pair(box('gauntlet_right', 'hand_right', [5.5 + sw, 16, -1], [7.5 + sw, 20, 1], m, { inflate: .5 })));
      add(pair(box('vambrace_right', 'arm_lower_right', [5 + sw, 19, -1.5], [8 + sw, 22.5, 1.5], m, { inflate: .3 })));
      add(pair(box('greave_right', 'leg_lower_right', [0, 2, -2], [4, 8, 2], m, { inflate: .3 })));
      add(pair(box('poleyn_right', 'leg_upper_right', [.3, 8.5, -2.6], [3.7, 11, -1.4], m, { inflate: .15 })));
      add(pair(box('sabaton_right', 'foot_right', [0, 0, -3], [4, 2, 2], m, { inflate: .25 })));
    }
    if (L.tabard) add(box('tabard_front', 'torso', [-2.5, 12, -3.4], [2.5, 24, -2.8], L.tabard, { decals: [{ face: 'north', palette: { g: '#b18b4a' }, x: 1, y: 3, map: ['.g.', 'ggg', '.g.'] }] }),
      box('tabard_back', 'torso', [-2.5, 12, 2.8], [2.5, 24, 3.4], L.tabard));
    if (L.helmet) {
      const m = L.helmet;
      add(box('helm_top', 'head', [-4, 38.5, -4], [4, 40, 4], m),
        box('helm_back', 'head', [-4, 32, 3.4], [4, 39, 4.4], m),
        ...pair(box('helm_side_right', 'head', [3.4, 32, -4], [4.4, 39.2, 4], m)),
        box('helm_visor', 'head', [-4, 32, -4.4], [4, 39, -3.4], m, { decals: [{ face: 'north', palette: { v: '#08090a', h: '#3d4347' }, x: 0, y: 1, map: ['........', 'vvv..vvv', '........', '...hh...', '..h..h..'] }] }),
        box('helm_crest', 'head', [-.5, 40, -3.5], [.5, 41.5, 3.5], 'brass'),
        box('helm_gorget', 'neck', [-3, 30, -3], [3, 32.5, 3], 'chain', { inflate: .3 }));
    }
    const spec = { name: L.name, bones, cubes, materials: MATERIALS, atlasWidth: 128 };
    return spec;
  }

  // ── Wolf (quadruped). Pivots sit on real joints; legs have three segments.
  function wolf() {
    const bones = [
      ['root', null, [0, 0, 0]],
      ['body', 'root', [0, 12, 2]],
      ['chest', 'body', [0, 12, -2]],
      ['neck', 'chest', [0, 14, -8]],
      ['head', 'neck', [0, 15, -11]],
      ['jaw', 'head', [0, 13, -12]],
      ['ear_right', 'head', [2, 18, -12]], ['ear_left', 'head', [-2, 18, -12]],
      ['tail_1', 'body', [0, 14, 9]], ['tail_2', 'tail_1', [0, 13, 13]], ['tail_3', 'tail_2', [0, 11, 16]],
    ];
    for (const [s, name] of [[1, 'right'], [-1, 'left']]) bones.push(
      [`front_upper_${name}`, 'chest', [s * 2.5, 11, -6]], [`front_lower_${name}`, `front_upper_${name}`, [s * 2.5, 6, -6]], [`front_paw_${name}`, `front_lower_${name}`, [s * 2.5, 1.5, -6]],
      [`rear_upper_${name}`, 'body', [s * 2.5, 11, 6]], [`rear_lower_${name}`, `rear_upper_${name}`, [s * 2.5, 6, 7]], [`rear_paw_${name}`, `rear_lower_${name}`, [s * 2.5, 1.5, 6.5]],
    );
    const cubes = [];
    const add = (...c) => cubes.push(...c.flat());
    add(box('body', 'body', [-3, 8, -1], [3, 14, 9], 'furGrey', { faceMat: { down: 'furLight' } }),
      box('chest', 'chest', [-3.5, 7, -8], [3.5, 15, 0], 'furGrey', { faceMat: { down: 'furLight' } }),
      box('ruff', 'chest', [-4, 9, -8.5], [4, 16, -3], 'furDark', { inflate: .3 }),
      box('spine_ridge', 'body', [-1.5, 14, -1], [1.5, 15, 7], 'furDark'),
      box('neck', 'neck', [-2.5, 11, -11], [2.5, 16, -6], 'furGrey', { rotation: [-20, 0, 0], origin: [0, 14, -8] }),
      box('head', 'head', [-3, 13, -15], [3, 18, -9], 'furGrey', { decals: [
        { face: 'north', palette: { e: '#f0a43c', d: '#151312', b: '#26221f' }, x: 0, y: 1, map: ['bb..bb', '.ed.de', '......'] },
      ] }),
      box('muzzle', 'head', [-1.5, 13, -19], [1.5, 16, -15], 'furLight', { decals: [{ face: 'up', palette: { d: '#2a2622' }, x: 0, y: 0, map: ['.d.', 'ddd'] }] }),
      box('nose', 'head', [-1, 15.2, -19.6], [1, 16.2, -18.6], 'nose'),
      box('jaw', 'jaw', [-1.5, 11.8, -18.5], [1.5, 13, -14], 'furLight'),
      box('fangs', 'jaw', [-1.3, 13, -18.3], [1.3, 13.6, -17.6], 'teeth'),
      ...pair(box('ear_right', 'ear_right', [1, 17.5, -12.5], [3, 20.5, -11.5], 'furDark', { rotation: [0, 0, -10], origin: [2, 18, -12] })),
      box('tail_1', 'tail_1', [-1.5, 12, 9], [1.5, 15, 13], 'furGrey', { rotation: [-30, 0, 0], origin: [0, 14, 9] }),
      box('tail_2', 'tail_2', [-1.5, 10.5, 12.5], [1.5, 13.5, 16.5], 'furGrey', { rotation: [-45, 0, 0], origin: [0, 13, 13] }),
      box('tail_3', 'tail_3', [-1, 8, 15], [1, 11.5, 18], 'furDark', { rotation: [-60, 0, 0], origin: [0, 11, 16] }));
    for (const legSet of ['front', 'rear']) {
      const z = legSet === 'front' ? -6 : 6.5;
      add(pair(box(`${legSet}_thigh_right`, `${legSet}_upper_right`, [1, 6, z - 1.5], [4, 12, z + 1.5], legSet === 'rear' ? 'furGrey' : 'furGrey')));
      add(pair(box(`${legSet}_shin_right`, `${legSet}_lower_right`, [1.5, 1.5, z - 1], [3.5, 6.5, z + 1], 'furDark')));
      add(pair(box(`${legSet}_paw_right`, `${legSet}_paw_right`, [1.25, 0, z - 2], [3.75, 1.5, z + 1], 'furDark')));
    }
    return { name: 'wolf', bones, cubes, materials: MATERIALS, atlasWidth: 128 };
  }

  // ── Game animals. Quadrupeds share the wolf's rig names (body › chest › neck › head, ears, tail,
  // {front,rear}_{upper,lower,paw}_*) so wildlife.js animates and ragdolls them all the same way.
  const eye = (face, x, y, colors = ['#0e0b09', '#5a4a3a']) => ({ face, x, y, palette: { d: colors[0], g: colors[1] }, map: [face === 'east' ? 'gd' : 'dg'] });
  // Legs are given for the right side (+X) and mirrored; segment thigh/shin/paw → bone upper/lower/paw.
  function quadLegs(legs, add) {
    const bone = { thigh: 'upper', shin: 'lower', paw: 'paw' };
    for (const [set, parts] of legs) for (const [seg, from, to, mat, extra] of parts) {
      const right = box(`${set}_${seg}_right`, `${set}_${bone[seg]}_right`, from, to, mat, extra || {});
      add(right, mirrorCube(right));
    }
  }
  function quadBones(bones, legPivots) {
    for (const [s, name] of [[1, 'right'], [-1, 'left']]) for (const [set, parent, upper, lower, paw] of legPivots) bones.push(
      [`${set}_upper_${name}`, parent, [s * upper[0], upper[1], upper[2]]],
      [`${set}_lower_${name}`, `${set}_upper_${name}`, [s * lower[0], lower[1], lower[2]]],
      [`${set}_paw_${name}`, `${set}_lower_${name}`, [s * paw[0], paw[1], paw[2]]]);
  }
  function deer() {
    const bones = [['root', null, [0, 0, 0]], ['body', 'root', [0, 20, 4]], ['chest', 'body', [0, 20, -4]],
      ['neck', 'chest', [0, 24, -10]], ['head', 'neck', [0, 32, -14]], ['antlers', 'head', [0, 36, -14]],
      ['ear_right', 'head', [2.5, 35.5, -12.5]], ['ear_left', 'head', [-2.5, 35.5, -12.5]], ['tail_1', 'body', [0, 24, 12]]];
    quadBones(bones, [['front', 'chest', [2.8, 17, -8], [2.8, 10, -8], [2.8, 2, -8]], ['rear', 'body', [2.8, 20, 8], [2.8, 11, 9], [2.8, 2, 9]]]);
    const cubes = [], add = (...c) => cubes.push(...c.flat());
    add(box('body', 'body', [-4.5, 16, -4], [4.5, 25, 12], 'deerCoat', { faceMat: { down: 'deerBelly' } }),
      box('rump', 'body', [-2.5, 18.5, 12], [2.5, 23.5, 12.4], 'deerRump'),
      box('withers', 'chest', [-3.5, 25, -11], [3.5, 27, -5], 'deerCoat'),
      box('chest', 'chest', [-5, 15, -12], [5, 26, -3], 'deerCoat', { faceMat: { down: 'deerBelly' },
        decals: [{ face: 'north', palette: { w: '#bba78a' }, x: 3, y: 5, map: ['wwww', 'wwww', '.ww.', '.ww.'] }] }),
      box('neck', 'neck', [-2.5, 23, -14], [2.5, 34, -8], 'deerCoat', { rotation: [-28, 0, 0], origin: [0, 24, -10],
        decals: [{ face: 'north', palette: { w: '#cbb99c' }, x: 1, y: 2, map: ['www', '.w.'] }] }),
      box('head', 'head', [-2.5, 30.5, -19], [2.5, 35.5, -12], 'deerCoat', { faceMat: { down: 'deerBelly' }, decals: [eye('east', 4, 1), eye('west', 1, 1),
        { face: 'up', palette: { d: '#5c3820' }, x: 1, y: 0, map: ['.d.', 'ddd'] }] }),
      box('muzzle', 'head', [-1.5, 30, -23], [1.5, 33.5, -19], 'deerCoat', { faceMat: { north: 'deerMuzzle', down: 'deerBelly' },
        decals: [{ face: 'east', palette: { d: '#46362b' }, x: 3, y: 1, map: ['d', 'd'] }, { face: 'west', palette: { d: '#46362b' }, x: 0, y: 1, map: ['d', 'd'] }] }),
      box('nose', 'head', [-1, 32.2, -23.6], [1, 33.6, -22.8], 'deerMuzzle'),
      ...pair(box('ear_right', 'ear_right', [2, 35, -13.5], [4.5, 39, -12.5], 'deerCoat', { rotation: [0, 0, -35], origin: [2.5, 35.5, -12.5],
        decals: [{ face: 'north', palette: { p: '#a07c64', w: '#d8c8ac' }, x: 0, y: 0, map: ['w.w', '.p.', '.p.'] }] })),
      box('tail', 'tail_1', [-1, 22, 12.2], [1, 25, 13.6], 'deerCoat', { faceMat: { down: 'deerRump' } }));
    // Antlers in their own bone, so does simply hide it.
    for (const [part, from, to] of [['beam', [1.5, 35.5, -14.5], [2.5, 42.5, -13.5]], ['brow', [1.5, 37.5, -17], [2.5, 38.5, -14.5]],
      ['fork_front', [1.5, 41.5, -16], [2.5, 43.5, -14.5]], ['fork_back', [1.5, 42, -13.5], [2.5, 44.5, -12.5]], ['mid', [2.5, 39.5, -14.2], [4, 40.5, -13.2]]])
      add(pair(box(`antler_${part}_right`, 'antlers', from, to, 'antler', { rotation: [-10, 0, -22], origin: [2, 35.5, -14] })));
    quadLegs([
      ['front', [['thigh', [1.6, 10, -9.6], [4.1, 18, -6.6], 'deerCoat', { faceMat: { west: 'deerBelly' } }], ['shin', [2.1, 2, -8.75], [3.5, 10.5, -7.3], 'deerCoat'], ['paw', [1.9, 0, -9.2], [3.7, 2, -7.2], 'hoof']]],
      ['rear', [['thigh', [1.2, 11, 5.6], [4.4, 21.5, 10.8], 'deerCoat', { faceMat: { west: 'deerBelly' } }], ['shin', [2.1, 2, 8.3], [3.5, 11.5, 9.8], 'deerCoat'], ['paw', [1.9, 0, 7.9], [3.7, 2, 9.9], 'hoof']]],
    ], add);
    return { name: 'deer', bones, cubes, materials: MATERIALS, atlasWidth: 128 };
  }
  function fox() {
    const bones = [['root', null, [0, 0, 0]], ['body', 'root', [0, 8.5, 3]], ['chest', 'body', [0, 8.5, -2]],
      ['neck', 'chest', [0, 9, -5]], ['head', 'neck', [0, 10.5, -7.5]], ['ear_right', 'head', [1.6, 12.5, -9]], ['ear_left', 'head', [-1.6, 12.5, -9]],
      ['tail_1', 'body', [0, 9.5, 7]], ['tail_2', 'tail_1', [0, 8.2, 10.5]], ['tail_3', 'tail_2', [0, 6.8, 14.2]]];
    quadBones(bones, [['front', 'chest', [1.6, 6.5, -4], [1.6, 3, -4], [1.6, .8, -4]], ['rear', 'body', [1.6, 7.5, 4.6], [1.6, 3, 5], [1.6, .8, 5]]]);
    const cubes = [], add = (...c) => cubes.push(...c.flat());
    add(box('body', 'body', [-2.5, 6, -.5], [2.5, 10.5, 7.5], 'foxCoat', { faceMat: { down: 'foxWhite' } }),
      box('chest', 'chest', [-2.75, 5.5, -6], [2.75, 11, 0], 'foxCoat', { faceMat: { down: 'foxWhite' },
        decals: [{ face: 'north', palette: { w: '#e2dccf' }, x: 1, y: 2, map: ['.ww.', 'wwww', 'wwww'] }] }),
      box('neck', 'neck', [-2, 8, -8], [2, 11.5, -4.5], 'foxCoat', { rotation: [-20, 0, 0], origin: [0, 9, -5], faceMat: { down: 'foxWhite' } }),
      box('head', 'head', [-2.5, 8.5, -11], [2.5, 12.5, -7], 'foxCoat', { faceMat: { down: 'foxWhite' }, decals: [
        eye('east', 2, 1, ['#120d0a', '#d8962c']), eye('west', 0, 1, ['#120d0a', '#d8962c']),
        { face: 'north', palette: { w: '#e2dccf' }, x: 0, y: 2, map: ['w...w', 'ww.ww'] },
        { face: 'east', palette: { w: '#e2dccf' }, x: 0, y: 3, map: ['wwww'] }, { face: 'west', palette: { w: '#e2dccf' }, x: 0, y: 3, map: ['wwww'] }] }),
      box('snout', 'head', [-1, 8.5, -14], [1, 10.5, -11], 'foxCoat', { faceMat: { down: 'foxWhite' },
        decals: [{ face: 'east', palette: { w: '#e2dccf' }, x: 0, y: 1, map: ['www'] }, { face: 'west', palette: { w: '#e2dccf' }, x: 0, y: 1, map: ['www'] }] }),
      box('nose', 'head', [-.6, 9.6, -14.6], [.6, 10.6, -13.8], 'foxBlack'),
      ...pair(box('ear_right', 'ear_right', [.9, 12.5, -9.6], [2.6, 15.5, -8.5], 'foxCoat', { rotation: [0, 0, -12], origin: [1.6, 12.5, -9],
        decals: [{ face: 'north', palette: { b: '#211a16', w: '#d0c9ba' }, x: 0, y: 0, map: ['bb', 'w.', 'w.'] }, { face: 'south', palette: { b: '#211a16' }, x: 0, y: 0, map: ['bb'] }] })),
      box('tail_1', 'tail_1', [-1.5, 7.6, 6.8], [1.5, 10.6, 11], 'foxCoat', { rotation: [32, 0, 0], origin: [0, 9.5, 7] }),
      box('tail_2', 'tail_2', [-1.9, 6.4, 10.2], [1.9, 9.9, 14.6], 'foxCoat', { rotation: [22, 0, 0], origin: [0, 8.2, 10.5] }),
      box('tail_3', 'tail_3', [-1.4, 5.4, 14], [1.4, 8.2, 17], 'foxWhite', { rotation: [12, 0, 0], origin: [0, 6.8, 14.2] }));
    quadLegs([
      ['front', [['thigh', [.8, 3, -4.8], [2.4, 7, -3.2], 'foxCoat'], ['shin', [1, .8, -4.6], [2.2, 3.3, -3.4], 'foxBlack'], ['paw', [.9, 0, -5.3], [2.3, .8, -3.3], 'foxBlack']]],
      ['rear', [['thigh', [.6, 3, 3.3], [2.6, 8.2, 6.2], 'foxCoat'], ['shin', [1, .8, 4.4], [2.2, 3.4, 5.6], 'foxBlack'], ['paw', [.9, 0, 4], [2.3, .8, 5.8], 'foxBlack']]],
    ], add);
    return { name: 'fox', bones, cubes, materials: MATERIALS, atlasWidth: 64 };
  }
  function hare() {
    const bones = [['root', null, [0, 0, 0]], ['body', 'root', [0, 4.5, 2]], ['chest', 'body', [0, 4.5, -1]],
      ['neck', 'chest', [0, 5.5, -3.5]], ['head', 'neck', [0, 7, -4.5]], ['ear_right', 'head', [.9, 8.8, -4.6]], ['ear_left', 'head', [-.9, 8.8, -4.6]],
      ['tail_1', 'body', [0, 4.5, 6.4]]];
    quadBones(bones, [['front', 'chest', [1.1, 3.5, -3.1], [1.1, 1.6, -3.2], [1.1, .3, -3.3]], ['rear', 'body', [1.6, 4.5, 3.4], [1.6, 1.4, 4.6], [1.6, .4, 1.8]]]);
    const cubes = [], add = (...c) => cubes.push(...c.flat());
    add(box('body', 'body', [-2.5, 2, -.5], [2.5, 7, 6.5], 'hareCoat', { faceMat: { down: 'hareBelly' } }),
      box('chest', 'chest', [-2, 2.2, -4], [2, 6.4, 0], 'hareCoat', { faceMat: { down: 'hareBelly', north: 'hareBelly' } }),
      box('neck', 'neck', [-1.5, 4.5, -5], [1.5, 7, -3], 'hareCoat'),
      box('head', 'head', [-1.75, 5.6, -7.6], [1.75, 9, -3.6], 'hareCoat', { faceMat: { down: 'hareBelly' }, decals: [
        eye('east', 1, 1, ['#140f0b', '#b07a2a']), eye('west', 1, 1, ['#140f0b', '#b07a2a']),
        { face: 'north', palette: { w: '#c6bba7', d: '#3a2d22' }, x: 0, y: 2, map: ['.ww.', 'w.dw'] }] }),
      ...pair(box('ear_right', 'ear_right', [.4, 8.6, -5.1], [1.6, 15, -4.1], 'hareCoat', { rotation: [18, 0, -8], origin: [.9, 8.8, -4.6],
        decals: [{ face: 'north', palette: { b: '#1d1915', p: '#8a6a58' }, x: 0, y: 0, map: ['b', 'b', 'p', 'p', 'p'] }, { face: 'south', palette: { b: '#1d1915' }, x: 0, y: 0, map: ['b', 'b'] }] })),
      box('tail', 'tail_1', [-1, 3.4, 6.2], [1, 5.4, 7.6], 'hareBelly', { faceMat: { up: 'foxBlack' } }));
    quadLegs([
      ['front', [['thigh', [.6, 1.5, -3.7], [1.6, 3.8, -2.7], 'hareCoat'], ['shin', [.65, .3, -3.8], [1.55, 1.7, -2.9], 'hareCoat'], ['paw', [.55, 0, -4.4], [1.65, .4, -3], 'hareBelly']]],
      ['rear', [['thigh', [1, 1.2, 1.6], [2.9, 5.4, 5.8], 'hareCoat'], ['shin', [1.1, .4, 3.6], [2.4, 1.6, 5.4], 'hareCoat'], ['paw', [1.1, 0, .6], [2.4, .9, 5], 'hareBelly']]],
    ], add);
    return { name: 'hare', bones, cubes, materials: MATERIALS, atlasWidth: 64 };
  }
  // Crow: the body tilts up at the chest like a perching bird; folded wings ride along it ('fold')
  // with their tips crossing over the tail; the spread wings ('wing_*') show only in flight.
  function crow() {
    const bones = [['root', null, [0, 0, 0]], ['body', 'root', [0, 4, .4]], ['head', 'body', [0, 5.6, -1.8]], ['fold', 'body', [0, 4.6, .4]],
      ['wing_right', 'body', [1.8, 5.8, -.4]], ['wing_left', 'body', [-1.8, 5.8, -.4]], ['tail_1', 'body', [0, 3.6, 3]],
      ['leg_right', 'body', [.8, 3, .5]], ['leg_left', 'body', [-.8, 3, .5]]];
    const cubes = [], add = (...c) => cubes.push(...c.flat()), tilt = { rotation: [25, 0, 0], origin: [0, 4, .4] };
    add(box('body', 'body', [-1.8, 2.8, -2.4], [1.8, 6, 3], 'crowBody', tilt),
      box('head', 'head', [-1.4, 5.2, -4.2], [1.4, 8, -1.2], 'crowBody', { decals: [eye('east', 1, 1, ['#050506', '#4e443a']), eye('west', 1, 1, ['#050506', '#4e443a'])] }),
      box('beak', 'head', [-.6, 5.7, -6.4], [.6, 7.1, -4.2], 'crowBeak'), box('beak_tip', 'head', [-.4, 5.7, -7.2], [.4, 6.5, -6.4], 'crowBeak'),
      ...pair(box('fold_right', 'fold', [1.5, 3.3, -1.8], [2.3, 6.1, 4.8], 'crowWing', tilt)),
      ...pair(box('wing_inner_right', 'wing_right', [1.8, 5.5, -1.6], [5.8, 6.1, 2.6], 'crowWing')),
      ...pair(box('wing_outer_right', 'wing_right', [5.8, 5.6, -1.2], [9.8, 6, 3.8], 'crowWing', { decals: [{ face: 'up', palette: { d: '#08080b' }, x: 0, y: 0, map: ['d.d.', '....', 'd.d.', '....', 'd.d.'] }] })),
      box('tail', 'tail_1', [-1.1, 3, 2.8], [1.1, 3.7, 6.8], 'crowWing', { rotation: [30, 0, 0], origin: [0, 3.6, 3] }),
      ...pair(box('leg_right', 'leg_right', [.55, 0, .2], [1.05, 3.2, .8], 'crowBeak')), ...pair(box('toes_right', 'leg_right', [.25, 0, -.8], [1.35, .35, .9], 'crowBeak')));
    return { name: 'crow', bones, cubes, materials: MATERIALS, atlasWidth: 64 };
  }

  // ── Street props for the towns (kronwacht.js streetClutter). Each top-level bone is one prop whose
  // pivot is its footprint centre on the ground; they stand in a row along X only for the atlas.
  function props() {
    const bones = [], cubes = [], add = (...c) => cubes.push(...c.flat());
    let slot = 0;
    const prop = name => { const x = slot; slot += 40; bones.push([name, null, [x, 0, 0]]); return (n, from, to, mat, extra = {}) => add(box(`${name}_${n}`, name, [from[0] + x, from[1], from[2]], [to[0] + x, to[1], to[2]], mat,
      { ...extra, origin: extra.origin ? [extra.origin[0] + x, extra.origin[1], extra.origin[2]] : undefined })); };
    // A spoked wheel: eight rim segments (four of them turned 45°), four spokes and an iron hub.
    const wheel = (put, n, cx, cy, cz, r, t = 1.5) => {
      const half = r * .43 + .2, ring = { origin: [cx, cy, cz] };
      for (const rot of [0, 45]) {
        const o = rot ? { rotation: [rot, 0, 0], ...ring } : {};
        put(`rim${n}_${rot}_t`, [cx - .75, cy + r - t, cz - half], [cx + .75, cy + r, cz + half], 'woodDark', o);
        put(`rim${n}_${rot}_b`, [cx - .75, cy - r, cz - half], [cx + .75, cy - r + t, cz + half], 'woodDark', o);
        put(`rim${n}_${rot}_f`, [cx - .75, cy - half, cz - r], [cx + .75, cy + half, cz - r + t], 'woodDark', o);
        put(`rim${n}_${rot}_k`, [cx - .75, cy - half, cz + r - t], [cx + .75, cy + half, cz + r], 'woodDark', o);
        put(`spoke${n}_${rot}_v`, [cx - .45, cy - r + t, cz - .5], [cx + .45, cy + r - t, cz + .5], 'barrelWood', o);
        put(`spoke${n}_${rot}_h`, [cx - .45, cy - .5, cz - r + t], [cx + .45, cy + .5, cz + r - t], 'barrelWood', o);
      }
      put(`hub${n}`, [cx - 1.2, cy - 1.1, cz - 1.1], [cx + 1.2, cy + 1.1, cz + 1.1], 'ironDark');
    };
    const barrel = (put, n, bx, by, bz, h = 14) => {
      for (const [k, rot] of [[0, 0], [1, 45]]) put(`barrel${n}_${k}`, [bx - 5, by, bz - 5], [bx + 5, by + h, bz + 5], 'barrelWood', { rotation: [0, rot, 0], origin: [bx, by, bz] });
      for (const hy of [2, h - 3]) for (const [k, rot] of [[0, 0], [1, 45]]) put(`hoop${n}_${hy}_${k}`, [bx - 5.3, by + hy, bz - 5.3], [bx + 5.3, by + hy + 1, bz + 5.3], 'ironDark', { rotation: [0, rot, 0], origin: [bx, by, bz] });
      put(`lid${n}`, [bx - 4.2, by + h, bz - 4.2], [bx + 4.2, by + h + .4, bz + 4.2], 'woodDark');
    };
    const sack = (put, n, sx, sy, sz, s = 1, mat = 'sack') => {
      put(`sack${n}`, [sx - 4 * s, sy, sz - 3 * s], [sx + 4 * s, sy + 8 * s, sz + 3 * s], mat);
      put(`tie${n}`, [sx - 1.5 * s, sy + 8 * s, sz - 1.5 * s], [sx + 1.5 * s, sy + 10 * s, sz + 1.5 * s], 'sackDark');
    };
    const crate = (put, n, cx, cy, cz, s = 11, rot = 0) => {
      const o = { rotation: [0, rot, 0], origin: [cx, cy, cz] }, h = s / 2;
      put(`crate${n}`, [cx - h, cy, cz - h], [cx + h, cy + s, cz + h], 'woodLight', { ...o, decals: ['north', 'south', 'east', 'west'].map(face => ({ face, palette: { d: '#5a3e26' }, x: 0, y: 0, map: Array.from({ length: s }, (_, y) => y === 0 || y === s - 1 || y === (s >> 1) ? 'd'.repeat(s) : 'd' + '.'.repeat(s - 2) + 'd') })) });
    };
    // 1 Handcart with sacks of grain.
    { const p = prop('handcart');
      p('bed', [-8, 8, -12], [8, 10, 12], 'woodLight');
      for (const sx of [-1, 1]) p(`side${sx}`, sx < 0 ? [-8, 10, -12] : [7, 10, -12], sx < 0 ? [-7, 14, 12] : [8, 14, 12], 'woodLight');
      p('front', [-8, 10, -12], [8, 14, -11], 'woodLight');
      for (const sx of [-1, 1]) p(`handle${sx}`, [sx * 5.5 - .5, 8.5, 12], [sx * 5.5 + .5, 9.5, 27], 'woodDark');
      for (const sx of [-1, 1]) wheel(p, sx, sx * 9.2, 6, 2, 6);
      p('leg', [-1, 0, 10], [1, 8, 11], 'woodDark');
      sack(p, 1, -3.5, 10, -6.5, .9); sack(p, 2, 3.5, 10, -5.5, .85); sack(p, 3, 0, 10, 3, .9, 'sackLight'); }
    // 2 Wheelbarrow with earth.
    { const p = prop('wheelbarrow');
      p('tray', [-6, 6, -6], [6, 11, 8], 'woodLight'); p('earth', [-5, 10.6, -5], [5, 11.4, 7], 'earth');
      wheel(p, 0, 0, 4, -12, 4, 1.2);
      for (const sx of [-1, 1]) { p(`arm${sx}`, [sx * 4.5 - .5, 6, -12], [sx * 4.5 + .5, 7, 20], 'woodDark'); p(`foot${sx}`, [sx * 4.5 - .5, 0, 6], [sx * 4.5 + .5, 6, 7], 'woodDark'); } }
    // 3 Barrels: three standing, one with its lid off and water in it.
    { const p = prop('barrels');
      barrel(p, 1, -6, 0, -2); barrel(p, 2, 5, 0, -4, 13); barrel(p, 3, 0, 0, 7, 15);
      p('water', [-4, 15.2, 3], [4, 15.6, 11], 'water'); }
    // 4 Crates, two below and one turned on top.
    { const p = prop('crates');
      crate(p, 1, -6, 0, 0); crate(p, 2, 6, 0, 1, 11, 8); crate(p, 3, 0, 11, .5, 10, 20); }
    // 5 Sacks piled against a wall.
    { const p = prop('sacks');
      sack(p, 1, -6, 0, 0); sack(p, 2, 3, 0, -1, 1.05, 'sackLight'); sack(p, 3, 11, 0, 1); sack(p, 4, -2, 8, -.5, .9); sack(p, 5, 7, 8.4, 0, .85, 'sackLight'); }
    // 6 Produce: a basket of apples, a crate of cabbages, a basket of carrots.
    { const p = prop('produce');
      p('basket1', [-12, 0, -5], [-2, 5, 5], 'wicker'); for (let k = 0; k < 9; k++) p(`apple${k}`, [-11 + (k % 3) * 3, 5, -4 + Math.floor(k / 3) * 3], [-9 + (k % 3) * 3, 7, -2 + Math.floor(k / 3) * 3], k % 4 ? 'apple' : 'appleGreen');
      crate(p, 1, 5, 0, 0, 10);
      for (let k = 0; k < 4; k++) p(`cabbage${k}`, [1 + (k % 2) * 4.5, 10, -4 + Math.floor(k / 2) * 4.5], [4.5 + (k % 2) * 4.5, 13, -.5 + Math.floor(k / 2) * 4.5], 'cabbage');
      p('basket2', [-9, 0, 7], [-1, 4, 14], 'wicker'); for (let k = 0; k < 6; k++) p(`carrot${k}`, [-8 + k * 1.2, 4, 8], [-7.2 + k * 1.2, 5, 13], 'carrot'); }
    // 7 Water trough on trestles.
    { const p = prop('trough');
      p('box', [-12, 2, -4], [12, 8, 4], 'woodLight'); p('water', [-11, 7.6, -3], [11, 7.9, 3], 'water');
      for (const sx of [-1, 1]) p(`trestle${sx}`, [sx * 9 - 1, 0, -4.5], [sx * 9 + 1, 3, 4.5], 'woodDark'); }
    // 8 Woodpile with a chopping block and an axe.
    { const p = prop('woodpile');
      for (let row = 0; row < 3; row++) for (let k = 0; k < 4 - row; k++) p(`log${row}_${k}`, [-8 + row * 2 + k * 4, row * 3.6, -9], [-4.4 + row * 2 + k * 4, row * 3.6 + 3.6, 9], 'logs', { faceMat: { north: 'logEnd', south: 'logEnd' } });
      p('block', [9, 0, -3], [15, 5, 3], 'logs', { faceMat: { up: 'logEnd' } });
      p('axe_handle', [11.5, 5, -.5], [12.5, 14, .5], 'woodDark', { rotation: [0, 0, -20], origin: [12, 5, 0] }); p('axe_head', [12.5, 11, -.6], [16, 13.4, .6], 'iron', { rotation: [0, 0, -20], origin: [12, 5, 0] }); }
    // 9 Bench.
    { const p = prop('bench');
      p('seat', [-12, 7, -3], [12, 8.5, 3], 'woodLight'); for (const sx of [-1, 1]) p(`leg${sx}`, [sx * 9 - 1, 0, -2.5], [sx * 9 + 1, 7, 2.5], 'woodDark'); p('rail', [-9, 2.5, -.5], [9, 3.5, .5], 'woodDark'); }
    // 10 Hay bales.
    { const p = prop('hay');
      for (const [k, bx, by, rot] of [[1, -5, 0, 0], [2, 6, 0, 12], [3, 0, 9, -8]]) {
        p(`bale${k}`, [bx - 8, by, -6], [bx + 8, by + 9, 6], 'hay', { rotation: [0, rot, 0], origin: [bx, by, 0], decals: ['north', 'south', 'up'].map(face => ({ face, palette: { t: '#5a4a24' }, x: 4, y: 0, map: Array.from({ length: face === 'up' ? 12 : 9 }, () => 't.......t') })) });
      } }
    // 11 Pottery: a tall jar, round pots and a stack of bowls.
    { const p = prop('pottery');
      p('jar_foot', [-8, 0, -3], [-2, 2, 3], 'clay'); p('jar_body', [-9, 2, -4], [-1, 10, 4], 'clay'); p('jar_neck', [-7, 10, -2], [-3, 13, 2], 'clay'); p('jar_lip', [-7.5, 13, -2.5], [-2.5, 14, 2.5], 'clayDark');
      p('pot1', [1, 0, -4], [7, 5, 2], 'clayDark'); p('pot1_rim', [1.5, 5, -3.5], [6.5, 6, 1.5], 'clay');
      p('pot2', [2, 0, 4], [6, 4, 8], 'clay'); for (let k = 0; k < 3; k++) p(`bowl${k}`, [8 - k * .3, k * 1.2, -2 - k * .3], [13 + k * .3, k * 1.2 + 1.2, 3 + k * .3], 'clay'); }
    // 12 A painted sign on an A-frame, pointing to a shop.
    { const p = prop('sign');
      for (const sz of [-1, 1]) p(`board${sz}`, [-6, 2, sz * 2.5 - .5], [6, 14, sz * 2.5 + .5], 'woodLight', { rotation: [sz * -14, 0, 0], origin: [0, 14, 0],
        decals: [{ face: sz < 0 ? 'north' : 'south', palette: { r: '#9a3a2a', y: '#d8b04a', k: '#2a1d14' }, x: 2, y: 3, map: ['..kkkk..', '.kyyyyk.', 'kyrrrryk', 'kyrrrryk', '.kyyyyk.', '..kkkk..'] }] });
      p('cap', [-6.5, 14, -1], [6.5, 15, 1], 'woodDark'); }
    // 13 Ladder.
    { const p = prop('ladder');
      for (const sx of [-1, 1]) p(`rail${sx}`, [sx * 4 - .5, 0, -.5], [sx * 4 + .5, 52, .5], 'woodLight');
      for (let y = 4; y < 52; y += 6) p(`rung${y}`, [-4, y, -.4], [4, y + 1, .4], 'woodDark'); }
    // 14 A spare cart wheel leaning on a wall.
    { const p = prop('cartwheel');
      wheel(p, 1, 0, 9, 0, 9); }
    return { name: 'props', bones, cubes, materials: MATERIALS, atlasWidth: 256 };
  }

  // ── Trees and bushes (src/world/trees.js). Each top-level bone is one tree whose pivot is the foot
  // of its trunk; they stand in a row along X only for the atlas. Wood cubes are named *_wood*,
  // foliage *_leaf*: the game rounds foliage normals into a crown and sways it in the wind.
  // Limbs are boxes tilted `tilt`° from upright toward compass `yaw`° (Blockbench turns cubes ZYX).
  function trees() {
    const bones = [], cubes = [], rad = Math.PI / 180;
    let slot = 0;
    const rng = s => () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const q = (v, step = 4) => Math.max(step, Math.round(v / step) * step);
    // The point at height fraction f along a trunk polyline.
    const along = (pts, f) => {
      const y = pts[0][1] + (pts[pts.length - 1][1] - pts[0][1]) * f;
      for (let i = 1; i < pts.length; i++) if (pts[i][1] >= y) { const a = pts[i - 1], b = pts[i], u = (y - a[1]) / (b[1] - a[1] || 1); return [a[0] + (b[0] - a[0]) * u, y, a[2] + (b[2] - a[2]) * u]; }
      return pts[pts.length - 1];
    };
    function tree(name, seed, build) {
      const x0 = slot; slot += 160; bones.push([name, null, [x0, 0, 0]]);
      const r = rng(seed), at = v => [v[0] + x0, v[1], v[2]];
      let n = 0;
      build({
        r,
        limb(base, len, thick, tilt, yaw, mat = 'bark') {
          const h = Math.max(1, thick) / 2;
          cubes.push(box(`${name}_wood${n++}`, name, at([base[0] - h, base[1] - 1, base[2] - h]), at([base[0] + h, base[1] + len, base[2] + h]), mat, { origin: at(base), rotation: [tilt, yaw, 0] }));
          const a = tilt * rad, b = yaw * rad;
          return [base[0] + Math.sin(a) * Math.sin(b) * len, base[1] + Math.cos(a) * len, base[2] + Math.sin(a) * Math.cos(b) * len];
        },
        // A root flare: a low box from the trunk axis outward, its outer end dipping into the ground.
        root(len, wide, high, yaw, mat) { cubes.push(box(`${name}_wood${n++}`, name, at([-wide / 2, -3, 0]), at([wide / 2, high, len]), mat, { origin: at([0, 0, 0]), rotation: [9 + r() * 6, yaw, 0] })); },
        leaf(c, s, h, mat, extra = {}) {
          s = q(s); h = q(h); const tilt = extra.tilt ?? 0;
          cubes.push(box(`${name}_leaf${n++}`, name, at([c[0] - s / 2, c[1] - h / 2, c[2] - s / 2]), at([c[0] + s / 2, c[1] + h / 2, c[2] + s / 2]), mat,
            { share: 'foliage', origin: at(c), rotation: [(r() - .5) * tilt, extra.yaw ?? Math.round(r() * 6) * 15, (r() - .5) * tilt], faceMat: extra.faceMat }));
        },
        // A conifer bough: a flat leaf box from the trunk outward along `yaw`, drooping `droop`°.
        bough(base, len, wide, thick, droop, yaw, mat, faceMat) {
          len = q(len); wide = q(wide, 2); thick = q(thick, 2);
          cubes.push(box(`${name}_leaf${n++}`, name, at([base[0] - wide / 2, base[1] - thick / 2, base[2]]), at([base[0] + wide / 2, base[1] + thick / 2, base[2] + len]), mat,
            { share: 'foliage', origin: at(base), rotation: [droop, yaw, 0], faceMat }));
          const a = droop * rad, b = yaw * rad;
          return [base[0] + Math.sin(b) * Math.cos(a) * len, base[1] - Math.sin(a) * len, base[2] + Math.cos(b) * Math.cos(a) * len];
        },
      });
    }
    const clamp1 = v => Math.max(-1, Math.min(1, v));
    const limbTo = (t, from, to, thick, mat) => {
      const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]], len = Math.hypot(...d) || 1;
      return t.limb(from, len, thick, Math.acos(clamp1(d[1] / len)) / rad, Math.atan2(d[0], d[2]) / rad, mat);
    };
    // A round crown: foliage clumps spread over an ellipsoid (golden spiral, top to `floor`), each on
    // a twig from the nearest limb end, most with a lobe pushed outward (or hanging, for birch), and
    // a dark heart inside so the crown never looks hollow.
    function crown(t, o, centre, mat, ends, twig = 'bark') {
      const { r } = t;
      for (let k = 0; k < o.clumps; k++) {
        const v = 1 - 2 * (k + .5) / o.clumps;
        if (v < o.floor) continue;
        const a = k * 2.39996 + r() * .5, ring = Math.sqrt(1 - v * v), s = .82 + r() * .22;
        const p = [centre[0] + Math.cos(a) * ring * o.R * s, centre[1] + v * o.Ry * s, centre[2] + Math.sin(a) * ring * o.R * s];
        let near = ends[0], best = Infinity;
        for (const e of ends) { const d = Math.hypot(e[0] - p[0], e[1] - p[1], e[2] - p[2]); if (d < best) { best = d; near = e; } }
        if (best > 6 && o.twigs !== false) limbTo(t, near, p.map((c, i) => near[i] + (c - near[i]) * .8), 2, twig);
        const size = o.leaf * (.75 + r() * .35);
        t.leaf(p, size, size * (.6 + r() * .2), mat(), { tilt: 16 });
        if (r() < o.lobes) {
          const out = [p[0] - centre[0], (p[1] - centre[1]) * .6, p[2] - centre[2]], len = Math.hypot(...out) || 1;
          t.leaf(p.map((c, i) => c + out[i] / len * size * .45 + (i === 1 ? size * (o.hang ? -.35 : .1) : 0)), size * .6, size * (o.hang ? .7 : .45), mat(), { tilt: 24 });
        }
      }
      t.leaf(centre, o.R * 1.25, o.Ry * 1.1, o.heart, { tilt: 6 });
    }
    // Broadleaf: flared roots, a leaning, tapering trunk, a few main limbs into the crown.
    const broadleaf = (t, o) => {
      const { r } = t, leaf = () => o.leaves[Math.floor(r() * o.leaves.length)];
      for (let k = 0; k < 4; k++) t.root(o.trunk / 2 + 6, 6, 5, k * 90 + r() * 40 - 20, 'barkMoss');
      let p = [0, 0, 0], w = o.trunk;
      for (const [len, tilt] of o.segments) { p = t.limb(p, len, w, tilt, r() * 360, w === o.trunk ? 'barkMoss' : 'bark'); w = Math.max(4, w - 2); }
      const centre = [p[0], p[1] + o.Ry * .55, p[2]], ends = [p];
      for (let k = 0; k < o.limbs; k++) {
        const yaw = (k * 360 / o.limbs + r() * 40 - 20) * rad, reach = o.R * (.45 + r() * .15);
        ends.push(limbTo(t, [p[0], p[1] - 4 - r() * 6, p[2]], [centre[0] + Math.sin(yaw) * reach, centre[1] + (r() - .3) * o.Ry * .5, centre[2] + Math.cos(yaw) * reach], 5, 'bark'));
      }
      ends.push(limbTo(t, p, [centre[0], centre[1] + o.Ry * .4, centre[2]], 4, 'bark'));
      crown(t, o, centre, leaf, ends);
    };
    // Birch: a slim pale trunk with an S-curve running up through a narrow, drooping oval crown.
    const birch = (t, o) => {
      o = { leaves: 'leavesBirch', heart: 'leavesBirchHeart', ...o };
      const { r } = t, trunk = [[0, 0, 0]];
      for (let k = 0; k < 3; k++) t.root(7, 3, 3, k * 120 + r() * 30, 'birchBark');
      let w = 7;
      for (const [len, tilt] of o.segments) { trunk.push(t.limb(trunk[trunk.length - 1], len, w, tilt, r() * 360, 'birchBark')); w = Math.max(4, w - 1); }
      const ends = [.5, .6, .7, .8, .9, 1].map(f => along(trunk, f));
      crown(t, { clumps: 20, floor: -.65, R: o.R, Ry: o.Ry, leaf: 18, lobes: .8, hang: true, heart: o.heart }, along(trunk, .8), () => o.leaves, ends, 'birchBark');
    };
    // Spruce: a broad cone of drooping boughs, tier on tier, each tier turned against the last.
    const spruce = (t, o) => {
      const { r } = t;
      for (let k = 0; k < 4; k++) t.root(10, 4, 4, k * 90 + r() * 30, 'barkPine');
      t.limb([0, 0, 0], o.height - 12, 8, 0, 0, 'barkPine');
      for (let k = 0; k < o.tiers; k++) {
        const f = k / (o.tiers - 1), y = o.base + f * (o.height - o.base - 6), R = o.radius * Math.pow(1 - f, .9) + 6;
        const count = f < .5 ? 5 : 4, turn = k * 37 + r() * 20;
        for (let j = 0; j < count; j++) t.bough([0, y, 0], R * (.85 + r() * .3), Math.max(6, 14 - f * 8), 6, 14 + r() * 10 - f * 6, turn + j * 360 / count + r() * 16, o.needles, o.snow);
        t.leaf([0, y + 1, 0], R * .9, 6 + (k % 2) * 2, o.needles, { yaw: (k % 2) * 45, faceMat: o.snow });
      }
      t.leaf([0, o.height + 4, 0], 4, 16, o.needles, { yaw: 0, faceMat: o.snow });
    };
    // Fir of the taiga: tall and slender, a bare lower trunk with dead stubs, long drooping boughs
    // with a tuft at every second tier's tips.
    const fir = (t, o) => {
      const { r } = t, trunk = [[0, 0, 0]];
      for (let k = 0; k < 4; k++) t.root(11, 5, 4, k * 90 + r() * 30, 'barkPine');
      [[60, 1], [60, 2], [54, 3]].forEach(([len, tilt], k) => trunk.push(t.limb(trunk[k], len, 9 - k, tilt, r() * 360, 'barkPine')));
      for (let k = 0; k < 4; k++) t.limb(along(trunk, .12 + k * .06), 5 + r() * 4, 2, 70 + r() * 20, r() * 360, 'barkPine');
      for (let k = 0; k < o.tiers; k++) {
        const f = k / (o.tiers - 1), c = along(trunk, o.crown + f * (.97 - o.crown)), R = o.radius * (1 - f * .85) + 5, turn = k * 53 + r() * 30;
        for (let j = 0; j < 3; j++) {
          const tip = t.bough(c, R * (.8 + r() * .4), Math.max(6, 12 - f * 6), 6, 18 + r() * 10 - f * 8, turn + j * 120 + r() * 20, o.needles, o.snow);
          if (k % 2 === 0 && f < .8) t.leaf(tip, 12 - f * 4, 8, o.needles, { tilt: 16, faceMat: o.snow });
        }
        t.leaf([c[0], c[1] + 1, c[2]], R * .8, 8, o.needles, { yaw: (k % 2) * 45, faceMat: o.snow });
      }
      const top = trunk[trunk.length - 1];
      t.leaf([top[0], top[1] + 6, top[2]], 4, 16, o.needles, { yaw: 0, faceMat: o.snow });
    };
    // Dead tree: grey, crooked, broken limbs and bare twigs.
    const dead = t => {
      const { r } = t, trunk = [[0, 0, 0]];
      for (let k = 0; k < 3; k++) t.root(11, 6, 5, k * 120 + r() * 40, 'barkGrey');
      [[26, 5], [22, 9], [18, 12], [12, 16]].forEach(([len, tilt], k) => trunk.push(t.limb(trunk[k], len, 10 - k * 2, tilt, k * 70 + r() * 40, 'barkGrey')));
      for (let k = 0; k < 5; k++) {
        const base = along(trunk, .42 + k * .12), yaw = k * 137.5 + r() * 30, tilt = 45 + r() * 30;
        const tip = t.limb(base, 16 + r() * 12, k < 2 ? 4 : 3, tilt, yaw, 'barkGrey');
        for (let j = 0; j < 1 + (k % 2); j++) t.limb(tip.map((v, i) => v + (base[i] - v) * .25), 8 + r() * 5, 2, tilt - 25 + r() * 20, yaw + (j ? 40 : -40), 'barkGrey');
      }
    };
    const bush = (t, mat) => {
      for (let k = 0; k < 3; k++) t.limb([0, 0, 0], 7, 2, 30 + t.r() * 30, k * 120, 'bark');
      crown(t, { clumps: 12, floor: -.5, R: 13, Ry: 9, leaf: 14, lobes: .6, heart: 'leavesHeart', twigs: false }, [0, 9, 0], () => mat, [[0, 2, 0]]);
    };
    const OAK = { leaves: ['leavesOak'], heart: 'leavesHeart' }, AUTUMN = { leaves: ['leavesAutumn', 'leavesGold', 'leavesAutumn'], heart: 'leavesAutumnHeart' };
    const CROWN = { clumps: 24, floor: -.55, lobes: .7 };
    tree('oak_1', 11, t => broadleaf(t, { ...OAK, ...CROWN, trunk: 12, segments: [[26, 3], [22, 5], [12, 6]], limbs: 4, R: 38, Ry: 34, leaf: 26 }));
    tree('oak_2', 23, t => broadleaf(t, { ...OAK, ...CROWN, trunk: 11, segments: [[30, 4], [26, 6], [14, 8]], limbs: 3, R: 32, Ry: 36, leaf: 24 }));
    tree('oak_3', 37, t => broadleaf(t, { ...OAK, ...CROWN, clumps: 28, trunk: 14, segments: [[22, 2], [18, 4], [10, 5]], limbs: 5, R: 44, Ry: 32, leaf: 26 }));
    tree('autumn_1', 41, t => broadleaf(t, { ...AUTUMN, ...CROWN, trunk: 12, segments: [[26, 3], [22, 5], [12, 7]], limbs: 4, R: 38, Ry: 34, leaf: 26 }));
    tree('autumn_2', 53, t => broadleaf(t, { ...AUTUMN, ...CROWN, trunk: 11, segments: [[30, 5], [24, 7], [14, 6]], limbs: 3, R: 32, Ry: 34, leaf: 24 }));
    tree('birch_1', 61, t => birch(t, { segments: [[34, 2], [30, 3], [26, 3], [22, 4]], R: 18, Ry: 36 }));
    tree('birch_2', 67, t => birch(t, { segments: [[30, 4], [28, 5], [24, 5], [18, 6]], R: 20, Ry: 32 }));
    // Autumn woods only: red maples (short trunk, a broad round crown) and birches gone gold.
    const MAPLE = { leaves: ['leavesMaple', 'leavesMaple', 'leavesAutumn'], heart: 'leavesMapleHeart', clumps: 28, floor: -.5, lobes: .8 };
    tree('maple_1', 107, t => broadleaf(t, { ...MAPLE, trunk: 11, segments: [[20, 3], [16, 5], [10, 6]], limbs: 5, R: 44, Ry: 34, leaf: 24 }));
    tree('maple_2', 109, t => broadleaf(t, { ...MAPLE, trunk: 10, segments: [[24, 4], [18, 6], [10, 4]], limbs: 4, R: 38, Ry: 36, leaf: 22 }));
    tree('birch_gold_1', 113, t => birch(t, { segments: [[34, 2], [30, 3], [26, 3], [22, 4]], R: 18, Ry: 36, leaves: 'leavesGold', heart: 'leavesGoldHeart' }));
    tree('birch_gold_2', 127, t => birch(t, { segments: [[30, 4], [28, 5], [24, 5], [18, 6]], R: 20, Ry: 32, leaves: 'leavesGold', heart: 'leavesGoldHeart' }));
    tree('spruce_1', 71, t => spruce(t, { height: 116, base: 18, radius: 36, tiers: 9, needles: 'needlesSpruce' }));
    tree('spruce_2', 79, t => spruce(t, { height: 128, base: 22, radius: 32, tiers: 10, needles: 'needlesSpruce' }));
    tree('pine_1', 83, t => fir(t, { crown: .24, tiers: 10, radius: 30, needles: 'needlesPine' }));
    tree('pine_2', 89, t => fir(t, { crown: .32, tiers: 9, radius: 26, needles: 'needlesPine' }));
    tree('pine_snow_1', 83, t => fir(t, { crown: .24, tiers: 10, radius: 30, needles: 'needlesPine', snow: { up: 'snowCap' } }));
    tree('pine_snow_2', 89, t => fir(t, { crown: .32, tiers: 9, radius: 26, needles: 'needlesPine', snow: { up: 'snowCap' } }));
    tree('dead_1', 97, dead);
    tree('bush_1', 101, t => bush(t, 'leavesBush'));
    tree('bush_2', 103, t => bush(t, 'leavesBerry'));
    return { name: 'trees', bones, cubes, materials: MATERIALS, atlasWidth: 512 };
  }

  // ── Held items. Each top-level bone is one item whose pivot is the grip point.
  function weapons() {
    const items = [['sword_rusty', 'rust', 'iron', 'leatherDark'], ['sword_guard', 'steel', 'brass', 'leather'], ['sword_ash', 'darkSteel', 'darkSteel', 'leatherDark']];
    const bones = [], cubes = [];
    items.forEach(([name, blade, guard, grip], i) => {
      const x = i * 10;
      bones.push([name, null, [x, 0, 0]]);
      const fuller = name === 'sword_ash' ? '#ff9a3f' : blade === 'rust' ? '#4a3426' : '#4a5258';
      const edge = blade === 'rust' ? '#9a8d84' : '#e3eaec';
      const bladeDecal = [{ face: 'north', palette: { f: fuller, e: edge }, map: Array.from({ length: 13 }, (_, y) => y < 11 ? 'efe' : 'e.e') }, { face: 'south', palette: { f: fuller, e: edge }, map: Array.from({ length: 13 }, (_, y) => y < 11 ? 'efe' : 'e.e') }];
      if (blade === 'rust') bladeDecal.push({ face: 'north', palette: { r: '#6b4430' }, x: 0, y: 3, map: ['r..', '...', '..r', '.r.', '...', '...', 'r..'] });
      cubes.push(
        box(`${name}_pommel`, name, [x - 1, -4, -1], [x + 1, -2, 1], guard),
        box(`${name}_grip`, name, [x - .5, -2, -.5], [x + .5, 3, .5], grip, { inflate: .2, decals: [{ face: 'north', palette: { w: '#8d6a4a' }, map: ['.', 'w', '.', 'w', '.'] }] }),
        box(`${name}_guard`, name, [x - 3, 3, -1], [x + 3, 4, 1], guard),
        box(`${name}_quillon_r`, name, [x + 3, 3.5, -.5], [x + 4, 5, .5], guard),
        box(`${name}_quillon_l`, name, [x - 4, 3.5, -.5], [x - 3, 5, .5], guard),
        box(`${name}_blade`, name, [x - 1.5, 4, -.5], [x + 1.5, 17, .5], blade, { decals: bladeDecal }),
        box(`${name}_tip`, name, [x - 1, 17, -.5], [x + 1, 19, .5], blade),
        box(`${name}_point`, name, [x - .5, 19, -.5], [x + .5, 20.5, .5], blade),
      );
    });
    bones.push(['hammer', null, [32, 0, 0]]);
    cubes.push(box('hammer_handle', 'hammer', [31.5, -6, -.5], [32.5, 9, .5], 'wood', { inflate: .15 }),
      box('hammer_head', 'hammer', [29.5, 8, -1.5], [34.5, 11, 1.5], 'iron'),
      box('hammer_face', 'hammer', [34.5, 8.5, -1], [35.5, 10.5, 1], 'steel'));
    // Hunting bow: pivot in the grip, limbs up and down (+Y), the belly faces the target (−Z) and the
    // string runs behind it (+Z, toward the archer). Each limb is its own bone so the game can bend it
    // while drawing; the string is drawn by the game from nock to nock (BOW_NOCK in characters/models.js).
    { const x = 48;
      bones.push(['bow', null, [x, 0, 0]], ['bow_upper', 'bow', [x, 4, 0]], ['bow_lower', 'bow', [x, -4, 0]]);
      cubes.push(box('bow_riser', 'bow', [x - .9, -4.5, -1.3], [x + .9, 4.5, .5], 'bowWood'),
        box('bow_grip', 'bow', [x - 1.15, -2.6, -1.5], [x + 1.15, 2.6, .8], 'leather', { decals: ['north', 'south'].map(face => ({ face, palette: { w: '#7d5e42' }, map: ['..', 'ww', '..', 'ww', '..'] })) }),
        box('bow_rest', 'bow', [x - 1.5, 2.6, -1], [x - .9, 3.2, .4], 'leatherDark'));
      for (const [bone, s] of [['bow_upper', 1], ['bow_lower', -1]]) {
        let y = 4 * s, z = 0;
        [[5, 6, 2, 1.5], [5, 14, 1.6, 1.3], [4.5, 24, 1.2, 1.1]].forEach(([len, angle, w, d], k) => {
          const a = angle * Math.PI / 180;
          cubes.push(box(`${bone}_${k}`, bone, [x - w / 2, s > 0 ? y : y - len, z - d / 2], [x + w / 2, s > 0 ? y + len : y, z + d / 2], 'bowWood', { origin: [x, y, z], rotation: [s * angle, 0, 0] }));
          y += s * len * Math.cos(a); z += len * Math.sin(a);
        });
        cubes.push(box(`${bone}_nock`, bone, [x - .7, y - .8, z - .7], [x + .7, y + .8, z + .7], 'horn', { origin: [x, y, z], rotation: [s * 24, 0, 0] }));
      }
    }
    // Arrow: pivot at the nock, pointing −Z.
    { const x = 60;
      bones.push(['arrow', null, [x, 0, 0]]);
      cubes.push(box('arrow_shaft', 'arrow', [x - .4, -.4, -17], [x + .4, .4, 0], 'arrowShaft'),
        box('arrow_nock', 'arrow', [x - .5, -.5, -.3], [x + .5, .5, .5], 'woodDark'),
        box('arrow_head', 'arrow', [x - 1, -.25, -19.5], [x + 1, .25, -17], 'steel'),
        box('arrow_point', 'arrow', [x - .45, -.25, -20.6], [x + .45, .25, -19.5], 'steel'),
        box('arrow_vane_v', 'arrow', [x - .1, -1.3, -4.6], [x + .1, 1.3, -.9], 'fletchRed'),
        box('arrow_vane_h', 'arrow', [x - 1.3, -.1, -4.6], [x + 1.3, .1, -.9], 'fletching'));
    }
    // Round shield of planks: pivot at the handle behind it, the face looks −Z. An octagon of planks
    // with an iron rim, an iron boss and the plunderers' red band painted across.
    { const x = 78, t = 1.2, R = 9;
      bones.push(['shield', null, [x, 0, 0]]);
      const band = { face: 'north', palette: { r: '#7a2626', d: '#521818' }, x: 0, y: 0, map: Array.from({ length: 14 }, (_, y) => Array.from({ length: 14 }, (_, k) => Math.abs(k - y) < 2 ? (k === y ? 'd' : 'r') : '.').join('')) };
      const seams = { face: 'north', palette: { s: '#3e2b1f' }, x: 0, y: 0, map: Array.from({ length: 14 }, () => '...s...s...s..') };
      cubes.push(box('shield_core', 'shield', [x - 7, -7, -t], [x + 7, 7, 0], 'woodLight', { decals: [seams, band] }));
      for (const [n, dx, dy, w, h] of [['top', 0, 8, 12, 2], ['bottom', 0, -8, 12, 2], ['left', -8, 0, 2, 12], ['right', 8, 0, 2, 12]])
        cubes.push(box(`shield_${n}`, 'shield', [x + dx - w / 2, dy - h / 2, -t], [x + dx + w / 2, dy + h / 2, 0], 'woodLight'));
      for (const [k, sx, sy] of [[0, 1, 1], [1, -1, 1], [2, 1, -1], [3, -1, -1]])
        cubes.push(box(`shield_corner${k}`, 'shield', [x + sx * 5.6 - 2.2, sy * 5.6 - 2.2, -t], [x + sx * 5.6 + 2.2, sy * 5.6 + 2.2, 0], 'woodLight', { origin: [x + sx * 5.6, sy * 5.6, 0], rotation: [0, 0, 45] }));
      // Iron rim along the eight edges, standing a little proud of the face.
      for (let k = 0; k < 8; k++) {
        const a = k * 45, rad = a * Math.PI / 180, cx = x + Math.sin(rad) * R, cy = Math.cos(rad) * R;
        cubes.push(box(`shield_rim${k}`, 'shield', [cx - 3.8, cy - .5, -t - .3], [cx + 3.8, cy + .5, .2], 'ironDark', { origin: [cx, cy, 0], rotation: [0, 0, -a] }));
      }
      cubes.push(box('shield_boss', 'shield', [x - 2, -2, -t - 1.4], [x + 2, 2, -t], 'iron'),
        box('shield_boss_cap', 'shield', [x - 1.2, -1.2, -t - 2], [x + 1.2, 1.2, -t - 1.4], 'iron'),
        box('shield_handle', 'shield', [x - 2.5, -.6, 0], [x + 2.5, .6, 1.4], 'leatherDark'),
        box('shield_strap', 'shield', [x - .6, -4, 0], [x + .6, 4, .5], 'leather'));
    }
    // A hedge-witch's staff: crooked ash in three pieces, leather wraps at the grip, a glowing ember held
    // in a fork of black iron. Pivot at the grip.
    { const x = 98;
      bones.push(['staff', null, [x, 0, 0]]);
      cubes.push(box('staff_low', 'staff', [x - .7, -14, -.7], [x + .7, 1, .7], 'wood', { origin: [x, -6, 0], rotation: [0, 0, 3] }),
        box('staff_mid', 'staff', [x - .65, 0, -.65], [x + .65, 13, .65], 'wood', { origin: [x, 0, 0], rotation: [2, 0, -4] }),
        box('staff_top', 'staff', [x - .9, 12.5, -.6], [x + .3, 19, .6], 'wood', { origin: [x, 12.5, 0], rotation: [0, 0, 7] }),
        box('staff_wrap', 'staff', [x - 1, -2, -1], [x + 1, 2, 1], 'leatherDark'),
        box('staff_wrap2', 'staff', [x - .9, 9, -.9], [x + .9, 10, .9], 'leather'));
      for (const side of [-1, 1]) cubes.push(box(`staff_prong${side}`, 'staff', [x + side * 1.3 - .3, 18.5, -.3], [x + side * 1.3 + .3, 22.5, .3], 'ironDark', { origin: [x + side * 1.3, 18.5, 0], rotation: [0, 0, side * -12] }));
      cubes.push(box('staff_ember', 'staff', [x - 1.1, 19.6, -1.1], [x + 1.1, 21.8, 1.1], 'ember', { origin: [x, 20.7, 0], rotation: [0, 45, 0] }));
    }
    return { name: 'weapons', bones, cubes, materials: MATERIALS, atlasWidth: 128 };
  }

  return {
    wanderer: () => humanoid({ name: 'wanderer', hair: 'hairAuburn', hairColor: '#53301f', browColor: '#3e2418', beardColor: '#53301f', beard: 'short',
      top: 'clothBlue', vest: 'leather', bracers: 'leather', tunicSkirt: 'clothBlue', cape: 'clothBlue', collar: 'clothLinen', brooch: true, scabbard: true, shoulderStrap: true }),
    elder: () => humanoid({ name: 'elder', skin: 'skinPale', hair: 'hairSilver', hairColor: '#8a877f', browColor: '#a5a299', eyes: '#3b5566', fringe: false, longHair: true, braid: true,
      top: 'clothCrimson', robe: 'clothCrimson', robeTrim: 'brass', shawl: 'clothLinen', cape: 'clothCrimson', pendant: true, noPouch: true, boots: 'leatherDark' }),
    smith: () => humanoid({ name: 'smith', build: 'strong', skin: 'skinTan', hair: 'hairDark', hairColor: '#251e19', beard: 'full', beardColor: '#251e19', fringe: false,
      top: 'clothShirt', rolled: true, apron: true }),
    ranger: () => humanoid({ name: 'ranger', hair: 'hairBlond', hairColor: '#735932', beard: 'short', beardColor: '#735932',
      top: 'clothGreen', hood: 'clothGreen', leatherArmor: 'leather', bracers: 'leatherDark', quiver: true, tunicSkirt: 'clothGreen', shoulderStrap: true }),
    bandit: () => humanoid({ name: 'bandit', skin: 'skinTan', hair: 'hairDark', hairColor: '#251e19', scar: true,
      top: 'clothGrey', leatherArmor: 'leatherDark', headband: 'clothCrimson', mask: 'clothGrey', bracers: 'leatherDark', tunicSkirt: 'clothGrey', scabbard: true }),
    captain: () => humanoid({ name: 'captain', build: 'strong', hair: 'hairDark', top: 'clothCrimson', plate: 'darkSteel', helmet: 'darkSteel', tabard: 'clothCrimson', cape: 'clothCrimson', noPouch: true, boots: 'boot' }),
    wolf, weapons, deer, fox, hare, crow, props, trees,
  };
}

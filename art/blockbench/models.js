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
    // Trees of the new regions. `image` materials are pictures by Codex (art/textures/codex); until a picture is there they paint
    // from their ramp in the `fallback` style, so a model always builds.
    barkRedwood: { style: 'image', sat: .85, gain: .88, image: 'bark_redwood', fallback: 'bark', ramp: ['#3a1a12', '#522818', '#6a3a22', '#80502f', '#946a44'] },
    barkWillow: { style: 'image', sat: .85, gain: .9, image: 'bark_willow', fallback: 'bark', ramp: ['#2e2a24', '#443d34', '#58504a', '#6c645a', '#80786c'] },
    barkAcacia: { style: 'image', sat: .85, gain: .9, image: 'bark_acacia', fallback: 'bark', ramp: ['#1e1814', '#2c231c', '#3a2e24', '#493a2d', '#5a4838'] },
    barkCharred: { style: 'image', sat: .8, gain: .95, image: 'bark_charred', fallback: 'bark', ramp: ['#0e0c0b', '#171412', '#221d1a', '#2e2823', '#3d352e'] },
    barkPalm: { style: 'image', sat: .7, gain: .85, image: 'bark_palm', fallback: 'bark', ramp: ['#5c4a30', '#74603e', '#8c7650', '#a08a60', '#b49c70'] },
    cactusSkin: { style: 'image', sat: .62, gain: .78, image: 'cactus_skin', fallback: 'bark', ramp: ['#2c4a2a', '#385c34', '#446e3e', '#528048', '#629256'] },
    barkCypress: { style: 'image', sat: .8, gain: .9, image: 'bark_cypress', fallback: 'bark', ramp: ['#3e342c', '#52463a', '#665848', '#7a6a58', '#8e7e68'] },
    barkHeath: { style: 'image', sat: .62, gain: .8, image: 'bark_heath', fallback: 'bark', ramp: ['#4a2c18', '#62381e', '#7a4824', '#92592c', '#a86c38'] },
    leavesRedwood: { style: 'image', sat: .8, gain: .85, image: 'leaves_redwood', fallback: 'leaves', clump: 1, holes: .1, ramp: ['#16282a', '#1e3633', '#28443c', '#335246', '#3f6050', '#4c6e5a'] },
    leavesWillow: { style: 'image', sat: .62, gain: .78, image: 'leaves_willow', fallback: 'leaves', holes: .55, ramp: ['#3a4a1e', '#4a5c26', '#5c7030', '#70853a', '#869c46', '#9cb256'] },
    leavesAcacia: { style: 'image', sat: .7, gain: .82, image: 'leaves_acacia', fallback: 'leaves', clump: 1, holes: .25, ramp: ['#3a4620', '#4c5a28', '#5e6e30', '#738338', '#8a9944', '#a0ae52'] },
    leavesPalm: { style: 'image', sat: .68, gain: .82, image: 'leaves_palm', fallback: 'leaves', clump: 1, holes: .2, ramp: ['#24401e', '#2e5224', '#3a652c', '#487836', '#588c42', '#6aa050'] },
    leavesCypress: { style: 'image', sat: .8, gain: .85, image: 'leaves_cypress', fallback: 'leaves', clump: 1, holes: .1, ramp: ['#14281c', '#1c3624', '#25442c', '#305236', '#3c6040', '#486e4a'] },
    leavesOlive: { style: 'image', sat: .75, gain: .85, image: 'leaves_olive', fallback: 'leaves', clump: 1, holes: .2, ramp: ['#3e4a30', '#4e5c3c', '#606e4a', '#748258', '#8a966a', '#a0aa7c'] },
    leavesOliveHeart: { style: 'leaves', ramp: ['#2a3224', '#343e2c', '#3e4a34', '#48563c'], holes: .03 },
    // Plants, mushrooms and the stone and wood of the wild points of interest.
    plantHeather: { style: 'image', fit: true, sat: .5, gain: .78, image: 'plant_heather_bloom', fallback: 'leaves', ramp: ['#3a2a52', '#563a74', '#72508e', '#8c68a6', '#a684be', '#bea0d2'] },
    plantPampas: { style: 'image', fit: true, sat: .7, gain: .85, image: 'plant_pampas', fallback: 'leaves', ramp: ['#7a704a', '#968a5c', '#b2a470', '#cabc88', '#dcd0a0', '#ece4bc'] },
    plantDryShrub: { style: 'image', fit: true, sat: .62, gain: .82, image: 'plant_dry_shrub', fallback: 'leaves', ramp: ['#4a3a24', '#5e4a2c', '#745c36', '#8a7042', '#a08850', '#b8a05e'] },
    mushCardRed: { style: 'image', fit: true, sat: .8, gain: .85, image: 'mushroom_red', fallback: 'leaves', ramp: ['#5a1a16', '#7a2420', '#962e28', '#b0443a', '#d8d0bc', '#ece4d0'] },
    mushCardBrown: { style: 'image', fit: true, sat: .8, gain: .85, image: 'mushroom_brown', fallback: 'leaves', ramp: ['#2e1e14', '#442d1e', '#5c3e2a', '#785238', '#947050', '#b08c68'] },
    mushCardGlow: { style: 'image', fit: true, sat: .7, gain: .95, image: 'mushroom_glow', fallback: 'leaves', ramp: ['#1c4a46', '#26645e', '#3a8478', '#58a898', '#82c8b8', '#b0e4d4'] },
    mushStem: { style: 'flat', ramp: ['#b8ac94', '#cdc2aa', '#ddd3bc'] }, mushRed: { style: 'flat', ramp: ['#5a1c18', '#6e231e', '#82291f'] },
    mushBrown: { style: 'flat', ramp: ['#3e2a1e', '#503828', '#624632'] }, mushGlow: { style: 'glow', ramp: ['#2c7c72', '#3e9a8a', '#5cb8a4'], unshaded: true },
    mushGlowStem: { style: 'flat', ramp: ['#7a9a94', '#94b4ac', '#aecac2'] },
    agaveLeaf: { style: 'flat', ramp: ['#3a5c52', '#486e62', '#588274'] }, agaveBloom: { style: 'flat', ramp: ['#8a7226', '#a08a30', '#b6a040'] },
    fernFrond: { style: 'leaves', clump: 1, holes: .08, ramp: ['#2c4a20', '#38602a', '#447434', '#52883e', '#629c4a', '#74b058'] },
    sandstone: { style: 'fur', ramp: ['#9c8258', '#b09468', '#c4a87a', '#d4ba8c'] }, sandstoneDark: { style: 'fur', ramp: ['#6a5638', '#7a6644', '#8c7650', '#a08a60'] },
    obsidian: { style: 'metal', ramp: ['#0e0c12', '#16131c', '#201c2a', '#2c2638', '#3a3248'] }, basalt: { style: 'fur', ramp: ['#1e1e22', '#2a2a2e', '#34343a', '#3e3e46'] },
    bone: { style: 'fur', ramp: ['#a89c84', '#bcb098', '#cfc4ac', '#e0d6c0'] }, boneDark: { style: 'fur', ramp: ['#7c705a', '#8c8068', '#a09478', '#b4a88c'] },
    graniteStone: { style: 'fur', ramp: ['#5a5a58', '#6c6c68', '#7e7e7a', '#90908a'] }, mossGreen: { style: 'fur', ramp: ['#2e4a22', '#3a5c2a', '#486e32', '#58823c'] },
    canvas: { style: 'cloth', ramp: ['#8a7e66', '#a09478', '#b4a88a', '#c6bc9e'] }, canvasRed: { style: 'cloth', ramp: ['#6a2a22', '#823428', '#9a4030', '#b05038'] },
    jadeStone: { style: 'fur', ramp: ['#3a5a4a', '#4a7060', '#5c8672', '#70a088'] }, jadeRoof: { style: 'fur', ramp: ['#1c3c3c', '#264c4a', '#325c58', '#406e68'] },
    turf: { style: 'fur', ramp: ['#4c4a2c', '#5a5832', '#6a673a', '#7c7842'] },
    charcoal: { style: 'fur', ramp: ['#0c0a09', '#161311', '#201c19', '#2c2723'] },
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
        // A collar round the foot of the trunk, sunk deep: on a slope the downhill side never shows a gap.
        foot(w, mat) {
          const top = (s, hi) => cubes.push(box(`${name}_root${n++}`, name, at([-s / 2, -18, -s / 2]), at([s / 2, hi, s / 2]), mat, { origin: at([0, 0, 0]), rotation: [0, r() * 90, 0] }));
          top(w, 2); top(w - 5, 6);
        },
        // A root flare: a low box from the trunk axis outward, its outer end dipping into the ground.
        root(len, wide, high, yaw, mat) { cubes.push(box(`${name}_root${n++}`, name, at([-wide / 2, -3, 0]), at([wide / 2, high, len]), mat, { origin: at([0, 0, 0]), rotation: [9 + r() * 6, yaw, 0] })); },
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
      buttress(t, 6, o.trunk, 'barkMoss'); t.foot(o.trunk + 6, 'barkMoss');
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
      buttress(t, 4, 7, 'birchBark'); t.foot(11, 'birchBark');
      let w = 7;
      for (const [len, tilt] of o.segments) { trunk.push(t.limb(trunk[trunk.length - 1], len, w, tilt, r() * 360, 'birchBark')); w = Math.max(4, w - 1); }
      const ends = [.5, .6, .7, .8, .9, 1].map(f => along(trunk, f));
      crown(t, { clumps: 20, floor: -.65, R: o.R, Ry: o.Ry, leaf: 18, lobes: .8, hang: true, heart: o.heart }, along(trunk, .8), () => o.leaves, ends, 'birchBark');
    };
    // Spruce: a broad cone of drooping boughs, tier on tier, each tier turned against the last.
    const spruce = (t, o) => {
      const { r } = t;
      buttress(t, 5, 8, 'barkPine'); t.foot(12, 'barkPine');
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
      buttress(t, 5, 9, 'barkPine'); t.foot(13, 'barkPine');
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
    const dead = (t, wood = 'barkGrey') => {
      const { r } = t, trunk = [[0, 0, 0]];
      buttress(t, 5, 10, wood); t.foot(14, wood);
      [[26, 5], [22, 9], [18, 12], [12, 16]].forEach(([len, tilt], k) => trunk.push(t.limb(trunk[k], len, 10 - k * 2, tilt, k * 70 + r() * 40, wood)));
      for (let k = 0; k < 5; k++) {
        const base = along(trunk, .42 + k * .12), yaw = k * 137.5 + r() * 30, tilt = 45 + r() * 30;
        const tip = t.limb(base, 16 + r() * 12, k < 2 ? 4 : 3, tilt, yaw, wood);
        for (let j = 0; j < 1 + (k % 2); j++) t.limb(tip.map((v, i) => v + (base[i] - v) * .25), 8 + r() * 5, 2, tilt - 25 + r() * 20, yaw + (j ? 40 : -40), wood);
      }
    };
    const bush = (t, mat) => {
      for (let k = 0; k < 3; k++) t.limb([0, 0, 0], 7, 2, 30 + t.r() * 30, k * 120, 'bark');
      crown(t, { clumps: 12, floor: -.5, R: 13, Ry: 9, leaf: 14, lobes: .6, heart: 'leavesHeart', twigs: false }, [0, 9, 0], () => mat, [[0, 2, 0]]);
    };
    // ── Roots and forks. A buttress is a flare of low boxes running out from the trunk, some splitting in two; the game bends
    // them over the ground under each tree, so on a slope the uphill roots climb and the downhill ones grip the drop.
    function buttress(t, count, trunkW, mat) {
      const { r } = t;
      for (let k = 0; k < count; k++) {
        const yaw = (k + r() * .6) * 360 / count, len = trunkW * .5 + 8 + r() * 10, wide = Math.max(3, Math.round(trunkW * .34 + r() * 2)), high = Math.max(3, Math.round(trunkW * .28));
        t.root(len, wide, high, yaw, mat);
        if (trunkW >= 9 && r() < .75) t.root(len * 1.55, Math.max(2, wide - 3), Math.max(2, high - 3), yaw + (r() < .5 ? -1 : 1) * (14 + r() * 20), mat);
      }
    }
    // A limb that forks: every tip is returned, so a crown can hang off the real ends of the wood instead of floating over it.
    function ramify(t, from, yaw, tilt, len, thick, depth, mat, tips) {
      const { r } = t, tip = t.limb(from, len, thick, tilt, yaw, mat);
      if (depth <= 0) { tips.push(tip); return; }
      const forks = 2 + (r() < .35 ? 1 : 0);
      for (let k = 0; k < forks; k++) {
        const base = from.map((v, i) => v + (tip[i] - v) * (k ? .72 : 1));
        ramify(t, base, yaw + (k - (forks - 1) / 2) * (40 + r() * 34), Math.min(88, tilt + 6 + r() * 22), len * (.6 + r() * .16), Math.max(2, thick - 2), depth - 1, mat, tips);
      }
    }
    // A grand broadleaf: buttress roots, a tapering trunk, limbs leaving it at different heights in a spiral, each forking, a
    // crown clumped on the ends of that wood.
    const grand = (t, o) => {
      const { r } = t, leaf = () => o.leaves[Math.floor(r() * o.leaves.length)], bark = o.bark || 'barkMoss', pts = [[0, 0, 0]], tips = [];
      buttress(t, o.roots ?? 7, o.trunk, bark); t.foot(o.trunk + 8, bark);
      let w = o.trunk;
      for (const [len, tilt] of o.segments) { pts.push(t.limb(pts[pts.length - 1], len, w, tilt, r() * 360, w === o.trunk ? bark : (o.wood || 'bark'))); w = Math.max(5, w - 3); }
      for (let k = 0; k < o.limbs; k++) ramify(t, along(pts, .42 + .55 * k / o.limbs), k * 137.5 + r() * 30, 34 + r() * 26, o.reach * (.8 + r() * .35), 5, 1, o.wood || 'bark', tips);
      const top = pts[pts.length - 1], centre = [top[0], top[1] + o.Ry * .42, top[2]];
      tips.push(limbTo(t, top, [centre[0], centre[1] + o.Ry * .35, centre[2]], 5, o.wood || 'bark'));
      crown(t, o, centre, leaf, tips, o.wood || 'bark');
    };
    // Redwood: a giant. A buttressed trunk with a bare lower half and dead stubs, then tiers of broad spray, narrowing to a spire.
    const redwood = (t, o) => {
      const { r } = t, trunk = [[0, 0, 0]];
      buttress(t, 9, 24, 'barkRedwood'); t.foot(32, 'barkRedwood');
      let w = 24;
      o.segments.forEach(([len, tilt], k) => { trunk.push(t.limb(trunk[k], len, w, tilt, r() * 360, 'barkRedwood')); w = Math.max(8, w - 4); });
      for (let k = 0; k < 7; k++) t.limb(along(trunk, .1 + k * .055), 5 + r() * 5, 2, 72 + r() * 18, r() * 360, 'barkRedwood');
      for (let k = 0; k < o.tiers; k++) {
        const f = k / (o.tiers - 1), c = along(trunk, o.crown + f * (.97 - o.crown)), R = o.radius * (1 - f * .82) + 8, turn = k * 47 + r() * 30;
        for (let j = 0; j < 4; j++) t.bough(c, R * (.8 + r() * .4), Math.max(8, 18 - f * 10), 6, 10 + r() * 14 - f * 6, turn + j * 90 + r() * 20, 'leavesRedwood');
        t.leaf([c[0], c[1] + 2, c[2]], R * .9, 8, 'leavesRedwood', { yaw: (k % 2) * 45 });
      }
      const top = trunk[trunk.length - 1];
      t.leaf([top[0], top[1] + 8, top[2]], 6, 24, 'leavesRedwood', { yaw: 0 });
    };
    // Willow: a short thick trunk, a low spreading dome and long strands hanging from it almost to the ground.
    const willow = (t, o) => {
      const { r } = t, trunk = [[0, 0, 0]], tips = [];
      buttress(t, 7, 14, 'barkWillow'); t.foot(20, 'barkWillow');
      [[22, 4], [20, 9], [14, 13]].forEach(([len, tilt], k) => trunk.push(t.limb(trunk[k], len, 14 - k * 3, tilt, r() * 360, 'barkWillow')));
      const top = trunk[3];
      for (let k = 0; k < 7; k++) ramify(t, [top[0], top[1] - 6 - r() * 6, top[2]], k * 51 + r() * 30, 52 + r() * 20, 22 + r() * 8, 5, 1, 'barkWillow', tips);
      crown(t, { clumps: 12, floor: -.05, R: o.R * .85, Ry: 18, leaf: 20, lobes: .3, heart: 'leavesHeart' }, [top[0], top[1] + 14, top[2]], () => 'leavesWillow', tips, 'barkWillow');
      // Long thin curtains hanging from the rim of the dome, two rings of them, nearly to the ground.
      for (let k = 0; k < 46; k++) { const a = k * 2.399 + r() * .4, d = o.R * (.3 + (k % 2 ? .45 : .7) * (.7 + r() * .3)), len = o.strand * (.75 + r() * .4); t.leaf([top[0] + Math.cos(a) * d, top[1] + 12 - len / 2, top[2] + Math.sin(a) * d], 4, len, 'leavesWillow', { tilt: 6 }); }
    };
    // Acacia: a thin trunk forking into a few limbs, each carrying a wide flat pad of leaf: the silhouette of the dry lands.
    const acacia = (t, o) => {
      const { r } = t, tips = [];
      buttress(t, 5, 9, 'barkAcacia'); t.foot(13, 'barkAcacia');
      const fork = t.limb([0, 0, 0], o.trunk, 9, 3 + r() * 5, r() * 360, 'barkAcacia');
      for (let k = 0; k < 3; k++) ramify(t, fork, k * 120 + r() * 40, 38 + r() * 14, o.reach, 6, 1, 'barkAcacia', tips);
      tips.forEach((tip, k) => t.leaf([tip[0], tip[1] + 5, tip[2]], o.R * (.55 + r() * .25), 8, 'leavesAcacia', { tilt: 6 }));
      t.leaf([fork[0], fork[1] + 18, fork[2]], o.R * 1.1, 9, 'leavesAcacia', { tilt: 4 });
    };
    // Palm: a curved trunk ringed with old leaf scars and a ring of long fronds that arch and droop.
    const palm = (t, o) => {
      const { r } = t, yaw = r() * 360;
      buttress(t, 5, 9, 'barkPalm'); t.foot(13, 'barkPalm');
      let p = [0, 0, 0];
      for (let k = 0; k < o.segments; k++) p = t.limb(p, 24, Math.max(6, 9 - k * .5), 3 + k * o.bend, yaw + (r() - .5) * 8, 'barkPalm');
      for (let j = 0; j < 11; j++) t.bough([p[0], p[1] - 2, p[2]], 44 + r() * 16, 12, 3, 4 + (j % 3) * 20 + r() * 10, j * 32.7 + r() * 8, 'leavesPalm');
      for (let k = 0; k < 3; k++) t.leaf([p[0] + (r() - .5) * 8, p[1] - 6, p[2] + (r() - .5) * 8], 6, 7, 'barkAcacia', { tilt: 10 });
    };
    // Cypress: a dark spindle of foliage, wide in the middle, close to the trunk.
    const cypress = (t, o) => {
      const { r } = t;
      buttress(t, 5, 7, 'barkCypress'); t.foot(10, 'barkCypress');
      t.limb([0, 0, 0], o.height - 16, 7, 0, 0, 'barkCypress');
      const levels = Math.round(o.height / 13);
      for (let k = 0; k < levels; k++) {
        const f = k / (levels - 1), rr = o.R * Math.sin(Math.PI * Math.min(1, .1 + f * .9)) * (1 - f * .35) + 3, a = k * 2.4;
        for (let j = 0; j < 2; j++) t.leaf([Math.cos(a + j * 3.1) * rr * .45, 10 + f * (o.height - 18), Math.sin(a + j * 3.1) * rr * .45], rr * 1.5 + 8, 14, 'leavesCypress', { tilt: 10 });
      }
      t.leaf([0, o.height - 4, 0], 6, 14, 'leavesCypress', { yaw: 0 });
    };
    // Scrub pine of the moor: bent by the wind, a leaning twisted trunk and a flat, one-sided crown.
    const heath = (t, o) => {
      const { r } = t, lean = r() * 360, pts = [[0, 0, 0]], tips = [];
      buttress(t, 6, 10, 'barkHeath'); t.foot(15, 'barkHeath');
      [[22, 10], [24, 16], [20, 22]].forEach(([len, tilt], k) => pts.push(t.limb(pts[k], len, 10 - k * 2, tilt, lean + (r() - .5) * 50, 'barkHeath')));
      for (let k = 0; k < 4; k++) ramify(t, along(pts, .5 + k * .14), lean + (k - 1.5) * 38 + r() * 20, 50 + r() * 25, o.reach, 4, 1, 'barkHeath', tips);
      tips.forEach(tip => { t.leaf([tip[0], tip[1] + 3, tip[2]], o.R * (.6 + r() * .4), 10, 'needlesPine', { tilt: 14 }); });
      const top = pts[pts.length - 1];
      t.leaf([top[0], top[1] + 6, top[2]], o.R, 12, 'needlesPine', { tilt: 10 });
    };
    // Mangrove: the trunk stands on a cage of arched stilt roots, with a round crown above.
    const mangrove = (t, o) => {
      const { r } = t, tips = [];
      const top = t.limb([0, 14, 0], 34, 9, 3, r() * 360, 'barkWillow');
      for (let k = 0; k < 10; k++) { const a = k * 36 + r() * 26, d = 22 + r() * 18; limbTo(t, [0, 16 + r() * 16, 0], [Math.cos(a * rad) * d, -4, Math.sin(a * rad) * d], 3, 'barkWillow'); }
      for (let k = 0; k < 4; k++) ramify(t, [top[0], top[1] - 8, top[2]], k * 90 + r() * 30, 44, 20, 4, 1, 'barkWillow', tips);
      crown(t, { clumps: 18, floor: -.2, R: o.R, Ry: 24, leaf: 22, lobes: .5, heart: 'leavesHeart' }, [top[0], top[1] + 8, top[2]], () => 'leavesBush', tips, 'barkWillow');
    };
    // Cacti: stacked boxes of ribbed green, no leaves. The game keeps them upright and still (no sway).
    const saguaro = t => {
      const { r } = t;
      t.limb([0, 0, 0], 74, 10, 0, 0, 'cactusSkin');
      for (const [side, y, up] of [[1, 28, 26], [-1, 40, 20]]) {
        const elbow = t.limb([0, y, 0], 16, 7, 90, side > 0 ? 90 : 270, 'cactusSkin');
        t.limb(elbow, up + r() * 6, 7, 0, 0, 'cactusSkin');
      }
    };
    const barrel = t => {
      const { r } = t;
      t.limb([0, 0, 0], 17, 16, 0, 0, 'cactusSkin'); t.limb([0, 14, 0], 6, 11, 0, 0, 'cactusSkin');
      t.limb([0, 20, 0], 4, 5, 0, 0, 'cactusSkin');
    };
    const pear = t => {
      const { r } = t, pads = [[0, 0, 0]];
      for (let k = 0; k < 5; k++) {
        const base = pads[Math.floor(r() * pads.length)], tip = t.limb(base, 14, 12, 18 + r() * 40, r() * 360, 'cactusSkin');
        pads.push(tip);
      }
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
    tree('dead_2', 131, t => dead(t));
    // More variants of the old species (the same species, other limbs): a wood of oaks no longer shows the same tree twice.
    const GRAND = { ...CROWN, trunk: 16, segments: [[30, 3], [28, 4], [18, 5]], limbs: 6, reach: 44, R: 56, Ry: 46, leaf: 28, clumps: 32 };
    tree('oak_4', 139, t => grand(t, { ...OAK, ...GRAND }));
    tree('oak_5', 149, t => grand(t, { ...OAK, ...GRAND, trunk: 14, segments: [[34, 4], [26, 6], [14, 8]], limbs: 5, reach: 40, R: 48, Ry: 50, leaf: 26 }));
    tree('oak_6', 157, t => grand(t, { ...OAK, ...GRAND, trunk: 18, segments: [[24, 2], [22, 3], [12, 5]], limbs: 7, reach: 50, R: 62, Ry: 40, clumps: 36 }));
    tree('autumn_3', 163, t => grand(t, { ...AUTUMN, ...GRAND, trunk: 15, limbs: 6 }));
    tree('maple_3', 167, t => grand(t, { ...MAPLE, ...GRAND, trunk: 14, segments: [[22, 3], [18, 5], [10, 6]], R: 52, Ry: 40, leaf: 26 }));
    tree('birch_3', 173, t => birch(t, { segments: [[32, 3], [30, 4], [26, 4], [22, 5]], R: 19, Ry: 40 }));
    tree('spruce_3', 179, t => spruce(t, { height: 140, base: 24, radius: 38, tiers: 11, needles: 'needlesSpruce' }));
    tree('pine_3', 181, t => fir(t, { crown: .28, tiers: 11, radius: 28, needles: 'needlesPine' }));
    tree('pine_snow_3', 181, t => fir(t, { crown: .28, tiers: 11, radius: 28, needles: 'needlesPine', snow: { up: 'snowCap' } }));
    // The new regions.
    tree('redwood_1', 191, t => redwood(t, { segments: [[70, .6], [64, 1], [60, 1.4], [44, 2]], tiers: 11, crown: .34, radius: 46 }));
    tree('redwood_2', 193, t => redwood(t, { segments: [[76, .8], [70, 1.2], [64, 1.6], [46, 2.4]], tiers: 12, crown: .38, radius: 40 }));
    tree('willow_1', 197, t => willow(t, { R: 46, strand: 44 }));
    tree('willow_2', 199, t => willow(t, { R: 40, strand: 52 }));
    tree('acacia_1', 211, t => acacia(t, { trunk: 36, reach: 30, R: 58 }));
    tree('acacia_2', 223, t => acacia(t, { trunk: 44, reach: 34, R: 66 }));
    tree('palm_1', 227, t => palm(t, { segments: 5, bend: 3.6 }));
    tree('palm_2', 229, t => palm(t, { segments: 6, bend: 3 }));
    tree('cypress_1', 233, t => cypress(t, { height: 150, R: 16 }));
    tree('cypress_2', 239, t => cypress(t, { height: 180, R: 14 }));
    tree('heath_1', 257, t => heath(t, { reach: 24, R: 28 }));
    tree('heath_2', 263, t => heath(t, { reach: 28, R: 24 }));
    tree('olive_1', 283, t => grand(t, { leaves: ['leavesOlive'], heart: 'leavesOliveHeart', ...GRAND, trunk: 16, segments: [[14, 8], [14, 10], [10, 12]], limbs: 7, reach: 34, R: 40, Ry: 26, leaf: 20, bark: 'barkGrey', wood: 'barkGrey', roots: 5 }));
    tree('olive_2', 293, t => grand(t, { leaves: ['leavesOlive'], heart: 'leavesOliveHeart', ...GRAND, trunk: 18, segments: [[12, 10], [12, 12], [10, 14]], limbs: 8, reach: 30, R: 36, Ry: 24, leaf: 20, bark: 'barkGrey', wood: 'barkGrey', roots: 5 }));
    tree('charred_1', 307, t => dead(t, 'barkCharred'));
    tree('charred_2', 311, t => dead(t, 'barkCharred'));
    tree('cactus_1', 313, saguaro); tree('cactus_2', 317, barrel); tree('cactus_3', 331, pear);
    tree('mangrove_1', 337, t => mangrove(t, { R: 34 }));
    tree('mangrove_2', 347, t => mangrove(t, { R: 30 }));
    tree('bush_1', 101, t => bush(t, 'leavesBush'));
    tree('bush_2', 103, t => bush(t, 'leavesBerry'));
    return { name: 'trees', bones, cubes, materials: MATERIALS, atlasWidth: 512 };
  }

  // ── Plants of the landform regions (src/world/props.js › placePlant). Each top-level bone is one plant, the pivot is its foot on the ground.
  // Cards (flat boxes one texel thick) carry pictures made by Codex; mushrooms, agaves and ferns are built from boxes.
  function plants() {
    const bones = [], cubes = [];
    let slot = 0;
    const rng = s => () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    function plant(name, seed) {
      const x = slot, r = rng(seed); slot += 90; bones.push([name, null, [x, 0, 0]]);
      let n = 0;
      const put = (tag, from, to, mat, extra = {}) => cubes.push(box(`${name}_${tag}${n++}`, name, [from[0] + x, from[1], from[2]], [to[0] + x, to[1], to[2]], mat,
        { ...extra, origin: extra.origin ? [extra.origin[0] + x, extra.origin[1], extra.origin[2]] : undefined }));
      // A card: a picture standing on its foot, turned `yaw` about the vertical and leaning `tilt`.
      const card = (c, w, h, mat, yaw, tilt = 0) => put('card', [c[0] - w / 2, c[1], c[2] - .5], [c[0] + w / 2, c[1] + h, c[2] + .5], mat, { origin: [c[0], c[1], c[2]], rotation: [tilt, yaw, 0], hide: ['up', 'down', 'east', 'west'] });
      // A clump: `count` cards at random spots in a patch, each turned and leaning a little.
      const clump = (mat, count, w, h, spread) => { for (let k = 0; k < count; k++) { const a = r() * 6.283, d = r() * spread; card([Math.cos(a) * d, -1, Math.sin(a) * d], w * (.8 + r() * .4), h * (.8 + r() * .4), mat, k * 60 + r() * 40, (r() - .5) * 18); } };
      const mush = (cx, cz, h, capW, stem, cap, spots) => {
        put('stem', [cx - 1.5, -1, cz - 1.5], [cx + 1.5, h, cz + 1.5], stem);
        const dots = Array.from({ length: Math.round(capW) }, () => Array.from({ length: Math.round(capW) }, () => r() < spots ? 'W' : '.').join(''));
        put('cap', [cx - capW / 2, h - 1, cz - capW / 2], [cx + capW / 2, h + 2, cz + capW / 2], cap, { decals: spots ? [{ face: 'up', palette: { W: '#e8dec8' }, x: 0, y: 0, map: dots }] : undefined });
        put('crown', [cx - capW * .33, h + 2, cz - capW * .33], [cx + capW * .33, h + 4, cz + capW * .33], cap);
      };
      return { put, card, clump, mush, r };
    }
    // Only what the old ground sprites are not: heather clumps, pampas (flowers, ferns and grass already come as sprites; the plants here are the 3D ones).
    const CLUMPS = [['heather_1', 3, 'plantHeather', 4, 26, 24, 9], ['heather_2', 5, 'plantHeather', 6, 22, 20, 14], ['pampas_1', 19, 'plantPampas', 3, 26, 34, 7], ['pampas_2', 23, 'plantPampas', 5, 24, 30, 12]];
    for (const [name, seed, mat, count, w, h, spread] of CLUMPS) plant(name, seed).clump(mat, count, w, h, spread);
    // Dry shrub: a tangle of cards over a few woody sticks.
    for (const [name, seed] of [['dry_shrub_1', 29], ['dry_shrub_2', 31]]) {
      const p = plant(name, seed);
      for (let k = 0; k < 5; k++) p.put('stick', [-.7, 0, -.7], [.7, 10 + p.r() * 8, .7], 'barkAcacia', { origin: [0, 0, 0], rotation: [30 + p.r() * 40, k * 72 + p.r() * 30, 0] });
      p.clump('plantDryShrub', 3, 26, 26, 4);
    }
    // Agave: a rosette of thick leaves; the second one is in flower, on a tall stalk.
    for (const [name, seed, tall] of [['agave_1', 37, false], ['agave_2', 41, true]]) {
      const p = plant(name, seed);
      for (let k = 0; k < 11; k++) { const len = 18 + p.r() * 8, tilt = 18 + (k % 3) * 22 + p.r() * 8; p.put('leaf', [-2.5, 0, -1], [2.5, len, 1], 'agaveLeaf', { origin: [0, 1, 0], rotation: [tilt, k * 32.7 + p.r() * 10, 0] }); }
      p.put('heart', [-3, 0, -3], [3, 8, 3], 'agaveLeaf');
      if (tall) { p.put('stalk', [-1, 6, -1], [1, 54, 1], 'barkPalm'); for (let k = 0; k < 5; k++) p.put('bloom', [-3, 38 + k * 3.4, -3], [3, 41 + k * 3.4, 3], 'agaveBloom', { origin: [0, 40, 0], rotation: [0, k * 40, 0] }); }
    }
    // Big fern: a rosette of arching fronds.
    for (const [name, seed, n] of [['fern_big_1', 43, 9], ['fern_big_2', 47, 12]]) {
      const p = plant(name, seed);
      for (let k = 0; k < n; k++) { const len = 20 + p.r() * 10, tilt = 36 + p.r() * 34; p.put('frond', [-3.5, 0, -.5], [3.5, len, .5], 'fernFrond', { origin: [0, 1, 0], rotation: [tilt, k * 360 / n + p.r() * 20, 0], hide: ['east', 'west'] }); }
    }
    // Mushrooms: red toadstools with white spots, brown forest caps, pale glowing ones for caves and the deep wood; each with a card of its own kind behind.
    { const p = plant('mushroom_red_1', 53); p.mush(-5, 4, 9, 11, 'mushStem', 'mushRed', .22); p.mush(5, 2, 6, 8, 'mushStem', 'mushRed', .25); p.mush(0, -6, 5, 6, 'mushStem', 'mushRed', .3); }
    { const p = plant('mushroom_red_2', 59); p.mush(0, 0, 12, 14, 'mushStem', 'mushRed', .2); p.mush(8, 6, 6, 8, 'mushStem', 'mushRed', .25); p.mush(-7, 5, 4, 6, 'mushStem', 'mushRed', .3); }
    { const p = plant('mushroom_brown_1', 61); p.mush(-4, 3, 7, 9, 'mushStem', 'mushBrown', 0); p.mush(5, 1, 5, 7, 'mushStem', 'mushBrown', 0); }
    { const p = plant('mushroom_brown_2', 67); for (let k = 0; k < 5; k++) p.mush(Math.cos(k * 1.3) * 7, Math.sin(k * 1.3) * 7, 3 + p.r() * 5, 5 + p.r() * 4, 'mushStem', 'mushBrown', 0); }
    { const p = plant('mushroom_glow_1', 71); p.mush(-4, 2, 8, 10, 'mushGlowStem', 'mushGlow', 0); p.mush(5, 3, 5, 7, 'mushGlowStem', 'mushGlow', 0); p.mush(1, -5, 6, 8, 'mushGlowStem', 'mushGlow', 0); }
    return { name: 'plants', bones, cubes, materials: MATERIALS, atlasWidth: 256 };
  }

  // ── Points of interest of the wild regions (src/world/sites/wilds.js). Authored places of boxes; every one stands on a footing sunk into the
  // ground, so the terrain, which is flattened round it, takes it without a seam. Pivot: the middle of the footprint on the ground; front -z.
  function pois() {
    const bones = [], cubes = [];
    let slot = 0;
    const rng = s => () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    function poi(name, seed) {
      const x = slot, r = rng(seed); slot += 400; bones.push([name, null, [x, 0, 0]]);
      let n = 0;
      const put = (tag, from, to, mat, extra = {}) => cubes.push(box(`${name}_${tag}${n++}`, name, [from[0] + x, from[1], from[2]], [to[0] + x, to[1], to[2]], mat,
        { ...extra, origin: extra.origin ? [extra.origin[0] + x, extra.origin[1], extra.origin[2]] : undefined }));
      // A post / beam from `a` to `b` of square section `t` (any direction), as a box turned to lie along it.
      const beam = (a, b, t, mat) => {
        const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len = Math.hypot(...d), tilt = Math.acos(d[1] / len) * 180 / Math.PI, yaw = Math.atan2(d[0], d[2]) * 180 / Math.PI;
        put('beam', [a[0] - t / 2, a[1], a[2] - t / 2], [a[0] + t / 2, a[1] + len, a[2] + t / 2], mat, { origin: a, rotation: [tilt, yaw, 0] });
      };
      // A flat slab of ground under a place, sunk deep: the footing.
      const footing = (w, d, mat, depth = 20, up = -9) => put('footing', [-w / 2, -depth, -d / 2], [w / 2, up, d / 2], mat);
      return { put, beam, footing, r };
    }
    // 1. Verlassene Grube (Rotfelsen): a timber headframe over a shaft, a winch hut, an ore cart on rails.
    { const p = poi('mine_headframe', 101);
      p.footing(96, 96, 'sandstoneDark');
      p.put('pit', [-18, 1, -18], [18, 1.6, 18], 'obsidian');
      for (const [a, b] of [[[-22, 1, -22], [22, 6, -18]], [[-22, 1, 18], [22, 6, 22]], [[-22, 1, -18], [-18, 6, 18]], [[18, 1, -18], [22, 6, 18]]]) p.put('collar', a, b, 'woodDark');
      for (const z of [-17, 17]) { p.beam([-27, 0, z], [-4, 104, z], 7, 'woodDark'); p.beam([27, 0, z], [4, 104, z], 7, 'woodDark'); p.put('rungs', [-14, 40, z - 3], [14, 44, z + 3], 'woodLight'); p.put('rungs', [-21, 18, z - 3], [21, 22, z + 3], 'woodLight'); p.put('rungs', [-9, 70, z - 3], [9, 74, z + 3], 'woodLight'); }
      p.put('axle', [-6, 98, -20], [6, 106, 20], 'woodDark');
      for (const rot of [0, 45]) p.put('wheel', [-1.5, 88, -12], [1.5, 116, 12], 'ironDark', { origin: [0, 102, 0], rotation: [rot, 0, 0] });
      p.put('rope', [-.7, 2, -.7], [.7, 100, .7], 'hay');
      p.put('hut', [34, 0, -14], [70, 30, 18], 'woodLight'); p.put('hutroof', [32, 30, -16], [72, 34, 20], 'woodDark'); p.put('hutroof', [36, 34, -12], [68, 38, 16], 'woodDark');
      p.put('door', [33.5, 0, -7], [35, 20, 3], 'obsidian'); p.put('drum', [26, 8, -3], [34, 18, 7], 'barrelWood');
      p.put('rail', [-50, 1, 30], [50, 2.5, 32], 'rust'); p.put('rail', [-50, 1, 38], [50, 2.5, 40], 'rust');
      for (let k = 0; k < 11; k++) p.put('sleeper', [-48 + k * 9, .4, 28], [-44 + k * 9, 1.4, 42], 'woodDark');
      p.put('cart', [-40, 4, 27], [-14, 16, 43], 'ironDark'); p.put('ore', [-37, 16, 30], [-17, 19, 40], 'rust');
      for (const [wx, wz] of [[-37, 26], [-17, 26], [-37, 44], [-17, 44]]) p.put('cartwheel', [wx - 4, 0, wz - 1], [wx + 4, 8, wz + 1], 'ironDark', { origin: [wx, 4, wz] });
      p.put('lantern', [-3, 58, -21], [3, 68, -15], 'ember'); }
    // 2. Das Rippenfeld (Rotfelsen and the dunes): the bones of something huge, half buried: a spine, rib arches, a skull.
    { const p = poi('ribcage', 103);
      p.footing(40, 150, 'sandstone');
      p.put('spine', [-5, 14, -64], [5, 22, 56], 'bone'); for (let k = 0; k < 12; k++) p.put('vertebra', [-7, 12, -62 + k * 10], [7, 24, -57 + k * 10], 'boneDark');
      for (let k = 0; k < 9; k++) {
        const z = -54 + k * 11, s = 1 - Math.abs(k - 4) * .09;
        for (const side of [-1, 1]) {
          p.beam([side * 6, 20, z], [side * 30 * s, 52 * s, z + 2], 5, 'bone'); p.beam([side * 30 * s, 52 * s, z + 2], [side * 40 * s, 22, z + 5], 4.5, 'bone'); p.beam([side * 40 * s, 22, z + 5], [side * 38 * s, 0, z + 6], 3.5, 'boneDark');
        }
      }
      p.put('skull', [-18, 6, 64], [18, 40, 110], 'bone'); p.put('snout', [-11, 6, 108], [11, 24, 134], 'bone'); p.put('jaw', [-12, 0, 84], [12, 8, 134], 'boneDark');
      for (const sx of [-1, 1]) { p.put('socket', [sx * 11 - 4, 22, 106], [sx * 11 + 4, 32, 110], 'obsidian'); for (let k = 0; k < 6; k++) p.put('tooth', [sx * 8 - 1, 8, 112 + k * 4], [sx * 8 + 1, 14, 114 + k * 4], 'horn'); }
      p.put('tail', [-3, 12, -118], [3, 20, -64], 'boneDark'); }
    // 3. Der Sonnenobelisk (Sandmark): a carved shaft on steps, broken, its fallen top in the sand beside it.
    { const p = poi('obelisk', 107);
      p.footing(100, 100, 'sandstoneDark');
      p.put('step', [-48, 0, -48], [48, 4, 48], 'sandstoneDark'); p.put('step', [-38, 4, -38], [38, 8, 38], 'sandstone'); p.put('step', [-28, 8, -28], [28, 12, 28], 'sandstone');
      p.put('shaft', [-12, 12, -12], [12, 56, 12], 'sandstone', { rotation: [0, 12, 0], origin: [0, 12, 0] });
      p.put('shaft', [-9, 56, -9], [9, 100, 9], 'sandstone', { rotation: [0, 12, 0], origin: [0, 56, 0], decals: ['north', 'south', 'east', 'west'].map(face => ({ face, palette: { g: '#4a3a24' }, x: 3, y: 4, map: Array.from({ length: 36 }, (_, y) => '.'.repeat(12).split('').map((_, x) => (y % 5 < 3 && ((x * 7 + y * 3 + face.length) % 4 === 0 || (x + y) % 9 === 0)) ? 'g' : '.').join('')) })) });
      p.put('broken', [-9, 100, -9], [9, 106, 3], 'sandstone', { rotation: [0, 12, 0], origin: [0, 100, 0] });
      p.put('fallen', [-8, 0, -8], [8, 52, 8], 'sandstone', { origin: [0, 0, 0], rotation: [90, 70, 0], decals: [{ face: 'north', palette: { g: '#4a3a24' }, x: 3, y: 4, map: Array.from({ length: 40 }, (_, y) => '.'.repeat(10).split('').map((_, x) => (y % 4 < 2 && (x * 5 + y) % 3 === 0) ? 'g' : '.').join('')) }] });
      p.put('tip', [-5, 0, -5], [5, 14, 5], 'sandstone', { origin: [0, 0, 0], rotation: [96, 70, 0] });
      for (let k = 0; k < 9; k++) { const a = k * 40 + p.r() * 20, d = 58 + p.r() * 30; p.put('rubble', [Math.cos(a) * d - 4, -1, Math.sin(a) * d - 4], [Math.cos(a) * d + 4, 4 + p.r() * 5, Math.sin(a) * d + 4], 'sandstoneDark', { origin: [Math.cos(a) * d, 0, Math.sin(a) * d], rotation: [0, k * 33, 0] }); } }
    // 4. Karawanenrast (Sandmark): a striped tent, crates, a fire pit, bedrolls.
    { const p = poi('caravan_camp', 109);
      p.footing(130, 110, 'sandstoneDark');
      const tent = (cx, cz, len, mat) => { for (const side of [-1, 1]) for (let k = 0; k < 6; k++) p.put('canvas', [cx + side * 27 - 1, 0, cz - len / 2 + k * len / 6], [cx + side * 27 + 1, 44, cz - len / 2 + (k + 1) * len / 6], k % 2 ? 'canvasRed' : mat, { origin: [cx + side * 27, 0, cz - len / 2 + k * len / 6], rotation: [0, 0, side * 38] }); p.put('ridge', [cx - 1.5, 38, cz - len / 2], [cx + 1.5, 41, cz + len / 2], 'woodDark'); for (const e of [-1, 1]) p.put('pole', [cx - 1, 0, cz + e * len / 2 - 1], [cx + 1, 40, cz + e * len / 2 + 1], 'woodDark'); };
      tent(-24, -8, 60, 'canvas');
      for (let k = 0; k < 3; k++) p.put('crate', [20 + k * 9, 0, -36 + (k % 2) * 8], [29 + k * 9, 9, -27 + (k % 2) * 8], 'woodLight', { origin: [24 + k * 9, 0, -32], rotation: [0, k * 25, 0] });
      p.put('barrel', [50, 0, -20], [60, 14, -10], 'barrelWood'); p.put('sack', [44, 0, -4], [54, 8, 6], 'sack'); p.put('sack', [54, 0, 2], [63, 7, 10], 'sackLight');
      for (let k = 0; k < 8; k++) { const a = k * 45; p.put('ring', [Math.cos(a * .01745) * 12 - 3, 0, 24 + Math.sin(a * .01745) * 12 - 3], [Math.cos(a * .01745) * 12 + 3, 5, 24 + Math.sin(a * .01745) * 12 + 3], 'sandstoneDark', { origin: [Math.cos(a * .01745) * 12, 0, 24 + Math.sin(a * .01745) * 12], rotation: [0, a, 0] }); }
      p.put('ash', [-8, 0, 16], [8, 1.5, 32], 'obsidian'); p.put('ember', [-3, 1.5, 21], [3, 3, 27], 'ember');
      for (const bx of [-30, -12]) p.put('bedroll', [bx - 6, 0, 28], [bx + 6, 4, 52], 'clothGreen', { origin: [bx, 0, 40], rotation: [0, bx * 2, 0] }); }
    // 5. Der Obsidianaltar (Aschenkrone): a black altar on three steps, glass spikes round it, a brazier burning on it.
    { const p = poi('obsidian_altar', 113);
      p.footing(110, 110, 'basalt');
      p.put('step', [-52, 0, -52], [52, 4, 52], 'basalt'); p.put('step', [-42, 4, -42], [42, 8, 42], 'basalt'); p.put('step', [-32, 8, -32], [32, 12, 32], 'obsidian');
      p.put('block', [-22, 12, -14], [22, 32, 14], 'obsidian'); p.put('top', [-25, 32, -17], [25, 36, 17], 'basalt');
      p.put('bowl', [-8, 36, -8], [8, 44, 8], 'ironDark'); p.put('fire', [-6, 44, -6], [6, 50, 6], 'ember'); p.put('fire', [-3, 50, -3], [3, 56, 3], 'ember');
      for (let k = 0; k < 9; k++) { const a = k * 40 + p.r() * 10, d = 48 + p.r() * 12, h = 30 + p.r() * 40, px = Math.sin(a * .01745) * d, pz = Math.cos(a * .01745) * d; p.put('spike', [px - 4, 0, pz - 4], [px + 4, h, pz + 4], 'obsidian', { origin: [px, 0, pz], rotation: [8 + p.r() * 14, a, 0] }); }
      p.put('skull', [-5, 36, -22], [5, 43, -14], 'horn'); }
    // 6. Der Steinkreis (Heidemoor): standing stones in a ring round a flat altar stone.
    { const p = poi('stone_circle', 127);
      p.footing(160, 160, 'graniteStone');
      for (let k = 0; k < 11; k++) {
        if (k === 4) continue;
        const a = k / 11 * 6.283, d = 66, h = 44 + p.r() * 26, w = 12 + p.r() * 4, px = Math.cos(a) * d, pz = Math.sin(a) * d, lean = (p.r() - .5) * 8;
        p.put('stone', [px - w / 2, -4, pz - w / 2 * .7], [px + w / 2, h * .6, pz + w / 2 * .7], 'graniteStone', { origin: [px, 0, pz], rotation: [lean, -a * 57.3 + 90, lean * .5] });
        p.put('stone', [px - w * .38, h * .6, pz - w * .28], [px + w * .38, h, pz + w * .28], 'graniteStone', { origin: [px, 0, pz], rotation: [lean, -a * 57.3 + 90, lean * .5] });
        p.put('moss', [px - w / 2 - .3, h * .35, pz - 3], [px + w / 2 + .3, h * .5, pz + 3], 'mossGreen', { origin: [px, 0, pz], rotation: [lean, -a * 57.3 + 90, lean * .5] });
      }
      p.put('altar', [-20, 0, -12], [20, 11, 12], 'graniteStone'); p.put('altartop', [-23, 11, -14], [23, 15, 14], 'graniteStone', { rotation: [0, 8, 0], origin: [0, 11, 0] });
      p.put('fallen', [-6, 0, -6], [6, 42, 6], 'graniteStone', { origin: [0, 0, 0], rotation: [84, 20, 0] }); p.put('fallenmoss', [-6.4, 4, -3], [6.4, 20, 3], 'mossGreen', { origin: [0, 0, 0], rotation: [84, 20, 0] });
      for (let k = 0; k < 6; k++) p.put('offering', [-14 + k * 5, 15, -4 + (k % 2) * 4], [-11 + k * 5, 17, -1 + (k % 2) * 4], k % 2 ? 'ember' : 'horn'); }
    // 7. Torfstecherhütte (Heidemoor): a low turf hut with a thatched roof, stacks of drying peat, a rack.
    { const p = poi('peat_hut', 131);
      p.footing(120, 96, 'earth');
      p.put('walls', [-30, 0, -22], [30, 22, 22], 'turf'); for (let k = 0; k < 5; k++) p.put('turf', [-31 + k * 12.6, 15, -23], [-20 + k * 12.6, 21, -21], 'mossGreen');
      for (let k = 0; k < 7; k++) p.put('thatch', [-36, 22 + k * 3, -27 + k * 4], [36, 25 + k * 3, 27 - k * 4], 'hay');
      p.put('ridge', [-37, 43, -3], [37, 46, 3], 'woodDark'); p.put('door', [-8, 0, -23.5], [8, 18, -21.5], 'obsidian'); p.put('doorframe', [-10, 0, -24], [-8, 20, -21], 'woodDark'); p.put('doorframe', [8, 0, -24], [10, 20, -21], 'woodDark');
      p.put('chimney', [18, 30, -4], [26, 50, 4], 'sandstoneDark');
      for (let row = 0; row < 3; row++) for (let k = 0; k < 6 - row; k++) p.put('peat', [-56 + k * 9, row * 5, -38], [-48 + k * 9, row * 5 + 4.5, -30], 'earth');
      for (const x of [34, 54]) p.put('post', [x - 1.2, 0, -30], [x + 1.2, 28, -28], 'woodDark');
      p.put('rack', [32, 22, -30.5], [56, 24, -27.5], 'woodLight'); for (let k = 0; k < 4; k++) p.put('hang', [35 + k * 5, 12, -30], [39 + k * 5, 22, -28], 'earth'); }
    // 8. Der Jadeschrein (Jadegrat): a small shrine of green stone with two tiers of roof, lanterns, vines.
    { const p = poi('jade_shrine', 137);
      p.footing(116, 116, 'jadeStone');
      p.put('step', [-56, 0, -56], [56, 5, 56], 'jadeStone'); p.put('step', [-46, 5, -46], [46, 9, 46], 'jadeStone');
      for (const [px, pz] of [[-30, -30], [30, -30], [-30, 30], [30, 30]]) { p.put('pillar', [px - 4, 9, pz - 4], [px + 4, 52, pz + 4], 'jadeStone'); p.put('vine', [px - 4.3, 14, pz - 2], [px + 4.3, 44, pz + 2], 'leavesBush'); }
      p.put('floor', [-34, 9, -34], [34, 10, 34], 'sandstoneDark');
      p.put('eave', [-42, 52, -42], [42, 58, 42], 'jadeRoof'); p.put('eave', [-32, 58, -32], [32, 64, 32], 'jadeRoof'); p.put('eave', [-22, 64, -22], [22, 70, 22], 'jadeRoof'); p.put('eave', [-12, 70, -12], [12, 76, 12], 'jadeRoof'); p.put('finial', [-2, 76, -2], [2, 90, 2], 'brass');
      p.put('upper', [-20, 76, -20], [20, 80, 20], 'jadeStone');
      p.put('idol', [-6, 10, -6], [6, 30, 6], 'jadeStone'); p.put('idolhead', [-4, 30, -4], [4, 38, 4], 'jadeStone'); p.put('altar', [-12, 10, -12], [12, 14, 12], 'sandstoneDark');
      for (const [px, pz] of [[-40, -40], [40, -40], [-40, 40], [40, 40]]) { p.put('cord', [px - .4, 46, pz - .4], [px + .4, 52, pz + .4], 'woodDark'); p.put('lantern', [px - 3, 38, pz - 3], [px + 3, 46, pz + 3], 'ember'); }
      for (let k = 0; k < 6; k++) p.put('moss', [-56 + k * 20, 4, -57], [-46 + k * 20, 6, -55], 'leavesBush'); }
    // 9. Der hohle Stamm (woods): a fallen trunk you could crawl into: round (an octagon of two turned boxes), moss on it, a dark mouth, toadstools, a lantern left inside.
    { const p = poi('hollow_log', 139);
      p.footing(60, 130, 'earth');
      for (const rot of [0, 45]) p.put('trunk', [-14, 2, -62], [14, 30, 62], 'bark', { origin: [0, 16, 0], rotation: [0, 0, rot] });
      p.put('mouth', [-9, 9, -64.5], [9, 23, -61], 'obsidian'); p.put('lip', [-12, 4, -63], [12, 8, -61.5], 'bark'); p.put('lip', [-12, 24, -63], [12, 28, -61.5], 'bark');
      p.put('end', [-13, 3, 61.5], [13, 29, 62.5], 'logEnd', { origin: [0, 16, 0] }); p.put('endring', [-8, 8, 62.4], [8, 24, 63], 'bark');
      p.put('moss', [-9, 29, -34], [8, 30.6, -10], 'mossGreen'); p.put('moss', [-7, 29, 14], [10, 30.6, 40], 'mossGreen'); p.put('moss', [-10, 28.4, 44], [3, 30, 56], 'mossGreen');
      for (let k = 0; k < 5; k++) p.put('shelf', [15, 12 + k * 3.4, -30 + k * 14], [26, 14.5 + k * 3.4, -20 + k * 14], 'mushRed', { rotation: [0, 14, 0], origin: [15, 12 + k * 3.4, -25 + k * 14] });
      for (const [rx, rz, rr] of [[-22, 40, 20], [20, -50, -30], [-20, -30, 10]]) p.put('root', [rx - 3, 0, rz - 3], [rx + 3, 10, rz + 9], 'bark', { origin: [rx, 0, rz], rotation: [0, rr, 0] });
      p.put('lantern', [-3, 10, -52], [3, 18, -46], 'ember'); }
    // 10. Die Brandhütte (Aschenkrone): a hut of charred timber, roof fallen in, ash on the floor.
    { const p = poi('burned_hut', 149);
      p.footing(120, 100, 'basalt');
      for (const [px, pz, h] of [[-34, -26, 40], [34, -26, 34], [-34, 26, 22], [34, 26, 44], [0, -26, 30], [0, 26, 12], [-34, 0, 34]]) p.put('post', [px - 3, 0, pz - 3], [px + 3, h, pz + 3], 'barkCharred');
      p.put('wall', [-36, 0, 24], [-8, 14, 28], 'barkCharred'); p.put('wall', [10, 0, -28], [36, 20, -24], 'barkCharred');
      for (let k = 0; k < 6; k++) p.beam([-34 + k * 12, 44 - k * 4, -26], [-26 + k * 12, 6, 6 + k * 4], 4, 'barkCharred');
      p.put('ash', [-34, .8, -24], [34, 2, 24], 'obsidian'); p.put('embers', [-8, 2, -4], [4, 3, 8], 'ember'); p.put('pot', [18, 2, 8], [28, 12, 18], 'ironDark');
      p.put('bed', [-30, 2, -22], [-12, 6, 4], 'charcoal'); for (let k = 0; k < 5; k++) p.put('plank', [-30 + k * 14, 1, 14 + (k % 2) * 6], [-12 + k * 14, 3, 18 + (k % 2) * 6], 'barkCharred', { origin: [0, 1, 16], rotation: [0, k * 29, 0] }); }
    return { name: 'pois', bones, cubes, materials: MATERIALS, atlasWidth: 512 };
  }

  // ── Horses. A heavy riding horse, bigger than life like everything in Hemland (withers about 2.6 units, a
  // rider's head near four): deep chest, broad hindquarters, a thick crested neck, feathered fetlocks on the
  // heavier coats. Faces −Z like every model. The mane lies on the crest in four bones and the tail hangs in
  // four more, so the game can swing them; stirrups hang in their own bones; 'bit' marks where the reins attach.
  // Tack: a padded saddle with high pommel and cantle over a striped blanket, saddlebags, a bedroll, a bridle.
  // Markings come from the coat material: points and socks by height, dapples, white patches (see builder.js).
  const HORSE_WHITE = ['#d6d1c6', '#e2ded5', '#ebe8e0', '#f4f2ec'];
  const HORSES = {
    // Bay: red-brown, black mane, tail and legs from the knees down, a star, dark feathering.
    bay: { coat: ['#40210f', '#57301b', '#6b3c23', '#7f4a2c', '#925a37'], belly: ['#3a1e10', '#4a2816', '#5a321d', '#683b23'],
      points: { ramp: ['#141110', '#1c1815', '#25201b', '#2f2822'], top: 16.5 }, mane: ['#100d0b', '#1a1613', '#251f1b', '#302924'],
      muzzle: ['#1c1715', '#262019', '#30291f'], feathers: ['#1d1916', '#26201c', '#2f2822', '#3a332c'], darkEars: true, star: true, socks: {}, blanket: 'clothCrimson' },
    // Black: a heavy black with a long mane and tail, feathering, one white sock behind.
    black: { coat: ['#101014', '#18181d', '#222228', '#2e2e36', '#3e3e48'], belly: ['#0c0c0f', '#121215', '#18181c', '#1e1e23'],
      mane: ['#08080a', '#0f0f12', '#17171b', '#202026'], muzzle: ['#141416', '#1c1c1f', '#252528'], feathers: ['#0c0c0e', '#141417', '#1c1c20', '#26262b'],
      darkEars: true, socks: { rear_right: 6.5 }, blanket: 'clothBlue' },
    // Dapple grey: light rings in a darker grey net, dark lower legs, a silver mane.
    grey: { coat: ['#6c6f73', '#7f8286', '#93969a', '#a7aaad', '#babcbe'], belly: ['#8d9093', '#9da0a2', '#adafb1', '#bcbdbe'], dapples: ['#5d6064', '#cbcccd', .8],
      points: { ramp: ['#3a3b3f', '#46474b', '#535458', '#606165'], top: 12.5 }, mane: ['#b9bab9', '#cacac8', '#d9d9d6', '#e7e6e2'],
      muzzle: ['#3a3a3c', '#46474a', '#545558'], socks: {}, blanket: 'clothGreen' },
    // Chestnut: copper with a flaxen mane and tail, a blaze, two white legs behind.
    chestnut: { coat: ['#5b2a10', '#713516', '#86411d', '#9a4e25', '#ac5b2e'], belly: ['#4e230e', '#622c12', '#723418', '#823d1e'],
      mane: ['#9a7048', '#b4895c', '#c9a072', '#dcb688'], muzzle: ['#3a2622', '#4a302a', '#5a3a32'], blaze: true, socks: { rear_right: 6.5, rear_left: 10.5 }, blanket: 'clothLinen' },
    // Palomino: gold with a cream mane, a blaze, odd socks.
    palomino: { coat: ['#9a7232', '#b0883e', '#c29a4c', '#d2ac60', '#e0c07a'], belly: ['#a88446', '#bc9856', '#ccaa66', '#d8b878'],
      mane: ['#d8cfb8', '#e5ddc9', '#efe9db', '#f8f5ed'], muzzle: ['#4a3a30', '#5a463a', '#6a5244'], blaze: true, socks: { front_left: 6.5, rear_right: 3.5 }, blanket: 'clothCrimson' },
    // Paint: dark brown with big white patches over the back, white legs, a blaze, a two-coloured mane.
    paint: { coat: ['#4a2814', '#5e341c', '#704024', '#844e2e', '#965c38'], belly: HORSE_WHITE, patches: [HORSE_WHITE, .56],
      mane: ['#141110', '#1e1a17', '#28221e', '#332c26'], tail: ['#cfc9bd', '#ddd8ce', '#e8e4dc', '#f2efe8'], muzzle: ['#3a2a26', '#4a3630', '#5a423a'], feathers: HORSE_WHITE, blaze: true,
      socks: { front_right: 12, front_left: 12, rear_right: 12.5, rear_left: 12.5 }, blanket: 'clothBlue' },
  };
  function horse(variant) {
    const V = HORSES[variant];
    const coat = { style: 'coat', points: V.points, socks: V.socks, sockRamp: HORSE_WHITE, dapples: V.dapples, patches: V.patches };
    const materials = { ...MATERIALS,
      coat: { ...coat, ramp: V.coat }, belly: { ...coat, ramp: V.belly },
      mane: { style: 'hair', ramp: V.mane }, maneSide: { style: 'hair', ramp: V.mane, across: true, ragged: true }, tail: { style: 'hair', ramp: V.tail || V.mane, ragged: true }, tailRoot: { style: 'hair', ramp: V.tail || V.mane },
      eye: { style: 'flat', ramp: ['#0b0706', '#120c09', '#1a120d'] },
      feather: { style: 'hair', ramp: V.feathers || V.mane, ragged: true }, featherWhite: { style: 'hair', ramp: HORSE_WHITE, ragged: true },
      muzzle: { style: 'flat', ramp: V.muzzle }, hoof: { style: 'flat', ramp: ['#2a2420', '#36302a', '#433b33'] }, hoofPale: { style: 'flat', ramp: ['#6e6250', '#7e705c', '#8e8068'] } };
    // Points into a cube's turned frame: [y, z] about origin [oy, oz], degrees about X (Blockbench's sense).
    const turnX = ([y, z], [oy, oz], deg) => { const a = deg * Math.PI / 180, dy = y - oy, dz = z - oz; return [oy + dy * Math.cos(a) - dz * Math.sin(a), oz + dy * Math.sin(a) + dz * Math.cos(a)]; };
    const NECK = [
      { name: 'neck_low', bone: 'neck_1', from: [-4.5, 32, -22], to: [4.5, 46, -13], tilt: -38, origin: [0, 37, -17], mane: [[39.5, 43], [43, 46.5]] },
      { name: 'neck_high', bone: 'neck_2', from: [-4, 41, -28], to: [4, 52, -19], tilt: -28, origin: [0, 45, -23], mane: [[43, 47.5], [47.5, 52.6]] },
    ];
    const maneBones = [];
    NECK.forEach(n => n.mane.forEach(([y0, y1]) => { const [py, pz] = turnX([y1, n.to[2] + .5], [n.origin[1], n.origin[2]], n.tilt); maneBones.push({ n, y0, y1, pivot: [0, +py.toFixed(2), +pz.toFixed(2)] }); }));
    const bones = [
      ['root', null, [0, 0, 0]], ['body', 'root', [0, 32, 2]], ['chest', 'body', [0, 32, -11]], ['hips', 'body', [0, 32, 13]],
      ['neck_1', 'chest', [0, 37, -17]], ['neck_2', 'neck_1', [0, 45, -23]], ['head', 'neck_2', [0, 51, -28]],
      ['bit', 'head', [0, 36.5, -30.8]], ['ear_right', 'head', [2.2, 52, -28.5]], ['ear_left', 'head', [-2.2, 52, -28.5]], ['forelock', 'head', [0, 51.6, -28.9]],
      ...maneBones.map((m, k) => [`mane_${k + 1}`, m.n.bone, m.pivot]),
      ['tail_1', 'hips', [0, 38, 20]], ['tail_2', 'tail_1', [0, 33.5, 22.1]], ['tail_3', 'tail_2', [0, 25.6, 23.2]], ['tail_4', 'tail_3', [0, 17.6, 23.6]],
      ['saddle', 'body', [0, 38.6, -1]], ['stirrup_right', 'saddle', [7.3, 37.5, -1]], ['stirrup_left', 'saddle', [-7.3, 37.5, -1]],
    ];
    for (const [s, side] of [[1, 'right'], [-1, 'left']]) bones.push(
      [`front_upper_${side}`, 'chest', [s * 4.4, 30, -13]], [`front_lower_${side}`, `front_upper_${side}`, [s * 4.4, 15.5, -13]], [`front_hoof_${side}`, `front_lower_${side}`, [s * 4.4, 5.5, -13]],
      [`rear_upper_${side}`, 'hips', [s * 4.4, 31, 14.5]], [`rear_lower_${side}`, `rear_upper_${side}`, [s * 4.4, 15.5, 19.4]], [`rear_hoof_${side}`, `rear_lower_${side}`, [s * 4.4, 5.5, 19]]);
    const cubes = [], add = (...c) => cubes.push(...c.flat());
    const HEAD = { rotation: [-55, 0, 0], origin: [0, 51, -28] };
    // Body: a barrel with sprung ribs, a deep chest and breast, withers, big hindquarters stepped out over the
    // hips, the shoulder laid back along the shoulder blade.
    add(box('barrel', 'body', [-6.4, 23, -9], [6.4, 38, 11], 'coat', { faceMat: { down: 'belly' } }),
      box('chest', 'chest', [-6.2, 21.5, -19], [6.2, 38, -8], 'coat', { faceMat: { down: 'belly' } }),
      box('breast', 'chest', [-5, 22.5, -21], [5, 34, -19], 'coat'),
      box('withers', 'chest', [-3.8, 38, -17], [3.8, 41.2, -6.5], 'coat'),
      box('belly', 'body', [-5.2, 21.5, -6], [5.2, 23, 8], 'belly'),
      box('rump', 'hips', [-6.3, 22.5, 9], [6.3, 39, 20], 'coat', { faceMat: { down: 'belly' } }),
      box('croup', 'hips', [-4.6, 39, 9.5], [4.6, 40.2, 18.5], 'coat'),
      ...pair(box('haunch_right', 'hips', [6.3, 25, 10.5], [7, 36.5, 19.2], 'coat')),
      ...pair(box('shoulder_right', 'chest', [6.2, 24.5, -17], [6.8, 37.5, -10.5], 'coat', { rotation: [22, 0, 0], origin: [6.5, 31, -13.75] })));
    // Neck: two thick sections leaning forward to the poll; the crest is their back face.
    for (const n of NECK) add(box(n.name, n.bone, n.from, n.to, 'coat', { rotation: [n.tilt, 0, 0], origin: n.origin }));
    // Head (built level, nose to −Z, then tipped 55° down at the poll): skull with eyes, nasal bone, muzzle with
    // nostrils and a lower lip, round jowls; ears in two steps; the forelock lies on the forehead.
    const white = { w: '#ece9e1' };
    const skullTop = V.blaze ? [{ face: 'up', palette: white, x: 0, y: 0, map: ['..www..', '..www..', '.wwwww.', '.wwwww.', '..www..', '...w...'] }]
      : V.star ? [{ face: 'up', palette: white, x: 2, y: 1, map: ['.ww', 'www', '.w.'] }] : [];
    add(box('skull', 'head', [-3.5, 45, -35], [3.5, 52, -28], 'coat', { ...HEAD, faceMat: { down: 'belly' }, decals: skullTop }),
      // The eye: a dark, glossy box set into the side of the head under a bony brow, a glint at its top.
      ...pair(box('eye_right', 'head', [3.5, 48.3, -33.9], [3.92, 50.3, -31.3], 'eye', { ...HEAD, decals: [{ face: 'east', palette: { w: '#cbbfae', g: '#3a2a20' }, x: 0, y: 0, map: ['gwg', '...'] }] })),
      ...pair(box('brow_right', 'head', [3.5, 50.3, -34.3], [3.84, 51.1, -30.9], 'coat', HEAD)),
      box('face', 'head', [-3, 46, -41], [3, 51, -35], 'coat', { ...HEAD, decals: V.blaze ? [{ face: 'up', palette: white, x: 2, y: 0, map: ['ww', 'ww', 'ww', 'ww', 'ww', 'ww'] }] : [] }),
      box('muzzle', 'head', [-2.8, 44.6, -45], [2.8, 50, -41], 'muzzle', { ...HEAD, decals: [{ face: 'north', palette: { n: '#0a0807' }, x: 1, y: 2, map: ['n..n', 'n..n'] },
        ...(V.blaze ? [{ face: 'up', palette: white, x: 0, y: 0, map: ['.wwww.', '..ww..', '..ww..', '..ww..'] }, { face: 'north', palette: white, x: 2, y: 0, map: ['ww'] }] : [])] }),
      box('lip', 'head', [-2.4, 43.6, -44.6], [2.4, 44.6, -40.5], 'muzzle', HEAD),
      box('chin', 'head', [-2, 43.4, -40.5], [2, 44.6, -36], 'muzzle', HEAD),
      ...pair(box('jowl_right', 'head', [3.5, 44.8, -31.4], [4.05, 47.7, -28.6], 'coat', HEAD)));
    for (const side of ['right', 'left']) {
      const e = c => side === 'right' ? c : mirrorCube(c);
      add(e(box('ear_right', 'ear_right', [1.3, 52, -29.6], [3.1, 55, -27.4], 'coat', { rotation: [14, 0, -14], origin: [2.2, 52, -28.5], decals: [{ face: 'north', palette: { p: '#2a1e18' }, x: 0, y: 0, map: ['.p', 'pp', 'pp'] }] })),
        e(box('ear_tip_right', 'ear_right', [1.6, 55, -29.2], [2.8, 57, -27.8], V.darkEars ? 'mane' : 'coat', { rotation: [14, 0, -14], origin: [2.2, 52, -28.5] })));
    }
    add(box('forelock', 'forelock', [-1.6, 52, -31.2], [1.6, 52.9, -28.6], 'mane', HEAD),
      box('forelock_tuft', 'forelock', [-1.2, 52, -29.6], [1.2, 53.8, -28.2], 'mane', HEAD));
    // Mane: a ridge of hair standing along the crest and, on the right side, hair lying down the neck in two
    // staggered layers per piece whose strands end in points of uneven length; every piece is turned with its
    // neck section so it sits exactly on the crest, and overlaps the next.
    const MANE_LENGTH = [[4.6, 3.6], [5.4, 4.4], [5, 4], [3.4, 2.6]];
    maneBones.forEach(({ n, y0, y1 }, k) => {
      const zb = n.to[2], xr = n.to[0], turned = { rotation: [n.tilt, 0, 0], origin: n.origin }, [la, lb] = MANE_LENGTH[k], mid = (a, t) => y0 + (y1 - y0) * t;
      add(box(`mane_ridge_${k + 1}`, `mane_${k + 1}`, [-1.3, y0 - .4, zb - 1], [1.3, y1 + .4, zb + 1.9], 'mane', turned),
        box(`mane_fall_${k + 1}`, `mane_${k + 1}`, [xr - .05, y0 - .4, zb - la], [xr + .7, mid(0, .62), zb + .4], 'maneSide', turned),
        box(`mane_fall_${k + 1}b`, `mane_${k + 1}`, [xr - .05, mid(0, .38), zb - lb], [xr + .62, y1 + .4, zb + .4], 'maneSide', turned));
    });
    // Tail: a dock angled out from the croup, then long falls of hair reaching below the hocks, frayed at the end.
    add(box('tail_dock', 'tail_1', [-1.6, 33, 18.5], [1.6, 38.6, 21.5], 'tailRoot', { rotation: [-25, 0, 0], origin: [0, 38, 20] }),
      box('tail_fall_1', 'tail_2', [-2.3, 25.2, 20.4], [2.3, 34, 24], 'tailRoot', { rotation: [-8, 0, 0], origin: [0, 33.5, 22.1] }),
      box('tail_fall_2', 'tail_3', [-2.6, 17.2, 21.4], [2.6, 26.2, 25], 'tailRoot', { rotation: [-3, 0, 0], origin: [0, 25.6, 23.2] }),
      box('tail_fall_3', 'tail_4', [-2.2, 10.5, 21.8], [2.2, 18.2, 25.4], 'tail'),
      box('tail_tip', 'tail_4', [-1.4, 8, 22.4], [1.4, 10.5, 24.8], 'tail'));
    // Legs (right side given, mirrored): forearm tapering to the knee, a slim cannon, the fetlock joint, pastern and
    // hoof; behind, the thigh, the gaskin slanting back to the point of the hock, then the cannon straight down.
    for (const [s, side] of [[1, 'right'], [-1, 'left']]) {
      const leg = (name, bone, from, to, mat, extra) => { const c = box(`${name}_right`, `${bone}_right`, from, to, mat, extra || {}); return s > 0 ? c : mirrorCube(c); };
      const featherMat = set => V.socks[`${set}_${side}`] ? 'featherWhite' : 'feather', hoof = set => V.socks[`${set}_${side}`] ? 'hoofPale' : 'hoof';
      add(leg('forearm', 'front_upper', [2.3, 21, -16], [6.5, 30.5, -10.5], 'coat'),
        leg('forearm_low', 'front_upper', [2.6, 15.5, -15.4], [6.2, 21, -11], 'coat'),
        leg('knee', 'front_lower', [2.5, 12.5, -15.5], [6.3, 16, -11.1], 'coat'),
        leg('front_cannon', 'front_lower', [3, 5.5, -14.5], [5.8, 12.5, -11.6], 'coat'),
        leg('front_fetlock', 'front_hoof', [2.8, 3.6, -14.8], [6, 6.2, -11.2], 'coat'),
        leg('front_pastern', 'front_hoof', [3, 1.8, -15], [5.8, 3.8, -12], 'coat'),
        leg('front_hoof', 'front_hoof', [2.6, 0, -15.6], [6.2, 2, -11.4], hoof('front')),
        leg('thigh', 'rear_upper', [2, 21.5, 10.5], [6.6, 32, 19.5], 'coat'),
        leg('gaskin', 'rear_upper', [2.7, 14.5, 15], [6.1, 23, 19], 'coat', { rotation: [-18, 0, 0], origin: [4.4, 23, 17] }),
        leg('hock', 'rear_lower', [2.6, 12.5, 17.5], [6.1, 16.5, 21], 'coat'),
        leg('hock_point', 'rear_lower', [3.4, 14.5, 21], [5.3, 16.8, 22], 'coat'),
        leg('rear_cannon', 'rear_lower', [3, 5.5, 17.6], [5.8, 12.5, 20.4], 'coat'),
        leg('rear_fetlock', 'rear_hoof', [2.8, 3.6, 17.3], [6, 6.2, 20.8], 'coat'),
        leg('rear_pastern', 'rear_hoof', [3, 1.8, 16.7], [5.8, 3.8, 19.8], 'coat'),
        leg('rear_hoof', 'rear_hoof', [2.6, 0, 16], [6.2, 2, 20.2], hoof('rear')));
      if (V.feathers) add(leg('front_feather', 'front_hoof', [2.4, 1.2, -13.6], [6.4, 5.4, -10.6], featherMat('front')),
        leg('rear_feather', 'rear_hoof', [2.4, 1.2, 18.6], [6.4, 5.4, 21.6], featherMat('rear')));
    }
    // Tack: blanket, saddle with pommel and cantle, flaps, girth, saddlebags, bedroll; stirrups; bridle.
    const B = V.blanket;
    add(box('blanket', 'saddle', [-7, 30, -6], [7, 38.6, 5], B, { decals: ['east', 'west'].map(face => ({ face, palette: { s: '#b39a62' }, x: 0, y: 6, map: ['sssssssssss', '...........', 'sssssssssss'] })) }),
      box('seat', 'saddle', [-4, 38.6, -4], [4, 39.6, 4], 'leatherDark'),
      box('pommel', 'saddle', [-2.5, 39.6, -5.5], [2.5, 42.5, -3.5], 'leather'),
      box('cantle', 'saddle', [-3.5, 39.6, 3.5], [3.5, 42.5, 5.5], 'leather'),
      ...pair(box('flap_right', 'saddle', [7, 31, -3.5], [7.6, 38.6, 2.5], 'leather')),
      box('girth', 'saddle', [-7.2, 21.2, -1], [7.2, 30, 1], 'leatherDark'),
      ...pair(box('saddlebag_right', 'saddle', [6.6, 31, 5.5], [8.2, 36, 9.5], 'leather', { decals: [{ face: 'east', palette: { b: '#a8a8a0' }, x: 1, y: 1, map: ['.b.'] }] })),
      box('bedroll', 'saddle', [-5.5, 39, 5.5], [5.5, 41.5, 8], 'clothLinen', { decals: [{ face: 'up', palette: { l: '#2c1e15' }, x: 2, y: 0, map: ['l.....l', 'l.....l', 'l.....l'] }] }));
    for (const side of ['right', 'left']) {
      const st = c => side === 'right' ? c : mirrorCube(c);
      add(st(box('stirrup_strap_right', 'stirrup_right', [7.1, 30.5, -1.4], [7.7, 37.5, -.6], 'leatherDark')),
        st(box('stirrup_iron_right', 'stirrup_right', [6.7, 28.5, -2.2], [8.1, 30.5, .2], 'iron')));
    }
    add(box('noseband', 'head', [-3.1, 45.6, -40.4], [3.1, 50.4, -39.5], 'leatherDark', HEAD),
      box('browband', 'head', [-3.7, 51.4, -30], [3.7, 52.4, -29], 'leatherDark', HEAD),
      ...pair(box('headstall_right', 'head', [3.5, 46, -30.2], [3.9, 52.2, -29.2], 'leatherDark', HEAD)),
      ...pair(box('cheekpiece_right', 'head', [3.1, 45.4, -41.6], [3.6, 46.4, -30], 'leatherDark', HEAD)),
      ...pair(box('bitring_right', 'head', [2.8, 44.4, -42.6], [3.6, 45.8, -41.2], 'iron', HEAD)));
    return { name: `horse_${variant}`, bones, cubes, materials, atlasWidth: 256 };
  }

  // ── Goblins (the Ukhai, src/data/goblins/lore.js). Small, hunched, grey, with bat ears wider than their
  // shoulders, milky blind eyes, a hooked nose and an underbite of fangs; long arms down to the knees, short
  // bowed legs on long clawed feet. The rig uses the humanoid bone names (plus jaw and ears), so the humanoid
  // animator, IK and ragdolls work on them; the hunch is built into the boxes. Each tribe dresses and paints
  // differently; the special kinds change the body itself (lanky stalker, bloated spore sack, wire-thin
  // chain strangler, a hulking brute with one giant arm, a drummer), and the three chiefs are bigger still.
  const GOBLIN_TRIBES = {
    schaedelsaenger: { skin: ['#5a7848', '#688754', '#779760', '#87a76d'], paint: ['#c9c4b5', '#d8d4c6', '#e6e2d6'], cloth: 'leatherDark' },
    pilzmuetter: { skin: ['#3b6a3c', '#467a46', '#528b51', '#5f9c5c'], paint: ['#3d5a2e', '#4a6b37', '#587c41'], cloth: 'clothGreen' },
    kettenbrecher: { skin: ['#52682f', '#5f7838', '#6d8842', '#7c984c'], paint: ['#6e2a1c', '#843422', '#9a3f29'], cloth: 'leather' },
  };
  function goblin({ name, tribe = 'schaedelsaenger', kind = 'speer', chief = false }) {
    const T = GOBLIN_TRIBES[tribe];
    const materials = { ...MATERIALS,
      gobSkin: { style: 'skin', ramp: T.skin }, gobDark: { style: 'flat', ramp: ['#2f2b28', '#3b3632', '#47413c'] },
      gobInner: { style: 'flat', ramp: ['#5a4a3a', '#6a5844', '#7a654e'] }, gobPaint: { style: 'flat', ramp: T.paint },
      gobEye: { style: 'flat', ramp: ['#aab6b8', '#bdc8c9', '#d0d9d9'] }, gobClaw: { style: 'flat', ramp: ['#1c1814', '#26201b', '#302822'] },
      gobBone: { style: 'flat', ramp: ['#a89c82', '#bab096', '#cbc2aa', '#dbd4c0'] }, gobHide: { style: 'leather', ramp: ['#9a8064', '#ab9073', '#bba183'] },
      capBrown: { style: 'flat', ramp: ['#6e3f22', '#83502d', '#986139'] }, capGlow: { style: 'glow', ramp: ['#3fa894', '#5cc4ae', '#86e0cc', '#b2f2e4'] },
      spore: { style: 'glow', ramp: ['#7d9a3a', '#98b84a', '#b8d660', '#d4ec84'] } };
    // Body shape by kind: k scales the whole goblin, the rest stretch or swell parts of it.
    const brute = kind === 'brecher' || chief && tribe === 'kettenbrecher';
    const shape = { k: brute ? 1.6 : chief ? 1.22 : kind === 'schleicher' ? 1.12 : 1, limb: kind === 'schleicher' ? 1.22 : kind === 'wuerger' ? 1.08 : 1,
      width: kind === 'wuerger' ? .78 : kind === 'schleicher' ? .85 : chief && tribe === 'pilzmuetter' ? 1.3 : brute ? 1.35 : 1, neck: kind === 'wuerger' ? 2.2 : 0 };
    const { k, limb, width, neck } = shape, W = v => v * width;
    // Scale a point; the legs and arms take the limb factor on their lengths.
    const P = ([x, y, z]) => [x * k, y * k, z * k];
    const legTop = 11 * limb, hipY = legTop, chestY = hipY + 5;
    const bones = [
      ['root', null, [0, 0, 0]], ['hips', 'root', P([0, hipY, .5])], ['torso', 'hips', P([0, hipY + 2, .5])], ['chest', 'torso', P([0, chestY, 0])],
      ['neck', 'chest', P([0, chestY + 3.2, -3])], ['head', 'neck', P([0, chestY + 4.4 + neck - (brute ? 1.6 : 0), -3.6 - neck * .3])], ['jaw', 'head', P([0, chestY + 5.2 + neck - (brute ? 1.6 : 0), -6.9 - neck * .3])],
      ['ear_right', 'head', P([3.5, chestY + 7.9 + neck - (brute ? 3.2 : 0), -4.6 - neck * .3])], ['ear_left', 'head', P([-3.5, chestY + 7.9 + neck - (brute ? 3.2 : 0), -4.6 - neck * .3])], ['pack', 'chest', P([0, chestY + 2, 2.5])],
    ];
    const armLen = 4.8 * limb;
    for (const [s, side] of [[1, 'right'], [-1, 'left']]) bones.push(
      [`arm_upper_${side}`, 'chest', P([s * W(4.4), chestY + 3, -1.2])], [`arm_lower_${side}`, `arm_upper_${side}`, P([s * W(4.7), chestY + 3 - armLen, -1.4])],
      [`hand_${side}`, `arm_lower_${side}`, P([s * W(4.9), chestY + 3 - armLen * 1.9, -1.6])], [`grip_${side}`, `hand_${side}`, P([s * W(4.9), chestY + 1.8 - armLen * 1.9 - 1.2, -2.3])],
      [`leg_upper_${side}`, 'hips', P([s * 1.7 * width, hipY, .6])], [`leg_lower_${side}`, `leg_upper_${side}`, P([s * 2 * width, hipY - 5 * limb, .9])], [`foot_${side}`, `leg_lower_${side}`, P([s * 2.1 * width, 1.7, .6])]);
    const cubes = [], add = (...c) => cubes.push(...c.flat());
    // Boxes in goblin-space (scaled by k); right-side boxes mirrored with sym().
    const g = (n, bone, from, to, mat, extra = {}) => box(n, bone, P(from), P(to), mat, { ...extra, ...(extra.origin ? { origin: P(extra.origin) } : {}) });
    const sym = c => pair(c);
    const head = chestY + 4.4 + neck - (brute ? 1.6 : 0), hz = -1 - neck * .3, H = v => v * (brute ? .78 : 1.15);
    // Torso: pelvis, belly and a hunched chest with knobs of spine.
    add(g('pelvis', 'hips', [W(-2.4), hipY - 1.2, -1.2], [W(2.4), hipY + 1.8, 2.2], 'gobSkin'),
      g('belly', 'torso', [W(-2.6), hipY + 1.6, -1.6], [W(2.6), hipY + 5.2, 2.1], 'gobSkin', { rotation: [-12, 0, 0], origin: [0, hipY + 2, .5] }),
      g('chest', 'chest', [W(-3.3), chestY - .6, -2.4], [W(3.3), chestY + 4, 2.3], 'gobSkin', { rotation: [-32, 0, 0], origin: [0, chestY, 0] }));
    for (let i = 0; i < 3; i++) add(g(`spine_${i}`, 'chest', [-.5, chestY + i * 1.3, 2.1], [.5, chestY + i * 1.3 + .8, 2.8], 'gobSkin', { rotation: [-24, 0, 0], origin: [0, chestY, 0] }));
    add(g('neck', 'neck', [-1.2, chestY + 2.4, -4 - neck * .3], [1.2, head + .2, -1.8 - neck * .3], 'gobSkin', { rotation: [-38 + neck * 4, 0, 0], origin: [0, chestY + 3.2, -3] }));
    // Head: skull, heavy brow, milky eyes, a long hooked nose, cheekbones, a jaw of fangs.
    const eyes = { face: 'north', palette: { e: '#d4dcdc', m: '#a4b0b2', d: '#24201c' }, x: 0, y: 1, map: ['.dd.dd.', '.em.me.', '.......'] };
    add(g('skull', 'head', [H(-3.4), head - .6, H(-6.4) + hz], [H(3.4), head + H(5.6) - .6, -.8 + hz], 'gobSkin', { decals: [eyes, ...(tribe === 'schaedelsaenger' ? [{ face: 'north', palette: { w: T.paint[2] }, x: 0, y: 3, map: ['w.....w', 'ww...ww'] }] : [])] }),
      g('brow', 'head', [H(-3.5), head + 3.8, H(-6.8) + hz], [H(3.5), head + 4.8, H(-5.8) + hz], 'gobSkin'),
      g('nose', 'head', [-.8, head + 1, H(-7.8) + hz], [.8, head + 3.7, H(-6.3) + hz], 'gobSkin'),
      g('nose_tip', 'head', [-.7, head + .4, H(-8.5) + hz], [.7, head + 1.4, H(-7.5) + hz], 'gobSkin'),
      ...sym(g('cheek_right', 'head', [2.6, head - .2, -6 + hz], [3.7, head + 1.6, -3.4 + hz], 'gobSkin')),
      g('jaw', 'jaw', [H(-2.8), head - 1.5, H(-6.6) + hz], [H(2.8), head + .4, -2.4 + hz], 'gobSkin', { decals: [{ face: 'north', palette: { t: '#d6cdb6', d: '#2a1f1a' }, x: 0, y: 0, map: ['t.dd.t', 'dddddd'] }] }),
      ...sym(g('fang_right', 'jaw', [1.5, head + .4, H(-6.5) + hz], [2.3, head + 1.5, H(-5.9) + hz], 'teeth')));
    // Ears: bat-wide, swept up and back, a dark inside; some carry ritual notches.
    for (const [s, side] of [[1, 'right'], [-1, 'left']]) {
      const e = c => s > 0 ? c : mirrorCube(c), ey = head + (brute ? 1.9 : 3.5), ez = -3.6 + hz, sag = chief && tribe === 'pilzmuetter' ? -18 : 0, reach = brute ? 6.6 : 10;
      add(e(g('ear_right', 'ear_right', [H(3) + .4, ey - 1.8, ez - .3], [reach, ey + 2.4, ez + .4], 'gobSkin', { rotation: [6, 32, 12 + sag], origin: [3.5, ey, ez],
          decals: [{ face: 'north', palette: { i: '#5e4646', n: '#2f2b28' }, x: 0, y: 1, map: ['..iiii', '.iiiii', '..iii.'] }, { face: 'up', palette: { n: '#2f2b28' }, x: 3, y: 0, map: ['n'] }] })),
        e(g('ear_tip_right', 'ear_right', [reach - .6, ey + .2, ez - .2], [reach + (brute ? 1.6 : 2), ey + 2.8, ez + .3], 'gobSkin', { rotation: [6, 32, 20 + sag], origin: [3.5, ey, ez] })));
    }
    // Arms: long and thin, a wrap at the wrist, clawed hands.
    for (const [s, side] of [[1, 'right'], [-1, 'left']]) {
      const e = c => s > 0 ? c : mirrorCube(c), x = W(4.4), top = chestY + 3, mid = top - armLen, low = top - armLen * 1.9;
      const big = brute && s > 0 ? 1.9 : 1;
      add(e(g('arm_upper_right', 'arm_upper_right', [x - .9 * big, mid - .4, -2.2 * big], [x + 1 * big, top + .6, -.2 + .4 * (big - 1)], 'gobSkin')),
        e(g('arm_lower_right', 'arm_lower_right', [x - .6 * big, low, -2.4 * big], [x + 1.2 * big, mid + .2, -.4 + .6 * (big - 1)], 'gobSkin')),
        e(g('wrap_right', 'arm_lower_right', [x - .75 * big, low + .4, -2.55 * big], [x + 1.35 * big, low + 1.4, -.25 + .6 * (big - 1)], T.cloth)),
        e(g('hand_right', 'hand_right', [x - .8 * big, low - 2.4 * big, -2.8 * big], [x + 1.4 * big, low, -.2 + .4 * (big - 1)], 'gobSkin')),
        e(g('claws_right', 'hand_right', [x - .6 * big, low - 3 * big, -3.2 * big], [x + 1.2 * big, low - 2.3 * big, -1.8], kind === 'schleicher' ? 'gobBone' : 'gobClaw')));
      if (kind === 'schleicher') add(e(g('blades_right', 'hand_right', [x - .2, low - 6.5, -3], [x + .6, low - 2.4, -2.2], 'gobBone')));
    }
    // Legs: bowed, knobbly knees, long bare clawed feet.
    for (const [s, side] of [[1, 'right'], [-1, 'left']]) {
      const e = c => s > 0 ? c : mirrorCube(c), x = 1.7 * width, kneeY = hipY - 5 * limb;
      add(e(g('thigh_right', 'leg_upper_right', [x - 1.2, kneeY, -1], [x + 1.2, hipY + .4, 1.8], 'gobSkin')),
        e(g('knee_right', 'leg_upper_right', [x - .9, kneeY - .4, -1.3], [x + 1.1, kneeY + 1.2, .4], 'gobSkin')),
        e(g('shin_right', 'leg_lower_right', [x - .9, 1.6, -.4], [x + 1.1, kneeY + .4, 1.6], 'gobSkin')),
        e(g('foot_right', 'foot_right', [x - 1.3, 0, -2.8], [x + 1.5, 1.8, 1.4], 'gobSkin', { decals: [{ face: 'north', palette: { c: '#1c1814' }, x: 0, y: 1, map: ['c.c'] }] })));
    }
    // Clothing: a loincloth and a belt hung with dried ears.
    add(g('loin_front', 'hips', [W(-1.8), hipY - 4.5, -1.6], [W(1.8), hipY - .5, -1.1], T.cloth), g('loin_back', 'hips', [W(-2), hipY - 4.2, 1.9], [W(2), hipY - .5, 2.4], T.cloth),
      g('belt', 'hips', [W(-2.6), hipY + .6, -1.4], [W(2.6), hipY + 1.6, 2.4], 'leatherDark'));
    for (const [i, x] of [[0, 1.6], [1, -1.2]]) add(g(`trophy_${i}`, 'hips', [W(x) - .45, hipY - 1.4, -1.8], [W(x) + .45, hipY + .6, -1.4], 'gobInner'));
    // Tribe dress.
    if (tribe === 'schaedelsaenger') {
      add(g('paint_chest', 'chest', [W(-3.35), chestY + 1.2, -2.5], [W(3.35), chestY + 1.8, -2.35], 'gobPaint', { rotation: [-24, 0, 0], origin: [0, chestY, 0] }),
        ...sym(g('scapula_right', 'chest', [W(2.6), chestY + 2.4, -2.2], [W(4.6), chestY + 3.4, 1.6], 'gobBone', { rotation: [-24, 0, -18], origin: [W(3.6), chestY + 2.8, 0] })));
      for (let i = 0; i < 5; i++) add(g(`bone_bead_${i}`, 'chest', [-2.2 + i * 1.1, chestY + 2.6 - Math.abs(i - 2) * .5, -2.9], [-1.6 + i * 1.1, chestY + 3.3 - Math.abs(i - 2) * .5, -2.4], 'gobBone', { rotation: [-24, 0, 0], origin: [0, chestY, 0] }));
      add(g('visor', 'head', [-3.6, head + 2.4, -6.9 + hz], [3.6, head + 5.2, -6.3 + hz], 'gobBone', { decals: [{ face: 'north', palette: { d: '#1a1612' }, x: 0, y: 1, map: ['.dd.dd.'] }] }));
    } else if (tribe === 'pilzmuetter') {
      add(g('hood', 'head', [-3.7, head + 2.5, -5.6 + hz], [3.7, head + 5.6, -.4 + hz], 'clothGreen', { inflate: .15 }),
        g('cap_head', 'head', [-2.2, head + 5.4, -4.2 + hz], [1.2, head + 6.3, -1.4 + hz], 'capBrown'),
        ...sym(g('cap_shoulder_right', 'chest', [W(2.8), chestY + 3.4, -1.6], [W(5), chestY + 4.2, .8], 'capGlow', { rotation: [-24, 0, 0], origin: [0, chestY, 0] })),
        g('spore_pouch', 'hips', [W(1.8), hipY - 1.6, -1.2], [W(3), hipY + .2, .6], 'spore'));
    } else {
      add(g('collar', 'chest', [W(-2.4), chestY + 3.2, -2.6], [W(2.4), chestY + 4.1, 1], 'rust', { rotation: [-24, 0, 0], origin: [0, chestY, 0] }),
        g('chain_link_a', 'chest', [-.5, chestY + .6, -3], [.5, chestY + 3.2, -2.5], 'iron', { rotation: [-24, 0, 0], origin: [0, chestY, 0] }),
        ...sym(g('manacle_right', 'arm_lower_right', [W(4.4) - .9, chestY + 3 - armLen * 1.9 + 1.4, -2.7], [W(4.4) + 1.5, chestY + 3 - armLen * 1.9 + 2.4, -.1], 'rust')),
        g('apron', 'chest', [W(-2.6), chestY - .8, -2.7], [W(2.6), chestY + 2.4, -2.4], 'leather', { rotation: [-24, 0, 0], origin: [0, chestY, 0] }));
      if (kind !== 'brecher' && !chief) add(g('helmet', 'head', [-3.6, head + 3.9, -6.2 + hz], [3.6, head + 5.6, -.6 + hz], 'ironDark'), g('helmet_brim', 'head', [-3.9, head + 3.7, -6.8 + hz], [3.9, head + 4.1, -5.6 + hz], 'ironDark'));
    }
    // The special kinds.
    if (kind === 'schleicher') add(g('cowl', 'head', [-3.8, head + 1, -5 + hz], [3.8, head + 5.8, .2 + hz], 'leatherDark', { inflate: .2 }), g('cloak', 'chest', [W(-3.6), chestY - 5, 1.6], [W(3.6), chestY + 4.2, 2.6], 'leatherDark', { rotation: [-24, 0, 0], origin: [0, chestY, 0] }));
    if (kind === 'speier') {
      // A sack of spores swollen on the back, lumpy, with glowing blisters, and a sagging belly.
      add(g('sack', 'pack', [-3.6, chestY - 1, 1.6], [3.6, chestY + 6, 7.4], 'gobSkin', { decals: [{ face: 'south', palette: { s: '#b8d660' }, x: 1, y: 1, map: ['s..s..', '..s..s', 's...s.'] }] }),
        g('sack_lump', 'pack', [-2.4, chestY + 5, 2.4], [2.8, chestY + 7.6, 6.2], 'gobSkin'), ...sym(g('blister_right', 'pack', [3.4, chestY + 1, 3], [4.6, chestY + 3.2, 5.6], 'spore')),
        g('gut', 'torso', [W(-3), hipY + .4, -2.8], [W(3), hipY + 4, 1], 'gobSkin'));
    }
    if (kind === 'wuerger') {
      for (let i = 0; i < 4; i++) add(g(`coil_${i}`, 'chest', [W(-3.4), chestY + .6 + i * .9, -2.6 + i * .2], [W(3.4), chestY + 1.2 + i * .9, 2.4], i % 2 ? 'iron' : 'ironDark', { rotation: [-24, 0, 14 - i * 9], origin: [0, chestY + 2, 0] }));
    }
    if (kind === 'trommler' || chief && tribe === 'schaedelsaenger') {
      add(...sym(g('tine_right', 'head', [1.4, head + 5, -3 + hz], [2, head + 9, -2.4 + hz], 'gobBone', { rotation: [0, 0, -20], origin: [1.7, head + 5, -2.7 + hz] })),
        ...sym(g('tine_branch_right', 'head', [1.9, head + 7, -2.9 + hz], [3.6, head + 7.6, -2.5 + hz], 'gobBone', { rotation: [0, 0, -20], origin: [1.7, head + 5, -2.7 + hz] })));
    }
    if (kind === 'trommler') add(g('drum', 'torso', [-3, hipY - .4, -6], [3, hipY + 4.6, -2], 'wood', { faceMat: { north: 'gobHide' } }), g('drum_strap', 'chest', [W(-3.4), chestY + 1, -2.7], [W(3.4), chestY + 1.8, 2.5], 'leatherDark', { rotation: [-24, 0, 40], origin: [0, chestY + 1, 0] }));
    if (brute) {
      // A brute: a hump of muscle, a head sunk between the shoulders, growths on the giant arm.
      add(g('hump', 'chest', [W(-3), chestY + 2, -.4], [W(3), chestY + 6, 3], 'gobSkin', { rotation: [-24, 0, 0], origin: [0, chestY, 0] }),
        g('growth_a', 'arm_upper_right', [W(4.4) + 1, chestY - 1, -1.4], [W(4.4) + 2.4, chestY + 1, .4], 'gobSkin'),
        g('growth_b', 'arm_lower_right', [W(4.4) + 1.2, chestY - 6, -3.6], [W(4.4) + 2.4, chestY - 4, -2], 'gobSkin'));
    }
    if (chief) {
      if (tribe === 'schaedelsaenger') add(g('skull_crown', 'head', [-2.4, head + 5.2, -5.6 + hz], [2.4, head + 8, -2.2 + hz], 'gobBone', { decals: [{ face: 'north', palette: { d: '#1a1612' }, x: 0, y: 1, map: ['.d.d.'] }] }),
        g('bone_cloak', 'chest', [W(-4), chestY - 6, 2], [W(4), chestY + 4.4, 3.2], 'gobBone', { rotation: [-18, 0, 0], origin: [0, chestY, 0] }));
      if (tribe === 'pilzmuetter') for (let i = 0; i < 6; i++) add(g(`mantle_cap_${i}`, 'chest', [W(-4 + i * 1.4), chestY + 3.2 + (i % 2) * .6, -1 + (i % 3)], [W(-2.6 + i * 1.4), chestY + 4.2 + (i % 2) * .6, 1.6 + (i % 3)], i % 2 ? 'capGlow' : 'capBrown', { rotation: [-24, 0, 0], origin: [0, chestY, 0] }));
      if (tribe === 'kettenbrecher') {
        add(g('iron_mask', 'head', [-3.6, head - .2, -7 + hz], [3.6, head + 4.4, -6.2 + hz], 'ironDark', { decals: [{ face: 'north', palette: { d: '#120f0d' }, x: 0, y: 1, map: ['.dd.dd.', '.......', '..ddd..'] }] }));
        for (let i = 0; i < 5; i++) add(g(`chain_wrap_${i}`, 'chest', [W(-3.5), chestY - .5 + i * 1, -2.6], [W(3.5), chestY + .1 + i * 1, 2.4], i % 2 ? 'iron' : 'rust', { rotation: [-24, 0, 22 - i * 11], origin: [0, chestY + 2, 0] }));
      }
    }
    return { name, bones, cubes, materials, atlasWidth: brute ? 256 : 128 };
  }
  const GOBLIN_MODELS = {
    goblin_schaedel: { tribe: 'schaedelsaenger' }, goblin_pilz: { tribe: 'pilzmuetter' }, goblin_ketten: { tribe: 'kettenbrecher' },
    goblin_schleicher: { tribe: 'schaedelsaenger', kind: 'schleicher' }, goblin_speier: { tribe: 'pilzmuetter', kind: 'speier' },
    goblin_wuerger: { tribe: 'kettenbrecher', kind: 'wuerger' }, goblin_brecher: { tribe: 'kettenbrecher', kind: 'brecher' }, goblin_trommler: { tribe: 'schaedelsaenger', kind: 'trommler' },
    goblin_vosh: { tribe: 'schaedelsaenger', kind: 'speer', chief: true }, goblin_ghast: { tribe: 'pilzmuetter', kind: 'dolch', chief: true }, goblin_ulgrak: { tribe: 'kettenbrecher', kind: 'brecher', chief: true },
  };

  // ── Held items. Each top-level bone is one item whose pivot is the grip point.
  // ── The wanderer's backpack (characters/backpack.js: it swings round from the back, the flap opens, the inventory
  // is the view into it). Faces −Z (its outer side, with the flap and buckles), stands on y = 0, 11 × 5 px footprint,
  // 12 px tall. Bones: pack › flap (hinge at the back of the rim, opens by turning +X) › buckle; strap_left /
  // strap_right hang on the back side; the bedroll under it and the pockets are part of the pack.
  function backpack() {
    const bones = [['pack', null, [0, 0, 0]], ['flap', 'pack', [0, 12.4, 2.4]], ['buckle', 'flap', [0, 8.6, -3.1]], ['strap_left', 'pack', [-3.6, 10.8, 2.7]], ['strap_right', 'pack', [3.6, 10.8, 2.7]],
      ['pocket_left', 'pack', [5.6, 7.2, 0]], ['pocket_right', 'pack', [-5.6, 7.2, 0]]];
    const cubes = [], put = (name, bone, from, to, mat, extra) => cubes.push(box(name, bone, from, to, mat, extra));
    // Body: a leather bag with a darker foot, stitched, with a rim round the opening and the inside showing dark.
    put('body', 'pack', [-5.5, .8, -2.5], [5.5, 11.2, 2.5], 'leather');
    put('foot', 'pack', [-5.7, 0, -2.7], [5.7, 1.4, 2.7], 'leatherDark');
    put('belly', 'pack', [-5.9, 3, -2.7], [5.9, 4.1, 2.7], 'leatherDark');
    put('rim_front', 'pack', [-5.6, 11.2, -2.6], [5.6, 12.5, -1.7], 'leatherDark');
    put('rim_back', 'pack', [-5.6, 11.2, 1.7], [5.6, 12.5, 2.6], 'leatherDark');
    put('rim_left', 'pack', [-5.6, 11.2, -1.7], [-4.7, 12.5, 1.7], 'leatherDark');
    put('rim_right', 'pack', [4.7, 11.2, -1.7], [5.6, 12.5, 1.7], 'leatherDark');
    put('inside', 'pack', [-4.7, 10.6, -1.7], [4.7, 11.6, 1.7], 'sackDark');
    // What the pack holds, showing over the rim: a loaf, a flask, a scroll, a pouch, a folded blanket.
    put('loaf', 'pack', [-3.9, 11.2, -1.4], [-1.5, 13.0, .9], 'clay', { origin: [-2.7, 11.2, -.2], rotation: [0, 14, 4] });
    put('flask', 'pack', [1.3, 11.2, -1.2], [3.0, 13.4, .5], 'water');
    put('flask_neck', 'pack', [1.75, 13.4, -.75], [2.55, 14.4, .05], 'wood');
    put('scroll', 'pack', [-.6, 11.2, .4], [.9, 14.2, 1.5], 'clothLinen', { origin: [0, 11.2, 1], rotation: [-7, 0, 5] });
    put('pouch', 'pack', [3.2, 11.2, .2], [4.6, 12.7, 1.5], 'leatherDark');
    put('blanket', 'pack', [-4.6, 11.2, 1.0], [-1.0, 12.4, 1.65], 'clothCrimson');
    // Front strap with its buckle, and the stitched pocket of the flap.
    put('strap_front_l', 'pack', [-3.4, 3.4, -2.8], [-2.2, 9.2, -2.5], 'leatherDark');
    put('strap_front_r', 'pack', [2.2, 3.4, -2.8], [3.4, 9.2, -2.5], 'leatherDark');
    put('strap_buckle_l', 'pack', [-3.5, 4.2, -3], [-2.1, 5.6, -2.7], 'brass');
    put('strap_buckle_r', 'pack', [2.1, 4.2, -3], [3.5, 5.6, -2.7], 'brass');
    // The flap: a lid over the opening, its front drop covers the upper part of the front.
    put('flap_top', 'flap', [-5.8, 12.4, -3.1], [5.8, 13.4, 2.8], 'leather');
    put('flap_front', 'flap', [-5.8, 8.4, -3.2], [5.8, 13.4, -2.4], 'leather');
    put('flap_edge', 'flap', [-5.2, 8.0, -3.3], [5.2, 8.6, -2.55], 'leatherDark');
    put('flap_seam', 'flap', [-5.8, 12.9, -3.3], [5.8, 13.2, -2.9], 'leatherDark');
    put('flap_strap_l', 'flap', [-3.2, 7.6, -3.4], [-2.4, 13.5, -2.9], 'leatherDark');
    put('flap_strap_r', 'flap', [2.4, 7.6, -3.4], [3.2, 13.5, -2.9], 'leatherDark');
    put('flap_stud_l', 'flap', [-3.3, 8.3, -3.6], [-2.3, 9.3, -3.35], 'brass');
    put('flap_stud_r', 'flap', [2.3, 8.3, -3.6], [3.3, 9.3, -3.35], 'brass');
    put('buckle_plate', 'buckle', [-1.1, 8.0, -3.7], [1.1, 9.4, -3.35], 'brass');
    put('buckle_tongue', 'buckle', [-.35, 7.2, -3.8], [.35, 8.2, -3.5], 'steel');
    // Side pockets, a little looser than the bag.
    for (const [name, sign] of [['pocket_left', 1], ['pocket_right', -1]]) {
      const lo = sign > 0 ? 5.5 : -7.2, hi = sign > 0 ? 7.2 : -5.5;
      put(`${name}_bag`, name, [lo, 1.6, -1.8], [hi, 7.2, 1.8], 'leatherDark');
      put(`${name}_flap`, name, [lo - (sign < 0 ? .15 : 0), 6.0, -2.0], [hi + (sign > 0 ? .15 : 0), 7.6, 2.0], 'leather');
    }
    put('pocket_stud_l', 'pocket_left', [6.6, 6.4, -2.15], [7.3, 7.0, -1.85], 'brass');
    put('pocket_stud_r', 'pocket_right', [-7.3, 6.4, -2.15], [-6.6, 7.0, -1.85], 'brass');
    // The bedroll under the bag: a rolled blanket held by two straps.
    put('bedroll', 'pack', [-5.2, -3.2, -2.2], [5.2, -.2, 2.4], 'clothGrey');
    put('bedroll_end_l', 'pack', [-5.5, -3.0, -1.8], [-5.2, -.4, 2.0], 'clothLinen');
    put('bedroll_end_r', 'pack', [5.2, -3.0, -1.8], [5.5, -.4, 2.0], 'clothLinen');
    put('bedroll_strap_l', 'pack', [-3.4, -3.4, -2.4], [-2.4, -.1, 2.6], 'leatherDark');
    put('bedroll_strap_r', 'pack', [2.4, -3.4, -2.4], [3.4, -.1, 2.6], 'leatherDark');
    // Shoulder straps on the back side, each in two pieces so it can slacken and swing.
    for (const [name, x] of [['strap_left', -3.6], ['strap_right', 3.6]]) {
      put(`${name}_top`, name, [x - 1.1, 6.2, 2.5], [x + 1.1, 10.8, 3.6], 'leatherDark');
      put(`${name}_low`, name, [x - 1.1, 1.0, 2.5], [x + 1.1, 6.2, 3.3], 'leather');
      put(`${name}_pad`, name, [x - 1.5, 7.4, 3.2], [x + 1.5, 10.0, 4.1], 'clothGrey');
      put(`${name}_ring`, name, [x - .6, 9.9, 3.4], [x + .6, 10.9, 3.9], 'brass');
    }
    return { name: 'backpack', bones, cubes, materials: MATERIALS, atlasWidth: 128 };
  }

  function weapons() {
    // Swords: souls-like shapes (an arming/longsword, about 0.8 m of blade on a 1.1 m sword) in chunky
    // Blockbench proportions, so they read in a fist four pixels wide and at the low render resolution:
    // a blade 2.5 px wide and 0.8 px thick that tapers in steps to a point, a fuller two thirds of the way
    // up, a ricasso above the guard, a crossguard with its own block, a wrapped grip longer than the fist
    // with risers, a pommel. Pivot (0, 0, 0) is where the hand closes; the blade runs up +Y, edges face ±X.
    const bones = [], cubes = [];
    const sword = (name, x, o) => {
      bones.push([name, null, [x, 0, 0]]);
      const b = (part, from, to, mat, opts) => cubes.push(box(`${name}_${part}`, name, from, to, mat, opts));
      // Pommel: a wheel (two squares turned 45°) or a teardrop, and the peen of the tang.
      if (o.pommel === 'wheel') {
        b('pommel', [x - 1.4, -5.4, -.75], [x + 1.4, -2.6, .75], o.guard);
        b('pommel_45', [x - 1.4, -5.4, -.75], [x + 1.4, -2.6, .75], o.guard, { origin: [x, -4, 0], rotation: [0, 0, 45] });
        b('pommel_face', [x - .7, -4.7, -.9], [x + .7, -3.3, .9], o.gem || o.guard);
      } else {
        b('pommel', [x - 1.1, -4.7, -.95], [x + 1.1, -2.6, .95], o.guard);
        b('pommel_drop', [x - .8, -5.9, -.7], [x + .8, -4.7, .7], o.guard);
        if (o.gem) b('pommel_gem', [x - .5, -4.2, -1.05], [x + .5, -3.1, 1.05], o.gem);
      }
      b('peen', [x - .45, o.pommel === 'wheel' ? -6 : -6.4, -.4], [x + .45, o.pommel === 'wheel' ? -5.4 : -5.9, .4], o.guard);
      // Grip: leather (or wire) wrap, a riser band at each end.
      b('grip', [x - .85, -2.6, -.8], [x + .85, 2.8, .8], o.grip, { decals: ['north', 'south', 'east', 'west'].map(face => ({ face, palette: { w: o.wrap }, map: ['.', 'w', '.', 'w', '.'] })) });
      b('riser_low', [x - .95, -2.55, -.9], [x + .95, -2.1, .9], o.guard);
      b('riser_high', [x - .95, 2.35, -.9], [x + .95, 2.75, .9], o.guard);
      // Crossguard: a bar, its block over the blade, quillon ends bent toward or away from the blade.
      b('guard', [x - 4.2, 2.8, -.85], [x + 4.2, 3.9, .85], o.guard);
      b('guard_block', [x - 1.4, 2.5, -1.1], [x + 1.4, 4.4, 1.1], o.guard);
      for (const sgn of [1, -1]) b(`quillon_${sgn > 0 ? 'r' : 'l'}`, [x + sgn * 4 - .75, 2.85, -.75], [x + sgn * 4 + .75, 3.95, .75], o.guard,
        { origin: [x + sgn * 4, 3.4, 0], rotation: [0, 0, sgn * o.bend] });
      if (o.spikes) for (const sgn of [1, -1]) b(`spike_${sgn > 0 ? 'r' : 'l'}`, [x + sgn * 2.6 - .35, 3.9, -.35], [x + sgn * 2.6 + .35, 6, .35], o.guard,
        { origin: [x + sgn * 2.6, 3.9, 0], rotation: [0, 0, -sgn * 18] });
      // Ricasso, then the blade in tapering steps; the fuller a darker groove down its middle.
      b('ricasso', [x - 1.3, 4.4, -.45], [x + 1.3, 5.6, .45], o.ricasso || o.blade);
      const steps = o.broken ? [[5.6, 13.5, 1.25, .4], [13.5, 19.5, 1.1, .38], [19.5, 21.4, .9, .34]] : [[5.6, 14, 1.25, .4], [14, 20, 1.1, .38], [20, 23, .85, .34], [23, 24.6, .55, .28], [24.6, 25.6, .22, .18]];
      steps.forEach(([y0, y1, w, t], k) => b(`blade_${k}`, [x - w, y0, -t], [x + w, y1, t], o.blade));
      if (o.broken) { b('break_a', [x - .9, 21.4, -.3], [x + .1, 22.4, .3], o.blade); b('break_b', [x + .1, 21.4, -.3], [x + .8, 21.9, .3], o.blade); }
      b('fuller', [x - .3, 5.6, -.44], [x + .3, o.broken ? 15 : 17.5, .44], o.fuller);
    };
    sword('sword_rusty', 0, { blade: 'rust', guard: 'ironDark', grip: 'leatherDark', wrap: '#5a4030', fuller: 'ironDark', pommel: 'wheel', bend: 0, broken: true });
    sword('sword_guard', 10, { blade: 'steel', ricasso: 'iron', guard: 'brass', grip: 'leather', wrap: '#b3bec2', fuller: 'ironDark', pommel: 'drop', bend: -24 });
    sword('sword_ash', 20, { blade: 'darkSteel', guard: 'darkSteel', grip: 'leatherDark', wrap: '#5b2a1a', fuller: 'ember', gem: 'ember', pommel: 'wheel', bend: 28, spikes: true });
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
    // Goblin arms: spears of bone, flint and rusted iron, daggers of rib bone, black glass and a hooked knife, the
    // strangler's chain hook, Vosh's skull staff and Ulgrak's chain fist. Pivot at the grip, points up +Y.
    const gob = (item, x, parts) => { bones.push([item, null, [x, 0, 0]]); parts.forEach(([n, from, to, mat, o], i) => cubes.push(box(`${item}_${n || i}`, item, [x + from[0], from[1], from[2]], [x + to[0], to[1], to[2]], mat, o ? { ...o, ...(o.origin ? { origin: [x + o.origin[0], o.origin[1], o.origin[2]] } : {}) } : {}))); };
    const shaft = [['shaft', [-.4, -9, -.4], [.4, 14, .4], 'wood'], ['grip', [-.55, -1.5, -.55], [.55, 2, .55], 'leatherDark'], ['lash', [-.55, 12.6, -.55], [.55, 13.8, .55], 'leather']];
    gob('gob_spear_bone', 120, [...shaft, ['tip', [-.9, 13.8, -.3], [.9, 17, .3], 'antler'], ['point', [-.45, 17, -.22], [.45, 19.6, .22], 'antler'], ['ear', [.5, 11, -.2], [1.3, 12.4, .2], 'skin']]);
    gob('gob_spear_stone', 132, [...shaft, ['tip', [-1.1, 13.8, -.35], [1.1, 16, .35], 'ironDark'], ['point', [-.6, 16, -.3], [.6, 18, .3], 'ironDark'], ['point2', [-.25, 18, -.2], [.25, 19.2, .2], 'ironDark'], ['feather', [-1.4, 11.6, -.1], [-.4, 13.6, .1], 'fletchRed']]);
    gob('gob_spear_iron', 144, [...shaft, ['socket', [-.6, 13.6, -.6], [.6, 15, .6], 'rust'], ['tip', [-.8, 15, -.25], [.8, 18.4, .25], 'rust'], ['barb', [.6, 14.6, -.2], [1.6, 16.4, .2], 'rust', { rotation: [0, 0, -30], origin: [.8, 15.4, 0] }], ['point', [-.35, 18.4, -.2], [.35, 19.6, .2], 'rust']]);
    gob('gob_dagger_bone', 156, [['grip', [-.6, -2.2, -.55], [.6, 2.2, .55], 'leather'], ['guard', [-1, 2.2, -.5], [1, 2.9, .5], 'antler'], ['blade', [-.55, 2.9, -.25], [.55, 7.5, .25], 'antler', { rotation: [0, 0, 6], origin: [0, 2.9, 0] }], ['point', [-.3, 7.3, -.2], [.3, 8.8, .2], 'antler', { rotation: [0, 0, 12], origin: [0, 2.9, 0] }]]);
    gob('gob_dagger_obsidian', 166, [['grip', [-.55, -2.2, -.55], [.55, 2.2, .55], 'leatherDark'], ['blade', [-.85, 2.2, -.25], [.85, 6.4, .25], 'darkSteel'], ['tip', [-.5, 6.4, -.2], [.5, 8.2, .2], 'darkSteel', { rotation: [0, 0, -14], origin: [0, 6.4, 0] }], ['chip', [.6, 3.4, -.2], [1.2, 4.4, .2], 'darkSteel']]);
    gob('gob_dagger_rust', 176, [['grip', [-.55, -2.4, -.55], [.55, 2, .55], 'wood'], ['blade', [-.7, 2, -.2], [.7, 7, .2], 'rust'], ['hook', [-.7, 6.4, -.2], [1.6, 7.6, .2], 'rust', { rotation: [0, 0, -40], origin: [0, 7, 0] }]]);
    gob('gob_hook', 188, [['grip', [-.6, -2, -.6], [.6, 2, .6], 'leatherDark'], ...[0, 1, 2, 3].map(i => [`link${i}`, [-.4, 2 + i * 1.4, i % 2 ? -.15 : -.5], [.4, 3.4 + i * 1.4, i % 2 ? .15 : .5], 'iron']), ['shank', [-.45, 7.6, -.45], [.45, 11, .45], 'ironDark'], ['hook', [-.4, 10.4, -.4], [3.2, 11.4, .4], 'ironDark'], ['barb', [2.4, 8.8, -.35], [3.2, 11, .35], 'ironDark']]);
    gob('gob_staff', 200, [['shaft', [-.5, -12, -.5], [.5, 16, .5], 'wood'], ['wrap', [-.65, -1.5, -.65], [.65, 2, .65], 'leather'], ['skull', [-1.6, 16, -1.6], [1.6, 19, 1.4], 'antler', { decals: [{ face: 'north', palette: { d: '#1a1612' }, x: 0, y: 1, map: ['.d.d', '....', '.dd.'] }] }], ...[-1, 1].map(s => [`horn${s}`, [s * 1.4 - .3, 18, -.3], [s * 1.4 + .3, 21.5, .3], 'antler', { rotation: [0, 0, -s * 22], origin: [s * 1.4, 18, 0] }])]);
    gob('gob_flail', 214, [['grip', [-.7, -2.5, -.7], [.7, 2.5, .7], 'leatherDark'], ...[0, 1, 2].map(i => [`link${i}`, [-.45, 2.5 + i * 1.5, i % 2 ? -.15 : -.55], [.45, 4 + i * 1.5, i % 2 ? .15 : .55], 'iron']), ['ball', [-2, 7, -2], [2, 11, 2], 'ironDark'], ...[[0, 1], [1, 0], [0, -1], [-1, 0]].map(([dx, dz], i) => [`spike${i}`, [dx * 2 - .35, 8.6, dz * 2 - .35], [dx * 2.9 + .35, 9.4, dz * 2.9 + .35], 'iron'])]);
    return { name: 'weapons', bones, cubes, materials: MATERIALS, atlasWidth: 128 };
  }

  // ── Goblin cave props (systems/caves.js, sites/caveMouths.js): filthy, crooked, made of bone, hide, rotten wood and
  // rust. Each top-level bone is one prop, pivot on the ground at its footprint centre, front −z; a prop that hangs
  // on a wall has the wall at +z. Fire, glow and turning puzzle parts stay in code.
  function caveProps() {
    const bones = [], cubes = [], add = (...c) => cubes.push(...c.flat());
    const M = { ...MATERIALS,
      bone: { style: 'flat', ramp: ['#8a7e66', '#a09478', '#b4a98c', '#c6bca0'] }, boneDark: { style: 'flat', ramp: ['#5e5444', '#6e6350', '#7e735e'] },
      hide: { style: 'leather', ramp: ['#5e4636', '#6c5240', '#7a5e4a'] }, hideDark: { style: 'leather', ramp: ['#3e2e22', '#4a3829', '#564131'] },
      rag: { style: 'cloth', ramp: ['#3e382c', '#4a4334', '#564e3e', '#625a48'] }, ragRed: { style: 'cloth', ramp: ['#4a2018', '#5a281e', '#6a3024', '#7a382a'] },
      rock: { style: 'flat', ramp: ['#4a4740', '#56524a', '#625e55', '#6e6a60'] }, rockDark: { style: 'flat', ramp: ['#33302b', '#3e3a34', '#48443d'] },
      ochre: { style: 'flat', ramp: ['#5e2418', '#72301e', '#863a24'] }, soot: { style: 'flat', ramp: ['#141210', '#1c1915', '#24201b'] },
      filth: { style: 'fur', ramp: ['#241e14', '#2e2619', '#3a301f', '#463a27'] }, slime: { style: 'flat', ramp: ['#3a4420', '#465228', '#526030'] },
      meat: { style: 'flat', ramp: ['#5a1e1a', '#6e2822', '#82322a'] }, fat: { style: 'flat', ramp: ['#9a8a68', '#ab9a76', '#bcab84'] },
      capGlow: { style: 'glow', ramp: ['#2f8a78', '#46a892', '#62c4ac', '#8adcc6'], unshaded: true }, capRot: { style: 'flat', ramp: ['#4e3420', '#5e3f27', '#6e4a2e'] },
      stem: { style: 'flat', ramp: ['#9a9078', '#aca28a', '#bcb29a'] }, rope: { style: 'hair', ramp: ['#4e4028', '#5c4c30', '#6a5838'] },
      stew: { style: 'fur', ramp: ['#3a3a18', '#46461e', '#525224', '#5e5c2a'] }, parchment: { style: 'flat', ramp: ['#8e8064', '#a09274', '#b0a284'] },
      ember: MATERIALS.ember };
    let slot = 0;
    const prop = name => { const x = slot; slot += 48; bones.push([name, null, [x, 0, 0]]); return (n, from, to, mat, extra = {}) => add(box(`${name}_${n}`, name, [from[0] + x, from[1], from[2]], [to[0] + x, to[1], to[2]], mat,
      { ...extra, origin: extra.origin ? [extra.origin[0] + x, extra.origin[1], extra.origin[2]] : undefined })); };
    const R = (rx, ry, rz, o) => ({ rotation: [rx, ry, rz], origin: o });
    const EYES = { face: 'north', palette: { k: '#120e0a' }, x: 1, y: 1, map: ['k.k', '...', '.k.'] };
    const skull = (p, n, x, y, z, s = 1, ry = 0, mat = 'bone') => {
      p(`${n}_cap`, [x - 2.5 * s, y + 1.5 * s, z - 2.5 * s], [x + 2.5 * s, y + 5 * s, z + 2.5 * s], mat, { ...R(0, ry, 0, [x, y, z]), decals: [{ ...EYES, x: Math.round(s), y: Math.round(.5 * s) }] });
      p(`${n}_jaw`, [x - 1.8 * s, y, z - 2.6 * s], [x + 1.8 * s, y + 1.6 * s, z + 1.2 * s], mat, R(0, ry, 0, [x, y, z]));
    };
    const longBone = (p, n, x, y, z, len, ry, mat = 'bone') => {
      p(`${n}`, [x - .5, y, z - len / 2], [x + .5, y + 1, z + len / 2], mat, R(0, ry, 0, [x, y, z]));
      for (const e of [-1, 1]) p(`${n}_k${e}`, [x - 1, y, z + e * len / 2 - .8], [x + 1, y + 1.5, z + e * len / 2 + .8], mat, R(0, ry, 0, [x, y, z]));
    };
    const stake = (p, n, x, z, h, rx = 0, rz = 0, mat = 'woodDark') => {
      p(n, [x - 1, 0, z - 1], [x + 1, h, z + 1], mat, R(rx, 0, rz, [x, 0, z]));
      p(`${n}_tip`, [x - .5, h, z - .5], [x + .5, h + 2.5, z + .5], mat, R(rx, 0, rz, [x, 0, z]));
    };

    // 1 Wall torch: rusty bracket on the wall (+z), a crooked stick, an oily rag head (the flame is code).
    { const p = prop('torch_wall');
      p('plate', [-2.5, 30, 6.4], [2.5, 37, 7.6], 'rust'); p('arm', [-.6, 32, 2], [.6, 33.2, 7], 'rust'); p('ring', [-1.6, 31.5, .6], [1.6, 33.6, 3.4], 'rust');
      p('stick', [-.8, 26, 1.2], [.8, 38, 2.8], 'woodDark', R(-14, 0, 0, [0, 32, 2])); p('rag', [-1.6, 37, .2], [1.6, 41, 3.4], 'soot', R(-14, 0, 0, [0, 32, 2])); }
    // 2 Fire pit: blackened stones, half-burnt logs, ash and a gnawed bone (the flame is code).
    { const p = prop('fire_pit');
      for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, x = Math.cos(a) * 12, z = Math.sin(a) * 12; p(`stone${k}`, [x - 3, 0, z - 2.5], [x + 3, 3.5 + (k % 3), z + 2.5], k % 2 ? 'rock' : 'rockDark', R(0, k * 40, 0, [x, 0, z])); }
      p('ash', [-9, 0, -9], [9, .6, 9], 'soot');
      for (let k = 0; k < 4; k++) p(`log${k}`, [-1.6, .5, -10], [1.6, 3.4, 10], k % 2 ? 'logs' : 'soot', R(18 * (k % 2 ? 1 : -1), k * 47, 0, [0, 1, 0]));
      longBone(p, 'bone', 14, 0, 9, 8, 30); }
    // 3 Mushroom cluster: pale stems, a few glowing caps, a few rotting ones.
    { const p = prop('mushrooms');
      for (const [k, x, z, h, w, glow] of [[0, 0, 0, 14, 9, 1], [1, 8, 4, 9, 6, 0], [2, -7, 5, 7, 5, 1], [3, 4, -8, 11, 7, 1], [4, -6, -6, 5, 4, 0], [5, 11, -3, 4, 3, 1]]) {
        p(`stem${k}`, [x - 1.2, 0, z - 1.2], [x + 1.2, h, z + 1.2], 'stem', R(0, 0, (k % 3 - 1) * 6, [x, 0, z]));
        p(`cap${k}`, [x - w / 2, h, z - w / 2], [x + w / 2, h + 2.2, z + w / 2], glow ? 'capGlow' : 'capRot', R(0, k * 23, (k % 3 - 1) * 6, [x, 0, z]));
        p(`top${k}`, [x - w / 3, h + 2.2, z - w / 3], [x + w / 3, h + 3.4, z + w / 3], glow ? 'capGlow' : 'capRot', R(0, k * 23, (k % 3 - 1) * 6, [x, 0, z]));
      } }
    // 4 Bone pile: skulls, ribs, long bones, filth.
    { const p = prop('bone_pile');
      p('muck', [-12, 0, -10], [12, .8, 10], 'filth');
      skull(p, 's1', -4, 0, -2, 1.2, 20); skull(p, 's2', 5, 0, 3, 1, -40, 'boneDark'); skull(p, 's3', 1, 2.5, -1, 1.1, 70);
      longBone(p, 'b1', -2, .8, 5, 12, 60); longBone(p, 'b2', 6, .8, -5, 10, -20, 'boneDark'); longBone(p, 'b3', -8, .8, -6, 9, 100); longBone(p, 'b4', 2, 1.8, 0, 11, 15);
      for (let k = 0; k < 5; k++) p(`rib${k}`, [8 + k * 1.3, 0, -1], [8.8 + k * 1.3, 4 - Math.abs(k - 2) * .6, 6], 'bone', R(-30, 10, 0, [8, 0, 2])); }
    // 5 Totem: a bark pole, crossbars hung with bone strings and rags, a horned skull with bat ears on top, ochre stripes.
    { const p = prop('totem');
      p('pole', [-2.2, 0, -2.2], [2.2, 50, 2.2], 'logs', { decals: ['north', 'south', 'east', 'west'].map(face => ({ face, palette: { o: '#7a2e1e' }, x: 0, y: 8, map: ['oooo', '....', 'oooo', '....', '....', 'oooo'] })) });
      for (const [k, y] of [[0, 30], [1, 40]]) { p(`bar${k}`, [-11 + k * 3, y, -1], [11 - k * 3, y + 2, 1], 'woodDark');
        for (const e of [-1, 1]) for (let j = 0; j < 4; j++) p(`string${k}_${e}_${j}`, [e * (9 - k * 3) - .4, y - 2 - j * 2.2, -.4], [e * (9 - k * 3) + .4, y - .2 - j * 2.2, .4], j % 2 ? 'bone' : 'boneDark'); }
      p('rag', [3, 20, -2.6], [7, 28, -2.2], 'ragRed', R(0, 0, -8, [5, 28, -2]));
      skull(p, 'skull', 0, 50, 0, 1.8);
      for (const e of [-1, 1]) { p(`ear${e}`, [e > 0 ? 3.5 : -9, 54, -.6], [e > 0 ? 9 : -3.5, 59, .6], 'hide', R(0, 0, e * 25, [e * 3.5, 54, 0]));
        p(`horn${e}`, [e * 3 - .8, 58, -.8], [e * 3 + .8, 64, .8], 'boneDark', R(0, 0, e * -20, [e * 3, 58, 0])); } }
    // 6 Altar: a stone slab on two blocks, a skull, candle stubs, old blood running down.
    { const p = prop('altar');
      for (const e of [-1, 1]) p(`foot${e}`, [e * 10 - 4, 0, -6], [e * 10 + 4, 10, 6], 'rockDark');
      p('slab', [-16, 10, -9], [16, 15, 9], 'rock', { decals: [{ face: 'north', palette: { b: '#3a1210', r: '#5a1a14' }, x: 12, y: 0, map: ['rbbr', '.bb.', '.b..', '.b..'] }, { face: 'up', palette: { b: '#3a1210', r: '#5a1a14' }, x: 8, y: 6, map: ['..rr..', '.rbbr.', 'rbbbbr', '.rbbr.'] }] });
      skull(p, 'skull', -8, 15, 0, 1.4, 15);
      for (const [k, x, z, h] of [[0, 6, -4, 4], [1, 9, 3, 3], [2, 12, -2, 5]]) { p(`candle${k}`, [x - .8, 15, z - .8], [x + .8, 15 + h, z + .8], 'fat'); p(`wick${k}`, [x - .3, 15 + h, z - .3], [x + .3, 15 + h + 1, z + .3], 'ember'); }
      longBone(p, 'bone', 2, 15, 2, 9, 70); }
    // 7 Drums: three hide drums on rough wood, bone pegs, beaters.
    { const p = prop('drums');
      for (const [k, x, z, r, h] of [[0, 0, 0, 7, 12], [1, 14, 5, 5, 9], [2, -13, 6, 5.5, 10]]) {
        for (const ry of [0, 45]) p(`body${k}_${ry}`, [x - r, 0, z - r], [x + r, h, z + r], 'woodDark', R(0, ry, 0, [x, 0, z]));
        p(`skin${k}`, [x - r + .6, h, z - r + .6], [x + r - .6, h + .6, z + r - .6], 'hide');
        for (let j = 0; j < 4; j++) { const a = j * Math.PI / 2 + .4; p(`peg${k}_${j}`, [x + Math.cos(a) * r - .5, h - 4, z + Math.sin(a) * r - .5], [x + Math.cos(a) * r + .5, h + .4, z + Math.sin(a) * r + .5], 'bone'); } }
      longBone(p, 'beater', 6, 12.6, -5, 9, 40); }
    // 8 Banner on the wall: a pole and crossbar, a stretched hide painted with the eye, bones dangling.
    { const p = prop('banner');
      p('pole', [-1, 0, 4], [1, 46, 6], 'woodDark'); p('bar', [-10, 42, 4], [10, 44, 6], 'woodDark');
      p('hide', [-9, 16, 4.6], [9, 42, 5.4], 'hide', { decals: [{ face: 'north', palette: { o: '#7a2e1e', k: '#1a1410', w: '#b4a98c' }, x: 4, y: 6, map: ['..oooooo..', '.oo....oo.', 'oo.wwww.oo', 'o.wwkkww.o', 'oo.wwww.oo', '.oo....oo.', '..oooooo..'] }] });
      for (let j = 0; j < 4; j++) p(`dangle${j}`, [-7.5 + j * 5, 11 + (j % 2) * 2, 4.7], [-6.5 + j * 5, 16, 5.3], 'bone'); }
    // 9 Bed: a heap of mangy furs and straw with a gnawed bone and rags.
    { const p = prop('bed');
      p('straw', [-14, 0, -8], [14, 2, 8], 'hay'); p('fur1', [-12, 2, -6], [6, 4.5, 6], 'furDark', R(0, 8, 0, [-3, 2, 0])); p('fur2', [-2, 2, -7], [13, 4, 4], 'hide', R(0, -12, 0, [5, 2, -1]));
      p('rag', [-13, 4, 2], [-5, 5, 7], 'rag'); longBone(p, 'bone', 9, 4, 4, 7, 30, 'boneDark'); }
    // 10 Junk heap: a broken crate, a torn sack, a cracked pot, rags and bones.
    { const p = prop('junk');
      p('crate', [-12, 0, -5], [-2, 9, 5], 'woodLight', R(0, 12, 6, [-7, 0, 0])); p('plank', [-14, 0, 6], [2, 1.2, 8.5], 'woodDark', R(0, -24, 0, [-6, 0, 7]));
      p('sack', [1, 0, -4], [9, 7, 3], 'sack', R(0, -10, -12, [5, 0, 0])); p('spill', [6, 0, 2], [13, .6, 9], 'filth');
      p('pot', [-4, 0, 5], [2, 5, 11], 'clayDark'); p('pot_rim', [-3.5, 5, 5.5], [1.5, 6, 10.5], 'clay'); p('rag', [3, 0, -9], [11, .8, -3], 'ragRed');
      skull(p, 'skull', 9, 0, 9, .9, 40, 'boneDark'); }
    // 11 Mine cart tipped over, rusted through.
    { const p = prop('cart');
      p('tub', [-10, 4, -7], [10, 16, 7], 'rust', R(0, 0, 0, [0, 0, 0])); p('rim', [-10.5, 15, -7.5], [10.5, 16.5, 7.5], 'ironDark');
      for (const e of [-1, 1]) for (const f of [-1, 1]) p(`wheel${e}${f}`, [e * 7 - 2.5, 0, f * 7.5 - .8], [e * 7 + 2.5, 5, f * 7.5 + .8], 'ironDark');
      p('ore', [-8, 16, -5], [8, 17, 5], 'rockDark'); }
    // 12 Rail segment, one cell long.
    { const p = prop('rails');
      for (const e of [-1, 1]) p(`rail${e}`, [e * 7 - .8, 1, -16], [e * 7 + .8, 2.6, 16], 'rust');
      for (let k = 0; k < 3; k++) p(`sleeper${k}`, [-10, 0, -12 + k * 12], [10, 1.2, -9 + k * 12], k === 1 ? 'logs' : 'woodDark', R(0, (k - 1) * 4, 0, [0, 0, -10.5 + k * 12])); }
    // 13 A scrap of parchment, scribbled on.
    { const p = prop('scrap');
      p('sheet', [-4, 0, -3], [4, .3, 3], 'parchment', { decals: [{ face: 'up', palette: { k: '#2a2018' }, x: 1, y: 1, map: ['kk.kkk', '......', 'kkk.kk', '......', 'k.kkk.'] }] }); p('stone', [2, 0, 1], [5, 2, 4], 'rock'); }
    // 14 Wall carving: a stone tablet scratched with tribal signs (on the wall at +z).
    { const p = prop('carving');
      p('tablet', [-12, 16, 5], [12, 36, 7.5], 'rock', { decals: [{ face: 'north', palette: { o: '#7a2e1e', k: '#1a1612' }, x: 3, y: 3, map: ['.kkk..ooo..kk.k.kk', 'k...k.o.o..k..k..k', '.kkk..ooo...kkk.kk', '..................', 'ooo.kk.k.ooo.k.kk.', 'o...k..k...o.kk.k.', 'ooo.kk.k.ooo.k.kk.'] }] }); }
    // 15 Chest: rough planks, rusty straps, a bone handle, a lock.
    { const p = prop('chest');
      p('box', [-9, 0, -6], [9, 9, 6], 'woodDark'); p('lid', [-9.3, 9, -6.3], [9.3, 12, 6.3], 'woodLight');
      for (const e of [-1, 1]) p(`strap${e}`, [e * 5.5 - 1, 0, -6.5], [e * 5.5 + 1, 12.4, 6.5], 'rust');
      p('lock', [-1.5, 6.5, -7], [1.5, 9.5, -6], 'ironDark'); for (const e of [-1, 1]) p(`handle${e}`, [e * 9 - .5 * e, 6, -1.5], [e * 9 + 1.2 * e, 7, 1.5].map((v, i) => v), 'bone'); }
    // 16 Key: a big iron key with a bone bow.
    { const p = prop('key');
      p('stem', [-3, 0, -.5], [3, 1, .5], 'ironDark'); p('bow', [-5.5, 0, -1.5], [-3, 1.2, 1.5], 'bone'); p('bit', [2, 0, .5], [3, 1, 2], 'ironDark'); }
    // 17 Cage: crooked poles lashed with rope, a lid of poles, bones hung from it.
    { const p = prop('cage');
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, x = Math.cos(a) * 14, z = Math.sin(a) * 14; p(`pole${k}`, [x - 1, 0, z - 1], [x + 1, 38, z + 1], k % 3 ? 'woodDark' : 'logs', R((k % 2 - .5) * 4, 0, (k % 3 - 1) * 3, [x, 0, z])); }
      for (const y of [6, 30]) for (const [k, from, to] of [[0, [-15, y, -15], [15, y + 1.2, -13.8]], [1, [-15, y, 13.8], [15, y + 1.2, 15]], [2, [-15, y, -15], [-13.8, y + 1.2, 15]], [3, [13.8, y, -15], [15, y + 1.2, 15]]]) p(`ring${y}_${k}`, from, to, 'rope');
      for (let k = 0; k < 4; k++) p(`lid${k}`, [-15, 38, -1 + (k - 1.5) * 7], [15, 40, 1 + (k - 1.5) * 7], 'woodDark');
      skull(p, 'skull', 0, 40, 0, 1.2); longBone(p, 'hang', 6, 26, -6, 6, 20); }
    // 18 Gates: a portcullis of sharpened stakes (iron-shod for the mine), lashed crossbars, bone charms.
    for (const [name, mat, tip] of [['gate_wood', 'logs', 'boneDark'], ['gate_iron', 'rust', 'ironDark']]) {
      const p = prop(name);
      for (let k = 0; k < 6; k++) { const x = -13.5 + k * 5.4; p(`bar${k}`, [x - 1.1, 2, -1.1], [x + 1.1, 66, 1.1], mat); p(`tip${k}`, [x - .6, 0, -.6], [x + .6, 2.5, .6], tip); }
      for (const y of [18, 46]) p(`cross${y}`, [-16, y, -1.6], [16, y + 2, 1.6], 'woodDark');
      for (const [k, x] of [[0, -8], [1, 6]]) skull(p, `charm${k}`, x, 52, -2, .8, 0); }
    // 19 Lever: a stone block with a slot; the handle is its own prop so it can turn.
    { const p = prop('lever_base'); p('block', [-5, 0, -4], [5, 14, 4], 'rockDark'); p('slot', [-1.5, 13.6, -3], [1.5, 14.2, 3], 'soot'); }
    { const p = prop('lever_handle'); p('bar', [-.8, 0, -.8], [.8, 14, .8], 'rust'); p('grip', [-1.2, 12, -1.2], [1.2, 17, 1.2], 'bone'); }
    // 20 Pull chain: a bracket on the wall (+z), a rusty chain, a ring to pull.
    { const p = prop('chain_pull');
      p('bracket', [-2, 44, 4], [2, 48, 7], 'rust');
      for (let k = 0; k < 9; k++) p(`link${k}`, [-.7, 18 + k * 3, k % 2 ? 4.8 : 4.2], [.7, 21.4 + k * 3, k % 2 ? 5.2 : 5.8], 'chain');
      p('ring', [-2.4, 13, 4.2], [2.4, 18, 5.8], 'rust'); }
    // 21 Pillar: a squat carved column, rough bands, a base and a cap (the symbol plates are code).
    { const p = prop('pillar');
      p('base', [-9, 0, -9], [9, 4, 9], 'rockDark'); p('shaft', [-7, 4, -7], [7, 34, 7], 'rock', { decals: ['north', 'south', 'east', 'west'].map(face => ({ face, palette: { k: '#2a2620' }, x: 0, y: 2, map: ['kkkkkkkkkkkkkk', '..............', '..............', '..............', '..............', '..............', '..............', '..............', '..............', '..............', '..............', '..............', '..............', '..............', '..............', '..............', '..............', '..............', '..............', '..............', '..............', '..............', '..............', '..............', '..............', 'kkkkkkkkkkkkkk'] })) });
      p('cap', [-8.5, 34, -8.5], [8.5, 38, 8.5], 'rockDark'); p('crack', [6.8, 10, -2], [7.2, 22, -1], 'soot'); }
    // 22 Brazier: a rusty bowl on three bone-lashed legs, cold coals.
    { const p = prop('brazier');
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2, x = Math.cos(a) * 5, z = Math.sin(a) * 5; p(`leg${k}`, [x - .8, 0, z - .8], [x + .8, 18, z + .8], k ? 'ironDark' : 'bone', R(Math.sin(a) * -10, 0, Math.cos(a) * 10, [x, 9, z])); }
      p('bowl', [-8, 16, -8], [8, 21, 8], 'rust'); p('bowl2', [-6, 15, -6], [6, 16, 6], 'rust'); p('coals', [-6.5, 20.4, -6.5], [6.5, 21.2, 6.5], 'soot'); }
    // 23 Pressure plate: a carved slab, a little sunk.
    { const p = prop('plate'); p('slab', [-11, 0, -11], [11, 1.6, 11], 'rock', { decals: [{ face: 'up', palette: { k: '#2a2620', o: '#6e2a1c' }, x: 6, y: 6, map: ['..kkkkk...', '.k.....k..', 'k..ooo..k.', 'k..o.o..k.', 'k..ooo..k.', '.k.....k..', '..kkkkk...'] }] }); }
    // 24 Idol: a squat goblin figure in stone, big ears, ochre eyes.
    { const p = prop('idol');
      p('body', [-3, 0, -2.5], [3, 6, 2.5], 'rock'); p('head', [-2.5, 6, -2.5], [2.5, 10, 2.5], 'rock', { decals: [{ face: 'north', palette: { o: '#9a3a24' }, x: 1, y: 1, map: ['o.o'] }] });
      for (const e of [-1, 1]) p(`ear${e}`, [e > 0 ? 2.5 : -5.5, 7, -.5], [e > 0 ? 5.5 : -2.5, 9.5, .5], 'rock', R(0, 0, e * 20, [e * 2.5, 8, 0])); }
    // 25 Socket: a pedestal with a hollow at the top (against the wall at +z).
    { const p = prop('socket');
      p('base', [-7, 0, -7], [7, 18, 7], 'rockDark'); for (const [k, from, to] of [[0, [-7, 18, -7], [7, 22, -4]], [1, [-7, 18, 4], [7, 22, 7]], [2, [-7, 18, -4], [-4, 22, 4]], [3, [4, 18, -4], [7, 22, 4]]]) p(`rim${k}`, from, to, 'rock'); p('hollow', [-4, 18, -4], [4, 18.4, 4], 'soot'); }
    // 26 Skull stake (outside the bone singers' hole): a sharpened pole, a skull, rags and feathers.
    { const p = prop('skull_stake');
      stake(p, 'pole', 0, 0, 34, 0, 4); skull(p, 'skull', -1.5, 34, 0, 1.6, 10);
      p('rag', [-3, 26, -1.6], [2, 32, -1.2], 'ragRed', R(0, 0, -10, [0, 32, 0])); for (const e of [-1, 1]) p(`feather${e}`, [e * 2 - .4, 38, -.4], [e * 2 + .4, 44, .4], 'feather', R(0, 0, e * 25, [e * 2, 38, 0])); }
    // 27 Giant mushroom (outside the fungus mothers' hole): a pale stem, a broad cap, glowing gills.
    { const p = prop('mushroom_giant');
      p('stem', [-3, 0, -3], [3, 26, 3], 'stem', R(0, 0, 4, [0, 0, 0])); p('gills', [-11, 25, -11], [11, 26.5, 11], 'capGlow'); p('cap', [-12, 26.5, -12], [12, 31, 12], 'capRot'); p('top', [-8, 31, -8], [8, 34, 8], 'capRot');
      for (const [k, x, z] of [[0, -6, 3], [1, 5, -6], [2, 7, 6]]) p(`spot${k}`, [x - 1.5, 33.6, z - 1.5], [x + 1.5, 34.2, z + 1.5], 'capGlow'); }
    // 28 Filth: dung heaps, a slick of slime, gnawed bones, a rat-chewed rag.
    { const p = prop('filth');
      p('slime', [-14, 0, -9], [10, .4, 10], 'slime'); for (const [k, x, z, s] of [[0, -6, -3, 4], [1, 4, 4, 3], [2, 8, -5, 2.5]]) { p(`dung${k}`, [x - s, 0, z - s], [x + s, s * .7, z + s], 'filth'); p(`dungtop${k}`, [x - s * .55, s * .7, z - s * .55], [x + s * .55, s * 1.15, z + s * .55], 'filth'); }
      longBone(p, 'b1', -2, .3, 6, 7, 50, 'boneDark'); longBone(p, 'b2', 9, .3, 4, 5, -30); p('rag', [-13, .3, 3], [-6, 1, 9], 'rag', R(0, 30, 0, [-9, 0, 6])); }
    // 29 Spikes: sharpened stakes driven in at angles, a barricade.
    { const p = prop('spikes');
      for (let k = 0; k < 7; k++) stake(p, `s${k}`, -15 + k * 5, (k % 2) * 3, 16 + (k % 3) * 4, -28 - (k % 2) * 8, (k % 3 - 1) * 6, k % 2 ? 'woodDark' : 'logs');
      p('lash', [-17, 6, -3], [17, 7.5, 0], 'rope'); }
    // 30 Meat rack: a frame of poles with hanging strips of meat and a hide stretched to dry.
    { const p = prop('meat_rack');
      for (const e of [-1, 1]) p(`post${e}`, [e * 14 - 1, 0, -1], [e * 14 + 1, 30, 1], 'woodDark', R(0, 0, e * -5, [e * 14, 0, 0]));
      p('beam', [-16, 28, -1], [16, 30, 1], 'logs');
      for (let k = 0; k < 6; k++) { const x = -11 + k * 4.4, len = 7 + (k % 3) * 3; p(`hook${k}`, [x - .3, 25, -.3], [x + .3, 28, .3], 'rope'); p(`meat${k}`, [x - 1.6, 25 - len, -1.2], [x + 1.6, 25, 1.2], k % 4 === 1 ? 'fat' : 'meat', R(0, k * 30, (k % 2 - .5) * 8, [x, 25, 0])); }
      p('drip', [-12, 0, -4], [12, .3, 4], 'ochre'); }
    // 31 Stew pot: a cracked cauldron on stones, a green stew, a bone ladle.
    { const p = prop('stew_pot');
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2, x = Math.cos(a) * 9, z = Math.sin(a) * 9; p(`stone${k}`, [x - 2.5, 0, z - 2.5], [x + 2.5, 3, z + 2.5], 'rockDark'); }
      p('ash', [-7, 0, -7], [7, .5, 7], 'soot');
      for (const ry of [0, 45]) p(`pot${ry}`, [-8, 3, -8], [8, 14, 8], 'ironDark', R(0, ry, 0, [0, 3, 0]));
      p('stew', [-6.6, 13, -6.6], [6.6, 13.8, 6.6], 'stew'); p('ladle', [3, 12, -1], [4, 22, 1], 'bone', R(0, 0, -25, [3.5, 12, 0])); skull(p, 'float', -2, 12.6, 1, .7, 30, 'boneDark'); }
    return { name: 'cave_props', bones, cubes, materials: M, atlasWidth: 256 };
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
    wolf, weapons, deer, fox, hare, crow, props, trees, plants, pois, cave_props: caveProps, backpack,
    ...Object.fromEntries(Object.keys(HORSES).map(v => [`horse_${v}`, () => horse(v)])),
    ...Object.fromEntries(Object.entries(GOBLIN_MODELS).map(([name, o]) => [name, () => goblin({ name, ...o })])),
  };
}

const NUM_CELLS = 16;
const OVERSCAN = 1;
const NUM_CELLS_OVERSCAN = NUM_CELLS + OVERSCAN;

const NUM_CELLS_HEIGHT = 128;
const NUM_CHUNKS_HEIGHT = NUM_CELLS_HEIGHT / NUM_CELLS;

const NUM_RENDER_GROUPS = NUM_CHUNKS_HEIGHT / 2;

const HEIGHTFIELD_DEPTH = 8;

const RANGE = 5;

const DEFAULT_SEED = 'a';

const PEEK_FACES = (() => {
  let faceIndex = 0;
  return {
    FRONT: faceIndex++,
    BACK: faceIndex++,
    LEFT: faceIndex++,
    RIGHT: faceIndex++,
    TOP: faceIndex++,
    BOTTOM: faceIndex++,
    NULL: faceIndex++,
  };
})();
const PEEK_FACE_INDICES = (() => {
  let peekIndex = 0;
  const result = new Uint8Array(8 * 8);
  result.fill(0xFF);
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      if (i !== j) {
        const otherEntry = result[j << 4 | i];
        result[i << 4 | j] = otherEntry !== 0xFF ? otherEntry : peekIndex++;
      }
    }
  }
  return result;
})();

const BIOMES = {
  "biOcean": {
    "baseHeight": 50,
    "amps": [
      [
        0.1,
        2
      ],
      [
        0.05,
        10
      ],
      [
        0.01,
        8
      ]
    ],
    "color": 0x000070
  },
  "biPlains": {
    "baseHeight": 68,
    "amps": [
      [
        0.1,
        1
      ],
      [
        0.05,
        1.5
      ],
      [
        0.01,
        4
      ]
    ],
    "color": 0x8db360
  },
  "biDesert": {
    "baseHeight": 68,
    "amps": [
      [
        0.1,
        1
      ],
      [
        0.05,
        1.5
      ],
      [
        0.01,
        4
      ]
    ],
    "color": 0xfa9418
  },
  "biExtremeHills": {
    "baseHeight": 100,
    "amps": [
      [
        0.2,
        4
      ],
      [
        0.05,
        20
      ],
      [
        0.01,
        16
      ]
    ],
    "color": 0x606060
  },
  "biForest": {
    "baseHeight": 70,
    "amps": [
      [
        0.1,
        1
      ],
      [
        0.05,
        2
      ],
      [
        0.01,
        4
      ]
    ],
    "color": 0x056621
  },
  "biTaiga": {
    "baseHeight": 70,
    "amps": [
      [
        0.1,
        1
      ],
      [
        0.05,
        2
      ],
      [
        0.01,
        4
      ]
    ],
    "color": 0x0b6659
  },
  "biSwampland": {
    "baseHeight": 61.5,
    "amps": [
      [
        0.1,
        1.1
      ],
      [
        0.05,
        1.5
      ],
      [
        0.02,
        2.5
      ]
    ],
    "color": 0x2fffda
  },
  "biRiver": {
    "baseHeight": 56,
    "amps": [
      [
        0.2,
        0.1
      ],
      [
        0.05,
        0.1
      ],
      [
        0.01,
        0.1
      ]
    ],
    "color": 0x3030af
  },
  "biNether": {
    "baseHeight": 0,
    "amps": [
      [
        0.1,
        0
      ],
      [
        0.01,
        0
      ],
      [
        0.01,
        0
      ]
    ],
    "color": 0x7f0000
  },
  "biEnd": {
    "baseHeight": 0,
    "amps": [
      [
        0.1,
        0
      ],
      [
        0.01,
        0
      ],
      [
        0.01,
        0
      ]
    ],
    "color": 0x007fff
  },
  "biFrozenOcean": {
    "baseHeight": 40,
    "amps": [
      [
        0.1,
        2
      ],
      [
        0.05,
        12
      ],
      [
        0.01,
        10
      ]
    ],
    "color": 0xa0a0df
  },
  "biFrozenRiver": {
    "baseHeight": 56,
    "amps": [
      [
        0.2,
        0.1
      ],
      [
        0.05,
        0.1
      ],
      [
        0.01,
        0.1
      ]
    ],
    "color": 0xa0a0ff
  },
  "biTundra": {
    "baseHeight": 68,
    "amps": [
      [
        0.1,
        1
      ],
      [
        0.05,
        1.5
      ],
      [
        0.01,
        4
      ]
    ],
    "color": 0xffffff
  },
  "biIceMountains": {
    "baseHeight": 80,
    "amps": [
      [
        0.2,
        2
      ],
      [
        0.05,
        10
      ],
      [
        0.01,
        8
      ]
    ],
    "color": 0xa0a0a0
  },
  "biMushroomIsland": {
    "baseHeight": 80,
    "amps": [
      [
        0.1,
        2
      ],
      [
        0.05,
        8
      ],
      [
        0.01,
        6
      ]
    ],
    "color": 0xff00ff
  },
  "biMushroomShore": {
    "baseHeight": 64,
    "amps": [
      [
        0.1,
        1
      ],
      [
        0.05,
        2
      ],
      [
        0.01,
        4
      ]
    ],
    "color": 0xa000ff
  },
  "biBeach": {
    "baseHeight": 64,
    "amps": [
      [
        0.1,
        0.5
      ],
      [
        0.05,
        1
      ],
      [
        0.01,
        1
      ]
    ],
    "color": 0xfade55
  },
  "biDesertHills": {
    "baseHeight": 75,
    "amps": [
      [
        0.2,
        2
      ],
      [
        0.05,
        5
      ],
      [
        0.01,
        4
      ]
    ],
    "color": 0xd25f12
  },
  "biForestHills": {
    "baseHeight": 80,
    "amps": [
      [
        0.2,
        2
      ],
      [
        0.05,
        12
      ],
      [
        0.01,
        10
      ]
    ],
    "color": 0x22551c
  },
  "biTaigaHills": {
    "baseHeight": 80,
    "amps": [
      [
        0.2,
        2
      ],
      [
        0.05,
        12
      ],
      [
        0.01,
        10
      ]
    ],
    "color": 0x163933
  },
  "biExtremeHillsEdge": {
    "baseHeight": 80,
    "amps": [
      [
        0.2,
        3
      ],
      [
        0.05,
        16
      ],
      [
        0.01,
        12
      ]
    ],
    "color": 0x7f8f7f
  },
  "biJungle": {
    "baseHeight": 70,
    "amps": [
      [
        0.1,
        3
      ],
      [
        0.05,
        6
      ],
      [
        0.01,
        6
      ]
    ],
    "color": 0x537b09
  },
  "biJungleHills": {
    "baseHeight": 80,
    "amps": [
      [
        0.2,
        3
      ],
      [
        0.05,
        12
      ],
      [
        0.01,
        10
      ]
    ],
    "color": 0x2c4205
  },
  "biJungleEdge": {
    "baseHeight": 70,
    "amps": [
      [
        0.1,
        3
      ],
      [
        0.05,
        6
      ],
      [
        0.01,
        6
      ]
    ],
    "color": 0x628b17
  },
  "biDeepOcean": {
    "baseHeight": 40,
    "amps": [
      [
        0.1,
        2
      ],
      [
        0.05,
        12
      ],
      [
        0.01,
        10
      ]
    ],
    "color": 0x000030
  },
  "biStoneBeach": {
    "baseHeight": 40,
    "amps": [
      [
        0.1,
        2
      ],
      [
        0.05,
        12
      ],
      [
        0.01,
        10
      ]
    ],
    "color": 0xa2a284
  },
  "biColdBeach": {
    "baseHeight": 64,
    "amps": [
      [
        0.1,
        0.5
      ],
      [
        0.05,
        1
      ],
      [
        0.01,
        1
      ]
    ],
    "color": 0xfaf0c0
  },
  "biBirchForest": {
    "baseHeight": 70,
    "amps": [
      [
        0.1,
        1
      ],
      [
        0.05,
        2
      ],
      [
        0.01,
        4
      ]
    ],
    "color": 0x307444
  },
  "biBirchForestHills": {
    "baseHeight": 80,
    "amps": [
      [
        0.2,
        2
      ],
      [
        0.05,
        10
      ],
      [
        0.01,
        8
      ]
    ],
    "color": 0x1f5f32
  },
  "biRoofedForest": {
    "baseHeight": 70,
    "amps": [
      [
        0.1,
        1
      ],
      [
        0.05,
        2
      ],
      [
        0.01,
        4
      ]
    ],
    "color": 0x40511a
  },
  "biColdTaiga": {
    "baseHeight": 70,
    "amps": [
      [
        0.1,
        1
      ],
      [
        0.05,
        2
      ],
      [
        0.01,
        4
      ]
    ],
    "color": 0x31554a
  },
  "biColdTaigaHills": {
    "baseHeight": 80,
    "amps": [
      [
        0.2,
        2
      ],
      [
        0.05,
        10
      ],
      [
        0.01,
        8
      ]
    ],
    "color": 0x597d72
  },
  "biMegaTaiga": {
    "baseHeight": 70,
    "amps": [
      [
        0.1,
        1
      ],
      [
        0.05,
        2
      ],
      [
        0.01,
        4
      ]
    ],
    "color": 0x596651
  },
  "biMegaTaigaHills": {
    "baseHeight": 80,
    "amps": [
      [
        0.2,
        2
      ],
      [
        0.05,
        10
      ],
      [
        0.01,
        8
      ]
    ],
    "color": 0x596659
  },
  "biExtremeHillsPlus": {
    "baseHeight": 120,
    "amps": [
      [
        0.2,
        4
      ],
      [
        0.05,
        20
      ],
      [
        0.01,
        16
      ]
    ],
    "color": 0x507050
  },
  "biSavanna": {
    "baseHeight": 68,
    "amps": [
      [
        0.1,
        1
      ],
      [
        0.05,
        1.5
      ],
      [
        0.01,
        4
      ]
    ],
    "color": 0xbdb25f
  },
  "biSavannaPlateau": {
    "baseHeight": 80,
    "amps": [
      [
        0.1,
        1
      ],
      [
        0.05,
        1.5
      ],
      [
        0.01,
        4
      ]
    ],
    "color": 0xa79d64
  },
  "biMesa": {
    "baseHeight": 70,
    "amps": [
      [
        0.2,
        2
      ],
      [
        0.05,
        10
      ],
      [
        0.01,
        8
      ]
    ],
    "color": 0xd94515
  },
  "biMesaPlateauF": {
    "baseHeight": 80,
    "amps": [
      [
        0.1,
        1
      ],
      [
        0.05,
        1.5
      ],
      [
        0.01,
        4
      ]
    ],
    "color": 0xb09765
  },
  "biMesaPlateau": {
    "baseHeight": 80,
    "amps": [
      [
        0.1,
        1
      ],
      [
        0.05,
        1.5
      ],
      [
        0.01,
        4
      ]
    ],
    "color": 0xca8c65
  },
  "biSunflowerPlains": {
    "baseHeight": 40,
    "amps": [
      [
        0.1,
        2
      ],
      [
        0.05,
        12
      ],
      [
        0.01,
        10
      ]
    ],
    "color": 0xb5db88
  },
  "biDesertM": {
    "baseHeight": 40,
    "amps": [
      [
        0.1,
        2
      ],
      [
        0.05,
        12
      ],
      [
        0.01,
        10
      ]
    ],
    "color": 0xffbc40
  },
  "biExtremeHillsM": {
    "baseHeight": 40,
    "amps": [
      [
        0.1,
        2
      ],
      [
        0.05,
        12
      ],
      [
        0.01,
        10
      ]
    ],
    "color": 0x888888
  },
  "biFlowerForest": {
    "baseHeight": 40,
    "amps": [
      [
        0.1,
        2
      ],
      [
        0.05,
        12
      ],
      [
        0.01,
        10
      ]
    ],
    "color": 0x2d8e49
  },
  "biTaigaM": {
    "baseHeight": 40,
    "amps": [
      [
        0.1,
        2
      ],
      [
        0.05,
        12
      ],
      [
        0.01,
        10
      ]
    ],
    "color": 0x338e81
  },
  "biSwamplandM": {
    "baseHeight": 60,
    "amps": [
      [
        1,
        3
      ],
      [
        1.1,
        7
      ],
      [
        0.01,
        0.01
      ]
    ],
    "color": 0x07f9b2
  },
  "biIcePlainsSpikes": {
    "baseHeight": 40,
    "amps": [
      [
        0.1,
        2
      ],
      [
        0.05,
        12
      ],
      [
        0.01,
        10
      ]
    ],
    "color": 0xb4dcdc
  },
  "biJungleM": {
    "baseHeight": 70,
    "amps": [
      [
        0.1,
        3
      ],
      [
        0.05,
        6
      ],
      [
        0.01,
        6
      ]
    ],
    "color": 0x7ba331
  },
  "biJungleEdgeM": {
    "baseHeight": 70,
    "amps": [
      [
        0.1,
        3
      ],
      [
        0.05,
        6
      ],
      [
        0.01,
        6
      ]
    ],
    "color": 0x628b17
  },
  "biBirchForestM": {
    "baseHeight": 70,
    "amps": [
      [
        0.1,
        1
      ],
      [
        0.05,
        2
      ],
      [
        0.01,
        4
      ]
    ],
    "color": 0x589c6c
  },
  "biBirchForestHillsM": {
    "baseHeight": 80,
    "amps": [
      [
        0.2,
        2
      ],
      [
        0.05,
        10
      ],
      [
        0.01,
        8
      ]
    ],
    "color": 0x47875a
  },
  "biRoofedForestM": {
    "baseHeight": 70,
    "amps": [
      [
        0.1,
        1
      ],
      [
        0.05,
        2
      ],
      [
        0.01,
        4
      ]
    ],
    "color": 0x687942
  },
  "biColdTaigaM": {
    "baseHeight": 70,
    "amps": [
      [
        0.1,
        1
      ],
      [
        0.05,
        2
      ],
      [
        0.01,
        4
      ]
    ],
    "color": 0x243f36
  },
  "biMegaSpruceTaiga": {
    "baseHeight": 70,
    "amps": [
      [
        0.1,
        1
      ],
      [
        0.05,
        2
      ],
      [
        0.01,
        4
      ]
    ],
    "color": 0x454f3e
  },
  "biMegaSpruceTaigaHills": {
    "baseHeight": 80,
    "amps": [
      [
        0.2,
        2
      ],
      [
        0.05,
        10
      ],
      [
        0.01,
        8
      ]
    ],
    "color": 0x454f4e
  },
  "biExtremeHillsPlusM": {
    "baseHeight": 120,
    "amps": [
      [
        0.2,
        4
      ],
      [
        0.05,
        20
      ],
      [
        0.01,
        16
      ]
    ],
    "color": 0x789878
  },
  "biSavannaM": {
    "baseHeight": 68,
    "amps": [
      [
        0.1,
        1
      ],
      [
        0.05,
        1.5
      ],
      [
        0.01,
        4
      ]
    ],
    "color": 0xe5da87
  },
  "biSavannaPlateauM": {
    "baseHeight": 80,
    "amps": [
      [
        0.1,
        1
      ],
      [
        0.05,
        1.5
      ],
      [
        0.01,
        4
      ]
    ],
    "color": 0xa79d74
  },
  "biMesaBryce": {
    "baseHeight": 80,
    "amps": [
      [
        0.2,
        2
      ],
      [
        0.1,
        30
      ],
      [
        0.01,
        8
      ]
    ],
    "color": 0xff6d3d
  },
  "biMesaPlateauFM": {
    "baseHeight": 80,
    "amps": [
      [
        0.1,
        1
      ],
      [
        0.05,
        1.5
      ],
      [
        0.01,
        4
      ]
    ],
    "color": 0xd8bf8d
  },
  "biMesaPlateauM": {
    "baseHeight": 80,
    "amps": [
      [
        0.1,
        1
      ],
      [
        0.05,
        1.5
      ],
      [
        0.01,
        4
      ]
    ],
    "color": 0xf2b48d
  }
};
let biomeIndex = 0;
for (const k in BIOMES) {
  BIOMES[k].index = biomeIndex++;
}

const BIOMES_TH = [
		//       0         1         2               3               4               5               6         7         8         9         10              11              12              13              14             15
		/*  0 */ "biTundra", "biTundra", "biTundra",       "biTundra",       "biPlains",       "biPlains",       "biPlains", "biPlains", "biPlains", "biPlains", "biDesert",       "biDesert",      "biDesert",       "biDesert",       "biDesert",      "biDesert",
		/*  1 */ "biTundra", "biTundra", "biTundra",       "biTundra",       "biPlains",       "biPlains",       "biPlains", "biPlains", "biPlains", "biPlains", "biDesert",       "biDesert",      "biDesert",       "biDesert",       "biDesert",      "biDesert",
		/*  2 */ "biTundra", "biTundra", "biTundra",       "biTundra",       "biPlains",       "biExtremeHills", "biPlains", "biPlains", "biPlains", "biPlains", "biDesert",       "biDesert",      "biDesertHills",  "biDesertHills",  "biDesert",      "biDesert",
		/*  3 */ "biTundra", "biTundra", "biTundra",       "biTundra",       "biExtremeHills", "biExtremeHills", "biPlains", "biPlains", "biPlains", "biPlains", "biDesert",       "biDesert",      "biDesertHills",  "biDesertHills",  "biDesert",      "biDesert",
		/*  4 */ "biTundra", "biTundra", "biIceMountains", "biIceMountains", "biExtremeHills", "biExtremeHills", "biPlains", "biPlains", "biPlains", "biPlains", "biForestHills",  "biForestHills", "biExtremeHills", "biExtremeHills", "biDesertHills", "biDesert",
		/*  5 */ "biTundra", "biTundra", "biIceMountains", "biIceMountains", "biExtremeHills", "biExtremeHills", "biPlains", "biPlains", "biPlains", "biPlains", "biForestHills",  "biForestHills", "biExtremeHills", "biExtremeHills", "biDesertHills", "biDesert",
		/*  6 */ "biTundra", "biTundra", "biIceMountains", "biIceMountains", "biForestHills",  "biForestHills",  "biForest", "biForest", "biForest", "biForest", "biForest",       "biForestHills", "biExtremeHills", "biExtremeHills", "biPlains",      "biPlains",
		/*  7 */ "biTundra", "biTundra", "biIceMountains", "biIceMountains", "biForestHills",  "biForestHills",  "biForest", "biForest", "biForest", "biForest", "biForest",       "biForestHills", "biExtremeHills", "biExtremeHills", "biPlains",      "biPlains",
		/*  8 */ "biTundra", "biTundra", "biTaiga",        "biTaiga",        "biForest",       "biForest",       "biForest", "biForest", "biForest", "biForest", "biForest",       "biForestHills", "biExtremeHills", "biExtremeHills", "biPlains",      "biPlains",
		/*  9 */ "biTundra", "biTundra", "biTaiga",        "biTaiga",        "biForest",       "biForest",       "biForest", "biForest", "biForest", "biForest", "biForest",       "biForestHills", "biExtremeHills", "biExtremeHills", "biPlains",      "biPlains",
		/* 10 */ "biTaiga",  "biTaiga",  "biTaiga",        "biIceMountains", "biForestHills",  "biForestHills",  "biForest", "biForest", "biForest", "biForest", "biJungle",       "biJungle",      "biSwampland",    "biSwampland",    "biSwampland",   "biSwampland",
		/* 11 */ "biTaiga",  "biTaiga",  "biIceMountains", "biIceMountains", "biExtremeHills", "biForestHills",  "biForest", "biForest", "biForest", "biForest", "biJungle",       "biJungle",      "biSwampland",    "biSwampland",    "biSwampland",   "biSwampland",
		/* 12 */ "biTaiga",  "biTaiga",  "biIceMountains", "biIceMountains", "biExtremeHills", "biJungleHills",  "biJungle", "biJungle", "biJungle", "biJungle", "biJungle",       "biJungle",      "biSwampland",    "biSwampland",    "biSwampland",   "biSwampland",
		/* 13 */ "biTaiga",  "biTaiga",  "biTaiga",        "biIceMountains", "biJungleHills",  "biJungleHills",  "biJungle", "biJungle", "biJungle", "biJungle", "biJungle",       "biJungle",      "biSwampland",    "biSwampland",    "biSwampland",   "biSwampland",
		/* 14 */ "biTaiga",  "biTaiga",  "biTaiga",        "biTaiga",        "biJungle",       "biJungle",       "biJungle", "biJungle", "biJungle", "biJungle", "biJungle",       "biJungle",      "biSwampland",    "biSwampland",    "biSwampland",   "biSwampland",
		/* 15 */ "biTaiga",  "biTaiga",  "biTaiga",        "biTaiga",        "biJungle",       "biJungle",       "biJungle", "biJungle", "biJungle", "biJungle", "biJungle",       "biJungle",      "biSwampland",    "biSwampland",    "biSwampland",   "biSwampland",
].map(k => BIOMES[k]);

module.exports = {
  NUM_CELLS,
  OVERSCAN,
  NUM_CELLS_OVERSCAN,

  NUM_CELLS_HEIGHT,
  NUM_CHUNKS_HEIGHT,

  NUM_RENDER_GROUPS,

  HEIGHTFIELD_DEPTH,

  RANGE,

  DEFAULT_SEED,

  PEEK_FACES,
  PEEK_FACE_INDICES,

  BIOMES,
  BIOMES_TH,
};

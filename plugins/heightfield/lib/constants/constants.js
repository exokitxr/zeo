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
    "color": 112,
    "index": 0
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
    "color": 9286496,
    "index": 1
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
    "color": 16421912,
    "index": 2
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
    "color": 6316128,
    "index": 3
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
    "color": 353825,
    "index": 4
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
    "color": 747097,
    "index": 5
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
    "color": 3145690,
    "index": 6
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
    "color": 3158191,
    "index": 7
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
    "color": 8323072,
    "index": 8
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
    "color": 32767,
    "index": 9
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
    "color": 10526943,
    "index": 10
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
    "color": 10526975,
    "index": 11
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
    "color": 16777215,
    "index": 12
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
    "color": 10526880,
    "index": 13
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
    "color": 16711935,
    "index": 14
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
    "color": 10486015,
    "index": 15
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
    "color": 16440917,
    "index": 16
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
    "color": 13786898,
    "index": 17
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
    "color": 2250012,
    "index": 18
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
    "color": 1456435,
    "index": 19
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
    "color": 8359807,
    "index": 20
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
    "color": 5470985,
    "index": 21
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
    "color": 2900485,
    "index": 22
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
    "color": 6458135,
    "index": 23
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
    "color": 48,
    "index": 24
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
    "color": 10658436,
    "index": 25
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
    "color": 16445632,
    "index": 26
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
    "color": 3175492,
    "index": 27
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
    "color": 2055986,
    "index": 28
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
    "color": 4215066,
    "index": 29
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
    "color": 3233098,
    "index": 30
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
    "color": 5864818,
    "index": 31
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
    "color": 5858897,
    "index": 32
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
    "color": 5858905,
    "index": 33
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
    "color": 5271632,
    "index": 34
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
    "color": 12431967,
    "index": 35
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
    "color": 10984804,
    "index": 36
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
    "color": 14238997,
    "index": 37
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
    "color": 11573093,
    "index": 38
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
    "color": 13274213,
    "index": 39
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
    "color": 11918216,
    "index": 40
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
    "color": 16759872,
    "index": 41
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
    "color": 8947848,
    "index": 42
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
    "color": 2985545,
    "index": 43
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
    "color": 3378817,
    "index": 44
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
    "color": 522674,
    "index": 45
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
    "color": 11853020,
    "index": 46
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
    "color": 8102705,
    "index": 47
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
    "color": 6458135,
    "index": 48
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
    "color": 5807212,
    "index": 49
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
    "color": 4687706,
    "index": 50
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
    "color": 6846786,
    "index": 51
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
    "color": 2375478,
    "index": 52
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
    "color": 4542270,
    "index": 53
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
    "color": 4542286,
    "index": 54
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
    "color": 7903352,
    "index": 55
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
    "color": 15063687,
    "index": 56
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
    "color": 10984820,
    "index": 57
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
    "color": 16739645,
    "index": 58
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
    "color": 14204813,
    "index": 59
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
    "color": 15905933,
    "index": 60
  }
};

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

biomes = BIOMES;

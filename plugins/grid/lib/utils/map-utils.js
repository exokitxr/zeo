import indev from 'indev';

import {
  NUM_CELLS,
} from '../constants/grid';

export class Point {
  constructor(
    elevation = 0,
    moisture = 0,
    land = false,
    water = false,
    ocean = false,
    lake = false,
    lava = 0,
    biome = null
  ) {
    this.elevation = elevation;
    this.moisture = moisture;
    this.land = land;
    this.water = water;
    this.ocean = ocean;
    this.lake = lake;
    this.lava = lava;
    this.biome = biome;
  }
}
class Chunk {
  constructor(position, points) {
    this.position = position;
    this.points = points;
  }
}

const makeUtils = ({rng}) => {

const BIOME_COLORS = {
  // Features
  OCEAN: 0x44447a,
  // OCEAN: 0x000000,
  // COAST: 0x33335a,
  COAST: 0x333333,
  LAKESHORE: 0x225588,
  LAKE: 0x336699,
  RIVER: 0x225588,
  MARSH: 0x2f6666,
  // ICE: 0x99ffff,
  ICE: 0x99dddd,
  // BEACH: 0xa09077,
  BEACH: 0xa0b077,
  ROAD1: 0x442211,
  ROAD2: 0x553322,
  ROAD3: 0x664433,
  BRIDGE: 0x686860,
  LAVA: 0xcc3333,

  // Terrain
  SNOW: 0xffffff,
  TUNDRA: 0xbbbbaa,
  BARE: 0x888888,
  SCORCHED: 0x555555,
  TAIGA: 0x99aa77,
  SHRUBLAND: 0x889977,
  TEMPERATE_DESERT: 0xc9d29b,
  TEMPERATE_RAIN_FOREST: 0x448855,
  TEMPERATE_DECIDUOUS_FOREST: 0x679459,
  GRASSLAND: 0x88aa55,
  SUBTROPICAL_DESERT: 0xd2b98b,
  TROPICAL_RAIN_FOREST: 0x337755,
  TROPICAL_SEASONAL_FOREST: 0x559944,
  MAGMA: 0xff3333,
};

const DIRECTIONS = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];
const _random = (() => {
  const generator = indev({
    random: rng,
  });
  const elevationNoise = generator.uniform({
    frequency: 0.008,
    octaves: 8,
  });
  const moistureNoise = generator.uniform({
    frequency: 0.005,
    octaves: 2,
  });

  return {
    elevationNoise,
    moistureNoise,
  };
})();

const getCoordIndex = (x, y) => x + (y * NUM_CELLS);
const makeMapChunk = ({position}) => {
  const points = (() => {
    const points = Array(NUM_CELLS * NUM_CELLS);

    for (let y = 0; y < NUM_CELLS; y++) {
      for (let x = 0; x < NUM_CELLS; x++) {
        const index = getCoordIndex(x, y);
 
        const dx = position.x + x;
        const dy = position.y + y;
        const elevation = (() => {
          const h = _random.elevationNoise.in2D(dx, dy);
          const scaleFactor = 1;
          const powFactor = 0.3;
          const normalizedH = Math.pow(scaleFactor, powFactor) - Math.pow(scaleFactor * (1 - h), powFactor);
          return (normalizedH * 18) - 6;
        })();
        const moisture = _random.moistureNoise.in2D(x, y);
        const land = elevation > 0;
        const water = !land;
        const point = new Point(
          elevation,
          moisture,
          land,
          water
        );

        points[index] = point;
      }
    }

    const _flood = (x, y, floodSeenIndex, fn) => {
      const nextPoints = [
        [x, y]
      ];

      while (nextPoints.length > 0) {
        const nextPoint = nextPoints.pop();
        const [x, y] = nextPoint;
        const index = getCoordIndex(x, y);

        if (!floodSeenIndex[index]) {
          const potentialNextPoints = fn(x, y, index);
          nextPoints.push.apply(nextPoints, potentialNextPoints);

          floodSeenIndex[index] = true;
        }
      }
    };

    const floodOceanSeenIndex = {};
    const _startFloodOcean = (x, y) => {
      const _isOcean = p => p.water;

      const index = getCoordIndex(x, y);
      const point = points[index];
      if (_isOcean(point)) {
        _flood(x, y, floodOceanSeenIndex, (x, y, index) => {
          const point = points[index];
          point.ocean = true;

          const nextPoints = [];
          for (let i = 0; i < DIRECTIONS.length; i++) {
            const direction = DIRECTIONS[i];
            const dx = x + direction[0];
            const dy = y + direction[1];
            if (dx >= 0 && dx < NUM_CELLS && dy >= 0 && dy < NUM_CELLS) {
              const neighborPointIndex = getCoordIndex(dx, dy);
              const neighborPoint = points[neighborPointIndex];
              if (_isOcean(neighborPoint)) {
                nextPoints.push([dx, dy]);
              }
            }
          }
          return nextPoints;
        });
      }
    };

    const floodLakeSeenIndex = {};
    const _startFloodLake = (x, y) => {
      const _isLake = p => p.water && !p.ocean;

      const index = getCoordIndex(x, y);
      const point = points[index];
      if (_isLake(point)) {
        _flood(x, y, floodLakeSeenIndex, (x, y, index) => {
          const point = points[index];
          point.lake = true;

          const nextPoints = [];
          for (let i = 0; i < DIRECTIONS.length; i++) {
            const direction = DIRECTIONS[i];
            const dx = x + direction[0];
            const dy = y + direction[1];
            if (dx >= 0 && dx < NUM_CELLS && dy >= 0 && dy < NUM_CELLS) {
              const neighborPointIndex = getCoordIndex(dx, dy);
              const neighborPoint = points[neighborPointIndex];
              if (_isLake(neighborPoint)) {
                nextPoints.push([dx, dy]);
              }
            }
          }
          return nextPoints;
        });
      }
    };

    // flood fill oceans + lakes
    for (let y = 0; y < NUM_CELLS; y++) {
      for (let x = 0; x < NUM_CELLS; x++) {
        if (x === 0 || x === (NUM_CELLS - 1) || y === 0 || y === (NUM_CELLS - 1)) {
          _startFloodOcean(x, y);
        }
        _startFloodLake(x, y);
      }
    }

    // XXX assign lava

    // assign biomes
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      point.biome = _getBiome(point);
    }

    return points;
  })();

  return new Chunk(
    position,
    points
  );
};
const getBiomeColor = biome => BIOME_COLORS[biome];

const _getBiome = p => {
  if (p.coast) {
    return 'BEACH';
  } else if (p.ocean) {
    return 'OCEAN';
  } else if (p.water) {
    if (p.elevation < 1) { return 'MARSH'; }
    if (p.elevation > 6) { return 'ICE'; }
    return 'LAKE';
  } else if (p.lava > 2) {
    return 'MAGMA';
  } else if (p.elevation > 7) {
    if (p.moisture > 0.50) { return 'SNOW'; }
    else if (p.moisture > 0.33) { return 'TUNDRA'; }
    else if (p.moisture > 0.16) { return 'BARE'; }
    else { return 'SCORCHED'; }
  } else if (p.elevation > 5) {
    if (p.moisture > 0.66) { return 'TAIGA'; }
    else if (p.moisture > 0.33) { return 'SHRUBLAND'; }
    else { return 'TEMPERATE_DESERT'; }
  } else if (p.elevation > 3) {
    if (p.moisture > 0.83) { return 'TEMPERATE_RAIN_FOREST'; }
    else if (p.moisture > 0.50) { return 'TEMPERATE_DECIDUOUS_FOREST'; }
    else if (p.moisture > 0.16) { return 'GRASSLAND'; }
    else { return 'TEMPERATE_DESERT'; }
  } else {
    if (p.moisture > 0.66) { return 'TROPICAL_RAIN_FOREST'; }
    else if (p.moisture > 0.33) { return 'TROPICAL_SEASONAL_FOREST'; }
    else if (p.moisture > 0.16) { return 'GRASSLAND'; }
    else { return 'SUBTROPICAL_DESERT'; }
  }
};

return {
  getCoordIndex,
  makeMapChunk,
  getBiomeColor,
};

};

const api = {
  makeUtils,
};
export default api;

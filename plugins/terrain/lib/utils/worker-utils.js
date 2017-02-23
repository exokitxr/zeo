import isosurface from 'isosurface';
import indev from 'indev';

import {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,
  DEFAULT_SEED,
} from '../constants/constants';
import {MapPoint} from '../records/records';

const getApi = ({alea}) => {

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
  const rng = new alea(DEFAULT_SEED);
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

const buildMapChunk = ({offset, position}) => {
  const points = (() => {
    const points = Array(NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN);

    for (let y = 0; y < NUM_CELLS_OVERSCAN; y++) {
      for (let x = 0; x < NUM_CELLS_OVERSCAN; x++) {
        const index = _getCoordOverscanIndex(x, y);
  
        const mapCoords = _getMapCoords(position.x + x, position.y + y);
        const [dx, dy] = mapCoords;
        const elevation = (() => {
          const y = _random.elevationNoise.in2D(dx, dy);
          const scaleFactor = 1;
          const powFactor = 0.3;
          const x = Math.pow(scaleFactor, powFactor) - Math.pow(scaleFactor * (1 - y), powFactor);
          return (x * 18) - 6;
        })();
        const moisture = _random.moistureNoise.in2D(dx, dy);
        const land = elevation > 0;
        const water = !land;
        const point = new MapPoint(
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
        const index = _getCoordOverscanIndex(x, y);

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

      const index = _getCoordOverscanIndex(x, y);
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
            if (dx >= 0 && dx < NUM_CELLS_OVERSCAN && dy >= 0 && dy < NUM_CELLS_OVERSCAN) {
              const neighborPointIndex = _getCoordOverscanIndex(dx, dy);
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

      const index = _getCoordOverscanIndex(x, y);
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
            if (dx >= 0 && dx < NUM_CELLS_OVERSCAN && dy >= 0 && dy < NUM_CELLS_OVERSCAN) {
              const neighborPointIndex = _getCoordOverscanIndex(dx, dy);
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
    for (let y = 0; y < NUM_CELLS_OVERSCAN; y++) {
      for (let x = 0; x < NUM_CELLS_OVERSCAN; x++) {
        if (x === 0 || x === (NUM_CELLS_OVERSCAN - 1) || y === 0 || y === (NUM_CELLS_OVERSCAN - 1)) {
          _startFloodOcean(x, y);
        }
        _startFloodLake(x, y);
      }
    }

    // XXX assign lava

    return points;
  })();

  const caves = new Float32Array(NUM_CELLS_OVERSCAN * (NUM_CELLS_OVERSCAN * 2) * NUM_CELLS_OVERSCAN);

  return {
    offset,
    position,
    points,
    caves
  };
};

const compileMapChunk = mapChunk => {
  const {offset, position, points, caves} = mapChunk;
  const mapChunkUpdate = recompileMapChunk(mapChunk);
  const {positions, normals, colors, heightField} = mapChunkUpdate;

  return {
    offset,
    position,
    points,
    caves,
    positions,
    normals,
    colors,
    heightField,
  };
};

const recompileMapChunk = mapChunk => {
  const {offset, position, points, caves} = mapChunk;

  const cubes = isosurface.marchingCubes([ NUM_CELLS_OVERSCAN, NUM_CELLS_OVERSCAN * 2, NUM_CELLS_OVERSCAN ], (x, y, z) => {
    const index = _getCoordOverscanIndex(x, z);
    const point = points[index];
    const {elevation} = point;
    const normalizedElevation = _normalizeElevation(elevation);

    let value = -1;
    for (let dy = y - 1 + ((1/8) / 2); dy <= y + 1 - ((1/8) / 2); dy += 1/8) {
      if (dy >= normalizedElevation) {
        value += 1/8;
      }
    }

    if (caves.length > 0) {
      const caveIndex = _getCaveIndex(x, y, z);
      const cave = caves[caveIndex];
      if (cave !== 0) {
        value += cave * 2;
      }
    }

    return value;
  }, [
    [ 0, -NUM_CELLS_OVERSCAN, 0 ],
    [ NUM_CELLS_OVERSCAN, NUM_CELLS_OVERSCAN, NUM_CELLS_OVERSCAN ],
  ]);
  const {positions: cubePositions, cells: cubeCells} = cubes;
  const numCells = cubeCells.length;

  const positions = new Float32Array(numCells * 3 * 3);
  const colors = new Float32Array(numCells * 3 * 3);
  for (let i = 0; i < numCells; i++) {
    const cell = cubeCells[i];
    const [fa, fb, fc] = cell;
    const va = cubePositions[fa];
    const vb = cubePositions[fb];
    const vc = cubePositions[fc];

    positions[(i * 9) + 0] = position.x + va[0];
    positions[(i * 9) + 1] = va[1];
    positions[(i * 9) + 2] = position.y + va[2];

    positions[(i * 9) + 3] = position.x + vb[0];
    positions[(i * 9) + 4] = vb[1];
    positions[(i * 9) + 5] = position.y + vb[2];

    positions[(i * 9) + 6] = position.x + vc[0];
    positions[(i * 9) + 7] = vc[1];
    positions[(i * 9) + 8] = position.y + vc[2];

    const paIndex = _getCoordOverscanIndex(Math.round(va[0]), Math.round(va[2]));
    const pa = points[paIndex];
    const pbIndex = _getCoordOverscanIndex(Math.round(vb[0]), Math.round(vb[2]));
    const pb = points[pbIndex];
    const pcIndex = _getCoordOverscanIndex(Math.round(vc[0]), Math.round(vc[2]));
    const pc = points[pcIndex];

    const positionElevation = (va[1] + vb[1] + vc[1]) / 3;
    const pointElevation = (pa.elevation + pb.elevation + pc.elevation) / 3;
    const normalizedPointElevation = _normalizeElevation(pointElevation);
    const colorInt = (() => {
      if (positionElevation > (normalizedPointElevation - 0.5)) {
        const biome = _getTriangleBiome(pa, pb, pc);
        return BIOME_COLORS[biome];
      } else {
        return 0x888888;
      }
    })();
    const colorArray = new THREE.Color(colorInt).toArray();

    colors[(i * 9) + 0] = colorArray[0];
    colors[(i * 9) + 1] = colorArray[1];
    colors[(i * 9) + 2] = colorArray[2];

    colors[(i * 9) + 3] = colorArray[0];
    colors[(i * 9) + 4] = colorArray[1];
    colors[(i * 9) + 5] = colorArray[2];

    colors[(i * 9) + 6] = colorArray[0];
    colors[(i * 9) + 7] = colorArray[1];
    colors[(i * 9) + 8] = colorArray[2];
  }

  const normals = (() => {
    const geometry = new THREE.BufferGeometry();
    geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry.getAttribute('normal').array;
  })();

  const heightField = (() => {
    const result = new Float32Array(((NUM_CELLS * 2) + 1) * ((NUM_CELLS * 2) + 1));

    const minX = position.x;
    const maxX = minX + NUM_CELLS;
    const minY = position.y;
    const maxY = minY + NUM_CELLS;

    const _getPointElevation = (() => {
      const cache = {};

      return (x, y) => {
        const key = x + ',' + y;
        const entry = cache[key];

        if (entry !== undefined) {
          return entry;
        } else {
          const newEntry = (() => {
            const {position} = mapChunk;
            const pointIndex = _getCoordOverscanIndex(x - position.x, y - position.y);
            const point = points[pointIndex];
            const elevation = point ? point.elevation : 0;
            const normalizedElevation = _normalizeElevation(elevation);
            return normalizedElevation;
          })();
          cache[key] = newEntry;
          return newEntry;
        }
      };
    })();

    let i = 0;
    for (let y = minY; y <= maxY; y += 0.5) {
      for (let x = minX; x <= maxX; x += 0.5) {
        const height = (() => {
          const ax = Math.floor(x);
          const ay = Math.floor(y);
          if (x === ax && y === ay) {
            const elevation = _getPointElevation(ax, ay);
            return elevation;
          } else {
            const aElevation = _getPointElevation(ax, ay);
            const bx = Math.ceil(x);
            const by = Math.ceil(y);
            const bElevation = _getPointElevation(bx, by);
            const elevation = (aElevation + bElevation) / 2;
            return elevation;
          }
        })();

        result[i] = height;
        i++;
      }
    }

    return result;
  })();

  return {
    offset,
    position,
    positions,
    normals,
    colors,
    heightField,
  };
};

const _getCoordOverscanIndex = (x, y) => x + (y * NUM_CELLS_OVERSCAN);
const _getMapCoords = (x, y) => {
  if (y % 2 === 0) {
    return [x, y];
  } else {
    return [x + 0.5, y];
  }
};
const _getCaveIndex = (x, y, z) => x + ((y + NUM_CELLS_OVERSCAN) * NUM_CELLS_OVERSCAN) + (z * NUM_CELLS_OVERSCAN * (NUM_CELLS_OVERSCAN * 2));

const _normalizeElevation = elevation => {
  if (elevation >= 0) {
    return elevation;
  } else {
    return -Math.pow(-elevation, 0.5);
  }
};
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
const _getTriangleBiome = (ap, bp, cp) => {
  const elevation = (ap.elevation + bp.elevation + cp.elevation) / 3;
  const moisture = (ap.moisture + bp.moisture + cp.moisture) / 3;
  const numLand = (+ap.land) + (+bp.land) + (+cp.land);
  const land = numLand > 0;
  const numWater = (+ap.water) + (+bp.water) + (+cp.water);
  const water = numWater > 0;
  const numOcean = (+ap.ocean) + (+bp.ocean) + (+cp.ocean);
  const ocean = numOcean > 0;
  const coast = numLand >= 1 && numOcean >= 1;
  const lava = (ap.lava || 0) + (bp.lava || 0) + (cp.lava || 0);

  return _getBiome({
    elevation,
    moisture,
    land,
    water,
    ocean,
    coast,
    lava,
  });
}

const api = {
  buildMapChunk,
  compileMapChunk,
};
return api;

};

export default getApi;

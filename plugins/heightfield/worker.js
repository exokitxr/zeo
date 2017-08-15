importScripts('/archae/assets/three.js');
const {exports: THREE} = self.module;
importScripts('/archae/assets/murmurhash.js');
const {exports: murmur} = self.module;
self.module = {};

const indev = require('indev');
const isosurface = require('isosurface');
const protocolUtils = require('./lib/utils/protocol-utils');
const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,

  DEFAULT_SEED,
} = require('./lib/constants/constants');

const _marchCubes = (fn, resolution) => isosurface.marchingCubes(
  [resolution + 1, resolution * 2 + 1, resolution + 1],
  fn,
  [
    [0, 0, 0],
    [resolution + 1, resolution * 2 + 1, resolution + 1],
  ]
);
const _makeGeometry = (points, worms) => {
  const localVector = new THREE.Vector3();
  const localVector2 = new THREE.Vector3();
  const _getWormDistance = (x, y, z) => {
    let result = Infinity;
    for (let i = 0; i < worms.length; i++) {
      result = Math.min(
        worms[i].closestPointToPoint(localVector.set(x, y, z), true, localVector2)
          .distanceTo(localVector),
        result
      );
    }
    return result;
  };
  const {positions: positionsArray, cells: cellsArray} = _marchCubes((x, y, z) => {
    return Math.max(y - points[_getCoordOverscanIndex(x, z)].elevation, -1) + Math.max(3 - _getWormDistance(x, y, z), 0);
  }, NUM_CELLS);

  const numPositions = positionsArray.length;
  const positions = new Float32Array(numPositions * 3);
  for (let i = 0; i < numPositions; i++) {
    const baseIndex = i * 3;
    positions[baseIndex + 0] = positionsArray[i][0];
    positions[baseIndex + 1] = positionsArray[i][1];
    positions[baseIndex + 2] = positionsArray[i][2];
  }
  const numCells = cellsArray.length;
  const indices = new Uint32Array(numCells * 3);
  for (let i = 0; i < numCells; i++) {
    const baseIndex = i * 3;
    indices[baseIndex + 0] = cellsArray[i][0];
    indices[baseIndex + 1] = cellsArray[i][1];
    indices[baseIndex + 2] = cellsArray[i][2];
  }

  const geometry = new THREE.BufferGeometry();
  geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();

  return geometry;
};

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
    seed: DEFAULT_SEED,
  });
  const elevationNoise = generator.uniform({
    frequency: 0.002,
    octaves: 8,
  });
  const moistureNoise = generator.uniform({
    frequency: 0.001,
    octaves: 2,
  });
  const wormNoise = generator.uniform({
    frequency: 0.001,
    octaves: 2,
  });

  return {
    elevationNoise,
    moistureNoise,
    wormNoise,
  };
})();

class MapPoint {
  constructor(
    elevation = 0,
    moisture = 0,
    land = false,
    water = false,
    ocean = false,
    lake = false,
    lava = 0
  ) {
    this.elevation = elevation;
    this.moisture = moisture;
    this.land = land;
    this.water = water;
    this.ocean = ocean;
    this.lake = lake;
    this.lava = lava;
  }
}

const _generateMapChunk = (ox, oy) => {
  const points = (() => {
    const points = Array(NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN);

    for (let y = 0; y < NUM_CELLS_OVERSCAN; y++) {
      for (let x = 0; x < NUM_CELLS_OVERSCAN; x++) {
        const dx = (ox * NUM_CELLS) + x;
        const dy = (oy * NUM_CELLS) + y;
        const baseElevation = _random.elevationNoise.in2D(dx + 1000, dy + 1000);
        const elevation = (-0.3 + Math.pow(baseElevation, 0.5)) * 64;
        const moisture = _random.moistureNoise.in2D(dx, dy);
        const land = elevation > 0;
        const water = !land;
        points[_getCoordOverscanIndex(x, y)] = new MapPoint(
          elevation,
          moisture,
          land,
          water
        );
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

      const point = points[_getCoordOverscanIndex(x, y)];
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

      const point = points[_getCoordOverscanIndex(x, y)];
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
  const worms = (() => {
    const worms = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const n = _random.wormNoise.in2D(ox + dx, oy + dy);
        const numWorms = Math.floor(n * 6);

        const forwardVector = new THREE.Vector3(0, 0, -1);
        const localVector = new THREE.Vector3();
        const localQuaternion = new THREE.Quaternion();

        for (let i = 0; i < numWorms; i++) {
          const s = [n, i].join(':');
          const lx = (dx * NUM_CELLS) + Math.floor(murmur(s + ':x') / 0xFFFFFFFF * NUM_CELLS);
          const lz = (dy * NUM_CELLS) + Math.floor(murmur(s + ':z') / 0xFFFFFFFF * NUM_CELLS);
          const ax = lx + ox * NUM_CELLS;
          const az = lz + oy * NUM_CELLS;

          const baseElevation = _random.elevationNoise.in2D(ax + 1000, az + 1000);
          const elevation = (-0.3 + Math.pow(baseElevation, 0.5)) * 64;
          const ly = elevation;

          let currentPosition = new THREE.Vector3(lx, ly, lz);
          let currentDirection = new THREE.Vector3(
            -0.5 + murmur(s + ':startAngleX') / 0xFFFFFFFF,
            -0.25 * murmur(s + ':startAngleY') / 0xFFFFFFFF,
            -0.5 + murmur(s + ':startAngleZ') / 0xFFFFFFFF
          ).normalize();
          const numSegments = 4 + Math.floor(murmur(s + ':segments') / 0xFFFFFFFF * 10);
          for (let j = 0; j < numSegments; j++) {
            const segementLength = 1 + murmur(s + ':' + j + ':length') / 0xFFFFFFFF * 4;
            const worm = new THREE.Line3(
              currentPosition.clone(),
              currentPosition.add(
                localVector.copy(forwardVector)
                  .applyQuaternion(localQuaternion.setFromUnitVectors(forwardVector, currentDirection))
                  .multiplyScalar(segementLength)
              )
            );
            worms.push(worm);

            currentPosition = worm.end.clone();
            currentDirection.x += (-0.5 + (murmur(s + ':' + j + ':angleX') / 0xFFFFFFFF)) * 2 * 0.5;
            currentDirection.y += (-0.5 + (murmur(s + ':' + j + ':angleY') / 0xFFFFFFFF)) * 2 * 0.5;
            currentDirection.z += (-0.5 + (murmur(s + ':' + j + ':angleZ') / 0xFFFFFFFF)) * 2 * 0.5;
            currentDirection.normalize();
          }
        }
      }
    }
    return worms;
  })();

  const geometry = _makeGeometry(points, worms);
  const positions = geometry.getAttribute('position').array;
  const colors = new Float32Array(positions.length);
  geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
  const indices = geometry.index.array;
  const heightfield = new Float32Array(NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN);
  let minY = Infinity;
  let maxY = -Infinity;

  const numPositions = positions.length / 3;
  for (let i = 0; i < numPositions; i++) {
    const baseIndex = i * 3;

    const lx = Math.floor(positions[baseIndex + 0]);
    const ly = Math.floor(positions[baseIndex + 2]);

    const index = _getCoordOverscanIndex(lx, ly);
    const {elevation, moisture, land, water, ocean, lava} = points[index];
    const coast = land && ocean;

    const biome = _getBiome({
      elevation,
      moisture,
      land,
      water,
      ocean,
      coast,
      lava,
    });
    const colorInt = BIOME_COLORS[biome];
    const colorArray = _colorIntToArray(colorInt);
    colors[baseIndex + 0] = colorArray[0];
    colors[baseIndex + 1] = colorArray[1];
    colors[baseIndex + 2] = colorArray[2];

    positions[baseIndex + 0] += ox * NUM_CELLS;
    // positions[baseIndex + 1] += oy * NUM_CELLS;
    positions[baseIndex + 2] += oy * NUM_CELLS;

    heightfield[index] = Math.max(heightfield[index], elevation);

    if (elevation < minY) {
      minY = elevation;
    }
    if (elevation > maxY) {
      maxY = elevation;
    }
  }

  return {
    points: points,
    positions: geometry.getAttribute('position').array,
    normals: geometry.getAttribute('normal').array,
    colors: geometry.getAttribute('color').array,
    indices: geometry.index.array,
    heightfield: heightfield,
    heightRange: [minY, maxY],
  };
};
const _getOriginHeight = () => (-0.3 + Math.pow(_random.elevationNoise.in2D(0 + 1000, 0 + 1000), 0.5)) * 64;
const _getCoordOverscanIndex = (x, y) => x + (y * NUM_CELLS_OVERSCAN);

const _getBiome = p => {
  if (p.coast) {
    return 'BEACH';
  } else if (p.ocean) {
    return 'OCEAN';
  } else if (p.water) {
    if (p.elevation < 6) { return 'MARSH'; }
    if (p.elevation > 28) { return 'ICE'; }
    return 'LAKE';
  } else if (p.lava > 2) {
    return 'MAGMA';
  } else if (p.elevation > 28) {
    if (p.moisture > 0.50) { return 'SNOW'; }
    else if (p.moisture > 0.33) { return 'TUNDRA'; }
    else if (p.moisture > 0.16) { return 'BARE'; }
    else { return 'SCORCHED'; }
  } else if (p.elevation > 18) {
    if (p.moisture > 0.66) { return 'TAIGA'; }
    else if (p.moisture > 0.33) { return 'SHRUBLAND'; }
    else { return 'TEMPERATE_DESERT'; }
  } else if (p.elevation > 6) {
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
};
const _colorIntToArray = n => ([
  ((n >> (8 * 2)) & 0xFF) / 0xFF,
  ((n >> (8 * 1)) & 0xFF) / 0xFF,
  ((n >> (8 * 0)) & 0xFF) / 0xFF,
]);

self.onmessage = e => {
  const {data} = e;
  const {method} = data;

  switch (method) {
    case 'getOriginHeight': {
      postMessage(_getOriginHeight());
      break;
    }
    case 'generate': {
      const {args} = data;
      const {x, y, buffer} = args;
      const mapChunk = _generateMapChunk(x, y);
      const resultBuffer = protocolUtils.stringifyMapChunk(mapChunk, buffer, 0);

      postMessage(resultBuffer, [resultBuffer]);
      break;
    }
    default: {
      console.warn('invalid heightfield worker method:', JSON.stringify(method));
      break;
    }
  }
};;

module.exports = ({
  THREE,
  murmur,
  indev,
}) => {

const mrch = require('mrch');
const protocolUtils = require('./lib/utils/protocol-utils');
const {
  NUM_CELLS,
  OVERSCAN,
  NUM_CELLS_OVERSCAN,

  HEIGHTFIELD_DEPTH,

  DEFAULT_SEED,
} = require('./lib/constants/constants');
const NUM_CELLS_OVERSCAN_Y = (NUM_CELLS * 4) + OVERSCAN;
const HOLE_SIZE = 2;

const _marchCubes = (fn, resolution) => mrch.marchingCubes(
  [resolution + 1, (resolution * 4) + 1, resolution + 1],
  fn,
  [
    [0, 0, 0],
    [resolution + 1, (resolution * 4) + 1, resolution + 1],
  ]
);
const _makeGeometry = ether => {
  const {positions, indices} = _marchCubes(
    (x, y, z) => ether[_getEtherIndex(x, y, z)],
    NUM_CELLS
  );

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
  CAVE: 0x808080,
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

const forwardVector = new THREE.Vector3(0, 0, -1);
const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localVector3 = new THREE.Vector3();
const localVector4 = new THREE.Vector3();
const localVector5 = new THREE.Vector3();
const localVector6 = new THREE.Vector3();
const localLine = new THREE.Line3();
const localQuaternion = new THREE.Quaternion();
const localTriangle = new THREE.Triangle();
localTriangle.points = [localTriangle.a, localTriangle.b, localTriangle.c];
const _generateMapChunk = (ox, oy, opts) => {
  // generate

  let elevations = opts.oldElevations;
  if (!elevations) {
    elevations = new Float32Array(NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN);
    for (let z = 0; z < NUM_CELLS_OVERSCAN; z++) {
      for (let x = 0; x < NUM_CELLS_OVERSCAN; x++) {
        elevations[_getCoordOverscanIndex(x, z)] = (1 - 0.3 + Math.pow(_random.elevationNoise.in2D((ox * NUM_CELLS) + x + 1000, (oy * NUM_CELLS) + z + 1000), 0.5)) * 64;
      }
    }
  }

  let ether = opts.oldEther;
  if (!ether) {
    ether = new Float32Array((NUM_CELLS + 2) * ((NUM_CELLS * 4) + 2) * (NUM_CELLS + 2));
    for (let z = 0; z < NUM_CELLS_OVERSCAN; z++) {
      for (let y = 0; y < NUM_CELLS_OVERSCAN_Y; y++) {
        for (let x = 0; x < NUM_CELLS_OVERSCAN; x++) {
          ether[_getEtherIndex(x, y, z)] = Math.max(y - elevations[_getCoordOverscanIndex(x, z)], -1);
        }
      }
    }

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const n = _random.wormNoise.in2D(ox + dx, oy + dy);
        const numWorms = Math.floor(n * 6);

        for (let i = 0; i < numWorms; i++) {
          const s = [n, i].join(':');
          const lx = (dx * NUM_CELLS) + Math.floor(murmur(s + ':x') / 0xFFFFFFFF * NUM_CELLS);
          const lz = (dy * NUM_CELLS) + Math.floor(murmur(s + ':z') / 0xFFFFFFFF * NUM_CELLS);
          const ax = lx + ox * NUM_CELLS;
          const az = lz + oy * NUM_CELLS;

          const elevation = (1 - 0.3 + Math.pow(_random.elevationNoise.in2D(ax + 1000, az + 1000), 0.5)) * 64;
          const ly = elevation;

          let currentPosition = localVector.set(lx, ly, lz);
          let currentDirection = localVector2.set(
            -0.5 + murmur(s + ':startAngleX') / 0xFFFFFFFF,
            -0.25 * murmur(s + ':startAngleY') / 0xFFFFFFFF,
            -0.5 + murmur(s + ':startAngleZ') / 0xFFFFFFFF
          ).normalize();
          const numSegments = 4 + Math.floor(murmur(s + ':segments') / 0xFFFFFFFF * 10);
          for (let j = 0; j < numSegments; j++) {
            const segementLength = 1 + murmur(s + ':' + j + ':length') / 0xFFFFFFFF * 4;
            const worm = localLine.set(
              currentPosition,
              localVector3.copy(currentPosition).add(
                localVector4.copy(forwardVector)
                  .applyQuaternion(localQuaternion.setFromUnitVectors(forwardVector, currentDirection))
                  .multiplyScalar(segementLength)
              )
            );
            const min = localVector3.set(
              Math.max(Math.floor(Math.min(worm.start.x, worm.end.x)) - 3, 0),
              Math.max(Math.floor(Math.min(worm.start.y, worm.end.y)) - 3, 0),
              Math.max(Math.floor(Math.min(worm.start.z, worm.end.z)) - 3, 0)
            );
            const max = localVector4.set(
              Math.min(Math.ceil(Math.max(worm.start.x, worm.end.x)) + 3, NUM_CELLS + 1),
              Math.min(Math.ceil(Math.max(worm.start.y, worm.end.y)) + 3, (NUM_CELLS * 4) + 1),
              Math.min(Math.ceil(Math.max(worm.start.z, worm.end.z)) + 3, NUM_CELLS + 1)
            );
            for (let nz = min.z; nz <= max.z; nz++) {
              for (let ny = min.y; ny <= max.y; ny++) {
                for (let nx = min.x; nx <= max.x; nx++) {
                  const index = _getEtherIndex(nx, ny, nz);
                  ether[index] += Math.max(
                    3 - worm.closestPointToPoint(localVector5.set(nx, ny, nz), true, localVector6)
                      .distanceTo(localVector5),
                    0
                  )
                }
              }
            }

            currentPosition.copy(worm.end);
            currentDirection.x += (-0.5 + (murmur(s + ':' + j + ':angleX') / 0xFFFFFFFF)) * 2 * 0.5;
            currentDirection.y += (-0.5 + (murmur(s + ':' + j + ':angleY') / 0xFFFFFFFF)) * 2 * 0.5;
            currentDirection.z += (-0.5 + (murmur(s + ':' + j + ':angleZ') / 0xFFFFFFFF)) * 2 * 0.5;
            currentDirection.normalize();
          }
        }
      }
    }
  }
  const numNewEthers = opts.newEther.length / 4;
  for (let i = 0; i < numNewEthers; i++) {
    const baseIndex = i * 4;
    const x = opts.newEther[baseIndex + 0];
    const y = opts.newEther[baseIndex + 1];
    const z = opts.newEther[baseIndex + 2];
    const v = opts.newEther[baseIndex + 3];
    for (let dz = -HOLE_SIZE; dz <= HOLE_SIZE; dz++) {
      const az = z + dz;
      if (az >= 0 && az < (NUM_CELLS + 2)) {
        for (let dy = -HOLE_SIZE; dy <= HOLE_SIZE; dy++) {
          const ay = y + dy;
          if (ay >= 0 && ay < ((NUM_CELLS * 4) + 2)) {
            for (let dx = -HOLE_SIZE; dx <= HOLE_SIZE; dx++) {
              const ax = x + dx;
              if (ax >= 0 && ax < (NUM_CELLS + 2)) {
                ether[_getEtherIndex(ax, ay, az)] += v * Math.max(HOLE_SIZE - Math.sqrt(dx * dx + dy * dy + dz * dz), 0) / HOLE_SIZE;
              }
            }
          }
        }
      }
    }
  }

  // compile

  const geometry = _makeGeometry(ether);
  const positions = geometry.getAttribute('position').array;
  const indices = geometry.index.array;

  const heightfield = new Float32Array(NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN * HEIGHTFIELD_DEPTH);
  heightfield.fill(-1024);
  const staticHeightfield = new Float32Array(NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN);
  staticHeightfield.fill(-1024);

  const numIndices = indices.length / 3;
  for (let i = 0; i < numIndices; i++) {
    const indexIndex = i * 3;
    localTriangle.a.fromArray(positions, indices[indexIndex + 0] * 3);
    localTriangle.b.fromArray(positions, indices[indexIndex + 1] * 3);
    localTriangle.c.fromArray(positions, indices[indexIndex + 2] * 3);
    if (localTriangle.normal(localVector).y > 0) {
      for (let j = 0; j < 3; j++) {
        const point = localTriangle.points[j];
        const x = Math.floor(point.x);
        const y = point.y;
        const z = Math.floor(point.z);

        for (let layer = 0; layer < HEIGHTFIELD_DEPTH; layer++) {
          const heightfieldXYBaseIndex = _getTopHeightfieldIndex(x, z);
          const oldY = heightfield[heightfieldXYBaseIndex + layer];
          if (y > oldY) {
            if (j === 0 || (y - oldY) >= 5) { // ignore non-surface heights with small height difference
              for (let k = HEIGHTFIELD_DEPTH - 1; k > layer; k--) {
                heightfield[heightfieldXYBaseIndex + k] = heightfield[heightfieldXYBaseIndex + k - 1];
              }
              heightfield[heightfieldXYBaseIndex + layer] = y;
            }
            break;
          } else if (y === oldY) {
            break;
          }
        }

        const staticheightfieldIndex = _getStaticHeightfieldIndex(x, z);
        if (y > staticHeightfield[staticheightfieldIndex]) {
          staticHeightfield[staticheightfieldIndex] = y;
        }
      }
    }
  }

  const numPositions = positions.length / 3;
  const colors = new Float32Array(numPositions * 3);
  geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));

  for (let i = 0; i < numPositions; i++) {
    const baseIndex = i * 3;
    const lx = Math.floor(positions[baseIndex + 0]);
    const y = positions[baseIndex + 1];
    const lz = Math.floor(positions[baseIndex + 2]);
    const elevation = heightfield[_getTopHeightfieldIndex(lx, lz)];
    const dx = (ox * NUM_CELLS) + lx;
    const dz = (oy * NUM_CELLS) + lz;
    const moisture = _random.moistureNoise.in2D(dx, dz);
    const land = elevation > 64;
    const cave = y < elevation - 3;
    const water = !land;
    const ocean = false;
    const coast = land && ocean;
    const lava = 0;
    const biome = _getBiome({
      y,
      moisture,
      land,
      cave,
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
  }

  geometry.computeBoundingSphere();
  const {boundingSphere} = geometry;

  return {
    positions: geometry.getAttribute('position').array,
    normals: geometry.getAttribute('normal').array,
    colors: geometry.getAttribute('color').array,
    indices: geometry.index.array,
    heightfield,
    staticHeightfield,
    elevations,
    ether,
    boundingSphere: Float32Array.from(boundingSphere.center.toArray().concat([boundingSphere.radius])),
  };
};
const _getCoordOverscanIndex = (x, y) => x + (y * NUM_CELLS_OVERSCAN);
const ETHER_INDEX_Y_FACTOR = NUM_CELLS + 2;
const ETHER_INDEX_Z_FACTOR = ETHER_INDEX_Y_FACTOR * ((NUM_CELLS * 4) + 2);
const _getEtherIndex = (x, y, z) => x + (y * ETHER_INDEX_Y_FACTOR) + (z * ETHER_INDEX_Z_FACTOR);

const _getBiome = p => {
  if (p.coast) {
    return 'BEACH';
  } else if (p.ocean) {
    return 'OCEAN';
  } else if (p.water) {
    if (p.y < 64 + 6) { return 'MARSH'; }
    if (p.y > 64 + 28) { return 'ICE'; }
    return 'LAKE';
  } else if (p.cave) {
    return 'CAVE';
  } else if (p.lava > 2) {
    return 'MAGMA';
  } else if (p.y > 64 + 28) {
    if (p.moisture > 0.50) { return 'SNOW'; }
    else if (p.moisture > 0.33) { return 'TUNDRA'; }
    else if (p.moisture > 0.16) { return 'BARE'; }
    else { return 'SCORCHED'; }
  } else if (p.y > 64 + 18) {
    if (p.moisture > 0.66) { return 'TAIGA'; }
    else if (p.moisture > 0.33) { return 'SHRUBLAND'; }
    else { return 'TEMPERATE_DESERT'; }
  } else if (p.y > 64 + 6) {
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
const _colorIntToArray = n => ([
  ((n >> (8 * 2)) & 0xFF) / 0xFF,
  ((n >> (8 * 1)) & 0xFF) / 0xFF,
  ((n >> (8 * 0)) & 0xFF) / 0xFF,
]);
const _getTopHeightfieldIndex = (x, z) => (x + (z * NUM_CELLS_OVERSCAN)) * HEIGHTFIELD_DEPTH;
const _getStaticHeightfieldIndex = (x, z) => x + (z * NUM_CELLS_OVERSCAN);

/* const points = (() => {
  const points = Array(NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN);

  for (let y = 0; y < NUM_CELLS_OVERSCAN; y++) {
    for (let x = 0; x < NUM_CELLS_OVERSCAN; x++) {
      const dx = (ox * NUM_CELLS) + x;
      const dy = (oy * NUM_CELLS) + y;
      const elevation = (1 - 0.3 + Math.pow(_random.elevationNoise.in2D(dx + 1000, dy + 1000), 0.5)) * 64;
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
})(); */

const generator = (x, y, buffer, byteOffset, opts) => {
  if (opts === undefined) {
    opts = {};
  }
  if (opts.oldElevations === undefined) {
    opts.oldElevations = null;
  }
  if (opts.oldEther === undefined) {
    opts.oldEther = null;
  }
  if (opts.newEther === undefined) {
    opts.newEther = new Float32Array(0);
  }
  if (opts.regenerate === undefined) {
    opts.regenerate = false;
  }

  protocolUtils.stringifyDataChunk(_generateMapChunk(x, y, opts), buffer, byteOffset);
};
return generator;

};

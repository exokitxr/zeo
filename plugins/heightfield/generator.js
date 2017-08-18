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

const _makeGeometries = ether => {
  const geometries = Array(4);
  for (let i = 0; i < 4; i++) {
    const {positions, indices} = mrch.marchingCubes(
      [NUM_CELLS + 1, NUM_CELLS + 1, NUM_CELLS + 1],
      (x, y, z) => ether[_getEtherIndex(x, y, z)],
      [
        [0, NUM_CELLS * i, 0],
        [NUM_CELLS + 1, (NUM_CELLS * (i + 1)) + 1, NUM_CELLS + 1],
      ]
    );
    const geometry = new THREE.BufferGeometry();
    geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
    geometries[i] = geometry;
  }
  return geometries;
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
    for (let z = 0; z <= NUM_CELLS_OVERSCAN; z++) {
      for (let x = 0; x <= NUM_CELLS_OVERSCAN; x++) {
        const elevation = elevations[_getCoordOverscanIndex(x, z)];
        for (let y = 0; y <= NUM_CELLS_OVERSCAN_Y; y++) {
          ether[_getEtherIndex(x, y, z)] = Math.max(y - elevation, -1);
        }
      }
    }

    const _fillOblateSpheroid = (centerX, centerY, centerZ, minX, minZ, maxX, maxZ, radius) => {
      for (let z = -radius; z <= radius; z++) {
        const lz = centerZ + z;
        if (lz >= minZ && lz < (maxZ + 1)) {
          for (let y = -radius; y <= radius; y++) {
            const ly = centerY + y;
            if (ly >= 0 && ly < NUM_CELLS_OVERSCAN_Y) {
              for (let x = -radius; x <= radius; x++) {
                const lx = centerX + x;
                if (lx >= minX && lx < (maxX + 1)) {
                  const distance = Math.pow(x,2) + 2 * Math.pow(y,2) + Math.pow(z,2);
                  if (distance < Math.pow(radius,2)) {
                    const index = _getEtherIndex(Math.floor(lx - minX), Math.floor(ly), Math.floor(lz - minZ));
                    const distance2 = Math.sqrt(distance);
                    ether[index] += 1 + ((radius - distance2) / radius);
                  }
                }
              }
            }
          }
        }
      }
    };

    // for (let doy = -3; doy <= 3; doy++) {
      // for (let dox = -3; dox <= 3; dox++) {
    for (let doy = -1; doy <= 1; doy++) {
      for (let dox = -1; dox <= 1; dox++) {
        const aox = ox + dox;
        const aoy = oy + doy;
        const n = _random.wormNoise.in2D(aox * NUM_CELLS + 1000, aoy * NUM_CELLS + 1000);
        const numWorms = Math.floor(n * 14);

        for (let i = 0; i < numWorms; i++) {
          const s = [n, i].join(':');
          let cavePosX = (aox * NUM_CELLS) + (murmur(s + ':x') / 0xFFFFFFFF) * NUM_CELLS;
          let cavePosY = (murmur(s + ':y') / 0xFFFFFFFF) * NUM_CELLS * 4;
          let cavePosZ = (aoy * NUM_CELLS) + (murmur(s + ':z') / 0xFFFFFFFF) * NUM_CELLS;
          // const caveLength = (murmur(s + ':caveLength1') / 0xFFFFFFFF) * (murmur(s + ':caveLength2') / 0xFFFFFFFF) * 200;
          const caveLength = (murmur(s + ':caveLength1') / 0xFFFFFFFF) * (murmur(s + ':caveLength2') / 0xFFFFFFFF) * 100;

          let theta = (murmur(s + ':theta') / 0xFFFFFFFF) * Math.PI * 2;
          let deltaTheta = 0;
          let phi = (murmur(s + ':phi') / 0xFFFFFFFF) * Math.PI * 2;
          let deltaPhi = 0;

          const caveRadius = (murmur(s + ':caveRadius1') / 0xFFFFFFFF) * (murmur(s + ':caveRadius2') / 0xFFFFFFFF);

          for (let len = 0; len < caveLength; len++) {
            const s2 = [s, len].join(':');

            cavePosX += Math.sin(theta) * Math.cos(phi);
            cavePosY += Math.cos(theta) * Math.cos(phi);
            cavePosZ += Math.sin(phi);

            theta += deltaTheta * 0.2;
            deltaTheta = (deltaTheta * 0.9) + (murmur(s2 + ':deltaTheta1') / 0xFFFFFFFF) - (murmur(s2 + ':deltaTheta2') / 0xFFFFFFFF);
            phi = phi/2 + deltaPhi/4;
            deltaPhi = (deltaPhi * 0.75) + (murmur(s2 + ':deltaPhi1') / 0xFFFFFFFF) - (murmur(s2 + ':deltaPhi2') / 0xFFFFFFFF);

            if ((murmur(s2 + ':fill') / 0xFFFFFFFF) >= 0.25) {
              const centerPosX = cavePosX + (murmur(s2 + ':centerPosX') / 0xFFFFFFFF * 4 - 2) * 0.2;
              const centerPosY = cavePosY + (murmur(s2 + ':centerPosY') / 0xFFFFFFFF * 4 - 2) * 0.2;
              const centerPosZ = cavePosZ + (murmur(s2 + ':centerPosZ') / 0xFFFFFFFF * 4 - 2) * 0.2;

              const height = (1 - 0.3 + Math.pow(_random.elevationNoise.in2D(centerPosX + 1000, centerPosZ + 1000), 0.5)) * 64;
              let radius = (height - centerPosY) / height;
              // radius = 1.3 + (radius * 3.5 + 1) * caveRadius;
              radius = 3 + (radius * 3.5 + 1) * caveRadius;
              radius = radius * Math.sin(len * Math.PI / caveLength);

              _fillOblateSpheroid(centerPosX, centerPosY, centerPosZ, ox * NUM_CELLS, oy * NUM_CELLS, (ox + 1) * NUM_CELLS, (oy + 1) * NUM_CELLS, radius);
            }
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

  const geometries = _makeGeometries(ether);

  const heightfield = new Float32Array(NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN * HEIGHTFIELD_DEPTH);
  heightfield.fill(-1024);
  const staticHeightfield = new Float32Array(NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN);
  staticHeightfield.fill(-1024);

  for (let i = 0; i < 4; i++) {
    const geometry = geometries[i];

    const positions = geometry.getAttribute('position').array;
    const indices = geometry.index.array;

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
  }
  for (let i = 0; i < 4; i++) {
    const geometry = geometries[i];

    const positions = geometry.getAttribute('position').array;
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
  }

  return {
    geometries: geometries.map(geometry => ({
      positions: geometry.getAttribute('position').array,
      normals: geometry.getAttribute('normal').array,
      colors: geometry.getAttribute('color').array,
      indices: geometry.index.array,
      boundingSphere: Float32Array.from(geometry.boundingSphere.center.toArray().concat([geometry.boundingSphere.radius])),
    })),
    heightfield,
    staticHeightfield,
    elevations,
    ether,
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

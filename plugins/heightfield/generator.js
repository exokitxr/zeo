module.exports = ({
  THREE,
  mod,
  murmur,
  indev,
}) => {

const mrch = require('mrch');
const protocolUtils = require('./lib/utils/protocol-utils');
const {
  NUM_CELLS,
  OVERSCAN,
  NUM_CELLS_OVERSCAN,

  NUM_CELLS_HEIGHT,
  NUM_CHUNKS_HEIGHT,

  HEIGHTFIELD_DEPTH,

  DEFAULT_SEED,

  PEEK_FACES,
  PEEK_FACE_INDICES,

  BIOMES,
  BIOMES_TALL,
  BIOMES_TEMPERATURE_HUMIDITY,
} = require('./lib/constants/constants');
const NUM_POSITIONS_CHUNK = 800 * 1024;
const NUM_CELLS_HALF = NUM_CELLS / 2;
const NUM_CELLS_CUBE = Math.sqrt(NUM_CELLS_HALF * NUM_CELLS_HALF * 3);
const NUM_CELLS_OVERSCAN_Y = NUM_CELLS_HEIGHT + OVERSCAN;
const HOLE_SIZE = 2;

const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
  for (let i = 0; i < src.length; i++) {
    dst[startIndexIndex + i] = src[i] + startAttributeIndex;
  }
};

const _makeGeometries = (ox, oy, ether, liquid, liquidTypes) => {
  const positions = new Float32Array(NUM_POSITIONS_CHUNK);
  const indices = new Uint32Array(NUM_POSITIONS_CHUNK);
  let attributeIndex = 0;
  let indexIndex = 0;

  // land
  const geometries = Array(NUM_CHUNKS_HEIGHT);
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    const {positions: newPositions, indices: newIndices} = mrch.marchingCubes(
      [NUM_CELLS + 1, NUM_CELLS + 1, NUM_CELLS + 1],
      (x, y, z) => ether[_getEtherIndex(x, y, z)],
      [
        [0, NUM_CELLS * i, 0],
        [NUM_CELLS + 1, (NUM_CELLS * (i + 1)) + 1, NUM_CELLS + 1],
      ]
    );
    positions.set(newPositions, attributeIndex);
    _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

    geometries[i] = {
      attributeRange: {
        landStart: attributeIndex,
        landCount: newPositions.length,
        waterStart: 0,
        waterCount: 0,
        lavaStart: 0,
        lavaCount: 0,
      },
      indexRange: {
        landStart: indexIndex,
        landCount: newIndices.length,
        waterStart: 0,
        waterCount: 0,
        lavaStart: 0,
        lavaCount: 0,
      },
      boundingSphere: null,
      peeks: null,
    };

    attributeIndex += newPositions.length;
    indexIndex += newIndices.length;
  }
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    // water
    const {positions: newWaterPositions, indices: newWaterIndices} = mrch.marchingCubes(
      [NUM_CELLS + 1, NUM_CELLS + 1, NUM_CELLS + 1],
      (x, y, z) => {
        const index = _getEtherIndex(x, y, z);
        if (liquidTypes[index] === 1) {
          const liquidValue = liquid[index];
          if (liquidValue > 0) {
            return ether[index] * (liquidValue === 0xFF ? 1 : -1);
          } else {
            return 1;
          }
        } else {
          return 1;
        }
      },
      [
        [0, NUM_CELLS * i, 0],
        [NUM_CELLS + 1, (NUM_CELLS * (i + 1)) + 1, NUM_CELLS + 1],
      ]
    );
    // const newWaterPositions = [];
    // const newWaterIndices = [];
    positions.set(newWaterPositions, attributeIndex);
    _copyIndices(newWaterIndices, indices, indexIndex, attributeIndex / 3);

    const {attributeRange, indexRange} = geometries[i];
    attributeRange.waterStart = attributeIndex;
    attributeRange.waterCount = newWaterPositions.length;
    indexRange.waterStart = indexIndex;
    indexRange.waterCount = newWaterIndices.length;

    attributeIndex += newWaterPositions.length;
    indexIndex += newWaterIndices.length;

    // lava
    const {positions: newLavaPositions, indices: newLavaIndices} = mrch.marchingCubes(
      [NUM_CELLS + 1, NUM_CELLS + 1, NUM_CELLS + 1],
      (x, y, z) => {
        const index = _getEtherIndex(x, y, z);
        if (liquidTypes[index] === 2) {
          const liquidValue = liquid[index];
          if (liquidValue > 0) {
            return ether[index] * (liquidValue === 0xFF ? 1 : -1);
          } else {
            return 1;
          }
        } else {
          return 1;
        }
      },
      [
        [0, NUM_CELLS * i, 0],
        [NUM_CELLS + 1, (NUM_CELLS * (i + 1)) + 1, NUM_CELLS + 1],
      ]
    );
    positions.set(newLavaPositions, attributeIndex);
    _copyIndices(newLavaIndices, indices, indexIndex, attributeIndex / 3);

    attributeRange.lavaStart = attributeIndex;
    attributeRange.lavaCount = newLavaPositions.length;
    indexRange.lavaStart = indexIndex;
    indexRange.lavaCount = newLavaIndices.length;

    attributeIndex += newLavaPositions.length;
    indexIndex += newLavaIndices.length;
  }

  return {
    positions,
    indices,
    attributeIndex,
    indexIndex,
    geometries,
  }
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
  const elevationNoise1 = generator.uniform({
    frequency: 2,
    octaves: 1,
  });
  const elevationNoise2 = generator.uniform({
    frequency: 2,
    octaves: 1,
  });
  const elevationNoise3 = generator.uniform({
    frequency: 2,
    octaves: 1,
  });
  const wormNoise = generator.uniform({
    frequency: 0.001,
    octaves: 2,
  });
  const oceanNoise = generator.uniform({
    frequency: 0.001,
    octaves: 4,
  });
  const riverNoise = generator.uniform({
    frequency: 0.001,
    octaves: 4,
  });
  const temperatureNoise = generator.uniform({
    frequency: 0.001,
    octaves: 4,
  });
  const humidityNoise = generator.uniform({
    frequency: 0.001,
    octaves: 4,
  });

  return {
    elevationNoise1,
    elevationNoise2,
    elevationNoise3,
    wormNoise,
    oceanNoise,
    riverNoise,
    temperatureNoise,
    humidityNoise,
  };
})();

const localVector = new THREE.Vector3();
const localTriangle = new THREE.Triangle();
localTriangle.points = [localTriangle.a, localTriangle.b, localTriangle.c];
const _generateMapChunk = (ox, oy, opts) => {
  // generate

  const biomeCache = {};
  const _getBiome = (x, z) => {
    const index = x + z * 256;

    let biome = biomeCache[index];
    if (!biome) {
      const _genOcean = () => {
        if (_random.oceanNoise.in2D(x + 1000, z + 1000) < (90 / 255)) {
          biome = BIOMES.biOcean;
        }
      };
      const _genRivers = () => {
        if (biome === undefined) {
          const n = _random.riverNoise.in2D(x + 1000, z + 1000);
          const range = 0.04;
          if (n > 0.5 - range && n < 0.5 + range) {
            biome = BIOMES.biRiver;
          }
        }
      };
      const _genFreezeWater = () => {
        if (_random.temperatureNoise.in2D(x + 1000, z + 1000) < ((4 * 16) / 255)) {
          if (biome === BIOMES.biOcean) {
            biome = BIOMES.biFrozenOcean;
          } else if (biome === BIOMES.biRiver) {
            biome = BIOMES.biFrozenRiver;
          }
        }
      };
      const _genLand = () => {
        if (biome === undefined) {
          const t = Math.floor(_random.temperatureNoise.in2D(x + 1000, z + 1000) * 16);
          const h = Math.floor(_random.humidityNoise.in2D(x + 1000, z + 1000) * 16);
          biome = BIOMES_TEMPERATURE_HUMIDITY[t + 16 * h];
        }
      };
      _genOcean();
      _genRivers();
      _genFreezeWater();
      _genLand();

      biomeCache[index] = biome;
    }

    return biome;
  };

  const biomeHeightCache = {};
  const _getBiomeHeight = (biome, x, z) => {
    const index = mod(biome.index, 64) + mod(x, 64) * 64 + mod(z, 64) * 64 * 64;
    let entry = biomeHeightCache[index];
    if (!entry) {
      entry = biome.baseHeight +
        _random.elevationNoise1.in2D(x * biome.amps[0][0], z * biome.amps[0][0]) * biome.amps[0][1] +
        _random.elevationNoise2.in2D(x * biome.amps[1][0], z * biome.amps[1][0]) * biome.amps[1][1] +
        _random.elevationNoise3.in2D(x * biome.amps[2][0], z * biome.amps[2][0]) * biome.amps[2][1];
      biomeHeightCache[index] = entry;
    }
    return entry;
  }

  let biomes = opts.oldBiomes;
  if (!biomes) {
    biomes = new Uint8Array(NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN);
    for (let z = 0; z < NUM_CELLS_OVERSCAN; z++) {
      for (let x = 0; x < NUM_CELLS_OVERSCAN; x++) {
        biomes[_getCoordOverscanIndex(x, z)] = _getBiome((ox * NUM_CELLS) + x, (oy * NUM_CELLS) + z).index;
      }
    }
  }

  const _getElevation = (x, z) => {
    const biomeCounts = {};
    let totalBiomeCounts = 0;
    for (let dz = -8; dz <= 8; dz++) {
      for (let dx = -8; dx <= 8; dx++) {
        const biome = _getBiome(x + dx, z + dz);
        let biomeCount = biomeCounts[biome.index];
        if (!biomeCount) {
          biomeCount = {
            count: 0,
            height: _getBiomeHeight(biome, x + dx, z + dz),
          };
          biomeCounts[biome.index] = biomeCount;
        }
        biomeCount.count++;
        totalBiomeCounts++;
      }
    }

    let elevationSum = 0;
    for (const index in biomeCounts) {
      const biomeCount = biomeCounts[index];
      elevationSum += biomeCount.count * biomeCount.height;
    }
    return elevationSum / totalBiomeCounts;
  };

  let elevations = opts.oldElevations;
  if (!elevations) {
    elevations = new Float32Array(NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN);
    for (let z = 0; z < NUM_CELLS_OVERSCAN; z++) {
      for (let x = 0; x < NUM_CELLS_OVERSCAN; x++) {
        elevations[_getCoordOverscanIndex(x, z)] = _getElevation((ox * NUM_CELLS) + x, (oy * NUM_CELLS) + z);
      }
    }
  }

  let ether = opts.oldEther;
  if (!ether) {
    ether = new Float32Array((NUM_CELLS + 1) * (NUM_CELLS_HEIGHT + 1) * (NUM_CELLS + 1));
    for (let z = 0; z < NUM_CELLS_OVERSCAN; z++) {
      for (let x = 0; x < NUM_CELLS_OVERSCAN; x++) {
        const elevation = elevations[_getCoordOverscanIndex(x, z)];
        for (let y = 0; y < NUM_CELLS_OVERSCAN_Y; y++) {
          ether[_getEtherIndex(x, y, z)] = Math.min(Math.max(y - elevation, -1), 1);
        }
      }
    }

    /* const _fillOblateSpheroid = (centerX, centerY, centerZ, minX, minZ, maxX, maxZ, radius) => {
      for (let z = -radius; z <= radius; z++) {
        const lz = centerZ + z;
        if (lz >= minZ && lz < (maxZ + 1)) {
          for (let x = -radius; x <= radius; x++) {
            const lx = centerX + x;
            if (lx >= minX && lx < (maxX + 1)) {
              for (let y = -radius; y <= radius; y++) {
                const ly = centerY + y;
                if (ly >= 0 && ly < NUM_CELLS_OVERSCAN_Y) {
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

    for (let doy = -2; doy <= 2; doy++) {
      for (let dox = -2; dox <= 2; dox++) {
        const aox = ox + dox;
        const aoy = oy + doy;
        const n = _random.wormNoise.in2D(aox * NUM_CELLS + 1000, aoy * NUM_CELLS + 1000);
        const numWorms = Math.floor(n * 4);

        for (let i = 0; i < numWorms; i++) {
          const s = [n, i].join(':');
          let cavePosX = (aox * NUM_CELLS) + (murmur(s + ':x') / 0xFFFFFFFF) * NUM_CELLS;
          let cavePosY = (murmur(s + ':y') / 0xFFFFFFFF) * NUM_CELLS_HEIGHT;
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
    } */
  }
  let liquid = opts.oldLiquid;
  let liquidTypes = opts.oldLiquidTypes;
  if (!liquid || !liquidTypes) {
    liquid = new Uint8Array((NUM_CELLS + 1) * (NUM_CELLS_HEIGHT + 1) * (NUM_CELLS + 1));
    liquidTypes = new Int8Array((NUM_CELLS + 1) * (NUM_CELLS_HEIGHT + 1) * (NUM_CELLS + 1));

    const _setLiquid = (x, y, z, liquidType) => {
      x -= ox * NUM_CELLS;
      z -= oy * NUM_CELLS;

      for (let dz = -2; dz <= 2; dz++) {
        const az = z + dz;
        if (az >= 0 && az < (NUM_CELLS + 1)) {
          for (let dx = -2; dx <= 2; dx++) {
            const ax = x + dx;
            if (ax >= 0 && ax < (NUM_CELLS + 1)) {
              for (let dy = -2; dy <= 2; dy++) {
                const ay = y + dy;
                const index = _getEtherIndex(ax, ay, az);
                const oldLiquidValue = liquid[index];

                if (oldLiquidValue === 0 || oldLiquidValue === 0xFF || oldLiquidValue === 0xFE) {
                  if (dx > -2 && dx < 2 && dz > -2 && dz < 2 && ay >= 0 && ay < (NUM_CELLS_HEIGHT + 1)) {
                    if (dx === 0 && dy === 0 && dz === 0) {
                      liquid[index] = 1;
                    } else if (liquid[index] === 0) {
                      liquid[index] = (dy >= 0) ? 0xFF : (dx === 0 && dz === 0 ? 0xFE : 0);
                    }
                  }
                  liquidTypes[index] = liquidType;
                }
              }
            }
          }
        }
      }
    };

    // water
    for (let z = 0; z <= NUM_CELLS; z++) {
      for (let x = 0; x <= NUM_CELLS; x++) {
        const elevation = elevations[_getCoordOverscanIndex(x, z)];
        for (let y = 0; y <= NUM_CELLS_HEIGHT; y++) {
          if (y < 64 && y >= elevation) {
            const index = _getEtherIndex(x, y, z);
            liquid[index] = 1;
            liquidTypes[index] = 1;
          }
        }
      }
    }

    // lava
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let z = 0; z <= NUM_CELLS; z++) {
          for (let x = 0; x <= NUM_CELLS; x++) {
            const ax = ((ox + dx) * NUM_CELLS) + x;
            const az = ((oy + dz) * NUM_CELLS) + z;

            const elevation = _getElevation(ax, az);
            const biome = _getBiome(x, z);
            if (BIOMES_TALL[biome.index] && elevation >= 90) {
              if (_random.temperatureNoise.in2D(ax + 1000, az + 1000) < 0.15) {
                _setLiquid(ax, Math.floor(elevation + 1), az, 2);
              }
            }
          }
        }
      }
    }

    _setLiquid(15, Math.floor(_getElevation(15, 2) + 1), 0, 2);
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
      if (az >= 0 && az < (NUM_CELLS + 1)) {
        for (let dx = -HOLE_SIZE; dx <= HOLE_SIZE; dx++) {
          const ax = x + dx;
          if (ax >= 0 && ax < (NUM_CELLS + 1)) {
            for (let dy = -HOLE_SIZE; dy <= HOLE_SIZE; dy++) {
              const ay = y + dy;
              if (ay >= 0 && ay < (NUM_CELLS_HEIGHT + 1)) {
                ether[_getEtherIndex(ax, ay, az)] += v * Math.max(HOLE_SIZE - Math.sqrt(dx * dx + dy * dy + dz * dz), 0) / Math.sqrt(HOLE_SIZE * HOLE_SIZE * 3);
              }
            }
          }
        }
      }
    }
  }

  // compile

  const {
    positions,
    indices,
    attributeIndex,
    indexIndex,
    geometries,
  } = _makeGeometries(ox, oy, ether, liquid, liquidTypes);
  const colors = new Float32Array(NUM_POSITIONS_CHUNK);

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

  const _postProcessGeometry = (start, count, getColor) => {
    const geometryPositions = new Float32Array(positions.buffer, positions.byteOffset + start * 4, count);
    const geometryColors = new Float32Array(colors.buffer, colors.byteOffset + start * 4, count);

    const numPositions = geometryPositions.length / 3;
    for (let j = 0; j < numPositions; j++) {
      const baseIndex = j * 3;
      const x = geometryPositions[baseIndex + 0];
      const y = geometryPositions[baseIndex + 1];
      const z = geometryPositions[baseIndex + 2];

      const color = getColor((ox * NUM_CELLS) + x, y, (oy * NUM_CELLS) + z);
      const colorArray = Array.isArray(color) ? color : _colorIntToArray(color);
      geometryColors[baseIndex + 0] = colorArray[0];
      geometryColors[baseIndex + 1] = colorArray[1];
      geometryColors[baseIndex + 2] = colorArray[2];

      const ax = (ox * NUM_CELLS) + x;
      const az = (oy * NUM_CELLS) + z;
      geometryPositions[baseIndex + 0] = ax;
      geometryPositions[baseIndex + 2] = az;
    }
  };

  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    const geometry = geometries[i];
    const {attributeRange} = geometry;
    _postProcessGeometry(attributeRange.landStart, attributeRange.landCount, (x, y, z) => _getBiome(Math.floor(x), Math.floor(z)).color);
    _postProcessGeometry(attributeRange.waterStart, attributeRange.waterCount, (x, y, z) => {
      return [
        mod(Math.abs(x) / 16.0 * 4.0 * 0.99, 1) * 0.5,
        mod(Math.abs(z) / 16.0 * 4.0 / 16.0 * 0.99, 1),
        1.0
      ];
    });
    _postProcessGeometry(attributeRange.lavaStart, attributeRange.lavaCount, (x, y, z) => {
      return [
        0.5 + mod(Math.abs(x) / 16.0 * 4.0 * 0.99, 1) * 0.5,
        mod(Math.abs(z) / 16.0 * 4.0 / 16.0 * 0.99, 1),
        2.0
      ];
    });

    geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(ox * NUM_CELLS + NUM_CELLS_HALF, i * NUM_CELLS + NUM_CELLS_HALF, oy * NUM_CELLS + NUM_CELLS_HALF),
      NUM_CELLS_CUBE,
    );
  }

  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    const geometry = geometries[i];
    const peeks = new Uint8Array(16);
    const seenPeeks = new Uint8Array((NUM_CELLS + 1) * (NUM_CELLS_HEIGHT + 1) * (NUM_CELLS + 1));
    const minY = i * NUM_CELLS;
    const maxY = (i + 1) * NUM_CELLS;
    const _floodFill = (x, y, z, startFace) => {
      const index = _getEtherIndex(x, y, z);
      const queue = [[x, y, z, index]];
      seenPeeks[index] = 1;
      while (queue.length > 0) {
        const [x, y, z, index] = queue.shift();

        if (ether[index] >= 0) { // empty
          if (z === 0 && startFace !== PEEK_FACES.BACK) {
            peeks[PEEK_FACE_INDICES[startFace << 3 | PEEK_FACES.BACK]] = 1;
          }
          if (z === NUM_CELLS && startFace !== PEEK_FACES.FRONT) {
            peeks[PEEK_FACE_INDICES[startFace << 3 | PEEK_FACES.FRONT]] = 1;
          }
          if (x === 0 && startFace !== PEEK_FACES.LEFT) {
            peeks[PEEK_FACE_INDICES[startFace << 3 | PEEK_FACES.LEFT]] = 1;
          }
          if (x === NUM_CELLS && startFace !== PEEK_FACES.RIGHT) {
            peeks[PEEK_FACE_INDICES[startFace << 3 | PEEK_FACES.RIGHT]] = 1;
          }
          if (y === maxY && startFace !== PEEK_FACES.TOP) {
            peeks[PEEK_FACE_INDICES[startFace << 3 | PEEK_FACES.TOP]] = 1;
          }
          if (y === minY && startFace !== PEEK_FACES.BOTTOM) {
            peeks[PEEK_FACE_INDICES[startFace << 3 | PEEK_FACES.BOTTOM]] = 1;
          }

          for (let dx = -1; dx <= 1; dx++) {
            const ax = x + dx;
            if (ax >= 0 && ax <= NUM_CELLS) {
              for (let dz = -1; dz <= 1; dz++) {
                const az = z + dz;
                if (az >= 0 && az <= NUM_CELLS) {
                  for (let dy = -1; dy <= 1; dy++) {
                    const ay = y + dy;
                    if (ay >= minY && ay <= maxY) {
                      const index = _getEtherIndex(ax, ay, az);
                      if (!seenPeeks[index]) {
                        queue.push([ax, ay, az, index]);
                        seenPeeks[index] = 1;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
    for (let x = 0; x <= NUM_CELLS; x++) {
      for (let y = minY; y <= maxY; y++) {
        _floodFill(x, y, NUM_CELLS, PEEK_FACES.FRONT);
      }
    }
    for (let x = 0; x <= NUM_CELLS; x++) {
      for (let y = minY; y <= maxY; y++) {
        _floodFill(x, y, 0, PEEK_FACES.BACK);
      }
    }
    for (let z = 0; z <= NUM_CELLS; z++) {
      for (let y = minY; y <= maxY; y++) {
        _floodFill(0, y, z, PEEK_FACES.LEFT);
      }
    }
    for (let z = 0; z <= NUM_CELLS; z++) {
      for (let y = minY; y <= maxY; y++) {
        _floodFill(NUM_CELLS, y, z, PEEK_FACES.RIGHT);
      }
    }
    for (let x = 0; x <= NUM_CELLS; x++) {
      for (let z = 0; z <= NUM_CELLS; z++) {
        _floodFill(x, maxY, z, PEEK_FACES.TOP);
      }
    }
    for (let x = 0; x <= NUM_CELLS; x++) {
      for (let z = 0; z <= NUM_CELLS; z++) {
        _floodFill(x, minY, z, PEEK_FACES.BOTTOM);
      }
    }

    for (let startFace = 0; startFace < 6; startFace++) {
      for (let endFace = 0; endFace < 6; endFace++) {
        if (endFace !== startFace) {
          if (peeks[PEEK_FACE_INDICES[startFace << 3 | endFace]] === 1) {
            peeks[PEEK_FACE_INDICES[endFace << 3 | startFace]] = 1;

            for (let crossFace = 0; crossFace < 6; crossFace++) {
              if (crossFace !== startFace && crossFace !== endFace) {
                if (peeks[PEEK_FACE_INDICES[startFace << 3 | crossFace]] === 1) {
                  peeks[PEEK_FACE_INDICES[crossFace << 3 | startFace]] = 1;
                  peeks[PEEK_FACE_INDICES[crossFace << 3 | endFace]] = 1;
                  peeks[PEEK_FACE_INDICES[endFace << 3 | crossFace]] = 1;
                } else if (peeks[PEEK_FACE_INDICES[endFace << 3 | crossFace]] === 1) {
                  peeks[PEEK_FACE_INDICES[crossFace << 3 | startFace]] = 1;
                  peeks[PEEK_FACE_INDICES[crossFace << 3 | endFace]] = 1;
                  peeks[PEEK_FACE_INDICES[startFace << 3 | crossFace]] = 1;
                }
              }
            }
          }
        }
      }
    }

    geometry.peeks = peeks;
  }

  return {
    positions: new Float32Array(positions.buffer, positions.byteOffset, attributeIndex),
    colors: new Float32Array(colors.buffer, colors.byteOffset, attributeIndex),
    indices: new Uint32Array(indices.buffer, indices.byteOffset, indexIndex),
    geometries: geometries.map(geometry => ({
      indexRange: geometry.indexRange,
      boundingSphere: Float32Array.from(geometry.boundingSphere.center.toArray().concat([geometry.boundingSphere.radius])),
      peeks: geometry.peeks,
    })),
    heightfield,
    staticHeightfield,
    biomes,
    elevations,
    ether,
    liquid,
    liquidTypes,
  };
};
const _getCoordOverscanIndex = (x, y) => x + (y * NUM_CELLS_OVERSCAN);
const _getEtherIndex = (x, y, z) => x + (z * NUM_CELLS_OVERSCAN) + (y * NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN);
const _colorIntToArray = n => ([
  ((n >> (8 * 2)) & 0xFF) / 0xFF,
  ((n >> (8 * 1)) & 0xFF) / 0xFF,
  ((n >> (8 * 0)) & 0xFF) / 0xFF,
]);
const _getTopHeightfieldIndex = (x, z) => (x + (z * NUM_CELLS_OVERSCAN)) * HEIGHTFIELD_DEPTH;
const _getStaticHeightfieldIndex = (x, z) => x + (z * NUM_CELLS_OVERSCAN);

const _getLightsIndex = (x, y, z) => x + y * NUM_CELLS_OVERSCAN + z * NUM_CELLS_OVERSCAN * (NUM_CELLS_HEIGHT + 1);
const _getLightsArrayIndex = (x, z) => x + z * 3;

const generate = (x, y, buffer, byteOffset, opts) => {
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
  if (opts.oldLiquid === undefined) {
    opts.oldLiquid = null;
  }
  if (opts.oldLiquidTypes === undefined) {
    opts.oldLiquidTypes = null;
  }
  if (opts.regenerate === undefined) {
    opts.regenerate = false;
  }

  protocolUtils.stringifyData(_generateMapChunk(x, y, opts), buffer, byteOffset);
};

const light = (ox, oz, {getLightSources, isOccluded}) => {
  const lightsArray = Array(9);
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      lightsArray[_getLightsArrayIndex(dx + 1, dz + 1)] = new Uint8Array(NUM_CELLS_OVERSCAN * (NUM_CELLS_HEIGHT + 1) * NUM_CELLS_OVERSCAN);
    }
  }

  const minX = (ox - 1) * NUM_CELLS;
  const maxX = (ox + 2) * NUM_CELLS;
  const minZ = (oz - 1) * NUM_CELLS;
  const maxZ = (oz + 2) * NUM_CELLS;

  const _fillLight = (x, y, z, v) => {
    const queue = [];
    const _tryQueue = (x, y, z, v, origin) => {
      if (x >= minX && x < maxX && y >= 0 & y <= NUM_CELLS_HEIGHT && z >= minZ && z < maxZ && v > 0) {
        const lightsArrayIndex = _getLightsArrayIndex(Math.floor((x - minX) / NUM_CELLS), Math.floor((z - minZ) / NUM_CELLS));
        const lights = lightsArray[lightsArrayIndex];

        const lightsIndex = _getLightsIndex(x - Math.floor(x / NUM_CELLS) * NUM_CELLS, y, z - Math.floor(z / NUM_CELLS) * NUM_CELLS);
        if (lights[lightsIndex] < v) {
          lights[lightsIndex] = v;

          if (origin || !isOccluded(x, y, z)) {
            queue.push({x, y, z, v});
          }
        }
      }
    };

    _tryQueue(x, y, z, v, true);

    while (queue.length > 0) {
      const {x, y, z, v} = queue.shift();
      for (let dz = -1; dz <= 1; dz++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            _tryQueue(x + dx, y + dy, z + dz, v - (Math.abs(dx) + Math.abs(dy) + Math.abs(dz)), false);
          }
        }
      }
    }
  };

  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const lightSources = getLightSources(ox + dx, oz + dz);
      for (let i = 0; i < lightSources.length; i++) {
        const [x, y, z, v] = lightSources[i];
        _fillLight(x, y, z, v);
      }
    }
  }

  // merge edges and corner into center lights
  const centerLights = lightsArray[_getLightsArrayIndex(1, 1)];
  const eastLights = lightsArray[_getLightsArrayIndex(2, 1)]
  const southLights = lightsArray[_getLightsArrayIndex(1, 2)]
  const southeastLights = lightsArray[_getLightsArrayIndex(2, 2)]
  for (let z = 0; z < NUM_CELLS_OVERSCAN; z++) {
    for (let y = 0; y < (NUM_CELLS_HEIGHT + 1); y++) {
      centerLights[_getLightsIndex(NUM_CELLS, y, z)] = eastLights[_getLightsIndex(0, y, z)];
    }
  }
  for (let x = 0; x < NUM_CELLS_OVERSCAN; x++) {
    for (let y = 0; y < (NUM_CELLS_HEIGHT + 1); y++) {
      centerLights[_getLightsIndex(x, y, NUM_CELLS)] = southLights[_getLightsIndex(x, y, 0)];
    }
  }
  for (let y = 0; y < (NUM_CELLS_HEIGHT + 1); y++) {
    centerLights[_getLightsIndex(NUM_CELLS, y, NUM_CELLS)] = southeastLights[_getLightsIndex(0, y, 0)];
  }

  return centerLights;
};

return {
  generate,
  light,
};

};

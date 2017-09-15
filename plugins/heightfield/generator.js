module.exports = ({
  THREE,
  mod,
  murmur,
  alea,
  vxl,
}) => {

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
  BIOMES_INDEX,
  BIOMES_TALL,
  BIOMES_TEMPERATURE_HUMIDITY,
} = require('./lib/constants/constants');
const NUM_POSITIONS_CHUNK = 800 * 1024;
const NUM_CELLS_HALF = NUM_CELLS / 2;
const NUM_CELLS_CUBE = Math.sqrt(NUM_CELLS_HALF * NUM_CELLS_HALF * 3);
const NUM_CELLS_OVERSCAN_Y = NUM_CELLS_HEIGHT + OVERSCAN;
const HOLE_SIZE = 2;

const _makeGeometries = (ox, oy, ether, water, lava) => {
  const positions = new Float32Array(NUM_POSITIONS_CHUNK);
  const indices = new Uint32Array(NUM_POSITIONS_CHUNK);
  let attributeIndex = 0;
  let indexIndex = 0;

  // land
  const geometries = Array(NUM_CHUNKS_HEIGHT);
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    const {positions: newPositions, indices: newIndices} = vxl.marchingCubes(
      [NUM_CELLS + 1, NUM_CELLS + 1, NUM_CELLS + 1],
      ether,
      [
        [0, NUM_CELLS * i, 0],
        [NUM_CELLS + 1, (NUM_CELLS * (i + 1)) + 1, NUM_CELLS + 1],
      ],
      attributeIndex / 3,
      new Float32Array(positions.buffer, positions.byteOffset + attributeIndex * 4),
      new Uint32Array(indices.buffer, indices.byteOffset + indexIndex * 4)
    );

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
    const {positions: newWaterPositions, indices: newWaterIndices} = vxl.marchingCubes(
      [NUM_CELLS + 1, NUM_CELLS + 1, NUM_CELLS + 1],
      water,
      [
        [0, NUM_CELLS * i, 0],
        [NUM_CELLS + 1, (NUM_CELLS * (i + 1)) + 1, NUM_CELLS + 1],
      ],
      attributeIndex / 3,
      new Float32Array(positions.buffer, positions.byteOffset + attributeIndex * 4),
      new Uint32Array(indices.buffer, indices.byteOffset + indexIndex * 4)
    );

    const {attributeRange, indexRange} = geometries[i];
    attributeRange.waterStart = attributeIndex;
    attributeRange.waterCount = newWaterPositions.length;
    indexRange.waterStart = indexIndex;
    indexRange.waterCount = newWaterIndices.length;

    attributeIndex += newWaterPositions.length;
    indexIndex += newWaterIndices.length;

    // lava
    const {positions: newLavaPositions, indices: newLavaIndices} = vxl.marchingCubes(
      [NUM_CELLS + 1, NUM_CELLS + 1, NUM_CELLS + 1],
      lava,
      [
        [0, NUM_CELLS * i, 0],
        [NUM_CELLS + 1, (NUM_CELLS * (i + 1)) + 1, NUM_CELLS + 1],
      ],
      attributeIndex / 3,
      new Float32Array(positions.buffer, positions.byteOffset + attributeIndex * 4),
      new Uint32Array(indices.buffer, indices.byteOffset + indexIndex * 4)
    );

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

const _getCachesIndex2D = (x, z) => mod(x, 256) | mod(z, 256) << 8; // XXX make sure this does not overflow cache size
const _getCacheIndex2D = (x, z) => x + z * NUM_CELLS;
const _makeCacher2D = (gen, {type = Float32Array} = {}) => {
  const caches = {};
  return (x, z) => {
    const ox = Math.floor(x / NUM_CELLS);
    const oz = Math.floor(z / NUM_CELLS);
    const cachesIndex = _getCachesIndex2D(ox, oz);
    let entry = caches[cachesIndex];
    if (entry === undefined) {
      entry = new type(NUM_CELLS * NUM_CELLS);
      let index = 0;
      for (let dz = 0; dz < NUM_CELLS; dz++) {
        for (let dx = 0; dx < NUM_CELLS; dx++) {
          entry[index++] = gen(ox * NUM_CELLS + dx, oz * NUM_CELLS + dz);
        }
      }
      caches[cachesIndex] = entry;
    }
    return entry[_getCacheIndex2D(x - ox * NUM_CELLS, z - oz * NUM_CELLS)];
  };
};

const _getCachesIndex3D = (b, x, z) => mod(b, 256) | mod(x, 256) << 8 | mod(z, 256) << 16; // XXX make sure this does not overflow cache size
const _getCacheIndex3D = (x, z) => x + z * NUM_CELLS;
const _makeCacher3D = (gen, {type = Float32Array} = {}) => {
  const caches = {};
  return (b, x, z) => {
    const ox = Math.floor(x / NUM_CELLS);
    const oz = Math.floor(z / NUM_CELLS);
    const cachesIndex = _getCachesIndex3D(b, ox, oz);
    let entry = caches[cachesIndex];
    if (entry === undefined) {
      entry = new type(NUM_CELLS * NUM_CELLS);
      let index = 0;
      for (let dz = 0; dz < NUM_CELLS; dz++) {
        for (let dx = 0; dx < NUM_CELLS; dx++) {
          entry[index++] = gen(b, ox * NUM_CELLS + dx, oz * NUM_CELLS + dz);
        }
      }
      caches[cachesIndex] = entry;
    }
    return entry[_getCacheIndex3D(x - ox * NUM_CELLS, z - oz * NUM_CELLS)];
  };
};

const _random = (() => {
  const rng = new alea(DEFAULT_SEED);
  const _randInt = (() => {
    const float32Array = new Float32Array(1);
    const int32Array = new Int32Array(float32Array.buffer, float32Array.byteOffset, 1);
    return () => {
      float32Array[0] = rng();
      return int32Array[0];
    };
  })();
  const elevationNoise1 = new vxl.fastNoise({
    seed: _randInt(),
    frequency: 2,
    octaves: 1,
  });
  const elevationNoise2 = new vxl.fastNoise({
    seed: _randInt(),
    frequency: 2,
    octaves: 1,
  });
  const elevationNoise3 = new vxl.fastNoise({
    seed: _randInt(),
    frequency: 2,
    octaves: 1,
  });

  let noise = new vxl.fastNoise({
    seed: _randInt(),
    frequency: 0.002,
    octaves: 2,
  });
  const wormNoise = _makeCacher2D(noise.in2D.bind(noise));
  noise = new vxl.fastNoise({
    seed: _randInt(),
    frequency: 0.002,
    octaves: 4,
  });
  const oceanNoise = _makeCacher2D(noise.in2D.bind(noise));
  noise = new vxl.fastNoise({
    seed: _randInt(),
    frequency: 0.002,
    octaves: 4,
  });
  const riverNoise = _makeCacher2D(noise.in2D.bind(noise));
  noise = new vxl.fastNoise({
    seed: _randInt(),
    frequency: 0.002,
    octaves: 4,
  });
  const temperatureNoise = _makeCacher2D(noise.in2D.bind(noise));
  noise = new vxl.fastNoise({
    seed: _randInt(),
    frequency: 0.002,
    octaves: 4,
  });
  const humidityNoise = _makeCacher2D(noise.in2D.bind(noise));

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

const _getBiome = _makeCacher2D((x, z) => {
  let biome;
  const _genOcean = () => {
    if (_random.oceanNoise(x + 1000, z + 1000) < (90 / 255)) {
      biome = BIOMES.biOcean.index;
    }
  };
  const _genRivers = () => {
    if (biome === undefined) {
      const n = _random.riverNoise(x + 1000, z + 1000);
      const range = 0.04;
      if (n > 0.5 - range && n < 0.5 + range) {
        biome = BIOMES.biRiver.index;
      }
    }
  };
  const _genFreezeWater = () => {
    if (_random.temperatureNoise(x + 1000, z + 1000) < ((4 * 16) / 255)) {
      if (biome === BIOMES.biOcean.index) {
        biome = BIOMES.biFrozenOcean.index;
      } else if (biome === BIOMES.biRiver.index) {
        biome = BIOMES.biFrozenRiver.index;
      }
    }
  };
  const _genLand = () => {
    if (biome === undefined) {
      const t = Math.floor(_random.temperatureNoise(x + 1000, z + 1000) * 16);
      const h = Math.floor(_random.humidityNoise(x + 1000, z + 1000) * 16);
      biome = BIOMES_TEMPERATURE_HUMIDITY[t + 16 * h].index;
    }
  };
  _genOcean();
  _genRivers();
  _genFreezeWater();
  _genLand();

  return biome;
}, {type: Uint8Array});

const _getBiomeHeight = _makeCacher3D((b, x, z) => {
  const biome = BIOMES_INDEX[b];
  return biome.baseHeight +
    _random.elevationNoise1.in2D(x * biome.amps[0][0], z * biome.amps[0][0]) * biome.amps[0][1] +
    _random.elevationNoise2.in2D(x * biome.amps[1][0], z * biome.amps[1][0]) * biome.amps[1][1] +
    _random.elevationNoise3.in2D(x * biome.amps[2][0], z * biome.amps[2][0]) * biome.amps[2][1];
});

const _getElevation = _makeCacher2D((x, z) => {
  const biomeCounts = {};
  let totalBiomeCounts = 0;
  for (let dz = -8; dz <= 8; dz++) {
    for (let dx = -8; dx <= 8; dx++) {
      const biome = _getBiome(x + dx, z + dz);
      let biomeCount = biomeCounts[biome];
      if (!biomeCount) {
        biomeCount = {
          count: 0,
          height: _getBiomeHeight(biome, x, z),
        };
        biomeCounts[biome] = biomeCount;
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
});

const localVector = new THREE.Vector3();
const localTriangle = new THREE.Triangle();
localTriangle.points = [localTriangle.a, localTriangle.b, localTriangle.c];
const _generateMapChunk = (ox, oy, opts) => {
  // generate

  const biomes = (() => {
    let biomes = opts.oldBiomes;
    if (!biomes) {
      biomes = new Uint8Array(NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN);
      let index = 0;
      for (let z = 0; z < NUM_CELLS_OVERSCAN; z++) {
        for (let x = 0; x < NUM_CELLS_OVERSCAN; x++) {
          biomes[index++] = _getBiome((ox * NUM_CELLS) + x, (oy * NUM_CELLS) + z);
        }
      }
    }
    return biomes;
  })();

  // const elevations = (() => {
    let elevations = opts.oldElevations;
    if (!elevations) {
      elevations = new Float32Array(NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN);
      let index = 0;
      for (let z = 0; z < NUM_CELLS_OVERSCAN; z++) {
        for (let x = 0; x < NUM_CELLS_OVERSCAN; x++) {
          elevations[index++] = _getElevation((ox * NUM_CELLS) + x, (oy * NUM_CELLS) + z);
        }
      }
    }
    // return elevations;
  // })();

  // const ether = (() => {
    let ether = opts.oldEther;
    if (!ether) {
      ether = new Float32Array((NUM_CELLS + 1) * (NUM_CELLS_HEIGHT + 1) * (NUM_CELLS + 1));
      let index = 0;
      for (let z = 0; z < NUM_CELLS_OVERSCAN; z++) {
        for (let x = 0; x < NUM_CELLS_OVERSCAN; x++) {
          const elevation = elevations[index++];
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
          const n = _random.wormNoise(aox * NUM_CELLS + 1000, aoy * NUM_CELLS + 1000);
          const numNests = Math.floor(n * 4);

          for (let i = 0; i < numNests; i++) {
            const s = [n, i].join(':');

            const nestX = (aox * NUM_CELLS) + (murmur(s + ':x') / 0xFFFFFFFF) * NUM_CELLS;
            const nestY = (murmur(s + ':y') / 0xFFFFFFFF) * NUM_CELLS_HEIGHT;
            const nestZ = (aoy * NUM_CELLS) + (murmur(s + ':z') / 0xFFFFFFFF) * NUM_CELLS;

            const numWorms = 1 + Math.floor((murmur(s + ':worms') / 0xFFFFFFFF) * (2 + 1));
            for (let j = 0; j < numWorms; j++) {
              const s = [n, i, j].join(':');

              let cavePosX = nestX;
              let cavePosY = nestY;
              let cavePosZ = nestZ;
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

                  // const height = (1 - 0.3 + Math.pow(_random.elevationNoise.in2D(centerPosX + 1000, centerPosZ + 1000), 0.5)) * 64;
                  // let radius = (height - centerPosY) / height;
                  // radius = 1.3 + (radius * 3.5 + 1) * caveRadius;
                  const radius = 3 + 3.5 * caveRadius * Math.sin(len * Math.PI / caveLength);

                  _fillOblateSpheroid(centerPosX, centerPosY, centerPosZ, ox * NUM_CELLS, oy * NUM_CELLS, (ox + 1) * NUM_CELLS, (oy + 1) * NUM_CELLS, radius);
                }
              }
            }
          }
        }
      } */
    }
    // return ether;
  // })();

  // const {water, lava} = (() => {
    let water = opts.oldWater;
    let lava = opts.oldLava;
    if (!water || !lava) {
      water = new Float32Array((NUM_CELLS + 1) * (NUM_CELLS_HEIGHT + 1) * (NUM_CELLS + 1));
      water.fill(1);
      lava = new Float32Array((NUM_CELLS + 1) * (NUM_CELLS_HEIGHT + 1) * (NUM_CELLS + 1));
      lava.fill(1);

      const _setLiquid = (x, y, z, liquid) => {
        x -= ox * NUM_CELLS;
        z -= oy * NUM_CELLS;

        for (let dz = -1; dz <= 1; dz++) {
          const az = z + dz;
          if (az >= 0 && az < (NUM_CELLS + 1)) {
            for (let dx = -1; dx <= 1; dx++) {
              const ax = x + dx;
              if (ax >= 0 && ax < (NUM_CELLS + 1)) {
                for (let dy = -1; dy <= 1; dy++) {
                  const ay = y + dy;
                  const index = _getEtherIndex(ax, ay, az);
                  // const oldLiquidValue = liquid[index];

                  // if (oldLiquidValue === 0 || oldLiquidValue === 0xFF || oldLiquidValue === 0xFE) {
                    if (ay >= 0 && ay < (NUM_CELLS_HEIGHT + 1)) {
                      liquid[index] = Math.min(-1 * (1 - (Math.sqrt(dx*dx + dy*dy + dz*dz) / (Math.sqrt(3)*0.8))), liquid[index]);
                      /* if (dx === 0 && dy === 0 && dz === 0) {
                        liquid[index] = -1;
                      } else if (liquid[index] === 0) {
                        liquid[index] = (dy >= 0) ? 0xFF : (dx === 0 && dz === 0 ? 0xFE : 0);
                      } */
                    }
                  // }
                }
              }
            }
          }
        }
      };

      // water
      let index = 0;
      for (let z = 0; z <= NUM_CELLS; z++) {
        for (let x = 0; x <= NUM_CELLS; x++) {
          const elevation = elevations[index++];
          for (let y = 0; y <= NUM_CELLS_HEIGHT; y++) {
            if (y < 64 && y >= elevation) {
              const index = _getEtherIndex(x, y, z);
              water[index] = ether[index] * -1;
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
              // const biome = _getBiome(x, z);
              // if (BIOMES_TALL[biome] && elevation >= 90) {
              if (elevation >= 80) {
                if (_random.temperatureNoise(ax + 1000, az + 1000) < 0.2) {
                  _setLiquid(ax, Math.floor(elevation + 1), az, lava);
                }
              }
            }
          }
        }
      }

      _setLiquid(15, Math.floor(_getElevation(15, 2) + 1), 0, lava);
    }
    // return {water, lava};
  // })();

  // const _applyNewEthers = () => {
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
  // };
  // _applyNewEthers();

  // compile

  const {
    positions,
    indices,
    attributeIndex,
    indexIndex,
    geometries,
  } = _makeGeometries(ox, oy, ether, water, lava);
  const colors = new Float32Array(NUM_POSITIONS_CHUNK);

  // const {heightfield, staticHeightfield} = (() => { // XXX can be optimized
    const heightfield = new Float32Array(NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN * HEIGHTFIELD_DEPTH);
    heightfield.fill(-1024);
    const staticHeightfield = new Float32Array(NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN);
    staticHeightfield.fill(-1024);

    const numIndices = indices.length / 3;
    let localIndexIndex = 0;
    for (let i = 0; i < numIndices; i++) {
      localTriangle.a.x = positions[localIndexIndex++];
      localTriangle.a.y = positions[localIndexIndex++];
      localTriangle.a.z = positions[localIndexIndex++];
      localTriangle.b.x = positions[localIndexIndex++];
      localTriangle.b.y = positions[localIndexIndex++];
      localTriangle.b.z = positions[localIndexIndex++];
      localTriangle.c.x = positions[localIndexIndex++];
      localTriangle.c.y = positions[localIndexIndex++];
      localTriangle.c.z = positions[localIndexIndex++];
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

    // return {heightfield, staticHeightfield};
  // })();

  const _postProcessGeometry = (start, count, getColor, offset) => {
    const geometryPositions = new Float32Array(positions.buffer, positions.byteOffset + start * 4, count);
    const geometryColors = new Float32Array(colors.buffer, colors.byteOffset + start * 4, count);

    const numPositions = geometryPositions.length / 3;
    let baseIndex = 0;
    for (let j = 0; j < numPositions; j++) {
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
      if (offset) {
        geometryPositions[baseIndex + 1] += offset;
      }

      baseIndex += 3;
    }
  };

  // const _postProcessGeometries = () => {
    for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
      const geometry = geometries[i];
      const {attributeRange} = geometry;
      _postProcessGeometry(attributeRange.landStart, attributeRange.landCount, (x, y, z) => BIOMES_INDEX[_getBiome(Math.floor(x), Math.floor(z))].color);
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
      }, 0.01);

      geometry.boundingSphere = new THREE.Sphere(
        new THREE.Vector3(ox * NUM_CELLS + NUM_CELLS_HALF, i * NUM_CELLS + NUM_CELLS_HALF, oy * NUM_CELLS + NUM_CELLS_HALF),
        NUM_CELLS_CUBE
      );
    }
  // };
  // _postProcessGeometries();

  // const _floodPeeks = () => {
    for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
      const geometry = geometries[i];
      const peeks = new Uint8Array(16);
      vxl.flood(ether, [0, i * NUM_CELLS, 0], peeks);

      geometry.peeks = peeks;
    }
  // };
  // _floodPeeks();

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
    water,
    lava,
  };
};
const _getCoordOverscanIndex = (x, z) => x + z * NUM_CELLS_OVERSCAN;
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

const generate = (x, y, opts) => {
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

  return _generateMapChunk(x, y, opts);
};

const _makeLights = () => new Uint8Array(NUM_CELLS_OVERSCAN * (NUM_CELLS_HEIGHT + 1) * NUM_CELLS_OVERSCAN);
const light = (ox, oz, oldLightsArray, minX, maxX, minY, maxY, minZ, maxZ, {getLightSources, isOccluded}) => {
  let lightsArray;
  if (oldLightsArray) {
    lightsArray = oldLightsArray;

    for (let z = minZ; z < maxZ; z++) {
      for (let x = minX; x < maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const lax = Math.floor((x - (ox - 1) * NUM_CELLS) / NUM_CELLS);
          const laz = Math.floor((z - (oz - 1) * NUM_CELLS) / NUM_CELLS);
          const lightsArrayIndex = _getLightsArrayIndex(lax, laz);
          const lights = lightsArray[lightsArrayIndex];

          const ax = x - Math.floor(x / NUM_CELLS) * NUM_CELLS;
          const ay = y;
          const az = z - Math.floor(z / NUM_CELLS) * NUM_CELLS;
          const lightsIndex = _getLightsIndex(ax, ay, az);
          lightsArray[lightsIndex] = 0;
        }
      }
    }
  } else {
    lightsArray = Array(9);

    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        lightsArray[_getLightsArrayIndex(dx + 1, dz + 1)] = _makeLights();
      }
    }
  }

  const _fillLight = (x, y, z, v) => {
    const queue = [];
    const _tryQueue = (x, y, z, v, origin) => {
      if (x >= minX && x < maxX && y >= minY & y <= maxY && z >= minZ && z < maxZ && v > 0) {
        const lax = Math.floor((x - (ox - 1) * NUM_CELLS) / NUM_CELLS);
        const laz = Math.floor((z - (oz - 1) * NUM_CELLS) / NUM_CELLS);
        const lightsArrayIndex = _getLightsArrayIndex(lax, laz);
        const lights = lightsArray[lightsArrayIndex];

        const ax = x - Math.floor(x / NUM_CELLS) * NUM_CELLS;
        const ay = y;
        const az = z - Math.floor(z / NUM_CELLS) * NUM_CELLS;
        const lightsIndex = _getLightsIndex(ax, ay, az);
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
  const eastLights = lightsArray[_getLightsArrayIndex(2, 1)];
  const southLights = lightsArray[_getLightsArrayIndex(1, 2)];
  const southeastLights = lightsArray[_getLightsArrayIndex(2, 2)];
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

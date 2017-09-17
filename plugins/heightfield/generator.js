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

const _align = (n, alignment) => {
  let alignDiff = n % alignment;
  if (alignDiff > 0) {
    n += alignment - alignDiff;
  }
  return n;
};

const _makeGeometries = (ox, oy, ether, water, lava, positions, indices) => {
  // const positions = new Float32Array(NUM_POSITIONS_CHUNK);
  // const indices = new Uint32Array(NUM_POSITIONS_CHUNK);
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

  // new Float32Array(positions.buffer, positions.byteOffset + attributeIndex * 4, positions.length - attributeIndex).fill(0);
  // new Uint32Array(indices.buffer, indices.byteOffset + indexIndex * 4, indices.length - indexIndex).fill(0);

  return {
    positions: new Float32Array(positions.buffer, positions.byteOffset, attributeIndex),
    indices: new Uint32Array(indices.buffer, indices.byteOffset, indexIndex),
    attributeIndex,
    indexIndex,
    geometries,
  }
};

/* const _getCachesIndex2D = (x, z) => mod(x, 256) | mod(z, 256) << 8; // XXX make sure this does not overflow cache size
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
  const wormNoise = new vxl.cachedFastNoise({
    seed: _randInt(),
    frequency: 0.002,
    octaves: 2,
  });
  const oceanNoise = new vxl.cachedFastNoise({
    seed: _randInt(),
    frequency: 0.002,
    octaves: 4,
  })
  const riverNoise = new vxl.cachedFastNoise({
    seed: _randInt(),
    frequency: 0.002,
    octaves: 4,
  });
  const temperatureNoise = new vxl.cachedFastNoise({
    seed: _randInt(),
    frequency: 0.002,
    octaves: 4,
  });
  const humidityNoise = new vxl.cachedFastNoise({
    seed: _randInt(),
    frequency: 0.002,
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

const _getBiome = _makeCacher2D((x, z) => {
  let biome;
  const _genOcean = () => {
    if (_random.oceanNoise.in2D(x + 1000, z + 1000) < (90 / 255)) {
      biome = BIOMES.biOcean.index;
    }
  };
  const _genRivers = () => {
    if (biome === undefined) {
      const n = _random.riverNoise.in2D(x + 1000, z + 1000);
      const range = 0.04;
      if (n > 0.5 - range && n < 0.5 + range) {
        biome = BIOMES.biRiver.index;
      }
    }
  };
  const _genFreezeWater = () => {
    if (_random.temperatureNoise.in2D(x + 1000, z + 1000) < ((4 * 16) / 255)) {
      if (biome === BIOMES.biOcean.index) {
        biome = BIOMES.biFrozenOcean.index;
      } else if (biome === BIOMES.biRiver.index) {
        biome = BIOMES.biFrozenRiver.index;
      }
    }
  };
  const _genLand = () => {
    if (biome === undefined) {
      const t = Math.floor(_random.temperatureNoise.in2D(x + 1000, z + 1000) * 16);
      const h = Math.floor(_random.humidityNoise.in2D(x + 1000, z + 1000) * 16);
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
}); */

const noiser = vxl.noiser({
  seed: murmur(DEFAULT_SEED),
});

const slab = (() => {
  const BIOMES_SIZE = _align(NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN * Uint8Array.BYTES_PER_ELEMENT, Float32Array.BYTES_PER_ELEMENT);
  const ELEVATIONS_SIZE = NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN * Float32Array.BYTES_PER_ELEMENT;
  const ETHER_SIZE = ((NUM_CELLS + 1) * (NUM_CELLS_HEIGHT + 1) * (NUM_CELLS + 1)) * Float32Array.BYTES_PER_ELEMENT;
  const WATER_SIZE  = ((NUM_CELLS + 1) * (NUM_CELLS_HEIGHT + 1) * (NUM_CELLS + 1)) * Float32Array.BYTES_PER_ELEMENT;
  const LAVA_SIZE = ((NUM_CELLS + 1) * (NUM_CELLS_HEIGHT + 1) * (NUM_CELLS + 1)) * Float32Array.BYTES_PER_ELEMENT;
  const POSITIONS_SIZE = NUM_POSITIONS_CHUNK * Float32Array.BYTES_PER_ELEMENT;
  const INDICES_SIZE = NUM_POSITIONS_CHUNK * Uint32Array.BYTES_PER_ELEMENT;
  const COLORS_SIZE = NUM_POSITIONS_CHUNK * Float32Array.BYTES_PER_ELEMENT;
  const HEIGHTFIELD_SIZE = NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN * HEIGHTFIELD_DEPTH * Float32Array.BYTES_PER_ELEMENT;
  const STATIC_HEIGHTFIELD_SIZE = NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN * Float32Array.BYTES_PER_ELEMENT;
  const PEEK_SIZE = 16 * Uint8Array.BYTES_PER_ELEMENT;
  const PEEKS_ARRAY_SIZE = PEEK_SIZE * NUM_CHUNKS_HEIGHT;

  const buffer = new ArrayBuffer(
    BIOMES_SIZE +
    ELEVATIONS_SIZE +
    ETHER_SIZE +
    WATER_SIZE +
    LAVA_SIZE +
    POSITIONS_SIZE +
    INDICES_SIZE +
    COLORS_SIZE +
    HEIGHTFIELD_SIZE +
    STATIC_HEIGHTFIELD_SIZE +
    PEEKS_ARRAY_SIZE
  );
  let index = 0;

  const biomes = new Uint8Array(buffer, index, BIOMES_SIZE / Uint8Array.BYTES_PER_ELEMENT);
  index += BIOMES_SIZE;
  const elevations = new Float32Array(buffer, index, ELEVATIONS_SIZE / Float32Array.BYTES_PER_ELEMENT);
  index += ELEVATIONS_SIZE;
  const ether = new Float32Array(buffer, index, ETHER_SIZE / Float32Array.BYTES_PER_ELEMENT);
  index += ETHER_SIZE;
  const water = new Float32Array(buffer, index, WATER_SIZE / Float32Array.BYTES_PER_ELEMENT);
  index += WATER_SIZE;
  const lava = new Float32Array(buffer, index, LAVA_SIZE / Float32Array.BYTES_PER_ELEMENT);
  index += LAVA_SIZE;
  const positions = new Float32Array(buffer, index, POSITIONS_SIZE / Float32Array.BYTES_PER_ELEMENT);
  index += POSITIONS_SIZE;
  const indices = new Uint32Array(buffer, index, INDICES_SIZE / Uint32Array.BYTES_PER_ELEMENT);
  index += INDICES_SIZE;
  const colors = new Float32Array(buffer, index, COLORS_SIZE / Float32Array.BYTES_PER_ELEMENT);
  index += COLORS_SIZE;
  const heightfield = new Float32Array(buffer, index, HEIGHTFIELD_SIZE / Float32Array.BYTES_PER_ELEMENT);
  index += HEIGHTFIELD_SIZE;
  const staticHeightfield = new Float32Array(buffer, index, STATIC_HEIGHTFIELD_SIZE / Float32Array.BYTES_PER_ELEMENT);
  index += STATIC_HEIGHTFIELD_SIZE;
  const peeksArray = Array(NUM_CHUNKS_HEIGHT);
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    peeksArray[i] = new Uint8Array(buffer, index, PEEK_SIZE / Uint8Array.BYTES_PER_ELEMENT);
    index += PEEK_SIZE;
  }

  return {
    biomes,
    elevations,
    ether,
    water,
    lava,
    positions,
    indices,
    colors,
    heightfield,
    staticHeightfield,
    peeksArray,
  };
})();

const _generateMapChunk = (ox, oy, opts) => {
  // generate

  let biomes = opts.oldBiomes;
  if (!biomes) {
    biomes = slab.biomes;
    noiser.fillBiomes(ox, oy, biomes);
  }

  let elevations = opts.oldElevations;
  if (!elevations) {
    elevations = slab.elevations;
    noiser.fillElevations(ox, oy, elevations);
  }

  let ether = opts.oldEther;
  if (!ether) {
    ether = slab.ether;
    noiser.fillEther(elevations, ether);

    /* let index = 0;
    for (let z = 0; z < NUM_CELLS_OVERSCAN; z++) {
      for (let x = 0; x < NUM_CELLS_OVERSCAN; x++) {
        const elevation = elevations[index++];
        for (let y = 0; y < NUM_CELLS_OVERSCAN_Y; y++) {
          ether[_getEtherIndex(x, y, z)] = Math.min(Math.max(y - elevation, -1), 1);
        }
      }
    } */

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

  let water = opts.oldWater;
  let lava = opts.oldLava;
  if (!water || !lava) {
    water = slab.water;
    lava = slab.lava;

    noiser.fillLiquid(ox, oy, ether, elevations, water, lava);
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
  } = _makeGeometries(ox, oy, ether, water, lava, slab.positions, slab.indices);

  const {heightfield, staticHeightfield} = slab;
  vxl.genHeightfield(positions, indices, indices.length, heightfield, staticHeightfield);

  const {colors} = slab;
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    const geometry = geometries[i];
    noiser.postProcessGeometry(ox, oy, geometry.attributeRange, positions, colors, biomes);

    const peeks = slab.peeksArray[i];
    vxl.flood(ether, [0, i * NUM_CELLS, 0], peeks);
    geometry.peeks = peeks;

    geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(ox * NUM_CELLS + NUM_CELLS_HALF, i * NUM_CELLS + NUM_CELLS_HALF, oy * NUM_CELLS + NUM_CELLS_HALF),
      NUM_CELLS_CUBE
    );
  }

  return {
    positions,
    colors: new Float32Array(colors.buffer, colors.byteOffset, attributeIndex),
    indices,
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
// const _getCoordOverscanIndex = (x, z) => x + z * NUM_CELLS_OVERSCAN;
const _getEtherIndex = (x, y, z) => x + (z * NUM_CELLS_OVERSCAN) + (y * NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN);
/* const _colorIntToArray = n => ([
  ((n >> (8 * 2)) & 0xFF) / 0xFF,
  ((n >> (8 * 1)) & 0xFF) / 0xFF,
  ((n >> (8 * 0)) & 0xFF) / 0xFF,
]); */
// const _getTopHeightfieldIndex = (x, z) => (x + (z * NUM_CELLS_OVERSCAN)) * HEIGHTFIELD_DEPTH;
// const _getStaticHeightfieldIndex = (x, z) => x + (z * NUM_CELLS_OVERSCAN);

// const _getLightsIndex = (x, y, z) => x + y * NUM_CELLS_OVERSCAN + z * NUM_CELLS_OVERSCAN * (NUM_CELLS_HEIGHT + 1);
// const _getLightsArrayIndex = (x, z) => x + z * 3;

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

/* const _makeLights = () => new Uint8Array(NUM_CELLS_OVERSCAN * (NUM_CELLS_HEIGHT + 1) * NUM_CELLS_OVERSCAN);
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
}; */

return {
  generate,
  // light,
};

};

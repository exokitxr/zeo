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
    positions: new Float32Array(positions.buffer, positions.byteOffset, attributeIndex),
    indices: new Uint32Array(indices.buffer, indices.byteOffset, indexIndex),
    attributeIndex,
    indexIndex,
    geometries,
  }
};

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

  if (opts.newEther && opts.newEther.length > 0) {
    noiser.applyEther(opts.newEther, opts.newEther.length, ether);
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
// const _getEtherIndex = (x, y, z) => x + (z * NUM_CELLS_OVERSCAN) + (y * NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN);

const generate = (x, y, opts = {}) => _generateMapChunk(x, y, opts);

return {
  generate,
};

};

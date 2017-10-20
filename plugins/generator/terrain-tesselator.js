const {
  NUM_CELLS,
  OVERSCAN,
  NUM_CELLS_OVERSCAN,

  NUM_CELLS_HEIGHT,
  NUM_CHUNKS_HEIGHT,

  NUM_POSITIONS_CHUNK,

  DEFAULT_SEED,
} = require('./lib/constants/constants');

const NUM_CELLS_HALF = NUM_CELLS / 2;
const NUM_CELLS_CUBE = Math.sqrt(NUM_CELLS_HALF * NUM_CELLS_HALF * 3);
const NUM_CELLS_OVERSCAN_Y = NUM_CELLS_HEIGHT + OVERSCAN;

module.exports = ({
  THREE,
  mod,
  murmur,
  noiser,
}) => {

const _align = (n, alignment) => {
  let alignDiff = n % alignment;
  if (alignDiff > 0) {
    n += alignment - alignDiff;
  }
  return n;
};

const slab = (() => {
  const BIOMES_SIZE = _align(NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN * Uint8Array.BYTES_PER_ELEMENT, Float32Array.BYTES_PER_ELEMENT);
  const TEMPERATURE_SIZE = _align(1 * Uint8Array.BYTES_PER_ELEMENT, Float32Array.BYTES_PER_ELEMENT);
  const HUMIDITY_SIZE = _align(1 * Uint8Array.BYTES_PER_ELEMENT, Float32Array.BYTES_PER_ELEMENT);
  const ELEVATIONS_SIZE = NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN * Float32Array.BYTES_PER_ELEMENT;
  const ETHER_SIZE = ((NUM_CELLS + 1) * (NUM_CELLS_HEIGHT + 1) * (NUM_CELLS + 1)) * Float32Array.BYTES_PER_ELEMENT;
  const WATER_SIZE  = ((NUM_CELLS + 1) * (NUM_CELLS_HEIGHT + 1) * (NUM_CELLS + 1)) * Float32Array.BYTES_PER_ELEMENT;
  const LAVA_SIZE = ((NUM_CELLS + 1) * (NUM_CELLS_HEIGHT + 1) * (NUM_CELLS + 1)) * Float32Array.BYTES_PER_ELEMENT;

  const buffer = new ArrayBuffer(
    BIOMES_SIZE +
    TEMPERATURE_SIZE +
    HUMIDITY_SIZE +
    ELEVATIONS_SIZE +
    ETHER_SIZE +
    WATER_SIZE +
    LAVA_SIZE
  );

  let index = 0;
  const biomes = new Uint8Array(buffer, index, BIOMES_SIZE / Uint8Array.BYTES_PER_ELEMENT);
  index += BIOMES_SIZE;
  const temperature = new Uint8Array(buffer, index, 1);
  index += TEMPERATURE_SIZE;
  const humidity = new Uint8Array(buffer, index, 1);
  index += HUMIDITY_SIZE;
  const elevations = new Float32Array(buffer, index, ELEVATIONS_SIZE / Float32Array.BYTES_PER_ELEMENT);
  index += ELEVATIONS_SIZE;
  const ether = new Float32Array(buffer, index, ETHER_SIZE / Float32Array.BYTES_PER_ELEMENT);
  index += ETHER_SIZE;
  const water = new Float32Array(buffer, index, WATER_SIZE / Float32Array.BYTES_PER_ELEMENT);
  index += WATER_SIZE;
  const lava = new Float32Array(buffer, index, LAVA_SIZE / Float32Array.BYTES_PER_ELEMENT);
  index += LAVA_SIZE;

  return {
    biomes,
    temperature,
    humidity,
    elevations,
    ether,
    water,
    lava,
  };
})();

const _generateMapChunk = (ox, oy, opts) => {
  // generate

  let biomes = opts.oldBiomes;
  let temperature = opts.oldTemperature;
  let humidity = opts.oldHumidity;
  let fillBiomes = false;
  if (!(biomes && biomes.length > 0)) {
    biomes = slab.biomes;
    temperature = slab.temperature;
    humidity = slab.humidity;
    fillBiomes = true;
  }

  let elevations = opts.oldElevations;
  let fillElevations = false;
  if (!(elevations && elevations.length > 0)) {
    elevations = slab.elevations;
    fillElevations = true;
  }

  let ether = opts.oldEther;
  let fillEther = false;
  if (!(ether && ether.length > 0)) {
    ether = slab.ether;
    fillEther = true;

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
  let fillLiquid = false;
  if (!(water && water.length > 0 && lava && lava.length > 0)) {
    water = slab.water;
    lava = slab.lava;
    fillLiquid = true;
  }

  let newEther;
  let numNewEthers = 0;
  if (opts.newEther && opts.newEther.length > 0) {
    newEther = opts.newEther;
    numNewEthers = opts.newEther.length;
  } else {
    newEther = new Float32Array(0);
  }

  noiser.apply(
    ox,
    oy,
    biomes,
    temperature,
    humidity,
    fillBiomes,
    elevations,
    fillElevations,
    ether,
    fillEther,
    water,
    lava,
    fillLiquid,
    newEther,
    numNewEthers
  );

  return {
    biomes,
    temperature,
    humidity,
    elevations,
    ether,
    water,
    lava,
  };
};

const generate = (x, y, opts = {}) => _generateMapChunk(x, y, opts);

return {
  generate,
};

};

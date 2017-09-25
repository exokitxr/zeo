importScripts('/archae/assets/three.js');
const {exports: THREE} = self.module;
importScripts('/archae/assets/murmurhash.js');
const {exports: murmur} = self.module;
importScripts('/archae/assets/autows.js');
const {exports: Autows} = self.module;
importScripts('/archae/assets/alea.js');
const {exports: alea} = self.module;
self.module = {};

Module = {
  print(text) { console.log(text); },
  printErr(text) { console.warn(text); },
  wasmBinaryFile: '/archae/objects/objectize.wasm',
};
importScripts('/archae/objects/objectize.js');

const zeode = require('zeode');
const {
  TERRAIN_BUFFER_SIZE,
  OBJECT_BUFFER_SIZE,
  BLOCK_BUFFER_SIZE,
  LIGHT_BUFFER_SIZE,
  GEOMETRY_BUFFER_SIZE,
} = zeode;
const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,
  NUM_CELLS_HEIGHT,

  NUM_CHUNKS_HEIGHT,

  NUM_RENDER_GROUPS,

  HEIGHTFIELD_DEPTH,

  TEXTURE_SIZE,

  DEFAULT_SEED,

  NUM_POSITIONS_CHUNK,

  PEEK_FACES,
  PEEK_FACE_INDICES,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_CELLS_HALF = NUM_CELLS / 2;
const NUM_CELLS_CUBE = Math.sqrt((NUM_CELLS_HALF + 16) * (NUM_CELLS_HALF + 16) * 3); // larger than the actual bounding box to account for geometry overflow
const NUM_VOXELS_CHUNK_HEIGHT = BLOCK_BUFFER_SIZE / 4 / NUM_CHUNKS_HEIGHT;

const DIRECTIONS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];
const CROSS_DIRECTIONS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

const zeroVector = new THREE.Vector3();
const zeroVectorArray = zeroVector.toArray();

const terrainDecorationsSymbol = Symbol();
const objectsDecorationsSymbol = Symbol();
const objectsCallbacksSymbol = Symbol();
const lightsSymbol = Symbol();

const _getLightsArrayIndex = (x, z) => x + z * 3;

const _align = (n, alignment) => {
  let alignDiff = n % alignment;
  if (alignDiff > 0) {
    n += alignment - alignDiff;
  }
  return n;
};
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
  const ATTRIBUTE_RANGES_SIZE = NUM_CHUNKS_HEIGHT * 6 * Uint32Array.BYTES_PER_ELEMENT;
  const INDEX_RANGES_SIZE = NUM_CHUNKS_HEIGHT * 6 * Uint32Array.BYTES_PER_ELEMENT;
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
    ATTRIBUTE_RANGES_SIZE +
    INDEX_RANGES_SIZE +
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
  const attributeRanges = new Uint32Array(ATTRIBUTE_RANGES_SIZE / Uint32Array.BYTES_PER_ELEMENT);
  index += ATTRIBUTE_RANGES_SIZE;
  const indexRanges = new Uint32Array(INDEX_RANGES_SIZE / Uint32Array.BYTES_PER_ELEMENT);
  index += INDEX_RANGES_SIZE;
  const peeks = new Uint8Array(buffer, index, PEEK_SIZE * NUM_CHUNKS_HEIGHT);
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
    attributeRanges,
    indexRanges,
    peeks,
    peeksArray,
  };
})();

const zde = zeode();

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localVector3 = new THREE.Vector3();
const localQuaternion = new THREE.Quaternion();
const localQuaternion2 = new THREE.Quaternion();
const localCoord = new THREE.Vector2();
const localRay = new THREE.Ray();
const localRay2 = new THREE.Ray();
const localBox = new THREE.Box3();
const localBox2 = new THREE.Box3();

const oneVector = new THREE.Vector3(1, 1, 1);
const bodyOffsetVector = new THREE.Vector3(0, -1.6 / 2, 0);

let textureAtlasVersion = '';
let geometryVersion = '';
const objectApis = {};

const _makeGeometeriesBuffer = (() => {
  const slab = new ArrayBuffer(GEOMETRY_BUFFER_SIZE * NUM_CHUNKS_HEIGHT * 7);
  let index = 0;
  const result = constructor => {
    const result = new constructor(slab, index, (GEOMETRY_BUFFER_SIZE * NUM_CHUNKS_HEIGHT) / constructor.BYTES_PER_ELEMENT);
    index += GEOMETRY_BUFFER_SIZE * NUM_CHUNKS_HEIGHT;
    return result;
  };
  result.reset = () => {
    index = 0;
  };
  return result;
})();
const boundingSpheres = (() => {
  const slab = new ArrayBuffer(NUM_CHUNKS_HEIGHT * 4 * Float32Array.BYTES_PER_ELEMENT);
  const result = Array(NUM_CHUNKS_HEIGHT);
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    result[i] = new Float32Array(slab, i * 4 * Float32Array.BYTES_PER_ELEMENT, 4);
  }
  return result;
})();

const offsets = [];
const _alloc = b => {
  if (Array.isArray(b)) {
    const bs = b;
    const offset = Module._malloc(bs.length * Uint32Array.BYTES_PER_ELEMENT);
    offsets.push(offset);
    const array = new Uint32Array(Module.HEAP8.buffer, Module.HEAP8.byteOffset + offset, bs.length);
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      const offset = Module._malloc(b.byteLength);
      offsets.push(offset);
      const shadowBuffer = new b.constructor(Module.HEAP8.buffer, Module.HEAP8.byteOffset + offset, b.length);
      shadowBuffer.set(b);
      b.unshadow = () => {
        b.set(shadowBuffer);
      };
      array[i] = offset;
    }
    bs.unshadow = () => {
      for (let i = 0; i < bs.length; i++) {
        bs[i].unshadow();
      }
    };
    return offset;
  } else {
    const offset = Module._malloc(b.byteLength);
    offsets.push(offset);
    const shadowBuffer = new b.constructor(Module.HEAP8.buffer, Module.HEAP8.byteOffset + offset, b.length);
    shadowBuffer.set(b);
    b.unshadow = () => {
      b.set(shadowBuffer);
    };
    return offset;
  }
};
const _freeAll = () => {
  for (let i = 0; i < offsets.length; i++) {
    Module._free(offsets[i]);
  }
  offsets.length = 0;
};
const _retesselateTerrain = (chunk, newEther) => {
  const oldTerrainBuffer = chunk.getTerrainBuffer();
  const oldChunkData = protocolUtils.parseTerrainData(oldTerrainBuffer.buffer, oldTerrainBuffer.byteOffset);
  const oldBiomes = oldChunkData.biomes.slice();
  const oldElevations = oldChunkData.elevations.slice();
  const oldEther = oldChunkData.ether.slice();
  const oldWater = oldChunkData.water.slice();
  const oldLava = oldChunkData.lava.slice();

  const {attributeRanges, indexRanges, heightfield, staticHeightfield, peeks} = slab;
  const noiser = Module._make_noiser(murmur(DEFAULT_SEED));
  Module._noiser_fill(
    noiser,
    chunk.x,
    chunk.z,
    _alloc(oldBiomes),
    +false,
    _alloc(oldElevations),
    +false,
    _alloc(oldEther),
    +false,
    _alloc(oldWater),
    _alloc(oldLava),
    +false,
    _alloc(newEther),
    newEther.length,
    _alloc(slab.positions),
    _alloc(slab.indices),
    _alloc(attributeRanges),
    _alloc(indexRanges),
    _alloc(heightfield),
    _alloc(staticHeightfield),
    _alloc(slab.colors),
    _alloc(peeks)
  );

  oldBiomes.unshadow();
  oldElevations.unshadow();
  oldEther.unshadow();
  oldWater.unshadow();
  oldLava.unshadow();
  slab.positions.unshadow();
  slab.indices.unshadow();
  attributeRanges.unshadow();
  indexRanges.unshadow();
  heightfield.unshadow();
  staticHeightfield.unshadow();
  slab.colors.unshadow();
  peeks.unshadow();

  const attributeIndex = attributeRanges[attributeRanges.length - 2] + attributeRanges[attributeRanges.length - 1];
  const indexIndex = indexRanges[indexRanges.length - 2] + indexRanges[indexRanges.length - 1];
  const positions = slab.positions.subarray(0, attributeIndex);
  const indices = slab.indices.subarray(0, indexIndex);
  const colors = new Float32Array(slab.colors.buffer, slab.colors.byteOffset, attributeIndex);

  const geometries = Array(NUM_CHUNKS_HEIGHT);
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    geometries[i] = {
      /* attributeRange: {
        landStart: attributeRanges[i * 6 + 0],
        landCount: attributeRanges[i * 6 + 1],
        waterStart: attributeRanges[i * 6 + 2],
        waterCount: attributeRanges[i * 6 + 3],
        lavaStart: attributeRanges[i * 6 + 4],
        lavaCount: attributeRanges[i * 6 + 5],
      }, */
      indexRange: {
        landStart: indexRanges[i * 6 + 0],
        landCount: indexRanges[i * 6 + 1],
        waterStart: indexRanges[i * 6 + 2],
        waterCount: indexRanges[i * 6 + 3],
        lavaStart: indexRanges[i * 6 + 4],
        lavaCount: indexRanges[i * 6 + 5],
      },
      boundingSphere: Float32Array.from([
        chunk.x * NUM_CELLS + NUM_CELLS_HALF,
        i * NUM_CELLS + NUM_CELLS_HALF,
        chunk.z * NUM_CELLS + NUM_CELLS_HALF,
        NUM_CELLS_CUBE,
      ]),
      peeks: slab.peeksArray[i].slice(),
    };
  }

  const chunkDataSpec = {
    positions,
    colors,
    indices,
    geometries,
    heightfield,
    staticHeightfield,
    biomes: oldBiomes,
    elevations: oldElevations,
    ether: oldEther,
    water: oldWater,
    lava: oldLava,
  };

  const terrainBuffer = chunk.getTerrainBuffer();
  protocolUtils.stringifyTerrainData(chunkDataSpec, terrainBuffer.buffer, terrainBuffer.byteOffset);

  const chunkData = protocolUtils.parseTerrainData(terrainBuffer.buffer, terrainBuffer.byteOffset);
  chunk.chunkData.terrain = chunkData;
  chunk.chunkData.decorations.terrain = {
    skyLightmaps: new Uint8Array(chunkData.positions.length / 3),
    torchLightmaps: new Uint8Array(chunkData.positions.length / 3),
  };
  _undecorateTerrainChunk(chunk);

  Module._destroy_noiser(noiser);
  _freeAll();
};
const _retesselateObjects = chunk => {
  _makeGeometeriesBuffer.reset();
  const geometriesPositions = _makeGeometeriesBuffer(Float32Array);
  const geometriesUvs = _makeGeometeriesBuffer(Float32Array);
  const geometriesSsaos = _makeGeometeriesBuffer(Uint8Array);
  const geometriesFrames = _makeGeometeriesBuffer(Float32Array);
  const geometriesObjectIndices = _makeGeometeriesBuffer(Float32Array);
  const geometriesIndices = _makeGeometeriesBuffer(Uint32Array);
  const geometriesObjects = _makeGeometeriesBuffer(Uint32Array);

  const resultSize = 7 * 8;
  const resultOffset = Module._malloc(resultSize * 4);
  offsets.push(resultOffset);
  const result = new Uint32Array(Module.HEAP8.buffer, Module.HEAP8.byteOffset + resultOffset, resultSize);
  Module._objectize(
    _alloc(chunk.getObjectBuffer()),
    _alloc(geometriesBuffer),
    _alloc(geometryTypes),
    _alloc(chunk.getBlockBuffer()),
    _alloc(blockTypes),
    _alloc(Int32Array.from([NUM_CELLS, NUM_CELLS, NUM_CELLS])),
    _alloc(transparentVoxels),
    _alloc(translucentVoxels),
    _alloc(faceUvs),
    _alloc(Float32Array.from([chunk.x * NUM_CELLS, 0, chunk.z * NUM_CELLS])),
    _alloc(geometriesPositions),
    _alloc(geometriesUvs),
    _alloc(geometriesSsaos),
    _alloc(geometriesFrames),
    _alloc(geometriesObjectIndices),
    _alloc(geometriesIndices),
    _alloc(geometriesObjects),
    resultOffset
  );

  const numNewPositions = result.subarray(NUM_CHUNKS_HEIGHT * 0, NUM_CHUNKS_HEIGHT * 1);
  const numNewUvs = result.subarray(NUM_CHUNKS_HEIGHT * 1, NUM_CHUNKS_HEIGHT * 2);
  const numNewSsaos = result.subarray(NUM_CHUNKS_HEIGHT * 2, NUM_CHUNKS_HEIGHT * 3);
  const numNewFrames = result.subarray(NUM_CHUNKS_HEIGHT * 3, NUM_CHUNKS_HEIGHT * 4);
  const numNewObjectIndices = result.subarray(NUM_CHUNKS_HEIGHT * 4, NUM_CHUNKS_HEIGHT * 5);
  const numNewIndices = result.subarray(NUM_CHUNKS_HEIGHT * 5, NUM_CHUNKS_HEIGHT * 6);
  const numNewObjects = result.subarray(NUM_CHUNKS_HEIGHT * 6, NUM_CHUNKS_HEIGHT * 7);

  geometriesPositions.unshadow();
  geometriesUvs.unshadow();
  geometriesSsaos.unshadow();
  geometriesFrames.unshadow();
  geometriesObjectIndices.unshadow();
  geometriesIndices.unshadow();
  geometriesObjects.unshadow();

  const localGeometries = Array(NUM_CHUNKS_HEIGHT);
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    const attributeRangeStart = i === 0 ? 0 : numNewPositions[i - 1];
    const attributeRangeCount = numNewPositions[i] - attributeRangeStart;
    const indexRangeStart = i === 0 ? 0 : numNewIndices[i - 1];
    const indexRangeCount = numNewIndices[i] - indexRangeStart;

    const boundingSphere = boundingSpheres[i];
    boundingSphere[0] = chunk.x * NUM_CELLS + NUM_CELLS_HALF;
    boundingSphere[1] = i * NUM_CELLS + NUM_CELLS_HALF;
    boundingSphere[2] = chunk.z * NUM_CELLS + NUM_CELLS_HALF;
    boundingSphere[3] = NUM_CELLS_CUBE;

    localGeometries[i] = {
      attributeRange: {
        start: attributeRangeStart,
        count: attributeRangeCount,
      },
      indexRange: {
        start: indexRangeStart,
        count: indexRangeCount,
      },
      boundingSphere,
    };
  };
  const chunkDataSpec = {
    positions: new Float32Array(geometriesPositions.buffer, geometriesPositions.byteOffset, numNewPositions[NUM_CHUNKS_HEIGHT - 1]),
    uvs: new Float32Array(geometriesUvs.buffer, geometriesUvs.byteOffset, numNewUvs[NUM_CHUNKS_HEIGHT - 1]),
    ssaos: new Uint8Array(geometriesSsaos.buffer, geometriesSsaos.byteOffset, numNewSsaos[NUM_CHUNKS_HEIGHT - 1]),
    frames: new Float32Array(geometriesFrames.buffer, geometriesFrames.byteOffset, numNewFrames[NUM_CHUNKS_HEIGHT - 1]),
    objectIndices: new Float32Array(geometriesObjectIndices.buffer, geometriesObjectIndices.byteOffset, numNewObjectIndices[NUM_CHUNKS_HEIGHT - 1]),
    indices: new Uint32Array(geometriesIndices.buffer, geometriesIndices.byteOffset, numNewIndices[NUM_CHUNKS_HEIGHT - 1]),
    objects: new Uint32Array(geometriesObjects.buffer, geometriesObjects.byteOffset, numNewObjects[NUM_CHUNKS_HEIGHT - 1]),
    geometries: localGeometries,
  };

  const geometryBuffer = chunk.getGeometryBuffer();
  protocolUtils.stringifyGeometry(chunkDataSpec, geometryBuffer.buffer, geometryBuffer.byteOffset);

  const chunkData = protocolUtils.parseGeometry(geometryBuffer.buffer, geometryBuffer.byteOffset);
  chunk.chunkData.objects = chunkData;
  chunk.chunkData.decorations.objects = {
    skyLightmaps: new Uint8Array(chunkData.positions.length / 3),
    torchLightmaps: new Uint8Array(chunkData.positions.length / 3),
    blockfield: new Uint8Array(NUM_CELLS * NUM_CELLS_HEIGHT * NUM_CELLS),
  };
  _undecorateObjectsChunkSoft(chunk);

  _freeAll();
};
const _relight = (chunk, x, y, z) => {
  const _decorateChunkLightsSub = (chunk, x, y, z) => _decorateChunkLightsRange(
    chunk,
    Math.max(x - 15, (chunk.x - 1) * NUM_CELLS),
    Math.min(x + 15, (chunk.x + 2) * NUM_CELLS),
    Math.max(y - 15, 0),
    Math.min(y + 15, NUM_CELLS_HEIGHT),
    Math.max(z - 15, (chunk.z - 1) * NUM_CELLS),
    Math.min(z + 15, (chunk.z + 2) * NUM_CELLS),
    true
  );
  const _decorateChunkLightsRange = (chunk, minX, maxX, minY, maxY, minZ, maxZ, relight) => {
    const {x: ox, z: oz} = chunk;
    const updatingLights = chunk[lightsRenderedSymbol];

    const lavaArray = Array(9);
    const objectLightsArray = Array(9);
    const etherArray = Array(9);
    const blocksArray = Array(9);
    const lightsArray = Array(9);
    for (let doz = -1; doz <= 1; doz++) { // XXX can be reduced to use only the relight range
      for (let dox = -1; dox <= 1; dox++) {
        const arrayIndex = _getLightsArrayIndex(dox + 1, doz + 1);

        const aox = ox + dox;
        const aoz = oz + doz;
        const chunk = zde.getChunk(aox, aoz);
        const uint32Buffer = chunk.getTerrainBuffer();
        const {ether, lava} = protocolUtils.parseTerrainData(uint32Buffer.buffer, uint32Buffer.byteOffset); // XXX can be reduced to only parse the needed fields
        lavaArray[arrayIndex] = lava;

        const objectLights = chunk.getLightBuffer();
        objectLightsArray[arrayIndex] = objectLights;

        etherArray[arrayIndex] = ether;

        const blocks = chunk.getBlockBuffer();
        blocksArray[arrayIndex] = blocks;

        let lights = chunk[lightsSymbol];
        if (!lights) {
          lights = new Uint8Array(NUM_CELLS_OVERSCAN * (NUM_CELLS_HEIGHT + 1) * NUM_CELLS_OVERSCAN);
          chunk[lightsSymbol] = lights;
        }
        lightsArray[arrayIndex] = lights;
      }
    }

    Module._lght(
      ox, oz,
      minX, maxX, minY, maxY, minZ, maxZ,
      +relight,
      _alloc(lavaArray),
      _alloc(objectLightsArray),
      _alloc(etherArray),
      _alloc(blocksArray),
      _alloc(lightsArray),
    );

    lightsArray.unshadow();

    _freeAll();
  };

  _decorateChunkLightsSub(chunk, x, y, z);
};
const _relightmap = chunk => {
  const _relightmapTerrain = () => {
    const terrainBuffer = chunk.getTerrainBuffer();
    const {positions} = protocolUtils.parseTerrainData(terrainBuffer.buffer, terrainBuffer.byteOffset);
    const {skyLightmaps, torchLightmaps} = chunk.chunkData.decorations.terrain;
    _relightmapSpec({positions, skyLightmaps, torchLightmaps});
  };
  const _relightmapObjects = () => {
    const {positions} = chunk.chunkData.objects;
    const {skyLightmaps, torchLightmaps} = chunk.chunkData.decorations.objects;
    _relightmapSpec({positions, skyLightmaps, torchLightmaps});
  };
  const _relightmapSpec = ({positions, skyLightmaps, torchLightmaps}) => {
    const terrainBuffer = chunk.getTerrainBuffer();
    const {staticHeightfield} = protocolUtils.parseTerrainData(terrainBuffer.buffer, terrainBuffer.byteOffset);
    const {[lightsSymbol]: lights} = chunk;

    const numPositions = positions.length;

    Module._lghtmap(
      chunk.x,
      chunk.z,
      _alloc(positions),
      numPositions,
      _alloc(staticHeightfield),
      _alloc(lights),
      _alloc(skyLightmaps),
      _alloc(torchLightmaps)
    );

    skyLightmaps.unshadow();
    torchLightmaps.unshadow();

    _freeAll();
  };

  _relightmapTerrain();
  _relightmapObjects();
};

class TrackedObject {
  constructor(n, position, rotation, value) {
    this.n = n;
    this.position = position;
    this.rotation = rotation;
    this.value = value;

    this.rotationInverse = rotation.clone().inverse();
    this.calledBack = false;
  }
}

const _getHoveredTrackedObject = (x, y, z, buffer, byteOffset) => {
  const controllerPosition = localVector.set(x, y, z);
  const ox = Math.floor(x / NUM_CELLS);
  const oz = Math.floor(z / NUM_CELLS);

  const uint32Array = new Uint32Array(buffer, byteOffset, 12);
  const int32Array = new Int32Array(buffer, byteOffset, 12);
  const float32Array = new Float32Array(buffer, byteOffset, 12);
  uint32Array[0] = 0;

  for (const index in zde.chunks) {
    const chunk = zde.chunks[index];

    if (chunk && chunk[objectsDecorationsSymbol] && localCoord.set(chunk.x - ox, chunk.z - oz).lengthSq() <= 2) {
      const chunkResult = chunk.forEachObject((n, matrix, value, objectIndex) => {
        const position = localVector2.fromArray(matrix, 0);
        const rotation = localQuaternion.fromArray(matrix, 3);
        const rotationInverse = localQuaternion2.copy(rotation).inverse();
        const objectArray = chunk.objectsMap[objectIndex];
        localBox.min.fromArray(objectArray, 0);
        localBox.max.fromArray(objectArray, 3);

        localVector3.copy(controllerPosition)
          .sub(position)
          .applyQuaternion(rotationInverse);
          // .add(position);

        if (localBox.containsPoint(localVector3)) {
          uint32Array[0] = n;
          int32Array[1] = chunk.x;
          int32Array[2] = chunk.z;
          uint32Array[3] = objectIndex;
          // uint32Array[3] = objectIndex + chunk.offsets.index * chunk.offsets.numObjectIndices;
          float32Array[4] = position.x;
          float32Array[5] = position.y;
          float32Array[6] = position.z;

          return false;
        } else {
          return true;
        }
      });

      if (chunkResult === false) {
        break;
      }
    }
  }

  const chunk = zde.getChunk(ox, oz);
  if (chunk) {
    const ax = Math.floor(x);
    const ay = Math.floor(y);
    const az = Math.floor(z);
    const v = chunk.getBlock(ax - ox * NUM_CELLS, ay, az - oz * NUM_CELLS);
    if (v) {
      float32Array[8] = ax;
      float32Array[9] = ay;
      float32Array[10] = az;
      uint32Array[11] = v;
    } else {
      float32Array[8] = Infinity;
    }
  } else {
    float32Array[8] = Infinity;
  }
};
const _getTeleportObject = (x, y, z, buffer) => {
  localRay.origin.set(x, 1000, z);
  localRay.direction.set(0, -1, 0);

  const ox = Math.floor(x / NUM_CELLS);
  const oz = Math.floor(z / NUM_CELLS);

  let topY = -Infinity;
  let topPosition = null;
  let topRotation = null;
  let topRotationInverse = null;
  let topBox = null;

  for (const index in zde.chunks) {
    const chunk = zde.chunks[index];

    if (chunk && chunk[objectsDecorationsSymbol] && localCoord.set(chunk.x - ox, chunk.z - oz).lengthSq() <= 2) {
      const chunkResult = chunk.forEachObject((n, matrix, value, objectIndex) => {
        const position = localVector.fromArray(matrix, 0);
        const rotation = localQuaternion.fromArray(matrix, 3);
        const rotationInverse = localQuaternion2.copy(rotation).inverse();
        const objectArray = chunk.objectsMap[objectIndex];
        localBox.min.fromArray(objectArray, 0);
        localBox.max.fromArray(objectArray, 3);

        localRay2.origin.copy(localRay.origin)
          .sub(position)
          .applyQuaternion(rotationInverse);
          // .add(position);
        localRay2.direction.copy(localRay.direction);

        const intersectionPoint = localRay2.intersectBox(localBox, localVector2);
        if (intersectionPoint && intersectionPoint.y > topY) {
          topY = intersectionPoint.y;
          topPosition = position;
          topRotation = rotation;
          topRotationInverse = rotationInverse;
          topBox = localBox2.copy(localBox);

          return false;
        } else {
          return true;
        }
      });

      if (chunkResult === false) {
        let byteOffset = 0;
        new Uint32Array(buffer, byteOffset, 1)[0] = 1;
        byteOffset += 4;

        const float32Array = new Float32Array(buffer, byteOffset, 3 + 3 + 3 + 4 + 4);
        topBox.min.toArray(float32Array, 0);
        topBox.max.toArray(float32Array, 3);
        topPosition.toArray(float32Array, 6);
        topRotation.toArray(float32Array, 9);
        topRotationInverse.toArray(float32Array, 13);
        return;
      }
    }
  }
  new Uint32Array(buffer, 0, 1)[0] = 0;
};
const _getBodyObject = (x, y, z, buffer) => {
  const bodyCenterPoint = localVector.set(x, y, z).add(bodyOffsetVector);

  const ox = Math.floor(bodyCenterPoint.x / NUM_CELLS);
  const oz = Math.floor(bodyCenterPoint.z / NUM_CELLS);

  let topDistance = Infinity;
  let topN = -1;
  let topChunkX = -1;
  let topChunkZ = -1;
  let topObjectIndex = -1;

  for (const index in zde.chunks) {
    const chunk = zde.chunks[index];

    if (chunk && chunk[objectsDecorationsSymbol] && localCoord.set(chunk.x - ox, chunk.z - oz).lengthSq() <= 2) {
      const chunkResult = chunk.forEachObject((n, matrix, value, objectIndex) => {
        const position = localVector2.fromArray(matrix, 0);
        const rotation = localQuaternion.fromArray(matrix, 3);
        const rotationInverse = localQuaternion2.copy(rotation).inverse();
        const objectArray = chunk.objectsMap[objectIndex];
        localBox.min.fromArray(objectArray, 0);
        localBox.max.fromArray(objectArray, 3);

        localVector3.copy(bodyCenterPoint)
          .sub(position)
          .applyQuaternion(rotationInverse);
          // .add(position);

        const distance = localBox.distanceToPoint(localVector3);
        if (distance < 0.3 && (distance < topDistance)) {
          topDistance = distance;
          topN = n;
          topChunkX = chunk.x;
          topChunkZ = chunk.z;
          topObjectIndex = objectIndex;
          return false;
        } else {
          return true;
        }
      });

      if (chunkResult === false) {
        const uint32Array = new Uint32Array(buffer, 0, 4);
        const int32Array = new Int32Array(buffer, 0, 4);

        uint32Array[0] = topN;
        int32Array[1] = topChunkX;
        int32Array[2] = topChunkZ;
        uint32Array[3] = topObjectIndex;

        return;
      }
    }
  }
  new Uint32Array(buffer, 0, 1)[0] = 0;
};

const queue = [];
let pendingMessage = null;
const connection = new AutoWs(_wsUrl('/archae/generatorWs'));
connection.on('message', e => {
  const {data} = e;
  const m = JSON.parse(data);
  const {type} = m;

  if (type === 'addObject') {
    const {args: {n, positions, rotations, value, result: objectIndex}} = m;

    const ox = Math.floor(positions[0] / NUM_CELLS);
    const oz = Math.floor(positions[2] / NUM_CELLS);

    const oldChunk = zde.getChunk(ox, oz);
    if (oldChunk) {
      const matrix = positions.concat(rotations).concat(zeroVectorArray);
      const objectIndex = oldChunk.addObject(n, matrix, value);

      const x = Math.floor(positions[0]);
      const y = Math.floor(positions[1]);
      const z = Math.floor(positions[2]);

      const updateSpecs = [[ox, oz]];

      const light = _findLight(n);
      if (light) {
        oldChunk.addLightAt(objectIndex, positions[0], positions[1], positions[2], light);

        for (let i = 0; i < CROSS_DIRECTIONS.length; i++) {
          const [dx, dz] = CROSS_DIRECTIONS[i];
          const ox = Math.floor((x + dx * light) / NUM_CELLS);
          const oz = Math.floor((z + dz * light) / NUM_CELLS);
          if (!updateSpecs.some(update => update[0] === ox && update[1] === oz)) {
            updateSpecs.push([ox, oz]);
          }
        }
      }

      _retesselateObjects(oldChunk);
      _relight(oldChunk, x, y, z);

      for (let i = 0; i < updateSpecs.length; i++) {
        const updateSpec = updateSpecs[i];
        const [ox, oz] = updateSpec;

        const chunk = zde.getChunk(ox, oz);
        _relightmap(chunk);

        postMessage({
          type: 'chunkUpdate',
          args: [ox, oz],
        });
      }

      const objectApi = objectApis[n];
      if (objectApi && objectApi.added) {
        postMessage({
          type: 'objectAdded',
          args: [n, ox, oz, objectIndex, matrix.slice(0, 3), matrix.slice(3, 7), value],
        });
      }
    }
  } else if (type === 'removeObject') {
    const {args: {x: ox, z: oz, index: objectIndex}} = m;

    const oldChunk = zde.getChunk(ox, oz);
    if (oldChunk) {
      const oldObject = oldChunk.getObject(objectIndex);
      if (oldObject) {
        const n = oldChunk.removeObject(objectIndex);
        const light = oldChunk.removeLight(objectIndex);

        const matrix = oldObject[1];
        const x = Math.floor(matrix[0]);
        const y = Math.floor(matrix[1]);
        const z = Math.floor(matrix[2]);

        const updateSpecs = [[ox, oz]];
        if (light) {
          for (let i = 0; i < CROSS_DIRECTIONS.length; i++) {
            const [dx, dz] = CROSS_DIRECTIONS[i];
            const ox = Math.floor((x + dx * light) / NUM_CELLS);
            const oz = Math.floor((z + dz * light) / NUM_CELLS);
            if (!updateSpecs.some(update => update[0] === ox && update[1] === oz)) {
              updateSpecs.push([ox, oz]);
            }
          }
        }

        _retesselateObjects(oldChunk);
        _relight(oldChunk, x, y, z);
        _relightmap(oldChunk);

        for (let i = 0; i < updateSpecs.length; i++) {
          const updateSpec = updateSpecs[i];
          const [ox, oz] = updateSpec;

          const chunk = zde.getChunk(ox, oz);
          _relightmap(chunk);

          postMessage({
            type: 'chunkUpdate',
            args: [ox, oz],
          });
        }

        const objectApi = objectApis[n];
        if (objectApi && objectApi.removed) {
          postMessage({
            type: 'objectRemoved',
            args: [n, ox, oz, objectIndex],
          });
        }
      }
    }
  } else if (type === 'setObjectData') {
    const {args: {x, z, index: objectIndex, value}} = m;

    const chunk = zde.getChunk(x, z);
    if (chunk) {
      chunk.setObjectData(objectIndex, value);

      const n = chunk.getObjectN(objectIndex);
      const objectApi = objectApis[n];
      if (objectApi && objectApi.updated) {
        const matrix = chunk.getObjectMatrix(objectIndex);

        postMessage({
          type: 'objectUpdated',
          args: [n, x, z, objectIndex, matrix.slice(0, 3), matrix.slice(3, 7), value],
        });
      }
    }
  } else if (type === 'setBlock') {
    const {args: {x, y, z, v}} = m;

    const ox = Math.floor(x / NUM_CELLS);
    const oz = Math.floor(z / NUM_CELLS);
    const oldChunk = zde.getChunk(ox, oz);
    if (oldChunk) {
      oldChunk.setBlock(x - ox * NUM_CELLS, y, z - oz * NUM_CELLS, v);

      _retesselateObjects(oldChunk);
      _relight(oldChunk, x, y, z);
      _relightmap(oldChunk);

      postMessage({
        type: 'chunkUpdate',
        args: [ox, oz],
      });

      const objectApi = objectApis[n];
      if (objectApi && objectApi.set) {
        postMessage({
          type: 'blockSet',
          args: [v, ox * NUM_CELLS + x, y, oz * NUM_CELLS + z],
        });
      }
    }
  } else if (type === 'clearBlock') {
    const {args: {x, y, z}} = m;

    const ox = Math.floor(x / NUM_CELLS);
    const oz = Math.floor(z / NUM_CELLS);
    const oldChunk = zde.getChunk(ox, oz);
    if (oldChunk) {
      const n = oldChunk.clearBlock(x - ox * NUM_CELLS, y, z - oz * NUM_CELLS);

      _retesselateObjects(oldChunk);
      _relight(oldChunk, x, y, z);
      _relightmap(oldChunk);

      postMessage({
        type: 'chunkUpdate',
        args: [ox, oz],
      });

      const objectApi = objectApis[n];
      if (objectApi && objectApi.clear) {
        postMessage({
          type: 'blockCleared',
          args: [n, ox * NUM_CELLS + x, y, oz * NUM_CELLS + z],
        });
      }
    }
  } else if (type === 'mutateVoxel') {
    const {args: {x, y, z, v}} = m;

    const seenChunks = [];
    for (let i = 0; i < DIRECTIONS.length; i++) {
      const [dx, dz] = DIRECTIONS[i];
      const ax = x + dx * 2;
      const az = z + dz * 2;
      const ox = Math.floor(ax / NUM_CELLS);
      const oz = Math.floor(az / NUM_CELLS);

      if (!seenChunks.some(([x, z]) => x === ox && z === oz)) {
        const oldChunk = zde.getChunk(ox, oz);

        const lx = x - (ox * NUM_CELLS);
        const lz = z - (oz * NUM_CELLS);
        const newEther = Float32Array.from([lx, y, lz, v]);

        _retesselateTerrain(oldChunk, newEther);
        _relight(oldChunk, x, y, z);
        _relightmap(oldChunk);

        seenChunks.push([ox, oz]);
      }
    }

    postMessage({
      type: 'chunkUpdates',
      args: seenChunks,
    });
  } else if (type === 'response') {
    const {id, result} = m;

    queues[id](result);
    queues[id] = null;

    _cleanupQueues();
  } else {
    console.warn('generator worker got invalid connection message', m);
  }
});
connection.mutateVoxel = (x, y, z, v, cb) => {
  const id = _makeId();
  connection.send(JSON.stringify({
    method: 'mutateVoxel',
    id,
    args: {
      x,
      y,
      z,
      v,
    },
  }));
  queues[id] = cb;
};
connection.addObject = (n, positions, rotations, value, cb) => {
  const id = _makeId();
  connection.send(JSON.stringify({
    method: 'addObject',
    id,
    args: {
      n,
      positions,
      rotations,
      value,
    },
  }));
  queues[id] = cb;
};
connection.removeObject = (x, z, index, cb) => {
  const id = _makeId();
  connection.send(JSON.stringify({
    method: 'removeObject',
    id,
    args: {
      x,
      z,
      index,
    },
  }));
  queues[id] = cb;
};
connection.setObjectData = (x, z, index, value, cb) => {
  const id = _makeId();
  connection.send(JSON.stringify({
    method: 'setObjectData',
    id,
    args: {
      x,
      z,
      index,
      value,
    },
  }));
  queues[id] = cb;
};
connection.setBlock = (x, y, z, v, cb) => {
  const id = _makeId();
  connection.send(JSON.stringify({
    method: 'setBlock',
    id,
    args: {
      x,
      y,
      z,
      v,
    },
  }));
  queues[id] = cb;
};
connection.clearBlock = (x, y, z, cb) => {
  const id = _makeId();
  connection.send(JSON.stringify({
    method: 'clearBlock',
    id,
    args: {
      x,
      y,
      z,
    },
  }));
  queues[id] = cb;
};
const _getOriginHeight = () => 64;
const _resArrayBuffer = res => {
  if (res.status >= 200 && res.status < 300) {
    return res.arrayBuffer();
  } else {
    return Promise.reject({
      status: res.status,
      stack: 'API returned invalid status code: ' + res.status,
    });
  }
};
const _resArrayBufferHeaders = res => {
  if (res.status >= 200 && res.status < 300) {
    return res.arrayBuffer()
      .then(buffer => ({
         buffer,
         headers: res.headers,
      }));
  } else {
    return Promise.reject({
      status: res.status,
      stack: 'API returned invalid status code: ' + res.status,
    });
  }
};
const _resBlob = res => {
  if (res.status >= 200 && res.status < 300) {
    return res.blob();
  } else {
    return Promise.reject({
      status: res.status,
      stack: 'API returned invalid status code: ' + res.status,
    });
  }
};
function mod(value, divisor) {
  var n = value % divisor;
  return n < 0 ? (divisor + n) : n;
}
const _getChunkIndex = (x, z) => (mod(x, 0xFFFF) << 16) | mod(z, 0xFFFF);

const NUM_MAP_CHUNK_MESHES = 512;
const terrainMapChunkMeshes = new Int32Array(NUM_MAP_CHUNK_MESHES * NUM_CELLS_HEIGHT * 14);
let terrainMapChunkMeshesIndex = 0;
const _findFreeTerrainMapChunkMeshIndex = () => {
  let baseIndex = 0;
  for (let i = 0; i < NUM_MAP_CHUNK_MESHES * NUM_CELLS_HEIGHT; i++) {
    if (terrainMapChunkMeshes[baseIndex] === 0) {
      terrainMapChunkMeshesIndex = Math.max(i, terrainMapChunkMeshesIndex);
      return i;
    }
    baseIndex += 14;
  }
  throw new Error('ran out of map chunk mesh buffer');
  return -1;
};
const objectsMapChunkMeshes = new Int32Array(NUM_MAP_CHUNK_MESHES * (1 + 2 + NUM_CHUNKS_HEIGHT * 2));
let objectsMapChunkMeshesIndex = 0;
const _findFreeObjectsMapChunkMeshIndex = () => {
  let baseIndex = 0;
  for (let i = 0; i < NUM_MAP_CHUNK_MESHES; i++) {
    if (objectsMapChunkMeshes[baseIndex] === 0) {
      objectsMapChunkMeshesIndex = Math.max(i, objectsMapChunkMeshesIndex);
      return i;
    }
    baseIndex += 1 + 2 + NUM_CHUNKS_HEIGHT * 2;
  }
  throw new Error('ran out of map chunk mesh buffer');
  return -1;
};

const _requestChunk = (x, z) => {
  const chunk = zde.getChunk(x, z);
  if (chunk) {
    return Promise.resolve(chunk);
  } else {
    return fetch(`/archae/generator/chunks?x=${x}&z=${z}`, {
      credentials: 'include',
    })
      .then(_resArrayBufferHeaders)
      .then(({buffer, headers}) => {
        const newTextureAtlasVersion = headers.get('Texture-Atlas-Version');
        if (newTextureAtlasVersion !== textureAtlasVersion) {
          textureAtlasVersion = newTextureAtlasVersion;

          _updateTextureAtlas();
        }
        const newGeometryVersion = headers.get('Geometry-Version');
        if (newGeometryVersion !== geometryVersion) {
          geometryVersion = newGeometryVersion;

          _updateGeometries();
        }

        let index = 0;
        const terrainBuffer = new Uint32Array(buffer, index, TERRAIN_BUFFER_SIZE / Uint32Array.BYTES_PER_ELEMENT);
        index += TERRAIN_BUFFER_SIZE;
        const objectBuffer = new Uint32Array(buffer, index, OBJECT_BUFFER_SIZE / Uint32Array.BYTES_PER_ELEMENT);
        index += OBJECT_BUFFER_SIZE;
        const blockBuffer = new Uint32Array(buffer, index, BLOCK_BUFFER_SIZE / Uint32Array.BYTES_PER_ELEMENT);
        index += BLOCK_BUFFER_SIZE;
        const lightBuffer = new Float32Array(buffer, index, LIGHT_BUFFER_SIZE / Float32Array.BYTES_PER_ELEMENT);
        index += LIGHT_BUFFER_SIZE;
        const geometryBuffer = new Uint8Array(buffer, index, GEOMETRY_BUFFER_SIZE / Uint8Array.BYTES_PER_ELEMENT);
        index += GEOMETRY_BUFFER_SIZE;
        const decorationsBuffer = new Uint8Array(buffer, index);

        const chunk = new zeode.Chunk(x, z, terrainBuffer, objectBuffer, blockBuffer, lightBuffer, geometryBuffer);
        chunk.chunkData = {
          terrain: protocolUtils.parseTerrainData(terrainBuffer.buffer, terrainBuffer.byteOffset),
          objects: protocolUtils.parseGeometry(geometryBuffer.buffer, geometryBuffer.byteOffset),
          decorations: protocolUtils.parseDecorations(decorationsBuffer.buffer, decorationsBuffer.byteOffset),
        };
        zde.pushChunk(chunk);
        return chunk;
      });
  }
};
const _requestTerrainChunk = (x, y, index, numPositions, numIndices) => _requestChunk(x, y)
  .then(chunk => {
    _decorateTerrainChunk(chunk, index, numPositions, numIndices);
    return chunk;
  });
const _getTerrainChunk = (x, y, index, numPositions, numIndices) => {
  const chunk = zde.getChunk(x, y);
  _decorateTerrainChunk(chunk, index, numPositions, numIndices);
  return chunk;
};
const _requestObjectsChunk = (x, z, index, numPositions, numObjectIndices, numIndices) => _requestChunk(x, z)
  .then(chunk => {
    _decorateObjectsChunk(chunk, index, numPositions, numObjectIndices, numIndices);
    return chunk;
  });
const _offsetChunkData = (chunkData, index, numPositions) => {
  const {indices} = chunkData;
  const positionOffset = index * (numPositions / 3);
  for (let i = 0; i < indices.length; i++) {
    indices[i] += positionOffset;
  }
};
const _decorateTerrainChunk = (chunk, index, numPositions, numIndices) => {
  if (!chunk[terrainDecorationsSymbol]) {
    const {x, z} = chunk;

    const terrainMapChunkMeshIndices = Array(NUM_CHUNKS_HEIGHT);
    for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
      const {indexRange, peeks} = chunk.chunkData.terrain.geometries[i];
      const indexOffset = index * numIndices;

      const terrainMapChunkMeshIndex = _findFreeTerrainMapChunkMeshIndex();
      const baseIndex = terrainMapChunkMeshIndex * 14;
      terrainMapChunkMeshes[baseIndex + 0] = 1;
      terrainMapChunkMeshes[baseIndex + 1] = x;
      terrainMapChunkMeshes[baseIndex + 2] = i;
      terrainMapChunkMeshes[baseIndex + 3] = z;
      new Uint8Array(terrainMapChunkMeshes.buffer, terrainMapChunkMeshes.byteOffset + (baseIndex + 4) * 4, 16).set(peeks);
      terrainMapChunkMeshes[baseIndex + 8] = indexRange.landStart + indexOffset;
      terrainMapChunkMeshes[baseIndex + 9] = indexRange.landCount;
      terrainMapChunkMeshes[baseIndex + 10] = indexRange.waterStart + indexOffset;
      terrainMapChunkMeshes[baseIndex + 11] = indexRange.waterCount;
      terrainMapChunkMeshes[baseIndex + 12] = indexRange.lavaStart + indexOffset;
      terrainMapChunkMeshes[baseIndex + 13] = indexRange.lavaCount;

      terrainMapChunkMeshIndices[i] = terrainMapChunkMeshIndex;
    }

    _offsetChunkData(chunk.chunkData.terrain, index, numPositions);

    chunk[terrainDecorationsSymbol] = () => {
      for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
        const terrainMapChunkMeshIndex = terrainMapChunkMeshIndices[i];
        const baseIndex = terrainMapChunkMeshIndex * 14;
        terrainMapChunkMeshes[baseIndex] = 0;
      }
    };
  }
};
const _undecorateTerrainChunk = chunk => {
  if (chunk[terrainDecorationsSymbol]) {
    chunk[terrainDecorationsSymbol]();
    chunk[terrainDecorationsSymbol] = null;
  }
};
let ids = 0;
const _decorateObjectsChunk = (chunk, index, numPositions, numObjectIndices, numIndices) => {
  if (!chunk[objectsDecorationsSymbol]) {
    chunk.id = ids++;

    chunk.offsets = {
      index,
      numPositions,
      numObjectIndices,
      numIndices,
    };

    const objectsMap = {};
    const {objects} = chunk.chunkData.objects;
    const numObjects = objects.length / 7;
    for (let i = 0; i < numObjects; i++) {
      const baseIndex = i * 7;
      const index = objects[baseIndex];
      objectsMap[index] = new Float32Array(objects.buffer, objects.byteOffset + ((baseIndex + 1) * 4), 6);
    }
    chunk.objectsMap = objectsMap;

    const {objectIndices} = chunk.chunkData.objects;
    const objectIndexOffset = index * numObjectIndices;
    for (let i = 0; i < objectIndices.length; i++) {
      objectIndices[i] += objectIndexOffset;
    }

    const objectsMapChunkMeshIndex = _findFreeObjectsMapChunkMeshIndex();
    const baseIndex = objectsMapChunkMeshIndex * (1 + 2 + NUM_CHUNKS_HEIGHT * 2);
    objectsMapChunkMeshes[baseIndex + 0] = 1;
    objectsMapChunkMeshes[baseIndex + 1] = chunk.x;
    objectsMapChunkMeshes[baseIndex + 2] = chunk.z;
    const {geometries} = chunk.chunkData.objects;
    const indexOffset = index * numIndices;
    for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
      const {indexRange} = geometries[i];
      objectsMapChunkMeshes[baseIndex + 3 + i * 2 + 0] = indexRange.start + indexOffset;
      objectsMapChunkMeshes[baseIndex + 3 + i * 2 + 1] = indexRange.count;
    }

    _offsetChunkData(chunk.chunkData.objects, index, numPositions);

    const blocks = chunk.getBlockBuffer();
    const {blockfield} = chunk.chunkData.decorations.objects;
    Module._blockfield(
      _alloc(blocks),
      _alloc(blockfield),
    );
    blockfield.unshadow();
    _freeAll();

    chunk[objectsDecorationsSymbol] = () => {
      objectsMapChunkMeshes[baseIndex] = 0;
    };
  }
  if (!chunk[objectsCallbacksSymbol]) {
    chunk.forEachObject((n, matrix, value, objectIndex) => { // XXX can optimize this with some kind of index
      const entry = objectApis[n];
      if (entry && entry.added) {
        postMessage({
          type: 'objectAdded',
          args: [n, chunk.x, chunk.z, objectIndex, matrix.slice(0, 3), matrix.slice(3, 7), value],
        });
      }
    });
    chunk.forEachBlock((n, x, y, z) => {
      const entry = objectApis[n];
      if (entry && entry.set) {
        postMessage({
          type: 'blockSet',
          args: [n, chunk.x * NUM_CELLS + x, y, chunk.z * NUM_CELLS + z],
        });
      }
    });

    chunk[objectsCallbacksSymbol] = () => {
      chunk.forEachObject((n, matrix, value, objectIndex) => {
        const entry = objectApis[n];
        if (entry && entry.removed) {
          postMessage({
            type: 'objectRemoved',
            args: [n, chunk.x, chunk.z, objectIndex, matrix.slice(0, 3), matrix.slice(3, 7), value],
          });
        }
      });
      chunk.forEachBlock((n, x, y, z) => {
        const entry = objectApis[n];
        if (entry && entry.clear) {
          postMessage({
            type: 'blockCleared',
            args: [n, chunk.x * NUM_CELLS + x, y, chunk.z * NUM_CELLS + z],
          });
        }
      });
    };
  }
};
const _undecorateObjectsChunk = chunk => {
  if (chunk[objectsDecorationsSymbol]) {
    chunk[objectsDecorationsSymbol]();
    chunk[objectsDecorationsSymbol] = null;
  }
  if (chunk[objectsCallbacksSymbol]) {
    chunk[objectsCallbacksSymbol]();
    chunk[objectsCallbacksSymbol] = null;
  }
};
const _undecorateObjectsChunkSoft = chunk => {
  if (chunk[objectsDecorationsSymbol]) {
    chunk[objectsDecorationsSymbol]();
    chunk[objectsDecorationsSymbol] = null;
  }
};
const _updateTextureAtlas = _debounce(next => {
  return fetch(`/archae/objects/texture-atlas.png`, {
    credentials: 'include',
  })
    .then(_resBlob)
    .then(blob => createImageBitmap(blob, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE, {
      imageOrientation: 'flipY',
    }))
    .then(imageBitmap => {
      postMessage({
        type: 'textureAtlas',
        args: [imageBitmap],
      }, [imageBitmap]);

      next();
    })
    .catch(err => {
      console.warn(err);

      next();
    });
});
let geometriesBuffer = null;
let geometryTypes = null;
let blockTypes = null;
let transparentVoxels = null;
let translucentVoxels = null;
let faceUvs = null;
let lights = null;
const _findLight = n => {
  for (let i = 0; i < 256; i++) {
    if (lights[i * 2 + 0] === n) {
      return lights[i * 2 + 1];
    }
  }
  return 0;
};
const _updateGeometries = _debounce(next => {
  fetch(`/archae/objects/geometry.bin`, {
    credentials: 'include',
  })
    .then(_resArrayBuffer)
    .then(arrayBuffer => {
      const templates = protocolUtils.parseTemplates(arrayBuffer);
      geometriesBuffer = templates.geometriesBuffer;
      geometryTypes = templates.geometryTypes;
      blockTypes = templates.blockTypes;
      transparentVoxels = templates.transparentVoxels;
      translucentVoxels = templates.translucentVoxels;
      faceUvs = templates.faceUvs;
      lights = templates.lights;

      next();
    })
    .catch(err => {
      console.warn(err);

      next();
    });
});
const _unrequestChunk = (x, z) => {
  const oldChunk = zde.removeChunk(x, z);
  _undecorateTerrainChunk(oldChunk);
  _undecorateObjectsChunk(oldChunk);
  return oldChunk;
};

let queues = {};
let numRemovedQueues = 0;
const _cleanupQueues = () => {
  if (++numRemovedQueues >= 16) {
    const newQueues = {};
    for (const id in queues) {
      const entry = queues[id];
      if (entry !== null) {
        newQueues[id] = entry;
      }
    }
    queues = newQueues;
    numRemovedQueues = 0;
  }
};
function _wsUrl(s) {
  const l = self.location;
  return ((l.protocol === 'https:') ? 'wss://' : 'ws://') + l.host + s;
}

self.onmessage = e => {
  const {data} = e;
  const {type} = data;

  switch (type) {
    case 'getOriginHeight': {
      const {id} = data;

      postMessage({
        type: 'response',
        args: [id],
        result: _getOriginHeight(),
      });
      break;
    }
    case 'registerObject': {
      const {n, added, removed, updated, set, clear} = data;

      let entry = objectApis[n];
      if (!entry) {
        entry = {
          added: 0,
          removed: 0,
          updated: 0,
          set: 0,
          clear: 0,
        };
        objectApis[n] = entry;
      }
      if (added) {
        entry.added++;

        if (entry.added === 1) {
          zde.forEachObject((localN, matrix, value, objectIndex) => { // XXX also need to do this efficiently when the chunk loads
            if (localN === n) {
              postMessage({
                type: 'objectAdded',
                args: [localN, chunk.x, chunk.z, objectIndex, matrix.slice(0, 3), matrix.slice(3, 7), value],
              });
            }
          });
        }
      }
      if (removed) {
        entry.removed++;
      }
      if (updated) {
        entry.updated++;
      }
      if (set) {
        entry.set++;

        if (entry.set === 1) {
          for (const index in zde.chunks) {
            const chunk = zde.chunks[index];
            chunk.forEachBlock((localN, x, y, z) => {
              if (localN === n) {
                postMessage({
                  type: 'blockSet',
                  args: [n, chunk.x * NUM_CELLS + x, y, chunk.z * NUM_CELLS + z],
                });
              }
            });
          }
        }
      }
      if (clear) {
        entry.clear++;
      }
      break;
    }
    case 'unregisterObject': {
      const {n, added, removed, updated, set, clear} = data;
      const entry = objectApis[n];
      if (added) {
        entry.added--;
      }
      if (removed) {
        entry.removed--;

        /* if (entry.removed === 0) { // XXX figure out how to call this, since the callbacks will be removed in the client by the time this fires
          for (let i = 0; i < zde.chunks.length; i++) {
            const chunk = zde.chunks[i];

            for (const k in chunk.trackedObjects) {
              const trackedObject = chunk.trackedObjects[k];

              if (trackedObject.n === n) {
                postMessage({
                  type: 'objectRemoved',
                  args: [trackedObject.n, chunk.x, chunk.z, parseInt(k, 10), trackedObject.position, trackedObject.rotation, trackedObject.value],
                });
              }
            }
          }
        } */
      }
      if (updated) {
        entry.updated--;
      }
      if (set) {
        entry.set--;
      }
      if (clear) {
        entry.clear--;

        /* if (entry.removed === 0) { // XXX figure out how to call this, since the callbacks will be removed in the client by the time this fires
          for (let i = 0; i < zde.chunks.length; i++) {
            const chunk = zde.chunks[i];

            for (const k in chunk.trackedObjects) {
              const trackedObject = chunk.trackedObjects[k];

              if (trackedObject.n === n) {
                postMessage({
                  type: 'objectRemoved',
                  args: [trackedObject.n, chunk.x, chunk.z, parseInt(k, 10), trackedObject.position, trackedObject.rotation, trackedObject.value],
                });
              }
            }
          }
        } */
      }
      if (entry.added === 0 && entry.removed === 0 && entry.updated === 0 && entry.set === 0 && entry.clear === 0) {
        objectApis[n] = null;
      }
      break;
    }
    case 'addObject': {
      const {name, position: positions, rotation: rotations, value} = data;

      const ox = Math.floor(positions[0] / NUM_CELLS);
      const oz = Math.floor(positions[2] / NUM_CELLS);

      const oldChunk = zde.getChunk(ox, oz);
      if (oldChunk) {
        const n = murmur(name);
        connection.addObject(n, positions, rotations, value, () => {});

        const matrix = positions.concat(rotations).concat(zeroVectorArray);
        const objectIndex = oldChunk.addObject(n, matrix, value);

        const x = Math.floor(positions[0]);
        const y = Math.floor(positions[1]);
        const z = Math.floor(positions[2]);

        const updateSpecs = [[ox, oz]];

        const light = _findLight(n);
        if (light) {
          oldChunk.addLightAt(objectIndex, positions[0], positions[1], positions[2], light);

          for (let i = 0; i < CROSS_DIRECTIONS.length; i++) {
            const [dx, dz] = CROSS_DIRECTIONS[i];
            const ox = Math.floor((x + dx * light) / NUM_CELLS);
            const oz = Math.floor((z + dz * light) / NUM_CELLS);
            if (!updateSpecs.some(update => update[0] === ox && update[1] === oz)) {
              updateSpecs.push([ox, oz]);
            }
          }
        }

        _retesselateObjects(oldChunk);
        _relight(oldChunk, x, y, z);

        for (let i = 0; i < updateSpecs.length; i++) {
          const updateSpec = updateSpecs[i];
          const [ox, oz] = updateSpec;

          const chunk = zde.getChunk(ox, oz);
          _relightmap(chunk);

          postMessage({
            type: 'chunkUpdate',
            args: [ox, oz],
          });
        }

        const objectApi = objectApis[n];
        if (objectApi && objectApi.added) {
          postMessage({
            type: 'objectAdded',
            args: [n, ox, oz, objectIndex, matrix.slice(0, 3), matrix.slice(3, 7), value],
          });
        }
      }
      break;
    }
    case 'removeObject': {
      const {x: ox, z: oz, index: objectIndex} = data;

      const oldChunk = zde.getChunk(ox, oz);
      if (oldChunk) {
        const oldObject = oldChunk.getObject(objectIndex);
        if (oldObject) {
          connection.removeObject(ox, oz, objectIndex, () => {});

          const n = oldChunk.removeObject(objectIndex);
          const light = oldChunk.removeLight(objectIndex);

          const matrix = oldObject[1];
          const x = Math.floor(matrix[0]);
          const y = Math.floor(matrix[1]);
          const z = Math.floor(matrix[2]);

          const updateSpecs = [[ox, oz]];
          if (light) {
            for (let i = 0; i < CROSS_DIRECTIONS.length; i++) {
              const [dx, dz] = CROSS_DIRECTIONS[i];
              const ox = Math.floor((x + dx * light) / NUM_CELLS);
              const oz = Math.floor((z + dz * light) / NUM_CELLS);
              if (!updateSpecs.some(update => update[0] === ox && update[1] === oz)) {
                updateSpecs.push([ox, oz]);
              }
            }
          }

          _retesselateObjects(oldChunk);
          _relight(oldChunk, x, y, z);

          for (let i = 0; i < updateSpecs.length; i++) {
            const updateSpec = updateSpecs[i];
            const [ox, oz] = updateSpec;

            const chunk = zde.getChunk(ox, oz);
            _relightmap(chunk);

            postMessage({
              type: 'chunkUpdate',
              args: [ox, oz],
            });
          }

          postMessage({
            type: 'chunkUpdate',
            args: [ox, oz],
          });

          const objectApi = objectApis[n];
          if (objectApi && objectApi.removed) {
            postMessage({
              type: 'objectRemoved',
              args: [n, ox, oz, objectIndex],
            });
          }
        }
      }
      break;
    }
    case 'setObjectData': {
      const {x, z, index, value} = data;

      const chunk = zde.getChunk(x, z);
      if (chunk) {
        connection.setObjectData(x, z, index, value, () => {
          chunk.setObjectData(index, value);

          const n = chunk.getObjectN(index);
          const objectApi = objectApis[n];
          if (objectApi && objectApi.updated) {
            const matrix = chunk.getObjectMatrix(index);

            postMessage({
              type: 'objectUpdated',
              args: [n, x, z, index, matrix.slice(0, 3), matrix.slice(3, 7), value],
            });
          }
        });
      }
      break;
    }
    case 'setBlock': {
      const {x, y, z, v} = data;

      const ox = Math.floor(x / NUM_CELLS);
      const oz = Math.floor(z / NUM_CELLS);
      const oldChunk = zde.getChunk(ox, oz);
      if (oldChunk) {
        connection.setBlock(x, y, z, v, () => {});

        oldChunk.setBlock(x - ox * NUM_CELLS, y, z - oz * NUM_CELLS, v);

        _retesselateObjects(oldChunk);
        _relight(oldChunk, x, y, z);
        _relightmap(oldChunk);

        postMessage({
          type: 'chunkUpdate',
          args: [ox, oz],
        });

        const objectApi = objectApis[v];
        if (objectApi && objectApi.set) {
          postMessage({
            type: 'blockSet',
            args: [v, ox * NUM_CELLS + x, y, oz * NUM_CELLS + z],
          });
        }
      }
      break;
    }
    case 'clearBlock': {
      const {x, y, z} = data;

      const ox = Math.floor(x / NUM_CELLS);
      const oz = Math.floor(z / NUM_CELLS);
      const oldChunk = zde.getChunk(ox, oz);
      if (oldChunk) {
        connection.clearBlock(x, y, z, () => {});

        const n = oldChunk.clearBlock(x - ox * NUM_CELLS, y, z - oz * NUM_CELLS);

        _retesselateObjects(oldChunk);
        _relight(oldChunk, x, y, z);
        _relightmap(oldChunk);

        postMessage({
          type: 'chunkUpdate',
          args: [ox, oz],
        });

        const objectApi = objectApis[n];
        if (objectApi && objectApi.clear) {
          postMessage({
            type: 'blockCleared',
            args: [n, ox * NUM_CELLS + x, y, oz * NUM_CELLS + z],
          });
        }
      }
      break;
    }
    case 'generate': {
      const {id, args} = data;
      const {x, y} = args;

      _requestChunk(x, y)
        .then(() => {
          postMessage({
            type: 'response',
            args: [id],
            result: null,
          });
        })
        .catch(err => {
          console.warn(err);
        });
      break;
    }
    case 'terrainGenerate': {
      const {id, args} = data;
      const {x, y, index, numPositions, numIndices} = args;
      let {buffer} = args;

      _requestTerrainChunk(x, y, index, numPositions, numIndices)
        .then(chunk => {
          protocolUtils.stringifyTerrainRenderChunk(chunk.chunkData.terrain, chunk.chunkData.decorations.terrain, buffer, 0);

          postMessage({
            type: 'response',
            args: [id],
            result: buffer,
          }, [buffer]);
        })
        .catch(err => {
          console.warn(err);
        });
      break;
    }
    case 'terrainsGenerate': {
      const {id, args} = data;
      const {specs} = args;
      let {buffer} = args;

      const chunks = specs.map(({x, y, index, numPositions, numIndices}) => _getTerrainChunk(x, y, index, numPositions, numIndices));
      protocolUtils.stringifyTerrainsRenderChunk(chunks, buffer, 0);

      postMessage({
        type: 'response',
        args: [id],
        result: buffer,
      }, [buffer]);
      break;
    }
    case 'objectsGenerate': {
      const {id, args} = data;
      const {x, z, index, numPositions, numObjectIndices, numIndices} = args;
      let {buffer} = args;

      _requestObjectsChunk(x, z, index, numPositions, numObjectIndices, numIndices)
        .then(chunk => {
          zde.pushChunk(chunk);

          protocolUtils.stringifyWorker(chunk.chunkData.objects, chunk.chunkData.decorations.objects, buffer, 0);

          postMessage({
            type: 'response',
            args: [id],
            result: buffer,
          }, [buffer]);

          chunk.forEachObject((n, matrix, value, objectIndex) => {
            const objectApi = objectApis[n];

            if (objectApi && objectApi.added) {
              postMessage({
                type: 'objectAdded',
                args: [n, x, z, objectIndex, matrix.slice(0, 3), matrix.slice(3, 7), value],
              });
            }
          });
        })
        .catch(err => {
          console.warn(err);
        });
      break;
    }
    case 'ungenerate': {
      const {args} = data;
      const {x, z} = args;

      const chunk = _unrequestChunk(x, z);
      chunk.forEachObject((n, matrix, value, objectIndex) => {
        const objectApi = objectApis[n];

        if (objectApi && objectApi.removed) {
          postMessage({
            type: 'objectRemoved',
            args: [n, x, z, objectIndex],
          });
        }
      });
      break;
    }
    /* case 'update': {
      const {id, args} = data;
      const {x, z} = args;
      let {buffer} = args;

      const chunk = zde.getChunk(x, z);
      protocolUtils.stringifyWorker(chunk.chunkData, chunk.chunkData.decorations, buffer, 0);
      postMessage({
        type: 'response',
        args: [id],
        result: buffer,
      }, [buffer]);
      break;
    }
    case 'heightfield': {
      const {id, args} = data;
      const {x, y, buffer} = args;

      const chunk = zde.getChunk(x, y);

      const heightfield = new Float32Array(buffer, 0, newHeightfield.length);
      if (chunk) {
        heightfield.set(chunk.chunkData.heightfield);
      } else {
        heightfield.fill(0);
      }

      postMessage({
        type: 'response',
        args: [id],
        result: heightfield,
      }, [heightfield.buffer]);
      break;
    } */
    case 'mutateVoxel': {
      const {id, args} = data;
      const {position: [x, y, z, v]} = args;

      connection.mutateVoxel(x, y, z, v, () => {});

      const seenChunks = [];
      for (let i = 0; i < DIRECTIONS.length; i++) {
        const [dx, dz] = DIRECTIONS[i];
        const ax = x + dx * 2;
        const az = z + dz * 2;
        const ox = Math.floor(ax / NUM_CELLS);
        const oz = Math.floor(az / NUM_CELLS);

        if (!seenChunks.some(([x, z]) => x === ox && z === oz)) {
          const oldChunk = zde.getChunk(ox, oz);

          const lx = x - (ox * NUM_CELLS);
          const lz = z - (oz * NUM_CELLS);
          const newEther = Float32Array.from([lx, y, lz, v]);

          _retesselateTerrain(oldChunk, newEther);
          _relight(oldChunk, x, y, z);
          _relightmap(oldChunk);

          seenChunks.push([ox, oz]);
        }
      }

      postMessage({
        type: 'chunkUpdates',
        args: seenChunks,
      });
      break;
    }
    case 'terrainCull': {
      const {id, args} = data;
      const {hmdPosition, projectionMatrix, matrixWorldInverse, buffer} = args;

      const groups = _getTerrainCull(hmdPosition, projectionMatrix, matrixWorldInverse);
      protocolUtils.stringifyTerrainCull(groups, buffer, 0);
      postMessage({
        type: 'response',
        args: [id],
        result: buffer,
      }, [buffer]);
      break;
    }
    case 'objectsCull': {
      const {id, args} = data;
      const {hmdPosition, projectionMatrix, matrixWorldInverse, buffer} = args;

      const chunks = _getObjectsCull(hmdPosition, projectionMatrix, matrixWorldInverse);
      protocolUtils.stringifyObjectsCull(chunks, buffer, 0);
      postMessage({
        type: 'response',
        args: [id],
        result: buffer,
      }, [buffer]);
      break;
    }
    case 'getHoveredObjects': {
      const {id, args: {buffer}} = data;

      const float32Array = new Float32Array(buffer);
      const lx = float32Array[0];
      const ly = float32Array[1];
      const lz = float32Array[2];
      const rx = float32Array[3];
      const ry = float32Array[4];
      const rz = float32Array[5];
      _getHoveredTrackedObject(lx, ly, lz, buffer, 0)
      _getHoveredTrackedObject(rx, ry, rz, buffer, 12 * 4);

      postMessage({
        type: 'response',
        args: [id],
        result: buffer,
      }, [buffer]);
      break;
    }
    case 'getTeleportObject': {
      const {id, args: {buffer}} = data;

      const float32Array = new Float32Array(buffer, 0, 3);
      _getTeleportObject(float32Array[0], float32Array[1], float32Array[2], buffer);

      postMessage({
        type: 'response',
        args: [id],
        result: buffer,
      }, [buffer]);
      break;
    }
    case 'getBodyObject': {
      const {id, args: {buffer}} = data;

      const float32Array = new Float32Array(buffer, 0, 3);
      _getBodyObject(float32Array[0], float32Array[1], float32Array[2], buffer);

      postMessage({
        type: 'response',
        args: [id],
        result: buffer,
      }, [buffer]);
      break;
    }
    case 'response': {
      const {id, result} = data;

      queues[id](result);
      queues[id] = null;

      _cleanupQueues();
      break;
    }
    default: {
      console.warn('generator worker got invalid client message', data);
      break;
    }
  }
};

const _getTerrainCull = (hmdPosition, projectionMatrix, matrixWorldInverse) => {
  const resultSize = NUM_MAP_CHUNK_MESHES * (1 + NUM_RENDER_GROUPS * 6);
  const resultOffset = Module._malloc(resultSize * 4);
  offsets.push(resultOffset);
  const groups = new Uint32Array(Module.HEAP8.buffer, Module.HEAP8.byteOffset + resultOffset, resultSize);
  const groupsIndex = Module._cllTerrain(
    _alloc(Float32Array.from(hmdPosition)),
    _alloc(Float32Array.from(projectionMatrix)),
    _alloc(Float32Array.from(matrixWorldInverse)),
    _alloc(terrainMapChunkMeshes),
    terrainMapChunkMeshesIndex,
    resultOffset
  );

  const result = groups.slice(0, groupsIndex); // XXX can be optimized

  _freeAll();

  return result;
};
const _getObjectsCull = (hmdPosition, projectionMatrix, matrixWorldInverse) => {
  const resultSize = NUM_MAP_CHUNK_MESHES * (1 + NUM_RENDER_GROUPS * 2);
  const resultOffset = Module._malloc(resultSize * 4);
  offsets.push(resultOffset);
  const groups = new Uint32Array(Module.HEAP8.buffer, Module.HEAP8.byteOffset + resultOffset, resultSize);
  const groupsIndex = Module._cllObjects(
    _alloc(Float32Array.from(hmdPosition)),
    _alloc(Float32Array.from(projectionMatrix)),
    _alloc(Float32Array.from(matrixWorldInverse)),
    _alloc(objectsMapChunkMeshes),
    objectsMapChunkMeshesIndex,
    resultOffset
  );

  const result = groups.slice(0, groupsIndex); // XXX can be optimized

  _freeAll();

  return result;
};

let _id = 0;
const _makeId = () => {
  const result = _id;
  _id = (_id + 1) | 0;
  return result;
};
function _debounce(fn) {
  let running = false;
  let queued = false;

  const _go = () => {
    if (!running) {
      running = true;

      fn(() => {
        running = false;

        if (queued) {
          queued = false;

          _go();
        }
      });
    } else {
      queued = true;
    }
  };
  return _go;
}

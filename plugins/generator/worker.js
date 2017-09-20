importScripts('/archae/assets/three.js');
const {exports: THREE} = self.module;
importScripts('/archae/assets/murmurhash.js');
const {exports: murmur} = self.module;
importScripts('/archae/assets/autows.js');
const {exports: Autows} = self.module;
importScripts('/archae/assets/alea.js');
const {exports: alea} = self.module;
self.module = {};

/* Module = {
  print(text) { console.log(text); },
  printErr(text) { console.warn(text); },
  wasmBinaryFile: '/archae/objects/objectize.wasm',
};
importScripts('/archae/objects/objectize.js'); */

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

/* const DIRECTIONS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
]; */

const terrainDecorationsSymbol = Symbol();
const objectsDecorationsSymbol = Symbol();

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
const localVector4 = new THREE.Vector3();
const localQuaternion = new THREE.Quaternion();
const localQuaternion2 = new THREE.Quaternion();
const localCoord = new THREE.Vector2();
const localRay = new THREE.Ray();
const localRay2 = new THREE.Ray();
const localMatrix = new THREE.Matrix4();
const localMatrix2 = new THREE.Matrix4();
const localBox = new THREE.Box3();
const localBox2 = new THREE.Box3();
const localFrustum = new THREE.Frustum();

const oneVector = new THREE.Vector3(1, 1, 1);
const bodyOffsetVector = new THREE.Vector3(0, -1.6 / 2, 0);

let textureAtlasVersion = '';
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
    const {args: {x, z, n, matrix, value, result: objectIndex}} = m;

    const oldChunk = zde.getChunk(x, z);
    if (oldChunk) {
      const {offsets: {index, numPositions, numObjectIndices, numIndices}} = oldChunk;
      _requestObjectsChunk(x, z, index, numPositions, numObjectIndices, numIndices)
        .then(newChunk => {
          zde.removeChunk(x, z);
          zde.pushChunk(newChunk);

          postMessage({
            type: 'chunkUpdate',
            args: [x, z],
          });

          const objectApi = objectApis[n];
          if (objectApi && objectApi.added) {
            postMessage({
              type: 'objectAdded',
              args: [n, x, z, objectIndex, matrix.slice(0, 3), matrix.slice(3, 7), value],
            });
          }
        });
    }
  } else if (type === 'removeObject') {
    const {args: {x, z, index: objectIndex}} = m;

    const oldChunk = zde.getChunk(x, z);
    if (oldChunk) {
      const {offsets: {index, numPositions, numObjectIndices, numIndices}} = oldChunk;
      _requestObjectsChunk(x, z, index, numPositions, numObjectIndices, numIndices)
        .then(newChunk => {
          zde.removeChunk(x, z);
          zde.pushChunk(newChunk);

          postMessage({
            type: 'chunkUpdate',
            args: [x, z],
          });

          const objectApi = objectApis[n];
          if (objectApi && objectApi.removed) {
            postMessage({
              type: 'objectRemoved',
              args: [n, x, z, objectIndex],
            });
          }
        });
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

    const oldChunk = zde.getChunk(x, z);
    if (oldChunk) {
      const {offsets: {index, numPositions, numObjectIndices, numIndices}} = oldChunk;
      _requestObjectsChunk(x, z, index, numPositions, numObjectIndices, numIndices)
        .then(newChunk => {
          zde.removeChunk(x, z);
          zde.pushChunk(newChunk);

          postMessage({
            type: 'chunkUpdate',
            args: [x, z],
          });

          const objectApi = objectApis[n];
          if (objectApi && objectApi.set) {
            postMessage({
              type: 'blockSet',
              args: [x, y, z, v],
            });
          }
        });
    }
  } else if (type === 'removeObject') {
     const {args: {x, y, z}} = m;

    const oldChunk = zde.getChunk(x, z);
    if (oldChunk) {
      const {offsets: {index, numPositions, numObjectIndices, numIndices}} = oldChunk;
      _requestObjectsChunk(x, z, index, numPositions, numObjectIndices, numIndices)
        .then(newChunk => {
          zde.removeChunk(x, z);
          zde.pushChunk(newChunk);

          postMessage({
            type: 'chunkUpdate',
            args: [x, z],
          });

          const objectApi = objectApis[n];
          if (objectApi && objectApi.clear) {
            postMessage({
              type: 'blockCleared',
              args: [x, y, z],
            });
          }
        });
    }
  } else if (type === 'response') {
    const {id, result} = m;

    queues[id](result);
    queues[id] = null;

    _cleanupQueues();
  } else {
    console.warn('generator worker got invalid connection message', m);
  }
});
connection.addObject = (x, z, n, matrix, value, cb) => {
  const id = _makeId();
  connection.send(JSON.stringify({
    method: 'addObject',
    id,
    args: {
      x,
      z,
      n,
      matrix,
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

const mapChunkMeshes = {};

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

        let index = 0;
        const terrainBuffer = new Uint32Array(buffer, index, TERRAIN_BUFFER_SIZE / 4);
        index += TERRAIN_BUFFER_SIZE;
        const objectBuffer = new Uint32Array(buffer, index, OBJECT_BUFFER_SIZE / 4);
        index += OBJECT_BUFFER_SIZE;
        const blockBuffer = new Uint32Array(buffer, index, BLOCK_BUFFER_SIZE / 4);
        index += BLOCK_BUFFER_SIZE;
        const lightBuffer = new Float32Array(buffer, index, LIGHT_BUFFER_SIZE / 4);
        index += LIGHT_BUFFER_SIZE;
        const geometryBuffer = new Uint8Array(buffer, index, GEOMETRY_BUFFER_SIZE);
        index += GEOMETRY_BUFFER_SIZE;
        const decorationsBuffer = new Uint8Array(buffer, index);

        const chunk = new zeode.Chunk(x, z, terrainBuffer, objectBuffer, blockBuffer, lightBuffer, geometryBuffer);
        chunk.chunkData = {
          terrain: protocolUtils.parseTerrainData(terrainBuffer.buffer, terrainBuffer.byteOffset),
          objects: protocolUtils.parseGeometry(geometryBuffer.buffer, geometryBuffer.byteOffset),
          decorations: protocolUtils.parseDecorations(decorationsBuffer.buffer, decorationsBuffer.byteOffset),
        };
        zde.pushChunk(chunk);
        // _decorateTerrainChunk(chunk, index, numIndices);
        // _decorateObjectsChunk(chunk, chunkData, index, numPositions, numObjectIndices, numIndices);
        // _offsetChunkData(chunkData, index, numPositions);
        return chunk;
      });
  }
};
const _requestTerrainChunk = (x, y, index, numPositions, numIndices) => _requestChunk(x, y)
  .then(chunk => {
    _decorateTerrainChunk(chunk, index, numIndices);
    _offsetChunkData(chunk.chunkData.terrain, index, numPositions);
    return chunk;
  });
const _requestObjectsChunk = (x, z, index, numPositions, numObjectIndices, numIndices) => _requestChunk(x, z)
  .then(chunk => {
    _decorateObjectsChunk(chunk, index, numPositions, numObjectIndices, numIndices);
    _offsetChunkData(chunk.chunkData.objects, index, numPositions);
    return chunk;
  });
const _offsetChunkData = (chunkData, index, numPositions) => {
  const {indices} = chunkData;
  const positionOffset = index * (numPositions / 3);
  for (let i = 0; i < indices.length; i++) {
    indices[i] += positionOffset;
  }
};
const _decorateTerrainChunk = (chunk, index, numIndices) => {
  const {x, z} = chunk;

  const trackedMapChunkMeshes = {
    array: Array(NUM_CHUNKS_HEIGHT),
    groups: new Int32Array(NUM_RENDER_GROUPS * 6),
  };
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    const {indexRange, boundingSphere, peeks} = chunk.chunkData.terrain.geometries[i];
    const indexOffset = index * numIndices;

    trackedMapChunkMeshes.array[i] = {
      offset: new THREE.Vector3(x, i, z),
      indexRange: {
        landStart: indexRange.landStart + indexOffset,
        landCount: indexRange.landCount,
        waterStart: indexRange.waterStart + indexOffset,
        waterCount: indexRange.waterCount,
        lavaStart: indexRange.lavaStart + indexOffset,
        lavaCount: indexRange.lavaCount,
      },
      boundingSphere: new THREE.Sphere(
        new THREE.Vector3().fromArray(boundingSphere, 0),
        boundingSphere[3]
      ),
      peeks,
      visibleIndex: -1,
    };
  }
  mapChunkMeshes[_getChunkIndex(x, z)] = trackedMapChunkMeshes;

  chunk[terrainDecorationsSymbol] = true;
};
let ids = 0;
const _decorateObjectsChunk = (chunk, index, numPositions, numObjectIndices, numIndices) => {
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

  const {geometries} = chunk.chunkData.objects;
  const renderSpec = {
    index: _getChunkIndex(chunk.x, chunk.z),
    array: Array(NUM_CHUNKS_HEIGHT),
    groups: new Int32Array(NUM_RENDER_GROUPS * 2),
  };
  const indexOffset = index * numIndices;
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    const {indexRange, boundingSphere} = geometries[i];
    renderSpec.array[i] = {
      indexRange: {
        start: indexRange.start + indexOffset,
        count: indexRange.count,
      },
      boundingSphere: new THREE.Sphere(
        new THREE.Vector3().fromArray(boundingSphere),
        boundingSphere[3]
      ),
    };
  }
  chunk.renderSpec = renderSpec;

  chunk[objectsDecorationsSymbol] = true;

  return chunk;
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
    });
});
const _unrequestChunk = (x, z) => {
  const chunk = zde.removeChunk(x, z);
  mapChunkMeshes[_getChunkIndex(x, z)] = null;
  return chunk;
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
          for (let i = 0; i < zde.chunks.length; i++) {
            const chunk = zde.chunks[i];

            chunk.forEachObject((localN, matrix, value, objectIndex) => {
              if (localN === n) {
                postMessage({
                  type: 'objectAdded',
                  args: [localN, chunk.x, chunk.z, objectIndex, matrix.slice(0, 3), matrix.slice(3, 7), value],
                });
              }
            });
          }
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

        /* if (entry.set === 1) { // XXX figure out an efficient way to index blocks by value
          for (let i = 0; i < zde.chunks.length; i++) {
            const chunk = zde.chunks[i];

            // XXX iterate over all chunks
          }
        } */
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
      const {name, position: positionArray, rotation: rotationArray, value} = data;

      const x = Math.floor(positionArray[0] / NUM_CELLS);
      const z = Math.floor(positionArray[2] / NUM_CELLS);
      const oldChunk = zde.getChunk(x, z);
      if (oldChunk) {
        const n = murmur(name);
        const matrix = positionArray.concat(rotationArray).concat(oneVector.toArray());
        // const position = new THREE.Vector3().fromArray(positionArray);
        // const rotation = new THREE.Quaternion().fromArray(rotationArray);

        connection.addObject(x, z, n, matrix, value, objectIndex => {
          const {offsets: {index, numPositions, numObjectIndices, numIndices}} = oldChunk;
          _requestObjectsChunk(x, z, index, numPositions, numObjectIndices, numIndices)
            .then(newChunk => {
              zde.removeChunk(x, z);
              zde.pushChunk(newChunk);

              postMessage({
                type: 'chunkUpdate',
                args: [x, z],
              });

              const objectApi = objectApis[n];
              if (objectApi && objectApi.added) {
                postMessage({
                  type: 'objectAdded',
                  args: [n, x, z, objectIndex, positionArray, rotationArray, value],
                });
              }
            });
        });
      }
      break;
    }
    case 'removeObject': {
      const {x, z, index: objectIndex} = data;

      const oldChunk = zde.getChunk(x, z);
      if (oldChunk) {
        connection.removeObject(x, z, objectIndex, n => {
          const {offsets: {index, numPositions, numObjectIndices, numIndices}} = oldChunk;
          _requestObjectsChunk(x, z, index, numPositions, numObjectIndices, numIndices)
            .then(newChunk => {
              zde.removeChunk(x, z);
              zde.pushChunk(newChunk);

              postMessage({
                type: 'chunkUpdate',
                args: [xf, z],
              });

              const objectApi = objectApis[n];
              if (objectApi && objectApi.removed) {
                postMessage({
                  type: 'objectRemoved',
                  args: [n, x, z, objectIndex],
                });
              }
            });
        });
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
        connection.setBlock(x, y, z, v, () => {
          const {offsets: {index, numPositions, numObjectIndices, numIndices}} = oldChunk;
          _requestObjectsChunk(ox, oz, index, numPositions, numObjectIndices, numIndices)
            .then(newChunk => {
              zde.removeChunk(ox, oz);
              zde.pushChunk(newChunk);

              postMessage({
                type: 'chunkUpdate',
                args: [ox, oz],
              });

              /* postMessage({ // XXX enable this for registered listeners
                type: 'blockSet',
                args: [x, y, z, v],
              }); */
            });
        });
      }
      break;
    }
    case 'clearBlock': {
      const {x, y, z} = data;

      const ox = Math.floor(x / NUM_CELLS);
      const oz = Math.floor(z / NUM_CELLS);
      const oldChunk = zde.getChunk(ox, oz);
      if (oldChunk) {
        connection.clearBlock(x, y, z, () => {
          /* fetch(`/archae/objects/templates.dat`, {
            credentials: 'include',
          })
            .then(_resArrayBuffer)
            .then(arrayBuffer => {
              const {geometriesBuffer, geometryTypes, blockTypes, transparentVoxels, translucentVoxels, faceUvs} = protocolUtils.parseTemplates(arrayBuffer);

              const offsets = [];
              const _alloc = b => {
                const offset = Module._malloc(b.byteLength);
                new b.constructor(Module.HEAP8.buffer, Module.HEAP8.byteOffset + offset).set(b);
                offsets.push(offset);
                return offset;
              };
              const _freeAll = () => {
                for (let i = 0; i < offsets.length; i++) {
                  Module._free(offsets[i]);
                }
              };

              _makeGeometeriesBuffer.reset();
              const geometriesPositions = _makeGeometeriesBuffer(Float32Array);
              const geometriesUvs = _makeGeometeriesBuffer(Float32Array);
              const geometriesSsaos = _makeGeometeriesBuffer(Uint8Array);
              const geometriesFrames = _makeGeometeriesBuffer(Float32Array);
              const geometriesObjectIndices = _makeGeometeriesBuffer(Float32Array);
              const geometriesIndices = _makeGeometeriesBuffer(Uint32Array);
              const geometriesObjects = _makeGeometeriesBuffer(Uint32Array);

              console.log('objectize 1');

              const resultSize = 7 * 8;
              const resultOffset = Module._malloc(resultSize * 4);
              offsets.push(resultOffset);
              const result = new Uint32Array(Module.HEAP8.buffer, Module.HEAP8.byteOffset + resultOffset, resultSize);
              Module._objectize(
                _alloc(oldChunk.getObjectBuffer()),
                _alloc(geometriesBuffer),
                _alloc(geometryTypes),
                _alloc(oldChunk.getBlockBuffer()),
                _alloc(blockTypes),
                _alloc(Int32Array.from([NUM_CELLS, NUM_CELLS, NUM_CELLS])),
                _alloc(transparentVoxels),
                _alloc(translucentVoxels),
                _alloc(faceUvs),
                _alloc(Float32Array.from([x * NUM_CELLS, 0, z * NUM_CELLS])),
                _alloc(geometriesPositions),
                _alloc(geometriesUvs),
                _alloc(geometriesSsaos),
                _alloc(geometriesFrames),
                _alloc(geometriesObjectIndices),
                _alloc(geometriesIndices),
                _alloc(geometriesObjects),
                resultOffset
              );
              console.log('got result', Array.from(result));
              _freeAll();

              console.log('objectize 2');
            })
            .catch(err => {
              console.warn(err);
            }); */

          const {offsets: {index, numPositions, numObjectIndices, numIndices}} = oldChunk;
          _requestObjectsChunk(ox, oz, index, numPositions, numObjectIndices, numIndices)
            .then(newChunk => {
              zde.removeChunk(ox, oz);
              zde.pushChunk(newChunk);

              postMessage({
                type: 'chunkUpdate',
                args: [ox, oz],
              });

              /* postMessage({ // XXX enable this for registered listeners
                type: 'clearBlock',
                args: [x, y, z],
              }); */
            });
        });
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
if (!chunk) { // XXX
  console.log('no chunk to ungenerate', x, z);
}
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
    } */
    case 'heightfield': {
      const {id, args} = data;
      const {x, y, buffer} = args;

      const chunk = tra.getChunk(x, y);

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
    }
    case 'terrainCull': {
      const {id, args} = data;
      const {hmdPosition, projectionMatrix, matrixWorldInverse, buffer} = args;

      const mapChunkMeshes = _getTerrainCull(hmdPosition, projectionMatrix, matrixWorldInverse);
      protocolUtils.stringifyTerrainCull(mapChunkMeshes, buffer, 0);
      postMessage({
        type: 'response',
        args: [id],
        result: buffer,
      }, [buffer]);
      break;
    }
    case 'subVoxel': {
      const {id, args} = data;
      const {position: [x, y, z], gslots} = args;
      let {buffer} = args;

      /* (() => { // XXX
        const ox = Math.floor(x / NUM_CELLS);
        const oz = Math.floor(z / NUM_CELLS);

        const chunk = tra.getChunk(ox, oz);
        const oldTerrainBuffer = chunk.getTerrainBuffer();
        const oldChunkData = protocolUtils.parseTerrainData(oldTerrainBuffer.buffer, oldTerrainBuffer.byteOffset);
        const oldBiomes = oldChunkData.biomes.slice();
        const oldElevations = oldChunkData.elevations.slice();
        const oldEther = oldChunkData.ether.slice();
        const oldWater = oldChunkData.water.slice();
        const oldLava = oldChunkData.lava.slice();

        const lx = x - (ox * NUM_CELLS);
        const lz = z - (oz * NUM_CELLS);
        const v = 1;
        const newEther = Float32Array.from([lx, y, lz, v]);
        const numNewEthers = newEther.length;

        const offsets = [];
        const _alloc = b => {
          const offset = Module._malloc(b.byteLength);
          new b.constructor(Module.HEAP8.buffer, Module.HEAP8.byteOffset + offset).set(b);
          offsets.push(offset);
          return offset;
        };
        const _freeAll = () => {
          for (let i = 0; i < offsets.length; i++) {
            Module._free(offsets[i]);
          }
        };

        console.log('fill 1');

        const noiser = Module._make_noiser(murmur(DEFAULT_SEED));
        Module._noiser_fill(
          noiser,
          ox,
          oz,
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
          numNewEthers,
          _alloc(slab.positions),
          _alloc(slab.indices),
          _alloc(slab.attributeRanges),
          _alloc(slab.indexRanges),
          _alloc(slab.heightfield),
          _alloc(slab.staticHeightfield),
          _alloc(slab.colors),
          _alloc(slab.peeks)
        );

        const {index, numPositions, numIndices} = gslots[_getChunkIndex(ox, oz)];
        // const chunkData = protocolUtils.parseTerrainData(chunkBuffer.buffer, chunkBuffer.byteOffset);
        const chunkData = {
          buffer,
          positions,
          colors,
          indices,
          geometries,
          heightfield,
          staticHeightfield,
          biomes,
          elevations,
          ether,
          water,
          lava,
        };
        // chunkData.decorations = protocolUtils.parseDecorations(decorationsBuffer.buffer, decorationsBuffer.byteOffset);
        // XXX recompile the lightmaps
        // XXX regenerate the lightmaps
        chunkData.decorations = {
          skyLightmaps,
          torchLightmaps,
        };
        _offsetChunkData(chunkData, index, numPositions);
        chunk.chunkData = chunkData;

        const terrainBuffer = chunk.getTerrainBuffer();
        protocolUtils.stringifyTerrainData(chunkData, terrainBuffer.buffer, terrainBuffer.byteOffset);

        _registerChunk(chunk, index, numIndices);

        let writeByteOffset = 0;
        const chunksHeader = new Uint32Array(buffer, writeByteOffset, 1);
        chunksHeader[0] = 1;
        writeByteOffset += 4;

        const chunkHeader1 = new Int32Array(buffer, writeByteOffset, 2);
        chunkHeader1[0] = ox;
        chunkHeader1[1] = oz;
        writeByteOffset += 4 * 2;

        const chunkHeader2 = new Uint32Array(buffer, writeByteOffset, 1);
        writeByteOffset += 4;

        const newWriteByteOffset = protocolUtils.stringifyTerrainRenderChunk(chunk.chunkData, chunk.chunkData.decorations, buffer, writeByteOffset)[1];
        const numChunkBytes = newWriteByteOffset - writeByteOffset;
        writeByteOffset = newWriteByteOffset;

        chunkHeader2[0] = numChunkBytes;

        postMessage({
          type: 'response',
          args: [id],
          result: buffer,
        }, [buffer]);

        Module._destroy_noiser(noiser);
        _freeAll();

        console.log('fill 2');
      })(); */

      fetch(`/archae/heightfield/voxels?x=${x}&y=${y}&z=${z}`, {
        method: 'DELETE',
        credentials: 'include',
      })
        .then(_resArrayBuffer)
        .then(responseBuffer => {
          let readByteOffset = 0;
          const numChunks = new Uint32Array(responseBuffer, readByteOffset, 1)[0];
          readByteOffset += 4;

          if (numChunks > 0) {
            const chunkSpecs = [];
            for (let i = 0; i < numChunks; i++) {
              const chunkHeader = new Int32Array(responseBuffer, readByteOffset, 2);
              const x = chunkHeader[0];
              const z = chunkHeader[1];
              readByteOffset += 4 * 2;

              const chunkLength = new Uint32Array(responseBuffer, readByteOffset, 1)[0];
              readByteOffset += 4;
              const chunkBuffer = new Uint8Array(responseBuffer, readByteOffset, chunkLength);
              readByteOffset += chunkLength;

              const decorationsLength = new Uint32Array(responseBuffer, readByteOffset, 1)[0];
              readByteOffset += 4;
              const decorationsBuffer = new Uint8Array(responseBuffer, readByteOffset, decorationsLength);
              readByteOffset += decorationsLength;

              const chunk = tra.getChunk(x, z);
              const index = _getChunkIndex(x, z);
              const gslot = gslots[index];
              if (chunk && gslot) {
                const {index, numPositions, numIndices} = gslot;

                const chunkData = protocolUtils.parseTerrainData(chunkBuffer.buffer, chunkBuffer.byteOffset);
                chunkData.decorations = protocolUtils.parseDecorations(decorationsBuffer.buffer, decorationsBuffer.byteOffset);
                _offsetChunkData(chunkData, index, numPositions);
                chunk.chunkData = chunkData;

                const terrainBuffer = chunk.getTerrainBuffer();
                new Uint8Array(terrainBuffer.buffer, terrainBuffer.byteOffset).set(chunkBuffer);

                _registerChunk(chunk, index, numIndices);

                chunkSpecs.push({
                  x,
                  z,
                  chunkData,
                });
              }
            }
            const numChunkSpecs = chunkSpecs.length;

            let writeByteOffset = 0;
            const chunksHeader = new Uint32Array(buffer, writeByteOffset, 1);
            writeByteOffset += 4;

            let numResponseChunks = 0;
            for (let i = 0; i < numChunkSpecs; i++) {
              const chunkSpec = chunkSpecs[i];
              const {x, z} = chunkSpec;
              const chunk = tra.getChunk(x, z);
              if (chunk) {
                const chunkHeader1 = new Int32Array(buffer, writeByteOffset, 2);
                chunkHeader1[0] = x;
                chunkHeader1[1] = z;
                writeByteOffset += 4 * 2;

                const chunkHeader2 = new Uint32Array(buffer, writeByteOffset, 1);
                writeByteOffset += 4;

                const newWriteByteOffset = protocolUtils.stringifyTerrainRenderChunk(chunk.chunkData, chunk.chunkData.decorations, buffer, writeByteOffset)[1];
                const numChunkBytes = newWriteByteOffset - writeByteOffset;
                writeByteOffset = newWriteByteOffset;

                chunkHeader2[0] = numChunkBytes;

                numResponseChunks++;
              }
            }
            chunksHeader[0] = numResponseChunks;

            postMessage({
              type: 'response',
              args: [id],
              result: buffer,
            }, [buffer]);
          } else {
            let writeByteOffset = 0;
            new Uint32Array(buffer, writeByteOffset, 1)[0] = 0;
            writeByteOffset += 4;

            postMessage({
              type: 'response',
              args: [id],
              result: buffer,
            }, [buffer]);
          }
        })
        .catch(err => {
          console.warn(err);
        });
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

class PeekFace {
  constructor(exitFace, enterFace, x, y, z) {
    this.exitFace = exitFace;
    this.enterFace = enterFace;
    this.x = x;
    this.y = y;
    this.z = z;
  }
}
const peekFaceSpecs = [
  new PeekFace(PEEK_FACES.BACK, PEEK_FACES.FRONT, 0, 0, -1),
  new PeekFace(PEEK_FACES.FRONT, PEEK_FACES.BACK, 0, 0, 1),
  new PeekFace(PEEK_FACES.LEFT, PEEK_FACES.RIGHT, -1, 0, 0),
  new PeekFace(PEEK_FACES.RIGHT, PEEK_FACES.LEFT, 1, 0, 0),
  new PeekFace(PEEK_FACES.TOP, PEEK_FACES.BOTTOM, 0, 1, 0),
  new PeekFace(PEEK_FACES.BOTTOM, PEEK_FACES.TOP, 0, -1, 0),
];

const cullQueueX = new Int32Array(100000);
const cullQueueY = new Int32Array(100000);
const cullQueueZ = new Int32Array(100000);
const cullQueueFaces = new Uint8Array(100000);
let cullQueueStart = 0;
let cullQueueEnd = 0;
let visibleIndex = 0;
let max = 0;
const _getTerrainCull = (hmdPosition, projectionMatrix, matrixWorldInverse) => {
  const ox = Math.floor(hmdPosition[0] / NUM_CELLS);
  const oy = Math.min(Math.max(Math.floor(hmdPosition[1] / NUM_CELLS), 0), NUM_CHUNKS_HEIGHT - 1);
  const oz = Math.floor(hmdPosition[2] / NUM_CELLS);

  const index =_getChunkIndex(ox, oz);
  const trackedMapChunkMeshes = mapChunkMeshes[index];
  if (trackedMapChunkMeshes) {
    localFrustum.setFromMatrix(localMatrix.fromArray(projectionMatrix).multiply(localMatrix2.fromArray(matrixWorldInverse)));

    const trackedMapChunkMesh = trackedMapChunkMeshes.array[oy];
    cullQueueX[cullQueueEnd] = ox;
    cullQueueY[cullQueueEnd] = oy;
    cullQueueZ[cullQueueEnd] = oz;
    cullQueueFaces[cullQueueEnd] = PEEK_FACES.NULL;
    cullQueueEnd = (cullQueueEnd + 1) % 100000;
    for (;cullQueueStart !== cullQueueEnd; cullQueueStart = (cullQueueStart + 1) % 100000) {
      const x = cullQueueX[cullQueueStart];
      const y = cullQueueY[cullQueueStart];
      const z = cullQueueZ[cullQueueStart];
      const enterFace = cullQueueFaces[cullQueueStart];

      const trackedMapChunkMesh = mapChunkMeshes[_getChunkIndex(x, z)].array[y];
      trackedMapChunkMesh.visibleIndex = visibleIndex;

      for (let j = 0; j < peekFaceSpecs.length; j++) {
        const peekFaceSpec = peekFaceSpecs[j];
        const ay = y + peekFaceSpec.y;
        if (ay >= 0 && ay < NUM_CHUNKS_HEIGHT) {
          const ax = x + peekFaceSpec.x;
          const az = z + peekFaceSpec.z;
          if (
            (ax - ox) * peekFaceSpec.x > 0 ||
            (ay - oy) * peekFaceSpec.y > 0 ||
            (az - oz) * peekFaceSpec.z > 0
          ) {
            if (enterFace === PEEK_FACES.NULL || trackedMapChunkMesh.peeks[PEEK_FACE_INDICES[enterFace << 3 | peekFaceSpec.exitFace]] === 1) {
              const trackedMapChunkMeshes = mapChunkMeshes[_getChunkIndex(ax, az)];
              if (trackedMapChunkMeshes) {
                const trackedMapChunkMesh = trackedMapChunkMeshes.array[ay];

                if (localFrustum.intersectsSphere(trackedMapChunkMesh.boundingSphere)) {
                  cullQueueX[cullQueueEnd] = ax;
                  cullQueueY[cullQueueEnd] = ay;
                  cullQueueZ[cullQueueEnd] = az;
                  cullQueueFaces[cullQueueEnd] = peekFaceSpec.enterFace;
                  cullQueueEnd = (cullQueueEnd + 1) % 100000;
                }
              }
            }
          }
        }
      }
    }
  }

  for (const index in mapChunkMeshes) {
    const trackedMapChunkMeshes = mapChunkMeshes[index];
    if (trackedMapChunkMeshes) {
      trackedMapChunkMeshes.groups.fill(-1);
      let landGroupIndex = 0;
      let landStart = -1;
      let landCount = 0;
      let waterGroupIndex = 0;
      let waterStart = -1;
      let waterCount = 0;
      let lavaGroupIndex = 0;
      let lavaStart = -1;
      let lavaCount = 0;

      for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) { // XXX optimize this direction
        const trackedMapChunkMesh = trackedMapChunkMeshes.array[i];
        if (trackedMapChunkMesh.visibleIndex === visibleIndex) {
          if (landStart === -1 && trackedMapChunkMesh.indexRange.landCount > 0) {
            landStart = trackedMapChunkMesh.indexRange.landStart;
          }
          landCount += trackedMapChunkMesh.indexRange.landCount;

          if (waterStart === -1 && trackedMapChunkMesh.indexRange.waterCount > 0) {
            waterStart = trackedMapChunkMesh.indexRange.waterStart;
          }
          waterCount += trackedMapChunkMesh.indexRange.waterCount;

          if (lavaStart === -1 && trackedMapChunkMesh.indexRange.lavaCount > 0) {
            lavaStart = trackedMapChunkMesh.indexRange.lavaStart;
          }
          lavaCount += trackedMapChunkMesh.indexRange.lavaCount;
        } else {
          if (landStart !== -1) {
            const baseIndex = landGroupIndex * 6;
            trackedMapChunkMeshes.groups[baseIndex + 0] = landStart;
            trackedMapChunkMeshes.groups[baseIndex + 1] = landCount;
            landGroupIndex++;
            landStart = -1;
            landCount = 0;
          }
          if (waterStart !== -1) {
            const baseIndex = waterGroupIndex * 6;
            trackedMapChunkMeshes.groups[baseIndex + 2] = waterStart;
            trackedMapChunkMeshes.groups[baseIndex + 3] = waterCount;
            waterGroupIndex++;
            waterStart = -1;
            waterCount = 0;
          }
          if (lavaStart !== -1) {
            const baseIndex = lavaGroupIndex * 6;
            trackedMapChunkMeshes.groups[baseIndex + 4] = lavaStart;
            trackedMapChunkMeshes.groups[baseIndex + 5] = lavaCount;
            lavaGroupIndex++;
            lavaStart = -1;
            lavaCount = 0;
          }
        }
      }
      if (landStart !== -1) {
        const baseIndex = landGroupIndex * 6;
        trackedMapChunkMeshes.groups[baseIndex + 0] = landStart;
        trackedMapChunkMeshes.groups[baseIndex + 1] = landCount;
      }
      if (waterStart !== -1) {
        const baseIndex = waterGroupIndex * 6;
        trackedMapChunkMeshes.groups[baseIndex + 2] = waterStart;
        trackedMapChunkMeshes.groups[baseIndex + 3] = waterCount;
      }
      if (lavaStart !== -1) {
        const baseIndex = lavaGroupIndex * 6;
        trackedMapChunkMeshes.groups[baseIndex + 4] = lavaStart;
        trackedMapChunkMeshes.groups[baseIndex + 5] = lavaCount;
      }
    }
  }

  visibleIndex = (visibleIndex + 1) % 0xFFFFFFFF;

  return mapChunkMeshes;
};
const _getObjectsCull = (hmdPosition, projectionMatrix, matrixWorldInverse) => {
  localFrustum.setFromMatrix(localMatrix.fromArray(projectionMatrix).multiply(localMatrix2.fromArray(matrixWorldInverse)));

  for (const index in zde.chunks) {
    const chunk = zde.chunks[index];

    if (chunk && chunk[objectsDecorationsSymbol]) {
      const {renderSpec} = chunk;

      renderSpec.groups.fill(-1);
      let groupIndex = 0;
      let start = -1;
      let count = 0;
      for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) { // XXX optimize this direction
        const trackedObjectChunkMesh = renderSpec.array[i];
        if (localFrustum.intersectsSphere(trackedObjectChunkMesh.boundingSphere)) {
          if (start === -1 && trackedObjectChunkMesh.indexRange.count > 0) {
            start = trackedObjectChunkMesh.indexRange.start;
          }
          count += trackedObjectChunkMesh.indexRange.count;
        } else {
          if (start !== -1) {
            const baseIndex = groupIndex * 2;
            renderSpec.groups[baseIndex + 0] = start;
            renderSpec.groups[baseIndex + 1] = count;
            groupIndex++;
            start = -1;
            count = 0;
          }
        }
      }
      if (start !== -1) {
        const baseIndex = groupIndex * 2;
        renderSpec.groups[baseIndex + 0] = start;
        renderSpec.groups[baseIndex + 1] = count;
      }
    }
  }

  return zde.chunks;
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

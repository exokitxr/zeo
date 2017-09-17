importScripts('/archae/assets/three.js');
const {exports: THREE} = self.module;
importScripts('/archae/assets/murmurhash.js');
const {exports: murmur} = self.module;
importScripts('/archae/assets/autows.js');
const {exports: Autows} = self.module;
importScripts('/archae/assets/alea.js');
const {exports: alea} = self.module;
self.module = {};

const zeode = require('zeode');
const {
  OBJECT_BUFFER_SIZE,
  BLOCK_BUFFER_SIZE,
  LIGHT_BUFFER_SIZE,
  GEOMETRY_BUFFER_SIZE,
} = zeode;
const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,

  NUM_CHUNKS_HEIGHT,
  NUM_RENDER_GROUPS,

  TEXTURE_SIZE,

  DEFAULT_SEED,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const rng = new alea(DEFAULT_SEED);

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

const zeroFloat32Array = new Float32Array(0);
const oneVector = new THREE.Vector3(1, 1, 1);
const bodyOffsetVector = new THREE.Vector3(0, -1.6 / 2, 0);

let textureAtlasVersion = '';
const objectApis = {};

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

    if (chunk && localCoord.set(chunk.x - ox, chunk.z - oz).lengthSq() <= 2) {
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

    if (chunk && localCoord.set(chunk.x - ox, chunk.z - oz).lengthSq() <= 2) {
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

    if (chunk && localCoord.set(chunk.x - ox, chunk.z - oz).lengthSq() <= 2) {
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
const connection = new AutoWs(_wsUrl('/archae/objectsWs'));
connection.on('message', e => {
  const {data} = e;
  const m = JSON.parse(data);
  const {type} = m;

  if (type === 'addObject') {
    const {args: {x, z, n, matrix, value, result: objectIndex}} = m;

    const oldChunk = zde.getChunk(x, z);
    if (oldChunk) {
      const {offsets: {index, numPositions, numObjectIndices, numIndices}} = oldChunk;
      _requestChunk(x, z, index, numPositions, numObjectIndices, numIndices)
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
      _requestChunk(x, z, index, numPositions, numObjectIndices, numIndices)
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
      _requestChunk(x, z, index, numPositions, numObjectIndices, numIndices)
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
      _requestChunk(x, z, index, numPositions, numObjectIndices, numIndices)
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
    console.warn('objects worker got invalid message type:', JSON.stringify(type));
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

const _requestChunk = (x, z, index, numPositions, numObjectIndices, numIndices) => fetch(`/archae/objects/chunks?x=${x}&z=${z}`, {
  credentials: 'include',
})
  .then(_resArrayBufferHeaders)
  .then(({buffer, headers}) => {
    const newTextureAtlasVersion = headers.get('Texture-Atlas-Version');
    if (newTextureAtlasVersion !== textureAtlasVersion) {
      textureAtlasVersion = newTextureAtlasVersion;

      _updateTextureAtlas();
    }

    const objectBuffer = new Uint32Array(buffer, 0, OBJECT_BUFFER_SIZE / 4);
    const blockBuffer = new Uint32Array(buffer, OBJECT_BUFFER_SIZE, BLOCK_BUFFER_SIZE / 4);
    const lightBuffer = new Float32Array(buffer, OBJECT_BUFFER_SIZE + BLOCK_BUFFER_SIZE, LIGHT_BUFFER_SIZE / 4);
    const geometryBuffer = new Uint8Array(buffer, OBJECT_BUFFER_SIZE + BLOCK_BUFFER_SIZE + LIGHT_BUFFER_SIZE, GEOMETRY_BUFFER_SIZE);
    const decorationsBuffer = new Uint8Array(buffer, OBJECT_BUFFER_SIZE + BLOCK_BUFFER_SIZE + LIGHT_BUFFER_SIZE + GEOMETRY_BUFFER_SIZE);

    const chunkData = protocolUtils.parseGeometry(geometryBuffer.buffer, geometryBuffer.byteOffset);
    chunkData.decorations = protocolUtils.parseDecorations(decorationsBuffer.buffer, decorationsBuffer.byteOffset);
    _offsetChunkData(chunkData, index, numPositions);

    return _decorateChunk(new zeode.Chunk(x, z, objectBuffer, blockBuffer, lightBuffer, geometryBuffer), chunkData, index, numPositions, numObjectIndices, numIndices);
  });
const _offsetChunkData = (chunkData, index, numPositions) => {
  const {indices} = chunkData;
  const positionOffset = index * (numPositions / 3);
  for (let i = 0; i < indices.length; i++) {
    indices[i] += positionOffset;
  }
};
let ids = 0;
const _decorateChunk = (chunk, chunkData, index, numPositions, numObjectIndices, numIndices) => {
  chunk.id = ids++;

  chunk.chunkData = chunkData;

  chunk.offsets = {
    index,
    numPositions,
    numObjectIndices,
    numIndices,
  };

  const objectsMap = {};
  const {objects} = chunk.chunkData;
  const numObjects = objects.length / 7;
  for (let i = 0; i < numObjects; i++) {
    const baseIndex = i * 7;
    const index = objects[baseIndex];
    objectsMap[index] = new Float32Array(objects.buffer, objects.byteOffset + ((baseIndex + 1) * 4), 6);
  }
  chunk.objectsMap = objectsMap;

  const {objectIndices} = chunk.chunkData;
  const objectIndexOffset = index * numObjectIndices;
  for (let i = 0; i < objectIndices.length; i++) {
    objectIndices[i] += objectIndexOffset;
  }

  const {geometries} = chunk.chunkData;
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
const _unrequestChunk = (x, z) => zde.removeChunk(x, z);
const _requestLightmaps = (lightmapBuffer, cb) => {
  const id = _makeId();
  postMessage({
    type: 'request',
    method: 'render',
    args: [id],
    lightmapBuffer,
  }, [lightmapBuffer.buffer]);
  queues[id] = cb;
};
const _getCull = (hmdPosition, projectionMatrix, matrixWorldInverse) => {
  localFrustum.setFromMatrix(localMatrix.fromArray(projectionMatrix).multiply(localMatrix2.fromArray(matrixWorldInverse)));

  for (const index in zde.chunks) {
    const chunk = zde.chunks[index];

    if (chunk) {
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

const registerApi = {
  THREE,
  getUv(name) {
    const n = murmur(name);
    return textures[n];
  },
  rng() {
    return rng();
  },
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
          _requestChunk(x, z, index, numPositions, numObjectIndices, numIndices)
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
          _requestChunk(x, z, index, numPositions, numObjectIndices, numIndices)
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
          _requestChunk(ox, oz, index, numPositions, numObjectIndices, numIndices)
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
          const {offsets: {index, numPositions, numObjectIndices, numIndices}} = oldChunk;
          _requestChunk(ox, oz, index, numPositions, numObjectIndices, numIndices)
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
      const {x, z, index, numPositions, numObjectIndices, numIndices} = args;
      let {buffer} = args;

      _requestChunk(x, z, index, numPositions, numObjectIndices, numIndices)
        .then(chunk => {
          zde.pushChunk(chunk);

          protocolUtils.stringifyWorker(chunk.chunkData, chunk.chunkData.decorations, buffer, 0);

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
    case 'update': {
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
    case 'lightmaps': {
      const {id, args} = data;
      const {lightmapBuffer} = args;

      let readByteOffset = 0;
      const numLightmaps = new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + readByteOffset, 1)[0];
      readByteOffset += 4;

      const lightmapsCoordsArray = new Int32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + readByteOffset, numLightmaps * 2);
      readByteOffset += 4 * numLightmaps * 2;

      const requestObjectChunkMeshes = Array(numLightmaps);
      for (let i = 0; i < numLightmaps; i++) {
        const baseIndex = i * 2;
        const x = lightmapsCoordsArray[baseIndex + 0];
        const z = lightmapsCoordsArray[baseIndex + 1];
        requestObjectChunkMeshes[i] = zde.getChunk(x, z) || {
          x,
          z,
          chunkData: {
            positions: zeroFloat32Array,
          },
        };
      }

      let writeByteOffset = 4;
      for (let i = 0; i < numLightmaps; i++) {
        const chunk = requestObjectChunkMeshes[i];

        const lightmapHeaderArray = new Int32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + writeByteOffset, 2);
        lightmapHeaderArray[0] = chunk.x;
        lightmapHeaderArray[1] = chunk.z;
        writeByteOffset += 4 * 2;

        const {positions} = chunk.chunkData;
        const numPositions = positions.length;
        new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + writeByteOffset, 1)[0] = numPositions;
        writeByteOffset += 4;

        new Float32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + writeByteOffset, numPositions).set(positions);
        writeByteOffset += 4 * numPositions;
      }

      _requestLightmaps(lightmapBuffer, lightmapBuffer => {
        postMessage({
          type: 'response',
          args: [id],
          result: lightmapBuffer,
        }, [lightmapBuffer.buffer]);
      });

      break;
    }
    case 'cull': {
      const {id, args} = data;
      const {hmdPosition, projectionMatrix, matrixWorldInverse, buffer} = args;

      const chunks = _getCull(hmdPosition, projectionMatrix, matrixWorldInverse);
      protocolUtils.stringifyCull(chunks, buffer, 0);
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
      console.warn('objects worker got invalid method', JSON.stringify(type));
      break;
    }
  }
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

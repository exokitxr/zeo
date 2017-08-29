importScripts('/archae/assets/three.js');
const {exports: THREE} = self.module;
importScripts('/archae/assets/murmurhash.js');
const {exports: murmur} = self.module;
importScripts('/archae/assets/autows.js');
const {exports: Autows} = self.module;
importScripts('/archae/assets/alea.js');
const {exports: alea} = self.module;
self.module = {};

const zeode = require('/home/k/zeode');
const {
  OBJECT_BUFFER_SIZE,
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

const oneVector = new THREE.Vector3(1, 1, 1);
const bodyOffsetVector = new THREE.Vector3(0, -1.6 / 2, 0);

let textureAtlasVersion = '';
const objectApis = {};
const objectChunkMeshes = {};

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

  for (let i = 0; i < zde.chunks.length; i++) {
    const chunk = zde.chunks[i];

    if (localCoord.set(chunk.x - ox, chunk.z - oz).lengthSq() <= 2) {
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
          const uint32Array = new Uint32Array(buffer, byteOffset, 8);
          uint32Array[0] = n;
          const int32Array = new Int32Array(buffer, byteOffset, 8);
          int32Array[1] = chunk.x;
          int32Array[2] = chunk.z;
          uint32Array[3] = objectIndex;
          // uint32Array[3] = objectIndex + chunk.offsets.index * chunk.offsets.numObjectIndices;
          const float32Array = new Float32Array(buffer, byteOffset, 8);
          float32Array[4] = position.x;
          float32Array[5] = position.y;
          float32Array[6] = position.z;

          return false;
        } else {
          return true;
        }
      });

      if (chunkResult === false) {
        return;
      }
    }
  }
  new Uint32Array(buffer, byteOffset, 8).fill(0);
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

  for (let i = 0; i < zde.chunks.length; i++) {
    const chunk = zde.chunks[i];

    if (localCoord.set(chunk.x - ox, chunk.z - oz).lengthSq() <= 2) {
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

  for (let i = 0; i < zde.chunks.length; i++) {
    const chunk = zde.chunks[i];

    if (localCoord.set(chunk.x - ox, chunk.z - oz).lengthSq() <= 2) {
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

  if (!pendingMessage) {
    const m = JSON.parse(data);
    const {type} = m;

    if (type === 'response') {
      pendingMessage = m;
    } else if (type === 'addObject') {
      const {args: {x, z, n, matrix, value}} = m;
      const chunk = zde.getChunk(x, z);
      const objectIndex = chunk.addObject(n, matrix);

      const positionArray = matrix.slice(0, 3);
      const position = new THREE.Vector3().fromArray(positionArray);
      const rotationArray = matrix.slice(3, 7);
      const rotation = new THREE.Quaternion().fromArray(rotationArray);
      // chunk.trackedObjects[objectIndex] = new TrackedObject(n, position, rotation, value);

      const objectApi = objectApis[n];
      if (objectApi && objectApi.added) {
        postMessage({
          type: 'objectAdded',
          args: [n, x, z, objectIndex, positionArray, rotationArray, value],
        });
      }

      postMessage({
        type: 'chunkUpdate',
        args: [x, z],
      });
    } else if (type === 'removeObject') {
      const {args: {x, z, index: objectIndex}} = m;
      // const chunk = zde.getChunk(x, z);
      // chunk.removeObject(objectIndex);

      /* const trackedObject = trackedObjects[objectIndex];
      const objectApi = objectApis[trackedObject.n];
      if (objectApi && objectApi.removed) {
        postMessage({
          type: 'objectRemoved',
          args: [trackedObject.n, x, z, objectIndex],
        });
      }

      chunk.trackedObjects[objectIndex] = null; */

      postMessage({
        type: 'chunkUpdate',
        args: [x, z],
      });
    } else if (type === 'setObjectData') {
      const {args: {x, z, index: objectIndex, value}} = m;
      const chunk = zde.getChunk(x, z);
      chunk.setObjectData(objectIndex, value);

      /* const trackedObject = chunk.trackedObjects[objectIndex];
      const objectApi = objectApis[trackedObject.n];
      if (objectApi && objectApi.updated) {
        trackedObject.value = value;

        postMessage({
          type: 'objectUpdated',
          args: [trackedObject.n, x, z, objectIndex, trackedObject.position.toArray(), trackedObject.rotation.toArray(), trackedObject.value],
        });
      } */

      postMessage({
        type: 'chunkUpdate',
        args: [x, z],
      });
    } else {
      console.warn('objects worker got invalid message type:', JSON.stringify(type));
    }
  } else {
    queue.shift()(data);
    pendingMessage = null;
  }
});
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

const _requestChunk = (x, z, index, numPositions, numObjectIndices, numIndices) => {
  const chunk = zde.getChunk(x, z);

  if (chunk) {
    return Promise.resolve(chunk);
  } else {
    return fetch(`/archae/objects/chunks?x=${x}&z=${z}`, {
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
        const geometryBuffer = new Uint8Array(buffer, OBJECT_BUFFER_SIZE, GEOMETRY_BUFFER_SIZE)

        const chunkData = protocolUtils.parseGeometry(geometryBuffer.buffer, geometryBuffer.byteOffset);
        _offsetChunkData(chunkData, index, numPositions);

        const chunk = zde.addChunk(x, z, objectBuffer, geometryBuffer);
        chunk.chunkData = chunkData;

        _registerChunk(chunk, index, numPositions, numObjectIndices, numIndices);

        return chunk;
      });
  }
};
const _offsetChunkData = (chunkData, index, numPositions) => {
  const {indices} = chunkData;
  const positionOffset = index * (numPositions / 3);
  for (let i = 0; i < indices.length; i++) {
    indices[i] += positionOffset;
  }
};
const _registerChunk = (chunk, index, numPositions, numObjectIndices, numIndices) => {
  chunk.offsets = {
    index,
    numPositions,
    numObjectIndices,
    numIndices,
  };

  /* const trackedObjects = {};
  chunk.forEachObject((n, matrix, value, objectIndex) => {
    const position = new THREE.Vector3().fromArray(matrix, 0);
    const rotation = new THREE.Quaternion().fromArray(matrix, 3);
    trackedObjects[objectIndex] = new TrackedObject(n, position, rotation, value);
  });
  chunk.trackedObjects = trackedObjects; */

  const objectsMap = {};
  const {objects} = chunk.chunkData;
  const numObjects = objects.length / 7;
  for (let i = 0; i < numObjects; i++) {
    const baseIndex = i * 7;
    const index = objects[baseIndex];
    objectsMap[index] = new Float32Array(objects.buffer, objects.byteOffset + ((baseIndex + 1) * 4), 6);
  }
  chunk.objectsMap = objectsMap;
  /* if (!trackedObject.calledBack) {
    const objectApi = objectApis[trackedObject.n];
    if (objectApi && objectApi.added) {
      postMessage({
        type: 'objectAdded',
        args: [trackedObject.n, x, z, index, trackedObject.position.toArray(), trackedObject.rotation.toArray(), trackedObject.value],
      });
    }
    trackedObject.calledBack = true;
  } */

  const {objectIndices} = chunk.chunkData;
  const objectIndexOffset = index * numObjectIndices;
  for (let i = 0; i < objectIndices.length; i++) {
    objectIndices[i] += objectIndexOffset;
  }

  const {geometries} = chunk.chunkData;
  const trackedObjectChunkMeshes = {
    array: Array(NUM_CHUNKS_HEIGHT),
    groups: new Int32Array(NUM_RENDER_GROUPS * 2),
  };
  const indexOffset = index * numIndices;
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    const {indexRange, boundingSphere} = geometries[i];
    trackedObjectChunkMeshes.array[i] = {
      // offset: new THREE.Vector3(x, i, z),
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
  objectChunkMeshes[_getChunkIndex(chunk.x, chunk.z)] = trackedObjectChunkMeshes;
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
  zde.removeChunk(x, z);

  objectChunkMeshes[_getChunkIndex(x, z)] = null;
};
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

  for (const index in objectChunkMeshes) {
    const trackedObjectChunkMeshes = objectChunkMeshes[index];
    if (trackedObjectChunkMeshes) {
      trackedObjectChunkMeshes.groups.fill(-1);
      let groupIndex = 0;
      let start = -1;
      let count = 0;
      for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) { // XXX optimize this direction
        const trackedObjectChunkMesh = trackedObjectChunkMeshes.array[i];
        if (localFrustum.intersectsSphere(trackedObjectChunkMesh.boundingSphere)) {
          if (start === -1) {
            start = trackedObjectChunkMesh.indexRange.start;
          }
          count += trackedObjectChunkMesh.indexRange.count;
        } else {
          if (start !== -1) {
            const baseIndex = groupIndex * 2;
            trackedObjectChunkMeshes.groups[baseIndex + 0] = start;
            trackedObjectChunkMeshes.groups[baseIndex + 1] = count;
            groupIndex++;
            start = -1;
            count = 0;
          }
        }
      }
      if (start !== -1) {
        const baseIndex = groupIndex * 2;
        trackedObjectChunkMeshes.groups[baseIndex + 0] = start;
        trackedObjectChunkMeshes.groups[baseIndex + 1] = count;
      }
    }
  }

  return objectChunkMeshes;
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
      const {n, added, removed, updated} = data;
      let entry = objectApis[n];
      if (!entry) {
        entry = {
          added: 0,
          removed: 0,
          updated: 0,
        };
        objectApis[n] = entry;
      }
      if (added) {
        entry.added++;

        if (entry.added === 1) {
          for (let i = 0; i < zde.chunks.length; i++) {
            const chunk = zde.chunks[i];

            /* for (const k in chunk.trackedObjects) {
              const trackedObject = chunk.trackedObjects[k];

              if (trackedObject && trackedObject.n === n) {
                postMessage({
                  type: 'objectAdded',
                  args: [trackedObject.n, chunk.x, chunk.z, parseInt(k, 10), trackedObject.position, trackedObject.rotation, trackedObject.value],
                });
              }
            } */
          }
        }
      }
      if (removed) {
        entry.removed++;
      }
      if (updated) {
        entry.updated++;
      }
      break;
    }
    case 'unregisterObject': {
      const {n, added, removed, updated} = data;
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
      if (entry.added === 0 && entry.removed === 0 && entry.updated === 0) {
        objectApis[n] = null;
      }
      break;
    }
    case 'addObject': {
      const {name, position: positionArray, rotation: rotationArray, value} = data;

      const x = Math.floor(positionArray[0] / NUM_CELLS);
      const z = Math.floor(positionArray[2] / NUM_CELLS);
      const chunk = zde.getChunk(x, z);
      if (chunk) {
        const n = murmur(name);
        const matrix = positionArray.concat(rotationArray).concat(oneVector.toArray());
        const index = chunk.addObject(n, matrix);
        const position = new THREE.Vector3().fromArray(positionArray);
        const rotation = new THREE.Quaternion().fromArray(rotationArray);
        // chunk.trackedObjects[index] = new TrackedObject(n, position, rotation, value);

        connection.send(JSON.stringify({
          method: 'addObject',
          args: {
            x,
            z,
            n,
            matrix,
            value,
          },
        }));
      }
      break;
    }
    case 'removeObject': {
      const {x, z, index} = data;

      /* const chunk = zde.getChunk(x, z);
      if (chunk) {
        chunk.removeObject(index);

        const trackedObject = chunk.trackedObjects[index];
        const objectApi = objectApis[trackedObject.n];
        if (objectApi && objectApi.removed) {
          postMessage({
            type: 'objectRemoved',
            args: [trackedObject.n, x, z, index],
          });
        }

        chunk.trackedObjects[index] = null;
      } */

      connection.send(JSON.stringify({
        method: 'removeObject',
        args: {
          x,
          z,
          index,
        },
      }));

      _unrequestChunk(x, z);

      postMessage({
        type: 'chunkUpdate',
        args: [x, z],
      });
      break;
    }
    case 'setObjectData': {
      const {x, z, index, value} = data;

      const chunk = zde.getChunk(x, z);
      if (chunk) {
        chunk.setObjectData(index, value);

        /* const trackedObject = chunk.trackedObjects[index];
        const objectApi = objectApis[trackedObject.n];
        if (objectApi && objectApi.updated) {
          trackedObject.value = value;

          postMessage({
            type: 'objectUpdated',
            args: [trackedObject.n, x, z, index, trackedObject.position.toArray(), trackedObject.rotation.toArray(), trackedObject.value],
          });
        } */

        connection.send(JSON.stringify({
          method: 'setObjectData',
          args: {
            x,
            z,
            index,
            value,
          },
        }));
      }
      break;
    }
    case 'generate': {
      const {id, args} = data;
      const {x, z, index, numPositions, numObjectIndices, numIndices} = args;
      let {buffer} = args;

      _requestChunk(x, z, index, numPositions, numObjectIndices, numIndices)
        .then(chunk => {
          const {positions} = chunk.chunkData;

          const lightmapBuffer = new Uint8Array(buffer, Math.floor(buffer.byteLength * 3 / 4));

          let byteOffset = 0;
          new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 1)[0] = 1;
          byteOffset += 4;

          const lightmapHeaderArray = new Int32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 2);
          lightmapHeaderArray[0] = chunk.x;
          lightmapHeaderArray[1] = chunk.z;
          byteOffset += 4 * 2;

          const numPositions = positions.length;
          new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 1)[0] = numPositions;
          byteOffset += 4;

          new Float32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, numPositions).set(positions);
          byteOffset += 4 * numPositions;

          _requestLightmaps(lightmapBuffer, lightmapBuffer => {
            const {buffer} = lightmapBuffer;

            let byteOffset = 3 * 4;
            const skyLightmapsLength = new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 1)[0];
            byteOffset += 4;
            const skyLightmaps = new Uint8Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, skyLightmapsLength);
            byteOffset += skyLightmapsLength;
            let alignDiff = byteOffset % 4;
            if (alignDiff > 0) {
              byteOffset += 4 - alignDiff;
            }

            const torchLightmapsLength = new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 1)[0];
            byteOffset += 4;
            const torchLightmaps = new Uint8Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, torchLightmapsLength);
            byteOffset += torchLightmapsLength;
            alignDiff = byteOffset % 4;
            if (alignDiff > 0) {
              byteOffset += 4 - alignDiff;
            }

            protocolUtils.stringifyGeometry(chunk.chunkData, skyLightmaps, torchLightmaps, buffer, 0);
            postMessage({
              type: 'response',
              args: [id],
              result: buffer,
            }, [buffer]);
          })
        })
        .catch(err => {
          console.warn(err);
        });
      break;
    }
    case 'ungenerate': {
      const {args} = data;
      const {x, z} = args;

      _unrequestChunk(x, z);

      // const chunk = zde.getChunk(x, z);

      /* for (const k in chunk.trackedObjects) {
        const trackedObject = chunk.trackedObjects[k];

        if (trackedObject) {
          const objectApi = objectApis[trackedObject.n];

          if (objectApi && objectApi.removed) {
            postMessage({
              type: 'objectRemoved',
              args: [trackedObject.n, chunk.x, chunk.z, parseInt(k, 10), trackedObject.position, trackedObject.rotation, trackedObject.value],
            });
          }
        }
      } */
      break;
    }
    case 'lightmaps': {
      const {id, args} = data;
      const {lightmapBuffer} = args;

      let byteOffset = 0;
      const numLightmaps = new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 1)[0];
      byteOffset += 4;

      const lightmapsCoordsArray = new Int32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, numLightmaps * 2);
      byteOffset += 4 * numLightmaps * 2;

      const promises = [];
      for (let i = 0; i < numLightmaps; i++) {
        const baseIndex = i * 2;
        const x = lightmapsCoordsArray[baseIndex + 0];
        const z = lightmapsCoordsArray[baseIndex + 1];
        promises.push(zde.getChunk(x, z) || {
          x,
          z,
          chunkData: {
            positions: new Float32Array(0),
          },
        });
      }
      Promise.all(promises)
        .then(chunks => {
          let byteOffset = 4;

          for (let i = 0; i < numLightmaps; i++) {
            const chunk = chunks[i];

            const lightmapHeaderArray = new Int32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 2);
            lightmapHeaderArray[0] = chunk.x;
            lightmapHeaderArray[1] = chunk.z;
            byteOffset += 4 * 2;

            const {positions} = chunk.chunkData;
            const numPositions = positions.length;
            new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 1)[0] = numPositions;
            byteOffset += 4;

            new Float32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, numPositions).set(positions);
            byteOffset += 4 * numPositions;
          }

          _requestLightmaps(lightmapBuffer, lightmapBuffer => {
            postMessage({
              type: 'response',
              args: [id],
              result: lightmapBuffer,
            }, [lightmapBuffer.buffer]);
          });
        })
        .catch(err => {
          console.warn(err);
        });

      break;
    }
    case 'cull': {
      const {id, args} = data;
      const {hmdPosition, projectionMatrix, matrixWorldInverse, buffer} = args;

      const objectChunkMeshes = _getCull(hmdPosition, projectionMatrix, matrixWorldInverse);
      protocolUtils.stringifyCull(objectChunkMeshes, buffer, 0);
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
      _getHoveredTrackedObject(rx, ry, rz, buffer, 8 * 4);

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

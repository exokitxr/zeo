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
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,

  NUM_CHUNKS_HEIGHT,

  NUM_RENDER_GROUPS,

  DEFAULT_SEED,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS_CHUNK = 500 * 1024;
const LIGHTMAP_BUFFER_SIZE = 100 * 1024 * 4;
const NUM_CELLS_HALF = NUM_CELLS / 2;
const NUM_CELLS_CUBE = Math.sqrt((NUM_CELLS_HALF + 16) * (NUM_CELLS_HALF + 16) * 3); // larger than the actual bouinding box to account for geometry overflow

const rng = new alea(DEFAULT_SEED);

const zde = zeode();
const geometries = {};
const textures = {};

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localVector3 = new THREE.Vector3();
const localVector4 = new THREE.Vector3();
const localCoord = new THREE.Vector2();
const localRay = new THREE.Ray();
const localRay2 = new THREE.Ray();
const localQuaternion = new THREE.Quaternion();
const localMatrix = new THREE.Matrix4();
const localMatrix2 = new THREE.Matrix4();
const localBox = new THREE.Box3();
const localBox2 = new THREE.Box3();
const localFrustum = new THREE.Frustum();

const oneVector = new THREE.Vector3(1, 1, 1);
const bodyOffsetVector = new THREE.Vector3(0, -1.6 / 2, 0);

const objectApis = {};

class TrackedObject {
  constructor(n, position, rotation, value, startIndex, endIndex) {
    this.n = n;
    this.position = position;
    this.rotation = rotation;
    this.value = value;
    this.startIndex = startIndex;
    this.endIndex = endIndex;

    this.rotationInverse = rotation.clone().inverse();
    this.calledBack = false;
  }
}

const _getHoveredTrackedObject = position => {
  localVector.fromArray(position);

  const ox = Math.floor(localVector.x / NUM_CELLS);
  const oz = Math.floor(localVector.z / NUM_CELLS);

  for (let i = 0; i < zde.chunks.length; i++) {
    const chunk = zde.chunks[i];

    if (localCoord.set(chunk.x - ox, chunk.z - oz).lengthSq() <= 2) {
      for (const k in chunk.trackedObjects) {
        const trackedObject = chunk.trackedObjects[k];

        if (trackedObject) {
          const entry = geometries[trackedObject.n];
          const geometry = entry.length > 0 ? entry[0] : null;

          localVector2.copy(localVector)
            .sub(trackedObject.position)
            .applyQuaternion(trackedObject.rotationInverse)
            .add(trackedObject.position);

          localBox.set(
            geometry ? localVector3.copy(geometry.boundingBox.min).add(trackedObject.position) : trackedObject.position,
            geometry ? localVector4.copy(geometry.boundingBox.max).add(trackedObject.position) : localVector4.set(0, 0, 0)
          );

          if (localBox.containsPoint(localVector2)) {
            const uint32Array = new Uint32Array(8);
            uint32Array[0] = trackedObject.n;
            const int32Array = new Int32Array(uint32Array.buffer, uint32Array.byteOffset, uint32Array.length);
            int32Array[1] = chunk.x;
            int32Array[2] = chunk.z;
            uint32Array[3] = parseInt(k, 10);
            const float32Array = new Float32Array(uint32Array.buffer, uint32Array.byteOffset, uint32Array.length);
            float32Array[4] = trackedObject.position.x;
            float32Array[5] = trackedObject.position.y;
            float32Array[6] = trackedObject.position.z;
            return uint32Array;
          }
        }
      }
    }
  }
  return new Uint32Array(8);
};
const _getTeleportObject = position => {
  localRay.origin.set(position[0], 1000, position[2]);
  localRay.direction.set(0, -1, 0);

  const ox = Math.floor(position[0] / NUM_CELLS);
  const oz = Math.floor(position[2] / NUM_CELLS);

  let topY = -Infinity;
  let topTrackedObject = null;
  let topBox = null;

  for (let i = 0; i < zde.chunks.length; i++) {
    const chunk = zde.chunks[i];

    if (localCoord.set(chunk.x - ox, chunk.z - oz).lengthSq() <= 2) {
      for (const k in chunk.trackedObjects) {
        const trackedObject = chunk.trackedObjects[k];

        if (trackedObject) {
          const entry = geometries[trackedObject.n];
          const geometry = entry.length > 0 ? entry[0] : null;

          localRay2.origin.copy(localRay.origin)
            .sub(trackedObject.position)
            .applyQuaternion(trackedObject.rotationInverse)
            .add(trackedObject.position);
          localRay2.direction.copy(localRay.direction);

          localBox.set(
            geometry ? localVector2.copy(geometry.boundingBox.min).add(trackedObject.position) : trackedObject.position,
            geometry ? localVector3.copy(geometry.boundingBox.max).add(trackedObject.position) : localVector3.set(0, 0, 0)
          );

          const intersectionPoint = localRay2.intersectBox(localBox, localVector4);
          if (intersectionPoint && (topTrackedObject === null || intersectionPoint.y > topY)) {
            topY = intersectionPoint.y;
            topTrackedObject = trackedObject;
            topBox = localBox2.copy(localBox);
          }
        }
      }
    }
  }

  if (topTrackedObject !== null) {
    return topBox.min.toArray().concat(topBox.max.toArray())
      .concat(topTrackedObject.position.toArray())
      .concat(topTrackedObject.rotation.toArray())
      .concat(topTrackedObject.rotationInverse.toArray());
  } else {
    return null;
  }
};
const _getBodyObject = position => {
  const bodyCenterPoint = localVector.fromArray(position).add(bodyOffsetVector);

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
      for (const k in chunk.trackedObjects) {
        const trackedObject = chunk.trackedObjects[k];

        if (trackedObject) {
          const entry = geometries[trackedObject.n];
          const geometry = entry.length > 0 ? entry[0] : null;

          localVector2.copy(bodyCenterPoint)
            .sub(trackedObject.position)
            .applyQuaternion(trackedObject.rotationInverse)
            .add(trackedObject.position);

          localBox.set(
            geometry ? localVector3.copy(geometry.boundingBox.min).add(trackedObject.position) : trackedObject.position,
            geometry ? localVector4.copy(geometry.boundingBox.max).add(trackedObject.position) : localVector4.set(0, 0, 0)
          );

          const distance = localBox.distanceToPoint(localVector2);
          if (distance < 0.3 && (distance < topDistance)) {
            topDistance = distance;
            topN = trackedObject.n;
            topChunkX = chunk.x;
            topChunkZ = chunk.z;
            topObjectIndex = parseInt(k, 10);
          }
        }
      }
    }
  }

  if (topN !== null) {
    const uint32Array = new Uint32Array(4);
    uint32Array[0] = topN;
    const int32Array = new Int32Array(uint32Array.buffer, uint32Array.byteOffset, uint32Array.length);
    int32Array[1] = topChunkX;
    int32Array[2] = topChunkZ;
    uint32Array[3] = topObjectIndex;
    return uint32Array;
  } else {
    return new Uint32Array(4);
  }
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
      const index = chunk.addObject(n, matrix);
      chunk.geometry = null;

      const positionArray = matrix.slice(0, 3);
      const position = new THREE.Vector3().fromArray(positionArray);
      const rotationArray = matrix.slice(3, 7);
      const rotation = new THREE.Quaternion().fromArray(rotationArray);
      chunk.trackedObjects[index] = new TrackedObject(n, position, rotation, value, -1, -1);

      const objectApi = objectApis[n];
      if (objectApi && objectApi.added) {
        postMessage({
          type: 'objectAdded',
          args: [n, x, z, index, positionArray, rotationArray, value],
        });
      }

      postMessage({
        type: 'chunkUpdate',
        args: [x, z],
      });
    } else if (type === 'removeObject') {
      const {args: {x, z, index}} = m;
      const chunk = zde.getChunk(x, z);
      chunk.removeObject(index);
      chunk.geometry = null;

      const trackedObject = trackedObjects[index];
      const objectApi = objectApis[trackedObject.n];
      if (objectApi && objectApi.removed) {
        postMessage({
          type: 'objectRemoved',
          args: [trackedObject.n, x, z, index, trackedObject.startIndex, trackedObject.endIndex],
        });
      }

      chunk.trackedObjects[index] = null;

      postMessage({
        type: 'chunkUpdate',
        args: [x, z],
      });
    } else if (type === 'setObjectData') {
      const {args: {x, z, index, value}} = m;
      const chunk = zde.getChunk(x, z);
      chunk.setObjectData(index, value);
      chunk.geometry = null;

      const trackedObject = chunk.trackedObjects[index];
      const objectApi = objectApis[trackedObject.n];
      if (objectApi && objectApi.updated) {
        trackedObject.value = value;

        postMessage({
          type: 'objectUpdated',
          args: [trackedObject.n, x, z, index, trackedObject.position.toArray(), trackedObject.rotation.toArray(), trackedObject.value],
        });
      }

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
function mod(value, divisor) {
  var n = value % divisor;
  return n < 0 ? (divisor + n) : n;
}
const _getChunkIndex = (x, z) => (mod(x, 0xFFFF) << 16) | mod(z, 0xFFFF);
const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
  for (let i = 0; i < src.length; i++) {
    dst[startIndexIndex + i] = src[i] + startAttributeIndex;
  }
};

const objectChunkMeshes = {};

const _decorateChunkGeometry = chunk => {
  if (!chunk.geometry) {
    chunk.geometry = _makeChunkGeometry(chunk);
  }
  return chunk;
};
const _requestChunk = (x, z) => {
  const chunk = zde.getChunk(x, z);

  if (chunk) {
    return Promise.resolve(chunk)
      .then(_decorateChunkGeometry);
  } else {
    return fetch(`/archae/objects/chunks?x=${x}&z=${z}`, {
      credentials: 'include',
    })
      .then(_resArrayBuffer)
      .then(buffer => {
        const chunk = zde.addChunk(x, z, new Uint32Array(buffer));
        chunk.trackedObjects = {};
        chunk.forEachObject((n, matrix, value, i) => {
          const position = new THREE.Vector3().fromArray(matrix, 0);
          const rotation = new THREE.Quaternion().fromArray(matrix, 3);
          chunk.trackedObjects[i] = new TrackedObject(n, position, rotation, value, -1, -1);
        });
        return chunk;
      })
      .then(_decorateChunkGeometry);
  }
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

const _makeGeometeriesBuffer = constructor => {
  const result = Array(NUM_CHUNKS_HEIGHT);
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    result[i] = {
      array: new constructor(NUM_POSITIONS_CHUNK / NUM_CHUNKS_HEIGHT),
      index: 0,
    };
  }
  return result;
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

function _makeChunkGeometry(chunk) {
  const {x: ox, z: oy} = chunk;

  const geometriesPositions = _makeGeometeriesBuffer(Float32Array);
  const geometriesUvs = _makeGeometeriesBuffer(Float32Array);
  const geometriesFrames = _makeGeometeriesBuffer(Float32Array);
  const geometriesObjectIndices = _makeGeometeriesBuffer(Float32Array);
  const geometriesIndices = _makeGeometeriesBuffer(Uint32Array);
  const geometriesObjects = _makeGeometeriesBuffer(Uint32Array);

  chunk.forEachObject((n, matrix, value, index) => {
    const geometryEntries = geometries[n];

    if (geometryEntries) {
      for (let j = 0; j < geometryEntries.length; j++) {
        const newGeometry = geometryEntries[j].clone()
          .applyMatrix(localMatrix.makeRotationFromQuaternion(localQuaternion.set(matrix[3], matrix[4], matrix[5], matrix[6])))
          .applyMatrix(localMatrix.makeTranslation(matrix[0], matrix[1], matrix[2]));
          // .applyMatrix(localMatrix.makeScale(matrix[7], matrix[8], matrix[9]));

        const i = Math.min(Math.max(Math.floor(matrix[1] / NUM_CELLS), 0), NUM_CHUNKS_HEIGHT);

        const newPositions = newGeometry.getAttribute('position').array;
        geometriesPositions[i].array.set(newPositions, geometriesPositions[i].index);

        const newUvs = newGeometry.getAttribute('uv').array;
        const numNewUvs = newUvs.length / 2;
        for (let k = 0; k < numNewUvs; k++) {
          const baseIndex = k * 2;
          geometriesUvs[i].array[geometriesUvs[i].index + baseIndex + 0] = newUvs[baseIndex + 0];
          geometriesUvs[i].array[geometriesUvs[i].index + baseIndex + 1] = 1 - newUvs[baseIndex + 1];
        }

        const newFrames = newGeometry.getAttribute('frame').array;
        geometriesFrames[i].array.set(newFrames, geometriesFrames[i].index);

        const numNewPositions = newPositions.length / 3;
        const newObjectIndices = new Float32Array(numNewPositions);
        for (let k = 0; k < numNewPositions; k++) {
          newObjectIndices[k] = index;
        }
        geometriesObjectIndices[i].array.set(newObjectIndices, geometriesObjectIndices[i].index);

        const newIndices = newGeometry.index.array;
        _copyIndices(newIndices, geometriesIndices[i].array, geometriesIndices[i].index, geometriesPositions[i].index / 3);

        const newObjects = Uint32Array.from([index, geometriesIndices[i].index, geometriesIndices[i].index + newIndices.length]);
        geometriesObjects[i].array.set(newObjects, geometriesObjects[i].index);

        geometriesPositions[i].index += newPositions.length;
        geometriesUvs[i].index += newUvs.length;
        geometriesFrames[i].index += newFrames.length;
        geometriesObjectIndices[i].index += newObjectIndices.length;
        geometriesIndices[i].index += newIndices.length;
        geometriesObjects[i].index += newObjects.length;
      }
    }
  });

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(NUM_POSITIONS_CHUNK);
  const uvs = new Float32Array(NUM_POSITIONS_CHUNK);
  const frames = new Float32Array(NUM_POSITIONS_CHUNK);
  const objectIndices = new Float32Array(NUM_POSITIONS_CHUNK);
  const indices = new Uint32Array(NUM_POSITIONS_CHUNK);
  const objects = new Uint32Array(NUM_POSITIONS_CHUNK);
  let attributeIndex = 0;
  let uvIndex = 0;
  let frameIndex = 0;
  let objectIndexIndex = 0;
  let indexIndex = 0;
  let objectIndex = 0;

  const localGeometries = Array(NUM_CHUNKS_HEIGHT);
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    const newPositions = geometriesPositions[i].array.subarray(0, geometriesPositions[i].index);
    positions.set(newPositions, attributeIndex);

    const newUvs = geometriesUvs[i].array.subarray(0, geometriesUvs[i].index);
    uvs.set(newUvs, uvIndex);

    const newFrames = geometriesFrames[i].array.subarray(0, geometriesFrames[i].index);
    frames.set(newFrames, frameIndex);

    const newObjectIndices = geometriesObjectIndices[i].array.subarray(0, geometriesObjectIndices[i].index);
    objectIndices.set(newObjectIndices, objectIndexIndex);

    const newIndices = geometriesIndices[i].array.subarray(0, geometriesIndices[i].index);
    _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

    const newObjects = new Uint32Array(geometriesObjects[i].index);
    const numNewObjects = geometriesObjects[i].index / 3;
    for (let j = 0; j < numNewObjects; j++) {
      const baseIndex = j * 3;
      newObjects[baseIndex + 0] = geometriesObjects[i].array[baseIndex + 0];
      newObjects[baseIndex + 1] = indexIndex + geometriesObjects[i].array[baseIndex + 1];
      newObjects[baseIndex + 2] = indexIndex + geometriesObjects[i].array[baseIndex + 2];
    }
    objects.set(newObjects, objectIndex);

    localGeometries[i] = {
      attributeRange: {
        start: attributeIndex,
        count: newPositions.length,
      },
      indexRange: {
        start: indexIndex,
        count: newIndices.length,
      },
      boundingSphere: new THREE.Sphere(
        new THREE.Vector3(ox * NUM_CELLS + NUM_CELLS_HALF, i * NUM_CELLS + NUM_CELLS_HALF, oy * NUM_CELLS + NUM_CELLS_HALF),
        NUM_CELLS_CUBE
      ),
    };

    attributeIndex += newPositions.length;
    uvIndex += newUvs.length;
    frameIndex += newFrames.length;
    objectIndexIndex += newObjectIndices.length;
    indexIndex += newIndices.length;
    objectIndex += newObjects.length;
  };

  return {
    positions: new Float32Array(positions.buffer, positions.byteOffset, attributeIndex),
    uvs: new Float32Array(uvs.buffer, uvs.byteOffset, uvIndex),
    frames: new Float32Array(frames.buffer, frames.byteOffset, frameIndex),
    objectIndices: new Float32Array(objectIndices.buffer, objectIndices.byteOffset, objectIndexIndex),
    indices: new Uint32Array(indices.buffer, indices.byteOffset, indexIndex),
    objects: new Uint32Array(objects.buffer, objects.byteOffset, objectIndex),
    geometries: localGeometries,
  };
};
function _wsUrl(s) {
  const l = self.location;
  return ((l.protocol === 'https:') ? 'wss://' : 'ws://') + l.host + s;
}

self.onmessage = e => {
  const {data} = e;
  const {type} = data;

  switch (type) {
    case 'registerGeometry': {
      const {name, args, src} = data;
      const fn = Reflect.construct(Function, args.concat(src));

      let geometry;
      try {
        geometry = fn(registerApi);
      } catch (err) {
        console.warn(err);
      }

      const frameAttribute = geometry.getAttribute('frame');
      if (!frameAttribute) {
        const frames = new Float32Array(geometry.getAttribute('position').array.length);
        geometry.addAttribute('frame', new THREE.BufferAttribute(frames, 3));
      }

      if (!geometry.boundingBox) {
        geometry.computeBoundingBox();
      }

      const n = murmur(name);
      let entry = geometries[n];
      if (!entry) {
        entry = [];
        geometries[n] = entry;
      }
      entry.push(geometry);
      break;
    }
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

            for (const k in chunk.trackedObjects) {
              const trackedObject = chunk.trackedObjects[k];

              if (trackedObject && trackedObject.n === n) {
                postMessage({
                  type: 'objectAdded',
                  args: [trackedObject.n, chunk.x, chunk.z, parseInt(k, 10), trackedObject.position, trackedObject.rotation, trackedObject.value],
                });
              }
            }
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
    case 'registerTexture': {
      const {name, uv} = data;
      const n = murmur(name);
      textures[n] = uv;
      break;
    }
    case 'addObject': {
      const {name, position: positionArray, rotation: rotationArray, value} = data;

      const x = Math.floor(positionArray[0] / NUM_CELLS);
      const z = Math.floor(positionArray[2] / NUM_CELLS);
      _requestChunk(x, z)
        .then(chunk => {
          const n = murmur(name);
          const matrix = positionArray.concat(rotationArray).concat(oneVector.toArray());
          const index = chunk.addObject(n, matrix);
          chunk.geometry = null;
          const position = new THREE.Vector3().fromArray(positionArray);
          const rotation = new THREE.Quaternion().fromArray(rotationArray);
          chunk.trackedObjects[index] = new TrackedObject(n, position, rotation, value, -1, -1);

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
        })
        .catch(err => {
          console.warn(err);
        });
      break;
    }
    case 'removeObject': {
      const {x, z, index} = data;

      const chunk = zde.getChunk(x, z);
      if (chunk) {
        chunk.removeObject(index);
        chunk.geometry = null;

        const trackedObject = chunk.trackedObjects[index];
        const objectApi = objectApis[trackedObject.n];
        if (objectApi && objectApi.removed) {
          postMessage({
            type: 'objectRemoved',
            args: [trackedObject.n, x, z, index, trackedObject.startIndex, trackedObject.endIndex],
          });
        }

        chunk.trackedObjects[index] = null;
      }

      connection.send(JSON.stringify({
        method: 'removeObject',
        args: {
          x,
          z,
          index,
        },
      }));
      break;
    }
    case 'setObjectData': {
      const {x, z, index, value} = data;

      _requestChunk(x, z)
        .then(chunk => {
          chunk.setObjectData(index, value);
          chunk.geometry = null;

          const trackedObject = chunk.trackedObjects[index];
          const objectApi = objectApis[trackedObject.n];
          if (objectApi && objectApi.updated) {
            trackedObject.value = value;

            postMessage({
              type: 'objectUpdated',
              args: [trackedObject.n, x, z, index, trackedObject.position.toArray(), trackedObject.rotation.toArray(), trackedObject.value],
            });
          }

          connection.send(JSON.stringify({
            method: 'setObjectData',
            args: {
              x,
              z,
              index,
              value,
            },
          }));
        })
        .catch(err => {
          console.warn(err);
        });
      break;
    }
    case 'generate': {
      const {id, args} = data;
      const {x, z} = args;
      let {buffer} = args;

      _requestChunk(x, z)
        .then(chunk => {
          const {geometry} = chunk;

          const lightmapBuffer = new Uint8Array(buffer, Math.floor(buffer.byteLength * 3 / 4));

          let byteOffset = 0;
          new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 1)[0] = 1;
          byteOffset += 4;

          const lightmapHeaderArray = new Int32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 2);
          lightmapHeaderArray[0] = chunk.x;
          lightmapHeaderArray[1] = chunk.z;
          byteOffset += 4 * 2;

          const {positions} = geometry;
          const numPositions = positions.length;
          new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 1)[0] = numPositions;
          byteOffset += 4;

          new Float32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, numPositions).set(positions);
          byteOffset += 4 * numPositions;

          _requestLightmaps(lightmapBuffer, lightmapBuffer => {
            const {buffer} = lightmapBuffer;

            const lightmapsLength = new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset, 1)[0];
            const lightmaps = new Uint8Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + 4, lightmapsLength);

            protocolUtils.stringifyGeometry(geometry, lightmaps, buffer, 0);
            postMessage({
              type: 'response',
              args: [id],
              result: buffer,
            }, [buffer]);

            const {geometries: localGeometries} = geometry;
            const trackedObjectChunkMeshes = {
              array: Array(NUM_CHUNKS_HEIGHT),
              groups: new Int32Array(NUM_RENDER_GROUPS * 2),
            };
            for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
              const {indexRange, boundingSphere} = localGeometries[i];
              trackedObjectChunkMeshes.array[i] = {
                // offset: new THREE.Vector3(x, i, z),
                indexRange,
                boundingSphere,
              };
            }
            objectChunkMeshes[_getChunkIndex(x, z)] = trackedObjectChunkMeshes;

            const {objects} = geometry
            const numObjects = objects.length / 3;
            for (let i = 0; i < numObjects; i++) {
              const baseIndex = i * 3;
              const index = objects[baseIndex + 0];
              const startIndex = objects[baseIndex + 1];
              const endIndex = objects[baseIndex + 2];

              const trackedObject = chunk.trackedObjects[index];
              trackedObject.startIndex = startIndex;
              trackedObject.endIndex = endIndex;

              if (!trackedObject.calledBack) {
                const objectApi = objectApis[trackedObject.n];
                if (objectApi && objectApi.added) {
                  postMessage({
                    type: 'objectAdded',
                    args: [trackedObject.n, x, z, index, trackedObject.position.toArray(), trackedObject.rotation.toArray(), trackedObject.value],
                  });
                }
                trackedObject.calledBack = true;
              }
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

      const chunk = zde.getChunk(x, z);
      zde.removeChunk(x, z);

      objectChunkMeshes[_getChunkIndex(x, z)] = null;

      for (const k in chunk.trackedObjects) {
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
      }
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
        const y = lightmapsCoordsArray[baseIndex + 1];
        promises.push(_requestChunk(x, y));
      }
      Promise.all(promises)
        .then(chunks => {
          let byteOffset = 4;

          for (let i = 0; i < numLightmaps; i++) {
            const chunk = chunks[i];
            const {geometry} = chunk;

            const lightmapHeaderArray = new Int32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 2);
            lightmapHeaderArray[0] = chunk.x;
            lightmapHeaderArray[1] = chunk.z;
            byteOffset += 4 * 2;

            const {positions} = geometry;
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
      const {id, args: positions} = data;
      const result = new Uint32Array(8 * 2);
      result.set(_getHoveredTrackedObject(positions[0]), 0);
      result.set(_getHoveredTrackedObject(positions[1]), 8);
      postMessage({
        type: 'response',
        args: [id],
        result,
      });
      break;
    }
    case 'getTeleportObject': {
      const {id, args: position} = data;
      const result = _getTeleportObject(position);
      postMessage({
        type: 'response',
        args: [id],
        result,
      });
      break;
    }
    case 'getBodyObject': {
      const {id, args: position} = data;
      const result = _getBodyObject(position);
      postMessage({
        type: 'response',
        args: [id],
        result,
      });
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

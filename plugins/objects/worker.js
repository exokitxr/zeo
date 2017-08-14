importScripts('/archae/assets/three.js');
const {exports: THREE} = self.module;
importScripts('/archae/assets/murmurhash.js');
const {exports: murmur} = self.module;
importScripts('/archae/assets/autows.js');
const {exports: Autows} = self.module;
importScripts('/archae/assets/alea.js');
const {exports: alea} = self.module;
// importScripts('/archae/assets/indev.js');
// const {exports: indev} = self.module;
self.module = {};

const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,

  DEFAULT_SEED,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');
const zeode = require('zeode');

const NUM_POSITIONS_CHUNK = 2 * 1024 * 1024;

const rng = new alea(DEFAULT_SEED);

const zde = zeode();
const geometries = {};
const textures = {};

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localVector3 = new THREE.Vector3();
const localVector4 = new THREE.Vector3();
const localRay = new THREE.Ray();
const localRay2 = new THREE.Ray();
const localQuaternion = new THREE.Quaternion();
const localMatrix = new THREE.Matrix4();
const localBox = new THREE.Box3();
const localBox2 = new THREE.Box3();
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

  for (let i = 0; i < zde.chunks.length; i++) {
    const chunk = zde.chunks[i];

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
          return [trackedObject.n, chunk.x, chunk.z, parseInt(k, 10), trackedObject.position.toArray()];
        }
      }
    }
  }
  return null;
};
const _getTeleportObject = position => {
  localRay.origin.set(position[0], 1000, position[2]);
  localRay.direction.set(0, -1, 0);

  let topY = -Infinity;
  let topTrackedObject = null;
  let topBox = null;

  for (let i = 0; i < zde.chunks.length; i++) {
    const chunk = zde.chunks[i];

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

  let topDistance = Infinity;
  let topN = -1;
  let topChunkX = -1;
  let topChunkZ = -1;
  let topObjectIndex = -1;

  for (let i = 0; i < zde.chunks.length; i++) {
    const chunk = zde.chunks[i];

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

  if (topN !== null) {
    return [topN, topChunkX, topChunkZ, topObjectIndex];
  } else {
    return null;
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

      const positionArray = matrix.slice(0, 3);
      const position = new THREE.Vector3().fromArray(positionArray);
      const rotationArray = matrix.slice(3, 7);
      const rotation = new THREE.Quaternion().fromArray(rotationArray);
      chunk.trackedObjects[index] = new TrackedObject(n, position, rotation, value, -1, -1);

      const objectApi = objectApis[n];
      if (objectApi && objectApi.added) {
        postMessage(JSON.stringify({
          type: 'objectAdded',
          args: [n, x, z, index, positionArray, rotationArray, value],
        }));
      }

      postMessage(JSON.stringify({
        type: 'chunkUpdate',
        args: [x, z],
      }));
    } else if (type === 'removeObject') {
      const {args: {x, z, index}} = m;
      const chunk = zde.getChunk(x, z);
      chunk.removeObject(index);

      const trackedObject = trackedObjects[index];
      const objectApi = objectApis[trackedObject.n];
      if (objectApi && objectApi.removed) {
        postMessage(JSON.stringify({
          type: 'objectRemoved',
          args: [trackedObject.n, x, z, index, trackedObject.startIndex, trackedObject.endIndex],
        }));
      }

      chunk.trackedObjects[index] = null;

      postMessage(JSON.stringify({
        type: 'chunkUpdate',
        args: [x, z],
      }));
    } else if (type === 'setObjectData') {
      const {args: {x, z, index, value}} = m;
      const chunk = zde.getChunk(x, z);
      chunk.setObjectData(index, value);

      const trackedObject = chunk.trackedObjects[index];
      const objectApi = objectApis[trackedObject.n];
      if (objectApi && objectApi.updated) {
        trackedObject.value = value;

        postMessage(JSON.stringify({
          type: 'objectUpdated',
          args: [trackedObject.n, x, z, index, trackedObject.position.toArray(), trackedObject.rotation.toArray(), trackedObject.value],
        }));
      }

      postMessage(JSON.stringify({
        type: 'chunkUpdate',
        args: [x, z],
      }));
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
const _requestChunk = (x, z) => {
  const chunk = zde.getChunk(x, z);

  if (chunk) {
    return Promise.resolve(chunk);
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
      });
  }
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
const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
  for (let i = 0; i < src.length; i++) {
    dst[startIndexIndex + i] = src[i] + startAttributeIndex;
  }
};

function _makeChunkGeometry(chunk) {
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

  chunk.forEachObject((n, matrix, value, index) => {
    const geometryEntries = geometries[n];

    if (geometryEntries) {
      for (let j = 0; j < geometryEntries.length; j++) {
        const geometry = geometryEntries[j].clone()
          .applyMatrix(localMatrix.makeRotationFromQuaternion(localQuaternion.set(matrix[3], matrix[4], matrix[5], matrix[6])))
          .applyMatrix(localMatrix.makeTranslation(matrix[0], matrix[1], matrix[2]))
          .applyMatrix(localMatrix.makeScale(matrix[7], matrix[8], matrix[9]));

        const newPositions = geometry.getAttribute('position').array;
        positions.set(newPositions, attributeIndex);

        const newUvs = geometry.getAttribute('uv').array;
        const numNewUvs = newUvs.length / 2;
        for (let k = 0; k < numNewUvs; k++) {
          const baseIndex = k * 2;
          uvs[uvIndex + baseIndex + 0] = newUvs[baseIndex + 0];
          uvs[uvIndex + baseIndex + 1] = 1 - newUvs[baseIndex + 1];
        }

        const newFrames = geometry.getAttribute('frame').array;
        frames.set(newFrames, frameIndex);

        const numNewPositions = newPositions.length / 3;
        const newObjectIndices = new Float32Array(numNewPositions);
        for (let k = 0; k < numNewPositions; k++) {
          newObjectIndices[k] = index;
        }
        objectIndices.set(newObjectIndices, objectIndexIndex);

        const newIndices = geometry.index.array;
        _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

        const newObjects = Uint32Array.from([index, indexIndex, indexIndex + newIndices.length]);
        objects.set(newObjects, objectIndex);

        attributeIndex += newPositions.length;
        uvIndex += newUvs.length;
        frameIndex += newFrames.length;
        objectIndexIndex += newObjectIndices.length;
        indexIndex += newIndices.length;
        objectIndex += newObjects.length;
      }
    }
  });

  return {
    positions: new Float32Array(positions.buffer, positions.byteOffset, attributeIndex),
    uvs: new Float32Array(uvs.buffer, uvs.byteOffset, uvIndex),
    frames: new Float32Array(frames.buffer, frames.byteOffset, frameIndex),
    objectIndices: new Float32Array(objectIndices.buffer, objectIndices.byteOffset, objectIndexIndex),
    indices: new Uint32Array(indices.buffer, indices.byteOffset, indexIndex),
    objects: new Uint32Array(objects.buffer, objects.byteOffset, objectIndex),
  };
};
function _wsUrl(s) {
  const l = self.location;
  return ((l.protocol === 'https:') ? 'wss://' : 'ws://') + l.host + s;
}

self.onmessage = e => {
  const {data} = e;
  const {type} = data;

  if (type === 'registerGeometry') {
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
  } else if (type === 'registerObject') {
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
              postMessage(JSON.stringify({
                type: 'objectAdded',
                args: [trackedObject.n, chunk.x, chunk.z, parseInt(k, 10), trackedObject.position, trackedObject.rotation, trackedObject.value],
              }));
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
  } else if (type === 'unregisterObject') {
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
              postMessage(JSON.stringify({
                type: 'objectRemoved',
                args: [trackedObject.n, chunk.x, chunk.z, parseInt(k, 10), trackedObject.position, trackedObject.rotation, trackedObject.value],
              }));
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
  } else if (type === 'registerTexture') {
    const {name, uv} = data;
    const n = murmur(name);
    textures[n] = uv;
  } else if (type === 'addObject') {
    const {name, position: positionArray, rotation: rotationArray, value} = data;

    const x = Math.floor(positionArray[0] / NUM_CELLS);
    const z = Math.floor(positionArray[2] / NUM_CELLS);
    _requestChunk(x, z)
      .then(chunk => {
        const n = murmur(name);
        const matrix = positionArray.concat(rotationArray).concat(oneVector.toArray());
        const index = chunk.addObject(n, matrix);
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
  } else if (type === 'removeObject') {
    const {x, z, index} = data;

    const chunk = zde.getChunk(x, z);
    if (chunk) {
      chunk.removeObject(index);

      const trackedObject = chunk.trackedObjects[index];
      const objectApi = objectApis[trackedObject.n];
      if (objectApi && objectApi.removed) {
        postMessage(JSON.stringify({
          type: 'objectRemoved',
          args: [trackedObject.n, x, z, index, trackedObject.startIndex, trackedObject.endIndex],
        }));
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
  } else if (type === 'setObjectData') {
    const {x, z, index, value} = data;

    _requestChunk(x, z)
      .then(chunk => {
        chunk.setObjectData(index, value);

        const trackedObject = chunk.trackedObjects[index];
        const objectApi = objectApis[trackedObject.n];
        if (objectApi && objectApi.updated) {
          trackedObject.value = value;

          postMessage(JSON.stringify({
            type: 'objectUpdated',
            args: [trackedObject.n, x, z, index, trackedObject.position.toArray(), trackedObject.rotation.toArray(), trackedObject.value],
          }));
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
  } else if (type === 'generate') {
    const {id, args} = data;
    const {x, z} = args;
    let {buffer: resultBuffer} = args;

    _requestChunk(x, z)
      .then(chunk => {
        const geometry = _makeChunkGeometry(chunk);

        resultBuffer = protocolUtils.stringifyGeometry(geometry, resultBuffer, 0);
        postMessage(JSON.stringify({
          type: 'response',
          args: [id],
        }));
        postMessage(resultBuffer, [resultBuffer]);

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
              postMessage(JSON.stringify({
                type: 'objectAdded',
                args: [trackedObject.n, x, z, index, trackedObject.position.toArray(), trackedObject.rotation.toArray(), trackedObject.value],
              }));
            }
            trackedObject.calledBack = true;
          }
        }
      })
      .catch(err => {
        console.warn(err);
      });
  } else if (type === 'ungenerate') {
    const {args} = data;
    const {x, z} = args;

    const chunk = zde.getChunk(x, z);

    zde.removeChunk(x, z);

    for (const k in chunk.trackedObjects) {
      const trackedObject = chunk.trackedObjects[k];

      if (trackedObject) {
        const objectApi = objectApis[trackedObject.n];

        if (objectApi && objectApi.removed) {
          postMessage(JSON.stringify({
            type: 'objectRemoved',
            args: [trackedObject.n, chunk.x, chunk.z, parseInt(k, 10), trackedObject.position, trackedObject.rotation, trackedObject.value],
          }));
        }
      }
    }
  } else if (type === 'getHoveredObjects') {
    const {id, args: positions} = data;
    const result = [
      _getHoveredTrackedObject(positions[0]),
      _getHoveredTrackedObject(positions[1]),
    ];
    postMessage(JSON.stringify({
      type: 'response',
      args: [id],
    }));
    postMessage(result);
  } else if (type === 'getTeleportObject') {
    const {id, args: position} = data;
    const result = _getTeleportObject(position);
    postMessage(JSON.stringify({
      type: 'response',
      args: [id],
    }));
    postMessage(result);
  } else if (type === 'getBodyObject') {
    const {id, args: position} = data;
    const result = _getBodyObject(position);
    postMessage(JSON.stringify({
      type: 'response',
      args: [id],
    }));
    postMessage(result);
  } else {
    console.warn('objects worker got invalid method', JSON.stringify(type));
  }
};

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

const NUM_POSITIONS_CHUNK = 4 * 1024 * 1024;

const rng = new alea(DEFAULT_SEED);

const zde = zeode();
const geometries = {};
const textures = {};

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localVector3 = new THREE.Vector3();
const localVector4 = new THREE.Vector3();
const localQuaternion = new THREE.Quaternion();
const localMatrix = new THREE.Matrix4();
const localBox = new THREE.Box3();

class TrackedObject {
  constructor(n, position) {
    this.n = n;
    this.position = position;
  }
}

const _getHoveredTrackedObject = position => {
  localVector.fromArray(position);

  for (let i = 0; i < zde.chunks.length; i++) {
    const chunk = zde.chunks[i];

    for (const k in chunk.trackedObjects) {
      const trackedObject = chunk.trackedObjects[k];
      const entry = geometries[trackedObject.n];
      const geometry = entry.length > 0 ? entry[0] : null;

      localBox.set(
        geometry ? localVector2.copy(geometry.boundingBox.min).add(trackedObject.position) : trackedObject.position,
        geometry ? localVector3.copy(geometry.boundingBox.max).add(trackedObject.position) : localVector3.set(0, 0, 0)
      );

      if (localBox.containsPoint(localVector)) {
        return [chunk.x, chunk.z, parseInt(k, 10)];
      }
    }
  }
  return null;
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
      const {args: {x, z, n, matrix}} = m;
      const chunk = zde.getChunk(x, z);
      chunk.addObject(n, matrix);
    } else if (type === 'removeObject') {
      const {args: {x, z, index}} = m;
      const chunk = zde.getChunk(x, z);
      chunk.removeObject(index);
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
        chunk.forEachObject((n, matrix, i) => {
          const position = new THREE.Vector3().fromArray(matrix);
          chunk.trackedObjects[i] = new TrackedObject(n, position);
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
  const objectIndices = new Float32Array(NUM_POSITIONS_CHUNK);
  const indices = new Uint32Array(NUM_POSITIONS_CHUNK);
  const objectsUint32Array = new Uint32Array(NUM_POSITIONS_CHUNK);
  const objectsFloat32Array = new Float32Array(objectsUint32Array.buffer, objectsUint32Array.byteOffset, objectsUint32Array.length);
  let attributeIndex = 0;
  let uvIndex = 0;
  let objectIndexIndex = 0;
  let indexIndex = 0;
  let objectIndex = 0;

  chunk.forEachObject((n, matrix, index) => {
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
        const numNewPositions = newPositions.length / 3;
        const newObjectIndices = new Float32Array(numNewPositions);
        for (let k = 0; k < numNewPositions; k++) {
          newObjectIndices[k] = index;
        }
        objectIndices.set(newObjectIndices, objectIndexIndex);
        const newIndices = geometry.index.array;
        _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);
        const newObjectsHeader = Uint32Array.from([n, index, indexIndex, indexIndex + newIndices.length]);
        objectsUint32Array.set(newObjectsHeader, objectIndex);
        const newObjectsBody = Float32Array.from([matrix[0], matrix[1], matrix[2]]);
        objectsFloat32Array.set(newObjectsBody, objectIndex + newObjectsHeader.length);

        attributeIndex += newPositions.length;
        uvIndex += newUvs.length;
        objectIndexIndex += newObjectIndices.length;
        indexIndex += newIndices.length;
        objectIndex += newObjectsHeader.length + newObjectsBody.length;
      }
    }
  });

  return {
    positions: new Float32Array(positions.buffer, positions.byteOffset, attributeIndex),
    uvs: new Float32Array(uvs.buffer, uvs.byteOffset, uvIndex),
    objectIndices: new Float32Array(objectIndices.buffer, objectIndices.byteOffset, objectIndexIndex),
    indices: new Uint32Array(indices.buffer, indices.byteOffset, indexIndex),
    objects: new Uint32Array(objectsUint32Array.buffer, objectsUint32Array.byteOffset, objectIndex),
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

    if (!geometry.boundingBox) {
      geometry.computeBoundingBox();
    }
    if (!geometry.boundingBox) {
      console.warn('fail');
    }

    const n = murmur(name);
    let entry = geometries[n];
    if (!entry) {
      entry = [];
      geometries[n] = entry;
    }
    entry.push(geometry);
  } else if (type === 'registerTexture') {
    const {name, uv} = data;
    const n = murmur(name);
    textures[n] = uv;
  } else if (type === 'addObject') {
    const {name, matrix} = data;

    const x = Math.floor(matrix[0] / NUM_CELLS);
    const z = Math.floor(matrix[2] / NUM_CELLS);
    _requestChunk(x, z)
      .then(chunk => {
        const n = murmur(name);
        const objectIndex = chunk.addObject(n, matrix);
        const position = new THREE.Vector3().fromArray(matrix);
        chunk.trackedObjects[objectIndex] = new TrackedObject(n, position);

        connection.send(JSON.stringify({
          method: 'addObject',
          args: {
            x,
            z,
            n,
            matrix,
          },
        }));
      })
      .catch(err => {
        console.warn(err);
      });
  } else if (type === 'removeObject') {
    const {x, z, index} = data;

    _requestChunk(x, z)
      .then(chunk => {
        chunk.removeObject(index);

        delete chunk.trackedObjects[index];

        connection.send(JSON.stringify({
          method: 'removeObject',
          args: {
            x,
            z,
            index,
          },
        }));
      })
      .catch(err => {
        console.warn(err);
      });
  } else if (type === 'generate') {
    const {id, x, z} = data;
    let {buffer: resultBuffer} = data;
    _requestChunk(x, z)
      .then(chunk => {
        const geometry = _makeChunkGeometry(chunk);
        resultBuffer = protocolUtils.stringifyGeometry(geometry, resultBuffer, 0);
        postMessage(id);
        postMessage(resultBuffer, [resultBuffer]);
      })
      .catch(err => {
        console.warn(err);
      });
  } else if (type === 'getHoveredObjects') {
    const {id, args} = data;
    const result = args.map(position => _getHoveredTrackedObject(position));
    postMessage(id);
    postMessage(result);
  } else {
    console.warn('objects worker got invalid method', JSON.stringify(type));
  }
};

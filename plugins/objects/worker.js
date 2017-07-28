importScripts('/archae/assets/three.js');
const {exports: THREE} = self.module;
importScripts('/archae/assets/murmurhash.js');
const {exports: murmur} = self.module;
self.module = {};

const protocolUtils = require('./lib/utils/protocol-utils');

const TEXTURE_ATLAS_SIZE = 512;
const NUM_POSITIONS_CHUNK = 100 * 1024;

const geometries = {};
const textures = {};
const objects = [];

class ObjectInstance {
  constructor(n, position) {
    this.n = n;
    this.position = position;
  }
}
const registerApi = {
  THREE,
  getUv(name) {
    const n = murmur(name);
    return textures[n];
  },
};
const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
  for (let i = 0; i < src.length; i++) {
    dst[startIndexIndex + i] = src[i] + startAttributeIndex;
  }
};

const _makeGeometry = (geometries, objects) => {
  const positions = new Float32Array(NUM_POSITIONS_CHUNK);
  const uvs = new Float32Array(NUM_POSITIONS_CHUNK);
  const indices = new Uint16Array(NUM_POSITIONS_CHUNK);
  let attributeIndex = 0;
  let uvIndex = 0;
  let indexIndex = 0;

  for (let i = 0; i < objects.length; i++) {
    const object = objects[i];
    const {n, position} = object;
    const geometryEntries = geometries[n];

    for (let j = 0; j < geometryEntries.length; j++) {
      const geometry = geometryEntries[j];
      const newPositions = geometry.getAttribute('position').array;
      const numNewPositions = newPositions.length / 3;
      for (let i = 0; i < numNewPositions; i++) {
        const baseIndex = i * 3;
        positions[attributeIndex + baseIndex + 0] = newPositions[baseIndex + 0] + position.x;
        positions[attributeIndex + baseIndex + 1] = newPositions[baseIndex + 1] + position.y;
        positions[attributeIndex + baseIndex + 2] = newPositions[baseIndex + 2] + position.z;
      }
      const newUvs = geometry.getAttribute('uv').array;
      const numNewUvs = newUvs.length / 2;
      for (let k = 0; k < numNewUvs; k++) {
        const baseIndex = k * 2;
        uvs[uvIndex + baseIndex + 0] = newUvs[baseIndex + 0];
        uvs[uvIndex + baseIndex + 1] = 1 - newUvs[baseIndex + 1];
      }
      const newIndices = geometry.index.array;
      _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

      attributeIndex += newPositions.length;
      uvIndex += newUvs.length;
      indexIndex += newIndices.length;
    }
  }

  return {
    positions: new Float32Array(positions.buffer, positions.byteOffset, attributeIndex),
    uvs: new Float32Array(uvs.buffer, uvs.byteOffset, uvIndex),
    indices: new Uint16Array(indices.buffer, indices.byteOffset, indexIndex),
  };
};

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
    const {name, position: positionArray} = data;
    const n = murmur(name);
    const position = new THREE.Vector3().fromArray(positionArray);
    const object = new ObjectInstance(n, position);
    objects.push(object);
  } else if (type === 'generate') {
    const {x, y, buffer} = data;
    const geometry = _makeGeometry(geometries, objects);
    const resultBuffer = protocolUtils.stringifyGeometry(geometry, buffer, 0);
    postMessage(resultBuffer, [resultBuffer]);
  } else {
    console.warn('objects worker got invalid method', JSON.stringify(''));
  }
};

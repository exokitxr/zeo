importScripts('/archae/assets/three.js');
const {exports: THREE} = self.module;
importScripts('/archae/assets/murmurhash.js');
const {exports: murmur} = self.module;
// importScripts('/archae/assets/indev.js');
// const {exports: indev} = self.module;
self.module = {};

const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_CELLS = 256;
const SCALE = 8;
const UV_SCALE = 32;
const NUM_FRAMES = 16;
const DATA = {
  amplitude: 0.3,
  amplitudeVariance: 0.3,
  speed: 1.0,
  speedVariance: 1.0,
};

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localQuaternion = new THREE.Quaternion();
const localMatrix = new THREE.Matrix4();

const hiGeometry = new THREE.PlaneBufferGeometry(NUM_CELLS, NUM_CELLS, NUM_CELLS / SCALE, NUM_CELLS / SCALE)
  .applyMatrix(localMatrix.makeTranslation(NUM_CELLS/2, 0, NUM_CELLS/2));
const loGeometry = new THREE.PlaneBufferGeometry(NUM_CELLS, NUM_CELLS, 1, 1)
  .applyMatrix(localMatrix.makeTranslation(NUM_CELLS/2, 0, NUM_CELLS/2));

/* const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
  for (let i = 0; i < src.length; i++) {
    dst[startIndexIndex + i] = src[i] + startAttributeIndex;
  }
}; */

function _makeOceanChunkGeometry(ox, oz, lod) {
  const geometry = (lod === 1 ? hiGeometry : loGeometry).clone()
    .applyMatrix(localMatrix.makeRotationFromQuaternion(localQuaternion.setFromAxisAngle(
      localVector.set(1, 0, 0),
      -Math.PI/2
    )))
    .applyMatrix(localMatrix.makeTranslation(ox * NUM_CELLS, 0, oz * NUM_CELLS));

  const positions = geometry.getAttribute('position').array;

  const uvs = geometry.getAttribute('uv').array;
  const numUvs = uvs.length / 2;
  for (let i = 0; i < numUvs; i++) {
    const baseIndex = i * 2;
    uvs[baseIndex + 0] *= UV_SCALE;
    uvs[baseIndex + 1] *= UV_SCALE / NUM_FRAMES;
  }

  const numPositions = positions.length / 3;
  const waves = new Float32Array(numPositions * 3);
  for (let i = 0; i < numPositions; i++) {
    const baseIndex = i * 3;
    const x = positions[baseIndex + 0];
    const z = positions[baseIndex + 2];
    const key = `${x}:${z}`;
    waves[baseIndex + 0] = (murmur(key + ':ang') / 0xFFFFFFFF) * Math.PI * 2; // ang
    waves[baseIndex + 1] = DATA.amplitude + (murmur(key + ':amp') / 0xFFFFFFFF) * DATA.amplitudeVariance; // amp
    waves[baseIndex + 2] = (DATA.speed + (murmur(key + ':speed') / 0xFFFFFFFF) * DATA.speedVariance) / 1000; // speed
  }

  const indices = geometry.index.array;

  return {positions, uvs, waves, indices};
};

self.onmessage = e => {
  const {data} = e;
  const {x, z, lod} = data;
  let {buffer: resultBuffer} = data;
  const geometry = _makeOceanChunkGeometry(x, z, lod);
  resultBuffer = protocolUtils.stringifyGeometry(geometry, resultBuffer, 0);
  postMessage(resultBuffer, [resultBuffer]);
};

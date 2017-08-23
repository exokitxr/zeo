importScripts('/archae/assets/three.js');
const {exports: THREE} = self.module;
importScripts('/archae/assets/murmurhash.js');
const {exports: murmur} = self.module;
// importScripts('/archae/assets/indev.js');
// const {exports: indev} = self.module;
self.module = {};

const {
  NUM_CELLS,

  NUM_CHUNKS_HEIGHT,
  NUM_RENDER_GROUPS,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const SCALE = 8;
const UV_SCALE = 2;
const NUM_FRAMES = 16;
const DATA = {
  amplitude: 0.3,
  amplitudeVariance: 0.3,
  speed: 1.0,
  speedVariance: 1.0,
};

function mod(value, divisor) {
  var n = value % divisor;
  return n < 0 ? (divisor + n) : n;
}
const _getChunkIndex = (x, z) => (mod(x, 0xFFFF) << 16) | mod(z, 0xFFFF);

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localQuaternion = new THREE.Quaternion();
const localMatrix = new THREE.Matrix4();
const localMatrix2 = new THREE.Matrix4();
const localFrustum = new THREE.Frustum();

const hiGeometry = new THREE.PlaneBufferGeometry(NUM_CELLS, NUM_CELLS, NUM_CELLS / SCALE, NUM_CELLS / SCALE)
  .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    -Math.PI/2
  )))
  .applyMatrix(localMatrix.makeTranslation(NUM_CELLS/2, 64, NUM_CELLS/2));
/* const loGeometry = new THREE.PlaneBufferGeometry(NUM_CELLS, NUM_CELLS, 1, 1)
  .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    -Math.PI/2
  )))
  .applyMatrix(localMatrix.makeTranslation(NUM_CELLS/2, 64, NUM_CELLS/2)); */

const oceanChunkMeshes = {};

function _makeOceanChunkGeometry(ox, oz) {
  const geometry = hiGeometry.clone()
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

  geometry.computeBoundingSphere();
  const {boundingSphere} = geometry;

  return {
    positions,
    uvs,
    waves,
    indices,
    boundingSphere: Float32Array.from(boundingSphere.center.toArray().concat([boundingSphere.radius])),
  };
};

const _getCull = (hmdPosition, projectionMatrix, matrixWorldInverse) => {
  localFrustum.setFromMatrix(localMatrix.fromArray(projectionMatrix).multiply(localMatrix2.fromArray(matrixWorldInverse)));

  for (const index in oceanChunkMeshes) {
    const trackedOceanChunkMeshes = oceanChunkMeshes[index];
    if (trackedOceanChunkMeshes) {
      trackedOceanChunkMeshes.groups.fill(-1);
      let groupIndex = 0;
      let start = -1;
      let count = 0;
      for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) { // XXX optimize this direction
        const trackedOceanChunkMesh = trackedOceanChunkMeshes.array[i];
        if (localFrustum.intersectsSphere(trackedOceanChunkMesh.boundingSphere)) {
          if (start === -1) {
            start = trackedOceanChunkMesh.indexRange.start;
          }
          count += trackedOceanChunkMesh.indexRange.count;
        } else {
          if (start !== -1) {
            const baseIndex = groupIndex * 2;
            trackedOceanChunkMeshes.groups[baseIndex + 0] = start;
            trackedOceanChunkMeshes.groups[baseIndex + 1] = count;
            groupIndex++;
            start = -1;
            count = 0;
          }
        }
      }
      if (start !== -1) {
        const baseIndex = groupIndex * 2;
        trackedOceanChunkMeshes.groups[baseIndex + 0] = start;
        trackedOceanChunkMeshes.groups[baseIndex + 1] = count;
      }
    }
  }

  return oceanChunkMeshes;
};

self.onmessage = e => {
  const {data} = e;
  const {type} = data;

  if (type === 'generate') {
    const {id, x, y, buffer} = data;
    let {buffer: resultBuffer} = data;
    const geometry = _makeOceanChunkGeometry(x, y);

    const geometries = (() => { // XXX actually split into multiple geometries
      const result = Array(NUM_CHUNKS_HEIGHT);
      for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
        result[i] = {
          indexRange: {
            start: -1,
            count: 0,
          },
          boundingSphere: new Float32Array(4),
        };
      }
      result[0] = {
        indexRange: {
          start: 0,
          count: geometry.indices.length,
        },
        boundingSphere: geometry.boundingSphere,
      };
      return result;
    })();
    const trackedOceanChunkMeshes = {
      array: Array(NUM_CHUNKS_HEIGHT),
      groups: new Int32Array(NUM_RENDER_GROUPS * 2),
    };
    for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
      const {indexRange, boundingSphere} = geometries[i];
      trackedOceanChunkMeshes.array[i] = {
        // offset: new THREE.Vector3(x, i, y),
        indexRange,
        boundingSphere: new THREE.Sphere(
          new THREE.Vector3().fromArray(boundingSphere, 0),
          boundingSphere[3]
        ),
      };
    }
    oceanChunkMeshes[_getChunkIndex(x, y)] = trackedOceanChunkMeshes;

    resultBuffer = protocolUtils.stringifyGeometry(geometry, resultBuffer, 0);
    postMessage({
      type: 'response',
      args: [id],
      result: resultBuffer,
    }, [buffer]);
  } else if (type === 'ungenerate') {
    const {x, y} = data;

    oceanChunkMeshes[_getChunkIndex(x, y)] = null;
  } else if (type === 'cull') {
    const {id, args} = data;
    const {hmdPosition, projectionMatrix, matrixWorldInverse, buffer} = args;

    const oceanChunkMeshes = _getCull(hmdPosition, projectionMatrix, matrixWorldInverse);
    protocolUtils.stringifyCull(oceanChunkMeshes, buffer, 0);
    postMessage({
      type: 'response',
      args: [id],
      result: buffer,
    }, [buffer]);
  } else {
    console.warn('invalid ocean worker method:', JSON.stringify(type));
  }
};

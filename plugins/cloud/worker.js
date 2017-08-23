importScripts('/archae/assets/three.js');
const {exports: THREE} = self.module;
importScripts('/archae/assets/alea.js');
const {exports: alea} = self.module;
self.module = {};

const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,

  NUM_CHUNKS_HEIGHT,
  NUM_RENDER_GROUPS,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS = 20 * 1024;
const NUM_POSITIONS_CHUNK = 100 * 1024;
const CAMERA_ROTATION_ORDER = 'YXZ';

const upVector = new THREE.Vector3(0, 1, 0);

const rng = new alea();

function mod(value, divisor) {
  var n = value % divisor;
  return n < 0 ? (divisor + n) : n;
}
const _getChunkIndex = (x, z) => (mod(x, 0xFFFF) << 16) | mod(z, 0xFFFF);

const localMatrix = new THREE.Matrix4();
const localMatrix2 = new THREE.Matrix4();
const localFrustum = new THREE.Frustum();

const _makeIndices = numPositions => {
  const indices = new Uint32Array(numPositions);
  for (let i = 0; i < numPositions; i++) {
    indices[i] = i;
  }
  return indices;
};
const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
  for (let i = 0; i < src.length; i++) {
    dst[startIndexIndex + i] = src[i] + startAttributeIndex;
  }
};

const cloudTypes = [
  (() => {
    const geometry = new THREE.TetrahedronBufferGeometry(1, 1);
    const positions = geometry.getAttribute('position').array;
    const numPositions = positions.length / 3;
    const indices = _makeIndices(numPositions);
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeFaceNormals();
    return geometry;
  })(),
  (() => {
    const g = new THREE.BoxBufferGeometry(1, 1, 1);
    g.computeFaceNormals();
    return g;
  })(),
];
const _makeCloudPatchGeometry = () => {
  const cloudGeometries = [];
  const numClouds = 5 + Math.floor(Math.random() * 20);
  for (let j = 0; j < numClouds; j++) {
    const cloudType = cloudTypes[Math.floor(cloudTypes.length * Math.random())];
    const geometry = cloudType.clone()
      .applyMatrix(new THREE.Matrix4().makeScale(
        1 + (Math.random() * 8),
        1 + (Math.random() * 8),
        1 + (Math.random() * 8)
      ))
      .applyMatrix(new THREE.Matrix4().makeRotationFromEuler(
        new THREE.Euler(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          CAMERA_ROTATION_ORDER
        )
      ))
      .applyMatrix(new THREE.Matrix4().makeTranslation(
        -25 + (Math.random() * 25),
        -5 + (Math.random() * 5),
        -25 + (Math.random() * 25)
      ));
    cloudGeometries.push(geometry);
  }

  const positions = new Float32Array(NUM_POSITIONS * 3);
  const normals = new Float32Array(NUM_POSITIONS * 3);
  const indices = new Uint32Array(NUM_POSITIONS * 3);
  let attributeIndex = 0;
  let indexIndex = 0;
  for (let i = 0; i < cloudGeometries.length; i++) {
    const cloudGeometry = cloudGeometries[i];
    const newPositions = cloudGeometry.getAttribute('position').array;
    positions.set(newPositions, attributeIndex);
    const newNormals = cloudGeometry.getAttribute('normal').array;
    normals.set(newNormals, attributeIndex);
    const newIndices = cloudGeometry.index.array;
    _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

    attributeIndex += newPositions.length;
    indexIndex += newIndices.length;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, attributeIndex), 3));
  geometry.addAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals.buffer, normals.byteOffset, attributeIndex), 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices.buffer, indices.byteOffset, indexIndex), 1));
  return geometry;
};
const cloudPatchGeometries = (() => {
  const numCloudGeometries = 20;
  const result = Array(numCloudGeometries);
  for (let i = 0; i < numCloudGeometries; i++) {
    result[i] = _makeCloudPatchGeometry();
  }
  return result;
})();

const cloudChunkMeshes = {};

const _makeCloudChunkMesh = (x, y, cloudPatchGeometries) => {
  const positions = new Float32Array(NUM_POSITIONS_CHUNK);
  const normals = new Float32Array(NUM_POSITIONS_CHUNK);
  const indices = new Uint32Array(NUM_POSITIONS_CHUNK);
  let attributeIndex = 0;
  let indexIndex = 0;

  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const matrix = new THREE.Matrix4();

  const cloudRng = new alea(x + ':' + y);
  const numCloudPatches = Math.round(Math.random() * 0.7);
  for (let i = 0; i < numCloudPatches; i++) {
    const dx = cloudRng() * NUM_CELLS;
    const dy = cloudRng() * NUM_CELLS;
    const cloudPatchGeometry = cloudPatchGeometries[Math.floor(cloudRng() * cloudTypes.length)];

    position.set(
      (x * NUM_CELLS) + dx,
      64 + 60 + (cloudRng() * 10),
      (y * NUM_CELLS) + dy
    )
    quaternion.setFromAxisAngle(upVector, cloudRng() * Math.PI * 2);
    matrix.compose(position, quaternion, scale);
    const geometry = cloudPatchGeometry
      .clone()
      .applyMatrix(matrix);
    const newPositions = geometry.getAttribute('position').array;
    positions.set(newPositions, attributeIndex);
    const newNormals = geometry.getAttribute('normal').array;
    normals.set(newNormals, attributeIndex);
    const newIndices = geometry.index.array;
    _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

    attributeIndex += newPositions.length;
    indexIndex += newIndices.length;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, attributeIndex), 3));
  geometry.computeBoundingSphere();
  const {boundingSphere} = geometry;

  return {
    positions: new Float32Array(positions.buffer, positions.byteOffset, attributeIndex),
    normals: new Float32Array(normals.buffer, normals.byteOffset, attributeIndex),
    indices: new Uint32Array(indices.buffer, indices.byteOffset, indexIndex),
    boundingSphere: Float32Array.from(boundingSphere.center.toArray().concat([boundingSphere.radius])),
  };
};

const _getCull = (hmdPosition, projectionMatrix, matrixWorldInverse) => {
  localFrustum.setFromMatrix(localMatrix.fromArray(projectionMatrix).multiply(localMatrix2.fromArray(matrixWorldInverse)));

  for (const index in cloudChunkMeshes) {
    const trackedCloudChunkMeshes = cloudChunkMeshes[index];
    if (trackedCloudChunkMeshes) {
      trackedCloudChunkMeshes.groups.fill(-1);
      let groupIndex = 0;
      let start = -1;
      let count = 0;
      for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) { // XXX optimize this direction
        const trackedCloudChunkMesh = trackedCloudChunkMeshes.array[i];
        if (localFrustum.intersectsSphere(trackedCloudChunkMesh.boundingSphere)) {
          if (start === -1) {
            start = trackedCloudChunkMesh.indexRange.start;
          }
          count += trackedCloudChunkMesh.indexRange.count;
        } else {
          if (start !== -1) {
            const baseIndex = groupIndex * 2;
            trackedCloudChunkMeshes.groups[baseIndex + 0] = start;
            trackedCloudChunkMeshes.groups[baseIndex + 1] = count;
            groupIndex++;
            start = -1;
            count = 0;
          }
        }
      }
      if (start !== -1) {
        const baseIndex = groupIndex * 2;
        trackedCloudChunkMeshes.groups[baseIndex + 0] = start;
        trackedCloudChunkMeshes.groups[baseIndex + 1] = count;
      }
    }
  }

  return cloudChunkMeshes;
};

self.onmessage = e => {
  const {data} = e;
  const {type} = data;

  if (type === 'generate') {
    const {id, x, y, buffer} = data;
    const cloudChunkGeometry = _makeCloudChunkMesh(x, y, cloudPatchGeometries);

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
          count: cloudChunkGeometry.indices.length,
        },
        boundingSphere: cloudChunkGeometry.boundingSphere,
      };
      return result;
    })();
    const trackedCloudChunkMeshes = {
      array: Array(NUM_CHUNKS_HEIGHT),
      groups: new Int32Array(NUM_RENDER_GROUPS * 2),
    };
    for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
      const {indexRange, boundingSphere} = geometries[i];
      trackedCloudChunkMeshes.array[i] = {
        indexRange,
        boundingSphere: new THREE.Sphere(
          new THREE.Vector3().fromArray(boundingSphere, 0),
          boundingSphere[3]
        ),
      };
    }
    cloudChunkMeshes[_getChunkIndex(x, y)] = trackedCloudChunkMeshes;

    const resultBuffer = protocolUtils.stringifyCloudGeometry(cloudChunkGeometry, buffer, 0);
    postMessage({
      type: 'response',
      args: [id],
      result: buffer,
    }, [buffer]);
  } else if (type === 'ungenerate') {
    const {x, y} = data;

    cloudChunkMeshes[_getChunkIndex(x, y)] = null;
  } else if (type === 'cull') {
    const {id, args} = data;
    const {hmdPosition, projectionMatrix, matrixWorldInverse, buffer} = args;

    const cloudChunkMeshes = _getCull(hmdPosition, projectionMatrix, matrixWorldInverse);
    protocolUtils.stringifyCull(cloudChunkMeshes, buffer, 0);
    postMessage({
      type: 'response',
      args: [id],
      result: buffer,
    }, [buffer]);
  } else {
    console.warn('invalid cloud worker method:', JSON.stringify(type));
  }
};

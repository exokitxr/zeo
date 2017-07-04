importScripts('/archae/three/three.js');
const {exports: THREE} = self.module;
self.module = {};

const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS = 10 * 1024; // XXX can be computed exactly

const _sum = a => {
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    const e = a[i];
    result += e;
  }
  return result;
};
const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
  for (let i = 0; i < src.length; i++) {
    dst[startIndexIndex + i] = src[i] + startAttributeIndex;
  }
};

const _makeCubeGeometry = () => {
  const size = 1;
  const halfSize = size/2;

  const positions = Float32Array.from([
    -halfSize, +halfSize, -halfSize,
    -halfSize, -halfSize, -halfSize,
    +halfSize, +halfSize, -halfSize,
    +halfSize, -halfSize, -halfSize,

    -halfSize, -halfSize, +halfSize,
    +halfSize, -halfSize, +halfSize,
    -halfSize, +halfSize, +halfSize,
    +halfSize, +halfSize, +halfSize,

    -halfSize, +halfSize, -halfSize,
    +halfSize, +halfSize, -halfSize,

    -halfSize, +halfSize, -halfSize,
    -halfSize, +halfSize, +halfSize,

    +halfSize, +halfSize, -halfSize,
    +halfSize, +halfSize, +halfSize,
  ]);
  const uvs = Float32Array.from([
    0, 0.66,
    0.25, 0.66,
    0, 0.33,
    0.25, 0.33,

    0.5, 0.66,
    0.5, 0.33,
    0.75, 0.66,
    0.75, 0.33,

    1, 0.66,
    1, 0.33,

    0.25, 1,
    0.5, 1,

    0.25, 0,
    0.5, 0,
  ]);
  const indices = Float32Array.from([
    0, 2, 1, // front
    1, 2, 3,
    4, 5, 6, // back
    5, 7, 6,
    6, 7, 8, //top
    7, 9 ,8, 
    1, 3, 4, //bottom
    3, 5, 4,
    1, 11,10,// left
    1, 4, 11,
    3, 12, 5,//right
    5, 12, 13,
  ]);

  const geometry = new THREE.BufferGeometry();
  geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
};
const animalGeometry = (() => {
  const bodyGeometry = (() => {
    const type = Math.random() < 0.5 ? 'long' : 'high';
    const width = 0.2 + (Math.random() * 0.3);
    const height = (type === 'long') ? (0.1 + (Math.random() * 0.4)) : (0.5 + (Math.random() * 1));
    const depth = (type === 'long') ? (0.5 + (Math.random() * 1)) : (0.1 + (Math.random() * 0.4));

    const geometry = _makeCubeGeometry()
      .applyMatrix(new THREE.Matrix4().makeScale(width, height, depth));
    geometry.width = width;
    geometry.height = height;
    geometry.depth = depth;
    return geometry;
  })();
  const legGeometries = (() => {
    const numLegs = 1 + Math.floor(Math.random() * (2 +  1));
    const width = 0.05 + (Math.random() * 0.1);
    const height = 0.2 + (Math.random() * 0.8);
    const depth = 0.05 + (Math.random() * 0.1);
    const offsetX = 0.6 + (Math.random() * 0.4);
    const offsetY = 0.1 + (Math.random() * 0.2);
    const offsetZ = 0 + (Math.random() * 0.2);
    const scaleZ = 1 + (-0.2 + (Math.random() * 0.4));

    const result = [];
    for (let i = 0; i < numLegs; i++) {
      const leftGeometry = _makeCubeGeometry()
        .applyMatrix(new THREE.Matrix4().makeScale(width, height, depth))
        .applyMatrix(new THREE.Matrix4().makeTranslation(
          -offsetX*bodyGeometry.width/2,
          -bodyGeometry.height/2 - height/2 + offsetZ*bodyGeometry.height,
          ((-bodyGeometry.depth/2 + (numLegs === 1 ? (bodyGeometry.depth/2) : (i/(numLegs-1)*bodyGeometry.depth))) * scaleZ) + offsetZ*bodyGeometry.depth
        ));
      result.push(leftGeometry);

      const rightGeometry = _makeCubeGeometry()
        .applyMatrix(new THREE.Matrix4().makeScale(width, height, depth))
        .applyMatrix(new THREE.Matrix4().makeTranslation(
          offsetX*bodyGeometry.width/2,
          -bodyGeometry.height/2 - height/2 + offsetZ*bodyGeometry.height,
          ((-bodyGeometry.depth/2 + (numLegs === 1 ? (bodyGeometry.depth/2) : (i/(numLegs-1)*bodyGeometry.depth))) * scaleZ) + offsetZ*bodyGeometry.depth
        ));
      result.push(rightGeometry);
    }
    return result;
  })();
  const geometries = [bodyGeometry].concat(legGeometries);

  const numPositions = _sum(geometries.map(g => g.getAttribute('position').array.length));
  const numNormals = _sum(geometries.map(g => g.getAttribute('normal').array.length));
  const numUvs = _sum(geometries.map(g => g.getAttribute('uv').array.length));
  const numIndices = _sum(geometries.map(g => g.index.array.length));

  const positions = new Float32Array(numPositions);
  const normals = new Float32Array(numNormals);
  const uvs = new Float32Array(numUvs);
  const indices = new Uint32Array(numIndices);
  let attributeIndex = 0;
  let uvIndex = 0;
  let indexIndex = 0;

  for (let i = 0; i < geometries.length; i++) {
    const geometry = geometries[i];

    const newPositions = geometry.getAttribute('position').array;
    positions.set(newPositions, attributeIndex);
    const newNormals = geometry.getAttribute('normal').array;
    normals.set(newNormals, attributeIndex);
    const newUvs = geometry.getAttribute('uv').array;
    uvs.set(newUvs, uvIndex);
    const newIndices = geometry.index.array;
    _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

    attributeIndex += newPositions.length;
    uvIndex += newUvs.length;
    indexIndex += newIndices.length;
  }

  return {
    positions: new Float32Array(positions.buffer, positions.byteOffset, attributeIndex),
    normals: new Float32Array(positions.buffer, positions.byteOffset, attributeIndex),
    uvs: new Float32Array(uvs.buffer, uvs.byteOffset, uvIndex),
    indices: new Uint32Array(indices.buffer, indices.byteOffset, indexIndex),
  };
})();

self.onmessage = e => {
  const {data: {buffer}} = e;
  const resultBuffer = protocolUtils.stringifyGeometry(animalGeometry, buffer, 0);
  postMessage(resultBuffer, [resultBuffer]);
};

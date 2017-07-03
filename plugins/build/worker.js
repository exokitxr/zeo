importScripts('/archae/three/three.js');
const {exports: THREE} = self.module;
self.module = {};

const isosurface = require('isosurface');
const protocolUtils = require('./lib/utils/protocol-utils');

const RESOLUTION = 32;

const _marchCubes = (fn, resolution) => isosurface.marchingCubes(
  [resolution, resolution, resolution],
  fn,
  [
    [-resolution / 2, -resolution / 2, -resolution / 2],
    [resolution / 2, resolution / 2, resolution / 2]
  ]
);

const _makeGeometry = (x, y, z, points) => {
  const {positions: positionsArray, cells: cellsArray} = _marchCubes((x, y, z) => {
    const dx = x + (RESOLUTION / 2);
    const dy = y + (RESOLUTION / 2);
    const dz = z + (RESOLUTION / 2);
    const index = dx + (dy * RESOLUTION) + (dz * RESOLUTION * RESOLUTION);
    return 1 - points[index];
  }, RESOLUTION);

  const numPositions = positionsArray.length;
  const positions = new Float32Array(numPositions * 3);
  for (let i = 0; i < numPositions; i++) {
    const baseIndex = i * 3;
    positions[baseIndex + 0] = positionsArray[i][0];
    positions[baseIndex + 1] = positionsArray[i][1];
    positions[baseIndex + 2] = positionsArray[i][2];
  }
  const numCells = cellsArray.length;
  const indices = new Uint32Array(numCells * 3);
  for (let i = 0; i < numCells; i++) {
    const baseIndex = i * 3;
    indices[baseIndex + 0] = cellsArray[i][0];
    indices[baseIndex + 1] = cellsArray[i][1];
    indices[baseIndex + 2] = cellsArray[i][2];
  }

  const geometry = new THREE.BufferGeometry();
  geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.applyMatrix(new THREE.Matrix4().makeScale(1 / RESOLUTION, 1 / RESOLUTION, 1 / RESOLUTION));
  geometry.computeVertexNormals();

  const normals = geometry.getAttribute('normal').array;

  return {
    positions: positions,
    normals: normals,
    indices: indices,
  };
};

self.onmessage = e => {
  const {data: {x, y, z, points, resultBuffer}} = e;
  const geometry = _makeGeometry(x, y, z, points);
  const newResultBuffer = protocolUtils.stringifyGeometry(geometry, resultBuffer, 0);
  postMessage({
    resultBuffer: newResultBuffer,
  }, [newResultBuffer]);
};

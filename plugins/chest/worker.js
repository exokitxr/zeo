importScripts('/archae/three/three.js');
const {exports: THREE} = self.module;
self.module = {};

const isosurface = require('isosurface');
const {
  NUM_CELLS,
  OVERSCAN,
  NUM_CELLS_OVERSCAN,

  DEFAULT_SEED,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const zeroVector = new THREE.Vector3();
const upVector = new THREE.Vector3(0, 1, 0);

const _marchCubes = (fn, resolution) => isosurface.marchingCubes(
  [resolution, resolution, resolution],
  fn,
  [
    [-resolution / 2, -resolution / 2, -resolution / 2],
    [resolution / 2, resolution / 2, resolution / 2]
  ]
);

const chestGeometry = (() => {
  const resolution = 24;
  const box = new THREE.Box3(
    new THREE.Vector3(-resolution * 0.45, -resolution * 0.5, -resolution * 0.3),
    new THREE.Vector3(resolution * 0.45, resolution * 0, resolution * 0.3)
  );
  const box2 = new THREE.Box3(
    new THREE.Vector3(-resolution * 0.35, -resolution * 0.4, -resolution * 0.2),
    new THREE.Vector3(resolution * 0.35, resolution * 0.5, resolution * 0.2)
  );
  /* const line = new THREE.Line3(
    new THREE.Vector3(-resolution * 0.05, 0, -resolution * 0.2),
    new THREE.Vector3(resolution * 0.05, 0, resolution * 0.2)
  ); */
  const _distanceToBox = (p, rect) => {
    const dxMin = Math.abs(rect.min.x - p.x);
    const dxMax = Math.abs(p.x - rect.max.x);
    const dxDirection = (dxMin <= dxMax) ? -1 : 1;
    const dx = Math.min(dxMin, dxMax);

    const dyMin = Math.abs(rect.min.y - p.y);
    const dyMax = Math.abs(p.y - rect.max.y);
    const dyDirection = (dyMin <= dyMax) ? -1 : 1;
    const dy = Math.min(dyMin, dyMax);
    
    const dzMin = Math.abs(rect.min.z - p.z);
    const dzMax = Math.abs(p.z - rect.max.z);
    const dzDirection = (dzMin <= dzMax) ? -1 : 1;
    const dz = Math.min(dzMin, dzMax);

    const bindPoint = (() => {
      const bindAxis = [['x', dx], ['y', dy], ['z', dz]].sort((a,b) => a[1] - b[1])[0][0];
      switch (bindAxis) {
        case 'x': return new THREE.Vector3(dxDirection === -1 ? rect.min.x : rect.max.x, p.y, p.z);
        case 'y': return new THREE.Vector3(p.x, dyDirection === -1 ? rect.min.y : rect.max.y, p.z);
        case 'z': return new THREE.Vector3(p.x, p.y, dzDirection === -1 ? rect.min.z : rect.max.z);
        default: return null;
      }
    })();
    return p.distanceTo(bindPoint);
  };
  const baseValue = 1;
  const {positions: positionsArray, cells: cellsArray} = _marchCubes((x, y, z) => {
    const v = new THREE.Vector3(x, y, z);

    if (box.containsPoint(v) && !box2.containsPoint(v)) {
      return baseValue - _distanceToBox(v, box);
    } else {
      return baseValue;
    }
  }, resolution);

  const geometry = new THREE.BufferGeometry();
  const numPositions = positionsArray.length;
  const positions = new Float32Array(numPositions * 3);
  for (let i = 0; i < numPositions; i++) {
    const baseIndex = i * 3;
    positions[baseIndex + 0] = positionsArray[i][0];
    positions[baseIndex + 1] = positionsArray[i][1];
    positions[baseIndex + 2] = positionsArray[i][2];
  }
  const colors = new Float32Array(numPositions * 3);
  const baseColor = new THREE.Color(0x795548);
  for (let i = 0; i < numPositions; i++) {
    const baseIndex = i * 3;
    const z = positions[baseIndex + 2];
    const zFactor = (z / resolution) + 0.5;
    const color = baseColor.clone().multiplyScalar(1 - (zFactor * 0.5));
    colors[baseIndex + 0] = color.r;
    colors[baseIndex + 1] = color.g;
    colors[baseIndex + 2] = color.b;
  }
  const numCells = cellsArray.length;
  const indices = new Uint16Array(numCells * 3);
  for (let i = 0; i < numCells; i++) {
    const baseIndex = i * 3;
    indices[baseIndex + 0] = cellsArray[i][0];
    indices[baseIndex + 1] = cellsArray[i][1];
    indices[baseIndex + 2] = cellsArray[i][2];
  }

  geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.applyMatrix(new THREE.Matrix4().makeScale(1 / resolution, 1 / resolution, 1 / resolution));
  geometry.computeVertexNormals();

  const normals = geometry.getAttribute('normal').array;

  return {
    positions: positions,
    normals: normals,
    colors: colors,
    indices: indices,
  };
})();

self.onmessage = e => {
  const {data: {buffer}} = e;
  const resultBuffer = protocolUtils.stringifyChestChunk(chestGeometry, buffer, 0);
  postMessage(resultBuffer, [resultBuffer]);
};

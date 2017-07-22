importScripts('/archae/assets/three.js');
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
const resolution = 24;
const baseValue = 1;
const chestGeometry = (() => {
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
    const y = positions[baseIndex + 1];
    const yFactor = (y / resolution) + 0.5;
    const color = baseColor.clone().multiplyScalar(0.5 + (yFactor * 0.5));
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
  geometry.computeBoundingBox();

  const normals = geometry.getAttribute('normal').array;
  const {boundingBox} = geometry;

  return {
    positions: positions,
    normals: normals,
    colors: colors,
    indices: indices,
    boundingBox: [
      boundingBox.min.toArray(),
      boundingBox.max.toArray(),
    ],
  };
})();
const lidGeometry = (() => {
  const woodGeometry = (() => {
    const box = new THREE.Box3(
      new THREE.Vector3(-resolution * 0.45, -resolution * 0.1, -resolution * 0.3),
      new THREE.Vector3(resolution * 0.45, resolution * 0.1, resolution * 0.3)
    );
    const box2 = new THREE.Box3(
      new THREE.Vector3(-resolution * 0.35, -resolution * 0.5, -resolution * 0.2),
      new THREE.Vector3(resolution * 0.35, resolution * 0, resolution * 0.2)
    );
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
      const y = positions[baseIndex + 1];
      const yFactor = (y / resolution) + 0.5;
      const color = baseColor.clone().multiplyScalar(0.45 + (yFactor * 0.55));
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

    return {
      positions: positions,
      colors: colors,
      indices: indices,
    };
  })();
  const latchGeometry = (() => {
    const box = new THREE.Box3(
      new THREE.Vector3(-resolution * 0.04, -resolution * 0.03, resolution * 0.26),
      new THREE.Vector3(resolution * 0.04, resolution * 0.02, resolution * 0.265)
    );
    const {positions: positionsArray, cells: cellsArray} = _marchCubes((x, y, z) => {
      const v = new THREE.Vector3(x, y, z);
      return -0.5 + box.distanceToPoint(v);
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
    const baseColor = new THREE.Color(0xFFC107);
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

    return {
      positions: positions,
      colors: colors,
      indices: indices,
    };
  })();
  const hingeGeometry = (() => {
    const box = new THREE.Box3(
      new THREE.Vector3(-resolution * 0.35, -resolution * 0.05 - resolution * 0.0005, -resolution * 0.251),
      new THREE.Vector3(resolution * 0.35, -resolution * 0.05 + resolution * 0.0005, -resolution * 0.25)
    );
    const {positions: positionsArray, cells: cellsArray} = _marchCubes((x, y, z) => {
      const v = new THREE.Vector3(x, y, z);
      return -0.5 + box.distanceToPoint(v);
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
    const baseColor = new THREE.Color(0x9E9E9E);
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

    return {
      positions: positions,
      colors: colors,
      indices: indices,
    };
  })();

  const newGeometries = [woodGeometry, latchGeometry, hingeGeometry];
  const numPositions = _sum(newGeometries.map(({positions}) => positions.length));
  const numIndices = _sum(newGeometries.map(({indices}) => indices.length));
  const positions = new Float32Array(numPositions);
  const colors = new Float32Array(numPositions);
  const indices = new Uint32Array(numIndices);
  let attributeIndex = 0;
  let indexIndex = 0;

  for (let i = 0; i < newGeometries.length; i++) {
    const newGeometry = newGeometries[i];
    const {positions: newPositions, colors: newColors, indices: newIndices} = newGeometry;
    positions.set(newPositions, attributeIndex);
    colors.set(newColors, attributeIndex);
    _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

    attributeIndex += newPositions.length;
    indexIndex += newIndices.length;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.applyMatrix(new THREE.Matrix4().makeScale(1 / resolution, 1 / resolution, 1 / resolution));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  const normals = geometry.getAttribute('normal').array;
  const {boundingBox} = geometry;

  return {
    positions: positions,
    normals: normals,
    colors: colors,
    indices: indices,
    boundingBox: [
      boundingBox.min.toArray(),
      boundingBox.max.toArray(),
    ],
  };
})();

self.onmessage = e => {
  const {data: {buffer}} = e;
  const [resultBuffer] = protocolUtils.stringifyChestChunks([chestGeometry, lidGeometry], buffer, 0);
  postMessage(resultBuffer, [resultBuffer]);
};

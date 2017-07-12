importScripts('/archae/three/three.js');
const {exports: THREE} = self.module;
self.module = {};

const indev = require('indev');
const isosurface = require('isosurface');
const {
  NUM_CELLS,
  OVERSCAN,
  NUM_CELLS_OVERSCAN,

  DEFAULT_SEED,
  ITEMS,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS = 10 * 1024;
const NUM_POSITIONS_CHUNK = 500 * 1024;

const upVector = new THREE.Vector3(0, 1, 0);

const generator = indev({
  seed: DEFAULT_SEED,
});
const elevationNoise = generator.uniform({
  frequency: 0.002,
  octaves: 8,
});

const _marchCubes = (fn, resolution) => isosurface.marchingCubes(
  [resolution, resolution, resolution],
  fn,
  [
    [-resolution / 2, -resolution / 2, -resolution / 2],
    [resolution / 2, resolution / 2, resolution / 2]
  ]
);
const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
  for (let i = 0; i < src.length; i++) {
    dst[startIndexIndex + i] = src[i] + startAttributeIndex;
  }
};

const itemsGeometries = [
  (() => { // stick
    const resolution = 12;
    const baseLine1 = new THREE.Line3(
      new THREE.Vector3(0, 0, -resolution * 0.35),
      new THREE.Vector3(-resolution * 0.05, 0, -resolution * 0.2)
    );
    const baseLine2 = new THREE.Line3(
      new THREE.Vector3(-resolution * 0.05, 0, -resolution * 0.2),
      new THREE.Vector3(resolution * 0.05, 0, resolution * 0.2)
    );
    const baseLine3 = new THREE.Line3(
      new THREE.Vector3(resolution * 0.05, 0, resolution * 0.2),
      new THREE.Vector3(0, 0, resolution * 0.35)
    );
    const {positions: positionsArray, cells: cellsArray} = _marchCubes((x, y, z) => {
      const v = new THREE.Vector3(x, y, z);
      return -(resolution / 24) +
        Math.min(
          v.distanceTo(baseLine1.closestPointToPoint(v, true)),
          v.distanceTo(baseLine2.closestPointToPoint(v, true)),
          v.distanceTo(baseLine3.closestPointToPoint(v, true))
        );
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
    geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, positions.length), 3));
    geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(colors.buffer, colors.byteOffset, colors.length), 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    geometry.applyMatrix(new THREE.Matrix4().makeScale(1 / resolution, 1 / resolution, 1 / resolution));
    geometry.computeVertexNormals();

    return geometry;
  })(),
  (() => { // rock
    const resolution = 12;
    const baseLine1 = new THREE.Line3(
      new THREE.Vector3(0, 0, -resolution * 0.15),
      new THREE.Vector3(0, 0, resolution * 0.15)
    );
    const baseLine2 = new THREE.Line3(
      new THREE.Vector3(0, 0, -resolution * 0.15),
      new THREE.Vector3(0, resolution * 0.15, 0)
    );
    const baseLine3 = new THREE.Line3(
      new THREE.Vector3(0, 0, resolution * 0.15),
      new THREE.Vector3(0, resolution * 0.15, 0)
    );
    const {positions: positionsArray, cells: cellsArray} = _marchCubes((x, y, z) => {
      const v = new THREE.Vector3(x, y, z);
      return -(resolution / 10) +
        Math.min(
          v.distanceTo(baseLine1.closestPointToPoint(v, true)),
          v.distanceTo(baseLine2.closestPointToPoint(v, true)),
          v.distanceTo(baseLine3.closestPointToPoint(v, true))
        );
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
      const y = positions[baseIndex + 1];
      const yFactor = Math.abs(y / resolution) * 2;
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
    geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, positions.length), 3));
    geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(colors.buffer, colors.byteOffset, colors.length), 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    geometry.applyMatrix(new THREE.Matrix4().makeScale(1 / resolution, 1 / resolution, 1 / resolution));
    geometry.computeVertexNormals();

    return geometry;
  })(),
  (() => { // coal
    const resolution = 12;
    const point = new THREE.Vector3(0, 0.2, 0);
    const {positions: positionsArray, cells: cellsArray} = _marchCubes((x, y, z) => {
      const v = new THREE.Vector3(x, y, z);
      return -(resolution / 12) + v.distanceTo(point);
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
    const baseColor = new THREE.Color(0x212121);
    for (let i = 0; i < numPositions; i++) {
      const baseIndex = i * 3;
      const y = positions[baseIndex + 1];
      const yFactor = Math.abs(y / resolution) + 0.5;
      const color = baseColor.clone().multiplyScalar(yFactor);
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
    geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, positions.length), 3));
    geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(colors.buffer, colors.byteOffset, colors.length), 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.applyMatrix(new THREE.Matrix4().makeScale(1 / resolution, 1 / resolution, 1 / resolution));
    geometry.computeVertexNormals();

    return geometry;
  })(),
  (() => { // iron
    const resolution = 10;
    const box = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(0, resolution/10/2, 0),
      new THREE.Vector3(resolution/2, resolution/10, resolution/2)
    );
    const line = new THREE.Line3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, resolution/8, 0)
    );
    const {positions: positionsArray, cells: cellsArray} = _marchCubes((x, y, z) => {
      if (y > 0) {
        const v = new THREE.Vector3(x, y, z);
        return -1 +
          Math.min(
            box.distanceToPoint(v),
            v.distanceTo(line.closestPointToPoint(v, true)) * Math.pow(y, 0.8) / 4,
          );
      } else {
        return 2;
      }
    }, resolution);

    const coreGeometry = (() => {
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
      const baseColor = new THREE.Color(0x808080);
      const rustColor = new THREE.Color(0xB7410E);
      const _getCachedRandom = (() => {
        let cache = {};

        return k => {
          const entry = cache[k];

          if (entry !== undefined) {
            return entry;
          } else {
            const entry = Math.random();
            cache[k] = entry;
            return entry;
          }
        };
      })();
      for (let i = 0; i < numPositions; i++) {
        const baseIndex = i * 3;
        const y = positions[baseIndex + 1];
        const yFactor = (y / resolution) + 0.5;
        const color = baseColor.clone()
          .multiplyScalar(((yFactor - 0.5) * 4))
          .lerp(rustColor, _getCachedRandom(positions[baseIndex + 0] + ':' + positions[baseIndex + 1] + ':' + positions[baseIndex + 2]) * 0.4);
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
      geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, positions.length), 3));
      geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(colors.buffer, colors.byteOffset, colors.length), 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));

      geometry
        .applyMatrix(new THREE.Matrix4().makeScale(1.5 / resolution, 1.5 / resolution, 1.5 / resolution))
        .applyMatrix(new THREE.Matrix4().makeTranslation(0, -1 / resolution, 0));
      geometry.computeVertexNormals();

      return geometry;
    })();
    return coreGeometry;
    /* const rustGeometry = (() => {
      const resolution = 12;
      const point = new THREE.Vector3(0, 0.2, 0);
      const {positions: positionsArray, cells: cellsArray} = _marchCubes((x, y, z) => {
        const v = new THREE.Vector3(x, y, z);
        return -(resolution / 12) + v.distanceTo(point);
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
      const baseColor = new THREE.Color(0xB7410E);
      for (let i = 0; i < numPositions; i++) {
        const baseIndex = i * 3;
        const y = positions[baseIndex + 1];
        const yFactor = Math.abs(y / resolution) + 0.5;
        const color = baseColor.clone().multiplyScalar(yFactor);
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
      geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, positions.length), 3));
      geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(colors.buffer, colors.byteOffset, colors.length), 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.computeVertexNormals();
      return geometry;
    })();
    const geometries = [
      coreGeometry,
      rustGeometry.clone()
        .applyMatrix(new THREE.Matrix4().makeScale(1 / resolution, 1 / resolution, 1 / resolution))
        .applyMatrix(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-Math.PI/2, 0, 0, 'YXZ')))
        .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.3, 0)),
      rustGeometry.clone()
        .applyMatrix(new THREE.Matrix4().makeScale(1 / resolution, 1 / resolution, 1 / resolution))
        .applyMatrix(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-Math.PI/2, Math.PI, 0, 'YXZ')))
        .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.2, 0.3)),
      rustGeometry.clone()
        .applyMatrix(new THREE.Matrix4().makeScale(1 / resolution, 1 / resolution, 1 / resolution))
        .applyMatrix(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-Math.PI/2, Math.PI/3, 0, 'YXZ')))
        .applyMatrix(new THREE.Matrix4().makeTranslation(-0.35, 0.2, -0.2)),
    ];

    const positions = new Float32Array(NUM_POSITIONS);
    const normals = new Float32Array(NUM_POSITIONS);
    const colors = new Float32Array(NUM_POSITIONS);
    const indices = new Uint16Array(NUM_POSITIONS);
    let attributeIndex = 0;
    let indexIndex = 0;
    for (let i = 0; i < geometries.length; i++) {
      const newGeometry = geometries[i];
      const newPositions = newGeometry.getAttribute('position').array;
      positions.set(newPositions, attributeIndex);
      const newNormals = newGeometry.getAttribute('normal').array;
      normals.set(newNormals, attributeIndex);
      const newColors = newGeometry.getAttribute('color').array;
      colors.set(newColors, attributeIndex);
      const newIndices = newGeometry.index.array;
      _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

      attributeIndex += newPositions.length;
      indexIndex += newIndices.length;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, attributeIndex), 3));
    geometry.addAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals.buffer, normals.byteOffset, attributeIndex), 3));
    geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(colors.buffer, colors.byteOffset, attributeIndex), 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices.buffer, indices.byteOffset, indexIndex), 1));
    return geometry; */
  })(),
];

const _makeItemsChunkMesh = (x, y, itemsGeometries, points, heightRange) => {
  const positions = new Float32Array(NUM_POSITIONS_CHUNK * 3);
  const normals = new Float32Array(NUM_POSITIONS_CHUNK * 3);
  const colors = new Float32Array(NUM_POSITIONS_CHUNK * 3);
  const indices = new Uint32Array(NUM_POSITIONS_CHUNK * 3);
  const items = new Float32Array(NUM_POSITIONS_CHUNK * 3);
  let attributeIndex = 0;
  let indexIndex = 0;
  let itemIndex = 0;

  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const matrix = new THREE.Matrix4();

  const itemProbability = 0.1;

  for (let dy = 0; dy < NUM_CELLS_OVERSCAN; dy++) {
    for (let dx = 0; dx < NUM_CELLS_OVERSCAN; dx++) {
      if (Math.random() < itemProbability) {
        const pointIndex = dx + (dy * NUM_CELLS_OVERSCAN);
        const elevation = points[pointIndex];

        position.set(
          (x * NUM_CELLS) + dx,
          elevation,
          (y * NUM_CELLS) + dy
        )
        quaternion.setFromAxisAngle(upVector, Math.random() * Math.PI * 2);
        matrix.compose(position, quaternion, scale);
        const typeIndex = Math.floor(Math.random() * ITEMS.length);
        const geometry = itemsGeometries[typeIndex]
          .clone()
          .applyMatrix(matrix);
        const newPositions = geometry.getAttribute('position').array;
        positions.set(newPositions, attributeIndex);
        const newNormals = geometry.getAttribute('normal').array;
        normals.set(newNormals, attributeIndex);
        const newColors = geometry.getAttribute('color').array;
        colors.set(newColors, attributeIndex);
        const newIndices = geometry.index.array;
        _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);
        const newItems = Float32Array.from([typeIndex, indexIndex, indexIndex + newIndices.length, position.x, position.y, position.z]);
        items.set(newItems, itemIndex);

        attributeIndex += newPositions.length;
        indexIndex += newIndices.length;
        itemIndex += newItems.length;
      }
    }
  }

  return {
    positions: new Float32Array(positions.buffer, positions.byteOffset, attributeIndex),
    normals: new Float32Array(normals.buffer, normals.byteOffset, attributeIndex),
    colors: new Float32Array(colors.buffer, colors.byteOffset, attributeIndex),
    indices: new Uint32Array(indices.buffer, indices.byteOffset, indexIndex),
    items: new Float32Array(items.buffer, items.byteOffset, itemIndex),
    heightRange: [
      heightRange[0],
      heightRange[1] + 1, // account for item height
    ],
  };
};
const _generateHeightfield = (ox, oy) => {
  const points = Array(NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN);
  let minHeight = Infinity;
  let maxHeight = -Infinity;

  for (let y = 0; y < NUM_CELLS_OVERSCAN; y++) {
    for (let x = 0; x < NUM_CELLS_OVERSCAN; x++) {
      const index = x + (y * NUM_CELLS_OVERSCAN);

      const dx = (ox * NUM_CELLS) - OVERSCAN + x;
      const dy = (oy * NUM_CELLS) - OVERSCAN + y;
      const elevation = (-0.3 + Math.pow(elevationNoise.in2D(dx + 1000, dy + 1000), 0.5)) * 64;

      points[index] = elevation;
      if (elevation < minHeight) {
        minHeight = elevation;
      }
      if (elevation > maxHeight) {
        maxHeight = elevation;
      }
    }
  }

  return {
    points,
    heightRange: [
      minHeight,
      maxHeight,
    ],
  };
};

self.onmessage = e => {
  const {data: {x, y, buffer}} = e;
  const mapChunk = _generateHeightfield(x, y);
  const {points, heightRange} = mapChunk;
  const itemsChunkGeometry = _makeItemsChunkMesh(x, y, itemsGeometries, points, heightRange);
  const resultBuffer = protocolUtils.stringifyItemsChunk(itemsChunkGeometry);

  postMessage(resultBuffer, [resultBuffer]);
};

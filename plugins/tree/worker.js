importScripts('/archae/three/three.js');
const {exports: THREE} = self.module;
self.module = {};

const indev = require('indev');
const {
  NUM_CELLS,
  OVERSCAN,
  NUM_CELLS_OVERSCAN,

  DEFAULT_SEED,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS = 30 * 1024;
const NUM_POSITIONS_CHUNK = 100 * 1024;
const CAMERA_ROTATION_ORDER = 'YXZ';

const upVector = new THREE.Vector3(0, 1, 0);
const sideQuaternion = new THREE.Quaternion().setFromUnitVectors(
  upVector,
  new THREE.Vector3(1, 0, 0)
);

const generator = indev({
  seed: DEFAULT_SEED,
});
const elevationNoise = generator.uniform({
  frequency: 0.002,
  octaves: 8,
});

const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
  for (let i = 0; i < src.length; i++) {
    dst[startIndexIndex + i] = src[i] + startAttributeIndex;
  }
};
const treeTemplates = (() => {
  const _makeIndexArray = n => {
    const result = new Uint16Array(n * 3 * 2);
    for (let i = 0; i < n; i++) {
      const baseIndexIndex = i * 3 * 2;
      const baseAttributeIndex = i * 3;

      // double side
      result[baseIndexIndex + 0] = baseAttributeIndex + 0;
      result[baseIndexIndex + 1] = baseAttributeIndex + 1;
      result[baseIndexIndex + 2] = baseAttributeIndex + 2;

      result[baseIndexIndex + 3] = baseAttributeIndex + 0;
      result[baseIndexIndex + 4] = baseAttributeIndex + 2;
      result[baseIndexIndex + 5] = baseAttributeIndex + 1;
    }
    return result;
  };
  const leafGeometries = [ // same for all trees
    (() => {
      const geometry = new THREE.BufferGeometry();
      const positions = Float32Array.from([
        0, 0, 0,
        -0.05, 0.1, 0,
        0.05, 0.1, 0,

        -0.05, 0.1, 0,
        0, 0.2, 0,
        0.05, 0.1, 0,
      ]);
      geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
      const lightColor = new THREE.Color(0x8BC34A);
      const darkColor = lightColor.clone().multiplyScalar(0.75);
      const colors = Float32Array.from([
        lightColor.r, lightColor.g, lightColor.b,
        darkColor.r, darkColor.g, darkColor.b,
        darkColor.r, darkColor.g, darkColor.b,

        darkColor.r, darkColor.g, darkColor.b,
        lightColor.r, lightColor.g, lightColor.b,
        darkColor.r, darkColor.g, darkColor.b,
      ]);
      geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      geometry.setIndex(new THREE.BufferAttribute(_makeIndexArray(positions.length / 9), 1));

      return geometry;
    })(),
    (() => {
      const geometry = new THREE.BufferGeometry();
      const positions = Float32Array.from([
        0, 0, -0.05,
        -0.1, 0.2, -0.05,
        0, 0.1, -0.05,

        0, 0, 0,
        0.1, 0.2, 0,
        0, 0.1, 0,
      ]);
      geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
      const lightColor = new THREE.Color(0x8BC34A);
      const darkColor = lightColor.clone().multiplyScalar(0.25);
      const colors = Float32Array.from([
        darkColor.r, darkColor.g, darkColor.b,
        lightColor.r, lightColor.g, lightColor.b,
        darkColor.r, darkColor.g, darkColor.b,

        darkColor.r, darkColor.g, darkColor.b,
        lightColor.r, lightColor.g, lightColor.b,
        darkColor.r, darkColor.g, darkColor.b,
      ]);
      geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      geometry.setIndex(new THREE.BufferAttribute(_makeIndexArray(positions.length / 9), 1));

      return geometry;
    })(),
    (() => {
      const geometry = new THREE.BufferGeometry();
      const positions = Float32Array.from([
        0, 0, -0.05,
        -0.15, 0.15, -0.05,
        0, 0.175, -0.05,

        0, 0, -0.05,
        0.15, 0.15, -0.05,
        0, 0.175, -0.05,

        -0.075, 0.075, 0,
        0, 0.275, 0,
        0.075, 0.075, 0,
      ]);
      geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
      const lightColor = new THREE.Color(0x8BC34A);
      const darkColor = lightColor.clone().multiplyScalar(0.25);
      const colors = Float32Array.from([
        darkColor.r, darkColor.g, darkColor.b,
        lightColor.r, lightColor.g, lightColor.b,
        lightColor.r, lightColor.g, lightColor.b,

        darkColor.r, darkColor.g, darkColor.b,
        lightColor.r, lightColor.g, lightColor.b,
        lightColor.r, lightColor.g, lightColor.b,

        darkColor.r, darkColor.g, darkColor.b,
        lightColor.r, lightColor.g, lightColor.b,
        darkColor.r, darkColor.g, darkColor.b,
      ]);
      geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      geometry.setIndex(new THREE.BufferAttribute(_makeIndexArray(positions.length / 9), 1));

      return geometry;
    })(),
  ];

  const trunkGeometries = [
    (() => {
      const radiusBottom = 0.3 + Math.random() * 0.3;
      const radiusTop = radiusBottom * (0.2 + (Math.random() * 0.3));
      const heightSegments = 16;
      const radialSegments = 5;
      const geometry = new THREE.CylinderBufferGeometry(radiusTop, radiusBottom, heightSegments, radialSegments, heightSegments);
      geometry.removeAttribute('normal');
      geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, heightSegments / 2, 0));
      const positions = geometry.getAttribute('position').array;

      const heightOffsets = {};
      let heightOffset = new THREE.Vector3();
      heightOffsets[0] = heightOffset;
      for (let i = 1; i <= heightSegments; i++) {
        heightOffset = heightOffset.clone()
           .multiplyScalar(0.8)
          .add(new THREE.Vector3(
            -0.6 + (Math.random() * 0.6),
            0,
            -0.6 + (Math.random() * 0.6)
          ));
        heightOffsets[i] = heightOffset;
      }

      const numPositions = positions.length / 3;
      const colors = new Float32Array(numPositions * 3);
      const baseColor = new THREE.Color(0x795548);

      for (let i = 0; i < numPositions; i++) {
        const baseIndex = i * 3;
        const y = positions[baseIndex + 1];
        const heightOffset = heightOffsets[y];
        const c = baseColor.clone().multiplyScalar(0.1 + (((y + 1) / heightSegments) * (1 - 0.1)));

        positions[baseIndex + 0] += heightOffset.x;
        // positions[baseIndex + 1] += heightOffset.y;
        positions[baseIndex + 2] += heightOffset.z;

        colors[baseIndex + 0] = c.r;
        colors[baseIndex + 1] = c.g;
        colors[baseIndex + 2] = c.b;
      }

      geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.computeVertexNormals();

      geometry.heightSegments = heightSegments;
      geometry.radialSegments = radialSegments;
      geometry.heightOffsets = heightOffsets;

      return geometry;
    })(),
  ];
  const _makeTreeBranchGeometry = heightSegments => {
    const radiusBottom = 0.1 + Math.random() * 0.1;
    const radiusTop = radiusBottom * (0.2 + (Math.random() * 0.3));
    const radialSegments = 3;
    const geometry = new THREE.CylinderBufferGeometry(radiusTop, radiusBottom, heightSegments, radialSegments, heightSegments);
    geometry.removeAttribute('normal');
    geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, heightSegments / 2, 0));
    const positions = geometry.getAttribute('position').array;

    const heightOffsets = {};
    let heightOffset = new THREE.Vector3();
    heightOffsets[0] = heightOffset;
    for (let i = 1; i <= heightSegments; i++) {
      heightOffset = heightOffset.clone()
         .multiplyScalar(0.8)
        .add(new THREE.Vector3(
          -0.6 + (Math.random() * 0.6),
          0,
          -0.6 + (Math.random() * 0.6)
        ));
      heightOffsets[i] = heightOffset;
    }

    const numPositions = positions.length / 3;
    const colors = new Float32Array(numPositions * 3);
    const baseColor = new THREE.Color(0x795548);

    for (let i = 0; i < numPositions; i++) {
      const baseIndex = i * 3;
      const y = positions[baseIndex + 1];
      const heightOffset = heightOffsets[y];
      const c = baseColor.clone().multiplyScalar(0.7 + (((y + 1) / heightSegments) * (1 - 0.7)));

      positions[baseIndex + 0] += heightOffset.x;
      // positions[baseIndex + 1] += heightOffset.y;
      positions[baseIndex + 2] += heightOffset.z;

      colors[baseIndex + 0] = c.r;
      colors[baseIndex + 1] = c.g;
      colors[baseIndex + 2] = c.b;
    }

    geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(sideQuaternion));
    geometry.computeVertexNormals();

    return geometry;
  };
  const _makeTreeBranchGeometrySize = heightSegments => {
    const numChoices = 4;
    const result = Array(numChoices);
    for (let i = 0; i < numChoices; i++) {
      result[i] = _makeTreeBranchGeometry(heightSegments);
    };
    return result;
  };
  const branchGeometrySizes = [
    _makeTreeBranchGeometrySize(4),
    _makeTreeBranchGeometrySize(5),
    _makeTreeBranchGeometrySize(6),
    _makeTreeBranchGeometrySize(7),
    _makeTreeBranchGeometrySize(8),
    _makeTreeBranchGeometrySize(9),
    _makeTreeBranchGeometrySize(10),
  ];
  const treeGeometry = (() => {
    const positions = new Float32Array(NUM_POSITIONS * 3);
    const normals = new Float32Array(NUM_POSITIONS * 3);
    const colors = new Float32Array(NUM_POSITIONS * 3);
    const indices = new Uint16Array(NUM_POSITIONS * 3);
    let attributeIndex = 0;
    let indexIndex = 0;

    const _renderTrunk = () => {
      const trunkGeometry = trunkGeometries[Math.floor(Math.random() * trunkGeometries.length)];
      const geometry = trunkGeometry;
      const newPositions = geometry.getAttribute('position').array;
      positions.set(newPositions, attributeIndex);
      const newNormals = geometry.getAttribute('normal').array;
      normals.set(newNormals, attributeIndex);
      const newColors = geometry.getAttribute('color').array;
      colors.set(newColors, attributeIndex);
      const newIndices = geometry.index.array;
      _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

      attributeIndex += newPositions.length;
      indexIndex += newIndices.length;

      return trunkGeometry;
    };
    const trunkGeometrySpec = _renderTrunk();

    const _renderBranches = trunkGeometrySpec => {
      const {heightSegments, heightOffsets} = trunkGeometrySpec;

      const branchGeometrySpec = [];
      for (let i = Math.floor(heightSegments * 0.4); i < heightSegments; i++) {
        const heightOffset = heightOffsets[i];

        const maxNumBranchesPerNode = 2;
        const optimalBranchHeight = 0.7;
        const branchWeight = 1 - Math.pow(Math.abs(i - (heightSegments * optimalBranchHeight)) / (heightSegments * optimalBranchHeight), 0.25);
        for (let j = 0; j < maxNumBranchesPerNode; j++) {
          if (Math.random() < branchWeight) {
            const branchSizeIndex = branchWeight === 1 ? (branchGeometrySizes.length - 1) : Math.floor(branchWeight * branchGeometrySizes.length);
            const branchGeometries = branchGeometrySizes[branchSizeIndex];
            const branchGeometry = branchGeometries[Math.floor(Math.random() * branchGeometries.length)];
            const geometry = branchGeometry
              .clone()
              .applyMatrix(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
                Math.random() * Math.PI / 6,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI / 6,
                CAMERA_ROTATION_ORDER
              )))
              .applyMatrix(new THREE.Matrix4().makeTranslation(
                heightOffset.x,
                i,
                heightOffset.z
              ));
            const newPositions = geometry.getAttribute('position').array;
            positions.set(newPositions, attributeIndex);
            const newNormals = geometry.getAttribute('normal').array;
            normals.set(newNormals, attributeIndex);
            const newColors = geometry.getAttribute('color').array;
            colors.set(newColors, attributeIndex);
            const newIndices = geometry.index.array;
            _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

            branchGeometrySpec.push(geometry);

            attributeIndex += newPositions.length;
            indexIndex += newIndices.length;
          }
        }
      }

      return branchGeometrySpec;
    };
    const branchGeometrySpec = _renderBranches(trunkGeometrySpec);

    const _renderLeaves = branchGeometrySpec => {
      const numLeaves = 50;
      for (let i = 0; i < numLeaves; i++) {
        const branchGeometry = branchGeometrySpec[Math.floor(Math.random() * branchGeometrySpec.length)];
        const branchPositions = branchGeometry.getAttribute('position').array;
        const branchNormals = branchGeometry.getAttribute('normal').array;
        const numPositions = branchPositions.length / 3;
        const index1 = Math.floor((1 - Math.pow(Math.random(), 0.5)) * numPositions);
        const index2 = (index1 < (numPositions - 1)) ? (index1 + 1) : (index1 - 1);
        const baseIndex1 = index1 * 3;
        const baseIndex2 = index2 * 3;
        const lerpFactor = Math.random();
        const inverseLerpFactor = 1 - lerpFactor;

        const leafGeometry = leafGeometries[Math.floor(Math.random() * leafGeometries.length)];
        const geometry = leafGeometry 
          .clone()
          .applyMatrix(new THREE.Matrix4().makeScale(
            5,
            5,
            1
          ))
          .applyMatrix(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
            Math.random() * Math.PI / 2,
            Math.random() * (Math.PI * 2),
            0,
            CAMERA_ROTATION_ORDER
          )))
          /* .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
            upVector,
            new THREE.Vector3(
              (branchNormals[baseIndex1 + 0] * lerpFactor + branchNormals[baseIndex2 + 0] * inverseLerpFactor),
              (branchNormals[baseIndex1 + 1] * lerpFactor + branchNormals[baseIndex2 + 1] * inverseLerpFactor),
              (branchNormals[baseIndex1 + 2] * lerpFactor + branchNormals[baseIndex2 + 2] * inverseLerpFactor)
            )
          ))) */
          .applyMatrix(new THREE.Matrix4().makeTranslation(
            (branchPositions[baseIndex1 + 0] * lerpFactor + branchPositions[baseIndex2 + 0] * inverseLerpFactor),
            (branchPositions[baseIndex1 + 1] * lerpFactor + branchPositions[baseIndex2 + 1] * inverseLerpFactor),
            (branchPositions[baseIndex1 + 2] * lerpFactor + branchPositions[baseIndex2 + 2] * inverseLerpFactor)
          ));

        const newPositions = geometry.getAttribute('position').array;
        positions.set(newPositions, attributeIndex);
        const newNormals = geometry.getAttribute('normal').array;
        normals.set(newNormals, attributeIndex);
        const newColors = geometry.getAttribute('color').array;
        colors.set(newColors, attributeIndex);
        const newIndices = geometry.index.array;
        _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

        attributeIndex += newPositions.length;
        indexIndex += newIndices.length;
      }
    };
    _renderLeaves(branchGeometrySpec);

    const geometry = new THREE.BufferGeometry();
    geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, attributeIndex), 3));
    geometry.addAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals.buffer, normals.byteOffset, attributeIndex), 3));
    geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(colors.buffer, colors.byteOffset, attributeIndex), 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices.buffer, indices.byteOffset, indexIndex), 1));
    return geometry;
  })();

  return treeGeometry;
})();
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

const _makeTreeChunkGeometry = (x, y, treeTemplates, points, heightRange) => {
  const positions = new Float32Array(NUM_POSITIONS_CHUNK * 3);
  // const normals = new Float32Array(NUM_POSITIONS_CHUNK * 3);
  const colors = new Float32Array(NUM_POSITIONS_CHUNK * 3);
  const indices = new Uint32Array(NUM_POSITIONS_CHUNK * 3);
  let attributeIndex = 0;
  let indexIndex = 0;

  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const matrix = new THREE.Matrix4();

  const treeProbability = 0.025;
  let treeIndex = 0;

  for (let dy = 0; dy < NUM_CELLS_OVERSCAN; dy++) {
    for (let dx = 0; dx < NUM_CELLS_OVERSCAN; dx++) {
      if (Math.random() < treeProbability) {
        const pointIndex = dx + (dy * NUM_CELLS_OVERSCAN);
        const elevation = points[pointIndex];
        position.set(
          (x * NUM_CELLS) + dx,
          elevation,
          (y * NUM_CELLS) + dy
        );
        quaternion.setFromAxisAngle(upVector, Math.random() * Math.PI * 2);
        matrix.compose(position, quaternion, scale);
        const geometry = treeTemplates
          .clone()
          .applyMatrix(matrix);
        const newPositions = geometry.getAttribute('position').array;
        positions.set(newPositions, attributeIndex);
        const newColors = geometry.getAttribute('color').array;
        colors.set(newColors, attributeIndex);
        const newIndices = geometry.index.array;
        _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

        attributeIndex += newPositions.length;
        indexIndex += newIndices.length;
      }
    }
  }

  return {
    positions: new Float32Array(positions.buffer, positions.byteOffset, attributeIndex),
    colors: new Float32Array(colors.buffer, colors.byteOffset, attributeIndex),
    indices: new Uint32Array(indices.buffer, indices.byteOffset, indexIndex),
    heightRange: [
      heightRange[0],
      heightRange[1] + 20, // account for tree height
    ],
  };
};

self.onmessage = e => {
  const {data: {x, y, buffer}} = e;
  const mapChunk = _generateHeightfield(x, y);
  const {points, heightRange} = mapChunk;
  const treeChunkGeometry = _makeTreeChunkGeometry(x, y, treeTemplates, points, heightRange);
  const resultBuffer = protocolUtils.stringifyTreeGeometry(treeChunkGeometry);

  postMessage(resultBuffer, [resultBuffer]);
};

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
const TEXTURE_SIZE = 1024;
const TEXTURE_CHUNK_SIZE = 512;
const NUM_TEXTURE_CHUNKS_WIDTH = TEXTURE_SIZE / TEXTURE_CHUNK_SIZE;

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

class Box {
  constructor(min, max) {
    this.min = min;
    this.max = max;
  }
}
class Triangle {
  constructor(a, b, c) {
    this.a = a;
    this.b = b;
    this.c = c;
  }
}

const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
  for (let i = 0; i < src.length; i++) {
    dst[startIndexIndex + i] = src[i] + startAttributeIndex;
  }
};

const baseLeafColor = new THREE.Color(0x8BC34A);
const baseTrunkColor = new THREE.Color(0x795548);
const lightTrunkColor = new THREE.Color(0x5D4037);
const _isPointInBox = (p, b) => p.x >= b.min.x && p.x < b.max.x && p.y >= b.min.y && p.y < b.max.y;
const _isPointInBoxes = (p, bs) => {
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i];
    if (_isPointInBox(p, b)) {
      return true;
    }
  }
  return false;
};
const _isPointInTriangle = (p, tri) => {
  const {a: p0, b: p1, c: p2} = tri;
  const A = 1/2 * (-p1.y * p2.x + p0.y * (-p1.x + p2.x) + p0.x * (p1.y - p2.y) + p1.x * p2.y);
  const sign = A < 0 ? -1 : 1;
  const s = (p0.y * p2.x - p0.x * p2.y + (p2.y - p0.y) * p.x + (p0.x - p2.x) * p.y) * sign;
  const t = (p0.x * p1.y - p0.y * p1.x + (p0.y - p1.y) * p.x + (p1.x - p0.x) * p.y) * sign;

  return s > 0 && t > 0 && (s + t) < 2 * A * sign;
};
const _isPointInTriangles = (p, ts) => {
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    if (_isPointInTriangle(p, t)) {
      return true;
    }
  }
  return false;
};
const treeTextureAtlas = (() => {
  const transparentColorArray = Uint8Array.from([0, 0, 0, 0]);

  const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
  for (let y = 0; y < NUM_TEXTURE_CHUNKS_WIDTH; y++) {
    for (let x = 0; x < NUM_TEXTURE_CHUNKS_WIDTH; x++) {
      if (x === 0) { // trunk
        const numBoxes = Math.floor(50 + Math.random() * 50);
        const boxes = Array(numBoxes);
        for (let i = 0; i < numBoxes; i++) {
          const min = new THREE.Vector2(Math.random(), Math.random());
          const max = min.clone().add(new THREE.Vector2(Math.random() * 0.02, Math.random() * 0.04));
          const box = new Box(min, max);
          boxes[i] = box;
        }

        for (let dy = 0; dy < TEXTURE_CHUNK_SIZE; dy++) {
          for (let dx = 0; dx < TEXTURE_CHUNK_SIZE; dx++) {
            const ax = (x * TEXTURE_CHUNK_SIZE) + dx;
            const ay = (y * TEXTURE_CHUNK_SIZE) + dy;
            const baseIndex = (ax + (ay * TEXTURE_SIZE)) * 4;

            data.set(
              Uint8Array.from(
                (_isPointInBoxes(
                  new THREE.Vector2(dx / TEXTURE_CHUNK_SIZE, 1 - (dy / TEXTURE_CHUNK_SIZE)),
                  boxes
                ) ? lightTrunkColor.clone() : baseTrunkColor.clone().multiplyScalar(0.2 + ((1 - (dy / TEXTURE_CHUNK_SIZE)) * 0.8)))
                  .toArray()
                  .concat([1])
                  .map(v => Math.floor(v * 255))
              ),
              baseIndex,
              4
            );
          }
        }
      } else { // leaf
        const numBlades = Math.floor(5 + (Math.random() * 5));
        const numTrianglesPerBlade = 5;
        const numTriangles = numBlades * numTrianglesPerBlade;
        const triangles = [];
        for (let i = 0; i < numBlades; i++) {
          const type = Math.floor(Math.random() * (2 + 1));
          const w = (() => {
            switch (type) {
              case 0: return 0.05;
              case 1: return 0.1;
              case 2: return 0.15;
            }
          })();
          const h = (() => {
            switch (type) {
              case 0: return 0.2;
              case 1: return 0.2;
              case 2: return 0.275;
            }
          })();
          const ox = Math.random() * (1 - w);
          const sy = (1 / h) * (0.25 + Math.random() * 0.75);
          const points = (() => {
            switch (type) {
              case 0: {
                return [
                  new THREE.Vector2(0, 0),
                  new THREE.Vector2(-0.05, 0.1),
                  new THREE.Vector2(0.05, 0.1),

                  new THREE.Vector2(-0.05, 0.1),
                  new THREE.Vector2(0, 0.2),
                  new THREE.Vector2(0.05, 0.1),
                ];
              }
              case 1: {
                return [
                  new THREE.Vector2(0, 0),
                  new THREE.Vector2(-0.1, 0.2),
                  new THREE.Vector2(0, 0.1),

                  new THREE.Vector2(0, 0),
                  new THREE.Vector2(0.1, 0.2),
                  new THREE.Vector2(0, 0.1),
                ];
              }
              case 2: {
                return [
                  new THREE.Vector2(0, 0),
                  new THREE.Vector2(-0.15, 0.15),
                  new THREE.Vector2(0, 0.175),

                  new THREE.Vector2(0, 0),
                  new THREE.Vector2(0.15, 0.15),
                  new THREE.Vector2(0, 0.175),

                  new THREE.Vector2(-0.075, 0.075),
                  new THREE.Vector2(0, 0.275),
                  new THREE.Vector2(0.075, 0.075),
                ];
              }
            }
          })().map(v => v
            .multiply(new THREE.Vector2(1, sy))
            .add(new THREE.Vector2(ox, 0))
          );

          const numTriangles = points.length / 3;
          for (let j = 0; j < numTriangles; j++) {
            const baseIndex = j * 3;
            const triangle = new Triangle(
              points[baseIndex + 0],
              points[baseIndex + 1],
              points[baseIndex + 2]
            );
            triangles.push(triangle);
          }
        }

        for (let dy = 0; dy < TEXTURE_CHUNK_SIZE; dy++) {
          for (let dx = 0; dx < TEXTURE_CHUNK_SIZE; dx++) {
            const ax = (x * TEXTURE_CHUNK_SIZE) + dx;
            const ay = (y * TEXTURE_CHUNK_SIZE) + dy;
            const baseIndex = (ax + (ay * TEXTURE_SIZE)) * 4;

            data.set(
              _isPointInTriangles(
                new THREE.Vector2(dx / TEXTURE_CHUNK_SIZE, 1 - (dy / TEXTURE_CHUNK_SIZE)),
                triangles
              ) ? Uint8Array.from(
                baseLeafColor.clone()
                  .multiplyScalar(0.3 + ((1 - (dy / TEXTURE_CHUNK_SIZE)) * 1))
                .toArray()
                .concat([1])
                .map(v => Math.floor(v * 255))
              ) : transparentColorArray,
              baseIndex,
              4
            );
          }
        }
      }
    }
  }
  return data;
})();
const treeTemplates = (() => {
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
      const uvs = geometry.getAttribute('uv').array;

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
      const tx = 0; // 0 is trunk textures
      const ty = Math.floor(Math.random() * NUM_TEXTURE_CHUNKS_WIDTH);
      for (let i = 0; i < numPositions; i++) {
        const baseIndex3 = i * 3;
        const y = positions[baseIndex3 + 1];
        const heightOffset = heightOffsets[y];

        positions[baseIndex3 + 0] += heightOffset.x;
        // positions[baseIndex + 1] += heightOffset.y;
        positions[baseIndex3 + 2] += heightOffset.z;

        const baseIndex2 = i * 2;
        uvs[baseIndex2 + 0] = ((tx + (0.02 + uvs[baseIndex2 + 0] * 0.96)) / NUM_TEXTURE_CHUNKS_WIDTH);
        uvs[baseIndex2 + 1] = 1 - ((tx + (1 - (0.02 + uvs[baseIndex2 + 1] * 0.96))) / NUM_TEXTURE_CHUNKS_WIDTH);
      }

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
    const uvs = geometry.getAttribute('uv').array;

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
    const tx = 0; // 0 is trunk textures
    const ty = Math.floor(Math.random() * NUM_TEXTURE_CHUNKS_WIDTH);
    for (let i = 0; i < numPositions; i++) {
      const baseIndex3 = i * 3;
      const y = positions[baseIndex3 + 1];
      const heightOffset = heightOffsets[y];

      positions[baseIndex3 + 0] += heightOffset.x;
      // positions[baseIndex + 1] += heightOffset.y;
      positions[baseIndex3 + 2] += heightOffset.z;

      const baseIndex2 = i * 2;
      uvs[baseIndex2 + 0] = ((tx + (0.02 + uvs[baseIndex2 + 0] * 0.96)) / NUM_TEXTURE_CHUNKS_WIDTH);
      uvs[baseIndex2 + 1] = 1 - ((tx + (1 - (0.02 + uvs[baseIndex2 + 1] * 0.96))) / NUM_TEXTURE_CHUNKS_WIDTH);
    }

    geometry.applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(sideQuaternion));

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
    const uvs = new Float32Array(NUM_POSITIONS * 2);
    const indices = new Uint16Array(NUM_POSITIONS);
    let attributeIndex = 0;
    let uvIndex = 0;
    let indexIndex = 0;

    const _renderTrunk = () => {
      const trunkGeometry = trunkGeometries[Math.floor(Math.random() * trunkGeometries.length)];
      const geometry = trunkGeometry;
      const newPositions = geometry.getAttribute('position').array;
      positions.set(newPositions, attributeIndex);
      const newUvs = geometry.getAttribute('uv').array;
      uvs.set(newUvs, uvIndex);
      const newIndices = geometry.index.array;
      _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

      attributeIndex += newPositions.length;
      uvIndex += newUvs.length;
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
            const newUvs = geometry.getAttribute('uv').array;
            uvs.set(newUvs, uvIndex);
            const newIndices = geometry.index.array;
            _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

            branchGeometrySpec.push(geometry);

            attributeIndex += newPositions.length;
            uvIndex += newUvs.length;
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
        // const branchNormals = branchGeometry.getAttribute('normal').array;
        const numPositions = branchPositions.length / 3;
        // const index1 = Math.floor((1 - Math.pow(Math.random(), 0.5)) * numPositions);
        const index1 = Math.floor(Math.random() * numPositions);
        const index2 = (index1 < (numPositions - 1)) ? (index1 + 1) : (index1 - 1); // XXX bugfix this to scan to a position with a different y
        const baseIndex1 = index1 * 3;
        const baseIndex2 = index2 * 3;
        const lerpFactor = Math.random();
        const inverseLerpFactor = 1 - lerpFactor;

        const geometry = new THREE.PlaneBufferGeometry(1, 1)
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, 1 / 2, 0))
          .applyMatrix(new THREE.Matrix4().makeScale(
            3,
            3,
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
        const newUvs = geometry.getAttribute('uv').array;
        const numNewUvs = newUvs.length / 2;
        const tx = Math.floor(1 + (Math.random() * (NUM_TEXTURE_CHUNKS_WIDTH - 1))); // 0 is trunk textures
        const ty = Math.floor(Math.random() * NUM_TEXTURE_CHUNKS_WIDTH);
        for (let j = 0; j < numNewUvs; j++) {
          const baseIndex = j * 2;
          newUvs[baseIndex + 0] = ((tx + (0.02 + newUvs[baseIndex + 0] * 0.96)) / NUM_TEXTURE_CHUNKS_WIDTH);
          newUvs[baseIndex + 1] = 1 - ((tx + (1 - (0.02 + newUvs[baseIndex + 1] * 0.96))) / NUM_TEXTURE_CHUNKS_WIDTH);
        }
        uvs.set(newUvs, uvIndex);
        const newIndices = geometry.index.array;
        _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

        attributeIndex += newPositions.length;
        uvIndex += newUvs.length;
        indexIndex += newIndices.length;
      }
    };
    _renderLeaves(branchGeometrySpec);

    const geometry = new THREE.BufferGeometry();
    geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, attributeIndex), 3));
    geometry.addAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs.buffer, uvs.byteOffset, uvIndex), 2));
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
  const uvs = new Float32Array(NUM_POSITIONS_CHUNK * 2);
  const indices = new Uint32Array(NUM_POSITIONS_CHUNK);
  const trees = new Float32Array(NUM_POSITIONS_CHUNK);
  let attributeIndex = 0;
  let uvIndex = 0;
  let indexIndex = 0;
  let treeIndex = 0;

  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const matrix = new THREE.Matrix4();

  const treeProbability = 0.025;

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
        const newUvs = geometry.getAttribute('uv').array;
        uvs.set(newUvs, uvIndex);
        const newIndices = geometry.index.array;
        _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);
        const newTrees = Float32Array.from([indexIndex, indexIndex + newIndices.length, position.x, position.y, position.z]);
        trees.set(newTrees, treeIndex);

        attributeIndex += newPositions.length;
        uvIndex += newUvs.length;
        indexIndex += newIndices.length;
        treeIndex += newTrees.length;
      }
    }
  }

  return {
    positions: new Float32Array(positions.buffer, positions.byteOffset, attributeIndex),
    uvs: new Float32Array(uvs.buffer, uvs.byteOffset, uvIndex),
    indices: new Uint32Array(indices.buffer, indices.byteOffset, indexIndex),
    trees: new Float32Array(trees.buffer, trees.byteOffset, treeIndex),
    heightRange: [
      heightRange[0],
      heightRange[1] + 20, // account for tree height
    ],
  };
};

self.onmessage = e => {
  const {data} = e;
  const {type} = data;

  if (type === 'chunk') {
    const {x, y, buffer} = data;
    const mapChunk = _generateHeightfield(x, y);
    const {points, heightRange} = mapChunk;
    const treeChunkGeometry = _makeTreeChunkGeometry(x, y, treeTemplates, points, heightRange);
    const resultBuffer = protocolUtils.stringifyTreeGeometry(treeChunkGeometry);

    postMessage(resultBuffer, [resultBuffer]);
  } else {
    const {buffer} = data;
    new Uint8Array(buffer).set(treeTextureAtlas);

    postMessage(buffer, [buffer]);
  }
};

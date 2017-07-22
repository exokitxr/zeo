importScripts('/archae/three/three.js');
const {exports: THREE} = self.module;
self.module = {};

const murmur = require('murmurhash');
const alea = require('alea');
const indev = require('indev');
const {
  NUM_CELLS,
  OVERSCAN,
  NUM_CELLS_OVERSCAN,

  DEFAULT_SEED,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS = 20 * 1024;
const NUM_POSITIONS_CHUNK = 100 * 1024;
const TEXTURE_SIZE = 1024;
const TEXTURE_CHUNK_SIZE = 512;
const NUM_TEXTURE_CHUNKS_WIDTH = TEXTURE_SIZE / TEXTURE_CHUNK_SIZE;

const upVector = new THREE.Vector3(0, 1, 0);

const rng = new alea(DEFAULT_SEED);
const generator = indev({
  seed: DEFAULT_SEED,
});
const elevationNoise = generator.uniform({
  frequency: 0.002,
  octaves: 8,
});
const grassNoise = generator.uniform({
  frequency: 0.1,
  octaves: 4,
});

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

const baseColor = new THREE.Color(0x8db360);
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
const grassTextureAtlas = (() => {
  const transparentColorArray = Uint8Array.from([0, 0, 0, 0]);

  const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
  for (let y = 0; y < NUM_TEXTURE_CHUNKS_WIDTH; y++) {
    for (let x = 0; x < NUM_TEXTURE_CHUNKS_WIDTH; x++) {
      const numBlades = Math.floor(5 + (rng() * 5));
      const numTrianglesPerBlade = 5;
      const numTriangles = numBlades * numTrianglesPerBlade;
      const triangles = Array(numTriangles);
      for (let i = 0; i < numBlades; i++) {
        const type = rng() < 0.5 ? -1 : 0;
        const flip = rng() < 0.5 ? -1 : 1;
        const w = (type === -1) ? 0.3 : 0.4;
        const h = type === -1 ? 0.6 : 0.25;
        const ox = (rng() * (1 - w)) + (flip === -1 ? w : 0);
        const sy = (1 / h) * (0.25 + rng() * 0.75);
        const points = (type === -1 ? [
          new THREE.Vector2(0, 0),
          new THREE.Vector2(0.1, 0),
          new THREE.Vector2(0.05, 0.2),
          new THREE.Vector2(0.15, 0.2),
          new THREE.Vector2(0.125, 0.4),
          new THREE.Vector2(0.2, 0.4),
          new THREE.Vector2(0.3, 0.6),
        ] : [
          new THREE.Vector2(0, 0.2),
          new THREE.Vector2(0.125, 0.125),
          new THREE.Vector2(0.1, 0),
          new THREE.Vector2(0.2, 0),
          new THREE.Vector2(0.2, 0.13),
          new THREE.Vector2(0.3, 0.13),
          new THREE.Vector2(0.4, 0.25),
        ]).map(v => v
          .multiply(new THREE.Vector2(flip, sy))
          .add(new THREE.Vector2(ox, 0))
        );

        for (let j = 0; j < numTrianglesPerBlade; j++) {
          const triangle = new Triangle(
            points[j + 0],
            points[j + 1],
            points[j + 2]
          );
          triangles[i * numTrianglesPerBlade + j] = triangle;
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
              baseColor.clone()
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
  return data;
})();
const _makeGrassTemplate = () => {
  const numGrasses = Math.floor(4 + rng() * 4);
  const positions = new Float32Array(NUM_POSITIONS * 3);
  const uvs = new Float32Array(NUM_POSITIONS * 2);
  const indices = new Uint16Array(NUM_POSITIONS);
  let attributeIndex = 0;
  let uvIndex = 0;
  let indexIndex = 0;

  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const matrix = new THREE.Matrix4();

  for (let i = 0; i < numGrasses; i++) {
    position.set(-0.5 + rng(), 0, -0.5 + rng())
      .normalize()
      .multiplyScalar(rng() * 1)
      .add(new THREE.Vector3(0, 0.5, 0));
    quaternion.setFromAxisAngle(upVector, rng() * Math.PI * 2);
    // scale.set(5 + (rng() * 5), 5 + rng() * 10, 5 + (rng() * 5));
    matrix.compose(position, quaternion, scale);
    const geometry = new THREE.PlaneBufferGeometry(1, 1)
      .applyMatrix(matrix);
    const newPositions = geometry.getAttribute('position').array;
    positions.set(newPositions, attributeIndex);
    const newUvs = geometry.getAttribute('uv').array;
    const numNewUvs = newUvs.length / 2;
    const tx = Math.floor(rng() * NUM_TEXTURE_CHUNKS_WIDTH);
    const ty = Math.floor(rng() * NUM_TEXTURE_CHUNKS_WIDTH);
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

  const geometry = new THREE.BufferGeometry();
  geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, attributeIndex), 3));
  geometry.addAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs.buffer, uvs.byteOffset, uvIndex), 2));
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices.buffer, indices.byteOffset, indexIndex), 1));

  return geometry;
};
const grassTemplates = (() => {
  const numGrassTemplates = 8;
  const result = Array(numGrassTemplates);
  for (let i = 0; i < numGrassTemplates; i++) {
    result[i] = _makeGrassTemplate();
  }
  return result;
})();
const _makeGrassChunkMesh = (ox, oy, grassTemplates, points, heightRange) => {
  const positions = new Float32Array(NUM_POSITIONS_CHUNK * 3);
  const uvs = new Float32Array(NUM_POSITIONS_CHUNK * 2);
  const indices = new Uint16Array(NUM_POSITIONS_CHUNK);
  let attributeIndex = 0;
  let uvIndex = 0;
  let indexIndex = 0;

  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4();

  const grassProbability = 0.2;

  for (let dy = 0; dy < NUM_CELLS_OVERSCAN; dy++) {
    for (let dx = 0; dx < NUM_CELLS_OVERSCAN; dx++) {
      const ax = (ox * NUM_CELLS) + dx;
      const ay = (oy * NUM_CELLS) + dy;
      const v = grassNoise.in2D(ax + 1000, ay + 1000);

      if (v < grassProbability) {
        const pointIndex = dx + (dy * NUM_CELLS_OVERSCAN);
        const elevation = points[pointIndex];

        position.set(
          ax,
          elevation,
          ay
        );
        const n = murmur(String(v)) / 0xFFFFFFFF;
        quaternion.setFromAxisAngle(upVector, n * Math.PI * 2);
        matrix.compose(position, quaternion, scale);
        scale.set(1, 0.5 + rng() * 1, 1);
        const grassGeometry = grassTemplates[Math.floor(n * grassTemplates.length)];
        const geometry = grassGeometry
          .clone()
          .applyMatrix(matrix);
        const newPositions = geometry.getAttribute('position').array;
        positions.set(newPositions, attributeIndex);
        const newUvs = geometry.getAttribute('uv').array;
        uvs.set(newUvs, uvIndex);
        const newIndices = geometry.index.array;
        _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

        attributeIndex += newPositions.length;
        uvIndex += newUvs.length;
        indexIndex += newIndices.length;
      }
    }
  }

  return {
    positions: new Float32Array(positions.buffer, positions.byteOffset, attributeIndex),
    uvs: new Float32Array(uvs.buffer, uvs.byteOffset, uvIndex),
    indices: new Uint16Array(indices.buffer, indices.byteOffset, indexIndex),
    heightRange: [
      heightRange[0],
      heightRange[1] + 1, // account for grass height
    ],
  };
};
const _generateHeightfield = (ox, oy) => {
  const points = Array(NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN);
  let minHeight = Infinity;
  let maxHeight = -Infinity;

  for (let dy = 0; dy < NUM_CELLS_OVERSCAN; dy++) {
    for (let dx = 0; dx < NUM_CELLS_OVERSCAN; dx++) {
      const index = dx + (dy * NUM_CELLS_OVERSCAN);

      const ax = (ox * NUM_CELLS) + dx;
      const ay = (oy * NUM_CELLS) + dy;
      const elevation = (-0.3 + Math.pow(elevationNoise.in2D(ax + 1000, ay + 1000), 0.5)) * 64;

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
  const {data} = e;
  const {type} = data;

  if (type === 'chunk') {
    const {x, y, buffer} = data;
    const mapChunk = _generateHeightfield(x, y);
    const {points, heightRange} = mapChunk;
    const grassChunkGeometry = _makeGrassChunkMesh(x, y, grassTemplates, points, heightRange);
    const resultBuffer = protocolUtils.stringifyGrassGeometry(grassChunkGeometry);

    postMessage(resultBuffer, [resultBuffer]);
  } else if (type === 'texture') {
    const {buffer} = data;
    new Uint8Array(buffer).set(grassTextureAtlas);

    postMessage(buffer, [buffer]);
  }
};

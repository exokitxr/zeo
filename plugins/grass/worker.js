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

const NUM_POSITIONS = 20 * 1024;
const NUM_POSITIONS_CHUNK = 100 * 1024;
const TEXTURE_SIZE = 512;
const TEXTURE_CHUNK_SIZE = 32;
const NUM_TEXTURE_CHUNKS_WIDTH = TEXTURE_SIZE / TEXTURE_CHUNK_SIZE;

const upVector = new THREE.Vector3(0, 1, 0);

const generator = indev({
  seed: DEFAULT_SEED,
});
const elevationNoise = generator.uniform({
  frequency: 0.002,
  octaves: 8,
});

class Triangle {
  constructor(a, b, c) {
    this.a = a;
    this.b = b;
    this.c = c;
  }
}

const baseColor = new THREE.Color(0x8db360);
const grassColors = (() => {
  const result = new Float32Array(9 * 3);
  const baseColor = new THREE.Color(0x8db360);
  for (let i = 0 ; i < 9; i++) {
    const c = baseColor.clone().multiplyScalar(0.1 + (((i + 1) / 9) * 0.9));
    result[(i * 3) + 0] = c.r;
    result[(i * 3) + 1] = c.g;
    result[(i * 3) + 2] = c.b;
  }
  return result;
})();
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
  const baseColorArray = Uint8Array.from(baseColor.toArray().concat([1]).map(v => Math.floor(v * 255)));
  const transparentColorArray = Uint8Array.from([255, 255, 255, 0]);

  const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
  for (let y = 0; y < NUM_TEXTURE_CHUNKS_WIDTH; y++) {
    for (let x = 0; x < NUM_TEXTURE_CHUNKS_WIDTH; x++) {
      const numBlades = Math.floor(3 + (Math.random() * 4));
      const numTrianglesPerBlade = 5;
      const numTriangles = numBlades * numTrianglesPerBlade;
      const triangles = Array(numTriangles);
      for (let i = 0; i < numBlades; i++) {
        const type = Math.random() < 0.5 ? -1 : 0;
        const flip = Math.random() < 0.5 ? -1 : 1;
        const w = (type === -1) ? 0.3 : 0.4;
        const h = type === -1 ? 0.6 : 0.25;
        const ox = (Math.random() * (1 - w)) + (flip === -1 ? w : 0);
        const sy = (1 / h) * (0.25 + Math.random() * 0.75);
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
            points[j + 2],
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
            ) ? Float32Array.from(
              baseColor.clone()
                .multiplyScalar(0.4 + ((1 - (dy / TEXTURE_CHUNK_SIZE)) * 0.8))
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
const grassGeometries = [
  (() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(9 * 3);

    positions[0] = 0;
    positions[1] = 0;
    positions[2] = 0;

    positions[3] = 0;
    positions[4] = 0;
    positions[5] = 0;

    positions[6] = 0.01;
    positions[7] = 0;
    positions[8] = 0;

    positions[9] = 0.005;
    positions[10] = 0.02;
    positions[11] = 0;

    positions[12] = 0.015;
    positions[13] = 0.02;
    positions[14] = 0;

    positions[15] = 0.0125;
    positions[16] = 0.04;
    positions[17] = 0;

    positions[18] = 0.02;
    positions[19] = 0.04;
    positions[20] = 0;

    positions[21] = 0.03;
    positions[22] = 0.06;
    positions[23] = 0;

    positions[24] = 0.03;
    positions[25] = 0.06;
    positions[26] = 0;

    geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.addAttribute('color', new THREE.BufferAttribute(grassColors, 3));

    return geometry;
  })(),
  (() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(9 * 3);

    positions[0] = 0;
    positions[1] = 0.02;
    positions[2] = 0;

    positions[3] = 0;
    positions[4] = 0.02;
    positions[5] = 0;

    positions[6] = 0.0125;
    positions[7] = 0.0125;
    positions[8] = 0;

    positions[9] = 0.01;
    positions[10] = 0;
    positions[11] = -0.001;

    positions[12] = 0.02;
    positions[13] = 0;
    positions[14] = 0;

    positions[15] = 0.02;
    positions[16] = 0.015;
    positions[17] = 0;

    positions[18] = 0.03;
    positions[19] = 0.015;
    positions[20] = 0;

    positions[21] = 0.04;
    positions[22] = 0.025;
    positions[23] = 0;

    positions[24] = 0.04;
    positions[25] = 0.025;
    positions[26] = 0;

    geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.addAttribute('color', new THREE.BufferAttribute(grassColors, 3));

    return geometry;
  })(),
];

const grassTemplates = (() => {
  const numGrassesPerPatch = 30 / 3;
  const positions = new Float32Array(numGrassesPerPatch * 9 * 3);
  const colors = new Float32Array(numGrassesPerPatch * 9 * 3);
  let attributeIndex = 0;

  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4();

  for (let i = 0; i < numGrassesPerPatch; i++) {
    const baseIndex = (i * 9 * 3);
    position.set(-0.5 + Math.random(), 0, -0.5 + Math.random()).normalize().multiplyScalar(Math.random() * 1);
    quaternion.setFromAxisAngle(upVector, Math.random() * Math.PI * 2);
    scale.set(5 + (Math.random() * 5), 5 + Math.random() * 10, 5 + (Math.random() * 5));
    matrix.compose(position, quaternion, scale);
    const geometry = grassGeometries[Math.floor(Math.random() * grassGeometries.length)]
      .clone()
      .applyMatrix(matrix);
    const newPositions = geometry.getAttribute('position').array;
    positions.set(newPositions, baseIndex);
    const newColors = geometry.getAttribute('color').array;
    colors.set(newColors, baseIndex);

    attributeIndex += newPositions.length;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, attributeIndex), 3));
  geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(colors.buffer, colors.byteOffset, attributeIndex), 3));

  return geometry;
})();
const _makeGrassChunkMesh = (x, y, grassGeometry, points, heightRange) => {
  const positions = new Float32Array(NUM_POSITIONS_CHUNK * 3);
  const colors = new Float32Array(NUM_POSITIONS_CHUNK * 3);
  let attributeIndex = 0;

  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const matrix = new THREE.Matrix4();

  const grassProbability = 0.1;

  for (let dy = 0; dy < NUM_CELLS_OVERSCAN; dy++) {
    for (let dx = 0; dx < NUM_CELLS_OVERSCAN; dx++) {
      if (Math.random() < grassProbability) {
        const pointIndex = dx + (dy * NUM_CELLS_OVERSCAN);
        const elevation = points[pointIndex];

        position.set(
          (x * NUM_CELLS) + dx,
          elevation,
          (y * NUM_CELLS) + dy
        )
        quaternion.setFromAxisAngle(upVector, Math.random() * Math.PI * 2);
        matrix.compose(position, quaternion, scale);
        const geometry = grassGeometry
          .clone()
          .applyMatrix(matrix);
        const newPositions = geometry.getAttribute('position').array;
        positions.set(newPositions, attributeIndex);
        const newColors = geometry.getAttribute('color').array;
        colors.set(newColors, attributeIndex);

        attributeIndex += newPositions.length;
      }
    }
  }

  return {
    positions: new Float32Array(positions.buffer, positions.byteOffset, attributeIndex),
    colors: new Float32Array(colors.buffer, colors.byteOffset, attributeIndex),
    textureAtlas: grassTextureAtlas,
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
  const grassChunkGeometry = _makeGrassChunkMesh(x, y, grassTemplates, points, heightRange);
  const resultBuffer = protocolUtils.stringifyGrassGeometry(grassChunkGeometry);

  postMessage(resultBuffer, [resultBuffer]);
};

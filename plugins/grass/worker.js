importScripts('/archae/assets/three.js');
const {exports: THREE} = self.module;
importScripts('/archae/assets/murmurhash.js');
const {exports: murmur} = self.module;
importScripts('/archae/assets/alea.js');
const {exports: alea} = self.module;
importScripts('/archae/assets/indev.js');
const {exports: indev} = self.module;
self.module = {};

const {
  NUM_CELLS,
  OVERSCAN,
  NUM_CELLS_OVERSCAN,

  NUM_CHUNKS_HEIGHT,
  NUM_RENDER_GROUPS,

  DEFAULT_SEED,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS_CHUNK = 200 * 1024;
const LIGHTMAP_BUFFER_SIZE = 100 * 1024 * 4;
const TEXTURE_SIZE = 1024;
const TEXTURE_CHUNK_SIZE = 512;
const NUM_TEXTURE_CHUNKS_WIDTH = TEXTURE_SIZE / TEXTURE_CHUNK_SIZE;
const HEIGHTFIELD_DEPTH = 8;

const upVector = new THREE.Vector3(0, 1, 0);

const rng = new alea(DEFAULT_SEED);
const generator = indev({
  seed: DEFAULT_SEED,
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

const baseColor = new THREE.Color(0x8BC34A);
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
  const positions = new Float32Array(NUM_POSITIONS_CHUNK);
  const uvs = new Float32Array(NUM_POSITIONS_CHUNK);
  const indices = new Uint16Array(NUM_POSITIONS_CHUNK);
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

const _resArrayBuffer = res => {
  if (res.status >= 200 && res.status < 300) {
    return res.arrayBuffer();
  } else {
    return Promise.reject({
      status: res.status,
      stack: 'API returned invalid status code: ' + res.status,
    });
  }
};
function mod(value, divisor) {
  var n = value % divisor;
  return n < 0 ? (divisor + n) : n;
}
const _getChunkIndex = (x, z) => (mod(x, 0xFFFF) << 16) | mod(z, 0xFFFF);

const localMatrix = new THREE.Matrix4();
const localMatrix2 = new THREE.Matrix4();
const localFrustum = new THREE.Frustum();

const _requestHeightfield = (x, y, buffer, cb) => {
  const id = _makeId();
  postMessage({
    type: 'request',
    method: 'heightfield',
    args: [id, x, y],
    buffer,
  }, [buffer]);
  queues[id] = cb;
};

const grassChunkMeshes = {};

let queues = {};
let numRemovedQueues = 0;
const _cleanupQueues = () => {
  if (++numRemovedQueues >= 16) {
    const newQueues = {};
    for (const id in queues) {
      const entry = queues[id];
      if (entry !== null) {
        newQueues[id] = entry;
      }
    }
    queues = newQueues;
    numRemovedQueues = 0;
  }
};
const _makeGrassChunkMesh = (ox, oy, grassTemplates, heightfield) => {
  const positions = new Float32Array(NUM_POSITIONS_CHUNK);
  const uvs = new Float32Array(NUM_POSITIONS_CHUNK);
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
        const elevation = heightfield[(dx + (dy * NUM_CELLS_OVERSCAN)) * HEIGHTFIELD_DEPTH];

        if (elevation > 64) {
          position.set(
            ax,
            elevation,
            ay
          );
          quaternion.setFromAxisAngle(upVector, murmur(v + ':angle') / 0xFFFFFFFF * Math.PI * 2);
          matrix.compose(position, quaternion, scale);
          scale.set(1, 0.5 + murmur(v + ':scale') / 0xFFFFFFFF, 1);
          const grassGeometry = grassTemplates[Math.floor(murmur(v + ':template') / 0xFFFFFFFF * grassTemplates.length)];
          const geometry = grassGeometry.clone()
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
  }

  const geometry = new THREE.BufferGeometry();
  geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, attributeIndex), 3));
  geometry.computeBoundingSphere();
  const {boundingSphere} = geometry;

  return {
    positions: new Float32Array(positions.buffer, positions.byteOffset, attributeIndex),
    uvs: new Float32Array(uvs.buffer, uvs.byteOffset, uvIndex),
    indices: new Uint16Array(indices.buffer, indices.byteOffset, indexIndex),
    boundingSphere: Float32Array.from(boundingSphere.center.toArray().concat([boundingSphere.radius])),
  };
};
const _requestLightmaps = (lightmapBuffer, cb) => {
  const id = _makeId();
  postMessage({
    type: 'request',
    method: 'render',
    args: [id],
    lightmapBuffer,
  }, [lightmapBuffer.buffer]);
  queues[id] = cb;
};
const _getCull = (hmdPosition, projectionMatrix, matrixWorldInverse) => {
  localFrustum.setFromMatrix(localMatrix.fromArray(projectionMatrix).multiply(localMatrix2.fromArray(matrixWorldInverse)));

  for (const index in grassChunkMeshes) {
    const trackedGrassChunkMeshes = grassChunkMeshes[index];
    if (trackedGrassChunkMeshes) {
      trackedGrassChunkMeshes.groups.fill(-1);
      let groupIndex = 0;
      let start = -1;
      let count = 0;
      for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) { // XXX optimize this direction
        const trackedGrassChunkMesh = trackedGrassChunkMeshes.array[i];
        if (localFrustum.intersectsSphere(trackedGrassChunkMesh.boundingSphere)) {
          if (start === -1) {
            start = trackedGrassChunkMesh.indexRange.start;
          }
          count += trackedGrassChunkMesh.indexRange.count;
        } else {
          if (start !== -1) {
            const baseIndex = groupIndex * 2;
            trackedGrassChunkMeshes.groups[baseIndex + 0] = start;
            trackedGrassChunkMeshes.groups[baseIndex + 1] = count;
            groupIndex++;
            start = -1;
            count = 0;
          }
        }
      }
      if (start !== -1) {
        const baseIndex = groupIndex * 2;
        trackedGrassChunkMeshes.groups[baseIndex + 0] = start;
        trackedGrassChunkMeshes.groups[baseIndex + 1] = count;
      }
    }
  }

  return grassChunkMeshes;
};

self.onmessage = e => {
  const {data} = e;
  const {type} = data;

  switch (type) {
    case 'generate': {
      const {id, x, y, buffer} = data;

      _requestHeightfield(x, y, buffer, heightfield => {
        const {buffer} = heightfield;

        const grassChunkGeometry = _makeGrassChunkMesh(x, y, grassTemplates, heightfield);

        const lightmapBuffer = new Uint8Array(buffer, Math.floor(buffer.byteLength * 3 / 4));

        let byteOffset = 0;
        new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 1)[0] = 1;
        byteOffset += 4;

        const lightmapHeaderArray = new Int32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 2);
        lightmapHeaderArray[0] = x;
        lightmapHeaderArray[1] = y;
        byteOffset += 4 * 2;

        const {positions} = grassChunkGeometry;
        const numPositions = positions.length;
        new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 1)[0] = numPositions;
        byteOffset += 4;

        new Float32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, numPositions).set(positions);
        byteOffset += 4 * numPositions;

        _requestLightmaps(lightmapBuffer, lightmapBuffer => {
          const {buffer} = lightmapBuffer;

          const lightmapsLength = new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset, 1)[0];
          const lightmaps = new Uint8Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + 4, lightmapsLength);

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
                count: grassChunkGeometry.indices.length,
              },
              boundingSphere: grassChunkGeometry.boundingSphere,
            };
            return result;
          })();
          const trackedGrassChunkMeshes = {
            offset: new THREE.Vector2(x, y),
            positions: grassChunkGeometry.positions,
            array: Array(NUM_CHUNKS_HEIGHT),
            groups: new Int32Array(NUM_RENDER_GROUPS * 2),
          };
          for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
            const {indexRange, boundingSphere} = geometries[i];
            trackedGrassChunkMeshes.array[i] = {
              indexRange,
              boundingSphere: new THREE.Sphere(
                new THREE.Vector3().fromArray(boundingSphere, 0),
                boundingSphere[3]
              ),
            };
          }
          grassChunkMeshes[_getChunkIndex(x, y)] = trackedGrassChunkMeshes;

          protocolUtils.stringifyGrassGeometry(grassChunkGeometry, lightmaps, buffer, 0);
          postMessage({
            type: 'response',
            args: [id],
            result: buffer,
          }, [buffer]);
        });
      });
      break;
    }
    case 'ungenerate': {
      const {x, y} = data;

      grassChunkMeshes[_getChunkIndex(x, y)] = null;
      break;
    }
    case 'lightmaps': {
      const {id, args} = data;
      const {lightmapBuffer} = args;

      let readByteOffset = 0;
      const numLightmaps = new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + readByteOffset, 1)[0];
      readByteOffset += 4;

      const lightmapsCoordsArray = new Int32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + readByteOffset, numLightmaps * 2);
      readByteOffset += 4 * numLightmaps * 2;

      const requestGrassChunkMeshes = [];
      for (let i = 0; i < numLightmaps; i++) {
        const baseIndex = i * 2;
        const x = lightmapsCoordsArray[baseIndex + 0];
        const y = lightmapsCoordsArray[baseIndex + 1];
        const grassChunkMesh = grassChunkMeshes[_getChunkIndex(x, y)];
        if (grassChunkMesh) {
          requestGrassChunkMeshes.push(grassChunkMesh);
        } else {
          requestGrassChunkMeshes.push({
            offset: new THREE.Vector2(x, y),
            positions: new Float32Array(0),
          });
        }
      }

      let writeByteOffset = 4;
      for (let i = 0; i < numLightmaps; i++) {
        const {offset: {x, y}, positions} = requestGrassChunkMeshes[i];

        const lightmapHeaderArray = new Int32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + writeByteOffset, 2);
        lightmapHeaderArray[0] = x;
        lightmapHeaderArray[1] = y;
        writeByteOffset += 4 * 2;

        const numPositions = positions.length;
        new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + writeByteOffset, 1)[0] = numPositions;
        writeByteOffset += 4;

        new Float32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + writeByteOffset, numPositions).set(positions);
        writeByteOffset += 4 * numPositions;
      }

      _requestLightmaps(lightmapBuffer, lightmapBuffer => {
        postMessage({
          type: 'response',
          args: [id],
          result: lightmapBuffer,
        }, [lightmapBuffer.buffer]);
      });

      break;
    }
    case 'cull': {
      const {id, args} = data;
      const {hmdPosition, projectionMatrix, matrixWorldInverse, buffer} = args;

      const grassChunkMeshes = _getCull(hmdPosition, projectionMatrix, matrixWorldInverse);
      protocolUtils.stringifyCull(grassChunkMeshes, buffer, 0);
      postMessage({
        type: 'response',
        args: [id],
        result: buffer,
      }, [buffer]);
      break;
    }
    case 'texture': {
      const {id, buffer} = data;
      new Uint8Array(buffer).set(grassTextureAtlas);

      postMessage({
        type: 'response',
        args: [id],
        result: buffer,
      }, [buffer]);
      break;
    }
    case 'response': {
      const {id, result} = data;

      queues[id](result);
      queues[id] = null;

      _cleanupQueues();
      break;
    }
    default: {
      console.warn('invalid grass worker method:', JSON.stringify(type));
      break;
    }
  }
};
let _id = 0;
const _makeId = () => {
  const result = _id;
  _id = (_id + 1) | 0;
  return result;
};

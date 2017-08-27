importScripts('/archae/assets/three.js');
const {exports: THREE} = self.module;
self.module = {};

const {
  NUM_CELLS,

  NUM_CHUNKS_HEIGHT,
  NUM_RENDER_GROUPS,

  DEFAULT_SEED,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

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

const _requestGrassGeometry = (x, y, index, numPositions, numIndices) => {
  const grassChunkMesh = grassChunkMeshes[_getChunkIndex(x, y)];

  if (grassChunkMesh) {
    return Promise.resolve(grassChunkMesh.geometry);
  } else {
    return fetch(`/archae/grass/chunks?x=${x}&z=${y}`, {
      credentials: 'include',
    })
      .then(_resArrayBuffer)
      .then(buffer => {
        const geometry = protocolUtils.parseDataGeometry(buffer, 0);

        const positionOffset = index * (numPositions / 3);
        const indexOffset = index * numIndices;

        const {indices} = geometry;
        for (let i = 0; i < indices.length; i++) {
          indices[i] += positionOffset;
        }

        const geometries = (() => { // XXX actually split into multiple geometries
          const result = Array(NUM_CHUNKS_HEIGHT);
          for (let i = 1; i < NUM_CHUNKS_HEIGHT; i++) {
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
              start: indexOffset,
              count: geometry.indices.length,
            },
            boundingSphere: geometry.boundingSphere,
          };
          return result;
        })();
        const trackedGrassChunkMeshes = {
          offset: new THREE.Vector2(x, y),
          geometry,
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

        return geometry;
      });
  }
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
      const {id, x, y, index, numPositions, numIndices, buffer} = data;

      _requestGrassGeometry(x, y, index, numPositions, numIndices)
        .then(geometry => {
          const lightmapBuffer = new Uint8Array(buffer, Math.floor(buffer.byteLength * 3 / 4));

          let byteOffset = 0;
          new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 1)[0] = 1;
          byteOffset += 4;

          const lightmapHeaderArray = new Int32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 2);
          lightmapHeaderArray[0] = x;
          lightmapHeaderArray[1] = y;
          byteOffset += 4 * 2;

          const {positions} = geometry;
          const numPositions = positions.length;
          new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 1)[0] = numPositions;
          byteOffset += 4;

          new Float32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, numPositions).set(positions);
          byteOffset += 4 * numPositions;

          _requestLightmaps(lightmapBuffer, lightmapBuffer => {
            const {buffer} = lightmapBuffer;

            const lightmapsLength = new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + 3 * 4, 1)[0];
            const lightmaps = new Uint8Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + 4 * 4, lightmapsLength);

            protocolUtils.stringifyRenderGeometry(geometry, lightmaps, buffer, 0);
            postMessage({
              type: 'response',
              args: [id],
              result: buffer,
            }, [buffer]);
          });
        })
        .catch(err => {
          console.warn(err);
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
        const {offset: {x, y}, geometry: {positions}} = requestGrassChunkMeshes[i];

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

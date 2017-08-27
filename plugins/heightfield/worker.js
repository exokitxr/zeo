importScripts('/archae/assets/three.js');
const {exports: THREE} = self.module;
importScripts('/archae/assets/murmurhash.js');
const {exports: murmur} = self.module;
importScripts('/archae/assets/indev.js');
const {exports: indev} = self.module;
self.module = {};

const generatorLib = require('./generator');
const trra = require('trra');
const {
  NUM_CELLS,

  NUM_CHUNKS_HEIGHT,

  NUM_RENDER_GROUPS,

  DEFAULT_SEED,

  PEEK_FACES,
  PEEK_FACE_INDICES,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const LIGHTMAP_BUFFER_SIZE = 100 * 1024 * 4;

const DIRECTIONS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

const generator = generatorLib({
  THREE,
  murmur,
  indev,
});
const tra = trra({
  seed: DEFAULT_SEED,
});
const elevationNoise = indev({
  seed: DEFAULT_SEED,
}).uniform({
  frequency: 0.002,
  octaves: 8,
});

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
const _getOriginHeight = () => (1 - 0.3 + Math.pow(elevationNoise.in2D(0 + 1000, 0 + 1000), 0.5)) * 64;

class PeekFace {
  constructor(exitFace, enterFace, x, y, z) {
    this.exitFace = exitFace;
    this.enterFace = enterFace;
    this.x = x;
    this.y = y;
    this.z = z;
  }
}
const peekFaceSpecs = [
  new PeekFace(PEEK_FACES.BACK, PEEK_FACES.FRONT, 0, 0, -1),
  new PeekFace(PEEK_FACES.FRONT, PEEK_FACES.BACK, 0, 0, 1),
  new PeekFace(PEEK_FACES.LEFT, PEEK_FACES.RIGHT, -1, 0, 0),
  new PeekFace(PEEK_FACES.RIGHT, PEEK_FACES.LEFT, 1, 0, 0),
  new PeekFace(PEEK_FACES.TOP, PEEK_FACES.BOTTOM, 0, 1, 0),
  new PeekFace(PEEK_FACES.BOTTOM, PEEK_FACES.TOP, 0, -1, 0),
];

const mapChunkMeshes = {};

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
const _requestChunk = (x, z, index, numPositions, numIndices) => {
  const chunk = tra.getChunk(x, z);

  if (chunk) {
    return Promise.resolve(chunk);
  } else {
    return fetch(`/archae/heightfield/chunks?x=${x}&z=${z}`, {
      credentials: 'include',
    })
      .then(_resArrayBuffer);
  }
};
const _requestChunkLightmaps = (chunk, scratchBuffer, scratchBufferByteOffset, cb) => {
  const lightmapBuffer = new Uint8Array(scratchBuffer, scratchBufferByteOffset);

  let byteOffset = 0;
  new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 1)[0] = 1;
  byteOffset += 4;

  const lightmapHeaderArray = new Int32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 2);
  lightmapHeaderArray[0] = chunk.x;
  lightmapHeaderArray[1] = chunk.z;
  byteOffset += 4 * 2;

  const positions = chunk.chunkData.positions;
  const numPositions = positions.length;
  new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 1)[0] = numPositions;
  byteOffset += 4;

  new Float32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, numPositions).set(positions);
  byteOffset += 4 * numPositions;

  _requestLightmaps(lightmapBuffer, lightmapBuffer => {
    const {buffer: scratchBuffer} = lightmapBuffer;

    const lightmapsLength = new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + 3 * 4, 1)[0];
    const lightmaps = new Uint8Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + 4 * 4, lightmapsLength);

    cb({
      lightmaps,
      scratchBuffer,
    });
  });
};
const _offsetChunkData = (chunkData, index, numPositions) => {
  const {indices} = chunkData;
  const positionOffset = index * (numPositions / 3);
  for (let i = 0; i < indices.length; i++) {
    indices[i] += positionOffset;
  }
};
const _registerChunk = (chunk, index, numIndices) => {
  const {x, z} = chunk;

  const trackedMapChunkMeshes = {
    array: Array(NUM_CHUNKS_HEIGHT),
    groups: new Int32Array(NUM_RENDER_GROUPS * 2),
  };
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    const {indexRange, boundingSphere, peeks} = chunk.chunkData.geometries[i];
    const indexOffset = index * numIndices;
    trackedMapChunkMeshes.array[i] = {
      offset: new THREE.Vector3(x, i, z),
      indexRange: {
        start: indexRange.start + indexOffset,
        count: indexRange.count,
      },
      boundingSphere: new THREE.Sphere(
        new THREE.Vector3().fromArray(boundingSphere, 0),
        boundingSphere[3]
      ),
      peeks,
      visibleIndex: -1,
    };
  }
  mapChunkMeshes[_getChunkIndex(x, z)] = trackedMapChunkMeshes;
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
const _unrequestChunk = (x, z) => {
  mapChunkMeshes[_getChunkIndex(x, z)] = null;
  tra.removeChunk(x, z);
};

const localMatrix = new THREE.Matrix4();
const localMatrix2 = new THREE.Matrix4();
const localFrustum = new THREE.Frustum();
const cullQueueMeshes = Array(256);
for (let i = 0; i < cullQueueMeshes.length; i++) {
  cullQueueMeshes[i] = null;
}
const cullQueueFaces = new Uint8Array(256);
let cullQueueStart = 0;
let cullQueueEnd = 0;
let visibleIndex = 0;
const _getCull = (hmdPosition, projectionMatrix, matrixWorldInverse) => {
  const ox = Math.floor(hmdPosition[0] / NUM_CELLS);
  const oy = Math.min(Math.max(Math.floor(hmdPosition[1] / NUM_CELLS), 0), NUM_CHUNKS_HEIGHT);
  const oz = Math.floor(hmdPosition[2] / NUM_CELLS);

  const trackedMapChunkMeshes = mapChunkMeshes[_getChunkIndex(ox, oz)];
  if (trackedMapChunkMeshes) {
    localFrustum.setFromMatrix(localMatrix.fromArray(projectionMatrix).multiply(localMatrix2.fromArray(matrixWorldInverse)));

    const trackedMapChunkMesh = trackedMapChunkMeshes.array[oy];
    cullQueueMeshes[cullQueueEnd] = trackedMapChunkMesh;
    cullQueueFaces[cullQueueEnd] = PEEK_FACES.NULL;
    cullQueueEnd = (cullQueueEnd + 1) % 256;
    for (;cullQueueStart !== cullQueueEnd; cullQueueStart = (cullQueueStart + 1) % 256) {
      const trackedMapChunkMesh = cullQueueMeshes[cullQueueStart];
      const {offset: {x, y, z}} = trackedMapChunkMesh;
      cullQueueMeshes[cullQueueStart] = null;
      const enterFace = cullQueueFaces[cullQueueStart];

      trackedMapChunkMesh.visibleIndex = visibleIndex;
      for (let j = 0; j < peekFaceSpecs.length; j++) {
        const peekFaceSpec = peekFaceSpecs[j];
        const ay = y + peekFaceSpec.y;
        if (ay >= 0 && ay < NUM_CHUNKS_HEIGHT) {
          const ax = x + peekFaceSpec.x;
          const az = z + peekFaceSpec.z;
          if (
            (ax - ox) * peekFaceSpec.x > 0 ||
            (ay - oy) * peekFaceSpec.y > 0 ||
            (az - oz) * peekFaceSpec.z > 0
          ) {
            if (enterFace === PEEK_FACES.NULL || trackedMapChunkMesh.peeks[PEEK_FACE_INDICES[enterFace << 4 | peekFaceSpec.exitFace]] === 1) {
              const trackedMapChunkMeshes = mapChunkMeshes[_getChunkIndex(ax, az)];
              if (trackedMapChunkMeshes) {
                const trackedMapChunkMesh = trackedMapChunkMeshes.array[ay];
                if (localFrustum.intersectsSphere(trackedMapChunkMesh.boundingSphere)) {
                  cullQueueMeshes[cullQueueEnd] = trackedMapChunkMesh;
                  cullQueueFaces[cullQueueEnd] = peekFaceSpec.enterFace;
                  cullQueueEnd = (cullQueueEnd + 1) % 256;
                }
              }
            }
          }
        }
      }
    }
  }

  for (const index in mapChunkMeshes) {
    const trackedMapChunkMeshes = mapChunkMeshes[index];
    if (trackedMapChunkMeshes) {
      trackedMapChunkMeshes.groups.fill(-1);
      let groupIndex = 0;
      let start = -1;
      let count = 0;

      for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) { // XXX optimize this direction
        const trackedMapChunkMesh = trackedMapChunkMeshes.array[i];
        if (trackedMapChunkMesh.visibleIndex === visibleIndex) {
          if (start === -1) {
            start = trackedMapChunkMesh.indexRange.start;
          }
          count += trackedMapChunkMesh.indexRange.count;
        } else {
          if (start !== -1) {
            const baseIndex = groupIndex * 2;
            trackedMapChunkMeshes.groups[baseIndex + 0] = start;
            trackedMapChunkMeshes.groups[baseIndex + 1] = count;
            groupIndex++;
            start = -1;
            count = 0;
          }
        }
      }
      if (start !== -1) {
        const baseIndex = groupIndex * 2;
        trackedMapChunkMeshes.groups[baseIndex + 0] = start;
        trackedMapChunkMeshes.groups[baseIndex + 1] = count;
      }
    }
  }

  visibleIndex = (visibleIndex + 1) % 0xFFFFFFFF;

  return mapChunkMeshes;
};

self.onmessage = e => {
  const {data} = e;
  const {method} = data;

  switch (method) {
    case 'getOriginHeight': {
      const {id} = data;

      postMessage({
        type: 'response',
        args: [id],
        result: _getOriginHeight(),
      });
      break;
    }
    case 'generate': {
      const {id, args} = data;
      const {x, y, index, numPositions, numIndices} = args;
      let {buffer} = args;

      _requestChunk(x, y, index, numPositions, numIndices)
        .then(chunkBuffer => {
          const chunkData = protocolUtils.parseDataChunk(chunkBuffer, 0);
          _offsetChunkData(chunkData, index, numPositions);
          const chunk = tra.addChunk(x, y, new Uint32Array(chunkBuffer, 0));
          chunk.chunkData = chunkData;
          _registerChunk(chunk, index, numIndices);
          return chunk;
        })
        .then(chunk => new Promise((accept, reject) => {
          _requestChunkLightmaps(chunk, buffer, buffer.byteLength - LIGHTMAP_BUFFER_SIZE, ({lightmaps, scratchBuffer}) => {
            buffer = scratchBuffer;
            accept({
              chunk,
              lightmaps,
            });
          })
        }))
        .then(({chunk, lightmaps}) => {
          protocolUtils.stringifyRenderChunk(chunk.chunkData, lightmaps, buffer, 0);

          postMessage({
            type: 'response',
            args: [id],
            result: buffer,
          }, [buffer]);
        })
        .catch(err => {
          console.warn(err);
        });
      break;
    }
    case 'ungenerate': {
      const {args} = data;
      const {x, y} = args;
      _unrequestChunk(x, y);
      break;
    }
    case 'heightfield': {
      const {id, args} = data;
      const {x, y, buffer} = args;

      const chunk = tra.getChunk(x, y);

      const heightfield = new Float32Array(buffer, 0, newHeightfield.length);
      if (chunk) {
        heightfield.set(chunk.chunkData.heightfield);
      } else {
        heightfield.fill(0);
      }

      postMessage({
        type: 'response',
        args: [id],
        result: heightfield,
      }, [heightfield.buffer]);
      break;
    }
    case 'lightmaps': {
      const {id, args} = data;
      const {lightmapBuffer} = args;

      let byteOffset = 0;
      const numLightmaps = new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 1)[0];
      byteOffset += 4;

      const lightmapsCoordsArray = new Int32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, numLightmaps * 2);
      byteOffset += 4 * numLightmaps * 2;

      const promises = [];
      for (let i = 0; i < numLightmaps; i++) {
        const baseIndex = i * 2;
        const x = lightmapsCoordsArray[baseIndex + 0];
        const z = lightmapsCoordsArray[baseIndex + 1];
        promises.push(tra.getChunk(x, z) || {
          x,
          z,
          chunkData: {
            positions: new Float32Array(0),
          },
        });
      }
      Promise.all(promises)
        .then(chunks => {
          let byteOffset = 4;

          for (let i = 0; i < numLightmaps; i++) {
            const chunk = chunks[i];

            const lightmapHeaderArray = new Int32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 2);
            lightmapHeaderArray[0] = chunk.x;
            lightmapHeaderArray[1] = chunk.z;
            byteOffset += 4 * 2;

            const positions = chunk.chunkData.positions;
            const numPositions = positions.length;
            new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 1)[0] = numPositions;
            byteOffset += 4;

            new Float32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, numPositions).set(positions);
            byteOffset += 4 * numPositions;
          }

          _requestLightmaps(lightmapBuffer, lightmapBuffer => {
            postMessage({
              type: 'response',
              args: [id],
              result: lightmapBuffer,
            }, [lightmapBuffer.buffer]);
          });
        })
        .catch(err => {
          console.warn(err);
        });

      break;
    }
    case 'cull': {
      const {id, args} = data;
      const {hmdPosition, projectionMatrix, matrixWorldInverse, buffer} = args;

      const mapChunkMeshes = _getCull(hmdPosition, projectionMatrix, matrixWorldInverse);
      protocolUtils.stringifyCull(mapChunkMeshes, buffer, 0);
      postMessage({
        type: 'response',
        args: [id],
        result: buffer,
      }, [buffer]);
      break;
    }
    case 'addVoxel': {
      throw new Error('not implemented');
      /* const {id, args} = data;
      const {position} = args;
      const [x, y, z] = position;
      // XXX regenerate locally and return immediately
      // XXX need to inform other clients of these
      fetch(`/archae/heightfield/voxels?x=${x}&y=${y}&z=${z}`, {
        method: 'POST',
        credentials: 'include',
      })
        .then(_resBlob)
        .then(() => {
          const ox = Math.floor(x / NUM_CELLS);
          const oz = Math.floor(z / NUM_CELLS);
          tra.removeChunk(ox, oz); // XXX not needed once we regenerate locally

          postMessage({
            type: 'response',
            args: [id],
            result: null,
          });
        })
        .catch(err => {
          console.warn(err);
        }); */
      break;
    }
    case 'subVoxel': {
      const {id, args} = data;
      const {position: [x, y, z], gslots} = args;
      let {buffer} = args;

      fetch(`/archae/heightfield/voxels?x=${x}&y=${y}&z=${z}`, {
        method: 'DELETE',
        credentials: 'include',
      })
        .then(_resArrayBuffer)
        .then(responseBuffer => {
          let readByteOffset = 0;
          const numChunks = new Uint32Array(responseBuffer, readByteOffset, 1)[0];
          readByteOffset += 4;

          if (numChunks > 0) {
            const chunkSpecs = [];
            for (let i = 0; i < numChunks; i++) {
              const chunkHeader = new Int32Array(responseBuffer, readByteOffset, 2);
              const x = chunkHeader[0];
              const z = chunkHeader[1];
              readByteOffset += 4 * 2;

              const chunkLength = new Uint32Array(responseBuffer, readByteOffset, 1)[0];
              readByteOffset += 4;

              const chunkBuffer = new Uint8Array(responseBuffer, readByteOffset, chunkLength);
              readByteOffset += chunkLength;

              const chunk = tra.getChunk(x, z);
              const index = _getChunkIndex(x, z);
              const gslot = gslots[index];
              if (chunk && gslot) {
                const {index, numPositions, numIndices} = gslot;

                const chunkData = protocolUtils.parseDataChunk(chunkBuffer.buffer, chunkBuffer.byteOffset);
                _offsetChunkData(chunkData, index, numPositions);
                chunk.chunkData = chunkData;

                const uint32Array = chunk.getBuffer();
                new Uint8Array(uint32Array.buffer, uint32Array.byteOffset).set(chunkBuffer);

                _registerChunk(chunk, index, numIndices);

                chunkSpecs.push({
                  x,
                  z,
                  chunkData,
                });
              }
            }
            const numChunkSpecs = chunkSpecs.length;

            const lightmapBuffer = new Uint8Array(buffer, buffer.byteLength - LIGHTMAP_BUFFER_SIZE * numChunkSpecs);

            let lightmapByteOffset = 0;
            new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + lightmapByteOffset, 1)[0] = numChunkSpecs;
            lightmapByteOffset += 4;

            for (let i = 0; i < numChunkSpecs; i++) {
              const chunkSpec = chunkSpecs[i];
              const {x, z, chunkData: {positions}} = chunkSpec;

              const lightmapHeaderArray = new Int32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + lightmapByteOffset, 2);
              lightmapHeaderArray[0] = x;
              lightmapHeaderArray[1] = z;
              lightmapByteOffset += 4 * 2;

              const numPositions = positions.length;
              new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + lightmapByteOffset, 1)[0] = numPositions;
              lightmapByteOffset += 4;

              new Float32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + lightmapByteOffset, numPositions).set(positions);
              lightmapByteOffset += 4 * numPositions;
            }

            _requestLightmaps(lightmapBuffer, lightmapBuffer => { // XXX make sure new heightfield is passed to lightmap plugin before this
              const {buffer} = lightmapBuffer;

              const lightmapsLength = new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + 3 * 4, 1)[0];
              const lightmaps = new Uint8Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + 4 * 4, lightmapsLength);

              let writeByteOffset = 0;
              const chunksHeader = new Uint32Array(buffer, writeByteOffset, 1);
              writeByteOffset += 4;

              let numResponseChunks = 0;
              for (let i = 0; i < numChunkSpecs; i++) {
                const chunkSpec = chunkSpecs[i];
                const {x, z} = chunkSpec;
                const chunk = tra.getChunk(x, z);

                if (chunk) {
                  const chunkHeader1 = new Int32Array(buffer, writeByteOffset, 2);
                  chunkHeader1[0] = x;
                  chunkHeader1[1] = z;
                  writeByteOffset += 4 * 2;

                  const chunkHeader2 = new Uint32Array(buffer, writeByteOffset, 1);
                  writeByteOffset += 4;

                  const newWriteByteOffset = protocolUtils.stringifyRenderChunk(chunk.chunkData, lightmaps, buffer, writeByteOffset)[1];
                  const numChunkBytes = newWriteByteOffset - writeByteOffset;
                  writeByteOffset = newWriteByteOffset;

                  chunkHeader2[0] = numChunkBytes;

                  numResponseChunks++;
                }
              }
              chunksHeader[0] = numResponseChunks;

              postMessage({
                type: 'response',
                args: [id],
                result: buffer,
              }, [buffer]);
            });
          } else {
            let writeByteOffset = 0;
            new Uint32Array(buffer, writeByteOffset, 1)[0] = 0;
            writeByteOffset += 4;

            postMessage({
              type: 'response',
              args: [id],
              result: buffer,
            }, [buffer]);
          }
        })
        .catch(err => {
          console.warn(err);
        });
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
      console.warn('invalid heightfield worker method:', JSON.stringify(method));
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

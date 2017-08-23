const {
  NUM_RENDER_GROUPS,
} = require('../constants/constants');

const UINT32_SIZE = 4;
const UINT16_SIZE = 2;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const MAP_CHUNK_HEADER_ENTRIES = 4;
const MAP_CHUNK_HEADER_SIZE = UINT32_SIZE * MAP_CHUNK_HEADER_ENTRIES;
const CULL_HEADER_ENTRIES = 1;
const CULL_HEADER_SIZE = UINT32_SIZE * CULL_HEADER_ENTRIES;

const _getObjectsChunkSizeFromMetadata = metadata => {
  const {numPositions, numUvs, numWaves, numIndices} = metadata;

  return MAP_CHUNK_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numUvs) +  // uvs
    (FLOAT32_SIZE * numWaves) +  // waves
    (UINT16_SIZE * numIndices) // indices
};

const _getObjectsChunkSize = oceanChunk => {
  const {positions, uvs, waves, indices} = oceanChunk;

  const numPositions = positions.length;
  const numUvs = uvs.length;
  const numWaves = waves.length;
  const numIndices = indices.length;

  return _getObjectsChunkSizeFromMetadata({
    numPositions,
    numUvs,
    numWaves,
    numIndices,
  });
};

const stringifyGeometry = (oceanChunk, arrayBuffer, byteOffset) => {
  const {positions, uvs, waves, indices} = oceanChunk;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getObjectsChunkSize(oceanChunk);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, MAP_CHUNK_HEADER_ENTRIES);
  headerBuffer[0] = positions.length;
  headerBuffer[1] = uvs.length;
  headerBuffer[2] = waves.length;
  headerBuffer[3] = indices.length;
  byteOffset += MAP_CHUNK_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, positions.length);
  positionsBuffer.set(positions);
  byteOffset += FLOAT32_SIZE * positions.length;

  const uvsBuffer = new Float32Array(arrayBuffer, byteOffset, uvs.length);
  uvsBuffer.set(uvs);
  byteOffset += FLOAT32_SIZE * uvs.length;

  const wavesBuffer = new Float32Array(arrayBuffer, byteOffset, waves.length);
  wavesBuffer.set(waves);
  byteOffset += FLOAT32_SIZE * waves.length;

  const indicesBuffer = new Uint16Array(arrayBuffer, byteOffset, indices.length);
  indicesBuffer.set(indices);
  byteOffset += UINT16_SIZE * indices.length;

  return arrayBuffer;
};

const parseGeometry = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, MAP_CHUNK_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numUvs = headerBuffer[1];
  const numWaves = headerBuffer[2];
  const numIndices = headerBuffer[3];
  byteOffset += MAP_CHUNK_HEADER_SIZE;

  const positionsBuffer = new Float32Array(buffer, byteOffset, numPositions);
  const positions = positionsBuffer;
  byteOffset += FLOAT32_SIZE * numPositions;

  const uvsBuffer = new Float32Array(buffer, byteOffset, numUvs);
  const uvs = uvsBuffer;
  byteOffset += FLOAT32_SIZE * numUvs;

  const wavesBuffer = new Float32Array(buffer, byteOffset, numWaves);
  const waves = wavesBuffer;
  byteOffset += FLOAT32_SIZE * numWaves;

  const indicesBuffer = new Uint16Array(buffer, byteOffset, numIndices);
  const indices = indicesBuffer;
  byteOffset += UINT16_SIZE * numIndices;

  return {
    buffer,
    positions,
    uvs,
    waves,
    indices,
  };
};

const _getCullSizeFromMetadata = metadata => {
  const {numMapChunks} = metadata;

  return CULL_HEADER_SIZE + // header
    ((INT32_SIZE + (INT32_SIZE * 2 * NUM_RENDER_GROUPS)) * numMapChunks); // map chunks
};

const _getCullSize = mapChunks => {
  let numMapChunks = 0;
  for (const index in mapChunks) {
    if (mapChunks[index]) {
      numMapChunks++;
    }
  }
  return _getCullSizeFromMetadata({
    numMapChunks,
  });
};

const stringifyCull = (mapChunks, arrayBuffer, byteOffset) => {
  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getCullSize(mapChunks);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  let numMapChunks = 0;
  for (const index in mapChunks) {
    if (mapChunks[index]) {
      numMapChunks++;
    }
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, CULL_HEADER_ENTRIES);
  let index = 0;
  headerBuffer[index++] = numMapChunks;
  byteOffset += CULL_HEADER_SIZE;

  for (const index in mapChunks) {
    const trackedMapChunkMeshes = mapChunks[index];
    if (trackedMapChunkMeshes) {
      const indexArray = new Int32Array(arrayBuffer, byteOffset, 1);
      indexArray[0] = parseInt(index, 10);
      byteOffset += INT32_SIZE;

      const groupsArray = new Int32Array(arrayBuffer, byteOffset, NUM_RENDER_GROUPS * 2);
      groupsArray.set(trackedMapChunkMeshes.groups);
      byteOffset += INT32_SIZE * 2 * NUM_RENDER_GROUPS;
    }
  }

  return arrayBuffer;
};

const parseCull = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, CULL_HEADER_ENTRIES);
  let index = 0;
  const numMapChunks = headerBuffer[index++];
  byteOffset += CULL_HEADER_SIZE;

  const mapChunks = Array(numMapChunks);
  for (let i = 0; i < numMapChunks; i++) {
    const indexArray = new Int32Array(buffer, byteOffset, 1);
    const index = indexArray[0];
    byteOffset += INT32_SIZE;

    const groups = [];
    const groupsArray = new Int32Array(buffer, byteOffset, NUM_RENDER_GROUPS * 2);
    for (let i = 0; i < NUM_RENDER_GROUPS; i++) {
      const baseIndex = i * 2;
      const start = groupsArray[baseIndex + 0];
      if (start !== -1) {
        groups.push({
          start,
          count: groupsArray[baseIndex + 1],
          materialIndex: 0,
        });
      }
    }
    byteOffset += INT32_SIZE * 2 * NUM_RENDER_GROUPS;

    mapChunks[i] = {
      index,
      groups,
    };
  }
  return mapChunks;
};

module.exports = {
  stringifyGeometry,
  parseGeometry,

  stringifyCull,
  parseCull,
};

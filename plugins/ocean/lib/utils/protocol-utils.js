const UINT32_SIZE = 4;
const UINT16_SIZE = 2;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const MAP_CHUNK_HEADER_ENTRIES = 4;
const MAP_CHUNK_HEADER_SIZE = UINT32_SIZE * MAP_CHUNK_HEADER_ENTRIES;

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

// stringification

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

// parsing

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

module.exports = {
  stringifyGeometry,
  parseGeometry,
};

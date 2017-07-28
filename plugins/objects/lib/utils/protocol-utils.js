const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const MAP_CHUNK_HEADER_ENTRIES = 3;
const MAP_CHUNK_HEADER_SIZE = UINT32_SIZE * MAP_CHUNK_HEADER_ENTRIES;

const _getObjectsChunkSizeFromMetadata = metadata => {
  const {numPositions, numUvs, numIndices} = metadata;

  return MAP_CHUNK_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numUvs) +  // uvs
    (UINT32_SIZE * numIndices); // indices
};

const _getObjectsChunkSize = objectsChunk => {
  const {positions, uvs, indices} = objectsChunk;

  const numPositions = positions.length;
  const numUvsa = uvs.length;
  const numIndices = indices.length;

  return _getObjectsChunkSizeFromMetadata({
    numPositions,
    numUvsa,
    numIndices,
  });
};

// stringification

const stringifyGeometry = (objectsChunk, arrayBuffer, byteOffset) => {
  const {positions, uvs, indices} = objectsChunk;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getObjectsChunkSize(objectsChunk);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, MAP_CHUNK_HEADER_ENTRIES);
  headerBuffer[0] = positions.length;
  headerBuffer[1] = uvs.length;
  headerBuffer[2] = indices.length;
  byteOffset += MAP_CHUNK_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, positions.length);
  positionsBuffer.set(positions);
  byteOffset += FLOAT32_SIZE * positions.length;

  const uvsBuffer = new Float32Array(arrayBuffer, byteOffset, uvs.length);
  uvsBuffer.set(uvs);
  byteOffset += FLOAT32_SIZE * uvs.length;

  const indicesBuffer = new Uint32Array(arrayBuffer, byteOffset, indices.length);
  indicesBuffer.set(indices);
  byteOffset += UINT32_SIZE * indices.length;

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
  const numIndices = headerBuffer[2];
  byteOffset += MAP_CHUNK_HEADER_SIZE;

  const positionsBuffer = new Float32Array(buffer, byteOffset, numPositions);
  const positions = positionsBuffer;
  byteOffset += FLOAT32_SIZE * numPositions;

  const uvsBuffer = new Float32Array(buffer, byteOffset, numUvs);
  const uvs = uvsBuffer;
  byteOffset += FLOAT32_SIZE * numUvs;

  const indicesBuffer = new Uint32Array(buffer, byteOffset, numIndices);
  const indices = indicesBuffer;
  byteOffset += UINT32_SIZE * numIndices;

  return {
    buffer,
    positions,
    uvs,
    indices,
  };
};

module.exports = {
  stringifyGeometry,
  parseGeometry,
};

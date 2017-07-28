const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const MAP_CHUNK_HEADER_ENTRIES = 4;
const MAP_CHUNK_HEADER_SIZE = UINT32_SIZE * MAP_CHUNK_HEADER_ENTRIES;

const _getObjectsChunkSizeFromMetadata = metadata => {
  const {numPositions, numUvs, numIndices, numObjects} = metadata;

  return MAP_CHUNK_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numUvs) +  // uvs
    (UINT32_SIZE * numIndices) + // indices
    (FLOAT32_SIZE * numObjects); // objects
};

const _getObjectsChunkSize = objectsChunk => {
  const {positions, uvs, indices, objects} = objectsChunk;

  const numPositions = positions.length;
  const numUvsa = uvs.length;
  const numIndices = indices.length;
  const numObjects = objects.length;

  return _getObjectsChunkSizeFromMetadata({
    numPositions,
    numUvsa,
    numIndices,
    numObjects,
  });
};

// stringification

const stringifyGeometry = (objectsChunk, arrayBuffer, byteOffset) => {
  const {positions, uvs, indices, objects} = objectsChunk;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getObjectsChunkSize(objectsChunk);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, MAP_CHUNK_HEADER_ENTRIES);
  headerBuffer[0] = positions.length;
  headerBuffer[1] = uvs.length;
  headerBuffer[2] = indices.length;
  headerBuffer[3] = objects.length;
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

  const objectsBuffer = new Float32Array(arrayBuffer, byteOffset, objects.length);
  objectsBuffer.set(objects);
  byteOffset += FLOAT32_SIZE * objects.length;

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
  const numObjects = headerBuffer[3];
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

  const objectsBuffer = new Float32Array(buffer, byteOffset, numObjects);
  const objects = objectsBuffer;
  byteOffset += FLOAT32_SIZE * numObjects;

  return {
    buffer,
    positions,
    uvs,
    indices,
    objects,
  };
};

module.exports = {
  stringifyGeometry,
  parseGeometry,
};

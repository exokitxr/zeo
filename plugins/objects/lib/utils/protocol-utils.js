const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const MAP_CHUNK_HEADER_ENTRIES = 6;
const MAP_CHUNK_HEADER_SIZE = UINT32_SIZE * MAP_CHUNK_HEADER_ENTRIES;

const _getObjectsChunkSizeFromMetadata = metadata => {
  const {numPositions, numUvs, numFrames, numObjectIndices, numIndices, numObjects} = metadata;

  return MAP_CHUNK_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numUvs) +  // uvs
    (FLOAT32_SIZE * numFrames) +  // frames
    (FLOAT32_SIZE * numObjectIndices) +  // object indices
    (UINT32_SIZE * numIndices) + // indices
    (UINT32_SIZE * numObjects); // objects
};

const _getObjectsChunkSize = objectsChunk => {
  const {positions, uvs, frames, objectIndices, indices, objects} = objectsChunk;

  const numPositions = positions.length;
  const numUvs = uvs.length;
  const numFrames = frames.length;
  const numObjectIndices = objectIndices.length;
  const numIndices = indices.length;
  const numObjects = objects.length;

  return _getObjectsChunkSizeFromMetadata({
    numPositions,
    numUvs,
    numFrames,
    numObjectIndices,
    numIndices,
    numObjects,
  });
};

// stringification

const stringifyGeometry = (objectsChunk, arrayBuffer, byteOffset) => {
  const {positions, uvs, frames, objectIndices, indices, objects} = objectsChunk;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getObjectsChunkSize(objectsChunk);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, MAP_CHUNK_HEADER_ENTRIES);
  headerBuffer[0] = positions.length;
  headerBuffer[1] = uvs.length;
  headerBuffer[2] = frames.length;
  headerBuffer[3] = objectIndices.length;
  headerBuffer[4] = indices.length;
  headerBuffer[5] = objects.length;
  byteOffset += MAP_CHUNK_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, positions.length);
  positionsBuffer.set(positions);
  byteOffset += FLOAT32_SIZE * positions.length;

  const uvsBuffer = new Float32Array(arrayBuffer, byteOffset, uvs.length);
  uvsBuffer.set(uvs);
  byteOffset += FLOAT32_SIZE * uvs.length;

  const framesBuffer = new Float32Array(arrayBuffer, byteOffset, frames.length);
  framesBuffer.set(frames);
  byteOffset += FLOAT32_SIZE * frames.length;

  const objectIndexBuffer = new Float32Array(arrayBuffer, byteOffset, objectIndices.length);
  objectIndexBuffer.set(objectIndices);
  byteOffset += FLOAT32_SIZE * objectIndices.length;

  const indicesBuffer = new Uint32Array(arrayBuffer, byteOffset, indices.length);
  indicesBuffer.set(indices);
  byteOffset += UINT32_SIZE * indices.length;

  const objectsBuffer = new Uint32Array(arrayBuffer, byteOffset, objects.length);
  objectsBuffer.set(objects);
  byteOffset += UINT32_SIZE * objects.length;

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
  const numFrames = headerBuffer[2];
  const numObjectIndices = headerBuffer[3];
  const numIndices = headerBuffer[4];
  const numObjects = headerBuffer[5];
  byteOffset += MAP_CHUNK_HEADER_SIZE;

  const positionsBuffer = new Float32Array(buffer, byteOffset, numPositions);
  const positions = positionsBuffer;
  byteOffset += FLOAT32_SIZE * numPositions;

  const uvsBuffer = new Float32Array(buffer, byteOffset, numUvs);
  const uvs = uvsBuffer;
  byteOffset += FLOAT32_SIZE * numUvs;

  const framesBuffer = new Float32Array(buffer, byteOffset, numFrames);
  const frames = framesBuffer;
  byteOffset += FLOAT32_SIZE * numFrames;

  const objectIndexBuffer = new Float32Array(buffer, byteOffset, numObjectIndices);
  const objectIndices = objectIndexBuffer;
  byteOffset += FLOAT32_SIZE * numObjectIndices;

  const indicesBuffer = new Uint32Array(buffer, byteOffset, numIndices);
  const indices = indicesBuffer;
  byteOffset += UINT32_SIZE * numIndices;

  const objectsBuffer = new Uint32Array(buffer, byteOffset, numObjects);
  const objects = objectsBuffer;
  byteOffset += UINT32_SIZE * numObjects;

  return {
    buffer,
    positions,
    uvs,
    frames,
    objectIndices,
    indices,
    objects,
  };
};

module.exports = {
  stringifyGeometry,
  parseGeometry,
};

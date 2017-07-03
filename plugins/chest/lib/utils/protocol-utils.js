const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const MAP_CHUNKS_HEADER_ENTRIES = 1;
const MAP_CHUNKS_HEADER_SIZE = UINT32_SIZE * MAP_CHUNKS_HEADER_ENTRIES;
const MAP_CHUNK_HEADER_ENTRIES = 4;
const MAP_CHUNK_HEADER_SIZE = UINT32_SIZE * MAP_CHUNK_HEADER_ENTRIES;
const MAP_CHUNK_UPDATE_HEADER_ENTRIES = 4;
const MAP_CHUNK_UPDATE_HEADER_SIZE = UINT32_SIZE * MAP_CHUNK_HEADER_ENTRIES;

const _getChestChunkSizeFromMetadata = metadata => {
  const {numPositions, numNormals, numColors, numIndices} = metadata;

  return MAP_CHUNK_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numNormals) +  // normals
    (FLOAT32_SIZE * numColors) + // colors
    (UINT32_SIZE * numIndices) + // indices
    (FLOAT32_SIZE * 3 * 2); // bounding box
};

const _getChestChunkSize = chestChunk => {
  const {positions, normals, colors, indices} = chestChunk;

  const numPositions = positions.length;
  const numNormals = normals.length;
  const numColors = colors.length;
  const numIndices = indices.length;

  return _getChestChunkSizeFromMetadata({
    numPositions,
    numNormals,
    numColors,
    numIndices,
  });
};

const _getChestChunkBufferSize = (arrayBuffer, byteOffset) => {
  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, MAP_CHUNK_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numNormals = headerBuffer[1];
  const numColors = headerBuffer[2];
  const numIndices = headerBuffer[3];

  return _getChestChunkSizeFromMetadata({
    numPositions,
    numNormals,
    numColors,
    numIndices,
  });
};

// stringification

const stringifyChestChunk = (chestChunk, arrayBuffer, byteOffset) => {
  const {positions, normals, colors, indices, boundingBox} = chestChunk;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getChestChunkSize(chestChunk);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, MAP_CHUNK_HEADER_ENTRIES);
  headerBuffer[0] = positions.length;
  headerBuffer[1] = normals.length;
  headerBuffer[2] = colors.length;
  headerBuffer[3] = indices.length;
  byteOffset += MAP_CHUNK_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, positions.length);
  positionsBuffer.set(positions);
  byteOffset += FLOAT32_SIZE * positions.length;

  const normalsBuffer = new Float32Array(arrayBuffer, byteOffset, normals.length);
  normalsBuffer.set(normals);
  byteOffset += FLOAT32_SIZE * normals.length;

  const colorsBuffer = new Float32Array(arrayBuffer, byteOffset, colors.length);
  colorsBuffer.set(colors);
  byteOffset += FLOAT32_SIZE * colors.length;

  const indicesBuffer = new Uint32Array(arrayBuffer, byteOffset, indices.length);
  indicesBuffer.set(indices);
  byteOffset += UINT32_SIZE * indices.length;

  const boundingBoxBuffer = new Float32Array(arrayBuffer, byteOffset, 3 * 2);
  boundingBoxBuffer[0] = boundingBox[0][0];
  boundingBoxBuffer[1] = boundingBox[0][1];
  boundingBoxBuffer[2] = boundingBox[0][2];
  boundingBoxBuffer[3] = boundingBox[1][0];
  boundingBoxBuffer[4] = boundingBox[1][1];
  boundingBoxBuffer[5] = boundingBox[1][2];
  byteOffset += FLOAT32_SIZE * 3 * 2;

  return [arrayBuffer, byteOffset];
};

const _sum = a => {
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    const e = a[i];
    result += e;
  }
  return result;
};

const stringifyChestChunks = (chestChunks, arrayBuffer, byteOffset) => {
  if (arrayBuffer === undefined || byteOffset === undefined) {
    const chestChunkSizes = chestChunks.map(_getChestChunkSize);
    const bufferSize = _sum(chestChunkSizes);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, MAP_CHUNKS_HEADER_ENTRIES);
  headerBuffer[0] = chestChunks.length;
  byteOffset += MAP_CHUNKS_HEADER_SIZE;

  for (let i = 0; i < chestChunks.length; i++) {
    const chestChunk = chestChunks[i];
    byteOffset = stringifyChestChunk(chestChunk, arrayBuffer, byteOffset)[1];
  }

  return [arrayBuffer, byteOffset];
};

// parsing

const parseChestChunk = (arrayBuffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, MAP_CHUNK_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numNormals = headerBuffer[1];
  const numColors = headerBuffer[2];
  const numIndices = headerBuffer[3];
  byteOffset += MAP_CHUNK_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, numPositions);
  const positions = positionsBuffer;
  byteOffset += FLOAT32_SIZE * numPositions;

  const normalsBuffer = new Float32Array(arrayBuffer, byteOffset, numNormals);
  const normals = normalsBuffer;
  byteOffset += FLOAT32_SIZE * numNormals;

  const colorsBuffer = new Float32Array(arrayBuffer, byteOffset, numColors);
  const colors = colorsBuffer;
  byteOffset += FLOAT32_SIZE * numColors;

  const indicesBuffer = new Uint32Array(arrayBuffer, byteOffset, numIndices);
  const indices = indicesBuffer;
  byteOffset += UINT32_SIZE * numIndices;

  const boundingBoxBuffer = new Float32Array(arrayBuffer, byteOffset, 3 * 2);
  const boundingBox = [
    [boundingBoxBuffer[0], boundingBoxBuffer[1], boundingBoxBuffer[2]],
    [boundingBoxBuffer[3], boundingBoxBuffer[4], boundingBoxBuffer[5]],
  ];
  byteOffset += FLOAT32_SIZE * 3 * 2;

  return [
    {
      positions,
      normals,
      colors,
      indices,
      boundingBox,
    },
    byteOffset,
  ];
};

const parseChestChunks = arrayBuffer => {
  let byteOffset = 0;

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, MAP_CHUNKS_HEADER_ENTRIES);
  const numChestChunks = headerBuffer[0];
  byteOffset += MAP_CHUNKS_HEADER_SIZE;

  const chestChunks = Array(numChestChunks);
  for (let i = 0; i < numChestChunks; i++) {
    const [chestChunk, newByteOffset] = parseChestChunk(arrayBuffer, byteOffset);

    chestChunks[i] = chestChunk;
    byteOffset = newByteOffset;
  }

  return chestChunks;
};

module.exports = {
  stringifyChestChunk,
  stringifyChestChunks,
  parseChestChunk,
  parseChestChunks,
};

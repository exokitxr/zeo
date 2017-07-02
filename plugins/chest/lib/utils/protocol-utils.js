const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
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
    (UINT32_SIZE * numIndices); // indices
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
  const {positions, normals, colors, indices} = chestChunk;

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

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset + MAP_CHUNK_HEADER_SIZE, positions.length);
  positionsBuffer.set(positions);

  const normalsBuffer = new Float32Array(arrayBuffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (FLOAT32_SIZE * positions.length), normals.length);
  normalsBuffer.set(normals);

  const colorsBuffer = new Float32Array(arrayBuffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (FLOAT32_SIZE * positions.length) + (FLOAT32_SIZE * normals.length), colors.length);
  colorsBuffer.set(colors);

  const indicesBuffer = new Uint32Array(arrayBuffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (FLOAT32_SIZE * positions.length) + (FLOAT32_SIZE * normals.length) + (FLOAT32_SIZE * colors.length), indices.length);
  indicesBuffer.set(indices);

  return arrayBuffer;
};

const _sum = a => {
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    const e = a[i];
    result += e;
  }
  return result;
};

const stringifyChestChunks = chestChunks => {
  const chestChunkSizes = chestChunks.map(_getChestChunkSize);
  const bufferSize = _sum(chestChunkSizes);
  const arrayBuffer = new ArrayBuffer(bufferSize);

  let byteOffset = 0;
  for (let i = 0; i < chestChunks.length; i++) {
    const chestChunk = chestChunks[i];

    stringifyChestChunk(chestChunk, arrayBuffer, byteOffset);

    const chestChunkSize = chestChunkSizes[i];
    byteOffset += chestChunkSize;
  }

  return arrayBuffer;
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

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset + MAP_CHUNK_HEADER_SIZE, numPositions);
  const positions = positionsBuffer;

  const normalsBuffer = new Float32Array(arrayBuffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (FLOAT32_SIZE * numPositions), numNormals);
  const normals = normalsBuffer;

  const colorsBuffer = new Float32Array(arrayBuffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (FLOAT32_SIZE * numPositions) + (FLOAT32_SIZE * numNormals), numColors);
  const colors = colorsBuffer;

  const indicesBuffer = new Uint32Array(arrayBuffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (FLOAT32_SIZE * numPositions) + (FLOAT32_SIZE * numNormals) + (FLOAT32_SIZE * numColors), numIndices);
  const indices = indicesBuffer;

  return {
    positions,
    normals,
    colors,
    indices,
  };
};

const parseChestChunks = arrayBuffer => {
  const chestChunks = [];

  let byteOffset = 0;
  while (byteOffset < arrayBuffer.byteLength) {
    const chestChunk = parseChestChunk(arrayBuffer, byteOffset);
    chestChunks.push(chestChunk);

    const chestChunkSize = _getChestChunkBufferSize(arrayBuffer, byteOffset);
    byteOffset += chestChunkSize;
  }

  return chestChunks;
};

module.exports = {
  stringifyChestChunk,
  stringifyChestChunks,
  parseChestChunk,
  parseChestChunks,
};

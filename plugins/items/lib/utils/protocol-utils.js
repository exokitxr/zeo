const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const MAP_CHUNK_HEADER_ENTRIES = 4;
const MAP_CHUNK_HEADER_SIZE = UINT32_SIZE * MAP_CHUNK_HEADER_ENTRIES;
const MAP_CHUNK_UPDATE_HEADER_ENTRIES = 4;
const MAP_CHUNK_UPDATE_HEADER_SIZE = UINT32_SIZE * MAP_CHUNK_HEADER_ENTRIES;
const POINT_SIZE = 7 * FLOAT32_SIZE;

const _getItemsChunkSizeFromMetadata = metadata => {
  const {numPositions, numNormals, numColors, numIndices} = metadata;

  return MAP_CHUNK_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numNormals) +  // normals
    (FLOAT32_SIZE * numColors) + // colors
    (UINT32_SIZE * numIndices) + // indices
    (FLOAT32_SIZE * 2); // height range
};

const _getItemsChunkSize = itemsChunk => {
  const {positions, normals, colors, indices} = itemsChunk;

  const numPositions = positions.length;
  const numNormals = normals.length;
  const numColors = colors.length;
  const numIndices = indices.length;

  return _getItemsChunkSizeFromMetadata({
    numPositions,
    numNormals,
    numColors,
    numIndices,
  });
};

const _getItemsChunkBufferSize = (arrayBuffer, byteOffset) => {
  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, MAP_CHUNK_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numNormals = headerBuffer[1];
  const numColors = headerBuffer[2];
  const numIndices = headerBuffer[3];

  return _getItemsChunkSizeFromMetadata({
    numPositions,
    numNormals,
    numColors,
    numIndices,
  });
};

// stringification

const stringifyItemsChunk = (itemsChunk, arrayBuffer, byteOffset) => {
  const {positions, normals, colors, indices, heightRange} = itemsChunk;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getItemsChunkSize(itemsChunk);
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

  const heightRangeBuffer = new Float32Array(arrayBuffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (FLOAT32_SIZE * positions.length) + (FLOAT32_SIZE * normals.length) + (FLOAT32_SIZE * colors.length) + (UINT32_SIZE * indices.length), 2);
  heightRangeBuffer[0] = heightRange[0];
  heightRangeBuffer[1] = heightRange[1];

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

const stringifyItemsChunks = itemsChunks => {
  const itemsChunkSizes = itemsChunks.map(_getItemsChunkSize);
  const bufferSize = _sum(itemsChunkSizes);
  const arrayBuffer = new ArrayBuffer(bufferSize);

  let byteOffset = 0;
  for (let i = 0; i < itemsChunks.length; i++) {
    const itemsChunk = itemsChunks[i];

    stringifyItemsChunk(itemsChunk, arrayBuffer, byteOffset);

    const itemsChunkSize = itemsChunkSizes[i];
    byteOffset += itemsChunkSize;
  }

  return arrayBuffer;
};

// parsing

const parseItemsChunk = (arrayBuffer, byteOffset) => {
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

  const heightRangeBuffer = new Float32Array(arrayBuffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (FLOAT32_SIZE * numPositions) + (FLOAT32_SIZE * numNormals) + (FLOAT32_SIZE * numColors) + (UINT32_SIZE * numIndices), 2);
  const heightRange = [
    heightRangeBuffer[0],
    heightRangeBuffer[1],
  ];

  return {
    positions,
    normals,
    colors,
    indices,
    heightRange,
  };
};

const parseItemsChunks = arrayBuffer => {
  const itemsChunks = [];

  let byteOffset = 0;
  while (byteOffset < arrayBuffer.byteLength) {
    const itemsChunk = parseItemsChunk(arrayBuffer, byteOffset);
    itemsChunks.push(itemsChunk);

    const itemsChunkSize = _getItemsChunkBufferSize(arrayBuffer, byteOffset);
    byteOffset += itemsChunkSize;
  }

  return itemsChunks;
};

module.exports = {
  stringifyItemsChunk,
  stringifyItemsChunks,
  parseItemsChunk,
  parseItemsChunks,
};

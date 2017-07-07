const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const MAP_CHUNK_HEADER_ENTRIES = 5;
const MAP_CHUNK_HEADER_SIZE = UINT32_SIZE * MAP_CHUNK_HEADER_ENTRIES;

const _getItemsChunkSizeFromMetadata = metadata => {
  const {numPositions, numNormals, numColors, numIndices, numItems} = metadata;

  return MAP_CHUNK_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numNormals) +  // normals
    (FLOAT32_SIZE * numColors) + // colors
    (UINT32_SIZE * numIndices) + // indices
    (FLOAT32_SIZE * numItems) + // items
    (FLOAT32_SIZE * 2); // height range
};

const _getItemsChunkSize = itemsChunk => {
  const {positions, normals, colors, indices, items} = itemsChunk;

  const numPositions = positions.length;
  const numNormals = normals.length;
  const numColors = colors.length;
  const numIndices = indices.length;
  const numItems = items.length;

  return _getItemsChunkSizeFromMetadata({
    numPositions,
    numNormals,
    numColors,
    numIndices,
    numItems,
  });
};

const _getItemsChunkBufferSize = (arrayBuffer, byteOffset) => {
  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, MAP_CHUNK_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numNormals = headerBuffer[1];
  const numColors = headerBuffer[2];
  const numIndices = headerBuffer[3];
  const numItems = headerBuffer[4];

  return _getItemsChunkSizeFromMetadata({
    numPositions,
    numNormals,
    numColors,
    numIndices,
    numItems,
  });
};

// stringification

const stringifyItemsChunk = (itemsChunk, arrayBuffer, byteOffset) => {
  const {positions, normals, colors, indices, items, heightRange} = itemsChunk;

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
  headerBuffer[4] = items.length;
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

  const itemsBuffer = new Float32Array(arrayBuffer, byteOffset, items.length);
  itemsBuffer.set(items);
  byteOffset += FLOAT32_SIZE * items.length;

  const heightRangeBuffer = new Float32Array(arrayBuffer, byteOffset, 2);
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
  const numItems = headerBuffer[4];
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

  const itemsBuffer = new Float32Array(arrayBuffer, byteOffset, numItems);
  const items = itemsBuffer;
  byteOffset += FLOAT32_SIZE * numItems;

  const heightRangeBuffer = new Float32Array(arrayBuffer, byteOffset, 2);
  const heightRange = [
    heightRangeBuffer[0],
    heightRangeBuffer[1],
  ];

  return {
    positions,
    normals,
    colors,
    indices,
    items,
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

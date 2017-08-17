const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const DATA_HEADER_ENTRIES = 8;
const DATA_HEADER_SIZE = UINT32_SIZE * DATA_HEADER_ENTRIES;
const RENDER_HEADER_ENTRIES = 6;
const RENDER_HEADER_SIZE = UINT32_SIZE * RENDER_HEADER_ENTRIES;
const POINT_SIZE = 7 * FLOAT32_SIZE;

const _getDataChunkSizeFromMetadata = metadata => {
  const {numPositions, numColors, numIndices, numHeightfield, numStaticHeightfield, numElevations, numEther, numBoundingSphere} = metadata;

  return DATA_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numColors) + // colors
    (UINT32_SIZE * numIndices) + // indices
    (FLOAT32_SIZE * numHeightfield) + // heightfield
    (FLOAT32_SIZE * numStaticHeightfield) + // static heightfield
    (FLOAT32_SIZE * numElevations) + // elevations
    (FLOAT32_SIZE * numEther) + // ethers
    (FLOAT32_SIZE * numBoundingSphere); // bounding sphere
};

const _getDataChunkSize = mapChunk => {
  const {positions, colors, indices, heightfield, staticHeightfield, elevations, ether, boundingSphere} = mapChunk;

  const numPositions = positions.length;
  const numColors = colors.length;
  const numIndices = indices.length;
  const numHeightfield = heightfield.length;
  const numStaticHeightfield = staticHeightfield.length;
  const numElevations = elevations.length;
  const numEther = ether.length;
  const numBoundingSphere = boundingSphere.length;

  return _getDataChunkSizeFromMetadata({
    numPositions,
    numColors,
    numIndices,
    numHeightfield,
    numStaticHeightfield,
    numElevations,
    numEther,
    numBoundingSphere,
  });
};

const _getDataChunkBufferSize = (arrayBuffer, byteOffset) => {
  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, DATA_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numColors = headerBuffer[1];
  const numIndices = headerBuffer[2];
  const numHeightfield = headerBuffer[3];
  const numStaticHeightfield = headerBuffer[4];
  const numElevations = headerBuffer[5];
  const numEther = headerBuffer[6];
  const numBoundingSphere = headerBuffer[7];

  return _getDataChunkSizeFromMetadata({
    numPositions,
    numColors,
    numIndices,
    numHeightfield,
    numStaticHeightfield,
    numElevations,
    numEther,
    numBoundingSphere,
  });
};

const stringifyDataChunk = (mapChunk, arrayBuffer, byteOffset) => {
  const {positions, colors, indices, heightfield, staticHeightfield, elevations, ether, boundingSphere} = mapChunk;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getDataChunkSize(mapChunk);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, DATA_HEADER_ENTRIES);
  headerBuffer[0] = positions.length;
  headerBuffer[1] = colors.length;
  headerBuffer[2] = indices.length;
  headerBuffer[3] = heightfield.length;
  headerBuffer[4] = staticHeightfield.length;
  headerBuffer[5] = elevations.length;
  headerBuffer[6] = ether.length;
  headerBuffer[7] = boundingSphere.length;
  byteOffset += DATA_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, positions.length);
  positionsBuffer.set(positions);
  byteOffset += FLOAT32_SIZE * positions.length;

  const colorsBuffer = new Float32Array(arrayBuffer, byteOffset, colors.length);
  colorsBuffer.set(colors);
  byteOffset += FLOAT32_SIZE * colors.length;

  const indicesBuffer = new Uint32Array(arrayBuffer, byteOffset, indices.length);
  indicesBuffer.set(indices);
  byteOffset += UINT32_SIZE * indices.length;

  const heightfieldBuffer = new Float32Array(arrayBuffer, byteOffset, heightfield.length);
  heightfieldBuffer.set(heightfield);
  byteOffset += FLOAT32_SIZE * heightfield.length;

  const staticHeightfieldBuffer = new Float32Array(arrayBuffer, byteOffset, staticHeightfield.length);
  staticHeightfieldBuffer.set(staticHeightfield);
  byteOffset += FLOAT32_SIZE * staticHeightfield.length;

  const elevationsBuffer = new Float32Array(arrayBuffer, byteOffset, elevations.length);
  elevationsBuffer.set(elevations);
  byteOffset += FLOAT32_SIZE * elevations.length;

  const etherBuffer = new Float32Array(arrayBuffer, byteOffset, ether.length);
  etherBuffer.set(ether);
  byteOffset += FLOAT32_SIZE * ether.length;

  const boundingSphereBuffer = new Float32Array(arrayBuffer, byteOffset, boundingSphere.length);
  boundingSphereBuffer.set(boundingSphere);
  byteOffset += FLOAT32_SIZE * boundingSphere.length;

  return arrayBuffer;
};

const parseDataChunk = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, DATA_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numColors = headerBuffer[1];
  const numIndices = headerBuffer[2];
  const numHeightfield = headerBuffer[3];
  const numStaticHeightfield = headerBuffer[4];
  const numElevations = headerBuffer[5];
  const numEther = headerBuffer[6];
  const numBoundingSphere = headerBuffer[7];
  byteOffset += DATA_HEADER_SIZE;

  const positionsBuffer = new Float32Array(buffer, byteOffset, numPositions);
  const positions = positionsBuffer;
  byteOffset += FLOAT32_SIZE * numPositions;

  const colorsBuffer = new Float32Array(buffer, byteOffset, numColors);
  const colors = colorsBuffer;
  byteOffset += FLOAT32_SIZE * numColors;

  const indicesBuffer = new Uint32Array(buffer, byteOffset, numIndices);
  const indices = indicesBuffer;
  byteOffset += UINT32_SIZE * numIndices;

  const heightfieldBuffer = new Float32Array(buffer, byteOffset, numHeightfield);
  const heightfield = heightfieldBuffer;
  byteOffset += FLOAT32_SIZE * numHeightfield;

  const staticHeightfieldBuffer = new Float32Array(buffer, byteOffset, numStaticHeightfield);
  const staticHeightfield = staticHeightfieldBuffer;
  byteOffset += FLOAT32_SIZE * numStaticHeightfield;

  const elevationsBuffer = new Float32Array(buffer, byteOffset, numElevations);
  const elevations = elevationsBuffer;
  byteOffset += FLOAT32_SIZE * numElevations;

  const etherBuffer = new Float32Array(buffer, byteOffset, numEther);
  const ether = etherBuffer;
  byteOffset += FLOAT32_SIZE * numEther;

  const boundingSphereBuffer = new Float32Array(buffer, byteOffset, numBoundingSphere);
  const boundingSphere = boundingSphereBuffer;
  byteOffset += FLOAT32_SIZE * numBoundingSphere;

  return {
    buffer,
    positions,
    colors,
    indices,
    heightfield,
    staticHeightfield,
    elevations,
    ether,
    boundingSphere,
  };
};

const _getRenderChunkSizeFromMetadata = metadata => {
  const {numPositions, numColors, numIndices, numHeightfield, numStaticHeightfield, numBoundingSphere} = metadata;

  return RENDER_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numColors) + // colors
    (UINT32_SIZE * numIndices) + // indices
    (FLOAT32_SIZE * numHeightfield) + // heightfield
    (FLOAT32_SIZE * numStaticHeightfield) + // static heightfield
    (FLOAT32_SIZE * numBoundingSphere); // bounding sphere
};

const _getRenderChunkSize = mapChunk => {
  const {positions, colors, indices, heightfield, staticHeightfield, boundingSphere} = mapChunk;

  const numPositions = positions.length;
  const numColors = colors.length;
  const numIndices = indices.length;
  const numHeightfield = heightfield.length;
  const numStaticHeightfield = staticHeightfield.length;
  const numBoundingSphere = boundingSphere.length;

  return _getRenderChunkSizeFromMetadata({
    numPositions,
    numColors,
    numIndices,
    numHeightfield,
    numStaticHeightfield,
    numBoundingSphere,
  });
};

const _getRenderChunkBufferSize = (arrayBuffer, byteOffset) => {
  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, RENDER_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numColors = headerBuffer[1];
  const numIndices = headerBuffer[2];
  const numHeightfield = headerBuffer[3];
  const numStaticHeightfield = headerBuffer[4];
  const numBoundingSphere = headerBuffer[5];

  return _getRenderChunkSizeFromMetadata({
    numPositions,
    numColors,
    numIndices,
    numHeightfield,
    numStaticHeightfield,
    numBoundingSphere,
  });
};

const stringifyRenderChunk = (mapChunk, arrayBuffer, byteOffset) => {
  const {positions, colors, indices, heightfield, staticHeightfield, boundingSphere} = mapChunk;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getDataChunkSize(mapChunk);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, RENDER_HEADER_ENTRIES);
  headerBuffer[0] = positions.length;
  headerBuffer[1] = colors.length;
  headerBuffer[2] = indices.length;
  headerBuffer[3] = heightfield.length;
  headerBuffer[4] = staticHeightfield.length;
  headerBuffer[5] = boundingSphere.length;
  byteOffset += RENDER_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, positions.length);
  positionsBuffer.set(positions);
  byteOffset += FLOAT32_SIZE * positions.length;

  const colorsBuffer = new Float32Array(arrayBuffer, byteOffset, colors.length);
  colorsBuffer.set(colors);
  byteOffset += FLOAT32_SIZE * colors.length;

  const indicesBuffer = new Uint32Array(arrayBuffer, byteOffset, indices.length);
  indicesBuffer.set(indices);
  byteOffset += UINT32_SIZE * indices.length;

  const heightfieldBuffer = new Float32Array(arrayBuffer, byteOffset, heightfield.length);
  heightfieldBuffer.set(heightfield);
  byteOffset += FLOAT32_SIZE * heightfield.length;

  const staticHeightfieldBuffer = new Float32Array(arrayBuffer, byteOffset, staticHeightfield.length);
  staticHeightfieldBuffer.set(staticHeightfield);
  byteOffset += FLOAT32_SIZE * staticHeightfield.length;

  const boundingSphereBuffer = new Float32Array(arrayBuffer, byteOffset, boundingSphere.length);
  boundingSphereBuffer.set(boundingSphere);
  byteOffset += FLOAT32_SIZE * boundingSphere.length;

  return arrayBuffer;
};

const parseRenderChunk = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, RENDER_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numColors = headerBuffer[1];
  const numIndices = headerBuffer[2];
  const numHeightfield = headerBuffer[3];
  const numStaticHeightfield = headerBuffer[4];
  const numBoundingSphere = headerBuffer[5];
  byteOffset += RENDER_HEADER_SIZE;

  const positionsBuffer = new Float32Array(buffer, byteOffset, numPositions);
  const positions = positionsBuffer;
  byteOffset += FLOAT32_SIZE * numPositions;

  const colorsBuffer = new Float32Array(buffer, byteOffset, numColors);
  const colors = colorsBuffer;
  byteOffset += FLOAT32_SIZE * numColors;

  const indicesBuffer = new Uint32Array(buffer, byteOffset, numIndices);
  const indices = indicesBuffer;
  byteOffset += UINT32_SIZE * numIndices;

  const heightfieldBuffer = new Float32Array(buffer, byteOffset, numHeightfield);
  const heightfield = heightfieldBuffer;
  byteOffset += FLOAT32_SIZE * numHeightfield;

  const staticHeightfieldBuffer = new Float32Array(buffer, byteOffset, numStaticHeightfield);
  const staticHeightfield = staticHeightfieldBuffer;
  byteOffset += FLOAT32_SIZE * numStaticHeightfield;

  const boundingSphereBuffer = new Float32Array(buffer, byteOffset, numBoundingSphere);
  const boundingSphere = boundingSphereBuffer;
  byteOffset += FLOAT32_SIZE * numBoundingSphere;

  return {
    buffer,
    positions,
    colors,
    indices,
    heightfield,
    staticHeightfield,
    boundingSphere,
  };
};

const sliceDataHeightfield = (arrayBuffer, readByteOffset) => {
  const headerBuffer = new Uint32Array(arrayBuffer, readByteOffset, DATA_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numColors = headerBuffer[1];
  const numIndices = headerBuffer[2];
  const numHeightfield = headerBuffer[3];
  const numStaticHeightfield = headerBuffer[4];
  const numEther = headerBuffer[5];
  const numBoundingSphere = headerBuffer[6];
  readByteOffset += DATA_HEADER_SIZE + FLOAT32_SIZE * numPositions + FLOAT32_SIZE * numColors + UINT32_SIZE * numIndices;

  const heightfieldBuffer = new Float32Array(arrayBuffer, readByteOffset, numHeightfield);
  readByteOffset += FLOAT32_SIZE * numHeightfield + FLOAT32_SIZE * numStaticHeightfield + FLOAT32_SIZE * numEther + FLOAT32_SIZE * numBoundingSphere;

  const resultArrayBuffer = new ArrayBuffer(UINT32_SIZE + FLOAT32_SIZE * numHeightfield + FLOAT32_SIZE * 2);
  let writeByteOffset = 0;
  new Uint32Array(resultArrayBuffer, writeByteOffset, 1)[0] = numHeightfield;
  writeByteOffset += UINT32_SIZE;
  new Float32Array(resultArrayBuffer, writeByteOffset, numHeightfield).set(heightfieldBuffer);
  writeByteOffset += FLOAT32_SIZE * numHeightfield;

  return resultArrayBuffer;
};
const parseHeightfield = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, 1);
  const numHeightfield = headerBuffer[0];
  byteOffset += UINT32_SIZE * 1;

  const heightfieldBuffer = new Float32Array(buffer, byteOffset, numHeightfield);
  const heightfield = heightfieldBuffer;
  byteOffset += FLOAT32_SIZE * numHeightfield;

  return {
    heightfield,
  };
};

module.exports = {
  stringifyDataChunk,
  parseDataChunk,

  stringifyRenderChunk,
  parseRenderChunk,

  sliceDataHeightfield,
  parseHeightfield,
};

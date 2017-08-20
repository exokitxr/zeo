const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const UINT8_SIZE = 1;
const DATA_HEADER_ENTRIES = (4 * 5) + 4;
const DATA_HEADER_SIZE = UINT32_SIZE * DATA_HEADER_ENTRIES;
const RENDER_HEADER_ENTRIES = (4 * 5) + 3;
const RENDER_HEADER_SIZE = UINT32_SIZE * RENDER_HEADER_ENTRIES;

const _getDataChunkSizeFromMetadata = metadata => {
  const {numPositions, numColors, numIndices, numBoundingSphere, numPeeks, numHeightfield, numStaticHeightfield, numElevations, numEther} = metadata;

  return DATA_HEADER_SIZE + // header
    (FLOAT32_SIZE * _sum(numPositions)) + // positions
    (FLOAT32_SIZE * _sum(numColors)) + // colors
    (UINT32_SIZE * _sum(numIndices)) + // indices
    (FLOAT32_SIZE * _sum(numBoundingSphere)) + // bounding sphere
    (UINT8_SIZE * _sum(numPeeks)) + // peeks
    (FLOAT32_SIZE * numHeightfield) + // heightfield
    (FLOAT32_SIZE * numStaticHeightfield) + // static heightfield
    (FLOAT32_SIZE * numElevations) + // elevations
    (FLOAT32_SIZE * numEther); // ethers
};

const _getDataChunkSize = mapChunk => {
  const {geometries, heightfield, staticHeightfield, elevations, ether} = mapChunk;

  const numPositions = Array(4);
  const numColors = Array(4);
  const numIndices = Array(4);
  const numBoundingSphere = Array(4);
  const numPeeks = Array(4);
  for (let i = 0; i < 4; i++) {
    const geometry = geometries[i];
    const {positions, colors, indices, peeks} = geometry;
    numPositions[i] = positions.length;
    numColors[i] = colors.length;
    numIndices[i] = indices.length;
    numBoundingSphere[i] = boundingSphere.length;
    numPeeks[i] = peeks.length;
  }
  const numHeightfield = heightfield.length;
  const numStaticHeightfield = staticHeightfield.length;
  const numElevations = elevations.length;
  const numEther = ether.length;

  return _getDataChunkSizeFromMetadata({
    numPositions,
    numColors,
    numIndices,
    numBoundingSphere,
    numHeightfield,
    numStaticHeightfield,
    numElevations,
    numEther,
  });
};

/* const _getDataChunkBufferSize = (arrayBuffer, byteOffset) => {
  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, DATA_HEADER_ENTRIES);

  let index = 0;
  const numPositions = Array(4);
  const numColors = Array(4);
  const numIndices = Array(4);
  const numBoundingSphere = Array(4);
  const numPeeks = Array(4);
  for (let i = 0; i < 4; i++) {
    numPositions[i] = headerBuffer[index++];
    numColors[i] = headerBuffer[index++];
    numIndices[i] = headerBuffer[index++];
    numBoundingSphere[i] = headerBuffer[index++];
    numPeeks[i] = headerBuffer[index++];
  }
  const numHeightfield = headerBuffer[index++];
  const numStaticHeightfield = headerBuffer[index++];
  const numElevations = headerBuffer[index++];
  const numEther = headerBuffer[index++];

  return _getDataChunkSizeFromMetadata({
    numPositions,
    numColors,
    numIndices,
    numBoundingSphere,
    numHeightfield,
    numStaticHeightfield,
    numElevations,
    numEther,
  });
}; */

const stringifyDataChunk = (mapChunk, arrayBuffer, byteOffset) => {
  const {geometries, heightfield, staticHeightfield, elevations, ether} = mapChunk;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getDataChunkSize(mapChunk);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, DATA_HEADER_ENTRIES);
  let index = 0;
  for (let i = 0; i < 4; i++) {
    const geometry = geometries[i];
    const {positions, colors, indices, boundingSphere, peeks} = geometry;
    headerBuffer[index++] = positions.length;
    headerBuffer[index++] = colors.length;
    headerBuffer[index++] = indices.length;
    headerBuffer[index++] = boundingSphere.length;
    headerBuffer[index++] = peeks.length;
  }
  headerBuffer[index++] = heightfield.length;
  headerBuffer[index++] = staticHeightfield.length;
  headerBuffer[index++] = elevations.length;
  headerBuffer[index++] = ether.length;
  byteOffset += DATA_HEADER_SIZE;

  for (let i = 0; i < 4; i++) {
    const geometry = geometries[i];
    const {positions, colors, indices, boundingSphere, peeks} = geometry;

    const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, positions.length);
    positionsBuffer.set(positions);
    byteOffset += FLOAT32_SIZE * positions.length;

    const colorsBuffer = new Float32Array(arrayBuffer, byteOffset, colors.length);
    colorsBuffer.set(colors);
    byteOffset += FLOAT32_SIZE * colors.length;

    const indicesBuffer = new Uint32Array(arrayBuffer, byteOffset, indices.length);
    indicesBuffer.set(indices);
    byteOffset += UINT32_SIZE * indices.length;

    const boundingSphereBuffer = new Float32Array(arrayBuffer, byteOffset, boundingSphere.length);
    boundingSphereBuffer.set(boundingSphere);
    byteOffset += FLOAT32_SIZE * boundingSphere.length;

    const peeksBuffer = new Uint8Array(arrayBuffer, byteOffset, peeks.length);
    peeksBuffer.set(peeks);
    byteOffset += UINT8_SIZE * peeks.length;
  }

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

  return arrayBuffer;
};

const parseDataChunk = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, DATA_HEADER_ENTRIES);
  let index = 0;
  const numPositions = Array(4);
  const numColors = Array(4);
  const numIndices = Array(4);
  const numBoundingSphere = Array(4);
  const numPeeks = Array(4);
  for (let i = 0; i < 4; i++) {
    numPositions[i] = headerBuffer[index++];
    numColors[i] = headerBuffer[index++];
    numIndices[i] = headerBuffer[index++];
    numBoundingSphere[i] = headerBuffer[index++];
    numPeeks[i] = headerBuffer[index++];
  }
  const numHeightfield = headerBuffer[index++];
  const numStaticHeightfield = headerBuffer[index++];
  const numElevations = headerBuffer[index++];
  const numEther = headerBuffer[index++];
  byteOffset += DATA_HEADER_SIZE;

  const geometries = Array(4);
  for (let i = 0; i < 4; i++) {
    const positionsBuffer = new Float32Array(buffer, byteOffset, numPositions[i]);
    const positions = positionsBuffer;
    byteOffset += FLOAT32_SIZE * numPositions[i];

    const colorsBuffer = new Float32Array(buffer, byteOffset, numColors[i]);
    const colors = colorsBuffer;
    byteOffset += FLOAT32_SIZE * numColors[i];

    const indicesBuffer = new Uint32Array(buffer, byteOffset, numIndices[i]);
    const indices = indicesBuffer;
    byteOffset += UINT32_SIZE * numIndices[i];

    const boundingSphereBuffer = new Float32Array(buffer, byteOffset, numBoundingSphere[i]);
    const boundingSphere = boundingSphereBuffer;
    byteOffset += FLOAT32_SIZE * numBoundingSphere[i];

    const peeksBuffer = new Uint8Array(buffer, byteOffset, numPeeks[i]);
    const peeks = peeksBuffer;
    byteOffset += UINT8_SIZE * numPeeks[i];

    geometries[i] = {
      positions,
      colors,
      indices,
      boundingSphere,
      peeks,
    };
  }

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

  return {
    buffer,
    geometries,
    heightfield,
    staticHeightfield,
    elevations,
    ether,
  };
};

const _getRenderChunkSizeFromMetadata = metadata => {
  const {numPositions, numColors, numIndices, numBoundingSphere, numHeightfield, numStaticHeightfield, numEther} = metadata;

  return RENDER_HEADER_SIZE + // header
    (FLOAT32_SIZE * _sum(numPositions)) + // positions
    (FLOAT32_SIZE * _sum(numColors)) + // colors
    (UINT32_SIZE * _sum(numIndices)) + // indices
    (FLOAT32_SIZE * _sum(numBoundingSphere)) + // bounding sphere
    (FLOAT32_SIZE * numHeightfield) + // heightfield
    (FLOAT32_SIZE * numStaticHeightfield) + // static heightfield
    (FLOAT32_SIZE * numEther); // ether
};

const _getRenderChunkSize = mapChunk => {
  const {geometries, heightfield, staticHeightfield} = mapChunk;

  const numPositions = Array(4);
  const numColors = Array(4);
  const numIndices = Array(4);
  const numBoundingSphere = Array(4);
  const numPeeks = Array(4);
  for (let i = 0; i < 4; i++) {
    const geometry = geometries[i];
    const {positions, colors, indices, boundingSphere, peeks} = geometry;
    numPositions[i] = positions.length;
    numColors[i] = colors.length;
    numIndices[i] = indices.length;
    numBoundingSphere[i] = boundingSphere.length;
    numPeeks[i] = peeks.length;
  }
  const numHeightfield = heightfield.length;
  const numStaticHeightfield = staticHeightfield.length;
  const numEther = ether.length;

  return _getRenderChunkSizeFromMetadata({
    numPositions,
    numColors,
    numIndices,
    numBoundingSphere,
    numHeightfield,
    numStaticHeightfield,
    numEther,
  });
};

/* const _getRenderChunkBufferSize = (arrayBuffer, byteOffset) => {
  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, RENDER_HEADER_ENTRIES);

  let index = 0;
  const numPositions = Array(4);
  const numColors = Array(4);
  const numIndices = Array(4);
  const numBoundingSphere = Array(4);
  const numPeeks = Array(4);
  for (let i = 0; i < 4; i++) {
    numPositions[i] = headerBuffer[index++];
    numColors[i] = headerBuffer[index++];
    numIndices[i] = headerBuffer[index++];
    numBoundingSphere[i] = headerBuffer[index++];
    numPeeks[i] = headerBuffer[index++];
  }
  const numHeightfield = headerBuffer[index++];
  const numStaticHeightfield = headerBuffer[index++];
  const numEther = headerBuffer[index++];

  return _getRenderChunkSizeFromMetadata({
    numPositions,
    numColors,
    numIndices,
    numBoundingSphere,
    numHeightfield,
    numStaticHeightfield,
    numEther,
  });
}; */

const stringifyRenderChunk = (mapChunk, arrayBuffer, byteOffset) => {
  const {geometries, heightfield, staticHeightfield, ether} = mapChunk;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getDataChunkSize(mapChunk);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, RENDER_HEADER_ENTRIES);
  let index = 0;
  for (let i = 0; i < 4; i++) {
    const geometry = geometries[i];
    const {positions, colors, indices, boundingSphere, peeks} = geometry;
    headerBuffer[index++] = positions.length;
    headerBuffer[index++] = colors.length;
    headerBuffer[index++] = indices.length;
    headerBuffer[index++] = boundingSphere.length;
    headerBuffer[index++] = peeks.length;
  }
  headerBuffer[index++] = heightfield.length;
  headerBuffer[index++] = staticHeightfield.length;
  headerBuffer[index++] = ether.length;
  byteOffset += RENDER_HEADER_SIZE;

  for (let i = 0; i < 4; i++) {
    const geometry = geometries[i];
    const {positions, colors, indices, boundingSphere, peeks} = geometry;

    const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, positions.length);
    positionsBuffer.set(positions);
    byteOffset += FLOAT32_SIZE * positions.length;

    const colorsBuffer = new Float32Array(arrayBuffer, byteOffset, colors.length);
    colorsBuffer.set(colors);
    byteOffset += FLOAT32_SIZE * colors.length;

    const indicesBuffer = new Uint32Array(arrayBuffer, byteOffset, indices.length);
    indicesBuffer.set(indices);
    byteOffset += UINT32_SIZE * indices.length;

    const boundingSphereBuffer = new Float32Array(arrayBuffer, byteOffset, boundingSphere.length);
    boundingSphereBuffer.set(boundingSphere);
    byteOffset += FLOAT32_SIZE * boundingSphere.length;

    const peeksBuffer = new Uint8Array(arrayBuffer, byteOffset, peeks.length);
    peeksBuffer.set(peeks);
    byteOffset += UINT8_SIZE * peeks.length;
  }

  const heightfieldBuffer = new Float32Array(arrayBuffer, byteOffset, heightfield.length);
  heightfieldBuffer.set(heightfield);
  byteOffset += FLOAT32_SIZE * heightfield.length;

  const staticHeightfieldBuffer = new Float32Array(arrayBuffer, byteOffset, staticHeightfield.length);
  staticHeightfieldBuffer.set(staticHeightfield);
  byteOffset += FLOAT32_SIZE * staticHeightfield.length;

  const etherBuffer = new Float32Array(arrayBuffer, byteOffset, ether.length);
  etherBuffer.set(ether);
  byteOffset += FLOAT32_SIZE * ether.length;

  return arrayBuffer;
};

const parseRenderChunk = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, RENDER_HEADER_ENTRIES);
  let index = 0;
  const numPositions = Array(4);
  const numColors = Array(4);
  const numIndices = Array(4);
  const numBoundingSphere = Array(4);
  const numPeeks = Array(4);
  for (let i = 0; i < 4; i++) {
    numPositions[i] = headerBuffer[index++];
    numColors[i] = headerBuffer[index++];
    numIndices[i] = headerBuffer[index++];
    numBoundingSphere[i] = headerBuffer[index++];
    numPeeks[i] = headerBuffer[index++];
  }
  const numHeightfield = headerBuffer[index++];
  const numStaticHeightfield = headerBuffer[index++];
  const numElevations = headerBuffer[index++];
  const numEther = headerBuffer[index++];
  byteOffset += RENDER_HEADER_SIZE;

  const geometries = Array(4);
  for (let i = 0; i < 4; i++) {
    const positionsBuffer = new Float32Array(buffer, byteOffset, numPositions[i]);
    const positions = positionsBuffer;
    byteOffset += FLOAT32_SIZE * numPositions[i];

    const colorsBuffer = new Float32Array(buffer, byteOffset, numColors[i]);
    const colors = colorsBuffer;
    byteOffset += FLOAT32_SIZE * numColors[i];

    const indicesBuffer = new Uint32Array(buffer, byteOffset, numIndices[i]);
    const indices = indicesBuffer;
    byteOffset += UINT32_SIZE * numIndices[i];

    const boundingSphereBuffer = new Float32Array(buffer, byteOffset, numBoundingSphere[i]);
    const boundingSphere = boundingSphereBuffer;
    byteOffset += FLOAT32_SIZE * numBoundingSphere[i];

    const peeksBuffer = new Uint8Array(buffer, byteOffset, numPeeks[i]);
    const peeks = peeksBuffer;
    byteOffset += UINT8_SIZE * numPeeks[i];

    geometries[i] = {
      positions,
      colors,
      indices,
      boundingSphere,
      peeks,
    };
  }

  const heightfieldBuffer = new Float32Array(buffer, byteOffset, numHeightfield);
  const heightfield = heightfieldBuffer;
  byteOffset += FLOAT32_SIZE * numHeightfield;

  const staticHeightfieldBuffer = new Float32Array(buffer, byteOffset, numStaticHeightfield);
  const staticHeightfield = staticHeightfieldBuffer;
  byteOffset += FLOAT32_SIZE * numStaticHeightfield;

  const etherBuffer = new Float32Array(buffer, byteOffset, numEther);
  const ether = etherBuffer;
  byteOffset += FLOAT32_SIZE * numEther;

  return {
    buffer,
    geometries,
    heightfield,
    staticHeightfield,
    ether,
  };
};

const sliceDataHeightfield = (arrayBuffer, readByteOffset) => {
  const headerBuffer = new Uint32Array(arrayBuffer, readByteOffset, DATA_HEADER_ENTRIES);
  let index = 0;
  const numPositions = Array(4);
  const numColors = Array(4);
  const numIndices = Array(4);
  const numBoundingSphere = Array(4);
  const numPeeks = Array(4);
  for (let i = 0; i < 4; i++) {
    numPositions[i] = headerBuffer[index++];
    numColors[i] = headerBuffer[index++];
    numIndices[i] = headerBuffer[index++];
    numBoundingSphere[i] = headerBuffer[index++];
    numPeeks[i] = headerBuffer[index++];
  }
  const numHeightfield = headerBuffer[index++];
  const numStaticHeightfield = headerBuffer[index++];
  const numElevations = headerBuffer[index++];
  const numEther = headerBuffer[index++];
  readByteOffset += DATA_HEADER_SIZE + FLOAT32_SIZE * _sum(numPositions) + FLOAT32_SIZE * _sum(numColors) + UINT32_SIZE * _sum(numIndices) + FLOAT32_SIZE * _sum(numBoundingSphere) + UINT8_SIZE * _sum(numPeeks);

  const heightfieldBuffer = new Float32Array(arrayBuffer, readByteOffset, numHeightfield);
  readByteOffset += FLOAT32_SIZE * numHeightfield + FLOAT32_SIZE * numStaticHeightfield + FLOAT32_SIZE * numEther;

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

const _sum = a => {
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result += a[i];
  }
  return result;
};

module.exports = {
  stringifyDataChunk,
  parseDataChunk,

  stringifyRenderChunk,
  parseRenderChunk,

  sliceDataHeightfield,
  parseHeightfield,
};

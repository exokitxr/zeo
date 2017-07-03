const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const MAP_CHUNK_HEADER_ENTRIES = 4;
const MAP_CHUNK_HEADER_SIZE = UINT32_SIZE * MAP_CHUNK_HEADER_ENTRIES;

const _getGeometrySizeFromMetadata = metadata => {
  const {numPositions, numUnindexedPositions, numNormals, numColors, numIndices} = metadata;

  return MAP_CHUNK_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // indexed positions
    (FLOAT32_SIZE * numUnindexedPositions) + // unindexed positions
    (FLOAT32_SIZE * numNormals) +  // normals
    (UINT32_SIZE * numIndices);// indices
};

const _getGeometrySize = geometry => {
  const {positions, unindexedPositions, normals, indices} = geometry;

  const numPositions = positions.length;
  const numUnindexedPositions = unindexedPositions.length;
  const numNormals = normals.length;
  const numIndices = indices.length;

  return _getGeometrySizeFromMetadata({
    numPositions,
    numUnindexedPositions,
    numNormals,
    numIndices,
  });
};

// stringification

const stringifyGeometry = (geometry, arrayBuffer, byteOffset) => {
  const {positions, unindexedPositions, normals, indices} = geometry;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getGeometrySize(geometry);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, MAP_CHUNK_HEADER_ENTRIES);
  headerBuffer[0] = positions.length;
  headerBuffer[1] = unindexedPositions.length;
  headerBuffer[2] = normals.length;
  headerBuffer[3] = indices.length;
  byteOffset += MAP_CHUNK_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, positions.length);
  positionsBuffer.set(positions);
  byteOffset += FLOAT32_SIZE * positions.length;

  const unindexedPositionsBuffer = new Float32Array(arrayBuffer, byteOffset, unindexedPositions.length);
  unindexedPositionsBuffer.set(unindexedPositions);
  byteOffset += FLOAT32_SIZE * unindexedPositions.length;

  const normalsBuffer = new Float32Array(arrayBuffer, byteOffset, normals.length);
  normalsBuffer.set(normals);
  byteOffset += FLOAT32_SIZE * normals.length;

  const indicesBuffer = new Uint32Array(arrayBuffer, byteOffset, indices.length);
  indicesBuffer.set(indices);
  byteOffset += UINT32_SIZE * indices.length;

  return arrayBuffer;
};

// parsing

const parseGeometry = (arrayBuffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, MAP_CHUNK_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numUnindexedPositions = headerBuffer[1];
  const numNormals = headerBuffer[2];
  const numIndices = headerBuffer[3];
  byteOffset += MAP_CHUNK_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, numPositions);
  const positions = positionsBuffer;
  byteOffset += FLOAT32_SIZE * numPositions;

  const unindexedPositionsBuffer = new Float32Array(arrayBuffer, byteOffset, numUnindexedPositions);
  const unindexedPositions = unindexedPositionsBuffer;
  byteOffset += FLOAT32_SIZE * numUnindexedPositions;

  const normalsBuffer = new Float32Array(arrayBuffer, byteOffset, numNormals);
  const normals = normalsBuffer;
  byteOffset += FLOAT32_SIZE * numNormals;

  const indicesBuffer = new Uint32Array(arrayBuffer, byteOffset, numIndices);
  const indices = indicesBuffer;
  byteOffset += UINT32_SIZE * numIndices;

  return {
    positions,
    unindexedPositions,
    normals,
    indices,
  };
};

module.exports = {
  stringifyGeometry,
  parseGeometry,
};

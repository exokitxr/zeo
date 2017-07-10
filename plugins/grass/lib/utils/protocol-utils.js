const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const UINT16_SIZE = 2;
const GRASS_GEOMETRY_HEADER_ENTRIES = 3;
const GRASS_GEOMETRY_HEADER_SIZE = UINT32_SIZE * GRASS_GEOMETRY_HEADER_ENTRIES;

const _getGrassGeometrySizeFromMetadata = metadata => {
  const {numPositions, numNormals, numUvs, numIndices} = metadata;

  return GRASS_GEOMETRY_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numUvs) + // uvs
    (FLOAT32_SIZE * numIndices) + // indices
    (FLOAT32_SIZE * 2); // height range
};

const _getGrassGeometrySize = grassGeometry => {
  const {positions, uvs, indices} = grassGeometry;

  const numPositions = positions.length;
  const numUvs = uvs.length
  const numIndices = indices.length

  return _getGrassGeometrySizeFromMetadata({
    numPositions,
    numUvs,
    numIndices,
  });
};

const _getGrassGeometryBufferSize = (arrayBuffer, byteOffset) => {
  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, GRASS_GEOMETRY_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numUvs = headerBuffer[1];
  const numIndices = headerBuffer[2];

  return _getGrassGeometrySizeFromMetadata({
    numPositions,
    numUvs,
    numIndices,
  });
};

// stringification

const stringifyGrassGeometry = (grassGeometry, arrayBuffer, byteOffset) => {
  const {positions, uvs, indices, heightRange} = grassGeometry;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getGrassGeometrySize(grassGeometry);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, GRASS_GEOMETRY_HEADER_ENTRIES);
  headerBuffer[0] = positions.length;
  headerBuffer[1] = uvs.length;
  headerBuffer[2] = indices.length;
  byteOffset += GRASS_GEOMETRY_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, positions.length);
  positionsBuffer.set(positions);
  byteOffset += FLOAT32_SIZE * positions.length;

  const uvsBuffer = new Float32Array(arrayBuffer, byteOffset, uvs.length);
  uvsBuffer.set(uvs);
  byteOffset += FLOAT32_SIZE * uvs.length;

  const indicesBuffer = new Uint16Array(arrayBuffer, byteOffset, indices.length);
  indicesBuffer.set(indices);
  byteOffset += UINT16_SIZE * indices.length;

  const heightRangeBuffer = new Float32Array(arrayBuffer, byteOffset, 2);
  heightRangeBuffer[0] = heightRange[0];
  heightRangeBuffer[1] = heightRange[1];
  byteOffset += FLOAT32_SIZE * 2;

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

const stringifyGrassGeometries = grassGeometrys => {
  const grassGeometrySizes = grassGeometrys.map(_getGrassGeometrySize);
  const bufferSize = _sum(grassGeometrySizes);
  const arrayBuffer = new ArrayBuffer(bufferSize);

  let byteOffset = 0;
  for (let i = 0; i < grassGeometrys.length; i++) {
    const grassGeometry = grassGeometrys[i];

    stringifyGrassGeometry(grassGeometry, arrayBuffer, byteOffset);

    const grassGeometrySize = grassGeometrySizes[i];
    byteOffset += grassGeometrySize;
  }

  return arrayBuffer;
};

// parsing

const parseGrassGeometry = (arrayBuffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, GRASS_GEOMETRY_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numUvs = headerBuffer[1];
  const numIndices = headerBuffer[2];
  byteOffset += GRASS_GEOMETRY_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, numPositions);
  const positions = positionsBuffer;
  byteOffset += FLOAT32_SIZE * numPositions;

  const uvBuffer = new Float32Array(arrayBuffer, byteOffset, numUvs);
  const uvs = uvBuffer;
  byteOffset += FLOAT32_SIZE * numUvs;

  const indicesBuffer = new Uint16Array(arrayBuffer, byteOffset, numIndices);
  const indices = indicesBuffer;
  byteOffset += UINT16_SIZE * numIndices;

  const heightRangeBuffer = new Float32Array(arrayBuffer, byteOffset, 2);
  const heightRange = [
    heightRangeBuffer[0],
    heightRangeBuffer[1],
  ];
  byteOffset += FLOAT32_SIZE * 2;

  return {
    positions,
    uvs,
    indices,
    heightRange,
  };
};

const parseGrassGeometries = arrayBuffer => {
  const grassGeometries = [];

  let byteOffset = 0;
  while (byteOffset < arrayBuffer.byteLength) {
    const grassGeometry = parseGrassGeometry(arrayBuffer, byteOffset);
    grassGeometries.push(grassGeometry);

    const grassGeometrySize = _getGrassGeometryBufferSize(arrayBuffer, byteOffset);
    byteOffset += grassGeometrySize;
  }

  return grassGeometries;
};

module.exports = {
  stringifyGrassGeometry,
  stringifyGrassGeometries,
  parseGrassGeometry,
  parseGrassGeometries,
};

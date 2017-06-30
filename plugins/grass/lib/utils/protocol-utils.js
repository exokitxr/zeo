const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const GRASS_GEOMETRY_HEADER_ENTRIES = 2;
const GRASS_GEOMETRY_HEADER_SIZE = UINT32_SIZE * GRASS_GEOMETRY_HEADER_ENTRIES;

const _getGrassGeometrySizeFromMetadata = metadata => {
  const {numPositions, numNormals, numColors, numIndices} = metadata;

  return GRASS_GEOMETRY_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numColors) + // colors
    (FLOAT32_SIZE * 2); // height range
};

const _getGrassGeometrySize = grassGeometry => {
  const {positions, colors} = grassGeometry;

  const numPositions = positions.length;
  const numColors = colors.length;

  return _getGrassGeometrySizeFromMetadata({
    numPositions,
    numColors,
  });
};

const _getGrassGeometryBufferSize = (arrayBuffer, byteOffset) => {
  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, GRASS_GEOMETRY_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numColors = headerBuffer[1];

  return _getGrassGeometrySizeFromMetadata({
    numPositions,
    numColors,
  });
};

// stringification

const stringifyGrassGeometry = (grassGeometry, arrayBuffer, byteOffset) => {
  const {positions, colors, heightRange} = grassGeometry;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getGrassGeometrySize(grassGeometry);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, GRASS_GEOMETRY_HEADER_ENTRIES);
  headerBuffer[0] = positions.length;
  headerBuffer[1] = colors.length;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset + GRASS_GEOMETRY_HEADER_SIZE, positions.length);
  positionsBuffer.set(positions);

  const colorsBuffer = new Float32Array(arrayBuffer, byteOffset + GRASS_GEOMETRY_HEADER_SIZE + (FLOAT32_SIZE * positions.length), colors.length);
  colorsBuffer.set(colors);

  const heightRangeBuffer = new Float32Array(arrayBuffer, byteOffset + GRASS_GEOMETRY_HEADER_SIZE + (FLOAT32_SIZE * positions.length) + (FLOAT32_SIZE * colors.length), 2);
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
  const numColors = headerBuffer[1];

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset + GRASS_GEOMETRY_HEADER_SIZE, numPositions);
  const positions = positionsBuffer;

  const colorsBuffer = new Float32Array(arrayBuffer, byteOffset + GRASS_GEOMETRY_HEADER_SIZE + (FLOAT32_SIZE * numPositions), numColors);
  const colors = colorsBuffer;

  const heightRangeBuffer = new Float32Array(arrayBuffer, byteOffset + GRASS_GEOMETRY_HEADER_SIZE + (FLOAT32_SIZE * numPositions) + (FLOAT32_SIZE * numColors), 2);
  const heightRange = [
    heightRangeBuffer[0],
    heightRangeBuffer[1],
  ];

  return {
    positions,
    colors,
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

  return grassGeometrys;
};

module.exports = {
  stringifyGrassGeometry,
  stringifyGrassGeometries,
  parseGrassGeometry,
  parseGrassGeometries,
};

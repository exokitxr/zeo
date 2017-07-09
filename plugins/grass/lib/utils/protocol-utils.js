const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const UINT8_SIZE = 1;
const GRASS_GEOMETRY_HEADER_ENTRIES = 3;
const GRASS_GEOMETRY_HEADER_SIZE = UINT32_SIZE * GRASS_GEOMETRY_HEADER_ENTRIES;

const _getGrassGeometrySizeFromMetadata = metadata => {
  const {numPositions, numNormals, numColors, numTextureAtlas} = metadata;

  return GRASS_GEOMETRY_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numColors) + // colors
    (UINT8_SIZE * numTextureAtlas) + // texture atlas
    (FLOAT32_SIZE * 2); // height range
};

const _getGrassGeometrySize = grassGeometry => {
  const {positions, colors, textureAtlas} = grassGeometry;

  const numPositions = positions.length;
  const numColors = colors.length;
  const numTextureAtlas = textureAtlas.length;

  return _getGrassGeometrySizeFromMetadata({
    numPositions,
    numColors,
    numTextureAtlas,
  });
};

const _getGrassGeometryBufferSize = (arrayBuffer, byteOffset) => {
  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, GRASS_GEOMETRY_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numColors = headerBuffer[1];
  const numTextureAtlas = headerBuffer[2];

  return _getGrassGeometrySizeFromMetadata({
    numPositions,
    numColors,
    numTextureAtlas,
  });
};

// stringification

const stringifyGrassGeometry = (grassGeometry, arrayBuffer, byteOffset) => {
  const {positions, colors, textureAtlas, heightRange} = grassGeometry;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getGrassGeometrySize(grassGeometry);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, GRASS_GEOMETRY_HEADER_ENTRIES);
  headerBuffer[0] = positions.length;
  headerBuffer[1] = colors.length;
  headerBuffer[2] = textureAtlas.length;
  byteOffset += GRASS_GEOMETRY_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, positions.length);
  positionsBuffer.set(positions);
  byteOffset += FLOAT32_SIZE * positions.length;

  const colorsBuffer = new Float32Array(arrayBuffer, byteOffset, colors.length);
  colorsBuffer.set(colors);
  byteOffset += FLOAT32_SIZE * colors.length;

  const textureAtlasBuffer = new Uint8Array(arrayBuffer, byteOffset, textureAtlas.length);
  textureAtlasBuffer.set(textureAtlas);
  byteOffset += UINT8_SIZE * textureAtlas.length;

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
  const numColors = headerBuffer[1];
  const numTextureAtlas = headerBuffer[2];
  byteOffset += GRASS_GEOMETRY_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, numPositions);
  const positions = positionsBuffer;
  byteOffset += FLOAT32_SIZE * numPositions;

  const colorsBuffer = new Float32Array(arrayBuffer, byteOffset, numColors);
  const colors = colorsBuffer;
  byteOffset += FLOAT32_SIZE * numColors;

  const textureAtlasBuffer = new Uint8Array(arrayBuffer, byteOffset, numTextureAtlas);
  const textureAtlas = textureAtlasBuffer;
  byteOffset += UINT8_SIZE * numTextureAtlas;

  const heightRangeBuffer = new Float32Array(arrayBuffer, byteOffset, 2);
  const heightRange = [
    heightRangeBuffer[0],
    heightRangeBuffer[1],
  ];
  byteOffset += FLOAT32_SIZE * 2;

  return {
    positions,
    colors,
    textureAtlas,
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

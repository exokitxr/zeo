const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const MAP_CHUNK_HEADER_ENTRIES = 6;
const MAP_CHUNK_HEADER_SIZE = UINT32_SIZE * MAP_CHUNK_HEADER_ENTRIES;
const POINT_SIZE = 7 * FLOAT32_SIZE;

class MapPoint {
  constructor(
    elevation = 0,
    moisture = 0,
    land = false,
    water = false,
    ocean = false,
    lake = false,
    lava = 0
  ) {
    this.elevation = elevation;
    this.moisture = moisture;
    this.land = land;
    this.water = water;
    this.ocean = ocean;
    this.lake = lake;
    this.lava = lava;
  }
}

const _getMapChunkSizeFromMetadata = metadata => {
  const {numPoints, numPositions, /*numNormals, */numColors, numHeightfield, numStaticHeightfield} = metadata;

  return MAP_CHUNK_HEADER_SIZE + // header
    (POINT_SIZE * numPoints) + // points
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numColors) + // colors
    (UINT32_SIZE * numIndices) + // indices
    (FLOAT32_SIZE * numHeightfield) + // heightfield
    (FLOAT32_SIZE * numStaticHeightfield) + // static heightfield
    (FLOAT32_SIZE * 2); // height range
};

const _getMapChunkSize = mapChunk => {
  const {points, positions, colors, indices, heightfield, staticHeightfield} = mapChunk;

  const numPoints = points.length;
  const numPositions = positions.length;
  const numColors = colors.length;
  const numIndices = indices.length;
  const numHeightfield = heightfield.length;
  const numStaticHeightfield = staticHeightfield.length;

  return _getMapChunkSizeFromMetadata({
    numPoints,
    numPositions,
    numColors,
    numIndices,
    numHeightfield,
    numStaticHeightfield,
  });
};

const _getMapChunkBufferSize = (arrayBuffer, byteOffset) => {
  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, MAP_CHUNK_HEADER_ENTRIES);
  const numPoints = headerBuffer[0];
  const numPositions = headerBuffer[1];
  const numColors = headerBuffer[2];
  const numIndices = headerBuffer[3];
  const numHeightfield = headerBuffer[4];
  const numStaticHeightfield = headerBuffer[5];

  return _getMapChunkSizeFromMetadata({
    numPoints,
    numPositions,
    numColors,
    numIndices,
    numHeightfield,
    numStaticHeightfield,
  });
};

// stringification

const stringifyMapChunk = (mapChunk, arrayBuffer, byteOffset) => {
  const {points, positions, colors, indices, heightfield, staticHeightfield, heightRange} = mapChunk;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getMapChunkSize(mapChunk);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, MAP_CHUNK_HEADER_ENTRIES);
  headerBuffer[0] = points.length;
  headerBuffer[1] = positions.length;
  headerBuffer[2] = colors.length;
  headerBuffer[3] = indices.length;
  headerBuffer[4] = heightfield.length;
  headerBuffer[5] = staticHeightfield.length;
  byteOffset += MAP_CHUNK_HEADER_SIZE;

  const pointsBuffer = new Float32Array(arrayBuffer, byteOffset, points.length * 7);
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const {elevation, moisture, land, water, ocean, lake, lava} = point;
    const index = i * 7;

    pointsBuffer[index + 0] = elevation;
    pointsBuffer[index + 1] = moisture;
    pointsBuffer[index + 2] = land ? 1 : 0;
    pointsBuffer[index + 3] = water ? 1 : 0;
    pointsBuffer[index + 4] = ocean ? 1 : 0;
    pointsBuffer[index + 5] = lake ? 1 : 0;
    pointsBuffer[index + 6] = lava;
  }
  byteOffset += POINT_SIZE * points.length;

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

  const heightRangeBuffer = new Float32Array(arrayBuffer, byteOffset, 2);
  heightRangeBuffer[0] = heightRange[0];
  heightRangeBuffer[1] = heightRange[1];
  byteOffset += FLOAT32_SIZE * 2;

  return arrayBuffer;
};

// parsing

const parseMapChunk = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, MAP_CHUNK_HEADER_ENTRIES);
  const numPoints = headerBuffer[0];
  const numPositions = headerBuffer[1];
  const numColors = headerBuffer[2];
  const numIndices = headerBuffer[3];
  const numHeightfield = headerBuffer[4];
  const numStaticHeightfield = headerBuffer[5];
  byteOffset += MAP_CHUNK_HEADER_SIZE;

  const pointsBuffer = new Float32Array(buffer, byteOffset, numPoints * 7);
  const points = Array(numPoints);
  for (let i = 0; i < numPoints; i++) {
    const index = i * 7;

    const elevation = pointsBuffer[index + 0];
    const moisture = pointsBuffer[index + 1];
    const land = pointsBuffer[index + 2] !== 0;
    const water = pointsBuffer[index + 3] !== 0;
    const ocean = pointsBuffer[index + 4] !== 0;
    const lake = pointsBuffer[index + 5] !== 0;
    const lava = pointsBuffer[index + 6];

    points[i] = new MapPoint(
      elevation,
      moisture,
      land,
      water,
      ocean,
      lake,
      lava
    );
  }
  byteOffset += POINT_SIZE * numPoints;

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

  const heightRangeBuffer = new Float32Array(buffer, byteOffset, 2);
  const heightRange = [
    heightRangeBuffer[0],
    heightRangeBuffer[1],
  ];
  byteOffset += FLOAT32_SIZE * 2;

  return {
    buffer,
    points,
    positions,
    colors,
    indices,
    heightfield,
    staticHeightfield,
    heightRange,
  };
};

const sliceHeightfield = (arrayBuffer, readByteOffset) => {
  const headerBuffer = new Uint32Array(arrayBuffer, readByteOffset, MAP_CHUNK_HEADER_ENTRIES);
  const numPoints = headerBuffer[0];
  const numPositions = headerBuffer[1];
  const numColors = headerBuffer[2];
  const numIndices = headerBuffer[3];
  const numHeightfield = headerBuffer[4];
  const numStaticHeightfield = headerBuffer[5];
  readByteOffset += MAP_CHUNK_HEADER_SIZE + POINT_SIZE * numPoints + FLOAT32_SIZE * numPositions + FLOAT32_SIZE * numColors + UINT32_SIZE * numIndices;

  const heightfieldBuffer = new Float32Array(arrayBuffer, readByteOffset, numHeightfield);
  readByteOffset += FLOAT32_SIZE * numHeightfield + FLOAT32_SIZE * numStaticHeightfield;

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
  stringifyMapChunk,
  parseMapChunk,
  sliceHeightfield,
  parseHeightfield,
};

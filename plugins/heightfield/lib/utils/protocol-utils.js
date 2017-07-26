const {MapPoint} = require('../records/records');

const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const MAP_CHUNK_HEADER_ENTRIES = 5;
const MAP_CHUNK_HEADER_SIZE = UINT32_SIZE * MAP_CHUNK_HEADER_ENTRIES;
const POINT_SIZE = 7 * FLOAT32_SIZE;

const _getMapChunkSizeFromMetadata = metadata => {
  const {numPoints, numPositions, numNormals, numColors, numHeightfield} = metadata;

  return MAP_CHUNK_HEADER_SIZE + // header
    (INT32_SIZE * 2) + // offset // XXX can remove this since it's implicit on the front end
    (POINT_SIZE * numPoints) + // points
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numNormals) +  // normals
    (FLOAT32_SIZE * numColors) + // colors
    (FLOAT32_SIZE * numHeightfield) + // heightfield
    (FLOAT32_SIZE * 2); // height range
};

const _getMapChunkSize = mapChunk => {
  const {points, positions, normals, colors, heightfield} = mapChunk;

  const numPoints = points.length;
  const numPositions = positions.length;
  const numNormals = normals.length;
  const numColors = colors.length;
  const numHeightfield = heightfield.length;

  return _getMapChunkSizeFromMetadata({
    numPoints,
    numPositions,
    numNormals,
    numColors,
    numHeightfield,
  });
};

const _getMapChunkBufferSize = (arrayBuffer, byteOffset) => {
  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, MAP_CHUNK_HEADER_ENTRIES);
  const numPoints = headerBuffer[0];
  const numPositions = headerBuffer[1];
  const numNormals = headerBuffer[2];
  const numColors = headerBuffer[3];
  const numHeightfield = headerBuffer[4];

  return _getMapChunkSizeFromMetadata({
    numPoints,
    numPositions,
    numNormals,
    numColors,
    numHeightfield,
  });
};

// stringification

const stringifyMapChunk = (mapChunk, arrayBuffer, byteOffset) => {
  const {offset, points, positions, normals, colors, heightfield, heightRange} = mapChunk;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getMapChunkSize(mapChunk);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, MAP_CHUNK_HEADER_ENTRIES);
  headerBuffer[0] = points.length;
  headerBuffer[1] = positions.length;
  headerBuffer[2] = normals.length;
  headerBuffer[3] = colors.length;
  headerBuffer[4] = heightfield.length;
  byteOffset += MAP_CHUNK_HEADER_SIZE;

  const offsetBuffer = new Int32Array(arrayBuffer, byteOffset, 2);
  offsetBuffer[0] = offset.x;
  offsetBuffer[1] = offset.y;
  byteOffset += INT32_SIZE * 2;

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

  const normalsBuffer = new Float32Array(arrayBuffer, byteOffset, normals.length);
  normalsBuffer.set(normals);
  byteOffset += FLOAT32_SIZE * normals.length;

  const colorsBuffer = new Float32Array(arrayBuffer, byteOffset, colors.length);
  colorsBuffer.set(colors);
  byteOffset += FLOAT32_SIZE * colors.length;

  const heightfieldBuffer = new Float32Array(arrayBuffer, byteOffset, heightfield.length);
  heightfieldBuffer.set(heightfield);
  byteOffset += FLOAT32_SIZE * heightfield.length;

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

const stringifyMapChunks = mapChunks => {
  const mapChunkSizes = mapChunks.map(_getMapChunkSize);
  const bufferSize = _sum(mapChunkSizes);
  const arrayBuffer = new ArrayBuffer(bufferSize);

  let byteOffset = 0;
  for (let i = 0; i < mapChunks.length; i++) {
    const mapChunk = mapChunks[i];

    stringifyMapChunk(mapChunk, arrayBuffer, byteOffset);

    const mapChunkSize = mapChunkSizes[i];
    byteOffset += mapChunkSize;
  }

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
  const numNormals = headerBuffer[2];
  const numColors = headerBuffer[3];
  const numHeightfield = headerBuffer[4];
  byteOffset += MAP_CHUNK_HEADER_SIZE;

  const offsetBuffer = new Int32Array(buffer, byteOffset, 2);
  const offset = {
    x: offsetBuffer[0],
    y: offsetBuffer[1],
  };
  byteOffset += INT32_SIZE * 2;

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

  const normalsBuffer = new Float32Array(buffer, byteOffset, numNormals);
  const normals = normalsBuffer;
  byteOffset += FLOAT32_SIZE * numNormals;

  const colorsBuffer = new Float32Array(buffer, byteOffset, numColors);
  const colors = colorsBuffer;
  byteOffset += FLOAT32_SIZE * numColors;

  const heightfieldBuffer = new Float32Array(buffer, byteOffset, numHeightfield);
  const heightfield = heightfieldBuffer;
  byteOffset += FLOAT32_SIZE * numHeightfield;

  const heightRangeBuffer = new Float32Array(buffer, byteOffset, 2);
  const heightRange = [
    heightRangeBuffer[0],
    heightRangeBuffer[1],
  ];
  byteOffset += FLOAT32_SIZE * 2;

  return {
    buffer,
    offset,
    points,
    positions,
    normals,
    colors,
    heightfield,
    heightRange,
  };
};

const parseMapChunks = arrayBuffer => {
  const mapChunks = [];

  let byteOffset = 0;
  while (byteOffset < arrayBuffer.byteLength) {
    const mapChunk = parseMapChunk(arrayBuffer, byteOffset);
    mapChunks.push(mapChunk);

    const mapChunkSize = _getMapChunkBufferSize(arrayBuffer, byteOffset);
    byteOffset += mapChunkSize;
  }

  return mapChunks;
};

module.exports = {
  stringifyMapChunk,
  stringifyMapChunks,
  parseMapChunk,
  parseMapChunks,
};

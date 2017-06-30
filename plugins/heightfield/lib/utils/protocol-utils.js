const {MapPoint} = require('../records/records');

const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const UINT16_SIZE = 2;
const MAP_CHUNK_HEADER_ENTRIES = 5;
const MAP_CHUNK_HEADER_SIZE = UINT32_SIZE * MAP_CHUNK_HEADER_ENTRIES;
const MAP_CHUNK_UPDATE_HEADER_ENTRIES = 4;
const MAP_CHUNK_UPDATE_HEADER_SIZE = UINT32_SIZE * MAP_CHUNK_HEADER_ENTRIES;
const POINT_SIZE = 7 * FLOAT32_SIZE;

const _getMapChunkSizeFromMetadata = metadata => {
  const {numPoints, numPositions, numNormals, numColors, numIndices} = metadata;

  return MAP_CHUNK_HEADER_SIZE + // header
    (INT32_SIZE * 2) + // offset // XXX can remove this since it's implicit on the front end
    (POINT_SIZE * numPoints) + // points
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numNormals) +  // normals
    (FLOAT32_SIZE * numColors) + // colors
    (UINT16_SIZE * numIndices); // indices
};

const _getMapChunkSize = mapChunk => {
  const {points, positions, normals, colors, indices} = mapChunk;

  const numPoints = points.length;
  const numPositions = positions.length;
  const numNormals = normals.length;
  const numColors = colors.length;
  const numIndices = indices.length;

  return _getMapChunkSizeFromMetadata({
    numPoints,
    numPositions,
    numNormals,
    numColors,
    numIndices,
  });
};

const _getMapChunkBufferSize = (arrayBuffer, byteOffset) => {
  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, MAP_CHUNK_HEADER_ENTRIES);
  const numPoints = headerBuffer[0];
  const numPositions = headerBuffer[1];
  const numNormals = headerBuffer[2];
  const numColors = headerBuffer[3];
  const numIndices = headerBuffer[4];

  return _getMapChunkSizeFromMetadata({
    numPoints,
    numPositions,
    numNormals,
    numColors,
    numIndices,
  });
};

// stringification

const stringifyMapChunk = (mapChunk, arrayBuffer, byteOffset) => {
  const {offset, points, positions, normals, colors, indices} = mapChunk;

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
  headerBuffer[4] = indices.length;

  const offsetBuffer = new Int32Array(arrayBuffer, byteOffset + MAP_CHUNK_HEADER_SIZE, 2);
  offsetBuffer[0] = offset.x;
  offsetBuffer[1] = offset.y;

  const pointsBuffer = new Float32Array(arrayBuffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (INT32_SIZE * 2), points.length * 7);
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

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (INT32_SIZE * 2) + (POINT_SIZE * points.length), positions.length);
  positionsBuffer.set(positions);

  const normalsBuffer = new Float32Array(arrayBuffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (INT32_SIZE * 2) + (POINT_SIZE * points.length) + (FLOAT32_SIZE * positions.length), normals.length);
  normalsBuffer.set(normals);

  const colorsBuffer = new Float32Array(arrayBuffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (INT32_SIZE * 2) + (POINT_SIZE * points.length) + (FLOAT32_SIZE * positions.length) + (FLOAT32_SIZE * normals.length), colors.length);
  colorsBuffer.set(colors);

  const indicesBuffer = new Uint16Array(arrayBuffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (INT32_SIZE * 2) + (POINT_SIZE * points.length) + (FLOAT32_SIZE * positions.length) + (FLOAT32_SIZE * normals.length) + (FLOAT32_SIZE * colors.length), indices.length);
  indicesBuffer.set(indices);

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

const parseMapChunk = (arrayBuffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, MAP_CHUNK_HEADER_ENTRIES);
  const numPoints = headerBuffer[0];
  const numPositions = headerBuffer[1];
  const numNormals = headerBuffer[2];
  const numColors = headerBuffer[3];
  const numIndices = headerBuffer[4];

  const offsetBuffer = new Int32Array(arrayBuffer, byteOffset + MAP_CHUNK_HEADER_SIZE, 2);
  const offset = {
    x: offsetBuffer[0],
    y: offsetBuffer[1],
  };

  const pointsBuffer = new Float32Array(arrayBuffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (INT32_SIZE * 2), numPoints * 7);
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

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (INT32_SIZE * 2) + (POINT_SIZE * numPoints), numPositions);
  const positions = positionsBuffer;

  const normalsBuffer = new Float32Array(arrayBuffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (INT32_SIZE * 2) + (POINT_SIZE * numPoints) + (FLOAT32_SIZE * numPositions), numNormals);
  const normals = normalsBuffer;

  const colorsBuffer = new Float32Array(arrayBuffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (INT32_SIZE * 2) + (POINT_SIZE * numPoints) + (FLOAT32_SIZE * numPositions) + (FLOAT32_SIZE * numNormals), numColors);
  const colors = colorsBuffer;

  const indicesBuffer = new Uint16Array(arrayBuffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (INT32_SIZE * 2) + (POINT_SIZE * numPoints) + (FLOAT32_SIZE * numPositions) + (FLOAT32_SIZE * numNormals) + (FLOAT32_SIZE * numColors), numIndices);
  const indices = indicesBuffer;

  return {
    offset,
    points,
    positions,
    normals,
    colors,
    indices
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

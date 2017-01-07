const {
  MapPoint,
} = require('../records/records');

const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const MAP_CHUNK_HEADER_ENTRIES = 6;
const MAP_CHUNK_HEADER_SIZE = UINT32_SIZE * MAP_CHUNK_HEADER_ENTRIES;
const MAP_CHUNK_UPDATE_HEADER_ENTRIES = 4;
const MAP_CHUNK_UPDATE_HEADER_SIZE = UINT32_SIZE * MAP_CHUNK_HEADER_ENTRIES;
const POINT_SIZE = 7 * FLOAT32_SIZE;

const _getMapChunkSizeFromMetadata = metadata => {
  const {numPoints, numCaves, numPositions, numNormals, numColors, numHeightFields} = metadata;

  return MAP_CHUNK_HEADER_SIZE + // header
    (INT32_SIZE * 2) + // offset
    (INT32_SIZE * 2) + // position
    (POINT_SIZE * numPoints) + // points
    (FLOAT32_SIZE * numCaves) + // caves
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numNormals) +  // normals
    (FLOAT32_SIZE * numColors) + // colors
    (FLOAT32_SIZE * numHeightFields); // heightField
};

const _getMapChunkSize = mapChunk => {
  const {points, caves, positions, normals, colors, heightField} = mapChunk;

  const numPoints = points.length;
  const numCaves = caves.length;
  const numPositions = positions.length;
  const numNormals = normals.length;
  const numColors = colors.length;
  const numHeightFields = heightField.length;

  return _getMapChunkSizeFromMetadata({
    numPoints,
    numCaves,
    numPositions,
    numNormals,
    numColors,
    numHeightFields,
  });
};

const _getMapChunkBufferSize = (buffer, byteOffset) => {
  const headerBuffer = new Uint32Array(buffer.buffer, byteOffset, MAP_CHUNK_HEADER_ENTRIES);
  const numPoints = headerBuffer[0];
  const numCaves = headerBuffer[1];
  const numPositions = headerBuffer[2];
  const numNormals = headerBuffer[3];
  const numColors = headerBuffer[4];
  const numHeightFields = headerBuffer[5];

  return _getMapChunkSizeFromMetadata({
    numPoints,
    numCaves,
    numPositions,
    numNormals,
    numColors,
    numHeightFields,
  });
};

const _getMapChunkUpdateSizeFromMetadata = metadata => {
  const {numPositions, numNormals, numColors, numHeightFields} = metadata;

  return MAP_CHUNK_HEADER_SIZE + // header
    (INT32_SIZE * 2) + // offset
    (INT32_SIZE * 2) + // position
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numNormals) +  // normals
    (FLOAT32_SIZE * numColors) + // colors
    (FLOAT32_SIZE * numHeightFields); // heightField
};

const _getMapChunkUpdateSize = mapChunkUpdate => {
  const {positions, normals, colors, heightField} = mapChunkUpdate;

  const numPositions = positions.length;
  const numNormals = normals.length;
  const numColors = colors.length;
  const numHeightFields = heightField.length;

  return _getMapChunkUpdateSizeFromMetadata({
    numPositions,
    numNormals,
    numColors,
    numHeightFields,
  });
};

// stringification

export const stringifyMapChunk = (mapChunk, buffer, byteOffset) => {
  const {offset, position, points, caves, positions, normals, colors, heightField} = mapChunk;

  if (buffer === undefined || byteOffset === undefined) {
    const bufferSize = _getMapChunkSize(mapChunk);
    buffer = new Uint8Array(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer.buffer, byteOffset, MAP_CHUNK_HEADER_ENTRIES);
  headerBuffer[0] = points.length;
  headerBuffer[1] = caves.length;
  headerBuffer[2] = positions.length;
  headerBuffer[3] = normals.length;
  headerBuffer[4] = colors.length;
  headerBuffer[5] = heightField.length;

  const offsetBuffer = new Int32Array(buffer.buffer, byteOffset + MAP_CHUNK_HEADER_SIZE, 2);
  offsetBuffer[0] = offset.x;
  offsetBuffer[1] = offset.y;

  const positionBuffer = new Int32Array(buffer.buffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (INT32_SIZE * 2), 2);
  positionBuffer[0] = position.x;
  positionBuffer[1] = position.y;

  const pointsBuffer = new Float32Array(buffer.buffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (INT32_SIZE * 2) + (INT32_SIZE * 2), points.length * 7);
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

  const cavesBuffer = new Float32Array(buffer.buffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (INT32_SIZE * 2) + (INT32_SIZE * 2) + (POINT_SIZE * points.length), caves.length);
  cavesBuffer.set(caves);

  const positionsBuffer = new Float32Array(buffer.buffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (INT32_SIZE * 2) + (INT32_SIZE * 2) + (POINT_SIZE * points.length) + (FLOAT32_SIZE * caves.length), positions.length);
  positionsBuffer.set(positions);

  const normalsBuffer = new Float32Array(buffer.buffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (INT32_SIZE * 2) + (INT32_SIZE * 2) + (POINT_SIZE * points.length) + (FLOAT32_SIZE * caves.length) + (FLOAT32_SIZE * positions.length), normals.length);
  normalsBuffer.set(normals);

  const colorsBuffer = new Float32Array(buffer.buffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (INT32_SIZE * 2) + (INT32_SIZE * 2) + (POINT_SIZE * points.length) + (FLOAT32_SIZE * caves.length) + (FLOAT32_SIZE * positions.length) + (FLOAT32_SIZE * normals.length), colors.length);
  colorsBuffer.set(colors);

  const heightFieldBuffer = new Float32Array(buffer.buffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (INT32_SIZE * 2) + (INT32_SIZE * 2) + (POINT_SIZE * points.length) + (FLOAT32_SIZE * caves.length) + (FLOAT32_SIZE * positions.length) + (FLOAT32_SIZE * normals.length) + (FLOAT32_SIZE * colors.length), heightField.length);
  heightFieldBuffer.set(heightField);

  return buffer;
};

const _sum = a => {
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    const e = a[i];
    result += e;
  }
  return result;
};

export const stringifyMapChunks = mapChunks => {
  const mapChunkSizes = mapChunks.map(_getMapChunkSize);
  const bufferSize = sum_(mapChunkSizes);
  const buffer = new Uint8Array(bufferSize);

  let byteOffset = 0;
  for (let i = 0; i < mapChunks.length; i++) {
    const mapChunk = mapChunks[i];

    stringifyMapChunk(mapChunk, buffer, byteOffset);

    const mapChunkSize = mapChunkSizes[i];
    byteOffset += mapChunkSize;
  }

  return buffer;
};

export const stringifyMapChunkUpdate = (mapChunkUpdate, buffer, byteOffset) => {
  const {offset, position, positions, normals, colors, heightField} = mapChunkUpdate;

  if (buffer === undefined || byteOffset === undefined) {
    const bufferSize = _getMapChunkUpdateSize(mapChunkUpdate);
    buffer = new Uint8Array(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer.buffer, byteOffset, MAP_CHUNK_UPDATE_HEADER_ENTRIES);
  headerBuffer[0] = positions.length;
  headerBuffer[1] = normals.length;
  headerBuffer[2] = colors.length;
  headerBuffer[3] = heightField.length;

  const offsetBuffer = new Int32Array(buffer.buffer, byteOffset + MAP_CHUNK_UPDATE_HEADER_SIZE, 2);
  offsetBuffer[0] = offset.x;
  offsetBuffer[1] = offset.y;

  const positionBuffer = new Int32Array(buffer.buffer, byteOffset + MAP_CHUNK_UPDATE_HEADER_SIZE + (INT32_SIZE * 2), 2);
  positionBuffer[0] = position.x;
  positionBuffer[1] = position.y;

  const positionsBuffer = new Float32Array(buffer.buffer, byteOffset + MAP_CHUNK_UPDATE_HEADER_SIZE + (INT32_SIZE * 2) + (INT32_SIZE * 2), positions.length);
  positionsBuffer.set(positions);

  const normalsBuffer = new Float32Array(buffer.buffer, byteOffset + MAP_CHUNK_UPDATE_HEADER_SIZE + (INT32_SIZE * 2) + (INT32_SIZE * 2) + (FLOAT32_SIZE * positions.length), normals.length);
  normalsBuffer.set(normals);

  const colorsBuffer = new Float32Array(buffer.buffer, byteOffset + MAP_CHUNK_UPDATE_HEADER_SIZE + (INT32_SIZE * 2) + (INT32_SIZE * 2) + (FLOAT32_SIZE * positions.length) + (FLOAT32_SIZE * normals.length), colors.length);
  colorsBuffer.set(colors);

  const heightFieldBuffer = new Float32Array(buffer.buffer, byteOffset + MAP_CHUNK_UPDATE_HEADER_SIZE + (INT32_SIZE * 2) + (INT32_SIZE * 2) + (FLOAT32_SIZE * positions.length) + (FLOAT32_SIZE * normals.length) + (FLOAT32_SIZE * colors.length), heightField.length);
  heightFieldBuffer.set(heightField);

  return buffer;
};

// parsing

export const parseMapChunk = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer.buffer, byteOffset, MAP_CHUNK_HEADER_ENTRIES);
  const numPoints = headerBuffer[0];
  const numCaves = headerBuffer[1];
  const numPositions = headerBuffer[2];
  const numNormals = headerBuffer[3];
  const numColors = headerBuffer[4];
  const numHeightFields = headerBuffer[5];

  const offsetBuffer = new Int32Array(buffer.buffer, byteOffset + MAP_CHUNK_HEADER_SIZE, 2);
  const offset = {
    x: offsetBuffer[0],
    y: offsetBuffer[1],
  };

  const positionBuffer = new Int32Array(buffer.buffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (INT32_SIZE * 2), 2);
  const position = {
    x: positionBuffer[0],
    y: positionBuffer[1],
  };

  const pointsBuffer = new Float32Array(buffer.buffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (INT32_SIZE * 2) + (INT32_SIZE * 2), numPoints * 7);
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
      lava,
    );
  }

  const cavesBuffer = new Float32Array(buffer.buffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (INT32_SIZE * 2) + (INT32_SIZE * 2) + (POINT_SIZE * numPoints), numCaves);
  const caves = cavesBuffer;

  const positionsBuffer = new Float32Array(buffer.buffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (INT32_SIZE * 2) + (INT32_SIZE * 2) + (POINT_SIZE * numPoints) + (FLOAT32_SIZE * numCaves), numPositions);
  const positions = positionsBuffer;

  const normalsBuffer = new Float32Array(buffer.buffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (INT32_SIZE * 2) + (INT32_SIZE * 2) + (POINT_SIZE * numPoints) + (FLOAT32_SIZE * numCaves) + (FLOAT32_SIZE * numPositions), numNormals);
  const normals = normalsBuffer;

  const colorsBuffer = new Float32Array(buffer.buffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (INT32_SIZE * 2) + (INT32_SIZE * 2) + (POINT_SIZE * numPoints) + (FLOAT32_SIZE * numCaves) + (FLOAT32_SIZE * numPositions) + (FLOAT32_SIZE * numNormals), numColors);
  const colors = colorsBuffer;

  const heightFieldBuffer = new Float32Array(buffer.buffer, byteOffset + MAP_CHUNK_HEADER_SIZE + (INT32_SIZE * 2) + (INT32_SIZE * 2) + (POINT_SIZE * numPoints) + (FLOAT32_SIZE * numCaves) + (FLOAT32_SIZE * numPositions) + (FLOAT32_SIZE * numNormals) + (FLOAT32_SIZE * numColors), numHeightFields);
  const heightField = heightFieldBuffer;

  return {
    offset,
    position,
    points,
    caves,
    positions,
    normals,
    colors,
    heightField
  };
};

export const parseMapChunks = buffer => {
  const mapChunks = [];

  let byteOffset = 0;
  while (byteOffset < buffer.byteLength) {
    const mapChunk = parseMapChunk(buffer, byteOffset);
    mapChunks.push(mapChunk);

    const mapChunkSize = _getMapChunkBufferSize(buffer.buffer, byteOffset);
    byteOffset += mapChunkSize;
  }

  return mapChunks;
};

export const parseMapChunkUpdate = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer.buffer, byteOffset, MAP_CHUNK_UPDATE_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numNormals = headerBuffer[1];
  const numColors = headerBuffer[2];
  const numHeightFields = headerBuffer[3];

  const offsetBuffer = new Int32Array(buffer.buffer, byteOffset + MAP_CHUNK_UPDATE_HEADER_SIZE, 2);
  const offset = {
    x: offsetBuffer[0],
    y: offsetBuffer[1],
  };

  const positionBuffer = new Int32Array(buffer.buffer, byteOffset + MAP_CHUNK_UPDATE_HEADER_SIZE + (INT32_SIZE * 2), 2);
  const position = {
    x: positionBuffer[0],
    y: positionBuffer[1],
  };

  const positionsBuffer = new Float32Array(buffer.buffer, byteOffset + MAP_CHUNK_UPDATE_HEADER_SIZE + (INT32_SIZE * 2) + (INT32_SIZE * 2), numPositions);
  const positions = positionsBuffer;

  const normalsBuffer = new Float32Array(buffer.buffer, byteOffset + MAP_CHUNK_UPDATE_HEADER_SIZE + (INT32_SIZE * 2) + (INT32_SIZE * 2) + (FLOAT32_SIZE * numPositions), numNormals);
  const normals = normalsBuffer;

  const colorsBuffer = new Float32Array(buffer.buffer, byteOffset + MAP_CHUNK_UPDATE_HEADER_SIZE + (INT32_SIZE * 2) + (INT32_SIZE * 2) + (FLOAT32_SIZE * numPositions) + (FLOAT32_SIZE * numNormals), numColors);
  const colors = colorsBuffer;

  const heightFieldBuffer = new Float32Array(buffer.buffer, byteOffset + MAP_CHUNK_UPDATE_HEADER_SIZE + (INT32_SIZE * 2) + (INT32_SIZE * 2) + (FLOAT32_SIZE * numPositions) + (FLOAT32_SIZE * numNormals) + (FLOAT32_SIZE * numColors), numHeightFields);
  const heightField = heightFieldBuffer;

  return {
    offset,
    position,
    positions,
    normals,
    colors,
    heightField
  };
};

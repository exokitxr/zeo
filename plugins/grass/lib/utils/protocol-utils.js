const {
  NUM_RENDER_GROUPS,
} = require('../constants/constants');

const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const UINT8_SIZE = 1;
const FLOAT32_SIZE = 4;
const UINT16_SIZE = 2;
const GRASS_GEOMETRY_HEADER_ENTRIES = 5;
const GRASS_GEOMETRY_HEADER_SIZE = UINT32_SIZE * GRASS_GEOMETRY_HEADER_ENTRIES;
const CULL_HEADER_ENTRIES = 1;
const CULL_HEADER_SIZE = UINT32_SIZE * CULL_HEADER_ENTRIES;

const _getGrassGeometrySizeFromMetadata = metadata => {
  const {numPositions, numUvs, numLightmaps, numIndices, numBoundingSphere} = metadata;

  return _align(
    GRASS_GEOMETRY_HEADER_SIZE + // header
      (FLOAT32_SIZE * numPositions) + // positions
      (FLOAT32_SIZE * numUvs) + // uvs
      (UINT8_SIZE * numLightmaps), // lightmaps
    UINT16_SIZE
  ) +
  (UINT16_SIZE * numIndices) + // indices
  (FLOAT32_SIZE * numBoundingSphere); // bounding sphere
};

const _getGrassGeometrySize = (grassGeometry, lightmaps) => {
  const {positions, uvs, indices, boundingSphere} = grassGeometry;

  const numPositions = positions.length;
  const numUvs = uvs.length
  const numLightmaps = lightmaps.length
  const numIndices = indices.length
  const numBoundingSphere = boundingSphere.length;

  return _getGrassGeometrySizeFromMetadata({
    numPositions,
    numUvs,
    numLightmaps,
    numIndices,
    numBoundingSphere,
  });
};

const stringifyGrassGeometry = (grassGeometry, lightmaps, arrayBuffer, byteOffset) => {
  const {positions, uvs, indices, boundingSphere} = grassGeometry;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getGrassGeometrySize(grassGeometry, lightmaps);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, GRASS_GEOMETRY_HEADER_ENTRIES);
  headerBuffer[0] = positions.length;
  headerBuffer[1] = uvs.length;
  headerBuffer[2] = lightmaps.length;
  headerBuffer[3] = indices.length;
  headerBuffer[4] = boundingSphere.length;
  byteOffset += GRASS_GEOMETRY_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, positions.length);
  positionsBuffer.set(positions);
  byteOffset += FLOAT32_SIZE * positions.length;

  const uvsBuffer = new Float32Array(arrayBuffer, byteOffset, uvs.length);
  uvsBuffer.set(uvs);
  byteOffset += FLOAT32_SIZE * uvs.length;

  const lightmapsBuffer = new Uint8Array(arrayBuffer, byteOffset, lightmaps.length);
  lightmapsBuffer.set(lightmaps);
  byteOffset += UINT8_SIZE * lightmaps.length;

  byteOffset = _align(byteOffset, UINT16_SIZE);

  const indicesBuffer = new Uint16Array(arrayBuffer, byteOffset, indices.length);
  indicesBuffer.set(indices);
  byteOffset += UINT16_SIZE * indices.length;

  const boundingSphereBuffer = new Float32Array(arrayBuffer, byteOffset, boundingSphere.length);
  boundingSphereBuffer.set(boundingSphere);
  byteOffset += FLOAT32_SIZE * boundingSphere.length;

  return arrayBuffer;
};

const parseGrassGeometry = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, GRASS_GEOMETRY_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numUvs = headerBuffer[1];
  const numLightmaps = headerBuffer[2];
  const numIndices = headerBuffer[3];
  const numBoundingSphere = headerBuffer[4];
  byteOffset += GRASS_GEOMETRY_HEADER_SIZE;

  const positionsBuffer = new Float32Array(buffer, byteOffset, numPositions);
  const positions = positionsBuffer;
  byteOffset += FLOAT32_SIZE * numPositions;

  const uvBuffer = new Float32Array(buffer, byteOffset, numUvs);
  const uvs = uvBuffer;
  byteOffset += FLOAT32_SIZE * numUvs;

  const lightmapBuffer = new Uint8Array(buffer, byteOffset, numLightmaps);
  const lightmaps = lightmapBuffer;
  byteOffset += UINT8_SIZE * numLightmaps;

  byteOffset = _align(byteOffset, UINT16_SIZE);

  const indicesBuffer = new Uint16Array(buffer, byteOffset, numIndices);
  const indices = indicesBuffer;
  byteOffset += UINT16_SIZE * numIndices;

  const boundingSphereBuffer = new Float32Array(buffer, byteOffset, numBoundingSphere);
  const boundingSphere = boundingSphereBuffer;
  byteOffset += FLOAT32_SIZE * numBoundingSphere;

  return {
    buffer,
    positions,
    uvs,
    lightmaps,
    indices,
    boundingSphere,
  };
};

const _getCullSizeFromMetadata = metadata => {
  const {numMapChunks} = metadata;

  return CULL_HEADER_SIZE + // header
    ((INT32_SIZE + (INT32_SIZE * 2 * NUM_RENDER_GROUPS)) * numMapChunks); // map chunks
};

const _getCullSize = mapChunks => {
  let numMapChunks = 0;
  for (const index in mapChunks) {
    if (mapChunks[index]) {
      numMapChunks++;
    }
  }
  return _getCullSizeFromMetadata({
    numMapChunks,
  });
};

const stringifyCull = (mapChunks, arrayBuffer, byteOffset) => {
  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getCullSize(mapChunks);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  let numMapChunks = 0;
  for (const index in mapChunks) {
    if (mapChunks[index]) {
      numMapChunks++;
    }
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, CULL_HEADER_ENTRIES);
  let index = 0;
  headerBuffer[index++] = numMapChunks;
  byteOffset += CULL_HEADER_SIZE;

  for (const index in mapChunks) {
    const trackedMapChunkMeshes = mapChunks[index];
    if (trackedMapChunkMeshes) {
      const indexArray = new Int32Array(arrayBuffer, byteOffset, 1);
      indexArray[0] = parseInt(index, 10);
      byteOffset += INT32_SIZE;

      const groupsArray = new Int32Array(arrayBuffer, byteOffset, NUM_RENDER_GROUPS * 2);
      groupsArray.set(trackedMapChunkMeshes.groups);
      byteOffset += INT32_SIZE * 2 * NUM_RENDER_GROUPS;
    }
  }

  return arrayBuffer;
};

const parseCull = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, CULL_HEADER_ENTRIES);
  let index = 0;
  const numMapChunks = headerBuffer[index++];
  byteOffset += CULL_HEADER_SIZE;

  const mapChunks = Array(numMapChunks);
  for (let i = 0; i < numMapChunks; i++) {
    const indexArray = new Int32Array(buffer, byteOffset, 1);
    const index = indexArray[0];
    byteOffset += INT32_SIZE;

    const groups = [];
    const groupsArray = new Int32Array(buffer, byteOffset, NUM_RENDER_GROUPS * 2);
    for (let i = 0; i < NUM_RENDER_GROUPS; i++) {
      const baseIndex = i * 2;
      const start = groupsArray[baseIndex + 0];
      if (start !== -1) {
        groups.push({
          start,
          count: groupsArray[baseIndex + 1],
          materialIndex: 0,
        });
      }
    }
    byteOffset += INT32_SIZE * 2 * NUM_RENDER_GROUPS;

    mapChunks[i] = {
      index,
      groups,
    };
  }
  return mapChunks;
};

const _align = (n, alignment) => {
  let alignDiff = n % alignment;
  if (alignDiff > 0) {
    n += alignment - alignDiff;
  }
  return n;
};

module.exports = {
  stringifyGrassGeometry,
  parseGrassGeometry,

  stringifyCull,
  parseCull,
};

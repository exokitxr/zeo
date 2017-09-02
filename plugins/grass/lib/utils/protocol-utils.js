const {
  NUM_RENDER_GROUPS,
} = require('../constants/constants');

const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const UINT8_SIZE = 1;
const FLOAT32_SIZE = 4;
const UINT16_SIZE = 2;
const DATA_GEOMETRY_HEADER_ENTRIES = 6;
const DATA_GEOMETRY_HEADER_SIZE = UINT32_SIZE * DATA_GEOMETRY_HEADER_ENTRIES;
const RENDER_GEOMETRY_HEADER_ENTRIES = 6;
const RENDER_GEOMETRY_HEADER_SIZE = UINT32_SIZE * RENDER_GEOMETRY_HEADER_ENTRIES;
const CULL_HEADER_ENTRIES = 1;
const CULL_HEADER_SIZE = UINT32_SIZE * CULL_HEADER_ENTRIES;

const _getDataGeometrySizeFromMetadata = metadata => {
  const {numPositions, numSkyLightmaps, numTorchLightmaps, numUvs, numIndices, numBoundingSphere} = metadata;

  return RENDER_GEOMETRY_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numUvs) + // uvs
    _align(UINT8_SIZE * numSkyLightmaps, UINT32_SIZE) + // sky lightmaps
    _align(UINT8_SIZE * numTorchLightmaps, UINT32_SIZE) + // torch lightmaps
    (UINT32_SIZE * numIndices) + // indices
    (FLOAT32_SIZE * numBoundingSphere); // bounding sphere
};

const _getDataGeometrySize = grassGeometry => {
  const {positions, uvs, skyLightmaps, torchLightmaps, indices, boundingSphere} = grassGeometry;

  const numPositions = positions.length;
  const numUvs = uvs.length
  const numSkyLightmaps = skyLightmaps.length
  const numTorchLightmaps = torchLightmaps.length
  const numIndices = indices.length
  const numBoundingSphere = boundingSphere.length;

  return _getDataGeometrySizeFromMetadata({
    numPositions,
    numUvs,
    numSkyLightmaps,
    numTorchLightmaps,
    numIndices,
    numBoundingSphere,
  });
};

const stringifyDataGeometry = (grassGeometry, arrayBuffer, byteOffset) => {
  const {positions, uvs, skyLightmaps, torchLightmaps, indices, boundingSphere} = grassGeometry;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getGrassGeometrySize(grassGeometry);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, DATA_GEOMETRY_HEADER_ENTRIES);
  let index = 0;
  headerBuffer[index++] = positions.length;
  headerBuffer[index++] = uvs.length;
  headerBuffer[index++] = skyLightmaps.length;
  headerBuffer[index++] = torchLightmaps.length;
  headerBuffer[index++] = indices.length;
  headerBuffer[index++] = boundingSphere.length;
  byteOffset += DATA_GEOMETRY_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, positions.length);
  positionsBuffer.set(positions);
  byteOffset += FLOAT32_SIZE * positions.length;

  const uvsBuffer = new Float32Array(arrayBuffer, byteOffset, uvs.length);
  uvsBuffer.set(uvs);
  byteOffset += FLOAT32_SIZE * uvs.length;

  const skyLightmapsBuffer = new Uint8Array(arrayBuffer, byteOffset, skyLightmaps.length);
  skyLightmapsBuffer.set(skyLightmaps);
  byteOffset += UINT8_SIZE * skyLightmaps.length;
  byteOffset = _align(byteOffset, UINT32_SIZE);

  const torchLightmapsBuffer = new Uint8Array(arrayBuffer, byteOffset, torchLightmaps.length);
  torchLightmapsBuffer.set(torchLightmaps);
  byteOffset += UINT8_SIZE * torchLightmaps.length;
  byteOffset = _align(byteOffset, UINT32_SIZE);

  const indicesBuffer = new Uint32Array(arrayBuffer, byteOffset, indices.length);
  indicesBuffer.set(indices);
  byteOffset += UINT32_SIZE * indices.length;

  const boundingSphereBuffer = new Float32Array(arrayBuffer, byteOffset, boundingSphere.length);
  boundingSphereBuffer.set(boundingSphere);
  byteOffset += FLOAT32_SIZE * boundingSphere.length;

  return [arrayBuffer, byteOffset];
};

const parseDataGeometry = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, DATA_GEOMETRY_HEADER_ENTRIES);
  let index = 0;
  const numPositions = headerBuffer[index++];
  const numUvs = headerBuffer[index++];
  const numSkyLightmaps = headerBuffer[index++];
  const numTorchLightmaps = headerBuffer[index++];
  const numIndices = headerBuffer[index++];
  const numBoundingSphere = headerBuffer[index++];
  byteOffset += DATA_GEOMETRY_HEADER_SIZE;

  const positionsBuffer = new Float32Array(buffer, byteOffset, numPositions);
  const positions = positionsBuffer;
  byteOffset += FLOAT32_SIZE * numPositions;

  const uvBuffer = new Float32Array(buffer, byteOffset, numUvs);
  const uvs = uvBuffer;
  byteOffset += FLOAT32_SIZE * numUvs;

  const skyLightmapsBuffer = new Uint8Array(buffer, byteOffset, numSkyLightmaps);
  const skyLightmaps = skyLightmapsBuffer;
  byteOffset += UINT8_SIZE * numSkyLightmaps;
  byteOffset = _align(byteOffset, UINT32_SIZE);

  const torchLightmapsBuffer = new Uint8Array(buffer, byteOffset, numTorchLightmaps);
  const torchLightmaps = torchLightmapsBuffer;
  byteOffset += UINT8_SIZE * numTorchLightmaps;
  byteOffset = _align(byteOffset, UINT32_SIZE);

  const indicesBuffer = new Uint32Array(buffer, byteOffset, numIndices);
  const indices = indicesBuffer;
  byteOffset += UINT32_SIZE * numIndices;

  const boundingSphereBuffer = new Float32Array(buffer, byteOffset, numBoundingSphere);
  const boundingSphere = boundingSphereBuffer;
  byteOffset += FLOAT32_SIZE * numBoundingSphere;

  return {
    buffer,
    uvs,
    positions,
    skyLightmaps,
    torchLightmaps,
    indices,
    boundingSphere,
  };
};

const _getRenderGeometrySizeFromMetadata = metadata => {
  const {numPositions, numUvs, numSkyLightmaps, numTorchLightmaps, numIndices, numBoundingSphere} = metadata;

  return RENDER_GEOMETRY_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numUvs) + // uvs
    _align(UINT8_SIZE * numSkyLightmaps, UINT32_SIZE) + // sky lightmaps
    _align(UINT8_SIZE * numTorchLightmaps, UINT32_SIZE) + // torch lightmaps
    (UINT32_SIZE * numIndices) + // indices
    (FLOAT32_SIZE * numBoundingSphere); // bounding sphere
};

const _getRenderGeometrySize = (grassGeometry) => {
  const {positions, uvs, skyLightmaps, torchLightmaps, indices, boundingSphere} = grassGeometry;

  const numPositions = positions.length;
  const numUvs = uvs.length
  const numSkyLightmaps = skyLightmaps.length
  const numTorchLightmaps = torchLightmaps.length
  const numIndices = indices.length
  const numBoundingSphere = boundingSphere.length;

  return _getRenderGeometrySizeFromMetadata({
    numPositions,
    numUvs,
    numSkyLightmaps,
    numTorchLightmaps,
    numIndices,
    numBoundingSphere,
  });
};

const stringifyRenderGeometry = (grassGeometry, arrayBuffer, byteOffset) => {
  const {positions, uvs, skyLightmaps, torchLightmaps, indices, boundingSphere} = grassGeometry;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getGrassGeometrySize(grassGeometry, skyLightmaps, torchLightmaps);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, RENDER_GEOMETRY_HEADER_ENTRIES);
  let index = 0;
  headerBuffer[index++] = positions.length;
  headerBuffer[index++] = uvs.length;
  headerBuffer[index++] = skyLightmaps.length;
  headerBuffer[index++] = torchLightmaps.length;
  headerBuffer[index++] = indices.length;
  headerBuffer[index++] = boundingSphere.length;
  byteOffset += RENDER_GEOMETRY_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, positions.length);
  positionsBuffer.set(positions);
  byteOffset += FLOAT32_SIZE * positions.length;

  const uvsBuffer = new Float32Array(arrayBuffer, byteOffset, uvs.length);
  uvsBuffer.set(uvs);
  byteOffset += FLOAT32_SIZE * uvs.length;

  const skyLightmapsBuffer = new Uint8Array(arrayBuffer, byteOffset, skyLightmaps.length);
  skyLightmapsBuffer.set(skyLightmaps);
  byteOffset += UINT8_SIZE * skyLightmaps.length;
  byteOffset = _align(byteOffset, UINT32_SIZE);

  const torchLightmapsBuffer = new Uint8Array(arrayBuffer, byteOffset, torchLightmaps.length);
  torchLightmapsBuffer.set(torchLightmaps);
  byteOffset += UINT8_SIZE * torchLightmaps.length;
  byteOffset = _align(byteOffset, UINT32_SIZE);

  const indicesBuffer = new Uint32Array(arrayBuffer, byteOffset, indices.length);
  indicesBuffer.set(indices);
  byteOffset += UINT32_SIZE * indices.length;

  const boundingSphereBuffer = new Float32Array(arrayBuffer, byteOffset, boundingSphere.length);
  boundingSphereBuffer.set(boundingSphere);
  byteOffset += FLOAT32_SIZE * boundingSphere.length;

  return [arrayBuffer, byteOffset];
};

const parseRenderGeometry = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, RENDER_GEOMETRY_HEADER_ENTRIES);
  let index = 0;
  const numPositions = headerBuffer[index++];
  const numUvs = headerBuffer[index++];
  const numSkyLightmaps = headerBuffer[index++];
  const numTorchLightmaps = headerBuffer[index++];
  const numIndices = headerBuffer[index++];
  const numBoundingSphere = headerBuffer[index++];
  byteOffset += RENDER_GEOMETRY_HEADER_SIZE;

  const positionsBuffer = new Float32Array(buffer, byteOffset, numPositions);
  const positions = positionsBuffer;
  byteOffset += FLOAT32_SIZE * numPositions;

  const uvBuffer = new Float32Array(buffer, byteOffset, numUvs);
  const uvs = uvBuffer;
  byteOffset += FLOAT32_SIZE * numUvs;

  const skyLightmapsBuffer = new Uint8Array(buffer, byteOffset, numSkyLightmaps);
  const skyLightmaps = skyLightmapsBuffer;
  byteOffset += UINT8_SIZE * numSkyLightmaps;
  byteOffset = _align(byteOffset, UINT32_SIZE);

  const torchLightmapsBuffer = new Uint8Array(buffer, byteOffset, numTorchLightmaps);
  const torchLightmaps = torchLightmapsBuffer;
  byteOffset += UINT8_SIZE * numTorchLightmaps;
  byteOffset = _align(byteOffset, UINT32_SIZE);

  const indicesBuffer = new Uint32Array(buffer, byteOffset, numIndices);
  const indices = indicesBuffer;
  byteOffset += UINT32_SIZE * numIndices;

  const boundingSphereBuffer = new Float32Array(buffer, byteOffset, numBoundingSphere);
  const boundingSphere = boundingSphereBuffer;
  byteOffset += FLOAT32_SIZE * numBoundingSphere;

  return {
    buffer,
    positions,
    uvs,
    skyLightmaps,
    torchLightmaps,
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
  stringifyDataGeometry,
  parseDataGeometry,

  stringifyRenderGeometry,
  parseRenderGeometry,

  stringifyCull,
  parseCull,
};

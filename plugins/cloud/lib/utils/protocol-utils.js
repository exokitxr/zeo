const {
  NUM_RENDER_GROUPS,
} = require('../constants/constants');

const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const CLOUD_GEOMETRY_HEADER_ENTRIES = 4;
const CLOUD_GEOMETRY_HEADER_SIZE = UINT32_SIZE * CLOUD_GEOMETRY_HEADER_ENTRIES;
const CULL_HEADER_ENTRIES = 1;
const CULL_HEADER_SIZE = UINT32_SIZE * CULL_HEADER_ENTRIES;

const _getCloudGeometrySizeFromMetadata = metadata => {
  const {numPositions, numIndices, numBoundingSphere} = metadata;

  return CLOUD_GEOMETRY_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numNormals) + // normals
    (UINT32_SIZE * numIndices) + // indices
    (FLOAT32_SIZE * numBoundingSphere); // bounding sphere
};

const _getCloudGeometrySize = cloudGeometry => {
  const {positions, normals, indices, boundingSphere} = cloudGeometry;

  const numPositions = positions.length;
  const numNormals = normals.length;
  const numIndices = indices.length;
  const numBoundingSphere = boundingSphere.length;

  return _getCloudGeometrySizeFromMetadata({
    numPositions,
    numNormals,
    numIndices,
    numBoundingSphere,
  });
};

const _getCloudGeometryBufferSize = (arrayBuffer, byteOffset) => {
  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, CLOUD_GEOMETRY_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numNormals = headerBuffer[1];
  const numIndices = headerBuffer[2];
  const numBoundingSphere = headerBuffer[3];

  return _getCloudGeometrySizeFromMetadata({
    numPositions,
    numNormals,
    numIndices,
    boundingSphere,
  });
};

const stringifyCloudGeometry = (cloudGeometry, arrayBuffer, byteOffset) => {
  const {positions, normals, indices, boundingSphere} = cloudGeometry;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getCloudGeometrySize(cloudGeometry);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, CLOUD_GEOMETRY_HEADER_ENTRIES);
  headerBuffer[0] = positions.length;
  headerBuffer[1] = normals.length;
  headerBuffer[2] = indices.length;
  byteOffset += CLOUD_GEOMETRY_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, positions.length);
  positionsBuffer.set(positions);
  byteOffset += FLOAT32_SIZE * positions.length;

  const normalsBuffer = new Float32Array(arrayBuffer, byteOffset, normals.length);
  normalsBuffer.set(normals);
  byteOffset += FLOAT32_SIZE * normals.length;

  const numIndices = new Uint32Array(arrayBuffer, byteOffset, indices.length);
  numIndices.set(indices);
  byteOffset += FLOAT32_SIZE * indices.length;

  const numBoundingSphere = new Float32Array(arrayBuffer, byteOffset, boundingSphere.length);
  numBoundingSphere.set(boundingSphere);
  byteOffset += FLOAT32_SIZE * boundingSphere.length;

  return arrayBuffer;
};

const parseCloudGeometry = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, CLOUD_GEOMETRY_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numNormals = headerBuffer[1];
  const numIndices = headerBuffer[2];
  const numBoundingSphere = headerBuffer[3];
  byteOffset += CLOUD_GEOMETRY_HEADER_SIZE;

  const positionsBuffer = new Float32Array(buffer, byteOffset, numPositions);
  const positions = positionsBuffer;
  byteOffset += FLOAT32_SIZE * numPositions;

  const normalsBuffer = new Float32Array(buffer, byteOffset, numNormals);
  const normals = normalsBuffer;
  byteOffset += FLOAT32_SIZE * numNormals;

  const indicesBuffer = new Uint32Array(buffer, byteOffset, numIndices);
  const indices = indicesBuffer;
  byteOffset += FLOAT32_SIZE * numIndices;

  const boundingSphereBuffer = new Float32Array(buffer, byteOffset, numBoundingSphere);
  const boundingSphere = boundingSphereBuffer;
  byteOffset += FLOAT32_SIZE * numBoundingSphere;

  return {
    buffer,
    positions,
    normals,
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

module.exports = {
  stringifyCloudGeometry,
  parseCloudGeometry,

  stringifyCull,
  parseCull,
};

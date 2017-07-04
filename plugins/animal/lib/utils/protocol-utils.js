const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const UINT8_SIZE = 1;
const MAP_CHUNK_HEADER_ENTRIES = 6;
const MAP_CHUNK_HEADER_SIZE = UINT32_SIZE * MAP_CHUNK_HEADER_ENTRIES;

const _getGeometrySizeFromMetadata = metadata => {
  const {numPositions, numNormals, numDys, numUvs, numIndices, textureLength} = metadata;

  return MAP_CHUNK_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numNormals) + // normals
    (FLOAT32_SIZE * numDys) + // dys
    (FLOAT32_SIZE * numUvs) +  // uvs
    (UINT32_SIZE * numIndices) + // indices
    (UINT8_SIZE * textureLength); // texture
};

const _getGeometrySize = geometry => {
  const {positions, normals, dys, uvs, indices} = geometry;

  const numPositions = positions.length;
  const numNormals = normals.length;
  const numDys = dys.length;
  const numUvs = uvs.length;
  const numIndices = indices.length;
  const textureLength = texture.length;

  return _getGeometrySizeFromMetadata({
    numPositions,
    numNormals,
    numDys,
    numUvs,
    numIndices,
    textureLength,
  });
};

// stringification

const stringifyGeometry = (geometry, arrayBuffer, byteOffset) => {
  const {positions, normals, dys, uvs, indices, texture} = geometry;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getGeometrySize(geometry);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, MAP_CHUNK_HEADER_ENTRIES);
  headerBuffer[0] = positions.length;
  headerBuffer[1] = normals.length;
  headerBuffer[2] = dys.length;
  headerBuffer[3] = uvs.length;
  headerBuffer[4] = indices.length;
  headerBuffer[5] = texture.length;
  byteOffset += MAP_CHUNK_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, positions.length);
  positionsBuffer.set(positions);
  byteOffset += FLOAT32_SIZE * positions.length;

  const normalsBuffer = new Float32Array(arrayBuffer, byteOffset, normals.length);
  normalsBuffer.set(normals);
  byteOffset += FLOAT32_SIZE * normals.length;

  const dysBuffer = new Float32Array(arrayBuffer, byteOffset, dys.length);
  dysBuffer.set(dys);
  byteOffset += FLOAT32_SIZE * dys.length;

  const uvsBuffer = new Float32Array(arrayBuffer, byteOffset, uvs.length);
  uvsBuffer.set(uvs);
  byteOffset += FLOAT32_SIZE * uvs.length;

  const indicesBuffer = new Uint32Array(arrayBuffer, byteOffset, indices.length);
  indicesBuffer.set(indices);
  byteOffset += UINT32_SIZE * indices.length;

  const textureBuffer = new Uint8Array(arrayBuffer, byteOffset, texture.length);
  textureBuffer.set(texture);
  byteOffset += UINT8_SIZE * texture.length;

  return arrayBuffer;
};

// parsing

const parseGeometry = (arrayBuffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, MAP_CHUNK_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numNormals = headerBuffer[1];
  const numDys = headerBuffer[2];
  const numUvs = headerBuffer[3];
  const numIndices = headerBuffer[4];
  const textureLength = headerBuffer[5];
  byteOffset += MAP_CHUNK_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, numPositions);
  const positions = positionsBuffer;
  byteOffset += FLOAT32_SIZE * numPositions;

  const normalsBuffer = new Float32Array(arrayBuffer, byteOffset, numNormals);
  const normals = normalsBuffer;
  byteOffset += FLOAT32_SIZE * numNormals;

  const dysBuffer = new Float32Array(arrayBuffer, byteOffset, numDys);
  const dys = dysBuffer;
  byteOffset += FLOAT32_SIZE * numDys;

  const uvsBuffer = new Float32Array(arrayBuffer, byteOffset, numUvs);
  const uvs = uvsBuffer;
  byteOffset += FLOAT32_SIZE * numUvs;

  const indicesBuffer = new Uint32Array(arrayBuffer, byteOffset, numIndices);
  const indices = indicesBuffer;
  byteOffset += UINT32_SIZE * numIndices;

  const textureBuffer = new Uint8Array(arrayBuffer, byteOffset, textureLength);
  const texture = textureBuffer;
  byteOffset += UINT8_SIZE * textureLength;

  return {
    positions,
    normals,
    dys,
    uvs,
    indices,
    texture,
  };
};

module.exports = {
  stringifyGeometry,
  parseGeometry,
};

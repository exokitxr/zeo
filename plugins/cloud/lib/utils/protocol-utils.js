const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const CLOUD_GEOMETRY_HEADER_ENTRIES = 3;
const CLOUD_GEOMETRY_HEADER_SIZE = UINT32_SIZE * CLOUD_GEOMETRY_HEADER_ENTRIES;

const _getCloudGeometrySizeFromMetadata = metadata => {
  const {numPositions, numIndices} = metadata;

  return CLOUD_GEOMETRY_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numNormals) + // normals
    (UINT32_SIZE * numIndices); // indices
};

const _getCloudGeometrySize = cloudGeometry => {
  const {positions, normals, indices} = cloudGeometry;

  const numPositions = positions.length;
  const numNormals = normals.length;
  const numIndices = indices.length;

  return _getCloudGeometrySizeFromMetadata({
    numPositions,
    numNormals,
    numIndices,
  });
};

const _getCloudGeometryBufferSize = (arrayBuffer, byteOffset) => {
  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, CLOUD_GEOMETRY_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numNormals = headerBuffer[1];
  const numIndices = headerBuffer[2];

  return _getCloudGeometrySizeFromMetadata({
    numPositions,
    numNormals,
    numIndices,
  });
};

// stringification

const stringifyCloudGeometry = (cloudGeometry, arrayBuffer, byteOffset) => {
  const {positions, normals, indices} = cloudGeometry;

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

  return arrayBuffer;
};

// parsing

const parseCloudGeometry = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, CLOUD_GEOMETRY_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numNormals = headerBuffer[1];
  const numIndices = headerBuffer[2];
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

  return {
    buffer,
    positions,
    normals,
    indices,
  };
};

module.exports = {
  stringifyCloudGeometry,
  parseCloudGeometry,
};

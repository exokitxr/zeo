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

const _sum = a => {
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    const e = a[i];
    result += e;
  }
  return result;
};

const stringifyCloudGeometries = cloudGeometrys => {
  const cloudGeometrySizes = cloudGeometrys.map(_getCloudGeometrySize);
  const bufferSize = _sum(cloudGeometrySizes);
  const arrayBuffer = new ArrayBuffer(bufferSize);

  let byteOffset = 0;
  for (let i = 0; i < cloudGeometrys.length; i++) {
    const cloudGeometry = cloudGeometrys[i];

    stringifyCloudGeometry(cloudGeometry, arrayBuffer, byteOffset);

    const cloudGeometrySize = cloudGeometrySizes[i];
    byteOffset += cloudGeometrySize;
  }

  return arrayBuffer;
};

// parsing

const parseCloudGeometry = (arrayBuffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, CLOUD_GEOMETRY_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numNormals = headerBuffer[1];
  const numIndices = headerBuffer[2];
  byteOffset += CLOUD_GEOMETRY_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, numPositions);
  const positions = positionsBuffer;
  byteOffset += FLOAT32_SIZE * numPositions;

  const normalsBuffer = new Float32Array(arrayBuffer, byteOffset, numNormals);
  const normals = normalsBuffer;
  byteOffset += FLOAT32_SIZE * numNormals;

  const indicesBuffer = new Uint32Array(arrayBuffer, byteOffset, numIndices);
  const indices = indicesBuffer;
  byteOffset += FLOAT32_SIZE * numIndices;

  return {
    positions,
    normals,
    indices,
  };
};

const parseCloudGeometries = arrayBuffer => {
  const cloudGeometries = [];

  let byteOffset = 0;
  while (byteOffset < arrayBuffer.byteLength) {
    const cloudGeometry = parseCloudGeometry(arrayBuffer, byteOffset);
    cloudGeometries.push(cloudGeometry);

    const cloudGeometrySize = _getCloudGeometryBufferSize(arrayBuffer, byteOffset);
    byteOffset += cloudGeometrySize;
  }

  return cloudGeometries;
};

module.exports = {
  stringifyCloudGeometry,
  stringifyCloudGeometries,
  parseCloudGeometry,
  parseCloudGeometries,
};

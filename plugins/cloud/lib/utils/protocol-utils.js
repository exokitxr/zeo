const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const CLOUD_GEOMETRY_HEADER_ENTRIES = 2;
const CLOUD_GEOMETRY_HEADER_SIZE = UINT32_SIZE * CLOUD_GEOMETRY_HEADER_ENTRIES;

const _getCloudGeometrySizeFromMetadata = metadata => {
  const {numPositions, numIndices} = metadata;

  return CLOUD_GEOMETRY_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (UINT32_SIZE * numIndices); // indices
};

const _getCloudGeometrySize = cloudGeometry => {
  const {positions, indices} = cloudGeometry;

  const numPositions = positions.length;
  const numIndices = indices.length;

  return _getCloudGeometrySizeFromMetadata({
    numPositions,
    numIndices,
  });
};

const _getCloudGeometryBufferSize = (arrayBuffer, byteOffset) => {
  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, CLOUD_GEOMETRY_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numIndices = headerBuffer[1];

  return _getCloudGeometrySizeFromMetadata({
    numPositions,
    numIndices,
  });
};

// stringification

const stringifyCloudGeometry = (cloudGeometry, arrayBuffer, byteOffset) => {
  const {positions, indices} = cloudGeometry;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getCloudGeometrySize(cloudGeometry);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, CLOUD_GEOMETRY_HEADER_ENTRIES);
  headerBuffer[0] = positions.length;
  headerBuffer[1] = indices.length;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset + CLOUD_GEOMETRY_HEADER_SIZE, positions.length);
  positionsBuffer.set(positions);

  const numIndices = new Uint32Array(arrayBuffer, byteOffset + CLOUD_GEOMETRY_HEADER_SIZE + (FLOAT32_SIZE * positions.length), indices.length);
  numIndices.set(indices);

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
  const numIndices = headerBuffer[1];

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset + CLOUD_GEOMETRY_HEADER_SIZE, numPositions);
  const positions = positionsBuffer;

  const indicesBuffer = new Uint32Array(arrayBuffer, byteOffset + CLOUD_GEOMETRY_HEADER_SIZE + (FLOAT32_SIZE * numPositions), numIndices);
  const indices = indicesBuffer;

  return {
    positions,
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

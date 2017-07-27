const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const GEOMETRY_HEADER_ENTRIES = 5;
const GEOMETRY_HEADER_SIZE = UINT32_SIZE * GEOMETRY_HEADER_ENTRIES;

const _getGeometrySizeFromMetadata = metadata => {
  const {numPositions, numNormals, numColors, numDys, numZeroDys} = metadata;

  return GEOMETRY_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numNormals) + // normals
    (FLOAT32_SIZE * numColors) + // colors
    (FLOAT32_SIZE * numDys) + // dys
    (FLOAT32_SIZE * numZeroDys); // zero dys
};

const _getGeometrySize = geometry => {
  const {positions, normals, colors, dys, zeroDys} = geometry;

  const numPositions = positions.length;
  const numNormals = normals.length;
  const numColors = colors.length;
  const numDys = dys.length;
  const numZeroDys = zeroDys.length;

  return _getGeometrySizeFromMetadata({
    numPositions,
    numNormals,
    numColors,
    numDys,
    numZeroDys,
  });
};

// stringification

const stringifyGeometry = (geometry, arrayBuffer, byteOffset) => {
  const {positions, normals, colors, dys, zeroDys} = geometry;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getGeometrySize(geometry);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, GEOMETRY_HEADER_ENTRIES);
  headerBuffer[0] = positions.length;
  headerBuffer[1] = normals.length;
  headerBuffer[2] = colors.length;
  headerBuffer[3] = dys.length;
  headerBuffer[4] = zeroDys.length;
  byteOffset += GEOMETRY_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, positions.length);
  positionsBuffer.set(positions);
  byteOffset += FLOAT32_SIZE * positions.length;

  const normalsBuffer = new Float32Array(arrayBuffer, byteOffset, normals.length);
  normalsBuffer.set(normals);
  byteOffset += FLOAT32_SIZE * normals.length;

  const colorsBuffer = new Float32Array(arrayBuffer, byteOffset, colors.length);
  colorsBuffer.set(colors);
  byteOffset += FLOAT32_SIZE * colors.length;

  const dysBuffer = new Float32Array(arrayBuffer, byteOffset, dys.length);
  dysBuffer.set(dys);
  byteOffset += FLOAT32_SIZE * dys.length;

  const zeroDysBuffer = new Float32Array(arrayBuffer, byteOffset, zeroDys.length);
  zeroDysBuffer.set(zeroDys);
  byteOffset += FLOAT32_SIZE * zeroDys.length;

  return arrayBuffer;
};

// parsing

const parseGeometry = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, GEOMETRY_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numNormals = headerBuffer[1];
  const numColors = headerBuffer[2];
  const numDys = headerBuffer[3];
  const numZeroDys = headerBuffer[4];
  byteOffset += GEOMETRY_HEADER_SIZE;

  const positionsBuffer = new Float32Array(buffer, byteOffset, numPositions);
  const positions = positionsBuffer;
  byteOffset += FLOAT32_SIZE * numPositions;

  const normalsBuffer = new Float32Array(buffer, byteOffset, numNormals);
  const normals = normalsBuffer;
  byteOffset += FLOAT32_SIZE * numNormals;

  const colorsBuffer = new Float32Array(buffer, byteOffset, numColors);
  const colors = colorsBuffer;
  byteOffset += FLOAT32_SIZE * numColors;

  const dysBuffer = new Float32Array(buffer, byteOffset, numDys);
  const dys = dysBuffer;
  byteOffset += FLOAT32_SIZE * numDys;

  const zeroDysBuffer = new Float32Array(buffer, byteOffset, numZeroDys);
  const zeroDys = zeroDysBuffer;
  byteOffset += FLOAT32_SIZE * numZeroDys;

  return {
    buffer,
    positions,
    normals,
    colors,
    dys,
    zeroDys,
  };
};

module.exports = {
  stringifyGeometry,
  parseGeometry,
};

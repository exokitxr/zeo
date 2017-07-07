const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const TREE_GEOMETRY_HEADER_ENTRIES = 4;
const TREE_GEOMETRY_HEADER_SIZE = UINT32_SIZE * TREE_GEOMETRY_HEADER_ENTRIES;

const _getTreeGeometrySizeFromMetadata = metadata => {
  const {numPositions, numColors, numIndices, numTrees} = metadata;

  return TREE_GEOMETRY_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numColors) + // colors
    (UINT32_SIZE * numIndices) + // indices
    (UINT32_SIZE * numTrees) + // trees
    (UINT32_SIZE * 2); // height range
};

const _getTreeGeometrySize = treeGeometry => {
  const {positions, colors, indices, trees} = treeGeometry;

  const numPositions = positions.length;
  const numColors = colors.length;
  const numIndices = indices.length;
  const numTrees = trees.length;

  return _getTreeGeometrySizeFromMetadata({
    numPositions,
    numColors,
    numIndices,
    numTrees,
  });
};

const _getTreeGeometryBufferSize = (arrayBuffer, byteOffset) => {
  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, TREE_GEOMETRY_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numColors = headerBuffer[1];
  const numIndices = headerBuffer[2];
  const numTrees = headerBuffer[3];

  return _getTreeGeometrySizeFromMetadata({
    numPositions,
    numColors,
    numIndices,
    numTrees,
  });
};

// stringification

const stringifyTreeGeometry = (treeGeometry, arrayBuffer, byteOffset) => {
  const {positions, colors, indices, trees, heightRange} = treeGeometry;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getTreeGeometrySize(treeGeometry);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, TREE_GEOMETRY_HEADER_ENTRIES);
  headerBuffer[0] = positions.length;
  headerBuffer[1] = colors.length;
  headerBuffer[2] = indices.length;
  headerBuffer[3] = trees.length;
  byteOffset += TREE_GEOMETRY_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, positions.length);
  positionsBuffer.set(positions);
  byteOffset += FLOAT32_SIZE * positions.length;

  const colorsBuffer = new Float32Array(arrayBuffer, byteOffset, colors.length);
  colorsBuffer.set(colors);
  byteOffset += FLOAT32_SIZE * colors.length;

  const indicesBuffer = new Uint32Array(arrayBuffer, byteOffset, indices.length);
  indicesBuffer.set(indices);
  byteOffset += UINT32_SIZE * indices.length;

  const treesBuffer = new Uint32Array(arrayBuffer, byteOffset, trees.length);
  treesBuffer.set(trees);
  byteOffset += FLOAT32_SIZE * trees.length;

  const heightRangeBuffer = new Float32Array(arrayBuffer, byteOffset, 2);
  heightRangeBuffer[0] = heightRange[0];
  heightRangeBuffer[1] = heightRange[1];
  byteOffset += UINT32_SIZE * 2;

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

const stringifyTreeGeometries = treeGeometrys => {
  const treeGeometrySizes = treeGeometrys.map(_getTreeGeometrySize);
  const bufferSize = _sum(treeGeometrySizes);
  const arrayBuffer = new ArrayBuffer(bufferSize);

  let byteOffset = 0;
  for (let i = 0; i < treeGeometrys.length; i++) {
    const treeGeometry = treeGeometrys[i];

    stringifyTreeGeometry(treeGeometry, arrayBuffer, byteOffset);

    const treeGeometrySize = treeGeometrySizes[i];
    byteOffset += treeGeometrySize;
  }

  return arrayBuffer;
};

// parsing

const parseTreeGeometry = (arrayBuffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, TREE_GEOMETRY_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numColors = headerBuffer[1];
  const numIndices = headerBuffer[2];
  const numTrees = headerBuffer[3];
  byteOffset += TREE_GEOMETRY_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, numPositions);
  const positions = positionsBuffer;
  byteOffset += FLOAT32_SIZE * numPositions;

  const colorsBuffer = new Float32Array(arrayBuffer, byteOffset, numColors);
  const colors = colorsBuffer;
  byteOffset += FLOAT32_SIZE * numColors;

  const indicesBuffer = new Uint32Array(arrayBuffer, byteOffset, numIndices);
  const indices = indicesBuffer;
  byteOffset += UINT32_SIZE * numIndices;

  const treesBuffer = new Uint32Array(arrayBuffer, byteOffset, numTrees);
  const trees = treesBuffer;
  byteOffset += FLOAT32_SIZE * numTrees;

  const heightRangeBuffer = new Float32Array(arrayBuffer, byteOffset, 2);
  const heightRange = [
    heightRangeBuffer[0],
    heightRangeBuffer[1],
  ];
  byteOffset += UINT32_SIZE * 2;

  return {
    positions,
    colors,
    indices,
    heightRange,
  };
};

const parseTreeGeometries = arrayBuffer => {
  const treeGeometries = [];

  let byteOffset = 0;
  while (byteOffset < arrayBuffer.byteLength) {
    const treeGeometry = parseTreeGeometry(arrayBuffer, byteOffset);
    treeGeometries.push(treeGeometry);

    const treeGeometrySize = _getTreeGeometryBufferSize(arrayBuffer, byteOffset);
    byteOffset += treeGeometrySize;
  }

  return treeGeometrys;
};

module.exports = {
  stringifyTreeGeometry,
  stringifyTreeGeometries,
  parseTreeGeometry,
  parseTreeGeometries,
};

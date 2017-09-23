const zeode = require('zeode');
const {
  GEOMETRY_BUFFER_SIZE,
  BLOCK_BUFFER_SIZE,
} = zeode;
const {
  NUM_CELLS,

  NUM_CHUNKS_HEIGHT,
} = require('./lib/constants/constants');

const NUM_CELLS_HALF = NUM_CELLS / 2;
const NUM_CELLS_CUBE = Math.sqrt((NUM_CELLS_HALF + 16) * (NUM_CELLS_HALF + 16) * 3); // larger than the actual bounding box to account for geometry overflow
// const NUM_VOXELS_CHUNK_HEIGHT = BLOCK_BUFFER_SIZE / 4 / NUM_CHUNKS_HEIGHT;

module.exports = ({
  vxl,
  geometriesBuffer,
  geometryTypes,
  blockTypes,
  transparentVoxels,
  translucentVoxels,
  faceUvs,
}) => {

const _makeGeometeriesBuffer = (() => {
  const slab = new ArrayBuffer(GEOMETRY_BUFFER_SIZE * NUM_CHUNKS_HEIGHT * 7);
  let index = 0;
  const result = constructor => {
    const result = new constructor(slab, index, (GEOMETRY_BUFFER_SIZE * NUM_CHUNKS_HEIGHT) / constructor.BYTES_PER_ELEMENT);
    index += GEOMETRY_BUFFER_SIZE * NUM_CHUNKS_HEIGHT;
    return result;
  };
  result.reset = () => {
    index = 0;
  };
  return result;
})();
const boundingSpheres = (() => {
  const slab = new ArrayBuffer(NUM_CHUNKS_HEIGHT * 4 * Float32Array.BYTES_PER_ELEMENT);
  const result = Array(NUM_CHUNKS_HEIGHT);
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    result[i] = new Float32Array(slab, i * 4 * Float32Array.BYTES_PER_ELEMENT, 4);
  }
  return result;
})();
const tesselate = chunk => {
  _makeGeometeriesBuffer.reset();
  const geometriesPositions = _makeGeometeriesBuffer(Float32Array);
  const geometriesUvs = _makeGeometeriesBuffer(Float32Array);
  const geometriesSsaos = _makeGeometeriesBuffer(Uint8Array);
  const geometriesFrames = _makeGeometeriesBuffer(Float32Array);
  const geometriesObjectIndices = _makeGeometeriesBuffer(Float32Array);
  const geometriesIndices = _makeGeometeriesBuffer(Uint32Array);
  const geometriesObjects = _makeGeometeriesBuffer(Uint32Array);

  const {
    positions: numNewPositions,
    uvs: numNewUvs,
    ssaos: numNewSsaos,
    frames: numNewFrames,
    objectIndices: numNewObjectIndices,
    indices: numNewIndices,
    objects: numNewObjects,
  } = vxl.objectize({
    src: chunk.getObjectBuffer(),
    geometries: geometriesBuffer,
    geometryIndex: geometryTypes,
    blocks: chunk.getBlockBuffer(),
    blockTypes,
    dims: Int32Array.from([NUM_CELLS, NUM_CELLS, NUM_CELLS]),
    transparentVoxels,
    translucentVoxels,
    faceUvs,
    shift: Float32Array.from([chunk.x * NUM_CELLS, 0, chunk.z * NUM_CELLS]),
    positions: geometriesPositions,
    uvs: geometriesUvs,
    ssaos: geometriesSsaos,
    frames: geometriesFrames,
    objectIndices: geometriesObjectIndices,
    indices: geometriesIndices,
    objects: geometriesObjects,
  });

  const localGeometries = Array(NUM_CHUNKS_HEIGHT);
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    const attributeRangeStart = i === 0 ? 0 : numNewPositions[i - 1];
    const attributeRangeCount = numNewPositions[i] - attributeRangeStart;
    const indexRangeStart = i === 0 ? 0 : numNewIndices[i - 1];
    const indexRangeCount = numNewIndices[i] - indexRangeStart;

    const boundingSphere = boundingSpheres[i];
    boundingSphere[0] = chunk.x * NUM_CELLS + NUM_CELLS_HALF;
    boundingSphere[1] = i * NUM_CELLS + NUM_CELLS_HALF;
    boundingSphere[2] = chunk.z * NUM_CELLS + NUM_CELLS_HALF;
    boundingSphere[3] = NUM_CELLS_CUBE;

    localGeometries[i] = {
      attributeRange: {
        start: attributeRangeStart,
        count: attributeRangeCount,
      },
      indexRange: {
        start: indexRangeStart,
        count: indexRangeCount,
      },
      boundingSphere,
    };
  };

  return {
    positions: new Float32Array(geometriesPositions.buffer, geometriesPositions.byteOffset, numNewPositions[NUM_CHUNKS_HEIGHT - 1]),
    uvs: new Float32Array(geometriesUvs.buffer, geometriesUvs.byteOffset, numNewUvs[NUM_CHUNKS_HEIGHT - 1]),
    ssaos: new Uint8Array(geometriesSsaos.buffer, geometriesSsaos.byteOffset, numNewSsaos[NUM_CHUNKS_HEIGHT - 1]),
    frames: new Float32Array(geometriesFrames.buffer, geometriesFrames.byteOffset, numNewFrames[NUM_CHUNKS_HEIGHT - 1]),
    objectIndices: new Float32Array(geometriesObjectIndices.buffer, geometriesObjectIndices.byteOffset, numNewObjectIndices[NUM_CHUNKS_HEIGHT - 1]),
    indices: new Uint32Array(geometriesIndices.buffer, geometriesIndices.byteOffset, numNewIndices[NUM_CHUNKS_HEIGHT - 1]),
    objects: new Uint32Array(geometriesObjects.buffer, geometriesObjects.byteOffset, numNewObjects[NUM_CHUNKS_HEIGHT - 1]),
    geometries: localGeometries,
  };
};

return {
  tesselate,
};

};

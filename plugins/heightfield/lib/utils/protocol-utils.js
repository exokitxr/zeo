const {
  NUM_CHUNKS_HEIGHT,

  NUM_RENDER_GROUPS,
} = require('../constants/constants');

const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const UINT8_SIZE = 1;
const INT8_SIZE = 1;
const DATA_HEADER_ENTRIES = 5 + (1 * NUM_CHUNKS_HEIGHT) + 7;
const DATA_HEADER_SIZE = UINT32_SIZE * DATA_HEADER_ENTRIES;
const DECORATIONS_HEADER_ENTRIES = 2;
const DECORATIONS_HEADER_SIZE = UINT32_SIZE * DECORATIONS_HEADER_ENTRIES;
const RENDER_HEADER_ENTRIES = 5 + (1 * NUM_CHUNKS_HEIGHT) + 2;
const RENDER_HEADER_SIZE = UINT32_SIZE * RENDER_HEADER_ENTRIES;
const CULL_HEADER_ENTRIES = 1;
const CULL_HEADER_SIZE = UINT32_SIZE * CULL_HEADER_ENTRIES;

const _getDataChunkSizeFromMetadata = metadata => {
  const {numPositions, numColors, /*numSkyLightmaps, numTorchLightmaps, */numIndices, numPeeks, numHeightfield, numStaticHeightfield, numBiomes, numElevations, numEther, numLiquid} = metadata;

  return DATA_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numColors) + // colors
    // _align(UINT8_SIZE * numSkyLightmaps, UINT32_SIZE) + // sky lightmaps
    // _align(UINT8_SIZE * numTorchLightmaps, UINT32_SIZE) + // torch lightmaps
    (UINT32_SIZE * numIndices) + // indices
    (UINT32_SIZE * 6 * NUM_CHUNKS_HEIGHT) + // index range
    (FLOAT32_SIZE * NUM_CHUNKS_HEIGHT) + // bounding sphere
    (UINT8_SIZE * _sum(numPeeks)) + // peeks
    (FLOAT32_SIZE * numHeightfield) + // heightfield
    (FLOAT32_SIZE * numStaticHeightfield) + // static heightfield
    _align(UINT8_SIZE * numBiomes, FLOAT32_SIZE) + // biomes
    (FLOAT32_SIZE * numElevations) + // elevations
    (FLOAT32_SIZE * numEther) + // ethers
    (UINT8_SIZE * numLiquid) + // liquids
    (UINT8_SIZE * numLiquidTypes); // liquid types
};

const _getDataChunkSize = mapChunk => {
  const {positions, colors, /*skyLightmaps, torchLightmaps, */indices, geometries, heightfield, staticHeightfield, biomes, elevations, ether, liquid, liquidTypes} = mapChunk;

  const numPositions = positions.length;
  const numColors = colors.length;
  // const numSkyLightmaps = skyLightmaps.length;
  // const numTorchLightmaps = torchLightmaps.length;
  const numIndices = indices.length;
  const numPeeks = Array(NUM_CHUNKS_HEIGHT);
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    const geometry = geometries[i];
    const {peeks} = geometry;
    numPeeks[i] = peeks.length;
  }
  const numHeightfield = heightfield.length;
  const numStaticHeightfield = staticHeightfield.length;
  const numBiomes = biomes.length;
  const numElevations = elevations.length;
  const numEther = ether.length;
  const numLiquid = liquid.length;
  const numLiquidTypes = liquidTypes.length;

  return _getDataChunkSizeFromMetadata({
    numPositions,
    numColors,
    // numSkyLightmaps,
    // numTorchLightmaps,
    numIndices,
    numHeightfield,
    numStaticHeightfield,
    numBiomes,
    numElevations,
    numEther,
    numLiquid,
    numLiquidTypes,
  });
};

const stringifyData = (mapChunk, arrayBuffer, byteOffset) => {
  const {positions, colors, /*skyLightmaps, torchLightmaps, */indices, geometries, heightfield, staticHeightfield, biomes, elevations, ether, liquid, liquidTypes} = mapChunk;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getDataChunkSize(mapChunk);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, DATA_HEADER_ENTRIES);
  let index = 0;
  headerBuffer[index++] = positions.length;
  headerBuffer[index++] = colors.length;
  // headerBuffer[index++] = skyLightmaps.length;
  // headerBuffer[index++] = torchLightmaps.length;
  headerBuffer[index++] = indices.length;
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    const geometry = geometries[i];
    const {peeks} = geometry;
    headerBuffer[index++] = peeks.length;
  }
  headerBuffer[index++] = heightfield.length;
  headerBuffer[index++] = staticHeightfield.length;
  headerBuffer[index++] = biomes.length;
  headerBuffer[index++] = elevations.length;
  headerBuffer[index++] = ether.length;
  headerBuffer[index++] = liquid.length;
  headerBuffer[index++] = liquidTypes.length;
  byteOffset += DATA_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, positions.length);
  positionsBuffer.set(positions);
  byteOffset += FLOAT32_SIZE * positions.length;

  const colorsBuffer = new Float32Array(arrayBuffer, byteOffset, colors.length);
  colorsBuffer.set(colors);
  byteOffset += FLOAT32_SIZE * colors.length;

  /* const skyLightmapsBuffer = new Uint8Array(arrayBuffer, byteOffset, skyLightmaps.length);
  skyLightmapsBuffer.set(skyLightmaps);
  byteOffset += UINT8_SIZE * skyLightmaps.length;
  byteOffset = _align(byteOffset, UINT32_SIZE);

  const torchLightmapsBuffer = new Uint8Array(arrayBuffer, byteOffset, torchLightmaps.length);
  torchLightmapsBuffer.set(torchLightmaps);
  byteOffset += UINT8_SIZE * torchLightmaps.length;
  byteOffset = _align(byteOffset, UINT32_SIZE); */

  const indicesBuffer = new Uint32Array(arrayBuffer, byteOffset, indices.length);
  indicesBuffer.set(indices);
  byteOffset += UINT32_SIZE * indices.length;

  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    const geometry = geometries[i];
    const {indexRange, boundingSphere, peeks} = geometry;

    const indexRangeBuffer = new Uint32Array(arrayBuffer, byteOffset, 6);
    indexRangeBuffer.set(Uint32Array.from([
      indexRange.landStart,
      indexRange.landCount,
      indexRange.waterStart,
      indexRange.waterCount,
      indexRange.lavaStart,
      indexRange.lavaCount,
    ]));
    byteOffset += UINT32_SIZE * 6;

    const boundingSphereBuffer = new Float32Array(arrayBuffer, byteOffset, 4);
    boundingSphereBuffer.set(boundingSphere);
    byteOffset += FLOAT32_SIZE * 4;

    const peeksBuffer = new Uint8Array(arrayBuffer, byteOffset, peeks.length);
    peeksBuffer.set(peeks);
    byteOffset += UINT8_SIZE * peeks.length;
  }

  const heightfieldBuffer = new Float32Array(arrayBuffer, byteOffset, heightfield.length);
  heightfieldBuffer.set(heightfield);
  byteOffset += FLOAT32_SIZE * heightfield.length;

  const staticHeightfieldBuffer = new Float32Array(arrayBuffer, byteOffset, staticHeightfield.length);
  staticHeightfieldBuffer.set(staticHeightfield);
  byteOffset += FLOAT32_SIZE * staticHeightfield.length;

  const biomesBuffer = new Uint8Array(arrayBuffer, byteOffset, biomes.length);
  biomesBuffer.set(biomes);
  byteOffset += UINT8_SIZE * biomes.length;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  const elevationsBuffer = new Float32Array(arrayBuffer, byteOffset, elevations.length);
  elevationsBuffer.set(elevations);
  byteOffset += FLOAT32_SIZE * elevations.length;

  const etherBuffer = new Float32Array(arrayBuffer, byteOffset, ether.length);
  etherBuffer.set(ether);
  byteOffset += FLOAT32_SIZE * ether.length;

  const liquidBuffer = new Uint8Array(arrayBuffer, byteOffset, liquid.length);
  liquidBuffer.set(liquid);
  byteOffset += UINT8_SIZE * liquid.length;

  const liquidTypesBuffer = new Int8Array(arrayBuffer, byteOffset, liquidTypes.length);
  liquidTypesBuffer.set(liquidTypes);
  byteOffset += INT8_SIZE * liquidTypes.length;

  return [arrayBuffer, byteOffset];
};

const parseData = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, DATA_HEADER_ENTRIES);
  let index = 0;
  const numPositions = headerBuffer[index++];
  const numColors = headerBuffer[index++];
  // const numSkyLightmaps = headerBuffer[index++];
  // const numTorchLightmaps = headerBuffer[index++];
  const numIndices = headerBuffer[index++];
  const numPeeks = Array(NUM_CHUNKS_HEIGHT);
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    numPeeks[i] = headerBuffer[index++];
  }
  const numHeightfield = headerBuffer[index++];
  const numStaticHeightfield = headerBuffer[index++];
  const numBiomes = headerBuffer[index++];
  const numElevations = headerBuffer[index++];
  const numEther = headerBuffer[index++];
  const numLiquid = headerBuffer[index++];
  const numLiquidTypes = headerBuffer[index++];
  byteOffset += DATA_HEADER_SIZE;

  const positionsBuffer = new Float32Array(buffer, byteOffset, numPositions);
  const positions = positionsBuffer;
  byteOffset += FLOAT32_SIZE * numPositions;

  const colorsBuffer = new Float32Array(buffer, byteOffset, numColors);
  const colors = colorsBuffer;
  byteOffset += FLOAT32_SIZE * numColors;

  /* const skyLightmapsBuffer = new Uint8Array(buffer, byteOffset, numSkyLightmaps);
  const skyLightmaps = skyLightmapsBuffer;
  byteOffset += UINT8_SIZE * numSkyLightmaps;
  byteOffset = _align(byteOffset, UINT32_SIZE);

  const torchLightmapsBuffer = new Uint8Array(buffer, byteOffset, numTorchLightmaps);
  const torchLightmaps = torchLightmapsBuffer;
  byteOffset += UINT8_SIZE * numTorchLightmaps;
  byteOffset = _align(byteOffset, UINT32_SIZE); */

  const indicesBuffer = new Uint32Array(buffer, byteOffset, numIndices);
  const indices = indicesBuffer;
  byteOffset += UINT32_SIZE * numIndices;

  const geometries = Array(NUM_CHUNKS_HEIGHT);
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    const indexRangeBuffer = new Uint32Array(buffer, byteOffset, 6);
    const indexRange = {
      landStart: indexRangeBuffer[0],
      landCount: indexRangeBuffer[1],
      waterStart: indexRangeBuffer[2],
      waterCount: indexRangeBuffer[3],
      lavaStart: indexRangeBuffer[4],
      lavaCount: indexRangeBuffer[5],
    };
    byteOffset += UINT32_SIZE * 6;

    const boundingSphereBuffer = new Float32Array(buffer, byteOffset, 4);
    const boundingSphere = boundingSphereBuffer;
    byteOffset += FLOAT32_SIZE * 4;

    const peeksBuffer = new Uint8Array(buffer, byteOffset, numPeeks[i]);
    const peeks = peeksBuffer;
    byteOffset += UINT8_SIZE * numPeeks[i];

    geometries[i] = {
      indexRange,
      boundingSphere,
      peeks,
    };
  }

  const heightfieldBuffer = new Float32Array(buffer, byteOffset, numHeightfield);
  const heightfield = heightfieldBuffer;
  byteOffset += FLOAT32_SIZE * numHeightfield;

  const staticHeightfieldBuffer = new Float32Array(buffer, byteOffset, numStaticHeightfield);
  const staticHeightfield = staticHeightfieldBuffer;
  byteOffset += FLOAT32_SIZE * numStaticHeightfield;

  const biomesBuffer = new Uint8Array(buffer, byteOffset, numBiomes);
  const biomes = biomesBuffer;
  byteOffset += UINT8_SIZE * numBiomes;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  const elevationsBuffer = new Float32Array(buffer, byteOffset, numElevations);
  const elevations = elevationsBuffer;
  byteOffset += FLOAT32_SIZE * numElevations;

  const etherBuffer = new Float32Array(buffer, byteOffset, numEther);
  const ether = etherBuffer;
  byteOffset += FLOAT32_SIZE * numEther;

  const liquidBuffer = new Uint8Array(buffer, byteOffset, numLiquid);
  const liquid = liquidBuffer;
  byteOffset += UINT8_SIZE * numLiquid;

  const liquidTypesBuffer = new Int8Array(buffer, byteOffset, numLiquidTypes);
  const liquidTypes = liquidTypesBuffer;
  byteOffset += INT8_SIZE * numLiquidTypes;

  return {
    buffer,
    positions,
    colors,
    // skyLightmaps,
    // torchLightmaps,
    indices,
    geometries,
    heightfield,
    staticHeightfield,
    biomes,
    elevations,
    ether,
    liquid,
    liquidTypes,
  };
};

const _getRenderChunkSizeFromMetadata = metadata => {
  const {numPositions, numColors, numSkyLightmaps, numTorchLightmaps, numIndices, numPeeks, numHeightfield, numStaticHeightfield} = metadata;

  return RENDER_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numColors) + // colors
    _align(UINT8_SIZE * numSkyLightmaps, UINT32_SIZE) + // sky lightmaps
    _align(UINT8_SIZE * numTorchLightmaps, UINT32_SIZE) + // torch lightmaps
    (UINT32_SIZE * numIndices) + // indices
    (UINT32_SIZE * 6 * NUM_CHUNKS_HEIGHT) + // index range
    (FLOAT32_SIZE * NUM_CHUNKS_HEIGHT) + // bounding sphere
    (UINT8_SIZE * _sum(numPeeks)) + // peeks
    (FLOAT32_SIZE * numHeightfield) + // heightfield
    (FLOAT32_SIZE * numStaticHeightfield); // static heightfield
};

const _getRenderChunkSize = (mapChunk, decorations) => {
  const {positions, colors, indices, geometries, heightfield, staticHeightfield} = mapChunk;
  const {skyLightmaps, torchLightmaps} = decorations;

  const numPositions = positions.length;
  const numColors = colors.length;
  const numSkyLightmaps = skyLightmaps.length;
  const numTorchLightmaps = torchLightmaps.length;
  const numIndices = indices.length;
  const numPeeks = Array(NUM_CHUNKS_HEIGHT);
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    const geometry = geometries[i];
    const {peeks} = geometry;
    numPeeks[i] = peeks.length;
  }
  const numHeightfield = heightfield.length;
  const numStaticHeightfield = staticHeightfield.length;

  return _getRenderChunkSizeFromMetadata({
    numPositions,
    numColors,
    numSkyLightmaps,
    numTorchLightmaps,
    numIndices,
    numPeeks,
    numHeightfield,
    numStaticHeightfield,
  });
};

const stringifyRenderChunk = (mapChunk, decorations, arrayBuffer, byteOffset) => {
  const {positions, colors, indices, geometries, heightfield, staticHeightfield} = mapChunk;
  const {skyLightmaps, torchLightmaps} = decorations;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getRenderChunkSize(mapChunk, decorations);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, RENDER_HEADER_ENTRIES);
  let index = 0;
  headerBuffer[index++] = positions.length;
  headerBuffer[index++] = colors.length;
  headerBuffer[index++] = skyLightmaps.length;
  headerBuffer[index++] = torchLightmaps.length;
  headerBuffer[index++] = indices.length;
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    const geometry = geometries[i];
    const {peeks} = geometry;
    headerBuffer[index++] = peeks.length;
  }
  headerBuffer[index++] = heightfield.length;
  headerBuffer[index++] = staticHeightfield.length;
  byteOffset += RENDER_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, positions.length);
  positionsBuffer.set(positions);
  byteOffset += FLOAT32_SIZE * positions.length;

  const colorsBuffer = new Float32Array(arrayBuffer, byteOffset, colors.length);
  colorsBuffer.set(colors);
  byteOffset += FLOAT32_SIZE * colors.length;

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

  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    const geometry = geometries[i];
    const {indexRange, boundingSphere, peeks} = geometry;

    const indexRangeBuffer = new Uint32Array(arrayBuffer, byteOffset, 6);
    indexRangeBuffer.set(Uint32Array.from([
      indexRange.landStart,
      indexRange.landCount,
      indexRange.waterStart,
      indexRange.waterCount,
      indexRange.lavaStart,
      indexRange.lavaCount,
    ]));
    byteOffset += UINT32_SIZE * 6;

    const boundingSphereBuffer = new Float32Array(arrayBuffer, byteOffset, 4);
    boundingSphereBuffer.set(boundingSphere);
    byteOffset += FLOAT32_SIZE * 4;

    const peeksBuffer = new Uint8Array(arrayBuffer, byteOffset, peeks.length);
    peeksBuffer.set(peeks);
    byteOffset += UINT8_SIZE * peeks.length;
  }

  const heightfieldBuffer = new Float32Array(arrayBuffer, byteOffset, heightfield.length);
  heightfieldBuffer.set(heightfield);
  byteOffset += FLOAT32_SIZE * heightfield.length;

  const staticHeightfieldBuffer = new Float32Array(arrayBuffer, byteOffset, staticHeightfield.length);
  staticHeightfieldBuffer.set(staticHeightfield);
  byteOffset += FLOAT32_SIZE * staticHeightfield.length;

  return [arrayBuffer, byteOffset];
};

const parseRenderChunk = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, RENDER_HEADER_ENTRIES);
  let index = 0;
  const numPositions = headerBuffer[index++];
  const numColors = headerBuffer[index++];
  const numSkyLightmaps = headerBuffer[index++];
  const numTorchLightmaps = headerBuffer[index++];
  const numIndices = headerBuffer[index++];
  const numPeeks = Array(NUM_CHUNKS_HEIGHT);
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    numPeeks[i] = headerBuffer[index++];
  }
  const numHeightfield = headerBuffer[index++];
  const numStaticHeightfield = headerBuffer[index++];
  const numElevations = headerBuffer[index++];
  byteOffset += RENDER_HEADER_SIZE;

  const positionsBuffer = new Float32Array(buffer, byteOffset, numPositions);
  const positions = positionsBuffer;
  byteOffset += FLOAT32_SIZE * numPositions;

  const colorsBuffer = new Float32Array(buffer, byteOffset, numColors);
  const colors = colorsBuffer;
  byteOffset += FLOAT32_SIZE * numColors;

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

  const geometries = Array(NUM_CHUNKS_HEIGHT);
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    const indexRangeBuffer = new Uint32Array(buffer, byteOffset, 6);
    const indexRange = {
      landStart: indexRangeBuffer[0],
      landCount: indexRangeBuffer[1],
      waterStart: indexRangeBuffer[2],
      waterCount: indexRangeBuffer[3],
      lavaStart: indexRangeBuffer[4],
      lavaCount: indexRangeBuffer[5],
    };
    byteOffset += UINT32_SIZE * 6;

    const boundingSphereBuffer = new Float32Array(buffer, byteOffset, 4);
    const boundingSphere = boundingSphereBuffer;
    byteOffset += FLOAT32_SIZE * 4;

    const peeksBuffer = new Uint8Array(buffer, byteOffset, numPeeks[i]);
    const peeks = peeksBuffer;
    byteOffset += UINT8_SIZE * numPeeks[i];

    geometries[i] = {
      indexRange,
      boundingSphere,
      peeks,
    };
  }

  const heightfieldBuffer = new Float32Array(buffer, byteOffset, numHeightfield);
  const heightfield = heightfieldBuffer;
  byteOffset += FLOAT32_SIZE * numHeightfield;

  const staticHeightfieldBuffer = new Float32Array(buffer, byteOffset, numStaticHeightfield);
  const staticHeightfield = staticHeightfieldBuffer;
  byteOffset += FLOAT32_SIZE * numStaticHeightfield;

  return {
    buffer,
    positions,
    colors,
    skyLightmaps,
    torchLightmaps,
    indices,
    geometries,
    heightfield,
    staticHeightfield,
  };
};

const _getDecorationsSizeFromMetadata = metadata => {
  const {numSkyLightmaps, numTorchLightmaps} = metadata;

  return DECORATIONS_HEADER_SIZE + // header
    _align(UINT8_SIZE * numSkyLightmaps, FLOAT32_SIZE) + // sky lightmaps
    _align(UINT8_SIZE * numTorchLightmaps, FLOAT32_SIZE); // torch lightmaps
};

const _getDecorationsSize = decorations => {
  const {skyLightmaps, torchLightmaps} = decorations;

  const numSkyLightmaps = skyLightmaps.length;
  const numTorchLightmaps = torchLightmaps.length;

  return _getDecorationsSizeFromMetadata({
    numSkyLightmaps,
    numTorchLightmaps,
  });
};

const stringifyDecorations = (decorations, arrayBuffer, byteOffset) => {
  const {skyLightmaps, torchLightmaps} = decorations;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getDecorationsSize(decorations);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, DECORATIONS_HEADER_ENTRIES);
  let index = 0;
  headerBuffer[index++] = skyLightmaps.length;
  headerBuffer[index++] = torchLightmaps.length;
  byteOffset += DECORATIONS_HEADER_SIZE;

  const skyLightmapsBuffer = new Uint8Array(arrayBuffer, byteOffset, skyLightmaps.length);
  skyLightmapsBuffer.set(skyLightmaps);
  byteOffset += UINT8_SIZE * skyLightmaps.length;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  const torchLightmapsBuffer = new Uint8Array(arrayBuffer, byteOffset, torchLightmaps.length);
  torchLightmapsBuffer.set(torchLightmaps);
  byteOffset += UINT8_SIZE * torchLightmaps.length;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  return [arrayBuffer, byteOffset];
};

const parseDecorations = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, DECORATIONS_HEADER_ENTRIES);
  let index = 0;
  const numSkyLightmaps = headerBuffer[index++];
  const numTorchLightmaps = headerBuffer[index++];
  byteOffset += DECORATIONS_HEADER_SIZE;

  const skyLightmapsBuffer = new Uint8Array(buffer, byteOffset, numSkyLightmaps);
  const skyLightmaps = skyLightmapsBuffer;
  byteOffset += UINT8_SIZE * numSkyLightmaps;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  const torchLightmapsBuffer = new Uint8Array(buffer, byteOffset, numTorchLightmaps);
  const torchLightmaps = torchLightmapsBuffer;
  byteOffset += UINT8_SIZE * numTorchLightmaps;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  return {
    skyLightmaps,
    torchLightmaps,
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

      const groupsArray = new Int32Array(arrayBuffer, byteOffset, NUM_RENDER_GROUPS * 6);
      groupsArray.set(trackedMapChunkMeshes.groups);
      byteOffset += INT32_SIZE * 6 * NUM_RENDER_GROUPS;
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

    const landGroups = [];
    const waterGroups = [];
    const lavaGroups = [];
    const groupsArray = new Int32Array(buffer, byteOffset, NUM_RENDER_GROUPS * 6);
    for (let i = 0; i < NUM_RENDER_GROUPS; i++) {
      const baseIndex = i * 6;
      const landStart = groupsArray[baseIndex + 0];
      if (landStart !== -1) {
        landGroups.push({
          start: landStart,
          count: groupsArray[baseIndex + 1],
          materialIndex: 0,
        });
      }

      const waterStart = groupsArray[baseIndex + 2];
      if (waterStart !== -1) {
        waterGroups.push({
          start: waterStart,
          count: groupsArray[baseIndex + 3],
          materialIndex: 0,
        });
      }

      const lavaStart = groupsArray[baseIndex + 4];
      if (lavaStart !== -1) {
        lavaGroups.push({
          start: lavaStart,
          count: groupsArray[baseIndex + 5],
          materialIndex: 0,
        });
      }
    }
    byteOffset += INT32_SIZE * 6 * NUM_RENDER_GROUPS;

    mapChunks[i] = {
      index,
      landGroups,
      waterGroups,
      lavaGroups,
    };
  }
  return mapChunks;
};

const _sum = a => {
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result += a[i];
  }
  return result;
};
const _align = (n, alignment) => {
  let alignDiff = n % alignment;
  if (alignDiff > 0) {
    n += alignment - alignDiff;
  }
  return n;
};

module.exports = {
  stringifyData,
  parseData,

  stringifyRenderChunk,
  parseRenderChunk,

  stringifyDecorations,
  parseDecorations,

  stringifyCull,
  parseCull,
};

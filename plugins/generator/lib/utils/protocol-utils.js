const {
  NUM_CHUNKS_HEIGHT,

  NUM_RENDER_GROUPS,

  NUM_POSITIONS_CHUNK,
} = require('../constants/constants');

const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const UINT8_SIZE = 1;
const INT8_SIZE = 1;
const TERRAIN_DATA_HEADER_ENTRIES = 5;
const TERRAIN_DATA_HEADER_SIZE = UINT32_SIZE * TERRAIN_DATA_HEADER_ENTRIES;
const GEOMETRY_HEADER_ENTRIES = 7;
const GEOMETRY_HEADER_SIZE = UINT32_SIZE * GEOMETRY_HEADER_ENTRIES;
const WORKER_HEADER_ENTRIES = 10;
const WORKER_HEADER_SIZE = UINT32_SIZE * WORKER_HEADER_ENTRIES;
const TEMPLATE_HEADER_ENTRIES = 5;
const TEMPLATE_HEADER_SIZE = UINT32_SIZE * TEMPLATE_HEADER_ENTRIES;
const LIGHTMAPS_HEADER_ENTRIES = 2;
const LIGHTMAPS_HEADER_SIZE = UINT32_SIZE * LIGHTMAPS_HEADER_ENTRIES;
const DECORATIONS_HEADER_ENTRIES = 5;
const DECORATIONS_HEADER_SIZE = UINT32_SIZE * DECORATIONS_HEADER_ENTRIES;
const TERRAIN_RENDER_HEADER_ENTRIES = 5 + (1 * NUM_CHUNKS_HEIGHT) + 2;
const TERRAIN_RENDER_HEADER_SIZE = UINT32_SIZE * TERRAIN_RENDER_HEADER_ENTRIES;
const TERRAINS_RENDER_HEADER_ENTRIES = 1;
const TERRAINS_RENDER_HEADER_SIZE = UINT32_SIZE * TERRAINS_RENDER_HEADER_ENTRIES;
const TERRAIN_CULL_HEADER_ENTRIES = 1;
const TERRAIN_CULL_HEADER_SIZE = UINT32_SIZE * TERRAIN_CULL_HEADER_ENTRIES;
const OBJECTS_CULL_HEADER_ENTRIES = 1;
const OBJECTS_CULL_HEADER_SIZE = UINT32_SIZE * OBJECTS_CULL_HEADER_ENTRIES;
const TERRAIN_CULL_GROUP_LENGTH = (1 + NUM_RENDER_GROUPS * 6);
// const TERRAIN_CULL_GROUP_SIZE = TERRAIN_CULL_GROUP_LENGTH * 4;
const OBJECTS_CULL_GROUP_LENGTH = (1 + NUM_RENDER_GROUPS * 2);
// const OBJECTS_CULL_GROUP_SIZE = OBJECTS_CULL_GROUP_LENGTH * 4;

const _getTerrainDataChunkSizeFromMetadata = metadata => {
  const {numBiomes, numElevations, numEther, numWater, numLava} = metadata;

  return TERRAIN_DATA_HEADER_SIZE + // header
    _align(UINT8_SIZE * numBiomes, FLOAT32_SIZE) + // biomes
    (FLOAT32_SIZE * numElevations) + // elevations
    (FLOAT32_SIZE * numEther) + // ethers
    (FLOAT32_SIZE * numWater) + // water
    (FLOAT32_SIZE * numLava); // lava
};

const _getTerrainDataChunkSize = mapChunk => {
  const {biomes, elevations, ether, water, lava} = mapChunk;

  const numBiomes = biomes.length;
  const numElevations = elevations.length;
  const numEther = ether.length;
  const numWater = water.length;
  const numLava = lava.length;

  return _getTerrainDataChunkSizeFromMetadata({
    numBiomes,
    numElevations,
    numEther,
    numWater,
    numLava,
  });
};

const stringifyTerrainData = (mapChunk, arrayBuffer, byteOffset) => {
  const {biomes, elevations, ether, water, lava} = mapChunk;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getTerrainDataChunkSize(mapChunk);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, TERRAIN_DATA_HEADER_ENTRIES);
  let index = 0;
  headerBuffer[index++] = biomes.length;
  headerBuffer[index++] = elevations.length;
  headerBuffer[index++] = ether.length;
  headerBuffer[index++] = water.length;
  headerBuffer[index++] = lava.length;
  byteOffset += TERRAIN_DATA_HEADER_SIZE;

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

  const waterBuffer = new Float32Array(arrayBuffer, byteOffset, water.length);
  waterBuffer.set(water);
  byteOffset += FLOAT32_SIZE * water.length;

  const lavaBuffer = new Float32Array(arrayBuffer, byteOffset, lava.length);
  lavaBuffer.set(lava);
  byteOffset += FLOAT32_SIZE * lava.length;

  return [arrayBuffer, byteOffset];
};

const parseTerrainData = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, TERRAIN_DATA_HEADER_ENTRIES);
  let index = 0;
  const numBiomes = headerBuffer[index++];
  const numElevations = headerBuffer[index++];
  const numEther = headerBuffer[index++];
  const numWater = headerBuffer[index++];
  const numLava = headerBuffer[index++];
  byteOffset += TERRAIN_DATA_HEADER_SIZE;

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

  const waterBuffer = new Float32Array(buffer, byteOffset, numWater);
  const water = waterBuffer;
  byteOffset += FLOAT32_SIZE * numWater;

  const lavaBuffer = new Float32Array(buffer, byteOffset, numLava);
  const lava = lavaBuffer;
  byteOffset += FLOAT32_SIZE * numLava;

  return {
    buffer,
    biomes,
    elevations,
    ether,
    water,
    lava,
  };
};

const _getTerrainRenderChunkSizeFromMetadata = metadata => {
  const {numPositions, numColors, numSkyLightmaps, numTorchLightmaps, numIndices, numPeeks, numStaticHeightfield} = metadata;

  return TERRAIN_RENDER_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numColors) + // colors
    _align(UINT8_SIZE * numSkyLightmaps, UINT32_SIZE) + // sky lightmaps
    _align(UINT8_SIZE * numTorchLightmaps, UINT32_SIZE) + // torch lightmaps
    (UINT32_SIZE * numIndices) + // indices
    (UINT32_SIZE * 6 * NUM_CHUNKS_HEIGHT) + // index range
    (FLOAT32_SIZE * NUM_CHUNKS_HEIGHT) + // bounding sphere
    (UINT8_SIZE * _sum(numPeeks)) + // peeks
    (FLOAT32_SIZE * numStaticHeightfield); // static heightfield
};

const _getTerrainRenderChunkSize = (mapChunk, decorations) => {
  const {positions, colors, indices, geometries, staticHeightfield} = mapChunk;
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
  const numStaticHeightfield = staticHeightfield.length;

  return _getTerrainRenderChunkSizeFromMetadata({
    numPositions,
    numColors,
    numSkyLightmaps,
    numTorchLightmaps,
    numIndices,
    numPeeks,
    numStaticHeightfield,
  });
};

const stringifyTerrainRenderChunk = (mapChunk, decorations, arrayBuffer, byteOffset) => {
  const {positions, colors, indices, geometries, staticHeightfield, ether} = mapChunk;
  const {skyLightmaps, torchLightmaps} = decorations;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getTerrainRenderChunkSize(mapChunk, decorations);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, TERRAIN_RENDER_HEADER_ENTRIES);
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
  headerBuffer[index++] = staticHeightfield.length;
  headerBuffer[index++] = ether.length;
  byteOffset += TERRAIN_RENDER_HEADER_SIZE;

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

  const staticHeightfieldBuffer = new Float32Array(arrayBuffer, byteOffset, staticHeightfield.length);
  staticHeightfieldBuffer.set(staticHeightfield);
  byteOffset += FLOAT32_SIZE * staticHeightfield.length;

  const etherBuffer = new Float32Array(arrayBuffer, byteOffset, ether.length);
  etherBuffer.set(ether);
  byteOffset += FLOAT32_SIZE * ether.length;

  return [arrayBuffer, byteOffset];
};

const parseTerrainRenderChunk = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, TERRAIN_RENDER_HEADER_ENTRIES);
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
  const numStaticHeightfield = headerBuffer[index++];
  const numEther = headerBuffer[index++];
  byteOffset += TERRAIN_RENDER_HEADER_SIZE;

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

  const staticHeightfieldBuffer = new Float32Array(buffer, byteOffset, numStaticHeightfield);
  const staticHeightfield = staticHeightfieldBuffer;
  byteOffset += FLOAT32_SIZE * numStaticHeightfield;

  const etherBuffer = new Float32Array(buffer, byteOffset, numEther);
  const ether = etherBuffer;
  byteOffset += FLOAT32_SIZE * numEther;

  return {
    buffer,
    byteOffset,
    positions,
    colors,
    skyLightmaps,
    torchLightmaps,
    indices,
    geometries,
    staticHeightfield,
    ether,
  };
};

const _getTerrainsRenderChunkSize = chunks => {
  let result = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    result += _getTerrainRenderChunkSize(chunk.chunkData.terrain, chunk.chunkData.decorations.terrain);
  }
  return result;
};

const stringifyTerrainsRenderChunk = (mapChunks, arrayBuffer, byteOffset) => {
  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getTerrainsRenderChunkSize(mapChunks);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, TERRAINS_RENDER_HEADER_ENTRIES);
  let index = 0;
  headerBuffer[index++] = mapChunks.length;
  byteOffset += TERRAINS_RENDER_HEADER_SIZE;

  for (let i = 0; i < mapChunks.length; i++) {
    const mapChunk = mapChunks[i];
    byteOffset = stringifyTerrainRenderChunk(mapChunk.chunkData.terrain, mapChunk.chunkData.decorations.terrain, arrayBuffer, byteOffset)[1];
  }

  return [arrayBuffer, byteOffset];
};

const parseTerrainsRenderChunk = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, TERRAINS_RENDER_HEADER_ENTRIES);
  let index = 0;
  const numMapChunks = headerBuffer[index++];
  byteOffset += TERRAINS_RENDER_HEADER_SIZE;

  const mapChunks = Array(numMapChunks);
  for (let i = 0; i < numMapChunks; i++) {
    const mapChunk = parseTerrainRenderChunk(buffer, byteOffset);
    mapChunks[i] = mapChunk;
    byteOffset = mapChunk.byteOffset;
  }
  return mapChunks;
};

const _getLightmapsSizeFromMetadata = metadata => {
  const {numSkyLightmaps, numTorchLightmaps} = metadata;

  return LIGHTMAPS_HEADER_SIZE + // header
    _align(UINT8_SIZE * numSkyLightmaps, FLOAT32_SIZE) + // sky lightmaps
    _align(UINT8_SIZE * numTorchLightmaps, FLOAT32_SIZE); // torch lightmaps
};

const _getLightmapsSize = (skyLightmaps, torchLightmaps) => {
  const numSkyLightmaps = skyLightmaps.length;
  const numTorchLightmaps = torchLightmaps.length;

  return _getLightmapsSizeFromMetadata({
    numSkyLightmaps,
    numTorchLightmaps,
  });
};

const stringifyLightmaps = (skyLightmaps, torchLightmaps, arrayBuffer, byteOffset) => {
  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getLightmapsSize(skyLightmaps, torchLightmaps);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, LIGHTMAPS_HEADER_ENTRIES);
  let index = 0;
  headerBuffer[index++] = skyLightmaps.length;
  headerBuffer[index++] = torchLightmaps.length;
  byteOffset += LIGHTMAPS_HEADER_SIZE;

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

const parseLightmaps = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, LIGHTMAPS_HEADER_ENTRIES);
  let index = 0;
  const numSkyLightmaps = headerBuffer[index++];
  const numTorchLightmaps = headerBuffer[index++];
  byteOffset += LIGHTMAPS_HEADER_SIZE;

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

const _getDecorationsSizeFromMetadata = metadata => {
  const {numTerrainSkyLightmaps, numTerrainTorchLightmaps, numObjectsSkyLightmaps, numObjectsTorchLightmaps, numBlockfield} = metadata;

  return DECORATIONS_HEADER_SIZE + // header
    _align(UINT8_SIZE * numTerrainSkyLightmaps, FLOAT32_SIZE) + // terrain sky lightmaps
    _align(UINT8_SIZE * numTerrainTorchLightmaps, FLOAT32_SIZE) + // terrain torch lightmaps
    _align(UINT8_SIZE * numObjectsSkyLightmaps, FLOAT32_SIZE) + // object sky lightmaps
    _align(UINT8_SIZE * numObjectsTorchLightmaps, FLOAT32_SIZE) + // object torch lightmaps
    _align(UINT8_SIZE * numBlockfield, FLOAT32_SIZE); // blockfield
};

const _getDecorationsSize = (lightmaps, blockfield) => {
  const {
    terrain: {
      skyLightmaps: terrainSkyLightmaps,
      torchLightmaps: terrainTorchLightmaps,
    },
    objects: {
      skyLightmaps: objectsSkyLightmaps,
      torchLightmaps: objectsTorchLightmaps,
    },
  } = lightmaps;

  const numTerrainSkyLightmaps = terrainSkyLightmaps.length;
  const numTerrainTorchLightmaps = terrainTorchLightmaps.length;
  const numObjectsSkyLightmaps = objectsSkyLightmaps.length;
  const numObjectsTorchLightmaps = objectsTorchLightmaps.length;
  const numBlockfield = blockfield.length;

  return _getDecorationsSizeFromMetadata({
    numTerrainSkyLightmaps,
    numTerrainTorchLightmaps,
    numObjectsSkyLightmaps,
    numObjectsTorchLightmaps,
    numBlockfield,
  });
};

const stringifyDecorations = (lightmaps, blockfield, arrayBuffer, byteOffset) => {
  const {
    terrain: {
      skyLightmaps: terrainSkyLightmaps,
      torchLightmaps: terrainTorchLightmaps,
    },
    objects: {
      skyLightmaps: objectsSkyLightmaps,
      torchLightmaps: objectsTorchLightmaps,
    },
  } = lightmaps;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getDecorationsSize(lightmaps, blockfield);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, DECORATIONS_HEADER_ENTRIES);
  let index = 0;
  headerBuffer[index++] = terrainSkyLightmaps.length;
  headerBuffer[index++] = terrainTorchLightmaps.length;
  headerBuffer[index++] = objectsSkyLightmaps.length;
  headerBuffer[index++] = objectsTorchLightmaps.length;
  headerBuffer[index++] = blockfield.length;
  byteOffset += DECORATIONS_HEADER_SIZE;

  const terrainSkyLightmapsBuffer = new Uint8Array(arrayBuffer, byteOffset, terrainSkyLightmaps.length);
  terrainSkyLightmapsBuffer.set(terrainSkyLightmaps);
  byteOffset += UINT8_SIZE * terrainSkyLightmaps.length;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  const terrainTorchLightmapsBuffer = new Uint8Array(arrayBuffer, byteOffset, terrainTorchLightmaps.length);
  terrainTorchLightmapsBuffer.set(terrainTorchLightmaps);
  byteOffset += UINT8_SIZE * terrainTorchLightmaps.length;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  const objectsSkyLightmapsBuffer = new Uint8Array(arrayBuffer, byteOffset, objectsSkyLightmaps.length);
  objectsSkyLightmapsBuffer.set(objectsSkyLightmaps);
  byteOffset += UINT8_SIZE * objectsSkyLightmaps.length;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  const objectsTorchLightmapsBuffer = new Uint8Array(arrayBuffer, byteOffset, objectsTorchLightmaps.length);
  objectsTorchLightmapsBuffer.set(objectsTorchLightmaps);
  byteOffset += UINT8_SIZE * objectsTorchLightmaps.length;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  const blockfieldBuffer = new Uint8Array(arrayBuffer, byteOffset, blockfield.length);
  blockfieldBuffer.set(blockfield);
  byteOffset += UINT8_SIZE * blockfield.length;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  return [arrayBuffer, byteOffset];
};

const parseDecorations = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, DECORATIONS_HEADER_ENTRIES);
  let index = 0;
  const numTerrainSkyLightmaps = headerBuffer[index++];
  const numTerrainTorchLightmaps = headerBuffer[index++];
  const numObjectsSkyLightmaps = headerBuffer[index++];
  const numObjectsTorchLightmaps = headerBuffer[index++];
  const numBlockfield = headerBuffer[index++];
  byteOffset += DECORATIONS_HEADER_SIZE;

  const terrainSkyLightmapsBuffer = new Uint8Array(buffer, byteOffset, numTerrainSkyLightmaps);
  const terrainSkyLightmaps = terrainSkyLightmapsBuffer;
  byteOffset += UINT8_SIZE * numTerrainSkyLightmaps;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  const terrainTorchLightmapsBuffer = new Uint8Array(buffer, byteOffset, numTerrainTorchLightmaps);
  const terrainTorchLightmaps = terrainTorchLightmapsBuffer;
  byteOffset += UINT8_SIZE * numTerrainTorchLightmaps;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  const objectsSkyLightmapsBuffer = new Uint8Array(buffer, byteOffset, numObjectsSkyLightmaps);
  const objectsSkyLightmaps = objectsSkyLightmapsBuffer;
  byteOffset += UINT8_SIZE * numObjectsSkyLightmaps;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  const objectsTorchLightmapsBuffer = new Uint8Array(buffer, byteOffset, numObjectsTorchLightmaps);
  const objectsTorchLightmaps = objectsTorchLightmapsBuffer;
  byteOffset += UINT8_SIZE * numObjectsTorchLightmaps;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  const blockfieldBuffer = new Uint8Array(buffer, byteOffset, numBlockfield);
  const blockfield = blockfieldBuffer;
  byteOffset += UINT8_SIZE * numBlockfield;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  return {
    terrain: {
      skyLightmaps: terrainSkyLightmaps,
      torchLightmaps: terrainTorchLightmaps,
    },
    objects: {
      skyLightmaps: objectsSkyLightmaps,
      torchLightmaps: objectsTorchLightmaps,
      blockfield,
    },
  };
};

const _getTerrainCullSizeFromMetadata = metadata => {
  const {numGroups} = metadata;

  return TERRAIN_CULL_HEADER_SIZE + // header
    (numGroups * (1 + NUM_RENDER_GROUPS * 6) * INT32_SIZE); // groups
};

const _getTerrainCullSize = mapChunks => _getTerrainCullSizeFromMetadata({
  numGroups: groups.length / (1 + NUM_RENDER_GROUPS * 6),
});

const stringifyTerrainCull = (groups, arrayBuffer, byteOffset) => {
  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getTerrainCullSize(groups);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const numGroups = groups.length / TERRAIN_CULL_GROUP_LENGTH;

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, TERRAIN_CULL_HEADER_ENTRIES);
  let index = 0;
  headerBuffer[index++] = numGroups;
  byteOffset += TERRAIN_CULL_HEADER_SIZE;

  new Int32Array(arrayBuffer, byteOffset, groups.length).set(groups);
  byteOffset += groups.byteLength;

  return arrayBuffer;
};

const parseTerrainCull = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, TERRAIN_CULL_HEADER_ENTRIES);
  let index = 0;
  const numGroups = headerBuffer[index++];
  byteOffset += TERRAIN_CULL_HEADER_SIZE;

  const mapChunks = Array(numGroups);
  for (let i = 0; i < numGroups; i++) {
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

const _getGeometrySizeFromMetadata = metadata => {
  const {numPositions, numUvs, numSsaos, numFrames, numObjectIndices, numIndices, numObjects} = metadata;

  return GEOMETRY_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numUvs) + // uvs
    _align(UINT8_SIZE * numSsaos, FLOAT32_SIZE) + // ssaos
    (FLOAT32_SIZE * numFrames) + // frames
    (FLOAT32_SIZE * numObjectIndices) +  // object indices
    (UINT32_SIZE * numIndices) + // indices
    (UINT32_SIZE * numObjects) + // objects
    (UINT32_SIZE * 2 * NUM_CHUNKS_HEIGHT) + // index range
    (FLOAT32_SIZE * 4 * NUM_CHUNKS_HEIGHT); // bounding sphere
};

const _getGeometrySize = geometry => {
  const {positions, uvs, ssaos, frames, objectIndices, indices, objects} = geometry;

  const numPositions = positions.length;
  const numUvs = uvs.length;
  const numSsaos = ssaos.length;
  const numFrames = frames.length;
  const numObjectIndices = objectIndices.length;
  const numIndices = indices.length;
  const numObjects = objects.length;

  return _getGeometrySizeFromMetadata({
    numPositions,
    numUvs,
    numSsaos,
    numFrames,
    numObjectIndices,
    numIndices,
    numObjects,
  });
};

const stringifyGeometry = (geometry, arrayBuffer, byteOffset) => {
  const {positions, uvs, ssaos, frames, objectIndices, indices, objects, geometries} = geometry;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getGeometrySize(geometry);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, GEOMETRY_HEADER_ENTRIES);
  let index = 0;
  headerBuffer[index++] = positions.length;
  headerBuffer[index++] = uvs.length;
  headerBuffer[index++] = ssaos.length;
  headerBuffer[index++] = frames.length;
  headerBuffer[index++] = objectIndices.length;
  headerBuffer[index++] = indices.length;
  headerBuffer[index++] = objects.length;
  byteOffset += GEOMETRY_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, positions.length);
  positionsBuffer.set(positions);
  byteOffset += FLOAT32_SIZE * positions.length;

  const uvsBuffer = new Float32Array(arrayBuffer, byteOffset, uvs.length);
  uvsBuffer.set(uvs);
  byteOffset += FLOAT32_SIZE * uvs.length;

  const ssaosBuffer = new Uint8Array(arrayBuffer, byteOffset, ssaos.length);
  ssaosBuffer.set(ssaos);
  byteOffset += UINT8_SIZE * ssaos.length;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  const framesBuffer = new Float32Array(arrayBuffer, byteOffset, frames.length);
  framesBuffer.set(frames);
  byteOffset += FLOAT32_SIZE * frames.length;

  const objectIndexBuffer = new Float32Array(arrayBuffer, byteOffset, objectIndices.length);
  objectIndexBuffer.set(objectIndices);
  byteOffset += FLOAT32_SIZE * objectIndices.length;

  const indicesBuffer = new Uint32Array(arrayBuffer, byteOffset, indices.length);
  indicesBuffer.set(indices);
  byteOffset += UINT32_SIZE * indices.length;

  const objectsBuffer = new Uint32Array(arrayBuffer, byteOffset, objects.length);
  objectsBuffer.set(objects);
  byteOffset += UINT32_SIZE * objects.length;

  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    const geometry = geometries[i];
    const {indexRange, boundingSphere} = geometry;

    const indexRangeBuffer = new Uint32Array(arrayBuffer, byteOffset, 2);
    indexRangeBuffer.set(Uint32Array.from([indexRange.start, indexRange.count]));
    byteOffset += UINT32_SIZE * 2;

    const boundingSphereBuffer = new Float32Array(arrayBuffer, byteOffset, 4);
    boundingSphereBuffer.set(boundingSphere);
    byteOffset += FLOAT32_SIZE * 4;
  }

  return [arrayBuffer, byteOffset];
};

const parseGeometry = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, GEOMETRY_HEADER_ENTRIES);
  let index = 0;
  const numPositions = headerBuffer[index++];
  const numUvs = headerBuffer[index++];
  const numSsaos = headerBuffer[index++];
  const numFrames = headerBuffer[index++];
  const numObjectIndices = headerBuffer[index++];
  const numIndices = headerBuffer[index++];
  const numObjects = headerBuffer[index++];
  byteOffset += GEOMETRY_HEADER_SIZE;

  const positionsBuffer = new Float32Array(buffer, byteOffset, numPositions);
  const positions = positionsBuffer;
  byteOffset += FLOAT32_SIZE * numPositions;

  const uvsBuffer = new Float32Array(buffer, byteOffset, numUvs);
  const uvs = uvsBuffer;
  byteOffset += FLOAT32_SIZE * numUvs;

  const ssaosBuffer = new Uint8Array(buffer, byteOffset, numSsaos);
  const ssaos = ssaosBuffer;
  byteOffset += UINT8_SIZE * numSsaos;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  const framesBuffer = new Float32Array(buffer, byteOffset, numFrames);
  const frames = framesBuffer;
  byteOffset += FLOAT32_SIZE * numFrames;

  const objectIndexBuffer = new Float32Array(buffer, byteOffset, numObjectIndices);
  const objectIndices = objectIndexBuffer;
  byteOffset += FLOAT32_SIZE * numObjectIndices;

  const indicesBuffer = new Uint32Array(buffer, byteOffset, numIndices);
  const indices = indicesBuffer;
  byteOffset += UINT32_SIZE * numIndices;

  const objectsBuffer = new Uint32Array(buffer, byteOffset, numObjects);
  const objects = objectsBuffer;
  byteOffset += UINT32_SIZE * numObjects;

  const geometries = Array(NUM_CHUNKS_HEIGHT);
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    const indexRangeBuffer = new Uint32Array(buffer, byteOffset, 2);
    const indexRange = {
      start: indexRangeBuffer[0],
      count: indexRangeBuffer[1],
    };
    byteOffset += UINT32_SIZE * 2;

    const boundingSphereBuffer = new Float32Array(buffer, byteOffset, 4);
    const boundingSphere = boundingSphereBuffer;
    byteOffset += FLOAT32_SIZE * 4;

    geometries[i] = {
      indexRange,
      boundingSphere,
    };
  }

  return {
    buffer,
    positions,
    uvs,
    ssaos,
    frames,
    objectIndices,
    indices,
    objects,
    geometries,
  };
};

const _getWorkerSizeFromMetadata = metadata => {
  const {numPositions, numUvs, numSsaos, numFrames, numSkyLightmaps, numTorchLightmaps, numBlockfield, numObjectIndices, numIndices, numObjects} = metadata;

  return WORKER_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numUvs) + // uvs
    _align(UINT8_SIZE * numSsaos, FLOAT32_SIZE) + // ssaos
    (FLOAT32_SIZE * numFrames) + // frames
    _align(UINT8_SIZE * numSkyLightmaps, FLOAT32_SIZE) + // sky lightmaps
    _align(UINT8_SIZE * numTorchLightmaps, FLOAT32_SIZE) + // torch lightmaps
    _align(UINT8_SIZE * numBlockfield, FLOAT32_SIZE) + // blockfield
    (FLOAT32_SIZE * numObjectIndices) +  // object indices
    (UINT32_SIZE * numIndices) + // indices
    (UINT32_SIZE * numObjects) + // objects
    (UINT32_SIZE * 2 * NUM_CHUNKS_HEIGHT) + // index range
    (FLOAT32_SIZE * NUM_CHUNKS_HEIGHT); // bounding sphere
};

const _getWorkerSize = (geometry, decorations) => {
  const {positions, uvs, ssaos, frames, objectIndices, indices, objects} = geometry;
  const {skyLightmaps, torchLightmaps, blockfield} = decorations;

  const numPositions = positions.length;
  const numUvs = uvs.length;
  const numSsaos = ssaos.length;
  const numFrames = frames.length;
  const numSkyLightmaps = skyLightmaps.length;
  const numTorchLightmaps = torchLightmaps.length;
  const numBlockfield = blockfield.length;
  const numObjectIndices = objectIndices.length;
  const numIndices = indices.length;
  const numObjects = objects.length;

  return _getWorkerSizeFromMetadata({
    numPositions,
    numUvs,
    numSsaos,
    numFrames,
    numSkyLightmaps,
    numTorchLightmaps,
    numBlockfield,
    numObjectIndices,
    numIndices,
    numObjects,
  });
};

const stringifyWorker = (geometry, decorations, arrayBuffer, byteOffset) => {
  const {positions, uvs, ssaos, frames, objectIndices, indices, objects, geometries} = geometry;
  const {skyLightmaps, torchLightmaps, blockfield} = decorations;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getWorkerSize(geometry, decorations);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, WORKER_HEADER_ENTRIES);
  let index = 0;
  headerBuffer[index++] = positions.length;
  headerBuffer[index++] = uvs.length;  
  headerBuffer[index++] = ssaos.length;
  headerBuffer[index++] = frames.length;
  headerBuffer[index++] = skyLightmaps.length;
  headerBuffer[index++] = torchLightmaps.length;
  headerBuffer[index++] = blockfield.length;
  headerBuffer[index++] = objectIndices.length;
  headerBuffer[index++] = indices.length;
  headerBuffer[index++] = objects.length;
  byteOffset += WORKER_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, positions.length);
  positionsBuffer.set(positions);
  byteOffset += FLOAT32_SIZE * positions.length;

  const uvsBuffer = new Float32Array(arrayBuffer, byteOffset, uvs.length);
  uvsBuffer.set(uvs);
  byteOffset += FLOAT32_SIZE * uvs.length;

  const ssaosBuffer = new Uint8Array(arrayBuffer, byteOffset, ssaos.length);
  ssaosBuffer.set(ssaos);
  byteOffset += UINT8_SIZE * ssaos.length;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  const framesBuffer = new Float32Array(arrayBuffer, byteOffset, frames.length);
  framesBuffer.set(frames);
  byteOffset += FLOAT32_SIZE * frames.length;

  const skyLightmapsBuffer = new Uint8Array(arrayBuffer, byteOffset, skyLightmaps.length);
  skyLightmapsBuffer.set(skyLightmaps);
  byteOffset += UINT8_SIZE * skyLightmaps.length;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  const torchLightmapsBuffer = new Uint8Array(arrayBuffer, byteOffset, torchLightmaps.length);
  torchLightmapsBuffer.set(torchLightmaps);
  byteOffset += UINT8_SIZE * torchLightmaps.length;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  const blockfieldBuffer = new Uint8Array(arrayBuffer, byteOffset, blockfield.length);
  blockfieldBuffer.set(blockfield);
  byteOffset += UINT8_SIZE * blockfield.length;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  const objectIndexBuffer = new Float32Array(arrayBuffer, byteOffset, objectIndices.length);
  objectIndexBuffer.set(objectIndices);
  byteOffset += FLOAT32_SIZE * objectIndices.length;

  const indicesBuffer = new Uint32Array(arrayBuffer, byteOffset, indices.length);
  indicesBuffer.set(indices);
  byteOffset += UINT32_SIZE * indices.length;

  const objectsBuffer = new Uint32Array(arrayBuffer, byteOffset, objects.length);
  objectsBuffer.set(objects);
  byteOffset += UINT32_SIZE * objects.length;

  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    const geometry = geometries[i];
    const {indexRange, boundingSphere, peeks} = geometry;

    const indexRangeBuffer = new Uint32Array(arrayBuffer, byteOffset, 2);
    indexRangeBuffer.set(Uint32Array.from([indexRange.start, indexRange.count]));
    byteOffset += UINT32_SIZE * 2;

    const boundingSphereBuffer = new Float32Array(arrayBuffer, byteOffset, 4);
    boundingSphereBuffer.set(boundingSphere);
    byteOffset += FLOAT32_SIZE * 4;
  }

  return [arrayBuffer, byteOffset];
};

const parseWorker = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, WORKER_HEADER_ENTRIES);
  let index = 0;
  const numPositions = headerBuffer[index++];
  const numUvs = headerBuffer[index++];
  const numSsaos = headerBuffer[index++];
  const numFrames = headerBuffer[index++];
  const numSkyLightmaps = headerBuffer[index++];
  const numTorchLightmaps = headerBuffer[index++];
  const numBlockfield = headerBuffer[index++];
  const numObjectIndices = headerBuffer[index++];
  const numIndices = headerBuffer[index++];
  const numObjects = headerBuffer[index++];
  byteOffset += WORKER_HEADER_SIZE;

  const positionsBuffer = new Float32Array(buffer, byteOffset, numPositions);
  const positions = positionsBuffer;
  byteOffset += FLOAT32_SIZE * numPositions;

  const uvsBuffer = new Float32Array(buffer, byteOffset, numUvs);
  const uvs = uvsBuffer;
  byteOffset += FLOAT32_SIZE * numUvs;

  const ssaosBuffer = new Uint8Array(buffer, byteOffset, numSsaos);
  const ssaos = ssaosBuffer;
  byteOffset += UINT8_SIZE * numSsaos;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  const framesBuffer = new Float32Array(buffer, byteOffset, numFrames);
  const frames = framesBuffer;
  byteOffset += FLOAT32_SIZE * numFrames;

  const skyLightmapsBuffer = new Uint8Array(buffer, byteOffset, numSkyLightmaps);
  const skyLightmaps = skyLightmapsBuffer;
  byteOffset += UINT8_SIZE * numSkyLightmaps;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  const torchLightmapsBuffer = new Uint8Array(buffer, byteOffset, numTorchLightmaps);
  const torchLightmaps = torchLightmapsBuffer;
  byteOffset += UINT8_SIZE * numTorchLightmaps;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  const blockfieldBuffer = new Uint8Array(buffer, byteOffset, numBlockfield);
  const blockfield = blockfieldBuffer;
  byteOffset += UINT8_SIZE * numBlockfield;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  const objectIndexBuffer = new Float32Array(buffer, byteOffset, numObjectIndices);
  const objectIndices = objectIndexBuffer;
  byteOffset += FLOAT32_SIZE * numObjectIndices;

  const indicesBuffer = new Uint32Array(buffer, byteOffset, numIndices);
  const indices = indicesBuffer;
  byteOffset += UINT32_SIZE * numIndices;

  const objectsBuffer = new Uint32Array(buffer, byteOffset, numObjects);
  const objects = objectsBuffer;
  byteOffset += UINT32_SIZE * numObjects;

  const geometries = Array(NUM_CHUNKS_HEIGHT);
  for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
    const indexRangeBuffer = new Uint32Array(buffer, byteOffset, 2);
    const indexRange = {
      start: indexRangeBuffer[0],
      count: indexRangeBuffer[1],
    };
    byteOffset += UINT32_SIZE * 2;

    const boundingSphereBuffer = new Float32Array(buffer, byteOffset, 4);
    const boundingSphere = boundingSphereBuffer;
    byteOffset += FLOAT32_SIZE * 4;

    geometries[i] = {
      indexRange,
      boundingSphere,
    };
  }

  return {
    buffer,
    positions,
    uvs,
    ssaos,
    frames,
    skyLightmaps,
    torchLightmaps,
    blockfield,
    objectIndices,
    indices,
    objects,
    geometries,
  };
};

const _getTemplateSizeFromMetadata = metadata => {
  const {numPositions, numUvs, numSsaos, numFrames, numIndices} = metadata;

  return TEMPLATE_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numUvs) + // uvs
    _align(UINT8_SIZE * numSsaos, FLOAT32_SIZE) + // ssaos
    (FLOAT32_SIZE * numFrames) + // frames
    (UINT32_SIZE * numIndices) + // indices
    (FLOAT32_SIZE * 6); // bounding box
};

const _getTemplateSize = geometry => {
  const {positions, uvs, ssaos, frames, objectIndices, indices, objects} = geometry;

  const numPositions = positions.length;
  const numUvs = uvs.length;
  const numSsaos = ssaos.length;
  const numFrames = frames.length;
  const numIndices = indices.length;

  return _getTemplateSizeFromMetadata({
    numPositions,
    numUvs,
    numSsaos,
    numFrames,
    numIndices,
  });
};

const stringifyTemplate = (geometry, arrayBuffer, byteOffset) => {
  const {positions, uvs, ssaos, frames, indices, boundingBox} = geometry;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getTemplateSize(geometry);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, TEMPLATE_HEADER_ENTRIES);
  let index = 0;
  headerBuffer[index++] = positions.length;
  headerBuffer[index++] = uvs.length;
  headerBuffer[index++] = ssaos.length;
  headerBuffer[index++] = frames.length;
  headerBuffer[index++] = indices.length;
  byteOffset += TEMPLATE_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, positions.length);
  positionsBuffer.set(positions);
  byteOffset += FLOAT32_SIZE * positions.length;

  const uvsBuffer = new Float32Array(arrayBuffer, byteOffset, uvs.length);
  uvsBuffer.set(uvs);
  byteOffset += FLOAT32_SIZE * uvs.length;

  const ssaosBuffer = new Uint8Array(arrayBuffer, byteOffset, ssaos.length);
  ssaosBuffer.set(ssaos);
  byteOffset += UINT8_SIZE * ssaos.length;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  const framesBuffer = new Float32Array(arrayBuffer, byteOffset, frames.length);
  framesBuffer.set(frames);
  byteOffset += FLOAT32_SIZE * frames.length;

  const indicesBuffer = new Uint32Array(arrayBuffer, byteOffset, indices.length);
  indicesBuffer.set(indices);
  byteOffset += UINT32_SIZE * indices.length;

  const boundingBoxBuffer = new Float32Array(arrayBuffer, byteOffset, 6);
  boundingBoxBuffer.set(boundingBox);
  byteOffset += FLOAT32_SIZE * 6;

  return [arrayBuffer, byteOffset];
};

const parseTemplate = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, TEMPLATE_HEADER_ENTRIES);
  let index = 0;
  const numPositions = headerBuffer[index++];
  const numUvs = headerBuffer[index++];
  const numSsaos = headerBuffer[index++];
  const numFrames = headerBuffer[index++];
  const numIndices = headerBuffer[index++];
  byteOffset += TEMPLATE_HEADER_SIZE;

  const positionsBuffer = new Float32Array(buffer, byteOffset, numPositions);
  const positions = positionsBuffer;
  byteOffset += FLOAT32_SIZE * numPositions;

  const uvsBuffer = new Float32Array(buffer, byteOffset, numUvs);
  const uvs = uvsBuffer;
  byteOffset += FLOAT32_SIZE * numUvs;

  const ssaosBuffer = new Uint8Array(buffer, byteOffset, numSsaos);
  const ssaos = ssaosBuffer;
  byteOffset += UINT8_SIZE * numSsaos;
  byteOffset = _align(byteOffset, FLOAT32_SIZE);

  const framesBuffer = new Float32Array(buffer, byteOffset, numFrames);
  const frames = framesBuffer;
  byteOffset += FLOAT32_SIZE * numFrames;

  const indicesBuffer = new Uint32Array(buffer, byteOffset, numIndices);
  const indices = indicesBuffer;
  byteOffset += UINT32_SIZE * numIndices;

  const boundingBoxBuffer = new Float32Array(buffer, byteOffset, 6);
  const boundingBox = boundingBoxBuffer;
  byteOffset += FLOAT32_SIZE * 6;

  return {
    buffer,
    positions,
    uvs,
    ssaos,
    frames,
    indices,
    boundingBox,
  };
};

const _getTemplatesSize = () => {
  return (NUM_POSITIONS_CHUNK * UINT8_SIZE) + // geometries buffer
    (4096 * UINT32_SIZE) + // geometry types
    (4096 * UINT32_SIZE) + // block types
    (256 * UINT8_SIZE) + // transparent voxels
    (256 * UINT8_SIZE) + // translucent voxels
    (256 * 6 * 4 * FLOAT32_SIZE) + // face uvs
    (256 * UINT32_SIZE); // lights
};

const stringifyTemplates = (geometry, arrayBuffer, byteOffset) => {
  const {geometriesBuffer, geometryTypes, blockTypes, transparentVoxels, translucentVoxels, faceUvs, lights} = geometry;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getTemplatesSize();
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const geometriesBufferBuffer = new Uint8Array(arrayBuffer, byteOffset, NUM_POSITIONS_CHUNK);
  geometriesBufferBuffer.set(geometriesBuffer);
  byteOffset += UINT8_SIZE * NUM_POSITIONS_CHUNK;

  const geometryTypesBuffer = new Uint32Array(arrayBuffer, byteOffset, 4096);
  geometryTypesBuffer.set(geometryTypes);
  byteOffset += 4096 * UINT32_SIZE;

  const blockTypesBuffer = new Uint32Array(arrayBuffer, byteOffset, 4096);
  blockTypesBuffer.set(blockTypes);
  byteOffset += 4096 * UINT32_SIZE;

  const transparentVoxelsBuffer = new Uint8Array(arrayBuffer, byteOffset, 256);
  transparentVoxelsBuffer.set(transparentVoxels);
  byteOffset += 256 * UINT8_SIZE;

  const translucentVoxelsBuffer = new Uint8Array(arrayBuffer, byteOffset, 256);
  translucentVoxelsBuffer.set(translucentVoxels);
  byteOffset += 256 * UINT8_SIZE;

  const faceUvsBuffer = new Float32Array(arrayBuffer, byteOffset, 256 * 6 * 4);
  faceUvsBuffer.set(faceUvs);
  byteOffset += 256 * 6 * 4 * FLOAT32_SIZE;

  const lightsBuffer = new Float32Array(arrayBuffer, byteOffset, 256);
  lightsBuffer.set(lights);
  byteOffset += 256 * UINT32_SIZE;

  return [arrayBuffer, byteOffset];
};

const parseTemplates = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const geometriesBufferBuffer = new Uint8Array(buffer, byteOffset, NUM_POSITIONS_CHUNK);
  const geometriesBuffer = geometriesBufferBuffer;
  byteOffset += UINT8_SIZE * NUM_POSITIONS_CHUNK;

  const geometryTypesBuffer = new Uint32Array(buffer, byteOffset, 4096);
  const geometryTypes = geometryTypesBuffer;
  byteOffset += 4096 * UINT32_SIZE;

  const blockTypesBuffer = new Uint32Array(buffer, byteOffset, 4096);
  const blockTypes = blockTypesBuffer;
  byteOffset += 4096 * UINT32_SIZE;

  const transparentVoxelsBuffer = new Uint8Array(buffer, byteOffset, 256);
  const transparentVoxels = transparentVoxelsBuffer;
  byteOffset += 256 * UINT8_SIZE;

  const translucentVoxelsBuffer = new Uint8Array(buffer, byteOffset, 256);
  const translucentVoxels = translucentVoxelsBuffer;
  byteOffset += 256 * UINT8_SIZE;

  const faceUvsBuffer = new Float32Array(buffer, byteOffset, 256 * 6 * 4);
  const faceUvs = faceUvsBuffer;
  byteOffset += 256 * 6 * 4 * FLOAT32_SIZE;

  const lightsBuffer = new Uint32Array(buffer, byteOffset, 256);
  const lights = lightsBuffer;
  byteOffset += 256 * UINT32_SIZE;

  return {
    geometriesBuffer,
    geometryTypes,
    blockTypes,
    transparentVoxels,
    translucentVoxels,
    faceUvs,
    lights,
  };
};

const _getObjectsCullSizeFromMetadata = metadata => {
  const {numGroups} = metadata;

  return TERRAIN_CULL_HEADER_SIZE + // header
    (numGroups * (1 + NUM_RENDER_GROUPS * 2) * INT32_SIZE); // groups
};

const _getObjectsCullSize = groups => _getObjectsCullSizeFromMetadata({
  numGroups: groups.length / (1 + NUM_RENDER_GROUPS * 2),
});

const stringifyObjectsCull = (groups, arrayBuffer, byteOffset) => {
  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getObjectsCullSize(groups);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const numGroups = groups.length / OBJECTS_CULL_GROUP_LENGTH;

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, OBJECTS_CULL_HEADER_ENTRIES);
  let index = 0;
  headerBuffer[index++] = numGroups;
  byteOffset += OBJECTS_CULL_HEADER_SIZE;

  new Int32Array(arrayBuffer, byteOffset, groups.length).set(groups);
  byteOffset += groups.byteLength;

  return arrayBuffer;
};

const parseObjectsCull = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, OBJECTS_CULL_HEADER_ENTRIES);
  let index = 0;
  const numGroups = headerBuffer[index++];
  byteOffset += OBJECTS_CULL_HEADER_SIZE;

  const objectChunks = Array(numGroups);
  for (let i = 0; i < numGroups; i++) {
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

    objectChunks[i] = {
      index,
      groups,
    };
  }
  return objectChunks;
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
  stringifyTerrainData,
  parseTerrainData,

  stringifyTerrainRenderChunk,
  parseTerrainRenderChunk,

  stringifyTerrainsRenderChunk,
  parseTerrainsRenderChunk,

  stringifyLightmaps,
  parseLightmaps,

  stringifyDecorations,
  parseDecorations,

  stringifyTerrainCull,
  parseTerrainCull,

  stringifyGeometry,
  parseGeometry,

  stringifyWorker,
  parseWorker,

  stringifyTemplate,
  parseTemplate,

  stringifyTemplates,
  parseTemplates,

  stringifyObjectsCull,
  parseObjectsCull,
};

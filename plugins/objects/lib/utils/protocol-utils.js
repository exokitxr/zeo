const {
  NUM_CHUNKS_HEIGHT,

  NUM_RENDER_GROUPS,
} = require('../constants/constants');

const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const UINT8_SIZE = 1;
const FLOAT32_SIZE = 4;
const GEOMETRY_HEADER_ENTRIES = 7;
const GEOMETRY_HEADER_SIZE = UINT32_SIZE * GEOMETRY_HEADER_ENTRIES;
const WORKER_HEADER_ENTRIES = 9;
const WORKER_HEADER_SIZE = UINT32_SIZE * WORKER_HEADER_ENTRIES;
const DECORATIONS_HEADER_ENTRIES = 2;
const DECORATIONS_HEADER_SIZE = UINT32_SIZE * DECORATIONS_HEADER_ENTRIES;
const TEMPLATE_HEADER_ENTRIES = 5;
const TEMPLATE_HEADER_SIZE = UINT32_SIZE * TEMPLATE_HEADER_ENTRIES;
const CULL_HEADER_ENTRIES = 1;
const CULL_HEADER_SIZE = UINT32_SIZE * CULL_HEADER_ENTRIES;

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
    (FLOAT32_SIZE * NUM_CHUNKS_HEIGHT); // bounding sphere
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

const _getWorkerSizeFromMetadata = metadata => {
  const {numPositions, numUvs, numSsaos, numFrames, numSkyLightmaps, numTorchLightmaps, numObjectIndices, numIndices, numObjects} = metadata;

  return WORKER_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numUvs) + // uvs
    _align(UINT8_SIZE * numSsaos, FLOAT32_SIZE) + // ssaos
    (FLOAT32_SIZE * numFrames) + // frames
    _align(UINT8_SIZE * numSkyLightmaps, FLOAT32_SIZE) + // sky lightmaps
    _align(UINT8_SIZE * numTorchLightmaps, FLOAT32_SIZE) + // torch lightmaps
    (FLOAT32_SIZE * numObjectIndices) +  // object indices
    (UINT32_SIZE * numIndices) + // indices
    (UINT32_SIZE * numObjects) + // objects
    (UINT32_SIZE * 2 * NUM_CHUNKS_HEIGHT) + // index range
    (FLOAT32_SIZE * NUM_CHUNKS_HEIGHT); // bounding sphere
};

const _getWorkerSize = (geometry, decorations) => {
  const {positions, uvs, ssaos, frames, objectIndices, indices, objects} = geometry;
  const {skyLightmaps, torchLightmaps} = decorations;

  const numPositions = positions.length;
  const numUvs = uvs.length;
  const numSsaos = ssaos.length;
  const numFrames = frames.length;
  const numSkyLightmaps = skyLightmaps.length;
  const numTorchLightmaps = torchLightmaps.length;
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
    numObjectIndices,
    numIndices,
    numObjects,
  });
};

const stringifyWorker = (geometry, decorations, arrayBuffer, byteOffset) => {
  const {positions, uvs, ssaos, frames, objectIndices, indices, objects, geometries} = geometry;
  const {skyLightmaps, torchLightmaps} = decorations;

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

const _getCullSizeFromMetadata = metadata => {
  const {numObjectChunks} = metadata;

  return CULL_HEADER_SIZE + // header
    ((INT32_SIZE + (INT32_SIZE * 2 * NUM_RENDER_GROUPS)) * numObjectChunks); // object chunks
};

const _getCullSize = objectChunks => {
  const numObjectChunks = objectChunks.length;

  return _getCullSizeFromMetadata({
    numObjectChunks,
  });
};

const stringifyCull = (objectChunks, arrayBuffer, byteOffset) => {
  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getCullSize(objectChunks);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, CULL_HEADER_ENTRIES);
  let index = 0;
  const headerIndex = index;
  byteOffset += CULL_HEADER_SIZE;

  let numChunks = 0;
  for (const index in objectChunks) {
    const chunk = objectChunks[index];

    if (chunk) {
      const {renderSpec} = chunk;

      if (renderSpec) {
        const indexArray = new Int32Array(arrayBuffer, byteOffset, 1);
        indexArray[0] = renderSpec.index;
        byteOffset += INT32_SIZE;

        const groupsArray = new Int32Array(arrayBuffer, byteOffset, NUM_RENDER_GROUPS * 2);
        groupsArray.set(renderSpec.groups);
        byteOffset += INT32_SIZE * 2 * NUM_RENDER_GROUPS;
      }

      numChunks++;
    }
  }
  headerBuffer[headerIndex] = numChunks;

  return arrayBuffer;
};

const parseCull = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, CULL_HEADER_ENTRIES);
  let index = 0;
  const numObjectChunks = headerBuffer[index++];
  byteOffset += CULL_HEADER_SIZE;

  const objectChunks = Array(numObjectChunks);
  for (let i = 0; i < numObjectChunks; i++) {
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

const _align = (n, alignment) => {
  let alignDiff = n % alignment;
  if (alignDiff > 0) {
    n += alignment - alignDiff;
  }
  return n;
};

module.exports = {
  stringifyGeometry,
  parseGeometry,

  stringifyDecorations,
  parseDecorations,

  stringifyWorker,
  parseWorker,

  stringifyTemplate,
  parseTemplate,

  stringifyCull,
  parseCull,
};

importScripts('/archae/assets/three.js');
const {exports: THREE} = self.module;
self.module = {};

const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS_CHUNK = 200 * 1024;

const pixelGeometryVerticesCache = {};
const _getPixelGeometryVertices = size => {
  const entry = pixelGeometryVerticesCache[size];

  if (entry) {
    return entry.slice();
  } else {
    const newEntry = (() => {
      const cubeGeometry = new THREE.CubeGeometry(size, size, size);
      for (let i = 0; i < cubeGeometry.vertices.length; i++) {
        cubeGeometry.vertices[i].x -= size / 2;
        cubeGeometry.vertices[i].y -= size / 2;
        cubeGeometry.vertices[i].z -= size / 2;
      }
      const bufferGeometry = new THREE.BufferGeometry().fromGeometry(cubeGeometry);
      return bufferGeometry.getAttribute('position').array;
    })();
    pixelGeometryVerticesCache[size] = newEntry;
    return newEntry.slice();
  };
};
const _getPixelVertices = (x, y, width, height, size) => {
  const pixelVertices = _getPixelGeometryVertices(size);
  const numVertices = pixelVertices.length / 3;
  for (let i = 0; i < numVertices; i++) {
    const baseIndex = i * 3;
    pixelVertices[baseIndex + 0] += (-(width / 2) + x + 1) * size;
    pixelVertices[baseIndex + 1] -= (-(height / 2) + y) * size;
    pixelVertices[baseIndex + 2] += size / 2;
  }
  return pixelVertices;
};

const _makeImageDataGeometry = (width, height, size, imageDataData) => {
  const getPixel = (imageDataData, x, y, pixelData) => {
    const index = (x + y * width) * 4;
    pixelData[0] = imageDataData[index + 0];
    pixelData[1] = imageDataData[index + 1];
    pixelData[2] = imageDataData[index + 2];
    pixelData[3] = imageDataData[index + 3];
  };

  const positions = new Float32Array(NUM_POSITIONS_CHUNK);
  const colors = new Float32Array(NUM_POSITIONS_CHUNK);
  let attributeIndex = 0;
  const pixelData = Array(4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      getPixel(imageDataData, x, y, pixelData);

      const aFactor = pixelData[3] / 255;
      if (aFactor > 0.5) {
        const newPositions = _getPixelVertices(x, y, width, height, size);
        positions.set(newPositions, attributeIndex);

        const numNewPositions = newPositions.length / 3;
        const rFactor = pixelData[0] / 255;
        const gFactor = pixelData[1] / 255;
        const bFactor = pixelData[2] / 255;
        for (let i = 0; i < numNewPositions; i++) {
          const baseIndex = i * 3;
          colors[attributeIndex + baseIndex + 0] = rFactor;
          colors[attributeIndex + baseIndex + 1] = gFactor;
          colors[attributeIndex + baseIndex + 2] = bFactor;
        }

        attributeIndex += newPositions.length;
      }
    }
  }
  const numPositions = attributeIndex / 3;
  const dys = new Float32Array(numPositions * 2);
  for (let i = 0; i < numPositions; i++) {
    dys[(i * 2) + 0] = positions[(i * 3) + 0];
    dys[(i * 2) + 1] = positions[(i * 3) + 2];
  }

  const geometry = new THREE.BufferGeometry();
  geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, 0, attributeIndex), 3));
  geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(colors.buffer, 0, attributeIndex), 3));
  geometry.addAttribute('dy', new THREE.BufferAttribute(dys, 2));
  geometry.computeVertexNormals();

  return {
    positions: geometry.getAttribute('position').array,
    normals: geometry.getAttribute('normal').array,
    colors: geometry.getAttribute('color').array,
    dys: geometry.getAttribute('dy').array,
  };
};

self.onmessage = e => {
  const {data: {width, height, size, imageDataBuffer, buffer}} = e;
  const geometrySpec = _makeImageDataGeometry(width, height, size, new Uint8Array(imageDataBuffer));
  const resultBuffer = protocolUtils.stringifyGeometry(geometrySpec, buffer, 0);

  postMessage(resultBuffer, [resultBuffer]);
};

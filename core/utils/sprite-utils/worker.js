importScripts('/archae/assets/three.js');
const {exports: THREE} = self.module;
self.module = {};

const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS_CHUNK = 200 * 1024;

/* const pixelGeometryVerticesCache = {};
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
}; */

const _makeImageDataGeometry = (width, height, size, imageDataData) => {
  const vertices = [
    [-size/2, size/2, -size/2], // 0 left up back
    [size/2, size/2, -size/2], // 1 right up back
    [-size/2, size/2, size/2], // 2 left up front
    [size/2, size/2, size/2], // 3 right up front
    [-size/2, -size/2, -size/2], // 4 left down back
    [size/2, -size/2, -size/2], // 5 right down back
    [-size/2, -size/2, size/2], // 6 left down front
    [size/2, -size/2, size/2], // 7 right down front
  ];
  const getPixelValue = (imageDataData, x, y, pixelData) => {
    const index = (x + y * width) * 4;
    pixelData[0] = imageDataData[index + 0];
    pixelData[1] = imageDataData[index + 1];
    pixelData[2] = imageDataData[index + 2];
    pixelData[3] = imageDataData[index + 3];
  };
  const getPixelVertices = (x, y, left, right, top, bottom) => {
    const result = vertices[2].concat(vertices[6]).concat(vertices[3]) // front
      .concat(vertices[6]).concat(vertices[7]).concat(vertices[3])
      .concat(vertices[1]).concat(vertices[5]).concat(vertices[0]) // back
      .concat(vertices[5]).concat(vertices[4]).concat(vertices[0]);

    if (left) {
      result.push.apply(
        result,
        vertices[0].concat(vertices[4]).concat(vertices[2])
          .concat(vertices[4]).concat(vertices[6]).concat(vertices[2])
      );
    }
    if (right) {
      result.push.apply(
        result,
        vertices[3].concat(vertices[7]).concat(vertices[1])
          .concat(vertices[7]).concat(vertices[5]).concat(vertices[1])
      );
    }
    if (top) {
      result.push.apply(
        result,
        vertices[0].concat(vertices[2]).concat(vertices[1])
          .concat(vertices[2]).concat(vertices[3]).concat(vertices[1])
      );
    }
    if (bottom) {
      result.push.apply(
        result,
        vertices[6].concat(vertices[4]).concat(vertices[7])
          .concat(vertices[4]).concat(vertices[5]).concat(vertices[7])
      );
    }

    const numPositions = result.length / 3;
    for (let i = 0; i < numPositions; i++) {
      const baseIndex = i * 3;
      result[baseIndex + 0] += (-(width / 2) + x) * size;
      result[baseIndex + 1] -= (-(height / 2) + y) * size;
      // result[baseIndex + 2] += size / 2;
    }
    return Float32Array.from(result);
  };
  const isSolidPixel = (x, y) => imageDataData[((x + y * width) * 4) + 3] >= 128;

  const positions = new Float32Array(NUM_POSITIONS_CHUNK);
  const colors = new Float32Array(NUM_POSITIONS_CHUNK);
  let attributeIndex = 0;
  const pixelData = Array(4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      getPixelValue(imageDataData, x, y, pixelData);

      if (pixelData[3] >= 128) {
        const newPositions = getPixelVertices(
          x,
          y,
          !((x - 1) >= 0 && isSolidPixel(x - 1, y)),
          !((x + 1) < width && isSolidPixel(x + 1, y)),
          !((y - 1) >= 0 && isSolidPixel(x, y - 1)),
          !((y + 1) < height && isSolidPixel(x, y + 1))
        );
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

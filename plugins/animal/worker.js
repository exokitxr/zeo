importScripts('/archae/three/three.js');
const {exports: THREE} = self.module;
self.module = {};

const colors = require('./lib/data/colors.json');
const protocolUtils = require('./lib/utils/protocol-utils');

const _sum = a => {
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    const e = a[i];
    result += e;
  }
  return result;
};
const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
  for (let i = 0; i < src.length; i++) {
    dst[startIndexIndex + i] = src[i] + startAttributeIndex;
  }
};

const _makeCubeGeometry = ({rotate = false, invert = false, odd = false, scale = [1, 1]} = {}) => {
  const size = 1;
  const halfSize = size/2;

  const positions = Float32Array.from([
    -halfSize, +halfSize, -halfSize,
    -halfSize, -halfSize, -halfSize,
    +halfSize, +halfSize, -halfSize,
    +halfSize, -halfSize, -halfSize,

    -halfSize, -halfSize, +halfSize,
    +halfSize, -halfSize, +halfSize,
    -halfSize, +halfSize, +halfSize,
    +halfSize, +halfSize, +halfSize,

    -halfSize, +halfSize, -halfSize,
    +halfSize, +halfSize, -halfSize,

    -halfSize, +halfSize, -halfSize,
    -halfSize, +halfSize, +halfSize,

    +halfSize, +halfSize, -halfSize,
    +halfSize, +halfSize, +halfSize,
  ]);
  const dys = (() => {
    if (rotate) {
      const numPositions = positions.length / 3;
      const result = new Float32Array(numPositions * 2);
      for (let i = 0; i < numPositions; i++) {
        result[(i * 2) + 0] = positions[(i * 3) + 2] * scale[0]; // x is z
        result[(i * 2) + 1] = (positions[(i * 3) + 1] - halfSize) * scale[1]; // y is y
      }
      return result;
    } else {
      return new Float32Array(positions.length / 3 * 2);
    }
  })();
  const uvs = Float32Array.from([
    0, 0.66,
    0.25, 0.66,
    0, 0.33,
    0.25, 0.33,

    0.5, 0.66,
    0.5, 0.33,
    0.75, 0.66,
    0.75, 0.33,

    1, 0.66,
    1, 0.33,

    0.25, 1,
    0.5, 1,

    0.25, 0,
    0.5, 0,
  ]);
  const indices = Float32Array.from([
    0, 2, 1, // front
    1, 2, 3,
    4, 5, 6, // back
    5, 7, 6,
    6, 7, 8, //top
    7, 9 ,8, 
    1, 3, 4, //bottom
    3, 5, 4,
    1, 11,10, // left
    1, 4, 11,
    3, 12, 5, //right
    5, 12, 13,
  ]);
  if (invert) {
    const numIndices = indices.length / 3;
    for (let i = 0; i < numIndices; i++) {
      const baseIndex = i * 3;
      indices[baseIndex + 0] = indices[baseIndex + 0];
      const indices1 = indices[baseIndex + 1];
      indices[baseIndex + 1] = indices[baseIndex + 2];
      indices[baseIndex + 2] = indices1;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.addAttribute('dy', new THREE.BufferAttribute(dys, 3));
  geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
};
const animalGeometry = (() => {
  const bodyGeometry = (() => {
    const type = Math.random() < 0.5 ? 'long' : 'high';
    const width = 0.3 + (Math.random() * 0.3);
    const height = (type === 'long') ? (0.2 + (Math.random() * 0.4)) : (1 + (Math.random() * 1));
    const depth = (type === 'long') ? (1 + (Math.random() * 1)) : (0.2 + (Math.random() * 0.4));

    const geometry = _makeCubeGeometry()
      .applyMatrix(new THREE.Matrix4().makeScale(width, height, depth));
    geometry.width = width;
    geometry.height = height;
    geometry.depth = depth;
    return geometry;
  })();
  const legGeometries = (() => {
    const numLegs = 1 + Math.floor(Math.random() * (3 +  1));
    const width = 0.05 + (Math.random() * 0.2);
    const height = 0.2 + (Math.random() * 0.8);
    const depth = 0.05 + (Math.random() * 0.2);
    const offsetX = 0.6 + (Math.random() * 0.4);
    const offsetY = 0 + (Math.random() * 0.2);
    const offsetZ = -0.1 + (Math.random() * 0.2);
    const scaleZ = (1 / (1 + Math.abs(offsetZ))) - (Math.random() * 0.2);
    const legOffsets = (() => {
      const result = Array(numLegs);
      for (let i = 0; i < numLegs; i++) {
        result[i] = new THREE.Vector2(
          -0.1 + (Math.random() * 0.2),
          -0.01 + (Math.random() * 0.02)
        );
      }
      return result;
    })();

    const result = [];
    for (let i = 0; i < numLegs; i++) {
      const odd = i % 2 === 1;

      const leftGeometry = _makeCubeGeometry({rotate: true, odd, scale: [depth, height]})
        .applyMatrix(new THREE.Matrix4().makeScale(width, height, depth))
        .applyMatrix(new THREE.Matrix4().makeTranslation(
          -offsetX*bodyGeometry.width/2 + legOffsets[i].x*bodyGeometry.width/2,
          -bodyGeometry.height/2 - height/2 + offsetY*bodyGeometry.height + legOffsets[i].y*bodyGeometry.height/2,
          ((-bodyGeometry.depth/2 + (numLegs === 1 ? (bodyGeometry.depth/2) : (i/(numLegs-1)*bodyGeometry.depth))) * scaleZ) + offsetZ*bodyGeometry.depth
        ));
      result.push(leftGeometry);

      const rightGeometry = _makeCubeGeometry({rotate: true, invert: true, odd, scale: [depth, height]})
        .applyMatrix(new THREE.Matrix4().makeScale(-width, height, depth))
        .applyMatrix(new THREE.Matrix4().makeTranslation(
          offsetX*bodyGeometry.width/2 - legOffsets[i].x*bodyGeometry.width/2,
          -bodyGeometry.height/2 - height/2 + offsetY*bodyGeometry.height + legOffsets[i].y*bodyGeometry.height/2,
          ((-bodyGeometry.depth/2 + (numLegs === 1 ? (bodyGeometry.depth/2) : (i/(numLegs-1)*bodyGeometry.depth))) * scaleZ) + offsetZ*bodyGeometry.depth
        ));
      result.push(rightGeometry);
    }
    return result;
  })();
  const geometries = [bodyGeometry].concat(legGeometries);

  const numPositions = _sum(geometries.map(g => g.getAttribute('position').array.length));
  const numNormals = _sum(geometries.map(g => g.getAttribute('normal').array.length));
  const numDys = _sum(geometries.map(g => g.getAttribute('dy').array.length));
  const numUvs = _sum(geometries.map(g => g.getAttribute('uv').array.length));
  const numIndices = _sum(geometries.map(g => g.index.array.length));

  const positions = new Float32Array(numPositions);
  const normals = new Float32Array(numNormals);
  const dys = new Float32Array(numDys);
  const uvs = new Float32Array(numUvs);
  const indices = new Uint32Array(numIndices);
  let attributeIndex = 0;
  let dyIndex = 0;
  let uvIndex = 0;
  let indexIndex = 0;

  for (let i = 0; i < geometries.length; i++) {
    const geometry = geometries[i];

    const newPositions = geometry.getAttribute('position').array;
    positions.set(newPositions, attributeIndex);
    const newNormals = geometry.getAttribute('normal').array;
    normals.set(newNormals, attributeIndex);
    const newDys = geometry.getAttribute('dy').array;
    dys.set(newDys, dyIndex);
    const newUvs = geometry.getAttribute('uv').array;
    uvs.set(newUvs, uvIndex);
    const newIndices = geometry.index.array;
    _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

    attributeIndex += newPositions.length;
    dyIndex += newDys.length;
    uvIndex += newUvs.length;
    indexIndex += newIndices.length;
  }

  const texture = (() => {
    const size = 16;
    const width = 4 * size;
    const height = 3 * size;
    const numPixels = width * height;
    const data = new Uint8Array(numPixels * 3);

    const palette = colors[Math.floor(Math.random() * colors.length)];
    const baseColor = new THREE.Color().setStyle(palette[0]);
    const grainColor = new THREE.Color().setStyle(palette[1]);
    const boxColor = new THREE.Color().setStyle(palette[2]);
    const graininess = 0.4 + Math.random() * 0.4;
    const boxes = (() => {
      const numBoxes = Math.floor(0 + (Math.random() * 20));

      const result = Array(numBoxes);
      for (let i = 0; i < numBoxes; i++) {
        const box = new THREE.Box2().setFromCenterAndSize(
          new THREE.Vector2(Math.random() * width, Math.random() * height),
          new THREE.Vector2((0.1 + (Math.random() * 0.2)) * width, (0.1 + (Math.random() * 0.2)) * height)
        );
        box.value = Math.random() * 0.5;
        result[i] = box;
      }
      return result;
    })();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = new THREE.Vector2(x, y);
        const c = baseColor.clone().lerp(grainColor, Math.random() * graininess);
        for (let i = 0; i < boxes.length; i++) {
          const box = boxes[i];

          if (box.containsPoint(p)) {
            const {value} = box;
            c.lerp(boxColor, value);
          }
        }

        const baseIndex = (x + (y * width)) * 3;
        data[baseIndex + 0] = c.r * 255;
        data[baseIndex + 1] = c.g * 255;
        data[baseIndex + 2] = c.b * 255;
      }
    }

    return data;
  })();

  return {
    positions: new Float32Array(positions.buffer, positions.byteOffset, attributeIndex),
    dys: new Float32Array(dys.buffer, dys.byteOffset, dyIndex),
    normals: new Float32Array(positions.buffer, positions.byteOffset, attributeIndex),
    uvs: new Float32Array(uvs.buffer, uvs.byteOffset, uvIndex),
    indices: new Uint32Array(indices.buffer, indices.byteOffset, indexIndex),
    texture: texture,
  };
})();

self.onmessage = e => {
  const {data: {buffer}} = e;
  const resultBuffer = protocolUtils.stringifyGeometry(animalGeometry, buffer, 0);
  postMessage(resultBuffer, [resultBuffer]);
};

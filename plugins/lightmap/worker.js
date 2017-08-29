const {
  NUM_CELLS,
  NUM_CELLS_HEIGHT,
} = require('./lib/constants/constants');
self.module = {};

const width = NUM_CELLS;
const depth = NUM_CELLS;
const height = NUM_CELLS_HEIGHT;
const width1 = NUM_CELLS + 1;
const depth1 = NUM_CELLS + 1;
const width1depth1 = width1 * depth1;

const DIRECTIONS = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

const BLENDS = {
  'add': (a, b) => Math.min(Math.max(a + b, 0), 255),
  'sub': (a, b) => Math.min(Math.max(a - b, 0), 255),
  'max': (a, b) => Math.max(a, b),
};

class Ambient {
  constructor({id, v, blend}) {
    this.type = 'ambient';

    this.id = id;
    this.v = v;
    this.blend = BLENDS[blend];
  }

  set(spec) {
    if (spec.v !== undefined) {
      this.v = spec.v;
    }
  }

  getRange() {
    return [
      -Infinity,
      -Infinity,
      Infinity,
      Infinity,
    ];
  }
}
class Heightfield {
  constructor({id, x, z, v, data, blend}) {
    this.type = 'heightfield';

    this.id = id;
    this.x = x;
    this.z = z;
    this.v = v;
    this.data = data;
    this.blend = BLENDS[blend];

    this.sky = true;
  }

  set(spec) {
    if (spec.x !== undefined) {
      this.x = spec.x;
    }
    if (spec.z !== undefined) {
      this.z = spec.z;
    }
    if (spec.v !== undefined) {
      this.v = spec.v;
    }
    if (spec.data !== undefined) {
      this.data = spec.data;
    }
  }

  getRange() {
    const {x, z} = this;
    return [
      x,
      z,
      x + NUM_CELLS,
      z + NUM_CELLS,
    ];
  }
}
class Ether {
  constructor({id, x, z, data, blend}) {
    this.type = 'ether';

    this.id = id;
    this.x = x;
    this.z = z;
    this.data = data;
    this.blend = BLENDS[blend];

    this.sky = true;
  }

  set(spec) {
    if (spec.x !== undefined) {
      this.x = spec.x;
    }
    if (spec.z !== undefined) {
      this.z = spec.z;
    }
    if (spec.data !== undefined) {
      this.data = spec.data;
    }
  }

  getRange() {
    const {x, z} = this;
    return [
      x,
      z,
      x + NUM_CELLS,
      z + NUM_CELLS,
    ];
  }
}
class Sphere {
  constructor({id, x, y, z, r, v, blend}) {
    this.type = 'sphere';

    this.id = id;
    this.x = Math.floor(x);
    this.y = Math.floor(y);
    this.z = Math.floor(z);
    this.r = Math.floor(r);
    this.v = v;
    this.blend = BLENDS[blend];

    this.sky = false;
  }

  set(spec) {
    if (spec.x !== undefined) {
      this.x = spec.x;
    }
    if (spec.y !== undefined) {
      this.y = spec.y;
    }
    if (spec.z !== undefined) {
      this.z = spec.z;
    }
    if (spec.r !== undefined) {
      this.r = spec.r;
    }
    if (spec.v !== undefined) {
      this.v = spec.v;
    }
  }

  getRange() {
    const {x, z, r} = this;
    return [
      x - r,
      z - r,
      x + r,
      z + r,
    ];
  }
}
class Cylinder {
  constructor({id, x, y, z, h, r, v, blend}) {
    this.type = 'cylinder';

    this.id = id;
    this.x = Math.floor(x);
    this.y = Math.floor(y);
    this.z = Math.floor(z);
    this.h = Math.floor(h);
    this.r = Math.floor(r);
    this.v = v;
    this.blend = BLENDS[blend];

    this.sky = false;
  }

  set(spec) {
    if (spec.x !== undefined) {
      this.x = spec.x;
    }
    if (spec.y !== undefined) {
      this.y = spec.y;
    }
    if (spec.z !== undefined) {
      this.z = spec.z;
    }
    if (spec.h !== undefined) {
      this.h = spec.h;
    }
    if (spec.r !== undefined) {
      this.r = spec.r;
    }
    if (spec.v !== undefined) {
      this.v = spec.v;
    }
  }

  getRange() {
    const {x, z, r} = this;
    return [
      x - r,
      z - r,
      x + r,
      z + r,
    ];
  }
}
class Voxel {
  constructor({id, x, y, z, v, blend}) {
    this.type = 'voxel';

    this.id = id;
    this.x = Math.floor(x);
    this.y = Math.floor(y);
    this.z = Math.floor(z);
    this.v = v;
    this.blend = BLENDS[blend];

    this.sky = false;
  }

  set(spec) {
    if (spec.x !== undefined) {
      this.x = spec.x;
    }
    if (spec.y !== undefined) {
      this.y = spec.y;
    }
    if (spec.z !== undefined) {
      this.z = spec.z;
    }
    if (spec.v !== undefined) {
      this.v = spec.v;
    }
  }

  getRange() {
    const {x, z} = this;
    return [
      x,
      z,
      x + 1,
      z + 1,
    ];
  }
}

const SHAPES = {
  'ambient': Ambient,
  'heightfield': Heightfield,
  'ether': Ether,
  'sphere': Sphere,
  'cylinder': Cylinder,
  'voxel': Voxel,
};

const _renderShape = (shape, ox, oz, lx, ly, lz, value) => {
  switch (shape.type) {
    case 'heightfield': {
      const {x, z, v, data, blend} = shape; // XXX get rid of v

      if (ox === (x / width) && oz === (z / depth)) {
        const elevation = data[lx + lz * (NUM_CELLS + 1)];
        value = blend(value, Math.min(Math.max((ly - (elevation - 8)) / 8, 0), 1) * 255);
      }

      break;
    }
    case 'ether': {
      // XXX

      break;
    }
    case 'sphere': {
      const {x, y, z, r, v, blend} = shape;

      const ax = (ox * width) + lx;
      const ay = ly;
      const az = (oz * depth) + lz;

      const dx = ax - x;
      const dy = ay - y;
      const dz = az - z;

      const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
      const dr = r - 1;
      const maxDistance = Math.sqrt(dr * dr * 3);
      if (distance < maxDistance) {
        const distanceFactor = (maxDistance - distance) / maxDistance;
        value = blend(value, Math.min(distanceFactor * distanceFactor * v, 1) * 255);
      }

      break;
    }
    /* case 'cylinder': {
      const {x, y, z, h, r, v, blend} = shape;
      const ax = x - (ox * width);
      const ay = y;
      const az = z - (oz * depth);

      const dr = r - 1;
      const maxDistance = Math.sqrt(dr*dr*2);
      for (let dz = -dr; dz <= dr; dz++) {
        for (let dx = -dr; dx <= dr; dx++) {
          const radiusFactor = (maxDistance - Math.sqrt(dx*dx + dz*dz)) / maxDistance;

          for (let dy = 0; dy < h; dy++) {
            const lx = ax + dx;
            const ly = ay + dy;
            const lz = az + dz;

            if (_isInRange(lx, width) && _isInRange(ly, height) && _isInRange(lz, depth)) {
              const lightmapIndex = lx + (lz * width1) + (ly * width1depth1);
              const distanceFactor = radiusFactor * (1 - (dy / h));
              skyArray[lightmapIndex] = blend(skyArray[lightmapIndex], Math.min(distanceFactor * distanceFactor * v, 1) * 255);
            }
          }
        }
      }

      break;
    }
    case 'voxel': {
      const {x, y, z, r, blend} = shape;
      const ax = x - (ox * width);
      const ay = y;
      const az = z - (ox * height);

      if (_isInRange(ax, width) && _isInRange(ay, height) && _isInRange(az, depth)) {
        const lightmapIndex = ax + (az * width1) + (ay * width1depth1);
        skyArray[lightmapIndex] = blend(skyArray[lightmapIndex], v);
      }

      break;
    } */
  }

  return value;
};
const _getLight = (ox, oz, lx, ly, lz, sky) => {
  let ambientValue = 0;
  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i];
    if (shape.type === 'ambient') {
      ambientValue += shape.v;
    }
  }
  let value = ambientValue;

  // add/sub
  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i];
    if (shape.sky === sky && shape.blend !== BLENDS.max) {
      value = _renderShape(shape, ox, oz, lx, ly, lz, value);
    }
  }

  // max
  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i];
    if (shape.sky === sky && shape.blend === BLENDS.max) {
      value = _renderShape(shape, ox, oz, lx, ly, lz, value);
    }
  }

  return value;
};
/* const _isInRange = (n, l) => n >= 0 && n <= l;
const _intersectRect = (r1, r2) =>
  !(r2[0] > r1[2] || 
   r2[2] < r1[0] || 
   r2[1] > r1[3] ||
   r2[3] < r1[1]); */

const shapes = [];
/* const skyLightmapsArray = new Uint8Array(width1 * depth1 * height);
const torchLightmapsArray = new Uint8Array(width1 * depth1 * height); */

self.onmessage = e => {
  const {data} = e;
  const {type} = data;

  if (type === 'addShape') {
    const {spec} = data;
    const {type} = spec;

    const shape = new (SHAPES[type])(spec);
    shapes.push(shape);
  } else if (type === 'removeShape') {
    const {id} = data;

    const index = shapes.findIndex(shape => shape.id === id);
    shapes.splice(index, 1);
  } else if (type === 'setShapeData') {
    const {id, spec} = data;

    const shape = shapes.find(shape => shape.id === id);
    shape.set(spec);
  } else if (type === 'removeShapes') {
    const {ids} = data;

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const index = shapes.findIndex(shape => shape.id === id);
      shapes.splice(index, 1);
    }
  } else if (type === 'render') {
    const {lightmapBuffer} = data;

    const int32Array = new Int32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset);
    const uint32Array = new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset);
    const float32Array = new Float32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset);
    const uint8Array = new Uint8Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset);

    let readWordOffset = 0;
    const numLightmaps = uint32Array[readWordOffset];
    readWordOffset++;

    let writeWordOffset = 0;
    uint32Array[writeWordOffset] = numLightmaps;
    writeWordOffset++;

    for (let i = 0; i < numLightmaps; i++) {
      const x = int32Array[readWordOffset + 0];
      const z = int32Array[readWordOffset + 1];
      readWordOffset += 2;

      const numPositions = uint32Array[readWordOffset];
      readWordOffset++;

      const positionsWordOffset = readWordOffset;
      readWordOffset += numPositions;

      const lightmapsLength = numPositions / 3;
      int32Array[writeWordOffset + 0] = x;
      int32Array[writeWordOffset + 1] = z;
      writeWordOffset += 2;

      const skyLightmapsLengthWordOffset = writeWordOffset;
      writeWordOffset++;

      const skyLightmapsByteOffset = writeWordOffset * 4;
      let writeByteOffset = skyLightmapsByteOffset + lightmapsLength;
      let alignDiff = writeByteOffset % 4;
      if (alignDiff > 0) {
        writeByteOffset += 4 - alignDiff;
      }
      writeWordOffset = writeByteOffset / 4;

      const torchLightmapsLengthWordOffset = writeWordOffset;
      writeWordOffset++;

      const torchLightmapsByteOffset = writeWordOffset * 4;
      writeByteOffset = torchLightmapsByteOffset + lightmapsLength;
      alignDiff = writeByteOffset % 4;
      if (alignDiff > 0) {
        writeByteOffset += 4 - alignDiff;
      }
      writeWordOffset = writeByteOffset / 4;

      // _getUpdate(x, z, skyLightmapsArray, torchLightmapsArray);

      const offsetX = x * width;
      const offsetZ = z * depth;
      for (let i = 0; i < lightmapsLength; i++) {
        const baseIndex = positionsWordOffset + i * 3;
        const lx = Math.min(Math.max(Math.floor(float32Array[baseIndex + 0] - offsetX), 0), NUM_CELLS + 1);
        const ly = Math.min(Math.max(Math.floor(float32Array[baseIndex + 1]), 0), NUM_CELLS_HEIGHT);
        const lz = Math.min(Math.max(Math.floor(float32Array[baseIndex + 2] - offsetZ), 0), NUM_CELLS + 1);
        // const lightmapIndex = dx + (dz * width1) + (dy * width1depth1);
        uint8Array[skyLightmapsByteOffset + i] = _getLight(x, z, lx, ly, lz, true);
        uint8Array[torchLightmapsByteOffset + i] = _getLight(x, z, lx, ly, lz, false);
      }

      uint32Array[skyLightmapsLengthWordOffset] = lightmapsLength;
      uint32Array[torchLightmapsLengthWordOffset] = lightmapsLength;
    }

    postMessage(lightmapBuffer, [lightmapBuffer.buffer]);
  } else {
    console.warn('unknown lightmap message type:', JSON.stringify(type));
  }
};

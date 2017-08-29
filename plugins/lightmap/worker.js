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

const _getUpdate = (ox, oz, skyArray, torchArray) => {
  const chunkRange = [
    ox * width,
    oz * depth,
    (ox + 1) * width,
    (oz + 1) * depth,
  ];

  const _renderShape = shape => {
    const shapeRange = shape.getRange();

    if (_intersectRect(shapeRange, chunkRange)) {
      const {type} = shape;

      switch (type) {
        case 'heightfield': {
          const {x, z, v, data, blend} = shape;

          if (x === (ox * width) && z === (oz * depth)) {
            for (let dz = 0; dz <= NUM_CELLS; dz++) {
              for (let dx = 0; dx <= NUM_CELLS; dx++) {
                const elevation = data[dx + dz * (NUM_CELLS + 1)];
                for (let dy = NUM_CELLS_HEIGHT; dy >= (elevation - 8); dy--) {
                  const lightmapIndex = dx + (dz * width1) + (dy * width1depth1);
                  skyArray[lightmapIndex] = blend(skyArray[lightmapIndex], Math.min(Math.max((dy - (elevation - 8)) / 8, 0), 1) * v * 255);
                }
              }
            }
          }

          break;
        }
        case 'ether': {
          // XXX

          break;
        }
        case 'sphere': {
          const {x, y, z, r, v, blend} = shape;
          const ax = x - (ox * width);
          const ay = y;
          const az = z - (oz * depth);

          const dr = r - 1;
          const maxDistance = Math.sqrt(dr*dr*3);
          for (let dy = -dr; dy <= dr; dy++) {
            for (let dz = -dr; dz <= dr; dz++) {
              for (let dx = -dr; dx <= dr; dx++) {
                const lx = ax + dx;
                const ly = ay + dy;
                const lz = az + dz;

                if (_isInRange(lx, width) && _isInRange(ly, height) && _isInRange(lz, depth)) {
                  const distanceFactor = (maxDistance - Math.sqrt(dx*dx + dy*dy + dz*dz)) / maxDistance;
                  const lightmapIndex = lx + (lz * width1) + (ly * width1depth1);
                  skyArray[lightmapIndex] = blend(skyArray[lightmapIndex], Math.min(distanceFactor * distanceFactor * v, 1) * 255);
                }
              }
            }
          }

          break;
        }
        case 'cylinder': {
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
        }
      }
    }
  };

  const ambientValue = (() => {
    let result = 0;
    for (let i = 0; i < shapes.length; i++) {
      const shape = shapes[i];
      if (shape.type === 'ambient') {
        result += shape.v;
      }
    }
    return result;
  })();
  skyArray.fill(ambientValue);

  // add/sub
  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i];
    if (shape.blend !== BLENDS.max) {
      _renderShape(shape);
    }
  }

  // max
  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i];
    if (shape.blend === BLENDS.max) {
      _renderShape(shape);
    }
  }
};
const _isInRange = (n, l) => n >= 0 && n <= l;
const _intersectRect = (r1, r2) =>
  !(r2[0] > r1[2] || 
   r2[2] < r1[0] || 
   r2[1] > r1[3] ||
   r2[3] < r1[1]);

const shapes = [];
const skyLightmapsArray = new Uint8Array(width1 * depth1 * height);
const torchLightmapsArray = new Uint8Array(width1 * depth1 * height);

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

    let readByteOffset = 0;
    const numLightmaps = new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + readByteOffset, 1)[0];
    readByteOffset += 4;

    let writeByteOffset = 0;
    new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + writeByteOffset, 1)[0] = numLightmaps;
    writeByteOffset += 4;

    for (let i = 0; i < numLightmaps; i++) {
      const lightmapHeaderArray = new Int32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + readByteOffset, 2);
      const x = lightmapHeaderArray[0];
      const z = lightmapHeaderArray[1];
      readByteOffset += 4 * 2;

      const numPositions = new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + readByteOffset, 1)[0];
      readByteOffset += 4;

      const positions = new Float32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + readByteOffset, numPositions);
      readByteOffset += 4 * numPositions;

      const header = new Int32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + writeByteOffset, 3);
      const lightmapsLength = numPositions / 3;
      header[0] = x;
      header[1] = z;
      writeByteOffset += 2 * 4;

      const skyLightmapsLengthArray = new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + writeByteOffset, 1);
      writeByteOffset += 4;

      const skyLightmap = new Uint8Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + writeByteOffset, lightmapsLength);
      writeByteOffset += lightmapsLength;
      let alignDiff = writeByteOffset % 4;
      if (alignDiff > 0) {
        writeByteOffset += 4 - alignDiff;
      }

      const torchLightmapsLengthArray = new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + writeByteOffset, 1);
      writeByteOffset += 4;

      const torchLightmap = new Uint8Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + writeByteOffset, lightmapsLength);
      writeByteOffset += lightmapsLength;
      alignDiff = writeByteOffset % 4;
      if (alignDiff > 0) {
        writeByteOffset += 4 - alignDiff;
      }

      _getUpdate(x, z, skyLightmapsArray, torchLightmapsArray);

      const offsetX = x * width;
      const offsetZ = z * depth;
      for (let i = 0; i < lightmapsLength; i++) {
        const baseIndex = i * 3;
        const dx = Math.min(Math.max(Math.floor(positions[baseIndex + 0] - offsetX), 0), NUM_CELLS + 1);
        const dy = Math.min(Math.max(Math.floor(positions[baseIndex + 1]), 0), NUM_CELLS_HEIGHT);
        const dz = Math.min(Math.max(Math.floor(positions[baseIndex + 2] - offsetZ), 0), NUM_CELLS + 1);
        const lightmapIndex = dx + (dz * width1) + (dy * width1depth1);
        skyLightmap[i] = skyLightmapsArray[lightmapIndex];
      }

      skyLightmapsLengthArray[0] = lightmapsLength;
      torchLightmapsLengthArray[0] = lightmapsLength;
    }

    postMessage(lightmapBuffer, [lightmapBuffer.buffer]);
  } else {
    console.warn('unknown lightmap message type:', JSON.stringify(type));
  }
};

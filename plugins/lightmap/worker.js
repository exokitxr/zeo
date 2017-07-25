const {
  NUM_CELLS,
  NUM_CELLS_HEIGHT,

  HEIGHT_OFFSET,
} = require('./lib/constants/constants');
self.module = {};

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
  constructor({v, blend}) {
    this.type = 'ambient';

    this.v = v;
    this.blend = BLENDS[blend];
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
  'sphere': Sphere,
  'cylinder': Cylinder,
  'voxel': Voxel,
};

const _getUpdate = (ox, oz, buffer) => {
  const array = new Uint8Array(buffer);

  const chunkRange = [
    ox * width,
    oz * depth,
    (ox + 1) * width,
    (oz + 1) * depth,
  ];
  const width1 = width + 1;
  const depth1 = depth + 1;
  const width1depth1 = width1 * depth1;

  const _renderShape = shape => {
    const shapeRange = shape.getRange();

    if (_intersectRect(shapeRange, chunkRange)) {
      const {type} = shape;

      switch (type) {
        case 'sphere': {
          const {x, y, z, r, v, blend} = shape;
          const ax = x - (ox * width);
          const ay = y - heightOffset;
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
                  array[lightmapIndex] = blend(array[lightmapIndex], Math.min(distanceFactor * distanceFactor * v, 1) * 255);
                }
              }
            }
          }

          break;
        }
        case 'cylinder': {
          const {x, y, z, h, r, v, blend} = shape;
          const ax = x - (ox * width);
          const ay = y - heightOffset;
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
                  array[lightmapIndex] = blend(array[lightmapIndex], Math.min(distanceFactor * distanceFactor * v, 1) * 255);
                }
              }
            }
          }

          break;
        }
        case 'voxel': {
          const {x, y, z, r, blend} = shape;
          const ax = x - (ox * width);
          const ay = y - heightOffset;
          const az = z - (ox * height);

          if (_isInRange(ax, width) && _isInRange(ay, height) && _isInRange(az, depth)) {
            const lightmapIndex = ax + (az * width1) + (ay * width1depth1);
            array[lightmapIndex] = blend(array[lightmapIndex], v);
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
  array.fill(ambientValue);

  // add/sub
  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i];
    if (shape.blend !== BLENDS.add) {
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

  return buffer;
};
const _isInRange = (n, l) => n >= 0 && n <= l;
const _intersectRect = (r1, r2) =>
  !(r2[0] > r1[2] || 
   r2[2] < r1[0] || 
   r2[1] > r1[3] ||
   r2[3] < r1[1]);

let width, height, depth, heightOffset;
const shapes = [];

self.onmessage = e => {
  const {data} = e;
  const {type} = data;

  if (type === 'init') {
    width = data.width;
    height = data.height;
    depth = data.depth;
    heightOffset = data.heightOffset;
  } else if (type === 'addShape') {
    const {spec} = data;
    const {type} = spec;

    const shape = new (SHAPES[type])(spec);
    shapes.push(shape);
  } else if (type === 'removeShape') {
    const {id} = data;

    const index = shapes.findIndex(shape => shape.id === id);
    shapes.splice(index, 1);
  } else if (type === 'removeShapes') {
    const {ids} = data;

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const index = shapes.findIndex(shape => shape.id === id);
      shapes.splice(index, 1);
    }
  } else if (type === 'requestUpdate') {
    const {ox, oz, buffer} = data;

    const resultBuffer = _getUpdate(ox, oz, buffer);

    postMessage({
      type: 'respondUpdate',
      buffer: resultBuffer,
    }, [resultBuffer]);
  } else {
    console.warn('unknown lightmap message type:', JSON.stringify(type));
  }
};

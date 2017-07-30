importScripts('/archae/assets/three.js');
const {exports: THREE} = self.module;
importScripts('/archae/assets/murmurhash.js');
const {exports: murmur} = self.module;
importScripts('/archae/assets/autows.js');
const {exports: Autows} = self.module;
importScripts('/archae/assets/alea.js');
const {exports: alea} = self.module;
importScripts('/archae/assets/indev.js');
const {exports: indev} = self.module;
self.module = {};

const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,

  DEFAULT_SEED,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');
const zeode = require('zeode');

const NUM_POSITIONS_CHUNK = 500 * 1024;

const rng = new alea(DEFAULT_SEED);
const generator = indev({
  seed: DEFAULT_SEED,
});
const elevationNoise = generator.uniform({
  frequency: 0.002,
  octaves: 8,
});
const generator2 = indev({
  seed: DEFAULT_SEED + '2',
});
const itemsNoise = generator2.uniform({
  frequency: 0.1,
  octaves: 4,
});

const zde = zeode();
const geometries = {};
const textures = {};
const generators = [];

const queue = [];
let pendingMessage = null;
const connection = new AutoWs(_wsUrl('/archae/objectsWs'));
connection.on('message', e => {
  const {data} = e;

  if (!pendingMessage) {
    const m = JSON.parse(data);
    const {type} = m;

    if (type === 'response') {
      pendingMessage = m;
    } else if (type === 'addObject') {
      // XXX
    } else if (type === 'removeObject') {
      // XXX
    } else {
      console.warn('objects worker got invalid message type:', JSON.stringify(type));
    }
  } else {
    queue.shift()(data);
    pendingMessage = null;
  }
});
const _requestChunk = (x, z) => new Promise((accept, reject) => {
  const chunk = zde.getChunk(x, z);

  if (chunk) {
    accept(chunk);
  } else {
    connection.send(JSON.stringify({
      method: 'getChunk',
      args: {
        x,
        z,
      },
    }));
    queue.push(buffer => {
      accept((buffer && buffer.byteLength > 0) ? zde.addChunk(x, z, new Uint32Array(buffer)) : zde.makeChunk(x, z));
    });
  }
})
  .then(chunk => {
    for (let i = 0; i < generators.length; i++) {
      generators[i][1](chunk, generateApi);
    }
    return chunk;
  });

const registerApi = {
  THREE,
  getUv(name) {
    const n = murmur(name);
    return textures[n];
  },
};
const generateApi = {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,
  getElevation(ox, oz, x, z) {
    const ax = (ox * NUM_CELLS) + x;
    const az = (oz * NUM_CELLS) + z;
    return (-0.3 + Math.pow(elevationNoise.in2D(ax + 1000, az + 1000), 0.5)) * 64;
  },
  getItemsNoise(ox, oz, x, z) {
    const ax = (ox * NUM_CELLS) + x;
    const az = (oz * NUM_CELLS) + z;
    return itemsNoise.in2D(ax + 1000, az + 1000);
  },
  addObject(chunk, name, position) {
    const n = murmur(name);
    chunk.addObject(n, position);
  },
};
const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
  for (let i = 0; i < src.length; i++) {
    dst[startIndexIndex + i] = src[i] + startAttributeIndex;
  }
};

function _makeChunkGeometry(chunk) {
  const positions = new Float32Array(NUM_POSITIONS_CHUNK);
  const uvs = new Float32Array(NUM_POSITIONS_CHUNK);
  const indices = new Uint16Array(NUM_POSITIONS_CHUNK);
  const objectsUint32Array = new Uint32Array(NUM_POSITIONS_CHUNK);
  const objectsFloat32Array = new Float32Array(objectsUint32Array.buffer, objectsUint32Array.byteOffset, objectsUint32Array.length);
  let attributeIndex = 0;
  let uvIndex = 0;
  let indexIndex = 0;
  let objectIndex = 0;

  chunk.forEachObject((n, position, index) => {
    const geometryEntries = geometries[n];

    if (geometryEntries) {
      for (let j = 0; j < geometryEntries.length; j++) {
        const geometry = geometryEntries[j];
        const newPositions = geometry.getAttribute('position').array;
        const numNewPositions = newPositions.length / 3;

        for (let k = 0; k < numNewPositions; k++) {
          const baseIndex = k * 3;
          positions[attributeIndex + baseIndex + 0] = newPositions[baseIndex + 0] + position[0];
          positions[attributeIndex + baseIndex + 1] = newPositions[baseIndex + 1] + position[1];
          positions[attributeIndex + baseIndex + 2] = newPositions[baseIndex + 2] + position[2];
        }
        const newUvs = geometry.getAttribute('uv').array;
        const numNewUvs = newUvs.length / 2;
        for (let k = 0; k < numNewUvs; k++) {
          const baseIndex = k * 2;
          uvs[uvIndex + baseIndex + 0] = newUvs[baseIndex + 0];
          uvs[uvIndex + baseIndex + 1] = 1 - newUvs[baseIndex + 1];
        }
        const newIndices = geometry.index.array;
        _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);
        const newObjectsHeader = Uint32Array.from([n, index, indexIndex, indexIndex + newIndices.length]);
        objectsUint32Array.set(newObjectsHeader, objectIndex);
        const newObjectsBody = Float32Array.from([position[0], position[1], position[2]]);
        objectsFloat32Array.set(newObjectsBody, objectIndex + newObjectsHeader.length);

        attributeIndex += newPositions.length;
        uvIndex += newUvs.length;
        indexIndex += newIndices.length;
        objectIndex += newObjectsHeader.length + newObjectsBody.length;
      }
    }
  });

  return {
    positions: new Float32Array(positions.buffer, positions.byteOffset, attributeIndex),
    uvs: new Float32Array(uvs.buffer, uvs.byteOffset, uvIndex),
    indices: new Uint16Array(indices.buffer, indices.byteOffset, indexIndex),
    objects: new Uint32Array(objectsUint32Array.buffer, objectsUint32Array.byteOffset, objectIndex),
  };
};
function _wsUrl(s) {
  const l = self.location;
  return ((l.protocol === 'https:') ? 'wss://' : 'ws://') + l.host + s;
}

self.onmessage = e => {
  const {data} = e;
  const {type} = data;

  if (type === 'registerGeometry') {
    const {name, args, src} = data;
    const fn = Reflect.construct(Function, args.concat(src));

    let geometry;
    try {
      geometry = fn(registerApi);
    } catch (err) {
      console.warn(err);
    }

    const n = murmur(name);
    let entry = geometries[n];
    if (!entry) {
      entry = [];
      geometries[n] = entry;
    }
    entry.push(geometry);
  } else if (type === 'registerTexture') {
    const {name, uv} = data;
    const n = murmur(name);
    textures[n] = uv;
  } else if (type === 'registerGenerator') {
    const {name, args, src} = data;
    const fn = Reflect.construct(Function, args.concat(src));

    const n = murmur(name);
    generators.push([n, fn]);

    for (let i = 0; i < zde.chunks.length; i++) {
      fn(zde.chunks[i], generateApi);
    }
  } else if (type === 'addObject') {
    const {name, position} = data;

    const x = Math.floor(position[0] / NUM_CELLS);
    const z = Math.floor(position[2] / NUM_CELLS);
    _requestChunk(x, z)
      .then(chunk => {
        const n = murmur(name);
        chunk.addObject(n, position);

        connection.send(JSON.stringify({
          method: 'addObject',
          args: {
            x,
            z,
            n,
            position,
          },
        }));
      })
      .catch(err => {
        console.warn(err);
      });
  } else if (type === 'removeObject') {
    const {x, z, index} = data;

    _requestChunk(x, z)
      .then(chunk => {
        chunk.removeObject(index);

        connection.send(JSON.stringify({
          method: 'removeObject',
          args: {
            x,
            z,
            index,
          },
        }));
      })
      .catch(err => {
        console.warn(err);
      });
  } else if (type === 'generate') {
    const {x, z} = data;
    let {buffer: resultBuffer} = data;
    _requestChunk(x, z)
      .then(chunk => {
        const geometry = _makeChunkGeometry(chunk);
        resultBuffer = protocolUtils.stringifyGeometry(geometry, resultBuffer, 0);
        postMessage(resultBuffer, [resultBuffer]);
      })
      .catch(err => {
        console.warn(err);
      });
  } else {
    console.warn('objects worker got invalid method', JSON.stringify(type));
  }
};

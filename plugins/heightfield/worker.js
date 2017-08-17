self.module = {};

const trra = require('/home/k/trra');
const indev = require('indev');
const {
  NUM_CELLS,

  DEFAULT_SEED,
} = require('./lib/constants/constants');

const tra = trra({
  seed: DEFAULT_SEED,
});

const generator = indev({
  seed: DEFAULT_SEED,
});
const elevationNoise = generator.uniform({
  frequency: 0.002,
  octaves: 8,
});

const _resArrayBuffer = res => {
  if (res.status >= 200 && res.status < 300) {
    return res.arrayBuffer();
  } else {
    return Promise.reject({
      status: res.status,
      stack: 'API returned invalid status code: ' + res.status,
    });
  }
};
const _resBlob = res => {
  if (res.status >= 200 && res.status < 300) {
    return res.blob();
  } else {
    return Promise.reject({
      status: res.status,
      stack: 'API returned invalid status code: ' + res.status,
    });
  }
};
const _getOriginHeight = () => (1 - 0.3 + Math.pow(elevationNoise.in2D(0 + 1000, 0 + 1000), 0.5)) * 64;
const _requestChunk = (x, z) => {
  const chunk = tra.getChunk(x, z);

  if (chunk) {
    return Promise.resolve(chunk);
  } else {
    return fetch(`/archae/heightfield/chunks?x=${x}&z=${z}`, {
      credentials: 'include',
    })
      .then(_resArrayBuffer)
      .then(buffer => tra.addChunk(x, z, new Uint32Array(buffer)));
  }
};

self.onmessage = e => {
  const {data} = e;
  const {method} = data;

  switch (method) {
    case 'getOriginHeight': {
      const {id} = data;

      postMessage(JSON.stringify({
        type: 'response',
        args: [id],
      }));
      postMessage(_getOriginHeight());
      break;
    }
    case 'generate': {
      const {id, args} = data;
      const {x, y, buffer} = args;

      _requestChunk(x, y)
        .then(chunk => {
          new Uint32Array(buffer).set(chunk.getBuffer());

          postMessage(JSON.stringify({
            type: 'response',
            args: [id],
          }));
          postMessage(buffer, [buffer]);
        })
        .catch(err => {
          console.warn(err);
        });
      break;
    }
    case 'ungenerate': {
      const {args} = data;
      const {x, z} = args;
      tra.removeChunk(x, z);
      break;
    }
    case 'addVoxel': {
      const {id, args} = data;
      const {position} = args;
      const [x, y, z] = position;
      // XXX regenerate locally and return immediately
      // XXX need to inform other clients of these
      return fetch(`/archae/heightfield/voxels?x=${x}&y=${y}&z=${z}`, {
        method: 'POST',
        credentials: 'include',
      })
        .then(_resBlob)
        .then(() => {
          const ox = Math.floor(x / NUM_CELLS);
          const oz = Math.floor(z / NUM_CELLS);
          tra.removeChunk(ox, oz); // XXX not needed once we regenerate locally

          postMessage(JSON.stringify({
            type: 'response',
            args: [id],
          }));
          postMessage(null);
        })
        .catch(err => {
          console.warn(err);
        });
      break;
    }
    case 'subVoxel': {
      const {id, args} = data;
      const {position} = args;
      const [x, y, z] = position;
      return fetch(`/archae/heightfield/voxels?x=${x}&y=${y}&z=${z}`, {
        method: 'DELETE',
        credentials: 'include',
      })
        .then(_resBlob)
        .then(() => {
          const ox = Math.floor(x / NUM_CELLS);
          const oz = Math.floor(z / NUM_CELLS);
          tra.removeChunk(ox, oz); // XXX not needed once we regenerate locally

          postMessage(JSON.stringify({
            type: 'response',
            args: [id],
          }));
          postMessage(null);
        })
        .catch(err => {
          console.warn(err);
        });
      break;
    }
    default: {
      console.warn('invalid heightfield worker method:', JSON.stringify(method));
      break;
    }
  }
};

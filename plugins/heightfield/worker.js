self.module = {};

const indev = require('indev');
const {
  DEFAULT_SEED,
} = require('./lib/constants/constants');

const generator = indev({
  seed: DEFAULT_SEED,
});
const elevationNoise = generator.uniform({
  frequency: 0.002,
  octaves: 8,
});
const _getOriginHeight = () => (1 - 0.3 + Math.pow(elevationNoise.in2D(0 + 1000, 0 + 1000), 0.5)) * 64;
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
      return fetch(`/archae/heightfield/chunks?x=${x}&z=${y}`, {
        credentials: 'include',
      })
        .then(_resArrayBuffer)
        .then(chunkBuffer => {
          new Uint32Array(buffer).set(new Uint32Array(chunkBuffer));

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
    case 'addVoxel': {
      const {id, args} = data;
      const {position} = args;
      const [x, y, z] = position;
      return fetch(`/archae/heightfield/voxels?x=${x}&y=${y}&z=${z}`, {
        method: 'POST',
        credentials: 'include',
      })
        .then(_resBlob)
        .then(() => {
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

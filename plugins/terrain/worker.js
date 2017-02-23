importScripts(
  '/archae/three/three.js'
);

const workerUtils = require('./lib/utils/worker-utils');
const protocolUtils = require('./lib/utils/protocol-utils');

let workerUtilsInstance = null;
const queue = [];
const _init = () => {
  archae.requestPlugins([
    '/core/plugins/random-utils',
  ]).then(([
    randomUtils,
  ]) => {
    const {alea} = randomUtils;
    
    workerUtilsInstance = workerUtils({alea});

    for (let i = 0; i < queue.length; i++) {
      const callback = queue[i];
      callback();
    }
    queue.length = 0;
  })
  .catch(err => {
    console.warn(err);
  });
};
_init();

const _requestWorkerUtilsInstance = () => new Promise((accept, reject) => {
  if (workerUtilsInstance) {
    accept(workerUtilsInstance);
  } else {
    queue.push(() => {
      accept(workerUtilsInstance);
    });
  }
});

self.onrequest = (method, args, cb) => {
  switch (method) {
    case 'generate': {
      const opts = args[0];
      const {offset, position} = opts;

      _requestWorkerUtilsInstance()
        .then(workerUtilsInstance => {
          const builtMapChunk = workerUtilsInstance.buildMapChunk({
            offset,
            position,
          });
          const compiledMapChunk = workerUtilsInstance.compileMapChunk(builtMapChunk);
          const mapChunkBuffer = protocolUtils.stringifyMapChunk(compiledMapChunk);

          const value = {
            mapChunk: mapChunkBuffer,
          };
          const transfers = [
            mapChunkBuffer.buffer,
          ];
          cb(null, value, transfers);
        })
        .catch(err => {
          cb(err);
        });

      break;
    }
    default: {
      const err = new Error('unknown method');
      cb(err.stack);

      break;
    }
  }
};

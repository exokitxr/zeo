importScripts('/archae/three/three.js');
const {exports: THREE} = self.module;
self.module = {};

const workerUtilser = require('./lib/utils/worker-utils');
const protocolUtils = require('./lib/utils/protocol-utils');
const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,
} = require('./lib/constants/constants');

const workerUtils = workerUtilser({THREE});

const _generate = (x, y) => {
  const builtMapChunk = workerUtils.buildMapChunk({
    offset: {
      x,
      y,
    },
  });
  return workerUtils.compileMapChunk(builtMapChunk);
};

self.onmessage = e => {
  const {data} = e;
  const {method} = data;

  switch (method) {
    case 'getOriginHeight': {
      const originHeight = workerUtils.getOriginHeight();

      postMessage(originHeight);
      break;
    }
    case 'generate': {
      const {args} = data;
      const {x, y, buffer} = args;
      const mapChunk = _generate(x, y);
      const resultBuffer = protocolUtils.stringifyMapChunk(mapChunk, buffer, 0);

      postMessage(resultBuffer, [resultBuffer]);
      break;
    }
    default: {
      console.warn('invalid heightfield worker method:', JSON.stringify(method));
      break;
    }
  }
};

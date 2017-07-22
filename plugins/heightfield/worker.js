importScripts('/archae/assets/three.js');
const {exports: THREE} = self.module;
self.module = {};

const workerUtilser = require('./lib/utils/worker-utils');
const protocolUtils = require('./lib/utils/protocol-utils');
const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,
} = require('./lib/constants/constants');

const workerUtils = workerUtilser({THREE});

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
      const {x, y, resolution, buffer} = args;
      const mapChunk = workerUtils.generateMapChunk(x, y, resolution);
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

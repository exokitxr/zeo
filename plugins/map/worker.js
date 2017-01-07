const workerUtils = require('./lib/utils/worker-utils');
const protocolUtils = require('./lib/utils/protocol-utils');

self.onrequest = (method, args, cb) => {
  switch (method) {
    case 'generate': {
      const opts = args[0];
      const {offset, position} = opts;
      const builtMapChunk = workerUtils.buildMapChunk({
        offset,
        position,
      });
      const compiledMapChunk = workerUtils.compileMapChunk(builtMapChunk);
      const mapChunkBuffer = protocolUtils.stringifyMapChunk(compiledMapChunk);

      const value = {
        mapChunk: mapChunkBuffer,
      };
      const transfers = [
        mapChunkBuffer.buffer,
      ];
      const result = {
        value,
        transfers,
      };
      cb(null, result);

      break;
    }
    default: {
      const err = new Error('unknown method');
      cb(err.stack);

      break;
    }
  }
};

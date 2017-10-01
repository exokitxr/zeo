const path = require('path');
const fs = require('fs');

const Pullstream = require('pullstream');
const terrainTesselatorLib = require('./terrain-tesselator');
const {
  DEFAULT_SEED,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const installDirectory = process.argv[2];
const prefix = path.join(installDirectory, 'plugins');

let numMethods = 0;
const METHODS = {
  generateTerrain: numMethods++,
};

const _instantiate = (o, arg) => {
  if (typeof o === 'function') {
    if (/^(?:function|class)/.test(o.toString())) {
      return new o(arg);
    } else {
      return o(arg);
    }
  } else {
    return o;
  }
};
const _requestPlugin = p => {
  const constructor = require(`${prefix}/${p.replace(/\//g, '_')}/node_modules/${p.match(/\/([^\/]+)$/)[1]}/server.js`);
  const m = _instantiate(constructor);
  return Promise.resolve(m.mount());
};
const _requestPlugins = ps => Promise.all(ps.map(_requestPlugin));

const _init = () => _requestPlugins([
  '/core/engines/three',
  '/core/utils/js-utils',
  '/core/utils/hash-utils',
  '/core/utils/random-utils',
])
  .then(([
    three,
    jsUtils,
    hashUtils,
    randomUtils,
  ]) => {
    const {THREE} = three;
    const {mod} = jsUtils;
    const {murmur} = hashUtils;
    const {vxl} = randomUtils;

    const noiser = vxl.noiser({
      seed: murmur(DEFAULT_SEED),
    });

    const pullstream = new Pullstream();
    process.stdin.pipe(pullstream)

    const terrainTesselator = terrainTesselatorLib({
      THREE,
      mod,
      murmur,
      noiser,
    });

    const _readArgs = (constructors, cb) => {
      const result = Array(constructors.length);
      const _recurse = i => {
        if (i < constructors.length) {
          pullstream.pull(4, (err, data) => {
            if (!err) {
              const numBytes = new Uint32Array(data.buffer, data.byteOffset, 1)[0];
              pullstream.pull(numBytes, (err, data) => {
                if (!err) {
                  const constructor = constructors[i];
                  result[i] = new constructor(data.buffer, data.byteOffset, data.byteLength / constructor.BYTES_PER_ELEMENT);

                  _recurse(i + 1);
                } else {
                  cb(err);
                }
              });
            } else {
              cb(err);
            }
          });
        } else {
          cb(null, result);
        }
      };
      _recurse(0);
    };

    const methods = {
      [METHODS.generateTerrain]: cb => {
        _readArgs([
          Uint32Array, // header
          Uint8Array, // biomes
          Float32Array, // elevation
          Float32Array, // old ether
          Float32Array, // water
          Float32Array, // lava
          Float32Array, // new ether
        ], (err, [
          header,
          oldBiomes,
          oldElevations,
          oldEther,
          oldWater,
          oldLava,
          newEther,
        ]) => {
          const [ox, oz] = header;
          const opts = {
            oldBiomes,
            oldElevations,
            oldEther,
            oldWater,
            oldLava,
            newEther,
          };
          cb(null, new Uint8Array(protocolUtils.stringifyTerrainData(terrainTesselator.generate(ox, oz, opts))[0]));
        });
      },
    };

    const _recurse = () => {
      pullstream.pull(2 * 4, (err, data) => {
        if (!err) {
          const [method, id] = new Uint32Array(data.buffer, data.byteOffset, 2);

          methods[method]((err, result) => {
            if (!err) {
              const headerBuffer = Uint32Array.from([id, result.byteLength]);
              process.stdout.write(new Buffer(headerBuffer.buffer, headerBuffer.byteOffset, headerBuffer.byteLength));

              process.stdout.write(new Buffer(result.buffer, result.byteOffset, result.length * result.constructor.BYTES_PER_ELEMENT));

              _recurse();
            } else {
              console.warn(err);

              // _recurse();
            }
          });
        } else {
          console.warn(err);

          // _recurse();
        }
      });
    };
    _recurse();
  });
if (require.main === module) {
  _init();
}

module.exports = {
  METHODS,
};

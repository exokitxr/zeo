const path = require('path');
const fs = require('fs');
const {
  DEFAULT_SEED,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');
const terrainTesselatorLib = require('./terrain-tesselator');
const objectsTesselatorLib = require('./objects-tesselator');
const Pullstream = require('pullstream');

let numMethods = 0;
const METHODS = {
  generateTerrain: numMethods++,
  generateObjects: numMethods++,
  light: numMethods++,
  lightmap: numMethods++,
  blockfield: numMethods++,
};

const _alignData = (data, alignment) => {
  if ((data.byteOffset % alignment) !== 0) {
    const newData = new Buffer(new ArrayBuffer(data.length));
    data.copy(newData);
    data = newData;
  }
  return data;
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
  const installDirectory = process.argv[2];
  const prefix = path.join(installDirectory, 'plugins');
  const modulePath = path.join(prefix, p.replace(/\//g, '_'), 'node_modules', p.match(/[\/\\]([^\/\\]+)$/)[1], 'server.js');
  const constructor = require(modulePath);
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
    const terrainTesselator = terrainTesselatorLib({
      THREE,
      mod,
      murmur,
      noiser,
    });
    const objectsTesselator = objectsTesselatorLib({
      vxl,
    });

    const pullstream = new Pullstream();
    process.stdin.pipe(pullstream)

    const _readArgs = (constructors, cb) => {
      const result = Array(constructors.length);
      const _recurse = i => {
        if (i < constructors.length) {
          pullstream.pull(4, (err, data) => {
            if (!err) {
              data = _alignData(data, Uint32Array.BYTES_PER_ELEMENT);
              let numBytes = new Uint32Array(data.buffer, data.byteOffset, 1)[0];
              pullstream.pull(numBytes, (err, data) => {
                if (!err) {
                  const constructor = constructors[i];
                  data = _alignData(data, constructor.BYTES_PER_ELEMENT);
                  result[i] = new constructor(data.buffer, data.byteOffset, data.length / constructor.BYTES_PER_ELEMENT);

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
          Int32Array, // header
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
          const result = terrainTesselator.generate(ox, oz, opts);
          cb(null, new Uint8Array(protocolUtils.stringifyTerrainData(result)[0]));
        });
      },
      [METHODS.generateObjects]: cb => {
        _readArgs([
          Int32Array, // header
          Uint32Array, // objects src
          Uint32Array, // vegetations src
          Uint32Array, // blocks
          Uint8Array, // geometry buffer
          Uint32Array, // geometry types
          Uint32Array, // block types
          Uint8Array, // transparent voxels
          Uint8Array, // translucent voxels
          Float32Array, // face uvs
        ], (err, [
          header,
          objectsSrc,
          vegetationsSrc,
          blocks,
          geometriesBuffer,
          geometryTypes,
          blockTypes,
          transparentVoxels,
          translucentVoxels,
          faceUvs,
        ]) => {
          const [ox, oz] = header;
          const result = objectsTesselator.tesselate(
            ox,
            oz,
            objectsSrc,
            vegetationsSrc,
            blocks,
            geometriesBuffer,
            geometryTypes,
            blockTypes,
            transparentVoxels,
            translucentVoxels,
            faceUvs
          );
          cb(null, new Uint8Array(protocolUtils.stringifyGeometry(result)[0]));
        });
      },
    };

    const _recurse = () => {
      pullstream.pull(2 * 4, (err, data) => {
        if (!err) {
          data = _alignData(data, Uint32Array.BYTES_PER_ELEMENT);
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

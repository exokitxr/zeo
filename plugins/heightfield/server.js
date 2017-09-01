const path = require('path');
const fs = require('fs');

const touch = require('touch');
const trra = require('trra');

const {
  NUM_CELLS,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');
const lightmapUtils = require('./lib/utils/lightmap-utils');
const generatorLib = require('./generator');
const {
  DEFAULT_SEED,
} = require('./lib/constants/constants');
const DIRECTIONS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

class Heightfield {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {dirname, dataDirectory} = archae;
    const {express, app} = archae.getCore();
    const {
      three: {THREE},
      elements,
      utils: {
        hash: {murmur},
        random: {indev},
      },
    } = zeo;

    const generator = generatorLib({
      THREE,
      murmur,
      indev,
    });
    const trraDataPath = path.join(dirname, dataDirectory, 'trra.dat');

    const _getTrra = () => new Promise((accept, reject) => {
      fs.readFile(trraDataPath, (err, b) => {
        if (!err) {
          const tra = trra({
            seed: DEFAULT_SEED,
          });
          tra.load(b);
          accept(tra);
        } else if (err.code === 'ENOENT') {
          touch(trraDataPath, err => {
            if (!err) {
              accept(trra({
                seed: DEFAULT_SEED,
              }));
            } else {
              reject(err);
            }
          });
        } else {
          reject(err);
        }
      });
    });

    return _getTrra()
      .then(tra => {
        const _writeFileData = (data, byteOffset) => new Promise((accept, reject) => {
          const ws = fs.createWriteStream(trraDataPath, {
            flags: 'r+',
            start: byteOffset,
          });
          ws.end(data);
          ws.on('finish', () => {
            accept();
          });
          ws.on('error', err => {
            reject(err);
          });
        });
        const _saveChunks = _debounce(next => {
          const promises = [];
          tra.save((byteOffset, data) => {
            promises.push(_writeFileData(new Buffer(data.buffer, data.byteOffset, data.byteLength), byteOffset));
          });
          Promise.all(promises)
            .then(() => {
              next();
            })
            .catch(err => {
              console.warn(err);

              next();
            });
        });

        const heightfieldImgStatic = express.static(path.join(__dirname, 'lib', 'img'));
        function serveHeightfieldImg(req, res, next) {
          heightfieldImgStatic(req, res, next);
        }
        app.use('/archae/heightfield/img', serveHeightfieldImg);

        function serveHeightfieldChunks(req, res, next) {
          const {query: {x: xs, z: zs}} = req;
          const x = parseInt(xs, 10);
          const z = parseInt(zs, 10);

          if (!isNaN(x) && !isNaN(z)) {
            let chunk = tra.getChunk(x, z);
            if (!chunk) {
              chunk = tra.makeChunk(x, z);
              chunk.generate(generator);
              _saveChunks();
            }

            res.type('application/octet-stream');

            const uint32Buffer = chunk.getBuffer();
            res.send(new Buffer(uint32Buffer.buffer, uint32Buffer.byteOffset, uint32Buffer.byteLength));
          } else {
            res.status(400);
            res.send();
          }
        }
        app.get('/archae/heightfield/chunks', serveHeightfieldChunks);

        function serveHeightfieldVoxels(req, res, next) {
          const {query: {x: xs, y: ys, z: zs}} = req;
          const x = parseInt(xs, 10);
          const y = parseInt(ys, 10);
          const z = parseInt(zs, 10);

          if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            const v = req.method === 'POST' ? -1 : 1;

            const regenerated = [];
            for (let i = 0; i < DIRECTIONS.length; i++) {
              const [dx, dz] = DIRECTIONS[i];
              const ax = x + dx * 2;
              const az = z + dz * 2;
              const ox = Math.floor(ax / NUM_CELLS);
              const oz = Math.floor(az / NUM_CELLS);
              const lx = x - (ox * NUM_CELLS);
              const lz = z - (oz * NUM_CELLS);
              const newEther = Float32Array.from([lx, y, lz, v]);

              if (!regenerated.some(chunk => chunk.x === ox && chunk.z === oz)) {
                let chunk = tra.getChunk(ox, oz);
                if (!chunk) {
                  chunk = tra.makeChunk(ox, oz);
                  chunk.generate(generator, {
                    newEther,
                  });
                } else {
                  const uint32Buffer = chunk.getBuffer();
                  const chunkData = protocolUtils.parseDataChunk(uint32Buffer.buffer, uint32Buffer.byteOffset);
                  const oldElevations = chunkData.elevations.slice();
                  const oldEther = chunkData.ether.slice();
                  const oldLiquid = chunkData.liquid.slice();
                  chunk.generate(generator, {
                    oldElevations,
                    oldEther,
                    oldLiquid,
                    newEther,
                  });
                }
                regenerated.push(chunk);
              }
            }
            _saveChunks();

            res.type('application/octet-stream');

            const chunksHeader = Uint32Array.from([regenerated.length]);
            res.write(new Buffer(chunksHeader.buffer, chunksHeader.byteOffset, chunksHeader.byteLength));
            for (let i = 0; i < regenerated.length; i++) {
              const chunk = regenerated[i];

              const chunkHeader1 = Int32Array.from([chunk.x, chunk.z]);
              res.write(new Buffer(chunkHeader1.buffer, chunkHeader1.byteOffset, chunkHeader1.byteLength));

              const uint32Buffer = chunk.getBuffer();
              const chunkHeader2 = Uint32Array.from([uint32Buffer.byteLength]);
              res.write(new Buffer(chunkHeader2.buffer, chunkHeader2.byteOffset, chunkHeader2.byteLength));

              res.write(new Buffer(uint32Buffer.buffer, uint32Buffer.byteOffset, uint32Buffer.byteLength));
            }
            res.end();
          } else {
            res.status(400);
            res.send();
          }
        }
        app.post('/archae/heightfield/voxels', serveHeightfieldVoxels);
        app.delete('/archae/heightfield/voxels', serveHeightfieldVoxels);

        const heightfieldElement = {
          requestHeightfield(x, z) {
            let chunk = tra.getChunk(x, z);
            if (!chunk) {
              chunk = tra.makeChunk(x, z);
              chunk.generate(generator);
              _saveChunks();
            }
            const uint32Buffer = chunk.getBuffer();
            const {heightfield} = protocolUtils.parseDataChunk(uint32Buffer.buffer, uint32Buffer.byteOffset);
            return Promise.resolve(heightfield);
          },
          requestStaticHeightfield(x, z) {
            let chunk = tra.getChunk(x, z);
            if (!chunk) {
              chunk = tra.makeChunk(x, z);
              chunk.generate(generator);
              _saveChunks();
            }
            const uint32Buffer = chunk.getBuffer();
            const {staticHeightfield} = protocolUtils.parseDataChunk(uint32Buffer.buffer, uint32Buffer.byteOffset);
            return Promise.resolve(staticHeightfield);
          },
          requestLightmaps(x, z, positions) {
            return this.requestStaticHeightfield(x, z)
              .then(staticHeightfield => {
                const numPositions = positions.length / 3;
                const skyLightmaps = new Uint8Array(numPositions);
                const torchLightmaps = new Uint8Array(numPositions);

                const ox = x * NUM_CELLS;
                const oz = z * NUM_CELLS;

                for (let i = 0; i < numPositions; i++) {
                  const baseIndex = i * 3;
                  skyLightmaps[i] = lightmapUtils.render(
                    positions[baseIndex + 0] - ox,
                    positions[baseIndex + 1],
                    positions[baseIndex + 2] - oz,
                    staticHeightfield
                  );
                }

                return {
                  skyLightmaps,
                  torchLightmaps,
                };
              });
          },
        };
        elements.registerEntity(this, heightfieldElement);

        this._cleanup = () => {
          function removeMiddlewares(route, i, routes) {
            if (
              route.handle.name === 'serveHeightfieldImg' ||
              route.handle.name === 'serveHeightfieldChunks' ||
              route.handle.name === 'serveHeightfieldVoxels'
            ) {
              routes.splice(i, 1);
            }
            if (route.route) {
              route.route.stack.forEach(removeMiddlewares);
            }
          }
          app._router.stack.forEach(removeMiddlewares);

          elements.unregisterEntity(this, heightfieldElement);
        };
      });
  }

  unmount() {
    this._cleanup();
  }
}
const _debounce = fn => {
  let running = false;
  let queued = false;

  const _go = () => {
    if (!running) {
      running = true;

      fn(() => {
        running = false;

        if (queued) {
          queued = false;

          _go();
        }
      });
    } else {
      queued = true;
    }
  };
  return _go;
};

module.exports = Heightfield;

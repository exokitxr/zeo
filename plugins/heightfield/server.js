const path = require('path');
const fs = require('fs');

const touch = require('touch');
const trra = require('trra');

const {
  NUM_CELLS,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');
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
            const uint32Buffer = chunk.getBuffer();
            const buffer = new Buffer(uint32Buffer.buffer, uint32Buffer.byteOffset, uint32Buffer.byteLength);
            res.type('application/octet-stream');
            res.send(buffer);
          } else {
            res.status(400);
            res.send();
          }
        }
        app.get('/archae/heightfield/chunks', serveHeightfieldChunks);

        function serveHeightfieldHeightfield(req, res, next) {
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
            const uint32Buffer = chunk.getBuffer();
            const arrayBuffer = protocolUtils.sliceDataHeightfield(uint32Buffer.buffer, uint32Buffer.byteOffset);
            const buffer = new Buffer(arrayBuffer);
            res.type('application/octet-stream');
            res.send(buffer);
          } else {
            res.status(400);
            res.send();
          }
        }
        app.get('/archae/heightfield/heightfield', serveHeightfieldHeightfield);

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

              if (!regenerated.some(entry => entry[0] === ox && entry[1] === oz)) {
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
                  chunk.generate(generator, {
                    oldElevations,
                    oldEther,
                    newEther,
                  });
                }
                regenerated.push([ox, oz]);
              }
            }
            _saveChunks();
            res.send();
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
        };
        elements.registerEntity(this, heightfieldElement);

        this._cleanup = () => {
          function removeMiddlewares(route, i, routes) {
            if (
              route.handle.name === 'serveHeightfieldImg' ||
              route.handle.name === 'serveHeightfieldChunks' ||
              route.handle.name === 'serveHeightfieldHeightfield' ||
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

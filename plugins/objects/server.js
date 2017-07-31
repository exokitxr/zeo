const path = require('path');
const fs = require('fs');

const zeode = require('zeode');
const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,

  DEFAULT_SEED,
} = require('./lib/constants/constants');
const objectsLib = require('./lib/objects/server/index');

class Objects {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {dirname, dataDirectory} = archae;
    const {express, ws, app, wss} = archae.getCore();
    const {three, utils: {hash: hashUtils, random: randomUtils}} = zeo;
    const {THREE} = three;
    const {murmur} = hashUtils;
    const {alea, indev} = randomUtils;

    const zeodeDataPath = path.join(dirname, dataDirectory, 'zeode.dat');
    const zeroBuffer = new Uint32Array(0);

    const rng = new alea(DEFAULT_SEED);
    const generator = indev({
      seed: DEFAULT_SEED,
    });
    const elevationNoise = generator.uniform({
      frequency: 0.002,
      octaves: 8,
    });
    const grassNoise = generator.uniform({
      frequency: 0.1,
      octaves: 4,
    });
    const treeNoise = generator.uniform({
      frequency: 0.1,
      octaves: 4,
    });
    const generator2 = indev({
      seed: DEFAULT_SEED + '2',
    });
    const itemsNoise = generator2.uniform({
      frequency: 0.1,
      octaves: 4,
    });

    const generators = [];
    const generateApi = {
      THREE,
      NUM_CELLS,
      NUM_CELLS_OVERSCAN,
      getElevation(ox, oz, x, z) {
        const ax = (ox * NUM_CELLS) + x;
        const az = (oz * NUM_CELLS) + z;
        return (-0.3 + Math.pow(elevationNoise.in2D(ax + 1000, az + 1000), 0.5)) * 64;
      },
      getItemsNoise(ox, oz, x, z) {
        const ax = (ox * NUM_CELLS) + x;
        const az = (oz * NUM_CELLS) + z;
        return itemsNoise.in2D(ax + 1000, az + 1000);
      },
      getGrassNoise(ox, oz, x, z) {
        const ax = (ox * NUM_CELLS) + x;
        const az = (oz * NUM_CELLS) + z;
        return grassNoise.in2D(ax + 1000, az + 1000);
      },
      getTreeNoise(ox, oz, x, z) {
        const ax = (ox * NUM_CELLS) + x;
        const az = (oz * NUM_CELLS) + z;
        return treeNoise.in2D(ax + 1000, az + 1000);
      },
      getHash(s) {
        return murmur(s);
      },
      addObject(chunk, name, position, rotation, scale) {
        const n = murmur(name);
        const matrix = position.toArray().concat(rotation.toArray()).concat(scale.toArray());
        chunk.addObject(n, matrix);
      },
    };
    const _generateChunk = chunk => {
      for (let i = 0; i < generators.length; i++) {
        _generateChunkWithGenerator(chunk, generators[i]);
      }
    };
    const _generateChunkWithGenerator = (chunk, generator) => {
      const n = generator[0];
      if (!chunk.hasTrailer(n)) {
        generator[1](chunk, generateApi);
        chunk.addTrailer(n);
      }
    };

    const _getZeode = () => new Promise((accept, reject) => {
      fs.readFile(zeodeDataPath, (err, b) => {
        if (!err || err.code === 'ENOENT') {
          const zde = zeode();
          if (b) {
            zde.load(b);
          }
          accept(zde);
        } else {
          reject(err);
        }
      });
    });
    const _getObjects = zde => {
      const objectApi = {
        THREE,
        registerGenerator(name, fn) {
          const n = murmur(name);
          const generator = [n, fn];
          generators.push(generator);

          for (let i = 0; i < zde.chunks.length; i++) {
            _generateChunkWithGenerator(zde.chunks[i], generator);
          }
        },
      };

      return Promise.all(
        objectsLib(objectApi)
          .map(makeObject => makeObject())
      );
    };

    return _getZeode()
    .then(zde => {
      return Promise.all([
        Promise.resolve(zde),
        _getObjects(zde),
      ]);
    })
      .then(([
        zde,
        objectCleanups,
      ])=> {
        const _writeFileData = (data, byteOffset) => new Promise((accept, reject) => {
          const ws = fs.createWriteStream(zeodeDataPath, {
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
          zde.save((byteOffset, data) => {
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

        const objectsImgStatic = express.static(path.join(__dirname, 'lib', 'img'));
        function serveObjectsImg(req, res, next) {
          objectsImgStatic(req, res, next);
        }
        app.use('/archae/objects/img', serveObjectsImg);

        const connections = [];
        const _connection = c => {
          const {url} = c.upgradeReq;

          if (url === '/archae/objectsWs') {
            const _broadcast = m => {
              for (let i = 0; i < connections.length; i++) {
                const connection = connections[i];
                if (connection.readyState === ws.OPEN && connection !== c) {
                  connection.send(m);
                }
              }
            };

            c.on('message', msg => {
              const m = JSON.parse(msg);
              const {method} = m;

              if (method === 'getChunk') {
                const {args: {x, z}} = m;

                let chunk = zde.getChunk(x, z);
                if (!chunk) {
                  chunk = zde.makeChunk(x, z);
                  _generateChunk(chunk);
                }
                c.send(JSON.stringify({
                  type: 'response',
                }));
                c.send(chunk.getBuffer());
              } else if (method === 'addObject') {
                const {args: {x, z, n, matrix}} = m;

                let chunk = zde.getChunk(x, z);
                if (!chunk) {
                  chunk = zde.makeChunk(x, z);
                  _generateChunk(chunk);
                }
                chunk.addObject(n, matrix);

                _saveChunks();

                _broadcast({
                  type: 'addObject',
                  x,
                  z,
                  n,
                  matrix,
                });
              } else if (method === 'removeObject') {
                const {args: {x, z, index}} = m;

                const chunk = zde.getChunk(x, z);
                if (chunk) {
                  chunk.removeObject(index);

                  _saveChunks();

                  _broadcast({
                    type: 'removeObject',
                    index,
                  });
                }
              } else {
                console.warn('objects server got unknown method:', JSON.stringify(method));
              }
            });
            c.on('close', () => {
              connections.splice(connections.indexOf(c), 1);
            });

            connections.push(c);
          }
        };
        wss.on('connection', _connection);

        this._cleanup = () => {
          for (let i = 0; i < objectCleanups.length; i++) {
            const objectCleanup = objectCleanups[i];
            objectCleanup();
          }

          function removeMiddlewares(route, i, routes) {
            if (route.handle.name === 'serveObjectsImg') {
              routes.splice(i, 1);
            }
            if (route.route) {
              route.route.stack.forEach(removeMiddlewares);
            }
          }
          app._router.stack.forEach(removeMiddlewares);

          for (let i = 0; i < connections.length; i++) {
            const c = connections[i];
            c.close();
          }
          wss.removeListener('connection', _connection);
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

module.exports = Objects;

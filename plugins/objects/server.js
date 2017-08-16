const path = require('path');
const fs = require('fs');

const touch = require('touch');
const zeode = require('zeode');
const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,

  DEFAULT_SEED,
} = require('./lib/constants/constants');
const objectsLib = require('./lib/objects/server/index');
const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';

class Objects {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {dirname, dataDirectory} = archae;
    const {express, ws, app, wss} = archae.getCore();
    const {three, elements, utils: {hash: hashUtils, random: randomUtils}} = zeo;
    const {THREE} = three;
    const {murmur} = hashUtils;
    const {alea, indev} = randomUtils;

    const zeodeDataPath = path.join(dirname, dataDirectory, 'zeode.dat');

    const rng = new alea(DEFAULT_SEED);
    const noises = {};

    const generators = [];
    const generateApi = {
      THREE,
      NUM_CELLS,
      NUM_CELLS_OVERSCAN,
      getHash(s) {
        return murmur(s);
      },
      registerNoise(name, spec) {
        noises[name] = indev({
          seed: spec.seed,
        }).uniform({
          frequency: spec.frequency,
          octaves: spec.octaves,
        });
      },
      getNoise(name, ox, oz, x, z) {
        const ax = (ox * NUM_CELLS) + x;
        const az = (oz * NUM_CELLS) + z;
        return noises[name].in2D(ax + 1000, az + 1000);
      },
      addObject(chunk, name, position, rotation, value) {
        const n = murmur(name);
        const matrix = position.toArray().concat(rotation.toArray());
        chunk.addObject(n, matrix, value);
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
        if (!err) {
          const zde = zeode();
          zde.load(b);
          accept(zde);
        } else if (err.code === 'ENOENT') {
          touch(zeodeDataPath, err => {
            if (!err) {
              accept(zeode());
            } else {
              reject(err);
            }
          });
        } else {
          reject(err);
        }
      });
    });

    return _getZeode()
      .then(zde => {
        const _decorateChunkHeightfield = chunk => elements.requestElement(HEIGHTFIELD_PLUGIN)
          .then(heightfieldElement => heightfieldElement.requestHeightfield(chunk.x, chunk.z))
          .then(heightfield => {
            chunk.heightfield = heightfield;
            return chunk;
          });
        const _requestChunk = (x, z) => {
          const chunk = zde.getChunk(x, z);
          if (chunk) {
            return Promise.resolve(chunk);
          } else {
            const chunk = zde.makeChunk(x, z);
            return _decorateChunkHeightfield(chunk)
              .then(chunk => {
                _generateChunk(chunk);
                _saveChunks();

                return chunk;
              });
          }
        };

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

        const _getObjects = () => {
          generateApi.registerNoise('elevation', { // XXX move these into the objects lib
            seed: DEFAULT_SEED,
            frequency: 0.002,
            octaves: 8,
          });
          generateApi.registerNoise('grass', {
            seed: DEFAULT_SEED,
            frequency: 0.1,
            octaves: 4,
          });
          generateApi.registerNoise('tree', {
            seed: DEFAULT_SEED,
            frequency: 0.1,
            octaves: 4,
          });
          generateApi.registerNoise('items', {
            seed: DEFAULT_SEED + '2',
            frequency: 0.1,
            octaves: 4,
          });

          const objectApi = {
            THREE,
            registerGenerator(name, fn) {
              const n = murmur(name);
              const generator = [n, fn];
              generators.push(generator);

              if (zde.chunks.length > 0) {
                for (let i = 0; i < zde.chunks.length; i++) {
                  _generateChunkWithGenerator(zde.chunks[i], generator);
                }
                _saveChunks();
              }
            },
          };

          return Promise.all(
            objectsLib(objectApi)
              .map(makeObject => makeObject())
          );
        };

        return _getObjects()
          .then(objectCleanups => {
            const objectsImgStatic = express.static(path.join(__dirname, 'lib', 'img'));
            function serveObjectsImg(req, res, next) {
              objectsImgStatic(req, res, next);
            }
            app.use('/archae/objects/img', serveObjectsImg);

            const objectsSfxStatic = express.static(path.join(__dirname, 'lib', 'sfx'));
            function serveObjectsSfx(req, res, next) {
              objectsSfxStatic(req, res, next);
            }
            app.use('/archae/objects/sfx', serveObjectsSfx);

            function serveObjectsChunks(req, res, next) {
              const {query: {x: xs, z: zs}} = req;
              const x = parseInt(xs, 10);
              const z = parseInt(zs, 10);

              if (!isNaN(x) && !isNaN(z)) {
                _requestChunk(x, z)
                  .then(chunk => {
                    const uint32Buffer = chunk.getBuffer();
                    const buffer = new Buffer(uint32Buffer.buffer, uint32Buffer.byteOffset, uint32Buffer.byteLength);
                    res.type('application/octet-stream');
                    res.send(buffer);
                  })
                  .catch(err => {
                    res.status(500);
                    res.json({
                      error: err.stack,
                    });
                  });
              } else {
                res.status(400);
                res.send();
              }
            }
            app.get('/archae/objects/chunks', serveObjectsChunks);

            const connections = [];
            const _connection = c => {
              const {url} = c.upgradeReq;

              if (url === '/archae/objectsWs') {
                const _broadcast = e => {
                  const es = JSON.stringify(e);

                  for (let i = 0; i < connections.length; i++) {
                    const connection = connections[i];
                    if (connection.readyState === ws.OPEN && connection !== c) {
                      connection.send(es);
                    }
                  }
                };

                c.on('message', msg => {
                  const m = JSON.parse(msg);
                  const {method} = m;

                  if (method === 'addObject') {
                    const {args} = m;
                    const {x, z, n, matrix, value} = args;

                    _requestChunk(x, z)
                      .then(chunk => {
                        chunk.addObject(n, matrix, value);

                        _saveChunks();

                        _broadcast({
                          type: 'addObject',
                          args,
                        });
                      })
                      .catch(err => {
                        res.status(500);
                        res.json({
                          error: err.stack,
                        });
                      });
                  } else if (method === 'removeObject') {
                    const {args} = m;
                    const {x, z, index} = args;

                    const chunk = zde.getChunk(x, z);
                    if (chunk) {
                      chunk.removeObject(index);

                      _saveChunks();

                      _broadcast({
                        type: 'removeObject',
                        args,
                      });
                    }
                  } else if (method === 'setObjectData') {
                    const {args} = m;
                    const {x, z, index, value} = args;

                    const chunk = zde.getChunk(x, z);
                    if (chunk) {
                      chunk.setObjectData(index, value);

                      _saveChunks();

                      _broadcast({
                        type: 'setObjectData',
                        args,
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
                if (route.handle.name === 'serveObjectsImg' || route.handle.name === 'serveObjectsSfx' || route.handle.name === 'serveObjectsChunks') {
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

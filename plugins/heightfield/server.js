const path = require('path');
const fs = require('fs');

const touch = require('touch');
const trra = require('trra');

const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,
  NUM_CELLS_HEIGHT,

  NUM_POSITIONS_CHUNK,
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

const decorationsSymbol = Symbol();

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
        js: {mod},
        hash: {murmur},
        random: {indev},
      },
    } = zeo;

    const generator = generatorLib({
      THREE,
      mod,
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

        const _decorateFakeLights = (chunk, geometry) => { // XXX
          geometry.lights = new Uint8Array(NUM_CELLS * NUM_CELLS_HEIGHT * NUM_CELLS);

          if (chunk.x === 0 && chunk.z === -1) {
            const {lights, elevations} = geometry;
            const _getCoordOverscanIndex = (x, z) => x + (z * NUM_CELLS_OVERSCAN);
            const _fillLight = (x, y, z, v) => {
              const queue = [];
              const _tryQueue = (x, y, z, v) => {
                if (x >= 0 && x < NUM_CELLS && y >= 0 & y < NUM_CELLS_HEIGHT && z >= 0 && z < NUM_CELLS && v > 0) {
                  const index = _getLightIndex(x, y, z);

                  if (lights[index] < v) {
                    lights[index] = v;

                    queue.push({x, y, z, v});
                  }
                }
              };

              _tryQueue(x, y, z, v);

              while (queue.length > 0) {
                const {x, y, z, v} = queue.shift();

                for (let dz = -1; dz <= 1; dz++) {
                  for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                      _tryQueue(x + dx, y + dy, z + dz, v - (Math.abs(dx) + Math.abs(dy) + Math.abs(dz)));
                    }
                  }
                }
              }
            };

            _fillLight(4, Math.floor(elevations[_getCoordOverscanIndex(4, 4)]), 4, 16);
          }
        };
        const _decorateChunkLightmaps = chunk => {
          const uint32Buffer = chunk.getBuffer();
          const geometry = protocolUtils.parseData(uint32Buffer.buffer, uint32Buffer.byteOffset);
          _decorateFakeLights(chunk, geometry);
          const {positions, staticHeightfield, lights} = geometry;

          const numPositions = positions.length / 3;
          const skyLightmaps = new Uint8Array(numPositions);
          const torchLightmaps = new Uint8Array(numPositions);

          const ox = chunk.x * NUM_CELLS;
          const oz = chunk.z * NUM_CELLS;

          for (let i = 0; i < numPositions; i++) {
            const baseIndex = i * 3;
            skyLightmaps[i] = lightmapUtils.renderSkyVoxel(
              positions[baseIndex + 0] - ox,
              positions[baseIndex + 1],
              positions[baseIndex + 2] - oz,
              staticHeightfield
            );
            torchLightmaps[i] = lightmapUtils.renderTorchVoxel(
              positions[baseIndex + 0] - ox,
              positions[baseIndex + 1],
              positions[baseIndex + 2] - oz,
              lights
            );
          }

          chunk[decorationsSymbol] = {
            skyLightmaps,
            torchLightmaps,
          };
        };

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
              chunk.generate(generator.generate);
              _saveChunks();
            }
            if (!chunk[decorationsSymbol]) {
              _decorateChunkLightmaps(chunk);
            }

            res.type('application/octet-stream');

            const uint32Buffer = chunk.getBuffer();
            res.write(new Buffer(uint32Buffer.buffer, uint32Buffer.byteOffset, uint32Buffer.byteLength));

            const {[decorationsSymbol]: decorationsObject} = chunk;
            const [arrayBuffer, byteOffset] = protocolUtils.stringifyDecorations(decorationsObject);
            res.end(new Buffer(arrayBuffer, 0, byteOffset));
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
                  chunk.generate(generator.generate, {
                    newEther,
                  });
                } else {
                  const uint32Buffer = chunk.getBuffer();
                  const chunkData = protocolUtils.parseData(uint32Buffer.buffer, uint32Buffer.byteOffset);
                  const oldBiomes = chunkData.biomes.slice();
                  const oldElevations = chunkData.elevations.slice();
                  const oldEther = chunkData.ether.slice();
                  const oldLiquid = chunkData.liquid.slice();
                  const oldLiquidTypes = chunkData.liquidTypes.slice();
                  chunk.generate(generator.generate, {
                    oldBiomes,
                    oldElevations,
                    oldEther,
                    oldLiquid,
                    oldLiquidTypes,
                    newEther,
                  });
                }
                _decorateChunkLightmaps(chunk);

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

              const {[decorationsSymbol]: decorationsObject} = chunk;
              const [arrayBuffer, byteOffset] = protocolUtils.stringifyDecorations(decorationsObject);
              const chunkHeader3 = Uint32Array.from([byteOffset]);
              res.write(new Buffer(chunkHeader3.buffer, chunkHeader3.byteOffset, chunkHeader3.byteLength));
              res.write(new Buffer(arrayBuffer, 0, byteOffset));
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
              chunk.generate(generator.generate);
              _saveChunks();
            }
            const uint32Buffer = chunk.getBuffer();
            return Promise.resolve(protocolUtils.parseData(uint32Buffer.buffer, uint32Buffer.byteOffset).heightfield);
          },
          requestStaticHeightfield(x, z) {
            let chunk = tra.getChunk(x, z);
            if (!chunk) {
              chunk = tra.makeChunk(x, z);
              chunk.generate(generator.generate);
              _saveChunks();
            }
            const uint32Buffer = chunk.getBuffer();
            return Promise.resolve(protocolUtils.parseData(uint32Buffer.buffer, uint32Buffer.byteOffset).staticHeightfield);
          },
          requestBiomes(x, z) {
            let chunk = tra.getChunk(x, z);
            if (!chunk) {
              chunk = tra.makeChunk(x, z);
              chunk.generate(generator.generate);
              _saveChunks();
            }
            const uint32Buffer = chunk.getBuffer();
            return Promise.resolve(protocolUtils.parseData(uint32Buffer.buffer, uint32Buffer.byteOffset).biomes);
          },
          requestLights(x, z) {
            let chunk = tra.getChunk(x, z);
            if (!chunk) {
              chunk = tra.makeChunk(x, z);
              chunk.generate(generator.generate);
              _saveChunks();
            }
            const uint32Buffer = chunk.getBuffer();
            const geometry = protocolUtils.parseData(uint32Buffer.buffer, uint32Buffer.byteOffset);
            _decorateFakeLights(chunk, geometry);
            return Promise.resolve(geometry.lights);
          },
          requestLightmaps(x, z, positions) {
            return Promise.all([
              this.requestStaticHeightfield(x, z),
              this.requestLights(x, z)
            ])
              .then(([
                staticHeightfield,
                lights,
              ]) => {
                const numPositions = positions.length / 3;
                const skyLightmaps = new Uint8Array(numPositions);
                const torchLightmaps = new Uint8Array(numPositions);

                const ox = x * NUM_CELLS;
                const oz = z * NUM_CELLS;

                for (let i = 0; i < numPositions; i++) {
                  const baseIndex = i * 3;
                  skyLightmaps[i] = lightmapUtils.renderSkyVoxel(
                    positions[baseIndex + 0] - ox,
                    positions[baseIndex + 1],
                    positions[baseIndex + 2] - oz,
                    staticHeightfield
                  );
                  torchLightmaps[i] = lightmapUtils.renderTorchVoxel(
                    positions[baseIndex + 0] - ox,
                    positions[baseIndex + 1],
                    positions[baseIndex + 2] - oz,
                    lights
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
const _getLightIndex = (x, y, z) => x + y * NUM_CELLS + z * NUM_CELLS * NUM_CELLS_HEIGHT;

module.exports = Heightfield;

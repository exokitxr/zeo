const events = require('events');
const {EventEmitter} = events;
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
const OBJECTS_PLUGIN = 'plugins-objects';

const etherSymbol = Symbol();
const lightsSymbol = Symbol();
const decorationsSymbol = Symbol();
const _getLightsIndex = (x, y, z) => x + y * NUM_CELLS_OVERSCAN + z * NUM_CELLS_OVERSCAN * (NUM_CELLS_HEIGHT + 1);
const _getLightsArrayIndex = (x, z) => x + z * 3;

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
        random: {alea, vxl},
      },
    } = zeo;

    const generator = generatorLib({
      THREE,
      mod,
      murmur,
      alea,
      vxl,
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
        const _getChunkIndex = (x, z) => (mod(x, 0xFFFF) << 16) | mod(z, 0xFFFF);
        const _getEtherIndex = (x, y, z) => x + (z * NUM_CELLS_OVERSCAN) + (y * NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN);
        const _generateChunk = (chunk, opts) => {
          const chunkData = generator.generate(chunk.x, chunk.z, opts);

          const uint32Buffer = chunk.getBuffer();
          protocolUtils.stringifyData(chunkData, uint32Buffer.buffer, uint32Buffer.byteOffset);
          chunk.dirty = true;

          chunk[etherSymbol] = chunkData.ether;

          return chunk;
        };
        const _ensureNeighboringChunks = (x, z) => {
          const promises = [];
          for (let dz = -1; dz <= 1; dz++) {
            const az = z + dz;

            for (let dx = -1; dx <= 1; dx++) {
              const ax = x + dx;

              let chunk = tra.getChunk(ax, az);
              if (!chunk) {
                chunk = _generateChunk(tra.makeChunk(ax, az));
              }

              promises.push(Promise.resolve(chunk));
            }
          }
          return Promise.all(promises)
            .then(result => {
              if (result.length > 0) {
                _saveChunks();
              }
            });
        };
        const _decorateChunkLights = chunk => _decorateChunkLightsRange(
          chunk,
          null,
          (chunk.x - 1) * NUM_CELLS,
          (chunk.x + 2) * NUM_CELLS,
          0,
          NUM_CELLS_HEIGHT + 1,
          (chunk.z - 1) * NUM_CELLS,
          (chunk.z + 2) * NUM_CELLS,
          null
        );
        const _decorateChunkLightsSub = (chunk, x, y, z) => {
          const minX = Math.max(x - 15, (chunk.x - 1) * NUM_CELLS);
          const maxX = Math.min(x + 15, (chunk.x + 2) * NUM_CELLS);
          const minY = Math.max(y - 15, 0);
          const maxY = Math.min(y + 15, NUM_CELLS_HEIGHT);
          const minZ = Math.max(z - 15, (chunk.z - 1) * NUM_CELLS);
          const maxZ = Math.min(z + 15, (chunk.z + 2) * NUM_CELLS);

          const oldLightsArray = Array(9);
          let hadAllOldLights = true;
          for (let dz = -1; dz <= 1 && hadAllOldLights; dz++) {
            for (let dx = -1; dx <= 1 && hadAllOldLights; dx++) {
              const oldChunk = tra.getChunk(chunk.x + dx, chunk.z + dz);
              if (oldChunk) {
                const {[lightsSymbol]: oldLights} = oldChunk;
                if (oldLights) {
                  oldLightsArray[_getLightsArrayIndex(dx + 1, dz + 1)] = oldLights;
                } else {
                  hadAllOldLights = false;
                }
              } else {
                hadAllOldLights = false;
              }
            }
          }

          if (hadAllOldLights) {
            const _getOldLights = (x, y, z) => {
              const lax = Math.floor((x - (chunk.x - 1) * NUM_CELLS) / NUM_CELLS);
              const laz = Math.floor((z - (chunk.z - 1) * NUM_CELLS) / NUM_CELLS);
              const lightsArrayIndex = _getLightsArrayIndex(lax, laz);
              const oldLights = oldLightsArray[lightsArrayIndex];

              const ax = x - Math.floor(x / NUM_CELLS) * NUM_CELLS;
              const ay = y;
              const az = z - Math.floor(z / NUM_CELLS) * NUM_CELLS;
              const lightsIndex = _getLightsIndex(ax, ay, az);
              return oldLights[lightsIndex];
            };

            const extraLightSources = [];
            let x, y, z;
            // top
            y = maxY + 1;
            if (y <= NUM_CELLS_HEIGHT) {
              for (let z = minZ; z < maxZ; z++) {
                for (let x = minX; x < maxX; x++) {
                  extraLightSources.push([x, y, z, _getOldLights(x, y, z)]);
                }
              }
            }
            // bottom
            y = minY - 1;
            if (y >= 0) {
              for (let z = minZ; z < maxZ; z++) {
                for (let x = minX; x < maxX; x++) {
                  extraLightSources.push([x, y, z, _getOldLights(x, y, z)]);
                }
              }
            }
            // left
            x = minX - 1;
            if (x >= (chunk.x - 1) * NUM_CELLS) {
              for (let z = minZ; z < maxZ; z++) {
                for (let y = minY; y <= maxY; y++) {
                  extraLightSources.push([x, y, z, _getOldLights(x, y, z)]);
                }
              }
            }
            // right
            x = maxX;
            if (x < (chunk.x + 2) * NUM_CELLS) {
              for (let z = minZ; z < maxZ; z++) {
                for (let y = minY; y <= maxY; y++) {
                  extraLightSources.push([x, y, z, _getOldLights(x, y, z)]);
                }
              }
            }
            // back
            z = minZ - 1;
            if (z >= (chunk.z - 1) * NUM_CELLS) {
              for (let x = minX; x < maxX; x++) {
                for (let y = minY; y <= maxY; y++) {
                  extraLightSources.push([x, y, z, _getOldLights(x, y, z)]);
                }
              }
            }
            // front
            z = maxZ;
            if (z < (chunk.z + 2) * NUM_CELLS) {
              for (let x = minX; x < maxX; x++) {
                for (let y = minY; y <= maxY; y++) {
                  extraLightSources.push([x, y, z, _getOldLights(x, y, z)]);
                }
              }
            }

            return _decorateChunkLightsRange(
              chunk,
              oldLightsArray,
              minX,
              maxX,
              minY,
              maxY,
              minZ,
              maxZ,
              extraLightSources
            );
          } else {
            return _decorateChunkLights(chunk);
          }
        };
        const _decorateChunkLightsRange = (chunk, oldLightsArray, minX, maxX, minY, maxY, minZ, maxZ, extraLightSources) => {
          const objectsEntity = elements.getWorldElement().querySelector(OBJECTS_PLUGIN);

          return Promise.all([
            _ensureNeighboringChunks(chunk.x, chunk.z),
            objectsEntity.ensureNeighboringChunks(chunk.x, chunk.z),
          ])
            .then(() => {
              const hadOldLights = Boolean(chunk[lightsSymbol]);

              chunk[lightsSymbol] = generator.light(chunk.x, chunk.z, oldLightsArray, minX, maxX, minY, maxY, minZ, maxZ, {
                getLightSources: (ox, oz) => {
                  const _getHeightfieldLightSources = () => {
                    const chunk = tra.getChunk(ox, oz);
                    const uint32Buffer = chunk.getBuffer();
                    const {lava} = protocolUtils.parseData(uint32Buffer.buffer, uint32Buffer.byteOffset);

                    const result = [];
                    for (let z = 0; z < NUM_CELLS; z++) { // XXX this can be optimized to scan only the passed-in ranges
                      for (let y = 0; y < NUM_CELLS_HEIGHT; y++) {
                        for (let x = 0; x < NUM_CELLS; x++) {
                          if (lava[_getEtherIndex(x, y, z)] < 0) {
                            result.push([x + ox * NUM_CELLS, y, z + oz * NUM_CELLS, 15]);
                          }
                        }
                      }
                    }
                    return result;
                  };
                  const _getObjectsLightSources = () => objectsEntity.getLightSources(chunk.x, chunk.z);
                  const _getExtraLightSources = () => extraLightSources || [];

                  return _getHeightfieldLightSources()
                    .concat(_getObjectsLightSources()) // XXX this can be optimized to scan only the passed-in ranges
                    .concat(_getExtraLightSources());
                },
                isOccluded: (x, y, z) => {
                  const _isOccludedHeightfield = () => {
                    const ox = Math.floor(x / NUM_CELLS);
                    const oz = Math.floor(z / NUM_CELLS);
                    return tra.getChunk(ox, oz)[etherSymbol][_getEtherIndex(x - ox * NUM_CELLS, y, z - oz * NUM_CELLS)] <= -1;
                  };
                  const _isOccludedObjects = () => objectsEntity.isOccluded(x, y, z);

                  return _isOccludedHeightfield() || _isOccludedObjects();
                },
              });
              chunk[decorationsSymbol] = null;

              if (hadOldLights) {
                heightfieldElement.emit('lights', chunk);
              }

              return Promise.resolve(chunk);
            });
        };
        const _decorateChunkLightmaps = chunk => {
          const uint32Buffer = chunk.getBuffer();
          const geometry = protocolUtils.parseData(uint32Buffer.buffer, uint32Buffer.byteOffset);
          const {positions, staticHeightfield} = geometry;
          const {[lightsSymbol]: lights} = chunk;

          const numPositions = positions.length / 3;
          const lightmapsBuffer = new ArrayBuffer(numPositions * 2);
          const skyLightmaps = new Uint8Array(lightmapsBuffer, 0, numPositions);
          const torchLightmaps = new Uint8Array(lightmapsBuffer, numPositions, numPositions);

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

          return chunk;
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
            new Promise((accept, reject) => {
              let chunk = tra.getChunk(x, z);
              if (!chunk) {
                chunk = _generateChunk(tra.makeChunk(x, z));
                _saveChunks();
              }
              accept(chunk);
            })
              .then(chunk => !chunk[lightsSymbol] ? _decorateChunkLights(chunk) : Promise.resolve(chunk))
              .then(chunk => !chunk[decorationsSymbol] ? _decorateChunkLightmaps(chunk) : Promise.resolve(chunk))
              .then(chunk => {
                res.type('application/octet-stream');

                const uint32Buffer = chunk.getBuffer();
                res.write(new Buffer(uint32Buffer.buffer, uint32Buffer.byteOffset, uint32Buffer.byteLength));

                const {[decorationsSymbol]: decorationsObject} = chunk;
                const [arrayBuffer, byteOffset] = protocolUtils.stringifyDecorations(decorationsObject);
                res.end(new Buffer(arrayBuffer, 0, byteOffset));
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
        app.get('/archae/heightfield/chunks', serveHeightfieldChunks);

        function serveHeightfieldVoxels(req, res, next) {
          const {query: {x: xs, y: ys, z: zs}} = req;
          const x = parseInt(xs, 10);
          const y = parseInt(ys, 10);
          const z = parseInt(zs, 10);

          if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            const v = req.method === 'POST' ? -1 : 1;

            const regeneratePromises = [];
            const seenIndex = {};
            for (let i = 0; i < DIRECTIONS.length; i++) {
              const [dx, dz] = DIRECTIONS[i];
              const ax = x + dx * 2;
              const az = z + dz * 2;
              const ox = Math.floor(ax / NUM_CELLS);
              const oz = Math.floor(az / NUM_CELLS);
              const lx = x - (ox * NUM_CELLS);
              const lz = z - (oz * NUM_CELLS);
              const newEther = Float32Array.from([lx, y, lz, v]);

              const index = _getChunkIndex(ox, oz);
              if (!seenIndex[index]) {
                let chunk = tra.getChunk(ox, oz);
                if (!chunk) {
                  chunk = _generateChunk(tra.makeChunk(ox, oz), {
                    newEther,
                  });
                } else {
                  const oldUint32Buffer = chunk.getBuffer();
                  const oldChunkData = protocolUtils.parseData(oldUint32Buffer.buffer, oldUint32Buffer.byteOffset);
                  const oldBiomes = oldChunkData.biomes.slice();
                  const oldElevations = oldChunkData.elevations.slice();
                  const oldEther = oldChunkData.ether.slice();
                  const oldWater = oldChunkData.water.slice();
                  const oldLava = oldChunkData.lava.slice();

                  chunk = _generateChunk(chunk, {
                    oldBiomes,
                    oldElevations,
                    oldEther,
                    oldWater,
                    oldLava,
                    newEther,
                  });
                }

                regeneratePromises.push(
                  _decorateChunkLightsSub(chunk, x, y, z)
                    .then(chunk => _decorateChunkLightmaps(chunk))
                );

                seenIndex[index] = true;
              }
            }
            _saveChunks();

            Promise.all(regeneratePromises)
              .then(regeneratedChunks => {
                res.type('application/octet-stream');

                const chunksHeader = Uint32Array.from([regeneratedChunks.length]);
                res.write(new Buffer(chunksHeader.buffer, chunksHeader.byteOffset, chunksHeader.byteLength));
                for (let i = 0; i < regeneratedChunks.length; i++) {
                  const chunk = regeneratedChunks[i];

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
              });
          } else {
            res.status(400);
            res.send();
          }
        }
        app.post('/archae/heightfield/voxels', serveHeightfieldVoxels);
        app.delete('/archae/heightfield/voxels', serveHeightfieldVoxels);

        class Heightfield extends EventEmitter {
          requestHeightfield(x, z) {
            let chunk = tra.getChunk(x, z);
            if (!chunk) {
              chunk = _generateChunk(tra.makeChunk(x, z));
              _saveChunks();
            }
            const uint32Buffer = chunk.getBuffer();
            return Promise.resolve(protocolUtils.parseData(uint32Buffer.buffer, uint32Buffer.byteOffset).heightfield);
          }
          requestStaticHeightfield(x, z) {
            let chunk = tra.getChunk(x, z);
            if (!chunk) {
              chunk = _generateChunk(tra.makeChunk(x, z));
              _saveChunks();
            }
            const uint32Buffer = chunk.getBuffer();
            return Promise.resolve(protocolUtils.parseData(uint32Buffer.buffer, uint32Buffer.byteOffset).staticHeightfield);
          }
          requestBiomes(x, z) {
            let chunk = tra.getChunk(x, z);
            if (!chunk) {
              chunk = _generateChunk(tra.makeChunk(x, z));
              _saveChunks();
            }
            const uint32Buffer = chunk.getBuffer();
            return Promise.resolve(protocolUtils.parseData(uint32Buffer.buffer, uint32Buffer.byteOffset).biomes);
          }
          requestRelight(x, y, z) {
            const promises = [];

            const seenIndex = {};
            for (let i = 0; i < DIRECTIONS.length; i++) {
              const [dx, dz] = DIRECTIONS[i];
              const ax = x + dx * 15;
              const az = z + dz * 15;
              const ox = Math.floor(ax / NUM_CELLS);
              const oz = Math.floor(az / NUM_CELLS);

              const index = _getChunkIndex(ox, oz);
              if (!seenIndex[index]) {
                const chunk = tra.getChunk(ox, oz);
                if (chunk) {
                  promises.push(
                    _decorateChunkLightsSub(chunk, x, y, z)
                      .then(() => {})
                  );
                }
                seenIndex[index] = true;
              }
            }

            return Promise.all(promises);
          }
          requestLightmaps(x, z, positions) {
            const _requestLightedChunk = (x, z) => {
              let chunk = tra.getChunk(x, z);
              if (!chunk) {
                chunk = _generateChunk(tra.makeChunk(x, z));
                _saveChunks();
              }
              if (chunk[lightsSymbol]) {
                return Promise.resolve(chunk);
              } else {
                return _decorateChunkLights(chunk);
              }
            };

            return _requestLightedChunk(x, z)
              .then(chunk => {
                const uint32Buffer = chunk.getBuffer();
                const geometry = protocolUtils.parseData(uint32Buffer.buffer, uint32Buffer.byteOffset);
                const {staticHeightfield} = geometry;
                const {[lightsSymbol]: lights} = chunk;

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
          }
        };
        const heightfieldElement = new Heightfield();
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
const _getLightIndex = (x, y, z) => x + y * NUM_CELLS_OVERSCAN + z * NUM_CELLS_OVERSCAN * (NUM_CELLS_HEIGHT + 1);

module.exports = Heightfield;

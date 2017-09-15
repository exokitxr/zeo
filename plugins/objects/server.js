const path = require('path');
const fs = require('fs');

const touch = require('touch');
const zeode = require('zeode');
const {
  BLOCK_BUFFER_SIZE,
  GEOMETRY_BUFFER_SIZE,
} = zeode;
const txtr = require('txtr');
const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,

  NUM_CELLS_HEIGHT,
  NUM_CHUNKS_HEIGHT,

  TEXTURE_SIZE,

  DEFAULT_SEED,

  NUM_POSITIONS_CHUNK,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');
const objectsLib = require('./lib/objects/server/index');

const NUM_CELLS_HALF = NUM_CELLS / 2;
const NUM_CELLS_CUBE = Math.sqrt((NUM_CELLS_HALF + 16) * (NUM_CELLS_HALF + 16) * 3); // larger than the actual bounding box to account for geometry overflow
const NUM_VOXELS_CHUNK_HEIGHT = BLOCK_BUFFER_SIZE / 4 / NUM_CHUNKS_HEIGHT;
const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';

const decorationsSymbol = Symbol();

class Objects {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {dirname, dataDirectory} = archae;
    const {express, ws, app, wss} = archae.getCore();
    const {three, elements, utils: {js: jsUtils, hash: hashUtils, random: randomUtils, image: imageUtils}} = zeo;
    const {THREE} = three;
    const {mod} = jsUtils;
    const {murmur} = hashUtils;
    const {alea, vxl} = randomUtils;
    const {jimp} = imageUtils;

    return elements.requestElement(HEIGHTFIELD_PLUGIN)
      .then(heightfieldElement => {
        const _getChunkIndex = (x, z) => (mod(x, 0xFFFF) << 16) | mod(z, 0xFFFF);

        const zeodeDataPath = path.join(dirname, dataDirectory, 'zeode.dat');
        const texturesPngDataPath = path.join(dirname, dataDirectory, 'textures.png');
        const texturesJsonDataPath = path.join(dirname, dataDirectory, 'textures.json');

        const rng = new alea(DEFAULT_SEED);
        const heightfields = {}; // XXX these should be LRU caches
        const biomes = {};
        const geometryTypes = {};
        const geometriesBuffer = new Uint8Array(NUM_POSITIONS_CHUNK);
        let geommetriesIndex = 0;
        const noises = {};
        const generators = [];
        let numBlockTypes = 0;
        const blockTypes = {};
        const transparentVoxels = new Uint8Array(256);
        const translucentVoxels = new Uint8Array(256);
        const faceUvs = new Float32Array(256 * 6 * 4);

        const zeroUint8Array = new Uint8Array(0);
        const localQuaternion = new THREE.Quaternion();
        const localMatrix = new THREE.Matrix4();

        const _ensureNeighboringHeightfieldChunks = (x, z) => {
          const promises = [];
          for (let dz = -1; dz <= 1; dz++) {
            const az = z + dz;
            for (let dx = -1; dx <= 1; dx++) {
              const ax = x + dx;

              const index = _getChunkIndex(ax, az);
              if (!heightfields[index]) {
                promises.push(
                  heightfieldElement.requestHeightfield(ax, az)
                    .then(heightfield => {
                      heightfields[index] = heightfield;
                    })
                );
                promises.push(
                  heightfieldElement.requestBiomes(ax, az)
                    .then(biome => {
                      biomes[index] = biome;
                    })
                );
              }
            }
          }
          return Promise.all(promises);
        };
        const _generateChunk = chunk => {
          for (let i = 0; i < generators.length; i++) {
            _generateChunkWithGenerator(chunk, generators[i]);
          }
        };
        const _generateChunkWithGenerator = (chunk, generator) => {
          const n = generator[0];
          if (!chunk.hasTrailer(n)) {
            generator[1](chunk);
            chunk.addTrailer(n);
            return true;
          } else {
            return false;
          }
        };
        const _decorateChunkGeometry = chunk => {
          const geometry = _makeChunkGeometry(chunk);

          const geometryBuffer = chunk.getGeometryBuffer();
          protocolUtils.stringifyGeometry(geometry, geometryBuffer.buffer, geometryBuffer.byteOffset);
          chunk.dirty = true; // XXX can internalize this in zeode module

          return Promise.resolve(chunk);
        };
        const _decorateChunkLightmaps = chunk => {
          const geometryBuffer = chunk.getGeometryBuffer();
          const geometry = protocolUtils.parseGeometry(geometryBuffer.buffer, geometryBuffer.byteOffset);

           return heightfieldElement.requestLightmaps(chunk.x, chunk.z, geometry.positions)
            .then(({
              skyLightmaps,
              torchLightmaps,
            }) => {
              chunk[decorationsSymbol] = {
                skyLightmaps,
                torchLightmaps,
              };
              return chunk;
            });
        };
        const _makeGeometeriesBuffer = (() => {
          const slab = new ArrayBuffer(GEOMETRY_BUFFER_SIZE * NUM_CHUNKS_HEIGHT * 7);
          let index = 0;
          const sliceSize = GEOMETRY_BUFFER_SIZE / NUM_CHUNKS_HEIGHT;
          const result = constructor => {
            const result = Array(NUM_CHUNKS_HEIGHT);
            for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
              result[i] = {
                array: new constructor(slab, index, sliceSize / constructor.BYTES_PER_ELEMENT),
                index: 0,
              };
              index += sliceSize;
            }
            return result;
          };
          result.reset = () => {
            index = 0;
          };
          return result;
        })();
        const _makeChunkGeometry = chunk => {
          _makeGeometeriesBuffer.reset();
          const geometriesPositions = _makeGeometeriesBuffer(Float32Array);
          const geometriesUvs = _makeGeometeriesBuffer(Float32Array);
          const geometriesSsaos = _makeGeometeriesBuffer(Uint8Array);
          const geometriesFrames = _makeGeometeriesBuffer(Float32Array);
          const geometriesObjectIndices = _makeGeometeriesBuffer(Float32Array);
          const geometriesIndices = _makeGeometeriesBuffer(Uint32Array);
          const geometriesObjects = _makeGeometeriesBuffer(Uint32Array);

          const {
            positions: numNewPositions,
            uvs: numNewUvs,
            ssaos: numNewSsaos,
            frames: numNewFrames,
            objectIndices: numNewObjectIndices,
            indices: numNewIndices,
            objects: numNewObjects,
          } = vxl.compose({
            src: chunk.getObjectBuffer(),
            geometries: geometriesBuffer,
            geometryIndex: geometryTypes,
            positions: geometriesPositions.map(({array}) => array),
            uvs: geometriesUvs.map(({array}) => array),
            ssaos: geometriesSsaos.map(({array}) => array),
            frames: geometriesFrames.map(({array}) => array),
            objectIndices: geometriesObjectIndices.map(({array}) => array),
            indices: geometriesIndices.map(({array}) => array),
            objects: geometriesObjects.map(({array}) => array),
          });
          for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
            geometriesPositions[i].index += numNewPositions[i];
            geometriesUvs[i].index += numNewUvs[i];
            geometriesSsaos[i].index += numNewSsaos[i];
            geometriesFrames[i].index += numNewFrames[i];
            geometriesObjectIndices[i].index += numNewObjectIndices[i];
            geometriesIndices[i].index += numNewIndices[i];
            geometriesObjects[i].index += numNewObjects[i];
          }

          const blockBuffer = chunk.getBlockBuffer();
          for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
            const voxels = blockBuffer.subarray(i * NUM_VOXELS_CHUNK_HEIGHT, (i + 1) * NUM_VOXELS_CHUNK_HEIGHT);
            const {positions: newPositions, uvs: newUvs, ssaos: newSsaos} =
              vxl.tesselate(voxels, blockTypes, [NUM_CELLS, NUM_CELLS, NUM_CELLS], transparentVoxels, translucentVoxels, faceUvs, [chunk.x * NUM_CELLS, i * NUM_CELLS, chunk.z * NUM_CELLS],
                new Float32Array(geometriesPositions[i].array.buffer, geometriesPositions[i].array.byteOffset + geometriesPositions[i].index * 4),
                new Float32Array(geometriesUvs[i].array.buffer, geometriesUvs[i].array.byteOffset + geometriesUvs[i].index * 4),
                new Uint8Array(geometriesSsaos[i].array.buffer, geometriesSsaos[i].array.byteOffset + geometriesSsaos[i].index)
              );

            if (newPositions.length > 0) {
              const newFrames = new Float32Array(newPositions.length);
              geometriesFrames[i].array.set(newFrames, geometriesFrames[i].index);

              const numNewPositions = newPositions.length / 3;
              const newObjectIndices = new Float32Array(numNewPositions);
              geometriesObjectIndices[i].array.set(newObjectIndices, geometriesObjectIndices[i].index);

              const newIndices = new Uint32Array(newPositions.length / 3);
              for (let j = 0; j < newIndices.length; j++) {
                newIndices[j] = j;
              }
              _copyIndices(newIndices, geometriesIndices[i].array, geometriesIndices[i].index, geometriesPositions[i].index / 3);

              const newObjects = new Uint32Array(0);
              geometriesObjects[i].array.set(newObjects, geometriesObjects[i].index);

              geometriesPositions[i].index += newPositions.length;
              geometriesUvs[i].index += newUvs.length;
              geometriesSsaos[i].index += newSsaos.length;
              geometriesFrames[i].index += newFrames.length;
              geometriesObjectIndices[i].index += newObjectIndices.length;
              geometriesIndices[i].index += newIndices.length;
              geometriesObjects[i].index += newObjects.length;
            }
          }

          const geometry = new THREE.BufferGeometry();
          const positions = new Float32Array(GEOMETRY_BUFFER_SIZE / 4);
          const uvs = new Float32Array(GEOMETRY_BUFFER_SIZE / 4);
          const ssaos = new Uint8Array(GEOMETRY_BUFFER_SIZE / 4);
          const frames = new Float32Array(GEOMETRY_BUFFER_SIZE / 4);
          const objectIndices = new Float32Array(GEOMETRY_BUFFER_SIZE / 4);
          const indices = new Uint32Array(GEOMETRY_BUFFER_SIZE / 4);
          const objects = new Uint32Array(GEOMETRY_BUFFER_SIZE / 4);
          let attributeIndex = 0;
          let uvIndex = 0;
          let ssaoIndex = 0;
          let frameIndex = 0;
          let objectIndexIndex = 0;
          let indexIndex = 0;
          let objectIndex = 0;

          const localGeometries = Array(NUM_CHUNKS_HEIGHT);
          for (let i = 0; i < NUM_CHUNKS_HEIGHT; i++) {
            const newPositions = geometriesPositions[i].array.subarray(0, geometriesPositions[i].index);
            positions.set(newPositions, attributeIndex);

            const newUvs = geometriesUvs[i].array.subarray(0, geometriesUvs[i].index);
            uvs.set(newUvs, uvIndex);

            const newSsaos = geometriesSsaos[i].array.subarray(0, geometriesSsaos[i].index);
            ssaos.set(newSsaos, ssaoIndex);

            const newFrames = geometriesFrames[i].array.subarray(0, geometriesFrames[i].index);
            frames.set(newFrames, frameIndex);

            const newObjectIndices = geometriesObjectIndices[i].array.subarray(0, geometriesObjectIndices[i].index);
            objectIndices.set(newObjectIndices, objectIndexIndex);

            const newIndices = geometriesIndices[i].array.subarray(0, geometriesIndices[i].index);
            _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

            const newObjects = geometriesObjects[i].array.subarray(0, geometriesObjects[i].index);
            objects.set(newObjects, objectIndex);

            localGeometries[i] = {
              attributeRange: {
                start: attributeIndex,
                count: newPositions.length,
              },
              indexRange: {
                start: indexIndex,
                count: newIndices.length,
              },
              boundingSphere: Float32Array.from([
                chunk.x * NUM_CELLS + NUM_CELLS_HALF,
                i * NUM_CELLS + NUM_CELLS_HALF,
                chunk.z * NUM_CELLS + NUM_CELLS_HALF,
                NUM_CELLS_CUBE
              ]),
            };

            attributeIndex += newPositions.length;
            uvIndex += newUvs.length;
            ssaoIndex += newSsaos.length;
            frameIndex += newFrames.length;
            objectIndexIndex += newObjectIndices.length;
            indexIndex += newIndices.length;
            objectIndex += newObjects.length;
          };

          return {
            positions: new Float32Array(positions.buffer, positions.byteOffset, attributeIndex),
            uvs: new Float32Array(uvs.buffer, uvs.byteOffset, uvIndex),
            ssaos: new Uint8Array(ssaos.buffer, ssaos.byteOffset, ssaoIndex),
            frames: new Float32Array(frames.buffer, frames.byteOffset, frameIndex),
            objectIndices: new Float32Array(objectIndices.buffer, objectIndices.byteOffset, objectIndexIndex),
            indices: new Uint32Array(indices.buffer, indices.byteOffset, indexIndex),
            objects: new Uint32Array(objects.buffer, objects.byteOffset, objectIndex),
            geometries: localGeometries,
          };
        };
        const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
          for (let i = 0; i < src.length; i++) {
            dst[startIndexIndex + i] = src[i] + startAttributeIndex;
          }
        };

        const _readEnsureFile = (p, opts) => new Promise((accept, reject) => {
          fs.readFile(p, opts, (err, d) => {
            if (!err) {
              accept(d);
            } else if (err.code === 'ENOENT') {
              touch(p, err => {
                if (!err) {
                  accept(null);
                } else {
                  reject(err);
                }
              });
            } else {
              reject(err);
            }
          });
        });
        const _getZeode = () => _readEnsureFile(zeodeDataPath)
          .then(b => {
            const zde = zeode();
            if (b) {
              zde.load(b);
            }
            return zde;
          });
        const _getTextures = () => Promise.all([
          _readEnsureFile(texturesPngDataPath)
            .then(b => {
              if (b !== null && b.length > 0) {
                return jimp.read(b);
              } else {
                return Promise.resolve(new jimp(TEXTURE_SIZE, TEXTURE_SIZE));
              }
            })
            .then(textureImg => {
              textureImg.version = 0;
              return textureImg;
            }),
          _readEnsureFile(texturesJsonDataPath, 'utf8')
            .then(s => {
              if (s !== null && s.length > 0) {
                const {atlas, uvs} = JSON.parse(s);
                return [
                  txtr.fromJson(atlas),
                  uvs,
                ];
              } else {
                return [
                  txtr(TEXTURE_SIZE, TEXTURE_SIZE),
                  {},
                ];
              }
            }),
        ])
          .then(([
            textureImg,
            [
              textureAtlas,
              textureUvs,
            ],
          ]) => ({
            textureImg,
            textureAtlas,
            textureUvs,
          }));

        return Promise.all([
          _getZeode(),
          _getTextures(),
        ])
          .then(([
            zde,
            {
              textureImg,
              textureAtlas,
              textureUvs,
            },
          ]) => {
            const _requestChunk = (x, z) => {
              const chunk = zde.getChunk(x, z);

              if (chunk) {
                return Promise.resolve(chunk);
              } else {
                return _ensureNeighboringHeightfieldChunks(x, z)
                  .then(() => {
                    const chunk = zde.makeChunk(x, z);
                    _generateChunk(chunk);
                    return _decorateChunkGeometry(chunk);
                  })
                  .then(chunk => {
                    _saveChunks();

                    return chunk;
                  });
              }
            };

            const _writeFileData = (p, data, byteOffset) => new Promise((accept, reject) => {
              const ws = fs.createWriteStream(p, {
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
                promises.push(_writeFileData(zeodeDataPath, new Buffer(data.buffer, data.byteOffset, data.byteLength), byteOffset));
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
            const _saveTextures = _debounce(next => {
              Promise.all([
                textureImg.write(texturesPngDataPath),
                _writeFileData(texturesJsonDataPath, JSON.stringify({
                  atlas: textureAtlas.toJson(),
                  uvs: textureUvs,
                }, null, 2)),
              ])
                .then(() => {
                  next();
                })
                .catch(err => {
                  console.warn(err);

                  next();
                });
            });

            const _getObjects = () => {
              const objectApi = {
                NUM_CELLS,
                NUM_CELLS_OVERSCAN,
                getRandom() {
                  return rng();
                },
                getHash(s) {
                  return murmur(s);
                },
                registerNoise(name, spec) {
                  noises[name] = new vxl.fastNoise({
                    seed: murmur(spec.seed),
                    frequency: spec.frequency,
                    octaves: spec.octaves,
                  });
                },
                getNoise(name, ox, oz, x, z) {
                  const ax = (ox * NUM_CELLS) + x;
                  const az = (oz * NUM_CELLS) + z;
                  return noises[name].in2D(ax + 1000, az + 1000);
                },
                getHeightfield(x, z) {
                  return heightfields[_getChunkIndex(x, z)];
                },
                getBiomes(x, z) {
                  return biomes[_getChunkIndex(x, z)];
                },
                registerGeometry(name, geometry) {
                  if (!geometry.getAttribute('ssao')) {
                    const ssaos = new Uint8Array(geometry.getAttribute('position').array.length / 3);
                    geometry.addAttribute('ssao', new THREE.BufferAttribute(ssaos, 1));
                  }
                  if (!geometry.getAttribute('frame')) {
                    const frames = new Float32Array(geometry.getAttribute('position').array.length);
                    geometry.addAttribute('frame', new THREE.BufferAttribute(frames, 3));
                  }
                  if (!geometry.boundingBox) {
                    geometry.computeBoundingBox();
                  }

                  const index = geommetriesIndex;
                  geommetriesIndex = protocolUtils.stringifyTemplate({
                    positions: geometry.getAttribute('position').array,
                    uvs: geometry.getAttribute('uv').array,
                    ssaos: geometry.getAttribute('ssao').array,
                    frames: geometry.getAttribute('frame').array,
                    indices: geometry.index.array,
                    boundingBox: Float32Array.from([
                      geometry.boundingBox.min.x,
                      geometry.boundingBox.min.y,
                      geometry.boundingBox.min.z,
                      geometry.boundingBox.max.x,
                      geometry.boundingBox.max.y,
                      geometry.boundingBox.max.z,
                    ]),
                  }, geometriesBuffer.buffer, geometriesBuffer.byteOffset + geommetriesIndex)[1];

                  geometryTypes[murmur(name)] = index;
                },
                registerBlock(name, blockSpec) {
                  const index = ++numBlockTypes;
                  blockSpec.index = index;
                  blockTypes[murmur(name)] = blockSpec;

                  transparentVoxels[index] = +blockSpec.transparent;
                  translucentVoxels[index] = +blockSpec.translucent;
                  for (let d = 0; d < 6; d++) {
                    faceUvs.set(Float32Array.from(blockSpec.uvs[d]), index * 6 * 4 + d * 4);
                  }
                },
                setBlock(chunk, x, y, z, name) {
                  const ox = Math.floor(x / NUM_CELLS);
                  const oz = Math.floor(z / NUM_CELLS);
                  if (ox === chunk.x && oz === chunk.z && y > 0 && y < NUM_CELLS_HEIGHT) {
                    chunk.setBlock(x - ox * NUM_CELLS, y, z - oz * NUM_CELLS, murmur(name));
                  }
                },
                clearBlock(chunk, x, y, z) {
                  const ox = Math.floor(x / NUM_CELLS);
                  const oz = Math.floor(z / NUM_CELLS);
                  if (ox === chunk.x && oz === chunk.z && y > 0 && y < NUM_CELLS_HEIGHT) {
                    chunk.clearBlock(x - ox * NUM_CELLS, y, z - oz * NUM_CELLS);
                  }
                },
                getUv(name) {
                  return textureUvs[murmur(name)];
                },
                getTileUv(name) {
                  const uv = textureUvs[murmur(name)];

                  const tileSizeU = uv[2] - uv[0];
                  const tileSizeV = uv[3] - uv[1];

                  const tileSizeIntU = Math.floor(tileSizeU * TEXTURE_SIZE) / 2;
                  const tileSizeIntV = Math.floor(tileSizeV * TEXTURE_SIZE) / 2;

                  const u = tileSizeIntU + uv[0];
                  const v = tileSizeIntV + uv[1];

                  return [-u, 1 - v, -u, 1 - v];
                },
                registerTexture(name, img, {fourTap = false} = {}) {
                  const n = murmur(name);

                  if (!textureUvs[n]) {
                    if (fourTap) {
                      const srcImg = img;
                      img = new jimp(srcImg.bitmap.width * 2, srcImg.bitmap.height * 2);
                      img.composite(srcImg, 0, 0);
                      img.composite(srcImg, srcImg.bitmap.width, 0);
                      img.composite(srcImg, 0, srcImg.bitmap.height);
                      img.composite(srcImg, srcImg.bitmap.width, srcImg.bitmap.height);
                    }
                    const rect = textureAtlas.pack(img.bitmap.width, img.bitmap.height);
                    const uv = textureAtlas.uv(rect);

                    textureImg.composite(img, rect.x, rect.y);
                    textureImg.version++;

                    textureUvs[n] = uv;

                    _saveTextures();
                  }
                },
                registerGenerator(name, fn) {
                  const n = murmur(name);
                  const generator = [n, fn];
                  generators.push(generator);

                  if (zde.chunks.length > 0) {
                    const promises = [];
                    for (let i = 0; i < zde.chunks.length; i++) {
                      const chunk = zde.chunks[i];
                      if (_generateChunkWithGenerator(chunk, generator)) {
                        promises.push(
                          _decorateChunkGeometry(chunk)
                            .then(chunk => chunk[decorationsSymbol] ? _decorateChunkLightmaps(chunk) : chunk)
                        );
                      }
                    }
                    if (promises.length > 0) {
                      Promise.all(promises)
                        .then(() => {
                          _saveChunks();
                        })
                        .catch(err => {
                          console.warn(err);
                        });
                    }
                  }
                },
                addObject(chunk, name, position, rotation, value) {
                  const n = murmur(name);
                  const matrix = position.toArray().concat(rotation.toArray());
                  chunk.addObject(n, matrix, value);
                },
              };
              objectApi.registerNoise('grass', { // XXX move these into the objects lib
                seed: DEFAULT_SEED + ':grass',
                frequency: 0.2,
                octaves: 4,
              });
              objectApi.registerNoise('tree', {
                seed: DEFAULT_SEED + ':tree',
                frequency: 0.2,
                octaves: 4,
              });
              objectApi.registerNoise('items', {
                seed: DEFAULT_SEED + ':items',
                frequency: 0.2,
                octaves: 4,
              });

              return Promise.all(objectsLib(objectApi).map(makeObject => makeObject()));
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

                function serveObjectsTextureAtlas(req, res, next) {
                  textureImg.getBuffer('image/png', (err, buffer) => {
                    if (!err) {
                      res.type('image/png');
                      res.send(buffer);
                    } else {
                      res.status(500);
                      res.json({
                        error: err.stack,
                      });
                    }
                  });
                }
                app.use('/archae/objects/texture-atlas.png', serveObjectsTextureAtlas);

                function serveObjectsChunks(req, res, next) {
                  const {query: {x: xs, z: zs}} = req;
                  const x = parseInt(xs, 10);
                  const z = parseInt(zs, 10);

                  if (!isNaN(x) && !isNaN(z)) {
                    _requestChunk(x, z)
                      .then(chunk => !chunk[decorationsSymbol] ? _decorateChunkLightmaps(chunk) : chunk)
                      .then(chunk => {
                        res.type('application/octet-stream');
                        res.set('Texture-Atlas-Version', textureImg.version);

                        const objectBuffer = chunk.getObjectBuffer();
                        res.write(new Buffer(objectBuffer.buffer, objectBuffer.byteOffset, objectBuffer.byteLength));

                        const blockBuffer = chunk.getBlockBuffer();
                        res.write(new Buffer(blockBuffer.buffer, blockBuffer.byteOffset, blockBuffer.byteLength));

                        const geometryBuffer = chunk.getGeometryBuffer();
                        res.write(new Buffer(geometryBuffer.buffer, geometryBuffer.byteOffset, geometryBuffer.byteLength));

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
                        const {id, args} = m;
                        const {x, z, n, matrix, value} = args;

                        const chunk = zde.getChunk(x, z);
                        if (chunk) {
                          const objectIndex = chunk.addObject(n, matrix, value);

                          _decorateChunkGeometry(chunk)
                            .then(() => {
                              _saveChunks();

                              return heightfieldElement.requestRelight(Math.floor(matrix[0]), Math.floor(matrix[1]), Math.floor(matrix[2]));
                            })
                            .then(() => {
                              c.send(JSON.stringify({
                                type: 'response',
                                id,
                                result: objectIndex,
                              }));

                              _broadcast({
                                type: 'addObject',
                                args,
                                result: objectIndex,
                              });
                            })
                            .catch(err => {
                              console.warn(err);
                            });
                        }
                      } else if (method === 'removeObject') {
                        const {id, args} = m;
                        const {x, z, index} = args;

                        const chunk = zde.getChunk(x, z);
                        if (chunk) {
                          const matrix = chunk.getObjectMatrix(index);
                          const n = chunk.removeObject(index);

                          _decorateChunkGeometry(chunk)
                            .then(() => {
                              _saveChunks();

                              return heightfieldElement.requestRelight(Math.floor(matrix[0]), Math.floor(matrix[1]), Math.floor(matrix[2]));
                            })
                            .then(() => {
                              c.send(JSON.stringify({
                                type: 'response',
                                id,
                                result: n,
                              }));

                              _broadcast({
                                type: 'removeObject',
                                args,
                                result: n,
                              });
                            })
                            .catch(err => {
                              console.warn(err);
                            });
                        }
                      } else if (method === 'setObjectData') {
                        const {id, args} = m;
                        const {x, z, index, value} = args;

                        const chunk = zde.getChunk(x, z);
                        if (chunk) {
                          chunk.setObjectData(index, value);

                          _saveChunks();

                          c.send(JSON.stringify({
                            type: 'response',
                            id,
                            result: null,
                          }));

                          _broadcast({
                            type: 'setObjectData',
                            args,
                            result: null,
                          });
                        }
                      } else if (method === 'setBlock') {
                        const {id, args} = m;
                        const {x, y, z, v} = args;

                        const ox = Math.floor(x / NUM_CELLS);
                        const oz = Math.floor(z / NUM_CELLS);
                        const chunk = zde.getChunk(ox, oz);
                        if (chunk) {
                          chunk.setBlock(x - ox * NUM_CELLS, y, z - oz * NUM_CELLS, v);

                          _decorateChunkGeometry(chunk)
                            .then(() => {
                              _saveChunks();

                              return heightfieldElement.requestRelight(x, y, z);
                            })
                            .then(() => {
                              c.send(JSON.stringify({
                                type: 'response',
                                id,
                                result: null,
                              }));

                              _broadcast({
                                type: 'setBlock',
                                args,
                                result: null,
                              });
                            })
                            .catch(err => {
                              console.warn(err);
                            });
                        }
                      } else if (method === 'clearBlock') {
                        const {id, args} = m;
                        const {x, y, z} = args;

                        const ox = Math.floor(x / NUM_CELLS);
                        const oz = Math.floor(z / NUM_CELLS);
                        const chunk = zde.getChunk(ox, oz);
                        if (chunk) {
                          chunk.clearBlock(x - ox * NUM_CELLS, y, z - oz * NUM_CELLS);

                          _decorateChunkGeometry(chunk)
                            .then(() => {
                              _saveChunks();

                              return heightfieldElement.requestRelight(x, y, z);
                            })
                            .then(() => {
                              c.send(JSON.stringify({
                                type: 'response',
                                id,
                                result: null,
                              }));

                              _broadcast({
                                type: 'clearBlock',
                                args,
                                result: null,
                              });
                            })
                            .catch(err => {
                              console.warn(err);
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

                const _lights = chunk => {
                  if (chunk[decorationsSymbol]) {
                    chunk[decorationsSymbol] = null;
                  }
                };
                heightfieldElement.on('lights', _lights);

                const objectsElement = {
                  ensureNeighboringChunks: (x, z) => {
                    const promises = [];
                    for (let dz = -1; dz <= 1; dz++) {
                      const az = z + dz;
                      for (let dx = -1; dx <= 1; dx++) {
                        const ax = x + dx;
                        promises.push(_requestChunk(ax, az).then(() => {}));
                      }
                    }
                    return Promise.all(promises);
                  },
                  getLightSources: (x, z) => {
                    const result = [];
                    const torchN = murmur('torch');
                    zde.getChunk(x, z).forEachObject((n, matrix) => {
                      if (n === torchN) {
                        const [x, y, z] = matrix;
                        result.push([Math.floor(x), Math.floor(y), Math.floor(z), 16]);
                      }
                    });
                    return result;
                  },
                  isOccluded(x, y, z) {
                    const ox = Math.floor(x / NUM_CELLS);
                    const oz = Math.floor(z / NUM_CELLS);

                    return zde.getChunk(ox, oz).getBlock(x - ox * NUM_CELLS, y, z - oz * NUM_CELLS) !== 0;
                  },
                };
                elements.registerEntity(this, objectsElement);

                this._cleanup = () => {
                  for (let i = 0; i < objectCleanups.length; i++) {
                    const objectCleanup = objectCleanups[i];
                    objectCleanup();
                  }

                  function removeMiddlewares(route, i, routes) {
                    if (
                      route.handle.name === 'serveObjectsImg' ||
                      route.handle.name === 'serveObjectsSfx' ||
                      route.handle.name === 'serveObjectsTextureAtlas' ||
                      route.handle.name === 'serveObjectsChunks'
                    ) {
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

                  heightfieldElement.removeListener('lights', _lights);

                  elements.unregisterEntity(this, objectsElement);
                };
              });
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

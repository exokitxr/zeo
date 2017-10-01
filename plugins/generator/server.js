const path = require('path');
const fs = require('fs');
const child_process = require('child_process');

const touch = require('touch');
const zeode = require('zeode');
const {
  BLOCK_BUFFER_SIZE,
  GEOMETRY_BUFFER_SIZE,
} = zeode;
const txtr = require('txtr');
const Pullstream = require('pullstream');
const servletPath = require.resolve('./servlet');
const servlet = require(servletPath);
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
const objectsTesselatorLib = require('./objects-tesselator');

const DIRECTIONS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

const lightsSymbol = Symbol();
const lightsRenderedSymbol = Symbol();
const lightmapsSymbol = Symbol();
const blockfieldSymbol = Symbol();
const blockfieldRenderedSymbol = Symbol();

class Generator {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {dirname, dataDirectory, installDirectory} = archae;
    const {express, ws, app, wss} = archae.getCore();
    const {three, elements, utils: {js: jsUtils, hash: hashUtils, random: randomUtils, image: imageUtils}} = zeo;
    const {THREE} = three;
    const {mod} = jsUtils;
    const {murmur} = hashUtils;
    const {vxlPath, vxl} = randomUtils;
    const {jimp} = imageUtils;

    const zeroVector = new THREE.Vector3();
    const zeroVectorArray = zeroVector.toArray();

    const geometriesBuffer = new Uint8Array(NUM_POSITIONS_CHUNK);
    geometriesBuffer.version = 0;
    const geometryTypes = new Uint32Array(4096);
    let geometriesIndex = 0;
    let geometriesOffset = 0;
    const noises = {};
    const generators = [];
    const blockTypes = new Uint32Array(4096);
    let blockTypesIndex = 0;
    const transparentVoxels = new Uint8Array(256);
    const translucentVoxels = new Uint8Array(256);
    const faceUvs = new Float32Array(256 * 6 * 4);
    const lights = new Uint32Array(256);
    const zeroBuffer = new Uint32Array(0);
    let lightsIndex = 0;
    const noiser = vxl.noiser({
      seed: murmur(DEFAULT_SEED),
    });
    const objectsTesselator = objectsTesselatorLib({
      vxl,
      geometriesBuffer,
      geometryTypes,
      blockTypes,
      transparentVoxels,
      translucentVoxels,
      faceUvs,
    });
    const zeodeDataPath = path.join(dirname, dataDirectory, 'zeode.dat');
    const texturesPngDataPath = path.join(dirname, dataDirectory, 'textures.png');
    const texturesJsonDataPath = path.join(dirname, dataDirectory, 'textures.json');

    const _getChunkIndex = (x, z) => (mod(x, 0xFFFF) << 16) | mod(z, 0xFFFF);
    // const _getLightsIndex = (x, y, z) => x + y * NUM_CELLS_OVERSCAN + z * NUM_CELLS_OVERSCAN * (NUM_CELLS_HEIGHT + 1);
    const _getLightsArrayIndex = (x, z) => x + z * 3;
    const _findLight = n => {
      for (let i = 0; i < 256; i++) {
        if (lights[i * 2 + 0] === n) {
          return lights[i * 2 + 1];
        }
      }
      return 0;
    };

    const childProcess = child_process.spawn(process.argv[0], [servletPath, path.join(dirname, installDirectory)], {
      stdio: 'pipe',
    });
    let numRemovedQueues = 0;
    const _cleanupQueues = () => {
      if (++numRemovedQueues >= 16) {
        const newQueues = {};
        for (const id in queues) {
          const entry = queues[id];
          if (entry !== null) {
            newQueues[id] = entry;
          }
        }
        queues = newQueues;
        numRemovedQueues = 0;
      }
    };
    let ids = 0;
    const queues = {};
    childProcess.request = (method, args, cb) => {
      const id = ids++;

      const headerBuffer = Uint32Array.from([method, id]);
      childProcess.stdin.write(new Buffer(headerBuffer.buffer, headerBuffer.byteOffset, headerBuffer.byteLength));

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const headerBuffer = Uint32Array.from([arg.byteLength]);
        childProcess.stdin.write(new Buffer(headerBuffer.buffer, headerBuffer.byteOffset, headerBuffer.byteLength));
        childProcess.stdin.write(new Buffer(arg.buffer, arg.byteOffset, arg.length * arg.constructor.BYTES_PER_ELEMENT));
      }

      queues[id] = cb;
    };
    const pullstream = new Pullstream();
    childProcess.stdout.pipe(pullstream);
    childProcess.stderr.pipe(process.stderr);
    const _recurse = () => {
      pullstream.pull(4 * 2, (err, data) => {
        if (!err) {
          const headerBufer = new Uint32Array(data.buffer, data.byteOffset, 2);
          const [id, numBuffers] = headerBufer;
          pullstream.pull(numBuffers, (err, result) => {
            queues[id](result);

            _recurse();
          });
        } else {
          console.warn(err);

          // _recurse();
        }
      });
    };
    _recurse();
    childProcess.on('exit', (code, signal) => {
      console.warn('generator child process exited with code', code, signal);
    });

    const _generateChunk = chunk => _generateChunkTerrain(chunk)
      .then(chunk => _generateChunkObjects(chunk));
    const _generateChunkTerrain = (chunk, oldBiomes, oldElevations, oldEther, oldWater, oldLava, newEther) => new Promise((accept, reject) => {
      childProcess.request(servlet.METHODS.generateTerrain, [
        Uint32Array.from([chunk.x, chunk.z]),
        oldBiomes || zeroBuffer,
        oldElevations || zeroBuffer,
        oldEther || zeroBuffer,
        oldWater || zeroBuffer,
        oldLava || zeroBuffer,
        newEther || zeroBuffer,
      ], result => {
        const uint32Buffer = chunk.getTerrainBuffer();
        result.copy(new Buffer(uint32Buffer.buffer, uint32Buffer.byteOffset, uint32Buffer.byteLength));
        // protocolUtils.stringifyTerrainData(result, uint32Buffer.buffer, uint32Buffer.byteOffset);

        accept(chunk);
      });
    });
    const _generateChunkObjects = chunk => {
      for (let i = 0; i < generators.length; i++) {
        _generateChunkObjectsWithGenerator(chunk, generators[i]);
      }
      _decorateChunkObjectsGeometry(chunk);

      return Promise.resolve(chunk);
    };
    const _generateChunkObjectsWithGenerator = (chunk, generator) => {
      const n = generator[0];
      if (!chunk.hasTrailer(n)) {
        generator[1](chunk);
        chunk.addTrailer(n);
        return true;
      } else {
        return false;
      }
    };
    const _decorateChunkObjectsGeometry = chunk => {
      const geometryBuffer = chunk.getGeometryBuffer();
      protocolUtils.stringifyGeometry(objectsTesselator.tesselate(chunk), geometryBuffer.buffer, geometryBuffer.byteOffset); // XXX make this go through the child process
      return Promise.resolve(chunk);
    };
    const _symbolizeChunk = chunk => {
      if (chunk) {
        chunk[lightsSymbol] = new Uint8Array(NUM_CELLS_OVERSCAN * (NUM_CELLS_HEIGHT + 1) * NUM_CELLS_OVERSCAN);
        chunk[lightsRenderedSymbol] = false;
        chunk[lightmapsSymbol] = null;
        chunk[blockfieldSymbol] = new Uint8Array(NUM_CELLS * NUM_CELLS_HEIGHT * NUM_CELLS);
        chunk[blockfieldRenderedSymbol] = false;
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

          for (const index in zde.chunks) {
            _symbolizeChunk(zde.chunks[index]);
          }
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
        const _requestChunkHard = (x, z) => {
          const chunk = zde.getChunk(x, z);

          if (chunk) {
            return Promise.resolve(chunk);
          } else {
            const chunk = zde.makeChunk(x, z);
            _symbolizeChunk(chunk);

            return _generateChunk(chunk)
              .then(() => {
                _saveChunks();

                return chunk;
              });
          }
        };
        const _decorateChunkLights = chunk => _decorateChunkLightsRange(
          chunk,
          (chunk.x - 1) * NUM_CELLS,
          (chunk.x + 2) * NUM_CELLS,
          0,
          NUM_CELLS_HEIGHT + 1,
          (chunk.z - 1) * NUM_CELLS,
          (chunk.z + 2) * NUM_CELLS,
          false
        );
        const _decorateChunkLightsSub = (chunk, x, y, z) => _decorateChunkLightsRange(
          chunk,
          Math.max(x - 15, (chunk.x - 1) * NUM_CELLS),
          Math.min(x + 15, (chunk.x + 2) * NUM_CELLS),
          Math.max(y - 15, 0),
          Math.min(y + 15, NUM_CELLS_HEIGHT),
          Math.max(z - 15, (chunk.z - 1) * NUM_CELLS),
          Math.min(z + 15, (chunk.z + 2) * NUM_CELLS),
          true
        );
        /* const _ensureChunksHardRange = (minX, maxX, minZ, maxZ) => {
          const minOX = Math.floor(minX / NUM_CELLS);
          const maxOX = Math.floor((maxX - 1) / NUM_CELLS);
          const minOZ = Math.floor(minZ / NUM_CELLS);
          const maxOZ = Math.floor((maxZ - 1) / NUM_CELLS); */
        const _ensureChunksHardRange = (ox, oz) => {
          const promises = [];
          for (let doz = -1; doz <= 1; doz++) {
            for (let dox = -1; dox <= 1; dox++) {
          /* for (let doz = minOZ; doz < maxOZ; doz++) {
            for (let dox = minOX; dox < maxOX; dox++) { */
              promises.push(_requestChunkHard(ox + dox, oz + doz));
            }
          }
          return Promise.all(promises).then(() => {});
        };
        // const _decorateChunkLightsRange = (chunk, minX, maxX, minY, maxY, minZ, maxZ, relight) => _ensureChunksHardRange(minX, maxZ, minZ, maxZ)
        const _decorateChunkLightsRange = (chunk, minX, maxX, minY, maxY, minZ, maxZ, relight) => _ensureChunksHardRange(chunk.x, chunk.z)
          .then(() => {
            const {x: ox, z: oz} = chunk;
            const updatingLights = chunk[lightsRenderedSymbol];

            const lavaArray = Array(9);
            const objectLightsArray = Array(9);
            const etherArray = Array(9);
            const blocksArray = Array(9);
            const lightsArray = Array(9);
            for (let doz = -1; doz <= 1; doz++) {
              for (let dox = -1; dox <= 1; dox++) {
                const arrayIndex = _getLightsArrayIndex(dox + 1, doz + 1);

                const aox = ox + dox;
                const aoz = oz + doz;
                const chunk = zde.getChunk(aox, aoz);
                const uint32Buffer = chunk.getTerrainBuffer();
                const {ether, lava} = protocolUtils.parseTerrainData(uint32Buffer.buffer, uint32Buffer.byteOffset); // XXX can be reduced to only parse the needed fields
                lavaArray[arrayIndex] = lava;

                const objectLights = chunk.getLightBuffer();
                objectLightsArray[arrayIndex] = objectLights;

                etherArray[arrayIndex] = ether;

                const blocks = chunk.getBlockBuffer();
                blocksArray[arrayIndex] = blocks;

                const {[lightsSymbol]: lights} = chunk;
                lightsArray[arrayIndex] = lights;
              }
            }

            vxl.light(
              ox, oz,
              minX, maxX, minY, maxY, minZ, maxZ,
              relight,
              lavaArray,
              objectLightsArray,
              etherArray,
              blocksArray,
              lightsArray,
            );
            chunk[lightsRenderedSymbol] = true;
            chunk[lightmapsSymbol] = null;

            return chunk;
          });
        const _requestChunkWithLights = chunk => chunk[lightsRenderedSymbol] ? Promise.resolve(chunk) : _decorateChunkLights(chunk);
        const _requestChunkWithLightmaps = chunk => {
          if (chunk[lightmapsSymbol]) {
            return Promise.resolve(chunk);
          } else {
            const _getTerrainLightmaps = () => {
              const terrainBuffer = chunk.getTerrainBuffer();
              const {positions, staticHeightfield} = protocolUtils.parseTerrainData(terrainBuffer.buffer, terrainBuffer.byteOffset);
              const {[lightsSymbol]: lights} = chunk;

              const numPositions = positions.length;
              const numLightmaps = numPositions / 3;
              const lightmapsBuffer = new ArrayBuffer(numLightmaps * 2);
              const skyLightmaps = new Uint8Array(lightmapsBuffer, 0, numLightmaps);
              const torchLightmaps = new Uint8Array(lightmapsBuffer, numLightmaps, numLightmaps);

              vxl.lightmap(chunk.x, chunk.z, positions, numPositions, staticHeightfield, lights, skyLightmaps, torchLightmaps);

              return {
                skyLightmaps,
                torchLightmaps,
              };
            };
            const _getObjectLightmaps = () => {
              const geometryBuffer = chunk.getGeometryBuffer();
              const {positions} = protocolUtils.parseGeometry(geometryBuffer.buffer, geometryBuffer.byteOffset);

              const terrainBuffer = chunk.getTerrainBuffer();
              const {staticHeightfield} = protocolUtils.parseTerrainData(terrainBuffer.buffer, terrainBuffer.byteOffset);
              const {[lightsSymbol]: lights} = chunk;

              const numPositions = positions.length;
              const numLightmaps = numPositions / 3;
              const lightmapsBuffer = new ArrayBuffer(numLightmaps * 2);
              const skyLightmaps = new Uint8Array(lightmapsBuffer, 0, numLightmaps);
              const torchLightmaps = new Uint8Array(lightmapsBuffer, numLightmaps, numLightmaps);

              vxl.lightmap(chunk.x, chunk.z, positions, numPositions, staticHeightfield, lights, skyLightmaps, torchLightmaps);

              return {
                skyLightmaps,
                torchLightmaps,
              };
            };

            chunk[lightmapsSymbol] = {
              terrain: _getTerrainLightmaps(),
              objects: _getObjectLightmaps(),
            };

            return Promise.resolve(chunk);
          }
        };
        const _requestChunkWithBlockfield = chunk => {
          if (chunk[blockfieldRenderedSymbol]) {
            return Promise.resolve(chunk);
          } else {
            vxl.blockfield(chunk.getBlockBuffer(), chunk[blockfieldSymbol]);
            chunk[blockfieldRenderedSymbol] = true;
            return Promise.resolve(chunk);
          }
        };
        const _requestChunk = (x, z) => _requestChunkHard(x, z)
          .then(chunk => _requestChunkWithLights(chunk))
          .then(chunk => _requestChunkWithLightmaps(chunk))
          .then(chunk => _requestChunkWithBlockfield(chunk));

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

        class Generator {
          getElevation(x, z) {
            return noiser.getElevation(x, z);
          }
          getBiome(x, z) {
            return noiser.getBiome(x, z);
          }
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

            const offset = geometriesOffset;
            geometriesOffset = protocolUtils.stringifyTemplate({
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
            }, geometriesBuffer.buffer, geometriesBuffer.byteOffset + geometriesOffset)[1];

            const index = geometriesIndex++;
            geometryTypes[index * 2 + 0] = murmur(name);
            geometryTypes[index * 2 + 1] = offset;
          }
          registerBlock(name, blockSpec) {
            const index = ++blockTypesIndex;
            // blockSpec.index = index;

            blockTypes[index] = murmur(name);

            transparentVoxels[index] = +blockSpec.transparent;
            translucentVoxels[index] = +blockSpec.translucent;
            for (let d = 0; d < 6; d++) {
              faceUvs.set(Float32Array.from(blockSpec.uvs[d]), index * 6 * 4 + d * 4);
            }
          }
          registerLight(name, v) {
            const index = ++lightsIndex;

            lights[index * 2 + 0] = murmur(name);
            lights[index * 2 + 1] = v;
          }
          setBlock(chunk, x, y, z, name) {
            const ox = Math.floor(x / NUM_CELLS);
            const oz = Math.floor(z / NUM_CELLS);
            if (ox === chunk.x && oz === chunk.z && y > 0 && y < NUM_CELLS_HEIGHT) {
              chunk.setBlock(x - ox * NUM_CELLS, y, z - oz * NUM_CELLS, murmur(name));
            }
          }
          clearBlock(chunk, x, y, z) {
            const ox = Math.floor(x / NUM_CELLS);
            const oz = Math.floor(z / NUM_CELLS);
            if (ox === chunk.x && oz === chunk.z && y > 0 && y < NUM_CELLS_HEIGHT) {
              chunk.clearBlock(x - ox * NUM_CELLS, y, z - oz * NUM_CELLS);
            }
          }
          getUv(name) {
            return textureUvs[murmur(name)];
          }
          getTileUv(name) {
            const uv = textureUvs[murmur(name)];

            const tileSizeU = uv[2] - uv[0];
            const tileSizeV = uv[3] - uv[1];

            const tileSizeIntU = Math.floor(tileSizeU * TEXTURE_SIZE) / 2;
            const tileSizeIntV = Math.floor(tileSizeV * TEXTURE_SIZE) / 2;

            const u = tileSizeIntU + uv[0];
            const v = tileSizeIntV + uv[1];

            return [-u, 1 - v, -u, 1 - v];
          }
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
          }
          registerGenerator(name, fn) {
            const n = murmur(name);
            const generator = [n, fn];
            generators.push(generator);

            if (zde.chunks.length > 0) {
              const promises = [];
              for (let i = 0; i < zde.chunks.length; i++) {
                const chunk = zde.chunks[i];
                if (_generateChunkObjectsWithGenerator(chunk, generator)) {
                  promises.push(
                    _decorateChunkObjectsGeometry(chunk)
                      .then(() => {
                        chunk.dirty = true;
                      })
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
          }
          addObject(chunk, name, position, rotation, value) {
            const n = murmur(name);
            const matrix = position.toArray().concat(rotation.toArray());
            const objectIndex = chunk.addObject(n, matrix, value);

            const light = _findLight(n);
            if (light) {
              chunk.addLightAt(objectIndex, position.x, position.y, position.z, light);
            }
          }
          requestLightmaps(x, z, positions) {
            return _requestChunkHard(x, z)
              .then(chunk => _requestChunkWithLights(chunk))
              .then(chunk => {
                const terrainBuffer = chunk.getTerrainBuffer();
                const {staticHeightfield} = protocolUtils.parseTerrainData(terrainBuffer.buffer, terrainBuffer.byteOffset);
                const {[lightsSymbol]: lights} = chunk;

                const numPositions = positions.length;
                const numLightmaps = numPositions / 3;
                const lightmapsBuffer = new ArrayBuffer(numLightmaps * 2);
                const skyLightmaps = new Uint8Array(lightmapsBuffer, 0, numLightmaps);
                const torchLightmaps = new Uint8Array(lightmapsBuffer, numLightmaps, numLightmaps);

                vxl.lightmap(chunk.x, chunk.z, positions, numPositions, staticHeightfield, lights, skyLightmaps, torchLightmaps);

                return {
                  skyLightmaps,
                  torchLightmaps,
                };
              });
          }
          requestRelight(x, y, z) {
            const promises = [];

            const seenIndex = {};
            for (let i = 0; i < DIRECTIONS.length; i++) {
              const [dx, dz] = DIRECTIONS[i];
              const ax = x + dx * (NUM_CELLS / 2);
              const az = z + dz * (NUM_CELLS / 2);
              const ox = Math.floor(ax / NUM_CELLS);
              const oz = Math.floor(az / NUM_CELLS);

              const index = _getChunkIndex(ox, oz);
              if (!seenIndex[index]) {
                const chunk = zde.getChunk(ox, oz);
                if (chunk && chunk[lightsRenderedSymbol]) {
                  promises.push(_decorateChunkLightsSub(chunk, x, y, z));
                }
                seenIndex[index] = true;
              }
            }

            return Promise.all(promises).then(() => {});
          }
        };
        const generatorElement = new Generator();
        elements.registerEntity(this, generatorElement);

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
        app.get('/archae/objects/texture-atlas.png', serveObjectsTextureAtlas);

        function serveObjectsObjectizeJs(req, res, next) {
          res.type('application/javascript');
          fs.createReadStream(path.join(vxlPath, 'bin', 'objectize.js')).pipe(res);
        }
        app.get('/archae/objects/objectize.js', serveObjectsObjectizeJs);
        function serveObjectsObjectizeWasm(req, res, next) {
          res.type('application/octret-stream');
          fs.createReadStream(path.join(vxlPath, 'bin', 'objectize.wasm')).pipe(res);
        }
        app.get('/archae/objects/objectize.wasm', serveObjectsObjectizeWasm);
        function serveObjectsTemplates(req, res, next) {
          res.write(new Buffer(geometriesBuffer.buffer, geometriesBuffer.byteOffset, geometriesBuffer.byteLength));
          res.write(new Buffer(geometryTypes.buffer, geometryTypes.byteOffset, geometryTypes.byteLength));
          res.write(new Buffer(blockTypes.buffer, blockTypes.byteOffset, blockTypes.byteLength));
          res.write(new Buffer(transparentVoxels.buffer, transparentVoxels.byteOffset, transparentVoxels.byteLength));
          res.write(new Buffer(translucentVoxels.buffer, translucentVoxels.byteOffset, translucentVoxels.byteLength));
          res.write(new Buffer(faceUvs.buffer, faceUvs.byteOffset, faceUvs.byteLength));
          res.write(new Buffer(lights.buffer, lights.byteOffset, lights.byteLength));
          res.end();
        }
        app.get('/archae/objects/geometry.bin', serveObjectsTemplates);

        function serveGeneratorChunks(req, res, next) {
          const {query: {x: xs, z: zs}} = req;
          const x = parseInt(xs, 10);
          const z = parseInt(zs, 10);

          if (!isNaN(x) && !isNaN(z)) {
            /* new Promise((accept, reject) => {
              let chunk = zde.getChunk(x, z);
              if (!chunk) {
                chunk = _generateChunk(zde.makeChunk(x, z));
                _saveChunks();
              }
              accept(chunk);
            })
              .then(chunk => !chunk[lightsRenderedSymbol] ? _decorateChunkLights(chunk) : Promise.resolve(chunk))
              .then(chunk => !chunk[lightmapsSymbol] ? _decorateChunkLightmaps(chunk) : Promise.resolve(chunk)) */
            _requestChunk(x, z)
              .then(chunk => {
                res.type('application/octet-stream');
                res.set('Texture-Atlas-Version', textureImg.version);
                res.set('Geometry-Version', geometriesBuffer.version);

                const terrainBuffer = chunk.getTerrainBuffer();
                res.write(new Buffer(terrainBuffer.buffer, terrainBuffer.byteOffset, terrainBuffer.byteLength));

                const objectBuffer = chunk.getObjectBuffer();
                res.write(new Buffer(objectBuffer.buffer, objectBuffer.byteOffset, objectBuffer.byteLength));

                const blockBuffer = chunk.getBlockBuffer();
                res.write(new Buffer(blockBuffer.buffer, blockBuffer.byteOffset, blockBuffer.byteLength));

                const lightBuffer = chunk.getLightBuffer();
                res.write(new Buffer(lightBuffer.buffer, lightBuffer.byteOffset, lightBuffer.byteLength));

                const geometryBuffer = chunk.getGeometryBuffer();
                res.write(new Buffer(geometryBuffer.buffer, geometryBuffer.byteOffset, geometryBuffer.byteLength));

                const [arrayBuffer, byteOffset] = protocolUtils.stringifyDecorations(chunk[lightmapsSymbol], chunk[blockfieldSymbol]);
                res.end(new Buffer(arrayBuffer, 0, byteOffset));
              })
              .catch(err => {
                console.warn(err);

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
        app.get('/archae/generator/chunks', serveGeneratorChunks);

        const connections = [];
        const _connection = c => {
          const {url} = c.upgradeReq;

          if (url === '/archae/generatorWs') {
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

              if (method === 'mutateVoxel') {
                const {id, args} = m;
                const {x, y, z, v} = args;

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
                    let chunk = zde.getChunk(ox, oz);
                    if (chunk) {
                      const oldTerrainBuffer = chunk.getTerrainBuffer();
                      const oldChunkData = protocolUtils.parseTerrainData(oldTerrainBuffer.buffer, oldTerrainBuffer.byteOffset);
                      const oldBiomes = oldChunkData.biomes.slice();
                      const oldElevations = oldChunkData.elevations.slice();
                      const oldEther = oldChunkData.ether.slice();
                      const oldWater = oldChunkData.water.slice();
                      const oldLava = oldChunkData.lava.slice();

                      regeneratePromises.push(
                        _generateChunkTerrain(chunk, {
                          oldBiomes,
                          oldElevations,
                          oldEther,
                          oldWater,
                          oldLava,
                          newEther,
                        })
                          .then(() => generatorElement.requestRelight(x, y, z))
                      );
                    }

                    seenIndex[index] = true;
                  }
                }
                _saveChunks();

                Promise.all(regeneratePromises)
                  .then(regeneratedChunks => {
                    c.send(JSON.stringify({
                      type: 'response',
                      id,
                      result: null,
                    }));

                    _broadcast({
                      type: 'mutateVoxel',
                      args,
                      result: {x, y, z, v},
                    });
                  });
              } else if (method === 'addObject') {
                const {id, args} = m;
                const {n, positions, rotations, value} = args;

                const ox = Math.floor(positions[0] / NUM_CELLS);
                const oz = Math.floor(positions[2] / NUM_CELLS);

                const chunk = zde.getChunk(ox, oz);
                if (chunk) {
                  const matrix = positions.concat(rotations).concat(zeroVectorArray);
                  const objectIndex = chunk.addObject(n, matrix, value);

                  _decorateChunkObjectsGeometry(chunk)
                    .then(() => {
                      _saveChunks();

                      return generatorElement.requestRelight(Math.floor(positions[0]), Math.floor(positions[1]), Math.floor(positions[2]));
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
                  chunk.removeLight(index);

                  _decorateChunkObjectsGeometry(chunk)
                    .then(() => {
                      _saveChunks();

                      return generatorElement.requestRelight(Math.floor(matrix[0]), Math.floor(matrix[1]), Math.floor(matrix[2]));
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
                  chunk[blockfieldRenderedSymbol] = false;

                  _decorateChunkObjectsGeometry(chunk)
                    .then(() => {
                      _saveChunks();

                      return generatorElement.requestRelight(x, y, z);
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
                  chunk[blockfieldRenderedSymbol] = false;

                  _decorateChunkObjectsGeometry(chunk)
                    .then(() => {
                      _saveChunks();

                      return generatorElement.requestRelight(x, y, z);
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

        this._cleanup = () => {
          function removeMiddlewares(route, i, routes) {
            if (
              route.handle.name === 'serveObjectsTextureAtlas' ||
              route.handle.name === 'serveObjectsObjectizeJs' ||
              route.handle.name === 'serveObjectsObjectizeWasm' ||
              route.handle.name === 'serveObjectsTemplates' ||
              route.handle.name === 'serveGeneratorChunks' ||
              route.handle.name === 'serveGeneratorVoxels'
            ) {
              routes.splice(i, 1);
            }
            if (route.route) {
              route.route.stack.forEach(removeMiddlewares);
            }
          }
          app._router.stack.forEach(removeMiddlewares);

          for (let i = 0; i < connections.length; i++) {
            connections[i].close();
          }
          wss.removeListener('connection', _connection);

          elements.unregisterEntity(this, generatorElement);
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

module.exports = Generator;

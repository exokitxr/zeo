const path = require('path');
const fs = require('fs');

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

const GENERATOR_PLUGIN = 'plugins-generator';

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

    const rng = new alea(DEFAULT_SEED);
    const noises = {};

    return elements.requestElement(GENERATOR_PLUGIN)
      .then(generatorElement => {
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
            getElevation(x, z) {
              return generatorElement.getElevation(x, z);
            },
            getBiome(x, z) {
              return generatorElement.getBiome(x, z);
            },
            /* getHeightfield(x, z) {
              return generatorElement.getHeightfield(x, z);
            },
            getBiomes(x, z) {
              return generatorElement.getBiomes(x, z);
            }, */
            registerGeometry(name, geometry) {
              generatorElement.registerGeometry(name, geometry);
            },
            registerBlock(name, blockSpec) {
              generatorElement.registerBlock(name, blockSpec);
            },
            registerLight(name, v) {
              generatorElement.registerLight(name, v);
            },
            setBlock(chunk, x, y, z, name) {
              generatorElement.setBlock(chunk, x, y, z, name);
            },
            clearBlock(chunk, x, y, z) {
              generatorElement.clearBlock(chunk, x, y, z);
            },
            getUv(name) {
              return generatorElement.getUv(name);
            },
            getTileUv(name) {
              return generatorElement.getTileUv(name);
            },
            registerTexture(name, img, {fourTap = false} = {}) {
              generatorElement.registerTexture(name, img, {fourTap});
            },
            registerGenerator(name, fn) {
              generatorElement.registerGenerator(name, fn);
            },
            addObject(chunk, name, position, rotation, value) {
              generatorElement.addObject(chunk, name, position, rotation, value);
            },
            addVegetation(chunk, name, position, rotation) {
              generatorElement.addVegetation(chunk, name, position, rotation);
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

            this._cleanup = () => {
              for (let i = 0; i < objectCleanups.length; i++) {
                const objectCleanup = objectCleanups[i];
                objectCleanup();
              }

              function removeMiddlewares(route, i, routes) {
                if (
                  route.handle.name === 'serveObjectsImg' ||
                  route.handle.name === 'serveObjectsSfx'
                ) {
                  routes.splice(i, 1);
                }
                if (route.route) {
                  route.route.stack.forEach(removeMiddlewares);
                }
              }
              app._router.stack.forEach(removeMiddlewares);
            };
          });
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Objects;

const path = require('path');
const fs = require('fs');

const murmurhashPath = require.resolve('murmurhash');
const aleaPath = require.resolve('alea-zeo');
const indevPath = require.resolve('indev');
const autowsPath = require.resolve('autows');
const jimp = require('jimp');

class Resource {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();
    const {dirname, installDirectory} = archae;

    const modsDirectory = path.join(dirname, installDirectory, 'plugins');

    const assetsMurmurhashStatic = express.static(path.dirname(murmurhashPath));
    function serveAssetsMurmurhash(req, res, next) {
      assetsMurmurhashStatic(req, res, next);
    }
    app.use('/archae/assets/', serveAssetsMurmurhash);

    const assetsAleaStatic = express.static(path.dirname(aleaPath));
    function serveAssetsAlea(req, res, next) {
      assetsAleaStatic(req, res, next);
    }
    app.use('/archae/assets/', serveAssetsAlea);

    const assetsIndevStatic = express.static(path.dirname(indevPath));
    function serveAssetsIndev(req, res, next) {
      assetsIndevStatic(req, res, next);
    }
    app.use('/archae/assets/', serveAssetsIndev);

    const assetsAutowsStatic = express.static(path.dirname(autowsPath));
    function serveAssetsAutows(req, res, next) {
      assetsAutowsStatic(req, res, next);
    }
    app.use('/archae/assets/', serveAssetsAutows);

    function serveResourceImg(req, res, next) {
      const modName = req.params.mod.toLowerCase().replace(/[^a-z0-9\-]/g, '');
      const itemIndex = parseInt(req.params.itemIndex, 10);

      const _requestImageData = () => new Promise((accept, reject) => {
        const modDirectory = path.join(modsDirectory, modName, 'node_modules', modName);

        fs.readFile(path.join(modDirectory, 'package.json'), 'utf8', (err, s) => {
          if (!err) {
            const mod = JSON.parse(s);

            if (mod && mod.metadata && mod.metadata.items && Array.isArray(mod.metadata.items) && mod.metadata.items.length > 0 && !isNaN(itemIndex)) {
              const itemSpec = mod.metadata.items[itemIndex];
              const {icon} = itemSpec;

              fs.readFile(path.join(modDirectory, icon), (err, data) => {
                if (!err) {
                  accept(data);
                } else {
                  reject(err);
                }
              });
            } else {
              accept(modImgData);
            }
          } else {
            reject(err);
          }
        });
      });
      _requestImageData()
        .then(buffer => {
          res.type('application/octet-stream');
          res.end(buffer);
        })
        .catch(err => {
          res.status(500);
          res.end(err.stack);
        });
    }
    app.get('/archae/resource/img/mods/:mod/:itemIndex', serveResourceImg);

    function serveResourceImgData(req, res, next) {
      const modName = req.params.mod.toLowerCase().replace(/[^a-z0-9\-]/g, '');
      const itemIndex = parseInt(req.params.itemIndex, 10);

      const _requestImageData = () => new Promise((accept, reject) => {
        const modDirectory = path.join(modsDirectory, modName, 'node_modules', modName);

        fs.readFile(path.join(modDirectory, modName, 'package.json'), 'utf8', (err, s) => {
          if (!err) {
            const mod = JSON.parse(s);

            if (mod && mod.metadata && mod.metadata.items && Array.isArray(mod.metadata.items) && mod.metadata.items.length > 0 && !isNaN(itemIndex)) {
              const itemSpec = mod.metadata.items[itemIndex];
              const {icon} = itemSpec;

              fs.readFile(path.join(modDirectory, icon), (err, data) => {
                if (!err) {
                  accept(data);
                } else {
                  reject(err);
                }
              });
            } else {
              accept(modImgData);
            }
          } else {
            reject(err);
          }
        });
      });
      _requestImageData()
        .then(buffer => {
          res.type('application/octet-stream');

          jimp.read(buffer, (err, img) => {
            res.end(img.bitmap.data);
          });
        })
        .catch(err => {
          res.status(500);
          res.end(err.stack);
        });
    }
    app.get('/archae/resource/imgData/mods/:mod/:itemIndex', serveResourceImgData);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (
          route.handle.name === 'serveAssetsHmd' ||
          route.handle.name === 'serveAssetsController' ||
          route.handle.name === 'serveAssetsImg' ||
          route.handle.name === 'serveAssetsSfx' ||
          route.handle.name === 'serveAssetsThree' ||
          route.handle.name === 'serveAssetsMurmurhash' ||
          route.handle.name === 'serveAssetsAlea' ||
          route.handle.name === 'serveAssetsIndev' ||
          route.handle.name === 'serveAssetsAutows' ||
          route.handle.name === 'serveResourceImg' ||
          route.handle.name === 'serveResourceImgData'
        ) {
          routes.splice(i, 1);
        }
        if (route.route) {
          route.route.stack.forEach(removeMiddlewares);
        }
      }
      app._router.stack.forEach(removeMiddlewares);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Resource;

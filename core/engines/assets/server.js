const path = require('path');

class Assets {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const controllerjsModelPath = path.join(path.dirname(require.resolve('controllerjs')), 'model');
    const imgPath = path.join(__dirname, 'lib', 'img');
    const sfxPath = path.join(__dirname, 'lib', 'sfx');

    const assetsHmdStatic = express.static(path.join(__dirname, 'lib', 'models', 'hmd'));
    function serveAssetsHmd(req, res, next) {
      assetsHmdStatic(req, res, next);
    }
    app.use('/archae/assets/models/hmd', serveAssetsHmd);
    const assetsControllerStatic = express.static(controllerjsModelPath);
    function serveAssetsController(req, res, next) {
      assetsControllerStatic(req, res, next);
    }
    app.use('/archae/assets/models/controller', serveAssetsController);
    const assetsImgStatic = express.static(imgPath);
    function serveAssetsImg(req, res, next) {
      assetsImgStatic(req, res, next);
    }
    app.use('/archae/assets/img', serveAssetsImg);
    const assetsSfxStatic = express.static(sfxPath);
    function serveAssetsSfx(req, res, next) {
      assetsSfxStatic(req, res, next);
    }
    app.use('/archae/assets/sfx', serveAssetsSfx);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (
          route.handle.name === 'serveAssetsHmd' ||
          route.handle.name === 'serveAssetsController' ||
          route.handle.name === 'serveAssetsImg' ||
          route.handle.name === 'serveAssetsSfx'
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

module.exports = Assets;

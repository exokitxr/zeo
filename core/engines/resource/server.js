const path = require('path');

const threePath = require.resolve('three-zeo');
const aleaPath = require.resolve('alea-zeo');
const indevPath = require.resolve('indev');

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

    const assetsThreeStatic = express.static(path.dirname(threePath));
    function serveAssetsThree(req, res, next) {
      assetsThreeStatic(req, res, next);
    }
    app.use('/archae/assets/', serveAssetsThree);

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

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (
          route.handle.name === 'serveAssetsHmd' ||
          route.handle.name === 'serveAssetsController' ||
          route.handle.name === 'serveAssetsImg' ||
          route.handle.name === 'serveAssetsSfx' ||
          route.handle.name === 'serveAssetsThree' ||
          route.handle.name === 'serveAssetsAlea' ||
          route.handle.name === 'serveAssetsIndev'
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

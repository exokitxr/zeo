const path = require('path');

class Mob {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const mobModelsStatic = express.static(path.join(__dirname, 'lib', 'models'));
    function serveMobModels(req, res, next) {
      mobModelsStatic(req, res, next);
    }
    app.use('/archae/mob/models', serveMobModels);
    const mobImgStatic = express.static(path.join(__dirname, 'lib', 'img'));
    function serveMobImg(req, res, next) {
      mobImgStatic(req, res, next);
    }
    app.use('/archae/mob/img', serveMobImg);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveMobModels' || route.handle.name === 'serveMobImg') {
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

module.exports = Mob;

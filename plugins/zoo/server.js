const path = require('path');

class Zoo {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const zooModelsStatic = express.static(path.join(__dirname, 'lib', 'models'));
    function serveZooModels(req, res, next) {
      zooModelsStatic(req, res, next);
    }
    app.use('/archae/zoo/models', serveZooModels);
    const zooImgStatic = express.static(path.join(__dirname, 'lib', 'img'));
    function serveZooImg(req, res, next) {
      zooImgStatic(req, res, next);
    }
    app.use('/archae/zoo/img', serveZooImg);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveZooModels' || route.handle.name === 'serveZooImg') {
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

module.exports = Zoo;

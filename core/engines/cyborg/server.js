const path = require('path');

class Cyborg {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const cyborgModelsStatic = express.static(path.join(__dirname, 'models'));
    function serveCyborgModels(req, res, next) {
      cyborgModelsStatic(req, res, next);
    }
    app.use('/archae/cyborg/models', serveCyborgModels);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveCyborgModels') {
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

module.exports = Cyborg;

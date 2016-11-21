const path = require('path');

class Controllers {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const controllerModelStatic = express.static(path.join(__dirname, 'models', 'controller'));
    function serveControllerModel(req, res, next) {
      controllerModelStatic(req, res, next);
    }
    app.use('/archae/models/controller', serveControllerModel);
    app.use('/archae/models/hmd', express.static(path.join(__dirname, 'models', 'hmd')));

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveControllerModel') {
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

module.exports = Controllers;

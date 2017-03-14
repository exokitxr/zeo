const path = require('path');

class Hmd {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const hmdModelStatic = express.static(path.join(__dirname, 'models', 'hmd'));
    function serveHmdModel(req, res, next) {
      hmdModelStatic(req, res, next);
    }
    app.use('/archae/models/hmd', serveHmdModel);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveHmdModel') {
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

module.exports = Hmd;

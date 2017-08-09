const path = require('path');

class Health {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const healthSfxStatic = express.static(path.join(__dirname, 'lib', 'sfx'));
    function serveHealthSfx(req, res, next) {
      healthSfxStatic(req, res, next);
    }
    app.use('/archae/health/sfx', serveHealthSfx);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveHealthSfx') {
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

module.exports = Health;

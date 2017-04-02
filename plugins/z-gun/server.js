const path = require('path');

class Draw {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const gunSfxStatic = express.static(path.join(__dirname, 'sfx'));
    function serveGunSfx(req, res, next) {
      gunSfxStatic(req, res, next);
    }
    app.use('/archae/gun/sfx', serveGunSfx);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveGunSfx') {
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

module.exports = Draw;

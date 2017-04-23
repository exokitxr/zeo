const path = require('path');

class SpPhysics {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const ammojsDirectoryPath = path.dirname(require.resolve('ammojs'));

    const spPhysicsLibStatic = express.static(ammojsDirectoryPath);
    function serveSpPhysicsLib(req, res, next) {
      spPhysicsLibStatic(req, res, next);
    }
    app.use('/archae/sp-physics', serveSpPhysicsLib);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveSpPhysicsLib') {
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

module.exports = SpPhysics;

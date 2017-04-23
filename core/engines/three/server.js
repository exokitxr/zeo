const path = require('path');

class Three {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const threeLibStatic = express.static(path.join(__dirname, 'lib'));
    function serveThreeLib(req, res, next) {
      threeLibStatic(req, res, next);
    }
    app.use('/archae/three', serveThreeLib);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveThreeLib') {
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

module.exports = Three;

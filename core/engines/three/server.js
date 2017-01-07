const path = require('path');

class Three {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const threeStatic = express.static(path.join(__dirname, 'node_modules', 'three', 'build', 'three.js'));
    function serveThreeStatic(req, res, next) {
      threeStatic(req, res, next);
    }
    app.use('/archae/three/three.js', serveThreeStatic);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveThreeStatic') {
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

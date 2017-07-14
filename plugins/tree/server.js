const path = require('path');

class Tree {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const treeSfxStatic = express.static(path.join(__dirname, 'lib', 'sfx'));
    function serveTreeSfx(req, res, next) {
      treeSfxStatic(req, res, next);
    }
    app.use('/archae/tree/sfx', serveTreeSfx);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveTreeSfx') {
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

module.exports = Tree;

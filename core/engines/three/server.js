const path = require('path');

const THREE = require('three-zeo');
const threePath = require.resolve('three-zeo');

class Three {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const threeLibStatic = express.static(path.dirname(threePath));
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

    return {
      THREE,
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Three;

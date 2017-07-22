const path = require('path');

const alea = require('alea-zeo');
const aleaPath = require.resolve('alea-zeo');

class RandomUtils {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const randomUtilsLibStatic = express.static(path.dirname(aleaPath));
    function serveRandomUtilsLib(req, res, next) {
      randomUtilsLibStatic(req, res, next);
    }
    app.use('/archae/random-utils', serveRandomUtilsLib);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveRandomUtilsLib') {
          routes.splice(i, 1);
        }
        if (route.route) {
          route.route.stack.forEach(removeMiddlewares);
        }
      }
      app._router.stack.forEach(removeMiddlewares);
    };

    return {
      alea,
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = RandomUtils;

const path = require('path');

class Map {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const mapImgStatic = express.static(path.join(__dirname, 'lib/img'));
    function serveMapImg(req, res, next) {
      mapImgStatic(req, res, next);
    }
    app.use('/archae/map/img', serveMapImg);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveMapImg') {
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

module.exports = Map;

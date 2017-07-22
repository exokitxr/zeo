const path = require('path');

class Raptor {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const oceanImgStatic = express.static(path.join(__dirname, 'lib', 'img'));
    function serveOceanImg(req, res, next) {
      oceanImgStatic(req, res, next);
    }
    app.use('/archae/ocean/img', serveOceanImg);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveOceanImg') {
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

module.exports = Raptor;

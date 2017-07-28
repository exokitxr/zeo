const path = require('path');

class Objects {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const objectsImgStatic = express.static(path.join(__dirname, 'lib', 'img'));
    function serveObjectsImg(req, res, next) {
      objectsImgStatic(req, res, next);
    }
    app.use('/archae/objects/img', serveObjectsImg);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveObjectsImg') {
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

module.exports = Objects;

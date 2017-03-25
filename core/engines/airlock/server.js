const path = require('path');

class Airlock {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const airlockImgStatic = express.static(path.join(__dirname, 'lib', 'img'));
    function serveAirlockImg(req, res, next) {
      airlockImgStatic(req, res, next);
    }
    app.use('/archae/airlock/img', serveAirlockImg);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveAirlockImg') {
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

module.exports = Airlock;

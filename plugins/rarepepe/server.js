const path = require('path');

class Rarepepe {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const rarepepeImgStatic = express.static(path.join(__dirname, 'lib/img'));
    function serveRarepepeImg(req, res, next) {
      rarepepeImgStatic(req, res, next);
    }
    app.use('/archae/rarepepe/img', serveRarepepeImg);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveRarepepeImg') {
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

module.exports = Rarepepe;

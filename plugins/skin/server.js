const path = require('path');

class Sprite {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const skinImgStatic = express.static(path.join(__dirname, 'lib', 'img'));
    function serveSkinImg(req, res, next) {
      skinImgStatic(req, res, next);
    }
    app.use('/archae/skin/img', serveSkinImg);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveSkinImg') {
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

module.exports = Sprite;

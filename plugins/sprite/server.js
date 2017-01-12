const path = require('path');

class Sprite {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const spritesStatic = express.static(path.join(__dirname, 'sprites'));
    function serveSprites(req, res, next) {
      spritesStatic(req, res, next);
    }
    app.use('/archae/sprites/sprites', serveSprites);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveSprites') {
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

const path = require('path');

class ZCake {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const audioStatic = express.static(path.join(__dirname, 'lib/audio'));
    function serveAudio(req, res, next) {
      audioStatic(req, res, next);
    }
    app.use('/archae/z-cake/audio', serveAudio);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveAudio') {
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

module.exports = ZCake;

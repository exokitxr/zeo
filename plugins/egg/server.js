const path = require('path');

class Egg {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const eggAudioStatic = express.static(path.join(__dirname, 'lib/audio'));
    function serveEggAudio(req, res, next) {
      eggAudioStatic(req, res, next);
    }
    app.use('/archae/egg/audio', serveEggAudio);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveEggAudio') {
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

module.exports = Egg;

const path = require('path');

class ZFighter {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const zFighterAudioStatic = express.static(path.join(__dirname, 'audio'));
    function serveZFighterAudio(req, res, next) {
      zFighterAudioStatic(req, res, next);
    }
    app.use('/archae/z-fighter/audio', serveZFighterAudio);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveZFighterAudio') {
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

module.exports = ZFighter;

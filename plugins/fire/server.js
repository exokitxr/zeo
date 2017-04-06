const path = require('path');

class Fire {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const fireAudioStatic = express.static(path.join(__dirname, 'lib/audio'));
    function serveFireAudio(req, res, next) {
      fireAudioStatic(req, res, next);
    }
    app.use('/archae/fire/audio', serveFireAudio);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveFireAudio') {
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

module.exports = Fire;

const path = require('path');

class Lightsaber {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const lightsaberAudioStatic = express.static(path.join(__dirname, 'audio'));
    function serveLightsaberAudio(req, res, next) {
      lightsaberAudioStatic(req, res, next);
    }
    app.use('/archae/lightsaber/audio', serveLightsaberAudio);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveLightsaberAudio') {
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

module.exports = Lightsaber;

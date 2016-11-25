// const path = require('path');

class WebVR {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    /* const {express, app} = archae.getCore();

    const webvrPolyfillStatic = express.static(path.join(__dirname, 'node_modules', 'webvr-polyfill', 'build'));
    function serveWebvrPolyfill(req, res, next) {
      webvrPolyfillStatic(req, res, next);
    }
    app.use('/archae/webvr-polyfill', serveWebvrPolyfill);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveWebvrPolyfill') {
          routes.splice(i, 1);
        }
        if (route.route) {
          route.route.stack.forEach(removeMiddlewares);
        }
      }
      app._router.stack.forEach(removeMiddlewares);
    }; */

    this._cleanup = () => {};
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = WebVR;

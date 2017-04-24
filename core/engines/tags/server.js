const path = require('path');

class Tags {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const libPolyfillsPath = path.join(__dirname, 'lib', 'polyfills');

    const tagsPolyfillsStatic = express.static(libPolyfillsPath);
    function serveTagsPolyfills(req, res, next) {
      tagsPolyfillsStatic(req, res, next);
    }
    app.use('/archae/tags/polyfills', serveTagsPolyfills);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveTagsPolyfills') {
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

module.exports = Tags;

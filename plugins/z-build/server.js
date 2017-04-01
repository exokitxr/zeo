const path = require('path');

class ZBuild {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const zBuildIconsStatic = express.static(path.join(__dirname, 'icons'));
    function serveZBuildIcons(req, res, next) {
      zBuildIconsStatic(req, res, next);
    }
    app.use('/archae/z-build/icons', serveZBuildIcons);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveZBuildIcons') {
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

module.exports = ZBuild;

const path = require('path');

class Tools {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const toolsImgStatic = express.static(path.join(__dirname, 'lib', 'img'));
    function serveToolsImg(req, res, next) {
      toolsImgStatic(req, res, next);
    }
    app.use('/archae/tools/img', serveToolsImg);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveToolsImg') {
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

module.exports = Tools;

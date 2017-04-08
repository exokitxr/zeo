const path = require('path');

class Skybox {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const skyboxImgStatic = express.static(path.join(__dirname, 'lib', 'img'));
    function serveSkyboxImg(req, res, next) {
      skyboxImgStatic(req, res, next);
    }
    app.use('/archae/skybox/img', serveSkyboxImg);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveSkyboxImg') {
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

module.exports = Skybox;

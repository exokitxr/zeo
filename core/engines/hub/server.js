const path = require('path');
const fs = require('fs');

class Home {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const homeImgStatic = express.static(path.join(__dirname, 'lib', 'img'));
    function serveHomeImg(req, res, next) {
      homeImgStatic(req, res, next);
    }
    app.use('/archae/home/img', serveHomeImg);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveHomeImg') {
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

module.exports = Home;

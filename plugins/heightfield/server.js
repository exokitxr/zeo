const path = require('path');

class Heightfield {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {dirname, dataDirectory} = archae;
    const {express, app} = archae.getCore();
    const {
      three: {THREE},
      elements,
      utils: {
        js: {mod},
        hash: {murmur},
        random: {alea, vxl},
      },
    } = zeo;

    const heightfieldImgStatic = express.static(path.join(__dirname, 'lib', 'img'));
    function serveHeightfieldImg(req, res, next) {
      heightfieldImgStatic(req, res, next);
    }
    app.use('/archae/heightfield/img', serveHeightfieldImg);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (
          route.handle.name === 'serveHeightfieldImg'
        ) {
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

module.exports = Heightfield;

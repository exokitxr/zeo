const path = require('path');
const fs = require('fs');

class Inventory {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app, dirname} = archae.getCore();

    const inventoryImgStatic = express.static(path.join(__dirname, 'lib', 'img'));
    function serveInventoryImg(req, res, next) {
      inventoryImgStatic(req, res, next);
    }
    app.use('/archae/inventory/img', serveInventoryImg);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (
          route.handle.name === 'serveInventoryImg'
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

module.exports = Inventory;

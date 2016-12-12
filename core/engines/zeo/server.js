const path = require('path');
const fs = require('fs');

class Zeo {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {app} = archae.getCore();

    function serveModsAll(req, res, next) {
      const pluginsPath = path.join(__dirname, '..', '..', '..', 'extra', 'plugins', 'zeo');

      fs.readdir(pluginsPath, (err, plugins) => {
        if (!err) {
          if (plugins.length > 0) {
            const result = [];
            let pending = plugins.length;
            function pend() {
              if (--pending === 0) {
                done();
              }
            }
            function done() {
              res.json(result);
            }

            plugins.forEach((plugin, i) => {
              fs.readFile(path.join(pluginsPath, plugin, 'package.json'), 'utf8', (err, s) => {
                if (!err) {
                  const j = JSON.parse(s);

                  result.push({
                    name: plugin,
                    version: j.version,
                    description: j.description || null,
                    hasClient: Boolean(j.client),
                    hasServer: Boolean(j.server),
                    hasWorker: Boolean(j.worker),
                    installed: Math.random() < 0.5, // XXX make this an actual installed check
                  });
                } else {
                  console.warn(err);
                }

                pend();
              });
            });
          } else {
            res.json([]);
          }
        } else {
          res.status(500);
          res.send(err.stack);
        }
      });
    }
    app.use('/archae/zeo/mods/status', serveModsAll);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveModsAll') {
          routes.splice(i, 1);
        }
        if (route.route) {
          route.route.stack.forEach(removeMiddlewares);
        }
      }
      app._router.stack.forEach(removeMiddlewares);
    };

    this._cleanup = () => {};
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Zeo;

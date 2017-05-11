const path = require('path');
const fs = require('fs');

const modulequery = require('modulequery');

class Rend {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {site: {url: siteUrl}}} = archae;
    const {app, dirname} = archae.getCore();

    let live = true;
    this.cleanup = () => {
      live = false;
    };

    const _readFile = (p, options) => new Promise((accept, reject) => {
      fs.readFile(p, options, (err, d) => {
        if (!err) {
          accept(d);
        } else {
          reject(err);
        }
      });
    });

    return _readFile(path.join(dirname, 'public', 'assets', 'data', 'whitelist.json'), 'utf8')
      .then(s => _jsonParse(s))
      .then(whitelistJson => {
        if (live) {
          const mq = modulequery({
            dirname: dirname,
            modulePath: path.join('/', 'plugins'),
          });
          const _isWhitelisted = (module, version) => (whitelistJson[module] || []).includes(version);

          function serveSearch(req, res, next) {
            const q = req.query.q ? decodeURIComponent(req.query.q) : '';
            const {i = ''} = req.query;
            const showInsecure = i === String(true);

            mq.search(q, {
              keywords: ['zeo-module'],
            })
              .then(modSpecs => {
                if (!showInsecure) {
                  modSpecs = modSpecs.filter(modSpec => _isWhitelisted(modSpec.name, modSpec.version));
                }

                res.json(modSpecs);
              })
              .catch(err => {
                res.status(500);
                res.send(err.stack);
              });
          }
          app.get('/archae/rend/search', serveSearch);
          function serveMods(req, res, next) {
            const q = req.query.q ? decodeURIComponent(req.query.q) : '';

            mq.getModule(q)
              .then(modSpec => {
                res.json(modSpec);
              })
              .catch(err => {
                res.status(500);
                res.send(err.stack);
              });
          }
          app.get('/archae/rend/mods', serveMods);

          this._cleanup = () => {
            function removeMiddlewares(route, i, routes) {
              if (
                route.handle.name === 'serveSearch' ||
                route.handle.name === 'serveMods'
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
      });
  }

  unmount() {
    this._cleanup();
  }
}

const _jsonParse = s => {
  let error = null;
  let result;
  try {
    result = JSON.parse(s);
  } catch (err) {
    error = err;
  }
  if (!error) {
    return result;
  } else {
    return undefined;
  }
};

module.exports = Rend;

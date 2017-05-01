const path = require('path');

const modulequery = require('modulequery');

class Rend {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {site: {url: siteUrl}}} = archae;
    const {app, dirname} = archae.getCore();

    const mq = modulequery({
      dirname: dirname,
      modulePath: path.join('/', 'plugins'),
    });
    function serveSearch(req, res, next) {
      res.set('Access-Control-Allow-Origin', '*'); // XXX this should be ported directly to the site lib

      const {q = ''} = req.query;

      mq.search(q, {
        keywords: ['zeo-module'],
      })
        .then(modSpecs => {
          res.json(modSpecs);
        })
        .catch(err => {
          res.status(500);
          res.send(err.stack);
        });
    }
    app.get('/archae/rend/search', serveSearch);
    function serveMods(req, res, next) {
      res.set('Access-Control-Allow-Origin', '*');

      const {q = ''} = req.query;

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

  unmount() {
    this._cleanup();
  }
}

module.exports = Rend;

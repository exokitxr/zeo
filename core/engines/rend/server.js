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
    const {express, app, dirname} = archae.getCore();

    const rendImgStatic = express.static(path.join(__dirname, 'lib', 'img'));
    function serveRendImg(req, res, next) {
      rendImgStatic(req, res, next);
    }
    app.use('/archae/rend/img', serveRendImg);

    const mq = modulequery({
      dirname: dirname,
      modulePath: path.join('/', 'plugins'),
    });
    function serveSearch(req, res, next) {
      const q = req.query.q ? decodeURIComponent(req.query.q) : '';

      mq.search(q, {
        keywords: ['zeo-mod'],
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
          route.handle.name === 'serveRendImg' ||
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

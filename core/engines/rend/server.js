const path = require('path');
const fs = require('fs');

const modulequery = require('modulequery');
const puppeteer = require('puppeteer');

class Rend {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app, dirname} = archae.getCore();

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return puppeteer.launch({
      args: [
        '--no-sandbox',
        '--no-zygote',
      ],
    })
      .then(browser => {
        if (live) {
          const rendImgStatic = express.static(path.join(__dirname, 'img'));
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
                res.status(err.statusCode || 500);
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
                res.status(err.statusCode || 500);
                res.send(err.stack);
              });
          }
          app.get('/archae/rend/mods', serveMods);

          this._cleanup = () => {
            browser.close();

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
        } else {
          browser.close();
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Rend;

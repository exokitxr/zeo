const path = require('path');
const https = require('https');

const modulequery = require('modulequery');
const puppeteer = require('puppeteer');

class Rend {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app, dirname} = archae.getCore();

    const _resJson = res => {
      if (res.status >= 200 && res.status < 300) {
        return res.json();
      } else if (res.status === 404) {
        return Promise.resolve(null);
      } else {
        return Promise.reject({
          status: res.status,
          stack: 'API returned invalid status code: ' + res.status,
        });
      }
    };

    let npmModSpecs = [];
    const _refreshNpmMods = () => new Promise((accept, reject) => {
      const proxyReq = https.get({
        host: 'my-site.zeovr.io',
        path: '/mods',
      }, proxyRes => {
        const bs = [];
        proxyRes.on('data', b => {
          bs.push(b);
        });
        proxyRes.on('end', () => {
          const b = Buffer.concat(bs);
          const s = b.toString('utf8');
          npmModSpecs = JSON.parse(s);
        });
        proxyRes.on('error', err => {
          reject(err);
        });
      });
      proxyReq.on('error', err => {
        reject(err);
      });
      proxyReq.end();
    });
    _refreshNpmMods()
      .catch(err => {
        console.warn(err);
      });
    const interval = setInterval(() => {
      _refreshNpmMods()
        .catch(err => {
          console.warn(err);
        });
    }, 2 * 60 * 1000);

    let live = true;
    this._cleanup = () => {
      live = false;

      clearInterval(interval);
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
            dirname,
            modulePath: path.join('/', 'plugins'),
            sources: ['local'],
          });
          const _requestAllMods = () => mq.search()
            .then(localModSpecs => {
              const index = {};
              for (let i = 0; i < localModSpecs.length; i++) {
                index[localModSpecs[i].name] = true;
              }

              const result = localModSpecs.slice();
              for (let i = 0; i < npmModSpecs.length; i++) {
                const npmModSpec = npmModSpecs[i];
                if (!index[npmModSpec.name]) {
                  result.push(npmModSpec);
                }
              }
              return result;
            });

          function serveSearch(req, res, next) {
            const q = (req.query.q ? decodeURIComponent(req.query.q) : '').toLowerCase();

            _requestAllMods()
              .then(modSpecs => {
                modSpecs = modSpecs.filter(modSpec => modSpec.name.toLowerCase().includes(q));
                res.json(modSpecs);
              })
              .catch(err => {
                res.status(err.statusCode || 500);
                res.send(err.stack);
              });
          }
          app.get('/archae/rend/search', serveSearch);
          function serveMods(req, res, next) {
            const q = (req.query.q ? decodeURIComponent(req.query.q) : '').toLowerCase();

            _requestAllMods()
              .then(modSpecs => {
                const modSpec = modSpecs.find(modSpec => modSpec.name.toLowerCase() === q);
                if (modSpec) {
                  res.json(modSpec);
                } else {
                  res.status(404);
                  res.end();
                }
              })
              .catch(err => {
                res.status(err.statusCode || 500);
                res.send(err.stack);
              });
          }
          app.get('/archae/rend/mods', serveMods);

          this._cleanup = () => {
            browser.close();

            clearInterval(interval);

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

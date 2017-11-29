const path = require('path');
const fs = require('fs');

const modulequery = require('modulequery');
const puppeteer = require('puppeteer');

const font = require('./font.js');

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
          function serveReadmeImg(req, res, next) {
            const {name, version} = req.query; // XXX respect version
            const width = parseInt(req.query.width, 10) || 640;
            const height = parseInt(req.query.height, 10) || 480;
            const devicePixelRatio = parseInt(req.query.devicePixelRatio, 10) || 1;

            mq.getModule(name)
              .then(modSpec => {
                browser.newPage()
                  .then(page => {
                    return page.setViewport({
                      width,
                      height,
                      deviceScaleFactor: devicePixelRatio,
                    })
                    .then(() => page.goto(
                      `data:text/html,\
                        <!doctype html>\
                        <html>\
                          <head>\
                            <style>
                              ${font}
                              body {
                                font-family: 'Open Sans';
                                line-height: 1.4;
                              }
                              a {
                                color: '2196F3';
                              }
                            </style>
                          </head>
                          <body>
                            ${modSpec.readme || '<h1>No readme</h1>'}
                          </body>
                        </html>`
                      ))
                      .then(() => page.screenshot({
                        type: 'png',
                        fullPage: true,
                      }))
                      .then(screenshot => {
                        res.type('image/png');
                        res.end(screenshot);

                        page.close();
                      })
                      .catch(err => {
                        res.status(500);
                        res.end();

                        page.close();
                      });
                  });
              })
              .catch(err => {
                res.status(err.statusCode || 500);
                res.send(err.stack);
              });
          }
          app.get('/archae/rend/readmeImg', serveReadmeImg);

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

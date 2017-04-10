const path = require('path');
const fs = require('fs');

const mkdirp = require('mkdirp');
const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();

const DEFAULT_CONFIG = {
  voiceChat: false,
  stats: false,
};

class Config {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {app, dirname, dataDirectory} = archae.getCore();

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const worldPath = path.join(dirname, dataDirectory, 'world');
    const worldConfigJsonPath = path.join(worldPath, 'config.json');

    const _requestFile = (p, defaultValue) => new Promise((accept, reject) => {
      fs.readFile(p, 'utf8', (err, s) => {
        if (!err) {
          const j = JSON.parse(s);
          accept(j);
        } else if (err.code === 'ENOENT') {
          const j = defaultValue;
          accept(j);
        } else {
          reject(err);
        }
      });
    });
    const _requestConfigJson = () => _requestFile(worldConfigJsonPath, DEFAULT_CONFIG);
    const _ensureWorldPath = () => new Promise((accept, reject) => {
      const worldPath = path.join(dirname, dataDirectory, 'world');

      mkdirp(worldPath, err => {
        if (!err) {
          accept();
        } else {
          reject(err);
        }
      });
    });

    return Promise.all([
      _requestConfigJson(),
      _ensureWorldPath(),
    ])
      .then(([
        configJson,
        ensureWorldPathResult,
      ]) => {
        if (live) {
          const _saveFile = (p, j) => new Promise((accept, reject) => {
            fs.writeFile(p, JSON.stringify(j, null, 2), 'utf8', err => {
              if (!err) {
                accept();
              } else {
                reject(err);
              }
            });
          });

          function serveConfigGet(req, res, next) {
            res.json(configJson);
          }
          app.get('/archae/config/config.json', serveConfigGet);
          function serveConfigSet(req, res, next) {
            bodyParserJson(req, res, () => {
              const {body: data} = req;

              const _respondInvalid = () => {
                res.status(400);
                res.send();
              };

              if (typeof data === 'object' && data !== null) {
                configJson = data;

                _saveFile(worldConfigJsonPath, configJson)
                  .then(() => {
                    res.send();
                  })
                  .catch(err => {
                    res.status(500);
                    res.send(err.stack);
                  });
              } else {
                _respondInvalid();
              }
            });
          }
          app.put('/archae/config/config.json', serveConfigSet);

          this._cleanup = () => {
            function removeMiddlewares(route, i, routes) {
              if (
                route.handle.name === 'serveConfigGet' ||
                route.handle.name === 'serveConfigSet'
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

module.exports = Config;

const path = require('path');
const fs = require('fs');
const url = require('url');

const mkdirp = require('mkdirp');
const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();
const zeoTerm = require('zeo-term')

const DEFAULT_SERVER_CONFIG = {
  name: 'VR Server',
  visibility: 'public',
  password: '',
  maxPlayers: 4,
};

class Config {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {app, wss, dirname, dataDirectory} = archae.getCore();

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
    const _requestConfigJson = () => _requestFile(worldConfigJsonPath, DEFAULT_SERVER_CONFIG);

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/world',
        '/core/engines/wallet',
        '/core/engines/multiplayer',
      ]),
      _requestConfigJson(),
    ])
      .then(([
        [
          world,
          wallet,
          multiplayer,
        ],
        configJson,
      ]) => {
        if (live) {
          const _saveFile = (p, j) => new Promise((accept, reject) => {
            mkdirp(path.dirname(p), err => {
              fs.writeFile(p, JSON.stringify(j, null, 2), 'utf8', err => {
                if (!err) {
                  accept();
                } else {
                  reject(err);
                }
              });
            });
          });

          function serveConfigGet(req, res, next) {
            res.type('application/json');
            res.end(JSON.stringify({
              tags: world.getTags(),
              items: wallet.getItems(),
              players: multiplayer.getPlayers(),
              config: configJson,
            }, null, 2));
          }
          app.get('/archae/config', serveConfigGet);

          function serveConfigJsonGet(req, res, next) {
            res.type('application/json');
            res.end(JSON.stringify(configJson, null, 2));
          }
          app.get('/archae/config/config.json', serveConfigJsonGet);
          function serveConfigJsonSet(req, res, next) {
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
          app.put('/archae/config/config.json', serveConfigJsonSet);

          function serveTerm(req, res, next) {
            zeoTerm.app(req, res, next);
          }
          app.use('/term', serveTerm);

          const _connection = (c, req) => {
            const parsedUrl = url.parse(req.url);
            if (parsedUrl.pathname === '/term') {
              zeoTerm.handleConnection(c);
            }
          };
          wss.on('connection', _connection);

          this._cleanup = () => {
            function removeMiddlewares(route, i, routes) {
              if (
                route.handle.name === 'serveConfigGet' ||
                route.handle.name === 'serveConfigJsonGet' ||
                route.handle.name === 'serveConfigJsonSet' ||
                route.handle.name === 'serveTerm'
              ) {
                routes.splice(i, 1);
              }
              if (route.route) {
                route.route.stack.forEach(removeMiddlewares);
              }
            }
            app._router.stack.forEach(removeMiddlewares);

            wss.removeListener('connection', _connection);
          };

          return {
            getConfig: () => configJson,
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Config;

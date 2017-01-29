const path = require('path');
const fs = require('fs');

const mkdirp = require('mkdirp');
const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();

const DEFAULT_TAGS = {
  elements: [],
  free: [],
};
const DEFAULT_CONFIG = {
  airlock: true,
  voiceChat: false,
  stats: false,
};

class World {
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

    const worldPath = path.join(dirname, 'data', 'world');
    const worldTagsJsonPath = path.join(worldPath, 'tags.json');
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
    const _requestTagsJson = () => _requestFile(worldTagsJsonPath, DEFAULT_TAGS);
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
      _requestTagsJson(),
      _requestConfigJson(),
      _ensureWorldPath(),
    ])
      .then(([
        tagsJson,
        configJson,
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

          function serveTagsGet(req, res, next) {
            res.json(tagsJson);
          }
          app.get('/archae/world/tags.json', serveTagsGet);
          function serveTagsSet(req, res, next) {
            bodyParserJson(req, res, () => {
              const {body: data} = req;

              const _respondInvalid = () => {
                res.status(400);
                res.send();
              };

              if (
                typeof data === 'object' && data !== null &&
                data.elements && Array.isArray(data.elements) &&
                data.free && Array.isArray(data.free)
              ) {
                tagsJson = {
                  elements: data.elements,
                  free: data.free,
                };

                _saveFile(worldTagsJsonPath, tagsJson)
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
          app.put('/archae/world/tags.json', serveTagsSet);
          function serveConfigGet(req, res, next) {
            res.json(configJson);
          }
          app.get('/archae/world/config.json', serveConfigGet);
          function serveConfigSet(req, res, next) {
            bodyParserJson(req, res, () => {
              const {body: data} = req;

              const _respondInvalid = () => {
                res.status(400);
                res.send();
              };

              if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
                configJson = {
                  elements: data.elements,
                  free: data.free,
                };

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
          app.put('/archae/world/config.json', serveConfigSet);

          this._cleanup = () => {
            function removeMiddlewares(route, i, routes) {
              if (
                route.handle.name === 'serveTagsGet' ||
                route.handle.name === 'serveTagsSet' ||
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

module.exports = World;

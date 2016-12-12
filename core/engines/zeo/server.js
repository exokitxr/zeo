const path = require('path');
const fs = require('fs');

const mkdirp = require('mkdirp');
const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();
const MultiMutex = require('multimutex');

class Zeo {
  constructor(archae) {
    this._archae = archae;

    this.worldModJsons = new Map();
    this.worldModMutex = new MultiMutex();
  }

  mount() {
    const {_archae: archae, worldModJsons, worldModMutex} = this;
    const {app} = archae.getCore();

    let live = false;
    this._cleanup = () => {
      live = false;
    };

    const worldModJsonsPath = path.join(__dirname, '..', '..', '..', 'data', 'worlds');
    const _ensureWorldsDirectory = () => new Promise((accept, reject) => {
      mkdirp(worldModJsonsPath, err => {
        if (!err) {
          accept();
        } else {
          reject(err);
        }
      });
    });

    return _ensureWorldsDirectory()
      .then(() => {
        if (live) {
        const _addWorldMod = ({world, mod}, cb) => {
          const key = world + ':' + mod;

          worldModMutex.lock(key)
            .then(unlock => {
              cb = (cb => err => {
                cb(err);

                unlock();
              })(cb);

              const _getWorldModJson = ({world}) => new Promise((accept, reject) => {
                const entry = worldModJsons.get(key);

                if (entry) {
                  accept(entry);
                } else {
                  const worldModJsonPath = path.join(worldModJsonsPath, world + '.json');
                  fs.readFile(worldModJsonPath, 'utf8', (err, s) => {
                    if (!err) {
                      const entry = JSON.parse(s);
                      worldModJsons.set(key, entry);
                      accept(entry);
                    } else if (err.code === 'ENOENT') {
                      const entry = {
                        mods: [],
                      };
                      worldModJsons.set(key, entry);
                      accept(entry);
                    } else {
                      reject(err);
                    }
                  });
                }
              });
              const _setWorldModJson = ({world, worldModJson}) => new Promise((accept, reject) => {
                const worldModJsonPath = path.join(worldModJsonsPath, world + '.json');
                fs.writeFile(worldModJsonPath, JSON.stringify(worldModJson, null, 2), 'utf8', err => {
                  if (!err) {
                    accept();
                  } else {
                    reject(err);
                  }
                });
              });

              _getWorldModJson({world})
                .then(worldModJson => {
                  const {mods} = worldModJson;
                  if (!mods.includes(mod)) {
                    mods.push(mod);
                  }
                  
                  _setWorldModJson({world, worldModJson})
                    .then(() => {
                      cb();
                    })
                    .catch(err => {
                      cb(err);
                    });
                })
                .catch(err => {
                  cb(err);
                });
            })
            .catch(err => {
              cb(err);
            });
        };

        function serveModsStatus(req, res, next) {
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
        app.use('/archae/zeo/mods/status', serveModsStatus);
        function serveModsAdd(req, res, next) {
          bodyParserJson(req, res, (req, res, next) => {
            const {body: data} = req;

            const _respondInvalid = () => {
              res.status(400);
              res.send();
            };

            if (typeof data === 'object' && data !== null) {
              const {world, mod} = data;

              if (typeof world === 'string' && typeof mod === 'string') {
                _addWorldMod({
                  world,
                  mod,
                }, err => {
                  if (!err) {
                    res.send();
                  } else {
                    res.status(500);
                    res.send(err.stack);
                  }
                });
              } else {
                _respondInvalid();
              }
            } else {
              _respondInvalid();
            }
          });
        }
        app.post('/archae/zeo/mods/add', serveModsAdd);

        this._cleanup = () => {
          function removeMiddlewares(route, i, routes) {
            if (route.handle.name === 'serveModsStatus' || route.handle.name === 'serveModsAdd') {
              routes.splice(i, 1);
            }
            if (route.route) {
              route.route.stack.forEach(removeMiddlewares);
            }
          }
          app._router.stack.forEach(removeMiddlewares);
        };
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Zeo;

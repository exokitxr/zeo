const path = require('path');
const fs = require('fs');

const mkdirp = require('mkdirp');
const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();
const showdown = require('showdown');
const showdownConverter = new showdown.Converter();
const MultiMutex = require('multimutex');

class Rend {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {app, dirname} = archae.getCore();

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const worldModsJsons = new Map();
    const worldElementsJsons = new Map();
    const worldModMutex = new MultiMutex();

    const worldsPath = path.join(dirname, 'data', 'worlds');

    const _getWorldModJson = ({world}) => new Promise((accept, reject) => {
      const entry = worldModsJsons.get(world);

      if (entry) {
        accept(entry);
      } else {
        const worldModsJsonPath = path.join(worldsPath, world, 'mods.json');

        fs.readFile(worldModsJsonPath, 'utf8', (err, s) => {
          if (!err) {
            const entry = JSON.parse(s);
            worldModsJsons.set(world, entry);
            accept(entry);
          } else if (err.code === 'ENOENT') {
            const entry = {
              mods: [],
            };
            worldModsJsons.set(world, entry);
            accept(entry);
          } else {
            reject(err);
          }
        });
      }
    });
    const _setWorldModsJson = ({world, worldModsJson}) => new Promise((accept, reject) => {
      worldModsJsons.set(world, worldModsJson);

      const worldPath = path.join(worldsPath, world);
      mkdirp(worldPath, err => {
        if (!err) {
          const worldModsJsonPath = path.join(worldPath, 'mods.json');

          fs.writeFile(worldModsJsonPath, JSON.stringify(worldModsJson, null, 2), 'utf8', err => {
            if (!err) {
              accept();
            } else {
              reject(err);
            }
          });
        } else {
          reject(err);
        }
      });
    });
    const _getWorldElementsJson = ({world}) => new Promise((accept, reject) => {
      const entry = worldElementsJsons.get(world);

      if (entry) {
        accept(entry);
      } else {
        const worldElementsJsonPath = path.join(worldsPath, world, 'elements.json');

        fs.readFile(worldElementsJsonPath, 'utf8', (err, s) => {
          if (!err) {
            const entry = JSON.parse(s);
            worldElementsJsons.set(world, entry);
            accept(entry);
          } else if (err.code === 'ENOENT') {
            const entry = {
              elements: [],
              clipboardElements: [],
            };
            worldElementsJsons.set(world, entry);
            accept(entry);
          } else {
            reject(err);
          }
        });
      }
    });
    const _setWorldElementsJson = ({world, worldElementsJson}) => new Promise((accept, reject) => {
      worldElementsJsons.set(world, worldElementsJson);

      const worldPath = path.join(worldsPath, world);
      mkdirp(worldPath, err => {
        if (!err) {
          const worldElementJsonPath = path.join(worldPath, 'elements.json');
          fs.writeFile(worldElementJsonPath, JSON.stringify(worldElementsJson, null, 2), 'utf8', err => {
            if (!err) {
              accept();
            } else {
              reject(err);
            }
          });
        } else {
          reject(err);
        }
      });
    });

    const _addWorldMod = ({world, mod}, cb) => {
      const key = world + ':' + mod;

      worldModMutex.lock(key)
        .then(unlock => {
          cb = (cb => err => {
            cb(err);

            unlock();
          })(cb);

          _getWorldModJson({world})
            .then(worldModsJson => {
              const {mods} = worldModsJson;
              if (!mods.includes(mod)) {
                mods.push(mod);
              }
              
              _setWorldModsJson({world, worldModsJson})
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
    const _removeWorldMod = ({world, mod}, cb) => {
      const key = world + ':' + mod;

      worldModMutex.lock(key)
        .then(unlock => {
          cb = (cb => err => {
            cb(err);

            unlock();
          })(cb);

          _getWorldModJson({world})
            .then(worldModsJson => {
              const {mods} = worldModsJson;
              const index = mods.indexOf(mod);
              if (index !== -1) {
                mods.splice(index, 1);
              }
              
              _setWorldModsJson({world, worldModsJson})
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

    function serveReadme(req, res, next) {
      fs.readFile(path.join(__dirname, '..', 'zeo', 'README.md'), 'utf8', (err, s) => {
        if (!err) {
          res.send(_renderMarkdown(s));
        } else if (err.code === 'ENOENT') {
          res.send('');
        } else {
          res.status(500);
          res.send(err.stack);
        }
      });
    }
    app.get('/archae/rend/readme', serveReadme);
    function serveModsStatus(req, res, next) {
      bodyParserJson(req, res, () => {
        const {body: data} = req;

        const _respondInvalid = () => {
          res.status(400);
          res.send();
        };

        if (typeof data === 'object' && data !== null) {
          const {world} = data;

          if (typeof world === 'string') {
            const pluginsPath = path.join(dirname, 'extra', 'plugins');
            const _getPlugins = () => new Promise((accept, reject) => {
              fs.readdir(pluginsPath, (err, plugins) => {
                if (!err) {
                  accept(plugins);
                } else {
                  reject(err);
                }
              });
            });
            const _getPluginPackageJson = ({plugin}) => new Promise((accept, reject) => {
              fs.readFile(path.join(pluginsPath, plugin, 'package.json'), 'utf8', (err, s) => {
                if (!err) {
                  const j = JSON.parse(s);
                  accept(j);
                } else {
                  reject(err);
                }
              });
            });
            const _getPluginReadmeMd = ({plugin}) => new Promise((accept, reject) => {
              const pluginPath = path.join(pluginsPath, plugin);
              fs.readdir(pluginPath, (err, files) => {
                if (!err) {
                  const readmeFiles = files.filter(f => /^README\.md$/i.test());

                  if (readmeFiles.length > 0) {
                    const readmeFilePath = readmeFiles.sort((a, b) => a.localeCompare(b))[0];

                    fs.readFile(path.join(pluginPath, readmeFilePath), 'utf8', (err, s) => {
                      if (!err) {
                        accept(_renderMarkdown(s));
                      } else {
                        reject(err);
                      }
                    });
                  } else {
                    accept('');
                  }
                } else if (err.code === 'ENOENT') {
                  accept('');
                } else {
                  reject(err);
                }
              });
            });

            Promise.all([
              _getWorldModJson({world}),
              _getPlugins()
            ])
              .then(([
                worldModsJson,
                plugins,
              ]) => {
                if (plugins.length > 0) {
                  const {mods} = worldModsJson;

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

                  for (let i = 0; i < plugins.length; i++) {
                    const plugin = plugins[i];

                    Promise.all([
                      _getPluginPackageJson({plugin}),
                      _getPluginReadmeMd({plugin}),
                    ])
                      .then(([
                        packageJson,
                        readmeMd,
                      ]) => {
                        result.push({
                          name: plugin,
                          version: packageJson.version,
                          description: packageJson.description || null,
                          hasClient: Boolean(packageJson.client),
                          hasServer: Boolean(packageJson.server),
                          hasWorker: Boolean(packageJson.worker),
                          installed: mods.includes(plugin),
                          reamde: readmeMd,
                        });

                        pend();
                      })
                      .catch(err => {
                        console.warn(err);

                        pend();
                      });
                  }
                } else {
                  res.json([]);
                }
              })
              .catch(err => {
                res.status(500);
                res.send(err.stack);
              });
          } else {
            _respondInvalid();
          }
        } else {
          _respondInvalid();
        }
      });
    }
    app.post('/archae/rend/mods/status', serveModsStatus);
    function serveModsAdd(req, res, next) {
      bodyParserJson(req, res, () => {
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
    app.post('/archae/rend/mods/add', serveModsAdd);
    function serveModsRemove(req, res, next) {
      bodyParserJson(req, res, () => {
        const {body: data} = req;

        const _respondInvalid = () => {
          res.status(400);
          res.send();
        };

        if (typeof data === 'object' && data !== null) {
          const {world, mod} = data;

          if (typeof world === 'string' && typeof mod === 'string') {
            _removeWorldMod({
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
    app.post('/archae/rend/mods/remove', serveModsRemove);
    function serveElementsGet(req, res, next) {
      const {world} = req.params;
      const worldElementsJsonPath = path.join(worldsPath, world, 'elements.json');

      _getWorldElementsJson({world})
        .then(worldElementsJson => {
          const {elements, clipboardElements} = worldElementsJson;

          res.json({
            elements,
            clipboardElements,
          });
        })
        .catch(err => {
          res.status(500);
          res.send(err.stack);
        });
    }
    app.get('/archae/rend/worlds/:world/elements.json', serveElementsGet);
    function serveElementsSet(req, res, next) {
      bodyParserJson(req, res, () => {
        const {body: data} = req;

        const _respondInvalid = () => {
          res.status(400);
          res.send();
        };

        if (
          typeof data === 'object' && data !== null &&
          data.elements && Array.isArray(data.elements) &&
          data.clipboardElements && Array.isArray(data.clipboardElements)
        ) {
          const {world} = req.params;
          const worldElementsJson = {
            elements: data.elements,
            clipboardElements: data.clipboardElements,
          };
          _setWorldElementsJson({world, worldElementsJson})
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
    app.put('/archae/rend/worlds/:world/elements.json', serveElementsSet);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (
          route.handle.name === 'serveReadme' ||
          route.handle.name === 'serveModsStatus' ||
          route.handle.name === 'serveModsAdd' ||
          route.handle.name === 'serveModsRemove' ||
          route.handle.name === 'serveElementsGet' ||
          route.handle.name === 'serveElementsSet'
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

const _renderMarkdown = s => showdownConverter
  .makeHtml(s)
  .replace(/&mdash;/g, '-')
  .replace(/(<code\s*[^>]*?>)([^>]*?)(<\/code>)/g, (all, start, mid, end) => start + mid.replace(/\n/g, '<br/>') + end)
  .replace(/\n+/g, ' ');

module.exports = Rend;

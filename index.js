const path = require('path');
const fs = require('fs-extra');
const child_process = require('child_process');

const express = require('express');
const ws = require('ws');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');

class ArchaeServer {
  constructor({server, app, wss} = {}) {
    server = server || http.createServer();
    app = app || express();
    wss = wss || new ws.Server({ server });

    this.server = server;
    this.app = app;
    this.wss = wss;

    this.connections = [];

    this.engines = {};
    this._engines = {};
    this.__engines = {};
    this.plugins = {};
    this._plugins = {};
    this.__plugins = {};
  }

  addEngine(engine, opts = {}) {
    return new Promise((accept, reject) => {
      const _remove = cb => {
        _removeModule(engine, 'engines', cb);
      };
      const _add = cb => {
        _addModule(engine, 'engines', (err, result) => {
          if (!err) {
            cb();

            const {added, moduleName: engineName} = result;
            if (added) {
              this.loadEngine(engineName, (err, result) => {
                if (!err) {
                  const {loadedClient, loadedServer} = result;
                  if (loadedClient) {
                    this.broadcastAddEngine(engineName);
                  }
                  if (loadedServer) {
                    this.mountEngine(engineName);
                  }
                } else {
                  console.warn(err);
                }
              });
            }
          } else {
            cb(err);
          }
        });
      };

      if (opts.force) {
        _remove(err => {
          if (!err) {
            _add(err => {
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
      } else {
        _add(err => {
          if (!err) {
            accept(err);
          } else {
            reject(err);
          }
        });
      }
    });
  }

  removeEngine(engine, opts = {}) {
    return new Promise((accept, reject) => {
      _removeModule(engine, 'engines', err => {
        if (!err) {
          accept();
        } else {
          reject(err);
        }
      });
    });
  }

  addPlugin(plugin, opts = {}) {
    return new Promise((accept, reject) => {
      const _remove = cb => {
        _removeModule(plugin, 'plugins', cb);
      };
      const _add = cb => {
        _addModule(plugin, 'plugins', (err, result) => {
          if (!err) {
            accept();

            const {added, moduleName: pluginName} = result;
            if (added) {
              this.loadPlugin(pluginName, (err, result) => {
                if (!err) {
                  const {loadedClient, loadedServer} = result;
                  if (loadedClient) {
                    this.broadcastAddPlugin(pluginName);
                  }
                  if (loadedServer) {
                    this.mountPlugin(pluginName);
                  }
                } else {
                  console.warn(err);
                }
              });
            }
          } else {
            reject(err);
          }
        });
      };

      if (opts.force) {
        _remove(err => {
          if (!err) {
            _add(err => {
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
      } else {
        _add(err => {
          if (!err) {
            accept();
          } else {
            reject(err);
          }
        });
      }
    });
  }

  removePlugin(plugin, opts = {}) {
    return new Promise((accept, reject) => {
      _removeModule(plugin, 'plugins', err => {
        if (!err) {
          accept();
        } else {
          reject(err);
        }
      });
    });
  }

  getClientModules(cb) {
    let engines = [];
    let plugins = [];

    let pending = 2;
    const pend = () => {
      if (--pending === 0) {
        cb(null, {
          engines: _sort(engines),
          plugins: _sort(plugins),
        });
      }
    };
    const _sort = modules => modules.map(m => m.replace(/\.js$/, '')).sort();

    fs.readdir(path.join(__dirname, 'engines', 'build'), (err, files) => {
      if (!err) {
        engines = engines.concat(files);
      }

      pend();
    });
    fs.readdir(path.join(__dirname, 'plugins', 'build'), (err, files) => {
      if (!err) {
        plugins = plugins.concat(files);
      }

      pend();
    });
  }

  getServerModules(cb) {
    let engines = [];
    let plugins = [];

    let pending = 2;
    const pend = () => {
      if (--pending === 0) {
        cb(null, {
          engines: _sort(engines),
          plugins: _sort(plugins),
        });
      }
    };
    const _sort = modules => modules.map(m => m.replace(/\.js$/, '')).sort();

    fs.readdir(path.join(__dirname, 'engines', 'node_modules'), (err, files) => {
      if (!err) {
        if (files.length > 0) {
          let pending = files.length;
          const pend2 = () => {
            if (--pending === 0) {
              pend();
            }
          };

          files.forEach(file => {
            const engine = file;

            fs.readFile(path.join(__dirname, 'engines', 'node_modules', engine, 'package.json'), 'utf8', (err, s) => {
              if (!err) {
                const j = JSON.parse(s);
                const serverFileName = j.server;
                if (serverFileName) {
                  engines.push(engine);
                }

                pend2();
              } else {
                console.warn(err);

                pend2();
              }
            });
          });
        } else {
          pend();
        }
      } else if (err.code === 'ENOENT') {
        pend();
      } else {
        console.warn(err);

        pend();
      }
    });
    fs.readdir(path.join(__dirname, 'plugins', 'build'), (err, files) => {
      if (!err) {
        if (files.length > 0) {
          let pending = files.length;
          const pend2 = () => {
            if (--pending === 0) {
              pend();
            }
          };

          files.forEach(file => {
            const plugin = file.replace(/\.js$/, '');

            fs.readFile(path.join(__dirname, 'plugins', 'node_modules', plugin, 'package.json'), 'utf8', (err, s) => {
              if (!err) {
                const j = JSON.parse(s);
                const serverFileName = j.server;
                if (serverFileName) {
                  plugins.push(plugin);
                }

                pend2();
              } else {
                console.warn(err);

                pend2();
              }
            });
          });
        } else {
          pend();
        }
      } else if (err.code === 'ENOENT') {
        pend();
      } else {
        console.warn(err);

        pend();
      }
    });
  }

  loadAll(cb) {
    this.getServerModules((err, modules) => {
      if (!err) {
        const missingEngines = modules.engines.filter(engine => !(engine in this.engines));
        this.loadEngines(missingEngines, err => {
          if (!err) {
            const missingPlugins = modules.plugins.filter(plugin => !(plugin in this.plugins));
            this.loadPlugins(missingPlugins, cb);
          } else {
            cb(err);
          }
        });
      } else {
        cb(err);
      }
    });
  }

  loadEngines(engines, cb) {
    const _loadAll = cb => {
      if (engines.length > 0) {
        let pending = engines.length;
        const pend = () => {
          if (--pending === 0) {
            cb();
          }
        };

        engines.forEach(engine => {
          this.loadEngine(engine, pend);
        });
      } else {
        cb();
      }
    };
    const _mountAll = () => {
      engines.forEach(engine => {
        this.mountEngine(engine);
      });
    };

    _loadAll(err => {
      if (!err) {
        _mountAll();

        cb();
      } else {
        cb(err);
      }
    });
  }

  loadEngine(engine, cb) {
    fs.readFile(path.join(__dirname, 'engines', 'node_modules', engine, 'package.json'), 'utf8', (err, s) => {
      if (!err) {
        const j = JSON.parse(s);
        const {client: clientFileName, server: serverFileName} = j;
        if (serverFileName) {
          const engineModule = require(path.join(__dirname, 'engines', 'node_modules', engine, serverFileName));

          this.engines[engine] = engineModule;
        }

        cb(null, {
          loadedClient: Boolean(clientFileName),
          loadedServer: Boolean(serverFileName),
        });
      } else {
        cb(err);
      }
    });
  }

  mountEngine(engine) {
    const engineModule = this.engines[engine];
    const engineInstance = engineModule({
      server: this.server,
      app: this.app,
      wss: this.wss,
    });
    this._engines[engine] = engineInstance;

    const engineApi = engineInstance.mount();
    this.__engines[engine] = engineApi;
  }

  broadcastAddEngine(engine) {
    this.broadcast({
      type: 'addEngine',
      engine: engine,
    });
  }

  loadPlugins(plugins, cb) {
    const _loadAll = cb => {
      if (plugins.length > 0) {
        let pending = plugins.length;
        const pend = () => {
          if (--pending === 0) {
            cb();
          }
        }

        plugins.forEach(plugin => {
          this.loadPlugin(plugin, pend);
        });
      } else {
        cb();
      }
    };
    const _mountAll = () => {
      plugins.forEach(plugin => {
        this.mountPlugin(plugin);
      });
    };

    _loadAll(err => {
      if (!err) {
        _mountAll();

        cb();
      } else {
        cb(err);
      }
    });
  }

  loadPlugin(plugin, cb) {
    fs.readFile(path.join(__dirname, 'plugins', 'node_modules', plugin, 'package.json'), 'utf8', (err, s) => {
      if (!err) {
        const j = JSON.parse(s);
        const {client: clientFileName, server: serverFileName} = j;
        if (serverFileName) {
          const pluginModule = require(path.join(__dirname, 'plugins', 'node_modules', plugin, serverFileName));

          this.plugins[plugin] = pluginModule;
        }

        cb(null, {
          loadedClient: Boolean(clientFileName),
          loadedServer: Boolean(serverFileName),
        });
      } else {
        cb(err);
      }
    });
  }

  mountPlugin(plugin) {
    const pluginModule = this.plugins[plugin];
    const pluginInstance = pluginModule({
      engines: this.__engines,
    });
    this._plugins = pluginInstance;

    const pluginApi = pluginInstance.mount();
    this.__plugins[plugin] = pluginApi;
  }

  broadcastAddPlugin(plugin) {
    this.broadcast({
      type: 'addPlugin',
      plugin: plugin,
    });
  }

  broadcast(message) {
    const messageString = JSON.stringify(message);

    for (let i = 0; i < this.connections.length; i++) {
      const connection = this.connections[i];
      connection.send(messageString);
    }
  }

  listen(cb) {
    const {server, app, wss} = this;

    const {_options: options} = this;

    this.loadAll(err => {
      if (!err) {
        app.use('/', express.static(path.join(__dirname, 'public')));
        app.use('/archae/modules.json', (req, res, next) => {
          this.getClientModules((err, modules) => {
            if (!err) {
              res.json(modules);
            } else {
              res.status(500);
              res.send(err.stack);
            }
          });
        });
        app.use('/archae/engines', express.static(path.join(__dirname, 'engines', 'build')));
        app.use('/archae/plugins', express.static(path.join(__dirname, 'plugins', 'build')));
        server.on('request', app);

        wss.on('connection', c => {
          const {url} = c.upgradeReq;
          if (url === '/archae/ws') {
            console.log('connection open');

            this.connections.push(c);

            c.on('message', s => {
              const m = JSON.parse(s);

              const cb = err => {
                console.warn(err);
              };

              if (typeof m === 'object' && m && typeof m.type === 'string' && typeof m.id === 'string') {
                const cb = (err = null, result = null) => {
                  if (c.readyState === ws.OPEN) {
                    const e = {
                      id: m.id,
                      error: err,
                      result: result,
                    };
                    const es = JSON.stringify(e);
                    c.send(es);
                  }
                };

                if (m.type === 'addEngine') {
                  const {engine} = m;

                  if (_isValidModule(engine)) {
                    this.addEngine(engine, cb);
                  } else {
                    cb('invalid engine spec');
                  }
                } else if (m.type === 'removePlugin') {
                  const {engine} = m;

                  if (_isValidModule(engine)) {
                    this.removeEngine(engine, cb);
                  } else {
                    cb('invalid engine spec');
                  }
                } else if (m.type === 'addPlugin') {
                  const {plugin} = m;

                  if (_isValidModule(plugin)) {
                    this.addPlugin(plugin, cb);
                  } else {
                    cb('invalid plugin spec');
                  }
                } else if (m.type === 'removePlugin') {
                  const {plugin} = m;

                  if (_isValidModule(plugin)) {
                    this.removePlugin(plugin, cb);
                  } else {
                    cb('invalid plugin spec');
                  }
                } else {
                  cb('invalid message type');
                }
              } else {
                cb('invalid message');
              }
            });
            c.on('close', () => {
              console.log('connection close');

              this.connections.splice(this.connections.indexOf(c), 1);
            });
          }
        });

        cb();
      } else {
        cb(err);
      }
    });
  }
}

const _addModule = (module, type, cb) => {
  const _downloadModule = (module, type, cb) => {
    if (path.isAbsolute(module)) {
      const modulePackageJsonPath = _getModulePackageJsonPath(module);
      fs.readFile(modulePackageJsonPath, 'utf8', (err, s) => {
        if (!err) {
          const j = JSON.parse(s);
          const moduleName = j.name;
          const modulePath = _getModulePath(moduleName, type);

          fs.exists(modulePath, exists => {
            if (exists) {
              _yarnInstall(moduleName, type, err => {
                if (!err) {
                  cb(null, j);
                } else {
                  cb(err);
                }
              });
            } else {
              const localModulePath = path.join(__dirname, module);
              fs.copy(localModulePath, modulePath, err => {
                if (!err) {
                  _yarnInstall(moduleName, type, err => {
                    if (!err) {
                      cb(null, j);
                    } else {
                      cb(err);
                    }
                  });
                } else {
                  cb(err);
                }
              });
            }
          });
        } else {
          cb(err);

          cleanup();
        }
      });  
    } else {
      _yarnAdd(module, type, err => {
        if (!err) {
          const modulePackageJsonPath = _getModulePackageJsonPath(module, type);
          fs.readFile(modulePackageJsonPath, 'utf8', (err, s) => {
            if (!err) {
              const j = JSON.parse(s);
              cb(null, j);
            } else {
              cb(err);
            }
          });
        } else {
          cb(err);
        }
      });
    }
  };
  const _yarnAdd = (module, type, cb) => {
    _queueYarn(cleanup => {
      const yarnAdd = child_process.spawn(
        'yarn',
        [ 'add', module ],
        {
          cwd: path.join(__dirname, type),
        }
      );
      yarnAdd.stdout.pipe(process.stdout);
      yarnAdd.stderr.pipe(process.stderr);
      yarnAdd.on('exit', code => {
        if (code === 0) {
          cb();
        } else {
          const err = new Error('yarn add error: ' + code);
          cb(err);
        }

        cleanup();
      });
    });
  };
  const _yarnInstall = (module, type, cb) => {
    _queueYarn(cleanup => {
      const modulePath = _getModulePath(module, type);
      const yarnInstall = child_process.spawn(
        'yarn',
        [ 'install' ],
        {
          cwd: modulePath,
        }
      );
      yarnInstall.stdout.pipe(process.stdout);
      yarnInstall.stderr.pipe(process.stderr);
      yarnInstall.on('exit', code => {
        if (code === 0) {
          cb();
        } else {
          const err = new Error('yard install error: ' + code);
          cb(err);
        }

        cleanup();
      });
    });
  };
  const _dumpPlugin = (module, type, cb) => {
    const {name, version = '0.0.1', dependencies = {}, client = 'client.js', server = 'server.js', files} = module;

    if (_isValidModuleSpec(module)) {
      const modulePath = _getModulePath(module.name, type);

      mkdirp(modulePath, err => {
        if (!err) {
          const packageJson = {
            name,
            version,
            dependencies,
            client,
            server,
          };
          const packageJsonString = JSON.stringify(packageJson, null, 2);

          fs.writeFile(path.join(modulePath, 'package.json'), packageJsonString, 'utf8', err => {
            if (!err) {
              _yarnInstall(module.name, type, err => {
                if (!err) {
                  if (_isValidFiles(files)) {
                    const fileNames = Object.keys(files);

                    if (fileNames.length > 0) {
                      let pending = fileNames.length;
                      const pend = () => {
                        if (--pending === 0) {
                          cb();
                        }
                      };

                      for (let i = 0; i < fileNames.length; i++) {
                        const fileName = fileNames[i];
                        const fileData = files[fileName];

                        fs.writeFile(path.join(modulePath, fileName), fileData, 'utf8', pend);
                      }
                    } else {
                      cb();
                    }
                  } else {
                    cb(err);
                  }
                } else {
                  cb();
                }
              });
            } else {
              cb(err);
            }
          });
        } else {
          cb(err);
        }
      });
    } else {
      const err = new Error('invalid module declaration');
      cb(err);
    }
  };
  const _buildModule = (module, type, cb) => {
    const moduleClientPath = _getModuleClientPath(module, type);
    const moduleBuildPath = _getModuleBuildPath(module, type);

    const webpack = child_process.spawn(
      path.join(__dirname, 'node_modules', 'webpack', 'bin', 'webpack.js'),
      [ moduleClientPath, moduleBuildPath ],
      {
        cwd: __dirname,
      }
    );
    webpack.stdout.pipe(process.stdout);
    webpack.stderr.pipe(process.stderr);
    webpack.on('exit', code => {
      if (code === 0) {
        cb();
      } else {
        const err = new Error('webpack error: ' + code);
        cb(err);
      }
    });
  };

  mkdirp(path.join(__dirname, type), err => {
    if (!err) {
      const _getModuleRealName = (module, cb) => {
        if (typeof module === 'string') {
          const packageJsonPath = _getModulePackageJsonPath(module, type);

          fs.readFile(packageJsonPath, 'utf8', (err, s) => {
            if (!err) {
              const j = JSON.parse(s);
              const moduleName = j.name;
              cb(null, moduleName);
            } else {
              cb(err);
            }
          });
        } else if (_isValidModuleSpec(module)) {
          cb(null, module.name);
        } else {
          cb(null, null);
        }
      };

      _getModuleRealName(module, (err, moduleName) => {
        if (!err) {
          const modulePath = _getModulePath(moduleName, type);

          fs.exists(modulePath, exists => {
            if (!exists) {
              if (typeof module === 'string') {
                _downloadModule(module, type, (err, packageJson) => {
                  if (!err) {
                    if (packageJson.client) {
                      _buildModule(packageJson, type, err => {
                        if (!err) {
                          cb(null, {
                            added: true,
                            moduleName,
                          });
                        } else {
                          cb(err);
                        }
                      });
                    } else {
                      cb(null, {
                        added: true,
                        moduleName,
                      });
                    }
                  } else {
                    cb(err);
                  }
                });
              } else if (typeof module === 'object') {
                const packageJson = module;

                _dumpPlugin(packageJson, type, err => {
                  if (!err) {
                    if (packageJson.client) {
                      _buildModule(packageJson, type, err => {
                        if (!err) {
                          cb(null, {
                            added: true,
                            moduleName,
                          });
                        } else {
                          cb(err);
                        }
                      });
                    } else {
                      cb(null, {
                        added: true,
                        moduleName,
                      });
                    }
                  } else {
                    cb(err);
                  }
                });
              } else {
                const err = new Error('invalid module format');
                cb(err);
              }
            } else {
              cb(null, {
                added: false,
              });
            }
          });
        } else {
          cb(err);
        }
      });
    } else {
      cb(err);
    }
  });
};

const _removeModule = (module, type, cb) => {
  if (typeof module === 'string') {
    const modulePath = _getModulePath(module, type); // XXX fix package json removal here

    rimraf(modulePath, err => {
      if (!err) {
        const moduleBuildPath = _getModuleBuildPath(module, type);

        rimraf(moduleBuildPath, cb);
      } else {
        cb(err);
      }
    });
  } else if (typeof module ==='object') {
    if (module && typeof module.name === 'string') {
      const moduleBuildPath = _getModuleBuildPath(module.name);

      rimraf(moduleBuildPath, cb);
    } else {
      const err = new Error('invalid module declaration');
      cb(err);
    }
  } else {
    const err = new Error('invalid module format');
    cb(err);
  }
};

const _queueYarn = (() => {
  let running = false;
  const queue = [];

  const _next = handler => {
    if (!running) {
      running = true;

      handler(() => {
        running = false;

        if (queue.length > 0) {
          _next(queue.pop());
        }
      });
    } else {
      queue.push(handler);
    }
  };

  return _next;
})();

const _getModuleName = module => {
  if (typeof module === 'string') {
    return module;
  } else if (_isValidModuleSpec(module)) {
    return module.name;
  } else {
    return null;
  }
};
const _getModulePath = (module, type) => path.join(__dirname, type, 'node_modules', _getModuleName(module));
const _getModulePackageJsonPath = (module, type) => {
  const moduleName = _getModuleName(module);

  if (path.isAbsolute(moduleName)) {
    return path.join(__dirname, moduleName, 'package.json');
  } else {
    return path.join(_getModulePath(moduleName, type), 'package.json');
  }
};
const _getModuleClientPath = (module, type) => {
  const modulePath = _getModulePath(module, type);

  if (typeof module === 'string') {
    return modulePath;
  } else if (_isValidModuleSpec(module)) {
    const clientFileName = module.client;
    return path.join(modulePath, clientFileName);
  } else {
    return null;
  }
};
const _getModuleBuildPath = (module, type) => path.join(__dirname, type, 'build', _getModuleName(module) + '.js');

const _isValidModule = module => typeof module === 'string' || _isValidModuleSpec(module);
const _isValidModuleSpec = module => {
  const {name, version = '', dependencies = {}, client = '', server = ''} = module;

  return typeof name === 'string' &&
    typeof version === 'string' &&
    typeof client === 'string' &&
    typeof server === 'string' &&
    _isValidDependencies(dependencies);
};
const _isValidDependencies = dependencies => {
  if (dependencies && typeof dependencies === 'object' && !Array.isArray(dependencies)) {
    for (const k in dependencies) {
      const v = dependencies[k];
      if (typeof v !== 'string') {
        return false;
      }
    }
    return true;
  } else {
    return false;
  }
};

const _isValidFiles = files => {
  if (files && typeof files === 'object' && !Array.isArray(files)) {
    for (const k in files) {
      const v = files[k];
      if (typeof v !== 'string') {
        return false;
      }
    }
    return true;
  } else {
    return false;
  }
};

const archae = (opts) => new ArchaeServer(opts);

module.exports = archae;

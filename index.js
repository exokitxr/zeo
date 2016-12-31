const path = require('path');
const fs = require('fs-extra');
const https = require('https');
const child_process = require('child_process');

const spdy = require('spdy');
const express = require('express');
const ws = require('ws');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const rollup = require('rollup');
const rollupPluginNodeResolve = require('rollup-plugin-node-resolve');
const rollupPluginCommonJs = require('rollup-plugin-commonjs');
const rollupPluginJson = require('rollup-plugin-json');
const cryptoutils = require('cryptoutils');
const MultiMutex = require('multimutex');
const fsHasher = require('fs-hasher');

const defaultConfig = {
  hostname: 'zeo.sh',
  port: 8000,
  dataDirectory: 'data',
};

const yarnBin = path.join(__dirname, 'node_modules', 'yarn', 'bin', 'yarn.js');

const nameSymbol = Symbol();

class ArchaeServer {
  constructor({server, app, wss} = {}) {
    server = server || _getServer();
    app = app || express();
    wss = wss || new ws.Server({
      noServer: true,
    });

    this.server = server;
    this.app = app;
    this.wss = wss;

    this.connections = [];

    this.engines = {};
    this.engineInstances = {};
    this.engineApis = {};
    this.plugins = {};
    this.pluginInstances = {};
    this.pluginApis = {};

    this.enginesMutex = new MultiMutex();
    this.pluginsMutex = new MultiMutex();

    this.mountApp();
  }

  requestEngine(engine, opts = {}) {
    return new Promise((accept, reject) => {
      const cb = (err, result) => {
        if (!err) {
          accept(result);
        } else {
          reject(err);
        }
      };

      _getModuleRealName(engine, 'engines', (err, engineName) => {
        if (!err) {
          const {enginesMutex} = this;

          enginesMutex.lock(engineName)
            .then(unlock => {
              const unlockCb = (cb => (err, result) => {
                cb(err, result);

                unlock();
              })(cb);
          
              const _remove = cb => {
                _removeModule(engineName, 'engines', cb);
              };
              const _add = cb => {
                _addModule(engine, 'engines', err => {
                  if (!err) {
                    const existingEngine = this.engines[engineName];
                    if (existingEngine !== undefined) {
                      const engineApi = this.engineApis[engineName];
                      cb(null, engineApi);
                    } else {
                      this.loadEngine(engineName, err => {
                        if (!err) {
                          this.mountEngine(engineName, err => {
                            if (!err) {
                              const engineApi = this.engineApis[engineName];
                              cb(null, engineApi);
                            } else {
                              cb(err);
                            }
                          });
                        } else {
                          cb(err);
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
                    _add(unlockCb);
                  } else {
                    unlockCb(err);
                  }
                });
              } else {
                _add(unlockCb);
              }
           })
           .catch(cb);
        } else {
          cb(err);
        }
      });
    });
  }

  requestEngines(engines, opts = {}) {
    const requestEnginePromises = engines.map(engine => this.requestEngine(engine, opts));
    return Promise.all(requestEnginePromises);
  }

  releaseEngine(engine) {
    return new Promise((accept, reject) => {
      const cb = (err, result) => {
        if (!err) {
          accept(result);
        } else {
          reject(err);
        }
      };

      _getModuleRealName(engine, 'engines', (err, engineName) => {
        this.enginesMutex.lock(engineName)
          .then(unlock => {
            const unlockCb = (cb => (err, result) => {
              cb(err, result);

              unlock();
            })(cb);

            this.unmountModule(engineName, this.engineInstances, this.engineApis, err => {
              if (!err) {
                this.unloadModule(engineName, this.engines);

                _removeModule(engineName, 'engines', () => {
                  if (!err) {
                    unlockCb(null, {
                      engineName,
                    });
                  } else {
                    unlockCb(err);
                  }
                });
              } else {
                unlockCb(err);
              }
            });
          })
          .catch(err => {
            unlockCb(err);
          });
      });
    });
  }

  releaseEngines(engines) {
    const releaseEnginePromises = engines.map(engine => this.releaseEngine(engine));
    return Promise.all(releaseEnginePromises);
  }

  requestPlugin(plugin, opts = {}) {
    return new Promise((accept, reject) => {
      const cb = (err, result) => {
        if (!err) {
          accept(result);
        } else {
          reject(err);
        }
      };

      _getModuleRealName(plugin, 'plugins', (err, pluginName) => {
        if (!err) {
          const {pluginsMutex} = this;

          pluginsMutex.lock(pluginName)
            .then(unlock => {
              const unlockCb = (cb => (err, result) => {
                cb(err, result);

                unlock();
              })(cb);
          
              const _remove = cb => {
                _removeModule(pluginName, 'plugins', cb);
              };
              const _add = cb => {
                _addModule(plugin, 'plugins', err => {
                  if (!err) {
                    const existingPlugin = this.plugins[pluginName];
                    if (existingPlugin !== undefined) {
                      const pluginApi = this.pluginApis[pluginName];
                      cb(null, pluginApi);
                    } else {
                      this.loadPlugin(pluginName, err => {
                        if (!err) {
                          this.mountPlugin(pluginName, err => {
                            if (!err) {
                              const pluginApi = this.pluginApis[pluginName];
                              cb(null, pluginApi);
                            } else {
                              cb(err);
                            }
                          });
                        } else {
                          cb(err);
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
                    _add(unlockCb);
                  } else {
                    unlockCb(err);
                  }
                });
              } else {
                _add(unlockCb);
              }
            })
            .catch(cb);
        } else {
          cb(err);
        }
      });
    });
  }

  requestPlugins(plugins, opts = {}) {
    const requestPluginPromises = plugins.map(plugin => this.requestPlugin(plugin, opts));
    return Promise.all(requestPluginPromises);
  }

  releasePlugin(plugin) {
    return new Promise((accept, reject) => {
      const cb = (err, result) => {
        if (!err) {
          accept(result);
        } else {
          reject(err);
        }
      };

      _getModuleRealName(plugin, 'plugins', (err, pluginName) => {
        this.pluginsMutex.lock(pluginName)
          .then(unlock => {
            const unlockCb = (cb => (err, result) => {
              cb(err, result);

              unlock();
            })(cb);

            this.unmountModule(pluginName, this.pluginInstances, this.pluginApis, err => {
              if (!err) {
                this.unloadModule(pluginName, this.plugins);

                _removeModule(pluginName, 'plugins', err => {
                  if (!err) {
                    unlockCb(null, {
                      pluginName,
                    });
                  } else {
                    unlockCb(err);
                  }
                });
              } else {
                unlockCb(err);
              }
            });
          })
          .catch(err => {
            cb(err);
          });
      });
    });
  }

  releasePlugins(plugins, opts = {}) {
    const releasePluginPromises = plugins.map(plugin => this.releasePlugin(plugin, opts));
    return Promise.all(releasePluginPromises);
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

    fs.readdir(path.join(__dirname, 'installed', 'engines', 'build'), (err, files) => {
      if (!err) {
        engines = engines.concat(files);
      }

      pend();
    });
    fs.readdir(path.join(__dirname, 'installed', 'plugins', 'build'), (err, files) => {
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

    fs.readdir(path.join(__dirname, 'installed', 'engines', 'node_modules'), (err, files) => {
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

            fs.readFile(path.join(__dirname, 'installed', 'engines', 'node_modules', engine, 'package.json'), 'utf8', (err, s) => {
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
  }

  loadEngine(engine, cb) {
    this.loadModule(engine, 'engines', 'server', this.engines, cb);
  }

  mountEngine(engine, cb) {
    this.mountModule(engine, this.engines, this.engineInstances, this.engineApis, cb);
  }

  loadPlugin(plugin, cb) {
    this.loadModule(plugin, 'plugins', 'server', this.plugins, cb);
  }

  mountPlugin(plugin, cb) {
    this.mountModule(plugin, this.plugins, this.pluginInstances, this.pluginApis, cb);
  }

  loadModule(module, type, packageJsonFileNameKey, exports, cb) {
    fs.readFile(path.join(__dirname, 'installed', type, 'node_modules', module, 'package.json'), 'utf8', (err, s) => {
      if (!err) {
        const j = JSON.parse(s);
        const fileName = j[packageJsonFileNameKey];
        if (fileName) {
          const moduleRequire = require(path.join(__dirname, 'installed', type, 'node_modules', module, fileName));

          exports[module] = moduleRequire;
        } else {
          exports[module] = null;
        }

        cb();
      } else {
        cb(err);
      }
    });
  }

  unloadModule(module, exports) {
    delete exports[module];
  }

  mountModule(module, exports, exportInstances, exportApis, cb) {
    const moduleRequire = exports[module];

    if (moduleRequire !== null) {
      Promise.resolve(_instantiate(moduleRequire, this))
        .then(moduleInstance => {
          exportInstances[module] = moduleInstance;

          Promise.resolve(moduleInstance.mount())
            .then(moduleApi => {
              if (typeof moduleApi !== 'object' || moduleApi === null) {
                moduleApi = {};
              }
              moduleApi[nameSymbol] = module;

              exportApis[module] = moduleApi;

              cb();
            })
            .catch(err => {
              cb(err);
            });
        })
        .catch(err => {

          cb(err);
        });
    } else {
      exportInstances[module] = {};
      exportApis[module] = {
        [nameSymbol]: module,
      };

      cb();
    }
  }

  unmountModule(module, exportInstances, exportApis, cb) {
    const moduleInstance = exportInstances[module];

    Promise.resolve(typeof moduleInstance.unmount === 'function' ? moduleInstance.unmount : null)
      .then(() => {
        delete exportInstances[module];
        delete exportApis[module];

        cb();
      })
      .catch(err => {
        cb(err);
      });
  }

  getCore() {
    return {
      express: express,
      dirname: __dirname,
      server: this.server,
      app: this.app,
      wss: this.wss,
    };
  }

  getName(moduleApi) {
    return moduleApi ? moduleApi[nameSymbol] : null;
  }

  mountApp() {
    const {server, app, wss} = this;

    // public
    app.use('/', express.static(path.join(__dirname, 'public')));

    // lists
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

    // bundles
    const bundleCache = {};
    app.get(/^\/archae\/(engines|plugins)\/([^\/]+?)\/([^\/]+?)(-worker)?\.js$/, (req, res, next) => {
      const {params} = req;
      const type = params[0];
      const module = params[1];
      const target = params[2];
      const worker = params[3];

      if (module === target) {
        const _respondOk = s => {
          res.type('application/javascript');
          res.send(s);
        };

        const entry = bundleCache[module];
        if (entry !== undefined) {
          _respondOk(entry);
        } else {
          rollup.rollup({
            entry: path.join(__dirname, 'installed', type, 'node_modules',  module, (!worker ? 'client' : 'worker') + '.js'),
            plugins: [
              rollupPluginNodeResolve({
                main: true,
                preferBuiltins: false,
              }),
              rollupPluginCommonJs(),
              rollupPluginJson(),
            ],
          }).then(bundle => {
            const result = bundle.generate({
              moduleName: module,
              format: 'cjs',
              useStrict: false,
            });
            const {code} = result;
            const wrappedCode = '(function() {\n' + code + '\n})();\n';

            bundleCache[module] = wrappedCode;

            _respondOk(wrappedCode);
          })
          .catch(err => {
            res.status(500);
            res.send(err.stack);
          });
        }
      } else {
        next();
      }
    });

    // mount on server
    server.on('request', app);

    const upgradeHandlers = [];
    server.addUpgradeHandler = upgradeHandler => {
      upgradeHandlers.push(upgradeHandler);
    };
    server.removeUpgradeHandler = upgradeHandler => {
      upgradeHandlers.splice(upgradeHandlers.indexOf(upgradeHandler), 1);
    };
    server.on('upgrade', (req, socket, head) => {
      let handled = false;
      for (let i = 0; i < upgradeHandlers.length; i++) {
        const upgradeHandler = upgradeHandlers[i];
        if (upgradeHandler(req, socket, head) === false) {
          handled = true;
          break;
        }
      }

      if (!handled) {
        wss.handleUpgrade(req, socket, head, c => {
          wss.emit('connection', c);
        });
      }
    });

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

          if (typeof m === 'object' && m && typeof m.method === 'string' && ('args' in m) && typeof m.id === 'string') {
            const cb = (err = null, result = null) => {
              if (c.readyState === ws.OPEN) {
                const e = {
                  id: m.id,
                  error: err ? (err.stack || err) : null,
                  result: result,
                };
                const es = JSON.stringify(e);
                c.send(es);
              }
            };

            const {method, args} = m;
            if (method === 'requestEngine') {
              const {engine} = args;

              if (_isValidModule(engine)) {
                this.requestEngine(engine)
                  .then(engineApi => {
                    const engineName = this.getName(engineApi);
                    cb(null, {
                      engineName,
                    });
                  })
                  .catch(err => {
                    cb(err);
                  });
              } else {
                const err = new Error('invalid engine spec');
                cb(err);
              }
            } else if (method === 'releaseEngine') {
              const {engine} = args;

              if (_isValidModule(engine)) {
                this.releaseEngine(engine)
                  .then(result => {
                    const {engineName} = result;

                    cb(null, {
                      engineName,
                    });
                  })
                  .catch(err => {
                    cb(err);
                  });
              } else {
                const err = new Error('invalid engine spec');
                cb(err);
              }
            } else if (method === 'requestPlugin') {
              const {plugin} = args;

              if (_isValidModule(plugin)) {
                this.requestPlugin(plugin)
                  .then(pluginApi => {
                    const pluginName = this.getName(pluginApi);
                    cb(null, {
                      pluginName,
                    });
                  })
                  .catch(err => {
                    cb(err);
                  });
              } else {
                const err = new Error('invalid plugin spec');
                cb(err);
              }
            } else if (method === 'releasePlugin') {
              const {plugin} = args;

              if (_isValidModule(plugin)) {
                this.releasePlugin(plugin)
                  .then(result => {
                    const {pluginName} = result;

                    cb(null, {
                      pluginName,
                    });
                  })
                  .catch(err => {
                    cb(err);
                  });
              } else {
                const err = new Error('invalid plugin spec');
                cb(err);
              }
            } else {
              const err = new Error('invalid message method: ' + JSON.stringify(method));
              cb(err);
            }
          } else {
            const err = new Error('invalid message');
            cb(err);
          }
        });
        c.on('close', () => {
          console.log('connection close');

          this.connections.splice(this.connections.indexOf(c), 1);
        });
      }
    });
  }
}

const moduleHashesMutex = new MultiMutex();
const MODULE_HASHES_MUTEX_KEY = 'key';
let modulesJson = null;
const validatedModules = {
  engines: {},
  plugins: {},
};
const _loadModulesJson = cb => {
  if (modulesJson !== null) {
    process.nextTick(() => {
      cb(null, modulesJson);
    });
  } else {
    moduleHashesMutex.lock(MODULE_HASHES_MUTEX_KEY)
      .then(unlock => {
        const unlockCb = (err, result) => {
          cb(err, result);

          unlock();
        };

        const modulesPath = path.join(__dirname, 'data', 'modules');
        const moduleHashesJsonPath = path.join(modulesPath, 'hashes.json');

        fs.readFile(moduleHashesJsonPath, 'utf8', (err, s) => {
          if (!err) {
            modulesJson = JSON.parse(s);

            unlockCb(null, modulesJson);
          } else if (err.code === 'ENOENT') {
            modulesJson = {
              engines: {},
              plugins: {},
            };

            unlockCb(null, modulesJson);
          } else {
            unlockCb(err);
          }
        });
      })
      .catch(err => {
        cb(err);
      });
  }
};
const _saveModulesJson = cb => {
  _loadModulesJson((err, modulesJson) => {
    if (!err) {
      moduleHashesMutex.lock(MODULE_HASHES_MUTEX_KEY)
        .then(unlock => {
          const unlockCb = (err, result) => {
            cb(err, result);

            unlock();
          };

          const modulesPath = path.join(__dirname, 'data', 'modules');

          mkdirp(modulesPath, err => {
            if (!err) {
              const moduleHashesJsonPath = path.join(modulesPath, 'hashes.json');

              fs.writeFile(moduleHashesJsonPath, JSON.stringify(modulesJson, null, 2), err => {
                if (!err) {
                  unlockCb();
                } else {
                  unlockCb(err);
                }
              });
            } else {
              unlockCb(err);
            }
          });
        })
        .catch(err => {
          cb(err);
        });
    } else {
      cb(err);
    }
  });
};
const _setModulesJson = (moduleName, type, hash, cb) => {
  _loadModulesJson((err, modulesJson) => {
    if (!err) {
      modulesJson[type][moduleName] = hash;

      _saveModulesJson(cb);
    } else {
      cb(err);
    }
  });
};
const _setValidatedModule = (moduleName, type, hash) => {
  validatedModules[type][moduleName] = hash;
};
const _requestInstalledModuleHash = (moduleName, type) => new Promise((accept, reject) => {
  _loadModulesJson((err, modulesJson) => {
    if (!err) {
      accept(modulesJson[type][moduleName] || null);
    } else {
      reject(err);
    }
  });
});
const _requestInstallCandidateModuleHash = module => new Promise((accept, reject) => { // XXX support object-formatted modules
  if (path.isAbsolute(module)) {
    const modulePath = _getLocalModulePath(module);

    const hasher = fsHasher.watch(modulePath, newHash => {
      accept(newHash);

      hasher.destroy();
    });
  } else {
throw new Error('npm not supported yet');

    https.get({
      hostname: 'api.npms.io',
      pathname: '/v2/package/' + moduleName,
    }, res => {
      const bs = [];
      res.on('data', d => {
        bs.push(b);
      });
      res.on('end', () => {
        const b = Buffer.concat(bs);
        const s = b.toString('utf8');
        const j = JSON.parse(s);
        const {collected: {metadata: {version}}} = j;
        accept(version);
      });
    }).on('error', err => {
      reject(err);
    });
  }
});
const _getModuleInstallStatus = (module, type, cb) => {
  _getModuleRealName(module, type, (err, moduleName) => {
    if (!err) {
      const validatedHash = validatedModules[type][moduleName] || null;

      if (validatedHash !== null) {
        const exists = true;
        const outdated = false;
        const installedHash = validatedHash;
        const candidateHash = validatedHash;

        cb(null, {exists, outdated, moduleName, installedHash, candidateHash});
      } else {
        Promise.all([
          _requestInstalledModuleHash(moduleName, type),
          _requestInstallCandidateModuleHash(module),
        ])
          .then(([
            installedHash,
            candidateHash,
          ]) => {
            const exists = installedHash !== null;
            const outdated = !exists || installedHash !== candidateHash;

            cb(null, {exists, outdated, moduleName, installedHash, candidateHash});
          })
          .catch(err => {
            cb(err);
          });
      }
    } else {
      cb(err);
    }
  });
};

const _addModule = (module, type, cb) => {
  const _downloadModule = (module, type, cb) => {
    if (path.isAbsolute(module)) {
      const modulePackageJsonPath = _getLocalModulePackageJsonPath(module);

      fs.readFile(modulePackageJsonPath, 'utf8', (err, s) => {
        if (!err) {
          const j = JSON.parse(s);
          const moduleName = j.name;
          const modulePath = _getInstalledModulePath(moduleName, type);

          fs.exists(modulePath, exists => {
            if (exists) {
              _yarnInstall(moduleName, type, err => {
                if (!err) {
                  cb();
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
                      cb();
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
      const moduleName = module;

      _yarnAdd(moduleName, type, err => {
        if (!err) {
          const modulePackageJsonPath = _getInstalledModulePackageJsonPath(moduleName, type);

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
        yarnBin,
        [ 'add', module ],
        {
          cwd: path.join(__dirname, 'installed', type),
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
  const _yarnInstall = (moduleName, type, cb) => {
    _queueYarn(cleanup => {
      const modulePath = _getInstalledModulePath(moduleName, type);

      const yarnInstall = child_process.spawn(
        yarnBin,
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
          const err = new Error('yarn install error: ' + code);
          cb(err);
        }

        cleanup();
      });
    });
  };
  const _dumpModule = (module, type, cb) => {
    const {name, version = '0.0.1', dependencies = {}, client = 'client.js', server = 'server.js', worker = 'worker.js', files} = module;

    if (_isValidModuleSpec(module)) {
      const modulePath = _getInstalledModulePath(module.name, type);

      mkdirp(modulePath, err => {
        if (!err) {
          const packageJson = {
            name,
            version,
            dependencies,
            client,
            server,
            worker,
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

  mkdirp(path.join(__dirname, 'installed', type), err => {
    if (!err) {
      _getModuleInstallStatus(module, type, (err, {exists, outdated, moduleName, installedHash, candidateHash}) => {
        if (!err) {
          const _doAdd = cb => {
            if (typeof module === 'string') {
              _downloadModule(module, type, cb);
            } else if (typeof module === 'object') {
              _dumpModule(module, type, cb);
            } else {
              const err = new Error('invalid module format');
              cb(err);
            }
          };
          const _doRemove = cb => {
            _removeModule(moduleName, type, cb);
          };
          const _doUpdateHash = cb => {
            _setModulesJson(moduleName, type, candidateHash, cb);
          };
          const _doValidateHash = () => {
            _setValidatedModule(moduleName, type, candidateHash);
          };

          if (!exists) {
            _doAdd(err => {
              if (!err) {
                _doUpdateHash(err => {
                  if (!err) {
                    _doValidateHash();

                    cb();
                  } else {
                    cb(err);
                  }
                });
              } else {
                cb(err);
              }
            });
          } else {
            if (outdated) {
              _doRemove(err => {
                if (!err) {
                  _doAdd(err => {
                    if (!err) {
                      _doUpdateHash(err => {
                        if (!err) {
                          _doValidateHash();

                          cb();
                        } else {
                          cb(err);
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
              _doValidateHash();

              cb();
            }
          }
        } else {
          cb(err);
        }
      });
    } else {
      cb(err);
    }
  });
};

const _getServer = () => {
  const certs = _loadCerts();

  const server = spdy.createServer({
    cert: certs.cert,
    key: certs.privateKey,
  });

  process.nextTick(() => {
    server.listen(defaultConfig.port);
  });

  return server;
};

const _loadCerts = () => {
  const _getOldCerts = () => {
    const _getFile = fileName => {
      try {
        return fs.readFileSync(path.join(__dirname, defaultConfig.dataDirectory, 'crypto', fileName), 'utf8');
      } catch(err) {
        if (err.code !== 'ENOENT') {
          console.warn(err);
        }
        return null;
      }
    };

    const privateKey = _getFile('private.pem');
    const cert = _getFile('cert.pem');
    if (privateKey && cert) {
      return {
        privateKey,
        cert,
      };
    } else {
      return null;
    }
  };

  const _getNewCerts = () => {
    const keys = cryptoutils.generateKeys();
    const publicKey = keys.publicKey;
    const privateKey = keys.privateKey;
    const cert = cryptoutils.generateCert(keys, {
      commonName: defaultConfig.hostname,
    });

    const cryptoDirectory = path.join(__dirname, defaultConfig.dataDirectory, 'crypto');
    const _makeCryptoDirectory = () => {
      mkdirp.sync(cryptoDirectory);
    };
    const _setFile = (fileName, fileData) => {
      fs.writeFileSync(path.join(cryptoDirectory, fileName), fileData);
    };

    _makeCryptoDirectory();
    _setFile('public.pem', publicKey);
    _setFile('private.pem', privateKey);
    _setFile('cert.pem', cert);

    return {
      privateKey,
      cert,
    };
  };

  return _getOldCerts() || _getNewCerts();
};

const _instantiate = (fn, arg) => _isConstructible(fn) ? new fn(arg) : fn(arg);
const _uninstantiate = api => (typeof api.unmount === 'function') ? api.unmount() : null;
const _isConstructible = fn => typeof fn === 'function' && /^(?:function|class)/.test(fn.toString());

const _removeModule = (module, type, cb) => {
  const modulePath = _getInstalledModulePath(module, type);

  rimraf(modulePath, cb);
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
const _getModuleRealName = (module, type, cb) => {
  if (typeof module === 'string') {
    if (path.isAbsolute(module)) {
      const packageJsonPath = _getLocalModulePackageJsonPath(module);

      fs.readFile(packageJsonPath, 'utf8', (err, s) => {
        if (!err) {
          const j = JSON.parse(s);
          const moduleName = j.name;
          cb(null, moduleName);
        } else {
          cb(err);
        }
      });
    } else {
      process.nextTick(() => {
        cb(null, module);
      });
    }
  } else if (_isValidModuleSpec(module)) {
    process.nextTick(() => {
      cb(null, module.name);
    });
  } else {
    process.nextTick(() => {
      const err = new Error('could not find module name: ' + JSON.stringify({module, type}, null, 2));
      cb(err);
    });
  }
};
const _getInstalledModulePath = (moduleName, type) => path.join(__dirname, 'installed', type, 'node_modules', _getModuleName(moduleName));
const _getLocalModulePath = module => path.join(__dirname, module);
const _getInstalledModulePackageJsonPath = (moduleName, type) => path.join(_getInstalledModulePath(moduleName, type), 'package.json');
const _getLocalModulePackageJsonPath = module => path.join(_getLocalModulePath(module), 'package.json');

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

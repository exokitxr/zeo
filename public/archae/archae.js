const env = (() => {
  const webworker = typeof window === 'undefined';
  const root = !webworker;

  return {
    root,
    webworker,
  };
})();
const global = (() => {
  if (env.root) {
    return window;
  } else if (env.webworker) {
    return self;
  } else {
    return null;
  }
})();

// begin inline

class MultiMutex {
  constructor() {
    this.mutexes = new Map();
  }

  lock(key, options) {
    let mutex = this.mutexes.get(key);
    if (!mutex) {
      mutex = new Mutex(key, this);
      this.mutexes.set(key, mutex);
    }

    return mutex.lock(options);
  }

  remove(key) {
    this.mutexes.delete(key);
  }
}

class Mutex {
  constructor(key, parent) {
    this._key = key;
    this._parent = parent;

    this.locked = false;
    this.queue = [];
  }

  lock(options = {}) {
    return new Promise((accept, reject) => {
      let timeout = options.timeout ? setTimeout(() => {
        this.queue.splice(this.queue.indexOf(_tryLock), 1);

        const err = new Error('mutex lock request timed out');
        reject(err);
      }, options.timeout) : null;

      const _tryLock = () => {
        if (!this.locked) {
          this.locked = true;

          if (timeout) {
            clearTimeout(timeout);
            timeout = null;
          }

          accept(() => {
            this.unlock();
          });
        } else {
          this.queue.push(_tryLock);
        }
      };
      _tryLock();
    });
  }

  unlock() {
    this.locked = false;

    const next = this.queue.pop();
    if (next) {
      next();
    } else {
      this._parent.remove(this._key);
    }
  }
}

// end inline

const nameSymbol = Symbol();

class ArchaeClient {
  constructor() {
    this.engines = {};
    this.engineInstances = {};
    this.engineApis = {};
    this.plugins = {};
    this.pluginInstances = {};
    this.pluginApis = {};

    this.moduleInstances = new Map();

    this.enginesMutex = new MultiMutex();
    this.pluginsMutex = new MultiMutex();
  }

  requestEngine(engine) {
    return new Promise((accept, reject) => {
      const id = _makeId();

      const cb = (err, result) => {
        if (!err) {
          accept(result);
        } else {
          reject(err);
        }
      };

      this.request('requestEngine', {
        engine,
      }, (err, result) => {
        if (!err) {
          const {engineName} = result;

          const {enginesMutex} = this;
          enginesMutex.lock(engineName)
            .then(unlock => {
              const unlockCb = (err, result) => {
                cb(err, result);

                unlock();
              };

              const existingEngine = this.engines[engineName];

              if (existingEngine !== undefined) {
                const engineApi = this.engineApis[engineName];
                unlockCb(null, engineApi);
              } else {
                this.loadEngine(engineName, err => {
                  if (!err) {
                    this.mountEngine(engineName, err => {
                      if (!err) {
                        const engineApi = this.engineApis[engineName];
                        unlockCb(null, engineApi);
                      } else {
                        unlockCb(err);
                      }
                    });
                  } else {
                    unlockCb(err);
                  }
                });
              }
          })
          .catch(cb);
        } else {
          cb(err);
        }
      });
    });
  }

  requestEngines(engines) {
    const requestEnginePromises = engines.map(engine => this.requestEngine(engine));
    return Promise.all(requestEnginePromises);
  }

  removeEngine(engine) {
    return new Promise((accept, reject) => {
      this.request('removeEngine', {
        engine,
      }, err => {
        if (!err) {
          accept();
        } else {
          reject(err);
        }
      });
    });
  }

  requestPlugin(plugin) {
    return new Promise((accept, reject) => {
      const cb = (err, result) => {
        if (!err) {
          accept(result);
        } else {
          reject(err);
        }
      };

      this.request('requestPlugin', {
        plugin,
      }, (err, result) => {
        if (!err) {
          const {pluginName} = result;

          const {pluginsMutex} = this;
          pluginsMutex.lock(pluginName)
            .then(unlock => {
              const unlockCb = (err, result) => {
                cb(err, result);

                unlock();
              };

              const existingPlugin = this.plugins[pluginName];

              if (existingPlugin !== undefined) {
                const pluginApi = this.pluginApis[pluginName];
                unlockCb(null, pluginApi);
              } else {
                this.loadPlugin(pluginName, err => {
                  if (!err) {
                    this.mountPlugin(pluginName, err => {
                      if (!err) {
                        const pluginApi = this.pluginApis[pluginName];
                        unlockCb(null, pluginApi);
                      } else {
                        unlockCb(err);
                      }
                    });
                  } else {
                    unlockCb(err);
                  }
                });
              }
          })
          .catch(cb);
        } else {
          cb(err);
        }
      });
    });
  }

  requestPlugins(plugins) {
    const requestPluginPromises = plugins.map(plugin => this.requestPlugin(plugin));
    return Promise.all(requestPluginPromises);
  }

  removePlugin(plugin) {
    return new Promise((accept, reject) => {
      this.request('removePlugin', {
        plugin,
      }, err => {
        if (!err) {
          accept();
        } else {
          reject(err);
        }
      });
    });
  }

  requestWorker(moduleInstance, options = {}) {
    return new Promise((accept, reject) => {
      const moduleInstanceSpec = this.moduleInstances.get(moduleInstance);

      if (moduleInstanceSpec) {
        const {type, name} = moduleInstanceSpec;
        const {count = 1} = options;

        const responseListeners = new Map();
        const onmessage = e => {
          const {onmessage: fakeWorkerOnMessage} = fakeWorker;

          if (fakeWorkerOnMessage) {
            fakeWorkerOnMessage(e);
          } else {
            const {data} = e;
            if (data && typeof data == 'object' && !Array.isArray(data)) {
              const {id} = data;

              if (typeof id === 'string') {
                const responseListener = responseListeners.get(id);

                if (responseListener) {
                  const {error, result} = data;
                  responseListener(error, result);

                  responseListeners.delete(id);
                }
              }
            }
          }
        };
        const onerror = err => {
          console.warn(err);
        };
        const workers = (() => {
          const result = [];
          for (let i = 0; i < count; i++) {
            const worker = new Worker('/archae/worker.js');
            worker.postMessage({
              method: 'init',
              args: [ type, name, name + '-worker' ],
            });
            worker.onmessage = onmessage;
            worker.onerror = onerror;
            result.push(worker);
          }
          return result;
        })();

        let workerIndex = 0;
        const _getNextWorker = () => {
          const worker = workers[workerIndex];
          workerIndex = (workerIndex + 1) % count;
          return worker;
        }

        const fakeWorker = {
          postMessage(m, transfers) {
            _getNextWorker().postMessage(m, transfers);
          },
          terminate() {
            for (let i = 0; i < count; i++) {
              const worker = workers[i];
              worker.terminate();
            }
          },
          onmessage: null,
          request(method, args = [], transfers) {
            return new Promise((accept, reject) => {
              const id = _makeId();

              _getNextWorker().postMessage({
                method,
                args,
                id,
              }, transfers);

              responseListeners.set(id, (err, result) => {
                if (!err) {
                  accept(result);
                } else {
                  reject(err);
                }
              });
            });
          },
        };
        accept(fakeWorker);
      } else {
        const err = new Error('no such module');
        reject(err);
      }

      this.request('removePlugin', {
        plugin,
      }, err => {
        if (!err) {
          accept();
        } else {
          reject(err);
        }
      });
    });
  }

  bootstrap() {
    this.connect();
  }

  loadModule(module, type, target, exports, cb) {
    if (!exports[module]) {
      _loadModuleScript('/archae/' + type + '/' + module + '/' + target + '.js')
        .then(m => {
          console.log('module loaded:', type + '/' + module);

          exports[module] = m;

          cb(null, {
            loaded: true,
          });
        })
        .catch(err => {
          cb(err);
        });
    } else {
      cb(null, {
        loaded: false,
      });
    }
  }

  loadEngine(engine, cb) {
    this.loadModule(engine, 'engines', engine, this.engines, cb);
  }

  mountEngine(engine, cb) {
    const engineModule = this.engines[engine];

    if (engineModule) {
      Promise.resolve(_instantiate(engineModule, this))
        .then(engineInstance => {
          this.engineInstances[engine] = engineInstance;
          this.moduleInstances.set(engineInstance, {
            type: 'engines',
            name: engine,
          });

          Promise.resolve(engineInstance.mount())
            .then(engineApi => {
              if (typeof engineApi !== 'object' || engineApi === null) {
                engineApi = {};
              }
              engineApi[nameSymbol] = engine;

              this.engineApis[engine] = engineApi;

              cb();
            })
            .catch(err => {
              this.engineApis[engine] = null;

              cb(err);
            });
        })
        .catch(err => {
          this.engineInstances[engine] = null;
          this.engineApis[engine] = null;

          cb(err);
        });
    } else {
      this.engineInstances[engine] = null;
      this.engineApis[engine] = {
        [nameSymbol]: engine,
      };

      cb();
    }
  }

  loadPlugin(plugin, cb) {
    this.loadModule(plugin, 'plugins', plugin, this.plugins, cb);
  }

  mountPlugin(plugin, cb) {
    const pluginModule = this.plugins[plugin];

    if (pluginModule) {
      Promise.resolve(_instantiate(pluginModule, this))
        .then(pluginInstance => {
          this.pluginInstances[plugin] = pluginInstance;
          this.moduleInstances.set(pluginInstance, {
            type: 'plugins',
            name: plugin,
          });

          Promise.resolve(pluginInstance.mount())
            .then(pluginApi => {
              if (typeof pluginApi !== 'object' || pluginApi === null) {
                pluginApi = {};
              }
              pluginApi[nameSymbol] = plugin;

              this.pluginApis[plugin] = pluginApi;

              cb();
            })
            .catch(err => {
              cb(err);
            });
        })
        .catch(err => {
          this.pluginInstances[plugin] = null;
          this.pluginApis[plugin] = null;

          cb(err);
        });
    } else {
      this.pluginInstances[plugin] = null;
      this.pluginApis[plugin] = {
        [nameSymbol]: plugin,
      };

      cb();
    }
  }

  getCore() {
    return {};
  }

  getName(moduleApi) {
    return moduleApi ? moduleApi[nameSymbol] : null;
  }

  connect() {
    const connection = (() => {
      const result = new WebSocket('wss://' + location.host + '/archae/ws');
      result.onopen = () => {
        console.log('on open');

        if (this._queue.length > 0) {
          for (let i = 0; i < this._queue.length; i++) {
            this.send(this._queue[i]);
          }
          this._queue = [];
        }
      };
      result.onerror = err => {
        console.warn(err);
      };
      result.onmessage = msg => {
        const m = JSON.parse(msg.data);

        for (let i = 0; i < this._listeners.length; i++) {
          const listener = this._listeners[i];
          listener(m);
        }
      };
      return result;
    })();

    this._connection = connection;
    this._queue = [];
    this._listeners = [];
  }

  request(method, args, cb) {
    const id = _makeId();

    this.send({
      method,
      args,
      id: id,
    });

    this.onceId(id, (err, result) => {
      if (!err) {
        cb(null, result);
      } else {
        cb(err);
      }
    });
  }

  send(o) {
    if (this._connection.readyState === 1) {
      this._connection.send(JSON.stringify(o));
    } else {
      this._queue.push(o);
    }
  }

  on(type, handler) {
    this._listeners.push(m => {
      if (m.type === type) {
        handler(m);
      }
    });
  }

  onceId(id, handler) {
    const listener = m => {
      if (m.id === id) {
        handler(m.error, m.result);

        this._listeners.splice(this._listeners.indexOf(listener), 1);
      }
    };
    this._listeners.push(listener);
  }
}

const _instantiate = (fn, arg) => _isConstructible(fn) ? new fn(arg) : fn(arg);
const _isConstructible = fn => typeof fn === 'function' && /^(?:function|class)/.test(fn.toString());

const _makeId = () => Math.random().toString(36).substring(7);

const _loadModuleScript = src => fetch(src)
  .then(res => res.text()
    .then(s => _asyncEval(s))
  );
const _asyncEval = s => new Promise((accept, reject) => {
  let error = null;
  let result;
  try {
    result = eval(s);
  } catch(err) {
    error = err;
  }

  if (!error) {
    accept(result);
  } else {
    reject(error);
  }
});

const archae = new ArchaeClient();
archae.bootstrap();

global.archae = archae;

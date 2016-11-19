class ArchaeClient {
  constructor() {
    this.engines = {};
    this.engineInstances = {};
    this.engineApis = {};
    this.plugins = {};
    this.pluginInstances = {};
    this.pluginApis = {};
  }

  requestEngine(engine) {
    const id = _makeId();

    this.send({
      type: 'requestEngine',
      id: id,
      engine: engine,
    });

    return this.waitForId(id);
  }

  removeEngine(engine) {
    const id = _makeId();

    this.send({
      type: 'removeEngine',
      id: id,
      engine: engine,
    });

    return this.waitForId(id);
  }

  requestPlugin(plugin) {
    const id = _makeId();

    this.send({
      type: 'requestPlugin',
      id: id,
      plugin: plugin,
    });

    return this.waitForId(id);
  }

  removePlugin(plugin) {
    const id = _makeId();

    this.send({
      type: 'removePlugin',
      id: id,
      plugin: plugin,
    });

    return this.waitForId(id);
  }

  waitForId(id) {
    return new Promise((accept, reject) => {
      this.onceId(id, (err, result) => {
        if (!err) {
          accept();
        } else {
          reject(err);
        }
      });
    });
  }

  bootstrap() {
    this.mountAll();
    this.connect();
    this.listen();
  }

  loadModules(modules, cb) {
    const {engines, plugins} = modules;

    if ((engines.length + plugins.length) > 0) {
      let pending = engines.length + plugins.length;
      const pend = () => {
        if (--pending === 0) {
          console.log('all modules loaded');

          cb();
        }
      };
      const loaded = err => {
        if (err) {
          console.warn(err);
        }

        pend();
      };

      const _load = (modules, type, exports, cb) => {
        modules.forEach(module => {
          this.loadModule(module, type, exports, cb);
        });
      };

      _load(engines, 'engines', this.engines, loaded);
      _load(plugins, 'plugins', this.plugins, loaded);
    } else {
      cb();
    }
  }

  loadModule(module, type, exports, cb) {
    if (!exports[module]) {
      window.module = {};

      const script = document.createElement('script');
      script.src = '/archae/' + type + '/' + module + '.js';
      script.async = true;
      script.onload = () => {
        console.log('module loaded:', type + '/' + module);

        exports[module] = window.module.exports;
        window.module = {};

        cb(null, {
          loaded: true,
        });
        cleanup();
      };
      script.onerror = err => {
        cb(err);
        cleanup();
      };

      document.body.appendChild(script);
      const cleanup = () => {
        document.body.removeChild(script);
      };
    } else {
      cb(null, {
        loaded: false,
      });
    }
  }

  loadEngine(engine, cb) {
    this.loadModule(engine, 'engines', this.engines, cb);
  }

  loadPlugin(plugin, cb) {
    this.loadModule(plugin, 'plugins', this.plugins, cb);
  }

  mountEngines(engines) {
    engines.forEach(engine => {
      this.mountEngine(engine);
    });
  }

  mountEngine(engine) {
    const engineModule = this.engines[engine];

    const engineInstance = engineModule();
    this.engineInstances[engine] = engineInstance;

    const engineApi = engineInstance.mount();
    this.engineApis[engine] = engineApi;
  }

  mountPlugins(plugins) {
    plugins.forEach(plugin => {
      this.mountPlugin(plugin);
    });
  }

  mountPlugin(plugin) {
    const pluginModule = this.plugins[plugin];

    const pluginInstance = pluginModule({
      engines: this.engineApis,
    });
    this.pluginInstances[plugin] = pluginInstance;

    const pluginApi = pluginInstance.mount();
    this.pluginApis[plugin] = pluginApi;
  }

  mountAll() {
    fetch('/archae/modules.json')
      .then(res => {
        res.json()
          .then(modules => {
            this.loadModules(modules, err => {
              if (err) {
                console.warn(err);
              }

              this.mountEngines(modules.engines);
              this.mountPlugins(modules.plugins);

              console.log('done mounting');
            });
          })
          .catch(err => {
            console.warn(err);
          });
      })
      .catch(err => {
        console.warn(err);
      });
  }

  connect() {
    const connection = (() => {
      const result = new WebSocket('ws://' + location.host + '/archae/ws');
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

        console.log('on messsage', m);

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

  listen() {
    this.on('requestEngine', ({engine}) => {
      this.loadEngine(engine, (err, result) => {
        if (!err) {
          const {loaded} = result;
          if (loaded) {
            this.mountEngine(engine);
          }
        } else {
          console.warn(err);
        }
      });
    });
    this.on('requestPlugin', ({plugin}) => {
      this.loadPlugin(plugin, (err, result) => {
        if (!err) {
          const {loaded} = result;
          if (loaded) {
            this.mountPlugin(plugin);
          }
        } else {
          console.warn(err);
        }
      });
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

const _makeId = () => Math.random().toString(36).substring(7);

const archae = new ArchaeClient();
archae.bootstrap();

window.archae = archae;

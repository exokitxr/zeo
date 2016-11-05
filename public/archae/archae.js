class ArchaeClient {
  constructor() {
    // XXX
  }

  addPlugin(plugin, cb) {
    const id = _makeId();

    this.send({
      type: 'addPlugin',
      id: id,
      plugin: plugin,
    });

    this.on(id, (err, result) => {
      console.log('got result', {err, result});
    });

    cb();
  }

  removePlugin(plugin, cb) {
    this.send({
      type: 'removePlugin',
      plugin: _stringifyPlugin(plugin),
    });

    cb();
  }

  bootstrap() {
    this.mountAll();
    this.connect();
  }

  loadModules(modules, cb) {
    window.module = {};
    this.engines = {};
    this.plugins = {};

    const {engines, plugins} = modules;

    if ((engines.length + plugins.length) > 0) {
      let pending = engines.length + plugins.length;
      const pend = () => {
        if (--pending === 0) {
          console.log('all modules loaded');

          cb();
        }
      };
      const _load = (modules, type, exports, cb) => {
        modules.forEach(module => {
          const script = document.createElement('script');
          script.src = '/archae/' + type + '/' + module + '.js';
          script.async = true;
          script.onload = () => {
            console.log('module loaded:', type + '/' + module);

            exports[module] = window.module.exports;
            window.module = {};

            cb();
            cleanup();
          };
          script.onerror = err => {
            console.warn(err);

            cb();
            cleanup();
          };

          document.body.appendChild(script);
          const cleanup = () => {
            document.body.removeChild(script);
          };
        });
      };

      _load(engines, 'engines', this.engines, pend);
      _load(plugins, 'plugins', this.plugins, pend);
    } else {
      cb();
    }
  }

  mountEngines(engines, cb) {
    this._engines = {};

    const engineMountPromises = engines.map(engine => {
      const engineModule = this.engines[engine];

      const engineInstance = {};
      this._engines[engine] = engineInstance;

      return engineModule.mount.call(engineInstance);
    });

    Promise.all(engineMountPromises)
      .then(() => {
        cb();
      })
     .catch(cb);
  }

  mountPlugins(plugins, cb) {
    this._plugins = {};

    const pluginOptions = {
      engines: this._engines,
    };

    const pluginMountPromises = plugins.map(plugin => {
      const pluginModule = this.plugins[plugin];

      const pluginInstance = pluginModule(pluginOptions);
      this._plugins[plugin] = pluginInstance;

      return pluginInstance.mount();
    });

    Promise.all(pluginMountPromises)
      .then(() => {
        cb();
      })
     .catch(cb);
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

              this.mountEngines(modules.engines, err => {
                if (err) {
                  console.warn(err);
                }

                this.mountPlugins(modules.plugins, err => {
                  if (err) {
                    console.warn(err);
                  }

                  console.log('done mounting');
                });
              });
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
      const result = new WebSocket('ws://' + window.location.host + '/archae/ws');
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

  send(o) {
    if (this._connection.readyState === 1) {
      this._connection.send(JSON.stringify(o));
    } else {
      this._queue.push(o);
    }
  }

  on(id, cb) {
    const listener = m => {
      if (m.id === id) {
        cb(m.error, m.result);

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

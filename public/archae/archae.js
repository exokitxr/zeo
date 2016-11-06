class ArchaeClient {
  constructor() {
    this.engines = {};
    this._engines = {};
    this.__engines = {};
    this.plugins = {};
    this._plugins = {};
    this.__plugins = {};
  }

  addEngine(engine) {
    const id = _makeId();

    this.send({
      type: 'addEngine',
      id: id,
      engine: engine,
    });

    return this.waitForId(id);
  }

  removePlugin(engine) {
    const id = _makeId();

    this.send({
      type: 'removeEngine',
      id: id,
      engine: engine,
    });

    return this.waitForId(id);
  }

  addPlugin(plugin) {
    const id = _makeId();

    this.send({
      type: 'addPlugin',
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
      this.once(id, (err, result) => {
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
  }

  loadModules(modules, cb) {
    window.module = {};

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

  mountEngines(engines) {
    engines.forEach(engine => {
      this.mountEngine(engine);
    });
  }

  mountEngine(engine) {
    const engineModule = this.engines[engine];

    const engineInstance = engineModule();
    this._engines[engine] = engineInstance;

    const engineApi = engineInstance.mount();
    this.__engines[engine] = engineApi;
  }

  mountPlugins(plugins) {
    plugins.forEach(plugin => {
      this.mountPlugin(plugin);
    });
  }

  mountPlugin(plugin) {
    const pluginModule = this.plugins[plugin];

    const pluginInstance = pluginModule({
      engines: this.__engines,
    });
    this._plugins[plugin] = pluginInstance;

    const pluginApi = pluginInstance.mount();
    this.__plugins[plugin] = pluginApi;
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

  once(id, cb) {
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

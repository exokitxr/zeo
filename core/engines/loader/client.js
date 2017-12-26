class Loader {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {offline}} = archae;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/utils/js-utils',
    ]).then(([
      jsUtils,
    ]) => {
      if (live) {
        const {events} = jsUtils;
        const {EventEmitter} = events;

        const pluginApis = {};

        class LoaderApi extends EventEmitter {
          requestPlugin(plugin) {
            const _preload = () => {
              if (offline) {
                window.module = {};
                return _loadScript(`/build/${plugin}/${plugin}.js`)
                  .then(() => {
                    window.plugins[plugin] = window.module.exports;
                    window.module = {};
                  });
              } else {
                return Promise.resolve();
              }
            };
            return _preload()
              .then(() => archae.requestPlugin(plugin, {
                hotload: true,
              }))
              .then(pluginApi => {
                const pluginName = plugin.replace(/^(.+?)@.*$/, '$1');

                pluginApis[pluginName] = pluginApi;

                loaderApi.emit('pluginAdded', pluginName, pluginApi);
              });
          }

          releasePlugin(plugin) {
            return archae.releasePlugin(plugin)
              .then(() => {
                const pluginName = plugin.replace(/^(.+?)@.*$/, '$1');

                pluginApis[pluginName] = null;

                loaderApi.emit('pluginRemoved', plugin);
              });
          }

          removePlugin(plugin) {
            return archae.removePlugin(plugin);
          }

          requestLoadedPlugin(plugin, {timeout = 30 * 1000} = {}) {
            return new Promise((accept, reject) => {
              const pluginApi = pluginApis[plugin];

              if (pluginApi) {
                accept(pluginApi);
              } else {
                const _pluginAdded = (plugin, pluginApi) => {
                  clearTimeout(localTimeout);

                  accept(pluginApi);
                };
                this.on('pluginAdded', _pluginAdded);

                const localTimeout = setTimeout(() => {
                  this.removeListener('pluginAdded', _pluginAdded);

                  const err = new Error('timeout out');
                  err.code = 'ETIMEOUT';
                  reject(err);
                }, timeout);
              }
            });
          }
        }
        const loaderApi = new LoaderApi();

        const _unload = plugin => {
          loaderApi.releasePlugin(plugin);
        };
        archae.on('unload', _unload);
        const _load = plugin => {
          loaderApi.requestPlugin(plugin);
        };
        archae.on('load', _load);

        this._cleanup = () => {
          archae.removeListener('unload', _unload);
          archae.removeListener('load', _load);
        };

        return loaderApi;
      }
    });
  }

  unmount() {
    this._cleanup();
  }
};
const _loadScript = src => new Promise((accept, reject) => {
  const script = document.createElement('script');
  script.src = src;
  script.async = true;
  script.onload = () => {
    accept();
    _cleanup();
  };
  script.onerror = err => {
    reject(err);
    _cleanup();
  };
  document.body.appendChild(script);

  const _cleanup = () => {
    document.body.removeChild(script);
  };
});

module.exports = Loader;

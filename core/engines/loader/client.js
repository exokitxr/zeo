class Loader {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {offline}} = archae;

    class LoaderApi {
      requestPlugin(plugin) {
        const _preload = () => {
          if (offline) {
            window.module = {};
            return _loadScript(`https://my-site.zeovr.io/bundle/${plugin}`)
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
          }));
      }

      removePlugin(plugin) {
        return archae.removePlugin(plugin);
      }

      releasePlugin(plugin) {
        return archae.releasePlugin(plugin);
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

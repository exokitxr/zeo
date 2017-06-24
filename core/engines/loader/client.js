class Loader {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    class LoaderApi {
      requestPlugin(plugin) {
        return archae.requestPlugin(plugin, {
          hotload: true,
        });
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

module.exports = Loader;

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

      releasePlugin(pluginName) {
        return archae.releasePlugin(pluginName);
      }
    }
    const loaderApi = new LoaderApi();

    const _unload = pluginName => {
      loaderApi.releasePlugin(pluginName);
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

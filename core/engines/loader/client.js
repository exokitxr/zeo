class Loader {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    this._cleanup = () => {};

    class LoaderApi {
      requestPlugin(plugin) {
        return archae.requestPlugin(plugin);
      }

      removePlugin(plugin) {
        return archae.removePlugin(plugin);
      }

      releasePlugin(pluginName) {
        return archae.releasePlugin(pluginName);
      }
    }
    const loaderApi = new LoaderApi();

    return loaderApi;
  }

  unmount() {
    this._cleanup();
  }
};

module.exports = Loader;

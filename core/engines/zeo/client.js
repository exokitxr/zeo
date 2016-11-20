const client = archae => ({
  mount() {
    this._cleanup = () => {};

    return archae.requestEngines([
      '/core/engines/three',
    ]).then(([
      three,
    ])) => {
      const {scene, camera, renderer} = three;

      const plugins = {};

      const _requestPlugin = pluginSpec => new Promise((accept, reject) => {
        archae.requestPlugin(pluginSpec)
          .then(plugin => {
            const pluginName = archae.getName(plugin);
            plugins[pluginName] = plugin;

            accept();
          })
          .catch(reject);
      });

      // XXX perform update cycle for plugins here

      return {
        scene,
        camera,
        renderer,
        requestPlugin: _requestPlugin,
      };
    });
  },
  unmount() {
    this._cleanup();
  },
});

module.exports = client;

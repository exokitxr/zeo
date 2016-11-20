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
            // XXX register the plugin here

            accept();
          })
          .catch(reject);
      });

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

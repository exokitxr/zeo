const client = archae => ({
  mount() {
    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestEngines([
      '/core/engines/three',
    ]).then(([
      three,
    ]) => {
      if (live) {
        const {scene, camera, renderer} = three;

        const worlds = new Map();

        const _requestWorld = worldName => new Promise((accept, reject) => {
          const world = worlds.get(worldName);

          if (world) {
            accept(world);
          } else {
            const plugins = new Map();

            const _requestPlugin = pluginSpec => new Promise((accept, reject) => {
              archae.requestPlugin(pluginSpec)
                .then(plugin => {
                  const pluginName = archae.getName(plugin);
                  plugins.set(pluginName, plugin);

                  accept();
                })
                .catch(reject);
            });
            const _destroy = () => {
              if (animationFrame) {
                cancelAnimationFrame(animationFrame);
              }
            };

            const startTime = Date.now()
            let animationFrame = null;
            const _recurse = () => {
              animationFrame = requestAnimationFrame(() => {
                animationFrame = null;

                const now = Date.now();
                const worldTime = now - startTime;

                const updateOptions = {
                  worldTime,
                };
                plugins.forEach(plugin => {
                  plugin.update(updateOptions);
                });

                renderer.render(scene, camera);

                _recurse();
              });
            };
            _recurse();

            const world = {
              requestPlugin: _requestPlugin,
              destroy: _destroy,
            };

            worlds.set(worldName, world);

            accept(world);
          }
        });

        this._cleanup = () => {
          worlds.forEach(world => {
            world.destroy();
          });
        };

        return {
          scene,
          camera,
          renderer,
          requestWorld: _requestWorld,
        };
      }
    });
  },
  unmount() {
    this._cleanup();
  },
});

module.exports = client;

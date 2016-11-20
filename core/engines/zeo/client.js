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
        const {THREE, scene, camera, renderer} = three;

        const worlds = new Map();

        const _requestWorld = worldName => new Promise((accept, reject) => {
          const world = worlds.get(worldName);

          if (world) {
            accept(world);
          } else {
            const plugins = new Map();

            const _requestMod = modSpec => new Promise((accept, reject) => {
              archae.requestPlugin(modSpec)
                .then(plugin => {
                  const pluginName = archae.getName(plugin);
                  plugins.set(pluginName, plugin);

                  accept();
                })
                .catch(reject);
            });
            const _requestMods = modSpecs => {
              const modPromises = modSpecs.map(_requestMod);
              return Promise.all(modPromises);
            };
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
              requestMod: _requestMod,
              requestMods: _requestMods,
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
          THREE,
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

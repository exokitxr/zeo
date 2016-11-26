class Zeo {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestEngines([
      '/core/engines/webvr',
      '/core/engines/three',
      '/core/engines/somnifer',
      '/core/engines/antikyth',
      '/core/engines/heartlink',
    ]).then(([
      webvr,
      three,
      somnifer,
      antikyth,
      heartlink,
    ]) => {
      if (live) {
        const {THREE, scene, camera, renderer} = three;
        const {sound} = somnifer;

        const worlds = new Map();
        let currentWorld = null;

        const _getCurrentWorld = () => currentWorld;
        const _requestChangeWorld = worldName => new Promise((accept, reject) => {
          const world = worlds.get(worldName);

          if (world) {
            currentWorld = world;

            accept(world);
          } else {
            antikyth.requestWorld(worldName)
              .then(physics => {
                const player = heartlink.getPlayer(); // XXX make this per-world

                // main render loop
                const startTime = Date.now();
                let worldTime = 0;
                let animationFrame = null;
                const _tick = () => {
                  // update state
                  const now = Date.now();
                  worldTime = now - startTime;

                  // update plugins
                  plugins.forEach(plugin => {
                    if (typeof plugin.update === 'function') {
                      plugin.update();
                    }
                  });

                  // render
                  renderer.render(scene, camera);
                };
                let cleanups = [];
                const _cleanup = () => {
                  for (let i = 0; i < cleanups.length; i++) {
                    const cleanup = cleanups[i];
                    cleanup();
                  }

                  cleanups = [];
                };
                const _enterNormal = () => {
                  const _recurse = () => {
                    animationFrame = requestAnimationFrame(() => {
                      animationFrame = null;

                      _tick();

                      _recurse();
                    });
                  };
                  _recurse();

                  cleanups.push(() => {
                    if (animationFrame) {
                      cancelAnimationFrame(animationFrame);
                      animationFrame = null;
                    }
                  });
                };
                const _enterVr = () => {
                  const tick = () => {
                    _tick();
                  };
                  webvr.on('tick', tick);

                  cleanups.push(() => {
                    webvr.removeListener('tick', tick);
                  });
                };

                _enterNormal();
                webvr.on('open', () => {
                  _cleanup();
                  _enterVr();
                });
                webvr.on('close', () => {
                  _cleanup();
                  _enterNormal();
                });

                // plugin management
                const plugins = new Map();

                const _getWorldTime = () => {
                  return worldTime;
                };
                const _requestMod = modSpec => new Promise((accept, reject) => {
                  archae.requestPlugin(modSpec)
                    .then(plugin => {
                      const pluginName = archae.getName(plugin);
                      plugins.set(pluginName, plugin);

                      accept(plugin);
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

                const world = {
                  name: worldName,
                  getWorldTime: _getWorldTime,
                  requestMod: _requestMod,
                  requestMods: _requestMods,
                  physics,
                  player,
                  destroy: _destroy,
                };

                worlds.set(worldName, world);
                currentWorld = world;

                accept(world);
              })
              .catch(reject);
          }
        });
        const _requestDeleteWorld = worldName => new Promise((accept, reject) => {
          antikyth.releaseWorld(worldName)
            .then(() => {
              worlds.delete(worldName);

              if (currentWorld && currentWorld.name === worldName) {
                currentWorld = null;
              }

              accept();
            })
            .catch(reject);
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
          sound,
          getCurrentWorld: _getCurrentWorld,
          requestChangeWorld: _requestChangeWorld,
          requestDeleteWorld: _requestDeleteWorld,
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Zeo;

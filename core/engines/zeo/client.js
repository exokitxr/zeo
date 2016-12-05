class Zeo {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let cleanups = [];
    const _cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
      cleanups = [];
    };

    let live = true;
    cleanups.push(() => {
      live = false;
    });

    return archae.requestEngines([
      '/core/engines/webvr',
      '/core/engines/three',
      '/core/engines/biolumi',
      '/core/engines/somnifer',
      '/core/engines/bullet',
      '/core/engines/heartlink',
    ]).then(([
      webvr,
      three,
      biolumi,
      somnifer,
      bullet,
      heartlink,
    ]) => {
      if (live) {
        const {THREE, scene, camera, renderer} = three;
        const {domElement} = renderer;
        const {sound} = somnifer;

        const updates = [];
        const updateEyes = [];
        const _update = () => {
          for (let i = 0; i < updates.length; i++) {
            const update = updates[i];
            update();
          }
        };
        const _updateEye = camera => {
          for (let i = 0; i < updateEyes.length; i++) {
            const updateEye = updateEyes[i];
            updateEye(camera);
          }
        };

        const _enterNormal = () => {
          _stopRenderLoop();

          renderLoop = webvr.requestRenderLoop({
            update: _update,
            updateEye: _updateEye,
          });

          return renderLoop;
        };
        const _enterVR = () => {
          _stopRenderLoop();

          const _onExit = () => {
            _enterNormal();
          };

          renderLoop = webvr.requestEnterVR({
            update: _update,
            updateEye: _updateEye,
            onExit: _onExit,
          });

          return renderLoop;
        };

        let renderLoop = null;
        const _stopRenderLoop = () => {
          if (renderLoop) {
            renderLoop.destroy();
            renderLoop = null;
          }
        };
        const _startRenderLoop = () => {
          cleanups.push(() => {
            _stopRenderLoop();
          });

          return _enterNormal();
        };

        const _requestAnchor = () => new Promise((accept, reject) => {
          const img = new Image();
          img.src = webvrIconSrc;
          img.onload = () => {
            const a = document.createElement('a');
            a.style.cssText = `\
position: absolute;
bottom: 0;
right: 0;
width: 100px;
height: 100px;
background-color: rgba(255, 255, 255, 0.5);
cursor: pointer;
`;
            a.appendChild(img);
            document.body.appendChild(a);

            const click = e => {
              if (!webvr.display) {
                _enterVR();
              }
            };
            domElement.addEventListener('click', click);

            cleanups.push(() => {
              document.body.removeChild(a);

              domElement.removeEventListener('click', click);
            });

            accept();
          };
          img.onerror = err => {
            reject(err);
          };
        });

        return _startRenderLoop()
          .then(() => {
            if (live) {
              return _requestAnchor();
            }
          })
          .then(() => {
            if (live) {
              const worlds = new Map();
              let currentWorld = null;

              const _getCurrentWorld = () => currentWorld;
              const _requestChangeWorld = worldName => new Promise((accept, reject) => {
                const world = worlds.get(worldName);

                if (world) {
                  currentWorld = world;

                  accept(world);
                } else {
                  bullet.requestWorld(worldName)
                    .then(physics => {
                      const player = heartlink.getPlayer(); // XXX make this per-world

                      // main render loop
                      const startTime = Date.now();
                      let worldTime = 0;
                      let animationFrame = null;
                      updates.push(() => {
                        // update state
                        const now = Date.now();
                        worldTime = now - startTime;

                        // update plugins
                        plugins.forEach(plugin => {
                          if (typeof plugin.update === 'function') {
                            plugin.update();
                          }
                        });
                      });
                      updateEyes.push(camera => {
                        // update plugins per eye
                        plugins.forEach(plugin => {
                          if (typeof plugin.updateEye === 'function') {
                            plugin.updateEye(camera);
                          }
                        });
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
                      const _requestWorker = (module, options) => archae.requestWorker(module, options);
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
                        requestWorker: _requestWorker,
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
                bullet.releaseWorld(worldName)
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
                _stopRenderLoop();

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
    });
  }

  unmount() {
    this._cleanup();
  }
}

const webvrIconSrc = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" x="0px" y="0px" viewBox="0 0 90 90" enable-background="new 0 0 90 90" xml:space="preserve"><path d="M81.671,21.323c-2.085-2.084-72.503-1.553-74.054,0c-1.678,1.678-1.684,46.033,0,47.713  c0.558,0.559,12.151,0.896,26.007,1.012l3.068-8.486c0,0,1.987-8.04,7.92-8.04c6.257,0,8.99,9.675,8.99,9.675l2.555,6.848  c13.633-0.116,24.957-0.453,25.514-1.008C83.224,67.483,83.672,23.324,81.671,21.323z M24.572,54.582  c-6.063,0-10.978-4.914-10.978-10.979c0-6.063,4.915-10.978,10.978-10.978s10.979,4.915,10.979,10.978  C35.551,49.668,30.635,54.582,24.572,54.582z M64.334,54.582c-6.063,0-10.979-4.914-10.979-10.979  c0-6.063,4.916-10.978,10.979-10.978c6.062,0,10.978,4.915,10.978,10.978C75.312,49.668,70.396,54.582,64.334,54.582z"/></svg>`;

module.exports = Zeo;

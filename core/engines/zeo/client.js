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

    const $ = s => document.querySelectorAll(s);

    const _requestLoader = () => new Promise((accept, reject) => {
      const loaderOverlay = $('#loader-overlay')[0];
      const loaderPlugin = $('#loader-plugin')[0];

      const loadingPlugins = [];
      const pluginloadstart = plugin => {
        loadingPlugins.push(plugin);
        loaderPlugin.innerText = loadingPlugins[0];
      };
      archae.on('pluginloadstart', pluginloadstart);
      const pluginload = plugin => {
        loadingPlugins.splice(loadingPlugins.indexOf(plugin), 1);
        loaderPlugin.innerText = loadingPlugins.length > 0 ? loadingPlugins[0] : '';
      }
      archae.on('pluginload', pluginload);

      const cleanup = () => {
        loaderOverlay.style.display = 'none';

        archae.removeListener('pluginloadstart', pluginloadstart);
        archae.removeListener('pluginload', pluginload);
      };
      cleanups.push(cleanup);

      const _destroy = () => {
        cleanup();
        cleanups.splice(cleanups.indexOf(cleanup), 1);
      };

      accept({
        destroy: _destroy,
      });
    });

    return _requestLoader()
      .then(loader => {
        if (live) {
          return archae.requestPlugins([
            '/core/engines/hub',
            '/core/engines/input',
            '/core/engines/webvr',
            '/core/engines/three',
            '/core/engines/anima',
            '/core/engines/cyborg',
            '/core/engines/rend',
            '/core/engines/biolumi',
            '/core/engines/airlock',
            '/core/engines/teleport',
            '/core/engines/hands',
            '/core/engines/tags',
            '/core/engines/universe',
            '/core/engines/world',
            '/core/engines/adventure',
            '/core/engines/inventory',
            '/core/engines/multiplayer',
            '/core/engines/webrtc',
            '/core/engines/npm',
            '/core/engines/fs',
            '/core/engines/somnifer',
            '/core/engines/bullet',
            '/core/plugins/js-utils',
          ]).then(([
            hub,
            input,
            webvr,
            three,
            anima,
            cyborg,
            rend,
            biolumi,
            airlock,
            teleport,
            hands,
            tags,
            universe,
            world,
            adventure,
            inventory,
            multiplayer,
            webrtc,
            npm,
            fs,
            somnifer,
            bullet,
            jsUtils,
          ]) => {
            if (live) {
              const {THREE, scene, camera, renderer} = three;
              const {domElement} = renderer;
              const {EVENTS} = input;
              const {sound} = somnifer;
              const {events} = jsUtils;
              const {EventEmitter} = events;

              loader.destroy();

              const inputEventsIndex = (() => {
                const result = {};
                for (let i = 0; i < EVENTS.length; i++) {
                  const eventName = EVENTS[i];
                  result[eventName] = true;
                }
                return result;
              })();
              const supportsWebVR = webvr.supportsWebVR();

              const updates = [];
              const updateEyes = [];
              const _update = () => {
                rend.update();
              };
              const _updateEye = camera => {
                rend.updateEye(camera);
              };
              const _updateStart = () => {
                rend.updateStart();
              };
              const _updateEnd = () => {
                rend.updateEnd();
              };

              const _enterNormal = () => {
                _stopRenderLoop();

                renderLoop = webvr.requestRenderLoop({
                  update: _update,
                  updateEye: _updateEye,
                  updateStart: _updateStart,
                  updateEnd: _updateEnd,
                });

                return renderLoop;
              };
              const _enterVR = ({stereoscopic, onExit}) => {
                _stopRenderLoop();

                const _onExit = () => {
                  onExit();

                  _enterNormal();
                };

                renderLoop = webvr.requestEnterVR({
                  stereoscopic,
                  update: _update,
                  updateEye: _updateEye,
                  updateStart: _updateStart,
                  updateEnd: _updateEnd,
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

              return _startRenderLoop()
                .then(() => {
                  if (live) {
                    const _initHelper = () => {
                      const helper = document.createElement('div');
                      helper.id = 'helper';
                      helper.style.cssText = `\
                        display: flex;
                        position: absolute;
                        top: 0;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        align-items: center;
                        background-color: rgba(0, 0, 0, 0.5);
                        font-family: 'Open Sans';
                      `;
                      helper.innerHTML = `\
                        <div style="display: flex; width: 100%; margin: auto 0; justify-content: center; color: #FFF;">
                          <div style="display: flex; flex-direction: column; justify-content: center; align-items: center;">
                            <img src="/img/logo-large.png" width=100 height=158 style="width: 100px; height: 158px; margin-bottom: 20px;">
                            <h1 style="width: 400px; margin: 0; margin-bottom: 20px; font-size: 30px; font-weight: 300;"><span id=username>Username</span> / <span id=worldname>Unknown world</span></h1>
                            <div style="display: flex; width: 400px; margin-bottom: 20px;">
                              <button style="display: inline-block; margin-right: 10px; padding: 10px 20px; border: 1px solid; background-color: transparent; border-radius: 100px; color: #FFF; font-family: 'Open Sans'; font-size: 13px; font-weight: 300; cursor: pointer; outline: none; box-sizing: border-box;" id="headset-button">Headset</button>
                              <button style="display: inline-block; padding: 10px 20px; border: 1px solid; background-color: transparent; border-radius: 100px; color: #FFF; font-family: 'Open Sans'; font-size: 13px; font-weight: 300; cursor: pointer; outline: none; box-sizing: border-box;" id="keyboard-button">Mouse + Keyboard</button>
                            </div>
                            <p style="width: 400px; margin: 0; font-size: 13px; color: rgba(255, 255, 255, 0.5); font-weight: 300;" id="error-message">WebVR is not supported by your browser so you can't use a headset. <a href="#" style="color: inherit; text-decoration: underline;">Learn more</a></p>
                          </div>
                        </div>
                      `;
                      helper.addEventListener('dragover', fs.dragover);
                      helper.addEventListener('drop', fs.drop);
                      document.body.appendChild(helper);

                      const _styleButton = button => {
                        button.addEventListener('mouseover', e => {
                          button.style.backgroundColor = '#FFF';
                          button.style.borderColor = 'transparent';
                          button.style.color = '#000';
                        });
                        button.addEventListener('mouseout', e => {
                          button.style.backgroundColor = 'transparent';
                          button.style.borderColor = 'currentColor';
                          button.style.color = '#FFF';
                        });
                      };

                      const headsetButton = $('#headset-button')[0];
                      if (supportsWebVR) {
                        _styleButton(headsetButton);
                        headsetButton.addEventListener('click', e => {
                          if (!webvr.display) {
                            _enterVR({
                              stereoscopic: true,
                              onExit: () => {
                                helper.style.display = 'flex';
                              },
                            });

                            helper.style.display = 'none';
                          }
                        });
                      } else {
                        headsetButton.style.display = 'none';
                      }

                      const keyboardButton = $('#keyboard-button')[0];
                      _styleButton(keyboardButton);
                      keyboardButton.addEventListener('click', e => {
                        if (!webvr.display) {
                          _enterVR({
                            stereoscopic: false,
                            onExit: () => {
                              helper.style.display = 'flex';
                            },
                          });

                          helper.style.display = 'none';
                        }
                      });

                      const errorMessage = $('#error-message')[0];
                      if (supportsWebVR) {
                        errorMessage.style.display = 'none';
                      }

                      const userState = hub.getUserState();
                      const {username, world} = userState;
                      if (username) {
                        const usernameEl = $('#username')[0];
                        usernameEl.innerText = username;
                      }
                      if (world) {
                        const worldnameEl = $('#worldname')[0];
                        worldnameEl.innerText = world;
                      }
                    };
                    _initHelper();

                    class Listener {
                      constructor(handler, priority) {
                        this.handler = handler;
                        this.priority = priority;
                      }
                    }

                    const _makeEventListener = () => {
                      const listeners = [];

                      const result = e => {
                        let live = true;
                        e.stopImmediatePropagation = (stopImmediatePropagation => () => {
                          live = false;

                          stopImmediatePropagation.call(e);
                        })(e.stopImmediatePropagation);

                        const oldListeners = listeners.slice();
                        for (let i = 0; i < oldListeners.length; i++) {
                          const listener = oldListeners[i];
                          const {handler} = listener;

                          handler(e);

                          if (!live) {
                            break;
                          }
                        }
                      };
                      result.add = (handler, {priority}) => {
                        const listener = new Listener(handler, priority);
                        listeners.push(listener);
                        listeners.sort((a, b) => b.priority - a.priority);
                      };
                      result.remove = handler => {
                        const index = listeners.indexOf(handler);
                        if (index !== -1) {
                          listeners.splice(index, 1);
                        }
                      };

                      return result;
                    };

                    this._cleanup = () => {
                      _stopRenderLoop();
                    };

                    class ZeoApi extends EventEmitter {
                      constructor({THREE, scene, camera, renderer, sound, anima}) {
                        super();

                        this.THREE = THREE;
                        this.scene = scene;
                        this.camera = camera;
                        this.renderer = renderer;
                        this.sound = sound;
                        this.anima = anima;
                      }

                      on(eventName, handler, options) {
                        if (inputEventsIndex[eventName]) {
                          input.on(eventName, handler, options);
                          return this;
                        } else {
                          return super.on(eventName, handler);
                        }
                      }
                      removeListener(eventName, handler) {
                        if (inputEventsIndex[eventName]) {
                          input.removeListener(eventName, handler);
                          return this;
                        } else {
                          return super.removeListener(eventName, handler);
                        }
                      }
                      removeAllListeners(eventName) {
                        if (inputEventsIndex[eventName]) {
                          input.removeAllListeners(eventName);
                          return this;
                        } else {
                          return super.removeAllListeners(eventName);
                        }
                      }

                      update() {
                        this.emit('update');
                      }
                      updateEye(camera) {
                        this.emit('updateEye', camera);
                      }

                      getUiTime() {
                        return world.getWorldTime();
                      }

                      getWorldTime() {
                        return world.getWorldTime();
                      }

                      getPhysicsWorld() {
                        return bullet.getPhysicsWorld();
                      }

                      getStatus() {
                        return webvr.getStatus();
                      }

                      canGrab(side, object, options) {
                        return hands.canGrab(side, object, options);
                      }
                      grab(side, object) {
                        return hands.grab(side, object);
                      }
                      release(side) {
                        return hands.release(side);
                      }
                      peek(side) {
                        return hands.peek(side);
                      }

                      registerElement(pluginInstance, elementApi) {
                        world.registerElement(pluginInstance, elementApi);
                      }
                      unregisterElement(pluginInstance) {
                        world.unregisterElement(pluginInstance);
                      }
                    }

                    const api = new ZeoApi({
                      THREE,
                      scene,
                      camera,
                      renderer,
                      sound,
                      anima,
                    });
                    rend.on('update', () => {
                      api.update();
                    });
                    rend.on('updateEye', camera => {
                      api.updateEye(camera);
                    });

                    return api;
                  }
                })
            }
          });
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Zeo;

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
    const $$ = (el, s) => el.querySelectorAll(s);

    const _requestLoader = () => new Promise((accept, reject) => {
      const loaderOverlay = $('#loader-overlay')[0];
      const loaderPlugin = $('#loader-plugin')[0];

      const pendingPlugins = [];
      let loadingPlugins = true;
      let loadingMediaPermissions = true;
      const pluginloadstart = plugin => {
        if (!pendingPlugins.includes(plugin)) {
          pendingPlugins.push(plugin);

          _updateText();
        }
      };
      archae.on('pluginloadstart', pluginloadstart);
      const pluginload = plugin => {
        pendingPlugins.splice(pendingPlugins.indexOf(plugin), 1);

        _updateText();
      }
      archae.on('pluginload', pluginload);
      const pluginsload = () => {
        loadingPlugins = false;

        _updateText();
      }
      archae.on('pluginsload', pluginsload);
      const mediapermissionsload = () => {
        loadingMediaPermissions = false;

        _updateText();
      }
      archae.on('mediapermissionsload', mediapermissionsload);

      const _updateText = () => {
        loaderPlugin.innerText = (() => {
          if (pendingPlugins.length > 0) {
            return pendingPlugins[0];
          } else if (loadingPlugins) {
             return 'Waiting for plugins...';
          } else if (loadingMediaPermissions) {
             return 'Waiting for media permissions...';
          } else {
            return '';
          }
        })();
      };

      const cleanup = () => {
        loaderOverlay.style.display = 'none';

        archae.removeListener('pluginloadstart', pluginloadstart);
        archae.removeListener('pluginload', pluginload);
        archae.removeListener('pluginsload', pluginsload);
        archae.removeListener('mediapermissionsload', mediapermissionsload);
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
          const _requestPlugins = () => archae.requestPlugins([
            '/core/engines/bootstrap',
            '/core/engines/input',
            '/core/engines/webvr',
            '/core/engines/three',
            '/core/engines/anima',
            '/core/engines/cyborg',
            '/core/engines/hub',
            '/core/engines/login',
            '/core/engines/rend',
            '/core/engines/biolumi',
            '/core/engines/airlock',
            '/core/engines/teleport',
            '/core/engines/hands',
            '/core/engines/tags',
            '/core/engines/world',
            '/core/engines/mail',
            '/core/engines/universe',
            '/core/engines/servers',
            '/core/engines/bag',
            '/core/engines/backpack',
            '/core/engines/multiplayer',
            '/core/engines/voicechat',
            '/core/engines/npm',
            '/core/engines/fs',
            '/core/engines/somnifer',
            '/core/engines/bullet',
            '/core/plugins/js-utils',
          ])
            .then(pluginApis => {
              archae.emit('pluginsload');

              return pluginApis;
            });
          const _requestMediaPermissions = () => new Promise((accept, reject) => {
            navigator.mediaDevices.getUserMedia({
              video: true,
              audio: true,
            })
              .then(mediaStream => {
                const tracks = mediaStream.getTracks();
                let video = false;
                let audio = false;
                for (let i = 0; i < tracks.length; i++) {
                  const track = tracks[i];
                  if (track.kind === 'video') {
                    video = true;
                  } else if (track.kind === 'audio') {
                    audio = true;
                  }
                  track.stop();
                }

                archae.emit('mediapermissionsload');

                accept(video && audio);
              })
              .catch(err => {
                console.warn(err);

                accept(false);
              });
          });

          return Promise.all([
            _requestPlugins(),
            _requestMediaPermissions(),
          ]).then(([
            [
              bootstrap,
              input,
              webvr,
              three,
              anima,
              cyborg,
              hub,
              login,
              rend,
              biolumi,
              airlock,
              teleport,
              hands,
              tags,
              world,
              mail,
              universe,
              servers,
              bag,
              backpack,
              multiplayer,
              voicechat,
              npm,
              fs,
              somnifer,
              bullet,
              jsUtils,
            ],
            mediaPermissions,
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
                        font-family: ${biolumi.getFonts()};
                      `;
                      const fonts = biolumi.getFonts().replace(/"/g, "'");
                      helper.innerHTML = `\
                        <div style="display: flex; width: 100%; margin: auto 0; justify-content: center; color: #FFF;">
                          <div style="display: flex; flex-direction: column; justify-content: center; align-items: center;">
                            <img src="/img/logo-large.png" width=100 height=158 style="width: 100px; height: 158px; margin-bottom: 20px;">
                            <h1 style="width: 400px; margin: 0; margin-bottom: 20px; font-size: 30px; font-weight: 300;"><span class=username>Username</span> / <span class=worldname>Unknown world</span></h1>
                            <div class=helper-content style="width: 400px;"></div>
                          </div>
                        </div>
                      `;
                      helper.addEventListener('dragover', fs.dragover);
                      helper.addEventListener('drop', fs.drop);
                      document.body.appendChild(helper);

                      const helperConent = helper.querySelector('.helper-content');

                      const enterHelperContent = document.createElement('div');
                      enterHelperContent.innerHTML = `\
                        <div>
                          <div style="display: flex; margin-bottom: 20px;">
                            <button style="display: inline-block; margin-right: 10px; padding: 10px 20px; border: 1px solid; background-color: transparent; border-radius: 100px; color: #FFF; font-family: ${fonts}; font-size: 13px; font-weight: 300; cursor: pointer; outline: none; box-sizing: border-box;" class="headset-button">Headset</button>
                            <button style="display: inline-block; padding: 10px 20px; border: 1px solid; background-color: transparent; border-radius: 100px; color: #FFF; font-family: ${fonts}; font-size: 13px; font-weight: 300; cursor: pointer; outline: none; box-sizing: border-box;" class=keyboard-button>Mouse + Keyboard</button>
                          </div>
                          <p style="width: 400px; margin: 0; font-size: 13px; color: #CCC; font-weight: 300;" class="error-message">WebVR is not supported by your browser so you can't use a headset. <a href="#" style="color: inherit; text-decoration: underline;">Learn more</a></p>
                        </div>
                      `;

                      const permissionsHelperContent = document.createElement('div');
                      permissionsHelperContent.innerHTML = `\
                        <div>
                          <div style="margin-bottom: 18px; padding: 15px; background-color: #E91E63; color: #FFF; cursor: pointer;">
                            <div style="display: flex; margin-bottom: 15px; font-size: 18px; line-height: 22px;">
                              <div style="margin-right: auto; color: #FFF;">Media Permissions</div>
                              <button style="display: inline-flex; padding: 2px; border: 2px solid; background-color: transparent; color: #FFF; font-family: ${fonts}; font-size: 13px; font-weight: 300; cursor: pointer; outline: none; opacity: 0.5; box-sizing: border-box;" class=permission-button>
                                <div style="width: 12px; height: 12px; background-color: #FFF;"></div>
                                <div style="width: 12px; height: 12px;"></div>
                              </button>
                            </div>
                            <p style="margin: 0; font-size: 13px; font-weight: 300;" class="help-message">Media permissions enable camera + microphone support in VR. They will <i>not</i> be used until you enable them in the Options menu. <a href="#" style="color: inherit; text-decoration: underline;">Learn more</a></p>
                          </div>
                        </div>
                      `;
                      permissionsHelperContent.addEventListener('click', () => {
                        _requestMediaPermissions();
                      });

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

                      const headsetButton = $$(enterHelperContent, '.headset-button')[0];
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

                      const keyboardButton = $$(enterHelperContent, '.keyboard-button')[0];
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

                      const errorMessage = $$(enterHelperContent, '.error-message')[0];
                      if (supportsWebVR) {
                        errorMessage.style.display = 'none';
                      }

                      const userState = bootstrap.getUserState();
                      const {username, world} = userState;
                      if (username) {
                        const usernameEl = $$(helper, '.username')[0];
                        usernameEl.innerText = username;
                      }
                      if (world) {
                        const worldnameEl = $$(helper, '.worldname')[0];
                        worldnameEl.innerText = world;
                      }

                      if (mediaPermissions) {
                        helperConent.appendChild(enterHelperContent);
                      } else {
                        helperConent.appendChild(permissionsHelperContent);
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

                      getWorldTime() {
                        return world.getWorldTime();
                      }

                      getGrabElement(side) {
                        return world.getGrabElement(side);
                      }

                      createFile(blob) {
                        return world.createFile(blob);
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

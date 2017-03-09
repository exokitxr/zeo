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

      const _updateText = () => {
        loaderPlugin.innerText = (() => {
          if (pendingPlugins.length > 0) {
            return pendingPlugins[0];
          } else {
             return 'Waiting for plugins...';
          }
        })();
      };

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
          ]);

          let mediaPermissions = false;
          let mediaPermissionsLoaded = false;
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

                accept(video && audio);
              })
              .catch(err => {
                console.warn(err);

                accept(false);
              });
          });
          const _initMediaPermissions = () => _requestMediaPermissions()
            .then(newMediaPermissions => {
              mediaPermissions = newMediaPermissions;
              mediaPermissionsLoaded = true;
            });
          _initMediaPermissions();

          return _requestPlugins().then(([
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
                    const filterText = 'blur(5px) opacity(0.75)';
                    renderer.domElement.style.display = 'block';
                    renderer.domElement.style.filter = filterText;

                    // begin helper content
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
                      font-family: ${biolumi.getFonts()};
                    `;
                    const fonts = biolumi.getFonts().replace(/"/g, "'");
                    helper.innerHTML = `\
                      <div style="display: flex; width: 100%; margin: auto 0; padding: 20px 0; justify-content: center;">
                        <div style="display: flex; flex-direction: column; justify-content: center; align-items: center;">
                          <img src="/img/logo-large.png" width=100 height=158 style="width: 100px; height: 158px; margin-bottom: 20px;">
                          <h1 style="display: flex; width: 400px; margin: 0; margin-bottom: 20px; font-size: 40px; font-weight: 300; justify-content: center;">Paused</span></h1>
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
                          <button style="display: inline-block; margin-right: 10px; padding: 10px 20px; border: 1px solid; background-color: transparent; border-radius: 100px; color: #000; font-family: ${fonts}; font-size: 13px; font-weight: 600; cursor: pointer; outline: none; box-sizing: border-box;" class="headset-button">Headset</button>
                          <button style="display: inline-block; padding: 10px 20px; border: 1px solid; background-color: transparent; border-radius: 100px; color: #000; font-family: ${fonts}; font-size: 13px; font-weight: 600; cursor: pointer; outline: none; box-sizing: border-box;" class=keyboard-button>Mouse + Keyboard</button>
                        </div>
                        <div style="padding: 15px; background-color: #000; color: #FFF;" class="error-message">
                          <div style="margin-bottom: 15px; font-size: 18px; line-height: 1;">No WebVR</div>
                          <div style="font-size: 13px; font-weight: 400;">WebVR is not supported by your browser, so you can't use a headset. <a href="#" style="color: inherit; text-decoration: underline;">Learn more</a>
                        </div>
                      </div>
                    `;

                    const permissionsHelperContent = document.createElement('div');
                    permissionsHelperContent.innerHTML = `\
                      <div style="margin-top: 10px; margin-bottom: 18px; padding: 15px; background-color: #4CAF50; color: #FFF; cursor: pointer;">
                        <div style="display: flex; margin-bottom: 10px; font-size: 18px; line-height: 1;">
                          <div style="margin-right: auto; color: #FFF;">Media Permissions</div>
                          <button style="display: inline-flex; padding: 2px; border: 2px solid; background-color: transparent; color: #FFF; cursor: pointer; outline: none; opacity: 0.5; box-sizing: border-box;" class=permission-button>
                            <div style="width: 10px; height: 10px; background-color: #FFF;"></div>
                            <div style="width: 10px; height: 10px;"></div>
                          </button>
                        </div>
                        <p style="margin: 0; font-size: 13px; font-weight: 400;" class="help-message">Media permissions enable avatar chat in VR. Click to grant permission.</p>
                      </div>
                    `;
                    permissionsHelperContent.addEventListener('click', () => {
                      _reinitMediaPermissions();
                    });

                    const _styleButton = button => {
                      button.addEventListener('mouseover', e => {
                        button.style.backgroundColor = '#000';
                        button.style.borderColor = 'transparent';
                        button.style.color = '#FFF';
                      });
                      button.addEventListener('mouseout', e => {
                        button.style.backgroundColor = 'transparent';
                        button.style.borderColor = 'currentColor';
                        button.style.color = '#000';
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
                              renderer.domElement.style.filter = filterText;
                            },
                          });

                          helper.style.display = 'none';
                          renderer.domElement.style.filter = 'none';
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
                            renderer.domElement.style.filter = filterText;
                          },
                        });

                        helper.style.display = 'none';
                        renderer.domElement.style.filter = 'none';
                      }
                    });

                    const errorMessage = $$(enterHelperContent, '.error-message')[0];
                    if (supportsWebVR) {
                      errorMessage.style.display = 'none';
                    }

                    const _updateHelperContent = () => {
                      if (mediaPermissions) {
                        permissionsHelperContent.style.display = 'none';
                      } else {
                        permissionsHelperContent.style.display = 'block';
                      }
                    };
                    _updateHelperContent();

                    helperConent.appendChild(enterHelperContent);
                    helperConent.appendChild(permissionsHelperContent);

                    const _reinitMediaPermissions = () => {
                      _requestMediaPermissions()
                        .then(newMediaPermissions => {
                          mediaPermissions = newMediaPermissions;

                          _updateHelperContent();
                        });
                    };
                    if (!mediaPermissionsLoaded) {
                      _reinitMediaPermissions();
                    }

                    // end helper content

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
                      release(side, object) {
                        return hands.release(side, object);
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
                    hands.on('release', e => {
                      api.emit('release', e);
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

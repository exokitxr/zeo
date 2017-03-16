class Zeo {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {site: {url: siteUrl}, server: {enabled: serverEnabled}}} = archae;

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
            '/core/plugins/function-utils',
            '/core/plugins/geometry-utils',
            '/core/plugins/random-utils',
            '/core/plugins/text-utils',
            '/core/plugins/creature-utils',
            '/core/plugins/sprite-utils',
          ]);

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
            functionUtils,
            geometryUtils,
            randomUtils,
            textUtils,
            creatureUtils,
            spriteUtils,
          ]) => {
            if (live) {
              const {THREE, scene, camera, renderer} = three;
              const {domElement} = renderer;
              const {EVENTS: INPUT_EVENTS} = input;
              const {sound} = somnifer;
              const {events} = jsUtils;
              const {EventEmitter} = events;

              loader.destroy();

              const isInIframe = bootstrap.isInIframe();
              const supportsWebVR = webvr.supportsWebVR();

              if (isInIframe) {
                window.parent.postMessage({
                  method: 'loaded',
                }, 'https://' + siteUrl);
              }

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
                    renderer.domElement.style.display = 'block';

                    // begin helper content

                    const overlay = document.createElement('div');
                    overlay.style.cssText = `\
                      display: flex;
                      position: absolute;
                      top: 0;
                      bottom: 0;
                      left: 0;
                      right: 0;
                      align-items: center;
                      font-family: ${biolumi.getFonts()};
                    `;
                    overlay.innerHTML = `\
                      <div style="display: flex; width: 100%; margin: auto 0; padding: 20px 0; justify-content: center;">
                        <div style="display: flex; flex-direction: column; justify-content: center; align-items: center;" class=overlay-content></div>
                      </div>
                    `;
                    document.body.insertBefore(overlay, renderer.domElement.nextSibling);
                    const overlayContent = overlay.querySelector('.overlay-content');

                    const helper = document.createElement('div');
                    helper.style.cssText = `\
                      display: flex;
                      width: 500px;
                      flex-direction: column;
                      justify-content: center;
                      align-items: center;
                    `;
                    const fonts = biolumi.getFonts().replace(/"/g, "'");
                    helper.innerHTML = `\
                      <img src="/img/logo-large.png" width=100 height=158 style="width: 100px; height: 158px; margin-bottom: 20px;">
                      <h1 style="display: flex; margin: 0; margin-bottom: 20px; font-size: 40px; font-weight: 300; justify-content: center;">Paused</span></h1>
                    `;
                    helper.addEventListener('dragover', fs.dragover);
                    helper.addEventListener('drop', fs.drop);

                    const enterHelperContent = document.createElement('div');
                    enterHelperContent.innerHTML = `\
                      <div style="display: flex; width: 500px; margin-bottom: 20px;">
                        <button style="display: inline-block; position: relative; height: 42px; margin-right: 10px; padding: 10px 20px; background-color: transparent; border: 1px solid; border-radius: 100px; color: #000; font-family: ${fonts}; font-size: 13px; font-weight: 600; cursor: pointer; outline: none; box-sizing: border-box;" class=headset-button>Headset</button>
                        <button style="display: inline-block; position: relative; height: 42px; padding: 10px 20px; background-color: transparent; border: 1px solid; border-radius: 100px; color: #000; font-family: ${fonts}; font-size: 13px; font-weight: 600; cursor: pointer; outline: none; box-sizing: border-box;" class=keyboard-button>Mouse + Keyboard</button>
                      </div>
                    `;

                    const errorMessage = document.createElement('div');
                    errorMessage.innerHTML = `\
                      <div style="height: 80px; padding: 15px; background-color: #000; color: #FFF; box-sizing: border-box;">
                        <div style="margin-bottom: 15px; font-size: 18px; line-height: 1;">No WebVR</div>
                        <div style="font-size: 13px;">WebVR is not supported by your browser, so you can't use a headset. <a href="#" style="color: inherit; text-decoration: underline;">Learn more</a>
                      </div>
                    `;

                    const siteContent = document.createElement('div');
                    siteContent.innerHTML = `\
                      <div style="margin-bottom: 10px; padding: 0 30px; padding-bottom: 20px; background-color: #000; color: #FFF; font-size: 60px; line-height: 1.4; font-weight: 300;">Multiplayer VR worlds<br>in your browser<br>powered by npm</div>
                      <div style="display: flex; margin-bottom: 10px;">
                        <button style="display: inline-flex; position: relative; margin-right: 10px; padding: 4px 8px; background-color: #000; border: 0; color: #FFF; font-family: ${fonts}; font-size: 13px; font-weight: 600; cursor: pointer; outline: none; justify-content: center; align-items: center; box-sizing: border-box;" class=headset-button>
                          <img src="/img/headset.svg" style="margin-right: 5px; padding: 5px;" />
                          Headset
                        </button>
                        <button style="display: inline-flex; position: relative; padding: 4px 8px; background-color: #000; border: 0; color: #FFF; font-family: ${fonts}; font-size: 13px; font-weight: 600; cursor: pointer; outline: none; justify-content: center; align-items: center; box-sizing: border-box;" class=keyboard-button>
                          <img src="/img/mouse.svg" style="margin-right: 5px; padding: 5px;" />
                          Mouse + keyboard
                        </button>
                      </div>
                    `;

                    const strikethrough = document.createElement('div');
                    strikethrough.style.cssText = 'position: absolute; top: 50%; margin-top: -1px; left: -5px; right: -5px; height: 2px; background-color: #F44336;';

                    const _styleButton = button => {
                      if (!isInIframe) {
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
                      } else {
                        button.addEventListener('mouseover', e => {
                          button.style.backgroundColor = '#4CAF50';
                        });
                        button.addEventListener('mouseout', e => {
                          button.style.backgroundColor = '#000';
                        });
                      }
                    };

                    const headsetButtons = [$$(enterHelperContent, '.headset-button')[0], $$(siteContent, '.headset-button')[0]];
                    if (supportsWebVR) {
                      headsetButtons.forEach(headsetButton => {
                        _styleButton(headsetButton);

                        headsetButton.addEventListener('click', e => {
                          if (!webvr.display) {
                            _enterVR({
                              stereoscopic: true,
                              onExit: () => {
                                overlay.style.display = 'flex';

                                bootstrap.setVrMode(null);
                              },
                            });

                            bootstrap.setVrMode('hmd');

                            overlay.style.display = 'none';
                          }
                        });
                      });

                      errorMessage.style.display = 'none';
                    } else {
                      headsetButtons.forEach(headsetButton => {
                        headsetButton.appendChild(strikethrough.cloneNode(true));
                      });
                    }

                    const keyboardButtons = [$$(enterHelperContent, '.keyboard-button')[0], $$(siteContent, '.keyboard-button')[0]];
                    keyboardButtons.forEach(keyboardButton => {
                      _styleButton(keyboardButton);

                      keyboardButton.addEventListener('click', e => {
                        if (!webvr.display) {
                          _enterVR({
                            stereoscopic: false,
                            onExit: () => {
                              overlay.style.display = 'flex';

                              bootstrap.setVrMode(null);
                            },
                          });

                          bootstrap.setVrMode('keyboard');

                          overlay.style.display = 'none';
                        }
                      });
                    });

                    if (!isInIframe) {
                      overlayContent.appendChild(helper);
                      helper.appendChild(enterHelperContent);
                      helper.appendChild(errorMessage);
                    } else {
                      overlayContent.appendChild(siteContent);
                      siteContent.appendChild(errorMessage);
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

                    class ZeoThreeApi {
                      constructor() {
                        this.THREE = THREE;
                        this.scene = scene;
                        this.camera = camera;
                        this.renderer = renderer;
                      }
                    }

                    class ZeoPoseApi {
                      getStatus() {
                        return webvr.getStatus();
                      }

                      getStageMatrix() {
                        return webvr.getStageMatrix();
                      }

                      setStageMatrix(stageMatrix) {
                        webvr.setStageMatrix(stageMatrix);
                      }

                      updateStatus() {
                        webvr.updateStatus();
                      }

                      resetPose() {
                        webvr.resetPose();
                      }
                    }

                    class ZeoInputApi extends EventEmitter {
                      constructor() {
                        super();

                        for (let i = 0; i < INPUT_EVENTS.length; i++) {
                          const eventName = INPUT_EVENTS[i];
                          input.on(eventName, e => {
                            this.emit(eventName, e);
                          });
                        }
                      }
                    }

                    class ZeoRenderApi extends EventEmitter {
                      constructor() {
                        super();

                        rend.on('update', () => {
                          this.emit('update');
                        });
                        rend.on('updateEye', camera => {
                          this.emit('updateEye', camera);
                        });
                      }
                    }

                    class ZeoElementsApi {
                      registerComponent(pluginInstance, componentApi) {
                        tags.registerComponent(pluginInstance, componentApi);
                      }

                      unregisterComponent(pluginInstance) {
                        tags.unregisterComponent(pluginInstance);
                      }

                      getRootElement() {
                        return tags.getRootElement();
                      }
                    }

                    class ZeoWorldApi {
                      getWorldTime() {
                        return world.getWorldTime();
                      }
                    }

                    class ZeoUiApi {
                      makeUi(options) {
                        return biolumi.makeUi(options);
                      }

                      getTransparentImg() {
                        return biolumi.getTransparentImg();
                      }
                    }

                    class ZeoSoundApi {
                      makeBody() {
                        return somnifer.makeBody();
                      }
                    }

                    class ZeoPhysicsApi {
                      getPhysicsWorld() {
                        return bullet.getPhysicsWorld();
                      }

                      getControllerPhysicsBodies() {
                        return cyborg.getControllerPhysicsBodies();
                      }
                    }

                    class ZeoHandsApi extends EventEmitter {
                      constructor() {
                        super();

                        hands.on('release', e => {
                          this.emit('release', e);
                        });
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
                    }

                    class ZeoAnimationApi {
                      makeAnimation(duration) {
                        return anima.makeAnimation(duration);
                      }
                    }

                    class ZeoJsApi {
                      constructor() {
                        this.events = events;
                      }
                    }

                    class ZeoUtilsApi {
                      constructor() {
                        this.js = jsUtils;
                        this.function = functionUtils;
                        this.geometry = geometryUtils;
                        this.random = randomUtils;
                        this.text = textUtils;
                        this.creature = creatureUtils;
                        this.sprite = spriteUtils;
                      }
                    }

                    class ZeoApi extends EventEmitter {
                      constructor() {
                        super();

                        this.three = new ZeoThreeApi();
                        this.pose = new ZeoPoseApi();
                        this.input = new ZeoInputApi();
                        this.render = new ZeoRenderApi();
                        this.elements = new ZeoElementsApi();
                        this.world = new ZeoWorldApi();
                        this.ui = new ZeoUiApi();
                        this.sound = new ZeoSoundApi();
                        this.physics = new ZeoPhysicsApi();
                        this.hands = new ZeoHandsApi();
                        this.animation = new ZeoAnimationApi();
                        this.utils = new ZeoUtilsApi();
                      }
                    }
                    const zeoApi = new ZeoApi();
                    window.zeo = zeoApi;

                    if (serverEnabled) {
                      servers.requestInitialConnect();
                    }

                    return zeoApi;
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

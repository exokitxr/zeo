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

    const _requestBlocker = () => new Promise((accept, reject) => {
      const loaderOverlay = $('#loader-overlay')[0];
      const loaderPlugin = $('#loader-plugin')[0];
      const loaderError = $('#loader-error')[0];

      let loggedIn = false;
      const pendingPlugins = {};
      let loadTimeout = null;
      const _kickLoadTimeout = () => {
        if (loadTimeout !== null) {
          clearTimeout(loadTimeout);
        }

        loadTimeout = setTimeout(() => {
          loaderError.innerHTML = `\
            <h2>:/</h2>
            <div>This is taking way too long. These plugins are hung:</div>
            <ul>${Object.keys(pendingPlugins).map(plugin => `<li>${plugin}</li>`).join('\n')}</ul>
          `;
        }, 10 * 1000);
      };
      _kickLoadTimeout();

      const pluginloadstart = plugin => {
        if (pendingPlugins[plugin] === undefined) {
          pendingPlugins[plugin] = 0;
        }

        pendingPlugins[plugin]++;

        if (pendingPlugins[plugin] === 1) {
          _updateText();
        }
      };
      archae.on('pluginloadstart', pluginloadstart);
      const pluginmount = plugin => {
        pendingPlugins[plugin]--;
        if (pendingPlugins[plugin] === 0) {
          delete pendingPlugins[plugin];

          _updateText();
        }
      }
      archae.on('pluginmount', pluginmount);

      const _updateText = () => {
        loaderPlugin.innerText = (() => {
          if (!loggedIn) {
            return 'Logging in...';
          } else {
            if (pendingPlugins.length > 0) {
              return pendingPlugins[0];
            } else {
              return 'Waiting for plugins...';
            }
          }
        })();
      };

      const cleanup = () => {
        loaderOverlay.style.display = 'none';

        archae.removeListener('pluginloadstart', pluginloadstart);
        archae.removeListener('pluginmount', pluginmount);
      };
      cleanups.push(cleanup);

      const _setLoggedIn = () => {
        loggedIn = true;

        _updateText();
      };
      const _destroy = () => {
        cleanup();
        cleanups.splice(cleanups.indexOf(cleanup), 1);
      };

      accept({
        setLoggedIn: _setLoggedIn,
        destroy: _destroy,
      });
    });

    return _requestBlocker()
      .then(blocker => {
        if (live) {
          const _resJson = res => {
            if (res.status >= 200 && res.status < 300) {
              return res.json();
            } else {
              return null;
            }
          };
          const _requestLogin = () => fetch(`${siteUrl}/id/api/address`, {
            credentials: 'include',
          })
            .then(_resJson)
            .then(({address}) => {
              blocker.setLoggedIn();

              return Promise.resolve(address);
            })
            .catch(err => {
              console.warn(err);

              blocker.setLoggedIn();

              return Promise.resolve(null);
            });
          const _requestPlugins = () => archae.requestPlugins([
            '/core/engines/bootstrap',
            '/core/engines/input',
            '/core/engines/webvr',
            '/core/engines/three',
            '/core/engines/anima',
            '/core/engines/resource',
            '/core/engines/cyborg',
            '/core/engines/biolumi',
            '/core/engines/rend',
            '/core/engines/keyboard',
            '/core/engines/teleport',
            '/core/engines/scale',
            '/core/engines/hand',
            '/core/engines/transform',
            '/core/engines/loader',
            '/core/engines/tags',
            '/core/engines/world',
            '/core/engines/entity',
            '/core/engines/file',
            '/core/engines/servers',
            '/core/engines/wallet',
            '/core/engines/notification',
            '/core/engines/config',
            '/core/engines/multiplayer',
            '/core/engines/voicechat',
            '/core/engines/stage',
            '/core/engines/fs',
            '/core/engines/somnifer',
            '/core/engines/stck',
            '/core/utils/js-utils',
            '/core/utils/type-utils',
            '/core/utils/network-utils',
            '/core/utils/geometry-utils',
            '/core/utils/hash-utils',
            '/core/utils/random-utils',
            '/core/utils/text-utils',
            '/core/utils/menu-utils',
            '/core/utils/skin-utils',
            '/core/utils/creature-utils',
            '/core/utils/sprite-utils',
            '/core/utils/vrid-utils',
          ]);

          return Promise.all([
            _requestLogin(),
            _requestPlugins(),
          ])
            .then(([
              address,
              [
                bootstrap,
                input,
                webvr,
                three,
                anima,
                resource,
                cyborg,
                biolumi,
                rend,
                keyboard,
                teleport,
                scale,
                hand,
                transform,
                loader,
                tags,
                world,
                entity,
                file,
                servers,
                wallet,
                notification,
                config,
                multiplayer,
                voicechat,
                stage,
                fs,
                somnifer,
                stck,
                jsUtils,
                typeUtils,
                networkUtils,
                geometryUtils,
                hashUtils,
                randomUtils,
                textUtils,
                menuUtils,
                skinUtils,
                creatureUtils,
                spriteUtils,
                vridUtils,
              ],
            ]) => {
              if (live) {
                blocker.destroy();

                const {THREE, scene, camera, renderer} = three;
                const {domElement} = renderer;
                const {EVENTS: INPUT_EVENTS} = input;
                const {events} = jsUtils;
                const {EventEmitter} = events;

                address = address || _makeId(); // if we failed to get the user's address, make one up
                bootstrap.setAddress(address);
                const supportsWebVR = webvr.supportsWebVR();

                const _update = () => {
                  rend.update();
                };
                /* const _updateEye = camera => {
                  rend.updateEye(camera);
                }; */
                const _updateStart = () => {
                  rend.updateStart();
                };
                const _updateEnd = () => {
                  rend.updateEnd();
                };
                /* const _renderStart = () => {
                  rend.renderStart();
                };
                const _renderEnd = () => {
                  rend.renderEnd();
                }; */

                const _enterNormal = () => {
                  _stopRenderLoop();

                  renderLoop = webvr.requestRenderLoop({
                    update: _update,
                    // updateEye: _updateEye,
                    updateStart: _updateStart,
                    updateEnd: _updateEnd,
                    /* renderStart: _renderStart,
                    renderEnd: _renderEnd, */
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
                    // updateEye: _updateEye,
                    updateStart: _updateStart,
                    updateEnd: _updateEnd,
                    /* renderStart: _renderStart,
                    renderEnd: _renderEnd, */
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
                        <div style="display: flex; width: 100%; margin: auto 0; padding: 20px 0; background-color: #000; color: #FFF; justify-content: center;">
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
                        <h1 style="display: flex; margin: 0; margin-bottom: 20px; font-size: 40px; font-weight: 300; justify-content: center;">Paused</span></h1>
                      `;
                      helper.addEventListener('dragover', e => {
                        e.preventDefault(); // needed to prevent browser drag-and-drop behavior
                      });

                      const enterHelperContent = document.createElement('div');
                      enterHelperContent.style.cssText = `display: flex; width: 500px; margin-bottom: 20px;`;
                      enterHelperContent.innerHTML = `\
                        <button style="display: inline-block; position: relative; height: 42px; margin-right: 10px; padding: 10px 20px; background-color: transparent; border: 1px solid; color: #FFF; font-family: ${fonts}; font-size: 13px; font-weight: 600; cursor: pointer; outline: none; box-sizing: border-box;" class=headset-button>Headset</button>
                        <button style="display: inline-block; position: relative; height: 42px; padding: 10px 20px; background-color: transparent; border: 1px solid; color: #FFF; font-family: ${fonts}; font-size: 13px; font-weight: 600; cursor: pointer; outline: none; box-sizing: border-box;" class=keyboard-button>Mouse + Keyboard</button>
                      `;

                      const errorMessage = document.createElement('div');
                      errorMessage.style.cssText = `width: 100%; height: 80px;`;
                      errorMessage.innerHTML = `\
                        <div style="margin-bottom: 15px; font-size: 18px; line-height: 1;">No WebVR</div>
                        <div style="font-size: 13px;">WebVR is not supported by your browser, so you can't use a headset. <a href="#" style="color: inherit; text-decoration: underline;">Learn more</a>
                      `;

                      const _enterHeadsetVR = () => {
                        _enterVR({
                          stereoscopic: true,
                          onExit: () => {
                            overlay.style.display = 'flex';

                            bootstrap.setVrMode(null);
                          },
                        });

                        bootstrap.setVrMode('hmd');

                        overlay.style.display = 'none';
                      };
                      const _enterKeyboardVR = () => {
                        _enterVR({
                          stereoscopic: false,
                          onExit: () => {
                            overlay.style.display = 'flex';

                            bootstrap.setVrMode(null);
                          },
                        });

                        bootstrap.setVrMode('keyboard');

                        overlay.style.display = 'none';
                      };

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
                          if (!webvr.isPresenting()) {
                            _enterHeadsetVR();
                          }
                        });

                        errorMessage.style.display = 'none';

                        window.onvrdisplayactivate = null;
                        window.addEventListener('vrdisplayactivate', e => {
                          _enterHeadsetVR();
                        });

                        const urlRequestPresent = _getQueryVariable('e');
                        if (webvr.displayIsPresenting() || urlRequestPresent === 'hmd') {
                          _enterHeadsetVR();
                        } else if (urlRequestPresent === 'keyboard') {
                          _enterKeyboardVR();
                        }
                      } else {
                        headsetButton.style.display = 'none';
                      }

                      const keyboardButton = $$(enterHelperContent, '.keyboard-button')[0];
                      _styleButton(keyboardButton);

                      keyboardButton.addEventListener('click', e => {
                        if (!webvr.isPresenting()) {
                          _enterKeyboardVR();
                        }
                      });

                      overlayContent.appendChild(helper);
                      helper.appendChild(enterHelperContent);
                      helper.appendChild(errorMessage);

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

                        getControllerLinearVelocity(side) {
                          const player = cyborg.getPlayer();
                          return player.getControllerLinearVelocity(side);
                        }

                        getControllerAngularVelocity(side) {
                          const player = cyborg.getPlayer();
                          return player.getControllerAngularVelocity(side);
                        }

                        getVrMode() {
                          return bootstrap.getVrMode();
                        }
                      }

                      class ZeoInputApi {
                        on(event, handler, options) {
                          return input.on(event, handler, options);
                        }

                        removeListener(event, handler) {
                          return input.removeListener(event, handler);
                        }

                        removeAllListeners(event) {
                          return input.removeAllListeners(event);
                        }

                        vibrate(side, value, time) {
                          webvr.vibrate(side, value, time);
                        }
                      }

                      class ZeoRenderApi {
                        constructor() {
                          /* rend.on('update', () => {
                            this.emit('update');
                          });
                          rend.on('updateStart', () => {
                            this.emit('updateStart');
                          });
                          rend.on('updateEnd', () => {
                            this.emit('updateEnd');
                          });
                          rend.on('updateEye', camera => {
                            this.emit('updateEye', camera);
                          });
                          rend.on('renderStart', () => {
                            this.emit('renderStart');
                          });
                          rend.on('renderEnd', () => {
                            this.emit('renderEnd');
                          });
                          tags.on('mutate', () => {
                            this.emit('mutate');
                          }); */
                        }

                        on(event, handler) {
                          return rend.on(event, handler);
                        }

                        removeListener(event, handler) {
                          return rend.removeListener(event, handler);
                        }

                        removeAllListeners(event) {
                          return rend.removeAllListeners(event);
                        }
                      }

                      class ZeoElementsApi {
                        registerEntity(pluginInstance, componentApi) {
                          tags.registerEntity(pluginInstance, componentApi);
                        }

                        unregisterEntity(pluginInstance, componentApi) {
                          tags.unregisterEntity(pluginInstance, componentApi);
                        }

                        getWorldElement() {
                          return tags.getWorldElement();
                        }

                        getEntitiesElement() {
                          return tags.getEntitiesElement();
                        }

                        makeListener(selector) {
                          return tags.makeListener(selector);
                        }

                        destroyListener(listener) {
                          tags.destroyListener(listener);
                        }

                        /* on(event, handler) {
                          return tags.on(event, handler);
                        }

                        removeListener(event, handler) {
                          return tags.removeListener(event, handler);
                        }

                        removeAllListeners(event) {
                          return tags.removeAllListeners(event);
                        } */
                      }

                      class ZeoWorldApi {
                        getWorldTime() {
                          return bootstrap.getWorldTime();
                        }

                        getTags() {
                          return bootstrap.getWorldTime();
                        }

                        getSpawnMatrix() {
                          return webvr.getSpawnMatrix();
                        }

                        setSpawnMatrix(spawnMatrix) {
                          webvr.setSpawnMatrix(spawnMatrix);
                        }
                      }

                      /* const controllerMeshes = (() => {
                        const controllers = cyborg.getControllers();
                        return {
                          left: controllers['left'].mesh,
                          right: controllers['right'].mesh,
                        };
                      })(); */
                      class ZeoPlayerApi {
                        getId() {
                          return multiplayer.getId();
                        }

                        /* getControllerMeshes() {
                          return controllerMeshes;
                        } */

                        getRemoteStatuses() {
                          return multiplayer.getPlayerStatuses();
                        }

                        getRemoteStatus(userId) {
                          return multiplayer.getPlayerStatus(userId);
                        }

                        getRemoteHmdMesh(userId) {
                          const remotePlayerMesh = multiplayer.getRemotePlayerMesh(userId);

                          if (remotePlayerMesh) {
                            const {hmd: hmdMesh} = remotePlayerMesh;
                            return hmdMesh;
                          } else {
                            return null;
                          }
                        }

                        getRemoteControllerMeshes(userId) {
                          return multiplayer.getRemoteControllerMeshes(userId);
                        }

                        setSkin(skinImg) {
                          return cyborg.setSkin(skinImg);
                        }

                        on(event, handler) {
                          return multiplayer.on(event, handler);
                        }

                        removeListener(event, handler) {
                          return multiplayer.removeListener(event, handler);
                        }

                        removeAllListeners(event) {
                          return multiplayer.removeAllListeners(event);
                        }
                      }

                      class ZeoUiApi {
                        makeUi(options) {
                          return biolumi.makeUi(options);
                        }

                        addPage(page) {
                          rend.addPage(page);
                        }

                        removePage(page) {
                          rend.removePage(page);
                        }

                        getHoverState(side) {
                          return rend.getHoverState(side);
                        }

                        getTransparentImg() {
                          return biolumi.getTransparentImg();
                        }
                      }

                      class ZeoSoundApi {
                        requestSfx(url) {
                          return somnifer.requestSfx(url);
                        }

                        makeBody() {
                          return somnifer.makeBody();
                        }
                      }

                      class ZeoStageApi {
                        getStage() {
                          return stage.getStage();
                        }

                        setStage(st) {
                          stage.setStage(st);
                        }

                        add(st, object) {
                          stage.add(st, object);
                        }

                        remove(st, object) {
                          stage.remove(st, object);
                        }

                       on() {
                          return stage.on.apply(stage, arguments);
                        }

                        removeListener() {
                          return stage.removeListener.apply(stage, arguments);
                        }

                        removeAllListeners() {
                          return stage.removeAllListeners.apply(stage, arguments);
                        }
                      }

                      class ZeoStckApi {
                        makeDynamicBoxBody() {
                          return stck.makeDynamicBoxBody.apply(stck, arguments);
                        }

                        makeStaticHeightfieldBody() {
                          return stck.makeStaticHeightfieldBody.apply(stck, arguments);
                        }

                        destroyBody(body) {
                          stck.destroyBody(body);
                        }
                      }

                      class ZeoIntersectApi {
                        makeIntersecter() {
                          return intersect.makeIntersecter();
                        }

                        destroyIntersecter(object) {
                          intersect.destroyIntersecter(object);
                        }
                      }

                      class ZeoTeleportApi {
                        addTarget(object, options) {
                          teleport.addTarget(object, options);
                        }

                        removeTarget(object) {
                          teleport.removeTarget(object);
                        }

                        getHoverState(side) {
                          return teleport.getHoverState(side);
                        }

                        on(event, handler, options) {
                          return teleport.on(event, handler, options);
                        }

                        removeListener(event, handler) {
                          return teleport.removeListener(event, handler);
                        }

                        removeAllListeners(event) {
                          return teleport.removeAllListeners(event);
                        }
                      }

                      class ZeoHandsApi {
                        makeGrabbable(id, options) {
                          return hand.makeGrabbable(id, options);
                        }

                        destroyGrabbable(grabbable) {
                          hand.destroyGrabbable(grabbable);
                        }

                        getGrabbedGrabbable(side) {
                          return hand.getGrabbedGrabbable(side);
                        }

                        on() {
                          return hand.on.apply(hand, arguments);
                        }

                        removeListener() {
                          return hand.removeListener.apply(hand, arguments);
                        }

                        removeAllListeners() {
                          return hand.removeAllListeners.apply(hand, arguments);
                        }
                      }

                      class ZeoTransformApi {
                        makeTransformGizmo(spec) {
                          return transform.makeTransformGizmo(spec);
                        }

                        destroyTransformGizmo(transformGizmo) {
                          return transform.destroyTransformGizmo(transformGizmo);
                        }
                      }

                      class ZeoAnimationApi {
                        makeAnimation(startValue, endValue, duration) {
                          return anima.makeAnimation(startValue, endValue, duration);
                        }
                      }

                      class ZeoItemsApi {
                        getItem(id) {
                          return wallet.getAsset(id);
                        }

                        makeItem(itemSpec) {
                          return wallet.makeItem(itemSpec);
                        }

                        destroyItem(item) {
                          wallet.destroyItem(item);
                        }

                        makeFile(options) {
                          return wallet.makeFile(options);
                        }

                        getFile(id) {
                          return fs.makeRemoteFileFromId(id);
                        }

                        registerItem(pluginInstance, itemApi) {
                          wallet.registerItem(pluginInstance, itemApi);
                        }

                        unregisterItem(pluginInstance, itemApi) {
                          wallet.unregisterItem(pluginInstance, itemApi);
                        }

                        registerEquipment(pluginInstance, equipmentApi) {
                          wallet.registerEquipment(pluginInstance, equipmentApi);
                        }

                        unregisterEquipment(pluginInstance, equipmentApi) {
                          wallet.unregisterEquipment(pluginInstance, equipmentApi);
                        }

                        registerRecipe(pluginInstance, recipe) {
                          craft.registerRecipe(pluginInstance, recipe);
                        }

                        unregisterRecipe(pluginInstance, recipe) {
                          craft.unregisterRecipe(pluginInstance, recipe);
                        }

                        getAssetsMaterial() {
                          return wallet.getAssetsMaterial();
                        }

                        on() {
                          return wallet.on.apply(wallet, arguments);
                        }

                        removeListener() {
                          return wallet.removeListener.apply(wallet, arguments);
                        }

                        removeAllListeners() {
                          return wallet.removeAllListeners.apply(wallet, arguments);
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
                          this.network = networkUtils;
                          this.geometry = geometryUtils;
                          this.hash = hashUtils;
                          this.random = randomUtils;
                          this.text = textUtils;
                          this.menu = menuUtils;
                          this.skin = skinUtils;
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
                          this.player = new ZeoPlayerApi();
                          this.ui = new ZeoUiApi();
                          this.sound = new ZeoSoundApi();
                          this.stage = new ZeoStageApi();
                          this.stck = new ZeoStckApi();
                          this.teleport = new ZeoTeleportApi();
                          this.hands = new ZeoHandsApi();
                          this.transform = new ZeoTransformApi();
                          this.animation = new ZeoAnimationApi();
                          this.items = new ZeoItemsApi();
                          this.utils = new ZeoUtilsApi();
                        }
                      }
                      const zeoApi = new ZeoApi();
                      window.zeo = zeoApi;

                      world.init();

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

const _makeId = () => Math.random().toString(36).substring(7);
const _getQueryVariable = (url, variable) => {
  const match = url.match(/\?(.+)$/);
  const query = match ? match[1] : '';
  const vars = query.split('&');

  for (let i = 0; i < vars.length; i++) {
    const pair = vars[i].split('=');

    if (decodeURIComponent(pair[0]) === variable) {
      return decodeURIComponent(pair[1]);
    }
  }
  return null;
};

module.exports = Zeo;

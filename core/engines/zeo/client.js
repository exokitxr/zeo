class Zeo {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {site: {url: siteUrl}}} = archae;

    let cleanups = [];
    this._cleanup = () => {
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
      const nativeHtml = document.createElement('native-html');
      nativeHtml.show();

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
        archae.removeListener('pluginmount', pluginmount);
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

    return _requestBlocker()
      .then(blocker => {
        if (live) {
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
            '/core/engines/loader',
            '/core/engines/tags',
            '/core/engines/world',
            '/core/engines/entity',
            '/core/engines/inventory',
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
            '/core/engines/admin',
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
          return _requestPlugins()
            .then(([
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
              loader,
              tags,
              world,
              entity,
              inventory,
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
              admin,
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
            ]) => {
              if (live) {
                const {THREE, scene, camera, renderer, canvas} = three;
                const {EVENTS: INPUT_EVENTS} = input;
                const {events} = jsUtils;
                const {EventEmitter} = events;
                const {vridApi} = vridUtils;

                blocker.destroy();

                vridApi.get('username')
                  .then(username => {
                    username = username || 'unknown-avatar';
                    bootstrap.setAddress({username});
                  });

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
                      document.body.insertBefore(overlay, document.body.firstChild);
                      const overlayContent = overlay.querySelector('.overlay-content');

                      const helper = document.createElement('div');
                      helper.style.cssText = `\
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                      `;
                      const fonts = biolumi.getFonts().replace(/"/g, "'");
                      helper.innerHTML = `\
                        <div style="display: flex;">
                          <button style="position: relative; background-color: #FFF; border: 0; outline: none; cursor: pointer;" class=headset-button>${vrSvg}</button>
                          <button style="position: relative; background-color: #FFF; border: 0; outline: none; cursor: pointer;" class=keyboard-button>${keyboardSvg}</button>
                          <button style="position: relative; background-color: #FFF; border: 0; outline: none; cursor: pointer;" class=microphone-button>${microphoneOffSvg}</button>
                          <a href="https://my.zeovr.io/" target="_blank" style="position: relative; display: flex; background-color: #FFF; border: 0; justify-content: center; align-items: center; outline: none; cursor: pointer;" class=account-button>${accountSvg}</a>
                        </div>
                      `;
                      helper.addEventListener('dragover', e => {
                        e.preventDefault(); // needed to prevent browser drag-and-drop behavior
                      });

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
                          button.style.backgroundColor = '#2196F3';
                          // button.style.borderColor = 'transparent';
                          // button.style.color = '#000';
                          button.querySelector('svg').style.fill = '#FFF';
                        });
                        button.addEventListener('mouseout', e => {
                          button.style.backgroundColor = '#FFF';
                          // button.style.borderColor = 'currentColor';
                          // button.style.color = '#FFF';
                          button.querySelector('svg').style.fill = null;
                        });
                      };

                      const headsetButton = $$(helper, '.headset-button')[0];
                      if (supportsWebVR) {
                        _styleButton(headsetButton);

                        headsetButton.addEventListener('click', e => {
                          if (!webvr.isPresenting()) {
                            _enterHeadsetVR();
                          }
                          e.preventDefault();
                        });

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
                        // headsetButton.style.display = 'none';
                        headsetButton.style.backgroundColor = '#666';
                        headsetButton.style.cursor = null;
                        const strikethroughEl = document.createElement('div');
                        strikethroughEl.style.cssText = `position: absolute; top: 50%; left: 0; right: 0; height: 3px; margin-top: -1px; background-color: #F44336;`;
                        headsetButton.appendChild(strikethroughEl);
                      }

                      const keyboardButton = $$(helper, '.keyboard-button')[0];
                      _styleButton(keyboardButton);
                      keyboardButton.addEventListener('click', e => {
                        if (!webvr.isPresenting()) {
                          _enterKeyboardVR();
                        }
                        e.preventDefault();
                      });
                      if (canvas.on) {
                        canvas.on('click', e => {
                          if (!webvr.isPresenting()) {
                            _enterKeyboardVR();
                          }
                        });
                      }

                      let microphone = false;
                      const microphoneButton = $$(helper, '.microphone-button')[0];
                      _styleButton(microphoneButton);
                      const _setMicrophone = newMicrophone => {
                        voicechat[newMicrophone ? 'enable' : 'disable']()
                          .then(() => {
                            microphone = newMicrophone;
                            
                            microphoneButton.innerHTML = microphone ? microphoneOnSvg : microphoneOffSvg;
                          })
                          .catch(err => {
                            console.warn(err);
                          });
                      };
                      microphoneButton.addEventListener('click', e => {
                        _setMicrophone(!microphone);
                        
                        e.preventDefault();
                      });

                      const accountButton = $$(helper, '.account-button')[0];
                      _styleButton(accountButton);

                      overlayContent.appendChild(helper);

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

                        addCollider(collider) {
                          webvr.addCollider(collider);
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

                        requestElement(selector) {
                          return tags.requestElement(selector);
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
                        requestCheck() {
                          return stck.requestCheck.apply(stck, arguments);
                        }

                        makeDynamicBoxBody() {
                          return stck.makeDynamicBoxBody.apply(stck, arguments);
                        }

                        makeStaticHeightfieldBody() {
                          return stck.makeStaticHeightfieldBody.apply(stck, arguments);
                        }

                        makeStaticEtherfieldBody() {
                          return stck.makeStaticEtherfieldBody.apply(stck, arguments);
                        }

                        makeStaticBlockfieldBody() {
                          return stck.makeStaticBlockfieldBody.apply(stck, arguments);
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

                      class ZeoAnimationApi {
                        makeAnimation(startValue, endValue, duration) {
                          return anima.makeAnimation(startValue, endValue, duration);
                        }
                      }

                      class ZeoNotificationApi {
                        addNotification(text) {
                          return notification.addNotification(text);
                        }

                        removeNotification(n) {
                          return notification.removeNotification(n);
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

                        reifyFile(options) {
                          return wallet.reifyFile(options);
                        }

                        getFile(id) {
                          return fs.makeRemoteFile(id);
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
                          this.vrid = vridUtils;
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
                          this.notification = new ZeoNotificationApi();
                          this.animation = new ZeoAnimationApi();
                          this.items = new ZeoItemsApi();
                          this.utils = new ZeoUtilsApi();
                        }
                      }
                      const zeoApi = new ZeoApi();
                      window.zeo = zeoApi;

                      renderer.compile(scene, camera);

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
const iconSize = 40;
const vrSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24"><path d="M20.74,6H3.2C2.55,6 2,6.57 2,7.27V17.73C2,18.43 2.55,19 3.23,19H8C8.54,19 9,18.68 9.16,18.21L10.55,14.74C10.79,14.16 11.35,13.75 12,13.75C12.65,13.75 13.21,14.16 13.45,14.74L14.84,18.21C15.03,18.68 15.46,19 15.95,19H20.74C21.45,19 22,18.43 22,17.73V7.27C22,6.57 21.45,6 20.74,6M7.22,14.58C6,14.58 5,13.55 5,12.29C5,11 6,10 7.22,10C8.44,10 9.43,11 9.43,12.29C9.43,13.55 8.44,14.58 7.22,14.58M16.78,14.58C15.56,14.58 14.57,13.55 14.57,12.29C14.57,11.03 15.56,10 16.78,10C18,10 19,11.03 19,12.29C19,13.55 18,14.58 16.78,14.58Z" /></svg>`;
const keyboardSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24"><path d="M6,16H18V18H6V16M6,13V15H2V13H6M7,15V13H10V15H7M11,15V13H13V15H11M14,15V13H17V15H14M18,15V13H22V15H18M2,10H5V12H2V10M19,12V10H22V12H19M18,12H16V10H18V12M8,12H6V10H8V12M12,12H9V10H12V12M15,12H13V10H15V12M2,9V7H4V9H2M5,9V7H7V9H5M8,9V7H10V9H8M11,9V7H13V9H11M14,9V7H16V9H14M17,9V7H22V9H17Z" /></svg>`;
const microphoneOnSvg = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24"><path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z" /></svg>`;
const microphoneOffSvg = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24"><path d="M19,11C19,12.19 18.66,13.3 18.1,14.28L16.87,13.05C17.14,12.43 17.3,11.74 17.3,11H19M15,11.16L9,5.18V5A3,3 0 0,1 12,2A3,3 0 0,1 15,5V11L15,11.16M4.27,3L21,19.73L19.73,21L15.54,16.81C14.77,17.27 13.91,17.58 13,17.72V21H11V17.72C7.72,17.23 5,14.41 5,11H6.7C6.7,14 9.24,16.1 12,16.1C12.81,16.1 13.6,15.91 14.31,15.58L12.65,13.92L12,14A3,3 0 0,1 9,11V10.28L3,4.27L4.27,3Z" /></svg>`;
const accountSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24"><path d="M12,19.2C9.5,19.2 7.29,17.92 6,16C6.03,14 10,12.9 12,12.9C14,12.9 17.97,14 18,16C16.71,17.92 14.5,19.2 12,19.2M12,5A3,3 0 0,1 15,8A3,3 0 0,1 12,11A3,3 0 0,1 9,8A3,3 0 0,1 12,5M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12C22,6.47 17.5,2 12,2Z" /></svg>`;

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

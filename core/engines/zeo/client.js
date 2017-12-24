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
      nativeHtml.show && nativeHtml.show();

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
            '/core/engines/analytics',
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
              analytics,
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

                const _requestImage = src => new Promise((accept, reject) => {
                  const img = new Image();
                  img.src = src;
                  img.onload = () => {
                    accept(img);
                  };
                  img.onerror = err => {
                    reject(err);
                  };
                });
                const _requestImageBitmap = src => _requestImage(src)
                  .then(img => createImageBitmap(img, 0, 0, img.width, img.height));

                const blockerTexture = new THREE.Texture(
                  null,
                  THREE.UVMapping,
                  THREE.ClampToEdgeWrapping,
                  THREE.ClampToEdgeWrapping,
                  THREE.LinearFilter,
                  THREE.LinearFilter,
                  THREE.RGBAFormat,
                  THREE.UnsignedByteType,
                  1
                );
                const _renderBlocker = () => {
                  Promise.all([
                    _requestImageBitmap(voicechat.isEnabled() ? '/archae/plugins/_core_engines_zeo/serve/img/mic-on.png' : '/archae/plugins/_core_engines_zeo/serve/img/mic-off.png'),
                    _requestImageBitmap(webvr.supportsWebVR() ? '/archae/plugins/_core_engines_zeo/serve/img/google-cardboard.png' : '/archae/plugins/_core_engines_zeo/serve/img/google-cardboard-x.png'),
                  ])
                    .then(([
                      micImg,
                      vrImg,
                    ]) => {
                      const canvas = document.createElement('canvas');
                      canvas.width = micImg.width + vrImg.width;
                      canvas.height = Math.max(micImg.height, vrImg.height);
                      const ctx = canvas.getContext('2d');

                      ctx.drawImage(micImg, 0, 0);
                      ctx.drawImage(vrImg, micImg.width, 0);

                      blockerTexture.image = canvas;
                      blockerTexture.needsUpdate = true;
                    })
                    .catch(err => {
                      console.warn(err);
                    });
                };
                _renderBlocker();

                const localMatrix = new THREE.Matrix4();
                const blockerMesh = (() => {
                  const geometry = new THREE.PlaneBufferGeometry(1, 1);

                  const vertexShader = `\
                    uniform mat4 u_matrix;

                    varying vec2 v_texcoord;

                    void main() {
                      gl_Position = u_matrix * vec4(position, 1.0);
                      v_texcoord = uv;
                    }
                  `;
                  const fragmentShader = `\
                    varying vec2 v_texcoord;

                    uniform sampler2D u_texture;

                    void main() {
                      gl_FragColor = vec4(texture2D(u_texture, v_texcoord).rgb, 1.0);
                    }
                  `;

                  const texWidth = renderer.domElement.width * 0.1;
                  const texHeight = renderer.domElement.width * 0.1;
                  const dstX = 0.85 * renderer.domElement.width;
                  const dstY = 0.1 * renderer.domElement.width;
                  const matrix = new THREE.Matrix4().makeOrthographic(0, renderer.domElement.width, renderer.domElement.height, 0, -1, 1);
                  matrix.multiply(localMatrix.makeTranslation(dstX, dstY, 1));
                  matrix.multiply(localMatrix.makeScale(texWidth * 2, texHeight, 1));
                  const material = new THREE.ShaderMaterial({
                    uniforms: {
                      u_matrix: {
                        type: 'm4',
                        value: matrix,
                      },
                      u_texture: {
                        type: 't',
                        value: blockerTexture,
                      },
                    },
                    vertexShader,
                    fragmentShader,
                  });
                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.frustumCulled = false;
                  return mesh;
                })();
                scene.add(blockerMesh);

                blocker.destroy();

                vridApi.get('username')
                  .then(username => {
                    username = username || 'unknown-avatar';
                    bootstrap.setAddress({username});
                  });

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
                const _enterVR = ({stereoscopic, spectate, onExit}) => {
                  _stopRenderLoop();

                  blockerMesh.visible = false;

                  const _onExit = () => {
                    onExit();

                    _enterNormal();

                    blockerMesh.visible = true;
                  };

                  renderLoop = webvr.requestEnterVR({
                    stereoscopic,
                    spectate,
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

                      renderer.domElement.addEventListener('dragover', e => {
                        e.preventDefault(); // needed to prevent browser drag-and-drop behavior
                      });

                      const _enterHeadsetVR = () => {
                        _enterVR({
                          stereoscopic: true,
                          spectate: false,
                          onExit: () => {
                            bootstrap.setVrMode(null);
                          },
                        });

                        bootstrap.setVrMode('hmd');
                      };
                      const _enterSpectateVR = () => {
                        _enterVR({
                          stereoscopic: false,
                          spectate: true,
                          onExit: () => {
                            bootstrap.setVrMode(null);
                          },
                        });

                        bootstrap.setVrMode('keyboard');
                      };
                      const _enterKeyboardVR = () => {
                        _enterVR({
                          stereoscopic: false,
                          spectate: false,
                          onExit: () => {
                            bootstrap.setVrMode(null);
                          },
                        });

                        bootstrap.setVrMode('keyboard');
                      };

                      if (!bootstrap.isSpectating()) {
                        window.onvrdisplayactivate = null;
                        window.addEventListener('vrdisplayactivate', () => {
                          _enterHeadsetVR();
                        });

                        canvas.addEventListener('click', e => {
                          if (!webvr.isPresenting()) {
                            const iconSize = parseInt(canvas.style.width, 10) * 0.1;
                            const fx = parseInt(canvas.style.width, 10) - e.clientX;
                            const fy = parseInt(canvas.style.height, 10) - e.clientY;
                            if (fx >= iconSize*0.5 && fx <= iconSize*1.5 && fy >= iconSize*0.5 && fy <= iconSize*1.5) {
                              if (webvr.supportsWebVR()) {
                                _enterHeadsetVR();
                              }
                            } else if (fx >= iconSize*1.5 && fx <= iconSize*2.5 && fy >= iconSize*0.5 && fy <= iconSize*1.5) {
                              if (voicechat.isEnabled()) {
                                voicechat.disable();
                              } else {
                                voicechat.enable();
                              }

                              _renderBlocker();
                            } else {
                              _enterKeyboardVR();
                            }
                          }
                        });

                        const urlRequestPresent = _getQueryVariable(window.location.search, 'e');
                        if (webvr.supportsWebVR() && urlRequestPresent === 'hmd') {
                          _enterHeadsetVR();
                        } else if (urlRequestPresent === 'keyboard') {
                          _enterKeyboardVR();
                        }
                      } else {
                        _enterSpectateVR();
                      }

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

                        requestPlugin(selector) {
                          return loader.requestLoadedPlugin(selector);
                        }

                        on(event, handler) {
                          return loader.on(event, handler);
                        }

                        removeListener(event, handler) {
                          return loader.removeListener(event, handler);
                        }

                        removeAllListeners(event) {
                          return loader.removeAllListeners(event);
                        }
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

                        /* makeFile(options) {
                          return wallet.makeFile(options);
                        }

                        reifyFile(options) {
                          return wallet.reifyFile(options);
                        }

                        getFile(id) {
                          return fs.makeRemoteFile(id);
                        } */

                        makeServerFile(id, name) {
                          return fs.makeServerFile(id, name);
                        }

                        requestStorageFiles() {
                          return fs.requestStorageFiles();
                        }

                        requestMakeStorageFile(id, name, ext) {
                          return fs.requestMakeStorageFile(id, name, ext);
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

                        getAssetInstances() {
                          return wallet.getAssetInstances();
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

import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,

  NAVBAR_WIDTH,
  NAVBAR_HEIGHT,
  NAVBAR_WORLD_WIDTH,
  NAVBAR_WORLD_HEIGHT,
  NAVBAR_WORLD_DEPTH,

  DEFAULT_USER_HEIGHT,
  TRANSITION_TIME,
} from './lib/constants/menu';
import {
  KEYBOARD_WIDTH,
  KEYBOARD_HEIGHT,
  KEYBOARD_WORLD_WIDTH,
  KEYBOARD_WORLD_HEIGHT,
} from './lib/constants/keyboard';
import menuUtils from './lib/utils/menu';
import keyboardImg from './lib/img/keyboard';
import menuRender from './lib/render/menu';

const keyboardImgSrc = 'data:image/svg+xml;base64,' + btoa(keyboardImg);

const SIDES = ['left', 'right'];

class Rend {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {server: {worldname: serverWorldname, enabled: serverEnabled}, hub: {url: hubUrl}}} = archae;

    let live = true;
    const cleanups = [];
    this._cleanup = () => {
      live = false;

      const oldCleanups = cleanups.slice();
      for (let i = 0; i < oldCleanups.length; i++) {
        const cleanup = oldCleanups[i];
        cleanup();
      }
    };

    return archae.requestPlugins([
      '/core/engines/bootstrap',
      '/core/engines/input',
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/engines/biolumi',
      '/core/engines/anima',
      '/core/utils/js-utils',
      '/core/utils/geometry-utils',
      '/core/utils/creature-utils',
    ]).then(([
      bootstrap,
      input,
      three,
      webvr,
      biolumi,
      anima,
      jsUtils,
      geometryUtils,
      creatureUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera, renderer} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;

        const transparentImg = biolumi.getTransparentImg();
        const transparentMaterial = biolumi.getTransparentMaterial();

        const _parseUrlSpec = url => {
          const match = url.match(/^(?:([^:]+):\/\/)([^:]+)(?::([0-9]*?))?$/);
          return match && {
            protocol: match[1],
            host: match[2],
            port: match[3] ? parseInt(match[3], 10) : null,
          };
        };
        const hubSpec = _parseUrlSpec(hubUrl);

        const oneVector = new THREE.Vector3(1, 1, 1);

        const menuRenderer = menuRender.makeRenderer({
          creatureUtils,
        });

        const _decomposeObjectMatrixWorld = object => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          object.matrixWorld.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        const localUpdates = [];

        const auxObjects = {
          tagMeshes: null,
          tagsLinesMesh: null,
        };

        const menuState = {
          open: false,
          position: null,
          rotation: null,
          loggedIn: false,
          animation: null,
        };
        const statusState = {
          username: null,
          worldname: serverWorldname,
          users: null,
          hasHub: Boolean(hubSpec),
          loading: true,
        };
        const navbarState = {
          tab: 'status',
        };

        const {matrix: matrixArray} = bootstrap.getUserState();
        if (matrixArray) {
          webvr.setStageMatrix(new THREE.Matrix4().fromArray(matrixArray));
          webvr.updateStatus();
        }

        const menuMesh = (() => {
          if (serverEnabled) {
            const menuUi = biolumi.makeUi({
              width: WIDTH,
              height: HEIGHT,
            });
            const navbarUi = biolumi.makeUi({
              width: NAVBAR_WIDTH,
              height: NAVBAR_HEIGHT,
            });

            const menuMesh = (() => {
              const object = new THREE.Object3D();
              object.position.set(0, DEFAULT_USER_HEIGHT, -1.5);
              object.visible = menuState.open;
              object.menuUi = menuUi;
              object.navbarUi = navbarUi;

              const statusMesh = (() => {
                const mesh = menuUi.addPage(({
                  status,
                }) => ({
                  type: 'html',
                  src: menuRenderer.getStatusSrc({status}),
                  x: 0,
                  y: 0,
                  w: WIDTH,
                  h: HEIGHT,
                }), {
                  type: 'status',
                  state: {
                    status: statusState,
                  },
                  worldWidth: WORLD_WIDTH,
                  worldHeight: WORLD_HEIGHT,
                });
                mesh.receiveShadow = true;

                return mesh;
              })();
              object.add(statusMesh);
              object.statusMesh = statusMesh;

              object.worldMesh = null;
              object.universeMesh = null;
              object.configMesh = null;
              object.statsMesh = null;
              object.trashMesh = null;

              const navbarMesh = (() => {
                const mesh = navbarUi.addPage(({
                  navbar: {
                    tab,
                  },
                }) => ({
                  type: 'html',
                  src: menuRenderer.getNavbarSrc({tab}),
                  x: 0,
                  y: 0,
                  w: NAVBAR_WIDTH,
                  h: NAVBAR_HEIGHT,
                }), {
                  type: 'navbar',
                  state: {
                    navbar: navbarState,
                  },
                  worldWidth: NAVBAR_WORLD_WIDTH,
                  worldHeight: NAVBAR_WORLD_HEIGHT,
                });
                mesh.position.y = (WORLD_HEIGHT / 2) + (NAVBAR_WORLD_HEIGHT / 2);
                mesh.receiveShadow = true;

                return mesh;
              })();
              object.add(navbarMesh);
              object.navbarMesh = navbarMesh;

              const shadowMesh = (() => {
                const geometry = new THREE.BoxBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT + NAVBAR_WORLD_HEIGHT, 0.01);
                const material = transparentMaterial.clone();
                material.depthWrite = false;

                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = NAVBAR_WORLD_HEIGHT / 2;
                mesh.castShadow = true;
                return mesh;
              })();
              object.add(shadowMesh);

              return object;
            })();
            scene.add(menuMesh);

            const menuHoverStates = {
              left: biolumi.makeMenuHoverState(),
              right: biolumi.makeMenuHoverState(),
            };
            const navbarHoverStates = {
              left: biolumi.makeMenuHoverState(),
              right: biolumi.makeMenuHoverState(),
            };

            const menuDotMeshes = {
              left: biolumi.makeMenuDotMesh(),
              right: biolumi.makeMenuDotMesh(),
            };
            scene.add(menuDotMeshes.left);
            scene.add(menuDotMeshes.right);

            const menuBoxMeshes = {
              left: biolumi.makeMenuBoxMesh(),
              right: biolumi.makeMenuBoxMesh(),
            };
            scene.add(menuBoxMeshes.left);
            scene.add(menuBoxMeshes.right);

            const navbarDotMeshes = {
              left: biolumi.makeMenuDotMesh(),
              right: biolumi.makeMenuDotMesh(),
            };
            scene.add(navbarDotMeshes.left);
            scene.add(navbarDotMeshes.right);

            const navbarBoxMeshes = {
              left: biolumi.makeMenuBoxMesh(),
              right: biolumi.makeMenuBoxMesh(),
            };
            scene.add(navbarBoxMeshes.left);
            scene.add(navbarBoxMeshes.right);

            const trigger = e => {
              const {open} = menuState;

              if (open) {
                const {side} = e;

                const _doClickNavbar = () => {
                  const navbarHoverState = navbarHoverStates[side];
                  const {anchor} = navbarHoverState;
                  const onclick = (anchor && anchor.onclick) || '';

                  let match;
                  if (match = onclick.match(/^navbar:(status|world|worlds|options)$/)) {
                    const newTab = match[1];

                    const _getTabMesh = tab => {
                      switch (tab) {
                        case 'status': return menuMesh.statusMesh;
                        case 'world': return menuMesh.worldMesh;
                        case 'worlds': return menuMesh.universeMesh;
                        case 'options': return menuMesh.configMesh;
                        default: return null;
                      }
                    };

                    const {tab: oldTab} = navbarState;
                    const oldMesh = _getTabMesh(oldTab);
                    const newMesh = _getTabMesh(newTab);

                    oldMesh.visible = false;
                    newMesh.visible = true;

                    navbarState.tab = newTab;

                    _updateNavbarPage();

                    rendApi.emit('tabchange', newTab);

                    return true;
                  } else {
                    return false;
                  }
                };
                const _doClickMenu = () => {
                  const menuHoverState = menuHoverStates[side];
                  const {anchor} = menuHoverState;
                  const onclick = (anchor && anchor.onclick) || '';

                  if (onclick === 'status:downloadLoginToken') {
                    const a = document.createElement('a');
                    a.href = '/server/token';
                    a.download = 'token.txt';
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);

                    return true;
                  } else if (onclick === 'status:logOut') {
                    const _requestLogout = () => new Promise((accept, reject) => {
                      bootstrap.requestLogout()
                        .then(() => {
                          accept();
                        })
                        .catch(err => {
                          console.warn(err);

                          accept();
                        });
                    });

                    _requestLogout()
                      .then(() => {
                        rendApi.logout();
                      });

                    return true;
                  } else if (onclick === 'status:snapshotWorld') {
                    // XXX implement this

                    return true;
                  } else if (onclick === 'status:backToHub') {
                    const initialToken = _getQueryVariable(bootstrap.getInitialUrl(), 't');
                    bootstrap.navigate('https://' + hubUrl + (initialToken ? ('?t=' + initialToken) : ''));

                    return true; // can't happen
                  } else {
                    return false;
                  }
                };

                _doClickNavbar();
                _doClickMenu();
              }
            };
            input.on('trigger', trigger);
            const menudown = () => {
              const {loggedIn} = menuState;

              if (loggedIn) {
                const {open, animation} = menuState;

                if (open) {
                  SIDES.forEach(side => {
                    menuBoxMeshes[side].visible = false;
                    menuDotMeshes[side].visible = false;

                    navbarBoxMeshes[side].visible = false;
                    navbarDotMeshes[side].visible = false;
                  });

                  menuState.open = false; // XXX need to cancel other menu states as well
                  menuState.position = null;
                  menuState.rotation = null;
                  menuState.animation = anima.makeAnimation(TRANSITION_TIME);

                  const {tagsLinesMesh} = auxObjects;
                  tagsLinesMesh.visible = false;
                } else {
                  const newMenuRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
                    0,
                    camera.rotation.y,
                    0,
                    camera.rotation.order
                  ));
                  const newMenuPosition = camera.position.clone()
                    .add(new THREE.Vector3(0, 0, -1.5).applyQuaternion(newMenuRotation));
                  menuMesh.position.copy(newMenuPosition);
                  menuMesh.quaternion.copy(newMenuRotation);

                  const newKeyboardPosition = camera.position;
                  keyboardMesh.position.copy(newKeyboardPosition);
                  keyboardMesh.quaternion.copy(newMenuRotation);
                  keyboardMesh.updateKeySpecAnchorBoxTargets();

                  menuState.open = true;
                  menuState.position = newMenuPosition.toArray();
                  menuState.rotation = newMenuRotation.toArray();
                  menuState.animation = anima.makeAnimation(TRANSITION_TIME);

                  const {tagsLinesMesh} = auxObjects;
                  tagsLinesMesh.visible = true;
                }
              }
            };
            input.on('menudown', menudown);

            localUpdates.push(() => {
              const _updateMeshAnimations = () => {
                const {animation} = menuState;

                if (animation) {
                  const {open} = menuState;

                  const startValue = open ? 0 : 1;
                  const endValue = 1 - startValue;
                  const factor = animation.getValue();
                  const value = ((1 - factor) * startValue) + (factor * endValue);

                  const {tagMeshes} = auxObjects;
                  const animatedMeshSpecs = [
                    {
                      mesh: menuMesh,
                      direction: 'y',
                    },
                    {
                      mesh: keyboardMesh,
                      direction: 'x',
                    },
                  ].concat(tagMeshes.map(tagMesh => ({
                    mesh: tagMesh,
                    direction: 'y',
                  })));

                  if (factor < 1) {
                    if (value > 0.001) {
                      animatedMeshSpecs.forEach(meshSpec => {
                        const {direction, mesh} = meshSpec;

                        switch (direction) {
                          case 'x':
                            mesh.scale.set(value, 1, 1);
                            break;
                          case 'y':
                            mesh.scale.set(1, value, 1);
                            break;
                          case 'z':
                            mesh.scale.set(1, 1, value);
                            break;
                        }

                        if (!mesh.visible) {
                          mesh.visible = (('initialVisible' in mesh) ? mesh.initialVisible : true);
                        }
                      });
                    } else {
                      animatedMeshSpecs.forEach(meshSpec => {
                        const {mesh} = meshSpec;

                        mesh.visible = false;
                      });
                    }
                  } else {
                    animatedMeshSpecs.forEach(meshSpec => {
                      const {mesh} = meshSpec;

                      mesh.scale.set(1, 1, 1);

                      if (open && !mesh.visible) {
                        mesh.visible = (('initialVisible' in mesh) ? mesh.initialVisible : true);
                      } else if (!open && mesh.visible) {
                        mesh.visible = false;
                      }
                    });

                    menuState.animation = null;
                  }
                }
              };
              const _updateMenuAnchors = () => {
                const {open} = menuState;

                if (open) {
                  const {gamepads} = webvr.getStatus();

                  const {statusMesh, navbarMesh} = menuMesh;
                  const menuMatrixObject = _decomposeObjectMatrixWorld(statusMesh);
                  const {page: statusPage} = statusMesh;
                  const navbarMatrixObject = _decomposeObjectMatrixWorld(navbarMesh);
                  const {page: navbarPage} = navbarMesh;

                  SIDES.forEach(side => {
                    const gamepad = gamepads[side];

                    if (gamepad) {
                      const {position: controllerPosition, rotation: controllerRotation, scale: controllerScale} = gamepad;

                      const menuHoverState = menuHoverStates[side];
                      const menuDotMesh = menuDotMeshes[side];
                      const menuBoxMesh = menuBoxMeshes[side];

                      const navbarHoverState = navbarHoverStates[side];
                      const navbarDotMesh = navbarDotMeshes[side];
                      const navbarBoxMesh = navbarBoxMeshes[side];

                      const {tab} = navbarState;
                      if (tab === 'status') {
                        biolumi.updateAnchors({
                          objects: [{
                            matrixObject: menuMatrixObject,
                            page: statusPage,
                            width: WIDTH,
                            height: HEIGHT,
                            worldWidth: WORLD_WIDTH,
                            worldHeight: WORLD_HEIGHT,
                            worldDepth: WORLD_DEPTH,
                          }],
                          hoverState: menuHoverState,
                          dotMesh: menuDotMesh,
                          boxMesh: menuBoxMesh,
                          controllerPosition,
                          controllerRotation,
                          controllerScale,
                        });
                      }

                      biolumi.updateAnchors({
                        objects: [{
                          matrixObject: navbarMatrixObject,
                          page: navbarPage,
                          width: NAVBAR_WIDTH,
                          height: NAVBAR_HEIGHT,
                          worldWidth: NAVBAR_WORLD_WIDTH,
                          worldHeight: NAVBAR_WORLD_HEIGHT,
                          worldDepth: NAVBAR_WORLD_DEPTH,
                        }],
                        hoverState: navbarHoverState,
                        dotMesh: navbarDotMesh,
                        boxMesh: navbarBoxMesh,
                        controllerPosition,
                        controllerRotation,
                        controllerScale,
                      });
                    }
                  });
                }
              };

              _updateMeshAnimations();
              _updateMenuAnchors();
            });

            cleanups.push(() => {
              scene.remove(menuMesh);
              SIDES.forEach(side => {
                scene.remove(menuDotMeshes[side]);
                scene.remove(menuBoxMeshes[side]);
                scene.remove(navbarDotMeshes[side]);
                scene.remove(navbarBoxMeshes[side]);
              });
              input.removeListener('trigger', trigger);
              input.removeListener('menudown', menudown);
            });

            return menuMesh;
          } else {
            return null;
          }
        })();

        const keyboardMesh = (() => {
          const object = new THREE.Object3D();
          object.position.set(0, DEFAULT_USER_HEIGHT, 0);
          object.visible = menuState.open;

          const planeMesh = (() => {
            const _requestKeyboardImage = () => new Promise((accept, reject) => {
              const img = new Image();
              img.src = keyboardImgSrc;
              img.onload = () => {
                accept(img);
              };
              img.onerror = err => {
                reject(err);
              };
            });

            const geometry = new THREE.PlaneBufferGeometry(KEYBOARD_WORLD_WIDTH, KEYBOARD_WORLD_HEIGHT);
            const material = (() => {
              const texture = new THREE.Texture(
                transparentImg,
                THREE.UVMapping,
                THREE.ClampToEdgeWrapping,
                THREE.ClampToEdgeWrapping,
                THREE.LinearFilter,
                THREE.LinearFilter,
                THREE.RGBAFormat,
                THREE.UnsignedByteType,
                16
              );

              _requestKeyboardImage()
                .then(img => {
                  texture.image = img;
                  texture.needsUpdate = true;
                })
                .catch(err => {
                  console.warn(err);
                });

              const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
                transparent: true,
                alphaTest: 0.5,
              });
              return material;
            })();
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.y = 1 - DEFAULT_USER_HEIGHT;
            mesh.position.z = -0.4;
            mesh.rotation.x = -Math.PI * (3 / 8);

            const shadowMesh = (() => {
              const geometry = new THREE.BoxBufferGeometry(KEYBOARD_WORLD_WIDTH, KEYBOARD_WORLD_HEIGHT, 0.01);
              const material = transparentMaterial;
              const mesh = new THREE.Mesh(geometry, material);
              mesh.castShadow = true;
              return mesh;
            })();
            mesh.add(shadowMesh);

            return mesh;
          })();
          object.add(planeMesh);
          object.planeMesh = planeMesh;

          const keySpecs = (() => {
            class KeySpec {
              constructor(key, rect) {
                this.key = key;
                this.rect = rect;

                this.anchorBoxTarget = null;
              }
            }

            const div = document.createElement('div');
            div.style.cssText = 'position: absolute; top: 0; left: 0; width: ' + KEYBOARD_WIDTH + 'px; height: ' + KEYBOARD_HEIGHT + 'px;';
            div.innerHTML = keyboardImg;

            document.body.appendChild(div);

            const keyEls = div.querySelectorAll(':scope > svg > g[key]');
            const result = Array(keyEls.length);
            for (let i = 0; i < keyEls.length; i++) {
              const keyEl = keyEls[i];
              const key = keyEl.getAttribute('key');
              const rect = keyEl.getBoundingClientRect();

              const keySpec = new KeySpec(key, rect);
              result[i] = keySpec;
            }

            document.body.removeChild(div);

            return result;
          })();
          object.keySpecs = keySpecs;

          const _updateKeySpecAnchorBoxTargets = () => {
            object.updateMatrixWorld();
            const {position: keyboardPosition, rotation: keyboardRotation} = _decomposeObjectMatrixWorld(planeMesh);

            for (let i = 0; i < keySpecs.length; i++) {
              const keySpec = keySpecs[i];
              const {key, rect} = keySpec;

              const anchorBoxTarget = geometryUtils.makeBoxTargetOffset(
                keyboardPosition,
                keyboardRotation,
                oneVector,
                new THREE.Vector3(
                  -(KEYBOARD_WORLD_WIDTH / 2) + (rect.left / KEYBOARD_WIDTH) * KEYBOARD_WORLD_WIDTH,
                  (KEYBOARD_WORLD_HEIGHT / 2) + (-rect.top / KEYBOARD_HEIGHT) * KEYBOARD_WORLD_HEIGHT,
                  -WORLD_DEPTH
                ),
                new THREE.Vector3(
                  -(KEYBOARD_WORLD_WIDTH / 2) + (rect.right / KEYBOARD_WIDTH) * KEYBOARD_WORLD_WIDTH,
                  (KEYBOARD_WORLD_HEIGHT / 2) + (-rect.bottom / KEYBOARD_HEIGHT) * KEYBOARD_WORLD_HEIGHT,
                  WORLD_DEPTH
                )
              );
              keySpec.anchorBoxTarget = anchorBoxTarget;
            }
          };
          _updateKeySpecAnchorBoxTargets();
          object.updateKeySpecAnchorBoxTargets = _updateKeySpecAnchorBoxTargets;

          return object;
        })();
        scene.add(keyboardMesh);

        const keyboardBoxMeshes = {
          left: biolumi.makeMenuBoxMesh(),
          right: biolumi.makeMenuBoxMesh(),
        };
        scene.add(keyboardBoxMeshes.left);
        scene.add(keyboardBoxMeshes.right);

        cleanups.push(() => {
          scene.remove(keyboardMesh);
          SIDES.forEach(side => {
            scene.remove(keyboardBoxMeshes[side]);
          });
        });

        let lastMenuStatusJsonString = '';
        const _updateMenuPage = () => {
          if (menuMesh) {
            const menuStatusJsonString = JSON.stringify(statusState);

            if (menuStatusJsonString !== lastMenuStatusJsonString) {
              const {menuUi} = menuMesh;
              menuUi.update();

              lastMenuStatusJsonString = menuStatusJsonString;
            }
          };
        };
        const _updateNavbarPage = () => {
          if (menuMesh) {
            const {navbarUi} = menuMesh;
            navbarUi.update()
          };
        };
        const _updatePages = () => {
          _updateMenuPage();
          _updateNavbarPage();
        };
        _updatePages();

        const _makeKeyboardHoverState = () => ({
          key: null,
        });
        const keyboardHoverStates = {
          left: _makeKeyboardHoverState(),
          right: _makeKeyboardHoverState(),
        };

        localUpdates.push(() => {
          const _updateRenderer = () => {
            renderer.shadowMap.needsUpdate = true;
          };
          const _updateUiTimer = () => {
            biolumi.updateUiTimer();
          };
          const _updateKeyboardAnchors = () => {
            const {open} = menuState;

            if (open) {
              const {gamepads} = webvr.getStatus();

              const {statusMesh, navbarMesh} = menuMesh;
              const menuMatrixObject = _decomposeObjectMatrixWorld(statusMesh);
              const {page: statusPage} = statusMesh;
              const navbarMatrixObject = _decomposeObjectMatrixWorld(navbarMesh);
              const {page: navbarPage} = navbarMesh;

              SIDES.forEach(side => {
                const gamepad = gamepads[side];

                if (gamepad) {
                  const {position: controllerPosition} = gamepad;

                  const keyboardHoverState = keyboardHoverStates[side];
                  const keyboardBoxMesh = keyboardBoxMeshes[side];

                  // NOTE: there should be at most one intersecting anchor box since keys do not overlap
                  const {keySpecs} = keyboardMesh;
                  const newKeySpec = keySpecs.find(keySpec => keySpec.anchorBoxTarget.containsPoint(controllerPosition));

                  const {key: oldKey} = keyboardHoverState;
                  const newKey = newKeySpec ? newKeySpec.key : null;
                  keyboardHoverState.key = newKey;

                  if (oldKey && newKey !== oldKey) {
                    const key = oldKey;
                    const keyCode = biolumi.getKeyCode(key);

                    input.triggerEvent('keyboardup', {
                      key,
                      keyCode,
                      side,
                    });
                  }
                  if (newKey && newKey !== oldKey) {
                    const key = newKey;
                    const keyCode = biolumi.getKeyCode(key);

                    input.triggerEvent('keyboarddown', {
                      key,
                      keyCode,
                      side,
                    });
                    input.triggerEvent('keyboardpress', {
                      key,
                      keyCode,
                      side,
                    });
                  }

                  if (newKeySpec) {
                    const {anchorBoxTarget} = newKeySpec;

                    keyboardBoxMesh.position.copy(anchorBoxTarget.position);
                    keyboardBoxMesh.quaternion.copy(anchorBoxTarget.quaternion);
                    keyboardBoxMesh.scale.copy(anchorBoxTarget.size);

                    if (!keyboardBoxMesh.visible) {
                      keyboardBoxMesh.visible = true;
                    }
                  } else {
                    if (keyboardBoxMesh.visible) {
                      keyboardBoxMesh.visible = false;
                    }
                  }
                }
              });
            }
          };

          _updateRenderer();
          _updateUiTimer();
          _updateKeyboardAnchors();
        });

        const unload = e => {
          bootstrap.saveUserStateAsync();
        };
        window.addEventListener('unload', unload);
        cleanups.push(() => {
          window.removeEventListener('unload', unload);
        });

        class RendApi extends EventEmitter {
          constructor() {
            super();

            this.setMaxListeners(100);
          }

          isOpen() {
            return menuState.open;
          }

          getMenuState() {
            const {open, position, rotation} = menuState;

            return {
              open,
              position,
              rotation
            };
          }

          getTab() {
            return navbarState.tab;
          }

          getMenuMesh() {
            return menuMesh;
          }

          registerMenuMesh(name, object) {
            menuMesh.add(object);
            menuMesh[name] = object;
          }

          registerAuxObject(name, object) {
            auxObjects[name] = object;
          }

          getStatus(name) {
            return statusState[name];
          }

          setStatus(name, value) {
            statusState[name] = value;

            const {loading, username, users} = statusState;
            if (loading && username !== null && users !== null) {
              statusState.loading = false;
            }

            this.emit('statusUpdate');

            _updateMenuPage();
          }

          update() { // XXX move this
            this.emit('update');
          }

          updateEye(camera) {
            this.emit('updateEye', camera);
          }

          updateStart() {
            this.emit('updateStart');
          }

          updateEnd() {
            this.emit('updateEnd');
          }

          renderStart() {
            this.emit('renderStart');
          }

          renderEnd() {
            this.emit('renderEnd');
          }

          registerElement(pluginInstance, elementApi) {
            const tag = archae.getName(pluginInstance);

            _addModApiElement(tag, elementApi);
          }

          unregisterElement(pluginInstance) {
            const tag = archae.getName(pluginInstance);

            _removeModApiElement(tag);
          }

          login() {
            menuState.open = true;
            menuState.position = [0, DEFAULT_USER_HEIGHT, -1.5];
            menuState.rotation = [0, 0, 0, 1];
            menuState.loggedIn = true;

            _updateMenuPage();

            menuMesh.visible = true;
            keyboardMesh.visible = true;

            this.emit('login');
          }

          logout() {
            menuState.open = false;
            menuState.position = null;
            menuState.rotation = null;
            menuState.loggedIn = false;

            _updateMenuPage();

            menuMesh.visible = false;
            keyboardMesh.visible = false;

            this.emit('logout');
          }
        }
        const rendApi = new RendApi();
        rendApi.on('update', () => {
          for (let i = 0; i < localUpdates.length; i++) {
            const localUpdate = localUpdates[i];
            localUpdate();
          }
        });

        return rendApi;
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

module.exports = Rend;

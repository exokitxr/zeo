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
import menuUtils from './lib/utils/menu';
import menuRender from './lib/render/menu';

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

        const uiTracker = biolumi.makeUiTracker();

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

              const statusMesh = (() => {
                const mesh = menuUi.makePage(({
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

                const {page} = mesh;
                uiTracker.addPage(page);

                return mesh;
              })();
              object.add(statusMesh);
              object.statusMesh = statusMesh;

              object.worldMesh = null;
              object.configMesh = null;
              object.statsMesh = null;
              object.trashMesh = null;

              const navbarMesh = (() => {
                const mesh = navbarUi.makePage(({
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

                const {page} = mesh;
                uiTracker.addPage(page);

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

            const trigger = e => {
              const {open} = menuState;

              if (open) {
                const {side} = e;

                const _doClickNavbar = () => {
                  const hoverState = uiTracker.getHoverState(side);
                  const {anchor} = hoverState;
                  const onclick = (anchor && anchor.onclick) || '';

                  let match;
                  if (match = onclick.match(/^navbar:(status|world|options)$/)) {
                    const newTab = match[1];

                    const _getTabMesh = tab => {
                      switch (tab) {
                        case 'status': return menuMesh.statusMesh;
                        case 'world': return menuMesh.worldMesh;
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
                  const hoverState = uiTracker.getHoverState(side);
                  const {anchor} = hoverState;
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
                  menuState.open = false; // XXX need to cancel other menu states as well
                  menuState.position = null;
                  menuState.rotation = null;
                  menuState.animation = anima.makeAnimation(TRANSITION_TIME);

                  const {tagsLinesMesh} = auxObjects;
                  tagsLinesMesh.visible = false;
                } else {
                  const newCameraPosition = camera.position.clone();
                  const newCameraRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
                    0,
                    camera.rotation.y,
                    0,
                    camera.rotation.order
                  ));
                  const newMenuPosition = newCameraPosition.clone()
                    .add(new THREE.Vector3(0, 0, -1.5).applyQuaternion(newCameraRotation));
                  const newMenuRotation = newCameraRotation;
                  menuMesh.position.copy(newMenuPosition);
                  menuMesh.quaternion.copy(newMenuRotation);

                  menuState.open = true;
                  menuState.position = newMenuPosition.toArray();
                  menuState.rotation = newMenuRotation.toArray();
                  menuState.animation = anima.makeAnimation(TRANSITION_TIME);

                  rendApi.emit('open', {
                    position: newCameraPosition,
                    rotation: newCameraRotation,
                  });

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
                    /* {
                      mesh: keyboardMesh,
                      direction: 'x',
                    }, */
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
              const _updateUiTracker = () => {
                const navbarHoverState = navbarHoverStates[side];

                uiTracker.update({
                  pose: webvr.getPose(),
                });
              };

              _updateMeshAnimations();
              _updateUiTracker();
            });

            cleanups.push(() => {
              scene.remove(menuMesh);

              input.removeListener('trigger', trigger);
              input.removeListener('menudown', menudown);
            });

            return menuMesh;
          } else {
            return null;
          }
        })();

        let lastMenuStatusJsonString = '';
        const _updateMenuPage = () => {
          if (menuMesh) {
            const menuStatusJsonString = JSON.stringify(statusState);

            if (menuStatusJsonString !== lastMenuStatusJsonString) {
              const {statusMesh} = menuMesh;
              const {page} = statusMesh;
              page.update();

              lastMenuStatusJsonString = menuStatusJsonString;
            }
          };
        };
        const _updateNavbarPage = () => {
          if (menuMesh) {
            const {navbarMesh} = menuMesh;
            const {page} = navbarMesh;
            page.update();
          };
        };
        const _updatePages = () => {
          _updateMenuPage();
          _updateNavbarPage();
        };
        _updatePages();

        localUpdates.push(() => {
          const _updateRenderer = () => {
            renderer.shadowMap.needsUpdate = true;
          };
          const _updateUiTimer = () => {
            biolumi.updateUiTimer();
          };

          _updateRenderer();
          _updateUiTimer();
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

          update() {
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

            this.emit('login');
          }

          logout() {
            menuState.open = false;
            menuState.position = null;
            menuState.rotation = null;
            menuState.loggedIn = false;

            _updateMenuPage();

            menuMesh.visible = false;

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

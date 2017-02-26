import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/servers';
import serversRender from './lib/render/servers';
import menuUtils from './lib/utils/menu';

const SIDES = ['left', 'right'];

class Servers {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/hub',
      '/core/engines/three',
      '/core/engines/input',
      '/core/engines/webvr',
      '/core/engines/login',
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/plugins/creature-utils',
    ])
      .then(([
        hub,
        three,
        input,
        webvr,
        login,
        biolumi,
        rend,
        creatureUtils,
      ]) => {
        if (live) {
          const {THREE, scene, camera} = three;

          // constants
          const transparentMaterial = biolumi.getTransparentMaterial();
          const solidMaterial = biolumi.getSolidMaterial();

          const serversRenderer = serversRender.makeRenderer({creatureUtils});

          const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
          const _decomposeMatrix = matrix => {
            const position = new THREE.Vector3();
            const rotation = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            matrix.decompose(position, rotation, scale);
            return {position, rotation, scale};
          };

          const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x0000FF,
            wireframe: true,
            opacity: 0.5,
            transparent: true,
          });

          // states
          const serversState = {
            page: 'list',
            servers: hub.getServers(),
            currentServerUrl: null,
          };
          const focusState = {
            type: '',
          };

          // helper functions
          const _requestInitialConnect = () => new Promise((accept, reject) => {
            const loggedIn = !login.isOpen();
            const currentServer = hub.getCurrentServer()
            const shouldConnect = loggedIn && currentServer.type === 'server';

            if (shouldConnect) {
              const {url: currentServerUrl} = currentServer;

              _connectServer(currentServerUrl)
                .then(() => {
                  accept();
                })
                .catch(err => {
                  console.warn(err);

                  accept();
                });
            } else {
              accept();
            }
          });
          const _connectServer = serverUrl => hub.changeServer(serverUrl)
            .then(() => {
              serversState.currentServerUrl = serverUrl;

              rend.connectServer();
            });
          const _requestUis = () => Promise.all([
            biolumi.requestUi({
              width: WIDTH,
              height: HEIGHT,
            }),
          ])
            .then(([
              menuUi,
            ]) => ({
              menuUi,
            }));

          return Promise.all([
            _requestInitialConnect(),
            _requestUis(),
          ])
            .then(([
              initialConnectResult,
              {
                menuUi,
              }
            ]) => {
              if (live) {
                const menuHoverStates = {
                  left: biolumi.makeMenuHoverState(),
                  right: biolumi.makeMenuHoverState(),
                };
                const dotMeshes = {
                  left: biolumi.makeMenuDotMesh(),
                  right: biolumi.makeMenuDotMesh(),
                };
                scene.add(dotMeshes.left);
                scene.add(dotMeshes.right);
                const boxMeshes = {
                  left: biolumi.makeMenuBoxMesh(),
                  right: biolumi.makeMenuBoxMesh(),
                };
                scene.add(boxMeshes.left);
                scene.add(boxMeshes.right);

                menuUi.pushPage(({servers, focus: {type}}) => {
                  return [
                    {
                      type: 'html',
                      src: serversRenderer.getServersPageSrc(servers),
                      x: 0,
                      y: 0,
                      w: WIDTH,
                      h: HEIGHT,
                      scroll: true,
                    },
                  ];
                }, {
                  type: 'main',
                  state: {
                    servers: serversState,
                    focus: focusState,
                  },
                });

                const menuMesh = (() => {
                  const width = WORLD_WIDTH;
                  const height = WORLD_HEIGHT;
                  const depth = WORLD_DEPTH;

                  const menuMaterial = biolumi.makeMenuMaterial();

                  const geometry = new THREE.PlaneBufferGeometry(width, height);
                  const materials = [solidMaterial, menuMaterial];

                  const mesh = THREE.SceneUtils.createMultiMaterialObject(geometry, materials);
                  mesh.position.z = -1.5;
                  mesh.visible = false;
                  mesh.receiveShadow = true;
                  mesh.menuMaterial = menuMaterial;

                  const shadowMesh = (() => {
                    const geometry = new THREE.BoxBufferGeometry(width, height, 0.01);
                    const material = transparentMaterial;
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.castShadow = true;
                    return mesh;
                  })();
                  mesh.add(shadowMesh);

                  return mesh;
                })();
                rend.registerMenuMesh('serversMesh', menuMesh);

                const _updatePages = menuUtils.debounce(next => {
                  const pages = menuUi.getPages();

                  if (pages.length > 0) {
                    let pending = pages.length;
                    const pend = () => {
                      if (--pending === 0) {
                        next();
                      }
                    };

                    for (let i = 0; i < pages.length; i++) {
                      const page = pages[i];
                      const {type} = page;

                      if (type === 'main') {
                        page.update({
                          servers: serversState,
                          focus: focusState,
                        }, pend);
                      } else {
                        pend();
                      }
                    }
                  } else {
                    next();
                  }
                });

                const _trigger = e => {
                  const {side} = e;

                  const menuHoverState = menuHoverStates[side];
                  const {anchor} = menuHoverState;
                  const onclick = (anchor && anchor.onclick) || '';

                  let match;
                  if (onclick === 'servers:list') {
                    serversState.page = 'list';

                    _updatePages();
                  } else if (onclick === 'servers:newServer') {
                    serversState.page = 'newServer';

                    _updatePages();
                  } else if (match = onclick.match(/^servers:connect:(.+)$/)) {
                    const serverUrl = match[1];

                    _connectServer(serverUrl) // XXX handle race conditions for these
                      .then(() => {
                        _updatePages();
                      })
                      .catch(err => {
                        console.warn(err);
                      });
                  } else if (onclick === 'servers:disconnect') {
                    hub.changeServer(null)
                      .then(() => {
                        serversState.currentServerUrl = null;

                        _updatePages();

                        rend.disconnectServer();
                      })
                      .catch(err => {
                        console.warn(err);
                      });
                  }
                };
                input.on('trigger', _trigger);

                const _update = () => {
                  const _updateTextures = () => {
                    const tab = rend.getTab();

                    if (tab === 'servers') {
                      const {
                        menuMaterial,
                      } = menuMesh;
                      const uiTime = rend.getUiTime();

                      biolumi.updateMenuMaterial({
                        ui: menuUi,
                        menuMaterial,
                        uiTime,
                      });
                    }
                  };
                  const _updateMenuAnchors = () => {
                    const tab = rend.getTab();

                    if (tab === 'servers') {
                      const {gamepads} = webvr.getStatus();
                      const menuMatrixObject = _decomposeObjectMatrixWorld(menuMesh);

                      SIDES.forEach(side => {
                        const gamepad = gamepads[side];

                        if (gamepad) {
                          const {position: controllerPosition, rotation: controllerRotation} = gamepad;

                          const menuHoverState = menuHoverStates[side];
                          const dotMesh = dotMeshes[side];
                          const boxMesh = boxMeshes[side];

                          biolumi.updateAnchors({
                            objects: [{
                              matrixObject: menuMatrixObject,
                              ui: menuUi,
                              width: WIDTH,
                              height: HEIGHT,
                              worldWidth: WORLD_WIDTH,
                              worldHeight: WORLD_HEIGHT,
                              worldDepth: WORLD_DEPTH,
                            }],
                            hoverState: menuHoverState,
                            dotMesh: dotMesh,
                            boxMesh: boxMesh,
                            controllerPosition,
                            controllerRotation,
                          });
                        }
                      });
                    }
                  };

                  _updateTextures();
                  _updateMenuAnchors();
                };
                rend.on('update', _update);

                this._cleanup = () => {
                  SIDES.forEach(side => {
                    scene.remove(dotMeshes[side]);
                    scene.remove(boxMeshes[side]);
                  });

                  input.removeListener('trigger', _trigger);

                  rend.removeListener('login', _login);
                  rend.removeListener('update', _update);
                };

                class ServersApi {
                  isConnected() {
                    return Boolean(serversState.currentServerUrl);
                  }
                }
                const serversApi = new ServersApi();

                return serversApi;
              }
            });
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Servers;

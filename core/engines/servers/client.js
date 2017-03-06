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
          const _disconnectServer = () => hub.changeServer(null)
            .then(() => {
              serversState.currentServerUrl = null;

              rend.disconnectServer();
            });

          return _requestInitialConnect()
            .then(() => {
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

                const menuUi = biolumi.makeUi({
                  width: WIDTH,
                  height: HEIGHT,
                });

                const menuMesh = (() => {
                  const object = new THREE.Object3D();
                  object.position.z = -1.5;
                  object.visible = false;

                  const planeMesh = (() => {
                    const mesh = menuUi.addPage(({
                      servers,
                      focus: {
                        type,
                      }
                    }) => {
                      return [
                        {
                          type: 'html',
                          src: serversRenderer.getServersPageSrc(servers),
                          x: 0,
                          y: 0,
                          w: WIDTH,
                          h: HEIGHT,
                        },
                      ];
                    }, {
                      type: 'main',
                      state: {
                        servers: serversState,
                        focus: focusState,
                      },
                      worldWidth: WORLD_WIDTH,
                      worldHeight: WORLD_HEIGHT,
                    });
                    mesh.receiveShadow = true;

                    return mesh;
                  })();
                  object.add(planeMesh);
                  object.planeMesh = planeMesh;

                  const shadowMesh = (() => {
                    const geometry = new THREE.BoxBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT, 0.01);
                    const material = transparentMaterial;
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.castShadow = true;
                    return mesh;
                  })();
                  object.add(shadowMesh);

                  return object;
                })();
                rend.registerMenuMesh('serversMesh', menuMesh);

                const _updatePages = () => {
                  menuUi.update();
                };
                _updatePages();

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
                    _disconnectServer()
                      .then(() => {
                        _updatePages();
                      })
                      .catch(err => {
                        console.warn(err);
                      });
                  }
                };
                input.on('trigger', _trigger);

                const _updateEnabled = () => {
                  const enabled = serversApi.isConnected();
                  const loggedIn = !login.isOpen();
                  const currentServer = hub.getCurrentServer()
                  const shouldBeEnabled = loggedIn && currentServer.type === 'server';

                  if (!enabled && shouldBeEnabled) {
                    const {url: currentServerUrl} = currentServer;

                    _connectServer(currentServerUrl)
                      .then(() => {
                        _updatePages();
                      })
                      .catch(err => {
                        console.warn(err);
                      });
                  } else if (enabled && !shouldBeEnabled) {
                    _disconnectServer()
                      .then(() => {
                        _updatePages();
                      })
                      .catch(err => {
                        console.warn(err);
                      });
                  }
                };
                const _login = _updateEnabled;
                rend.on('login', _login);
                const _logout = _updateEnabled;
                rend.on('logout', _logout);
                const _update = () => {
                  const _updateAnchors = () => {
                    const tab = rend.getTab();

                    if (tab === 'servers') {
                      const {gamepads} = webvr.getStatus();
                      const {planeMesh} = menuMesh;
                      const menuMatrixObject = _decomposeObjectMatrixWorld(planeMesh);
                      const {page} = planeMesh;

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
                              page: page,
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
                  _updateAnchors();
                };
                rend.on('update', _update);

                this._cleanup = () => {
                  SIDES.forEach(side => {
                    scene.remove(dotMeshes[side]);
                    scene.remove(boxMeshes[side]);
                  });

                  input.removeListener('trigger', _trigger);

                  rend.removeListener('login', _login);
                  rend.removeListener('logout', _logout);
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

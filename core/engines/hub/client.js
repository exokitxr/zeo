import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,

  TAGS_WIDTH,
  TAGS_HEIGHT,
  TAGS_ASPECT_RATIO,
  TAGS_WORLD_WIDTH,
  TAGS_WORLD_HEIGHT,
  TAGS_WORLD_DEPTH,

  SERVER_WIDTH,
  SERVER_HEIGHT,
  SERVER_WORLD_WIDTH,
  SERVER_WORLD_HEIGHT,
  SERVER_WORLD_DEPTH,

  SPHERE_RADIUS,

  DEFAULT_USER_HEIGHT,
} from './lib/constants/menu';
import menuRender from './lib/render/menu';
import dataUrlToBlob from 'dataurl-to-blob';

const SIDES = ['left', 'right'];

class Hub {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {
      metadata: {
        home: {
          url: homeUrl,
          enabled: homeEnabled,
        },
        my: {
          enabled: myEnabled,
        },
        hub: {
          url: hubUrl,
        },
      },
    } = archae;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    if (homeEnabled) {
      const _requestBlobDataUrl = blob => new Promise((accept, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
          accept(e.target.result);
        };
        reader.readAsDataURL(blob);
      });
      const _requestFileBlobData = url => fetch(url)
       .then(res => res.blob()
         .then(blob => _requestBlobDataUrl(blob))
       );
      const _requestImgs = () => Promise.all([
        '/img/logo-large.png',
        '/archae/hub/img/keyboard.png',
        '/archae/hub/img/controller.png',
        '/archae/hub/img/menu.png',
        '/archae/hub/img/teleport.png',
        '/archae/hub/img/cake.png',
        '/archae/hub/img/server.png',
      ].map(_requestFileBlobData))
        .then(([
          logo,
          keyboard,
          controller,
          menu,
          teleport,
          cake,
          server,
        ]) => ({
          logo,
          keyboard,
          controller,
          menu,
          teleport,
          cake,
          server,
        }));
      const _requestZCakeModSpec = () => fetch('/archae/rend/mods?q=' + encodeURIComponent('/plugins/z-cake'))
        .then(res => res.json()
          .then(itemSpec => {
            itemSpec.isStatic = true;

            return itemSpec;
          })
        );

      return Promise.all([
        archae.requestPlugins([
          '/core/engines/bootstrap',
          '/core/engines/input',
          '/core/engines/three',
          '/core/engines/webvr',
          '/core/engines/biolumi',
          '/core/engines/cyborg',
          '/core/engines/rend',
          '/core/engines/tags',
          '/core/plugins/js-utils',
          '/core/plugins/geometry-utils',
          '/core/plugins/creature-utils',
        ]),
        _requestImgs(),
        _requestZCakeModSpec(),
      ])
        .then(([
          [
            bootstrap,
            input,
            three,
            webvr,
            biolumi,
            cyborg,
            rend,
            tags,
            jsUtils,
            geometryUtils,
            creatureUtils,
          ],
          imgs,
          zCakeItemSpec,
        ]) => {
          if (live) {
            const {THREE, scene, camera, renderer} = three;
            const {events} = jsUtils;
            const {EventEmitter} = events;

            const menuRenderer = menuRender.makeRenderer({
              creatureUtils,
            });

            const transparentMaterial = biolumi.getTransparentMaterial();
            const transparentImg = biolumi.getTransparentImg();

            const _decomposeObjectMatrixWorld = object => {
              const position = new THREE.Vector3();
              const rotation = new THREE.Quaternion();
              const scale = new THREE.Vector3();
              object.matrixWorld.decompose(position, rotation, scale);
              return {position, rotation, scale};
            };

            const wireframeHighlightMaterial = new THREE.MeshBasicMaterial({
              color: 0x0000FF,
              wireframe: true,
              opacity: 0.5,
              transparent: true,
            });

            const controllerMeshOffset = new THREE.Vector3(0, 0, -0.02);
            const controllerMeshQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1));
            const oneVector = new THREE.Vector3(1, 1, 1);
            const backVector = new THREE.Vector3(0, 0, 1);
            const sphereDiameterVector = new THREE.Vector3(SPHERE_RADIUS * 2, SPHERE_RADIUS * 2, SPHERE_RADIUS * 2);

            const menuUi = biolumi.makeUi({
              width: WIDTH,
              height: HEIGHT,
            });

            const mainFontSpec = {
              fonts: biolumi.getFonts(),
              fontSize: 40,
              lineHeight: 1.4,
              fontWeight: biolumi.getFontWeight(),
              fontStyle: biolumi.getFontStyle(),
            };
            const hubState = {
              page: 'tutorial:' + 0,
              remoteServers: [],
              localServers: [],
              username: '',
              inputText: '',
              inputIndex: 0,
              inputValue: 0,
              loading: false,
              flags: {
                localServers: myEnabled,
              },
              vrMode: bootstrap.getVrMode(),
            };
            const focusState = {
              type: '',
            };

            const _vrModeChange = vrMode => {
              hubState.vrMode = vrMode;

              _updatePages();
            };
            bootstrap.on('vrModeChange', _vrModeChange);

            const menuMesh = (() => {
              const object = new THREE.Object3D();
              object.position.y = DEFAULT_USER_HEIGHT;

              const planeMesh = (() => {
                const mesh = menuUi.addPage(({
                  hub: {
                    page,
                    remoteServers,
                    localServers,
                    inputText,
                    inputIndex,
                    inputValue,
                    loading,
                    flags,
                    vrMode,
                  },
                  focus: {
                    type: focusType,
                  },
                  imgs,
                }) => ({
                  type: 'html',
                  src: menuRenderer.getHubMenuSrc({
                    page,
                    remoteServers,
                    localServers,
                    inputText,
                    inputIndex,
                    inputValue,
                    loading,
                    vrMode,
                    focusType,
                    flags,
                    imgs,
                  }),
                  x: 0,
                  y: 0,
                  w: WIDTH,
                  h: HEIGHT,
                }), {
                  type: 'hub',
                  state: {
                    hub: hubState,
                    focus: focusState,
                    imgs: imgs,
                  },
                  worldWidth: WORLD_WIDTH,
                  worldHeight: WORLD_HEIGHT,
                });
                mesh.position.z = -1;
                mesh.receiveShadow = true;

                return mesh;
              })();
              object.add(planeMesh);
              object.planeMesh = planeMesh;

              const scale = 2;
              const cakeTagMesh = tags.makeTag(zCakeItemSpec);
              cakeTagMesh.position.y = -0.26;
              cakeTagMesh.position.z = -1 + 0.01;
              cakeTagMesh.scale.set(scale, scale, 1);
              cakeTagMesh.initialScale = cakeTagMesh.scale.clone();
              cakeTagMesh.visible = false;
              object.add(cakeTagMesh);
              object.cakeTagMesh = cakeTagMesh;

              const shadowMesh = (() => {
                const geometry = new THREE.BoxBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT, 0.01);
                const material = transparentMaterial.clone();
                material.depthWrite = false;

                const mesh = new THREE.Mesh(geometry, material);
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

            const _makeGrabState = () => ({
              tagMesh: null,
            });
            const grabStates = {
              left: _makeGrabState(),
              right: _makeGrabState(),
            };

            const _makeGrabbableState = () => ({
              hoverMesh: null,
            });
            const grabbableStates = {
              left: _makeGrabbableState(),
              right: _makeGrabbableState(),
            };

            const _makeGrabBoxMesh = () => {
              const width = TAGS_WORLD_WIDTH;
              const height = TAGS_WORLD_HEIGHT;
              const depth = TAGS_WORLD_DEPTH;

              const geometry = new THREE.BoxBufferGeometry(width, height, depth);
              const material = wireframeHighlightMaterial;

              const mesh = new THREE.Mesh(geometry, material);
              mesh.position.y = 1.2;
              mesh.rotation.order = camera.rotation.order;
              mesh.rotation.y = Math.PI / 2;
              mesh.depthWrite = false;
              mesh.visible = false;
              return mesh;
            };
            const grabBoxMeshes = {
              left: _makeGrabBoxMesh(),
              right: _makeGrabBoxMesh(),
            };
            scene.add(grabBoxMeshes.left);
            scene.add(grabBoxMeshes.right);

            const tagHoverStates = {
              left: biolumi.makeMenuHoverState(),
              right: biolumi.makeMenuHoverState(),
            };
            const tagDotMeshes = {
              left: biolumi.makeMenuDotMesh(),
              right: biolumi.makeMenuDotMesh(),
            };
            scene.add(tagDotMeshes.left);
            scene.add(tagDotMeshes.right);
            const tagBoxMeshes = {
              left: biolumi.makeMenuBoxMesh(),
              right: biolumi.makeMenuBoxMesh(),
            };
            scene.add(tagBoxMeshes.left);
            scene.add(tagBoxMeshes.right);

            const _makeEnvHoverState = () => ({
              hoveredServerMesh: null,
            });
            const envHoverStates = {
              left: _makeEnvHoverState(),
              right: _makeEnvHoverState(),
            };

            const serverHoverStates = {
              left: biolumi.makeMenuHoverState(),
              right: biolumi.makeMenuHoverState(),
            };
            const serverDotMeshes = {
              left: biolumi.makeMenuDotMesh(),
              right: biolumi.makeMenuDotMesh(),
            };
            scene.add(serverDotMeshes.left);
            scene.add(serverDotMeshes.right);
            const serverBoxMeshes = {
              left: biolumi.makeMenuBoxMesh(),
              right: biolumi.makeMenuBoxMesh(),
            };
            scene.add(serverBoxMeshes.left);
            scene.add(serverBoxMeshes.right);

            const envDotMeshes = {
              left: biolumi.makeMenuDotMesh(),
              right: biolumi.makeMenuDotMesh(),
            };
            scene.add(envDotMeshes.left);
            scene.add(envDotMeshes.right);

            const _makeEnvBoxMesh = () => {
              const size = SPHERE_RADIUS * 2;

              const mesh = biolumi.makeMenuBoxMesh();
              const {geometry} = mesh;
              geometry.applyMatrix(new THREE.Matrix4().makeScale(size, size, size));
              return mesh;
            };
            const envBoxMeshes = {
              left: _makeEnvBoxMesh(),
              right: _makeEnvBoxMesh(),
            };
            scene.add(envBoxMeshes.left);
            scene.add(envBoxMeshes.right);

            const _makeServerMesh = server => {
              const object = new THREE.Object3D();
              object.server = server;

              const envMesh = _makeServerEnvMesh(server);
              object.add(envMesh);
              object.envMesh = envMesh;

              const menuMesh = _makeServerMenuMesh(server);
              object.add(menuMesh);
              object.menuMesh = menuMesh;

              return object;
            };
            const _makeServerEnvMesh = server => {
              const cubeCamera = new THREE.CubeCamera(0.001, 1024, 256);

              const mesh = (() => {
                const geometry = new THREE.SphereBufferGeometry(SPHERE_RADIUS, 64, 64);
                const material = new THREE.MeshLambertMaterial({
                  color: 0xffffff,
                  envMap: cubeCamera.renderTarget.texture,
                });

                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;

                return mesh;
              })();
              mesh.add(cubeCamera);
              mesh.cubeCamera = cubeCamera;

              mesh.boxTarget = null;
              const _updateBoxTarget = () => {
                const {position: envMeshPosition, rotation: envMeshRotation, scale: envMeshScale} = _decomposeObjectMatrixWorld(mesh);
                const boxTarget = geometryUtils.makeBoxTarget(envMeshPosition, envMeshRotation, envMeshScale, sphereDiameterVector);
                mesh.boxTarget = boxTarget;
              };
              mesh.updateBoxTarget = _updateBoxTarget;

              return mesh;
            };
            const _makeServerMenuMesh = server => {
              const object = new THREE.Object3D();

              const planeMesh = (() => {
                const serverUi = biolumi.makeUi({
                  width: SERVER_WIDTH,
                  height: SERVER_HEIGHT,
                });

                const mesh = serverUi.addPage(({
                  server: {
                    worldname,
                    url,
                    running,
                    local,
                  },
                }) => ({
                  type: 'html',
                  src: menuRenderer.getServerTagSrc({
                    worldname,
                    url,
                    running,
                    local,
                  }),
                  x: 0,
                  y: 0,
                  w: SERVER_WIDTH,
                  h: SERVER_HEIGHT,
                }), {
                  type: 'hub',
                  state: {
                    server: {
                      worldname: server.worldname,
                      url: server.url,
                      running: server.running,
                      local: server.local,
                    },
                  },
                  worldWidth: SERVER_WORLD_WIDTH,
                  worldHeight: SERVER_WORLD_HEIGHT,
                });
                mesh.position.y = 0.45;
                mesh.receiveShadow = true;
                mesh.ui = serverUi;

                serverUi.update();

                return mesh;
              })();
              object.add(planeMesh);
              object.planeMesh = planeMesh;

              const shadowMesh = (() => {
                const geometry = new THREE.BoxBufferGeometry(SERVER_WORLD_WIDTH, SERVER_WORLD_HEIGHT, 0.01);
                const material = transparentMaterial.clone();
                material.depthWrite = false;

                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                return mesh;
              })();
              object.add(shadowMesh);

              return object;
            };
            const serversMesh = new THREE.Object3D();
            scene.add(serversMesh);

            const _updatePages = () => {
              menuUi.update();
            };
            _updatePages();

            const _addTag = (side, srcTagMesh) => {
              const itemSpec = _clone(srcTagMesh.item);
              itemSpec.id = _makeId();
              const tagMesh = tags.makeTag(itemSpec);

              const grabState = grabStates[side];
              grabState.tagMesh = tagMesh;

              const controllers = cyborg.getControllers();
              const controller = controllers[side];
              const {mesh: controllerMesh} = controller;
              tagMesh.position.copy(controllerMeshOffset);
              tagMesh.quaternion.copy(controllerMeshQuaternion);
              tagMesh.scale.copy(oneVector);
              controllerMesh.add(tagMesh);
            };

            const _requestRemoteServers = () => fetch('https://' + hubUrl + '/servers/servers.json')
              .then(res => res.json()
                .then(j => {
                  const {servers} = j;

                  for (let i = 0; i < servers.length; i++) {
                    const server = servers[i];
                    server.local = false;
                  }

                  return servers;
                })
              );
            const _requestLocalServers = () => fetch('https://' + homeUrl + '/servers/local.json')
              .then(res => res.json()
                .then(j => {
                  const {servers} = j;

                  for (let i = 0; i < servers.length; i++) {
                    const server = servers[i];
                    server.local = true;
                  }

                  return servers;
                })
              );
            const _parsePage = page => {
              const split = page.split(':');
              const name = split[0];
              const args = split.slice(1);
              return {
                name,
                args,
              };
            };
            const _setPage = page => {
              hubState.page = page;

              _updatePages();

              _removeServerMeshes();

              const {cakeTagMesh} = menuMesh;
              const pageIndex = parseInt(_parsePage(page).args[0], 10);
              cakeTagMesh.visible = pageIndex === 2;
            };
            const _removeServerMeshes = () => {
              const {children} = serversMesh;
              for (let i = 0; i < children.length; i++) {
                const child = children[i];
                serversMesh.remove(child);
              }
            };
            const _openRemoteServersPage = () => {
              hubState.loading = true;

              _setPage('remoteServers:' + 0);

              _requestRemoteServers() // XXX cancel these when switching pages
                .then(servers => {
                  hubState.remoteServers = servers;
                  hubState.loading = false;

                  _updatePages();
                })
                .catch(err => {
                  console.warn(err);
                });
            };
            const _openLocalServersPage = () => {
              hubState.loading = true;

              _setPage('localServers:' + 0);

              _requestLocalServers()
                .then(servers => {
                  hubState.localServers = servers;
                  hubState.loading = false;

                  _updatePages();
                })
                .catch(err => {
                  console.warn(err);
                });
            };
            const _proxyLoginServer = worldname => fetch('https://' + homeUrl + '/servers/proxyLogin', {
              method: 'POST',
              headers: (() => {
                const result = new Headers();
                result.append('Content-Type', 'application/json');
                return result;
              })(),
              body: JSON.stringify({
                worldname: worldname,
              }),
            })
              .then(res => res.json()
                .then(({token}) => token)
              );

            const _trigger = e => {
              const {side} = e;

              const _doTagMeshClick = () => {
                const {side} = e;
                const {gamepads} = webvr.getStatus();
                const gamepad = gamepads[side];

                if (gamepad) {
                  const {buttons: {grip: {pressed: gripPressed}}} = gamepad;

                  if (gripPressed) {
                    const tagHoverState = tagHoverStates[side];
                    const {intersectionPoint} = tagHoverState;
                    const grabState = grabStates[side];
                    const {tagMesh: grabMesh} = grabState;

                    if (intersectionPoint && !grabMesh) {
                      const {metadata: {tagMesh}} = tagHoverState;

                      _addTag(side, tagMesh);

                      return true;
                    } else {
                      return false;
                    }
                  } else {
                    return false;
                  }
                } else {
                  return false;
                }
              };
              const _doServerMeshClick = () => {
                const serverHoverState = serverHoverStates[side];
                const {intersectionPoint} = serverHoverState;

                if (intersectionPoint) {
                  const {anchor} = serverHoverState;
                  const onclick = (anchor && anchor.onclick) || '';

                  let match;
                  if (match = onclick.match(/^server:close:(.+)$/)) {
                    const {metadata: {serverMesh}} = serverHoverState;
                    serversMesh.remove(serverMesh);
                  } else if (match = onclick.match(/^server:toggleRunning:(.+)$/)) {
                    const {metadata: {serverMesh}} = serverHoverState;
                    const {server} = serverMesh;
                    const {worldname, running} = server;

                    if (!running) {
                      fetch('https://' + homeUrl + '/servers/start', {
                        method: 'POST',
                        headers: (() => {
                          const result = new Headers();
                          result.append('Content-Type', 'application/json');
                          return result;
                        })(),
                        body: JSON.stringify({
                          worldname: worldname,
                        }),
                      })
                        .then(res => {
                          const {status} = res;

                          if (status >= 200 && status < 300) {
                            return res.blob()
                              .then(() => {
                                 _openLocalServersPage();
                              });
                          } else {
                            const err = new Error('hub returned invalid status code: ' + status);
                            return Promise.reject(err);
                          }
                        })
                        .catch(err => {
                          console.warn(err);
                        });
                    } else {
                      fetch('https://' + homeUrl + '/servers/stop', {
                        method: 'POST',
                        headers: (() => {
                          const result = new Headers();
                          result.append('Content-Type', 'application/json');
                          return result;
                        })(),
                        body: JSON.stringify({
                          worldname: worldname,
                        }),
                      })
                        .then(res => {
                          const {status} = res;

                          if (status >= 200 && status < 300) {
                            return res.blob()
                              .then(() => {
                                 _openLocalServersPage();
                              });
                          } else {
                            const err = new Error('hub returned invalid status code: ' + status);
                            return Promise.reject(err);
                          }
                        })
                        .catch(err => {
                          console.warn(err);
                        });
                    }
                  }

                  return true;
                } else {
                  return false;
                }
              };
              const _doEnvMeshClick = () => {
                const envHoverState = envHoverStates[side];
                const {hoveredServerMesh} = envHoverState;

                if (hoveredServerMesh) {
                  const {server} = hoveredServerMesh;
                  const {running} = server;

                  if (running) {
                    const {url} = server;
                    const fullServerUrl = 'https://' + server.url;

                    const _connectServer = (token = null) => {
                      window.parent.location = fullServerUrl + (token ? ('?t=' + token) : '');
                    };

                    const {local} = server;
                    if (local) {
                      fetch(fullServerUrl + '/server/checkLogin', {
                        method: 'POST',
                      })
                        .then(res => res.json()
                          .then(({ok}) => {
                            if (ok) {
                              _connectServer();
                            } else {
                              const {worldname} = server;

                              _proxyLoginServer(worldname)
                                .then(token => {
                                  _connectServer(token);
                                })
                                .catch(err => {
                                  console.warn(err);
                                });
                            }
                          })
                        )
                        .catch(err => {
                          console.warn(err);

                          const {worldname} = server;

                          _proxyLoginServer(worldname)
                            .then(token => {
                              _connectServer(token);
                            })
                            .catch(err => {
                              console.warn(err);
                            });
                        });
                    } else {
                      _connectServer();
                    }

                    e.stopImmediatePropagation();
                  }

                  return true;
                } else {
                  return false;
                }
              };
              const _doMenuMeshClick = () => {
                const menuHoverState = menuHoverStates[side];
                const {anchor} = menuHoverState;
                const onclick = (anchor && anchor.onclick) || '';

                let match;
                if (onclick === 'hub:next') {
                  const {page} = hubState;
                  const pageSpec = _parsePage(page);
                  _setPage([pageSpec.name, parseInt(pageSpec.args[0], 10) + 1].join(':'));

                  return true;
                } else if (onclick === 'hub:back') {
                  const {page} = hubState;
                  _setPage([pageSpec.name, parseInt(pageSpec.args[0], 10) - 1].join(':'));

                  return true;
                } else if (onclick === 'hub:tutorial') {
                  _setPage('tutorial:' + 0);

                  return true;
                } else if (onclick === 'hub:menu') {
                  _setPage('tutorial:' + 4);

                  return true;
                } else if (onclick === 'hub:remoteServers') {
                  _openRemoteServersPage();

                  return true;
                } else if (onclick === 'hub:localServers') {
                  _openLocalServersPage();

                  return true;
                } else if (match = onclick.match(/^remoteServer:([0-9]+)$/)) {
                  const index = parseInt(match[1], 10);

                  const {remoteServers} = hubState;
                  const server = remoteServers[index];

                  // remove old server meshes
                  _removeServerMeshes();

                  // add new server mesh
                  const serverMesh = _makeServerMesh(server);
                  serverMesh.position.y = 1.2;
                  serversMesh.add(serverMesh);
                  serverMesh.updateMatrixWorld();
                  const {envMesh} = serverMesh;
                  envMesh.updateBoxTarget();

                  return true;
                } else if (match = onclick.match(/^localServer:([0-9]+)$/)) {
                  const index = parseInt(match[1], 10);

                  const {localServers} = hubState;
                  const server = localServers[index];

                  // remove old server meshes
                  _removeServerMeshes();

                  // add new server mesh
                  const serverMesh = _makeServerMesh(server);
                  serverMesh.position.y = 1.2;
                  serversMesh.add(serverMesh);
                  serverMesh.updateMatrixWorld();
                  const {envMesh} = serverMesh;
                  envMesh.updateBoxTarget();

                  return true;
                } else if (onclick === 'servers:up') {
                  const {page} = hubState;
                  const pageSpec = _parsePage(page);
                  _setPage([pageSpec.name, parseInt(pageSpec.args[0], 10) - 1].join(':'));

                  return true;
                } else if (onclick === 'servers:down') {
                  const {page} = hubState;
                  const pageSpec = _parsePage(page);
                  _setPage([pageSpec.name, parseInt(pageSpec.args[0], 10) + 1].join(':'));

                  return true;
                } else if (onclick === 'localServers:createServer') {
                  _setPage('createServer');

                  return true;
                } else if (onclick === 'createServer:focus') {
                  focusState.type = 'createServer';

                  _updatePages();

                  return true;
                } else if (onclick === 'createServer:submit') {
                  const {inputText: worldname} = hubState;

                  if (worldname) {
                    fetch('https://' + homeUrl + '/servers/create', {
                      method: 'POST',
                      headers: (() => {
                        const result = new Headers();
                        result.append('Content-Type', 'application/json');
                        return result;
                      })(),
                      body: JSON.stringify({
                        worldname: worldname,
                      }),
                    })
                      .then(res => res.blob()
                        .then(() => {
                           _openLocalServersPage();
                        })
                      )
                      .catch(err => {
                        console.warn(err);
                      });
                  }

                  return true;
                } else if (onclick === 'hub:apiDocs') {
                  bootstrap.navigate('https://zeovr.io/docs');

                  return true; // can't happen
                } else {
                  return false;
                }
              };

              _doTagMeshClick() || _doServerMeshClick() || _doEnvMeshClick() || _doMenuMeshClick();
            };
            input.on('trigger', _trigger, {
              priority: 1,
            });

            // this needs to be a native click event rather than a soft trigger click event due for clipboard copy security reasons
            const _click = () => {
              SIDES.some(side => {
                const serverHoverState = serverHoverStates[side];
                const {intersectionPoint} = serverHoverState;

                if (intersectionPoint) {
                  const {anchor} = serverHoverState;
                  const onclick = (anchor && anchor.onclick) || '';

                  let match;
                  if (match = onclick.match(/^server:copyUrl:(.+)$/)) {
                    const {metadata: {serverMesh}} = serverHoverState;
                    const {server} = serverMesh;
                    const {url, token} = server;
                    const clipboardText = 'https://' + url + '?t=' + token;

                    const ok = _copyToClipboard(clipboardText);
                    if (ok) {
                      const {worldname} = server;

                      _proxyLoginServer(worldname)
                        .then(token => {
                          server.token = token;
                        })
                        .catch(err => {
                          console.warn(err);
                        });
                    } else {
                      console.warn('failed to copy URL:\n' + clipboardText);
                    }

                    return true;
                  } else {
                    return false;
                  }
                } else {
                  return false;
                }
              });
            };
            input.on('click', _click);

            const _gripdown = e => {
              const {side} = e;
              const grabbableState = grabbableStates[side];
              const {hoverMesh} = grabbableState;

              if (hoverMesh) {
                _addTag(side, hoverMesh);

                e.stopImmediatePropagation();
              }
            };
            input.on('gripdown', _gripdown, {
              priority: 1,
            });
            const _gripup = e => {
              const {side} = e;
              const grabState = grabStates[side];
              const {tagMesh} = grabState;

              if (tagMesh) {
                const {position, rotation, scale} = _decomposeObjectMatrixWorld(tagMesh);
                scene.add(tagMesh);
                tagMesh.position.copy(position);
                tagMesh.quaternion.copy(rotation);
                tagMesh.scale.copy(scale);

                const {item} = tagMesh;
                const {attributes} = item;
                if (attributes.position) {
                  const matrixArray = position.toArray().concat(rotation.toArray()).concat(scale.toArray());
                  item.setAttribute('position', matrixArray);
                }

                tags.reifyTag(tagMesh); // XXX make this work with the ECS

                grabState.tagMesh = null;

                e.stopImmediatePropagation();
              }
            };
            input.on('gripup', _gripup, {
              priority: 1,
            });

            const _keydown = e => {
              const {type} = focusState;

              if (type === 'createServer') {
                const applySpec = biolumi.applyStateKeyEvent(hubState, mainFontSpec, e);

                if (applySpec) {
                  const {commit} = applySpec;

                  if (commit) {
                    focusState.type = '';
                  }

                  _updatePages();

                  e.stopImmediatePropagation();
                }
              }
            };
            input.on('keydown', _keydown, {
              priority: 1,
            });
            const _keyboarddown = _keydown;
            input.on('keyboarddown', _keyboarddown, {
              priority: 1,
            });

            const _update = () => {
              const _updateMenuAnchors = () => {
                const {gamepads} = webvr.getStatus();

                const {planeMesh} = menuMesh;
                const menuMatrixObject = _decomposeObjectMatrixWorld(planeMesh);
                const {page} = planeMesh;

                SIDES.forEach(side => {
                  const gamepad = gamepads[side];

                  if (gamepad) {
                    const {position: controllerPosition, rotation: controllerRotation} = gamepad;

                    const menuHoverState = menuHoverStates[side];
                    const menuDotMesh = menuDotMeshes[side];
                    const menuBoxMesh = menuBoxMeshes[side];

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
                      dotMesh: menuDotMesh,
                      boxMesh: menuBoxMesh,
                      controllerPosition,
                      controllerRotation,
                    });
                  }
                });
              };
              const _updateTagGrabAnchors = () => {
                const {cakeTagMesh} = menuMesh;
                const {visible} = menuMesh;

                if (visible) {
                  const _getHoverGrabbable = (side) => {
                    const grabState = grabStates[side];
                    const {tagMesh: grabMesh} = grabState;

                    if (!grabMesh) {
                      const {gamepads} = webvr.getStatus();
                      const gamepad = gamepads[side];

                      if (gamepad) {
                        const {position: controllerPosition} = gamepad;
                        const {position: cakeTagMeshPosition} = _decomposeObjectMatrixWorld(cakeTagMesh);

                        if (controllerPosition.distanceTo(cakeTagMeshPosition) <= 0.2) {
                          return cakeTagMesh;
                        } else {
                          return null;
                        }
                      } else {
                        return null;
                      }
                    } else {
                      return null;
                    }
                  };

                  SIDES.forEach(side => {
                    const grabbableState = grabbableStates[side];
                    const grabBoxMesh = grabBoxMeshes[side];

                    const hoverMesh = _getHoverGrabbable(side);

                    grabbableState.hoverMesh = hoverMesh;

                    if (hoverMesh) {
                      const {position: tagMeshPosition, rotation: tagMeshRotation, scale: tagMeshScale} = _decomposeObjectMatrixWorld(hoverMesh);
                      grabBoxMesh.position.copy(tagMeshPosition);
                      grabBoxMesh.quaternion.copy(tagMeshRotation);
                      grabBoxMesh.scale.copy(tagMeshScale);
                      grabBoxMesh.visible = true;
                    } else {
                      grabbableState.hoverMesh = null;
                      grabBoxMesh.visible = false;
                    }
                  });
                } else {
                  SIDES.forEach(side => {
                    const grabbableState = grabbableStates[side];
                    const grabBoxMesh = grabBoxMeshes[side];

                    grabbableState.hoverMesh = null;
                    grabBoxMesh.visible = false;
                  });
                }
              };
              const _updateTagPointerAnchors = () => {
                const {gamepads} = webvr.getStatus();
                const {cakeTagMesh} = menuMesh;

                SIDES.forEach(side => {
                  const {visible} = cakeTagMesh;
                  const gamepad = gamepads[side];
                  const tagHoverState = tagHoverStates[side];
                  const tagDotMesh = tagDotMeshes[side];
                  const tagBoxMesh = tagBoxMeshes[side];

                  if (visible && gamepad) {
                    const {position: controllerPosition, rotation: controllerRotation} = gamepad;

                    const {planeMesh, initialScale} = cakeTagMesh;
                    const matrixObject = _decomposeObjectMatrixWorld(planeMesh);
                    const {page} = planeMesh;

                    biolumi.updateAnchors({
                      objects: [{
                        matrixObject: matrixObject,
                        page: page,
                        width: TAGS_WIDTH,
                        height: TAGS_HEIGHT,
                        worldWidth: TAGS_WORLD_WIDTH * initialScale.x,
                        worldHeight: TAGS_WORLD_HEIGHT * initialScale.y,
                        worldDepth: TAGS_WORLD_DEPTH * initialScale.z,
                        metadata: {
                          tagMesh: cakeTagMesh,
                        },
                      }],
                      hoverState: tagHoverState,
                      dotMesh: tagDotMesh,
                      boxMesh: tagBoxMesh,
                      controllerPosition,
                      controllerRotation,
                    });
                  } else {
                    tagHoverState.intersectionPoint = null;
                    tagDotMesh.visible = false;
                    tagBoxMesh.visible = false;
                  }
                });
              };
              const _updateEnvAnchors = () => {
                const {gamepads} = webvr.getStatus();
                const {children: serverMeshes} = serversMesh;

                SIDES.forEach(side => {
                  const gamepad = gamepads[side];
                  const envHoverState = envHoverStates[side];
                  const envDotMesh = envDotMeshes[side];
                  const envBoxMesh = envBoxMeshes[side];

                  if (gamepad) {
                    const {position: controllerPosition, rotation: controllerRotation} = gamepad;
                    const controllerLine = geometryUtils.makeControllerLine(controllerPosition, controllerRotation);

                    const intersectionSpecs = serverMeshes.map(serverMesh => {
                      const {envMesh} = serverMesh;
                      const {boxTarget} = envMesh;

                      if (boxTarget) { // we add the box target asynchronously on next tick
                        const intersectionPoint = boxTarget.intersectLine(controllerLine);

                        if (intersectionPoint) {
                          const distance = intersectionPoint.distanceTo(controllerPosition);

                          return {
                            intersectionPoint,
                            distance,
                            serverMesh,
                          };
                        } else {
                          return null;
                        }
                      } else {
                        return null;
                      }
                    }).filter(intersectionSpec => intersectionSpec !== null);

                    if (intersectionSpecs.length > 0) {
                      const intersectionSpec = intersectionSpecs.sort((a, b) => a.distance - b.distance)[0];
                      const {intersectionPoint, serverMesh} = intersectionSpec;
                      const {envMesh} = serverMesh;
                      const {position: envMeshPosition, rotation: envMeshRotation, scale: envMeshScale} = _decomposeObjectMatrixWorld(envMesh);

                      envDotMesh.position.copy(intersectionPoint);
                      envBoxMesh.position.copy(envMeshPosition);
                      envBoxMesh.quaternion.copy(envMeshRotation);
                      envBoxMesh.scale.copy(envMeshScale);

                      envHoverState.hoveredServerMesh = serverMesh;
                      envDotMesh.visible = true;
                      envBoxMesh.visible = true;
                    } else {
                      envHoverState.hoveredServerMesh = null;
                      envDotMesh.visible = false;
                      envBoxMesh.visible = false;
                    }
                  } else {
                    envHoverState.hoveredServerMesh = null;
                    envDotMesh.visible = false;
                    envBoxMesh.visible = false;
                  }
                });
              };
              const _updateServerMeshes = () => {
                const {hmd} = webvr.getStatus();
                const {children: serverMeshes} = serversMesh;

                for (let i = 0; i < serverMeshes.length; i++) {
                  const serverMesh = serverMeshes[i];
                  const {menuMesh} = serverMesh;
                  const {position: menuMeshPosition} = _decomposeObjectMatrixWorld(menuMesh);
                  const serverMeshNormal = hmd.position.clone().sub(menuMeshPosition);
                  serverMeshNormal.y = 0;
                  serverMeshNormal.normalize();
                  menuMesh.quaternion.setFromUnitVectors(
                    backVector,
                    serverMeshNormal
                  );
                }
              };
              const _updateServerMeshAnchors = () => {
                const {gamepads} = webvr.getStatus();

                SIDES.forEach(side => {
                  const gamepad = gamepads[side];

                  if (gamepad) {
                    const {position: controllerPosition, rotation: controllerRotation} = gamepad;

                    const serverHoverState = serverHoverStates[side];
                    const serverDotMesh = serverDotMeshes[side];
                    const serverBoxMesh = serverBoxMeshes[side];

                    const {children: serverMeshes} = serversMesh;
                    const objects = serverMeshes.map(serverMesh => {
                      const {menuMesh} = serverMesh;
                      const {planeMesh} = menuMesh;

                      if (planeMesh) {
                        const matrixObject = _decomposeObjectMatrixWorld(planeMesh);
                        const {page} = planeMesh;

                        return {
                          matrixObject: matrixObject,
                          page: page,
                          width: SERVER_WIDTH,
                          height: SERVER_HEIGHT,
                          worldWidth: SERVER_WORLD_WIDTH,
                          worldHeight: SERVER_WORLD_HEIGHT,
                          worldDepth: SERVER_WORLD_DEPTH,
                          metadata: {
                            serverMesh,
                          },
                        };
                      } else {
                        return null;
                      }
                    }).filter(object => object !== null);

                    biolumi.updateAnchors({
                      objects: objects,
                      hoverState: serverHoverState,
                      dotMesh: serverDotMesh,
                      boxMesh: serverBoxMesh,
                      controllerPosition,
                      controllerRotation,
                    });
                  }
                });
              };
              const _updateEnvMaps = () => {
                const {children: serverMeshes} = serversMesh;

                for (let i = 0; i < serverMeshes.length; i++) {
                  const serverMesh = serverMeshes[i];
                  const {envMesh} = serverMesh;
                  const {cubeCamera} = envMesh;

                  envMesh.visible = false;
                  cubeCamera.updateCubeMap(renderer, scene);
                  envMesh.visible = true;
                }
              };

              _updateMenuAnchors();
              _updateTagGrabAnchors();
              _updateTagPointerAnchors();
              _updateEnvAnchors();
              _updateServerMeshes();
              _updateServerMeshAnchors();
              _updateEnvMaps();
            };
            rend.on('update', _update);

            this._cleanup = () => {
              bootstrap.removeListener('vrModeChange', _vrModeChange);

              scene.remove(menuMesh);
              SIDES.forEach(side => {
                scene.remove(menuDotMeshes[side]);
                scene.remove(menuBoxMeshes[side]);

                scene.remove(serverDotMeshes[side]);
                scene.remove(serverBoxMeshes[side]);

                scene.remove(grabBoxMeshes[side]);
                scene.remove(tagDotMeshes[side]);
                scene.remove(tagBoxMeshes[side]);

                scene.remove(envDotMeshes[side]);
                scene.remove(envBoxMeshes[side]);
              });
              scene.remove(serversMesh);

              input.removeListener('trigger', _trigger);

              input.removeListener('click', _click);

              input.removeListener('gripdown', _gripdown);
              input.removeListener('gripup', _gripup);

              input.removeListener('keydown', _keydown);
              input.removeListener('keyboarddown', _keyboarddown);

              rend.removeListener('update', _update);
            };
          }
        });
    }
  }

  unmount() {
    this._cleanup();
  }
}

const _clone = o => JSON.parse(JSON.stringify(o));
const _makeId = () => Math.random().toString(36).substring(7);
const _copyToClipboard = s => {
  const mark = document.createElement('span');
  mark.textContent = s;
  mark.setAttribute('style', [
    // reset user styles for span element
    'all: unset',
    // prevents scrolling to the end of the page
    'position: fixed',
    'top: 0',
    'clip: rect(0, 0, 0, 0)',
    // used to preserve spaces and line breaks
    'white-space: pre',
    // do not inherit user-select (it may be `none`)
    '-webkit-user-select: text',
    '-moz-user-select: text',
    '-ms-user-select: text',
    'user-select: text',
  ].join(';'));
  document.body.appendChild(mark);

  const range = document.createRange();
  range.selectNode(mark);

  const selection = document.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);

  const successful = document.execCommand('copy');
  return successful;
};

module.exports = Hub;

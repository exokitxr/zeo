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

const SIDES = ['left', 'right'];

class Home {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {
      metadata: {
        home: {
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

    const cleanups = [];
    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };

    let live = true;
    cleanups.push(() => {
      live = false;
    });

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
        '/archae/home/img/keyboard.png',
        '/archae/home/img/controller.png',
        '/archae/home/img/menu.png',
        '/archae/home/img/teleport.png',
        '/archae/home/img/cake.png',
        '/archae/home/img/server.png',
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
      const _requestZCakeNpmItemSpec = () => fetch('/archae/rend/mods?q=' + encodeURIComponent('/plugins/z-cake'))
        .then(res => res.json()
          .then(itemSpec => {
            itemSpec.metadata.isStatic = true;

            return itemSpec;
          })
        );
      const _requestDefaultTags = () => fetch('/archae/home/defaults/data/world/tags.json')
        .then(res => res.json()
          .then(({tags}) => Object.keys(tags).map(id => tags[id]))
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
          '/core/engines/keyboard',
          '/core/engines/tags',
          '/core/utils/js-utils',
          '/core/utils/geometry-utils',
          '/core/utils/creature-utils',
        ]),
        _requestImgs(),
        _requestZCakeNpmItemSpec(),
        _requestDefaultTags(),
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
            keyboard,
            tags,
            jsUtils,
            geometryUtils,
            creatureUtils,
          ],
          imgs,
          zCakeNpmItemSpec,
          defaultTags,
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

            const mainFontSpec = {
              fonts: biolumi.getFonts(),
              fontSize: 40,
              lineHeight: 1.4,
              fontWeight: biolumi.getFontWeight(),
              fontStyle: biolumi.getFontStyle(),
            };
            const homeState = {
              page: bootstrap.getTutorialFlag() ? ('tutorial:' + 0) : 'menu',
              remoteServers: [],
              localServers: [],
              username: '',
              inputText: '',
              loading: false,
              flags: {
                localServers: myEnabled,
              },
              vrMode: bootstrap.getVrMode(),
            };
            const focusState = {
              keyboardFocusState: null,
            };

            /* const _vrModeChange = vrMode => { // XXX we might not need this with the
              homeState.vrMode = vrMode;

              _updatePages();
            };
            bootstrap.on('vrModeChange', _vrModeChange); */

            const menuMesh = (() => {
              const object = new THREE.Object3D();
              object.position.y = DEFAULT_USER_HEIGHT;

              const planeMesh = (() => {
                const menuUi = biolumi.makeUi({
                  width: WIDTH,
                  height: HEIGHT,
                });
                const mesh = menuUi.makePage(({
                  home: {
                    page,
                    remoteServers,
                    localServers,
                    inputText,
                    loading,
                    flags,
                    vrMode,
                  },
                  focus: {
                    keyboardFocusState,
                  } ,
                  imgs,
                }) => {
                  const {type: focusType = '', inputIndex = 0, inputValue = 0} = keyboardFocusState || {};

                  return {
                    type: 'html',
                    src: menuRenderer.getHomeMenuSrc({
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
                  };
                }, {
                  type: 'home',
                  state: {
                    home: homeState,
                    focus: focusState,
                    imgs: imgs,
                  },
                  worldWidth: WORLD_WIDTH,
                  worldHeight: WORLD_HEIGHT,
                });
                mesh.position.z = -1;
                mesh.receiveShadow = true;

                const {page} = mesh;
                rend.addPage(page);

                cleanups.push(() => {
                  rend.removePage(page);
                });

                return mesh;
              })();
              object.add(planeMesh);
              object.planeMesh = planeMesh;

              const scale = 2;
              const cakeTagMesh = tags.makeTag(zCakeNpmItemSpec);
              cakeTagMesh.position.y = -0.26;
              cakeTagMesh.position.z = -1 + 0.01;
              cakeTagMesh.planeMesh.scale.set(scale, scale, 1);
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

            const _makeGrabState = () => ({
              tagMesh: null,
            });
            const grabStates = {
              left: _makeGrabState(),
              right: _makeGrabState(),
            };

            const _makeGrabbableState = () => ({
              pointerMesh: null,
              grabMesh: null,
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

            const _makeEnvHoverState = () => ({
              hoveredServerMesh: null,
            });
            const envHoverStates = {
              left: _makeEnvHoverState(),
              right: _makeEnvHoverState(),
            };

            const _makeEnvDotMesh = () => {
              const geometry = new THREE.BufferGeometry();
              geometry.addAttribute('position', new THREE.BufferAttribute(Float32Array.from([0, 0, 0]), 3));
              const material = new THREE.PointsMaterial({
                color: 0xFF0000,
                size: 0.01,
              });

              const mesh = new THREE.Points(geometry, material);
              mesh.visible = false;
              return mesh;
            };
            const envDotMeshes = {
              left: _makeEnvDotMesh(),
              right: _makeEnvDotMesh(),
            };
            scene.add(envDotMeshes.left);
            scene.add(envDotMeshes.right);

            const _makeEnvBoxMesh = () => {
              const size = SPHERE_RADIUS * 2;

              const mesh = biolumi.makeBoxMesh();
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
                const mesh = serverUi.makePage(({
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
                  type: 'home',
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

                const {page} = mesh;
                rend.addPage(page);
                page.update();

                cleanups.push(() => {
                  rend.removePage(page);
                });

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
              const {planeMesh} = menuMesh;
              const {page} = planeMesh;
              page.update();
            };
            _updatePages();

            /* const _addTag = (side, srcTagMesh) => { // XXX needs to be broken up into module and entity cases
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
            }; */
            const _loadModule = itemSpec => {
              const tagMesh = tags.makeTag(itemSpec);
              tags.reifyModule(tagMesh);

              scene.add(tagMesh);
            };
            const _loadEntity = itemSpec => {
              const tagMesh = tags.makeTag(itemSpec);
              tags.reifyEntity(tagMesh);

              scene.add(tagMesh);
            };
            const _addNpmModule = (side, srcTagMesh) => {
              const itemSpec = _clone(srcTagMesh.item);
              itemSpec.id = _makeId();
              itemSpec.metadata.isStatic = false;
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

              tags.reifyModule(tagMesh);
            };

            const _requestRemoteServers = () => fetch(hubUrl + '/servers/servers.json')
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
            const _requestLocalServers = () => fetch('servers/local.json')
              .then(res => res.json()
                .then(j => {
                  const {servers} = j;

                  for (let i = 0; i < servers.length; i++) {
                    const server = servers[i];
                    if (server.url) {
                      server.url = document.location.protocol + '//' + document.location.hostname + (document.location.port ? (':' + document.location.port) : '') + '/' + server.url;
                    }
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
              homeState.page = page;

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
              homeState.loading = true;

              _setPage('remoteServers:' + 0);

              _requestRemoteServers() // XXX cancel these when switching pages
                .then(servers => {
                  homeState.remoteServers = servers;
                  homeState.loading = false;

                  _updatePages();
                })
                .catch(err => {
                  console.warn(err);
                });
            };
            const _openLocalServersPage = () => {
              homeState.loading = true;

              _setPage('localServers:' + 0);

              _requestLocalServers()
                .then(servers => {
                  homeState.localServers = servers;
                  homeState.loading = false;

                  _updatePages();
                })
                .catch(err => {
                  console.warn(err);
                });
            };
            const _proxyLoginServer = worldname => fetch('servers/proxyLogin', {
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
                    const grabbableState = grabbableStates[side];
                    const grabState = grabStates[side];
                    const {pointerMesh} = grabbableState;
                    const {tagMesh: grabMesh} = grabState;

                    if (pointerMesh && !grabMesh) {
                      _addNpmModule(side, pointerMesh); // XXX make this handle both tag and module cases

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
                const hoverState = rend.getHoverState(side);
                const {intersectionPoint} = hoverState;

                if (intersectionPoint) {
                  const {anchor} = hoverState;
                  const onclick = (anchor && anchor.onclick) || '';

                  let match;
                  if (match = onclick.match(/^server:close:(.+)$/)) {
                    const {metadata: {serverMesh}} = hoverState;
                    serversMesh.remove(serverMesh);
                  } else if (match = onclick.match(/^server:toggleRunning:(.+)$/)) {
                    const {metadata: {serverMesh}} = hoverState;
                    const {server} = serverMesh;
                    const {worldname, running} = server;

                    if (!running) {
                      fetch('servers/start', {
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
                            const err = new Error('home backend returned invalid status code: ' + status);
                            return Promise.reject(err);
                          }
                        })
                        .catch(err => {
                          console.warn(err);
                        });
                    } else {
                      fetch('servers/stop', {
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
                            const err = new Error('home backend returned invalid status code: ' + status);
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
                    const {url: serverUrl} = server;

                    const _connectServer = (token = null) => {
                      window.parent.location = serverUrl + (token ? ('?t=' + token) : '');
                    };

                    const {local} = server;
                    if (local) {
                      fetch(serverUrl + '/server/checkLogin', {
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
                const hoverState = rend.getHoverState(side);
                const {anchor} = hoverState;
                const onclick = (anchor && anchor.onclick) || '';

                let match;
                if (onclick === 'home:next') {
                  const {page} = homeState;
                  const pageSpec = _parsePage(page);
                  _setPage([pageSpec.name, parseInt(pageSpec.args[0], 10) + 1].join(':'));

                  return true;
                } else if (onclick === 'home:back') {
                  const {page} = homeState;
                  const pageSpec = _parsePage(page);
                  _setPage([pageSpec.name, parseInt(pageSpec.args[0], 10) - 1].join(':'));

                  return true;
                } if (onclick === 'home:finishTutorial') {
                  bootstrap.setTutorialFlag(false);

                  _setPage('menu');

                  return true;
                } else if (onclick === 'home:unfinishTutorial') {
                  bootstrap.setTutorialFlag(true);

                  _setPage('tutorial:' + 0);

                  return true;
                } else if (onclick === 'home:menu') {
                  _setPage('menu');

                  return true;
                } else if (onclick === 'home:remoteServers') {
                  _openRemoteServersPage();

                  return true;
                } else if (onclick === 'home:localServers') {
                  _openLocalServersPage();

                  return true;
                } else if (match = onclick.match(/^remoteServer:([0-9]+)$/)) {
                  const index = parseInt(match[1], 10);

                  const {remoteServers} = homeState;
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

                  const {localServers} = homeState;
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
                  const {page} = homeState;
                  const pageSpec = _parsePage(page);
                  _setPage([pageSpec.name, parseInt(pageSpec.args[0], 10) - 1].join(':'));

                  return true;
                } else if (onclick === 'servers:down') {
                  const {page} = homeState;
                  const pageSpec = _parsePage(page);
                  _setPage([pageSpec.name, parseInt(pageSpec.args[0], 10) + 1].join(':'));

                  return true;
                } else if (onclick === 'localServers:createServer') {
                  _setPage('createServer');

                  return true;
                } else if (onclick === 'createServer:focus') {
                  const {inputText} = homeState;
                  const {value} = hoverState;
                  const valuePx = value * 600;
                  const {index, px} = biolumi.getTextPropertiesFromCoord(inputText, mainFontSpec, valuePx); // XXX this can be folded into the keyboard engine
                  const {hmd: {position: hmdPosition, rotation: hmdRotation}} = webvr.getStatus();
                  const keyboardFocusState = keyboard.focus({
                    type: 'createServer',
                    position: hmdPosition,
                    rotation: hmdRotation,
                    inputText: inputText,
                    inputIndex: index,
                    inputValue: px,
                    fontSpec: mainFontSpec,
                  });
                  focusState.keyboardFocusState = keyboardFocusState;

                  keyboardFocusState.on('update', () => {
                    const {inputText} = keyboardFocusState;
                    homeState.inputText = inputText;

                    _updatePages();
                  });
                  keyboardFocusState.on('blur', () => {
                    focusState.keyboardFocusState = null;

                    _updatePages();
                  });

                  _updatePages();

                  return true;
                } else if (onclick === 'createServer:submit') {
                  const {inputText: worldname} = homeState;

                  if (/^[a-z][a-z0-9_-]*$/i.test(worldname)) {
                    fetch('servers/create', {
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
                } else if (onclick === 'home:apiDocs') {
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
                const hoverState = rend.getHoverState(side);
                const {intersectionPoint} = hoverState;

                if (intersectionPoint) {
                  const {anchor} = hoverState;
                  const onclick = (anchor && anchor.onclick) || '';

                  let match;
                  if (match = onclick.match(/^server:copyUrl:(.+)$/)) {
                    const {metadata: {serverMesh}} = hoverState;
                    const {server} = serverMesh;
                    const {url, token} = server;
                    const clipboardText = url + '?t=' + token;

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
              const {grabMesh} = grabbableState;

              if (grabMesh) {
                const {cakeTagMesh} = menuMesh;

                if (grabMesh === cakeTagMesh) {
                  if (!grabMesh.item.metadata.exists) {
                    _addNpmModule(side, grabMesh);
                  }
                } else {
                  const controllers = cyborg.getControllers();
                  const controller = controllers[side];
                  const {mesh: controllerMesh} = controller;
                  grabMesh.position.copy(controllerMeshOffset);
                  grabMesh.quaternion.copy(controllerMeshQuaternion);
                  grabMesh.scale.copy(oneVector);

                  controllerMesh.add(grabMesh);

                  const grabState = grabStates[side];
                  grabState.tagMesh = grabMesh;
                }

                e.stopImmediatePropagation();
              }
            };
            input.on('gripdown', _gripdown, {
              priority: 1,
            });
            const _gripup = e => {
              const {side} = e;
              const grabState = grabStates[side];
              const {tagMesh: grabTagMesh} = grabState;

              if (grabTagMesh) {
                const {position, rotation, scale} = _decomposeObjectMatrixWorld(grabTagMesh);
                scene.add(grabTagMesh);
                grabTagMesh.position.copy(position);
                grabTagMesh.quaternion.copy(rotation);
                grabTagMesh.scale.copy(scale);

                const {item} = grabTagMesh;
                const matrixArray = position.toArray().concat(rotation.toArray()).concat(scale.toArray());
                item.matrix = matrixArray;

                grabState.tagMesh = null;

                e.stopImmediatePropagation();
              }
            };
            input.on('gripup', _gripup, {
              priority: 1,
            });

            const tagMeshes = [];
            const _tagsAddTag = ({itemSpec, dst}) => {
              if (dst === 'world') {
                const {type} = itemSpec;

                if (type === 'entity') {
                  const tagMesh = tags.makeTag(itemSpec);
                  tags.reifyEntity(tagMesh);

                  tagMeshes.push(tagMesh);

                  scene.add(tagMesh);
                }
              }
            };
            tags.on('addTag', _tagsAddTag);
            const _tagsSetAttribute = ({id, name, value}) => {
              const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);
              tagMesh.setAttribute(name, value);
            };
            tags.on('setAttribute', _tagsSetAttribute);
            const _loadTags = ({itemSpecs}) => {
              for (let i = 0; i < itemSpecs.length; i++) {
                const itemSpec = itemSpecs[i];
                const {type} = itemSpec;

                if (type === 'module') {
                  _loadModule(itemSpec);
                } else if (type === 'entity') {
                  _loadEntity(itemSpec);
                }
              }
            };
            tags.on('loadTags', _loadTags);

            const _update = () => {
              const _updateTagPointerAnchors = () => {
                SIDES.forEach(side => {
                  const grabbableState = grabbableStates[side];

                  const pointerMesh = tags.getPointedTagMesh(side);
                  grabbableState.pointerMesh = pointerMesh;
                });
              };
              const _updateTagGrabAnchors = () => {
                SIDES.forEach(side => {
                  const grabbableState = grabbableStates[side];

                  const grabMesh = tags.getGrabTagMesh(side);
                  grabbableState.grabMesh = grabMesh;
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
                    const {position: controllerPosition, rotation: controllerRotation, scale: controllerScale} = gamepad;
                    const controllerLine = geometryUtils.makeControllerLine(controllerPosition, controllerRotation, controllerScale);

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

              _updateTagPointerAnchors();
              _updateTagGrabAnchors();
              _updateEnvAnchors();
              _updateServerMeshes();
              _updateEnvMaps();
            };
            rend.on('update', _update);

            tags.loadTags(defaultTags);

            cleanups.push(() => {
              // bootstrap.removeListener('vrModeChange', _vrModeChange);

              scene.remove(menuMesh);
              SIDES.forEach(side => {
                scene.remove(menuDotMeshes[side]);
                scene.remove(menuBoxMeshes[side]);

                scene.remove(serverDotMeshes[side]);
                scene.remove(serverBoxMeshes[side]);

                scene.remove(envDotMeshes[side]);
                scene.remove(envBoxMeshes[side]);
              });
              scene.remove(serversMesh);

              input.removeListener('trigger', _trigger);

              input.removeListener('click', _click);

              input.removeListener('gripdown', _gripdown);
              input.removeListener('gripup', _gripup);

              tags.removeListener('addTag', _tagsAddTag);
              tags.removeListener('setAttribute', _tagsSetAttribute);
              tags.removeListener('loadTags', _loadTags);

              rend.removeListener('update', _update);
            });
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

module.exports = Home;

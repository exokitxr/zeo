import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/world';
import worldRender from './lib/render/world';
import menuUtils from './lib/utils/menu';

const SIDES = ['left', 'right'];

const DEFAULT_QUEST_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

class World {
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
      '/core/engines/three',
      '/core/engines/input',
      '/core/engines/webvr',
      '/core/engines/fs',
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/engines/hands',
      '/core/engines/tags',
      '/core/engines/quest',
      '/core/plugins/geometry-utils',
    ]).then(([
      three,
      input,
      webvr,
      fs,
      biolumi,
      rend,
      hands,
      tags,
      quest,
      geometryUtils,
    ]) => {
      if (live) {
        const {THREE, scene} = three;

        // constants
        const oneVector = new THREE.Vector3(1, 1, 1);
        const zeroQuaternion = new THREE.Quaternion();

        const transparentMaterial = biolumi.getTransparentMaterial();
        const solidMaterial = biolumi.getSolidMaterial();

        const worldRenderer = worldRender.makeRenderer({
          monospaceFonts: biolumi.getMonospaceFonts(),
        });

        const mainFontSpec = {
          fonts: biolumi.getFonts(),
          fontSize: 30,
          lineHeight: 1.4,
          fontWeight: biolumi.getFontWeight(),
          fontStyle: biolumi.getFontStyle(),
        };

        // helper functions
        const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
        const _decomposeMatrix = matrix => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        const _requestTags = () => fetch('/archae/world/tags.json')
          .then(res => res.json());
        const _requestFiles = () => fetch('/archae/world/files.json')
          .then(res => res.json());
        const _requestWorldTimer = () => fetch('/archae/world/start-time.json')
          .then(res => res.json()
            .then(({startTime}) => {
              const now = Date.now();
              let worldTime = now - startTime;

              rend.on('update', () => {
                const now = Date.now();
                worldTime = now - startTime;
              });

              class WorldTimer {
                getWorldTime() {
                  return worldTime;
                }
              }

              return new WorldTimer();
            })
          );
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
          _requestTags(),
          _requestFiles(),
          _requestWorldTimer(),
          _requestUis(),
        ])
          .then(([
            tagsJson,
            filesJson,
            worldTimer,
            {
              menuUi,
            },
          ]) => {
            if (live) {
              const _requestLocalModSpecs = () => new Promise((accept, reject) => {
                if (npmState.cancelLocalRequest) {
                  npmState.cancelLocalRequest();
                  npmState.cancelLocalRequest = null;
                }

                let live = true;
                npmState.cancelLocalRequest = () => {
                  live = false;
                };

                fetch('/archae/rend/mods/local').then(res => res.json()
                  .then(modSpecs => {
                    if (live) {
                      accept(modSpecs);

                      npmState.cancelLocalRequest = null;
                    }
                  })
                  .catch(err => {
                    if (live) {
                      reject(err);

                      npmState.cancelLocalRequest = null;
                    }
                  })
                );
              });
              const _requestRemoteModSpecs = q => new Promise((accept, reject) => {
                if (npmState.cancelRemoteRequest) {
                  npmState.cancelRemoteRequest();
                  npmState.cancelRemoteRequest = null;
                }

                let live = true;
                npmState.cancelRemoteRequest = () => {
                  live = false;
                };

                fetch('/archae/rend/mods/search', {
                  method: 'PUT',
                  headers: (() => {
                    const headers = new Headers();
                    headers.set('Content-Type', 'application/json');
                    return headers;
                  })(),
                  body: JSON.stringify({
                    q,
                  }),
                }).then(res => res.json()
                  .then(modSpecs => {
                    if (live) {
                      accept(modSpecs);

                      npmState.cancelRemoteRequest = null;
                    }
                  })
                  .catch(err => {
                    if (live) {
                      reject(err);

                      npmState.cancelRemoteRequest = null;
                    }
                  })
                );
              });
              const _requestModSpec = mod => new Promise((accept, reject) => {
                if (npmState.cancelModRequest) {
                  npmState.cancelModRequest();
                  npmState.cancelModRequest = null;
                }

                let live = true;
                npmState.cancelModRequest = () => {
                  live = false;
                };

                fetch('/archae/rend/mods/spec', {
                  method: 'POST',
                  headers: (() => {
                    const headers = new Headers();
                    headers.set('Content-Type', 'application/json');
                    return headers;
                  })(),
                  body: JSON.stringify({
                    mod,
                  }),
                }).then(res => res.json()
                  .then(modSpecs => {
                    if (live) {
                      accept(modSpecs);

                      npmState.cancelModRequest = null;
                    }
                  })
                  .catch(err => {
                    if (live) {
                      reject(err);

                      npmState.cancelModRequest = null;
                    }
                  })
                );
              });

              let lastTagsJsonString = JSON.stringify(tagsJson);
              const _saveTags = menuUtils.debounce(next => {
                tagsJson = {
                  elements: tags.getTagsClass('elements').map(({item}) => item),
                  free: tags.getFreeTags().map(({item}) => item),
                };
                const tagsJsonString = JSON.stringify(tagsJson);

                if (tagsJsonString !== lastTagsJsonString) {
                  lastTagsJsonString = tagsJsonString;

                  return fetch('/archae/world/tags.json', {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: tagsJsonString,
                  })
                    .then(res => res.blob())
                    .then(() => {
                      next();
                    })
                    .catch(err => {
                      console.warn(err);

                      next();
                    })
                } else {
                  return Promise.resolve();
                }
              });
              let lastFilesJsonString = JSON.stringify(filesJson);
              const _saveFiles = menuUtils.debounce(next => {
                filesJson = {
                  files: fs.getFiles().map(({file}) => file),
                };
                const filesJsonString = JSON.stringify(filesJson);

                if (filesJsonString !== lastFilesJsonString) {
                  lastFilesJsonString = filesJsonString;

                  return fetch('/archae/world/files.json', {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: filesJsonString,
                  })
                    .then(res => res.blob())
                    .then(() => {
                      next();
                    })
                    .catch(err => {
                      console.warn(err);

                      next();
                    })
                } else {
                  return Promise.resolve();
                }
              });
              const _reifyTag = tagMesh => {
                const {item} = tagMesh;
                const {instance, instancing} = item;

                if (!instance && !instancing) {
                  const {name} = item;

                  item.lock()
                    .then(unlock => {
                      archae.requestPlugin(name)
                        .then(pluginInstance => {
                          const name = archae.getName(pluginInstance);

                          const tag = name;
                          let elementApi = modElementApis[tag];
                          if (!HTMLElement.isPrototypeOf(elementApi)) {
                            elementApi = HTMLElement;
                          }
                          const {attributes} = item;
                          const baseClass = elementApi;

                          const element = menuUtils.makeZeoElement({
                            tag,
                            attributes,
                            baseClass,
                          });
                          item.instance = element;
                          item.instancing = false;
                          item.attributes = _clone(attributes);

                          _updatePages();
                          tags.updatePages();

                          unlock();
                        })
                        .catch(err => {
                          console.warn(err);

                          unlock();
                        });
                    });

                  item.instancing = true;

                  _updatePages();
                  tags.updatePages();
                }
              };
              const _unreifyTag = tagMesh => {
                const {item} = tagMesh;

                item.lock()
                  .then(unlock => {
                    const {instance} = item;

                    if (instance) {
                      if (typeof instance.destructor === 'function') {
                        instance.destructor();
                      }
                      item.instance = null;

                      _updatePages();
                    }

                    unlock();
                  });
              };
              const _addElement = (tagMesh) => {
                // place tag into container
                const {
                  elementsMesh: {
                    containerMesh: elementsContainerMesh,
                  },
                } = mesh;
                elementsContainerMesh.add(tagMesh);
                tags.mountTag('elements', tagMesh);
                const elementsTagMeshes = tags.getTagsClass('elements');
                _alignTagMeshes(elementsTagMeshes);

                // update elements state
                elementsState.empty = elementsTagMeshes.length === 0;
                _updatePages();

                // reify tag
                _reifyTag(tagMesh);
              };
              const _removeElement = (tagMesh) => {
                // remove tag from container
                tags.unmountTag('elements', tagMesh);
                const elementsTagMeshes = tags.getTagsClass('elements');
                _alignTagMeshes(elementsTagMeshes);

                // update elements state
                elementsState.empty = elementsTagMeshes.length === 0;
                _updatePages();

                // unreify tag
                _unreifyTag(tagMesh);
              };
              const _alignTagMeshes = tagMeshes => {
                const aspectRatio = 400 / 150;
                const size = (0.2 * 3) + ((0.2 / 4) * 2);
                const width = 0.2;
                const height = width / aspectRatio;
                const padding = width / 4;

                for (let i = 0; i < tagMeshes.length; i++) {
                  const tagMesh = tagMeshes[i];

                  const x = i % 3;
                  const y = Math.floor(i / 3);
                  tagMesh.position.set(
                    -(width + padding) + x * (width + padding),
                    ((size / 2) - (height / 2) - padding) - (y * (height + padding)),
                    0
                  );
                  tagMesh.quaternion.copy(zeroQuaternion);
                  tagMesh.scale.copy(oneVector);
                }
              };

              const elementsState = {
                empty: true,
              };
              const npmState = {
                inputText: '',
                inputPlaceholder: 'Search npm modules',
                inputIndex: 0,
                inputValue: 0,
                cancelLocalRequest: null,
                cancelRemoteRequest: null,
                cancelModRequest: null,
              };
              const focusState = {
                type: '',
              };

              const _makeContainerHoverState = () => ({
                hovered: false,
              });
              const elementsContainerHoverStates = {
                left: _makeContainerHoverState(),
                right: _makeContainerHoverState(),
              };
              const npmContainerHoverStates = {
                left: _makeContainerHoverState(),
                right: _makeContainerHoverState(),
              };

              const npmHoverStates = {
                left: biolumi.makeMenuHoverState(),
                right: biolumi.makeMenuHoverState(),
              };

              menuUi.pushPage(({elements: {empty}, npm: {inputText, inputPlaceholder, inputValue}, focus: {type}}) => {
                const focus = type === 'npm';

                return [
                  {
                    type: 'html',
                    src: worldRenderer.getElementsPageSrc({empty}),
                    x: 0,
                    y: 0,
                    w: WIDTH / 2,
                    h: HEIGHT,
                    scroll: true,
                  },
                  {
                    type: 'html',
                    src: worldRenderer.getNpmPageSrc({inputText, inputPlaceholder, inputValue, focus, onclick: 'npm:focus'}),
                    x: WIDTH / 2,
                    y: 0,
                    w: WIDTH / 2,
                    h: HEIGHT,
                    scroll: true,
                  },
                ];
              }, {
                type: 'main',
                state: {
                  elements: elementsState,
                  npm: npmState,
                  focus: focusState,
                },
                immediate: true,
              });

              const mesh = (() => {
                const result = new THREE.Object3D();
                result.visible = false;

                const menuMesh = (() => {
                  const width = WORLD_WIDTH;
                  const height = WORLD_HEIGHT;
                  const depth = WORLD_DEPTH;

                  const menuMaterial = biolumi.makeMenuMaterial();

                  const geometry = new THREE.PlaneBufferGeometry(width, height);
                  const materials = [solidMaterial, menuMaterial];

                  const mesh = THREE.SceneUtils.createMultiMaterialObject(geometry, materials);
                  mesh.position.z = -1;
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
                result.add(menuMesh);
                result.menuMesh = menuMesh;

                const _makeContainerMesh = () => {
                  const size = (0.2 * 3) + ((0.2 / 4) * 2);
                  const width = size;
                  const height = size;
                  const depth = size / 2;

                  const geometry = new THREE.BoxBufferGeometry(width, height, depth);
                  const material = new THREE.MeshBasicMaterial({
                    color: 0x808080,
                    wireframe: true,
                  });

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.width = width;
                  mesh.height = height;
                  mesh.depth = depth;

                  return mesh;
                };
                const elementsMesh = (() => {
                  const object = new THREE.Object3D();
                  object.position.x = -0.5 - 0.1;
                  object.position.y = 0.2;
                  object.position.z = -1 + 0.05;

                  const containerMesh = _makeContainerMesh();
                  object.add(containerMesh);
                  object.containerMesh = containerMesh;

                  return object;
                })();
                result.add(elementsMesh);
                result.elementsMesh = elementsMesh;

                const npmMesh = (() => {
                  const object = new THREE.Object3D();
                  object.position.x = 0.5 - 0.1;
                  object.position.y = 0.2;
                  object.position.z = -1 + 0.05;

                  const containerMesh = _makeContainerMesh();
                  object.add(containerMesh);
                  object.containerMesh = containerMesh;

                  return object;
                })();
                result.add(npmMesh);
                result.npmMesh = npmMesh;

                return result;
              })();
              rend.addMenuMesh('worldMesh', mesh);

              const _makePositioningMesh = ({opacity = 1} = {}) => {
                const geometry = (() => {
                  const result = new THREE.BufferGeometry();
                  const positions = Float32Array.from([
                    0, 0, 0,
                    0.1, 0, 0,
                    0, 0, 0,
                    0, 0.1, 0,
                    0, 0, 0,
                    0, 0, 0.1,
                  ]);
                  result.addAttribute('position', new THREE.BufferAttribute(positions, 3));
                  const colors = Float32Array.from([
                    1, 0, 0,
                    1, 0, 0,
                    0, 1, 0,
                    0, 1, 0,
                    0, 0, 1,
                    0, 0, 1,
                  ]);
                  result.addAttribute('color', new THREE.BufferAttribute(colors, 3));
                  return result;
                })();
                const material = new THREE.LineBasicMaterial({
                  // color: 0xFFFFFF,
                  // color: 0x333333,
                  vertexColors: THREE.VertexColors,
                  opacity: opacity,
                });

                const mesh = new THREE.LineSegments(geometry, material);
                mesh.visible = false;
                return mesh;
              };
              const positioningMesh = _makePositioningMesh();
              scene.add(positioningMesh);
              const oldPositioningMesh = _makePositioningMesh({
                opacity: 0.5,
              });
              scene.add(oldPositioningMesh);

              const npmDotMeshes = {
                left: biolumi.makeMenuDotMesh(),
                right: biolumi.makeMenuDotMesh(),
              };
              scene.add(npmDotMeshes.left);
              scene.add(npmDotMeshes.right);
              const npmBoxMeshes = {
                left: biolumi.makeMenuBoxMesh(),
                right: biolumi.makeMenuBoxMesh(),
              };
              scene.add(npmBoxMeshes.left);
              scene.add(npmBoxMeshes.right);

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
                        elements: elementsState,
                        npm: npmState,
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

              const _update = e => {
                const tab = rend.getTab();

                if (tab === 'world') {
                  const _updateTextures = () => {
                    const {
                      menuMesh: {
                        menuMaterial,
                      },
                    } = mesh;
                    const uiTime = rend.getUiTime();

                    biolumi.updateMenuMaterial({
                      ui: menuUi,
                      menuMaterial,
                      uiTime,
                    });
                  };
                  const _updateAnchors = () => {
                    const tab = rend.getTab();

                    if (tab === 'world') {
                      const {
                        menuMesh,
                        elementsMesh: {
                          containerMesh: elementsContainerMesh,
                        },
                        npmMesh: {
                          containerMesh: npmContainerMesh,
                        },
                      } = mesh;

                      const elementsContainerMatrixObject = _decomposeObjectMatrixWorld(elementsContainerMesh);
                      const {position: elementsPosition, rotation: elementsRotation, scale: elementsScale} = elementsContainerMatrixObject;
                      const elementsBoxTarget = geometryUtils.makeBoxTarget(
                        elementsPosition,
                        elementsRotation,
                        elementsScale,
                        new THREE.Vector3(elementsContainerMesh.width, elementsContainerMesh.height, elementsContainerMesh.depth)
                      );

                      const menuMatrixObject = _decomposeObjectMatrixWorld(menuMesh);
                      const npmContainerMatrixObject = _decomposeObjectMatrixWorld(npmContainerMesh);
                      const {position: npmPosition, rotation: npmRotation, scale: npmScale} = npmContainerMatrixObject;
                      const npmBoxTarget = geometryUtils.makeBoxTarget(
                        npmPosition,
                        npmRotation,
                        npmScale,
                        new THREE.Vector3(npmContainerMesh.width, npmContainerMesh.height, npmContainerMesh.depth)
                      );

                      const {gamepads} = webvr.getStatus();

                      SIDES.forEach(side => {
                        const gamepad = gamepads[side];

                        if (gamepad) {
                          const {position: controllerPosition, rotation: controllerRotation} = gamepad;

                          const npmHoverState = npmHoverStates[side];
                          const npmDotMesh = npmDotMeshes[side];
                          const npmBoxMesh = npmBoxMeshes[side];

                          const elementsContainerHoverState = elementsContainerHoverStates[side];
                          const npmContainerHoverState = npmContainerHoverStates[side];

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
                            hoverState: npmHoverState,
                            dotMesh: npmDotMesh,
                            boxMesh: npmBoxMesh,
                            controllerPosition,
                            controllerRotation,
                          });
                          
                          elementsContainerHoverState.hovered = elementsBoxTarget.containsPoint(controllerPosition);
                          npmContainerHoverState.hovered = npmBoxTarget.containsPoint(controllerPosition);
                        }
                      });
                    }
                  };
                  const _updateAnchorStyles = () => {
                    const {
                      elementsMesh: {
                        containerMesh: elementsContainerMesh,
                      }
                    } = mesh;
                    const elementsHovered = SIDES.some(side => elementsContainerHoverStates[side].hovered);
                    elementsContainerMesh.material.color = new THREE.Color(elementsHovered ? 0x0000FF : 0x808080);

                    const {
                      npmMesh: {
                        containerMesh: npmContainerMesh,
                      }
                    } = mesh;
                    const npmHovered = SIDES.some(side => npmContainerHoverStates[side].hovered);
                    npmContainerMesh.material.color = new THREE.Color(npmHovered ? 0x0000FF : 0x808080);
                  };

                  _updateTextures();
                  _updateAnchors();
                  _updateAnchorStyles();
                }
              };
              rend.on('update', _update);

              const _tabchange = tab => {
                if (tab === 'world') {
                  npmState.inputText = '';
                  npmState.inputIndex = 0;
                  npmState.inputValue = 0;

                  _requestLocalModSpecs()
                    .then(tagSpecs => tagSpecs.map(tagSpec => tags.makeTag(tagSpec)))
                    .then(tagMeshes => {
                      const npmTagMeshes = tags.getTagsClass('npm');
                      for (let i = 0; i < npmTagMeshes.length; i++) {
                        const npmTagMesh = npmTagMeshes[i];
                        tags.unmountTag('npm', npmTagMesh);

                        npmTagMesh.parent.remove(npmTagMesh);
                        tags.destroyTag(npmTagMesh);
                      }

                      for (let i = 0; i < tagMeshes.length; i++) {
                        const tagMesh = tagMeshes[i];
                        const {
                          npmMesh: {
                            containerMesh: npmContainerMesh,
                          },
                        } = mesh;
                        npmContainerMesh.add(tagMesh);
                        tags.mountTag('npm', tagMesh);
                      }
                      _alignTagMeshes(npmTagMeshes);
                    })
                    .catch(err => {
                      console.warn(err);
                    });
                }
              };
              rend.on('tabchange', _tabchange);

              const _trigger = e => {
                const tab = rend.getTab();

                if (tab === 'world') {
                  const {side} = e;
                  const npmHoverState = npmHoverStates[side];
                  const {intersectionPoint} = npmHoverState;

                  if (intersectionPoint) {
                    const {anchor} = npmHoverState;
                    const onclick = (anchor && anchor.onclick) || '';

                    let match;
                    if (onclick === 'npm:focus') {
                      const {value} = npmHoverState;
                      const valuePx = value * (WIDTH - (500 + 40));

                      const {index, px} = biolumi.getTextPropertiesFromCoord(npmState.inputText, mainFontSpec, valuePx);

                      npmState.inputIndex = index;
                      npmState.inputValue = px;
                      focusState.type = 'npm';

                      _updatePages();
                    }
                  }
                }
              };
              input.on('trigger', _trigger, {
                priority: 1,
              });
              const _gripdown = e => {
                const {side} = e;

                const tagMesh = tags.getGrabbableTag(side);
                if (tagMesh) {
                  const elementsTagMeshes = tags.getTagsClass('elements');
                  const npmTagMeshes = tags.getTagsClass('npm');

                  if (elementsTagMeshes.includes(tagMesh)) {
                    _removeElement(tagMesh);

                    _saveTags();

                    _updatePages();
                  } else if (npmTagMeshes.includes(tagMesh)) {
                    const tagMeshClone = tags.cloneTag(tagMesh);
                    tags.grabTag(side, tagMeshClone);

                    _saveTags();

                    _updatePages();
                  }
                }
              };
              input.on('gripdown', _gripdown, {
                priority: 1,
              });
              const _gripup = e => {
                const {side} = e;

                const handsGrabber = hands.peek(side);
                if (handsGrabber) {
                  const {object: handsGrabberObject} = handsGrabber;

                  const _releaseTag = () => {
                    if (tags.isTag(handsGrabberObject)) {
                      const elementsHovered = elementsContainerHoverStates[side].hovered;

                      if (elementsHovered) {
                        const newTagMesh = handsGrabberObject;
                        handsGrabber.release();

                        _addElement(newTagMesh);

                        _saveTags();

                        e.stopImmediatePropagation(); // so tags engine doesn't pick it up
                      } else {
                        handsGrabber.on('release', () => { // so the item matrix is saved first
                          _saveTags();
                        });
                      }

                      return true;
                    } else {
                      return false;
                    }
                  };

                  const _releaseFile = () => {
                    if (fs.isFile(handsGrabberObject)) {
                      handsGrabber.on('release', () => { // so the item matrix is saved first
                        _saveFiles();
                      });

                      return true;
                    } else {
                      return false;
                    }
                  };

                  _releaseTag() || _releaseFile();
                }
              };
              input.on('gripup', _gripup, {
                priority: 1,
              });

              const _keydown = e => {
                const tab = rend.getTab();

                if (tab === 'world') {
                  const {type} = focusState;

                  let match;
                  if (type === 'npm') {
                    const applySpec = biolumi.applyStateKeyEvent(npmState, mainFontSpec, e);

                    if (applySpec) {
                      const {commit} = applySpec;

                      if (commit) {
                        const {inputText} = npmState;

                        focusState.type = '';

                        console.log('commit', {inputText}); // XXX actually search here
                      }

                      _updatePages();

                      e.stopImmediatePropagation();
                    }
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

              const uploadStart = ({id, name, type}) => {
                const directory = '/';
                const matrix = (() => {
                  const {hmd} = webvr.getStatus();
                  const {position, rotation} = hmd;
                  const menuMesh = rend.getMenuMesh();
                  const menuMeshMatrixInverse = new THREE.Matrix4().getInverse(menuMesh.matrix);

                  const newMatrix = new THREE.Matrix4().compose(
                    position.clone()
                      .add(new THREE.Vector3(0, 0, -0.5).applyQuaternion(rotation)),
                    rotation,
                    new THREE.Vector3(1, 1, 1)
                  ).multiply(menuMeshMatrixInverse);
                  const {position: newPosition, rotation: newRotation, scale: newScale} = _decomposeMatrix(newMatrix);

                  return newPosition.toArray().concat(newRotation.toArray()).concat(newScale.toArray());
                })();

                const fileMesh = fs.makeFile({
                  id,
                  name,
                  type,
                  directory,
                  matrix,
                });
                fileMesh.instancing = true;

                const menuMesh = rend.getMenuMesh();
                menuMesh.add(fileMesh);

                fs.updatePages();
              };
              fs.on('uploadStart', uploadStart);
              const uploadEnd = ({id}) => {
                const fileMesh = fs.getFile(id);

                if (fileMesh) {
                  const {file} = fileMesh;
                  file.instancing = false;

                  fs.updatePages();

                  _saveFiles();
                }
              };
              fs.on('uploadEnd', uploadEnd);

              const _initialize = () => {
                const _initializeElements = () => {
                  const {elements, free} = tagsJson;

                  for (let i = 0; i < elements.length; i++) {
                    const itemSpec = elements[i];
                    const tagMesh = tags.makeTag(itemSpec);
                    _addElement(tagMesh);
                  }
                  _alignTagMeshes(tags.getTagsClass('elements'));

                  const menuMesh = rend.getMenuMesh();
                  for (let i = 0; i < free.length; i++) {
                    const itemSpec = free[i];
                    const tagMesh = tags.makeTag(itemSpec);
                    menuMesh.add(tagMesh);
                  }
                };
                const _initializeFiles = () => {
                  const {files} = filesJson;

                  const menuMesh = rend.getMenuMesh();
                  for (let i = 0; i < files.length; i++) {
                    const fileSpec = files[i];
                    const fileMesh = fs.makeFile(fileSpec);
                    menuMesh.add(fileMesh);
                  }
                };
                const _initializeQuests = () => {
                  const questMesh = quest.makeQuest({
                    id: _makeId(),
                    name: 'Explore with me.',
                    author: 'avaer',
                    created: Date.now() - (2 * 60 * 1000),
                    matrix: DEFAULT_QUEST_MATRIX,
                  });

                  const menuMesh = rend.getMenuMesh();
                  menuMesh.add(questMesh);
                };

                _initializeElements();
                _initializeFiles();
                _initializeQuests();
              };
              _initialize();

              this._cleanup = () => {
                rend.removeMenuMesh('worldMesh');

                SIDES.forEach(side => {
                  scene.remove(npmDotMeshes[side]);
                  scene.remove(npmBoxMeshes[side]);
                });

                scene.remove(positioningMesh);
                scene.remove(oldPositioningMesh);

                rend.removeListener('update', _update);
                rend.removeListener('tabchange', _tabchange);

                input.removeListener('trigger', _trigger);
                input.removeListener('gripdown', _gripdown);
                input.removeListener('gripup', _gripup);
                input.removeListener('keydown', _keydown);
                input.removeListener('keyboarddown', _keyboarddown);

                fs.removeListener('uploadStart', uploadStart);
                fs.removeListener('uploadEnd', uploadEnd);
              };

              const modElementApis = {};
              class WorldApi {
                getWorldTime() {
                  return worldTimer.getWorldTime();
                }

                registerElement(pluginInstance, elementApi) {
                  const tag = archae.getName(pluginInstance);

                  modElementApis[tag] = elementApi;
                }

                unregisterElement(pluginInstance) {
                  const tag = archae.getName(pluginInstance);

                  delete modElementApis[tag];
                }
              }

              const worldApi = new WorldApi();
              return worldApi;
            }
          });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _clone = o => JSON.parse(JSON.stringify(o));
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = World;

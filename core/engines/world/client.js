import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,

  INPUT_WIDTH,
  INPUT_HEIGHT,
  INPUT_ASPECT_RATIO,
  INPUT_WORLD_WIDTH,
  INPUT_WORLD_HEIGHT,
  INPUT_WORLD_DEPTH,
} from './lib/constants/world';
import worldRenderer from './lib/render/world';
import menuUtils from './lib/utils/menu';

const SIDES = ['left', 'right'];

const ATTRIBUTE_DEFAULTS = {
  MIN: 0,
  MAX: 100,
  STEP: 0,
  OPTIONS: [],
};

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
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/engines/hands',
      '/core/engines/tags',
      '/core/plugins/geometry-utils',
    ]).then(([
      three,
      input,
      webvr,
      biolumi,
      rend,
      hands,
      tags,
      geometryUtils,
    ]) => {
      if (live) {
        const {THREE, scene} = three;

        const transparentMaterial = biolumi.getTransparentMaterial();
        const solidMaterial = biolumi.getSolidMaterial();
        const currentWorld = rend.getCurrentWorld();

        const mainFontSpec = {
          fonts: biolumi.getFonts(),
          fontSize: 72,
          lineHeight: 1.4,
          fontWeight: biolumi.getFontWeight(),
          fontStyle: biolumi.getFontStyle(),
        };
        const subcontentFontSpec = {
          fonts: biolumi.getFonts(),
          fontSize: 28,
          lineHeight: 1.4,
          fontWeight: biolumi.getFontWeight(),
          fontStyle: biolumi.getFontStyle(),
        };

        const oneVector = new THREE.Vector3(1, 1, 1);
        const zeroQuaternion = new THREE.Quaternion();

        const _decomposeObjectMatrixWorld = object => {
          const {matrixWorld} = object;
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrixWorld.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        const _requestUis = () => Promise.all([
          biolumi.requestUi({
            width: WIDTH,
            height: HEIGHT,
          }),
          biolumi.requestUi({
            width: WIDTH,
            height: HEIGHT,
          }),
          biolumi.requestUi({
            width: INPUT_WIDTH,
            height: INPUT_HEIGHT,
          }),
        ])
          .then(([
            readmeUi,
            attributesUi,
            npmUi,
          ]) => ({
            readmeUi,
            attributesUi,
            npmUi,
          }));

        return _requestUis()
          .then(({
            readmeUi,
            attributesUi,
            npmUi,
          }) => {
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
                  method: 'POST',
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

              const npmInputState = {
                inputText: '',
                inputPlaceholder: 'Search npm',
                inputIndex: 0,
                inputValue: 0,
              };
              const npmState = {
                cancelLocalRequest: null,
                cancelRemoteRequest: null,
                cancelModRequest: null,
              };
              const detailsState = {
                type: null,
                item: null,
                loading: true,
                positioningName: null,
                positioningSide: null,
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
              const readmeHoverStates = {
                left: biolumi.makeMenuHoverState(),
                right: biolumi.makeMenuHoverState(),
              };
              const attributesHoverStates = {
                left: biolumi.makeMenuHoverState(),
                right: biolumi.makeMenuHoverState(),
              };

              readmeUi.pushPage(({details: {item, loading}}) => {
                return [
                  {
                    type: 'html',
                    src: worldRenderer.getReadmePageSrc({item, loading}),
                    x: 0,
                    y: 0,
                    w: WIDTH,
                    h: HEIGHT,
                    scroll: true,
                  },
                ];
              }, {
                type: 'readme',
                state: {
                  details: detailsState,
                },
              });
              attributesUi.pushPage(({details: {item, inputText, inputValue}, focus: {type}}) => {
                const focusAttribute = (() => {
                  const match = type.match(/^attribute:(.+)$/);
                  return match && match[1];
                })();

                return [
                  {
                    type: 'html',
                    src: worldRenderer.getAttributesPageSrc({item, inputText, inputValue, focusAttribute}),
                    x: 0,
                    y: 0,
                    w: WIDTH,
                    h: HEIGHT,
                    scroll: true,
                  },
                ];
              }, {
                type: 'attributes',
                state: {
                  details: detailsState,
                  focus: focusState,
                },
              });

              npmUi.pushPage(({npm: {inputText, inputPlaceholder, inputValue}, focus: {type}}) => {
                const focus = type === 'npm';

                return [
                  {
                    type: 'html',
                    src: worldRenderer.getInputSrc({inputText, inputPlaceholder, inputValue, focus, onclick: 'npm:focus'}),
                    x: 0,
                    y: 0,
                    w: INPUT_WIDTH,
                    h: INPUT_HEIGHT,
                  },
                ];
              }, {
                type: 'npm',
                state: {
                  npm: npmInputState,
                  focus: focusState,
                },
              });

              const mesh = (() => {
                const result = new THREE.Object3D();
                result.visible = false;

                const _makeContainerMesh = () => {
                  const size = 0.4;
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
                  object.position.x = -0.5;
                  object.position.y = -0.25;
                  object.rotation.y = Math.PI / 8;

                  const containerMesh = _makeContainerMesh();
                  object.add(containerMesh);
                  object.containerMesh = containerMesh;

                  return object;
                })();
                result.add(elementsMesh);
                result.elementsMesh = elementsMesh;

                const npmMesh = (() => {
                  const object = new THREE.Object3D();
                  object.position.x = 0.5;
                  object.position.y = -0.25;
                  object.rotation.y = -Math.PI / 8;

                  const inputMesh = (() => {
                    const aspectRatio = 1000 / 100;
                    const width = 0.4;
                    const height = width / aspectRatio;
                    const depth = width / 2 / 2;

                    const menuMaterial = biolumi.makeMenuMaterial();

                    const geometry = new THREE.PlaneBufferGeometry(width, height);
                    const material = menuMaterial;

                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.y = 0.25;
                    mesh.position.z = depth;
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
                  object.add(inputMesh);
                  object.inputMesh = inputMesh;

                  const containerMesh = _makeContainerMesh();
                  object.add(containerMesh);
                  object.containerMesh = containerMesh;

                  return object;
                })();
                result.add(npmMesh);
                result.npmMesh = npmMesh;

                const _makeMenuMesh = () => {
                  const width = WORLD_WIDTH;
                  const height = WORLD_HEIGHT;
                  const depth = WORLD_DEPTH;

                  const menuMaterial = biolumi.makeMenuMaterial();

                  const geometry = new THREE.PlaneBufferGeometry(width, height);
                  const materials = [solidMaterial, menuMaterial];

                  const mesh = THREE.SceneUtils.createMultiMaterialObject(geometry, materials);
                  mesh.visible = false;
                  mesh.position.y = -0.25;
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
                };

                const readmeMesh = _makeMenuMesh();
                result.add(readmeMesh);
                result.readmeMesh = readmeMesh;

                const attributesMesh = _makeMenuMesh();
                result.add(attributesMesh);
                result.attributesMesh = attributesMesh;

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

              const readmeDotMeshes = {
                left: biolumi.makeMenuDotMesh(),
                right: biolumi.makeMenuDotMesh(),
              };
              scene.add(readmeDotMeshes.left);
              scene.add(readmeDotMeshes.right);
              const readmeBoxMeshes = {
                left: biolumi.makeMenuBoxMesh(),
                right: biolumi.makeMenuBoxMesh(),
              };
              scene.add(readmeBoxMeshes.left);
              scene.add(readmeBoxMeshes.right);

              const attributesDotMeshes = {
                left: biolumi.makeMenuDotMesh(),
                right: biolumi.makeMenuDotMesh(),
              };
              scene.add(attributesDotMeshes.left);
              scene.add(attributesDotMeshes.right);
              const attributesBoxMeshes = {
                left: biolumi.makeMenuBoxMesh(),
                right: biolumi.makeMenuBoxMesh(),
              };
              scene.add(attributesBoxMeshes.left);
              scene.add(attributesBoxMeshes.right);

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
                const readmePages = readmeUi.getPages();
                const attributesPages = attributesUi.getPages();
                const npmPages = npmUi.getPages();
                const pages = readmePages.concat(attributesPages).concat(npmPages);

                const done = () => {
                  const {type} = detailsState;

                  const {readmeMesh, attributesMesh} = mesh;
                  readmeMesh.visible = type === 'npm';
                  attributesMesh.visible = type === 'elements';

                  next();
                };

                if (pages.length > 0) {
                  let pending = pages.length;
                  const pend = () => {
                    if (--pending === 0) {
                      done();
                    }
                  };

                  for (let i = 0; i < pages.length; i++) {
                    const page = pages[i];
                    const {type} = page;

                    if (type === 'readme') {
                      page.update({
                        details: detailsState,
                      }, pend);
                    } else if (type === 'attributes') {
                      page.update({
                        details: detailsState,
                        focus: focusState,
                      }, pend);
                    } else if (type === 'npm') {
                      page.update({
                        npm: npmInputState,
                        focus: focusState,
                      }, pend);
                    } else {
                      pend();
                    }
                  }
                } else {
                  done();
                }
              });

              const _update = e => {
                const tab = rend.getTab();

                if (tab === 'world') {
                  const _updateTextures = () => {
                    const {
                      readmeMesh: {
                        menuMaterial: readmeMenuMaterial,
                      },
                      attributesMesh: {
                        menuMaterial: attributesMenuMaterial,
                      },
                      npmMesh: {
                        inputMesh: {
                          menuMaterial: npmMenuMaterial,
                        },
                      },
                    } = mesh;
                    const worldTime = currentWorld.getWorldTime();

                    biolumi.updateMenuMaterial({
                      ui: readmeUi,
                      menuMaterial: readmeMenuMaterial,
                      worldTime,
                    });
                    biolumi.updateMenuMaterial({
                      ui: attributesUi,
                      menuMaterial: attributesMenuMaterial,
                      worldTime,
                    });
                    biolumi.updateMenuMaterial({
                      ui: npmUi,
                      menuMaterial: npmMenuMaterial,
                      worldTime,
                    });
                  };
                  const _updateAnchors = () => {
                    const tab = rend.getTab();

                    if (tab === 'world') {
                      const {
                        elementsMesh: {
                          containerMesh: elementsContainerMesh,
                        },
                        npmMesh: {
                          inputMesh: npmInputMesh,
                          containerMesh: npmContainerMesh,
                        },
                        readmeMesh,
                        attributesMesh,
                      } = mesh;

                      const elementsContainerMatrixObject = _decomposeObjectMatrixWorld(elementsContainerMesh);
                      const {position: elementsPosition, rotation: elementsRotation, scale: elementsScale} = elementsContainerMatrixObject;
                      const elementsBoxTarget = geometryUtils.makeBoxTarget(
                        elementsPosition,
                        elementsRotation,
                        elementsScale,
                        new THREE.Vector3(elementsContainerMesh.width, elementsContainerMesh.height, elementsContainerMesh.depth)
                      );

                      const npmMatrixObject = _decomposeObjectMatrixWorld(npmInputMesh);
                      const npmContainerMatrixObject = _decomposeObjectMatrixWorld(npmContainerMesh);
                      const {position: npmPosition, rotation: npmRotation, scale: npmScale} = npmContainerMatrixObject;
                      const npmBoxTarget = geometryUtils.makeBoxTarget(
                        npmPosition,
                        npmRotation,
                        npmScale,
                        new THREE.Vector3(npmContainerMesh.width, npmContainerMesh.height, npmContainerMesh.depth)
                      );

                      const readmeMatrixObject = _decomposeObjectMatrixWorld(readmeMesh);
                      const attributesMatrixObject = _decomposeObjectMatrixWorld(attributesMesh);

                      const {gamepads} = webvr.getStatus();

                      SIDES.forEach(side => {
                        const gamepad = gamepads[side];

                        if (gamepad) {
                          const {position: controllerPosition, rotation: controllerRotation} = gamepad;

                          const npmHoverState = npmHoverStates[side];
                          const npmDotMesh = npmDotMeshes[side];
                          const npmBoxMesh = npmBoxMeshes[side];

                          const readmeHoverState = readmeHoverStates[side];
                          const readmeDotMesh = readmeDotMeshes[side];
                          const readmeBoxMesh = readmeBoxMeshes[side];

                          const attributesHoverState = attributesHoverStates[side];
                          const attributesDotMesh = attributesDotMeshes[side];
                          const attributesBoxMesh = attributesBoxMeshes[side];

                          const elementsContainerHoverState = elementsContainerHoverStates[side];
                          const npmContainerHoverState = npmContainerHoverStates[side];

                          biolumi.updateAnchors({
                            matrixObject: npmMatrixObject,
                            ui: npmUi,
                            hoverState: npmHoverState,
                            dotMesh: npmDotMesh,
                            boxMesh: npmBoxMesh,
                            width: INPUT_WIDTH,
                            height: INPUT_HEIGHT,
                            worldWidth: INPUT_WORLD_WIDTH,
                            worldHeight: INPUT_WORLD_HEIGHT,
                            worldDepth: INPUT_WORLD_DEPTH,
                            controllerPosition,
                            controllerRotation,
                          });
                          biolumi.updateAnchors({
                            matrixObject: readmeMatrixObject,
                            ui: readmeUi,
                            hoverState: readmeHoverState,
                            dotMesh: readmeDotMesh,
                            boxMesh: readmeBoxMesh,
                            width: WIDTH,
                            height: HEIGHT,
                            worldWidth: WORLD_WIDTH,
                            worldHeight: WORLD_HEIGHT,
                            worldDepth: WORLD_DEPTH,
                            controllerPosition,
                            controllerRotation,
                          });
                          biolumi.updateAnchors({
                            matrixObject: attributesMatrixObject,
                            ui: attributesUi,
                            hoverState: attributesHoverState,
                            dotMesh: attributesDotMesh,
                            boxMesh: attributesBoxMesh,
                            width: WIDTH,
                            height: HEIGHT,
                            worldWidth: WORLD_WIDTH,
                            worldHeight: WORLD_HEIGHT,
                            worldDepth: WORLD_DEPTH,
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
                  const _updateControllers = () => {
                    const tab = rend.getTab();

                    if (tab === 'world') {
                      const {item, positioningName, positioningSide} = detailsState;

                      if (item && positioningName && positioningSide) {
                        const {gamepads} = webvr.getStatus();
                        const gamepad = gamepads[positioningSide];

                        if (gamepad) {
                          const {position: controllerPosition, rotation: controllerRotation, scale: controllerScale} = gamepad;
                          positioningMesh.position.copy(controllerPosition);
                          positioningMesh.quaternion.copy(controllerRotation);
                          positioningMesh.scale.copy(controllerScale);

                          const {attributes} = item;
                          const attribute = attributes[positioningName];
                          const newValue = controllerPosition.toArray().concat(controllerRotation.toArray()).concat(controllerScale.toArray());
                          attribute.value = newValue;
                        }

                        if (!positioningMesh.visible) {
                          positioningMesh.visible = true;
                        }
                        if (!oldPositioningMesh.visible) {
                          oldPositioningMesh.visible = true;
                        }
                      } else {
                        if (positioningMesh.visible) {
                          positioningMesh.visible = false;
                        }
                        if (oldPositioningMesh.visible) {
                          oldPositioningMesh.visible = false;
                        }
                      }
                    }
                  };

                  _updateTextures();
                  _updateAnchors();
                  _updateAnchorStyles();
                  _updateControllers();
                }
              };
              rend.on('update', _update);

              const _tabchange = tab => {
                if (tab === 'world') {
                  npmInputState.inputText = '';
                  npmInputState.inputIndex = 0;
                  npmInputState.inputValue = 0;
                  npmInputState.focus = false;

                  _requestLocalModSpecs()
                    .then(tagSpecs => tagSpecs.map(tagSpec => tags.makeTag(tagSpec)))
                    .then(tagMeshes => {
                      for (let i = 0; i < npmTagMeshes.length; i++) {
                        const npmTagMesh = npmTagMeshes[i];
                        _removeTagMesh(npmTagMeshes, npmTagMesh);
                        _alignTagMeshes(elementsTagMeshes);

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
                        _addTagMesh(npmTagMeshes, tagMesh);
                      }
                      _alignTagMeshes(npmTagMeshes);

                      npmState.tagMeshes = tagMeshes;
                    })
                    .catch(err => {
                      console.warn(err);
                    });
                }
              };
              rend.on('tabchange', _tabchange);

              const elementsTagMeshes = [];
              const npmTagMeshes = [];
              const _addTagMesh = (tagMeshes, tagMesh) => {
                tagMeshes.push(tagMesh);
              };
              const _removeTagMesh = (tagMeshes, tagMesh) => {
                const index = tagMeshes.indexOf(tagMesh);
                if (index !== -1) {
                  tagMeshes.splice(index, 1);
                }
              };
              const _alignTagMeshes = tagMeshes => {
                const aspectRatio = 400 / 150;
                const width = 0.1;
                const height = width / aspectRatio;
                const padding = width / 4;

                for (let i = 0; i < tagMeshes.length; i++) {
                  const tagMesh = tagMeshes[i];

                  const x = i % 3;
                  const y = Math.floor(i / 3);
                  tagMesh.position.set(
                    -(width + padding) + x * (width + padding),
                    ((0.4 / 2) - (height / 2) - padding) - (y * (height + padding)),
                    0
                  );
                  tagMesh.quaternion.copy(zeroQuaternion);
                  tagMesh.scale.copy(oneVector);
                }
              };

              const _trigger = e => {
                const tab = rend.getTab();

                if (tab === 'world') {
                  const {side} = e;

                  const _doSetPosition = () => {
                    const {positioningSide} = detailsState;

                    if (positioningSide && side === positioningSide) {
                      const {item, positioningName} = detailsState;
                      const {attributes} = item;
                      const attribute = attributes[positioningName];

                      const newValue = (() => {
                        const {position, quaternion, scale} = positioningMesh;
                        return position.toArray().concat(quaternion.toArray()).concat(scale.toArray());
                      })();
                      attribute.value = newValue;

                      detailsState.positioningName = null;
                      detailsState.positioningSide = null;

                      // _saveElements();

                      _updatePages();

                      return true;
                    } else {
                      return false;
                    }
                  };
                  const _doClickNpm = () => {
                    const npmHoverState = npmHoverStates[side];
                    const {intersectionPoint} = npmHoverState;

                    if (intersectionPoint) {
                      const {anchor} = npmHoverState;
                      const onclick = (anchor && anchor.onclick) || '';

                      let match;
                      if (onclick === 'npm:focus') {
                        const {value} = npmHoverState;
                        const valuePx = value * (WIDTH - (500 + 40));

                        const {index, px} = biolumi.getTextPropertiesFromCoord(npmInputState.inputText, mainFontSpec, valuePx);

                        npmInputState.inputIndex = index;
                        npmInputState.inputValue = px;
                        focusState.type = 'npm';

                        _updatePages();

                        return true;
                      } else {
                        return false;
                      }
                    } else {
                      return false;
                    }
                  };
                  const _doClickAttribute = () => {
                    const attributesHoverState = attributesHoverStates[side];
                    const {intersectionPoint} = attributesHoverState;

                    if (intersectionPoint) {
                      const {anchor} = attributesHoverState;
                      const onclick = (anchor && anchor.onclick) || '';

                      let match;
                      if (match = onclick.match(/^attribute:(.+?):(position|focus|set|tweak|toggle|choose)(?::(.+?))?$/)) {
                        const attributeName = match[1];
                        const action = match[2];
                        const value = match[3];

                        const {item} = detailsState;
                        const {attributes} = item;
                        const attribute = attributes[attributeName];
                        const {value: attributeValue, type: attributeType} = attribute;

                        if (action === 'position') {
                          oldPositioningMesh.position.set(attributeValue[0], attributeValue[1], attributeValue[2]);
                          oldPositioningMesh.quaternion.set(attributeValue[3], attributeValue[4], attributeValue[5], attributeValue[6]);
                          oldPositioningMesh.scale.set(attributeValue[7], attributeValue[8], attributeValue[9]);

                          detailsState.positioningName = attributeName;
                          detailsState.positioningSide = side;

                          focusState.type = '';
                        } else if (action === 'focus') {
                          const {value} = attributesHoverState;

                          const textProperties = (() => {
                            if (attributeType === 'text') {
                              const valuePx = value * 400;
                              return biolumi.getTextPropertiesFromCoord(menuUtils.castValueValueToString(attributeValue, attributeType), subcontentFontSpec, valuePx);
                            } else if (attributeType === 'number') {
                              const valuePx = value * 100;
                              return biolumi.getTextPropertiesFromCoord(menuUtils.castValueValueToString(attributeValue, attributeType), subcontentFontSpec, valuePx);
                            } else if (attributeType === 'color') {
                              const valuePx = value * (400 - (40 + 4));
                              return biolumi.getTextPropertiesFromCoord(menuUtils.castValueValueToString(attributeValue, attributeType), subcontentFontSpec, valuePx);
                            } else if (attributeType === 'file') {
                              const valuePx = value * 260;
                              return biolumi.getTextPropertiesFromCoord(menuUtils.castValueValueToString(attributeValue, attributeType), subcontentFontSpec, valuePx);
                            } else {
                              return null;
                            }
                          })();
                          if (textProperties) {
                            detailsState.inputText = menuUtils.castValueValueToString(attributeValue, attributeType);
                            const {index, px} = textProperties;
                            detailsState.inputIndex = index;
                            detailsState.inputValue = px;
                          }

                          focusState.type = 'attribute:' + attributeName;
                        } else if (action === 'set') {
                          attribute.value = value;

                          focusState.type = '';

                          // _saveElements();
                        } else if (action === 'tweak') {
                          const {value} = attributesHoverState;
                          const {min = ATTRIBUTE_DEFAULTS.MIN, max = ATTRIBUTE_DEFAULTS.MAX, step = ATTRIBUTE_DEFAULTS.STEP} = attribute;

                          const newValue = (() => {
                            let n = min + (value * (max - min));
                            if (step > 0) {
                              n = Math.floor(n / step) * step;
                            }
                            return n;
                          })();
                          attribute.value = newValue;

                          focusState.type = '';

                          // _saveElements();
                        } else if (action === 'toggle') {
                          const newValue = !attributeValue;
                          attribute.value = newValue;

                          // _saveElements();
                        } else if (action === 'choose') {
                          /* menuUi.cancelTransition();

                          elementsState.choosingName = attributeName;

                          _ensureFilesLoaded(elementAttributeFilesState);

                          menuUi.pushPage(({elementAttributeFiles: {cwd, files, inputText, inputValue, selectedName, clipboardPath, loading, uploading}, focus: {type: focusType}}) => ([
                            {
                              type: 'html',
                              src: menuRenderer.getFilesPageSrc({cwd, files, inputText, inputValue, selectedName, clipboardPath, loading, uploading, focusType, prefix: 'elementAttributeFile'}),
                            },
                            {
                              type: 'image',
                              img: creatureUtils.makeAnimatedCreature('files'),
                              x: 150,
                              y: 0,
                              w: 150,
                              h: 150,
                              frameTime: 300,
                              pixelated: true,
                            }
                          ]), {
                            type: 'elementAttributeFiles',
                            state: {
                              elementAttributeFiles: elementAttributeFilesState,
                              focus: focusState,
                            },
                          }); */
                        }

                        _updatePages();

                        return true;
                      } else {
                        return false;
                      }
                    } else {
                      return false;
                    }
                  };

                  _doSetPosition() || _doClickNpm() || _doClickAttribute();
                }
              };
              input.on('trigger', _trigger, {
                priority: 1,
              });
              const _triggerdown = e => {
                const tab = rend.getTab();

                if (tab === 'world') {
                  const {side} = e;
                  const tagMesh = tags.getHoverTag(side);

                  if (tagMesh) {
                    const {item} = tagMesh;

                    if (elementsTagMeshes.includes(tagMesh)) {
                      detailsState.type = 'elements';
                      detailsState.item = item;
                    } else {
                      detailsState.type = 'npm';
                      detailsState.item = item;
                      detailsState.loading = true;

                      _requestModSpec(item.name)
                        .then(tagSpec => {
                          detailsState.item = tagSpec;
                          detailsState.loading = false;

                          _updatePages();
                        })
                        .catch(err => {
                          console.warn(err);
                        });
                    }

                    _updatePages();

                    e.stopImmediatePropagation();
                  }
                }
              };
              input.on('triggerdown', _triggerdown, {
                priority: 1,
              });
              const _gripdown = e => {
                const {side} = e;
                const tagMesh = tags.getHoverTag(side);

                if (tagMesh) {
                  if (elementsTagMeshes.includes(tagMesh)) {
                    _removeTagMesh(elementsTagMeshes, tagMesh);
                    _alignTagMeshes(elementsTagMeshes);
                  } else if (npmTagMeshes.includes(tagMesh)) {
                    const tagMeshClone = tags.cloneTag(tagMesh);
                    tags.grabTag(side, tagMeshClone);
                  }
                }

                detailsState.type = null;
                detailsState.item = null;

                _updatePages();
              };
              input.on('gripdown', _gripdown, {
                priority: 1,
              });
              const _gripup = e => {
                const {side} = e;

                const handsGrabber = hands.peek(side);
                if (handsGrabber) {
                  const {object: handsGrabberObject} = handsGrabber;

                  if (tags.isTag(handsGrabberObject)) {
                    const elementsHovered = elementsContainerHoverStates[side].hovered;

                    if (elementsHovered) {
                      const newTagMesh = handsGrabberObject;
                      handsGrabber.release();
                      const {
                        elementsMesh: {
                          containerMesh: elementsContainerMesh,
                        },
                      } = mesh;
                      elementsContainerMesh.add(newTagMesh);
                      _addTagMesh(elementsTagMeshes, newTagMesh);
                      _alignTagMeshes(elementsTagMeshes);

                      const {item} = newTagMesh;
                      detailsState.type = 'elements';
                      detailsState.item = item;
                      _updatePages();

                      e.stopImmediatePropagation(); // so tags engine doesn't pick it up
                    }
                  }
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
                    const applySpec = biolumi.applyStateKeyEvent(npmInputState, mainFontSpec, e);

                    if (applySpec) {
                      const {commit} = applySpec;

                      if (commit) {
                        const {inputText} = npmInputState;

                        focusState.type = '';

                        console.log('commit', {inputText}); // XXX actually search here
                      }

                      _updatePages();

                      e.stopImmediatePropagation();
                    }
                  } else if (match = type.match(/^attribute:(.+)$/)) {
                    const applySpec = biolumi.applyStateKeyEvent(detailsState, subcontentFontSpec, e);

                    if (applySpec) {
                      const {commit} = applySpec;

                      if (commit) {
                        const attributeName = match[1];
                        const {item, inputText} = detailsState;
                        const {attributes} = item;
                        const attribute = attributes[attributeName];
                        const {type, min = ATTRIBUTE_DEFAULTS.MIN, max = ATTRIBUTE_DEFAULTS.MAX, step = ATTRIBUTE_DEFAULTS.STEP, options = ATTRIBUTE_DEFAULTS.OPTIONS} = attribute;
                        const newValue = menuUtils.castValueStringToValue(inputText, type, min, max, step, options);
                        if (newValue !== null) {
                          attribute.value = newValue;

                          // _saveElements();
                        }

                        focusState.type = '';
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

              this._cleanup = () => {
                rend.removeMenuMesh(mesh);

                SIDES.forEach(side => {
                  scene.remove(attributesDotMeshes[side]);
                  scene.remove(attributesBoxMeshes[side]);
                  scene.remove(npmDotMeshes[side]);
                  scene.remove(npmBoxMeshes[side]);
                });

                scene.remove(positioningMesh);
                scene.remove(oldPositioningMesh);

                rend.removeListener('update', _update);
                rend.removeListener('tabchange', _tabchange);
                input.removeListener('trigger', _trigger);
                input.removeListener('triggerdown', _triggerdown);
                input.removeListener('gripdown', _gripdown);
                input.removeListener('gripup', _gripup);
                input.removeListener('keydown', _keydown);
                input.removeListener('keyboarddown', _keyboarddown);
              };

              return {};
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

module.exports = World;

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

        const _makeHoverState = () => ({
          index: null,
        });
        const hoverStates = {
          left: _makeHoverState(),
          right: _makeHoverState(),
        };

        const _requestUis = () => Promise.all([
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
            attributesUi,
            npmUi,
          ]) => ({
            attributesUi,
            npmUi,
          }));

        return _requestUis()
          .then(({
            attributesUi,
            npmUi,
          }) => {
            if (live) {
              const npmState = {
                inputText: '',
                inputPlaceholder: 'Search npm',
                inputIndex: 0,
                inputValue: 0,
                focus: true,
              };
              const attributesState = {
                element: null,
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
              const attributesHoverStates = {
                left: biolumi.makeMenuHoverState(),
                right: biolumi.makeMenuHoverState(),
              };

              attributesUi.pushPage(({attributes: {element}}) => {
                return [
                  {
                    type: 'html',
                    src: worldRenderer.getAttributesPageSrc({element}),
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
                  attributes: attributesState,
                },
              });

              npmUi.pushPage(({npm: {inputText, inputPlaceholder, inputValue, focus}}) => {
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
                  npm: npmState,
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

                    const menuMaterial = biolumi.makeMenuMaterial();

                    const geometry = new THREE.PlaneBufferGeometry(width, height);
                    const material = menuMaterial;

                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.y = 0.25;
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

                const attributesMesh = (() => {
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
                })();
                result.add(attributesMesh);
                result.attributesMesh = attributesMesh;

                return result;
              })();
              rend.addMenuMesh('worldMesh', mesh);

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
                const pages = attributesUi.getPages();

                const done = () => {
                  const {element} = attributesState;

                  const {attributesMesh} = mesh;
                  attributesMesh.visible = Boolean(element);

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

                    if (type === 'attributes') {
                      page.update({
                        attributes: attributesState,
                      }, pend);
                    } else if (type === 'npm') {
                      page.update({
                        npm: npmState,
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

                      const attributesMatrixObject = _decomposeObjectMatrixWorld(attributesMesh);

                      const {gamepads} = webvr.getStatus();

                      SIDES.forEach(side => {
                        const gamepad = gamepads[side];

                        if (gamepad) {
                          const {position: controllerPosition, rotation: controllerRotation} = gamepad;

                          const attributesHoverState = attributesHoverStates[side];
                          const attributesDotMesh = attributesDotMeshes[side];
                          const attributesBoxMesh = attributesBoxMeshes[side];

                          const npmHoverState = npmHoverStates[side];
                          const npmDotMesh = npmDotMeshes[side];
                          const npmBoxMesh = npmBoxMeshes[side];

                          const elementsContainerHoverState = elementsContainerHoverStates[side];
                          const npmContainerHoverState = npmContainerHoverStates[side];

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

              const tagMeshes = [];
              const _addTagMesh = tagMesh => {
                const {elementsMesh} = mesh;

                elementsMesh.add(tagMesh);
                tagMeshes.push(tagMesh);
                _refreshTagMeshes();

                const {item: element} = tagMesh;
                attributesState.element = element; // XXX make this based on trigger selection
                _updatePages();
              };
              const _removeTagMesh = tagMesh => {
                const index = tagMeshes.indexOf(tagMesh);

                if (index !== -1) {
                  tagMeshes.splice(index, 1);
                  _refreshTagMeshes();

                  attributesState.element = null; // XXX make this based on trigger selection
                  _updatePages();
                }
              };
              const _refreshTagMeshes = () => {
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
                    ((0.4 / 2) - (height / 2) - padding) + (y * (height + padding)),
                    0
                  );
                  tagMesh.quaternion.copy(zeroQuaternion);
                  tagMesh.scale.copy(oneVector);
                }
              };

              const _gripdown1 = e => {
                const {side} = e;
                const hoverState = hoverStates[side];
                const {index} = hoverState;

                if (index !== null) {
                  const {itemBoxMeshes} = mesh;
                  const itemBoxMesh = itemBoxMeshes[index];
                  const tagMesh = itemBoxMesh.getItemMesh();

                  if (tagMesh) {
                    tags.grabTag(side, tagMesh);

                    e.stopImmediatePropagation(); // so tags engine doesn't pick it up
                  }
                }
              };
              input.on('gripdown', _gripdown1, {
                priority: 1,
              });
              const _gripdown2 = e => {
                const {side} = e;

                const handsGrabber = hands.peek(side);
                if (handsGrabber) {
                  const {object: handsGrabberObject} = handsGrabber;

                  if (tags.isTag(handsGrabberObject)) {
                    const tagMesh = handsGrabberObject;
                    _removeTagMesh(tagMesh);
                  }
                }
              };
              input.on('gripdown', _gripdown2, {
                priority: -1,
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
                      _addTagMesh(newTagMesh);

                      e.stopImmediatePropagation(); // so tags engine doesn't pick it up
                    }
                  }
                }
              };
              input.on('gripup', _gripup, {
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

                rend.removeListener('update', _update);
                input.removeListener('gripdown', _gripdown1);
                input.removeListener('gripdown', _gripdown2);
                input.removeListener('gripup', _gripup);
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

module.exports = World;

import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/equipment';
import equipmentRender from './lib/render/equipment';
import menuUtils from './lib/utils/menu';

const SIDES = ['left', 'right'];

class Equipment {
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
      '/core/engines/quest',
      '/core/plugins/geometry-utils',
    ]).then(([
      three,
      input,
      webvr,
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

        const equipmentRenderer = equipmentRender.makeRenderer({
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

        const _requestEquipment = () => fetch('/archae/world/equipment.json')
          .then(res => res.json());

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
          _requestEquipment(),
          _requestUis(),
        ])
          .then(([
            equipmentJson,
            {
              menuUi,
            },
          ]) => {
            if (live) {
              const _makeContainerHoverState = () => ({
                hovered: false,
              });
              const equipmentContainerHoverStates = {
                left: _makeContainerHoverState(),
                right: _makeContainerHoverState(),
              };

              let lastEquipmentJsonString = JSON.stringify(equipmentJson);
              const _saveEquipment = menuUtils.debounce(next => {
                equipmentJson = {
                  equipment: tags.getTagsClass('equipment').map(({item}) => item),
                };
                const equipmentJsonString = JSON.stringify(equipmentJson);

                if (equipmentJsonString !== lastEquipmentJsonString) {
                  lastEquipmentJsonString = equipmentJsonString;

                  return fetch('/archae/world/equipment.json', {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: equipmentJsonString,
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
              /* const _reifyTag = tagMesh => {
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

                // reify tag
                _reifyTag(tagMesh);
              };
              const _removeElement = (tagMesh) => {
                // remove tag from container
                tags.unmountTag('elements', tagMesh);
                const elementsTagMeshes = tags.getTagsClass('elements');
                _alignTagMeshes(elementsTagMeshes);

                // unreify tag
                _unreifyTag(tagMesh);
              }; */
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

              const equipmentState = {};
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

              const hoverStates = {
                left: biolumi.makeMenuHoverState(),
                right: biolumi.makeMenuHoverState(),
              };

              menuUi.pushPage(({equipment, npm: {inputText, inputPlaceholder, inputValue}, focus: {type}}) => {
                const focus = type === 'npm';

                return [
                  {
                    type: 'html',
                    src: equipmentRenderer.getEquipmentPageSrc(equipment),
                    x: 0,
                    y: 0,
                    w: WIDTH / 2,
                    h: HEIGHT,
                    scroll: true,
                  },
                  {
                    type: 'html',
                    src: equipmentRenderer.getNpmPageSrc({inputText, inputPlaceholder, inputValue, focus, onclick: 'npm:focus'}),
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
                  equipment: equipmentState,
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
                const equipmentMesh = (() => {
                  const object = new THREE.Object3D();
                  object.position.x = -0.5 - 0.1;
                  object.position.y = 0.2;
                  object.position.z = -1 + 0.05;

                  const containerMesh = _makeContainerMesh();
                  object.add(containerMesh);
                  object.containerMesh = containerMesh;

                  return object;
                })();
                result.add(equipmentMesh);
                result.equipmentMesh = equipmentMesh;

                return result;
              })();
              rend.addMenuMesh('equipmentMesh', mesh);

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
                        equipment: equipmentState,
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

                if (tab === 'equipment') {
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

                    if (tab === 'equipment') {
                      const {
                        menuMesh,
                        equipmentMesh: {
                          containerMesh: equipmentContainerMesh,
                        },
                      } = mesh;

                      const equipmentContainerMatrixObject = _decomposeObjectMatrixWorld(equipmentContainerMesh);
                      const {position: equipmentPosition, rotation: equipmentRotation, scale: equipmentScale} = equipmentContainerMatrixObject;
                      const equipmentBoxTarget = geometryUtils.makeBoxTarget(
                        equipmentPosition,
                        equipmentRotation,
                        equipmentScale,
                        new THREE.Vector3(equipmentContainerMesh.width, equipmentContainerMesh.height, equipmentContainerMesh.depth)
                      );

                      const {gamepads} = webvr.getStatus();

                      SIDES.forEach(side => {
                        const gamepad = gamepads[side];

                        if (gamepad) {
                          const {position: controllerPosition, rotation: controllerRotation} = gamepad;

                          const {menuMesh} = mesh;
                          const menuMatrixObject = _decomposeObjectMatrixWorld(menuMesh);

                          const hoverState = hoverStates[side];
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
                            hoverState: hoverState,
                            dotMesh: dotMesh,
                            boxMesh: boxMesh,
                            controllerPosition,
                            controllerRotation,
                          });

                          const equipmentContainerHoverState = equipmentContainerHoverStates[side];
                          equipmentContainerHoverState.hovered = equipmentBoxTarget.containsPoint(controllerPosition);
                        }
                      });
                    }
                  };
                  const _updateAnchorStyles = () => {
                    const {
                      equipmentMesh: {
                        containerMesh: equipmentContainerMesh,
                      }
                    } = mesh;
                    const equipmentHovered = SIDES.some(side => equipmentContainerHoverStates[side].hovered);
                    equipmentContainerMesh.material.color = new THREE.Color(equipmentHovered ? 0x0000FF : 0x808080);
                  };

                  _updateTextures();
                  _updateAnchors();
                  _updateAnchorStyles();
                }
              };
              rend.on('update', _update);

              const _trigger = e => {
                const tab = rend.getTab();

                if (tab === 'equipment') {
                  const {side} = e;
                  const hoverState = hoverStates[side];
                  const {intersectionPoint} = hoverState;

                  if (intersectionPoint) {
                    const {anchor} = hoverState;
                    const onclick = (anchor && anchor.onclick) || '';

                    if (onclick === 'npm:focus') {
                      const {value} = hoverState;
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
              const _keydown = e => {
                const tab = rend.getTab();

                if (tab === 'equipment') {
                  const {type} = focusState;

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

              const _initialize = () => {
                /* const _initializeElements = () => {
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

                _initializeElements(); */
              };
              _initialize();

              this._cleanup = () => {
                rend.removeMenuMesh('eqipmentMesh');

                SIDES.forEach(side => {
                  scene.remove(dotMeshes[side]);
                  scene.remove(boxMeshes[side]);
                });

                rend.removeListener('update', _update);

                input.removeListener('trigger', _trigger);
                input.removeListener('keydown', _keydown);
                input.removeListener('keyboarddown', _keyboarddown);
              };
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

module.exports = Equipment;

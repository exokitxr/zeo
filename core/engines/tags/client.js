import MultiMutex from 'multimutex';

import {
  WIDTH,
  HEIGHT,
  OPEN_WIDTH,
  OPEN_HEIGHT,

  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
  WORLD_OPEN_WIDTH,
  WORLD_OPEN_HEIGHT,
} from './lib/constants/tags';
import tagsRenderer from './lib/render/tags';
import menuUtils from './lib/utils/menu';

const SIDES = ['left', 'right'];

const DEFAULT_EQUIPMENT = (() => {
  const numEquipmentItems = (1 + 1 + 2 + 8);
  const result = Array(numEquipmentItems);
  for (let i = 0; i < numEquipmentItems; i++) {
    result[i] = null;
  }
  return result;
})();
const DEFAULT_GRAB_RADIUS = 0.1;
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const tagFlagSymbol = Symbol();
const itemInstanceSymbol = Symbol();
const itemMutexSymbol = Symbol();
const ITEM_LOCK_KEY = 'key';

class Tags {
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
      '/core/plugins/creature-utils',
    ])
      .then(([
        three,
        input,
        webvr,
        biolumi,
        rend,
        hands,
        creatureUtils,
      ]) => {
        if (live) {
          const {THREE, scene, camera} = three;

          const transparentMaterial = biolumi.getTransparentMaterial();
          const solidMaterial = biolumi.getSolidMaterial();

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

          const subcontentFontSpec = {
            fonts: biolumi.getFonts(),
            fontSize: 20,
            lineHeight: 1.4,
            fontWeight: biolumi.getFontWeight(),
            fontStyle: biolumi.getFontStyle(),
          };

          const _requestTags = () => fetch('/archae/world/tags.json')
            .then(res => res.json());

          return _requestTags()
            .then(tagsJson => {
              if (live) {
                const _makeGrabbableState = () => ({
                  tagMesh: null,
                });
                const grabbableStates = {
                  left: _makeGrabbableState(),
                  right: _makeGrabbableState(),
                };

                const _makeGrabState = () => ({
                  grabber: null,
                });
                const grabStates = {
                  left: _makeGrabState(),
                  right: _makeGrabState(),
                };

                const hoverStates = {
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

                const _makeGrabBoxMesh = () => {
                  const width = WORLD_WIDTH;
                  const height = WORLD_HEIGHT;
                  const depth = WORLD_DEPTH;

                  const geometry = new THREE.BoxBufferGeometry(width, height, depth);
                  const material = wireframeMaterial;

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

                const detailsState = {
                  inputText: '',
                  inputPlaceholder: 'Search npm',
                  inputIndex: 0,
                  inputValue: 0,
                  positioningId: null,
                  positioningName: null,
                  positioningSide: null,
                };
                const focusState = {
                  type: '',
                };

                const _updatePages = menuUtils.debounce(next => {
                  const pageSpecs = (() => {
                    const result = [];

                    for (let i = 0; i < tagMeshes.length; i++) {
                      const tagMesh = tagMeshes[i];
                      const {ui, item} = tagMesh;

                      if (ui) {
                        const pages = ui.getPages();

                        for (let j = 0; j < pages.length; j++) {
                          const page = pages[j];
                          const pageSpec = {
                            page,
                            item,
                          };
                          result.push(pageSpec);
                        }
                      }
                    }

                    return result;
                  })();

                  if (pageSpecs.length > 0) {
                    let pending = pageSpecs.length;
                    const pend = () => {
                      if (--pending === 0) {
                        next();
                      }
                    };

                    for (let i = 0; i < pageSpecs.length; i++) {
                      const pageSpec = pageSpecs[i];
                      const {page} = pageSpec;
                      const {type} = page;

                      if (type === 'tag') {
                        const {item} = pageSpec;

                        page.update({
                          item,
                          details: detailsState,
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

                let lastTagsJsonString = JSON.stringify(tagsJson);
                const _saveTags = menuUtils.debounce(next => {
                  tagsJson = {
                    elements: tagsInstance.getTagsClass('elements').map(({item}) => item),
                    equipment: tagsInstance.getTagsClass('equipment').map(({item}) => item),
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

                const _trigger = e => {
                  const {side} = e;

                  const _doClickOpen = () => {
                    const hoverState = hoverStates[side];
                    const {intersectionPoint} = hoverState;

                    if (intersectionPoint) {
                      const {anchor} = hoverState;
                      const onclick = (anchor && anchor.onclick) || '';

                      let match;
                      if (match = onclick.match(/^tag:open:(.+)$/)) {
                        const id = match[1];
                        const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);

                        const {ui, planeMesh} = tagMesh;
                        ui.setDimensions(OPEN_WIDTH, OPEN_HEIGHT);
                        const scaleX = WORLD_OPEN_WIDTH / WORLD_WIDTH;
                        const scaleY = WORLD_OPEN_HEIGHT / WORLD_HEIGHT;
                        const offsetX = (WORLD_OPEN_WIDTH - WORLD_WIDTH) / 2;
                        const offsetY = -(WORLD_OPEN_HEIGHT - WORLD_HEIGHT) / 2;
                        planeMesh.position.x = offsetX;
                        planeMesh.position.y = offsetY;
                        planeMesh.scale.x = scaleX;
                        planeMesh.scale.y = scaleY;
                        const {item} = tagMesh;
                        item.open = true;
                        _updatePages();

                        e.stopImmediatePropagation();

                        return true;
                      } else if (match = onclick.match(/^tag:close:(.+)$/)) {
                        const id = match[1];
                        const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);

                        const {ui, planeMesh} = tagMesh;
                        ui.setDimensions(WIDTH, HEIGHT);
                        planeMesh.position.x = 0;
                        planeMesh.position.y = 0;
                        planeMesh.scale.x = 1;
                        planeMesh.scale.y = 1;
                        const {item} = tagMesh;
                        item.open = false;
                        _updatePages();

                        e.stopImmediatePropagation();

                        return true;
                      } else {
                        return false;
                      }
                    } else {
                      return false;
                    }
                  };
                  const _doSetPosition = () => {
                    const {positioningSide} = detailsState;

                    if (positioningSide && side === positioningSide) {
                      const {positioningId, positioningName} = detailsState;

                      const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === positioningId);
                      const {item} = tagMesh;
                      const newValue = (() => {
                        const {position, quaternion, scale} = positioningMesh;
                        return position.toArray().concat(quaternion.toArray()).concat(scale.toArray());
                      })();
                      item.setAttribute(positioningName, newValue);

                      detailsState.positioningId = null;
                      detailsState.positioningName = null;
                      detailsState.positioningSide = null;

                      _updatePages();

                      _saveTags();

                      return true;
                    } else {
                      return false;
                    }
                  };
                  const _doClickAttribute = () => {
                    const hoverState = hoverStates[side];
                    const {intersectionPoint} = hoverState;

                    if (intersectionPoint) {
                      const {anchor} = hoverState;
                      const onclick = (anchor && anchor.onclick) || '';

                      let match;
                      if (match = onclick.match(/^attribute:(.+?):(.+?):(position|focus|set|tweak|toggle|choose)(?::(.+?))?$/)) {
                        const tagId = match[1];
                        const attributeName = match[2];
                        const action = match[3];
                        const value = match[4];

                        const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === tagId);
                        const {item} = tagMesh;
                        const {attributes} = item;
                        const attribute = attributes[attributeName];
                        const {value: attributeValue, type: attributeType} = attribute;

                        if (action === 'position') {
                          oldPositioningMesh.position.set(attributeValue[0], attributeValue[1], attributeValue[2]);
                          oldPositioningMesh.quaternion.set(attributeValue[3], attributeValue[4], attributeValue[5], attributeValue[6]);
                          oldPositioningMesh.scale.set(attributeValue[7], attributeValue[8], attributeValue[9]);

                          detailsState.positioningId = tagId;
                          detailsState.positioningName = attributeName;
                          detailsState.positioningSide = side;

                          focusState.type = '';
                        } else if (action === 'focus') {
                          const {value} = hoverState;

                          const textProperties = (() => {
                            if (attributeType === 'text') {
                              const valuePx = value * 400; // XXX update these
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

                          focusState.type = 'attribute:' + tagId + ':' + attributeName;
                        } else if (action === 'set') {
                          item.setAttribute(attributeName, value);

                          focusState.type = '';

                          _saveTags();
                        } else if (action === 'tweak') {
                          const {value} = hoverState;
                          const {min = ATTRIBUTE_DEFAULTS.MIN, max = ATTRIBUTE_DEFAULTS.MAX, step = ATTRIBUTE_DEFAULTS.STEP} = attribute;

                          const newValue = (() => {
                            let n = min + (value * (max - min));
                            if (step > 0) {
                              n = Math.floor(n / step) * step;
                            }
                            return n;
                          })();
                          item.setAttribute(attributeName, newValue);

                          focusState.type = '';

                          _saveTags();
                        } else if (action === 'toggle') {
                          const newValue = !attributeValue;
                          item.setAttribute(attributeName, newValue);

                          _saveTags();
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

                  _doClickOpen() || _doSetPosition() || _doClickAttribute();
                };
                input.on('trigger', _trigger);
                const _gripdown = e => {
                  const {side} = e;

                  const bestGrabbableTagMesh = hands.getBestGrabbable(side, tagMeshes, {radius: DEFAULT_GRAB_RADIUS});
                  if (bestGrabbableTagMesh) {
                    tagsInstance.grabTag(side, bestGrabbableTagMesh);
                  }
                };
                input.on('gripdown', _gripdown);
                const _gripup = e => {
                  const {side} = e;
                  const grabState = grabStates[side];
                  const {grabber} = grabState;

                  if (grabber) {
                    grabber.release();
                  }
                };
                input.on('gripup', _gripup);
                const _update = () => {
                  const _updateControllers = () => {
                    const _updateElementAnchors = () => {
                      const isOpen = rend.isOpen();

                      if (isOpen) {
                        const {gamepads} = webvr.getStatus();

                        SIDES.forEach(side => {
                          const gamepad = gamepads[side];

                          if (gamepad) {
                            const {position: controllerPosition, rotation: controllerRotation} = gamepad;
                            const hoverState = hoverStates[side];
                            const dotMesh = dotMeshes[side];
                            const boxMesh = boxMeshes[side];

                            biolumi.updateAnchors({
                              objects: (tagClassMeshes.elements.concat(tagClassMeshes.equipment)).map(tagMesh => {
                                if (tagMesh) {
                                  const {ui, planeMesh} = tagMesh;

                                  if (ui && planeMesh) {
                                    const matrixObject = _decomposeObjectMatrixWorld(planeMesh);
                                    const {item: {open}} = tagMesh;

                                    return {
                                      matrixObject: matrixObject,
                                      ui: ui,
                                      width: !open ? WIDTH : OPEN_WIDTH,
                                      height: !open ? HEIGHT : OPEN_HEIGHT,
                                      worldWidth: !open ? WORLD_WIDTH : WORLD_OPEN_WIDTH,
                                      worldHeight: !open ? WORLD_HEIGHT : WORLD_OPEN_HEIGHT,
                                      worldDepth: WORLD_DEPTH,
                                    };
                                  } else {
                                    return null;
                                  }
                                } else {
                                  return null;
                                }
                              }).filter(object => object !== null),
                              hoverState: hoverState,
                              dotMesh: dotMesh,
                              boxMesh: boxMesh,
                              controllerPosition,
                              controllerRotation,
                            });
                          }
                        });
                      }
                    };
                    const _updateGrabbers = () => {
                      const isOpen = rend.isOpen();

                      if (isOpen) {
                        SIDES.forEach(side => {
                          const grabbableState = grabbableStates[side];
                          const grabBoxMesh = grabBoxMeshes[side];

                          const bestGrabbableTagMesh = hands.getBestGrabbable(side, tagMeshes, {radius: DEFAULT_GRAB_RADIUS});
                          if (bestGrabbableTagMesh) {
                            grabbableState.tagMesh = bestGrabbableTagMesh;

                            const {position: tagMeshPosition, rotation: tagMeshRotation, scale: tagMeshScale} = _decomposeObjectMatrixWorld(bestGrabbableTagMesh);
                            grabBoxMesh.position.copy(tagMeshPosition);
                            grabBoxMesh.quaternion.copy(tagMeshRotation);
                            grabBoxMesh.scale.copy(tagMeshScale);

                            if (!grabBoxMesh.visible) {
                              grabBoxMesh.visible = true;
                            }
                          } else {
                            grabbableState.tagMesh = null;

                            if (grabBoxMesh.visible) {
                              grabBoxMesh.visible = false;
                            }
                          }
                        });
                      } else {
                        SIDES.forEach(side => {
                          const grabbableState = grabbableStates[side];
                          const grabBoxMesh = grabBoxMeshes[side];

                          grabbableState.tagMesh = null;

                          if (grabBoxMesh.visible) {
                            grabBoxMesh.visible = false;
                          }
                        });
                      }
                    };
                    const _updatePositioningMesh = () => {
                      const {positioningId, positioningName, positioningSide} = detailsState;

                      if (positioningId && positioningName && positioningSide) {
                        const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === positioningId);
                        const {item} = tagMesh;
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
                          item.setAttribute(positioningName, newValue);
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
                    };

                    _updateElementAnchors();
                    _updateGrabbers();
                    _updatePositioningMesh();
                  };
                  const _updateTextures = () => {
                    const uiTime = rend.getUiTime();

                    for (let i = 0; i < tagMeshes.length; i++) {
                      const tagMesh = tagMeshes[i];
                      const {
                        ui,
                        planeMesh,
                      } = tagMesh;

                      if (ui && planeMesh) {
                        const {menuMaterial} = planeMesh;

                        biolumi.updateMenuMaterial({
                          ui,
                          menuMaterial,
                          uiTime,
                        });
                      }
                    }
                  };

                  _updateControllers();
                  _updateTextures();
                };
                rend.on('update', _update);

                this._cleanup = () => {
                  for (let i = 0; i < tagMeshes.length; i++) {
                    const tagMesh = tagMeshes[i];
                    tagMesh.parent.remove(tagMesh);
                  }
                  SIDES.forEach(side => {
                    scene.remove(dotMeshes[side]);
                    scene.remove(boxMeshes[side]);

                    scene.remove(grabBoxMeshes[side]);

                    scene.remove(positioningMesh);
                    scene.remove(oldPositioningMesh);
                  });

                  input.removeListener('trigger', _trigger);
                  input.removeListener('gripdown', _gripdown);
                  input.removeListener('gripup', _gripup);
                  rend.removeListener('update', _update);
                };

                class Item {
                  constructor(id, name, displayName, description, version, attributes, matrix) {
                    this.id = id;
                    this.name = name;
                    this.displayName = displayName;
                    this.description = description;
                    this.version = version;
                    this.attributes = attributes;
                    this.matrix = matrix;

                    this[itemInstanceSymbol] = null;
                    this.instancing = false;

                    this.open = false;

                    this[itemMutexSymbol] = new MultiMutex();
                  }

                  get instance() {
                    return this[itemInstanceSymbol];
                  }

                  set instance(instance) {
                    this[itemInstanceSymbol] = instance;
                  }

                  setAttribute(name, value) {
                    const {attributes} = this;
                    const attribute = attributes[name];
                    attribute.value = value;

                    const instance = this.instance;
                    if (instance) {
                      instance.setAttribute(name, JSON.stringify(value));
                    }
                  }

                  lock() {
                    return this[itemMutexSymbol].lock(ITEM_LOCK_KEY);
                  }
                }

                const tagMeshes = [];
                rend.registerAuxObject('tagMeshes', tagMeshes);
                const tagClassMeshes = {
                  elements: [],
                  npm: [],
                  equipment: DEFAULT_EQUIPMENT,
                };
                class TagsApi {
                  makeTag(itemSpec, options) {
                    const object = new THREE.Object3D();
                    object[tagFlagSymbol] = true;

                    const item = new Item(itemSpec.id, itemSpec.name, itemSpec.displayName, itemSpec.description, itemSpec.version, itemSpec.attributes, itemSpec.matrix);
                    object.item = item;

                    object.position.set(item.matrix[0], item.matrix[1], item.matrix[2]);
                    object.quaternion.set(item.matrix[3], item.matrix[4], item.matrix[5], item.matrix[6]);
                    object.scale.set(item.matrix[7], item.matrix[8], item.matrix[9]);

                    object.ui = null;
                    object.planeMesh = null;

                    this._requestDecorateTag(object, options);

                    tagMeshes.push(object);

                    return object;
                  }

                  _requestDecorateTag(object, options) {
                    return biolumi.requestUi({
                      width: WIDTH,
                      height: HEIGHT,
                    })
                      .then(ui => {
                        const {item} = object;

                        ui.pushPage(({item, details: {inputText, inputValue, positioningId, positioningName}, focus: {type}}) => {
                          const focusAttributeSpec = (() => {
                            const match = type.match(/^attribute:(.+?):(.+?)$/);
                            return match && {
                              tagId: match[1],
                              attributeName: match[2],
                            };
                          })();
                          const highlight = Boolean(options && options.highlight);

                          return [
                            {
                              type: 'html',
                              src: tagsRenderer.getTagSrc({item, inputText, inputValue, positioningId, positioningName, focusAttributeSpec, highlight}),
                              w: !item.open ? WIDTH : OPEN_WIDTH,
                              h: !item.open ? HEIGHT : OPEN_HEIGHT,
                            },
                            {
                              type: 'image',
                              img: creatureUtils.makeAnimatedCreature('tag:' + item.displayName),
                              x: 10,
                              y: 0,
                              w: 100,
                              h: 100,
                              frameTime: 300,
                              pixelated: true,
                            }
                          ];
                        }, {
                          type: 'tag',
                          state: {
                            item,
                            details: detailsState,
                            focus: focusState,
                          },
                          immediate: true,
                        });
                        object.ui = ui;

                        _updatePages();

                        const planeMesh = (() => {
                          const width = WORLD_WIDTH;
                          const height = WORLD_HEIGHT;
                          const depth = WORLD_DEPTH;

                          const menuMaterial = biolumi.makeMenuMaterial();

                          const geometry = new THREE.PlaneBufferGeometry(width, height);
                          const materials = [solidMaterial, menuMaterial];

                          const mesh = THREE.SceneUtils.createMultiMaterialObject(geometry, materials);
                          // mesh.position.y = 1.5;
                          mesh.receiveShadow = true;
                          mesh.menuMaterial = menuMaterial;

                          return mesh;
                        })();
                        object.add(planeMesh);
                        object.planeMesh = planeMesh;
                      });
                  }

                  destroyTag(tagMesh) {
                    const index = tagMeshes.indexOf(tagMesh);

                    if (index !== -1) {
                      tagMeshes.splice(index, 1);
                    }
                  }

                  getGrabbableTag(side) {
                    return grabbableStates[side].tagMesh;
                  }

                  mountTag(tagClass, tagMesh) {
                    tagClassMeshes[tagClass].push(tagMesh);
                  }

                  unmountTag(tagClass, tagMesh) {
                    const entries = tagClassMeshes[tagClass];
                    const index = entries.indexOf(tagMesh);

                    if (index !== -1) {
                      entries.splice(index, 1);
                    }
                  }

                  setTag(tagClass, index, tagMesh) {
                    tagClassMeshes[tagClass][index] = tagMesh;

                    return tagMesh;
                  }

                  unsetTag(tagClass, index) {
                    const tagMesh = tagClassMeshes[tagClass][index];

                    tagClassMeshes[tagClass][index] = null;

                    return tagMesh;
                  }

                  moveTag(tagClass, oldIndex, newIndex) {
                    const tagMesh = tagClassMeshes[tagClass][oldIndex];

                    tagClassMeshes[tagClass][oldIndex] = null;
                    tagClassMeshes[tagClass][newIndex] = tagMesh;

                    return tagMesh;
                  }

                  getTagsClass(tagClass) {
                    return tagClassMeshes[tagClass];
                  }

                  isTag(object) {
                    return object[tagFlagSymbol] === true;
                  }

                  grabTag(side, tagMesh) {
                    const {item} = tagMesh;
                    item.matrix = DEFAULT_MATRIX;

                    const grabber = hands.grab(side, tagMesh);
                    grabber.on('update', ({position, rotation}) => {
                      const newRotation = rotation.clone()
                        .multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1)));
                      const newPosition = position.clone()
                        .add(new THREE.Vector3(0, 0.02, 0).applyQuaternion(newRotation));

                      tagMesh.position.copy(newPosition);
                      tagMesh.quaternion.copy(newRotation);
                    });
                    grabber.on('release', () => {
                      const {position, quaternion, item} = tagMesh;
                      const newMatrixArray = position.toArray().concat(quaternion.toArray()).concat(new THREE.Vector3(1, 1, 1).toArray());
                      item.matrix = newMatrixArray;

                      grabState.grabber = null;
                    });

                    const grabState = grabStates[side];
                    grabState.grabber = grabber;
                  }

                  updatePages() {
                    _updatePages();
                  }
                };

                const tagsInstance = new TagsApi();
                return tagsInstance;
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

module.exports = Tags;

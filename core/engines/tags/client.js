import deepEqual from 'deep-equal';
import MultiMutex from 'multimutex';
import CssSelectorParser from 'css-selector-parser';
const cssSelectorParser = new CssSelectorParser.CssSelectorParser();
import binPack from 'bin-pack';

import {
  WIDTH,
  HEIGHT,
  ASPECT_RATIO,
  OPEN_WIDTH,
  OPEN_HEIGHT,
  DETAILS_WIDTH,
  DETAILS_HEIGHT,
  MENU_WIDTH,
  MENU_HEIGHT,

  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
  WORLD_OPEN_WIDTH,
  WORLD_OPEN_HEIGHT,
  WORLD_DETAILS_WIDTH,
  WORLD_DETAILS_HEIGHT,
  WORLD_MENU_WIDTH,
  WORLD_MENU_HEIGHT,
} from './lib/constants/tags';
import menuUtilser from './lib/utils/menu';
import tagsRender from './lib/render/tags';

const SIDES = ['left', 'right'];
const AXES = ['x', 'y', 'z'];

const tagMeshSymbol = Symbol();
const itemInstanceSymbol = Symbol();
const itemInstancingSymbol = Symbol();
const itemPageSymbol = Symbol();
const itemPreviewSymbol = Symbol();
const itemTempSymbol = Symbol();
const itemMediaPromiseSymbol = Symbol();
const MODULE_TAG_NAME = 'module'.toUpperCase();
const NPM_TAG_MESH_SCALE = 1.5;
const TAGS_PER_ROW = 4;
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

class Tags {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    // const {metadata} = archae;

    const cleanups = [];
    this._cleanup = () => {
      const oldCleanups = cleanups.slice();
      for (let i = 0; i < oldCleanups.length; i++) {
        const cleanup = oldCleanups[i];
        cleanup();
      }
    };

    let live = true;
    cleanups.push(() => {
      live = false;
    });

    return archae.requestPlugins([
      '/core/engines/bootstrap',
      '/core/engines/three',
      '/core/engines/input',
      '/core/engines/webvr',
      '/core/engines/cyborg',
      '/core/engines/biolumi',
      '/core/engines/keyboard',
      '/core/engines/color',
      '/core/engines/loader',
      '/core/engines/fs',
      '/core/engines/somnifer',
      '/core/engines/rend',
      '/core/utils/js-utils',
      '/core/utils/geometry-utils',
      '/core/utils/image-utils',
      '/core/utils/creature-utils',
    ])
      .then(([
        bootstrap,
        three,
        input,
        webvr,
        cyborg,
        biolumi,
        keyboard,
        color,
        loader,
        fs,
        somnifer,
        rend,
        jsUtils,
        geometryUtils,
        imageUtils,
        creatureUtils,
      ]) => {
        if (live) {
          const {THREE, scene, camera} = three;
          const {events} = jsUtils;
          const {EventEmitter} = events;

          const upVector = new THREE.Vector3(0, 1, 0);
          const lineGeometry = geometryUtils.unindexBufferGeometry(new THREE.BoxBufferGeometry(1, 1, 1));

          const nubbinMaterial = new THREE.MeshBasicMaterial({
            color: 0xCCCCCC,
          });
          cleanups.push(() => {
            nubbinMaterial.dispose();
          });
          const scalerMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFFF00,
          });
          cleanups.push(() => {
            scalerMaterial.dispose();
          });

          const transparentImg = biolumi.getTransparentImg();

          const menuUtils = menuUtilser.makeUtils({THREE, scene, fs});
          const tagsRenderer = tagsRender.makeRenderer({menuUtils, creatureUtils});

          const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
          const _decomposeMatrix = matrix => {
            const position = new THREE.Vector3();
            const rotation = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            matrix.decompose(position, rotation, scale);
            return {position, rotation, scale};
          };
          const _getWorldPosition = object => new THREE.Vector3().setFromMatrixPosition(object.matrixWorld);

          const lineMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.5,
          });

          const subcontentFontSpec = {
            fonts: biolumi.getFonts(),
            fontSize: 24,
            lineHeight: 1.4,
            fontWeight: biolumi.getFontWeight(),
            fontStyle: biolumi.getFontStyle(),
          };

          const modulesMutex = new MultiMutex();

          const rootWorldElement = document.createElement('world');
          rootWorldElement.style.cssText = 'display: none !important;';
          const localEventSymbol = Symbol();
          rootWorldElement.addEventListener('broadcast', e => {
            tagsApi.emit('broadcast', e.detail);
          });
          document.body.appendChild(rootWorldElement);

          const rootModulesElement = document.createElement('modules');
          rootWorldElement.appendChild(rootModulesElement);
          const rootModulesObserver = new MutationObserver(mutations => {
            const _reifyModule = moduleElement => {
              let {item} = moduleElement;
              if (!item) { // added manually
                tagsApi.emit('mutateAddModule', {
                  element: moduleElement,
                });
              }
              const name = moduleElement.getAttribute('src');
              const tagMesh = tagMeshes.find(tagMesh =>
                tagMesh.item.type === 'module' &&
                tagMesh.item.name === name &&
                !tagMesh.item.metadata.isStatic
              );
              item = tagMesh.item;

              const _updateNpmUi = fn => {
                const tagMesh = tagMeshes.find(tagMesh =>
                  tagMesh.item.type === 'module' &&
                  tagMesh.item.name === item.name &&
                  tagMesh.item.metadata.isStatic
                );
                if (tagMesh) {
                  fn(tagMesh);

                  const {planeMesh: {page}} = tagMesh;
                  page.update();
                }
              };

              modulesMutex.lock(name)
                .then(unlock => {
                  loader.requestPlugin(name)
                    .then(pluginInstance => {
                      item.instance = moduleElement;
                      item.instancing = false;

                      const _updateInstanceUi = () => {
                        const {planeMesh: {page}} = tagMesh;
                        page.update();

                        const {planeOpenMesh} = tagMesh;
                        if (planeOpenMesh) {
                          const {page: openPage} = planeOpenMesh
                          openPage.update();
                        }
                      };
                      _updateInstanceUi();

                      _updateNpmUi(tagMesh => {
                        const {item} = tagMesh;
                        item.instancing = false;
                        item.metadata.exists = true;
                      });

                      unlock();
                    })
                    .catch(err => {
                      console.warn(err);

                      unlock();
                    });
                });

              item.instancing = true;

              const {planeMesh: {page}} = tagMesh;
              page.update();

              const {planeOpenMesh} = tagMesh;
              if (planeOpenMesh) {
                const {page: openPage} = planeOpenMesh
                openPage.update();
              }

              _updateNpmUi(tagMesh => {
                const {item} = tagMesh;
                item.instancing = true;
              });
            };

            const _unreifyModule = moduleElement => {
              const {item} = moduleElement;

              if (item) {
                const _updateNpmUi = fn => {
                  const tagMesh = tagMeshes.find(tagMesh =>
                    tagMesh.item.type === 'module' &&
                    tagMesh.item.name === item.name &&
                    tagMesh.item.metadata.isStatic
                  );
                  if (tagMesh) {
                    fn(tagMesh);

                    const {planeMesh: {page}} = tagMesh;
                    page.update();
                  }
                };

                const name = moduleElement.getAttribute('src');
                modulesMutex.lock(name)
                  .then(unlock => {
                    loader.removePlugin(name)
                      .then(() => {
                        _updateNpmUi(tagMesh => {
                          const {item} = tagMesh;
                          item.instancing = false;
                          item.metadata.exists = false;
                        });

                        unlock();
                      })
                      .catch(err => {
                        console.warn(err);

                        unlock();
                      });
                  });

                _updateNpmUi(tagMesh => {
                  const {item} = tagMesh;
                  item.instancing = true;
                  item.metadata.exists = false;
                });

                moduleElement.item = null;
                item.instance = null;

                const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === item.id);
                if (tagMesh) { // removed manually
                  tagsApi.emit('mutateRemoveModule', {
                    id: item.id,
                  });
                }
              }
            };

            for (let i = 0; i < mutations.length; i++) {
              const mutation = mutations[i];
              const {type} = mutation;

              if (type === 'childList') {
                const {addedNodes} = mutation;

                for (let j = 0; j < addedNodes.length; j++) {
                  const addedNode = addedNodes[j];

                  if (addedNode.tagName === MODULE_TAG_NAME) {
                    const moduleElement = addedNode;
                    const name = moduleElement.getAttribute('src');
                    
                    if (name) { // adding
                      _reifyModule(moduleElement);
                    }
                  }
                }

                const {removedNodes} = mutation;
                for (let j = 0; j < removedNodes.length; j++) {
                  const removedNode = removedNodes[j];

                  if (removedNode.tagName === MODULE_TAG_NAME) {
                    const moduleElement = removedNode;
                    const name = moduleElement.getAttribute('src');
                    
                    if (name) { // removing
                      _unreifyModule(moduleElement);
                    }
                  }
                }
              } else if (type === 'attributes') {
                const {target} = mutation;

                if (target.nodeType === Node.ELEMENT_NODE) {
                  const moduleElement = target;
                  const {attributeName} = mutation;

                  if (attributeName === 'src') {
                    const {oldValue: oldValueString} = mutation;
                    const newValueString = moduleElement.getAttribute('src');

                    if (!oldValueString && newValueString) { // adding
                      _reifyModule(moduleElement);
                    } else if (oldValueString && !newValueString) { // removing
                      _unreifyModule(moduleElement);
                    } else if (oldValueString && newValueString) { // changing
                      _unreifyModule(moduleElement);
                      _reifyModule(moduleElement);
                    }
                  }
                }
              }
            }

            tagsApi.emit('mutate');
          });
          rootModulesObserver.observe(rootModulesElement, {
            childList: true,
            attributes: true,
            subtree: true,
            attributeOldValue: true,
          });

          const _addEntityCallback = (componentElement, entityElement) => {
            const _updateObject = () => {
              let {_object: object, _numComponents: numComponents} = entityElement;

              if (numComponents === undefined) {
                numComponents = 0;
              }
              numComponents++;
              entityElement._numComponents = numComponents;

              if (numComponents === 1) {
                entityElement._object = null; // defer construction/add of the actual object until requested by the component
              }
            };
            const _updateLine = () => {
              let {_lines: componentLines} = componentElement;
              if (!componentLines) {
                componentLines = new Map();
                componentElement._lines = componentLines;
              }
              const line = (() => {
                const line = linesMesh.addLine();
                const {_baseObject: componentApi} = componentElement;
                const componentApiTagName = componentApiTags.get(componentApi);
                const moduleTagMesh = tagMeshes.find(tagMesh =>
                  tagMesh.item.type === 'module' &&
                  tagMesh.item.name === componentApiTagName &&
                  !(tagMesh.item.metadata && tagMesh.item.metadata.isStatic)
                );
                const {tipMesh: moduleTipMesh} = moduleTagMesh;
                const entityId = entityElement.item.id;
                const entityTagMesh = tagMeshes.find(tagMesh => tagMesh.item.type === 'entity' && tagMesh.item.id === entityId);
                const {tipMesh: entityTipMesh} = entityTagMesh;
                line.set(moduleTipMesh, entityTipMesh);
                return line;
              })();
              linesMesh.render();
              componentLines.set(entityElement, line);
            };

            _updateObject();
            _updateLine();

            componentElement.entityAddedCallback(entityElement);
          };
          const _removeEntityCallback = (componentElement, entityElement) => {
            const _updateLine = () => {
              const {_lines: componentLines} = componentElement;
              const line = componentLines.get(entityElement);
              linesMesh.removeLine(line);
              linesMesh.render();
              componentLines.delete(line);
            };
            const _updateObject = () => {
              let {_object: object, _numComponents: numComponents} = entityElement;

              numComponents--;
              entityElement._numComponents = numComponents;

              if (numComponents === 0) {
                scene.remove(object);
                entityElement._object = null;
              }
            };
            _updateLine();
            _updateObject();

            componentElement.entityRemovedCallback(entityElement);
          };

          const _getElementJsonAttributes = element => {
            const result = {};

            const {attributes} = element;
            for (let i = 0; i < attributes.length; i++) {
              const attribute = attributes[i];
              const {name, value: valueString} = attribute;
              const value = _parseAttribute(valueString);

              result[name] = {
                value: value,
              };
            }

            return result;
          };
          const _parseAttribute = attributeString => {
            if (attributeString !== null) {
              return _jsonParse(attributeString);
            } else {
              return undefined;
            }
          };
          const _stringifyAttribute = attributeValue => {
            if (attributeValue !== undefined) {
              return JSON.stringify(attributeValue);
            } else {
              return '';
            }
          };

          const rootEntitiesElement = document.createElement('entities');
          rootWorldElement.appendChild(rootEntitiesElement);
          const entityMutationIgnores = [];
          const rootEntitiesObserver = new MutationObserver(mutations => {
            for (let i = 0; i < mutations.length; i++) {
              const mutation = mutations[i];
              const {type} = mutation;

              if (type === 'childList') {
                const {addedNodes} = mutation;
                for (let j = 0; j < addedNodes.length; j++) {
                  const addedNode = addedNodes[j];

                  if (addedNode.nodeType === Node.ELEMENT_NODE) {
                    const entityElement = addedNode;
                    const {item: initialEntityItem} = entityElement;
                    const entityAttributes = _getElementJsonAttributes(entityElement);
                    if (!initialEntityItem) { // element added manually
                      const tagName = entityElement.tagName.toLowerCase();
                      tagsApi.emit('mutateAddEntity', {
                        element: entityElement,
                        tagName: tagName,
                        attributes: entityAttributes,
                      });
                    }

                    const entitySelector = _getElementSelector(entityElement);
                    const boundComponentSpecs = _getBoundComponentSpecs(entitySelector, entityAttributes);
                    for (let k = 0; k < boundComponentSpecs.length; k++) {
                      const boundComponentSpec = boundComponentSpecs[k];
                      const {componentElement, matchingAttributes} = boundComponentSpec;
                      const {componentApi} = componentElement;
                      const {attributes: componentAttributes = {}} = componentApi;

                      _addEntityCallback(componentElement, entityElement);

                      for (let l = 0; l < matchingAttributes.length; l++) {
                        const matchingAttribute = matchingAttributes[l];
                        const entityAttribute = entityAttributes[matchingAttribute];
                        const {value: attributeValueJson} = entityAttribute;
                        const componentAttribute = componentAttributes[matchingAttribute];
                        const {type: attributeType} = componentAttribute;
                        const oldValue = null;
                        const newValue = menuUtils.castValueToCallbackValue(attributeValueJson, attributeType);

                        componentElement.entityAttributeValueChangedCallback(entityElement, matchingAttribute, oldValue, newValue);
                        const {item} = entityElement;
                        const {id: entityId} = entityElement;
                        tagsApi.emit('attributeValueChanged', {
                          entityId: entityId,
                          attributeName: matchingAttribute,
                          type: attributeType,
                          oldValue: oldValue,
                          newValue: newValue,
                        });
                      }
                    }
                  }
                }

                const {removedNodes} = mutation;
                for (let k = 0; k < removedNodes.length; k++) {
                  const removedNode = removedNodes[k];

                  if (removedNode.nodeType === Node.ELEMENT_NODE) {
                    const entityElement = removedNode;
                    const {item: initialEntityItem} = entityElement;
                    if (initialEntityItem) { // element removed manually
                      const {id: entityId} = initialEntityItem;
                      tagsApi.emit('mutateRemoveEntity', {
                        id: entityId,
                      });
                    }

                    const entitySelector = _getElementSelector(entityElement);
                    const entityAttributes = _getElementJsonAttributes(entityElement);
                    const boundComponentSpecs = _getBoundComponentSpecs(entitySelector, entityAttributes);
                    for (let l = 0; l < boundComponentSpecs.length; l++) {
                      const boundComponentSpec = boundComponentSpecs[l];
                      const {componentElement} = boundComponentSpec;

                      _removeEntityCallback(componentElement, entityElement);
                    }
                  }
                }
              } else if (type === 'attributes') {
                const {target} = mutation;

                if (target.nodeType === Node.ELEMENT_NODE) {
                  const entityElement = target;
                  const {attributeName, oldValue: oldValueString} = mutation;
                  const newValueString = entityElement.getAttribute(attributeName);
                  const oldValueJson = _parseAttribute(oldValueString);
                  const newValueJson = _parseAttribute(newValueString);

                  const {item: entityItem} = entityElement;
                  const {id: entityId} = entityItem;
                  if (!entityMutationIgnores.some(({type, args: [id, name, value]}) =>
                    type === 'setAttribute' &&
                    id === entityId &&
                    name === attributeName &&
                    deepEqual(value, newValueJson)
                  )) {
                    tagsApi.emit('mutateSetAttribute', {
                      id: entityId,
                      name: attributeName,
                      value: newValueJson,
                    });
                  }

                  const oldEntityElement = (() => {
                    const oldEntityElement = entityElement.cloneNode(false);
                    if (oldValueString === null && newValueString !== null) {
                      oldEntityElement.removeAttribute(attributeName);
                    } else if (oldValueString !== null && newValueString === null) {
                      oldEntityElement.setAttribute(attributeName, oldValueString);
                    }
                    return oldEntityElement;
                  })();

                  for (let i = 0; i < componentApis.length; i++) {
                    const componentApi = componentApis[i];
                    const {selector: componentSelector = 'div', attributes: componentAttributes = []} = componentApi;
                    const oldElementMatches = oldEntityElement.webkitMatchesSelector(componentSelector);
                    const newElementMatches = entityElement.webkitMatchesSelector(componentSelector);

                    if (oldElementMatches || newElementMatches) {
                      const componentApiInstance = componentApiInstances[i];
                      const componentElement = componentApiInstance;
                      const componentAttribute = componentAttributes[attributeName];

                      if (componentAttribute) {
                        const {type: attributeType} = componentAttribute;
                        const oldAttributeValue = menuUtils.castValueToCallbackValue(oldValueJson, attributeType);
                        const newAttributeValue = menuUtils.castValueToCallbackValue(newValueJson, attributeType);

                        if (newValueString !== null) { // adding attribute
                          if (!oldElementMatches && newElementMatches) { // if no matching attributes were previously applied, mount the component on the entity
                            _addEntityCallback(componentElement, entityElement);
                          }
                          if (newElementMatches) {
                            componentElement.entityAttributeValueChangedCallback(entityElement, attributeName, oldAttributeValue, newAttributeValue);
                            tagsApi.emit('attributeValueChanged', {
                              entityId: entityId,
                              attributeName: attributeName,
                              type: attributeType,
                              oldValue: oldAttributeValue,
                              newValue: newAttributeValue,
                            });
                          }
                        } else { // removing attribute
                          if (oldElementMatches && !newElementMatches) { // if this is the last attribute that applied, unmount the component from the entity
                            _removeEntityCallback(componentElement, entityElement);
                          } else {
                            componentElement.entityAttributeValueChangedCallback(entityElement, attributeName, oldAttributeValue, newAttributeValue);
                            tagsApi.emit('attributeValueChanged', {
                              entityId: entityId,
                              attributeName: attributeName,
                              type: attributeType,
                              oldValue: oldAttributeValue,
                              newValue: newAttributeValue,
                            });
                          }
                        }
                      }
                    }
                  }

                  const {attributes: entityAttributes} = entityItem;
                  if (newValueString !== null) {
                    entityAttributes[attributeName] = {
                      value: newValueJson,
                    };
                  } else {
                    delete entityAttributes[attributeName];
                  }

                  const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === entityId);
                  const {attributesMesh} = tagMesh;
                  attributesMesh.update();
                }
              }
            }

            entityMutationIgnores.length = 0;

            tagsApi.emit('mutate');
          });
          rootEntitiesObserver.observe(rootEntitiesElement, {
            childList: true,
            attributes: true,
            // characterData: true,
            subtree: true,
            attributeOldValue: true,
            // characterDataOldValue: true,
          });

          class UiManager {
            constructor({width, height, color, metadata}) {
              this.width = width;
              this.height = height;
              this.color = color;
              this.metadata = metadata;
            }

            makePage(pageSpec, options) {
              const {width, height, color, uis} = this;

              const ui = biolumi.makeUi({
                width: width,
                height: height,
                color,
              });
              const pageMesh = ui.makePage(pageSpec, options);
              return pageMesh;
            }
          }
          const uiManager = new UiManager({
            width: WIDTH,
            height: HEIGHT,
            // color: [1, 1, 1, 1],
            metadata: {
              open: false,
            },
          });
          const uiOpenManager = new UiManager({
            width: OPEN_WIDTH,
            height: OPEN_HEIGHT,
            // color: [1, 1, 1, 0],
            metadata: {
              open: true,
            },
          });
          const uiDetailsManager = new UiManager({
            width: DETAILS_WIDTH,
            height: DETAILS_HEIGHT,
            color: [1, 1, 1, 1],
            metadata: {
              details: true,
            },
          });
          const uiStaticManager = new UiManager({
            width: WIDTH,
            height: HEIGHT,
            color: [1, 1, 1, 1],
            metadata: {
              open: false,
            },
          });
          const uiAttributeManager = new UiManager({
            width: WIDTH,
            height: HEIGHT,
            color: [1, 1, 1, 1],
          });

          const _makeGrabHoverState = () => ({
            tagMesh: null,
          });
          const grabHoverStates = {
            left: _makeGrabHoverState(),
            right: _makeGrabHoverState(),
          };

          const linesMesh = (() => {
            const maxNumLines = 100;
            const numBoxPoints = 36;

            const geometry = (() => {
              const geometry = new THREE.BufferGeometry();
              geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(maxNumLines * numBoxPoints * 3), 3));
              geometry.setDrawRange(0, 0);
              return geometry;
            })();
            const material = lineMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            mesh.frustumCulled = false;
            mesh.visible = false;

            class Line {
              constructor() {
                this.start = null;
                this.end = null;
              }

              set(start, end) {
                this.start = start;
                this.end = end;
              }
            }

            const lines = [];
            mesh.addLine = () => {
              const line = new Line();
              lines.push(line);
              return line;
            };
            mesh.removeLine = line => {
              lines.splice(lines.indexOf(line), 1);
            };
            mesh.render = () => {
              const positionsAttribute = geometry.getAttribute('position');
              const {array: positions} = positionsAttribute;

              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const {start, end} = line;
                const startPosition = _getWorldPosition(start);
                const endPosition = _getWorldPosition(end);
                const midpoint = startPosition.clone().add(endPosition).divideScalar(2);
                const diffVector = endPosition.clone().sub(startPosition);
                const diffVectorLength = diffVector.length();
                const quaternion = new THREE.Quaternion().setFromUnitVectors(
                  upVector,
                  diffVector.clone().divideScalar(diffVectorLength)
                );

                const localLineGeometry = lineGeometry.clone()
                  .applyMatrix(new THREE.Matrix4().makeScale(0.002, diffVectorLength, 0.002))
                  .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(quaternion))
                  .applyMatrix(new THREE.Matrix4().makeTranslation(midpoint.x, midpoint.y, midpoint.z));
                const localPositions = localLineGeometry.getAttribute('position').array;
                const baseIndex = i * numBoxPoints * 3;
                positions.set(localPositions, baseIndex);
              }
              positionsAttribute.needsUpdate = true;

              geometry.setDrawRange(0, lines.length * numBoxPoints);
            };

            return mesh;
          })();
          scene.add(linesMesh);
          rend.registerAuxObject('tagsLinesMesh', linesMesh);

          const _makeDragState = () => ({
            src: null,
            dst: null,
            line: null,
          });
          const dragStates = {
            left: _makeDragState(),
            right: _makeDragState(),
          };

          const _makeGrabBoxMesh = () => {
            const mesh = biolumi.makeBoxMesh();
            const {geometry} = mesh;
            geometry.applyMatrix(new THREE.Matrix4().makeScale(WORLD_WIDTH, WORLD_HEIGHT, 0.02));
            return mesh;
          };
          const grabBoxMeshes = {
            left: _makeGrabBoxMesh(),
            right: _makeGrabBoxMesh(),
          };
          scene.add(grabBoxMeshes.left);
          scene.add(grabBoxMeshes.right);

          const detailsState = {
            inputText: '',
            inputIndex: 0,
            inputValue: 0,
            transforms: [],
            page: 0,
          };
          const focusState = {
            keyboardFocusState: null,
          };

          const localUpdates = [];

          const _getItemPreviewMode = item => fs.getFileMode(item.mimeType);
          const _requestFileItemImageMesh = item => new Promise((accept, reject) => {
            const geometry = new THREE.PlaneBufferGeometry(0.2, 0.2);
            const material = (() => {
              const texture = new THREE.Texture(
                transparentImg,
                THREE.UVMapping,
                THREE.ClampToEdgeWrapping,
                THREE.ClampToEdgeWrapping,
                THREE.LinearFilter,
                THREE.LinearFilter,
                THREE.RGBAFormat,
                THREE.UnsignedByteType,
                16
              );

              fs.makeFile('fs/' + item.id + item.name)
                .read({type: 'image'})
                .then(img => {
                  const boxImg = imageUtils.boxizeImage(img);

                  texture.image = boxImg;
                  texture.needsUpdate = true;

                  mesh.image = boxImg;

                  accept(mesh);
                })
                .catch(reject);

              const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
                transparent: true,
              });
              return material;
            })();

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.z = 0.001;
          });
          const _requestFileItemAudioMesh = item => new Promise((accept, reject) => {
            const mesh = new THREE.Object3D();

            fs.makeFile('fs/' + item.id + item.name)
              .read({type: 'audio'})
              .then(audio => {
                soundBody.setInputElement(audio);

                mesh.audio = audio;

                localUpdates.push(localUpdate);

                accept(mesh);
              })
              .catch(reject);

            const soundBody = somnifer.makeBody();
            soundBody.setObject(mesh);

            const localUpdate = () => {
              const {paused} = item;

              if (!paused) {
                const {value: prevValue} = item;
                const {audio} = mesh;
                const nextValue = audio.currentTime / audio.duration;

                if (Math.abs(nextValue - prevValue) >= (1 / 1000)) { // to reduce the frequency of texture updates
                  item.value = nextValue;

                  item.emit('update');

                  const {id} = item;
                  tagsApi.emit('seekUpdate', {
                    id: id,
                    value: nextValue,
                  });
                }
              }
            };

            mesh.destroy = () => {
              const {audio} = mesh;
              if (audio && !audio.paused) {
                audio.pause();
              }

              localUpdates.splice(localUpdates.indexOf(localUpdate), 1);
            };
          });
          const _requestFileItemVideoMesh = item => new Promise((accept, reject) => {
            const geometry = new THREE.PlaneBufferGeometry(WORLD_OPEN_WIDTH, (OPEN_HEIGHT - HEIGHT - 100) / OPEN_HEIGHT * WORLD_OPEN_HEIGHT);
            const material = (() => {
              const texture = new THREE.Texture(
                transparentImg,
                THREE.UVMapping,
                THREE.ClampToEdgeWrapping,
                THREE.ClampToEdgeWrapping,
                THREE.LinearFilter,
                THREE.LinearFilter,
                THREE.RGBAFormat,
                THREE.UnsignedByteType,
                16
              );

              const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
                transparent: true,
                depthTest: false,
              });
              return material;
            })();
            const mesh = new THREE.Mesh(geometry, material);

            fs.makeFile('fs/' + item.id + item.name)
              .read({type: 'video'})
              .then(video => {
                video.width = OPEN_WIDTH;
                video.height = (OPEN_HEIGHT - HEIGHT) - 100;

                const {map: texture} = material;

                texture.image = video;
                texture.needsUpdate = true;

                soundBody.setInputElement(video);

                mesh.video = video;

                localUpdates.push(localUpdate);

                accept(mesh);
              })
              .catch(reject);

            const soundBody = somnifer.makeBody();
            soundBody.setObject(mesh);

            const localUpdate = () => {
              const {paused} = item;

              if (!paused) {
                const {value: prevValue} = item;
                const {map: texture} = material;
                const {image: video} = texture;
                const nextValue = video.currentTime / video.duration;

                if (Math.abs(nextValue - prevValue) >= (1 / 1000)) { // to reduce the frequency of texture updates
                  item.value = nextValue;

                  item.emit('update');

                  const {id} = item;
                  tagsApi.emit('seekUpdate', {
                    id: id,
                    value: nextValue,
                  });
                }

                texture.needsUpdate = true;
              }
            };

            mesh.destroy = () => {
              const {video} = mesh;
              if (video && !video.paused) {
                video.pause();
              }

              localUpdates.splice(localUpdates.indexOf(localUpdate), 1);
            };
          });
          const _requestFileItemModelMesh = item => fs.makeFile('fs/' + item.id + item.name)
            .read({type: 'model'});

          const _menudown = e => {
            const {side} = e;
            const {gamepads} = webvr.getStatus();
            const gamepad = gamepads[side];

            if (gamepad) {
              const {buttons: {grip: {pressed: gripPressed}}} = gamepad;

              if (gripPressed) {
                const {hmd: hmdStatus} = webvr.getStatus();
                const {worldPosition: hmdPosition, worldRotation: hmdRotation, worldScale: hmdScale} = hmdStatus;
                const scaleFactor = (hmdScale.x + hmdScale.y + hmdScale.z) / 3;
                const padding = WORLD_WIDTH * 0.1;

                if (tagMeshes.length > 0) {
                  const newTagMeshes = tagMeshes.slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(tagMesh => {
                      return {
                        x: 0,
                        y: 0,
                        width: (
                          (
                            (tagMesh.attributesMesh && tagMesh.attributesMesh.attributeMeshes.length > 0) ?
                              2
                            :
                              1
                          ) * ((tagMesh.planeOpenMesh && tagMesh.planeOpenMesh.visible) ? (WORLD_OPEN_WIDTH * scaleFactor) : (WORLD_WIDTH * scaleFactor))) +
                          (padding * 2),
                        height: (
                          (
                            (tagMesh.attributesMesh && tagMesh.attributesMesh.attributeMeshes.length > 0) ?
                              tagMesh.attributesMesh.attributeMeshes.length
                            :
                              1
                          ) * ((tagMesh.planeOpenMesh && tagMesh.planeOpenMesh.visible) ? (WORLD_OPEN_HEIGHT * scaleFactor) : (WORLD_HEIGHT * scaleFactor))) +
                          (padding * 2),
                        item: tagMesh,
                      };
                    });
                  binPack(newTagMeshes, {inPlace: true});

                  let fullWidth = 0;
                  let fullHeight = 0;
                  for (let i = 0; i < newTagMeshes.length; i++) {
                    const {x, y, width, height} = newTagMeshes[i];
                    fullWidth = Math.max(fullWidth, x + width);
                    fullHeight = Math.max(fullHeight, y + height);
                  }
                  const {width: firstWidth, height: firstHeight} = newTagMeshes[0];

                  const hmdEuler = new THREE.Euler().setFromQuaternion(hmdRotation, camera.rotation.order);
                  hmdEuler.x = 0;
                  hmdEuler.z = 0;
                  const tagRotation = new THREE.Quaternion().setFromEuler(hmdEuler);

                  for (let i = 0; i < newTagMeshes.length; i++) {
                    const {x, y, item: tagMesh} = newTagMeshes[i];
                    tagMesh.position.copy(
                      hmdPosition.clone()
                        .add(
                          new THREE.Vector3(
                            -(fullWidth / 2) + (firstWidth / 2) + x,
                            (fullHeight / 2) - (firstHeight / 2) - y,
                            -1.5
                          ).applyQuaternion(tagRotation)
                        )
                    );
                    tagMesh.quaternion.copy(tagRotation);
                    tagMesh.scale.copy(hmdScale);
                    tagMesh.updateMatrixWorld();
                  }

                  linesMesh.render();

                  e.stopImmediatePropagation();
                }
              }
            }
          };
          input.on('menudown', _menudown, {
            priority: 1,
          });
          const _trigger = e => {
            const {side} = e;

            const _doClickDetails = () => {
              const hoverState = rend.getHoverState(side);
              const {intersectionPoint} = hoverState;

              if (intersectionPoint) {
                const {gamepads} = webvr.getStatus();
                const gamepad = gamepads[side];

                if (gamepad) {
                  const {buttons: {grip: {pressed: gripPressed}}} = gamepad;

                  if (!gripPressed) {
                    const {anchor} = hoverState;
                    const onclick = (anchor && anchor.onclick) || '';

                    let match;
                    if (match = onclick.match(/^(?:module|asset):main:(.+)$/)) {
                      const id = match[1];

                      const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);
                      const isStatic = Boolean(tagMesh.item.metadata && tagMesh.item.metadata.isStatic);

                      tagsApi.emit('openDetails', {
                        id: id,
                        isStatic,
                      });

                      return true;
                    } else if (match = onclick.match(/^(?:module|asset):close:(.+)$/)) {
                      const id = match[1];

                      const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);
                      const isStatic = Boolean(tagMesh.item.metadata && tagMesh.item.metadata.isStatic);

                      tagsApi.emit('closeDetails', {
                        id: id,
                        isStatic: isStatic,
                      });

                      return true;
                    } else if (match = onclick.match(/^module:focusVersion:(.+)$/)) {
                      const id = match[1];

                      const _updateTagMeshDetailsPage = () => {
                        const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);
                        const {planeDetailsMesh} = tagMesh;
                        const {page} = planeDetailsMesh;
                        page.update();
                      };

                      const keyboardFocusState = keyboard.fakeFocus({
                        type: 'version:' + id,
                      });
                      focusState.keyboardFocusState = keyboardFocusState;

                      keyboardFocusState.on('blur', () => {
                        focusState.keyboardFocusState = null;

                        _updateTagMeshDetailsPage();
                      });

                      _updateTagMeshDetailsPage();

                      return true;
                    } else if (match = onclick.match(/^module:setVersion:(.+):(.+)$/)) {
                      const id = match[1];
                      const version = match[2];

                      const _updateTagMeshDetailsPage = () => {
                        const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);
                        const {planeDetailsMesh} = tagMesh;
                        const {page} = planeDetailsMesh;
                        page.update();
                      };

                      const {keyboardFocusState} = focusState;
                      const {type: focusType = ''} = keyboardFocusState || {};
                      let match2;
                      if (match2 = focusType.match(/^version:(.+?)$/)) {
                        const focusId = match2[1];

                        if (focusId === id) {
                          console.log('set version', { // XXX actually switch the version here
                            id,
                            version,
                          });

                          keyboardFocusState.blur();

                          return true;
                        } else {
                          return false;
                        }
                      } else {
                        return false;
                      }
                    } else if (match = onclick.match(/^module:reinstall:(.+)$/)) {
                      const id = match[1];

                      tagsApi.emit('reinstallModule', {id});

                      return true;
                    } else if (match = onclick.match(/^module:up:(.+)$/)) {
                      const id = match[1];

                      const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);
                      const {item, planeDetailsMesh} = tagMesh;
                      const {page} = planeDetailsMesh;

                      item.page--;
                      page.update();

                      return true;
                    } else if (match = onclick.match(/^module:down:(.+)$/)) {
                      const id = match[1];

                      const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);
                      const {item, planeDetailsMesh} = tagMesh;
                      const {page} = planeDetailsMesh;

                      item.page++;
                      page.update();

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
              } else {
                return false;
              }
            };
            const _doClickGrabNpmTag = () => {
              const {gamepads} = webvr.getStatus();
              const gamepad = gamepads[side];

              if (gamepad) {
                const {buttons: {grip: {pressed: gripPressed}}} = gamepad;

                if (gripPressed) {
                  const hoverState = rend.getHoverState(side);
                  const {intersectionPoint} = hoverState;

                  if (intersectionPoint) {
                    const {anchor} = hoverState;
                    const onclick = (anchor && anchor.onclick) || '';

                    let match;
                    if (match = onclick.match(/^(module|entity|asset):main:(.+?)$/)) {
                      const type = match[1];
                      const id = match[2];

                      const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);

                      if (
                        Boolean(tagMesh.item.metadata && tagMesh.item.metadata.isStatic) &&
                        !(type === 'module' && (tagMesh.item.metadata.exists || tagMesh.item.instancing)) &&
                        type !== 'asset'
                      ) {
                        tagsApi.emit('grabNpmTag', { // XXX handle the multi-{user,controller} conflict cases
                          side,
                          tagMesh,
                        });

                        return true;
                      } else {
                        return false;
                      }
                    } else if (match = onclick.match(/^asset:bill:(.+):([0-9.]+)$/)) {
                      const id = match[1];
                      const quantity = parseFloat(match[2]);

                      const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);

                      tagsApi.emit('grabAssetBill', {
                        side,
                        tagMesh,
                        quantity,
                      });

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
              } else {
                return false;
              }
            };
            const _doClickGrabWorldTag = () => {
              const {gamepads} = webvr.getStatus();
              const gamepad = gamepads[side];

              if (gamepad) {
                const {buttons: {grip: {pressed: gripPressed}}} = gamepad;

                if (gripPressed) {
                  const hoverState = rend.getHoverState(side);
                  const {type} = hoverState;

                  if (type === 'page') {
                    const {target: page} = hoverState;
                    const {mesh} = page;

                    if (mesh[tagMeshSymbol]) {
                      const {tagMesh} = mesh;
                      const {item} = tagMesh;
                      const {type, metadata} = item;

                      if (
                        (type === 'module' && !(metadata && metadata.isStatic)) ||
                        (type === 'entity' && !(metadata && metadata.isStatic)) ||
                        (type === 'file') ||
                        (type === 'asset' && !(metadata && metadata.isStatic))
                      ) {
                        tagsApi.emit('grabWorldTag', {
                          side,
                          tagMesh
                        });

                        return true;
                      } else {
                        return false;
                      }
                    }
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
            const _doClickAux = () => {
              const hoverState = rend.getHoverState(side);
              const {intersectionPoint} = hoverState;

              if (intersectionPoint) {
                const {anchor} = hoverState;
                const onclick = (anchor && anchor.onclick) || '';

                let match;
                if (match = onclick.match(/^entity:addAttribute:(.+)$/)) {
                  const id = match[1];

                  const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);
                  const {item} = tagMesh;
                  const {attributes} = item;
                  const newAttributeName = (() => {
                    for (let i = 1;; i++) {
                      const attributeName = 'attribute-' + i;
                      if (!(attributeName in attributes)) {
                        return attributeName;
                      }
                    }

                    return null;
                  })();

                  tagsApi.emit('setAttribute', {
                    id: id,
                    name: newAttributeName,
                    value: 'value',
                  });

                  e.stopImmediatePropagation();

                  return true;
                } else if (match = onclick.match(/^tag:open:(.+)$/)) {
                  const id = match[1];

                  tagsApi.emit('open', {
                    id: id,
                  });

                  e.stopImmediatePropagation();

                  return true;
                } else if (match = onclick.match(/^tag:close:(.+)$/)) {
                  const id = match[1];

                  tagsApi.emit('close', {
                    id: id,
                  });

                  e.stopImmediatePropagation();

                  return true;
                } else if (match = onclick.match(/^tag:remove:(.+)$/)) {
                  const id = match[1];

                  tagsApi.emit('remove', {
                    id: id,
                  });

                  e.stopImmediatePropagation();

                  return true;
                } else if (match = onclick.match(/^tag:download:(.+)$/)) {
                  const id = match[1];

                  const downloadEvent = {
                    id,
                  };
                  tagsApi.emit('download', downloadEvent);

                  return true;
                } else if (match = onclick.match(/^attribute:remove:(.+?):(.+?)$/)) {
                  const id = match[1];
                  const name = match[2];

                  tagsApi.emit('setAttribute', {
                    id: id,
                    name: name,
                    value: undefined,
                  });

                  return true;
                } else if (match = onclick.match(/^media:(play|pause|seek):(.+)$/)) {
                  const action = match[1];
                  const id = match[2];

                  if (action === 'play') {
                    tagsApi.emit('play', {
                      id: id,
                    });
                  } else if (action === 'pause') {
                    tagsApi.emit('pause', {
                      id: id,
                    });
                  } else if (action === 'seek') {
                    const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);
                    const {item} = tagMesh;

                    item.getMedia()
                      .then(({media}) => {
                        const {value} = hoverState;

                        tagsApi.emit('seek', {
                          id: id,
                          value: value,
                        });
                      })
                      .catch(err => {
                        console.warn(err);
                      });
                  }

                  return true;
                } else {
                  return false;
                }
              } else {
                return false;
              }
            };
            const _doClickAttribute = () => {
              const hoverState = rend.getHoverState(side);
              const {intersectionPoint} = hoverState;

              if (intersectionPoint) {
                const {anchor} = hoverState;
                const onclick = (anchor && anchor.onclick) || '';

                let match;
                if (match = onclick.match(/^attribute:([^:]+):([^:]+)(?::([^:]+))?:(focus|set|tweak|pick|toggle|choose)(?::([^:]+))?$/)) {
                  const tagId = match[1];
                  const attributeName = match[2];
                  const key = match[3];
                  const action = match[4];
                  const value = match[5];

                  const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === tagId);
                  const {item} = tagMesh;
                  const {attributes} = item;
                  const attribute = attributes[attributeName];
                  const {value: attributeValue} = attribute;

                  const _updateAttributes = () => {
                    const {attributesMesh} = tagMesh;
                    attributesMesh.update();
                  };

                  if (action === 'focus') {
                    const {value: hoverValue} = hoverState;
                    const {type} = _getAttributeSpec(attributeName);

                    const textProperties = (() => {
                      if (type === 'text') {
                        const hoverValuePx = hoverValue * 400;
                        return biolumi.getTextPropertiesFromCoord(menuUtils.castValueValueToString(attributeValue, type), subcontentFontSpec, hoverValuePx);
                      } else if (type === 'number') {
                        const hoverValuePx = hoverValue * 100;
                        return biolumi.getTextPropertiesFromCoord(menuUtils.castValueValueToString(attributeValue, type), subcontentFontSpec, hoverValuePx);
                      } else if (type === 'color') {
                        const hoverValuePx = hoverValue * (400 - (40 + 4));
                        return biolumi.getTextPropertiesFromCoord(menuUtils.castValueValueToString(attributeValue, type), subcontentFontSpec, hoverValuePx);
                      } else {
                        return null;
                      }
                    })();
                    const keyboardFocusState = (() => {
                      if (textProperties) {
                        const {hmd: hmdStatus} = webvr.getStatus();
                        const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmdStatus;
                        const inputText = menuUtils.castValueValueToString(attributeValue, type);
                        const {index, px} = textProperties;
                        return keyboard.focus({
                          type: 'attribute:' + tagId + ':' + attributeName,
                          position: hmdPosition,
                          rotation: hmdRotation,
                          inputText: inputText,
                          inputIndex: index,
                          inputValue: px,
                          fontSpec: subcontentFontSpec,
                        });
                      } else {
                        return keyboard.fakeFocus({
                          type: 'attribute:' + tagId + ':' + attributeName,
                        });
                      }
                    })();
                    focusState.keyboardFocusState = keyboardFocusState;

                    keyboardFocusState.on('update', () => {
                      const {inputText} = keyboardFocusState;

                      tagMesh.setAttribute(attributeName, inputText);
                    });
                    keyboardFocusState.on('blur', () => {
                      focusState.keyboardFocusState = null;

                      _updateAttributes();
                    });

                    _updateAttributes();
                  } else if (action === 'set') {
                    tagsApi.emit('setAttribute', {
                      id: tagId,
                      name: attributeName,
                      value: value,
                    });

                    keyboard.tryBlur();
                  } else if (action === 'tweak') {
                    const {type} = _getAttributeSpec(attributeName);

                    if (type === 'number') {
                      const newValue = (() => {
                        const {value} = hoverState;
                        const {min, max, step} = _getAttributeSpec(attributeName);

                        let n = min + (value * (max - min));
                        if (step > 0) {
                          n = _roundToDecimals(Math.round(n / step) * step, 8);
                        }
                        return n;
                      })();

                      tagsApi.emit('setAttribute', {
                        id: tagId,
                        name: attributeName,
                        value: newValue,
                      });

                      keyboard.tryBlur();
                    } else if (type ==='vector') {
                      const newKeyValue = (() => {
                        const {value} = hoverState;
                        const {min, max, step} = _getAttributeSpec(attributeName);

                        let n = min + (value * (max - min));
                        if (step > 0) {
                          n = _roundToDecimals(Math.round(n / step) * step, 8);
                        }
                        return n;
                      })();
                      const newValue = attributeValue.slice();
                      newValue[AXES.indexOf(key)] = newKeyValue;

                      tagsApi.emit('setAttribute', {
                        id: tagId,
                        name: attributeName,
                        value: newValue,
                      });

                      keyboard.tryBlur();
                    }
                  } else if (action === 'pick') {
                    const colorWheel = color.makeColorWheel({
                      onpreview: colorString => {
                        // XXX
                      },
                      onupdate: colorString => {
                        tagsApi.emit('setAttribute', {
                          id: tagId,
                          name: attributeName,
                          value: '#' + colorString,
                        });
                      },
                      menu: true,
                    });
                    scene.add(colorWheel);

                    const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === tagId);
                    const {attributesMesh} = tagMesh;
                    const {attributeMeshes} = attributesMesh;
                    const attributeMesh = attributeMeshes.find(attributeMesh => attributeMesh.attributeName === attributeName);
                    const {position, rotation, scale} = _decomposeObjectMatrixWorld(attributeMesh);
                    colorWheel.position.copy(position.clone().add(new THREE.Vector3(0, -0.125, 0.001).applyQuaternion(rotation)));
                    colorWheel.quaternion.copy(rotation);
                    colorWheel.scale.copy(scale);
                    colorWheel.updateBoxTargets();

                    const keyboardFocusState = keyboard.fakeFocus({
                      type: 'color',
                    });
                    focusState.keyboardFocusState = keyboardFocusState;

                    keyboardFocusState.on('blur', () => {
                      focusState.keyboardFocusState = null;

                      scene.remove(colorWheel);
                      color.destroyColorWheel(colorWheel);
                    });
                  } else if (action === 'toggle') {
                    const newValue = !attributeValue;

                    tagsApi.emit('setAttribute', {
                      id: tagId,
                      name: attributeName,
                      value: newValue,
                    });

                    _updateAttributes();
                  }

                  return true;
                } else {
                  return false;
                }
              } else {
                return false;
              }
            };

            if (_doClickDetails() || _doClickGrabNpmTag() || _doClickGrabWorldTag() || _doClickAux() || _doClickAttribute()) {
              e.stopImmediatePropagation();
            }
          };
          input.on('trigger', _trigger);
          const _triggerdown = e => {
            const {side} = e;

            const _doClickTag = () => {
              const hoverState = rend.getHoverState(side);
              const {intersectionPoint} = hoverState;

              if (intersectionPoint) {
                const {anchor} = hoverState;
                const onmousedown = (anchor && anchor.onmousedown) || '';

                let match;
                if (match = onmousedown.match(/^module:(?:main|link):(.+)$/)) {
                  const id = match[1];
                  const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);

                  const dragState = dragStates[side];
                  dragState.src = {
                    type: 'module',
                    tagMesh: tagMesh,
                  };

                  return true;
                } else if (match = onmousedown.match(/^attribute:(.+?):(.+?):link$/)) {
                  const id = match[1];
                  const attributeName = match[2];
                  const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);

                  const dragState = dragStates[side];
                  dragState.src = {
                    type: 'attribute',
                    tagMesh: tagMesh,
                    attributeName: attributeName,
                  };

                  return true;
                } else if (match = onmousedown.match(/^file:link:(.+?)$/)) {
                  const id = match[1];

                  const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);

                  const dragState = dragStates[side];
                  dragState.src = {
                    type: 'file',
                    tagMesh: tagMesh,
                  };

                  return true;
                } else {
                  return false;
                }
              } else {
                return false;
              }
            };

            if (_doClickTag()) {
              e.stopImmediatePropagation();
            }
          };
          input.on('triggerdown', _triggerdown);
          const _triggerup = e => {
            const {side} = e;
            const dragState = dragStates[side];
            const {src, dst} = dragState;
            const {type: srcType = ''} = src || {};
            const {type: dstType = ''} = dst || {};

            if (srcType === 'module') {
              const _linkModule = (srcTagMesh, dstTagMesh, {controllerPosition, controllerRotation, controllerScale}) => {
                const {item: srcItem} = srcTagMesh;
                const {name: srcName} = srcItem;
                const componentApis = tagComponentApis[srcName];

                for (let i = 0; i < componentApis.length; i++) {
                  const componentApi = componentApis[i];

                  const _requestSrcTagAttributes = fn => new Promise((accept, reject) => {
                    const componentApi = componentApis[i];
                    const {attributes: componentAttributes = {}} = componentApi;
                    const componentAttributeKeys = Object.keys(componentAttributes);

                    const _recurse = i => {
                      if (i < componentAttributeKeys.length) {
                        const attributeName = componentAttributeKeys[i];
                        const attribute = componentAttributes[attributeName];
                        const _requestAttributeValue = () => {
                          let {value: attributeValue} = attribute;
                          if (typeof attributeValue === 'function') {
                            attributeValue = attributeValue();
                          }
                          return Promise.resolve(attributeValue);
                        };

                        const result = fn(attributeName, _requestAttributeValue);
                        Promise.resolve(result)
                          .then(() => {
                            _recurse(i + 1);
                          });
                      } else {
                        accept();
                      }
                    };
                    _recurse(0);
                  });

                  if (!dstTagMesh) {
                    const {item} = srcTagMesh;

                    const _requestAttributes = () => {
                      const result = {};
                      return _requestSrcTagAttributes((attributeName, getAttributeValue) =>
                        getAttributeValue()
                          .then(attributeValue => {
                            result[attributeName] = {
                              value: attributeValue,
                            };
                          })
                      ).then(() => result);
                    };

                    _requestAttributes()
                      .then(attributes => {
                        const itemSpec = _clone(item);
                        itemSpec.id = _makeId();
                        itemSpec.type = 'entity';
                        const tagName = (() => {
                          const {selector: componentSelector = 'div'} = componentApi;
                          const {rule: {tagName}} = cssSelectorParser.parse(componentSelector);

                          if (tagName) {
                            return tagName;
                          } else {
                            return 'entity';
                          }
                        })();
                        itemSpec.name = tagName;
                        itemSpec.displayName = tagName;
                        itemSpec.tagName = tagName;
                        itemSpec.attributes = attributes;
                        const matrix = (() => { // XXX we should offset multiple entity tags here so they don't overlap
                          const {matrix: oldMatrix} = itemSpec;
                          const position = new THREE.Vector3().fromArray(oldMatrix.slice(0, 3));
                          // const rotation = new THREE.Quaternion().fromArray(oldMatrix.slice(3, 3 + 4));
                          // const scale = new THREE.Vector3().fromArray(oldMatrix.slice(3 + 4, 3 + 4 + 3));

                          const newPosition = controllerPosition.clone()
                            .add(
                              new THREE.Vector3(0, 0, -1)
                                .multiplyScalar(
                                  position.clone()
                                   .sub(controllerPosition)
                                   .length()
                                )
                                .applyQuaternion(controllerRotation)
                            );
                          const newRotation = controllerRotation;
                          const newScale = controllerScale;

                          return newPosition.toArray().concat(newRotation.toArray()).concat(newScale.toArray());
                        })();
                        itemSpec.matrix = matrix;

                        tagsApi.emit('addTag', {
                          itemSpec: itemSpec,
                          dst: 'world',
                        });
                      })
                      .catch(err => {
                        console.warn(err);
                      });
                  } else {
                    const {item: dstItem} = dstTagMesh;
                    const {id: dstId, instance: dstElement} = dstItem;

                    _requestSrcTagAttributes((attributeName, requestAttributeValue) => {
                      if (!dstElement.hasAttribute(attributeName)) {
                        return requestAttributeValue()
                          .then(attributeValue => {
                            tagsApi.emit('setAttribute', {
                              id: dstId,
                              name: attributeName,
                              value: attributeValue,
                            });
                          });
                      }
                    });
                  }
                }
              };

              if (!dstType) {
                const {gamepads} = webvr.getStatus();
                const gamepad = gamepads[side];

                if (gamepad) {
                  const {buttons: {grip: {pressed: gripPressed}}} = gamepad;

                  if (!gripPressed) {
                    const {tagMesh: srcTagMesh} = src;
                    const {item} = srcTagMesh;

                    if (!item.instancing) {
                      const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale} = gamepad;

                      _linkModule(srcTagMesh, null, {
                        controllerPosition,
                        controllerRotation,
                        controllerScale,
                      });

                      dragState.src = null;
                      dragState.dst = null;

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
              } else if (dstType === 'entity') {
                const {gamepads} = webvr.getStatus();
                const gamepad = gamepads[side];

                if (gamepad) {
                  const {buttons: {grip: {pressed: gripPressed}}} = gamepad;

                  if (!gripPressed) {
                    const {tagMesh: srcTagMesh} = src;
                    const {item} = srcTagMesh;

                    if (!item.instancing) {
                      const {tagMesh: dstTagMesh} = dst;
                      const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale} = gamepad;

                      _linkModule(srcTagMesh, dstTagMesh, {
                        controllerPosition,
                        controllerRotation,
                        controllerScale,
                      });

                      dragState.src = null;
                      dragState.dst = null;

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
              } else {
                return false;
              }
            } else if (srcType === 'attribute' && dstType === 'file') {
              const {tagMesh: srcTagMesh, attributeName} = src;
              const {tagMesh: dstTagMesh} = dst;

              const _linkAttribute = ({srcTagMesh, attributeName, dstTagMesh}) => {
                const {item: {id, name}} = dstTagMesh;
                srcTagMesh.setAttribute(attributeName, 'fs/' + id + name);
              };
              _linkAttribute({
                srcTagMesh,
                attributeName,
                dstTagMesh,
              });

              dragState.src = null;
              dragState.dst = null;

              return true;
            } else if (srcType === 'file' && dstType === 'attribute') {
              const {tagMesh: srcTagMesh} = src;
              const {itemId, attributeName} = dst;
              const dstTagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === itemId);

              const _linkFile = ({srcTagMesh, attributeName, dstTagMesh}) => {
                const {item: {id, name}} = srcTagMesh;
                dstTagMesh.setAttribute(attributeName, 'fs/' + id + name);
              };
              _linkFile({
                srcTagMesh,
                attributeName,
                dstTagMesh,
              });

              dragState.src = null;
              dragState.dst = null;

              return true;
            } else {
              dragState.src = null;
              dragState.dst = null;

              return false;
            }
          };
          input.on('triggerup', _triggerup);

          const _update = () => {
            const _updateElementGrabbables = () => {
              if (rend.isOpen()) {
                const {gamepads} = webvr.getStatus();

                SIDES.forEach(side => {
                  const grabHoverState = grabHoverStates[side];
                  const gamepad = gamepads[side];
                  const grabBoxMesh = grabBoxMeshes[side];

                  const hoverMesh = (() => {
                    if (gamepad) {
                      const {worldPosition: controllerPosition, worldScale: controllerScale} = gamepad;
                      const absPosition = controllerPosition.clone().multiply(controllerScale);

                      let closestTagMesh = null;
                      let closestTagMeshDistance = Infinity;
                      for (let i = 0; i < tagMeshes.length; i++) {
                        const tagMesh = tagMeshes[i];
                        const distance = absPosition.distanceTo(_getWorldPosition(tagMesh));

                        if (distance <= 0.2) {
                          if (distance < closestTagMeshDistance) {
                            closestTagMesh = tagMesh;
                            closestTagMeshDistance = distance;
                          }
                        }
                      }
                      return closestTagMesh;
                    } else {
                      return null;
                    }
                  })();
                  grabHoverState.tagMesh = hoverMesh;

                  if (hoverMesh) {
                    const {planeMesh} = hoverMesh;
                    const {position: tagMeshPosition, rotation: tagMeshRotation, scale: tagMeshScale} = _decomposeObjectMatrixWorld(planeMesh);
                    grabBoxMesh.position.copy(tagMeshPosition);
                    grabBoxMesh.quaternion.copy(tagMeshRotation);
                    grabBoxMesh.scale.copy(tagMeshScale);

                    if (!grabBoxMesh.visible) {
                      grabBoxMesh.visible = true;
                    }
                  } else {
                    if (grabBoxMesh.visible) {
                      grabBoxMesh.visible = false;
                    }
                  }
                });
              }
            };
            const _updateDragStates = () => {
              if (rend.isOpen()) {
                SIDES.forEach(side => {
                  const dragState = dragStates[side];
                  const {src} = dragState;
                  const {gamepads} = webvr.getStatus();
                  const gamepad = gamepads[side];

                  if (src) {
                    const {type: srcType} = src;

                    if (srcType === 'module' || srcType === 'entity' || srcType === 'file' || srcType === 'attribute') {
                      const hoverState = rend.getHoverState(side);
                      const {type} = hoverState;

                      if (type === 'page') {
                        const {target: page} = hoverState;
                        const {mesh} = page;

                        if (mesh[tagMeshSymbol]) {
                          const {tagMesh: hoverTagMesh} = mesh;
                          const {tagMesh: srcTagMesh} = src;
                          const {item: hoverItem} = hoverTagMesh;
                          const {type: hoverType} = hoverItem;

                          if (srcType === 'module' && hoverType === 'module' && srcTagMesh === hoverTagMesh) {
                            dragState.dst = {
                              type: 'module',
                              tagMesh: hoverTagMesh,
                            };
                          } else if (srcType === 'module' && hoverType === 'entity') {
                            dragState.dst = {
                              type: 'entity',
                              tagMesh: hoverTagMesh,
                            };
                          } else if (srcType === 'attribute' && hoverType === 'file') {
                            dragState.dst = {
                              type: 'file',
                              tagMesh: hoverTagMesh,
                            };
                          } else if (srcType === 'file' && hoverType === 'attribute') {
                            const {attributeName} = hoverTagMesh;
                            const attributeSpec = _getAttributeSpec(attributeName);
                            const attributeType = attributeSpec && attributeSpec.type;

                            if (attributeType === 'file') {
                              const {itemId} = hoverTagMesh;

                              dragState.dst = {
                                type: 'attribute',
                                tagMesh: hoverTagMesh,
                                itemId: itemId,
                                attributeName: attributeName,
                              };
                            } else {
                              dragState.dst = null;
                            }
                          } else {
                            dragState.dst = null;
                          }
                        } else {
                          dragState.dst = null;
                        }
                      } else {
                        dragState.dst = null;
                      }
                    } else {
                      dragState.dst = null;
                    }
                  }
                });
              }
            };
            const _updateDragLines = () => {
              if (rend.isOpen()) {
                SIDES.forEach(side => {
                  const dragState = dragStates[side];
                  const {src, line} = dragState;

                  const _clearLine = () => {
                    if (line) {
                      linesMesh.removeLine(line);
                      linesMesh.render();

                      dragState.line = null;
                    }
                  };

                  if (src) {
                    const {type: srcType} = src;

                    if (srcType === 'module' || srcType === 'entity' || srcType === 'file' || srcType === 'attribute') {
                      const localLine = (() => {
                        if (line) {
                          return line;
                        } else {
                          const newLine = linesMesh.addLine();
                          dragState.line = newLine;
                          return newLine;
                        }
                      })();

                      const {tagMesh: srcObject} = src;
                      const dstObject = (() => {
                        const {dst} = dragState;

                        if (dst) {
                          const {tagMesh: dstTagMesh} = dst;
                          return dstTagMesh;
                        } else {
                          return srcObject;
                        }
                      })();
                      localLine.set(srcObject, dstObject);
                      linesMesh.render();
                    } else {
                      _clearLine();
                    }
                  } else {
                    _clearLine();
                  }
                });

                if (!linesMesh.visible) {
                  linesMesh.visible = true;
                }
              } else {
                if (linesMesh.visible) {
                  linesMesh.visible = false;
                }
              }
            };
            const _updateLocal = () => {
              for (let i = 0; i < localUpdates.length; i++) {
                const update = localUpdates[i];
                update();
              }
            };

            _updateElementGrabbables();
            _updateDragStates();
            _updateDragLines();
            _updateLocal();
          };
          rend.on('update', _update);

          cleanups.push(() => {
            for (let i = 0; i < tagMeshes.length; i++) {
              const tagMesh = tagMeshes[i];
              tagMesh.parent.remove(tagMesh);
            }
            SIDES.forEach(side => {
              scene.remove(grabBoxMeshes[side]);
            });
            scene.remove(linesMesh);

            input.removeListener('trigger', _trigger);
            input.removeListener('triggerdown', _triggerdown);
            input.removeListener('triggerup', _triggerup);
            rend.removeListener('update', _update);
          });

          class Item extends EventEmitter {
            constructor(
              type,
              id,
              name,
              displayName,
              description,
              version,
              versions, // XXX need to fetch these from the backend every time instead of saving it to the tags json
              readme,
              tagName,
              matrix,
              attributes,
              mimeType,
              quantity,
              words,
              open,
              details,
              paused,
              value,
              metadata // transient state: isStatic, exists
            ) {
              super();

              this.type = type;
              this.id = id;
              this.name = name;
              this.displayName = displayName;
              this.description = description;
              this.version = version;
              this.versions = versions;
              this.readme = readme;
              this.tagName = tagName;
              this.matrix = matrix;
              this.attributes = attributes;
              this.mimeType = mimeType;
              this.quantity = quantity;
              this.words = words;
              this.open = open;
              this.details = details;
              this.paused = paused;
              this.value = value;
              this.metadata = metadata;

              // we use symbols so these keys don't show up in the JSON.stringify
              this[itemInstanceSymbol] = null;
              this[itemInstancingSymbol] = false;
              this[itemPageSymbol] = 0;
              this[itemPreviewSymbol] = false;
              this[itemTempSymbol] = false;
              this[itemMediaPromiseSymbol] = null;
            }

            get instance() {
              return this[itemInstanceSymbol];
            }
            set instance(instance) {
              this[itemInstanceSymbol] = instance;
            }
            get instancing() {
              return this[itemInstancingSymbol];
            }
            set instancing(instancing) {
              this[itemInstancingSymbol] = instancing;
            }
            get page() {
              return this[itemPageSymbol];
            }
            set page(page) {
              this[itemPageSymbol] = page;
            }
            get preview() {
              return this[itemPreviewSymbol];
            }
            set preview(preview) {
              this[itemPreviewSymbol] = preview;
            }
            get temp() {
              return this[itemTempSymbol];
            }
            set temp(temp) {
              this[itemTempSymbol] = temp;
            }

            setAttribute(attributeName, newValue) {
              const {instance} = this;
              if (instance) {
                const entityElement = instance;

                if (newValue !== undefined) {
                  entityElement.setAttribute(attributeName, _stringifyAttribute(newValue));
                } else {
                  entityElement.removeAttribute(attributeName);
                }
              }
            }

            setData(value) {
              this.data = value;

              const {instance} = this;
              if (instance) {
                const entityElement = instance;

                if (value !== undefined) {
                  entityElement.innerText = JSON.stringify(value, null, 2);
                } else {
                  entityElement.innerText = '';
                }
              }
            }

            getMedia() {
              if (!this[itemMediaPromiseSymbol]) {
                this[itemMediaPromiseSymbol] = new Promise((accept, reject) => {
                  const previewMesh = new THREE.Object3D();

                  const mode = _getItemPreviewMode(this);
                  if (mode === 'image') {
                    _requestFileItemImageMesh(this)
                      .then(imageMesh => {
                        imageMesh.position.y = -(WORLD_HEIGHT / 2);

                        previewMesh.add(imageMesh);

                        previewMesh.destroy = () => {
                          const {geometry, material} = imageMesh;
                          geometry.dispose();
                          material.dispose();
                          const {map} = material;
                          map.dispose();
                        };

                        return Promise.resolve(imageMesh);
                      })
                      .then(imageMesh => {
                        accept({
                          previewMesh: previewMesh,
                          media: imageMesh.image,
                        });
                      })
                      .catch(reject);
                  } else if (mode === 'audio') {
                    _requestFileItemAudioMesh(this)
                      .then(audioMesh => {
                        previewMesh.add(audioMesh);

                        const {audio} = audioMesh;
                        audio.addEventListener('ended', () => {
                          this.pause();
                        });

                        previewMesh.destroy = () => {};

                        return Promise.resolve(audioMesh);
                      })
                      .then(audioMesh => {
                        accept({
                          previewMesh: previewMesh,
                          media: audioMesh.audio,
                        });
                      })
                      .catch(reject);
                  } else if (mode === 'video') {
                    _requestFileItemVideoMesh(this)
                      .then(videoMesh => {
                        videoMesh.position.y = -((100 / OPEN_HEIGHT * WORLD_OPEN_HEIGHT) / 4);

                        previewMesh.add(videoMesh);

                        const {video} = videoMesh;
                        video.addEventListener('ended', () => {
                          this.pause();
                        });

                        previewMesh.destroy = () => {};

                        return Promise.resolve(videoMesh);
                      })
                      .then(videoMesh => {
                        accept({
                          previewMesh: previewMesh,
                          media: videoMesh.video,
                        });
                      })
                      .catch(reject);
                  } else if (mode === 'model') {
                    _requestFileItemModelMesh(this)
                      .then(modelMesh => {
                        const modelMeshWrap = new THREE.Object3D();
                        modelMeshWrap.add(modelMesh);

                        previewMesh.add(modelMeshWrap);

                        const boundingBox = new THREE.Box3().setFromObject(modelMesh);
                        const boundingBoxSize = boundingBox.getSize();
                        const meshCurrentScale = Math.max(boundingBoxSize.x, boundingBoxSize.y, boundingBoxSize.z);
                        const meshScaleFactor = (1 / meshCurrentScale) * (WORLD_OPEN_HEIGHT - WORLD_HEIGHT);
                        modelMeshWrap.scale.set(meshScaleFactor, meshScaleFactor, meshScaleFactor);

                        const boundingBoxCenter = boundingBox.getCenter();
                        modelMeshWrap.position.y = -(WORLD_HEIGHT / 2) - (boundingBoxCenter.y * meshScaleFactor);
                        modelMeshWrap.position.z = (WORLD_OPEN_HEIGHT - WORLD_HEIGHT) / 2;

                        previewMesh.destroy = () => {
                          // XXX figure out how to dispose of the model here
                        };

                        return Promise.resolve(modelMesh);
                      })
                      .then(modelMesh => {
                        accept({
                          previewMesh: previewMesh,
                          modelMesh: modelMesh,
                        });
                      })
                      .catch(reject);
                  } else {
                    accept({
                      previewMesh: previewMesh,
                      media: null,
                    });
                  }
                });
              }

              return this[itemMediaPromiseSymbol];
            }

            destroyMedia() {
              if (this[itemMediaPromiseSymbol]) {
                this[itemMediaPromiseSymbol].then(({previewMesh}) => {
                  previewMesh.destroy();
                })
                .catch(err => {
                  console.warn(err);
                });
              }
            }

            play() {
              this.paused = false;

              this.getMedia()
                .then(({media}) => {
                  if (media.paused) {
                    media.play();
                  }

                  this.emit('update');
                })
                .catch(err => {
                  console.warn(err);
                });
            }

            pause() {
              this.paused = true;

              this.getMedia()
                .then(({media}) => {
                  if (!media.paused) {
                    media.pause();
                  }

                  this.emit('update');
                })
                .catch(err => {
                  console.warn(err);
                });
            }

            seek(value) {
              this.value = value;

              this.getMedia()
                .then(({media}) => {
                  media.currentTime = value * media.duration;
                })
                .catch(err => {
                  console.warn(err);
                });

              this.emit('update');
            }

            destroy() {
              this.destroyMedia();

              const {type, temp} = this;
              if (type === 'file' && !temp) {
                const itemAttributeValue = 'fs/' + this.id + '/' + this.name;

                for (let i = 0; i < tagMeshes.length; i++) {
                  const tagMesh = tagMeshes[i];
                  const {item} = tagMesh;
                  const {type} = item;

                  if (type === 'entity') {
                    const {attributes} = item;

                    for (const attributeName in attributes) {
                      const attributeSpec = _getAttributeSpec(attributeName);

                      if (attributeSpec) {
                        const {type} = attributeSpec;

                        if (type === 'file') {
                          const {value: attributeValue} = attributes[attributeName];

                          if (attributeValue === itemAttributeValue) {
                            tagMesh.setAttribute(attributeName, undefined);
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }

          const tagMeshes = [];
          rend.registerAuxObject('tagMeshes', tagMeshes);

          let componentApis = []; // [ component api ]
          let componentApiInstances = []; // [ component element ]
          const tagComponentApis = {}; // plugin name -> [ component api ]
          const componentApiTags = new Map(); // component api -> plugin name

          const _getElementSelector = element => {
            const {tagName, attributes, classList} = element;

            let result = tagName.toLowerCase();

            for (let i = 0; i < attributes.length; i++) {
              const attribute = attributes[i];
              const {name} = attribute;
              result += '[' + name + ']';
            }

            for (let i = 0; i < classList.length; i++) {
              const className = classList[i];
              result += '.' + className;
            }

            return result;
          };
          const _isSelectorSubset = (a, b) => {
            const {rule: {tagName: aTagName = null, attrs: aAttributes = [], classNames: aClasses = []}} = cssSelectorParser.parse(a);
            const {rule: {tagName: bTagName = null, attrs: bAttributes = [], classNames: bClasses = []}} = cssSelectorParser.parse(b);

            if (aTagName && bTagName !== aTagName) {
              return false;
            }
            if (aAttributes.some(({name: aAttributeName}) => !bAttributes.some(({name: bAttributeName}) => bAttributeName === aAttributeName))) {
              return false;
            }
            if (aClasses.some(aClass => !bClasses.includes(aClass))) {
              return false;
            }

            return true;
          };
          const _getBoundComponentSpecs = (entitySelector, entityAttributes) => {
            const result = [];

            for (let i = 0; i < componentApis.length; i++) {
              const componentApi = componentApis[i];
              const componentApiInstance = componentApiInstances[i];
              const {selector: componentSelector = 'div'} = componentApi;

              if (_isSelectorSubset(componentSelector, entitySelector)) {
                const componentElement = componentApiInstance;
                const {attributes: componentAttributes = {}} = componentApi;
                const matchingAttributes = Object.keys(componentAttributes).filter(attributeName => (attributeName in entityAttributes));

                result.push({
                  componentElement,
                  matchingAttributes,
                });
              }
            }

            return result;
          };
          const _getBoundEntitySpecs = (componentSelector, componentAttributes) => {
            const result = [];

            for (let i = 0; i < tagMeshes.length; i++) {
              const tagMesh = tagMeshes[i];
              const {item} = tagMesh;
              const {type} = item;

              if (type === 'entity' && !(item.metadata && item.metadata.isStatic) && item.instance) {
                const {instance: entityElement} = item;

                if (entityElement.webkitMatchesSelector(componentSelector)) {
                  const {attributes: entityAttributes} = item;
                  const matchingAttributes = Object.keys(entityAttributes).filter(attributeName => (attributeName in componentAttributes));

                  result.push({
                    tagMesh,
                    matchingAttributes,
                  });
                }
              }
            }

            return result;
          };
          const _getBoundComponentAttributeSpecs = entityAttribute => {
            const result = [];

            for (let i = 0; i < componentApis.length; i++) {
              const componentApi = componentApis[i];
              const {selector: componentSelector = 'div'} = componentApi;
              const {rule: {attrs: cattrs = []}} = cssSelectorParser.parse(componentSelector);
              const componentAttributes = cattrs.map(attr => attr.name);

              if (componentAttributes.indexOf(entityAttribute) !== -1) {
                const componentApiInstance = componentApiInstances[i];
                const componentElement = componentApiInstance;
                const matchingAttributes = [entityAttribute];

                result.push({
                  componentElement,
                  matchingAttributes,
                });
              }
            }

            return result;
          };
          const _getAttributeSpec = attributeName => {
            for (let i = 0; i < componentApis.length; i++) {
              const componentApi = componentApis[i];
              const {attributes: componentAttributes = {}} = componentApi;
              const componentAttribute = componentAttributes[attributeName];

              if (componentAttribute) {
                return componentAttribute;
              }
            }

            return null;
          };

          class TagsApi extends EventEmitter {
            constructor() {
              super();

              this.listen();
            }

            registerComponent(pluginInstance, componentApi) {
              // create element
              const baseObject = componentApi;
              const componentElement = menuUtils.makeZeoComponentElement(baseObject);
              componentElement.componentApi = componentApi;

              // add to lists
              componentApis.push(componentApi);
              componentApiInstances.push(componentElement);

              const name = archae.getPath(pluginInstance);
              let tagComponentApiComponents = tagComponentApis[name];
              if (!tagComponentApiComponents) {
                tagComponentApiComponents = [];
                tagComponentApis[name] = tagComponentApiComponents;
              }
              tagComponentApiComponents.push(componentApi);
              componentApiTags.set(componentApi, name);

              // bind entities
              const {selector: componentSelector = 'div', attributes: componentAttributes = {}} = componentApi;
              const boundEntitySpecs = _getBoundEntitySpecs(componentSelector, componentAttributes);

              for (let k = 0; k < boundEntitySpecs.length; k++) {
                const boundEntitySpec = boundEntitySpecs[k];
                const {tagMesh, matchingAttributes} = boundEntitySpec;
                const {item: entityItem} = tagMesh;
                const {instance: entityElement} = entityItem;

                _addEntityCallback(componentElement, entityElement);

                for (let l = 0; l < matchingAttributes.length; l++) {
                  const matchingAttribute = matchingAttributes[l];
                  const {attributes: entityAttributes} = entityItem;
                  const entityAttribute = entityAttributes[matchingAttribute];
                  const {value: attributeValueJson} = entityAttribute;
                  const componentAttribute = componentAttributes[matchingAttribute];
                  const {type: attributeType} = componentAttribute;
                  const oldValue = null;
                  const newValue = menuUtils.castValueToCallbackValue(attributeValueJson, attributeType);

                  componentElement.entityAttributeValueChangedCallback(entityElement, matchingAttribute, oldValue, newValue);
                  const {id: entityId} = entityItem;
                  tagsApi.emit('attributeValueChanged', {
                    entityId: entityId,
                    attributeName: matchingAttribute,
                    type: attributeType,
                    oldValue: oldValue,
                    newValue: newValue,
                  });
                }
              }

              // update tag attribute meshes
              for (let i = 0; i < tagMeshes.length; i++) {
                const tagMesh = tagMeshes[i];
                const {item} = tagMesh;
                const {type} = item;

                if (type === 'entity') {
                  const {attributesMesh} = tagMesh;
                  attributesMesh.update();
                }
              }
            }

            unregisterComponent(pluginInstance, componentApiToRemove) {
              // remove from lists
              const removedComponentApiIndex = componentApis.indexOf(componentApiToRemove);
              componentApis.splice(removedComponentApiIndex, 1);
              const removedComponentApiInstance = componentApiInstances.splice(removedComponentApiIndex, 1)[0];

              const name = archae.getPath(pluginInstance);
              const tagComponentApiComponents = tagComponentApis[name];
              tagComponentApiComponents.splice(tagComponentApiComponents.indexOf(componentApiToRemove), 1);
              if (tagComponentApiComponents.length === 0) {
                tagComponentApis[name] = null;
              }
              componentApiTags.delete(componentApiToRemove);

              // unbind entities
              const componentElement = removedComponentApiInstance;
              const {componentApi} = componentElement;
              const {selector: componentSelector = 'div', attributes: componentAttributes = {}} = componentApi;
              const boundEntitySpecs = _getBoundEntitySpecs(componentSelector, componentAttributes);

              for (let k = 0; k < boundEntitySpecs.length; k++) {
                const boundEntitySpec = boundEntitySpecs[k];
                const {tagMesh, matchingAttributes} = boundEntitySpec;
                const {item: entityItem} = tagMesh;
                const {instance: entityElement} = entityItem;

                _removeEntityCallback(componentElement, entityElement);
              }
            }

            makeTag(itemSpec, {initialUpdate = true} = {}) {
              const object = new THREE.Object3D();

              const item = new Item(
                itemSpec.type,
                itemSpec.id,
                itemSpec.name,
                itemSpec.displayName,
                itemSpec.description,
                itemSpec.version,
                itemSpec.versions,
                itemSpec.readme,
                itemSpec.tagName, // XXX get rid of these
                itemSpec.matrix,
                itemSpec.attributes,
                itemSpec.mimeType,
                itemSpec.quantity,
                itemSpec.words,
                itemSpec.open,
                itemSpec.details,
                itemSpec.paused,
                itemSpec.value,
                itemSpec.metadata
              );
              object.item = item;

              object.position.set(item.matrix[0], item.matrix[1], item.matrix[2]);
              object.quaternion.set(item.matrix[3], item.matrix[4], item.matrix[5], item.matrix[6]);
              object.scale.set(item.matrix[7], item.matrix[8], item.matrix[9]);

              const _addUiManagerPage = uiManager => {
                const {metadata: {open, details}} = uiManager;

                const mesh = uiManager.makePage(({
                  item,
                  focus: {
                    keyboardFocusState,
                  },
                }) => {
                  const {type: focusType = '', inputText = '', inputValue = 0} = keyboardFocusState || {};
                  const src = (() => {
                    const {type: itemType} = item;

                    switch (itemType) {
                      case 'module': {
                        if (!details) {
                          return tagsRenderer.getModuleSrc({item, inputText, inputValue});
                        } else {
                          const focusVersionSpec = (() => {
                            const match = focusType.match(/^version:(.+?)$/);
                            return match && {
                              tagId: match[1],
                            };
                          })();

                          return tagsRenderer.getModuleDetailsSrc({item, focusVersionSpec});
                        }
                      }
                      case 'entity': {
                        return tagsRenderer.getEntitySrc({item});
                      }
                      case 'file': {
                        const mode = _getItemPreviewMode(item);

                        return tagsRenderer.getFileSrc({item, mode, open});
                      }
                      case 'asset': {
                        if (!details) {
                          return tagsRenderer.getAssetSrc({item});
                        } else {
                          return tagsRenderer.getAssetDetailsSrc({item});
                        }
                      }
                      default: {
                        return null;
                      }
                    }
                  })();

                  return {
                    type: 'html',
                    src: src,
                    w: open ? OPEN_WIDTH : details ? DETAILS_WIDTH : WIDTH,
                    h: open ? OPEN_HEIGHT : details ? DETAILS_HEIGHT : HEIGHT,
                  };
                }, {
                  type: 'tag',
                  state: {
                    item: item,
                    focus: focusState,
                  },
                  worldWidth: open ? WORLD_OPEN_WIDTH : details ? WORLD_DETAILS_WIDTH : WORLD_WIDTH,
                  worldHeight: open ? WORLD_OPEN_HEIGHT : details ? WORLD_DETAILS_HEIGHT : WORLD_HEIGHT,
                  isEnabled: () => rend.isOpen(),
                });
                mesh.receiveShadow = true;
                mesh[tagMeshSymbol] = true;
                mesh.tagMesh = object;

                const {page} = mesh;
                rend.addPage(page);

                const cleanup = () => {
                  rend.removePage(page);
                };
                cleanups.push(cleanup);

                mesh.destroy = (destroy => function() {
                  destroy.apply(this, arguments);

                  rend.removePage(page);

                  cleanups.splice(cleanups.indexOf(cleanup), 1);
                })(mesh.destroy);

                return mesh;
              };

              if (itemSpec.type === 'file') { 
                const planeMesh = _addUiManagerPage(uiManager);
                if (initialUpdate) {
                  const {page} = planeMesh;
                  page.initialUpdate();
                }
                planeMesh.visible = !item.open;
                object.add(planeMesh);
                object.planeMesh = planeMesh;

                const planeOpenMesh = _addUiManagerPage(uiOpenManager);
                planeOpenMesh.position.x = (WORLD_OPEN_WIDTH - WORLD_WIDTH) / 2;
                planeOpenMesh.position.y = -(WORLD_OPEN_HEIGHT - WORLD_HEIGHT) / 2;
                planeOpenMesh.visible = Boolean(item.open);
                object.add(planeOpenMesh);
                object.planeOpenMesh = planeOpenMesh;

                item.on('update', () => {
                  if (planeOpenMesh.visible) {
                    const {page: openPage} = planeOpenMesh;
                    openPage.update();
                  }
                });
              } else if (itemSpec.type === 'module') {
                const planeMesh = _addUiManagerPage(uiStaticManager);
                if (initialUpdate) {
                  const {page} = planeMesh;
                  page.initialUpdate();
                }
                planeMesh.visible = !item.details;
                object.add(planeMesh);
                object.planeMesh = planeMesh;

                const planeDetailsMesh = _addUiManagerPage(uiDetailsManager);
                if (itemSpec.metadata && itemSpec.metadata.isStatic) {
                  planeDetailsMesh.position.x = -((2 - WORLD_DETAILS_WIDTH) / 2);
                  planeDetailsMesh.position.z = 0.001;

                  planeDetailsMesh.initialOffset = planeDetailsMesh.position.clone();
                }
                planeDetailsMesh.visible = Boolean(item.details);
                object.add(planeDetailsMesh);
                object.planeDetailsMesh = planeDetailsMesh;
              } else if (itemSpec.type === 'asset') {
                const planeMesh = _addUiManagerPage(uiStaticManager);
                if (initialUpdate) {
                  const {page} = planeMesh;
                  page.initialUpdate();
                }
                planeMesh.visible = !item.details;
                object.add(planeMesh);
                object.planeMesh = planeMesh;

                const updates = [];
                object.update = () => {
                  console.log('update asset plane mesh', {itemSpec, planeMesh}); // XXX

                  for (let i = 0; i < updates.length; i++) {
                    const update = updates[i];
                    update();
                  }
                };
                updates.push(() => {
                  const {page} = planeMesh;
                  page.initialUpdate();
                });

                if (!(itemSpec.metadata && itemSpec.metadata.isSub)) {
                  const planeDetailsMesh = _addUiManagerPage(uiDetailsManager);

                  if (itemSpec.metadata && itemSpec.metadata.isStatic) {
                    planeDetailsMesh.position.x = -((2 - WORLD_DETAILS_WIDTH) / 2);
                    planeDetailsMesh.position.z = 0.01;

                    planeDetailsMesh.initialOffset = planeDetailsMesh.position.clone();

                    const subTagMeshes = [
                      1, 5, 10, 25,
                      100, 200, 500, 1000,
                      2000, 5000, 10000, 20000,
                      50000, 100000, 200000, 500000,
                      1000000, 2000000, 5000000, 10000000,
                    ]
                    .map((itemSpec.name === 'BTC') ? (billQuantity => billQuantity / 1e2) : (billQuantity => billQuantity))
                    .map((billQuantity, index) => {
                      if (itemSpec.quantity >= billQuantity) {
                        const subTagMesh = tagsApi.makeTag({
                          type: 'asset',
                          id: itemSpec.id + ':bill:' + billQuantity,
                          name: itemSpec.name,
                          displayName: itemSpec.name,
                          quantity: billQuantity,
                          matrix: DEFAULT_MATRIX,
                          metadata: {
                            isStatic: true,
                            isSub: true,
                          },
                        }, {
                          initialUpdate: false,
                        });

                        const width = WORLD_WIDTH * NPM_TAG_MESH_SCALE;
                        const height = width / ASPECT_RATIO;
                        const leftClip = ((30 / DETAILS_WIDTH) * WORLD_DETAILS_WIDTH);
                        const rightClip = ((30 / DETAILS_WIDTH) * WORLD_DETAILS_WIDTH);
                        const padding = (WORLD_DETAILS_WIDTH - (leftClip + rightClip) - (TAGS_PER_ROW * width)) / (TAGS_PER_ROW - 1);
                        const x = index % TAGS_PER_ROW;
                        const y = Math.floor(index / TAGS_PER_ROW);
                        subTagMesh.position.set(
                          -(WORLD_DETAILS_WIDTH / 2) + (leftClip + (width / 2)) + (x * (width + padding)),
                          (WORLD_DETAILS_HEIGHT / 2) - (height / 2) - (y * (height + padding)) - 0.23,
                          0.001
                        );
                        subTagMesh.planeMesh.scale.set(NPM_TAG_MESH_SCALE, NPM_TAG_MESH_SCALE, 1);

                        return subTagMesh;
                      } else {
                        return null;
                      }
                    }).filter(subTagMesh => subTagMesh !== null);
                    for (let i = 0; i < subTagMeshes.length; i++) {
                      const subTagMesh = subTagMeshes[i];
                      planeDetailsMesh.add(subTagMesh);
                    }
                    planeDetailsMesh.subTagMeshes = subTagMeshes;

                    updates.push(() => {
                      console.log('update asset plane details mesh', {itemSpec, planeDetailsMesh}); // XXX
                    });
                  }
                  planeDetailsMesh.visible = Boolean(item.details);
                  object.add(planeDetailsMesh);
                  object.planeDetailsMesh = planeDetailsMesh;
                }
              } else {
                const planeMesh = _addUiManagerPage(uiStaticManager);
                if (initialUpdate) {
                  const {page} = planeMesh;
                  page.initialUpdate();
                }
                object.add(planeMesh);
                object.planeMesh = planeMesh;
              }

              if (itemSpec.type === 'module') {
                object.openDetails = () => {
                  const tagMesh = object;
                  const {planeMesh, planeDetailsMesh} = tagMesh;
                  planeMesh.visible = false;
                  planeDetailsMesh.visible = true;

                  const {page} = planeDetailsMesh;
                  page.initialUpdate();
                };
                object.closeDetails = () => {
                  const tagMesh = object;
                  const {planeMesh, planeDetailsMesh} = tagMesh;
                  planeMesh.visible = true;
                  planeDetailsMesh.visible = false;
                };

                if (item.details) {
                  object.openDetails();
                }
              }
              if (itemSpec.type === 'entity') {
                const attributesMesh = (() => {
                  const attributesMesh = new THREE.Object3D();
                  attributesMesh.attributeMeshes = [];

                  const _update = () => {
                    const attributesArray = (() => {
                      const {attributes} = item;
                      return Object.keys(attributes).map(name => {
                        const attribute = attributes[name];
                        const {value} = attribute;
                        const attributeSpec = _getAttributeSpec(name);

                        const result = _shallowClone(attributeSpec);
                        result.name = name;
                        result.value = value;
                        return result;
                      }).sort((a, b) => a.name.localeCompare(b.name));
                    })();

                    const attributesIndex = (() => {
                      const index = {};

                      for (let i = 0; i < attributesArray.length; i++) {
                        const attribute = attributesArray[i];
                        const {name} = attribute;
                        index[name] = attribute;
                      }

                      return index;
                    })();

                    const oldAttributesIndex = (() => {
                      const index = {};

                      const {attributeMeshes: oldAttributeMeshes} = attributesMesh;
                      for (let i = 0; i < oldAttributeMeshes.length; i++) {
                        const attributeMesh = oldAttributeMeshes[i];
                        const {attributeName} = attributeMesh;
                        const attribute = attributesIndex[attributeName];

                        if (!attribute) {
                          attributesMesh.remove(attributeMesh);
                          attributeMesh.destroy();
                        } else {
                          index[attributeName] = attributeMesh;
                        }
                      }

                      return index;
                    })();

                    const newAttributeMeshes = attributesArray.map((attribute, i) => {
                      const mesh = (() => {
                        const {name: attributeName} = attribute;
                        const oldAttributeMesh = oldAttributesIndex[attributeName];

                        if (oldAttributeMesh) {
                          const {page, lastStateJson} = oldAttributeMesh;
                          const {state} = page;
                          state.attribute = attribute;
                          const currentStateJson = JSON.stringify(state);

                          if (currentStateJson !== lastStateJson) {
                            page.update();

                            oldAttributeMesh.lastStateJson = currentStateJson;
                          }

                          return oldAttributeMesh;
                        } else {
                          const state = {
                            attribute: attribute,
                            details: detailsState,
                            focus: focusState,
                          };
                          const newAttributeMesh = uiAttributeManager.makePage(({
                            attribute,
                            details: {
                              transforms,
                            },
                            focus: {
                              keyboardFocusState,
                            },
                          }) => {
                            const {type: focusType = '', inputText = '', inputValue = 0} = keyboardFocusState || {};
                            const focus = (() => {
                              const match = focusType.match(/^attribute:(.+?):(.+?)$/);
                              return Boolean(match) && match[1] === item.id && match[2] === attribute.name;
                            })();
                            const transform = transforms.some(transform => transform.tagId === item.id && transform.attributeName === attribute.name);

                            return {
                              type: 'html',
                              src: tagsRenderer.getAttributeSrc({item, attribute, inputText, inputValue, focus, transform}),
                              w: WIDTH,
                              h: HEIGHT,
                            };
                          }, {
                            type: 'attribute',
                            state: state,
                            worldWidth: WORLD_WIDTH,
                            worldHeight: WORLD_HEIGHT,
                            isEnabled: () => rend.isOpen(),
                          });
                          newAttributeMesh.receiveShadow = true;

                          const {page} = newAttributeMesh;
                          page.update();

                          // used by trigger handler lookups
                          newAttributeMesh.itemId = item.id;
                          newAttributeMesh.attributeName = attributeName;

                          newAttributeMesh.lastStateJson = JSON.stringify(state);

                          attributesMesh.add(newAttributeMesh);

                          return newAttributeMesh;
                        }
                      })();
                      mesh.position.x = WORLD_WIDTH;
                      mesh.position.y = (attributesArray.length * WORLD_HEIGHT / 2) - (0.5 * WORLD_HEIGHT) - (i * WORLD_HEIGHT);

                      const {page} = mesh;
                      rend.addPage(page);

                      const cleanup = () => {
                        rend.removePage(page);
                      };
                      cleanups.push(cleanup);

                      mesh.destroy = (destroy => function() {
                        destroy.apply(this, arguments);

                        rend.removePage(page);

                        cleanups.splice(cleanups.indexOf(cleanup), 1);
                      })(mesh.destroy);

                      return mesh;
                    });
                    attributesMesh.attributeMeshes = newAttributeMeshes;
                  };
                  attributesMesh.update = _update;
                  _update();

                  attributesMesh.destroy = () => {
                    const {attributeMeshes} = attributesMesh;

                    for (let i = 0; i < attributeMeshes; i++) {
                      const attributeMesh = attributeMeshes[i];
                      attributeMesh.destroy();
                    }
                  };

                  return attributesMesh;
                })();
                object.add(attributesMesh);
                object.attributesMesh = attributesMesh;

                object.setAttribute = (attribute, value) => {
                  item.setAttribute(attribute, value);

                  attributesMesh.update();

                  const {planeMesh: {page}} = object;
                  page.update();
                };
              }
              if (itemSpec.type === 'file') {
                object.open = () => {
                  const tagMesh = object;
                  const {planeMesh, planeOpenMesh, item} = tagMesh;
                  item.open = true;
                  planeMesh.visible = false;
                  planeOpenMesh.visible = true;

                  if (item.type === 'file') {
                    item.getMedia()
                      .then(({previewMesh}) => {
                        planeOpenMesh.add(previewMesh);
                      })
                      .catch(err => {
                        console.warn(err);
                      });
                  }

                  const {page} = planeOpenMesh;
                  page.initialUpdate();
                };
                object.close = () => {
                  const tagMesh = object;
                  const {planeMesh, planeOpenMesh, item} = tagMesh;
                  item.open = false;
                  planeMesh.visible = true;
                  planeOpenMesh.visible = false;

                  if (item.type === 'file') {
                    if (item.preview && item.preview.visible) {
                      item.preview.visible = false;
                    }
                  }
                };
                object.play = () => {
                  const tagMesh = object;
                  const {item} = tagMesh;

                  item.play();
                };
                object.pause = () => {
                  const tagMesh = object;
                  const {item} = tagMesh;

                  item.pause();
                };
                object.seek = value => {
                  const tagMesh = object;
                  const {item} = tagMesh;

                  item.seek(value);
                };

                if (item.open) {
                  object.open();
                }
                if (item.value !== undefined) {
                  object.seek(item.value);
                }
                if (item.paused === false) {
                  object.play();
                }
              }
              if (itemSpec.type === 'asset') {
                object.openDetails = () => {
                  const tagMesh = object;
                  const {planeMesh, planeDetailsMesh} = tagMesh;
                  planeMesh.visible = false;
                  planeDetailsMesh.visible = true;

                  const {page} = planeDetailsMesh;
                  page.initialUpdate();

                  const {subTagMeshes} = planeDetailsMesh;
                  for (let i = 0; i < subTagMeshes.length; i++) {
                    const subTagMesh = subTagMeshes[i];
                    const {planeMesh: subPlaneMesh} = subTagMesh;
                    const {page: subPage} = subPlaneMesh;
                    subPage.initialUpdate();
                  }
                };
                object.closeDetails = () => {
                  const tagMesh = object;
                  const {planeMesh, planeDetailsMesh} = tagMesh;
                  planeMesh.visible = true;
                  planeDetailsMesh.visible = false;
                };
              }

              const tipMesh = (() => {
                const object = new THREE.Object3D();
                object.position.x = -WORLD_WIDTH / 2;
                return object;
              })();
              object.add(tipMesh);
              object.tipMesh = tipMesh;

              object.destroy = () => {
                const {item} = object;
                item.destroy();

                const {planeMesh, planeOpenMesh = null, planeDetailsMesh = null, attributesMesh = null} = object;
                [planeMesh, planeOpenMesh, planeDetailsMesh, attributesMesh].forEach(tagSubMesh => {
                  if (tagSubMesh !== null) {
                    tagSubMesh.destroy();
                  }
                });
              };

              tagMeshes.push(object);

              return object;
            }

            destroyTag(tagMesh) {
              const index = tagMeshes.indexOf(tagMesh);

              if (index !== -1) {
                tagMesh.destroy();

                tagMeshes.splice(index, 1);
              }
            }

            reifyModule(tagMesh) {
              const {item} = tagMesh;
              const {name} = item;

              const moduleElement = document.createElement('module');
              moduleElement.setAttribute('src', name);
              moduleElement.item = item;
              item.instance = moduleElement;
              rootModulesElement.appendChild(moduleElement);
            }

            unreifyModule(tagMesh) {
              const {item} = tagMesh;
              const {instance} = item;

              if (instance) {
                rootModulesElement.removeChild(instance);
              }
            }

            reifyEntity(tagMesh) {
              const {item} = tagMesh;
              const {instance} = item;

              if (!instance) {
                const {tagName: entityTagName, attributes: entityAttributes} = item;
                const entityElement = document.createElement(entityTagName);

                for (const attributeName in entityAttributes) {
                  const attribute = entityAttributes[attributeName];
                  const {value: attributeValue} = attribute;
                  const attributeValueString = _stringifyAttribute(attributeValue);
                  entityElement.setAttribute(attributeName, attributeValueString);
                }

                entityElement.getId = () => item.id;

                entityElement.item = item;
                item.instance = entityElement;

                rootEntitiesElement.appendChild(entityElement);
              }
            }

            unreifyEntity(tagMesh) {
              const {item} = tagMesh;
              const {instance} = item;

              if (instance) {
                const entityElement = instance;

                entityElement.item = null;
                item.instance = null;

                const {parentNode} = entityElement;
                if (parentNode) {
                  parentNode.removeChild(entityElement);
                }
              }
            }

            getWorldElement() {
              return rootWorldElement;
            }

            getModulesElement() {
              return rootModulesElement;
            }

            getEntitiesElement() {
              return rootEntitiesElement;
            }

            getTagComponentApis(tag) {
              return tagComponentApis[tag];
            }

            loadTags(itemSpecs) {
              this.emit('loadTags', {
                itemSpecs,
              });
            }

            getPointedTagMesh(side) {
              const hoverState = rend.getHoverState(side);
              const {type} = hoverState;

              if (type === 'page') {
                const {target: page} = hoverState;
                const {mesh} = page;

                if (mesh[tagMeshSymbol]) {
                  const {tagMesh} = mesh;
                  return tagMesh;
                }
              }
            }

            getGrabTagMesh(side) {
              const grabHoverState = grabHoverStates[side];
              const {tagMesh} = grabHoverState;
              return tagMesh;
            }

            message(detail) {
              const e = new CustomEvent('message', {
                detail: detail,
              });
              rootWorldElement.dispatchEvent(e);
            }

            ignoreEntityMutation(entityMutationIgnoreSpec) {
              entityMutationIgnores.push(entityMutationIgnoreSpec);
            }

            updateLinesMesh() {
              linesMesh.render();
            }

            listen() {
              this.on('setAttribute', setAttrbuteSpec => {
                // if this is the only listener (i.e. a home with no world engine rather than a server), we need to set the attribute on ourselves
                if (this.listeners('setAttribute').length === 1) {
                  const {id, name, value} = setAttrbuteSpec;
                  const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);
                  const {item} = tagMesh;
                  item.setAttribute(name, value);
                }
              });
            }
          };
          const tagsApi = new TagsApi();

          return tagsApi;
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

const _jsonParse = s => {
  let error = null;
  let result;
  try {
    result = JSON.parse(s);
  } catch (err) {
    error = err;
  }
  if (!error) {
    return result;
  } else {
    return undefined;
  }
};
const _shallowClone = o => {
  const result = {};

  for (const k in o) {
    const v = o[k];
    result[k] = v;
  }

  return result;
};
const _makeId = () => Math.random().toString(36).substring(7);
const _clone = o => JSON.parse(JSON.stringify(o));
const _roundToDecimals = (value, decimals) => Number(Math.round(value+'e'+decimals)+'e-'+decimals);

module.exports = Tags;

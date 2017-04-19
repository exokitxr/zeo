import deepEqual from 'deep-equal';
import MultiMutex from 'multimutex';
import CssSelectorParser from 'css-selector-parser';
const cssSelectorParser = new CssSelectorParser.CssSelectorParser();

import {
  WIDTH,
  HEIGHT,
  OPEN_WIDTH,
  OPEN_HEIGHT,
  DETAILS_WIDTH,
  DETAILS_HEIGHT,

  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
  WORLD_OPEN_WIDTH,
  WORLD_OPEN_HEIGHT,
  WORLD_DETAILS_WIDTH,
  WORLD_DETAILS_HEIGHT
} from './lib/constants/tags';
import menuUtilser from './lib/utils/menu';
import tagsRender from './lib/render/tags';

const SIDES = ['left', 'right'];
const AXES = ['x', 'y', 'z'];

const itemInstanceSymbol = Symbol();
const itemInstancingSymbol = Symbol();
const itemPageSymbol = Symbol();
const itemPreviewSymbol = Symbol();
const itemTempSymbol = Symbol();
const itemMediaPromiseSymbol = Symbol();
const MODULE_TAG_NAME = 'module'.toUpperCase();

class Tags {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {home: {enabled: homeEnabled}}} = archae;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/bootstrap',
      '/core/engines/three',
      '/core/engines/input',
      '/core/engines/webvr',
      '/core/engines/cyborg',
      '/core/engines/biolumi',
      '/core/engines/keyboard',
      '/core/engines/fs',
      '/core/engines/somnifer',
      '/core/engines/rend',
      '/core/utils/js-utils',
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
        fs,
        somnifer,
        rend,
        jsUtils,
        imageUtils,
        creatureUtils,
      ]) => {
        if (live) {
          const {THREE, scene, camera} = three;
          const {events} = jsUtils;
          const {EventEmitter} = events;

          const transparentImg = biolumi.getTransparentImg();

          const menuUtils = menuUtilser.makeUtils({fs});
          const tagsRenderer = tagsRender.makeRenderer({menuUtils, creatureUtils});

          const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
          const _decomposeMatrix = matrix => {
            const position = new THREE.Vector3();
            const rotation = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            matrix.decompose(position, rotation, scale);
            return {position, rotation, scale};
          };

          const oneVector = new THREE.Vector3(1, 1, 1);

          const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x0000FF,
            wireframe: true,
            opacity: 0.5,
            transparent: true,
          });
          const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x000000,
            // linewidth: 1,
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
                  archae.requestPlugin(name)
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
                    archae.releasePlugin(name)
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
              let {_numComponents: numComponents = 0} = entityElement;
              numComponents++;
              entityElement._numComponents = numComponents;

              if (numComponents === 1) {
                const object = new THREE.Object3D();
                scene.add(object);
                entityElement._object = object;
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
                const entityId = entityElement.item.id;
                const entityTagMesh = tagMeshes.find(tagMesh => tagMesh.item.type === 'entity' && tagMesh.item.id === entityId);
                line.set(moduleTagMesh, entityTagMesh);
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
              let {_numComponents: numComponents = 0} = entityElement;
              numComponents--;
              entityElement._numComponents = numComponents;

              if (numComponents === 0) {
                const {_object: oldObject} = entityElement;
                scene.remove(oldObject);
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
                        const attributeValue = menuUtils.castValueToCallbackValue(attributeValueJson, attributeType);

                        componentElement.entityAttributeValueChangedCallback(entityElement, matchingAttribute, null, attributeValue);
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
                          }
                        } else { // removing attribute
                          if (oldElementMatches && !newElementMatches) { // if this is the last attribute that applied, unmount the component from the entity
                            _removeEntityCallback(componentElement, entityElement);
                          } else {
                            componentElement.entityAttributeValueChangedCallback(entityElement, attributeName, oldAttributeValue, newAttributeValue);
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
                      }
                    }

                    const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === entityId);
                    const {attributesMesh} = tagMesh;
                    attributesMesh.update();
                  }
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

            addPage(pageSpec, options) {
              const {width, height, color, uis} = this;

              const ui = biolumi.makeUi({
                width: width,
                height: height,
                color,
              });
              const pageMesh = ui.addPage(pageSpec, options);
              return pageMesh;
            }
          }
          const uiManager = new UiManager({
            width: WIDTH,
            height: HEIGHT,
            color: [1, 1, 1, 1],
            metadata: {
              open: false,
            },
          });
          const uiOpenManager = new UiManager({
            width: OPEN_WIDTH,
            height: OPEN_HEIGHT,
            color: [1, 1, 1, 0],
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

          const pointerStates = {
            left: biolumi.makeMenuHoverState(),
            right: biolumi.makeMenuHoverState(),
          };
          const _makeHoverState = () => ({
            tagMesh: null,
          });
          const hoverStates = {
            left: _makeHoverState(),
            right: _makeHoverState(),
          };

          const dotMeshes = {
            left: biolumi.makeMenuDotMesh(),
            right: biolumi.makeMenuDotMesh(),
          };
          scene.add(dotMeshes.left);
          scene.add(dotMeshes.right);

          const linesMesh = (() => {
            const maxNumLines = 256;

            const geometry = (() => {
              const geometry = new THREE.BufferGeometry();
              geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(maxNumLines * 3 * 2), 3));
              geometry.setDrawRange(0, 0);
              return geometry;
            })();
            const material = lineMaterial;

            const mesh = new THREE.LineSegments(geometry, material);
            // mesh.rotation.order = camera.rotation.order;
            mesh.frustumCulled = false;

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
            const _getWorldPosition = object => { // the object might not be a THREE.Object3D; it could be a gamepad or something
              if (object.getWorldPosition) {
                return object.getWorldPosition();
              } else {
                return object.position;
              }
            };
            mesh.render = () => {
              const positionsAttribute = geometry.getAttribute('position');
              const {array: positions} = positionsAttribute;

              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const {start, end} = line;
                const startPosition = _getWorldPosition(start);
                const endPosition = _getWorldPosition(end);

                const baseIndex = i * 3 * 2;
                positions[baseIndex + 0] = startPosition.x;
                positions[baseIndex + 1] = startPosition.y;
                positions[baseIndex + 2] = startPosition.z;
                positions[baseIndex + 3] = endPosition.x;
                positions[baseIndex + 4] = endPosition.y;
                positions[baseIndex + 5] = endPosition.z;
              }

              positionsAttribute.needsUpdate = true;

              geometry.setDrawRange(0, lines.length * 2);
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

          const positioningMesh = (() => {
            const geometry = (() => {
              const result = new THREE.BufferGeometry();
              const positions = Float32Array.from([
                0, 0, 0,
                1, 0, 0,
                0, 0, 0,
                0, 1, 0,
                0, 0, 0,
                0, 0, 1,
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
            });

            const mesh = new THREE.LineSegments(geometry, material);
            mesh.visible = false;
            return mesh;
          })();
          scene.add(positioningMesh);

          const detailsState = {
            inputText: '',
            inputIndex: 0,
            inputValue: 0,
            positioningId: null,
            positioningName: null,
            positioningSide: null,
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
                depthTest: false,
              });
              return material;
            })();

            const mesh = new THREE.Mesh(geometry, material);
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

          const _trigger = e => {
            const {side} = e;

            const _doClickDetails = () => {
              const pointerState = pointerStates[side];
              const {intersectionPoint} = pointerState;

              if (intersectionPoint) {
                const {gamepads} = webvr.getStatus();
                const gamepad = gamepads[side];

                if (gamepad) {
                  const {buttons: {grip: {pressed: gripPressed}}} = gamepad;

                  if (!gripPressed) {
                    const {anchor} = pointerState;
                    const onclick = (anchor && anchor.onclick) || '';

                    let match;
                    if (match = onclick.match(/^module:main:(.+)$/)) {
                      const id = match[1];

                      tagsApi.emit('openDetails', {
                        id: id,
                      });

                      return true;
                    } else if (match = onclick.match(/^module:close:(.+)$/)) {
                      const id = match[1];

                      tagsApi.emit('closeDetails', {
                        id: id,
                      });

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
                  const pointerState = pointerStates[side];
                  const {intersectionPoint} = pointerState;

                  if (intersectionPoint) {
                    const {anchor} = pointerState;
                    const onclick = (anchor && anchor.onclick) || '';

                    let match;
                    if (match = onclick.match(/^(module|entity):main:(.+?)$/)) {
                      const type = match[1];
                      const id = match[2];

                      const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);
                      const canMakeTag =
                        Boolean(tagMesh.item.metadata && tagMesh.item.metadata.isStatic)
                        !(type === 'module' && (tagMesh.item.metadata.exists || tagMesh.item.instancing));

                      if (canMakeTag) {
                        tagsApi.emit('grabNpmTag', { // XXX handle the multi-{user,controller} conflict cases
                          side,
                          tagMesh
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
                  const pointerState = pointerStates[side];
                  const {intersectionPoint} = pointerState;

                  if (intersectionPoint) {
                    const {metadata} = pointerState;
                    const {type} = metadata;

                    if (type === 'module' || type === 'entity' || type === 'file') {
                      const {tagMesh} = metadata;
                      const {item} = tagMesh;
                      const {type: itemType, metadata: itemMetadata} = item;

                      if (
                        (itemType === 'module' && !(itemMetadata && itemMetadata.isStatic)) ||
                        (itemType === 'entity' && !(itemMetadata && itemMetadata.isStatic)) ||
                        (itemType === 'file')
                      ) {
                        tagsApi.emit('grabWorldTag', {
                          side,
                          tagMesh
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
              } else {
                return false;
              }
            };
            const _doClickAux = () => {
              const pointerState = pointerStates[side];
              const {intersectionPoint} = pointerState;

              if (intersectionPoint) {
                const {anchor} = pointerState;
                const onclick = (anchor && anchor.onclick) || '';

                let match;
                if (match = onclick.match(/^entity:addAttribute:(.+)$/)) {
                  const id = match[1];

                  const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);
                  const {item} = tagMesh;
                  const {attributes} = item;
                  const newAtrributeName = (() => {
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
                    name: newAtrributeName,
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
                        const {value} = pointerState;

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
            const _doSetPosition = () => {
              const {positioningSide} = detailsState;

              if (positioningSide && side === positioningSide) {
                const {positioningId, positioningName} = detailsState;

                const newValue = (() => {
                  const {position, quaternion, scale} = positioningMesh;
                  return position.toArray().concat(quaternion.toArray()).concat(scale.toArray());
                })();
                tagsApi.emit('setAttribute', {
                  id: positioningId,
                  name: positioningName,
                  value: newValue,
                });

                detailsState.positioningId = null;
                detailsState.positioningName = null;
                detailsState.positioningSide = null;

                return true;
              } else {
                return false;
              }
            };
            const _doClickAttribute = () => {
              const pointerState = pointerStates[side];
              const {intersectionPoint} = pointerState;

              if (intersectionPoint) {
                const {anchor} = pointerState;
                const onclick = (anchor && anchor.onclick) || '';

                let match;
                if (match = onclick.match(/^attribute:([^:]+):([^:]+)(?::([^:]+))?:(position|focus|set|tweak|toggle|choose)(?::([^:]+))?$/)) {
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

                  if (action === 'position') {
                    detailsState.positioningId = tagId;
                    detailsState.positioningName = attributeName;
                    detailsState.positioningSide = side;

                    keyboard.tryBlur();
                  } else if (action === 'focus') {
                    const {value: hoverValue} = pointerState;
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
                        const {hmd: {position: hmdPosition, rotation: hmdRotation}} = webvr.getStatus();
                        const inputText = menuUtils.castValueValueToString(attributeValue, type);
                        const {index, px} = textProperties;
                        return keyboard.tryFocus({
                          type: 'attribute:' + tagId + ':' + attributeName,
                          position: hmdPosition,
                          rotation: hmdRotation,
                          inputText: inputText,
                          inputIndex: index,
                          inputValue: px,
                          fontSpec: subcontentFontSpec,
                        });
                      } else {
                        return keyboard.tryFakeFocus({
                          type: 'attribute:' + tagId + ':' + attributeName,
                        });
                      }
                    })();
                    if (keyboardFocusState) {
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
                    }
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
                        const {value} = pointerState;
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
                        const {value} = pointerState;
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

            _doClickDetails() || _doClickGrabNpmTag() || _doClickGrabWorldTag() || _doClickAux() || _doSetPosition() || _doClickAttribute();

            const pointerState = pointerStates[side];
            const {intersectionPoint} = pointerState;
            if (intersectionPoint) {
              e.stopImmediatePropagation();
            }
          };
          input.on('trigger', _trigger);
          const _triggerdown = e => {
            const {side} = e;

            const _doClickTag = () => {
              const pointerState = pointerStates[side];
              const {intersectionPoint} = pointerState;

              if (intersectionPoint) {
                const {anchor} = pointerState;
                const onmousedown = (anchor && anchor.onmousedown) || '';

                let match;
                if (match = onmousedown.match(/^module:link:(.+)$/)) {
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

            _doClickTag();
          };
          input.on('triggerdown', _triggerdown);
          const _triggerup = e => {
            const {side} = e;

            const _doClickTag = () => {
              const dragState = dragStates[side];
              const {src, dst} = dragState;

              if (src && dst) {
                const {type: srcType} = src;
                const {type: dstType} = dst;

                if (srcType === 'module' && dstType === 'module') {
                  const {gamepads} = webvr.getStatus();
                  const gamepad = gamepads[side];

                  if (gamepad) {
                    const {buttons: {grip: {pressed: gripPressed}}} = gamepad;

                    if (!gripPressed) {
                      const {tagMesh: srcTagMesh} = src;
                      const {item} = srcTagMesh;

                      if (!item.instancing) {
                        const {tagMesh: dstTagMesh} = dst;

                        const _linkModule = (srcTagMesh, dstTagMesh) => {
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
                                  const matrix = (() => { // XXX we should offset multiple tags here so they don't overlap
                                    const {matrix: oldMatrix} = itemSpec;
                                    const position = new THREE.Vector3().fromArray(oldMatrix.slice(0, 3));
                                    const rotation = new THREE.Quaternion().fromArray(oldMatrix.slice(3, 3 + 4));
                                    const scale = new THREE.Vector3().fromArray(oldMatrix.slice(3 + 4, 3 + 4 + 3));

                                    position.add(new THREE.Vector3(0, 0, 0.1).applyQuaternion(rotation));

                                    return position.toArray().concat(rotation.toArray()).concat(scale.toArray());
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
                        _linkModule(srcTagMesh, (srcTagMesh === dstTagMesh) ? null : dstTagMesh);

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
              } else {
                dragState.src = null;
                dragState.dst = null;

                return false;
              }
            };

            _doClickTag();
          };
          input.on('triggerup', _triggerup);

          const _update = () => {
            const _updateControllers = () => {
              const _updateElementAnchors = () => {
                if (rend.isOpen() || homeEnabled) {
                  const {gamepads} = webvr.getStatus();
                  const controllers = cyborg.getControllers();
                  const controllerMeshes = SIDES.map(side => controllers[side].mesh);

                  const isWorldTab = rend.getTab() === 'world';
                  const _isFreeTagMesh = tagMesh =>
                    (tagMesh.parent === scene) ||
                    controllerMeshes.some(controllerMesh => tagMesh.parent === controllerMesh);

                  const objects = (() => {
                    const result = [];

                    for (let i = 0; i < tagMeshes.length; i++) {
                      const tagMesh = tagMeshes[i];
                      const {visible} = tagMesh;

                      if (visible && (isWorldTab || homeEnabled || _isFreeTagMesh(tagMesh))) {
                        const {item} = tagMesh;
                        const {type} = item;

                        const {planeMesh} = tagMesh;
                        if (planeMesh.visible) {
                          const matrixObject = _decomposeObjectMatrixWorld(planeMesh);
                          const {page} = planeMesh;

                          result.push({
                            matrixObject: matrixObject,
                            page: page,
                            width: WIDTH,
                            height: HEIGHT,
                            worldWidth: WORLD_WIDTH,
                            worldHeight: WORLD_HEIGHT,
                            worldDepth: WORLD_DEPTH,
                            metadata: {
                              type,
                              tagMesh,
                            },
                          });
                        }

                        const {planeOpenMesh} = tagMesh;
                        if (planeOpenMesh && planeOpenMesh.visible) {
                          const matrixObject = _decomposeObjectMatrixWorld(planeOpenMesh);
                          const {page} = planeOpenMesh;

                          result.push({
                            matrixObject: matrixObject,
                            page: page,
                            width: OPEN_WIDTH,
                            height: OPEN_HEIGHT,
                            worldWidth: WORLD_OPEN_WIDTH,
                            worldHeight: WORLD_OPEN_HEIGHT,
                            worldDepth: WORLD_DEPTH,
                            metadata: {
                              type,
                              tagMesh,
                            },
                          });
                        }

                        const {planeDetailsMesh} = tagMesh;
                        if (planeDetailsMesh && planeDetailsMesh.visible) {
                          const matrixObject = _decomposeObjectMatrixWorld(planeDetailsMesh);
                          const {page} = planeDetailsMesh;

                          result.push({
                            matrixObject: matrixObject,
                            page: page,
                            width: DETAILS_WIDTH,
                            height: DETAILS_HEIGHT,
                            worldWidth: WORLD_DETAILS_WIDTH,
                            worldHeight: WORLD_DETAILS_HEIGHT,
                            worldDepth: WORLD_DEPTH,
                            metadata: {
                              type: 'details',
                              tagMesh: planeDetailsMesh,
                            },
                          });
                        }

                        if (type === 'entity') {
                          const {attributesMesh} = tagMesh;
                          const {attributeMeshes} = attributesMesh;

                          for (let j = 0; j < attributeMeshes.length; j++) {
                            const attributeMesh = attributeMeshes[j];
                            const matrixObject = _decomposeObjectMatrixWorld(attributeMesh);
                            const {page} = attributeMesh;

                            result.push({
                              matrixObject: matrixObject,
                              page: page,
                              width: WIDTH,
                              height: HEIGHT,
                              worldWidth: WORLD_WIDTH,
                              worldHeight: WORLD_HEIGHT,
                              worldDepth: WORLD_DEPTH,
                              metadata: {
                                type: 'attribute',
                                tagMesh: attributeMesh,
                              },
                            });
                          }
                        }
                      }
                    }

                    return result;
                  })();
                  SIDES.forEach(side => {
                    const gamepad = gamepads[side];

                    if (gamepad) {
                      const {position: controllerPosition, rotation: controllerRotation, scale: controllerScale} = gamepad;
                      const pointerState = pointerStates[side];
                      const dotMesh = dotMeshes[side];
                      const boxMesh = boxMeshes[side];

                      biolumi.updateAnchors({
                        objects: objects,
                        side,
                        hoverState: pointerState,
                        dotMesh: dotMesh,
                        boxMesh: boxMesh,
                        controllerPosition,
                        controllerRotation,
                        controllerScale,
                      });
                    }
                  });
                }
              };
              const _updateElementGrabbables = () => {
                if (rend.isOpen() || homeEnabled) {
                  const {gamepads} = webvr.getStatus();

                  SIDES.forEach(side => {
                    const hoverState = hoverStates[side];
                    const gamepad = gamepads[side];
                    const grabBoxMesh = grabBoxMeshes[side];

                    const hoverMesh = (() => {
                      if (gamepad) {
                        const {position: controllerPosition, scale: controllerScale} = gamepad;
                        const absPosition = controllerPosition.clone().multiply(controllerScale);

                        let closestTagMesh = null;
                        let closestTagMeshDistance = Infinity;
                        for (let i = 0; i < tagMeshes.length; i++) {
                          const tagMesh = tagMeshes[i];
                          const distance = absPosition.distanceTo(tagMesh.getWorldPosition());

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
                    hoverState.tagMesh = hoverMesh;

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
                if (rend.isOpen() || homeEnabled) {
                  SIDES.forEach(side => {
                    const dragState = dragStates[side];
                    const {src} = dragState;

                    if (src) {
                      const pointerState = pointerStates[side];
                      const {intersectionPoint} = pointerState;

                      if (intersectionPoint) {
                        const {type: srcType, tagMesh: srcTagMesh} = src;
                        const {metadata} = pointerState;
                        const {type: hoverType, tagMesh: hoverTagMesh} = metadata;

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
                    }
                  });
                }
              };
              const _updateDragLines = () => {
                if (rend.isOpen() || homeEnabled) {
                  const {gamepads} = webvr.getStatus();
                  const controllers = cyborg.getControllers();
                  const controllerMeshes = SIDES.map(side => controllers[side].mesh);

                  SIDES.forEach(side => {
                    const gamepad = gamepads[side];
                    const dragState = dragStates[side];
                    const {src, line} = dragState;

                    if (gamepad && src) {
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

                          if (dstTagMesh !== srcObject) {
                            return dstTagMesh;
                          } else {
                            return gamepad;
                          }
                        } else {
                          return gamepad;
                        }
                      })();
                      localLine.set(srcObject, dstObject);
                      linesMesh.render();
                    } else {
                      if (line) {
                        linesMesh.removeLine(line);
                        linesMesh.render();

                        dragState.line = null;
                      }
                    }
                  });
                }
              };
              const _updatePositioningMesh = () => {
                const {positioningId, positioningName, positioningSide} = detailsState;

                if (positioningId && positioningName && positioningSide) {
                  const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === positioningId);
                  const {gamepads} = webvr.getStatus();
                  const gamepad = gamepads[positioningSide];

                  if (gamepad) {
                    const {position: controllerPosition, rotation: controllerRotation, scale: controllerScale} = gamepad;
                    positioningMesh.position.copy(controllerPosition);
                    positioningMesh.quaternion.copy(controllerRotation);
                    positioningMesh.scale.copy(controllerScale);
                  }

                  if (!positioningMesh.visible) {
                    positioningMesh.visible = true;
                  }
                } else {
                  if (positioningMesh.visible) {
                    positioningMesh.visible = false;
                  }
                }
              };

              _updateElementAnchors();
              _updateElementGrabbables();
              _updateDragStates();
              _updateDragLines();
              _updatePositioningMesh();
            };
            const _updateLocal = () => {
              for (let i = 0; i < localUpdates.length; i++) {
                const update = localUpdates[i];
                update();
              }
            };

            _updateControllers();
            _updateLocal();
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
            });
            scene.remove(linesMesh);

            input.removeListener('trigger', _trigger);
            input.removeListener('triggerdown', _triggerdown);
            input.removeListener('triggerup', _triggerup);
            input.removeListener('keydown', _keydown);
            input.removeListener('keyboarddown', _keyboarddown);

            rend.removeListener('update', _update);
          };

          class Item extends EventEmitter {
            constructor(
              type,
              id,
              name,
              displayName,
              description,
              version,
              readme,
              tagName,
              matrix,
              attributes,
              mimeType,
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
              this.readme = readme;
              this.tagName = tagName;
              this.matrix = matrix;
              this.attributes = attributes;
              this.mimeType = mimeType;
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
              const componentElement = menuUtils.makeZeoComponentElement({
                baseObject,
              });
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
                  const attributeValue = menuUtils.castValueToCallbackValue(attributeValueJson, attributeType);

                  componentElement.entityAttributeValueChangedCallback(entityElement, matchingAttribute, null, attributeValue);
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
                itemSpec.readme,
                itemSpec.tagName, // XXX get rid of these
                itemSpec.matrix,
                itemSpec.attributes,
                itemSpec.mimeType,
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

                const mesh = uiManager.addPage(({
                  item,
                  details: {
                    positioningId,
                    positioningName,
                  },
                  focus: {
                    keyboardFocusState,
                  },
                }) => {
                  const {type: focusType = '', inputText = '', inputValue = 0} = keyboardFocusState || {};
                  const focusAttributeSpec = (() => {
                    const match = focusType.match(/^attribute:(.+?):(.+?)$/);
                    return match && {
                      tagId: match[1],
                      attributeName: match[2],
                    };
                  })();
                  const src = (() => {
                    const {type} = item;

                    switch (type) {
                      case 'module': {
                        if (!details) {
                          return tagsRenderer.getModuleSrc({item, inputText, inputValue, positioningId, positioningName, focusAttributeSpec});
                        } else {
                          return tagsRenderer.getModuleDetailsSrc({item});
                        }
                      }
                      case 'entity': {
                        return tagsRenderer.getEntitySrc({item});
                      }
                      case 'file': {
                        const mode = _getItemPreviewMode(item);

                        return tagsRenderer.getFileSrc({item, mode, open});
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
                    details: detailsState,
                    focus: focusState,
                  },
                  worldWidth: open ? WORLD_OPEN_WIDTH : details ? WORLD_DETAILS_WIDTH : WORLD_WIDTH,
                  worldHeight: open ? WORLD_OPEN_HEIGHT : details ? WORLD_DETAILS_HEIGHT : WORLD_HEIGHT,
                });
                mesh.receiveShadow = true;

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
                  // planeDetailsMesh.position.y = ((WORLD_DETAILS_WIDTH - WORLD_HEIGHT) / 2);
                  planeDetailsMesh.position.z = 0.01;

                  planeDetailsMesh.initialOffset = planeDetailsMesh.position.clone();
                } /* else {
                  planeDetailsMesh.position.x = -(WORLD_DETAILS_WIDTH - WORLD_WIDTH) / 2;
                  planeDetailsMesh.position.y = (WORLD_DETAILS_HEIGHT - WORLD_HEIGHT) / 2;
                } */
                planeDetailsMesh.visible = Boolean(item.details);
                object.add(planeDetailsMesh);
                object.planeDetailsMesh = planeDetailsMesh;
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
                            focus: focusState,
                          };
                          const newAttributeMesh = uiAttributeManager.addPage(({
                            attribute,
                            focus: {
                              keyboardFocusState,
                            },
                          }) => {
                            const {type: focusType = '', inputText = '', inputValue = 0} = keyboardFocusState || {};
                            const focusAttributeSpec = (() => {
                              const match = focusType.match(/^attribute:(.+?):(.+?)$/);
                              return match && {
                                tagId: match[1],
                                attributeName: match[2],
                              };
                            })();

                            return {
                              type: 'html',
                              src: tagsRenderer.getAttributeSrc({item, attribute, inputText, inputValue, focusAttributeSpec}),
                              w: WIDTH,
                              h: HEIGHT,
                            };
                          }, {
                            type: 'attribute',
                            state: state,
                            worldWidth: WORLD_WIDTH,
                            worldHeight: WORLD_HEIGHT,
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
              const pointerState = pointerStates[side];
              const {metadata} = pointerState;
              return metadata ? metadata.tagMesh : null;
            }

            getHoveredTagMesh(side) {
              const hoverState = hoverStates[side];
              const {tagMesh} = hoverState;
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
              // XXX this needs to actually sync to the object positions
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

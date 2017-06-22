import deepEqual from 'deep-equal';
import MultiMutex from 'multimutex';

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

const itemInstanceSymbol = Symbol();
const itemInstancingSymbol = Symbol();
const itemPageSymbol = Symbol();
const itemPreviewSymbol = Symbol();
const itemTempSymbol = Symbol();
const itemMediaPromiseSymbol = Symbol();

class Tags {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

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
          const modules = new Map();
          class ModuleTracker {
            constructor() {
              this.refCount = 0;
            }
          }
          const _addModule = name => {
            return modulesMutex.lock(name)
              .then(unlock => new Promise((accept, reject) => {
                const entry = modules.get(name);

                if (entry) {
                  entry.refCount++;

                  accept();

                  unlock();
                } else {
                  loader.requestPlugin(name)
                    .then(pluginInstance => {
                      const entry = new ModuleTracker();
                      entry.refCount++;

                      modules.set(name, entry);

                      accept();

                      unlock();
                    })
                    .catch(err => {
                      reject(err);

                      unlock();
                    });
                }
              }));
          };
          const _removeModule = name => {
            return modulesMutex.lock(name)
              .then(unlock => new Promise((accept, reject) => {
                const entry = modules.get(name);

                if (entry.refCount === 1) {
                  loader.removePlugin(name)
                    .then(() => {
                      modules.delete(name);

                      accept();

                      unlock();
                    })
                    .catch(err => {
                      reject(err);

                      unlock();
                    });
                } else {
                  entry.refCount--;

                  accept();

                  unlock();
                }
              }));
          };

          const rootWorldElement = document.createElement('world');
          rootWorldElement.style.cssText = 'display: none !important;';
          const localEventSymbol = Symbol();
          rootWorldElement.addEventListener('broadcast', e => {
            tagsApi.emit('broadcast', e.detail);
          });
          document.body.appendChild(rootWorldElement);

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
              /* let {_lines: componentLines} = componentElement;
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
              componentLines.set(entityElement, line); */
            };
            const _doCallback = () => {
              componentElement.entityAddedCallback(entityElement);
            };

            _updateObject();
            _updateLine();
            _doCallback();
          };
          const _removeEntityCallback = (componentElement, entityElement) => {
            const _updateLine = () => {
              /* const {_lines: componentLines} = componentElement;
              const line = componentLines.get(entityElement);
              linesMesh.removeLine(line);
              linesMesh.render();
              componentLines.delete(line); */
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
            const _doCallback = () => {
              componentElement.entityRemovedCallback(entityElement);
            };

            _updateLine();
            _updateObject();
            _doCallback();
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
          const _someList = (list, predicate) => {
            for (let i = 0; i < list.length; i++) {
              const e = list[i];
              if (predicate(e)) {
                return true;
              }
            }
            return false;
          };
          const _addEntity = (module, element) => {
            const {item: initialEntityItem} = element;
            const entityAttributes = _getElementJsonAttributes(element);
            if (!initialEntityItem) { // element added manually
              const tagName = element.tagName.toLowerCase();
              tagsApi.emit('mutateAddEntity', {
                element: element,
                tagName: tagName,
                attributes: entityAttributes,
              });
            }

            _addModule(module)
              .then(() => {
                if (element.getAttribute('module') === module) {
                  const componentApis = tagComponentApis[module] || [];
                  const componentElements = tagComponentInstances[module] || [];

                  for (let i = 0; i < componentApis.length; i++) {
                    const componentApi = componentApis[i];
                    const componentElement = componentElements[i];
                    const {attributes: componentAttributes = {}} = componentApi;

                    _addEntityCallback(componentElement, element);

                    for (const componentAttributeName in componentAttributes) {
                      const componentAttribute = componentAttributes[componentAttributeName];
                      const {type: attributeType} = componentAttribute;
                      const entityAttribute = entityAttributes[componentAttributeName] || {};
                      const {value: attributeValueJson} = entityAttribute;

                      if (attributeValueJson !== undefined) {
                        const oldValue = null;
                        const newValue = menuUtils.castValueToCallbackValue(attributeValueJson, attributeType);

                        componentElement.entityAttributeValueChangedCallback(element, componentAttributeName, oldValue, newValue);

                        const {item} = element;
                        const {id: entityId} = item;
                        tagsApi.emit('attributeValueChanged', {
                          entityId: entityId,
                          attributeName: componentAttributeName,
                          type: attributeType,
                          oldValue: oldValue,
                          newValue: newValue,
                        });
                      }
                    }
                  }
                }
              })
              .catch(err => {
                console.warn(err);
              });
          };
          const _removeEntity = (module, element) => {
            const {item: initialEntityItem} = element;
            if (initialEntityItem) { // element removed manually
              const {id: entityId} = initialEntityItem;
              tagsApi.emit('mutateRemoveEntity', {
                id: entityId,
              });
            }

            const componentElements = tagComponentInstances[module];
            for (let i = 0; i < componentElements.length; i++) {
              const componentElement = componentElements[i];
              _removeEntityCallback(componentElement, element);
            }

            _removeModule(module)
              .then(() => {
                if (element.getAttribute('module') === module) {
                  // nothing
                }
              })
              .catch(err => {
                console.warn(err);
              });
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

                  if (addedNode.nodeType === Node.ELEMENT_NODE && _someList(addedNode.attributes, a => a.name === 'module' && Boolean(a.value))) {
                    const entityElement = addedNode;
                    const module = entityElement.getAttribute('module');
                    _addEntity(module, entityElement);
                  }
                }

                const {removedNodes} = mutation;
                for (let k = 0; k < removedNodes.length; k++) {
                  const removedNode = removedNodes[k];

                  if (removedNode.nodeType === Node.ELEMENT_NODE && _someList(removedNode.attributes, a => a.name === 'module' && Boolean(a.value))) {
                    const entityElement = removedNode;
                    const module = entityElement.getAttribute('module');
                    _removeEntity(module, entityElement);
                  }
                }
              } else if (type === 'attributes') {
                const {target} = mutation;

                if (target.nodeType === Node.ELEMENT_NODE) {
                  const entityElement = target;
                  const {attributeName, oldValue: oldValueString} = mutation;
                  const newValueString = entityElement.getAttribute(attributeName);

                  if (attributeName === 'module') {
                    if (oldValueString !== null) {
                      const module = oldValueString;
                      _removeEntity(module, entityElement);
                    }
                    if (newValueString !== null) {
                      const module = newValueString;
                      _addEntity(module, entityElement);
                    }
                  } else {
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

                    const {module} = entityItem;
                    const componentApis = tagComponentApis[module] || [];
                    const componentElements = tagComponentInstances[module] || [];
                    for (let i = 0; i < componentApis.length; i++) {
                      const componentApi = componentApis[i];
                      const componentElement = componentElements[i];
                      const {attributes: componentAttributes = []} = componentApi;
                      const componentAttribute = componentAttributes[attributeName];

                      if (componentAttribute !== undefined) {
                        const {type: attributeType} = componentAttribute;
                        const oldAttributeValue = menuUtils.castValueToCallbackValue(oldValueJson, attributeType);
                        const newAttributeValue = menuUtils.castValueToCallbackValue(newValueJson, attributeType);

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
              }
            }

            entityMutationIgnores.length = 0;
          });
          rootEntitiesObserver.observe(rootEntitiesElement, {
            childList: true,
            attributes: true,
            // characterData: true,
            subtree: true,
            attributeOldValue: true,
            // characterDataOldValue: true,
          });

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
          // scene.add(linesMesh);
          rend.registerAuxObject('tagsLinesMesh', linesMesh);

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

          const _trigger = e => {
            const {side} = e;

            /* const _doClickDetails = () => {
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
                    if (match = onclick.match(/^module:focusVersion:(.+)$/)) {
                      const id = match[1];

                      const keyboardFocusState = keyboard.fakeFocus({
                        type: 'version:' + id,
                      });
                      focusState.keyboardFocusState = keyboardFocusState;

                      keyboardFocusState.on('blur', () => {
                        focusState.keyboardFocusState = null;
                      });

                      return true;
                    } else if (match = onclick.match(/^module:setVersion:(.+):(.+)$/)) {
                      const id = match[1];
                      const version = match[2];

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
            }; */
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
            /* const _doClickAttribute = () => {
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
                    });
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
                  }

                  return true;
                } else {
                  return false;
                }
              } else {
                return false;
              }
            }; */

            if (/* _doClickDetails() || */_doClickAux() /*|| _doClickAttribute()*/) {
              e.stopImmediatePropagation();
            }
          };
          input.on('trigger', _trigger);
          const _triggerdown = e => {
            /* const {side} = e;

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
            } */
          };
          input.on('triggerdown', _triggerdown);
          const _triggerup = e => {
            /* const {side} = e;
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
            } */
          };
          input.on('triggerup', _triggerup);

          const _update = () => {
            const _updateLocal = () => {
              for (let i = 0; i < localUpdates.length; i++) {
                const update = localUpdates[i];
                update();
              }
            };

            _updateLocal();
          };
          rend.on('update', _update);

          cleanups.push(() => {
            for (let i = 0; i < tagMeshes.length; i++) {
              const tagMesh = tagMeshes[i];
              tagMesh.parent.remove(tagMesh);
            }
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
              module,
              description,
              version,
              versions, // XXX need to fetch these from the backend every time instead of saving it to the tags json
              readme,
              tagName,
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
              this.module = module;
              this.description = description;
              this.version = version;
              this.versions = versions;
              this.readme = readme;
              this.tagName = tagName;
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
                    const {module, attributes} = item;

                    for (const attributeName in attributes) {
                      const attributeSpec = _getAttributeSpec(module, attributeName);

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
          const tagComponentApis = {}; // plugin name -> [ component api ]
          const tagComponentInstances = {}; // plugin name -> [ component element ]

          const _getAttributeSpec = (module, attributeName) => {
            const componentApis = tagComponentApis[module] || [];

            for (let i = 0; i < componentApis.length; i++) {
              const componentApi = componentApis[i];
              const {attributes: componentAttributes = {}} = componentApi;
              const componentAttribute = componentAttributes[attributeName];

              if (componentAttribute) {
                const attributeSpec = _shallowClone(componentAttribute);
                attributeSpec.name = attributeName;
                return attributeSpec;
              }
            }

            return null;
          };
          const _getAttributeSpecs = module => {
            const result = [];

            const componentApis = tagComponentApis[module] || [];
            for (let i = 0; i < componentApis.length; i++) {
              const componentApi = componentApis[i];
              const {attributes: componentAttributes} = componentApi;

              if (componentAttributes) {
                for (const componentAttributeName in componentAttributes) {
                  if (!result.some(attributeSpec => attributeSpec.name === componentAttributeName)) {
                    const componentAttribute = componentAttributes[componentAttributeName];

                    const attributeSpec = _shallowClone(componentAttribute);
                    attributeSpec.name = componentAttributeName;
                    result.push(attributeSpec);
                  }
                }
              }
            }

            return result;
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
              componentElement.componentApi = componentApi

              const name = archae.getPath(pluginInstance);

              let tagComponentApiComponents = tagComponentApis[name];
              if (!tagComponentApiComponents) {
                tagComponentApiComponents = [];
                tagComponentApis[name] = tagComponentApiComponents;
              }
              tagComponentApiComponents.push(componentApi);

              let tagComponentInstanceInstances = tagComponentInstances[name];
              if (!tagComponentInstanceInstances) {
                tagComponentInstanceInstances = [];
                tagComponentInstances[name] = tagComponentInstanceInstances;
              }
              tagComponentInstanceInstances.push(componentElement);
            }

            unregisterComponent(pluginInstance, componentApiToRemove) {
              const name = archae.getPath(pluginInstance);

              const tagComponentApiComponents = tagComponentApis[name];
              tagComponentApiComponents.splice(tagComponentApiComponents.indexOf(componentApiToRemove), 1);
              if (tagComponentApiComponents.length === 0) {
                delete tagComponentApis[name];
              }

              const tagComponentInstanceInstances = tagComponentInstances[name];
              const tagComponentInstanceIndex = tagComponentInstanceInstances.findIndex(componentElement => componentElement.componentApi === componentApiToRemove);
              tagComponentInstanceInstances.splice(tagComponentInstanceIndex, 1);
              if (tagComponentInstanceInstances.length === 0) {
                delete tagComponentInstances[name];
              }
            }

            getTagMeshes() {
              return tagMeshes;
            }

            getAttributeSpec(module, attributeName) {
              return _getAttributeSpec(module, attributeName);
            }

            getAttributeSpecs(module) {
              return _getAttributeSpecs(module);
            }

            makeTag(itemSpec, {initialUpdate = true} = {}) {
              const object = new THREE.Object3D();

              const item = new Item(
                itemSpec.type,
                itemSpec.id,
                itemSpec.name,
                itemSpec.displayName,
                itemSpec.module,
                itemSpec.description,
                itemSpec.version,
                itemSpec.versions,
                itemSpec.readme,
                itemSpec.tagName, // XXX get rid of these
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

              if (itemSpec.type === 'entity') {
                object.setAttribute = (attribute, value) => {
                  item.setAttribute(attribute, value);
                };
              }
              if (itemSpec.type === 'file') {
                object.open = () => {
                  const tagMesh = object;
                  const {item} = tagMesh;
                  item.open = true;

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
                  const {item} = tagMesh;
                  item.open = false;

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

                /* if (item.open) {
                  object.open();
                }
                if (item.value !== undefined) {
                  object.seek(item.value);
                }
                if (item.paused === false) {
                  object.play();
                } */
              }

              object.destroy = () => {
                const {item} = object;
                item.destroy();
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

            mutateAddEntity(tagMesh) {
              const {item} = tagMesh;
              const {tagName: entityTagName, module: entityModule, attributes: entityAttributes} = item;
              const entityElement = document.createElement(entityTagName);

              entityElement.setAttribute('module', entityModule);

              for (const attributeName in entityAttributes) {
                const attribute = entityAttributes[attributeName];
                const {value: attributeValue} = attribute;
                const attributeValueString = _stringifyAttribute(attributeValue);
                entityElement.setAttribute(attributeName, attributeValueString);
              }

              entityElement.item = item;
              item.instance = entityElement;

              rootEntitiesElement.appendChild(entityElement);

              return entityElement;
            }

            mutateRemoveEntity(tagMesh) {
              const {item} = tagMesh;
              const {instance: entityElement} = item;

              entityElement.item = null;
              item.instance = null;

              if (entityElement.parentNode) {
                entityElement.parentNode.removeChild(entityElement);
              }

              return entityElement;
            }

            getTagComponentApis(tag) {
              return tagComponentApis[tag];
            }

            loadTags(itemSpecs) {
              this.emit('loadTags', {
                itemSpecs,
              });
            }

            getWorldElement() {
              return rootWorldElement;
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

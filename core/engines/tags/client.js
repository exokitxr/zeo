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
import tagsRender from './lib/render/tags';
import menuUtils from './lib/utils/menu';
import OBJLoader from './lib/three-extra/OBJLoader';

const SIDES = ['left', 'right'];

const tagFlagSymbol = Symbol();
const itemInstanceSymbol = Symbol();
const itemInstancingSymbol = Symbol();
const itemOpenSymbol = Symbol();
const itemPausedSymbol = Symbol();
const itemValueSymbol = Symbol();
const itemPreviewSymbol = Symbol();
const itemMutexSymbol = Symbol();
const MODULE_TAG_NAME = 'z-module'.toUpperCase();
const ENTITY_TAG_NAME = 'z-entity'.toUpperCase();
const ITEM_LOCK_KEY = 'key';

class Tags {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {hub: {enabled: hubEnabled}}} = archae;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/three',
      '/core/engines/input',
      '/core/engines/webvr',
      '/core/engines/cyborg',
      '/core/engines/biolumi',
      '/core/engines/somnifer',
      '/core/engines/rend',
      '/core/plugins/js-utils',
      '/core/plugins/image-utils',
      '/core/plugins/creature-utils',
    ])
      .then(([
        three,
        input,
        webvr,
        cyborg,
        biolumi,
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
          const {sound} = somnifer;

          const tagsRenderer = tagsRender.makeRenderer({creatureUtils});

          const THREEOBJLoader = OBJLoader(THREE);

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
          const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x808080,
            linewidth: 1,
          });

          const subcontentFontSpec = {
            fonts: biolumi.getFonts(),
            fontSize: 24,
            lineHeight: 1.4,
            fontWeight: biolumi.getFontWeight(),
            fontStyle: biolumi.getFontStyle(),
          };

          const rootModulesElement = document.createElement('div');
          rootModulesElement.id = 'zeo-modules';
          document.body.appendChild(rootModulesElement);
          const rootModulesObserver = new MutationObserver(mutations => {
            for (let i = 0; i < mutations.length; i++) {
              const mutation = mutations[i];
              const {type} = mutation;

              if (type === 'childList') {
                const {addedNodes} = mutation;

                for (let j = 0; j < addedNodes.length; j++) {
                  const addedNode = addedNodes[j];

                  if (addedNode.tagName === MODULE_TAG_NAME) {
                    const moduleElement = addedNode;
                    const name = moduleElement.getAttribute('name');
                    
                    if (name) { // adding
                      // XXX
                    }
                  }
                }

                const {removedNodes} = mutation;
                for (let j = 0; j < removedNodes.length; j++) {
                  const removedNode = removedNodes[j];

                  if (removedNode.tagName === MODULE_TAG_NAME) {
                    const moduleElement = removedNode;
                    const name = moduleElement.getAttribute('name');
                    
                    if (name) { // removing
                      // XXX
                    }
                  }
                }
              } else if (type === 'attributes') {
                const {target} = mutation;

                if (target.tagName === ENTITY_TAG_NAME) {
                  const moduleElement = target;
                  const {attributeName} = mutation;

                  if (attributeName === 'name') {
                    const {oldValue: oldValueString} = mutation;
                    const newValueString = moduleElement.getAttribute('name');

                    if (!oldValueString && newValueString) { // adding
                      // XXX
                    } else if (oldValueString && !newValueString) { // removing
                      // XXX
                    } else if (oldValueString && newValueString) { // changing
                      // XXX
                    }
                  }
                }
              }
            }
          });
          rootModulesObserver.observe(rootModulesElement, {
            childList: true,
            attributes: true,
            subtree: true,
            attributeOldValue: true,
          });

          const rootComponentsElement = document.createElement('div');
          rootComponentsElement.id = 'zeo-components';
          // document.body.appendChild(rootComponentsElement);
          const rootComponentsObserver = new MutationObserver(mutations => {
            for (let i = 0; i < mutations.length; i++) {
              const mutation = mutations[i];
              const {type} = mutation;

              if (type === 'childList') {
                const {addedNodes} = mutation;

                for (let j = 0; j < addedNodes.length; j++) {
                  const addedNode = addedNodes[j];
                  const componentElement = addedNode;
                  const {componentApi} = componentElement;
                  const {attributes: componentAttributes = {}} = componentApi;
                  const boundEntitySpecs = _getBoundEntitySpecs(componentAttributes);

                  for (let l = 0; l < boundEntitySpecs.length; l++) {
                    const boundEntitySpec = boundEntitySpecs[l];
                    const {tagMesh, matchingAttributes} = boundEntitySpec;
                    const {item: entityItem} = tagMesh;
                    const {instance: entityElement} = entityItem;

                    componentElement.entityAddedCallback(entityElement);

                    for (let m = 0; m < matchingAttributes.length; m++) {
                      const matchingAttribute = matchingAttributes[m];
                      const {attributes: entityAttributes} = entityItem;
                      const attributeValue = entityAttributes[matchingAttribute];

                      componentElement.entityAttributeValueChangedCallback(entityElement, matchingAttribute, null, attributeValue);
                    }
                  }
                }

                const {removedNodes} = mutation;
                for (let k = 0; k < removedNodes.length; k++) {
                  const removedNode = removedNodes[k];
                  const componentElement = removedNode;
                  const {componentApi} = componentElement;
                  const {attributes: componentAttributes = {}} = componentApi;
                  const boundEntitySpecs = _getBoundEntitySpecs(componentAttributes);

                  for (let m = 0; m < boundEntitySpecs.length; m++) {
                    const boundEntitySpec = boundEntitySpecs[m];
                    const {tagMesh, matchingAttributes} = boundEntitySpec;
                    const {item: entityItem} = tagMesh;
                    const {instance: entityElement} = entityItem;

                    componentElement.entityRemovedCallback(entityElement);
                  }
                }
              // } else if (type === 'attributes') {
              }
            }
          });
          rootComponentsObserver.observe(rootComponentsElement, {
            childList: true,
            // attributes: true,
            subtree: true,
            // attributeOldValue: true,
          });

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

          const rootEntitiesElement = document.createElement('div');
          rootEntitiesElement.id = 'zeo-entities';
          document.body.appendChild(rootEntitiesElement);
          const rootEntitiesObserver = new MutationObserver(mutations => {
            for (let i = 0; i < mutations.length; i++) {
              const mutation = mutations[i];
              const {type} = mutation;

              if (type === 'childList') {
                const {addedNodes} = mutation;
                for (let j = 0; j < addedNodes.length; j++) {
                  const addedNode = addedNodes[j];

                  if (addedNode.tagName === ENTITY_TAG_NAME) {
                    const entityElement = addedNode;
                    const {item: initialEntityItem} = entityElement;
                    const entityAttributes = _getElementJsonAttributes(entityElement);
                    if (!initialEntityItem) { // element added manually
                      tagsApi.emit('mutateAddEntity', {
                        element: entityElement,
                        attributes: entityAttributes,
                      });
                    }

                    const boundComponentSpecs = _getBoundComponentSpecs(entityAttributes);
                    for (let k = 0; k < boundComponentSpecs.length; k++) {
                      const boundComponentSpec = boundComponentSpecs[k];
                      const {componentElement, matchingAttributes} = boundComponentSpec;

                      componentElement.entityAddedCallback(entityElement);

                      for (let l = 0; l < matchingAttributes.length; l++) {
                        const matchingAttribute = matchingAttributes[l];
                        const attribute = entityAttributes[matchingAttribute];
                        const {value: attributeValue} = attribute;
                        componentElement.entityAttributeValueChangedCallback(entityElement, matchingAttribute, null, attributeValue);
                      }
                    }
                  }
                }

                const {removedNodes} = mutation;
                for (let k = 0; k < removedNodes.length; k++) {
                  const removedNode = removedNodes[k];

                  if (removedNode.tagName === ENTITY_TAG_NAME) {
                    const entityElement = removedNode;
                    const {item: initialEntityItem} = entityElement;
                    if (initialEntityItem) { // element removed manually
                      const {id: entityId} = initialEntityItem;
                      tagsApi.emit('mutateRemoveEntity', {
                        id: entityId,
                      });
                    }

                    const entityAttributes = _getElementJsonAttributes(entityElement);
                    const boundComponentSpecs = _getBoundComponentSpecs(entityAttributes);
                    for (let l = 0; l < boundComponentSpecs.length; l++) {
                      const boundComponentSpec = boundComponentSpecs[l];
                      const {componentElement} = boundComponentSpec;

                      componentElement.entityRemovedCallback(entityElement);
                    }
                  }
                }
              } else if (type === 'attributes') {
                const {target} = mutation;

                if (target.tagName === ENTITY_TAG_NAME) {
                  const entityElement = target;
                  const {attributeName, oldValue: oldValueString} = mutation;
                  const newValueString = entityElement.getAttribute(attributeName);
                  const oldValue = _parseAttribute(oldValueString);
                  const newValue = _parseAttribute(newValueString);

                  const {item: entityItem} = entityElement;
                  const {id: entityId} = entityItem;
                  tagsApi.emit('mutateSetAttribute', {
                    id: entityId,
                    name: attributeName,
                    value: newValue,
                  });

                  const attributeSpec = {
                    [attributeName]: newValue,
                  };
                  const boundComponentSpecs = _getBoundComponentSpecs(attributeSpec);
                  for (let i = 0; i < boundComponentSpecs.length; i++) {
                    const boundComponentSpec = boundComponentSpecs[i];
                    const {componentElement, matchingAttributes} = boundComponentSpec;
                    const appliedMatchingAttributes = matchingAttributes.filter(matchingAttributeName => {
                      if (matchingAttributeName === attributeName) {
                        return oldValueString !== null;
                      } else {
                        return entityElement.hasAttribute(matchingAttributeName);
                      }
                    });

                    for (let j = 0; j < matchingAttributes.length; j++) {
                      const attributeName = matchingAttributes[j];

                      if (newValue !== undefined) { // adding attribute
                        if (appliedMatchingAttributes.length === 0) { // if no matching attributes were previously applied, mount the component on the entity
                          componentElement.entityAddedCallback(entityElement);
                        }

                        componentElement.entityAttributeValueChangedCallback(entityElement, attributeName, oldValue, newValue);
                      } else { // removing attribute
                        if (appliedMatchingAttributes.length === 1) { // if this is the last attribute that applied, unmount the component from the entity
                          componentElement.entityRemovedCallback(entityElement);
                        } else {
                          componentElement.entityAttributeValueChangedCallback(entityElement, attributeName, oldValue, newValue);
                        }
                      }
                    }
                  }
                }
              }
            }
          });
          rootEntitiesObserver.observe(rootEntitiesElement, {
            childList: true,
            attributes: true,
            subtree: true,
            attributeOldValue: true,
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
            color: [1, 1, 1, 0],
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

          const _makeDragState = () => ({
            src: null,
            dst: null,
          });
          const dragStates = {
            left: _makeDragState(),
            right: _makeDragState(),
          };

          const _makeDragLine = () => {
            const geometry = new THREE.BufferGeometry();
            geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 2), 3));
            const material = lineMaterial;

            const line = new THREE.Line(geometry, material);
            line.visible = false;
            return line;
          };
          const dragLines = {
            left: _makeDragLine(),
            right: _makeDragLine(),
          };
          scene.add(dragLines.left);
          scene.add(dragLines.right);

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

          const boxMeshes = {
            left: biolumi.makeMenuBoxMesh(),
            right: biolumi.makeMenuBoxMesh(),
          };
          scene.add(boxMeshes.left);
          scene.add(boxMeshes.right);

          const positioningMesh = (() => {
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
            });

            const mesh = new THREE.LineSegments(geometry, material);
            mesh.visible = false;
            return mesh;
          })();
          scene.add(positioningMesh);

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

          const localUpdates = [];

          const _getItemPreviewMode = item => {
            const {mimeType} = item;

            if (mimeType && /^image\/(?:png|jpeg|gif|file)$/.test(mimeType)) {
              return 'image';
            } else if (/^audio\/(?:wav|mp3|mpeg|ogg|vorbis|webm|x-flac)$/.test(mimeType)) {
              return 'audio';
            } else if (/^video\/(?:mp4|webm|ogg)$/.test(mimeType)) {
              return 'video';
            } else if (/^mime\/(?:obj)$/.test(mimeType)) {
              return 'model';
            } else {
              return null;
            }
          };
          const _requestFileItemImageMesh = tagMesh => new Promise((accept, reject) => {
            const {item} = tagMesh;

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

              const img = new Image();
              img.src = '/archae/fs/' + item.id;
              img.onload = () => {
                const boxImg = imageUtils.boxizeImage(img);

                texture.image = boxImg;
                texture.needsUpdate = true;
              };
              img.onerror = err => {
                console.warn(err);
              };

              const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
                transparent: true,
                depthTest: false,
              });
              return material;
            })();

            const mesh = new THREE.Mesh(geometry, material);
            accept(mesh);
          });
          const _requestFileItemAudioMesh = tagMesh => new Promise((accept, reject) => {
            const {item} = tagMesh;

            const mesh = new THREE.Object3D();

            const audio = document.createElement('audio');
            audio.src = '/archae/fs/' + item.id;
            audio.oncanplay = () => {
              soundBody.setInputElement(audio);

              audio.currentTime = item.value * audio.duration;

              if (!item.paused) {
                audio.play();
              }

              localUpdates.push(localUpdate);

              audio.oncanplay = null;
            };
            audio.onerror = err => {
              console.warn(err);
            };
            mesh.audio = audio;

            const soundBody = new sound.Body();
            soundBody.setObject(mesh);

            const localUpdate = () => {
              const {value: prevValue} = item;
              const nextValue = audio.currentTime / audio.duration;
              if (Math.abs(nextValue - prevValue) >= (1 / 1000)) { // to reduce the frequency of texture updates
                item.value = nextValue;

                const {page} = tagMesh;
                page.update();
              }
            };

            mesh.destroy = () => {
              if (!audio.paused) {
                audio.pause();
              }

              const index = localUpdates.indexOf(localUpdate);
              if (index !== -1) {
                localUpdates.splice(index, 1);
              }
            };

            accept(mesh);
          });
          const _requestFileItemVideoMesh = tagMesh => new Promise((accept, reject) => {
            const {item} = tagMesh;

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

            const video = document.createElement('video');
            video.src = '/archae/fs/' + item.id;
            video.width = OPEN_WIDTH;
            video.height = (OPEN_HEIGHT - HEIGHT) - 100;
            video.oncanplay = () => {
              const {map: texture} = material;

              texture.image = video;
              texture.needsUpdate = true;

              soundBody.setInputElement(video);

              video.currentTime = item.value * video.duration;

              if (!item.paused) {
                video.play();
              }

              localUpdates.push(localUpdate);

              video.oncanplay = null;
            };
            video.onerror = err => {
              console.warn(err);
            };

            const soundBody = new sound.Body();
            soundBody.setObject(mesh);

            const localUpdate = () => {
              const {map: texture} = material;
              const {image: video} = texture;

              const {value: prevValue} = item;
              const nextValue = video.currentTime / video.duration;
              if (Math.abs(nextValue - prevValue) >= (1 / 1000)) { // to reduce the frequency of texture updates
                item.value = nextValue;

                const {planeOpenMesh: {page: openPage}} = tagMesh;
                openPage.update();
              }

              texture.needsUpdate = true;
            };

            mesh.destroy = () => {
              if (!video.paused) {
                video.pause();
              }

              const index = localUpdates.indexOf(localUpdate);
              if (index !== -1) {
                localUpdates.splice(index, 1);
              }
            };

            accept(mesh);
          });
          const _requestFileItemModelMesh = tagMesh => fetch('/archae/fs/' + tagMesh.item.id)
            .then(res => res.text()
              .then(modelText => new Promise((accept, reject) => {
                const loader = new THREEOBJLoader();

                // XXX this texture path needs to actually be fetchable from /archae/fs/ by path, since that's what the model will be referencing
                loader.setPath('/archae/fs/');
                const modelMesh = loader.parse(modelText);
                accept(modelMesh);
              }))
            );

          const _trigger = e => {
            const {side} = e;

            const _doClickOpen = () => {
              const hoverState = hoverStates[side];
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
                  const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);

                  const {planeMesh, planeOpenMesh, item} = tagMesh;
                  item.open = true;
                  planeMesh.visible = false;
                  planeOpenMesh.visible = true;

                  if (item.type === 'file') {
                    if (!item.preview) {
                      const previewMesh = (() => {
                        const object = new THREE.Object3D();

                        const mode = _getItemPreviewMode(item);
                        if (mode === 'image') {
                          _requestFileItemImageMesh(tagMesh)
                            .then(imageMesh => {
                              imageMesh.position.y = -(WORLD_HEIGHT / 2) - ((WORLD_OPEN_HEIGHT - WORLD_HEIGHT) / 2);

                              object.add(imageMesh);
                            })
                            .catch(err => {
                              console.warn(err);
                            });
                        } else if (mode === 'audio') {
                          _requestFileItemAudioMesh(tagMesh)
                            .then(audioMesh => {
                              object.add(audioMesh);
                            })
                            .catch(err => {
                              console.warn(err);
                            });
                        } else if (mode === 'video') {
                          _requestFileItemVideoMesh(tagMesh)
                            .then(videoMesh => {
                              videoMesh.position.y = -(WORLD_HEIGHT / 2) - ((WORLD_OPEN_HEIGHT - WORLD_HEIGHT) / 2) + ((100 / OPEN_HEIGHT * WORLD_OPEN_HEIGHT) / 2);

                              object.add(videoMesh);
                            })
                            .catch(err => {
                              console.warn(err);
                            });
                        } else if (mode === 'model') {
                          _requestFileItemModelMesh(tagMesh)
                            .then(modelMesh => {
                              const boundingBox = new THREE.Box3().setFromObject(modelMesh);
                              const boundingBoxSize = boundingBox.getSize();
                              const meshCurrentScale = Math.max(boundingBoxSize.x, boundingBoxSize.y, boundingBoxSize.z);
                              const meshScaleFactor = (1 / meshCurrentScale) * 0.1125;
                              modelMesh.position.y = -(WORLD_HEIGHT / 2) - ((WORLD_OPEN_HEIGHT - WORLD_HEIGHT) / 2);
                              // XXX offset the model to center it based on its bounding box
                              modelMesh.scale.set(meshScaleFactor, meshScaleFactor, meshScaleFactor);

                              object.add(modelMesh);
                            })
                            .catch(err => {
                              console.warn(err);
                            });
                        }

                        return object;
                      })();
                      tagMesh.add(previewMesh);
                      item.preview = previewMesh;
                    } else {
                      item.preview.visible = true;
                    }
                  }

                  e.stopImmediatePropagation();

                  return true;
                } else if (match = onclick.match(/^tag:close:(.+)$/)) {
                  const id = match[1];
                  const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);

                  const {planeMesh, planeOpenMesh, item} = tagMesh;
                  item.open = false;
                  planeMesh.visible = true;
                  planeOpenMesh.visible = false;

                  if (item.type === 'file') {
                    if (item.preview && item.preview.visible) {
                      item.preview.visible = false;
                    }
                  }

                  e.stopImmediatePropagation();

                  return true;
                } else if (match = onclick.match(/^tag:download:(.+)$/)) {
                  const id = match[1];
                  const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);
                  const {item} = tagMesh;
                  const {name} = item;

                  tagsApi.emit('download', {
                    id,
                    name,
                  });

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
                } else if (match = onclick.match(/^media:(play|pause):(.+)$/)) {
                  const action = match[1];
                  const id = match[2];
                  const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);
                  const {item, planeOpenMesh: {page: openPage}} = tagMesh;

                  if (action === 'play') {
                    item.play();
                  } else if (action === 'pause') {
                    item.pause();
                  }

                  openPage.update();

                  return true;
                } else if (match = onclick.match(/^media:seek:(.+)$/)) {
                  const id = match[1];
                  const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);
                  const {item, planeOpenMesh: {page: openPage}} = tagMesh;

                  const {value} = hoverState;
                  item.seek(value);

                  openPage.update();

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

                const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === positioningId);
                const {planeOpenMesh: {page: openPage}} = tagMesh;
                openPage.update();

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
                  const {value: attributeValue} = attribute;

                  const _updateAttributes = () => {
                    const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === tagId);
                    const {attributesMesh} = tagMesh;
                    attributesMesh.update();
                  };

                  if (action === 'position') {
                    detailsState.positioningId = tagId;
                    detailsState.positioningName = attributeName;
                    detailsState.positioningSide = side;

                    focusState.type = '';
                  } else if (action === 'focus') {
                    const {value: hoverValue} = hoverState;
                    const {type} = _getAttributeSpec(attributeName);

                    const textProperties = (() => {
                      if (type === 'text') {
                        const hoverValuePx = hoverValue * 400; // XXX update these
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
                    if (textProperties) {
                      detailsState.inputText = menuUtils.castValueValueToString(attributeValue, type);
                      const {index, px} = textProperties;
                      detailsState.inputIndex = index;
                      detailsState.inputValue = px;
                    }

                    focusState.type = 'attribute:' + tagId + ':' + attributeName;

                    _updateAttributes();
                  } else if (action === 'set') {
                    focusState.type = '';

                    tagsApi.emit('setAttribute', {
                      id: tagId,
                      name: attributeName,
                      value: value,
                    });

                    // _updateAttributes();
                  } else if (action === 'tweak') {
                    const newValue = (() => {
                      const {value} = hoverState;
                      const {min, max, step} = _getAttributeSpec(attributeName);

                      let n = min + (value * (max - min));
                      if (step > 0) {
                        n = Math.round(n / step) * step;
                      }
                      return n;
                    })();

                    focusState.type = '';

                    tagsApi.emit('setAttribute', {
                      id: tagId,
                      name: attributeName,
                      value: newValue,
                    });

                    // _updateAttributes();
                  } else if (action === 'toggle') {
                    const newValue = !attributeValue;

                    tagsApi.emit('setAttribute', {
                      id: tagId,
                      name: attributeName,
                      value: newValue,
                    });

                    _updateAttributes();
                  } else if (action === 'choose') {
                    /* elementsState.choosingName = attributeName;

                    _ensureFilesLoaded(elementAttributeFilesState);

                    // XXX needs to be rewritten to handle the new tags model
                    menuUi.addPage(({elementAttributeFiles: {cwd, files, inputText, inputValue, selectedName, clipboardPath, loading, uploading}, focus: {type: focusType}}) => ([
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
                        frameTime: FRAME_TIME,
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

                  /* const {planeOpenMesh: {page: openPage}} = tagMesh;
                  openPage.update(); */

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
          const _triggerdown = e => {
            const {side} = e;

            const _doClickTag = () => {
              const hoverState = hoverStates[side];
              const {intersectionPoint} = hoverState;

              if (intersectionPoint) {
                const {anchor} = hoverState;
                const onclick = (anchor && anchor.onclick) || '';

                let match;
                if (match = onclick.match(/^module:link:(.+)$/)) {
                  const id = match[1];
                  const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);

                  const dragState = dragStates[side];
                  dragState.src = {
                    type: 'module',
                    tagMesh: tagMesh,
                  };

                  return true;
                } else if (match = onclick.match(/^attribute:(.+?):(.+?):link$/)) {
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
                const {type} = src;

                if (type === 'module') {
                  const {tagMesh: srcTagMesh} = src;
                  const {tagMesh: dstTagMesh} = dst;

                  if (srcTagMesh === dstTagMesh) {
                    tagsApi.emit('linkModule', {
                      side,
                      srcTagMesh,
                      dstTagMesh: null,
                    });

                    dragState.src = null;
                    dragState.dst = null;

                    return true;
                  } else {
                    tagsApi.emit('linkModule', {
                      side,
                      srcTagMesh,
                      dstTagMesh,
                    });

                    dragState.src = null;
                    dragState.dst = null;

                    return true;
                  }
                } else if (type === 'attribute') {
                  const {tagMesh: srcTagMesh, attributeName} = src;
                  const {tagMesh: dstTagMesh} = dst;

                  tagsApi.emit('linkAttribute', {
                    side,
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

          const _keydown = e => {
            const {type} = focusState;

            let match;
            if (match = focusState.type.match(/^attribute:(.+?):(.+?)$/)) {
              const tagId = match[1];
              const attributeName = match[2];

              const applySpec = biolumi.applyStateKeyEvent(detailsState, subcontentFontSpec, e);
              if (applySpec) {
                const {commit} = applySpec;
                if (commit) {
                  focusState.type = '';
                }

                const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === tagId);
                const {inputText} = detailsState;
                tagMesh.setAttribute(attributeName, inputText);

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
            const _updateControllers = () => {
              const _updateElementAnchors = () => {
                if (rend.isOpen() || hubEnabled) {
                  const {gamepads} = webvr.getStatus();
                  const controllers = cyborg.getControllers();
                  const controllerMeshes = SIDES.map(side => controllers[side].mesh);

                  SIDES.forEach(side => {
                    const gamepad = gamepads[side];

                    if (gamepad) {
                      const {position: controllerPosition, rotation: controllerRotation} = gamepad;
                      const hoverState = hoverStates[side];
                      const dotMesh = dotMeshes[side];
                      const boxMesh = boxMeshes[side];

                      const objects = (() => {
                        const result = [];

                        for (let i = 0; i < tagMeshes.length; i++) {
                          const tagMesh = tagMeshes[i];

                          if (
                            (tagMesh.parent === scene) ||
                            controllerMeshes.some(controllerMesh => tagMesh.parent === controllerMesh)
                          ) {
                            const {item} = tagMesh;
                            const {type, open} = item;

                            if (!open) {
                              const {planeMesh} = tagMesh;
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
                            } else {
                              const {planeOpenMesh} = tagMesh;
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
                          }
                        }

                        return result;
                      })();
                      biolumi.updateAnchors({
                        objects: objects,
                        hoverState: hoverState,
                        dotMesh: dotMesh,
                        boxMesh: boxMesh,
                        controllerPosition,
                        controllerRotation,
                      });
                    }
                  });
                }
              }
              const _updateDragStates = () => {
                if (rend.isOpen() || hubEnabled) {
                  SIDES.forEach(side => {
                    const dragState = dragStates[side];
                    const {src} = dragState;

                    if (src) {
                      const hoverState = hoverStates[side];
                      const {intersectionPoint} = hoverState;

                      if (intersectionPoint) {
                        const {type: srcType, tagMesh: srcTagMesh} = src;
                        const {metadata} = hoverState;
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
                if (rend.isOpen() || hubEnabled) {
                  const {gamepads} = webvr.getStatus();
                  const controllers = cyborg.getControllers();
                  const controllerMeshes = SIDES.map(side => controllers[side].mesh);

                  SIDES.forEach(side => {
                    const gamepad = gamepads[side];
                    const dragState = dragStates[side];
                    const {src} = dragState;
                    const dragLine = dragLines[side];

                    if (gamepad && src) {
                      const {geometry} = dragLine;
                      const positionsAttribute = geometry.getAttribute('position');
                      const {array: positions} = positionsAttribute;

                      const {tagMesh: srcTagMesh} = src;
                      const {position: srcPosition} = srcTagMesh;

                      const dstPosition = (() => {
                        const {dst} = dragState;

                        const _getControllerPosition = () => gamepad.position;

                        if (dst) {
                          const {tagMesh: dstTagMesh} = dst;

                          if (dstTagMesh !== srcTagMesh) {
                            return _decomposeObjectMatrixWorld(dstTagMesh).position;
                          } else {
                            return _getControllerPosition();
                          }
                        } else {
                          return _getControllerPosition();
                        }
                      })();

                      positions.set(Float32Array.from([
                        srcPosition.x, srcPosition.y, srcPosition.z,
                        dstPosition.x, dstPosition.y, dstPosition.z,
                      ]));

                      positionsAttribute.needsUpdate = true;

                      if (!dragLine.visible) {
                        dragLine.visible = true;
                      }
                    } else {
                      if (dragLine.visible) {
                        dragLine.visible = false;
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
              scene.remove(dragLines[side]);

              scene.remove(grabBoxMeshes[side]);

              scene.remove(positioningMesh);
              scene.remove(oldPositioningMesh);
            });

            input.removeListener('trigger', _trigger);
            input.removeListener('triggerdown', _triggerdown);
            input.removeListener('triggerup', _triggerup);
            input.removeListener('keydown', _keydown);
            input.removeListener('keyboarddown', _keyboarddown);

            rend.removeListener('update', _update);
          };

          class Item {
            constructor(
              type,
              id,
              name,
              displayName,
              description,
              version,
              attributes,
              mimeType,
              matrix,
              metadata
            ) {
              this.type = type;
              this.id = id;
              this.name = name;
              this.displayName = displayName;
              this.description = description;
              this.version = version;
              this.attributes = attributes;
              /* this.attributes = (() => {
                const result = {};

                for (const k in attributes) {
                  const attribute = attributes[k];

                  const v = (() => {
                    const {type} = attribute;
                    
                    switch (type) {
                      case 'matrix':
                        return {
                          type: 'matrix',
                          value: attribute.value,
                        };
                      case 'text':
                        return {
                          type: 'text',
                          value: attribute.value,
                        };
                      case 'color':
                        return {
                          type: 'color',
                          value: attribute.value,
                        };
                      case 'select':
                        return {
                          type: 'select',
                          value: attribute.value,
                          options: Array.isArray(attribute.options) ? attribute.options : [],
                        };
                      case 'number':
                        return {
                          type: 'number',
                          value: attribute.value,
                          min: typeof attribute.min === 'number' ? attribute.min : 1,
                          max: typeof attribute.max === 'number' ? attribute.max : 10,
                          step: typeof attribute.step === 'number' ? attribute.step : 1,
                        };
                      case 'checkbox':
                        return {
                          type: 'checkbox',
                          value: attribute.value,
                        };
                      case 'file':
                        return {
                          type: 'file',
                          value: attribute.value,
                        };
                      default:
                        return null;
                    }
                  })();
                  if (v !== null) {
                    result[k] = v;
                  }
                }

                return result;
              })(); */
              this.mimeType = mimeType;
              this.matrix = matrix;
              this.metadata = metadata;

              this[itemInstanceSymbol] = null;
              this[itemInstancingSymbol] = false;
              this[itemOpenSymbol] = false;
              this[itemPausedSymbol] = true;
              this[itemValueSymbol] = 0;
              this[itemPreviewSymbol] = false;

              this[itemMutexSymbol] = new MultiMutex();
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
            get open() {
              return this[itemOpenSymbol];
            }
            set open(open) {
              this[itemOpenSymbol] = open;
            }
            get paused() {
              return this[itemPausedSymbol];
            }
            set paused(paused) {
              this[itemPausedSymbol] = paused;
            }
            get value() {
              return this[itemValueSymbol];
            }
            set value(value) {
              this[itemValueSymbol] = value;
            }
            get preview() {
              return this[itemPreviewSymbol];
            }
            set preview(preview) {
              this[itemPreviewSymbol] = preview;
            }

            setAttribute(attributeName, newValue) {
              const {attributes} = this;
              if (newValue !== undefined) {
                attributes[attributeName] = {
                  value: newValue,
                };
              } else {
                delete attributes[attributeName];
              }

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

            lock() {
              return this[itemMutexSymbol].lock(ITEM_LOCK_KEY);
            }

            play() {
              this.paused = false;

              const {preview} = this;
              if (preview) {
                const mode = _getItemPreviewMode(this);

                if (mode === 'audio') {
                  const {
                    children: [
                      {
                        audio,
                      },
                    ],
                  } = preview;
                  audio.play();
                } else if (mode === 'video') {
                  const {
                    children: [
                      {
                        material: {
                          map: {
                            image: video,
                          },
                        },
                      },
                    ],
                  } = preview;
                  video.play();
                }
              }
            }

            pause() {
              this.paused = true;

              const {preview} = this;
              if (preview) {
                const mode = _getItemPreviewMode(this);

                if (mode === 'audio') {
                  const {
                    children: [
                      {
                        audio,
                      },
                    ],
                  } = preview;
                  audio.pause();
                } else if (mode === 'video') {
                  const {
                    children: [
                      {
                        material: {
                          map: {
                            image: video,
                          },
                        },
                      },
                    ],
                  } = preview;
                  video.pause();
                }
              }
            }

            seek(value) {
              this.value = value;

              const {preview} = this;
              if (preview) {
                const mode = _getItemPreviewMode(this);

                if (mode === 'audio') {
                  const {
                    children: [
                      {
                        audio,
                      },
                    ],
                  } = preview;
                  audio.currentTime = value * audio.duration;
                } else if (mode === 'video') {
                  const {
                    children: [
                      {
                        material: {
                          map: {
                            image: video,
                          },
                        },
                      },
                    ],
                  } = preview;
                  video.currentTime = value * video.duration;
                }
              }
            }

            destroy() {
              const {preview} = this;

              if (preview && preview.destroy) {
                preview.destroy();
              }
            }
          }

          const tagMeshes = [];
          rend.registerAuxObject('tagMeshes', tagMeshes);

          let componentApis = [];
          let componentApiInstances = [];
          const tagComponentApis = {};
          // const elementApis = {};

          const _getBoundComponentSpecs = entityAttributes => {
            const result = [];

            for (let i = 0; i < componentApis.length; i++) {
              const componentApi = componentApis[i];
              const componentApiInstance = componentApiInstances[i];
              const {attributes: componentAttributes = {}} = componentApi;

              const componentElement = componentApiInstance;
              const matchingAttributes = Object.keys(componentAttributes).filter(attributeName => (attributeName in entityAttributes));
              if (matchingAttributes.length > 0) {
                const matchingAttributeSpecs = (() => {
                  const result = {};

                  for (let j = 0; j < matchingAttributes.length; j++) {
                    const matchingAttribute = matchingAttributes[j];
                    const attributeSpec = componentAttributes[matchingAttribute];
                    result[matchingAttribute] = attributeSpec;
                  }

                  return result;
                })();
                const index = i;

                result.push({
                  componentElement,
                  matchingAttributes,
                  matchingAttributeSpecs,
                  index,
                });
              }
            }

            return result;
          };
          const _getBoundEntitySpecs = componentAttributes => {
            const result = [];

            for (let i = 0; i < tagMeshes.length; i++) {
              const tagMesh = tagMeshes[i];
              const {item} = tagMesh;
              const {type} = item;

              if (type === 'entity' && !(item.metadata && item.metadata.isStatic)) {
                const {attributes: entityAttributes} = item;

                const matchingAttributes = Object.keys(entityAttributes).filter(attributeName => (attributeName in componentAttributes));
                if (matchingAttributes.length > 0) {
                  result.push({
                    tagMesh,
                    matchingAttributes,
                  });
                }
              }
            }

            return result;
          };
          const _getAttributeSpec = attributeName => {
            const boundComponentSpecs = _getBoundComponentSpecs({
              [attributeName]: true,
            });
            if (boundComponentSpecs.length > 0) {
              const boundComponentSpec = boundComponentSpecs.sort((a, b) => a.index - b.index)[0];
              const {matchingAttributeSpecs} = boundComponentSpec;
              const matchingAttributeSpec = matchingAttributeSpecs[attributeName];
              return matchingAttributeSpec;
            } else {
              return null;
            }
          };

          class TagsApi extends EventEmitter {
            constructor() {
              super();

              this.listen();
            }

            registerComponent(pluginInstance, componentApi) {
              const name = archae.getName(pluginInstance);
              let tagComponentApiComponents = tagComponentApis[name];
              if (!tagComponentApiComponents) {
                tagComponentApiComponents = [];
                tagComponentApis[name] = tagComponentApiComponents;
              }
              tagComponentApiComponents.push(componentApi);

              const baseObject = componentApi;
              const componentElement = menuUtils.makeZeoComponentElement({
                baseObject,
              });
              componentElement.componentApi = componentApi;
              rootComponentsElement.appendChild(componentElement);

              componentApis.push(componentApi);
              componentApiInstances.push(componentElement);

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
              const name = archae.getName(pluginInstance);
              const tagComponentApiComponents = tagComponentApis[name];
              tagComponentApiComponents.splice(tagComponentApiComponents.indexOf(componentApiToRemove), 1);
              if (tagComponentApiComponents.length === 0) {
                tagComponentApis[name] = null;
              }

              const removeComponentApisIndex = {};
              for (let i = 0; i < componentApis.length; i++) {
                const componentApi = componentApis[i];

                if (componentApi === componentApiToRemove) {
                  removeComponentApisIndex[i] = true;
                }
              }

              componentApis = componentApis.filter((componentApi, index) => !removeComponentApisIndex[index]);
              componentApiInstances = componentApiInstances.filter((componentApiInstance, index) => {
                if (removeComponentApisIndex[index]) {
                  rootComponentsElement.removeChild(componentApiInstance);

                  return false;
                } else {
                  return true;
                }
              });
            }

            /* registerElement(pluginInstance, elementApi) {
              const tag = archae.getName(pluginInstance);

              elementApis[tag] = elementApi;
            }

            unregisterElement(pluginInstance) {
              const tag = archae.getName(pluginInstance);

              delete elementApis[tag];
            } */

            makeTag(itemSpec) {
              const object = new THREE.Object3D();
              object[tagFlagSymbol] = true;

              const item = new Item(
                itemSpec.type,
                itemSpec.id,
                itemSpec.name,
                itemSpec.displayName,
                itemSpec.description,
                itemSpec.version,
                itemSpec.attributes, // XXX get rid of this and source directly from the element
                itemSpec.mimeType,
                itemSpec.matrix,
                itemSpec.metadata
              );
              object.item = item;

              object.position.set(item.matrix[0], item.matrix[1], item.matrix[2]);
              object.quaternion.set(item.matrix[3], item.matrix[4], item.matrix[5], item.matrix[6]);
              object.scale.set(item.matrix[7], item.matrix[8], item.matrix[9]);

              const _addUiManagerPage = uiManager => {
                const {metadata: {open}} = uiManager;

                const mesh = uiManager.addPage(({
                  item,
                  details: {
                    inputText,
                    inputValue,
                    positioningId,
                    positioningName,
                  },
                  focus: {
                    type: focusType,
                  }
                }) => {
                  const {type} = item;
                  const focusAttributeSpec = (() => {
                    const match = focusType.match(/^attribute:(.+?):(.+?)$/);
                    return match && {
                      tagId: match[1],
                      attributeName: match[2],
                    };
                  })();
                  const mode = _getItemPreviewMode(item);
                  const src = (() => {
                    switch (type) {
                      case 'module':
                        return tagsRenderer.getModuleSrc({item, inputText, inputValue, positioningId, positioningName, focusAttributeSpec, open});
                      /* case 'element':
                        return tagsRenderer.getElementSrc({item, inputText, inputValue, positioningId, positioningName, focusAttributeSpec, open}); */
                      case 'entity':
                        return tagsRenderer.getEntitySrc({item});
                      case 'file':
                        return tagsRenderer.getFileSrc({item, mode, open});
                      default:
                        return null;
                    }
                  })();

                  return {
                    type: 'html',
                    src: src,
                    w: !open ? WIDTH : OPEN_WIDTH,
                    h: !open ? HEIGHT : OPEN_HEIGHT,
                  };
                }, {
                  type: 'tag',
                  state: {
                    item: item,
                    details: detailsState,
                    focus: focusState,
                  },
                  worldWidth: !open ? WORLD_WIDTH : WORLD_OPEN_WIDTH,
                  worldHeight: !open ? WORLD_HEIGHT : WORLD_OPEN_HEIGHT,
                });
                mesh.receiveShadow = true;

                return mesh;
              };

              const isStatic = Boolean(itemSpec.metadata && itemSpec.metadata.isStatic);
              if (!isStatic) { 
                const planeMesh = _addUiManagerPage(uiManager);
                object.add(planeMesh);
                object.planeMesh = planeMesh;

                const planeOpenMesh = _addUiManagerPage(uiOpenManager);
                planeOpenMesh.position.x = (WORLD_OPEN_WIDTH - WORLD_WIDTH) / 2;
                planeOpenMesh.position.y = -(WORLD_OPEN_HEIGHT - WORLD_HEIGHT) / 2;
                planeOpenMesh.visible = false;
                object.add(planeOpenMesh);
                object.planeOpenMesh = planeOpenMesh;
              } else {
                const planeMesh = _addUiManagerPage(uiStaticManager);
                object.add(planeMesh);
                object.planeMesh = planeMesh;
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
                            details: detailsState,
                          };
                          const newAttributeMesh = uiAttributeManager.addPage(({
                            attribute,
                            focus: {
                              type: focusType,
                            },
                            details: {
                              inputText,
                              inputValue,
                            },
                          }) => {
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

                          newAttributeMesh.attributeName = attributeName;
                          newAttributeMesh.lastStateJson = JSON.stringify(state);

                          attributesMesh.add(newAttributeMesh);

                          return newAttributeMesh;
                        }
                      })();
                      mesh.position.x = WORLD_WIDTH * (1 + 0.1);
                      mesh.position.y = (attributesArray.length * WORLD_HEIGHT / 2) - (0.5 * WORLD_HEIGHT) - (i * WORLD_HEIGHT);

                      return mesh;
                    });
                    attributesMesh.attributeMeshes = newAttributeMeshes;
                  };
                  attributesMesh.update = _update;
                  _update();

                  return attributesMesh;
                })();
                object.add(attributesMesh);
                object.attributesMesh = attributesMesh;

                const _setAttribute = (attribute, value) => {
                  item.setAttribute(attribute, value);

                  attributesMesh.update();

                  const {planeMesh: {page}} = object;
                  page.update();
                };
                object.setAttribute = _setAttribute;
              }

              tagMeshes.push(object);

              return object;
            }

            destroyTag(tagMesh) {
              const index = tagMeshes.indexOf(tagMesh);

              if (index !== -1) {
                const {item} = tagMesh;
                item.destroy();

                tagMeshes.splice(index, 1);
              }
            }

            reifyModule(tagMesh) {
              const {item} = tagMesh;
              const {instance, instancing} = item;

              if (!instance && !instancing) {
                const {name} = item;

                item.lock()
                  .then(unlock => {
                    archae.requestPlugin(name)
                      .then(pluginInstance => {
                        item.instance = {
                          name,
                        };
                        item.instancing = false;

                        tagComponentApis[name] = [];

                        const _updateInstanceUi = () => {
                          const {planeMesh: {page}, planeOpenMesh: {page: openPage}} = tagMesh;
                          page.update();
                          openPage.update();
                        };
                        _updateInstanceUi();

                        const _updateNpmUi = () => {
                          const tagMesh = tagMeshes.find(tagMesh =>
                            tagMesh.item.type === 'module' &&
                            tagMesh.item.name === item.name &&
                            tagMesh.item.metadata.isStatic
                          );
                          if (tagMesh) {
                            const {item} = tagMesh;
                            item.metadata.exists = true;

                            const {planeMesh: {page}} = tagMesh;
                            page.update();
                          }
                        };
                        _updateNpmUi();

                        unlock();
                      })
                      .catch(err => {
                        console.warn(err);

                        unlock();
                      });
                  });

                item.instancing = true;

                const {planeMesh: {page}, planeOpenMesh: {page: openPage}} = tagMesh;
                page.update();
                openPage.update();
              }
            }

            unreifyModule(tagMesh) {
              const {item} = tagMesh;

              item.lock()
                .then(unlock => {
                  const {instance} = item;
                  const {name} = instance;

                  return archae.releasePlugin(name)
                    .then(() => {
                      item.instance = null;

                      tagComponentApis[name] = null;

                      const _updateNpmUi = () => {
                        const tagMesh = tagMeshes.find(tagMesh =>
                          tagMesh.item.type === 'module' &&
                          tagMesh.item.name === item.name &&
                          tagMesh.item.metadata.isStatic
                        );
                        if (tagMesh) {
                          const {item} = tagMesh;
                          item.metadata.exists = false;

                          const {planeMesh: {page}} = tagMesh;
                          page.update();
                        }
                      };
                      _updateNpmUi();

                      unlock();
                    })
                    .catch(err => {
                      console.warn(err);

                      unlock();
                    });
                });
            }

            reifyEntity(tagMesh) {
              const {item} = tagMesh;
              const {instance} = item;

              if (!instance) {                
                const entityElement = menuUtils.makeZeoEntityElement();
                const {attributes: entityAttributes} = item;
                for (const attributeName in entityAttributes) {
                  const attribute = entityAttributes[attributeName];
                  const {value: attributeValue} = attribute;
                  const attributeValueString = _stringifyAttribute(attributeValue);
                  entityElement.setAttribute(attributeName, attributeValueString);
                }
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

            reifyTag(tagMesh) {
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
                        let elementApi = elementApis[tag];
                        if (!HTMLElement.isPrototypeOf(elementApi)) {
                          elementApi = HTMLElement;
                        }
                        const {id, attributes} = item;
                        const baseClass = elementApi;

                        const element = menuUtils.makeZeoEntityElement({
                          tag,
                          attributes,
                          baseClass,
                        });
                        element.onsetattribute = (name, value) => {
                          tagsApi.emit('setAttribute', {id, name, value});
                        };
                        item.instance = element;
                        rootEntitiesElement.appendChild(element);

                        item.instancing = false;
                        item.attributes = _shallowClone(attributes);

                        const {planeMesh: {page}, planeOpenMesh: {page: openPage}} = tagMesh;
                        page.update();
                        openPage.update();

                        unlock();
                      })
                      .catch(err => {
                        console.warn(err);

                        unlock();
                      });
                  });

                item.instancing = true;

                const {planeMesh: {page}, planeOpenMesh: {page: openPage}} = tagMesh;
                page.update();
                openPage.update();
              }
            }

            unreifyTag(tagMesh) {
              const {item} = tagMesh;

              item.lock()
                .then(unlock => {
                  const {instance} = item;

                  if (instance) {
                    if (typeof instance.destructor === 'function') {
                      instance.destructor();
                    }
                    item.instance = null;

                    rootEntitiesElement.removeChild(instance);
                  }

                  unlock();
                });
            }

            getRootComponentsmElement() {
              return rootComponentsElement;
            }

            getRootEntitiesElement() {
              return rootEntitiesElement;
            }

            getTagComponentApis(tag) {
              return tagComponentApis[tag];
            }

            getPointedTagMesh(side) {
              return hoverStates[side].metadata;
            }

            listen() {
              this.on('setAttribute', setAttrbuteSpec => {
                if (this.listeners('setAttribute').length === 1) { // if this is the only listener, we need to set the attribute on ourselves
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

module.exports = Tags;

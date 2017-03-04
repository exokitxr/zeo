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

  FRAME_TIME,
} from './lib/constants/tags';
import tagsRenderer from './lib/render/tags';
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
      '/core/engines/cyborg',
      '/core/engines/biolumi',
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

          const subcontentFontSpec = {
            fonts: biolumi.getFonts(),
            fontSize: 20,
            lineHeight: 1.4,
            fontWeight: biolumi.getFontWeight(),
            fontStyle: biolumi.getFontStyle(),
          };

          class UiManager {
            constructor({width, height}) {
              this.width = width;
              this.height = height;

              this.uis = [];
            }

            addPage(pageSpec, options) {
              const {width, height, uis} = this;

              let lastUi = uis.length > 0 ? uis[uis.length - 1] : null;
              if (!lastUi || !lastUi.hasFreePages()) {
                lastUi = biolumi.makeUi({
                  width: width,
                  height: height,
                  atlasSize: 4,
                  maxNumTextures: 3,
                  color: [1, 1, 1, 0],
                });
                uis.push(lastUi);
              }

              return lastUi.addPage(pageSpec, options);
            }

            update() {
              const {uis} = this;

              for (let i = 0; i < uis.length; i++) {
                const ui = uis[i];
                ui.update();
              }
            }
          }
          const uiManager = new UiManager({
            width: WIDTH,
            height: HEIGHT,
          });
          const uiOpenManager = new UiManager({
            width: OPEN_WIDTH,
            height: OPEN_HEIGHT,
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

          const localUpdates = [];

          const _updatePages = () => {
            uiManager.update();
            uiOpenManager.update();
          };

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

              const video = document.createElement('video');
              video.src = '/archae/fs/' + item.id;
              video.width = OPEN_WIDTH;
              video.height = (OPEN_HEIGHT - HEIGHT) - 100;
              video.oncanplay = () => {
                texture.image = video;
                texture.needsUpdate = true;

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

              const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
                transparent: true,
                depthTest: false,
              });
              return material;
            })();

            const localUpdate = () => {
              const {map: texture} = material;
              const {image: video} = texture;

              const {value: prevValue} = item;
              const nextValue = video.currentTime / video.duration;
              if (Math.abs(nextValue - prevValue) >= (1 / 1000)) {
                item.value = nextValue;

                _updatePages();
              }

              texture.needsUpdate = true;
            };

            const mesh = new THREE.Mesh(geometry, material);
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
          const _requestFileItemModelMesh = item => fetch('/archae/fs/' + item.id)
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
                if (match = onclick.match(/^tag:open:(.+)$/)) {
                  const id = match[1];
                  const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);

                  const {planeMesh, planeOpenMesh, item} = tagMesh;
                  item.open = true;
                  planeMesh.visible = false;
                  planeOpenMesh.visible = true;
                  _updatePages();

                  if (item.type === 'file') {
                    if (!item.preview) {
                      const previewMesh = (() => {
                        const object = new THREE.Object3D();

                        const mode = _getItemPreviewMode(item);
                        if (mode === 'image') {
                          _requestFileItemImageMesh(item)
                            .then(imageMesh => {
                              imageMesh.position.y = -(WORLD_HEIGHT / 2) - ((WORLD_OPEN_HEIGHT - WORLD_HEIGHT) / 2);

                              object.add(imageMesh);
                            })
                            .catch(err => {
                              console.warn(err);
                            });
                        } else if (mode === 'video') {
                          _requestFileItemVideoMesh(item)
                            .then(videoMesh => {
                              videoMesh.position.y = -(WORLD_HEIGHT / 2) - ((WORLD_OPEN_HEIGHT - WORLD_HEIGHT) / 2) + ((100 / OPEN_HEIGHT * WORLD_OPEN_HEIGHT) / 2);

                              object.add(videoMesh);
                            })
                            .catch(err => {
                              console.warn(err);
                            });
                        } else if (mode === 'model') {
                          _requestFileItemModelMesh(item)
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
                  _updatePages();

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
                } else if (match = onclick.match(/^media:(play|pause):(.+)$/)) {
                  const action = match[1];
                  const id = match[2];
                  const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);
                  const {item} = tagMesh;

                  if (action === 'play') {
                    item.play();

                    _updatePages();
                  } else if (action === 'pause') {
                    item.pause();

                    _updatePages();
                  }
                } else if (match = onclick.match(/^media:seek:(.+)$/)) {
                  const id = match[1];
                  const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);
                  const {item} = tagMesh;

                  const {value} = hoverState;
                  item.seek(value);

                   _updatePages();
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
                  attribute: positioningName,
                  value: newValue,
                });

                detailsState.positioningId = null;
                detailsState.positioningName = null;
                detailsState.positioningSide = null;

                _updatePages();

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
                    tagsApi.emit('setAttribute', {
                      id: tagId,
                      attribute: attributeName,
                      value: value,
                    });

                    focusState.type = '';
                  } else if (action === 'tweak') {
                    const {value} = hoverState;
                    const {min, max, step} = attribute;

                    const newValue = (() => {
                      let n = min + (value * (max - min));
                      if (step > 0) {
                        n = Math.floor(n / step) * step;
                      }
                      return n;
                    })();
                    tagsApi.emit('setAttribute', {
                      id: tagId,
                      attribute: attributeName,
                      value: newValue,
                    });

                    focusState.type = '';
                  } else if (action === 'toggle') {
                    const newValue = !attributeValue;

                    tagsApi.emit('setAttribute', {
                      id: tagId,
                      attribute: attributeName,
                      value: newValue,
                    });
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
          const _update = () => {
            const _updateControllers = () => {
              const _updateElementAnchors = () => {
                const isOpen = rend.isOpen();

                if (isOpen) {
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

                      biolumi.updateAnchors({
                        objects: tagMeshes.map(tagMesh => {
                          if (
                            (tagMesh.parent === scene) ||
                            controllerMeshes.some(controllerMesh => tagMesh.parent === controllerMesh)
                          ) {
                            const {item: {open}} = tagMesh;

                            if (!open) {
                              const {planeMesh} = tagMesh;
                              const matrixObject = _decomposeObjectMatrixWorld(planeMesh);
                              const {page} = planeMesh;

                              return {
                                matrixObject: matrixObject,
                                page: page,
                                width: WIDTH,
                                height: HEIGHT,
                                worldWidth: WORLD_WIDTH,
                                worldHeight: WORLD_HEIGHT,
                                worldDepth: WORLD_DEPTH,
                                metadata: tagMesh,
                              };
                            } else {
                              const {planeOpenMesh} = tagMesh;
                              const matrixObject = _decomposeObjectMatrixWorld(planeOpenMesh);
                              const {page} = planeOpenMesh;

                              return {
                                matrixObject: matrixObject,
                                page: page,
                                width: OPEN_WIDTH,
                                height: OPEN_HEIGHT,
                                worldWidth: WORLD_OPEN_WIDTH,
                                worldHeight: WORLD_OPEN_HEIGHT,
                                worldDepth: WORLD_DEPTH,
                                metadata: tagMesh,
                              };
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
                    item.setAttribute(positioningName, newValue); // XXX figure out what to do with this live update
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

          const frameInterval = setInterval(() => {
            uiManager.update();
            uiOpenManager.update();
          }, FRAME_TIME);

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
            rend.removeListener('update', _update);

            clearInterval(frameInterval);
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
              matrix
            ) {
              this.type = type;
              this.id = id;
              this.name = name;
              this.displayName = displayName;
              this.description = description;
              this.version = version;
              this.attributes = (() => {
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
              })();
              this.mimeType = mimeType;
              this.matrix = matrix;

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

            play() {
              this.paused = false;

              const {preview} = this;
              if (preview) {
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

            pause() {
              this.paused = true;

              const {preview} = this;
              if (preview) {
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

            seek(value) {
              this.value = value;

              const {preview} = this;
              if (preview) {
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

            jsonStringify() { // used to let update checks see Symbol-hidden properties
              const result = {};
              for (const k in this) {
                result[k] = this[k];
              }
              const {instancing, open, paused, value} = this;
              result.instancing = instancing;
              result.open = open;
              result.paused = paused;
              result.value = value;
              return result;
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

          class TagsApi extends EventEmitter {
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
                itemSpec.attributes,
                itemSpec.mimeType,
                itemSpec.matrix
              );
              object.item = item;

              const {highlight} = itemSpec;
              object.highlight = highlight;

              object.position.set(item.matrix[0], item.matrix[1], item.matrix[2]);
              object.quaternion.set(item.matrix[3], item.matrix[4], item.matrix[5], item.matrix[6]);
              object.scale.set(item.matrix[7], item.matrix[8], item.matrix[9]);

              const _addUiManagerPage = ({uiManager, open}) => {
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

                  return [
                    {
                      type: 'html',
                      src: type === 'element' ?
                        tagsRenderer.getElementSrc({item, inputText, inputValue, positioningId, positioningName, focusAttributeSpec, highlight})
                      :
                        tagsRenderer.getFileSrc({item, mode}),
                      w: !open ? WIDTH : OPEN_WIDTH,
                      h: !open ? HEIGHT : OPEN_HEIGHT,
                    },
                    {
                      type: 'image',
                      img: creatureUtils.makeAnimatedCreature(type + ':' + item.displayName),
                      x: 10,
                      y: 0,
                      w: 100,
                      h: 100,
                      frameTime: FRAME_TIME,
                      pixelated: true,
                    }
                  ];
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

              const planeMesh = _addUiManagerPage({
                uiManager: uiManager,
                open: false,
              });
              object.add(planeMesh);
              object.planeMesh = planeMesh;

              const planeOpenMesh = _addUiManagerPage({
                uiManager: uiOpenManager,
                open: true,
              });
              planeOpenMesh.position.x = (WORLD_OPEN_WIDTH - WORLD_WIDTH) / 2;
              planeOpenMesh.position.y = -(WORLD_OPEN_HEIGHT - WORLD_HEIGHT) / 2;
              planeOpenMesh.visible = false;
              object.add(planeOpenMesh);
              object.planeOpenMesh = planeOpenMesh;

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

            getPointedTagMesh(side) {
              return hoverStates[side].metadata;
            }

            updatePages() {
              _updatePages();
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

const _clone = o => JSON.parse(JSON.stringify(o));
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = Tags;

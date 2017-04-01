const mod = require('mod-loop');

const WIDTH = 512;
const ASPECT_RATIO = 1;
const HEIGHT = Math.round(WIDTH / ASPECT_RATIO);
const WORLD_WIDTH = 0.3;
const WORLD_HEIGHT = WORLD_WIDTH / ASPECT_RATIO;

const PAPER_DRAW_DISTANCE = 0.2;
const BRUSH_SIZE = 8;
const DIRTY_TIME = 1000;

const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];
const SIDES = ['left', 'right'];

class ZDraw {
  mount() {
    const {three: {THREE}, input, elements, render, pose, utils: {geometry: geometryUtils, menu: menuUtils}} = zeo;

    const colorWheelImg = menuUtils.getColorWheelImg();

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
    const _decomposeMatrix = matrix => {
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, rotation, scale);
      return {position, rotation, scale};
    };

    const _requestImage = src => new Promise((accept, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(err);
      };
    });

    const _getScaledImg = (img, width, height) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      return canvas;
    };

    let colorImg = null;
    const _getColorImg = (img, color) => {
      const colorHex = color.getHex();

      let entry = (() => {
        if (colorImg && colorImg.color === colorHex) {
          return colorImg;
        } else {
          return null;
        }
      })();

      if (!entry) {
        entry = (() => {
          const canvas = document.createElement('canvas');

          const {width, height} = img;
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          const imageData = ctx.getImageData(0, 0, width, height);
          const {data: imageDataData} = imageData;
          for (let i = 0; i < (width * height); i++) {
            const baseIndex = i * 4;
            imageDataData[baseIndex + 0] = (255 - imageDataData[baseIndex + 0]) * color.r;
            imageDataData[baseIndex + 1] = (255 - imageDataData[baseIndex + 1]) * color.g;
            imageDataData[baseIndex + 2] = (255 - imageDataData[baseIndex + 2]) * color.b;
          }
          ctx.putImageData(imageData, 0, 0);

          const colorHex = color.getHex();
          canvas.color = colorHex;

          return canvas;
        })();

        colorImg = entry;
      }

      return entry;
    };

    return _requestImage('/archae/draw/brushes/brush.png')
      .then(brushImg => {
        brushImg = _getScaledImg(brushImg, BRUSH_SIZE, BRUSH_SIZE);

        if (live) {
          const worldElement = elements.getWorldElement();

          const papers = [];

          const paperComponent = {
            selector: 'paper[position]',
            attributes: {
              position: {
                type: 'matrix',
                value: [
                  0, 1.2, 0,
                  0, 0, 0, 1,
                  1, 1, 1,
                ],
              },
              file: {
                type: 'file',
                value: () => elements.makeFile({
                  ext: 'raw',
                }).then(file => file.url),
              },
              grabbable: {
                type: 'checkbox',
                value: true,
              },
              holdable: {
                type: 'checkbox',
                value: true,
              },
              size: {
                type: 'vector',
                value: [WORLD_WIDTH, WORLD_HEIGHT, 0.1],
              },
            },
            entityAddedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();
              const entityObject = entityElement.getObject();

              entityApi.entityElement = entityElement;

              const mesh = (() => {
                const object = new THREE.Object3D();

                const planeMesh = (() => {
                  const geometry = new THREE.PlaneBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT);

                  const canvas = (() => {
                    const canvas = document.createElement('canvas');
                    canvas.width = WIDTH;
                    canvas.height = HEIGHT;

                    const ctx = canvas.getContext('2d');
                    canvas.ctx = ctx;

                    ctx.fillStyle = '#FFF';
                    ctx.fillRect(0, 0, WIDTH, HEIGHT);

                    return canvas;
                  })();
                  const texture = new THREE.Texture(
                    canvas,
                    THREE.UVMapping,
                    THREE.ClampToEdgeWrapping,
                    THREE.ClampToEdgeWrapping,
                    THREE.NearestFilter,
                    THREE.NearestFilter,
                    THREE.RGBAFormat,
                    THREE.UnsignedByteType,
                    16
                  );
                  texture.needsUpdate = true;
                  const material = new THREE.MeshBasicMaterial({
                    color: 0xFFFFFF,
                    map: texture,
                    side: THREE.DoubleSide,
                  });

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.visible = false;
                  return mesh;
                })();
                object.add(planeMesh);
                object.planeMesh = planeMesh;

                const placeholderMesh = (() => {
                  const geometry = new THREE.PlaneBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT);
                  const material = new THREE.MeshBasicMaterial({
                    color: 0x000000,
                  });

                  const mesh = new THREE.Mesh(geometry, material);
                  return mesh;
                })();
                object.add(placeholderMesh);
                object.placeholderMesh = placeholderMesh;

                const lineMesh = (() => {
                  const geometry = new THREE.BufferGeometry();
                  const positions = Float32Array.from([
                    -WORLD_WIDTH / 2, -WORLD_HEIGHT / 2, 0,
                    -WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 0,
                    WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 0,
                    WORLD_WIDTH / 2, -WORLD_HEIGHT / 2, 0,
                    -WORLD_WIDTH / 2, -WORLD_HEIGHT / 2, 0,
                  ]);
                  geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));

                  const material = new THREE.LineBasicMaterial({
                    color: 0x808080,
                  });

                  const mesh = new THREE.Line(geometry, material);
                  mesh.frustumCulled = false;
                  return mesh;
                })();
                object.add(lineMesh);
                object.lineMesh = lineMesh;

                return object;
              })();
              entityObject.add(mesh);
              entityApi.mesh = mesh;

              entityApi.position = DEFAULT_MATRIX;
              entityApi.align = () => {
                const {position} = entityApi;

                entityObject.position.set(position[0], position[1], position[2]);
                entityObject.quaternion.set(position[3], position[4], position[5], position[6]);
                entityObject.scale.set(position[7], position[8], position[9]);
              };

              entityApi.render = () => {
                const {file} = entityApi;
                const {planeMesh, placeholderMesh} = mesh;

                if (file) {
                  planeMesh.visible = true;
                  placeholderMesh.visible = false;
                } else {
                  planeMesh.visible = false;
                  placeholderMesh.visible = true;
                }
              };

              entityApi.load = () => {
                const {file} = entityApi;

                file.read({
                  type: 'arrayBuffer',
                })
                  .then(arrayBuffer => {
                    const arrayValue = new Uint8ClampedArray(arrayBuffer);

                    if (arrayValue.length > 0) {
                      const {
                        planeMesh: {
                          material: {
                            map: texture,
                          },
                        },
                      } = mesh;
                      const {
                        image: canvas,
                      } = texture;
                      const {ctx} = canvas;
                      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                      const {data: imageDataData} = imageData;

                      if (arrayValue.length === imageDataData.length) {
                        imageDataData.set(arrayValue);
                        ctx.putImageData(imageData, 0, 0);
                        texture.needsUpdate = true;
                      } else {
                        console.warn('draw paper tried to load invalid file data', {data: arrayValue});
                      }
                    }
                  });
              };
              let dirtyFlag = false;
              entityApi.cancelSave = null;
              entityApi.save = () => {
                const {cancelSave} = entityApi;

                if (!cancelSave) {
                  const timeout = setTimeout(() => {
                    const {file} = entityApi;

                    const {
                      planeMesh: {
                        material: {
                          map: {
                            image: canvas,
                          },
                        },
                      },
                    } = mesh;
                    const imageData = canvas.ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const {data: imageDataData} = imageData;

                    const _cleanup = () => {
                      entityApi.cancelSave = null;

                      if (dirtyFlag) {
                        dirtyFlag = false;

                        entityApi.save();
                      }
                    };

                    let live = true;
                    file.write(imageDataData)
                      .then(() => {
                        if (live) {
                          const broadcastEvent = new CustomEvent('broadcast', {
                            detail: {
                              type: 'paper.update',
                              id: entityElement.getId(),
                            },
                          });
                          worldElement.dispatchEvent(broadcastEvent);

                          _cleanup();
                        }
                      })
                      .catch(err => {
                        console.warn(err);

                        _cleanup();
                      });

                    entityApi.cancelSave = () => {
                      live = false;
                    };

                    dirtyFlag = false;
                  }, DIRTY_TIME);

                  entityApi.cancelSave = () => {
                    cancelTimeout(timeout);
                  };
                }
              };

              const _makePaperState = () => ({
                lastPoint: null,
              });
              const paperStates = {
                left: _makePaperState(),
                right: _makePaperState(),
              };
              entityApi.paperStates = paperStates;

              papers.push(entityApi);

              entityApi._cleanup = () => {
                entityObject.remove(mesh);

                const {cancelSave} = entityApi;
                if (cancelSave) {
                  cancelSave();
                }

                papers.splice(papers.indexOf(entityApi), 1);
              };
            },
            entityRemovedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();

              entityApi._cleanup();
            },
            entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
              const entityApi = entityElement.getComponentApi();

              switch (name) {
                case 'position': {
                  entityApi.position = newValue;

                  entityApi.align();

                  break;
                }
                case 'file': {
                  entityApi.file = newValue;

                  entityApi.render();

                  if (newValue) {
                    entityApi.load();
                  } else {
                    const {cancelSave} = entityApi;

                    if (cancelSave) {
                      cancelSave();
                      entityApi.cancelSave = null;
                    }
                  }

                  break;
                }
              }
            },
          };
          elements.registerComponent(this, paperComponent);
          const pencilComponent = {
            selector: 'pencil[position][color]',
            attributes: {
              position: {
                type: 'matrix',
                value: [
                  0.5, 1.2, 0,
                  0, 0, 0, 1,
                  1, 1, 1,
                ],
              },
              color: {
                type: 'color',
                value: '#2196F3',
              },
              grabbable: {
                type: 'checkbox',
                value: true,
              },
              holdable: {
                type: 'checkbox',
                value: true,
              },
              size: {
                type: 'vector',
                value: [0.2, 0.2, 0.2],
              },
            },
            entityAddedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();
              const entityObject = entityElement.getObject();

              const mesh = (() => {
                const object = new THREE.Object3D();

                const coreMesh = (() => {
                  const geometry = (() => {
                    const coreGeometry = new THREE.BoxBufferGeometry(0.01, 0.01, 0.1);
                    const tipGeometry = new THREE.CylinderBufferGeometry(0, sq(0.005), 0.02, 4, 1)
                      .applyMatrix(new THREE.Matrix4().makeRotationY(-Math.PI * (3 / 12)))
                      .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
                      .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -0.05 - (0.02 / 2)));

                    return geometryUtils.concatBufferGeometry([coreGeometry, tipGeometry]);
                  })();
                  const material = new THREE.MeshPhongMaterial({
                    color: 0x808080,
                  });

                  const mesh = new THREE.Mesh(geometry, material);
                  return mesh;
                })();
                object.add(coreMesh);
                object.coreMesh = coreMesh;

                const colorWheelMesh = (() => {
                  const size = 0.05;

                  const object = new THREE.Object3D();
                  object.position.y = 0.02;
                  object.visible = false;
                  object.size = size;

                  const planeMesh = (() => {
                    const geometry = new THREE.PlaneBufferGeometry(size, size)
                      .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));

                    const texture = new THREE.Texture(
                      colorWheelImg,
                      THREE.UVMapping,
                      THREE.ClampToEdgeWrapping,
                      THREE.ClampToEdgeWrapping,
                      THREE.NearestFilter,
                      THREE.NearestFilter,
                      THREE.RGBAFormat,
                      THREE.UnsignedByteType,
                      16
                    );
                    texture.needsUpdate = true;
                    const material = new THREE.MeshBasicMaterial({
                      color: 0xFFFFFF,
                      map: texture,
                      side: THREE.DoubleSide,
                    });

                    const mesh = new THREE.Mesh(geometry, material);
                    return mesh;
                  })();
                  object.add(planeMesh);

                  const notchMesh = (() => {
                    const geometry = new THREE.CylinderBufferGeometry(0, sq(0.002), 0.005, 4, 1)
                      .applyMatrix(new THREE.Matrix4().makeRotationY(-Math.PI * (3 / 12)))
                      .applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI));
                    const material = new THREE.MeshPhongMaterial({
                      color: 0xFF0000,
                      shading: THREE.FlatShading,
                    });

                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.y = 0.005 / 2;
                    return mesh;
                  })();
                  object.add(notchMesh);
                  object.notchMesh = notchMesh;

                  return object;
                })();
                object.add(colorWheelMesh);
                object.colorWheelMesh = colorWheelMesh;

                return object;
              })();
              entityObject.add(mesh);

              entityApi.position = DEFAULT_MATRIX;
              entityApi.align = () => {
                const {position} = entityApi;

                entityObject.position.set(position[0], position[1], position[2]);
                entityObject.quaternion.set(position[3], position[4], position[5], position[6]);
                entityObject.scale.set(position[7], position[8], position[9]);
              };

              entityApi.color = new THREE.Color(0x000000);
              entityApi.render = () => {
                const {color} = entityApi;
                const {coreMesh} = mesh;

                coreMesh.material.color.copy(color);
              };

              const _makePencilState = () => ({
                grabbed: false,
                drawing: false,
                pressed: false,
                color: '',
              });
              const pencilStates = {
                left: _makePencilState(),
                right: _makePencilState(),
              };

              const _grab = e => {
                const {detail: {side}} = e;
                const pencilState = pencilStates[side];

                pencilState.grabbed = true;
              };
              entityElement.addEventListener('grab', _grab);
              const _release = e => {
                const {detail: {side}} = e;
                const pencilState = pencilStates[side];

                pencilState.grabbed = false;

                const {colorWheelMesh} = mesh;
                colorWheelMesh.visible = false;
              };
              entityElement.addEventListener('release', _release);
              const _triggerdown = e => {
                const {side} = e;
                const pencilState = pencilStates[side];
                const {grabbed} = pencilState;

                if (grabbed) {
                  pencilState.drawing = true;

                  e.stopImmediatePropagation();
                }
              };
              input.on('triggerdown', _triggerdown, {
                priority: 1,
              });
              const _triggerup = e => {
                const {side} = e;
                const pencilState = pencilStates[side];
                const {grabbed} = pencilState;

                if (grabbed) {
                  const {drawing} = pencilState;

                  if (drawing) {
                    pencilState.drawing = false;

                    for (let i = 0; i < papers.length; i++) {
                      const paper = papers[i];
                      const {paperStates} = paper;
                      const paperState = paperStates[side];
                      paperState.lastPoint = null;
                    }
                  }

                  e.stopImmediatePropagation();
                }
              };
              input.on('triggerup', _triggerup, {
                priority: 1,
              });
              const _paddown = e => {
                const {side} = e;
                const pencilState = pencilStates[side];
                const {grabbed} = pencilState;

                if (grabbed) {
                  pencilState.pressed = true;

                  const {colorWheelMesh} = mesh;
                  colorWheelMesh.visible = true;

                  e.stopImmediatePropagation();
                }
              };
              input.on('paddown', _paddown, {
                priority: 1,
              });
              const _padup = e => {
                const {side} = e;
                const pencilState = pencilStates[side];
                const {grabbed} = pencilState;

                if (grabbed) {
                  pencilState.pressed = false;

                  const {colorWheelMesh} = mesh;
                  colorWheelMesh.visible = false;

                  const {color} = pencilState;
                  entityElement.setAttribute('color', JSON.stringify('#' + color.toString(16)));

                  e.stopImmediatePropagation();
                }
              };
              input.on('padup', _padup, {
                priority: 1,
              });

              const _update = () => {
                const {gamepads} = pose.getStatus();

                for (let i = 0; i < papers.length; i++) {
                  const paper = papers[i];
                  const {mesh: paperMesh, file} = paper;

                  let drawable = false;
                  if (file) {
                    const {
                      planeMesh: {
                        material: {
                          map: texture,
                        },
                      },
                    } = paperMesh;
                    const {image: canvas} = texture;

                    const {position: paperPosition, rotation: paperRotation} = _decomposeObjectMatrixWorld(paperMesh);
                    const planeTarget = geometryUtils.makePlaneTarget(paperPosition, paperRotation, WORLD_WIDTH, WORLD_HEIGHT);

                    SIDES.forEach(side => {
                      const pencilState = pencilStates[side];
                      const {grabbed} = pencilState;

                      if (grabbed) {
                        const gamepad = gamepads[side];

                        if (gamepad) {
                          const {position: controllerPosition, rotation: controllerRotation} = gamepad;
                          const pencilLine = geometryUtils.makeControllerLine(controllerPosition, controllerRotation);
                          const planePoint = planeTarget.intersectLine(pencilLine);

                          if (planePoint) {
                            drawable = true;

                            const {drawing} = pencilState;

                            if (drawing) {
                              const {z} = planePoint;

                              if (z < PAPER_DRAW_DISTANCE) {
                                const {paperStates} = paper;
                                const paperState = paperStates[side];

                                const {x: xFactor, y: yFactor} = planePoint;
                                const currentPoint = new THREE.Vector2(
                                  Math.round(xFactor * WIDTH),
                                  Math.round(yFactor * HEIGHT)
                                );
                                const lastPoint = (() => {
                                  const {lastPoint} = paperState;
                                  if (lastPoint) {
                                    return lastPoint;
                                  } else {
                                    const fakeLastPoint = currentPoint.clone();
                                    fakeLastPoint.y -= 10;
                                    return fakeLastPoint;
                                  }
                                })();

                                if (lastPoint.distanceTo(currentPoint) > 0) {
                                  const {color} = entityApi;
                                  const colorBrushImg = _getColorImg(brushImg, color);

                                  const halfBrushW = colorBrushImg.width / 2;
                                  const halfBrushH = colorBrushImg.height / 2;
                                  const distance = lastPoint.distanceTo(currentPoint);
                                  const angle = (() => {
                                    const dy = currentPoint.y - lastPoint.y;
                                    const dx = currentPoint.x - lastPoint.x;
                                    return mod(Math.atan2(dy, dx), Math.PI * 2);
                                  })();


                                  for (let z = 0; z <= distance || z === 0; z++) {
                                    const x = lastPoint.x + (Math.cos(angle) * z) - halfBrushW;
                                    const y = lastPoint.y + (Math.sin(angle) * z) - halfBrushH;
                                    canvas.ctx.drawImage(colorBrushImg, x, y);
                                  }

                                  texture.needsUpdate = true;

                                  paper.save();

                                  paperState.lastPoint = currentPoint;
                                }
                              }
                            }
                          }
                        }
                      }

                      const {pressed} = pencilState;
                      if (pressed) {
                        const {gamepads} = pose.getStatus();
                        const gamepad = gamepads[side];

                        if (gamepad) {
                          const {colorWheelMesh} = mesh;
                          const {size, notchMesh} = colorWheelMesh;
                          const {axes} = gamepad;

                          notchMesh.position.x = -(size / 2) + (((axes[0] / 2) + 0.5) * size);
                          notchMesh.position.z = (size / 2) - (((axes[1] / 2) + 0.5) * size);

                          const colorHex = colorWheelImg.getColor((axes[0] / 2) + 0.5, (-axes[1] / 2) + 0.5);
                          pencilState.color = colorHex;

                          notchMesh.material.color.setHex(colorHex);
                        }
                      }
                    });
                  }

                  const {lineMesh: {material}} = paperMesh;
                  material.color = new THREE.Color(drawable ? 0x000000 : 0x808080)
                };
              };
              render.on('update', _update);

              entityApi._cleanup = () => {
                entityObject.remove(mesh);

                entityElement.removeEventListener('grab', _grab);
                entityElement.removeEventListener('release', _release);
                input.removeListener('triggerdown', _triggerdown);
                input.removeListener('triggerup', _triggerup);
                input.removeListener('paddown', _paddown);
                input.removeListener('padup', _padup);

                render.removeListener('update', _update);
              };
            },
            entityRemovedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();

              entityApi._cleanup();
            },
            entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
              const entityApi = entityElement.getComponentApi();

              switch (name) {
                case 'position': {
                  entityApi.position = newValue;

                  entityApi.align();

                  break;
                }
                case 'color': {
                  entityApi.color.setStyle(newValue);

                  entityApi.render();

                  break;
                }
              }
            },
          };
          elements.registerComponent(this, pencilComponent);

          const _message = e => {
            const {detail: {type}} = e;

            if (type === 'paper') {
              const {id} = detail;

              for (let i = 0; i < papers.length; i++) {
                const paper = papers[i];
                const {entityElement} = paper;

                if (entityElement.getId() === id) {
                  const {file} = entityElement;

                  if (file) {
                    entityElement.load();
                  }
                }
              }
            }
          };
          worldElement.addEventListener('message', _message);

          this._cleanup = () => {
            elements.unregisterComponent(this, paperComponent);
            elements.unregisterComponent(this, pencilComponent);

            worldElement.removeEventListener('message', _message);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

const sq = n => Math.sqrt((n * n) + (n * n));

module.exports = ZDraw;

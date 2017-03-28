const mod = require('mod-loop');

const WIDTH = 512;
const ASPECT_RATIO = 1;
const HEIGHT = Math.round(WIDTH / ASPECT_RATIO);
const WORLD_WIDTH = 0.3;
const WORLD_HEIGHT = WORLD_WIDTH / ASPECT_RATIO;

const PAPER_DRAW_DISTANCE = 0.2;
const BRUSH_SIZE = 8;

const SIDES = ['left', 'right'];

class ZDraw {
  mount() {
    const {three: {THREE}, input, elements, render, pose, world, utils: {geometry: geometryUtils}} = zeo;

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
    const _getRotatedImg = (img, angle) => {
      const canvas = document.createElement('canvas');
      const size = Math.max(img.width, img.height) * 2;
      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext('2d');
      ctx.translate(size / 2, size / 2);
      ctx.rotate(angle);
      ctx.drawImage(img, -(size / 4), -(size / 4));

      return canvas;
    };

    return _requestImage('/archae/draw/brushes/brush.png')
      .then(brushImg => {
        brushImg = _getScaledImg(brushImg, BRUSH_SIZE, BRUSH_SIZE);

        if (live) {
          const pages = [];

          const pageComponent = {
            selector: 'page[position]',
            attributes: {
              position: {
                type: 'matrix',
                value: [
                  0, 1.2, 0,
                  0, 0, 0, 1,
                  1, 1, 1,
                ],
              },
              grabbable: {
                type: 'checkbox',
                value: true,
              },
            },
            entityAddedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();
              const entityObject = entityElement.getObject();

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

                    const imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT);
                    const {data: imageDataData} = imageData;
                    for (let i = 0; i < (WIDTH * HEIGHT); i++) {
                      const baseIndex = i * 4;
                      imageDataData[baseIndex + 0] = 255;
                      imageDataData[baseIndex + 1] = 255;
                      imageDataData[baseIndex + 2] = 255;
                      imageDataData[baseIndex + 3] = 0;
                    }

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
                  const canvasMaterial = new THREE.MeshBasicMaterial({
                    map: texture,
                    side: THREE.DoubleSide,
                  });

                  const mesh = new THREE.Mesh(geometry, canvasMaterial);
                  mesh.canvasMaterial = canvasMaterial;
                  return mesh;
                })();
                object.add(planeMesh);
                object.planeMesh = planeMesh;

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

              entityApi.position = new THREE.Vector3();
              entityApi.align = () => {
                const {position} = entityApi;

                entityObject.position.set(position[0], position[1], position[2]);
                entityObject.quaternion.set(position[3], position[4], position[5], position[6]);
                entityObject.scale.set(position[7], position[8], position[9]);
              };

              const _makePaperState = () => ({
                lastPoint: null,
              });
              const paperStates = {
                left: _makePaperState(),
                right: _makePaperState(),
              };
              entityApi.paperStates = paperStates;

              pages.push(entityApi);

              entityApi._cleanup = () => {
                entityObject.remove(mesh);

                pages.splice(pages.indexOf(entityApi), 1);
              };
            },
            entityRemovedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();

              entityApi._cleanup();
            },
            attributeValueChangedCallback(entityElement, name, oldValue, newValue) {
              const entityApi = entityElement.getComponentApi();

              switch (name) {
                case 'position': {
                  entityApi.position = newValue;

                  entityApi.align();

                  break;
                }
                /* case 'color': {
                  entityApi.color = new THREE.Color(newValue);

                  break;
                }
                case 'grabbable': {
                  entityApi.grabbable = newValue;

                  break;
                } */
              }
            },
          };
          elements.registerComponent(this, pageComponent);
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
            },
            entityAddedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();
              const entityObject = entityElement.getObject();

              const mesh = (() => {
                const geometry = (() => {
                  const coreGeometry = new THREE.BoxBufferGeometry(0.01, 0.01, 0.1);
                  const tipGeometry = new THREE.CylinderBufferGeometry(0, 0.01, 0.02, 4, 1)
                    .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -0.1));

                  return geometryUtils.concatBufferGeometry([coreGeometry, tipGeometry]);
                })();
                const material = new THREE.MeshPhongMaterial({
                  color: 0x808080,
                });

                const pencilMesh = new THREE.Line(geometry, material);
                return pencilMesh;
              })();
              entityObject.add(mesh);

              entityApi.position = new THREE.Vector3();
              entityApi.align = () => {
                const {position} = entityApi;

                entityObject.position.set(position[0], position[1], position[2]);
                entityObject.quaternion.set(position[3], position[4], position[5], position[6]);
                entityObject.scale.set(position[7], position[8], position[9]);
              };

              entityApi.color = new THREE.Color(0x000000);

              const _makePencilState = () => ({
                grabbed: false,
                drawing: false,
              });
              const pencilStates = {
                left: _makePencilState(),
                right: _makePencilState(),
              };

              const _grab = e => {
                const {side} = e;
                const pencilState = pencilStates[side];

                pencilState.grabbed = true;
              };
              entityElement.addEventListener('grab', _grab);
              const _release = e => {
                const {side} = e;
                const pencilState = pencilStates[side];

                pencilState.grabbed = false;
              };
              entityElement.addEventListener('release', _release);
              const _triggerdown = e => {
                const {side} = e;
                const pencilState = pencilStates[side];
                const {grabbed} = pencilState;

                if (grabbed) {
                  const {gamepads} = pose.getStatus();
                  const gamepad = gamepads[side];
                  const {position: controllerPosition} = gamepad;
                  const {position: paperPosition, quaternion: paperQuaternion} = _decomposeObjectMatrixWorld(mesh);
                  const planeTarget = geometryUtils.makePlaneTarget(paperPosition, paperQuaternion, WORLD_WIDTH, WORLD_HEIGHT);
                  const planePoint = planeTarget.projectPoint(controllerPosition);

                  if (planePoint) {
                    pencilState.drawing = true;

                    e.stopImmediatePropagation();
                  }
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

                    for (let i = 0; i < pages.length; i++) {
                      const page = pages[i];
                      const {pageStates} = page;
                      const pageState = pageStates[side];
                      pageState.lastPoint = null;
                    }
                  }

                  e.stopImmediatePropagation();
                }
              };
              input.on('triggerup', _triggerup, {
                priority: 1,
              });

              const _update = () => {
                const {gamepads} = pose.getStatus();

                for (let i = 0; i < pages.length; i++) {
                  const page = pages[i];
                  const {mesh} = page;
                  const {
                    planeMesh: {
                      canvasMaterial: {
                        map: texture,
                      },
                    },
                  } = mesh;
                  const {image: canvas} = texture;

                  const {position: paperPosition, rotation: paperRotation} = _decomposeObjectMatrixWorld(mesh);
                  const planeTarget = geometryUtils.makePlaneTarget(paperPosition, paperRotation, WORLD_WIDTH, WORLD_HEIGHT);

                  let drawable = false;
                  SIDES.forEach(side => {
                    const gamepad = gamepads[side];

                    if (gamepad) {
                      const {position: controllerPosition} = gamepad;
                      const planePoint = planeTarget.projectPoint(controllerPosition);

                      if (planePoint) {
                        drawable = true;

                        const pencilState = pencilStates[side];
                        const {drawing} = pencilState;

                        if (drawing) {
                          const {z} = planePoint;

                          if (z < PAPER_DRAW_DISTANCE) {
                            const {pageStates} = page;
                            const pageState = pageStates[side];

                            const {x: xFactor, y: yFactor} = planePoint;
                            const currentPoint = new THREE.Vector2(
                              Math.round(xFactor * WIDTH),
                              Math.round(yFactor * HEIGHT)
                            );
                            const lastPoint = (() => {
                              const {lastPoint} = pageState;
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

                              pageState.lastPoint = currentPoint;
                            }
                          }
                        }
                      }
                    }
                  });

                  const {lineMesh: {material}} = mesh;
                  material.color = new THREE.Color(drawable ? 0x0000FF : 0x808080)
                };
              };
              render.on('update', _update);

              entityApi._cleanup = () => {
                entityObject.remove(mesh);

                entityElement.removeEventListener('grab', _grab);
                entityElement.removeEventListener('release', _release);
                input.removeListener('triggerdown', _triggerdown);
                input.removeListener('triggerup', _triggerup);

                render.removeListener('update', _update);
              };
            },
            entityRemovedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();

              entityApi._cleanup();
            },
            attributeValueChangedCallback(entityElement, name, oldValue, newValue) {
              const entityApi = entityElement.getComponentApi();

              switch (name) {
                case 'position': {
                  entityApi.position = newValue;

                  entityApi.align();

                  break;
                }
                case 'color': {
                  entityApi.color = new THREE.Color(newValue);

                  break;
                }
                /* case 'grabbable': {
                  entityApi.grabbable = newValue;

                  break;
                } */
              }
            },
          };
          elements.registerComponent(this, pencilComponent);

          this._cleanup = () => {
            elements.unregisterComponent(this, pageComponent);
            elements.unregisterComponent(this, pencilComponent);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = ZDraw;

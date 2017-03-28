const mod = require('mod-loop');

const WIDTH = 512;
const ASPECT_RATIO = 1;
const HEIGHT = Math.round(WIDTH / ASPECT_RATIO);
const WORLD_WIDTH = 0.3;
const WORLD_HEIGHT = WORLD_WIDTH / ASPECT_RATIO;

const PAPER_DRAW_DISTANCE = 0.2;
const BRUSH_SIZE = 8;

const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];
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
    /* const _getRotatedImg = (img, angle) => {
      const canvas = document.createElement('canvas');
      const size = Math.max(img.width, img.height) * 2;
      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext('2d');
      ctx.translate(size / 2, size / 2);
      ctx.rotate(angle);
      ctx.drawImage(img, -(size / 4), -(size / 4));

      return canvas;
    }; */

    return _requestImage('/archae/draw/brushes/brush.png')
      .then(brushImg => {
        brushImg = _getScaledImg(brushImg, BRUSH_SIZE, BRUSH_SIZE);

        if (live) {
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
                  mesh.material = material;
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

              entityApi.position = DEFAULT_MATRIX;
              entityApi.align = () => {
                const {position} = entityApi;

                entityObject.position.set(position[0], position[1], position[2]);
                entityObject.quaternion.set(position[3], position[4], position[5], position[6]);
                entityObject.scale.set(position[7], position[8], position[9]);
              };

              const _makePaperState = () => ({
                lastPoint: null,
              });
              let dirtyTimeout = null;
              const paperStates = {
                left: _makePaperState(),
                right: _makePaperState(),
                setDirty: () => {
                  if (!dirtyTimeout) {
                    dirtyTimeout = setTimeout(() => {
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
                      const imageDataString = arraybuffer2base64(imageData.data);

                      entityElement.setData(imageDataString);

                      dirtyTimeout = null;
                    }, 1000);
                  }
                },
              };
              entityApi.paperStates = paperStates;

              papers.push(entityApi);

              entityApi._cleanup = () => {
                entityObject.remove(mesh);

                clearTimeout(dirtyTimeout);

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
            entityDataChangedCallback(entityElement, oldValue, newValue) {
              const entityApi = entityElement.getComponentApi();

              if (typeof newValue === 'string') {
                const newData = new Uint8ClampedArray(base642arraybuffer(newValue));;

                const {mesh} = entityApi;
                const {
                  planeMesh: {
                    material: {
                      map: {
                        image: canvas,
                      },
                    },
                  },
                } = mesh;
                const {ctx} = canvas;
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const {data: imageDataData} = imageData;
                if (newData.length === imageDataData.length) {
                  imageDataData.set(newData);
                  ctx.putImageData(imageData, 0, 0);
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
                const geometry = (() => {
                  const sq = n => Math.sqrt((n * n) + (n * n));

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

                const pencilMesh = new THREE.Mesh(geometry, material);
                return pencilMesh;
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

              const _makePencilState = () => ({
                grabbed: false,
                drawing: false,
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
              };
              entityElement.addEventListener('release', _release);
              const _triggerdown = e => {
                const {side} = e;
                const pencilState = pencilStates[side];
                const {grabbed} = pencilState;

                if (grabbed) {
                  const {gamepads} = pose.getStatus();
                  const gamepad = gamepads[side];
                  const {position: controllerPosition, rotation: controllerRotation} = gamepad;
                  const {position: paperPosition, rotation: paperRotation} = _decomposeObjectMatrixWorld(mesh);
                  const planeTarget = geometryUtils.makePlaneTarget(paperPosition, paperRotation, WORLD_WIDTH, WORLD_HEIGHT);
                  const pencilLine = geometryUtils.makeControllerLine(controllerPosition, controllerRotation);
                  const planePoint = planeTarget.intersectLine(pencilLine);

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

              const _update = () => {
                const {gamepads} = pose.getStatus();

                for (let i = 0; i < papers.length; i++) {
                  const paper = papers[i];
                  const {mesh} = paper;
                  const {
                    planeMesh: {
                      material: {
                        map: texture,
                      },
                    },
                  } = mesh;
                  const {image: canvas} = texture;

                  const {position: paperPosition, rotation: paperRotation} = _decomposeObjectMatrixWorld(mesh);
                  const planeTarget = geometryUtils.makePlaneTarget(paperPosition, paperRotation, WORLD_WIDTH, WORLD_HEIGHT);

                  let drawable = false;
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

                                paperStates.setDirty();

                                paperState.lastPoint = currentPoint;
                              }
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
            entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
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
            elements.unregisterComponent(this, paperComponent);
            elements.unregisterComponent(this, pencilComponent);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

const arraybuffer2base64 = arrayBuffer => {
  var base64    = ''
  var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

  var bytes         = new Uint8Array(arrayBuffer)
  var byteLength    = bytes.byteLength
  var byteRemainder = byteLength % 3
  var mainLength    = byteLength - byteRemainder

  var a, b, c, d
  var chunk

  // Main loop deals with bytes in chunks of 3
  for (var i = 0; i < mainLength; i = i + 3) {
    // Combine the three bytes into a single integer
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

    // Use bitmasks to extract 6-bit segments from the triplet
    a = (chunk & 16515072) >> 18 // 16515072 = (2^6 - 1) << 18
    b = (chunk & 258048)   >> 12 // 258048   = (2^6 - 1) << 12
    c = (chunk & 4032)     >>  6 // 4032     = (2^6 - 1) << 6
    d = chunk & 63               // 63       = 2^6 - 1

    // Convert the raw binary segments to the appropriate ASCII encoding
    base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
  }

  // Deal with the remaining bytes and padding
  if (byteRemainder == 1) {
    chunk = bytes[mainLength]

    a = (chunk & 252) >> 2 // 252 = (2^6 - 1) << 2

    // Set the 4 least significant bits to zero
    b = (chunk & 3)   << 4 // 3   = 2^2 - 1

    base64 += encodings[a] + encodings[b] + '=='
  } else if (byteRemainder == 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]

    a = (chunk & 64512) >> 10 // 64512 = (2^6 - 1) << 10
    b = (chunk & 1008)  >>  4 // 1008  = (2^6 - 1) << 4

    // Set the 2 least significant bits to zero
    c = (chunk & 15)    <<  2 // 15    = 2^4 - 1

    base64 += encodings[a] + encodings[b] + encodings[c] + '='
  }

  return base64
};
const base642arraybuffer = (() => {
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  // Use a lookup table to find the index.
  var lookup = new Uint8Array(256);
  for (var i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  return base64 => {
    var bufferLength = base64.length * 0.75,
    len = base64.length, i, p = 0,
    encoded1, encoded2, encoded3, encoded4;

    if (base64[base64.length - 1] === "=") {
      bufferLength--;
      if (base64[base64.length - 2] === "=") {
        bufferLength--;
      }
    }

    var arraybuffer = new ArrayBuffer(bufferLength),
    bytes = new Uint8Array(arraybuffer);

    for (i = 0; i < len; i+=4) {
      encoded1 = lookup[base64.charCodeAt(i)];
      encoded2 = lookup[base64.charCodeAt(i+1)];
      encoded3 = lookup[base64.charCodeAt(i+2)];
      encoded4 = lookup[base64.charCodeAt(i+3)];

      bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }

    return arraybuffer;
  };
})();

module.exports = ZDraw;

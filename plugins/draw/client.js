const mod = require('mod-loop');

const WIDTH = 512;
const ASPECT_RATIO = 1;
const HEIGHT = Math.round(WIDTH / ASPECT_RATIO);
const WORLD_WIDTH = 0.3;
const WORLD_HEIGHT = WORLD_WIDTH / ASPECT_RATIO;

const PAPER_DRAW_DISTANCE = 0.2;
const BRUSH_SIZE = 8;

const SIDES = ['left', 'right'];

class Draw {
  mount() {
    const {three: {THREE, scene}, input, elements, render, pose, world, utils: {geometry: geometryUtils}} = zeo;

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
          class DrawElement extends HTMLElement {
            createdCallback() {
              const mesh = (() => {
                const object = new THREE.Object3D();
                object.position.y = 1.2;

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
                  // const material = new THREE.MeshPhongMaterial({
                  const canvasMaterial = new THREE.MeshBasicMaterial({
                    map: texture,
                    // shininess: 10,
                    // shininess: 0,
                    side: THREE.DoubleSide,
                    transparent: true,
                  });
                  // const materials = [solidMaterial, canvasMaterial];

                  // const mesh = THREE.SceneUtils.createMultiMaterialObject(geometry, materials);
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
              this.mesh = mesh;
              scene.add(mesh);

              const color = new THREE.Color(0x000000);
              this.color = color;

              const _makeDrawState = () => ({
                drawing: false,
                lastPoint: null,
              });
              const drawStates = {
                left: _makeDrawState(),
                right: _makeDrawState(),
              };

              const _triggerdown = e => {
                const {side} = e;

                const {gamepads} = pose.getStatus();
                const gamepad = gamepads[side];
                const {position: controllerPosition} = gamepad;
                const {position: paperPosition, quaternion: paperQuaternion} = _decomposeObjectMatrixWorld(mesh);
                const planeTarget = geometryUtils.makePlaneTarget(paperPosition, paperQuaternion, WORLD_WIDTH, WORLD_HEIGHT);
                const planePoint = planeTarget.projectPoint(controllerPosition);

                if (planePoint) {
                  const drawState = drawStates[side];
                  drawState.drawing = true;

                  e.stopImmediatePropagation();
                }
              };
              input.on('triggerdown', _triggerdown, {
                priority: 1,
              });
              const _triggerup = e => {
                const {side} = e;
                const drawState = drawStates[side];
                const {drawing} = drawState;

                if (drawing) {
                  drawState.drawing = false;
                  drawState.lastPoint = null;

                  e.stopImmediatePropagation();
                }
              };
              input.on('triggerup', _triggerup, {
                priority: 1,
              });

              const _update = () => {
                const {gamepads} = pose.getStatus();
                const worldTime = world.getWorldTime();
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

                      const drawState = drawStates[side];
                      const {drawing} = drawState;

                      if (drawing) {
                        const {z} = planePoint;

                        if (z < PAPER_DRAW_DISTANCE) {
                          const {x: xFactor, y: yFactor} = planePoint;
                          const currentPoint = new THREE.Vector2(
                            Math.round(xFactor * WIDTH),
                            Math.round(yFactor * HEIGHT)
                          );
                          const lastPoint = (() => {
                            if (drawState.lastPoint) {
                              return drawState.lastPoint;
                            } else {
                              const fakeLastPoint = currentPoint.clone();
                              fakeLastPoint.y -= 10;
                              return fakeLastPoint;
                            }
                          })();

                          if (lastPoint.distanceTo(currentPoint) > 0) {
                            const {color} = this;
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

                            drawState.lastPoint = currentPoint;
                          }
                        }
                      }
                    }
                  }
                });

                const {lineMesh: {material}} = mesh;
                material.color = new THREE.Color(drawable ? 0x0000FF : 0x808080);
              };
              render.on('update', _update);

              this._cleanup = () => {
                scene.remove(mesh);

                input.removeListener('triggerdown', _triggerdown);
                input.removeListener('triggerup', _triggerup);

                render.removeListener('update', _update);
              };
            }

            destructor() {
              this._cleanup();
            }

            attributeValueChangedCallback(name, oldValue, newValue) {
              switch (name) {
                case 'color': {
                  this.color = new THREE.Color(newValue);

                  break;
                }
              }
            }
          }
          elements.registerElement(this, DrawElement);

          this._cleanup = () => {
            elements.unregisterElement(this);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Draw;

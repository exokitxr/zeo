const WIDTH = 512;
const ASPECT_RATIO = 0.75;
const HEIGHT = Math.round(WIDTH / ASPECT_RATIO);
const WORLD_WIDTH = 0.3;
const WORLD_HEIGHT = WORLD_WIDTH / ASPECT_RATIO;

const PAPER_DRAW_DISTANCE = 0.2;
const POINT_FRAME_RATE = 20;
const BRUSH_SIZE = 9;

const SIDES = ['left', 'right'];

class Draw {
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
      '/core/engines/zeo',
      '/core/plugins/geometry-utils',
    ]).then(([
      zeo,
      geometryUtils,
    ]) => {
      if (live) {
        const {THREE, scene} = zeo;

        const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
        const _decomposeMatrix = matrix => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        class DrawElement extends HTMLElement {
          static get attributes() {
            return {
              /* position: {
                type: 'matrix',
                value: [
                  0, 1, 0,
                  0, 0, 0, 1,
                  1, 1, 1,
                ],
              }, */
              color: {
                type: 'color',
                value: '#F44336'
              },
            };
          }

          createdCallback() {
            const mesh = (() => {
              const object = new THREE.Object3D();
              object.position.y = 1.2;

              const planeMesh = (() => {
                const geometry = new THREE.PlaneBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT);

                const imageData = (() => {
                  const canvas = document.createElement('canvas');
                  const ctx = canvas.getContext('2d');
                  return ctx.createImageData(WIDTH, HEIGHT);
                })();
                const texture = new THREE.Texture(
                  imageData,
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
                const material = new THREE.MeshBasicMaterial({
                  map: texture,
                  // shininess: 10,
                  // shininess: 0,
                  side: THREE.DoubleSide,
                });

                const mesh = new THREE.Mesh(geometry, material);
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

            const color = new THREE.Color(0xF44336);
            this.color = color;

            let lastPoint = 0;

            const _makeDrawState = () => ({
              drawing: false,
              lastPointTime: 0,
            });
            const drawStates = {
              left: _makeDrawState(),
              right: _makeDrawState(),
            };

            const _triggerdown = e => {
              const {side} = e;

              const {gamepads} = zeo.getStatus();
              const gamepad = gamepads[side];
              const {position: controllerPosition} = gamepad;
              const {position: paperPosition, rotation: paperRotation} = _decomposeObjectMatrixWorld(mesh);
              const planeTarget = geometryUtils.makePlaneTarget(paperPosition, paperRotation, WORLD_WIDTH, WORLD_HEIGHT);
              const planePoint = planeTarget.projectPoint(controllerPosition);

              if (planePoint) {
                const drawState = drawStates[side];
                drawState.drawing = true;

                e.stopImmediatePropagation();
              }
            };
            zeo.on('triggerdown', _triggerdown, {
              priority: 1,
            });
            const _triggerup = e => {
              const {side} = e;

              const {gamepads} = zeo.getStatus();
              const gamepad = gamepads[side];
              const {position: controllerPosition} = gamepad;
              const {position: paperPosition, rotation: paperRotation} = _decomposeObjectMatrixWorld(mesh);
              const planeTarget = geometryUtils.makePlaneTarget(paperPosition, paperRotation, WORLD_WIDTH, WORLD_HEIGHT);
              const planePoint = planeTarget.projectPoint(controllerPosition);

              if (planePoint) {
                const drawState = drawStates[side];
                drawState.drawing = false;

                e.stopImmediatePropagation();
              }
            };
            zeo.on('triggerup', _triggerup, {
              priority: 1,
            });

            const _update = () => {
              const {gamepads} = zeo.getStatus();
              const worldTime = zeo.getWorldTime();
              const {
                planeMesh: {
                  material: {
                    map: texture,
                  },
                },
              } = mesh;
              const {
                image: {
                  data: imageDataArray,
                },
              } = texture;

              const _getFrame = t => Math.floor(t / POINT_FRAME_RATE);

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
                      const {lastPointTime} = drawState;
                      const lastFrame = _getFrame(lastPointTime);
                      const currentPointTime = worldTime;
                      const currentFrame = _getFrame(currentPointTime);

                      if (currentFrame > lastFrame) {
                        const {z} = planePoint;

                        if (z < PAPER_DRAW_DISTANCE) {
                          const {x: xFactor, y: yFactor} = planePoint;

                          const {color} = this;
                          const pixelValue = Float32Array.from([
                            color.r * 255,
                            color.g * 255,
                            color.b * 255,
                          ]);
                          const centerX = Math.floor(xFactor * WIDTH);
                          const centerY = Math.floor(yFactor * HEIGHT);
                          const maxDistance = Math.floor((BRUSH_SIZE - 1) / 2);
                          for (let xOffset = -maxDistance; xOffset < maxDistance; xOffset++) {
                            const x = centerX + xOffset;

                            if (x >= 0 && x < WIDTH) {
                              for (let yOffset = -maxDistance; yOffset < maxDistance; yOffset++) {
                                const y = centerY + yOffset;

                                if (y >= 0 && y < HEIGHT) {
                                  const baseIndex = ((y * WIDTH) + x) * 4;

                                  imageDataArray.set(pixelValue, baseIndex);

                                  const alphaFactor = Math.max(maxDistance - Math.sqrt((xOffset * xOffset) + (yOffset * yOffset)), 0);
                                  imageDataArray[baseIndex + 3] = Math.max(imageDataArray[baseIndex + 3], alphaFactor * 255);
                                }
                              }
                            }
                          }
                          texture.needsUpdate = true;

                          drawState.lastPointTime = lastPointTime;
                        }
                      }
                    }
                  }
                }
              });

              const {lineMesh: {material}} = mesh;
              material.color = new THREE.Color(drawable ? 0x0000FF : 0x808080);
            };
            zeo.on('update', _update);

            this._cleanup = () => {
              scene.remove(mesh);

              zeo.removeListener('triggerdown', _triggerdown);
              zeo.removeListener('triggerup', _triggerup);
              zeo.removeListener('update', _update);
            };
          }

          destructor() {
            this._cleanup();
          }

          attributeValueChangedCallback(name, oldValue, newValue) {
            switch (name) {
              /* case 'position': {
                const {mesh} = this;

                mesh.position.set(newValue[0], newValue[1], newValue[2]);
                mesh.quaternion.set(newValue[3], newValue[4], newValue[5], newValue[6]);
                mesh.scale.set(newValue[7], newValue[8], newValue[9]);

                break;
              } */
              case 'color': {
                this.color = new THREE.Color(newValue);

                break;
              }
            }
          }
        }
        zeo.registerElement(this, DrawElement);

        this._cleanup = () => {
          zeo.unregisterElement(this);
        };

        return {};
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Draw;

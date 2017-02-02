const MAX_NUM_POINTS = 4 * 1024;
const POINT_FRAME_RATE = 20;
const SIZE = 0.02;

const SIDES = ['left', 'right'];

class Paint {
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
    ]).then(([
      zeo,
    ]) => {
      if (live) {
        const {THREE, scene} = zeo;

        const paintMaterial = new THREE.MeshPhongMaterial({
          // shininess: 10,
          vertexColors: THREE.VertexColors,
          side: THREE.DoubleSide,
        });

        const _requestFileImage = file =>
          file.fetch({
            type: 'blob',
          })
            .then(blob => new Promise((accept, reject) => {
              const url = URL.createObjectURL(blob);
              const img = new Image();
              img.src = url;
              img.onload = () => {
                accept(img);

                URL.revokeObjectURL(url);
              };
              img.onerror = err => {
                console.warn(err);

                URL.revokeObjectURL(url);
              };
            }))
            .catch(err => {
              console.warn(err);
            });

        class PaintElement extends HTMLElement {
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
                value: '#CCCCCC'
              },
            };
          }

          createdCallback() {
            const mesh = (() => {
              const geometry = new THREE.BufferGeometry();
              const positions = new Float32Array(MAX_NUM_POINTS * 6 * 3);
              geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
              const normals = new Float32Array(MAX_NUM_POINTS * 6 * 3);
              geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
              const colors = new Float32Array(MAX_NUM_POINTS * 6 * 3);
              geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
              geometry.setDrawRange(0, 0);

              const material = paintMaterial;

              const mesh = new THREE.Mesh(geometry, material);
              mesh.frustumCulled = false;
              return mesh;
            })();
            this.mesh = mesh;
            scene.add(mesh);

            const color = new THREE.Color(0xCCCCCC);
            this.color = color;

            let lastPoint = 0;

            const _makePaintState = () => ({
              painting: false,
              lastPointTime: 0,
            });
            const paintStates = {
              left: _makePaintState(),
              right: _makePaintState(),
            };

            const _triggerdown = e => {
              const {side} = e;
              const paintState = paintStates[side];
              paintState.painting = true;
            };
            zeo.on('triggerdown', _triggerdown);
            const _triggerup = e => {
              const {side} = e;
              const paintState = paintStates[side];
              paintState.painting = false;
            };
            zeo.on('triggerup', _triggerup);

            const _update = () => {
              const {gamepads} = zeo.getStatus();
              const worldTime = zeo.getWorldTime();

              const _getFrame = t => Math.floor(t / POINT_FRAME_RATE);

              SIDES.forEach(side => {
                const paintState = paintStates[side];
                const {painting} = paintState;

                if (painting) {
                  const {lastPointTime} = paintState;
                  const lastFrame = _getFrame(lastPointTime);
                  const currentPointTime = worldTime;
                  const currentFrame = _getFrame(currentPointTime);

                  if (currentFrame > lastFrame) {
                    const positionsAttribute = mesh.geometry.getAttribute('position');
                    const normalsAttribute = mesh.geometry.getAttribute('normal');
                    const colorsAttribute = mesh.geometry.getAttribute('color');

                    const positions = positionsAttribute.array;
                    const normals = normalsAttribute.array;
                    const colors = colorsAttribute.array;

                    const gamepad = gamepads[side];
                    const {position: controllerPosition, rotation: controllerRotation} = gamepad;
                    const baseIndex = lastPoint * 3;

                    // positions
                    const topLeft = controllerPosition.clone()
                      .add(new THREE.Vector3(-SIZE, -SIZE, 0).applyQuaternion(controllerRotation));
                    const topRight = controllerPosition.clone()
                      .add(new THREE.Vector3(SIZE, -SIZE, 0).applyQuaternion(controllerRotation))
                    const bottomLeft = controllerPosition.clone()
                      .add(new THREE.Vector3(-SIZE, SIZE, 0).applyQuaternion(controllerRotation))
                    const bottomRight = controllerPosition.clone()
                      .add(new THREE.Vector3(SIZE, SIZE, 0).applyQuaternion(controllerRotation))

                    positions[baseIndex + 0] = topLeft.x;
                    positions[baseIndex + 1] = topLeft.y;
                    positions[baseIndex + 2] = topLeft.z;

                    positions[baseIndex + 3] = bottomLeft.x;
                    positions[baseIndex + 4] = bottomLeft.y;
                    positions[baseIndex + 5] = bottomLeft.z;

                    positions[baseIndex + 6] = topRight.x;
                    positions[baseIndex + 7] = topRight.y;
                    positions[baseIndex + 8] = topRight.z;

                    positions[baseIndex + 9] = bottomLeft.x;
                    positions[baseIndex + 10] = bottomLeft.y;
                    positions[baseIndex + 11] = bottomLeft.z;

                    positions[baseIndex + 12] = bottomRight.x;
                    positions[baseIndex + 13] = bottomRight.y;
                    positions[baseIndex + 14] = bottomRight.z;

                    positions[baseIndex + 15] = topRight.x;
                    positions[baseIndex + 16] = topRight.y;
                    positions[baseIndex + 17] = topRight.z;

                    // normals
                    const upVector = new THREE.Vector3(0, 1, 0).applyQuaternion(controllerRotation);
                    for (let i = 0; i < 6; i++) {
                      const baseIndexNormal = baseIndex + (i * 3);
                      normals[baseIndexNormal + 0] = upVector.x;
                      normals[baseIndexNormal + 1] = upVector.y;
                      normals[baseIndexNormal + 2] = upVector.z;
                    }

                    // colors
                    const {color} = this;
                    for (let i = 0; i < 6; i++) {
                      const baseIndexColor = baseIndex + (i * 3);
                      colors[baseIndexColor + 0] = color.r;
                      colors[baseIndexColor + 1] = color.g;
                      colors[baseIndexColor + 2] = color.b;
                    }

                    positionsAttribute.needsUpdate = true;
                    normalsAttribute.needsUpdate = true;
                    colorsAttribute.needsUpdate = true;
                    lastPoint += 6;

                    const {geometry} = mesh;
                    geometry.setDrawRange(0, lastPoint);

console.log('last point', lastPoint);

                    paintState.lastPointTime = lastPointTime;
                  }
                }
              });
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
        zeo.registerElement(this, PaintElement);

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

module.exports = Paint;

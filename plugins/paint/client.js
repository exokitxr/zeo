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
      '/core/plugins/geometry-utils',
    ]).then(([
      zeo,
      geometryUtils,
    ]) => {
      if (live) {
        const {THREE, scene} = zeo;

        const planeUvs = geometryUtils.unindexBufferGeometry(new THREE.PlaneBufferGeometry(1, 1, 1, 1)).getAttribute('uv').array;

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

        return _requestImage('/archae/paint/brushes/brush.png')
          .then(brushImg => {
            if (live) {
              class PaintElement extends HTMLElement {
                createdCallback() {
                  const mesh = (() => {
                    const geometry = new THREE.BufferGeometry();
                    const positions = new Float32Array(MAX_NUM_POINTS * 6 * 3);
                    geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
                    const normals = new Float32Array(MAX_NUM_POINTS * 6 * 3);
                    geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
                    const colors = new Float32Array(MAX_NUM_POINTS * 6 * 3);
                    geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
                    const uvs = new Float32Array(MAX_NUM_POINTS * 6 * 2);
                    geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
                    geometry.setDrawRange(0, 0);

                    const texture = new THREE.Texture(
                      brushImg,
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
                    const material = new THREE.MeshPhongMaterial({
                      map: texture,
                      // shininess: 10,
                      shininess: 0,
                      vertexColors: THREE.VertexColors,
                      side: THREE.DoubleSide,
                      transparent: true,
                      alphaTest: 0.5,
                    });

                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.frustumCulled = false;
                    return mesh;
                  })();
                  this.mesh = mesh;
                  scene.add(mesh);

                  const color = new THREE.Color(0xF44336);
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
                          const uvsAttribute = mesh.geometry.getAttribute('uv');

                          const positions = positionsAttribute.array;
                          const normals = normalsAttribute.array;
                          const colors = colorsAttribute.array;
                          const uvs = uvsAttribute.array;

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
                          const downVector = new THREE.Vector3(0, -1, 0).applyQuaternion(controllerRotation);
                          for (let i = 0; i < 6; i++) {
                            const baseIndexNormal = baseIndex + (i * 3);
                            normals[baseIndexNormal + 0] = downVector.x;
                            normals[baseIndexNormal + 1] = downVector.y;
                            normals[baseIndexNormal + 2] = downVector.z;
                          }

                          // colors
                          const {color} = this;
                          for (let i = 0; i < 6; i++) {
                            const baseIndexColor = baseIndex + (i * 3);
                            colors[baseIndexColor + 0] = color.r;
                            colors[baseIndexColor + 1] = color.g;
                            colors[baseIndexColor + 2] = color.b;
                          }

                          // uvs
                          const baseIndexUv = lastPoint * 2;
                          uvs.set(planeUvs, baseIndexUv);

                          positionsAttribute.needsUpdate = true;
                          normalsAttribute.needsUpdate = true;
                          colorsAttribute.needsUpdate = true;
                          uvsAttribute.needsUpdate = true;
                          lastPoint += 6;

                          const {geometry} = mesh;
                          geometry.setDrawRange(0, lastPoint);

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
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Paint;

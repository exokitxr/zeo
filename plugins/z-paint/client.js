const MAX_NUM_POINTS = 4 * 1024;
const POINT_FRAME_RATE = 20;
const SIZE = 0.02;
const DIRTY_TIME = 1000;

const SIDES = ['left', 'right'];

class ZPaint {
  mount() {
    const {three: {THREE, scene}, elements, input, pose, world, render, utils: {function: funUtils, geometry: geometryUtils}} = zeo;

    let live = true;
    this.cleanup = () => {
      live = false;
    };

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
          const worldElement = elements.getWorldElement();

          const paintbrushComponent = {
            selector: 'paintbrush[position][color]',
            attributes: {
              position: {
                type: 'matrix',
                value: [
                  0, 1.2, 0,
                  0, 0, 0, 1,
                  1, 1, 1,
                ],
              },
              color: {
                type: 'color',
                value: '#F44336',
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
                value: [0.2, 0.2, 0.2],
              },
            },
            entityAddedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();
              const entityObject = entityElement.getObject();

              const paintbrushMesh = (() => {
                const geometry = (() => {
                  const sq = n => Math.sqrt((n * n) + (n * n));

                  const coreGeometry = new THREE.BoxBufferGeometry(0.02, 0.02, 0.05);
                  const jointGeometry = new THREE.BoxBufferGeometry(0.1, 0.03, 0.03)
                    .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(0.05 / 2) - (0.03 / 2)));
                  const brushGeometry = new THREE.BoxBufferGeometry(0.09, 0.02, 0.1)
                    .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(0.05 / 2) - (0.03 / 2) - (0.1 / 2)));

                  return geometryUtils.concatBufferGeometry([coreGeometry, jointGeometry, brushGeometry]);
                })();
                const material = new THREE.MeshPhongMaterial({
                  color: 0x808080,
                });

                const mesh = new THREE.Mesh(geometry, material);
                return mesh;
              })();
              entityObject.add(paintbrushMesh);

              entityApi.align = () => {
                const {position} = entityApi;

                entityObject.position.set(position[0], position[1], position[2]);
                entityObject.quaternion.set(position[3], position[4], position[5], position[6]);
                entityObject.scale.set(position[7], position[8], position[9]);
              };

              const _makePaintMesh = ({
                positions = new Float32Array(MAX_NUM_POINTS * 2 * 3),
                normals = new Float32Array(MAX_NUM_POINTS * 2 * 3),
                colors = new Float32Array(MAX_NUM_POINTS * 2 * 3),
                uvs = new Float32Array(MAX_NUM_POINTS * 2 * 2),
                numPoints = 0,
              } = {}) => {
                const geometry = new THREE.BufferGeometry();
                geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
                geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
                geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
                geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
                geometry.setDrawRange(0, numPoints * 2);

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
                mesh.drawMode = THREE.TriangleStripDrawMode;
                mesh.frustumCulled = false;
                mesh.lastPoint = numPoints;
                mesh.getBuffer = () => {
                  const {lastPoint} = mesh;
                  const positionSize = lastPoint * 2 * 3;
                  const uvSize = lastPoint * 2 * 2;
                  const array = new Float32Array(
                    1 + // length
                    positionSize + // position
                    positionSize + // normal
                    positionSize + // color
                    uvSize // uv
                  );
                  array[0] = lastPoint; // length
                  array.set(positions.slice(0, positionSize), 1); // position
                  array.set(normals.slice(0, positionSize), 1 + positionSize); // normal
                  array.set(colors.slice(0, positionSize), 1 + (positionSize * 2)); // color
                  array.set(uvs.slice(0, uvSize), 1 + (positionSize * 3)); // uv

                  return new Uint8Array(array.buffer);
                };

                return mesh;
              };
              let mesh = null;

              const meshes = [];

              entityApi.color = new THREE.Color(0xF44336);

              entityApi.load = () => {
                const {file} = entityApi;

                if (file) {
                  file.read({
                    type: 'arrayBuffer',
                  })
                    .then(arrayBuffer => {
                      const array = new Float32Array(arrayBuffer);
                      let frameIndex = 0;
                      while (frameIndex < array.length) {
                        const numPoints = Math.floor(array[frameIndex]);
                        const positionSize = numPoints * 2 * 3;
                        const uvSize = numPoints * 2 * 2;

                        const positions = array.slice(frameIndex + 1, frameIndex + 1 + positionSize);
                        const normals = array.slice(frameIndex + 1 + positionSize, frameIndex + 1 + (positionSize * 2));
                        const colors = array.slice(frameIndex + 1 + (positionSize * 2), frameIndex + 1 + (positionSize * 3));
                        const uvs = array.slice(frameIndex + 1 + (positionSize * 3), frameIndex + 1 + (positionSize * 3) + uvSize);

                        const mesh = _makePaintMesh({
                          positions,
                          normals,
                          colors,
                          uvs,
                          numPoints,
                        });
                        scene.add(mesh);
                        meshes.push(mesh);

                        frameIndex += 1 + (positionSize * 3) + uvSize;
                      }
                    });
                } else {
                  if (mesh) {
                    scene.remove(mesh);
                    mesh = null;
                  }

                  for (let i = 0; i < meshes.length; i++) {
                    const mesh = meshes[i];
                    scene.remove(mesh);
                  }
                  meshes.length = 0;

                  SIDES.forEach(side => {
                    const paintState = paintStates[side];
                    paintState.painting = false;
                  });
                }
              };

              let dirtyFlag = false;
              entityApi.cancelSave = null;
              entityApi.save = () => {
                const {cancelSave} = entityApi;

                if (!cancelSave) {
                  const timeout = setTimeout(() => {
                    const {file} = entityApi;

                    const allMeshes = meshes.concat(mesh ? [mesh] : []);
                    const b = _concatArrayBuffers(allMeshes.map(mesh => mesh.getBuffer()));

                    let live = true;
                    file.write(b)
                      .then(() => {
                        if (live) {
                          const broadcastEvent = new CustomEvent('broadcast', {
                            detail: {
                              type: 'paintbrush.update',
                              id: entityElement.getId(),
                            },
                          });
                          worldElement.dispatchEvent(broadcastEvent);

                          entityApi.cancelSave = null;

                          if (dirtyFlag) {
                            dirtyFlag = false;

                            entityApi.save();
                          }
                        }
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

              const _makePaintState = () => ({
                grabbed: false,
                painting: false,
                lastPointTime: 0,
              });
              const paintStates = {
                left: _makePaintState(),
                right: _makePaintState(),
              };

              const _grab = e => {
                const {detail: {side}} = e;
                const paintState = paintStates[side];

                paintState.grabbed = true;
              };
              entityElement.addEventListener('grab', _grab);
              const _release = e => {
                const {detail: {side}} = e;
                const paintState = paintStates[side];

                paintState.grabbed = false;
                paintState.painting = false;
              };
              entityElement.addEventListener('release', _release);
              const _triggerdown = e => {
                const {side} = e;
                const {file} = entityApi;

                if (file) {
                  const paintState = paintStates[side];
                  const {grabbed} = paintState;

                  if (grabbed) {
                    paintState.painting = true;
                  }

                  const numPainting = funUtils.sum(SIDES.map(side => Number(paintStates[side].painting)));
                  if (numPainting === 1) {
                    mesh = _makePaintMesh();

                    scene.add(mesh);
                  }
                }
              };
              input.on('triggerdown', _triggerdown);
              const _triggerup = e => {
                const {side} = e;
                const {file} = entityApi;

                if (file) {
                  const paintState = paintStates[side];
                  const {grabbed} = paintState;

                  if (grabbed) {
                    paintState.painting = false;
                  }

                  const numPainting = funUtils.sum(SIDES.map(side => Number(paintStates[side].painting)));
                  if (numPainting === 0) {
                    meshes.push(mesh);

                    mesh = null;
                  }
                }
              };
              input.on('triggerup', _triggerup);

              const _update = () => {
                const {gamepads} = pose.getStatus();
                const worldTime = world.getWorldTime();

                const _getFrame = t => Math.floor(t / POINT_FRAME_RATE);

                SIDES.forEach(side => {
                  const paintState = paintStates[side];
                  const {painting} = paintState;

                  if (painting) {
                    let {lastPoint} = mesh;

                    if (lastPoint < MAX_NUM_POINTS) {
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

                        const paintbrushTipPosition = controllerPosition.clone()
                          .add(new THREE.Vector3(0, 0, -(0.05 / 2) - (0.03 / 2) - (0.1 / 2)).applyQuaternion(controllerRotation));

                        const brushSize = 0.1;
                        const direction = new THREE.Vector3(1, 0, 0)
                          .applyQuaternion(controllerRotation);
                        const posA = paintbrushTipPosition.clone()
                          .add(direction.clone().multiplyScalar(brushSize / 2));
                        const posB = paintbrushTipPosition.clone()
                          .add(direction.clone().multiplyScalar(-brushSize / 2));

                        // positions
                        const basePositionIndex = lastPoint * 2 * 3;
                        positions[basePositionIndex + 0] = posA.x;
                        positions[basePositionIndex + 1] = posA.y;
                        positions[basePositionIndex + 2] = posA.z;
                        positions[basePositionIndex + 3] = posB.x;
                        positions[basePositionIndex + 4] = posB.y;
                        positions[basePositionIndex + 5] = posB.z;

                        // normals
                        (() => {
                          const pA = new THREE.Vector3();
                          const pB = new THREE.Vector3();
                          const pC = new THREE.Vector3();
                          const cb = new THREE.Vector3();
                          const ab = new THREE.Vector3();

                          const idx = lastPoint * 2 * 3;
                          for (let i = 0, il = idx; i < il; i++) {
                            normals[i] = 0;
                          }

                          let pair = true;
                          for (let i = 0, il = idx; i < il; i += 3) {
                            if (pair) {
                              pA.fromArray(positions, i);
                              pB.fromArray(positions, i + 3);
                              pC.fromArray(positions, i + 6);
                            } else {
                              pA.fromArray(positions, i + 3);
                              pB.fromArray(positions, i);
                              pC.fromArray(positions, i + 6);
                            }
                            pair = !pair;

                            cb.subVectors(pC, pB);
                            ab.subVectors(pA, pB);
                            cb.cross(ab);
                            cb.normalize();

                            normals[i] += cb.x;
                            normals[i + 1] += cb.y;
                            normals[i + 2] += cb.z;

                            normals[i + 3] += cb.x;
                            normals[i + 4] += cb.y;
                            normals[i + 5] += cb.z;

                            normals[i + 6] += cb.x;
                            normals[i + 7] += cb.y;
                            normals[i + 8] += cb.z;
                          }

                          /*
                          first and last vertice (0 and 8) belongs just to one triangle
                          second and penultimate (1 and 7) belongs to two triangles
                          the rest of the vertices belongs to three triangles
                            1_____3_____5_____7
                            /\    /\    /\    /\
                           /  \  /  \  /  \  /  \
                          /____\/____\/____\/____\
                          0    2     4     6     8
                          */

                          // Vertices that are shared across three triangles
                          for (let i = 2 * 3, il = idx - 2 * 3; i < il; i++) {
                            normals[i] = normals[i] / 3;
                          }

                          // Second and penultimate triangle, that shares just two triangles
                          normals[3] = normals[3] / 2;
                          normals[3 + 1] = normals[3 + 1] / 2;
                          normals[3 + 2] = normals[3 * 1 + 2] / 2;

                          normals[idx - 2 * 3] = normals[idx - 2 * 3] / 2;
                          normals[idx - 2 * 3 + 1] = normals[idx - 2 * 3 + 1] / 2;
                          normals[idx - 2 * 3 + 2] = normals[idx - 2 * 3 + 2] / 2;

                          mesh.geometry.normalizeNormals();
                        })();

                        // colors
                        const {color} = entityApi;
                        for (let i = 0; i < 2; i++) {
                          const baseColorIndex = basePositionIndex + (i * 3);

                          colors[baseColorIndex + 0] = color.r;
                          colors[baseColorIndex + 1] = color.g;
                          colors[baseColorIndex + 2] = color.b;
                        }

                        // uvs
                        for (let i = 0; i <= lastPoint; i++) {
                          const baseUvIndex = i * 2 * 2;

                          uvs[baseUvIndex + 0] = i / (lastPoint - 1);
                          uvs[baseUvIndex + 1] = 0;
                          uvs[baseUvIndex + 2] = i / (lastPoint - 1);
                          uvs[baseUvIndex + 3] = 1;
                        }

                        positionsAttribute.needsUpdate = true;
                        normalsAttribute.needsUpdate = true;
                        colorsAttribute.needsUpdate = true;
                        uvsAttribute.needsUpdate = true;

                        lastPoint++;
                        mesh.lastPoint = lastPoint;

                        const {geometry} = mesh;
                        geometry.setDrawRange(0, lastPoint * 2);

                        paintState.lastPointTime = lastPointTime;

                        entityApi.save();
                      }
                    }
                  }
                });
              };
              render.on('update', _update);

              entityApi._cleanup = () => {
                if (mesh) {
                  scene.remove(mesh);
                }
                for (let i = 0; i < meshes.length; i++) {
                  const mesh = meshes[i];
                  scene.remove(mesh);
                }

                const {cancelSave} = entityApi;
                if (cancelSave) {
                  cancelSave();
                }

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
                case 'file': {
                  entityApi.file = newValue;

                  entityApi.load();

                  if (!newValue) {
                    const {cancelSave} = entityApi;

                    if (cancelSave) {
                      cancelSave();
                      entityApi.cancelSave = null;
                    }
                  }

                  break;
                }
                case 'color': {
                  entityApi.color = new THREE.Color(newValue);

                  break;
                }
              }
            },
          };
          elements.registerComponent(this, paintbrushComponent);

          this._cleanup = () => {
            elements.unregisterComponent(this, paintbrushComponent);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

const _concatArrayBuffers = as => {
  let length = 0;
  for (let i = 0; i < as.length; i++) {
    const e = as[i];
    length += e.length;
  }

  const result = new Uint8Array(length);
  let index = 0;
  for (let i = 0; i < as.length; i++) {
    const e = as[i];
    result.set(e, index);
    index += e.length;
  }
  return result;
};

module.exports = ZPaint;

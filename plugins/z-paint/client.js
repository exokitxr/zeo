const MAX_NUM_POINTS = 4 * 1024;
const POINT_FRAME_RATE = 20;
const POINT_FRAME_TIME = 1000 / POINT_FRAME_RATE;
const SIZE = 0.02;
const DIRTY_TIME = 1000;

const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];
const SIDES = ['left', 'right'];

class ZPaint {
  mount() {
    const {three: {THREE, scene}, elements, input, pose, world, render, utils: {function: funUtils, networkUtils, geometry: geometryUtils, menu: menuUtils}} = zeo;
    const {AutoWs} = networkUtils;

    const colorWheelImg = menuUtils.getColorWheelImg();

    let live = true;
    this.cleanup = () => {
      live = false;
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

    return _requestImage('archae/z-paint/brushes/brush.png')
      .then(brushImg => {
        if (live) {
          const worldElement = elements.getWorldElement();

          const paintbrushComponent = {
            selector: 'paintbrush[position][paint-id][color]',
            attributes: {
              position: {
                type: 'matrix',
                value: [
                  0, 1.2, 0,
                  0, 0, 0, 1,
                  1, 1, 1,
                ],
              },
              'paint-id': {
                type: 'text',
                value: _makeId,
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
                const object = new THREE.Object3D();

                const coreMesh = (() => {
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
              entityObject.add(paintbrushMesh);

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
                const {coreMesh} = paintbrushMesh;

                coreMesh.material.color.copy(color);
              };

              let connection = null;
              const _ensureConnect = () => {
                const {file} = entityApi;

                if (file && !connection) {
                  const peerId = player.getId();
                  const {paintId} = entityApi;
                  connection = new AutoWs(_relativeWsUrl('archae/paintWs?peerId=' + encodeURIComponent(peerId) + '&paintId=' + encodeURIComponent(paintId)));

                  let currentRemotePaintSpec = null;
                  connection.on('message', msg => {
                    if (typeof msg.data === 'string') {
                      const e = JSON.parse(msg.data) ;
                      const {type} = e;

                      if (type === 'paintSpec') {
                        const {meshId} = e;
                        currentRemotePaintSpec = {
                          meshId,
                        };
                      } else {
                        console.warn('unknown message type', JSON.stringify(type));
                      }
                    } else {
                      if (currentRemotePaintSpec !== null) {
                        const {meshId} = currentRemotePaintSpec;
                        const {data} = msg;

                        _loadMesh({meshId, data});
                      } else {
                        console.warn('buffer data before paint spec', msg);
                      }
                    }
                  });
                } else if (!file && connection) {
                  _clearMeshes();

                  SIDES.forEach(side => {
                    const paintState = paintStates[side];
                    paintState.painting = false;
                  });

                  connection.destroy();
                  connection = null;
                }
              };
              entityApi.ensureConnect = _ensureConnect;

              const _broadcastUpdate = ({meshId, data}) => {
                const e = {
                  type: 'paintSpec',
                  meshId: meshId,
                };
                const es = JSON.stringify(e);

                connection.send(es);
                connection.send(data);
              };
              entityApi.broadcastUpdate = _broadcastUpdate;

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
                mesh.visible = numPoints > 0;
                mesh.lastPoint = numPoints;
                mesh.getBuffer = (startPoint, endPoint) => {
                  const positionOffset = startPoint * 2 * 3;
                  const uvOffset = startPoint * 2 * 2;
                  const numPoints = endPoint - startPoint;
                  const positionSize = numPoints * 2 * 3;
                  const uvSize = numPoints * 2 * 2;

                  const array = new Float32Array(
                    positionSize + // position
                    positionSize + // normal
                    positionSize + // color
                    uvSize // uv
                  );
                  array.set(positions.slice(positionOffset, positionOffset + positionSize), 0); // position
                  array.set(normals.slice(positionOffset, positionOffset + positionSize), positionSize); // normal
                  array.set(colors.slice(positionOffset, positionOffset + positionSize), positionSize * 2); // color
                  array.set(uvs.slice(uvOffset, uvOffset + uvSize), positionSize * 3); // uv

                  return new Uint8Array(array.buffer);
                };

                return mesh;
              };

              let currentMeshId = null;
              let meshes = {};

              const _loadMesh = ({meshId, data}) => {
                let mesh = meshes[meshId];
                if (!mesh) {
                  mesh = _makePaintMesh({
                    positions,
                    normals,
                    colors,
                    uvs,
                    numPoints,
                  });
                  scene.add(mesh);

                  meshes[meshId] = meshId;
                }
                const {geometry} = mesh;
                const positionsAttribute = geometry.getAttribute('position');
                const {array: positions} = positionsAttribute;
                const normalsAttribute = geometry.getAttribute('normal');
                const {array: normals} = normalsAttribute;
                const colorsAttribute = geometry.getAttribute('color');
                const {array: colors} = colorsAttribute;
                const uvsAttribute = geometry.getAttribute('uv');
                const {array: uvs} = uvsAttribute;
                const {numPoints: oldNumPoints} = mesh;
                const oldPositionsSize = oldNumPoints * 2 * 3;
                const oldUvsSize = oldNumPoints * 2 * 2;

                const array = new Float32Array(data);
                const dataNumPoints = array.length / ((2 * 3) + (2 * 2));
                const dataPositionSize = dataNumPoints * 2 * 3;
                const dataUvSize = dataNumPoints * 2 * 2;

                const newPositions = array.slice(0, dataPositionSize);
                const newNormals = array.slice(dataPositionSize, dataPositionSize * 2);
                const newColors = array.slice(dataPositionSize * 2, dataPositionSize * 3);
                const newUvs = array.slice(dataPositionSize * 3, (dataPositionSize * 3) + dataUvSize);

                positions.set(newPositions, oldPositionsSize);
                normals.set(newNormals, oldPositionsSize);
                colors.set(newColors, oldColorsSize);
                uvs.set(newUvs, oldUvsSize);
                const newNumPoints = oldNumPoints + dataNumPoints;
                mesh.lastPoint = newNumPoints;

                positionsAttribute.needsUpdate = true;
                normalsAttribute.needsUpdate = true;
                colorsAttribute.needsUpdate = true;
                uvsAttribute.needsUpdate = true;
                geometry.setDrawRange(0, newNumPoints * 2);

                return mesh;
              };
              const _clearMeshes = () => {
                for (const meshId in meshes) {
                  const mesh = meshes[meshId];
                  scene.remove(mesh);
                }
                meshes = {};
              };

              /* entityApi.load = () => {
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

                    const _cleanup = () => {
                      entityApi.cancelSave = null;

                      if (dirtyFlag) {
                        dirtyFlag = false;

                        entityApi.save();
                      }
                    };

                    let live = true;
                    file.write(b)
                      .then(() => {
                        if (live) {
                          const broadcastEvent = new CustomEvent('broadcast', { // XXX handle this for multiplayer
                            detail: {
                              type: 'paintbrush.update',
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
              }; */

              const _makePaintState = () => ({
                grabbed: false,
                painting: false,
                lastPoint: 0, // XXX don't need this once we get it from the mesh
                lastPointTime: 0,
                pressed: false,
                color: '',
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
                    paintState.lastPoint = 0;
                    paintState.lastPointTime = world.getWorldTime() - POINT_FRAME_TIME;

                    const numPainting = funUtils.sum(SIDES.map(side => Number(paintStates[side].painting)));
                    if (numPainting === 1) {
                      currentMeshId = _makeId();

                      const mesh = _loadMesh({
                        meshId: currentMeshId,
                        data: new ArrayBuffer(0),
                      });
                      mesh.visible = false;
                    }
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

                    const numPainting = funUtils.sum(SIDES.map(side => Number(paintStates[side].painting)));
                    if (numPainting === 0) {
                      currentMeshId = null;
                    }
                  }
                }
              };
              input.on('triggerup', _triggerup);
              const _paddown = e => {
                const {side} = e;
                const paintState = paintStates[side];
                const {grabbed} = paintState;

                if (grabbed) {
                  paintState.pressed = true;

                  const {colorWheelMesh} = paintbrushMesh;
                  colorWheelMesh.visible = true;

                  e.stopImmediatePropagation();
                }
              };
              input.on('paddown', _paddown, {
                priority: 1,
              });
              const _padup = e => {
                const {side} = e;
                const paintState = paintStates[side];
                const {grabbed} = paintState;

                if (grabbed) {
                  paintState.pressed = false;

                  const {colorWheelMesh} = paintbrushMesh;
                  colorWheelMesh.visible = false;

                  const {color} = paintState;
                  entityElement.setAttribute('color', JSON.stringify('#' + color.toString(16)));

                  e.stopImmediatePropagation();
                }
              };
              input.on('padup', _padup, {
                priority: 1,
              });

              const _update = () => {
                const {gamepads} = pose.getStatus();
                const worldTime = world.getWorldTime();

                const _getFrame = t => Math.floor(t / POINT_FRAME_RATE);

                SIDES.forEach(side => {
                  const paintState = paintStates[side];
                  const {painting} = paintState;

                  if (painting) {
                    const mesh = meshes[currentMeshId];
                    // let {lastPoint} = mesh; // XXX should really use the last point from the mesh here
                    let {lastPoint} = paintState;

                    if (lastPoint < MAX_NUM_POINTS) {
                      const {lastPointTime} = paintState;
                      const lastFrame = _getFrame(lastPointTime);
                      const currentPointTime = worldTime;
                      const currentFrame = _getFrame(currentPointTime);

                      if (currentFrame > lastFrame) {
                        const {geometry} = mesh;
                        const positionsAttribute = geometry.getAttribute('position');
                        const normalsAttribute = geometry.getAttribute('normal');
                        const colorsAttribute = geometry.getAttribute('color');
                        const uvsAttribute = geometry.getAttribute('uv');

                        const positions = positionsAttribute.array;
                        const normals = normalsAttribute.array;
                        const colors = colorsAttribute.array;
                        const uvs = uvsAttribute.array;

                        const gamepad = gamepads[side];
                        const {position: controllerPosition, rotation: controllerRotation, scale: controllerScale} = gamepad;
                        const absPosition = controllerPosition.clone().multiply(controllerScale);
                        const paintbrushTipPosition = absPosition.clone()
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

                        _broadcastUpdate({
                          meshId: currentMeshId,
                          data: mesh.getBuffer(lastPoint, lastPoint + 1);
                        });

                        lastPoint++;
                        /* mesh.lastPoint = lastPoint; // XXX unlock this once backend proxying works
                        if (!mesh.visible) {
                          mesh.visible = true;
                        }

                        geometry.setDrawRange(0, lastPoint * 2); */

                        paintState.lastPoint = lastPoint; // XXX use the per-mesh start point instead
                        paintState.lastPointTime = worldTime;

                        // entityApi.save(); // XXX remove these
                      }
                    }
                  }

                  const {pressed} = paintState;
                  if (pressed) {
                    const {gamepads} = pose.getStatus();
                    const gamepad = gamepads[side];

                    if (gamepad) {
                      const {colorWheelMesh} = paintbrushMesh;
                      const {size, notchMesh} = colorWheelMesh;
                      const {axes} = gamepad;

                      notchMesh.position.x = -(size / 2) + (((axes[0] / 2) + 0.5) * size);
                      notchMesh.position.z = (size / 2) - (((axes[1] / 2) + 0.5) * size);

                      const colorHex = colorWheelImg.getColor((axes[0] / 2) + 0.5, (-axes[1] / 2) + 0.5);
                      paintState.color = colorHex;

                      notchMesh.material.color.setHex(colorHex);
                    }
                  }
                });
              };
              render.on('update', _update);

              entityApi._cleanup = () => {
                entityObject.remove(paintbrushMesh);

                _clearMeshes();

                /* const {cancelSave} = entityApi;
                if (cancelSave) {
                  cancelSave();
                } */

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
                case 'paint-id': {
                  entityApi.paintId = newValue;

                  entityApi.ensureConnect();

                  break;
                }
                case 'file': {
                  entityApi.file = newValue;

                  /* entityApi.load();

                  if (!newValue) {
                    const {cancelSave} = entityApi;

                    if (cancelSave) {
                      cancelSave();
                      entityApi.cancelSave = null;
                    }
                  } */

                  break;
                }
                case 'color': {
                  entityApi.color = new THREE.Color(newValue);

                  entityApi.render();

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

const _makeId = () => Math.random().toString(36).substring(7);
const sq = n => Math.sqrt((n * n) + (n * n));
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

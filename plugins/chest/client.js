const {
  NUM_CELLS,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const MAX_ITEMS = 4;
const NUM_POSITIONS_CHUNK = 100 * 1024;
const SIDES = ['left', 'right'];
const dataSymbol = Symbol();

class Chest {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    return;
    const {_archae: archae} = this;
    const {three, render, pose, input, elements, hands, items, animation, utils: {geometry: geometryUtils}} = zeo;
    const {THREE, scene} = three;

    const zeroQuaternion = new THREE.Quaternion();
    const upQuaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 1, 0)
    );
    const chestMaterial = new THREE.MeshBasicMaterial({
      // color: 0xFFFFFF,
      // shininess: 0,
      // shading: THREE.FlatShading,
      vertexColors: THREE.VertexColors,
      // side: THREE.DoubleSide,
    });
    const hoverColor = new THREE.Color(0x2196F3);

    const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
    const _decomposeMatrix = matrix => {
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, rotation, scale);
      return {position, rotation, scale};
    };
    const _sum = a => {
      let result = 0;
      for (let i = 0; i < a.length; i++) {
        const e = a[i];
        result += e;
      }
      return result;
    };
    const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
      for (let i = 0; i < src.length; i++) {
        dst[startIndexIndex + i] = src[i] + startAttributeIndex;
      }
    };

    const worker = new Worker('archae/plugins/chest/build/worker.js');
    const queue = [];
    worker.requestGeometry = () => new Promise((accept, reject) => {
      const buffer = new ArrayBuffer(NUM_POSITIONS_CHUNK * 3 * 4);
      worker.postMessage({
        buffer,
      }, [buffer]);
      queue.push(buffer => {
        accept(buffer);
      });
    });
    worker.onmessage = e => {
      const {data: buffer} = e;
      const cb = queue.shift();
      cb(buffer);
    };

    const _requestChestGeometry = () => worker.requestGeometry()
      .then(chestChunkBuffer => protocolUtils.parseChestChunks(chestChunkBuffer))
      .then(([chestGeometry, lidGeometry]) => ({chestGeometry, lidGeometry}));

    return _requestChestGeometry()
      .then(chestGeometries => {
        worker.terminate();

        const chestEntity = {
          attributes: {
            position: {
              type: 'matrix',
              value: [
                0, 1, 0,
                0, 0, 0, 1,
                1, 1, 1,
              ],
            },
            items: {
              type: 'matrix',
              value: [],
            },
          },
          entityAddedCallback(entityElement) {
            const _makeHoverState = () => ({
              type: null,
            });
            const hoverStates = {
              left: _makeHoverState(),
              right: _makeHoverState(),
            };
            let lidAnimation = null;
            let lidOpen = false;
            const lidQuaternion = new THREE.Quaternion();

            const chestMesh = (() => {
              const {chestGeometry, lidGeometry} = chestGeometries;

              const chestGeometryList = [chestGeometry, lidGeometry];
              const numPositions = _sum(chestGeometryList.map(({positions}) => positions.length));
              const numIndices = _sum(chestGeometryList.map(({indices}) => indices.length));

              const positions = new Float32Array(numPositions);
              const positionAttribute = new THREE.BufferAttribute(positions, 3);
              const colors = new Float32Array(numPositions);
              const colorAttribute = new THREE.BufferAttribute(colors, 3);
              const indices = new Uint32Array(numIndices);
              const indexAttribute = new THREE.BufferAttribute(indices, 1);

              const _rotateGeometry = (geometry, offset, quaternion) => {
                const {positions, colors, indices} = geometry;
                const newPositions = positions.slice();
                const positionAttribute = new THREE.BufferAttribute(newPositions, 3);

                new THREE.Matrix4().makeTranslation(
                  offset.x,
                  offset.y,
                  offset.z
                )
                  .premultiply(new THREE.Matrix4().makeRotationFromQuaternion(quaternion))
                  .premultiply(new THREE.Matrix4().makeTranslation(
                    -offset.x,
                    -offset.y,
                    -offset.z
                  ))
                  .applyToBufferAttribute(positionAttribute);

                return {
                  positions: newPositions,
                  colors: colors,
                  indices: indices,
                };
              };
              const _render = () => {
                let attributeIndex = 0;
                let indexIndex = 0;

                const hoverTypes = (() => {
                  const result = [];
                  SIDES.forEach(side => {
                    const hoverState = hoverStates[side];
                    const {type} = hoverState;
                    if (!result.includes(type)) {
                      result.push(type);
                    }
                  });
                  return result;
                })();
                const _addGeometry = (newGeometry, highlight) => {
                  const {positions: newPositions, colors: newColors, indices: newIndices} = newGeometry;

                  positions.set(newPositions, attributeIndex);
                  if (highlight) {
                    const numColors = colors.length / 3;
                    for (let i = 0; i < numColors; i++) {
                      const baseIndex = i * 3;
                      const color = hoverColor.clone().multiplyScalar(
                        new THREE.Color(
                          newColors[baseIndex + 0],
                          newColors[baseIndex + 1],
                          newColors[baseIndex + 2]
                        ).getHSL().l * 3.5
                      );
                      colors[attributeIndex + baseIndex + 0] = color.r;
                      colors[attributeIndex + baseIndex + 1] = color.g;
                      colors[attributeIndex + baseIndex + 2] = color.b;
                    }
                  } else {
                    colors.set(newColors, attributeIndex);
                  }
                  _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

                  attributeIndex += newPositions.length;
                  indexIndex += newIndices.length;
                };

                _addGeometry(chestGeometry, hoverTypes.includes('chest'));
                _addGeometry(
                  _rotateGeometry(
                    lidGeometry,
                    new THREE.Vector3(
                      0,
                      (lidGeometry.boundingBox[1][1] - lidGeometry.boundingBox[0][1]) / 2,
                      (lidGeometry.boundingBox[1][2] - lidGeometry.boundingBox[0][2]) / 2
                    ),
                    lidQuaternion
                  ),
                  hoverTypes.includes('lid')
                );

                positionAttribute.needsUpdate = true;
                colorAttribute.needsUpdate = true;
                // indexAttribute.needsUpdate = true;
              };
              _render();

              const geometry = new THREE.BufferGeometry();
              geometry.addAttribute('position', positionAttribute);
              geometry.addAttribute('color', colorAttribute);
              geometry.setIndex(indexAttribute);
              geometry.boundingSphere = new THREE.Sphere(
                new THREE.Vector3(
                  0,
                  0,
                  0
                ),
                10
              );

              const material = chestMaterial;

              const mesh = new THREE.Mesh(geometry, material);
              // mesh.frustumCulled = false;

              const grabbable = hands.makeGrabbable('chest', {
                position: mesh.position.toArray(),
                rotation: mesh.quaternion.toArray(),
                scale: mesh.scale.toArray(),
                isGrabbable: p => SIDES.some(side => hoverStates[side].type === 'chest'),
              });
              grabbable.on('update', ({position, rotation, scale}) => {
                mesh.position.fromArray(position);
                mesh.quaternion.fromArray(rotation);
                mesh.scale.fromArray(scale);
                mesh.updateMatrixWorld();

                mesh.updateTrackedItems();
              });
              grabbable.on('release', () => {
                const {position, rotation, scale} = grabbable;
                entityElement.setAttribute('position', JSON.stringify(position.concat(rotation).concat(scale)));
              });
              mesh.grabbable = grabbable;

              const _makeBoxTargetSpec = (type, position, rotation, scale, boundingBox) => {
                const boundingBoxMin = new THREE.Vector3().fromArray(boundingBox[0]);
                const boundingBoxMax = new THREE.Vector3().fromArray(boundingBox[1]);
                const offset = boundingBoxMin.clone().add(boundingBoxMax).divideScalar(2).multiply(scale).applyQuaternion(rotation);
                const newPosition = position.clone().add(offset);
                const size = boundingBoxMax.clone().sub(boundingBoxMin);
                return {
                  type: type,
                  boxTarget: geometryUtils.makeBoxTarget(
                    newPosition,
                    rotation,
                    scale,
                    size
                  ),
                };
              };
              let lastMatrixWorld = new THREE.Matrix4();
              lastMatrixWorld.set(); // force initial update
              mesh.boxTargets = null;
              mesh.updateBoxTargets = () => {
                if (!mesh.matrixWorld.equals(lastMatrixWorld)) {
                  const {position, rotation, scale} = _decomposeObjectMatrixWorld(mesh);

                  mesh.boxTargets = [
                    _makeBoxTargetSpec('chest', position, rotation, scale, chestGeometry.boundingBox),
                    _makeBoxTargetSpec('lid',
                      position,
                      rotation,
                      scale,
                      [
                        [lidGeometry.boundingBox[0][0], lidGeometry.boundingBox[0][1], lidGeometry.boundingBox[0][2]],
                        [lidGeometry.boundingBox[1][0], lidGeometry.boundingBox[0][1] + (lidGeometry.boundingBox[1][2] - lidGeometry.boundingBox[0][2]), lidGeometry.boundingBox[1][2]],
                      ]
                    ),
                  ];
                  lastMatrixWorld.copy(mesh.matrixWorld);
                }
              };

              mesh.needsUpdate = false;
              mesh.update = () => {
                if (mesh.needsUpdate) {
                  _render();

                  mesh.needsUpdate = false;
                }
              };

              let trackedItemIds = [];
              mesh.hasItem = item => trackedItemIds.includes(item.id);
              mesh.canAddItem = item => {
                const {position: itemPosition} = item;
                const {boxTargets: boxTargetSpecs} = mesh;
                return boxTargetSpecs.some(boxTargetSpec => boxTargetSpec.boxTarget.containsPoint(itemPosition)) && trackedItemIds.length < MAX_ITEMS;
              };
              mesh.addItem = item => {
                const {id} = item;
                trackedItemIds.push(id);

                entityElement.setAttribute('items', JSON.stringify(trackedItemIds));
              };
              mesh.removeItem = item => {
                const {id} = item;
                trackedItemIds.splice(trackedItemIds.indexOf(id), 1);

                entityElement.setAttribute('items', JSON.stringify(trackedItemIds));
              };
              mesh.setItems = newTrackedItemIds => {
                trackedItemIds = newTrackedItemIds;
              };
              mesh.updateTrackedItems = () => {
                const assetSize = 0.02 * 12;
                const assetSpacing = 0.02;

                for (let i = 0; i < trackedItemIds.length; i++) {
                  const trackedItemId = trackedItemIds[i];
                  const item = items.getItem(trackedItemId);
                  const {grabbable} = item;
                  grabbable.setState(
                    mesh.position.clone().add(
                      new THREE.Vector3(
                        -(((assetSize * MAX_ITEMS) + (assetSpacing * (MAX_ITEMS - 1))) / 2) + (assetSize / 2) + ((assetSize + assetSpacing) * i),
                        0.2,
                        0
                      ).applyQuaternion(mesh.quaternion)
                    ).toArray(),
                    mesh.quaternion.toArray(),
                    mesh.scale.toArray()
                  );
                }
              };

              mesh.destroy = () => {
                geometry.dispose();

                hands.destroyGrabbable(grabbable);
              };

              return mesh;
            })();
            scene.add(chestMesh);

            const _gripdown = e => {
              const {side} = e;
              const hoverState = hoverStates[side];
              const {type} = hoverState;

              if (type === 'lid') {
                if (!lidOpen) {
                  lidAnimation = animation.makeAnimation(0, 1, 500);
                  lidOpen = true;
                } else {
                  lidAnimation = animation.makeAnimation(1, 0, 500);
                  lidOpen = false;
                }

                e.stopImmediatePropagation();
              }
            };
            input.on('gripdown', _gripdown);

            const _grab = e => {
              const {item} = e;

              if (chestMesh.hasItem(item)) {
                chestMesh.removeItem(item);
              }
            };
            items.on('grab', _grab);
            const _release = e => {
              const {item} = e;

              if (chestMesh.canAddItem(item)) {
                chestMesh.addItem(item);
                chestMesh.updateTrackedItems();
              }
            };
            items.on('release', _release);

            const _update = () => {
              const _updateHover = () => {
                const {grabbable} = chestMesh;

                if (!grabbable.isGrabbed()) {
                  const {gamepads} = pose.getStatus();
                  const {chestGeometry, lidGeometry} = chestGeometries;
                  chestMesh.updateBoxTargets();
                  const {boxTargets: boxTargetSpecs} = chestMesh;

                  SIDES.forEach(side => {
                    const gamepad = gamepads[side];
                    const {worldPosition: controllerPosition} = gamepad;
                    const hoverState = hoverStates[side];

                    let type = null;
                    for (let i = 0; i < boxTargetSpecs.length; i++) {
                      const boxTargetSpec = boxTargetSpecs[i];
                      const {boxTarget} = boxTargetSpec;

                      if (boxTarget.containsPoint(controllerPosition)) {
                        type = boxTargetSpec.type;
                        break;
                      }
                    }
                    if (hoverState.type !== type) {
                      hoverState.type = type;
                      chestMesh.needsUpdate = true;
                    }
                  });
                } else {
                  SIDES.forEach(side => {
                    const hoverState = hoverStates[side];
                    hoverState.type = null;
                  });
                }
              };
              const _updateLidAnimation = () => {
                if (lidAnimation) {
                  const value = lidAnimation.getValue();
                  lidQuaternion.copy(zeroQuaternion.clone().slerp(upQuaternion, value));
                  chestMesh.needsUpdate = true;

                  if (lidAnimation.isDone()) {
                    lidAnimation = null;
                  }
                }
              };
              const _updateMesh = () => {
                chestMesh.update();
              };

              _updateHover();
              _updateLidAnimation();
              _updateMesh();
            };
            render.on('update', _update);

            const _cleanup = () => {
              scene.remove(chestMesh);
              chestMesh.destroy();

              chestMaterial.dispose();

              input.removeListener('gripdown', _gripdown);
              items.on('grab', _grab);
              items.on('release', _release);
              render.removeListener('update', _update);
            };

            entityElement[dataSymbol] = {
              chestMesh,
              _cleanup,
            };
          },
          entityRemovedCallback(entityElement) {
            const {[dataSymbol]: data} = entityElement;

            data._cleanup();
          },
          entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
            const {[dataSymbol]: data} = entityElement;

            switch (name) {
              case 'position': {
                if (newValue) {
                  const {chestMesh} = data;
                  const {grabbable} = chestMesh;
                  const position = newValue.slice(0, 3);
                  const rotation = newValue.slice(3, 7);
                  const scale = newValue.slice(7, 10);
                  grabbable.setState(position, rotation, scale);

                  chestMesh.updateTrackedItems();
                }

                break;
              }
              case 'items': {
                const {chestMesh} = data;
                chestMesh.setItems(newValue);
                chestMesh.updateTrackedItems();

                break;
              }
            }
          },
        };
        elements.registerEntity(this, chestEntity);

        this._cleanup = () => {
          chestMaterial.dispose();

          elements.unregisterEntity(this, chestEntity);
        };
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Chest;

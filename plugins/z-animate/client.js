const MAX_NUM_POINTS = 4 * 1024;
const POINT_FRAME_RATE = 60;
const DIRTY_TIME = 1000;

const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];
const SIDES = ['left', 'right'];

class ZAnimate {
  mount() {
    const {three: {THREE, scene}, input, elements, render, pose, world, utils: {function: funUtils, geometry: geometryUtils}} = zeo;

    const worldElement = elements.getWorldElement();

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

    const animateComponent = {
      selector: 'animate[position]',
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
          value: [0.2, 0.2, 0.2],
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();
        const entityObject = entityElement.getObject();

        entityApi.entityElement = entityElement;

        const toolMesh = (() => {
          const geometry = (() => {
            const coreGeometries = [
              new THREE.BoxBufferGeometry(0.02, 0.1, 0.02),
              new THREE.BoxBufferGeometry(0.1, 0.02, 0.02),
            ];
            const tipGeometry = new THREE.CylinderBufferGeometry(0, sq(0.005), 0.02, 4, 1)
              .applyMatrix(new THREE.Matrix4().makeRotationY(-Math.PI * (3 / 12)))
              .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -0.05 - (0.02 / 2)));

            return geometryUtils.concatBufferGeometry(coreGeometries.concat(tipGeometry));
          })();
          const material = new THREE.MeshPhongMaterial({
            color: 0x808080,
          });

          const mesh = new THREE.Mesh(geometry, material);
          return mesh;
        })();
        entityObject.add(toolMesh);

        entityApi.position = DEFAULT_MATRIX;
        entityApi.align = () => {
          const {position} = entityApi;

          entityObject.position.set(position[0], position[1], position[2]);
          entityObject.quaternion.set(position[3], position[4], position[5], position[6]);
          entityObject.scale.set(position[7], position[8], position[9]);
        };

        entityApi.load = () => {
          const {file} = entityApi;

          file.read({ // XXX handle the no-file case
            type: 'arrayBuffer',
          })
            .then(arrayBuffer => {
              const array = new Float32Array(arrayBuffer);
              let frameIndex = 0;
              while (frameIndex < array.length) {
                const numPoints = Math.floor(array[frameIndex]);
                const positionSize = numPoints * 3;

                const positions = array.slice(frameIndex + 1, frameIndex + 1 + positionSize);

                const mesh = _makeAnimateMesh({
                  positions,
                  numPoints,
                });
                scene.add(mesh);
                meshes.push(mesh);

                frameIndex += 1 + positionSize;
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
                    const broadcastEvent = new CustomEvent('broadcast', {
                      detail: {
                        type: 'animate.update',
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

        const _makeAnimateMesh = ({
          positions = new Float32Array(MAX_NUM_POINTS * 3),
          numPoints = 0,
        } = {}) => {
          const geometry = new THREE.BufferGeometry();
          geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
          geometry.setDrawRange(0, numPoints);

          const material = new THREE.LineBasicMaterial({
            color: 0x0000FF,
          });

          const mesh = new THREE.Line(geometry, material);
          mesh.lastPoint = numPoints;
          mesh.getBuffer = () => {
            const {lastPoint} = mesh;
            const positionSize = lastPoint * 3;
            const array = new Float32Array(
              1 + // length
              positionSize // position
            );
            array[0] = lastPoint; // length
            array.set(positions.slice(0, positionSize), 1); // position

            return new Uint8Array(array.buffer);
          };

          return mesh;
        };
        let mesh = null;

        const meshes = [];

        const _makeAnimateState = () => ({
          grabbed: false,
          drawing: false,
          lastPointTime: null,
        });
        const animateStates = {
          left: _makeAnimateState(),
          right: _makeAnimateState(),
        };
        
        const _grab = e => {
          const {detail: {side}} = e;
          const animateState = animateStates[side];

          animateState.grabbed = true;
        };
        entityElement.addEventListener('grab', _grab);
        const _release = e => {
          const {detail: {side}} = e;
          const animateState = animateStates[side];

          animateState.grabbed = false;
          animateState.drawing = false;
        };
        entityElement.addEventListener('release', _release);
        const _triggerdown = e => {
          const {side} = e;
          const {file} = entityApi;

          if (file) {
            const animateState = animateStates[side];
            const {grabbed} = animateState;

            if (grabbed) {
              animateState.drawing = true;

              const numDrawing = funUtils.sum(SIDES.map(side => Number(animateStates[side].drawing)));
              if (numDrawing === 1) {
                mesh = _makeAnimateMesh();

                scene.add(mesh);
              }
            }
          }
        };
        input.on('triggerdown', _triggerdown);
        const _triggerup = e => {
          const {side} = e;
          const {file} = entityApi;

          if (file) {
            const animateState = animateStates[side];
            const {grabbed} = animateState;

            if (grabbed) {
              animateState.drawing = false;

              const numDrawing = funUtils.sum(SIDES.map(side => Number(animateStates[side].drawing)));
              if (numDrawing === 0) {
                meshes.push(mesh);

                mesh = null;
              }
            }
          }
        };
        input.on('triggerup', _triggerup);

        const _update = () => {
          const {gamepads} = pose.getStatus();
          const worldTime = world.getWorldTime();

          const _getFrame = t => Math.floor(t / POINT_FRAME_RATE);

          SIDES.forEach(side => {
            const animateState = animateStates[side];
            const {drawing} = animateState;

            if (drawing) {
              let {lastPoint} = mesh;

              if (lastPoint < MAX_NUM_POINTS) {
                const {lastPointTime} = animateState;
                const lastFrame = _getFrame(lastPointTime);
                const currentPointTime = worldTime;
                const currentFrame = _getFrame(currentPointTime);

                if (currentFrame > lastFrame) {
                  const positionsAttribute = mesh.geometry.getAttribute('position');

                  const positions = positionsAttribute.array;

                  const gamepad = gamepads[side];
                  const {position: controllerPosition, rotation: controllerRotation} = gamepad;

                  const toolTipPosition = controllerPosition.clone()
                    .add(new THREE.Vector3(0, 0, -0.05 - (0.02 / 2)).applyQuaternion(controllerRotation));

                  // positions
                  const basePositionIndex = lastPoint * 3;
                  positions[basePositionIndex + 0] = toolTipPosition.x;
                  positions[basePositionIndex + 1] = toolTipPosition.y;
                  positions[basePositionIndex + 2] = toolTipPosition.z;

                  positionsAttribute.needsUpdate = true;

                  lastPoint++;
                  mesh.lastPoint = lastPoint;

                  const {geometry} = mesh;
                  geometry.setDrawRange(0, lastPoint);

                  animateState.lastPointTime = lastPointTime;

                  entityApi.save();
                }
              }
            }
          });
        };
        render.on('update', _update);

        entityApi._cleanup = () => {
          entityObject.remove(toolMesh);

          if (mesh) {
            scene.remove(mesh);
          }
          for (let i = 0; i < meshes.length; i++) {
            const mesh = meshes[i];
            scene.remove(mesh);
          }

          entityElement.removeEventListener('grab', _grab);
          entityElement.removeEventListener('release', _release);

          input.removeListener('triggerdown', _triggerdown);
          input.removeListener('triggerup', _triggerup);

          const {cancelSave} = entityApi;
          if (cancelSave) {
            cancelSave();
          }
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
    elements.registerComponent(this, animateComponent);

    this._cleanup = () => {
      elements.unregisterComponent(this, paperComponent);
    };
  }

  unmount() {
    this._cleanup();
  }
}

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

module.exports = ZAnimate;

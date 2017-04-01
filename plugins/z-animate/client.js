const mod = require('mod-loop');

const MAX_NUM_POINTS = 4 * 1024;
const POINT_FRAME_RATE = 30;
const POINT_FRAME_TIME = 1000 / POINT_FRAME_RATE;
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
        play: {
          type: 'checkbox',
          value: true,
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

          if (file) {
            file.read({ // XXX handle the no-file case
              type: 'arrayBuffer',
            })
              .then(arrayBuffer => {
                const array = new Float32Array(arrayBuffer);
                const numPoints = Math.floor(array[0]);
                const positionSize = numPoints * 3;
                const rotationSizeSize = numPoints * 4;

                const positions = array.slice(1, 1 + positionSize);
                const rotations = array.slice(1 + positionSize, 1 + positionSize + rotationSizeSize);

                if (committedMesh) {
                  scene.remove(committedMesh);
                }
                committedMesh = _makeAnimateMesh({
                  positions,
                  rotations,
                  numPoints,
                });
                scene.add(committedMesh);
              });
          } else {
            if (mesh) {
              scene.remove(mesh);
              mesh = null;
            }

            SIDES.forEach(side => {
              const animateState = animateStates[side];
              animateState.drawing = false;
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

              const b = committedMesh.getBuffer();

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

        let playing = false;
        let playStartTime = 0;
        entityApi.play = () => {
          playing = true;
          playStartTime = 0;
        };
        entityApi.pause = () => {
          playing = false;
        };

        const _makeAnimateMesh = ({
          positions = new Float32Array(MAX_NUM_POINTS * 3),
          rotations = new Float32Array(MAX_NUM_POINTS * 4),
          numPoints = 0,
        } = {}) => {
          const geometry = new THREE.BufferGeometry();
          geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
          geometry.rotations = rotations;
          geometry.setDrawRange(0, numPoints);

          const material = new THREE.LineBasicMaterial({
            color: 0x0000FF,
          });

          const mesh = new THREE.Line(geometry, material);
          mesh.visible = numPoints > 0;
          mesh.lastPoint = numPoints;
          mesh.getBuffer = () => {
            const {lastPoint} = mesh;
            const positionSize = lastPoint * 3;
            const rotationSize = lastPoint * 4;
            const array = new Float32Array(
              1 + // length
              positionSize + // position
              rotationSize // rotation
            );
            array[0] = lastPoint; // length
            array.set(positions.slice(0, positionSize), 1); // position
            array.set(rotations.slice(0, rotationSize), 1 + positionSize); // rotation

            return new Uint8Array(array.buffer);
          };

          return mesh;
        };

        let mesh = null;
        let committedMesh = null;

        const playMesh = (() => {
          const geometry = new THREE.CylinderBufferGeometry(0, sq(0.005), 0.02, 4, 1)
            .applyMatrix(new THREE.Matrix4().makeRotationY(-Math.PI * (3 / 12)))
            .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
          const material = new THREE.MeshPhongMaterial({
            color: 0xFFFF00,
            shading: THREE.FlatShading,
          });

          const mesh = new THREE.Mesh(geometry, material);
          mesh.visible = false;
          return mesh;
        })();
        scene.add(playMesh);

        const _makeAnimateState = () => ({
          grabbed: false,
          drawing: false,
          lastPointTime: 0,
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
              animateState.lastPointTime = world.getWorldTime() - POINT_FRAME_TIME;

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
                if (committedMesh) {
                  scene.remove(committedMesh);
                }

                committedMesh = mesh;
                scene.add(committedMesh);

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
                const startFrame = _getFrame(lastPointTime);
                const endFrame = _getFrame(worldTime);

                if (endFrame > startFrame) {
                  const {geometry} = mesh;
                  const positionsAttribute = geometry.getAttribute('position');
                  const positions = positionsAttribute.array;
                  const {rotations} = geometry;

                  const gamepad = gamepads[side];
                  const {position: controllerPosition, rotation: controllerRotation} = gamepad;

                  const toolTipPosition = controllerPosition.clone()
                    .add(new THREE.Vector3(0, 0, -0.05 - (0.02 / 2)).applyQuaternion(controllerRotation));
                  const toolTipRotation = controllerRotation;

                  for (let currentFrame = startFrame; currentFrame < endFrame; currentFrame++) {
                    // positions
                    const basePositionIndex = lastPoint * 3;
                    positions[basePositionIndex + 0] = toolTipPosition.x;
                    positions[basePositionIndex + 1] = toolTipPosition.y;
                    positions[basePositionIndex + 2] = toolTipPosition.z;

                    // rotations
                    const baseRotationIndex = lastPoint * 4;
                    rotations[baseRotationIndex + 0] = toolTipRotation.x;
                    rotations[baseRotationIndex + 1] = toolTipRotation.y;
                    rotations[baseRotationIndex + 2] = toolTipRotation.z;
                    rotations[baseRotationIndex + 3] = toolTipRotation.w;

                    lastPoint++;
                  }

                  positionsAttribute.needsUpdate = true;

                  mesh.lastPoint = lastPoint;
                  if (!mesh.visible) {
                    mesh.visible = true;
                  }

                  geometry.setDrawRange(0, lastPoint);

                  animateState.lastPointTime = worldTime;

                  entityApi.save();
                }
              }
            }
          });

          if (playing) {
            if (committedMesh) {
              const {lastPoint} = committedMesh;

              if (lastPoint > 0) {
                const currentFrame = mod(_getFrame(worldTime - playStartTime), lastPoint);

                const {geometry} = committedMesh;
                const positions = geometry.getAttribute('position').array;
                const positionBaseIndex = currentFrame * 3;
                const positionArray = positions.slice(positionBaseIndex, positionBaseIndex + 3);
                playMesh.position.fromArray(positionArray);

                const {rotations} = geometry;
                const rotationBaseIndex = currentFrame * 4;
                const rotationArray = rotations.slice(rotationBaseIndex, rotationBaseIndex + 4);
                playMesh.quaternion.fromArray(rotationArray);

                if (!playMesh.visible) {
                  playMesh.visible = true;
                }
              }
            }
          } else {
            if (playMesh.visible) {
              playMesh.visible = false;
            }
          }
        };
        render.on('update', _update);

        entityApi._cleanup = () => {
          entityObject.remove(toolMesh);
          scene.remove(playMesh);

          if (mesh) {
            scene.remove(mesh);
          }
          if (committedMesh) {
            scene.remove(committedMesh);
          }

          entityElement.removeEventListener('grab', _grab);
          entityElement.removeEventListener('release', _release);

          input.removeListener('triggerdown', _triggerdown);
          input.removeListener('triggerup', _triggerup);

          const {cancelSave} = entityApi;
          if (cancelSave) {
            cancelSave();
          }

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
          case 'play': {
            if (newValue) {
              entityApi.play();
            } else {
              entityApi.pause();
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

module.exports = ZAnimate;

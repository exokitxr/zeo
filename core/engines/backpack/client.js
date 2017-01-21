const SIDES = ['left', 'right'];

const DEFAULT_GRAB_DISTANCE = 0.12;

class Backpack {
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
      '/core/engines/three',
      '/core/engines/input',
      '/core/engines/webvr',
      '/core/engines/rend',
      '/core/engines/hands',
      '/core/engines/tags',
    ]).then(([
      three,
      input,
      webvr,
      rend,
      hands,
      tags,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;

        const numItems = 4;

        const _decomposeObjectWorldMatrix = object => {
          const {matrixWorld} = object;
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrixWorld.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        const _makeHoverState = () => ({
          target: null,
        });
        const hoverStates = {
          left: _makeHoverState(),
          right: _makeHoverState(),
        };
        const _makeGrabState = () => ({
          grabber: null,
        });
        const grabStates = {
          left: _makeGrabState(),
          right: _makeGrabState(),
        };
        const backpackState = {
          visible: true,
        };

        const mesh = (() => {
          const width = 0.5;
          const height = 0.1;
          const depth = 0.35;
          const thickness = 0.01;

          const outerMaterial = new THREE.MeshPhongMaterial({
            color: 0x333333,
          });
          const innerMaterial = new THREE.MeshPhongMaterial({
            color: 0x795548,
          });

          const object = new THREE.Mesh();
          object.position.set(1, 1, 1);
          object.visible = false;

          const bottom = new THREE.Mesh(
            new THREE.BoxBufferGeometry(width, thickness, depth)
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, -(height / 2), 0))
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(depth / 2) - (0.05 / 2) - (thickness / 2))),
            outerMaterial
          );
          object.add(bottom);

          const top = new THREE.Mesh(
            new THREE.BoxBufferGeometry(width, thickness, depth)
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, depth / 2))
              .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 4))
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, height / 2, -(depth / 2)))
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, -(thickness / 4), -(depth / 2) - (0.05 / 2) - (thickness / 2))),
            outerMaterial
          );
          object.add(top);

          const left = new THREE.Mesh(
            new THREE.BoxBufferGeometry(thickness, height - thickness, depth)
              .applyMatrix(new THREE.Matrix4().makeTranslation(-(width / 2) + (thickness / 2), 0, 0))
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(depth / 2) - (0.05 / 2) - (thickness / 2))),
            outerMaterial
          );
          object.add(left);

          const right = new THREE.Mesh(
            new THREE.BoxBufferGeometry(thickness, height - thickness, depth)
              .applyMatrix(new THREE.Matrix4().makeTranslation((width / 2) - (thickness / 2), 0, 0))
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(depth / 2) - (0.05 / 2) - (thickness / 2))),
            outerMaterial
          );
          object.add(right);

          const back = new THREE.Mesh(
            new THREE.BoxBufferGeometry(width, height - thickness, thickness)
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(depth / 2) + (thickness / 2)))
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(depth / 2) - (0.05 / 2) - (thickness / 2))),
            outerMaterial
          );
          object.add(back);

          const front = new THREE.Mesh(
            new THREE.BoxBufferGeometry(width, height - thickness, thickness)
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, (depth / 2)))
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(depth / 2) - (0.05 / 2) - (thickness / 2))),
            outerMaterial
          );
          object.add(front);

          const handleFront = new THREE.Mesh(
            new THREE.BoxBufferGeometry(0.1, 0.01, 0.01)
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, (depth / 2) + 0.05))
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(depth / 2) - (0.05 / 2) - (thickness / 2))),
            outerMaterial
          );
          object.add(handleFront);

          const handleLeft = new THREE.Mesh(
            new THREE.BoxBufferGeometry(0.01, 0.01, 0.05)
              .applyMatrix(new THREE.Matrix4().makeTranslation(-(0.1 / 2) - (0.01 / 2), 0, (depth / 2) + (0.05 / 2) + (0.01 / 2)))
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(depth / 2) - (0.05 / 2) - (thickness / 2))),
            outerMaterial
          );
          object.add(handleLeft);

          const handleRight = new THREE.Mesh(
            new THREE.BoxBufferGeometry(0.01, 0.01, 0.05)
              .applyMatrix(new THREE.Matrix4().makeTranslation((0.1 / 2) + (0.01 / 2), 0, (depth / 2) + (0.05 / 2) + (0.01 / 2)))
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(depth / 2) - (0.05 / 2) - (thickness / 2))),
            outerMaterial
          );
          object.add(handleRight);

          const handleBoxMesh = (() => {
            const geometry = new THREE.BoxBufferGeometry(0.12, 0.05, 0.05);
            const material = new THREE.MeshBasicMaterial({
              color: 0x0000FF,
              wireframe: true,
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.visible = false;
            return mesh;
          })();
          object.add(handleBoxMesh);
          object.handleBoxMesh = handleBoxMesh;

          const itemBoxMeshes = (() => {
            const _makeItemBoxMesh = index => {
              const size = 0.075;
              const padding = size / 2;

              const geometry = new THREE.BoxBufferGeometry(size, size, size);
              const material = new THREE.MeshBasicMaterial({
                color: 0x808080,
                wireframe: true,
              });

              const mesh = new THREE.Mesh(geometry, material);
              mesh.position.x = -(((size * numItems) + (padding * (numItems - 1))) / 2) + ((size + padding) * index) + (size / 2);
              mesh.position.y = 0.1;
              mesh.position.z = -(size * 2);
              return mesh;
            };

            const result = Array(numItems);
            for (let i = 0; i < numItems; i++) {
              result[i] = _makeItemBoxMesh(i);
            }
            return result;
          })();
          itemBoxMeshes.forEach(itemBoxMesh => {
            object.add(itemBoxMesh);
          });
          object.itemBoxMeshes = itemBoxMeshes;

          return object;
        })();
        scene.add(mesh);

        const _update = e => {
          const _updateTarget = () => {
            const status = webvr.getStatus();
            const {gamepads} = status;
            const {visible: backbackVisible} = backpackState;

            SIDES.forEach(side => {
              const hoverState = hoverStates[side];
              const grabState = grabStates[side];
              const gamepad = gamepads[side];

              if (gamepad) {
                const target = (() => {
                  const {grabber} = grabState;
                  const {position: controllerPosition, rotation: controllerRotation} = gamepad;

                  const _isBehindCamera = position => {
                    const nearPlaneDistance = 1;
                    const farPlaneDistance = 15;

                    const nearPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
                      new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion),
                      camera.position
                    );
                    const farPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
                      new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion),
                      camera.position.clone().add(new THREE.Vector3(0, 0, farPlaneDistance).applyQuaternion(camera.quaternion))
                    );

                    const closestNearPoint = nearPlane.projectPoint(position);
                    const closestFarPoint = farPlane.projectPoint(position);

                    const nearLine = new THREE.Line3(position, closestNearPoint);
                    const farLine = new THREE.Line3(position, closestFarPoint);

                    const nearDistance = nearLine.distance();
                    const farDistance = farLine.distance();

                    return nearDistance < nearPlaneDistance && farDistance < farPlaneDistance;
                  };

                  const _isBackTarget = () => _isBehindCamera(controllerPosition);
                  const _getHandleOrItemTarget = () => {
                    const validTargets = [];

                    if (!grabber && backbackVisible) {
                      const distance = controllerPosition.distanceTo(mesh.position);

                      if (distance < DEFAULT_GRAB_DISTANCE) {
                        validTargets.push({
                          type: 'handle',
                          distance,
                        });
                      }
                    }

                    const {itemBoxMeshes} = mesh;
                    for (let i = 0; i < numItems; i++) {
                      const itemBoxMesh = itemBoxMeshes[i];
                      const {position} = _decomposeObjectWorldMatrix(itemBoxMesh);
                      const distance = controllerPosition.distanceTo(position);
                      if (distance < DEFAULT_GRAB_DISTANCE) {
                        validTargets.push({
                          type: 'item',
                          index: i,
                          distance,
                        });
                      }
                    }

                    if (validTargets.length > 0) {
                      const closestTarget = validTargets.sort((a, b) => a.distance - b.distance)[0];
                      const {type} = closestTarget;

                      if (type === 'handle') {
                        return 'handle';
                      } else if (type === 'item') {
                        const {index} = closestTarget;
                        return 'item:' + index;
                      } else {
                        return null;
                      }
                    } else {
                      return null;
                    }
                  };

                  const handleOrItemTarget = _getHandleOrItemTarget();
                  if (handleOrItemTarget !== null) {
                    return handleOrItemTarget;
                  } else if (_isBackTarget()) {
                    return 'back';
                  } else {
                    return null;
                  }
                })();
                hoverState.target = target;
              }
            });
          };
          const _updateBoxMeshes = () => {
            const _isHandleTarget = () => SIDES.some(side => {
              const hoverState = hoverStates[side];
              const {target} = hoverState;
              return target === 'handle';
            });
            const _isItemTarget = index => SIDES.some(side => {
              const hoverState = hoverStates[side];
              const {target} = hoverState;
              const match = target !== null ? target.match(/^item:([0-9]+)$/) : null;

              if (match) {
                const matchIndex = parseInt(match[1], 10);
                return matchIndex === index;
              } else {
                return false;
              }
            });

            const isHandleTarget = _isHandleTarget();
            const {handleBoxMesh} = mesh;
            if (isHandleTarget && !handleBoxMesh.visible) {
              handleBoxMesh.visible = true;
            } else if (!isHandleTarget && handleBoxMesh.visible) {
              handleBoxMesh.visible = false;
            }

            const {itemBoxMeshes} = mesh;
            for (let i = 0; i < numItems; i++) {
              itemBoxMeshes[i].material.color = new THREE.Color(_isItemTarget(i) ? 0x0000FF : 0x808080);
            }
          };

          _updateTarget();
          _updateBoxMeshes();
        };
        rend.on('update', _update);

        const _gripdown = e => {
          const {side} = e;
          const hoverState = hoverStates[side];
          const {target} = hoverState;

          if (target === 'back' || target == 'handle') {
            const grabber = hands.grab(side, mesh);
            grabber.on('update', ({position, rotation}) => {
              mesh.position.copy(position);
              mesh.quaternion.copy(rotation);
            });
            grabber.on('release', ({position, rotation}) => {
              const {target} = hoverState;
              if (target === 'back') {
                mesh.visible = false;
                backpackState.visible = false;
              }

              grabState.grabber = null;
            });

            const grabState = grabStates[side];
            grabState.grabber = grabber;

            mesh.visible = true;
            backpackState.visible = true;
          }
        };
        input.on('gripdown', _gripdown);
        const _gripup = e => {
          const {side} = e;

          const grabState = grabStates[side];
          const {grabber: localGrabber} = grabState;
          if (localGrabber) {
            localGrabber.release();
          }

          const handsGrabber = hands.peek(side);
          if (handsGrabber) {
            const {object: handsGrabberObject} = handsGrabber;

            if (tags.isTag(handsGrabberObject)) {
              const tagMesh = handsGrabberObject;

              handsGrabber.release();

              const hoverState = hoverStates[side];
              const {target} = hoverState;
              const match = target !== null ? target.match(/^item:([0-9]+)$/) : null;
              if (match) {
                const {itemBoxMeshes} = mesh;
                const index = parseInt(match[1], 10);
                const itemBoxMesh = itemBoxMeshes[index];

                const {position, rotation} = _decomposeObjectWorldMatrix(itemBoxMesh);
                tagMesh.position.copy(position);
                tagMesh.quaternion.copy(rotation);
              }
            }
          }
        };
        input.on('gripup', _gripup, {
          priority: 1,
        });

        this._cleanup = () => {
          scene.remove(mesh);

          rend.removeListener('update', _update);
          input.removeListener('gripdown', _gripdown);
          input.removeListener('gripup', _gripup);
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Backpack;

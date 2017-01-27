const SIDES = ['left', 'right'];

const DEFAULT_GRAB_DISTANCE = 0.12;

class Inventory {
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

        const _decomposeObjectMatrixWorld = object => {
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

        const mesh = (() => {
          const object = new THREE.Object3D();
          object.position.y = -0.25;
          object.position.z = -0.25;
          object.visible = false;

          const itemMeshes = (() => {
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
          itemMeshes.forEach(itemMesh => {
            object.add(itemMesh);
          });
          object.itemMeshes = itemMeshes;

          return object;
        })();
        rend.addMenuMesh('inventoryMesh', mesh);

        const _update = e => {
          const _updateTarget = () => {
            const status = webvr.getStatus();
            const {gamepads} = status;

            SIDES.forEach(side => {
              const hoverState = hoverStates[side];
              const grabState = grabStates[side];
              const gamepad = gamepads[side];

              if (gamepad) {
                const target = (() => {
                  const {grabber} = grabState;
                  const {position: controllerPosition, rotation: controllerRotation} = gamepad;

                  const _getItemTarget = () => {
                    const validTargets = [];

                    const {itemMeshes} = mesh;
                    for (let i = 0; i < numItems; i++) {
                      const itemMesh = itemMeshes[i];
                      const {position} = _decomposeObjectMatrixWorld(itemMesh);
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

                  const itemTarget = _getItemTarget();
                  if (itemTarget !== null) {
                    return itemTarget;
                  } else {
                    return null;
                  }
                })();
                hoverState.target = target;
              }
            });
          };
          const _updateBoxMeshes = () => {
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

            const {itemMeshes} = mesh;
            for (let i = 0; i < numItems; i++) {
              itemMeshes[i].material.color = new THREE.Color(_isItemTarget(i) ? 0x0000FF : 0x808080);
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
                const index = parseInt(match[1], 10);
                const {itemMeshes} = mesh;
                const itemMesh = itemMeshes[index];

                itemMesh.add(tagMesh);
                tagMesh.position.copy(new THREE.Vector3());
                tagMesh.quaternion.copy(new THREE.Quaternion());
                tagMesh.scale.set(1, 1, 1);
              }
            }
          }
        };
        input.on('gripup', _gripup, {
          priority: 1,
        });

        this._cleanup = () => {
          rend.removeMenuMesh(mesh);

          rend.removeListener('update', _update);
          input.removeListener('gripdown', _gripdown);
          input.removeListener('gripup', _gripup);
        };

        const _getMesh = () => mesh;

        return {
          getMesh: _getMesh,
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Inventory;

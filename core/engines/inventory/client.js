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
      '/core/engines/hub',
      '/core/engines/three',
      '/core/engines/input',
      '/core/engines/webvr',
      '/core/engines/rend',
      '/core/engines/hands',
      '/core/engines/tags',
    ]).then(([
      hub,
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
          index: null,
        });
        const hoverStates = {
          left: _makeHoverState(),
          right: _makeHoverState(),
        };

        const mesh = (() => {
          const object = new THREE.Object3D();
          object.position.y = -0.25;
          object.position.z = -0.25;
          object.visible = false;

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

              let itemMesh = null;
              mesh.setItemMesh = newItemMesh => {
                mesh.add(newItemMesh);
                itemMesh = newItemMesh;
              };
              mesh.getItemMesh = () => itemMesh;

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
        rend.addMenuMesh('inventoryMesh', mesh);

        const _update = e => {
          const _updateTarget = () => {
            const status = webvr.getStatus();
            const {gamepads} = status;

            SIDES.forEach(side => {
              const hoverState = hoverStates[side];
              const gamepad = gamepads[side];

              if (gamepad) {
                const index = (() => {
                  const {position: controllerPosition, rotation: controllerRotation} = gamepad;

                  const validTargets = [];

                  const {itemBoxMeshes} = mesh;
                  for (let i = 0; i < numItems; i++) {
                    const itemBoxMesh = itemBoxMeshes[i];
                    const {position} = _decomposeObjectMatrixWorld(itemBoxMesh);
                    const distance = controllerPosition.distanceTo(position);
                    if (distance < DEFAULT_GRAB_DISTANCE) {
                      validTargets.push({
                        index: i,
                        distance,
                      });
                    }
                  }

                  if (validTargets.length > 0) {
                    const closestTarget = validTargets.sort((a, b) => a.distance - b.distance)[0];
                    const {index} = closestTarget;
                    return index;
                  } else {
                    return null;
                  }
                })();
                hoverState.index = index;
              }
            });
          };
          const _updateBoxMeshes = () => {
            const _isHovered = testIndex => SIDES.some(side => {
              const hoverState = hoverStates[side];
              const {index} = hoverState;
              return index === testIndex;
            });

            const {itemBoxMeshes} = mesh;
            for (let i = 0; i < numItems; i++) {
              itemBoxMeshes[i].material.color = new THREE.Color(_isHovered(i) ? 0x0000FF : 0x808080);
            }
          };

          _updateTarget();
          _updateBoxMeshes();
        };
        rend.on('update', _update);

        const _gripdown = e => {
          const {side} = e;
          const hoverState = hoverStates[side];
          const {index} = hoverState;

          if (index !== null) {
            const {itemBoxMeshes} = mesh;
            const itemBoxMesh = itemBoxMeshes[index];
            const tagMesh = itemBoxMesh.getItemMesh();

            if (tagMesh) {
              tags.grabTag(side, tagMesh);

              hub.setUserStateInventoryItem(index, null);

              e.stopImmediatePropagation(); // so tags engine doesn't pick it up
            }
          }
        };
        input.on('gripdown', _gripdown, {
          priority: 1,
        });
        const _gripup = e => {
          const {side} = e;

          const handsGrabber = hands.peek(side);
          if (handsGrabber) {
            const {object: handsGrabberObject} = handsGrabber;

            if (tags.isTag(handsGrabberObject)) {
              const hoverState = hoverStates[side];
              const {index} = hoverState;

              if (index !== null) {
                const {itemBoxMeshes} = mesh;
                const itemBoxMesh = itemBoxMeshes[index];
                const oldTagMesh = itemBoxMesh.getItemMesh();

                if (!oldTagMesh) {
                  const newTagMesh = handsGrabberObject;

                  handsGrabber.release();

                  itemBoxMesh.setItemMesh(newTagMesh);
                  newTagMesh.position.copy(new THREE.Vector3());
                  newTagMesh.quaternion.copy(new THREE.Quaternion());
                  newTagMesh.scale.set(1, 1, 1);

                  const {item} = newTagMesh;
                  hub.setUserStateInventoryItem(index, item);

                  e.stopImmediatePropagation(); // so tags engine doesn't pick it up
                }
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

        // const _getMesh = () => mesh;

        return {
          // getMesh: _getMesh,
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Inventory;

const DEFAULT_GRAB_DISTANCE = 0.12;
const NUM_ITEMS = 9;
const NUM_ITEMS_PER_ROW = 3;
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const SIDES = ['left', 'right'];

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

        const _decomposeObjectMatrixWorld = object => {
          const {matrixWorld} = object;
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrixWorld.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        const zeroVector = new THREE.Vector3(0, 0, 0);
        const zeroQuaternion = new THREE.Quaternion();
        const oneVector = new THREE.Vector3(1, 1, 1);

        const _makeHoverState = () => ({
          hovered: false,
          targetItemIndex: -1,
        });
        const hoverStates = {
          left: _makeHoverState(),
          right: _makeHoverState(),
        };

        const mesh = (() => {
          const object = new THREE.Mesh();
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
              const xIndex = index % NUM_ITEMS_PER_ROW;
              mesh.position.x = -(((size * NUM_ITEMS_PER_ROW) + (padding * (NUM_ITEMS_PER_ROW - 1))) / 2) + ((size + padding) * xIndex) + (size / 2);
              const yIndex = Math.floor(index / NUM_ITEMS_PER_ROW);
              mesh.position.y = (size + padding) - (yIndex * (size + padding));
              // mesh.position.z = -0.5;
              return mesh;
            };

            const result = Array(NUM_ITEMS);
            for (let i = 0; i < NUM_ITEMS; i++) {
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
          const _updateHoverStates = () => {
            const status = webvr.getStatus();
            const {gamepads} = status;

            SIDES.forEach(side => {
              const hoverState = hoverStates[side];
              const gamepad = gamepads[side];

              if (gamepad) {
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
                const _getClosestItemMeshIndex = position => {
                  const {itemBoxMeshes} = mesh;
                  const itemBoxMeshSpecs = itemBoxMeshes.map((itemBoxMesh, index) => {
                    const {position: itemBoxMeshPosition} = _decomposeObjectMatrixWorld(itemBoxMesh);
                    const distance = position.distanceTo(itemBoxMeshPosition);
                    return {
                      index,
                      distance,
                    };
                  });
                  const closestItemBoxMeshIndex = itemBoxMeshSpecs.sort((a, b) => a.distance - b.distance)[0].index;
                  return closestItemBoxMeshIndex;
                };

                const {position: controllerPosition} = gamepad;
                const hovered = _isBehindCamera(controllerPosition);
                hoverState.hovered = hovered;
                const targetItemIndex = hovered ? _getClosestItemMeshIndex(controllerPosition) : -1;
                hoverState.targetItemIndex = targetItemIndex;
              }
            });
          };
          const _updateMeshes = () => {
            const hovered = SIDES.some(side => hoverStates[side].hovered);

            if (hovered) {
              const {hmd} = webvr.getStatus();
              const {position, rotation} = hmd;

              mesh.position.copy(position.clone().add(new THREE.Vector3(0, 0, -0.5).applyQuaternion(rotation)));
              mesh.quaternion.copy(rotation);

              const {itemBoxMeshes} = mesh;
              for (let i = 0; i < NUM_ITEMS; i++) {
                const hovered = SIDES.some(side => hoverStates[side].targetItemIndex === i);
                itemBoxMeshes[i].material.color = new THREE.Color(hovered ? 0x0000FF : 0x808080);
              }

              if (!mesh.visible) {
                mesh.visible = true;
              }
            } else {
              if (mesh.visible) {
                mesh.visible = false;
              }
            }
          };

          _updateHoverStates();
          _updateMeshes();
        };
        rend.on('update', _update);

        /* const _gripdown = e => {
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

                itemBoxMesh.add(tagMesh);
                tagMesh.position.copy(new THREE.Vector3());
                tagMesh.quaternion.copy(new THREE.Quaternion());
                tagMesh.scale.set(1, 1, 1);
              }
            }
          }
        };
        input.on('gripup', _gripup, {
          priority: 1,
        }); */

        this._cleanup = () => {
          scene.remove(mesh);

          rend.removeListener('update', _update);
          /* input.removeListener('gripdown', _gripdown);
          input.removeListener('gripup', _gripup); */
        };

        const _getBackpackMesh = () => mesh;
        const _getHoveredItemIndex = side => {
          const hoverState = hoverStates[side];
          const {targetItemIndex} = hoverState;

          return targetItemIndex;
        };

        return {
          getBackpackMesh: _getBackpackMesh,
          getHoveredItemIndex: _getHoveredItemIndex,
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Backpack;

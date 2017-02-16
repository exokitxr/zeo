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

        const numItems = 9;
        const numItemsPerRow = 3;

        const _decomposeObjectMatrixWorld = object => {
          const {matrixWorld} = object;
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrixWorld.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        const _makeHoverState = () => ({
          hovered: false,
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
              const xIndex = index % numItemsPerRow;
              mesh.position.x = -(((size * numItemsPerRow) + (padding * (numItemsPerRow - 1))) / 2) + ((size + padding) * xIndex) + (size / 2);
              const yIndex = Math.floor(index / numItemsPerRow);
              mesh.position.y = (size + padding) - (yIndex * (size + padding));
              // mesh.position.z = -0.5;
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

                const {position: controllerPosition} = gamepad;
                hoverState.hovered = _isBehindCamera(controllerPosition);
              }
            });
          };
          const _updateMeshes = () => {
            const hovered = SIDES.some(side => hoverStates[side].hovered);
console.log('hovered', hovered);

            if (hovered) {
              const {hmd} = webvr.getStatus();
              const {position, rotation} = hmd;

              mesh.position.copy(position.clone().add(new THREE.Vector3(0, 0, -0.5).applyQuaternion(rotation)));
              mesh.quaternion.copy(rotation);

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
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Backpack;

const DIRECTIONS = [
  [-1, -1, -1],
  [-1, -1, 1],
  [-1, 1, -1],
  [-1, 1, 1],

  [1, -1, -1],
  [1, -1, 1],
  [1, 1, -1],
  [1, 1, 1],
];

class Craft {
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
      '/core/engines/webvr',
      '/core/engines/input',
      '/core/engines/rend',
      '/core/engines/multiplayer',
      // '/core/utils/js-utils',
    ]).then(([
      three,
      webvr,
      input,
      rend,
      multiplayer,
      // jsUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        /* const {events} = jsUtils;
        const {EventEmitter} = events; */

        const localUserId = multiplayer.getId();

        const oneVector = new THREE.Vector3(1, 1, 1);
        const wireMaterial = new THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.5,
        });
        const size = 0.1;
        const spacing = size / 4;
        const directions = DIRECTIONS.map(direction => new THREE.Vector3().fromArray(direction).multiplyScalar(size / 2));
        const width = 3;

        const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
          for (let i = 0; i < src.length; i++) {
            dst[startIndexIndex + i] = src[i] + startAttributeIndex;
          }
        };
        const _getGridPosition = (x, y) => new THREE.Vector3(
          -(((width * size) + ((width - 1) * spacing)) / 2) + (size / 2) + (x * (size + spacing)),
          (((width * size) + ((width - 1) * spacing)) / 2) - (size / 2) - (y * (size + spacing)),
          0
        );

        const gridGeometry = (() => {
          const cylinderGeometry = new THREE.CylinderBufferGeometry(0.001, 0.001, size, 3, 1);
          const boxGeometry = (() => {
            const positions = new Float32Array(cylinderGeometry.getAttribute('position').array.length * 4 * 3);
            const indices = new Uint16Array(cylinderGeometry.index.array.length * 4 * 3);
            let attributeIndex = 0;
            let indexIndex = 0;

            for (let i = 0; i < directions.length; i++) {
              const direction1 = directions[i];

              for (let j = 0; j < directions.length; j++) {
                const direction2 = directions[j];
                const diff = direction2.clone().sub(direction1);
                diff.x = Math.abs(diff.x);
                diff.y = Math.abs(diff.y);
                diff.z = Math.abs(diff.z);

                const position = direction1.clone()
                  .add(direction2)
                  .divideScalar(2);
                const newPositions = (() => {
                  if (diff.x === size && diff.y === 0 && diff.z === 0 && direction1.x < 0 && direction2.x > 0) {
                    return cylinderGeometry.clone()
                      .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
                        new THREE.Vector3(0, 1, 0),
                        new THREE.Vector3(1, 0, 0)
                      )))
                      .applyMatrix(new THREE.Matrix4().makeTranslation(position.x, position.y, position.z))
                      .getAttribute('position').array;
                  } else if (diff.x === 0 && diff.y === size && diff.z === 0 && direction1.y < 0 && direction2.y > 0) {
                    return cylinderGeometry.clone()
                      .applyMatrix(new THREE.Matrix4().makeTranslation(position.x, position.y, position.z))
                      .getAttribute('position').array;
                  } else if (diff.x === 0 && diff.y === 0 && diff.z === size && direction1.z < 0 && direction2.z > 0) {
                    return cylinderGeometry.clone()
                      .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
                        new THREE.Vector3(0, 1, 0),
                        new THREE.Vector3(0, 0, 1)
                      )))
                      .applyMatrix(new THREE.Matrix4().makeTranslation(position.x, position.y, position.z))
                      .getAttribute('position').array;
                  } else {
                    return null;
                  }
                })();
                if (newPositions !== null) {
                  positions.set(newPositions, attributeIndex);
                  const newIndices = cylinderGeometry.index.array;
                  _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

                  attributeIndex += newPositions.length;
                  indexIndex += newIndices.length;
                }
              }
            }

            const geometry = new THREE.BufferGeometry();
            geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setIndex(new THREE.BufferAttribute(indices, 1));
            return geometry;
          })();
          const gridGeometry = (() => {
            const positions = new Float32Array(boxGeometry.getAttribute('position').array.length * width * width);
            const indices = new Uint16Array(boxGeometry.index.array.length * width * width);
            let attributeIndex = 0;
            let indexIndex = 0;

            for (let x = 0; x < width; x++) {
              for (let y = 0; y < width; y++) {
                const position = _getGridPosition(x, y);
                const newPositions = boxGeometry.clone()
                  .applyMatrix(new THREE.Matrix4().makeTranslation(position.x, position.y, position.z))
                  .getAttribute('position').array;
                positions.set(newPositions, attributeIndex);
                const newIndices = boxGeometry.index.array;
                _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

                attributeIndex += newPositions.length;
                indexIndex += newIndices.length;
              }
            }

            const geometry = new THREE.BufferGeometry();
            geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setIndex(new THREE.BufferAttribute(indices, 1));
            return geometry;
          })();

          return gridGeometry;
        })();

        const gridMeshes = {};

        const _makeGridMesh = (position, rotation, scale) => {
          const mesh = new THREE.Mesh(gridGeometry, wireMaterial);
          mesh.position.copy(position);
          mesh.quaternion.copy(rotation);
          mesh.scale.copy(scale);
          mesh.updateMatrixWorld();

          mesh.positions = (() => {
            const result = Array(width * width);
            for (let y = 0; y < width; y++) {
              for (let x = 0; x < width; x++) {
                const index = x + (y * width);
                const p = _getGridPosition(x, y)
                  .multiply(scale)
                  .applyQuaternion(rotation)
                  .add(position);
                p.offset = [x, y];
                result[index] = p;
              }
            }
            return result;
          })();

          return mesh;
        }

        const _trigger = e => {
          const {side} = e;
          const status = webvr.getStatus();
          const {gamepads} = status;
          const gamepad = gamepads[side];

          if (gamepad.buttons.grip.pressed) {
            const gridMesh = gridMeshes[localUserId];

            if (!gridMesh) {
              const {hmd} = status;
              const {worldRotation: hmdRotation} = hmd;
              const hmdEuler = new THREE.Euler().setFromQuaternion(hmdRotation, camera.rotation.order);
              hmdEuler.x = 0;
              hmdEuler.y += Math.PI;
              hmdEuler.z = 0;
              const hmdQuaternion = new THREE.Quaternion().setFromEuler(hmdEuler);
              const {worldPosition: controllerPosition} = gamepad;

              const gridMesh = _makeGridMesh(controllerPosition, hmdQuaternion, oneVector);
              scene.add(gridMesh);
              gridMeshes[localUserId] = gridMesh;
            } else {
              scene.remove(gridMesh);
              delete gridMeshes[localUserId];
            }

            e.stopImmediatePropagation();
          }
        };
        input.on('trigger', _trigger);

        const _gripdown = e => {
          const {side} = e;
          const {gamepads} = webvr.getStatus();
          const gamepad = gamepads[side];
          const {worldPosition: controllerPosition} = gamepad;

          const hoveredSpec = (() => {
            for (const userId in gridMeshes) {
              const gridMesh = gridMeshes[userId];
              const {positions} = gridMesh;

              for (let j = 0; j < positions.length; j++) {
                const position = positions[j];

                if (controllerPosition.distanceTo(position) < (size + (spacing / 2))) {
                  const {offset} = position;

                  return {
                    gridMesh,
                    offset,
                  };
                }
              }
            }
            return null;
          })();
          console.log('got grid position', hoveredSpec); // XXX
        };
        input.on('gripdown', _gripdown);

        const _update = () => {
          /* const {gamepads} = webvr.getStatus();
          const gamepad = gamepads.right;
          const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale} = gamepad;
          gridMesh.position.copy(controllerPosition);
          gridMesh.quaternion.copy(controllerRotation);
          gridMesh.scale.copy(controllerScale);
          gridMesh.updateMatrixWorld(); */
        };
        rend.on('update', _update);

        this._cleanup = () => {
          input.removeListener('trigger', _trigger);
          rend.removeListener('update', _update);
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Craft;

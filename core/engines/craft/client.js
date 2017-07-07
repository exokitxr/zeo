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
      '/core/engines/rend',
      // '/core/utils/js-utils',
    ]).then(([
      three,
      webvr,
      rend,
      // jsUtils,
    ]) => {
      if (live) {
        const {THREE, scene} = three;
        /* const {events} = jsUtils;
        const {EventEmitter} = events; */

        const wireMaterial = new THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.5,
        });
        const size = 0.1;
        const spacing = size / 4;
        const directions = DIRECTIONS.map(direction => new THREE.Vector3().fromArray(direction).multiplyScalar(size / 2));

        const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
          for (let i = 0; i < src.length; i++) {
            dst[startIndexIndex + i] = src[i] + startAttributeIndex;
          }
        };

        const gridGeometry = (() => {
          const cylinderGeometry = new THREE.CylinderBufferGeometry(0.0005, 0.0005, size, 3, 1);
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
            const width = 3;
            const positions = new Float32Array(boxGeometry.getAttribute('position').array.length * width * width);
            const indices = new Uint16Array(boxGeometry.index.array.length * width * width);
            let attributeIndex = 0;
            let indexIndex = 0;

            for (let x = 0; x < width; x++) {
              for (let y = 0; y < width; y++) {
                const position = new THREE.Vector3(
                  -(((width * size) + ((width - 1) * spacing)) / 2) + (size / 2) + (x * (size + spacing)),
                  -size / 4,
                  (((width * size) + ((width - 1) * spacing)) / 2) - (size / 2) - (y * (size + spacing))
                );
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

        const gridMesh = new THREE.Mesh(gridGeometry, wireMaterial);
        scene.add(gridMesh);

        const _update = () => {
          const {gamepads} = webvr.getStatus();
          const gamepad = gamepads.right;
          const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale} = gamepad;
          gridMesh.position.copy(controllerPosition);
          gridMesh.quaternion.copy(controllerRotation);
          gridMesh.scale.copy(controllerScale);
          gridMesh.updateMatrixWorld();
        };
        rend.on('update', _update);

        this._cleanup = () => {
          scene.remove(gridMesh);

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

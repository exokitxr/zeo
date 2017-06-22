const ConvexGeometry = require('./lib/three-extra/ConvexGeometry');

const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];
const SIDES = ['left', 'right'];

class ZSword {
  mount() {
    const {three: {THREE, scene}, input, elements, render, pose, utils: {geometry: geometryUtils}} = zeo;

    const worldElement = elements.getWorldElement();

    const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
    const _decomposeMatrix = matrix => {
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, rotation, scale);
      return {position, rotation, scale};
    };

    const weaponMaterial = new THREE.MeshPhongMaterial({
      color: 0x808080,
      shading: THREE.FlatShading,
    });

    const THREEConvexGeometry = ConvexGeometry(THREE);

    const swordEntity = {
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0.5, 1.2, 0,
            0, 0, 0, 1,
            1, 1, 1,
          ],
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
          value: [0.2, 0.2, 1],
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = entityElement.getEntityApi();
        const entityObject = entityElement.getObject();

        const mesh = (() => {
          const object = new THREE.Object3D();

          const bladeMesh = (() => {
            const geometry = new THREEConvexGeometry([
              new THREE.Vector3(0, 0, -0.9),
              new THREE.Vector3(0, -0.1, -0.8),
              new THREE.Vector3(-0.01, -0.05, -0.8),
              new THREE.Vector3(0.01, -0.05, -0.8),

              new THREE.Vector3(0, -0.1, 0),
              new THREE.Vector3(0, 0, 0),
              new THREE.Vector3(-0.01, -0.05, 0),
              new THREE.Vector3(0.01, -0.05, 0),
            ]);
            const material = weaponMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
          })();
          object.add(bladeMesh);

          const handleMesh = (() => {
            const geometry = new THREE.SphereBufferGeometry(0.1, 3, 3)
              .applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)))
              .applyMatrix(new THREE.Matrix4().makeRotationZ(-(Math.PI / 4) + (Math.PI / 16)))
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, -0.04, 0));

            const mesh = new THREE.Mesh(geometry, weaponMaterial);
            return mesh;
          })();
          object.add(handleMesh);

          return object;
        })();
        entityObject.add(mesh);

        entityApi.position = DEFAULT_MATRIX;
        entityApi.align = () => {
          const {position} = entityApi;

          entityObject.position.set(position[0], position[1], position[2]);
          entityObject.quaternion.set(position[3], position[4], position[5], position[6]);
          entityObject.scale.set(position[7], position[8], position[9]);
        };

        const _makeSwordState = () => ({
          grabbed: false,
        });
        const swordStates = {
          left: _makeSwordState(),
          right: _makeSwordState(),
        };

        const _grab = e => {
          const {detail: {side}} = e;
          const swordState = swordStates[side];

          swordState.grabbed = true;
        };
        entityElement.addEventListener('grab', _grab);
        const _release = e => {
          const {detail: {side}} = e;
          const swordState = swordStates[side];

          swordState.grabbed = false;
        };
        entityElement.addEventListener('release', _release);

        entityApi._cleanup = () => {
          entityObject.remove(mesh);

          entityElement.removeEventListener('grab', _grab);
          entityElement.removeEventListener('release', _release);
        };
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getEntityApi();
        entityApi._cleanup();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getEntityApi();

        switch (name) {
          case 'position': {
            entityApi.position = newValue;

            entityApi.align();

            break;
          }
        }
      },
    };
    elements.registerEntity(this, swordEntity);

    this._cleanup = () => {
      elements.unregisterEntity(this, swordEntity);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = ZSword;

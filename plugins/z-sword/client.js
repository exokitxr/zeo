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

    const swordComponent = {
      selector: 'sword[position]',
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
        const entityApi = entityElement.getComponentApi();
        const entityObject = entityElement.getObject();

        const mesh = (() => {
          const geometry = (() => {
            const coreGeometry = new THREE.PlaneBufferGeometry(0.1, 0.9, 1, 9)
              .applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)))
              .applyMatrix(new THREE.Matrix4().makeRotationZ(Math.PI / 2))
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, -(0.1 / 2), -(0.9 / 2)));
            const tipGeometry = (() => {
              const geometry = new THREE.BufferGeometry(0.1, 1, 1, 9);
              geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array([
                0, 0, -0.9,
                0, 0, -1.0,
                0, -0.1, -0.9,
              ]), 3));
              geometry.computeVertexNormals();
              return geometry;
            })();
            const handleGeometry = new THREE.SphereBufferGeometry(0.1, 3, 3)
              .applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)))
              .applyMatrix(new THREE.Matrix4().makeRotationZ(-(Math.PI / 4) + (Math.PI / 16)))
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, -0.04, 0));

            return geometryUtils.concatBufferGeometry([coreGeometry, /* tipGeometry, */ handleGeometry]);
          })();

          const mesh = new THREE.Mesh(geometry, weaponMaterial);
          return mesh;
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
        }
      },
    };
    elements.registerComponent(this, swordComponent);

    this._cleanup = () => {
      elements.unregisterComponent(this, swordComponent);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = ZSword;

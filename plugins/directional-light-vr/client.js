const geometryutils = require('geometryutils');

const SHADOW_MAP_SIZE = 2048;

class DirectionalLight {
  mount() {
    const {three, elements} = zeo;
    const {THREE, scene} = three;

    const geometryUtils = geometryutils({THREE});

    const directionalLightEntity = {
      attributes: {
        position: {
          type: 'matrix',
          value: [
            4, 3, 3,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        },
        lookat: {
          type: 'matrix',
          value: [
            0, 0, 0,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        },
        color: {
          type: 'color',
          value: '#FFFFFF',
        },
        intensity: {
          type: 'number',
          value: 2,
          min: 0,
          max: 4,
          step: 0.1,
        },
        shadow: {
          type: 'checkbox',
          value: false,
        },
      },
      entityAddedCallback(entityElement) {
        const mesh = (() => {
          const geometry = (() => {
            const coreSize = 0.1;
            const arrowSize = 0.05;
            const offsetSize = coreSize + (arrowSize / 2);
            const coreGeometry = new THREE.SphereBufferGeometry(coreSize, 0);
            const arrowGeometry = new THREE.CylinderBufferGeometry(0, sq(arrowSize / 2), arrowSize, 4, 1)
              .applyMatrix(new THREE.Matrix4().makeRotationY(-Math.PI * (3 / 12)))
              .applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI / 2))
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, offsetSize));

            return geometryUtils.concatBufferGeometry([coreGeometry, arrowGeometry]);
          })();
          const material = new THREE.MeshPhongMaterial({
            color: 0xFFEB3B,
            shininess: 10,
            shading: THREE.FlatShading,
          });

          return new THREE.Mesh(geometry, material);
        })();
        // scene.add(mesh);
        entityElement.mesh = mesh;

        const light = (() => {
          const light = new THREE.DirectionalLight(0xFFFFFF, 2);
          light.shadow.mapSize.width = SHADOW_MAP_SIZE;
          light.shadow.mapSize.height = SHADOW_MAP_SIZE;
          // light.castShadow = true;
          return light;
        })();
        scene.add(light);
        entityElement.light = light;

        entityElement._cleanup = () => {
          // scene.remove(mesh);
          scene.remove(light);
        };
      },
      entityRemovedCallback(entityElement) {
        entityElement._cleanup();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        switch (name) {
          case 'position': {
            const {mesh, light} = entityElement;

            mesh.position.set(newValue[0], newValue[1], newValue[2]);
            mesh.updateMatrixWorld();

            light.position.copy(mesh.position);
            light.updateMatrixWorld();

            break;
          }
          case 'lookat': {
            const {mesh, light} = entityElement;

            const lookAtVector = new THREE.Vector3(newValue[0], newValue[1], newValue[2]);
            mesh.lookAt(lookAtVector);
            mesh.updateMatrixWorld();

            light.lookAt(lookAtVector);
            light.updateMatrixWorld();

            break;
          }
          case 'color': {
            const {light} = entityElement;

            light.color.setStyle(newValue);

            break;
          }
          case 'intensity': {
            const {light} = entityElement;

            light.intensity = newValue;

            break;
          }
          case 'shadow': {
            const {light} = entityElement;

            light.castShadow = newValue;

            break;
          }
        }
      }
    }
    elements.registerEntity(this, directionalLightEntity);

    this._cleanup = () => {
      elements.unregisterEntity(this, directionalLightEntity);
    };
  }

  unount() {
    this._cleanup();
  }
}

const sq = n => Math.sqrt((n * n) + (n * n));

module.exports = DirectionalLight;

const SHADOW_MAP_SIZE = 2048;

const symbol = Symbol();

class Light {
  mount() {
    const {three: {THREE, scene}, elements} = zeo;

    const lightComponent = {
      attributes: {
        position: {
          type: 'matrix',
          value: [
            3, 3, 3,
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
        shadow: {
          type: 'checkbox',
          value: false,
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = {};

        const mesh = (() => {
          const geometry = new THREE.OctahedronBufferGeometry(0.1, 0);
          const material = new THREE.MeshPhongMaterial({
            color: 0xFFC107,
            shininess: 0,
          });

          return new THREE.Mesh(geometry, material);
        })();
        scene.add(mesh);

        const light = (() => {
          const light = new THREE.DirectionalLight(0xFFFFFF, 2);
          light.shadow.mapSize.width = SHADOW_MAP_SIZE;
          light.shadow.mapSize.height = SHADOW_MAP_SIZE;
          // light.castShadow = true;
          return light;
        })();
        scene.add(light);

        entityApi._cleanup = () => {
          scene.remove(mesh);
          scene.remove(light);
        };

        entityElement[symbol] = entityApi;
      },
      entityRemovedCallback(entityElement) {
        const {[symbol]: entityApi} = entityElement;

        entityApi._cleanup();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const {[symbol]: entityApi} = entityElement;

        switch (name) {
          case 'position': {
            const {mesh, light} = entityApi;

            mesh.position.set(newValue[0], newValue[1], newValue[2]);
            light.position.copy(mesh.position);

            break;
          }
          case 'lookat': {
            const {mesh, light} = entityApi;

            const lookAtVector = new THREE.Vector3(newValue[0], newValue[1], newValue[2]);
            mesh.lookAt(lookAtVector);
            light.lookAt(lookAtVector);

            break;
          }
          case 'shadow': {
            const {light} = entityApi;

            light.castShadow = newValue;

            break;
          }
        }
      }
    }
    elements.registerComponent(this, lightComponent);

    this._cleanup = () => {
      elements.unregisterComponent(this, lightComponent);
    };
  }

  unount() {
    this._cleanup();
  }
}

module.exports = Light;

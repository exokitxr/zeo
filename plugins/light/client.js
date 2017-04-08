const SHADOW_MAP_SIZE = 2048;

class Light {
  mount() {
    const {three: {THREE}, elements} = zeo;

    const lightComponent = {
      selector: 'light[position][lookat][shadow]',
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
        shadow: {
          type: 'checkbox',
          value: false,
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();
        const entityObject = entityElement.getObject();

        const mesh = (() => {
          const geometry = new THREE.OctahedronBufferGeometry(0.1, 0);
          const material = new THREE.MeshPhongMaterial({
            color: 0xFFC107,
            shininess: 0,
          });

          return new THREE.Mesh(geometry, material);
        })();
        entityObject.add(mesh);

        const light = (() => {
          const light = new THREE.DirectionalLight(0xFFFFFF, 2);
          light.shadow.mapSize.width = SHADOW_MAP_SIZE;
          light.shadow.mapSize.height = SHADOW_MAP_SIZE;
          // light.castShadow = true;
          return light;
        })();
        entityObject.add(light);

        entityApi._cleanup = () => {
          entityObject.remove(mesh);
          entityObject.remove(light);
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

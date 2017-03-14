const SHADOW_MAP_SIZE = 2048;

class Light {
  mount() {
    const {three: {THREE, scene}, elements} = zeo;

    class LightElement extends HTMLElement {
      createdCallback() {
        const mesh = (() => {
          const geometry = new THREE.OctahedronBufferGeometry(0.1, 0);
          const material = new THREE.MeshPhongMaterial({
            color: 0xFFC107,
            shininess: 0,
          });

          return new THREE.Mesh(geometry, material);
        })();
        scene.add(mesh);
        this.mesh = mesh;

        const light = (() => {
          const light = new THREE.DirectionalLight(0xFFFFFF, 2);
          light.shadow.mapSize.width = SHADOW_MAP_SIZE;
          light.shadow.mapSize.height = SHADOW_MAP_SIZE;
          // light.castShadow = true;
          return light;
        })();
        scene.add(light);
        this.light = light;

        this._cleanup = () => {
          scene.remove(mesh);
          scene.remove(light);
        };
      }

      destructor() {
        this._cleanup();
      }

      attributeValueChangedCallback(name, oldValue, newValue) {
        switch (name) {
          case 'position': {
            const {mesh, light} = this;

            mesh.position.set(newValue[0], newValue[1], newValue[2]);
            light.position.copy(mesh.position);

            break;
          }
          case 'lookat': {
            const {mesh, light} = this;

            const lookAtVector = new THREE.Vector3(newValue[0], newValue[1], newValue[2]);
            mesh.lookAt(lookAtVector);
            light.lookAt(lookAtVector);

            break;
          }
          case 'shadow': {
            const {light} = this;

            light.castShadow = newValue;

            break;
          }
        }
      }
    }
    elements.registerElement(this, LightElement);

    this._cleanup = () => {
      elements.unregisterElement(this);
    };
  }

  unount() {
    this._cleanup();
  }
}

module.exports = Light;

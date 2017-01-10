class Light {
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
      '/core/engines/zeo',
    ]).then(([
      zeo,
    ]) => {
      if (live) {
        const {THREE, scene} = zeo;

        return {
          elements: [
            class LightElement extends HTMLElement {
              static get tag() {
                return 'light';
              }
              static get attributes() {
                return {
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
                };
              }

              createdCallback() {
                const light = new THREE.DirectionalLight(0xFFFFFF, 2);
                scene.add(light);
                this.light = light;

                this._cleanup = () => {
                  scene.remove(light);
                };
              }

              destructor() {
                this._cleanup();
              }

              attributeValueChangedCallback(name, oldValue, newValue) {
                switch (name) {
                  case 'position': {
                    const {light} = this;

                    light.position.set(newValue[0], newValue[1], newValue[2]);

                    break;
                  }
                  case 'lookat': {
                    const {light} = this;

                    light.lookAt(new THREE.Vector3(newValue[0], newValue[1], newValue[2]));

                    break;
                  }
                }
              }
            }
          ],
          templates: [
            {
              tag: 'light',
              attributes: {},
              children: [],
            },
          ],
        };
      }
    });
  }

  unount() {
    this._cleanup();
  }
}

module.exports = Light;

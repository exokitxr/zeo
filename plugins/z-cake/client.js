const CakeModel = require('./lib/models/cake');

class ZCake {
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

        class CakeElement extends HTMLElement {
          createdCallback() {
            this.position = null;

            const mesh = new CakeModel({
              THREE,
            });
            scene.add(mesh);
            this.mesh = mesh;

            this._cleanup = () => {
              scene.remove(mesh);
            };
          }

          destructor() {
            this._cleanup();
          }

          attributeValueChangedCallback(name, oldValue, newValue) {
            switch (name) {
              case 'position': {
                this.position = newValue;

                this._updateMesh();

                break;
              }
            }
          }

          _updateMesh() {
            const {mesh, position} = this;

            if (position) {
              mesh.position.set(position[0], position[1], position[2]);
              mesh.quaternion.set(position[3], position[4], position[5], position[6]);
              mesh.scale.set(position[7], position[8], position[9]);
            }
          }
        }
        zeo.registerElement(this, CakeElement);

        this._cleanup = () => {
          zeo.unregisterElement(this);
        };

        return {};
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = ZCake;

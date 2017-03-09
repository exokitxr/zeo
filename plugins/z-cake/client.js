const CakeModel = require('./lib/models/cake');

const SIDES = ['left', 'right'];

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

            this.slices = 8;
            this.mesh = null;

            this._render();

            const _makeHoverState = () => ({
              hovered: false,
            });
            const hoverStates = {
              left: _makeHoverState(),
              right: _makeHoverState(),
            };

            const update = () => {
              const {gamepads} = zeo.getStatus();

              SIDES.forEach(side => {
                const hoverState = hoverStates[side];

                const hovered = (() => {
                  const gamepad = gamepads[side];

                  if (gamepad) {
                    return true;
                  } else {
                    return false;
                  }
                })();
                hoverState.hovered = hovered;
              });
            };
            updates.push(update);

            const _trigger = e => {
              const {side} = e;
              const hoverState = hoverStates[side];
              const {hovered} = hoverState;

              if (hovered) {
                this.slices = Math.max(this.slices - 1, 0);

                this._render();
              }
            };
            zeo.on('trigger', _trigger);

            this._cleanup = () => {
              const {mesh} = this;
              scene.remove(mesh);

              updates.slice(updates.indexOf(update), 1);
              zeo.removeListener('trigger', _trigger);
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

          _render() {
            const {mesh: oldMesh} = this;
            if (oldMesh) {
              scene.remove(oldMesh);
            }

            const {slices} = this;
            const newMesh = new CakeModel({
              THREE,
              slices,
            });
            scene.add(newMesh);
            this.mesh = newMesh;

            this._updateMesh();
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

        const updates = [];
        const _update = () => {
          for (let i = 0; i < updates.length; i++) {
            const update = updates[i];
            update();
          }
        };
        zeo.on('update', _update);

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

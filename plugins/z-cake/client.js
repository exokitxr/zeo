const CakeModel = require('./lib/models/cake');

const GRAB_RADIUS = 0.2;
const DEFAULT_MATRIX = [
  0, 1, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const SIDES = ['left', 'right'];

class ZCake {
  mount() {
    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _requestAudios = () => new Promise((accept, reject) => {
      const eatAudio = document.createElement('audio');
      eatAudio.src = '/archae/z-cake/audio/eat.mp3';
      eatAudio.oncanplaythrough = () => {
        accept({
          eatAudio,
        });
      };
      eatAudio.onerror = err => {
        reject(err);
      };
    });

    return _requestAudios()
      .then(({
        eatAudio,
      }) => {
        if (live) {
          const {three: {THREE, scene}, elements, input, render, hands} = zeo;

          class Cake {
            constructor(object) {
              this.object = object;

              this.position = DEFAULT_MATRIX;
              this.slices = 8;

              this.mesh = null;
              this.sliceSide = null;
              this.sliceMesh = null;

              this.render();

              const _gripdown = e => {
                const {side} = e;
                const {mesh} = this;

                const canGrab = hands.canGrab(side, mesh, {
                  radius: GRAB_RADIUS,
                });

                if (canGrab) {
                  const sliceMesh = new CakeModel({
                    THREE,
                    slices: 1,
                  });
                  sliceMesh.rotation.y = -(1/8 * Math.PI);
                  sliceMesh.position.z = -0.2;
                  hands.grab(side, sliceMesh);
                  this.sliceSide = side;
                  this.sliceMesh = sliceMesh;

                  this.setAttribute('slices', this.slices - 1);

                  e.stopImmediatePropagation();
                }
              };
              input.on('gripdown', _gripdown, {
                priority: 1,
              });
              const _release = e => {
                const {side, object} = e;
                const {sliceSide, sliceMesh} = this;

                if (side === sliceSide && object === sliceMesh) {
                  this.sliceSide = null;
                  this.sliceMesh = null;

                  eatAudio.currentTime = 0;
                  if (eatAudio.paused) {
                    eatAudio.play();
                  }
                }
              };
              input.on('release', _release);

              this._cleanup = () => {
                const {object, mesh} = this;
                object.remove(mesh);

                const {sliceSide, sliceMesh} = this;
                if (sliceSide && sliceMesh) {
                  hands.release(sliceSide, sliceMesh);
                }

                input.removeListener('gripdown', _gripdown);

                hands.removeListener('release', _release);
              };
            }

            render() {
              const {object, mesh: oldMesh} = this;
              if (oldMesh) {
                object.remove(oldMesh);
              }

              const {slices} = this;
              const newMesh = new CakeModel({
                THREE,
                slices,
              });
              object.add(newMesh);
              this.mesh = newMesh;

              this.updateMesh();
            }

            updateMesh() {
              const {mesh, position} = this;

              mesh.position.set(position[0], position[1], position[2]);
              mesh.quaternion.set(position[3], position[4], position[5], position[6]);
              mesh.scale.set(position[7], position[8], position[9]);
            }

            setPosition(newValue) {
              this.position = newValue;

              this.updateMesh();
            }

            setSlices(newValue) {
              this.slices = newValue;

              this.render();
            }

            destroy() {
              this._cleanup();
            }
          }

          const _makeFakeCake = () => new Cake(scene);

          let fakeCake = _makeFakeCake();
          const cakes = [];

          const cakeComponent = {
            selector: 'cake[position][slices]',
            attributes: {
              position: {
                type: 'matrix',
                value: DEFAULT_MATRIX,
              },
              slices: {
                type: 'number',
                value: 8,
                min: 0,
                max: 8,
                step: 1,
              }
            },
            entityAddedCallback(entityElement) {
              const entityObject = entityElement.getObject();

              const cake = new Cake(entityObject);
              cakes.push(cake);

              entityElement.setComponentApi(cake);

              if (cakes.length === 1) {
                fakeCake.destroy();
                fakeCake = null;
              }
            },
            entityRemovedCallback(entityElement) {
              const cake = entityElement.getComponentApi();
              cake.destroy();

              cakes.splice(cakes.indexOf(cake), 1);

              if (cakes.length === 0) {
                fakeCake = _makeFakeCake();
              }
            },
            entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
              const entityApi = entityElement.getComponentApi();

              switch (name) {
                case 'position': {
                  entityApi.setPosition(newValue);

                  break;
                }
                case 'slices': {
                  entityApi.setSlices(newValue);

                  break;
                }
              }
            }
          };
          elements.registerComponent(this, cakeComponent);

          const updates = [];
          const _update = () => {
            for (let i = 0; i < updates.length; i++) {
              const update = updates[i];
              update();
            }
          };
          render.on('update', _update);

          this._cleanup = () => {
            elements.unregisterComponent(this, cakeComponent);

            if (fakeCake) {
              fakeCake.destroy();
            }

            render.removeListener('update', _update);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = ZCake;

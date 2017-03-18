const CakeModel = require('./lib/models/cake');

const GRAB_RADIUS = 0.2;

const symbol = Symbol();

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

          const cakeComponent = {
            attributes: {
              position: {
                type: 'matrix',
                value: [
                  0, 0, 0,
                  0, 0, 0, 1,
                  1, 1, 1,
                ],
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
              const entityApi = {};

              entityApi.position = null;
              entityApi.slices = 0;

              entityApi.mesh = null;
              entityApi.sliceSide = null;
              entityApi.sliceMesh = null;

              const _gripdown = e => {
                const {side} = e;
                const {mesh} = entityApi;

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
                  entityApi.sliceSide = side;
                  entityApi.sliceMesh = sliceMesh;

                  this.setAttribute('slices', entityApi.slices - 1);

                  e.stopImmediatePropagation();
                }
              };
              input.on('gripdown', _gripdown, {
                priority: 1,
              });
              const _release = e => {
                const {side, object} = e;
                const {sliceSide, sliceMesh} = entityApi;

                if (side === sliceSide && object === sliceMesh) {
                  entityApi.sliceSide = null;
                  entityApi.sliceMesh = null;

                  eatAudio.currentTime = 0;
                  if (eatAudio.paused) {
                    eatAudio.play();
                  }
                }
              };
              input.on('release', _release);

              entityApi._render = () => {
                const {mesh: oldMesh} = entityApi;
                if (oldMesh) {
                  scene.remove(oldMesh);
                }

                const {slices} = entityApi;
                const newMesh = new CakeModel({
                  THREE,
                  slices,
                });
                scene.add(newMesh);
                entityApi.mesh = newMesh;

                entityApi._updateMesh();
              };
              entityApi._updateMesh = () => {
                const {mesh, position} = entityApi;

                if (mesh && position) {
                  mesh.position.set(position[0], position[1], position[2]);
                  mesh.quaternion.set(position[3], position[4], position[5], position[6]);
                  mesh.scale.set(position[7], position[8], position[9]);
                }
              };

              entityApi._cleanup = () =>0 {
                const {mesh} = entityApi;
                scene.remove(mesh);

                const {sliceSide, sliceMesh} = entityApi;
                if (sliceSide && sliceMesh) {
                  hands.release(sliceSide, sliceMesh);
                }

                input.removeListener('gripdown', _gripdown);

                hands.removeListener('release', _release);
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
                  entityApi.position = newValue;

                  entityApi._updateMesh();

                  break;
                }
                case 'slices': {
                  entityApi.slices = newValue;

                  entityApi._render();

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

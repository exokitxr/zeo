const CakeModel = require('./lib/models/cake');

const GRAB_RADIUS = 0.2;
const DEFAULT_MATRIX = [
  0, 1, 0,
  0, 0, 0, 1,
  1, 1, 1,
];
const DEFAULT_SIZE = [
  CakeModel.layerSize * 2,
  CakeModel.numLayers * CakeModel.layerHeight,
  CakeModel.layerSize * 2,
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
      eatAudio.src = '/archae/z-cake/audio/eat.ogg';
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
            constructor(entityElement, object) {
              this.entityElement = entityElement;
              this.object = object;

              this.position = DEFAULT_MATRIX;
              this.slices = 8;
              this.holdable = false;

              this.mesh = null;

              this.render();

              const _trygrab = e => {
                const {detail: {side}} = e;
                const {holdable} = this;

                if (!holdable) {
                  const sliceCakeEntity = document.createElement('cake');
                  const {position} = this;
                  sliceCakeEntity.setAttribute('position', JSON.stringify(position));
                  sliceCakeEntity.setAttribute('slices', JSON.stringify(1));
                  sliceCakeEntity.setAttribute('grabbable', JSON.stringify(true));
                  sliceCakeEntity.setAttribute('holdable', JSON.stringify(true));
                  sliceCakeEntity.setAttribute('sp-physics', JSON.stringify(true));
                  sliceCakeEntity.setAttribute('mp-physics', JSON.stringify(true));
                  sliceCakeEntity.setAttribute('size', JSON.stringify(DEFAULT_SIZE));
                  elements.getEntitiesElement().appendChild(sliceCakeEntity);

                  render.once('mutate', () => {
                    const grabEvent = new CustomEvent('grab', {
                      detail: {
                        side: side,
                      },
                    });
                    sliceCakeEntity.dispatchEvent(grabEvent);
                  });

                  const newSlices = this.slices - 1;
                  if (entityElement) {
                    entityElement.setAttribute('slices', newSlices);
                  } else {
                    this.setSlices(newSlices);
                  }
                }
              };
              if (entityElement) {
                entityElement.addEventListener('trygrab', _trygrab);
              }

              this._cleanup = () => {
                const {object, mesh} = this;
                object.remove(mesh);

                if (entityElement) {
                  entityElement.removeEventListener('trygrab', _trygrab);
                }
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

              this.align();
            }

            align() {
              const {object, position} = this;

              object.position.set(position[0], position[1], position[2]);
              object.quaternion.set(position[3], position[4], position[5], position[6]);
              object.scale.set(position[7], position[8], position[9]);
            }

            setPosition(newValue) {
              this.position = newValue;

              this.align();
            }

            setSlices(newValue) {
              this.slices = newValue;

              this.render();
            }

            setHoldable(newValue) {
              this.holdable = newValue;
            }

            destroy() {
              this._cleanup();
            }
          }

          const fakeCakeContainer = new THREE.Object3D();
          scene.add(fakeCakeContainer);
          const _makeFakeCake = () => new Cake(null, fakeCakeContainer);

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
              },
              grabbable: {
                type: 'checkbox',
                value: true,
              },
              holdable: {
                type: 'checkbox',
                value: false,
              },
              'sp-physics': {
                type: 'checkbox',
                value: true,
              },
              'mp-physics': {
                type: 'checkbox',
                value: true,
              },
              'physics-debug': {
                type: 'checkbox',
                value: false,
              },
              size: {
                type: 'vector',
                value: DEFAULT_SIZE,
              },
            },
            entityAddedCallback(entityElement) {
              const cake = new Cake(entityElement, entityElement.getObject());
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
              const cake = entityElement.getComponentApi();

              switch (name) {
                case 'position': {
                  cake.setPosition(newValue);

                  break;
                }
                case 'slices': {
                  cake.setSlices(newValue);

                  break;
                }
                case 'holdable': {
                  cake.setHoldable(newValue);

                  break;
                }
              }
            },
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
            scene.remove(fakeCakeContainer);

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

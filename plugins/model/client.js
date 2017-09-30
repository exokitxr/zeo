const Zlib = require('./inflate.min.js');
const FBXLoader = require('./FBXLoader');

class Model {
  mount() {
    const {three: {THREE, scene}, input, elements, hands} = zeo;

    const THREEFBXLoader = FBXLoader({THREE, Zlib});
    const manager = new THREE.LoadingManager();

    const modelEntity = {
      attributes: {},
      entityAddedCallback(entityElement) {
        const _triggerdown = e => {
          const {side} = e;
          const grabbable = hands.getGrabbedGrabbable(side);

          if (grabbable && grabbable.type === 'file') {
            const loader = new THREEFBXLoader(manager);
            loader.load('/archae/fs/hash/' + grabbable.value, object => {
              const parent = new THREE.Object3D();
              parent.position.set(0, 64, 0);
              parent.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 0, 1),
                new THREE.Vector3(0, 1, 0)
              );
              parent.add(object);
              parent.updateMatrixWorld();
              scene.add(parent);
            }, progress => {
              // console.log('progress', progress);
            }, err => {
              console.warn(err);
            });
          }
        };
        input.on('triggerdown', _triggerdown);

        entityElement._cleanup = () => {
          input.removeListener('triggerdown', _triggerdown);
        };
      },
      entityRemovedCallback(entityElement) {
        entityElement._cleanup();
      },
    }
    elements.registerEntity(this, modelEntity);

    this._cleanup = () => {
      elements.unregisterEntity(this, modelEntity);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Model;

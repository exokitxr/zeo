const SIDES = ['left', 'right'];

class Physics2 {
  mount() {
    const {three, elements, input, stck} = zeo;
    const {THREE, scene} = three;

    const zeroVector = new THREE.Vector3();
    const oneVector = new THREE.Vector3(1, 1, 1);
    const zeroQuaternion = new THREE.Quaternion();

    // const cleanupSymbol = Symbol();

    const physics2Entity = {
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0, 0, 0,
            0, 0, 0, 1,
            1, 1, 1
          ]
        },
      },
      entityAddedCallback(entityElement) {
        const initialPosition = [0, 40, 0];

        const body = stck.makeDynamicBoxBody(
          initialPosition,
          zeroQuaternion.toArray(),
          oneVector.clone().multiplyScalar(0.1).toArray(),
          zeroVector.toArray()
        );
        body.on('update', ({position, rotation, scale, velocity}) => {
          console.log('got update', position.join(','));
        });

        const _keypress = e => {
          if (e.key === 'k') {
            body.setState(
              initialPosition,
              zeroQuaternion.toArray(),
              oneVector.clone().multiplyScalar(0.1).toArray(),
              zeroVector.toArray()
            );
          }
        };
        input.on('keypress', _keypress);

        /* entityElement[cleanupSymbol] = () => {
          render.removeListener('update', _update);
        }; */
      },
      entityRemovedCallback(entityElement) {
        /* const {[cleanupSymbol]: cleanup} = entityElement;

        cleanup(); */
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        // XXX
      },
    };
    elements.registerEntity(this, physics2Entity);

    this._cleanup = () => {
      elements.unregisterEntity(this, physics2Entity);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Physics2;

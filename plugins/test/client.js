class Test {
  mount() {
    const {three, elements, input, pose, physics, payment} = zeo;
    const {THREE, scene} = three;

    const dataSymbol = Symbol();

    console.log('mount');

    const testEntity = {
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0, 0, 0,
            0, 0, 0, 1,
            1, 1, 1
          ]
        },
        text: {
          type: 'text',
          value: 'Some text',
        },
        number: {
          type: 'number',
          value: 1,
          min: 0,
          max: 10,
          step: 1,
        },
        select: {
          type: 'select',
          value: 'Option A',
          options: [
            'Option A',
            'Option B',
          ],
        },
        color: {
          type: 'color',
          value: '#E91E63',
        },
        checkbox: {
          type: 'checkbox',
          value: false,
        },
        file: {
          type: 'file',
          value: 'https://lol.com',
        },
      },
      entityAddedCallback(entityElement) {
        console.log('entityAddedCallback', {entityElement});

        const boxMesh = (() => {
          const geometry = new THREE.BoxBufferGeometry(1, 1, 1);
          const material = new THREE.MeshPhongMaterial({
            color: 0xFFFF00,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(-2, 5, 0);
          return mesh;
        })();
        scene.add(boxMesh);
        boxMesh.updateMatrixWorld();
        const boxBody = physics.makeBody(boxMesh, 'box', {
          weight: 1,
          bindObject: true,
          bindConnection: true,
        });

        entityElement[dataSymbol] = {
          boxMesh,
          boxBody,
        };
      },
      entityRemovedCallback(entityElement) {
        console.log('entityRemovedCallback', {entityElement});

        const {[dataSymbol]: {boxMesh, boxBody}} = entityElement;
        scene.remove(boxBody);
        physics.destroyBody(boxBody);
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        console.log('entityAttributeValueChangedCallback', {entityElement, name, oldValue, newValue});
      },
    };
    elements.registerEntity(this, testEntity);

    const _keypress = e => {
      if (e.keyCode === 112) { // P
        payment.requestCharge({
          dstAddress: 'G4ExZ6nYBPnu7Sr1c8kMgbzz3VS9DbGi6cNeghEirbHj',
          srcAsset: 'ZEOCOIN',
          srcQuantity: 10,
        })
          .then(result => {
            console.warn('charge result', result);
          })
          .catch(err => {
            console.warn('charge error', err);
          });
      } else if (e.keyCode === 107) { // K
        // XXX reset phyics here
      }
    };
    input.on('keypress', _keypress);

    this._cleanup = () => {
      elements.unregisterEntity(this, testEntity);

      input.removeListener('keypress', _keypress);
    };
  }

  unmount() {
    console.log('unmount');

    this._cleanup();
  }
}

module.exports = Test;

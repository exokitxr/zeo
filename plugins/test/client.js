class Test {
  mount() {
    const {elements, input, pose, payment} = zeo;

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
      },
      entityRemovedCallback(entityElement) {
        console.log('entityRemovedCallback', {entityElement});
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

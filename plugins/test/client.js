class Test {
  mount() {
    const {elements} = zeo;

    console.log('mount');

    const testComponent = {
      selector: 'test'
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
      entityAddedCallback(entityElement, attribute, value) {
        console.log('entityAddedCallback', {entityElement, attribute, value});
      },
      entityRemovedCallback(entityElement) {
        console.log('entityRemovedCallback', {entityElement});
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        console.log('entityAttributeValueChangedCallback', {entityElement, name, oldValue, newValue});
      },
    };
    elements.registerComponent(this, testComponent);

    this._cleanup = () => {
      elements.unregisterComponent(this, testComponent);
    };
  }

  unmount() {
    console.log('unmount');

    this._cleanup();
  }
}

module.exports = Test;

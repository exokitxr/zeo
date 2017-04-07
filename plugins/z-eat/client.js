const SIDES = ['left', 'right'];

class ZEat {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    const {three: {THREE}, elements, pose, input, utils: {js: {events: {EventEmitter}}}} = zeo;

    const worldElement = elements.getWorldElement();

    const _decomposeObjectMatrixWorld = object => {
      const {matrixWorld} = object;
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrixWorld.decompose(position, rotation, scale);
      return {position, rotation, scale};
    };

    const edibles = [];
    const edibleComponent = {
      selector: '[edible]',
      attributes: {
        edible: {
          type: 'checkbox',
          value: true,
        },
      },
      entityAddedCallback(entityElement) {
        const grabbable = new Grabbable(entityElement, entityElement.getObject());
        entityElement.setComponentApi(grabbable);
      },
      entityRemovedCallback(entityElement) {
        const grabbable = entityElement.getComponentApi();
        grabbable.destroy();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getComponentApi();

        switch (name) {
          case 'edible': {
            entityApi.setEdible(newValue);

            break;
          }
        }
      }
    };
    elements.registerComponent(this, edibleComponent);

    const eaters = [];
    const eaterComponent = {
      selector: '[eater]',
      attributes: {
        eater: {
          type: 'checkbox',
          value: true,
        },
      },
      entityAddedCallback(entityElement) {
        const grabbable = new Grabbable(entityElement, entityElement.getObject());
        entityElement.setComponentApi(grabbable);
      },
      entityRemovedCallback(entityElement) {
        const grabbable = entityElement.getComponentApi();
        grabbable.destroy();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getComponentApi();

        switch (name) {
          case 'eater': {
            entityApi.setEater(newValue);

            break;
          }
        }
      }
    };
    elements.registerComponent(this, eaterComponent);

    const _update = () => {
      // XXX
    };
    render.addListener('update', _update);

    this._cleanup = () => {
      elements.unregisterComponent(this, edibleComponent);

      render.removeListener('update', _update);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = ZEat;

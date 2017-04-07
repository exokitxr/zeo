const EAT_RADIUS = 0.2;

const SIDES = ['left', 'right'];

class ZEat {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    const {three: {THREE, camera}, elements, pose, input, render, utils: {js: {events: {EventEmitter}}}} = zeo;

    const worldElement = elements.getWorldElement();

    const _decomposeObjectMatrixWorld = object => {
      const {matrixWorld} = object;
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrixWorld.decompose(position, rotation, scale);
      return {position, rotation, scale};
    };

    class Edible {
      constructor(entityElement, entityObject) {
        this.entityElement = entityElement;
        this.entityObject = entityObject;
      }

      setEnabled(enabled) {
        this.enabled = enabled;
      }

      update() {
        const {entityObject} = this;
        const position = entityObject.getWorldPosition();

        for (let i = 0; i < eaters.length; i++) {
          const eater = eaters[i];

          if (eater.getWorldPosition().distanceTo(position) < EAT_RADIUS) {
            const {entityElement: edibleElement} = this;
            const {entityElement: eaterElement} = eater;

            const eatEvent = new CustomEvent('eat', {
              detail: {
                edible: edibleElement,
                eater: eaterElement,
              },
            });
            edibleElement.dispatchEvent(eatEvent);
            eaterElement.dispatchEvent(eatEvent);

            return true;
          }
        }

        return false;
      }

      destroy() {}
    }

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
        const edible = new Edible(entityElement, entityElement.getObject());
        entityElement.setComponentApi(edible);
      },
      entityRemovedCallback(entityElement) {
        const edible = entityElement.getComponentApi();
        edible.destroy();

        edibles.splice(edibles.indexOf(edible), 1);
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const edible = entityElement.getComponentApi();

        switch (name) {
          case 'edible': {
            edible.setEnabled(newValue);

            break;
          }
        }
      }
    };
    elements.registerComponent(this, edibleComponent);

    class Eater {
      constructor(entityElement, entityObject) {
        this.entityElement = entityElement;
        this.entityObject = entityObject;

        this.enabled = false;
      }

      setEnabled(enabled) {
        this.enabled = enabled;
      }

      /* update() {
        const {entityObject} = this;
        const position = entityObject.getWorldPosition();

        for (let i = 0; i < edibles.length; i++) {
          const edible = edibles[i];

          if (edible.getWorldPosition().distanceTo(position) < EAT_RADIUS) {
            const {entityElement: eaterElement} = this;
            const {entityElement: edibleElement} = edible;

            const eatEvent = new CustomEvent('eat', {
              detail: {
                eater: eaterElement,
                edible: edibleElement,
              },
            });
            eaterElement.dispatchEvent(eatEvent);
            edibleElement.dispatchEvent(eatEvent);

            return true;
          }
        }

        return false;
      } */

      destroy() {}
    }

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
        const eater = new Eater(entityElement, entityElement.getObject());
        entityElement.setComponentApi(eater);
      },
      entityRemovedCallback(entityElement) {
        const eater = new Eater(entityElement, entityElement.getObject());
        eater.destroy();

        eaters.splice(eaters.indexOf(eater), 1);
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const eater = entityElement.getComponentApi();

        switch (name) {
          case 'eater': {
            eater.setEnabled(newValue);

            break;
          }
        }
      }
    };
    elements.registerComponent(this, eaterComponent);

    const _update = () => {
      for (let i = 0; i < edibles.length i++) {
        const edible = edibles[i];
        const eaten = edible.update();

        if (!eaten) {
          const {position} = camera;

          if (edible.getWorldPosition().distanceTo(position) < EAT_RADIUS) {
            const {entityElement: edibleElement} = edible;

            const eatEvent = new CustomEvent('eat', {
              detail: {
                edible: edibleElement,
                eater: null,
              },
            });
            edibleElement.dispatchEvent(eatEvent);

            return true;
          }
        }
      }
    };
    render.addListener('update', _update);

    this._cleanup = () => {
      elements.unregisterComponent(this, edibleComponent);
      elements.unregisterComponent(this, eaterComponent);

      render.removeListener('update', _update);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = ZEat;

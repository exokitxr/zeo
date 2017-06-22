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

        this.enabled = false;
        this.size = null;
      }

      setEnabled(enabled) {
        this.enabled = enabled;
      }

      setSize(size) {
        this.size = size;
      }

      update() {
        const {entityObject: edibleEntityObject, size} = this;
        const ediblePosition = edibleEntityObject.getWorldPosition();
        const edibleSize = Math.max(size[0], size[1], size[2]);

        for (let i = 0; i < eaters.length; i++) {
          const eater = eaters[i];
          const {entityObject: eaterEntityObject, size} = eater;
          const eaterPosition = eaterEntityObject.getWorldPosition();
          const eaterSize = Math.max(size[0], size[1], size[2]);

          if (eaterPosition.distanceTo(ediblePosition) < (edibleSize + eaterSize)) {
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
    const edibleEntity = {
      attributes: {
        edible: {
          type: 'checkbox',
          value: true,
        },
        size: {
          type: 'vector',
          value: [0.2, 0.2, 0.2],
        },
      },
      entityAddedCallback(entityElement) {
        const edible = new Edible(entityElement, entityElement.getObject());
        entityElement.setEntityApi(edible);
        edibles.push(edible);
      },
      entityRemovedCallback(entityElement) {
        const edible = entityElement.getEntityApi();
        edible.destroy();

        edibles.splice(edibles.indexOf(edible), 1);
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const edible = entityElement.getEntityApi();

        switch (name) {
          case 'edible': {
            edible.setEnabled(newValue);

            break;
          }
          case 'size': {
            edible.setSize(newValue);

            break;
          }
        }
      }
    };
    elements.registerEntity(this, edibleEntity);

    class Eater {
      constructor(entityElement, entityObject) {
        this.entityElement = entityElement;
        this.entityObject = entityObject;

        this.enabled = false;
        this.size = null;
      }

      setEnabled(enabled) {
        this.enabled = enabled;
      }

      setSize(size) {
        this.size = size;
      }

      destroy() {}
    }

    const eaters = [];
    const eaterEntity = {
      attributes: {
        eater: {
          type: 'checkbox',
          value: true,
        },
        size: {
          type: 'vector',
          value: [1, 1, 1],
        },
      },
      entityAddedCallback(entityElement) {
        const eater = new Eater(entityElement, entityElement.getObject());
        entityElement.setEntityApi(eater);
        eaters.push(eater);
      },
      entityRemovedCallback(entityElement) {
        const eater = new Eater(entityElement, entityElement.getObject());
        eater.destroy();

        eaters.splice(eaters.indexOf(eater), 1);
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const eater = entityElement.getEntityApi();

        switch (name) {
          case 'eater': {
            eater.setEnabled(newValue);

            break;
          }
          case 'size': {
            eater.setSize(newValue);

            break;
          }
        }
      }
    };
    elements.registerEntity(this, eaterEntity);

    const _update = () => {
      for (let i = 0; i < edibles.length; i++) {
        const edible = edibles[i];
        const eaten = edible.update();

        if (!eaten) {
          const {position} = camera;
          const {entityObject: edibleEntityObject, size} = edible;
          const edibleWorldPosition = edibleEntityObject.getWorldPosition();
          const edibleSize = Math.max(size[0], size[1], size[2]);

          if (edibleWorldPosition.distanceTo(position) < edibleSize) {
            const {entityElement: edibleElement} = edible;

            const eatEvent = new CustomEvent('eat', {
              detail: {
                edible: edibleElement,
                eater: null,
              },
            });
            edibleElement.dispatchEvent(eatEvent);
          }
        }
      }
    };
    render.on('update', _update);

    this._cleanup = () => {
      elements.unregisterEntity(this, edibleEntity);
      elements.unregisterEntity(this, eaterEntity);

      render.removeListener('update', _update);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = ZEat;

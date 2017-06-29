const events = require('events');
const {EventEmitter} = events;

class Tags {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    class Element extends EventEmitter {
      constructor(tagName, module) {
        super();

        this.tagName = tagName.toUpperCase();
        this.module = module;

        this.children = [];
      }

      querySelectorAll(selector) {
        selector = selector.toUpperCase();

        const result = [];

        const _recurse = e => {
          const {tagName} = e;
          if (tagName === selector) {
            resule.push(e);
          }

          const {children} = e;
          for (let i = 0; i < children.length; i++) {
            const child = children[i];
            _recurse(child);
          }
        };
        _recurse(this);

        return result;
      }

      querySelector(selector) {
        const queue = [this];

        while (queue.length > 0) {
          const e = queue.pop();
          const {tagName} = e;

          if (tagName) {
            return e;
          } else {
            const {children} = e;
            queue.push.apply(queue, children);
          }
        }

        return null;
      }

      appendChild(child) {
        this.children.push(child);
      }

      removeChild(child) {
        this.children.splice(this.children.indexOf(child));
      }
    }

    const worldElement = new Element('world', 'zeo');

    const entityApiElements = new Map(); // entityApi -> entityElement

    const _getWorldElement = () => worldElement;
    const _registerEntity = (pluginInstance, entityApi) => {
      const name = archae.getPath(pluginInstance);
      const tagName = _makeTagName(name);
      const entityElement = new Element(tagName, name);
      worldEllement.appendChild(entityElement);

      entityApiElements.set(entityApi, entityElement);

      const {entityAddedCallback = nop} = entityApi;
      entityAddedCallback(entityElement);

      world.emit('elementAdded', entityElement);
    };
    const _unregisterEntity = (pluginInstance, entityApi) => {
      const entityElement = entityApiElements.get(entityApi);
      entityApiElements.delete(entityApi);

      world.removeChild(entityElement);

      const {entityAddedCallback = nop} = entityApi;
      entityAddedCallback(entityElement);

      worldElement.emit('elementRemoved', entityElement);
    };

    return {
      getWorldElement: _getWorldElement,
      registerEntity: _registerEntity,
      unregisterEntity: _unregisterEntity,
    };
  }

  unmount() {
    this._cleanup();
  }
}

const nop = () => {};
const _makeTagName = s => s
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, '-')
  .replace(/--+/g, '-')
  .replace(/(?:^-|-$)/g, '');

module.exports = Tags;

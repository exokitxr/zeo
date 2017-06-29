class Tags {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    class Element {
      constructor(tagName) {
        this.tagName = tagName.toUpperCase();

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

    const worldElement = new Element('world');

    const entityApiElements = new Map(); // entityApi -> entityElement

    const _getWorldElement = () => worldElement;
    const _registerEntity = (pluginInstance, entityApi) => {
      const name = archae.getPath(pluginInstance);
      const tagName = _makeTagName(name);
      const entityElement = new Element(tagName);
      worldEllement.appendChild(entityElement);

      entityApiElements.set(entityApi, entityElement);

      const {entityAddedCallback = nop} = entityApi;
      entityAddedCallback(element);
    };
    const _unregisterEntity = (pluginInstance, entityApi) => {
      const entityElement = entityApiElements.get(entityApi);

      world.removeChild(entityElement);

      const {entityAddedCallback = nop} = entityApi;
      entityAddedCallback(element);
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

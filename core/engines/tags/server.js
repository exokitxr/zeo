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

      addEventListener() {
        return this.on.apply(this, arguments);
      }

      removeEventListener() {
        return this.removeListener.apply(this, arguments);
      }

      querySelectorAll(selector) {
        selector = selector.toUpperCase();

        const result = [];

        const _recurse = e => {
          const {tagName} = e;
          if (tagName === selector) {
            result.push(e);
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
        selector = selector.toUpperCase();

        const queue = [this];

        while (queue.length > 0) {
          const e = queue.pop();
          const {tagName} = e;
          if (tagName === selector) {
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

    const _getWorldElement = () => worldElement;
    const _requestElement = (selector, {timeout = 30 * 1000} = {}) => {
      const element = worldElement.querySelector(selector);

      if (element) {
        return Promise.resolve(element);
      } else {
        let _elementAdded = null;
        const _requestElementAdded = () => new Promise((accept, reject) => {
          _elementAdded = element => {
            const {tagName} = element;

            if (tagName === selector) {
              accept(element);
            }
          };
          worldElement.on('elementAdded', _elementAdded);
        });
        let timeoutInstance = null;
        const _requestTimeout = () => new Promise((accept, reject) => {
          timeoutInstance = setTimeout(() => {
            timeoutInstance = null;

            const err = new Error(`element request for ${JSON.stringify(selector)} timed out`);
            err.code = 'ETIMEOUT';
            reject(err);
          }, timeout);
        });
        const _cleanup = () => {
          worldElement.removeListener('elementAdded', _elementAdded);

          if (timeoutInstance !== null) {
            clearTimeout(timeoutInstance);
          }
        };

        return Promise.race([
          _requestElementAdded(),
          _requestTimeout(),
        ])
          .then(element => {
            _cleanup();

            return Promise.resolve(element);
          })
          .catch(err => {
            _cleanup();

            return Promise.reject(err);
          });
      }
    };
    const _registerEntity = (pluginInstance, entityApi) => {
      entityApi.tagName = _makeTagName(archae.getPath(pluginInstance));
      worldElement.appendChild(entityApi);

      const {entityAddedCallback = nop} = entityApi;
      entityAddedCallback(entityApi);

      worldElement.emit('elementAdded', entityApi);
    };
    const _unregisterEntity = (pluginInstance, entityApi) => {
      worldElement.removeChild(entityApi);

      const {entityRemovedCallback = nop} = entityApi;
      entityRemovedCallback(entityApi);

      worldElement.emit('elementRemoved', entityApi);
    };

    return {
      getWorldElement: _getWorldElement,
      requestElement: _requestElement,
      registerEntity: _registerEntity,
      unregisterEntity: _unregisterEntity,
    };
  }

  unmount() {
    this._cleanup();
  }
}

const nop = () => {};
const _makeTagName = s => /\//.test(s) ? s : s.replace(/@.*$/, '');

module.exports = Tags;

class Input {
  constructor(archae) {
    // this._archae = archae;
  }

  mount() {
    // const {_archae: archae} = this;

    class Listener {
      constructor(handler, priority) {
        this.handler = handler;
        this.priority = priority;
      }
    }

    const _makeEventListener = () => {
      const listeners = [];

      const result = e => {
        let live = true;
        e.stopImmediatePropagation = (stopImmediatePropagation => () => {
          live = false;

          stopImmediatePropagation.call(e);
        })(e.stopImmediatePropagation);

        const oldListeners = listeners.slice();
        for (let i = 0; i < oldListeners.length; i++) {
          const listener = oldListeners[i];
          const {handler} = listener;

          handler(e);

          if (!live) {
            break;
          }
        }
      };
      result.add = (handler, {priority}) => {
        const listener = new Listener(handler, priority);
        listeners.push(listener);
        listeners.sort((a, b) => b.priority - a.priority);
      };
      result.remove = handler => {
        const index = listeners.indexOf(handler);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      };

      return result;
    };
    const eventListeners = (() => {
      const result = {};
      [
        'click',
        'mousedown',
        'mouseup',
        'mousemove',
        'mousewheel',
        'keypress',
        'keydown',
        'keyup',
      ].forEach(event => {
        result[event] = _makeEventListener();
      });
      return result;
    })();
    window.addEventListener('click', eventListeners.click);
    window.addEventListener('mousedown', eventListeners.mousedown);
    window.addEventListener('mouseup', eventListeners.mouseup);
    window.addEventListener('mousemove', eventListeners.mousemove);
    window.addEventListener('mousewheel', eventListeners.mousewheel);
    window.addEventListener('keypress', eventListeners.keypress);
    window.addEventListener('keydown', eventListeners.keydown);
    window.addEventListener('keyup', eventListeners.keyup);

    this._cleanup = () => {
      window.removeEventListener('click', eventListeners.click);
      window.removeEventListener('mousedown', eventListeners.mousedown);
      window.removeEventListener('mouseup', eventListeners.mouseup);
      window.removeEventListener('mousemove', eventListeners.mousemove);
      window.removeEventListener('keypress', eventListeners.keypress);
      window.removeEventListener('keydown', eventListeners.keydown);
      window.removeEventListener('keyup', eventListeners.keyup);
    };

    const _addEventListener = (event, handler, {priority = 0} = {}) => {
      const eventListener = eventListeners[event];
      if (eventListener) {
        eventListener.add(handler, {
          priority,
        });
      }
    };
    const _removeEventListener = (event, handler) => {
      const eventListener = eventListeners[event];
      if (eventListener) {
        eventListener.remove(handler);
      }
    };

    return {
      addEventListener: _addEventListener,
      removeEventListener: _removeEventListener,
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Input;

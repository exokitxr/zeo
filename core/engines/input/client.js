const DEFAULT_EVENT_SIDE = 'left';

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

    class EventRouter {
      constructor() {
        this.handle = this.handle.bind(this);

        this.listeners = [];
      }

      handle(e) {
        const {listeners} = this;

        let live = true;
        e.stopImmediatePropagation = (stopImmediatePropagation => () => {
          live = false;

          stopImmediatePropagation.call(e);
        })(e.stopImmediatePropagation);
        if (e.side === undefined) {
          e.side = DEFAULT_EVENT_SIDE;
        }

        const oldListeners = listeners.slice();
        for (let i = 0; i < oldListeners.length; i++) {
          const listener = oldListeners[i];
          const {handler} = listener;

          handler(e);

          if (!live) {
            break;
          }
        }
      }

      add(handler, {priority}) {
        const {listeners} = this;

        const listener = new Listener(handler, priority);
        listeners.push(listener);
        listeners.sort((a, b) => b.priority - a.priority);
      }

      remove(handler) {
        const {listeners} = this;

        const index = listeners.findIndex(listener => listener.handler === handler);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      }
    }

    const eventRouters = (() => {
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
        'trigger',
        'triggerdown',
        'triggerup',
        'pad',
        'paddown',
        'padup',
        'grip',
        'gripdown',
        'gripup',
        'menu',
        'menudown',
        'menuup',
      ].forEach(event => {
        result[event] = new EventRouter();
      });
      return result;
    })();
    window.addEventListener('click', eventRouters.click.handle);
    window.addEventListener('mousedown', eventRouters.mousedown.handle);
    window.addEventListener('mouseup', eventRouters.mouseup.handle);
    window.addEventListener('mousemove', eventRouters.mousemove.handle);
    window.addEventListener('mousewheel', eventRouters.mousewheel.handle);
    window.addEventListener('keypress', eventRouters.keypress.handle);
    window.addEventListener('keydown', eventRouters.keydown.handle);
    window.addEventListener('keyup', eventRouters.keyup.handle);

    this._cleanup = () => {
      window.removeEventListener('click', eventRouters.click.handle);
      window.removeEventListener('mousedown', eventRouters.mousedown.handle);
      window.removeEventListener('mouseup', eventRouters.mouseup.handle);
      window.removeEventListener('mousemove', eventRouters.mousemove.handle);
      window.removeEventListener('keypress', eventRouters.keypress.handle);
      window.removeEventListener('keydown', eventRouters.keydown.handle);
      window.removeEventListener('keyup', eventRouters.keyup.handle);
    };

    const _addEventListener = (event, handler, {priority = 0} = {}) => {
      const eventRouter = eventRouters[event];
      if (eventRouter) {
        eventRouter.add(handler, {
          priority,
        });
      }
    };
    const _removeEventListener = (event, handler) => {
      const eventRouter = eventRouters[event];
      if (eventRouter) {
        eventRouter.remove(handler);
      }
    };
    const _triggerEvent = (event, {side = DEFAULT_EVENT_SIDE} = {}) => {
      const eventRouter = eventRouters[event];
      if (eventRouter) {
        eventRouter.handle({side});
      }
    };

    return {
      addEventListener: _addEventListener,
      removeEventListener: _removeEventListener,
      triggerEvent: _triggerEvent,
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Input;

const EVENTS = [
  'click',
  'mousedown',
  'mouseup',
  'mousemove',
  'mousewheel',
  'wheel',
  'keypress',
  'keydown',
  'keyup',
  'paste',
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
  'keyboardpress',
  'keyboarddown',
  'keyboardup',
];
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

          if (stopImmediatePropagation) {
            stopImmediatePropagation.call(e);
          }
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

      removeAll() {
        const {listeners} = this;
        listeners.length = 0;
      }
    }

    const eventRouters = (() => {
      const result = {};
      EVENTS.forEach(event => {
        result[event] = new EventRouter();
      });
      return result;
    })();
    window.addEventListener('click', eventRouters.click.handle);
    window.addEventListener('mousedown', eventRouters.mousedown.handle);
    window.addEventListener('mouseup', eventRouters.mouseup.handle);
    window.addEventListener('mousemove', eventRouters.mousemove.handle);
    window.addEventListener('mousewheel', eventRouters.mousewheel.handle);
    window.addEventListener('wheel', eventRouters.wheel.handle);
    window.addEventListener('keypress', eventRouters.keypress.handle);
    window.addEventListener('keydown', eventRouters.keydown.handle);
    window.addEventListener('keyup', eventRouters.keyup.handle);
    document.addEventListener('paste', eventRouters.paste.handle);

    this._cleanup = () => {
      window.removeEventListener('click', eventRouters.click.handle);
      window.removeEventListener('mousedown', eventRouters.mousedown.handle);
      window.removeEventListener('mouseup', eventRouters.mouseup.handle);
      window.removeEventListener('mousemove', eventRouters.mousemove.handle);
      window.removeEventListener('keypress', eventRouters.keypress.handle);
      window.removeEventListener('keydown', eventRouters.keydown.handle);
      window.removeEventListener('keyup', eventRouters.keyup.handle);
      document.removeEventListener('paste', eventRouters.paste.handle);
    };

    function _on(event, handler, {priority = 0} = {}) {
      const eventRouter = eventRouters[event];
      if (eventRouter) {
        eventRouter.add(handler, {
          priority,
        });
      }

      return this;
    }
    function _removeListener(event, handler) {
      const eventRouter = eventRouters[event];
      if (eventRouter) {
        eventRouter.remove(handler);
      }

      return this;
    }
    function _removeAllListeners(event) {
      const eventRouter = eventRouters[event];
      if (eventRouter) {
        eventRouter.removeAll();
      }

      return this;
    }
    function _triggerEvent(event, eventData) {
      const eventRouter = eventRouters[event];
      if (eventRouter) {
        eventRouter.handle(eventData);
      }

      return this;
    }

    return {
      EVENTS,
      on: _on,
      removeListener: _removeListener,
      removeAllListeners: _removeAllListeners,
      triggerEvent: _triggerEvent,
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Input;

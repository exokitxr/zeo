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
  'padtouch',
  'padtouchdown',
  'padtouchup',
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
        this.live = true;
      }
    }

    class InputEvent {
      constructor() {
        this.event = null;
        this.side = DEFAULT_EVENT_SIDE;
        this.live = true;

        this.reset();
      }
      preventDefault() {}
      stopPropagation() {}
      stopImmediatePropagation() {
        this.live = false;
      }
      reset() {
        this.event = null;
        this.side = DEFAULT_EVENT_SIDE;
        this.live = true;
      }
    }
    const inputEvent = new InputEvent();

    class EventRouter {
      constructor() {
        this.handle = this.handle.bind(this);

        this.listeners = [];
      }

      handle(e) {
        inputEvent.reset();
        inputEvent.event = e;
        inputEvent.side = e.side || DEFAULT_EVENT_SIDE;

        // e.stopPropagation();

        for (let i = 0; i < this.listeners.length; i++) {
          const listener = this.listeners[i];
          if (listener.live) {
            listener.handler(inputEvent);
          }

          if (!inputEvent.live) {
            break;
          }
        }
      }

      add(handler, {priority}) {
        const listener = new Listener(handler, priority);
        this.listeners.push(listener);
        this.listeners.sort((a, b) => b.priority - a.priority);
      }

      remove(handler) {
        const listener = this.listeners.find(listener => listener.handler === handler);
        if (listener) {
          listener.live = false;

          setTimeout(() => {
            this.listeners.splice(this.listeners.indexOf(listener), 1);
          });
        }
      }

      removeAll() {
        this.listeners.length = 0;
      }
    }

    const _preventKeyHijack = e => {
      // prevent some key combinations from hijacking input
      if (
        (e.keyCode === 8) || // Backspace
        (e.keyCode === 18) || // Alt
        (e.ctrlKey && e.keyCode === 70) || // Ctrl-F
        (e.ctrlKey && e.keyCode === 87) || // Ctrl-W
        (e.ctrlKey && e.keyCode === 83) // Ctrl-S
      ) {
        e.preventDefault();
      }
    };

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
    const keydown = e => {
      _preventKeyHijack(e);
      eventRouters.keydown.handle(e);
    };
    window.addEventListener('keydown', keydown);
    const keypress = e => {
      _preventKeyHijack(e);
      eventRouters.keypress.handle(e);
    };
    window.addEventListener('keypress', keypress);
    const keyup = e => {
      _preventKeyHijack(e);
      eventRouters.keyup.handle(e);
    };
    window.addEventListener('keyup', keyup);
    document.addEventListener('paste', eventRouters.paste.handle);

    this._cleanup = () => {
      window.removeEventListener('click', eventRouters.click.handle);
      window.removeEventListener('mousedown', eventRouters.mousedown.handle);
      window.removeEventListener('mouseup', eventRouters.mouseup.handle);
      window.removeEventListener('mousemove', eventRouters.mousemove.handle);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keypress', keypress);
      window.removeEventListener('keyup', keyup);
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
const nop = () => {};

module.exports = Input;

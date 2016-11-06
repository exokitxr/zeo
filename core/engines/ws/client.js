const events = require('events');
const {EventEmitter} = events;

const client = () => ({
  mount() {
    const connection = new WebSocket('ws://' + location.host + '/archae/engineWs');
    connection.onopen = () => {
      if (queue.length > 0) {
        for (let i = 0; i < queue.length; i++) {
          const entry = queue[i];
          const {event, data} = entry;
          _emit.call(result, event, data);
        }

        queue = [];
      }
    };
    connection.onerror = err => {
      console.warn(err);
    };
    connection.onmessage = msg => {
      const m = JSON.parse(msg.data);
      const {event, data} = m;
      _emit.call(result, event, data);
    };
    let queue = [];

    const result = new EventEmitter();

    const _emit = result.emit;
    result.emit = function(event, data) {
      const o = {
        event,
        data,
      };

      if (connection.readyState === WebSocket.OPEN) {
        connection.send(JSON.stringify(o));
      } else {
        queue.push(o);
      }
    };

    this._cleanup = () => {
      connection.close();
    };

    return result;
  },
  unmount() {
    this._cleanup();
  },
});

module.exports = client;

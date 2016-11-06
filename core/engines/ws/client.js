const events = require('events');
const {EventEmitter} = events;

const client = () => {
  let connection = null;
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

  result.mount = function() {
    connection = new WebSocket('ws://' + location.host + '/archae/engineWs');
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

    this._cleanup = () => {
      connection.close();
      connection = null;
    };

    return result;
  };
  result.unmount = function() {
    this._cleanup();
  };
  return result;
};

module.exports = client;

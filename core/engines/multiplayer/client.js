const events = require('events');
const {EventEmitter} = events;

const client = () => ({
  mount() {
    const connection = new WebSocket('ws://' + location.host + '/archae/multiplayerWs');
    connection.onopen = () => {
      if (queue.length > 0) {
        for (let i = 0; i < queue.length; i++) {
          const e = queue[i];
          const es = JSON.stringify(e);
          connection.send(es);
        }

        queue = [];
      }
    };
    connection.onerror = err => {
      console.warn(err);
    };
    connection.onmessage = msg => {
      const m = JSON.parse(msg.data);
      const {type} = m;
      if (type === 'statuses') {
        const {statuses} = m;
        for (let i = 0; i < statuses.length; i++) {
          const entry = statuses[i];
          const {id, status} = entry;
          _emit.call(result, 'status', {id, status});
        }
      } else if (type === 'status') {
        const {id, status} = m;
        _emit.call(result, 'status', {id, status});
      }
    };
    let queue = [];

    const result = new EventEmitter();

    const _emit = result.emit;
    result.status = function(status) {
      const e = {
        type: 'status',
        status,
      };

      if (connection.readyState === WebSocket.OPEN) {
        const es = JSON.stringify(e);
        connection.send(es);
      } else {
        queue.push(e);
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

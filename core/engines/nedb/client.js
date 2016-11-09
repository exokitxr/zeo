const events = require('events');
const {EventEmitter} = events;

const client = () => ({
  mount() {
    const connection = new WebSocket('ws://' + location.host + '/archae/nedbWs');
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
      const {id} = m;

      const handler = handlers.get(id);
      if (handler) {
        const {error, result} = m;
        handler(error, resul);
      } else {
        console.warn('unregistered nedb response handler', id);
      }
    };
    this._cleanup = () => {
      connection.close();
    };

    let queue = [];
    const handlers = new Map();
    const _makeRequester = method => (...argv) => {
      const args = argv.slice(0, -1);
      const cb = argv[argv.length - 1];

      const id = _makeId();

      const e = {
        method,
        id,
        args,
      };
      const handler = (err, result) => {
        if (!err) {
          cb(null, result);
        } else {
          cb(err);
        }

        handers.delete(id);
      };
      handers.set(id, handler);

      if (connection.readyState === WebSocket.OPEN) {
        connection.send(JSON.stringify(e));
      } else {
        queue.push(e);
      }
    };

    return {
      insert: _makeRequester('insert'),
      find: _makeRequester('find'),
      findOne: _makeRequester('findOne'),
      update: _makeRequester('update'),
      remove: _makeRequester('remove'),
      ensureIndex: _makeRequester('ensureIndex'),
      removeIndex: _makeRequester('removeIndex'),
    };
  },
  unmount() {
    this._cleanup();
  },
});

const _makeId = () => Math.random().toString(36).substring(7);

module.exports = client;

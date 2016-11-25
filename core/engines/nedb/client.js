const events = require('events');
const {EventEmitter} = events;

class Nedb {
  mount() {
    const connection = new WebSocket('wss://' + location.host + '/archae/nedbWs');
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

      const requestHandler = requestHandlers.get(id);
      if (requestHandler) {
        const {error, result} = m;
        requestHandler(error, result);
      } else {
        const subscriptionHandler = subscriptionHandlers.get(id);
        if (subscriptionHandler) {
          const {data} = m;
          subscriptionHandler(data);
        } else {
          console.warn('unregistered handler:', JSON.stringify(id));
        }
      }
    };
    this._cleanup = () => {
      connection.close();
    };

    let queue = [];
    const requestHandlers = new Map();
    const _makeRequester = method => (...argv) => {
      const args = argv.slice(0, -1);
      const cb = argv[argv.length - 1];

      _request(method, args, cb);
    };
    const _request = (method, args, cb) => {
      const id = _makeId();

      const e = {
        method,
        id,
        args,
      };
      const requestHandler = (err, result) => {
        if (!err) {
          cb(null, result);
        } else {
          cb(err);
        }

        requestHandlers.delete(id);
      };
      requestHandlers.set(id, requestHandler);

      if (connection.readyState === WebSocket.OPEN) {
        connection.send(JSON.stringify(e));
      } else {
        queue.push(e);
      }
    };

    const subscriptionHandlers = new Map();

    return {
      insert: _makeRequester('insert'),
      find: _makeRequester('find'),
      findOne: _makeRequester('findOne'),
      update: _makeRequester('update'),
      remove: _makeRequester('remove'),
      ensureIndex: _makeRequester('ensureIndex'),
      removeIndex: _makeRequester('removeIndex'),
      subscribe: (query, subscriptionHandler) => {
        const subscriptionId = _makeId();

        _request('subscribe', [query, subscriptionId], error => {
          if (error) {
            console.warn(err);
          }
        });

        subscriptionHandlers.set(subscriptionId, subscriptionHandler);

        return {
          destroy: () => {
            _request('unsubscribe', [subscriptionId], error => {
              if (error) {
                console.warn(err);
              }
            });

            subscriptionHandlers.delete(subscriptionId);
          },
        };
      },
    };
  }

  unmount() {
    this._cleanup();
  }
}

const _makeId = () => Math.random().toString(36).substring(7);

module.exports = Nedb;

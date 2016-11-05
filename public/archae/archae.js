class ArchaeClient {
  constructor() {
    // XXX
  }

  addPlugin(plugin, cb) {
    const id = _makeId();

    this.send({
      type: 'addPlugin',
      id: id,
      plugin: plugin,
    });

    this.on(id, (err, result) => {
      console.log('got result', {err, result});
    });

    cb();
  }

  removePlugin(plugin, cb) {
    this.send({
      type: 'removePlugin',
      plugin: _stringifyPlugin(plugin),
    });

    cb();
  }

  connect() {
    const connection = (() => {
      const result = new WebSocket('ws://' + window.location.host + '/archae/ws');
      result.onopen = () => {
        console.log('on open');

        if (this._queue.length > 0) {
          for (let i = 0; i < this._queue.length; i++) {
            this.send(this._queue[i]);
          }
          this._queue = [];
        }
      };
      result.onerror = err => {
        console.warn(err);
      };
      result.onmessage = msg => {
        const m = JSON.parse(msg.data);

        console.log('on messsage', m);

        for (let i = 0; i < this._listeners.length; i++) {
          const listener = this._listeners[i];
          listener(m);
        }
      };
      return result;
    })();

    this._connection = connection;
    this._queue = [];
    this._listeners = [];
  }

  send(o) {
    if (this._connection.readyState === 1) {
      this._connection.send(JSON.stringify(o));
    } else {
      this._queue.push(o);
    }
  }

  on(id, cb) {
    const listener = m => {
      if (m.id === id) {
        cb(m.error, m.result);

        this._listeners.splice(this._listeners.indexOf(listener), 1);
      }
    };
    this._listeners.push(listener);
  }
}

const _makeId = () => Math.random().toString(36).substring(7);

const archae = new ArchaeClient();
archae.connect();

window.archae = archae;

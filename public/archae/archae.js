class ArchaeClient {
  constructor() {
    // XXX
  }

  addPlugin(plugin, cb) {
    this.send({
      type: 'addPlugin',
      plugin: _stringifyPlugin(plugin),
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
      };
      return result;
    })();

    this._connection = connection;
    this._queue = [];
  }

  send(o) {
    if (this._connection.readyState === 1) {
      this._connection.send(JSON.stringify(o));
    } else {
      this._queue.push(o);
    }
  }
}

const _stringifyPlugin = plugin => {
  if (plugin.client) {
    plugin.client = plugin.client.toString();
  }
  if (plugin.server) {
    plugin.server = plugin.server.toString();
  }

  return plugin;
};

const archae = new ArchaeClient();
archae.connect();

window.archae = archae;

class ArchaeClient {
  constructor() {
    // XXX
  }

  addPlugin(plugin, cb) {
    // XXX
    cb();
  }

  removePlugin(plugin, cb) {
    // XXX
    cb();
  }

  connect() {
    const connection = (() => {
      const result = new Websocket('ws://' + window.location.host + '/archae/ws');
      result.onopen = () => {
        console.log('on open');
      };
      result.onerror = err => {
        console.warn(err);
      };
      result.onmessage = m => {
        console.log('on messsage', m);
      };
      return result;
    })();

    this.connection = connection;
  }
}

window.archae = new ArchaeClient();

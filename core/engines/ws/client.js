class Ws {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    return archae.requestPlugins([
      '/core/utils/js-utils',
    ]).then(([
      jsUtils,
    ]) => {
      const {events} = jsUtils;
      const {EventEmitter} = events;

      const connection = new WebSocket('wss://' + location.host + '/archae/engineWs');
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
        const {event, data} = m;
        _emit.call(result, event, data);
      };
      let queue = [];

      const result = new EventEmitter();

      const _emit = result.emit;
      result.emit = function(event, data) {
        const e = {
          event,
          data,
        };

        if (connection.readyState === WebSocket.OPEN) {
          const es = JSON.stringify(o);
          connection.send(es);
        } else {
          queue.push(e);
        }
      };

      this._cleanup = () => {
        connection.close();
      };

      return result;
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Ws;

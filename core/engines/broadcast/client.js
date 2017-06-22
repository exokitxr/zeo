class Broadcast {
  mount() {
    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/utils/js-utils',
      '/core/utils/network-utils',
    ]).then(([
      jsUtils,
      networkUtils,
    ]) => {
      if (live) {
        const {events} = jsUtils;
        const {EventEmitter} = events;
        const {AutoWs} = networkUtils;

        const connection = (() => {
          const connection = new AutoWs(_relativeWsUrl('archae/broadcastWs'));
          connection.on('message', msg => {
            const m = JSON.parse(msg.data);
            const {event, args} = m;

            broadcastApi.handle(event, args);
          });
          return connection;
        })();

        this._cleanup = () => {
          connection.destroy();
        };

        class BroadcastApi extends EventEmitter {
          emit(event, ...args) {
            const e = {
              event,
              args,
            };
            const es = JSON.stringify(e);
            connection.send(es);
          }

          handle(event, args) {
            super.emit.apply(this, [event].concat(args));
          }
        }
        const broadcastApi = new BroadcastApi();

        return broadcastApi;
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _relativeWsUrl = s => {
  const l = window.location;
  return ((l.protocol === 'https:') ? 'wss://' : 'ws://') + l.host + l.pathname + (!/\/$/.test(l.pathname) ? '/' : '') + s;
};

module.exports = Broadcast;

class Bootstrap {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const initialUrl = document.location.href;
    const initialPath = document.location.protocol + '//' + document.location.host + document.location.pathname;

    return archae.requestPlugins([
      '/core/utils/js-utils',
      '/core/utils/network-utils',
    ])
      .then(([
        jsUtils,
        networkUtils,
      ]) => {
        if (live) {
          const {events} = jsUtils;
          const {EventEmitter} = events;
          const {AutoWs} = networkUtils;

          let connectionState = null;
          const connection = (() => {
            const connection = new AutoWs(_relativeWsUrl('archae/bootstrapWs'));
            connection.on('message', msg => {
              const newConnectionState = JSON.parse(msg.data);

              bootstrapApi.setConnectionState(newConnectionState);
            });
            return connection;
          })();
          this._cleanup = () => {
            connection.destroy();
          };

          let vrMode = null;
          class WorldTimer {
            constructor() {
              this.startTime = Date.now();
            }

            getWorldTime() {
              const {startTime} = this;
              const now = Date.now();
              const worldTime = now - startTime;
              return worldTime;
            }
          }
          const worldTimer = new WorldTimer();

          let address = null;

          class BootstrapApi extends EventEmitter {
            getInitialUrl() {
              return initialUrl;
            }

            getInitialPath() {
              return initialPath;
            }

            getConnectionState() {
              return connectionState;
            }

            setConnectionState(newConnectionState) {
              connectionState = newConnectionState;

              this.emit('connectionStateChange', connectionState);
            }

            getVrMode() {
              return vrMode;
            }

            setVrMode(newVrMode) {
              vrMode = newVrMode;

              this.emit('vrModeChange', vrMode);
            }

            getWorldTime() {
              return worldTimer.getWorldTime();
            }

            getAddress() {
              return address;
            }

            setAddress(newAddress) {
              address = newAddress;

              this.emit('addressChange', newAddress);
            }

            navigate(url) {
              document.location.href = url;
            }
          }
          const bootstrapApi = new BootstrapApi();

          return bootstrapApi;
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
const _getQueryVariable = (url, variable) => {
  const match = url.match(/\?(.+)$/);
  const query = match ? match[1] : '';
  const vars = query.split('&');

  for (let i = 0; i < vars.length; i++) {
    const pair = vars[i].split('=');

    if (decodeURIComponent(pair[0]) === variable) {
      return decodeURIComponent(pair[1]);
    }
  }
  return null;
};

module.exports = Bootstrap;

const NUM_SERVERS = 5;

class Bootstrap {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {
      metadata: {
        server: {
          url: serverUrl,
        },
        site: {
          url: siteUrl,
        },
        vrid: {
          url: vridUrl,
        },
      },
    } = archae;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const initialUrl = document.location.href;
    const initialPath = document.location.protocol + '//' + document.location.host + document.location.pathname;

    const _resJson = res => {
      if (res.status >= 200 && res.status < 300) {
        return res.json();
      } else {
        return Promise.reject({
          status: res.status,
          stack: 'API returned invalid status code: ' + res.status,
        });
      }
    };
    const _resBlob = res => {
      if (res.status >= 200 && res.status < 300) {
        return res.blob();
      } else {
        return Promise.reject({
          status: res.status,
          stack: 'API returned invalid status code: ' + res.status,
        });
      }
    };
    const _requestKickServer = () => fetch(`${vridUrl}/id/api/cookie/servers`, {
      credentials: 'include',
    })
      .then(_resJson)
      .catch(err => {
        console.warn(err);
        return Promise.resolve();
      })
      .then(servers => {
        if (!Array.isArray(servers)) {
          servers = [];
        }
        let server = servers.find(server => server.url === serverUrl);
        if (!server) {
          server = {
            url: serverUrl,
            timestamp: 0,
          };
          servers.push(server);
        }
        server.timestamp = Date.now();
        servers.sort((a, b) => b.timestamp - a.timestamp);
        servers.length = Math.min(servers.length, NUM_SERVERS);

        return fetch(`${vridUrl}/id/api/cookie/servers`, {
          method: 'POST',
          headers: (() => {
            const headers = new Headers();
            headers.append('Content-Type', 'application/json');
            return headers;
          })(),
          body: JSON.stringify(servers),
          credentials: 'include',
        })
          .then(_resBlob);
      });
    _requestKickServer()
      .catch(err => {
        console.warn(err);
      });

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

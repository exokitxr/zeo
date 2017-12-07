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
      '/core/utils/vrid-utils',
    ])
      .then(([
        jsUtils,
        vridUtils,
      ]) => {
        if (live) {
          const {events} = jsUtils;
          const {EventEmitter} = events;
          const {vridApi} = vridUtils;

          const _resJson = res => {
            if (res.status >= 200 && res.status < 300) {
              return res.json();
            } else if (res.status === 404) {
              return Promise.resolve(null);
            } else {
              return Promise.reject({
                status: res.status,
                stack: 'API returned invalid status code: ' + res.status,
              });
            }
          };

          return Promise.all([
            vridApi.get('name'),
            fetch('archae/bootstrap')
              .then(_resJson),
          ])
            .then(([
              username,
              bootstrapSpec,
            ]) => {
              const {startTime} = bootstrapSpec;

              let vrMode = null;
              let roamMode = 'physical';
              class WorldTimer {
                constructor(startTime = Date.now()) {
                  this.startTime = startTime;
                }

                getWorldTime() {
                  const now = Date.now();
                  const worldTime = now - this.startTime;
                  return worldTime;
                }

                setStartTime(startTime) {
                  this.startTime = startTime;
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

                getUsername() {
                  return username;
                }

                getVrMode() {
                  return vrMode;
                }

                setVrMode(newVrMode) {
                  vrMode = newVrMode;
                }

                getRoamMode() {
                  return roamMode;
                }

                toggleRoamMode() {
                  roamMode = roamMode === 'free' ? 'physical' : 'free';
                }

                getWorldTime() {
                  return worldTimer.getWorldTime();
                }

                getAddress() {
                  return address;
                }

                setAddress(newAddress) {
                  address = newAddress;
                }

                navigate(url) {
                  document.location.href = url;
                }
              }
              const bootstrapApi = new BootstrapApi();
              return bootstrapApi;
            });
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

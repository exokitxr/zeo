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

          return vridApi.get('name')
            .then(username => {
              let vrMode = null;
              let roamMode = 'physical';
              class WorldTimer {
                constructor(startTime) {
                  this.startTime = startTime;
                }

                getWorldTime() {
                  const now = Date.now();
                  const worldTime = now - this.startTime;
                  return worldTime;
                }

                /* setStartTime(startTime) {
                  this.startTime = startTime;
                } */
              }
              const worldTimer = new WorldTimer(window.startTime);

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

                isSpectating() {
                  return Boolean(_getQueryVariable(window.location.search, 's'));
                }

                getCaptureTime() {
                  const captureTime = parseInt(_getQueryVariable(window.location.search, 'c'), 10);
                  return !isNaN(captureTime) ? captureTime : null;
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

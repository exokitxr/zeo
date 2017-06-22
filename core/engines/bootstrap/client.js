import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,

  DEFAULT_USER_HEIGHT,
} from './lib/constants/menu';
import menuRenderer from './lib/render/menu';

const FACES = ['top', 'bottom', 'left', 'right', 'front', 'back'];

class Bootstrap {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {site: {url: siteUrl}, server: {enabled: serverEnabled}}} = archae;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const initialUrl = document.location.href;
    const initialPath = document.location.protocol + '//' + document.location.host + document.location.pathname;

    const _requestStartTime = () => fetch('archae/bootstrap/start-time.json')
      .then(res => res.json()
        .then(({startTime}) => startTime)
      );

    return Promise.all([
      archae.requestPlugins([
        '/core/utils/js-utils',
      ]),
      _requestStartTime(),
    ])
      .then(([
        [
          jsUtils,
        ],
        startTime,
      ]) => {
        if (live) {
          const {events} = jsUtils;
          const {EventEmitter} = events;

          let vrMode = null;
          class WorldTimer {
            constructor(startTime = 0) {
              this.startTime = startTime;
            }

            getWorldTime() {
              const {startTime} = this;
              const now = Date.now();
              const worldTime = now - startTime;
              return worldTime;
            }
          }
          const worldTimer = new WorldTimer(startTime);

          let address = null;
          const _resJson = res => {
            if (res.status >= 200 && res.status < 300) {
              return res.json();
            } else {
              return null;
            }
          };
          const _loadAddress = () => {
            fetch(`${siteUrl}/id/api/address`, {
              credentials: 'include',
            })
              .then(_resJson)
              .then(({address: newAddress}) => {
                address = newAddress;
              })
              .catch(err => {
                console.warn(err);

                setTimeout(_loadAddress, 1000);
              });
          };
          _loadAddress();

          class BootstrapApi extends EventEmitter {
            getInitialUrl() {
              return initialUrl;
            }

            getInitialPath() {
              return initialPath;
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

            navigate(url) {
              document.location.href = url;
            }

            requestLogout() {
              return fetch('server/logout', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
              })
                .then(_resJson);
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
const _debounce = fn => {
  let running = false;
  let queued = false;

  const _go = () => {
    if (!running) {
      running = true;

      fn(() => {
        running = false;

        if (queued) {
          queued = false;

          _go();
        }
      });
    } else {
      queued = true;
    }
  };
  return _go;
};

module.exports = Bootstrap;

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
    const {metadata: {site: {url: siteUrl}, hub: {url: hubUrl, enabled: hubEnabled}, server: {enabled: serverEnabled}}} = archae;

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

          const isInIframe = (() => {
            try {
              return window.self !== window.top;
            } catch (e) {
              return true;
            }
          })();
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

          class BootstrapApi extends EventEmitter {
            getInitialUrl() {
              return initialUrl;
            }

            getInitialPath() {
              return initialPath;
            }

            isInIframe() {
              return isInIframe;
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

            navigate(url) {
              if (!isInIframe) {
                document.location.href = url;
              } else {
                window.parent.postMessage({
                  method: 'navigate',
                  args: [url],
                }, 'https://' + siteUrl);
              }
            }

            requestLogout() {
              return fetch('server/logout', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
              })
                .then(res => {
                  if (res.status >= 200 && res.status < 300) {
                    return res.json();
                  } else {
                    return null;
                  }
                });
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

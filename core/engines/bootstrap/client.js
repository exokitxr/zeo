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
    const {metadata: {site: {url: siteUrl}, hub: {url: hubUrl, enabled: hubEnabled}, home: {enabled: homeEnabled}, server: {enabled: serverEnabled}}} = archae;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const initialUrl = document.location.href;
    const initialPath = document.location.protocol + '//' + document.location.host + document.location.pathname;

    const _requestInitialLogin = () => {
      if (serverEnabled) {
        const token = _getQueryVariable(initialUrl, 't');

        if (token !== null) {
          return _requestLogin({
            token,
          });
        } else {
          return _requestLogin();
        }
      } else {
        return Promise.resolve();
      }
    };
    const _requestLogin = ({token = null} = {}) => _fetchAuthenticatedJson('server/login', token);
    const _fetchAuthenticatedJson = (url, token) => fetch('server/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({token}),
      credentials: 'same-origin',
    })
      .then(res => {
        if (res.status >= 200 && res.status < 300) {
          return res.json();
        } else {
          return null;
        }
      });
    const _requestStartTime = () => fetch('archae/bootstrap/start-time.json')
      .then(res => res.json()
        .then(({startTime}) => startTime)
      );

    return Promise.all([
      archae.requestPlugins([
        '/core/utils/js-utils',
      ]),
      _requestInitialLogin(),
      _requestStartTime(),
    ])
      .then(([
        [
          jsUtils,
        ],
        loginResult,
        startTime,
      ]) => {
        if (live) {
          const {events} = jsUtils;
          const {EventEmitter} = events;

          if (loginResult) {
            const {token, username, authToken} = loginResult;
            history.replaceState(null, '', '?t=' + encodeURIComponent(token));
          }

          const isInIframe = (() => {
            try {
              return window.self !== window.top;
            } catch (e) {
              return true;
            }
          })();
          let vrMode = null;
          let tutorialFlag = homeEnabled && localStorage.getItem('tutorial') !== JSON.stringify(false);
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

            getLoginResult() {
              return loginResult;
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

            getTutorialFlag() {
              return tutorialFlag;
            }

            setTutorialFlag(newTutorialFlag) {
              tutorialFlag = newTutorialFlag;
              localStorage.setItem('tutorial', JSON.stringify(tutorialFlag));
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

module.exports = Bootstrap;

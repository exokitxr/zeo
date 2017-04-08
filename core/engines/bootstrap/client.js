import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,

  DEFAULT_USER_HEIGHT,
} from './lib/constants/menu';
import menuRenderer from './lib/render/menu';

const DEFAULT_MATRIX = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const NUM_INVENTORY_ITEMS = 4;

const FACES = ['top', 'bottom', 'left', 'right', 'front', 'back'];

class Bootstrap {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {site: {url: siteUrl}, hub: {url: hubUrl, enabled: hubEnabled}, server: {url: serverUrl, enabled: serverEnabled}}} = archae;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const initialUrl = document.location.href;
    const hostUrl = serverEnabled ? serverUrl : hubUrl;
    const _requestServer = hostUrl => fetch('https://' + hostUrl + '/servers/server.json', {
      mode: 'cors',
    })
      .then(res => res.json());

    return Promise.all([
      archae.requestPlugins([
        '/core/utils/js-utils',
      ]),
      _requestServer(hostUrl),
    ])
      .then(([
        [
          jsUtils
        ],
        serverJson,
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
          const userState = {
            username: null,
            world: null,
            matrix: DEFAULT_MATRIX,
            inventory: (() => {
              const result = Array(NUM_INVENTORY_ITEMS);
              for (let i = 0; i < NUM_INVENTORY_ITEMS; i++) {
                result[i] = null;
              }
              return result;
            })(),
          };

          class BootstrapApi extends EventEmitter {
            getInitialUrl() {
              return initialUrl;
            }

            getCurrentServer() {
              return serverJson;
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
              return fetch('https://' + serverUrl + '/server/logout', {
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

            getUserState() {
              return userState;
            }

            getUserStateJson() {
              const {world, matrix} = userState;
              return {
                token: null,
                state: {
                  world,
                  matrix,
                  inventory,
                },
              };
            }

            setUserStateMatrix(matrix) {
              userState.matrix = matrix;
            }

            getUserStateInventoryItem(index) {
              return userState.inventory[index] || null;
            }

            setUserStateInventoryItem(index, item) {
              userState.inventory[index] = item;
            }

            saveUserState() { // XXX rethink these
              const {username} = userState;

              if (hubEnabled && username) {
                return fetch(hubUrl + '/hub/userState', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(_getUserStateJson()),
                });
              } else {
                return Promise.resolve();
              }
            }

            saveUserStateAsync() {
              const {username} = userState;
              if (hubEnabled && username) {
                navigator.sendBeacon(hubUrl + '/hub/userState', new Blob([JSON.stringify(_getUserStateJson())], {
                  type: 'application/json',
                }));
              }
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

module.exports = Bootstrap;

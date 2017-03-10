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
    const {metadata: {hub: {url: hubUrl, enabled: hubEnabled}, server: {url: serverUrl, enabled: serverEnabled}}} = archae;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const initialUrl = document.location.href;
    const hostUrl = serverEnabled ? serverUrl : hubUrl;
    const _requestServer = hostUrl => fetch('https://' + hostUrl + '/servers/server.json')
      .then(res => res.json());

    return Promise.all([
      _requestServer(hostUrl),
    ])
      .then(([
        serverJson,
      ]) => {
        if (live) {
          const serversJson = { // XXX get rid of this
            servers: [],
          };

          const _getInitialUrl = () => initialUrl;
          const _getServers = () => serversJson.servers;
          const _getCurrentServer = () => serverJson;
          const _changeServer = serverUrl => {
            if (serverUrl !== null) {
              return _requestServer(serverUrl)
                .then(serverJsonData => {
                  serverJson = serverJsonData;
                });
            } else {
              serverJson = {
                type: 'hub',
                url: null,
              };

              return Promise.resolve();
            }
          };
          const _requestLogout = () => fetch('https://' + serverUrl + '/server/logout', {
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

          const _getUserState = () => userState;
          const _getUserStateJson = () => {
            const {world, matrix} = userState;
            return {
              token: null,
              state: {
                world,
                matrix,
                inventory,
              },
            };
          };
          const _setUserStateMatrix = matrix => {
            userState.matrix = matrix;
          };
          const _getUserStateInventoryItem = index => {
            return userState.inventory[index] || null;
          };
          const _setUserStateInventoryItem = (index, item) => {
            userState.inventory[index] = item;
          };
          const _saveUserState = () => {
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
          };
          const _saveUserStateAsync = () => {
            const {username} = userState;
            if (hubEnabled && username) {
              navigator.sendBeacon(hubUrl + '/hub/userState', new Blob([JSON.stringify(_getUserStateJson())], {
                type: 'application/json',
              }));
            }
          };

          return {
            getInitialUrl: _getInitialUrl,
            getServers: _getServers,
            getCurrentServer: _getCurrentServer,
            changeServer: _changeServer,
            requestLogout: _requestLogout,
            getUserState: _getUserState,
            setUserStateMatrix: _setUserStateMatrix,
            getUserStateInventoryItem: _getUserStateInventoryItem,
            setUserStateInventoryItem: _setUserStateInventoryItem,
            saveUserState: _saveUserState,
            saveUserStateAsync: _saveUserStateAsync,
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Bootstrap;

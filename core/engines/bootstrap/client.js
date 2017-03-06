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

    const hostUrl = serverEnabled ? serverUrl : hubUrl;
    const _requestServers = hostUrl => fetch('https://' + hostUrl + '/servers/servers.json')
      .then(res => res.json());
    const _requestServer = hostUrl => fetch('https://' + hostUrl + '/servers/server.json')
      .then(res => res.json());
    const _requestImageFile = (hostUrl, p) => fetch('https://' + hostUrl + p)
      .then(res => res.blob()
        .then(blob => new Promise((accept, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => {
            accept(reader.result);
          };
        }))
      );
    const _requestIconImg = hostUrl => _requestImageFile(hostUrl, '/servers/img/icon.png');
    const _requestSkyboxImg = hostUrl => _requestImageFile(hostUrl, '/servers/img/skybox.png');
    const _requestCubeMapImgs = hostUrl => Promise.all(FACES.map(face => _requestImageFile(hostUrl, '/servers/img/cubemap-' + face + '.png')))
      .then(cubeMapImgs => {
        const result = {};
        for (let i = 0; i < cubeMapImgs.length; i++) {
          const cubeMapImg = cubeMapImgs[i];
          const face = FACES[i];
          result[face] = cubeMapImg;
        }
        return result;
      });

    return Promise.all([
      _requestServers(hostUrl),
      _requestServer(hostUrl),
      _requestIconImg(hostUrl),
      _requestSkyboxImg(hostUrl),
      _requestCubeMapImgs(hostUrl),
    ])
      .then(([
        serversJson,
        serverJson,
        iconImg,
        skyboxImg,
        cubeMapImgs,
      ]) => {
        if (live) {
          const _getServers = () => serversJson.servers;
          const _getCurrentServer = () => serverJson;
          const _getIconImg = () => iconImg;
          const _getSkyboxImg = () => skyboxImg;
          const _getCubeMapImgs = () => cubeMapImgs;
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
          const _requestLogin = ({token = null} = {}) => fetch('https://' + serverUrl + '/server/login', { // XXX these can be moved to the callsites instead
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
            getServers: _getServers,
            getCurrentServer: _getCurrentServer,
            getIconImg: _getIconImg,
            getSkyboxImg: _getSkyboxImg,
            getCubeMapImgs: _getCubeMapImgs,
            changeServer: _changeServer,
            requestLogin: _requestLogin,
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

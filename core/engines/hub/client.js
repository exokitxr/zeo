const DEFAULT_MATRIX = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const NUM_INVENTORY_ITEMS = 4;

class Hub {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {hub: {url: hubUrl, enabled: hubEnabled}}} = archae;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const hubUrlPrefix = window.location.protocol + '//' + hubUrl + (window.location.port ? (':' + window.location.port) : '');

    const _requestLogin = () => {
      if (hubEnabled) {
        const token = (() => {
          const tokenParam = getQueryParameterByName('token');

          if (tokenParam) {
            return tokenParam;
          } else {
            const tokenString = localStorage.getItem('token');

            if (tokenString) {
              return _parseJson(tokenString);
            } else {
              return null;
            }
          }
        })();

        if (token !== null) {
          return fetch(hubUrlPrefix + '/hub/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              token,
            }),
          }).then(res => res.json());
        } else {
          return Promise.resolve(null);
        }
      } else {
        return Promise.resolve(null);
      }
    };

    return _requestLogin()
      .then(j => {
        console.log('got login result', j); // XXX

        const worldName = (() => {
          if (hubEnabled) {
            const {hostname} = window.location;
            const match = hostname.match(/^([^.]+)\./);
            return match && match[1];
          } else {
            return null;
          }
        })();
        const plan = j ? j.plan : null;
        const token = j ? j.token : null;
        const userState = {
          username: j ? j.username : null,
          world: j ? j.world : null,
          matrix: j ? j.matrix : DEFAULT_MATRIX,
          inventory: j ? j.inventory : (() => {
            const result = Array(NUM_INVENTORY_ITEMS);
            for (let i = 0; i < NUM_INVENTORY_ITEMS; i++) {
              result[i] = null;
            }
            return result;
          })(),
        };

        const _isEnabled = () => hubEnabled;
        const _getWorldName = () => worldName;
        const _getUserState = () => userState;
        const _getUserStateJson = () => {
          const {world, matrix} = userState;
          return {
            token,
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
            return fetch(hubUrlPrefix + '/hub/userState', {
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
            navigator.sendBeacon(hubUrlPrefix + '/hub/userState', new Blob([JSON.stringify(_getUserStateJson())], {
              type: 'application/json',
            }));
          }
        };

        return {
          isEnabled: _isEnabled,
          getWorldName: _getWorldName,
          getUserState: _getUserState,
          setUserStateMatrix: _setUserStateMatrix,
          getUserStateInventoryItem: _getUserStateInventoryItem,
          setUserStateInventoryItem: _setUserStateInventoryItem,
          saveUserState: _saveUserState,
          saveUserStateAsync: _saveUserStateAsync,
        };
      })
      .catch(err => {
        console.warn(err);
      });
  }

  unmount() {
    this._cleanup();
  }
}

const getQueryParameterByName = name => {
  name = name.replace(/[\[\]]/g, "\\$&");

  const url = window.location.href;
  const regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)");
  const results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, " "));
};

const _parseJson = s => {
  let err = null;
  let result;
  try {
    j = JSON.parse(s);
  } catch (e) {
    err = e;
  }
  if (!err) {
    return j;
  } else {
    return null;
  }
};

module.exports = Hub;

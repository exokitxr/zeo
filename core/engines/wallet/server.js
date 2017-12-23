const events = require('events');
const {EventEmitter} = events;
const path = require('path');
const fs = require('fs');

const mkdirp = require('mkdirp');

const DEFAULT_ITEMS = {
  items: {},
};

class Wallet {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {ws, wss, dirname, dataDirectory} = archae.getCore();

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const worldPath = path.join(dirname, dataDirectory, 'world');
    const worldItemsJsonPath = path.join(worldPath, 'items.json');

    const _requestFile = (p, defaultValue) => new Promise((accept, reject) => {
      fs.readFile(p, 'utf8', (err, s) => {
        if (!err) {
          const j = JSON.parse(s);
          accept(j);
        } else if (err.code === 'ENOENT') {
          const j = defaultValue;
          accept(j);
        } else {
          reject(err);
        }
      });
    });
    const _requestItemsJson = () => _requestFile(worldItemsJsonPath, DEFAULT_ITEMS);

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/multiplayer',
        '/core/engines/analytics',
      ]),
      _requestItemsJson(),
    ])
      .then(([
        [
          multiplayer,
          analytics,
        ],
        assetInstances,
      ]) => {
        if (live) {
          const _saveFile = (p, j) => new Promise((accept, reject) => {
            mkdirp(path.dirname(p), err => {
              if (!err) {
                fs.writeFile(p, JSON.stringify(j, null, 2), 'utf8', err => {
                  if (!err) {
                    accept();
                  } else {
                    reject(err);
                  }
                });
              } else {
                reject(err);
              }
            });
          });
          const _saveItems = _debounce(next => {
            const itemsData = assetInstances.filter(assetSpec => !assetSpec.owner);

            _saveFile(worldItemsJsonPath, itemsData)
              .then(() => {
                next();
              })
              .catch(err => {
                console.warn(err);
              });
          });

          class AssetInstance {
            constructor(assetId, id, name, ext, json, file, n, owner, physics, matrix, visible, open) {
              this.assetId = assetId;
              this.id = id;
              this.name = name;
              this.ext = ext;
              this.json = json;
              this.file = file;
              this.n = n;
              this.owner = owner;
              this.physics = physics;
              this.matrix = matrix;
              this.visible = visible;
              this.open = open;
            }
          }

          const connections = [];
          const _connection = (c, {url}) => {
            if (url === '/archae/walletWs') {
              const _init = () => {
                c.send(JSON.stringify({
                  type: 'init',
                  args: {
                    assets: assetInstances,
                  }
                }));
              };
              _init();

              const _broadcast = m => {
                for (let i = 0; i < connections.length; i++) {
                  const connection = connections[i];
                  if (connection.readyState === ws.OPEN && connection !== c) {
                    connection.send(m);
                  }
                };
              };

              c.on('message', s => {
                const m = _jsonParse(s);
                const {method, args} = m;

                if (method === 'addAsset') {
                  const {assetId, id, name, ext, json, file, n, owner, physics, matrix, visible, open} = args;
                  const assetInstance = new AssetInstance(assetId, id, name, ext, json, file, n, owner, physics, matrix, visible, open);
                  assetInstances.push(assetInstance);

                  _broadcast(JSON.stringify({type: 'addAsset', args: {assetId, id, name, ext, json, file, n, owner, physics, matrix, visible, open}}));

                  _saveItems();

                  analytics.addFile({id});
                } else if (method === 'removeAsset') {
                  const {assetId} = args;
                  assetInstances.splice(assetInstances.findIndex(assetInstance => assetInstance.assetId === assetId), 1);

                  _broadcast(JSON.stringify({type: 'removeAsset', args: {assetId}}));

                  _saveItems();

                  analytics.removeFile({assetId});
                } else if (method === 'setAttribute') {
                  const {assetId, name, value} = args;
                  const assetInstance = assetInstances.find(assetInstance => assetInstance.assetId === assetId);

                  if (assetInstance && assetInstance.json && assetInstance.json.data && typeof assetInstance.json.data === 'object') {
                    assetInstance.json.data.attributes[name].value = value;

                    _broadcast(JSON.stringify({type: 'setAttribute', args: {assetId, name, value}}));
                  }

                  _saveItems();
                } else if (method === 'setState') {
                  const {assetId, matrix} = args;
                  const assetInstance = assetInstances.find(assetInstance => assetInstance.assetId === assetId);

                  if (assetInstance) {
                    assetInstance.matrix = matrix;

                    // do not broadcast change; it will have already been broadcast via physics
                  }

                  _saveItems();
                } else if (method === 'setOwner') {
                  const {assetId, owner} = args;
                  const assetInstance = assetInstances.find(assetInstance => assetInstance.assetId === assetId);

                  if (assetInstance) {
                    assetInstance.owner = owner;

                    _broadcast(JSON.stringify({type: 'setOwner', args: {assetId, owner}}));
                  }

                  _saveItems();
                } else if (method === 'setVisible') {
                  const {assetId, visible} = args;
                  const assetInstance = assetInstances.find(assetInstance => assetInstance.assetId === assetId);

                  if (assetInstance) {
                    assetInstance.visible = visible;

                    _broadcast(JSON.stringify({type: 'setVisible', args: {assetId, visible}}));
                  }

                  _saveItems();
                } else if (method === 'setOpen') {
                  const {assetId, open} = args;
                  const assetInstance = assetInstances.find(assetInstance => assetInstance.assetId === assetId);

                  if (assetInstance) {
                    assetInstance.open = open;

                    _broadcast(JSON.stringify({type: 'setOpen', args: {assetId, open}}));
                  }

                  _saveItems();
                } else if (method === 'setPhysics') {
                  const {assetId, physics} = args;
                  const assetInstance = assetInstances.find(assetInstance => assetInstance.assetId === assetId);

                  if (assetInstance) {
                    assetInstance.physics = physics;

                    _broadcast(JSON.stringify({type: 'setPhysics', args: {assetId, physics}}));
                  }

                  _saveItems();
                } else {
                  console.warn('no such method:' + JSON.stringify(method));
                }
              });
              c.on('close', () => {
                connections.splice(connections.indexOf(c), 1);
              });

              connections.push(c);
            }
          };
          wss.on('connection', _connection);

          const _broadcastAll = m => {
            for (let i = 0; i < connections.length; i++) {
              const connection = connections[i];
              if (connection.readyState === ws.OPEN) {
                connection.send(m);
              }
            };
          };

          const _playerLeave = playerId => {
            const oldAssetInstances = assetInstances.slice();
            for (let i = 0; i < oldAssetInstances.length; i++) {
              const assetInstance = oldAssetInstances[i];
              if (String(assetInstance.owner) === playerId) {
                assetInstances.splice(assetInstances.indexOf(assetInstance), 1);

                _broadcastAll(JSON.stringify({type: 'removeAsset', args: {assetId: assetInstance.assetId}}));

                analytics.removeFile({id: assetInstance.id});
              }
            }
          };
          multiplayer.on('playerLeave', _playerLeave);

          this._cleanup = () => {
            wss.removeListener('connection', _connection);
            multiplayer.removeListener('playerLeave', c);
          };

          return {
            getItems() {
              return assetInstances;
            },
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}
const _jsonParse = s => {
  let error = null;
  let result;
  try {
    result = JSON.parse(s);
  } catch (err) {
    error = err;
  }
  if (!error) {
    return result;
  } else {
    return null;
  }
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

module.exports = Wallet;

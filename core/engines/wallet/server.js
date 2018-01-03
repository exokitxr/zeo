const events = require('events');
const {EventEmitter} = events;
const path = require('path');
const fs = require('fs');

const mkdirp = require('mkdirp');
const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();

const DEFAULT_ITEMS = [];

class Wallet {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {app, ws, wss, dirname, dataDirectory} = archae.getCore();

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
          const channel = wss.channel('wallet');
          channel.on('connection', c => {
            const _init = () => {
              c.send(JSON.stringify({
                type: 'init',
                args: {
                  assets: assetInstances,
                }
              }));
            };
            _init();

            c.on('message', msg => {
              const m = _jsonParse(msg);

              if (m !== null && typeof m === 'object') {
                _handleMessage(c, m);
              } else {
                console.warn('wallet engine server got invalid message', JSON.stringify(msg));

                c.close();
              }
            });
            c.on('close', () => {
              connections.splice(connections.indexOf(c), 1);
            });

            connections.push(c);
          });

          function serveSetItems(req, res, next) {
            bodyParserJson(req, res, () => {
              const {body: data} = req;

              const _respondInvalid = () => {
                res.status(400);
                res.send();
              };

              if (Array.isArray(data)) {
                const newAssetInstances = data;

                const addedAssetInstances = newAssetInstances.filter(assetInstance =>
                  !assetInstances.some(assetInstance2 => assetInstance2.assetId === assetInstance.assetId)
                );
                const removedAssetInstances = assetInstances.filter(assetInstance =>
                  !newAssetInstances.some(assetInstance2 => assetInstance2.assetId === assetInstance.assetId)
                );
                const keptAssetInstances = newAssetInstances.filter(assetInstance =>
                  assetInstances.some(assetInstance2 => assetInstance2.assetId === assetInstance.assetId)
                );

                for (let i = 0; i < addedAssetInstances.length; i++) {
                  const addedAssetInstance = addedAssetInstances[i];

                  const {assetId, id, name, ext, json, file, n, owner, physics, matrix, visible, open} = addedAssetInstance;
                  const assetInstance = new AssetInstance(assetId, id, name, ext, json, file, n, owner, physics, matrix, visible, open);
                  assetInstances.push(assetInstance);

                  _broadcast(null, JSON.stringify({type: 'addAsset', args: {assetId, id, name, ext, json, file, n, owner, physics, matrix, visible, open}}));

                  analytics.addFile({id});
                }
                for (let i = 0; i < removedAssetInstances.length; i++) {
                  const removedAssetInstance = removedAssetInstances[i];

                  const {assetId} = removedAssetInstance;
                  assetInstances.splice(assetInstances.findIndex(assetInstance => assetInstance.assetId === assetId), 1);

                  _broadcast(null, JSON.stringify({type: 'removeAsset', args: {assetId}}));

                  analytics.removeFile({assetId});
                }
                for (let i = 0; i < keptAssetInstances.length; i++) {
                  const keptAssetInstance = keptAssetInstances[i];

                  const {assetId} = keptAssetInstance;
                  const newAttributes = (keptAssetInstance.json && keptAssetInstance.json.data && keptAssetInstance.json.data.attributes) || {};
                  const oldAssetInstance = assetInstances.find(assetInstance => assetInstance.assetId === assetId);
                  const oldAttributes = (oldAssetInstance.json && oldAssetInstance.json.data && oldAssetInstance.json.data.attributes) || {};

                  if (!oldAssetInstance.json) {
                    oldAssetInstance.json = {};
                  }
                  if (!oldAssetInstance.json.data) {
                    oldAssetInstance.json.data = {};
                  }

                  for (const newAttributeName in newAttributes) {
                    const newAttribute = newAttributes[newAttributeName];
                    const oldAttribute = oldAttributes[newAttributeName];
                    if (oldAttribute) {
                      oldAttribute.value = newAttribute.value;
                    } else {
                      oldAttributes[newAttributeName] = {
                        value: newAttribute.value,
                      };
                    }

                    _broadcast(JSON.stringify({type: 'setAttribute', args: {assetId, name: newAttributeName, value: newAttribute.value}}));
                  }
                  for (const oldAttributeName in oldAttributes) {
                    const oldAttribute = oldAttributes[oldAttributeName];
                    const newAttribute = newAttributes[oldAttributeName];
                    if (!newAttribute) {
                      delete oldAttributes[oldAttributeName];

                      _broadcast(JSON.stringify({type: 'setAttribute', args: {assetId, name: oldAttributeName, value: null}}));
                    }
                  }
                }

                _saveItems();
              } else {
                _respondInvalid();
              }
            });
          }
          app.put('/archae/world/setItems', serveSetItems);

          const _broadcast = (c, m) => {
            for (let i = 0; i < connections.length; i++) {
              const connection = connections[i];
              if (connection.readyState === ws.OPEN && connection !== c) {
                connection.send(m);
              }
            };
          };
          const _handleMessage = (c, m) => {
            const {method, args} = m;

            if (method === 'addAsset') {
              const {assetId, id, name, ext, json, file, n, owner, physics, matrix, visible, open} = args;
              const assetInstance = new AssetInstance(assetId, id, name, ext, json, file, n, owner, physics, matrix, visible, open);
              assetInstances.push(assetInstance);

              _broadcast(c, JSON.stringify({type: 'addAsset', args: {assetId, id, name, ext, json, file, n, owner, physics, matrix, visible, open}}));

              _saveItems();

              analytics.addFile({id});

              return true;
            } else if (method === 'removeAsset') {
              const {assetId, id} = args;
              assetInstances.splice(assetInstances.findIndex(assetInstance => assetInstance.assetId === assetId), 1);

              _broadcast(c, JSON.stringify({type: 'removeAsset', args: {assetId}}));

              _saveItems();

              analytics.removeFile({id});

              return true;
            } else if (method === 'setAttribute') {
              const {assetId, name, value} = args;
              const assetInstance = assetInstances.find(assetInstance => assetInstance.assetId === assetId);

              if (assetInstance && assetInstance.json && assetInstance.json.data && typeof assetInstance.json.data === 'object') {
                if (value !== null) {
                  assetInstance.json.data.attributes[name].value = value;
                } else {
                  delete assetInstance.json.data.attributes[name];
                }

                _broadcast(c, JSON.stringify({type: 'setAttribute', args: {assetId, name, value}}));
              }

              _saveItems();

              return true;
            } else if (method === 'setState') {
              const {assetId, matrix} = args;
              const assetInstance = assetInstances.find(assetInstance => assetInstance.assetId === assetId);

              if (assetInstance) {
                assetInstance.matrix = matrix;

                // do not broadcast change; it will have already been broadcast via physics
              }

              _saveItems();

              return true;
            } else if (method === 'setOwner') {
              const {assetId, owner} = args;
              const assetInstance = assetInstances.find(assetInstance => assetInstance.assetId === assetId);

              if (assetInstance) {
                assetInstance.owner = owner;

                _broadcast(c, JSON.stringify({type: 'setOwner', args: {assetId, owner}}));
              }

              _saveItems();

              return true;
            } else if (method === 'setVisible') {
              const {assetId, visible} = args;
              const assetInstance = assetInstances.find(assetInstance => assetInstance.assetId === assetId);

              if (assetInstance) {
                assetInstance.visible = visible;

                _broadcast(c, JSON.stringify({type: 'setVisible', args: {assetId, visible}}));
              }

              _saveItems();

              return true;
            } else if (method === 'setOpen') {
              const {assetId, open} = args;
              const assetInstance = assetInstances.find(assetInstance => assetInstance.assetId === assetId);

              if (assetInstance) {
                assetInstance.open = open;

                _broadcast(c, JSON.stringify({type: 'setOpen', args: {assetId, open}}));
              }

              _saveItems();

              return true;
            } else if (method === 'setPhysics') {
              const {assetId, physics} = args;
              const assetInstance = assetInstances.find(assetInstance => assetInstance.assetId === assetId);

              if (assetInstance) {
                assetInstance.physics = physics;

                _broadcast(c, JSON.stringify({type: 'setPhysics', args: {assetId, physics}}));
              }

              _saveItems();

              return true;
            } else {
              console.warn('no such method:' + JSON.stringify(method));

              return false;
            }
          };

          const _playerLeave = playerId => {
            const oldAssetInstances = assetInstances.slice();
            for (let i = 0; i < oldAssetInstances.length; i++) {
              const assetInstance = oldAssetInstances[i];
              if (String(assetInstance.owner) === playerId) {
                assetInstances.splice(assetInstances.indexOf(assetInstance), 1);

                _broadcast(null, JSON.stringify({type: 'removeAsset', args: {assetId: assetInstance.assetId}}));

                analytics.removeFile({id: assetInstance.id});
              }
            }
          };
          multiplayer.on('playerLeave', _playerLeave);

          this._cleanup = () => {
            function removeMiddlewares(route, i, routes) {
              if (
                route.handle.name === 'serveSetItems'
              ) {
                routes.splice(i, 1);
              }
              if (route.route) {
                route.route.stack.forEach(removeMiddlewares);
              }
            }
            app._router.stack.forEach(removeMiddlewares);

            multiplayer.removeListener('playerLeave', c);
          };

          return {
            getItems() {
              return assetInstances;
            },
            registerConnection(c) {
              connections.push(c);
            },
            unregisterConnection(c) {
              connections.splice(connections.indexOf(c), 1);
            },
            handleMessage(c, m) {
              return _handleMessage(c, m);
            }
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

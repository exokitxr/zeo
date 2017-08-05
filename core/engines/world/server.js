const events = require('events');
const {EventEmitter} = events;
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const mkdirp = require('mkdirp');
const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();

const DEFAULT_TAGS = {
  tags: {},
};
const DEFAULT_FILES = {
  files: [],
};

class World {
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
    const worldTagsJsonPath = path.join(worldPath, 'tags.json');
    const worldFilesJsonPath = path.join(worldPath, 'files.json');

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
    const _requestTagsJson = () => _requestFile(worldTagsJsonPath, DEFAULT_TAGS);
    const _requestFilesJson = () => _requestFile(worldFilesJsonPath, DEFAULT_FILES);
    const _ensureWorldPath = () => new Promise((accept, reject) => {
      const worldPath = path.join(dirname, dataDirectory, 'world');

      mkdirp(worldPath, err => {
        if (!err) {
          accept();
        } else {
          reject(err);
        }
      });
    });

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/multiplayer',
        '/core/utils/vrid-utils',
      ]),
      _requestTagsJson(),
      _requestFilesJson(),
      _ensureWorldPath(),
    ])
      .then(([
        [
          multiplayer,
          vridUtils,
        ],
        tagsJson,
        filesJson,
        ensureWorldPathResult,
      ]) => {
        if (live) {
          const {vridApi} = vridUtils;

          const _initTags = () => {
            const plugins = [];
            for (const id in tagsJson.tags) {
              const tagSpec = tagsJson.tags[id];
              if (tagSpec.type === 'entity') {
                plugins.push(tagSpec.module);
              }
            }
            archae.requestPlugins(plugins)
              .catch(err => {
                console.warn(err);
              });
          };
          _initTags();

          const _saveFile = (p, j) => new Promise((accept, reject) => {
            fs.writeFile(p, JSON.stringify(j, null, 2), 'utf8', err => {
              if (!err) {
                accept();
              } else {
                reject(err);
              }
            });
          });
          const _saveTags = _debounce(next => {
            _saveFile(worldTagsJsonPath, tagsJson)
              .then(() => {
                next();
              })
              .catch(err => {
                console.warn(err);
              });
          });
          const _broadcastGlobal = (type, args) => {
            if (connections.length > 0) {
              const e = {
                type,
                args,
              };
              const es = JSON.stringify(e);

              for (let i = 0; i < connections.length; i++) {
                const connection = connections[i];

                if (connection.readyState === ws.OPEN) {
                  connection.send(es);
                }
              }
            }
          };
          const _removeTag = (userId, id) => {
            delete tagsJson.tags[id];

            _saveTags();

            _broadcastGlobal('removeTag', [userId, id]);
          };
          const _setTagAttribute = (userId, id, {name, value}) => {
            const itemSpec = tagsJson.tags[id];
            const {attributes} = itemSpec;
            if (value !== undefined) {
              attributes[name] = {
                value,
              };
            } else {
              delete attributes[name];
            }

            _saveTags();

            _broadcastGlobal('setTagAttribute', [userId, id, {name, value}]);
          };
          const _setTagAttributes = (userId, id, newAttributes) => {
            const itemSpec = tagsJson.tags[id];
            const {attributes} = itemSpec;

            for (let i = 0; i < newAttributes.length; i++) {
              const newAttribute = newAttributes[i];
              const {name, value} = newAttribute;

              if (value !== undefined) {
                attributes[name] = {
                  value,
                };
              } else {
                delete attributes[name];
              }
            }

            _saveTags();

            _broadcastGlobal('setTagAttributes', [userId, id, newAttributes]);
          };

          function worldAddTag(req, res, next) {
            bodyParserJson(req, res, () => {
              const itemSpec = req.body;

              const {id} = itemSpec;
              tagsJson.tags[id] = itemSpec;

              _saveTags();

              _broadcastLocal('addTags', [null, itemSpec]);
            });
          }
          app.post('/archae/world/addTag', worldAddTag);

          const connections = [];
          const usersJson = {};
          wss.on('connection', c => {
            const {url} = c.upgradeReq;

            let match;
            if (match = url.match(/\/archae\/worldWs\?id=(.+)$/)) {
              const userId = match[1];

              const user = {
                id: userId,
              };
              usersJson[userId] = user;

              const _sendInit = () => {
                const e = {
                  type: 'init',
                  args: [
                    _arrayify(tagsJson.tags),
                    _arrayify(usersJson),
                  ],
                };
                const es = JSON.stringify(e);
                c.send(es);
              };
              _sendInit();

              const _broadcastLocal = (type, args) => {
                if (connections.some(connection => connection !== c)) {
                  const e = {
                    type,
                    args,
                  };
                  const es = JSON.stringify(e);

                  for (let i = 0; i < connections.length; i++) {
                    const connection = connections[i];
                    if (connection !== c) {
                      connection.send(es);
                    }
                  }
                }
              };
              const _removeTag = (userId, id) => {
                const itemSpec = tagsJson.tags[id];
                delete tagsJson.tags[id];

                _saveTags();

                _broadcastLocal('removeTag', [userId, id]);
              };
              const _setTagAttribute = (userId, id, {name, value}) => {
                const itemSpec = tagsJson.tags[id];
                const {attributes} = itemSpec;
                const oldValue = attributes[name] ? attributes[name].value : undefined;

                if (value !== undefined) {
                  attributes[name] = {
                    value,
                  };
                } else {
                  delete attributes[name];
                }

                _saveTags();

                _broadcastLocal('setTagAttribute', [userId, id, {name, value}]);
              };
              const _setTagAttributes = (userId, id, newAttributes) => {
                const itemSpec = tagsJson.tags[id];
                const {type, attributes} = itemSpec;

                for (let i = 0; i < newAttributes.length; i++) {
                  const newAttribute = newAttributes[i];
                  const {name, value} = newAttribute;
                  const oldValue = attributes[name] ? attributes[name].value : undefined;

                  if (value !== undefined) {
                    attributes[name] = {
                      value,
                    };
                  } else {
                    delete attributes[name];
                  }
                }

                _saveTags();

                _broadcastLocal('setTagAttributes', [userId, id, newAttributes]);
              };

              c.on('message', s => {
                const m = _jsonParse(s);

                if (typeof m === 'object' && m !== null && typeof m.method === 'string' && Array.isArray(m.args)) {
                  const {method, args} = m;

                  if (method === 'addTag') {
                    const [userId, itemSpec] = args;

                    const {id} = itemSpec;
                    tagsJson.tags[id] = itemSpec;

                    _saveTags();

                    _broadcastLocal('addTag', [userId, itemSpec]);
                  } else if (method === 'addTags') {
                    const [userId, itemSpecs] = args;

                    for (let i = 0; i < itemSpecs.length; i++) {
                      const itemSpec = itemSpecs[i];
                      const {id} = itemSpec;
                      tagsJson.tags[id] = itemSpec;
                    }

                    _saveTags();

                    _broadcastLocal('addTags', [userId, itemSpecs]);
                  } else if (method === 'removeTag') {
                    const [userId, id] = args;

                    _removeTag(userId, id);
                  } else if (method === 'removeTags') {
                    const [userId, ids] = args;

                    for (let i = 0; i < ids.length; i++) {
                      const id = ids[i];
                      delete tagsJson.tags[id];
                    }

                    _saveTags();

                    _broadcastLocal('removeTags', [userId, ids]);
                  } else if (method === 'setTagAttribute') {
                    const [userId, id, {name, value}] = args;

                    _setTagAttribute(userId, id, {name, value});
                  } else if (method === 'setTagAttributes') {
                    const [userId, id, newAttributes] = args;

                    _setTagAttributes(userId, id, newAttributes);
                  } else if (method === 'loadModule') {
                    const [userId, id] = args;

                    _broadcastLocal('loadModule', [userId, id]);
                  } else if (method === 'unloadModule') {
                    const [userId, id] = args;

                    _broadcastLocal('unloadModule', [userId, id]);
                  } else {
                    console.warn('no such method:' + JSON.stringify(method));
                  }
                } else {
                  console.warn('invalid message', m);
                }
              });
              c.on('close', () => {
                delete usersJson[userId];
                connections.splice(connections.indexOf(c), 1);
              });

              connections.push(c);
            }
          });

          const _playerLeave = ({address}) => {
            const {tags} = tagsJson;

            const _inheritAbandonedAssets = (tags, address) => {
              for (const id in tags) {
                const tag = tags[id];
                const {type} = tag;

                if (type === 'asset') {
                  const {attributes} = tag;
                  const {owner: ownerAttribute, bindOwner: bindOwnerAttribute} = attributes;
                  const owner = ownerAttribute ? ownerAttribute.value : null;
                  const bindOwner = bindOwnerAttribute ? bindOwnerAttribute.value : null;

                  if (owner === address) {
                    const {asset: assetAttribute} = attributes;
                    const {quantity: quantityAttribute} = attributes;

                    if (assetAttribute && quantityAttribute) {
                      const srcAddress = address;
                      const {value: asset} = assetAttribute;
                      const {value: quantity} = quantityAttribute;
                      const privateKey = crypto.randomBytes(32);
                      const dstAddress = vridApi.getAddress(privateKey);
                      const privateKeyString = privateKey.toString('base64');

                      _removeTag(owner, id);

                      /* vridApi.requestCreatePack(srcAddress, dstAddress, asset, quantity, privateKeyString)
                        .then(() => {
                          _setTagAttributes(
                            owner,
                            id,
                            [
                              {
                                name: 'owner',
                                value: dstAddress,
                              },
                              {
                                name: 'privateKey',
                                value: privateKeyString,
                              }
                            ]
                          );
                        })
                        .catch(err => {
                          console.warn(err);

                          // remove the tag since we failed to inherit it
                          _removeTag(owner, id);
                        }); */
                    } else {
                      // remove the tag since it's corrupted
                      _removeTag(owner, id);
                    }
                  } else if (bindOwner === address) {
                    _removeTag(owner, id);
                  }
                }
              }
            };
            _inheritAbandonedAssets(tags, address);
          };
          multiplayer.on('playerLeave', _playerLeave);

          this._cleanup = () => {
            for (let i = 0; i < connections.length; i++) {
              const connection = connections[i];
              connection.close();
            }

            function removeMiddlewares(route, i, routes) {
              if (route.handle.name === 'worldAddTag') {
                routes.splice(i, 1);
              }
              if (route.route) {
                route.route.stack.forEach(removeMiddlewares);
              }
            }
            app._router.stack.forEach(removeMiddlewares);

            multiplayer.removeListener('playerLeave', _playerLeave);
          };

          class WorldApi extends EventEmitter {
            getTags() {
              return tagsJson.tags;
            }
          }
          const worldApi = new WorldApi();

          return worldApi;
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
const _arrayify = o => Object.keys(o).map(k => o[k]);
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

module.exports = World;

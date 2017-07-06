const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const mkdirp = require('mkdirp');
const vridApiLib = require('vrid/lib/backend-api');

const OPEN = 1; // ws.OPEN

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
    const {metadata: {crds: {url: crdsUrl}}} = archae;
    const {app, wss, dirname, dataDirectory} = archae.getCore();

    const vridApi = vridApiLib({crdsUrl});

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
      ]),
      _requestTagsJson(),
      _requestFilesJson(),
      _ensureWorldPath(),
    ])
      .then(([
        [multiplayer],
        tagsJson,
        filesJson,
        ensureWorldPathResult,
      ]) => {
        if (live) {
          const usersJson = {};

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

          const connections = [];
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

              const _broadcast = (type, args) => {
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
                delete tagsJson.tags[id];

                _saveTags();

                _broadcast('removeTag', [userId, id]);
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

                _broadcast('setTagAttribute', [userId, id, {name, value}]);
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

                _broadcast('setTagAttributes', [userId, id, newAttributes]);
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

                    _broadcast('addTag', [userId, itemSpec]);
                  } else if (method === 'addTags') {
                    const [userId, itemSpecs] = args;

                    for (let i = 0; i < itemSpecs.length; i++) {
                      const itemSpec = itemSpecs[i];
                      const {id} = itemSpec;
                      tagsJson.tags[id] = itemSpec;
                    }

                    _saveTags();

                    _broadcast('addTags', [userId, itemSpecs]);
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

                    _broadcast('removeTags', [userId, ids]);
                  } else if (method === 'setTagAttribute') {
                    const [userId, id, {name, value}] = args;

                    _setTagAttribute(userId, id, {name, value});
                  } else if (method === 'setTagAttributes') {
                    const [userId, id, newAttributes] = args;

                    _setTagAttributes(userId, id, newAttributes);
                  } else if (method === 'loadModule') {
                    const [userId, id] = args;

                    _broadcast('loadModule', [userId, id]);
                  } else if (method === 'unloadModule') {
                    const [userId, id] = args;

                    _broadcast('unloadModule', [userId, id]);
                  } else {
                    console.warn('no such method:' + JSON.stringify(method));
                  }
                } else {
                  console.warn('invalid message', m);
                }
              });

              const cleanups = [];
              const cleanup = () => {
                for (let i = 0; i < cleanups.length; i++) {
                  const cleanup = cleanups[i];
                  cleanup();
                }
              };

              c.on('close', () => {
                cleanup();
              });

              cleanups.push(() => {
                delete usersJson[userId];
              });

              connections.push(c);
              cleanups.push(() => {
                connections.splice(connections.indexOf(c), 1);
              });
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
                  const {owner: ownerAttribute} = attributes;

                  if (ownerAttribute) {
                    const {value: owner} = ownerAttribute;

                    if (owner === address) {
                      const {asset: assetAttribute} = attributes;
                      const {quantity: quantityAttribute} = attributes;

                      if (assetAttribute && quantityAttribute) {
                        const srcAddress = address;
                        const {value: asset} = assetAttribute;
                        const {value: quantity} = quantityAttribute;
                        const privateKey = crypto.randomBytes(32);
                        const dstAddress = vridApi.getAddress(privateKey);

                        vridApi.requestCreatePack(srcAddress, dstAddress, asset, quantity, privateKey)
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
                                  value: privateKey,
                                }
                              ]
                            );
                          })
                          .catch(err => {
                            console.warn(err);

                            // remove the tag since we failed to inherit it
                            _removeTag(owner, id);
                          });
                      } else {
                        // remove the tag since it's corrupted
                        _removeTag(owner, id);
                      }
                    }
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

            multiplayer.removeListener('playerLeave', _playerLeave);
          };

          const _getTags = () => tagsJson.tags;

          return {
            getTags: _getTags,
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

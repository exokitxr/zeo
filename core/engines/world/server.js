const events = require('events');
const {EventEmitter} = events;
const path = require('path');
const fs = require('fs');
const https = require('https');

const mkdirp = require('mkdirp');
const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();
const semver = require('semver');

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
        '/core/engines/analytics',
      ]),
      _requestTagsJson(),
      _requestFilesJson(),
      _ensureWorldPath(),
    ])
      .then(([
        [
          multiplayer,
          analytics,
        ],
        tagsJson,
        filesJson,
        ensureWorldPathResult,
      ]) => {
        if (live) {
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
          const _getModTagId = mod => {
            for (const id in tagsJson.tags) {
              const tag = tagsJson.tags[id];
              if (tag.name === mod) {
                return id;
              }
            }
            return null;
          };
          const _addTag = (userId, itemSpec) => {
            const {id} = itemSpec;
            tagsJson.tags[id] = itemSpec;

            _saveTags();

            _broadcastGlobal('addTag', [userId, itemSpec]);

            analytics.addMod(itemSpec);
          };
          const _removeTag = (userId, id) => {
            const itemSpec = tagsJson.tags[id];
            delete tagsJson.tags[id];

            _saveTags();

            _broadcastGlobal('removeTag', [userId, id]);

            analytics.removeMod(itemSpec);
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
          wss.on('connection', (c, {url}) => {
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

                      _removeTag(owner, id);
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

            addMod(mod) {
              if (!_getModTagId(mod)) {
                _getModuleVersion(mod)
                  .then(version => {
                    const itemSpec = {
                      type: 'entity',
                      id: _makeId(),
                      name: mod,
                      displayName: mod,
                      module: mod,
                      version: version,
                      tagName: _makeTagName(mod),
                      attributes: {},
                      metadata: {},
                    };
                    _addTag(null, itemSpec);
                  });
                return true;
              } else {
                return false;
              }
            }

            removeMod(mod) {
              const id = _getModTagId(mode);
              if (id) {
                _removeTag(null, id);
                return true;
              } else {
                return false;
              }
            }

            initTags() {
              const plugins = [];
              for (const id in tagsJson.tags) {
                const tagSpec = tagsJson.tags[id];

                if (tagSpec.type === 'entity') {
                  plugins.push(path.isAbsolute(tagSpec.module) ? tagSpec.module : `${tagSpec.module}@${tagSpec.version}`);

                  analytics.add(tagSpec);
                }
              }
              return archae.requestPlugins(plugins, {
                hotload: true,
              });
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
const _makeId = () => Math.random().toString(36).substring(7);
const _makeTagName = s => {
  s = s
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/--+/g, '-')
    .replace(/(?:^-|-$)/g, '');
  if (/^[0-9]/.test(s)) {
    s = 'e-' + s;
  }
  if (htmlTagNames.includes(s)) {
    s = 'e-' + s;
  }
  return s;
};
const _makeRejectApiError = reject => (statusCode = 500, message = 'API Error: ' + statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  reject(err);
};
const _getResponseString = (res, cb) => {
  const bs = [];
  res.on('data', d => {
    bs.push(d);
  });
  res.on('end', () => {
    const b = Buffer.concat(bs);
    const s = b.toString('utf8');

    cb(null, s);
  });
  res.on('error', err => {
    cb(err);
  });
};
const _getResponseJson = (res, cb) => {
  _getResponseString(res, (err, s) => {
    if (!err) {
      const j = _jsonParse(s);

      cb(null, j);
    } else {
      cb(err);
    }
  });
};
const _getModuleVersion = module => {
  if (path.isAbsolute(module)) {
    return Promise.resolve('0.0.1');
  } else {
    return _getNpmModuleVersions(module)
      .then(versions => versions[0]);
  }
};
const _getNpmModuleVersions = module => new Promise((accept, reject) => {
  const _rejectApiError = _makeRejectApiError(reject);

  https.get({
    hostname: 'registry.npmjs.org',
    path: '/' + module,
  }, proxyRes => {
    if (proxyRes.statusCode >= 200 && proxyRes.statusCode < 300) {
      _getResponseJson(proxyRes, (err, j) => {
        if (!err) {
          if (typeof j === 'object' && j !== null && typeof j.versions === 'object' && j.versions !== null) {
            const versions = Object.keys(j.versions)
              .sort((a, b) => semver.compare(a, b) * - 1); // newest to oldest
            accept(versions);
          } else {
            _rejectApiError();
          }
        } else {
          _rejectApiError(proxyRes.statusCode);
        }
      });
    } else {
      _rejectApiError(proxyRes.statusCode);
    }
  }).on('error', err => {
    _rejectApiError(500, err.stack);
  });
});
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

const path = require('path');
const fs = require('fs');

const mkdirp = require('mkdirp');

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
    const {metadata: {hub: {url: hubUrl}}} = archae;
    const {app, wss, dirname, dataDirectory} = archae.getCore();

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
      _requestTagsJson(),
      _requestFilesJson(),
      _ensureWorldPath(),
    ])
      .then(([
        tagsJson,
        filesJson,
        ensureWorldPathResult,
      ]) => {
        if (live) {
          const usersJson = {};

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

              c.on('message', s => {
                const m = _jsonParse(s);

                if (typeof m === 'object' && m !== null && typeof m.method === 'string' && Array.isArray(m.args) && typeof m.id === 'string') {
                  const {method, id, args} = m;

                  let cb = (err = null, result = null) => {
                    if (c.readyState === OPEN) {
                      const e = {
                        type: 'response',
                        id: id,
                        error: err,
                        result: result,
                      };
                      const es = JSON.stringify(e);
                      c.send(es);
                    }
                  };

                  if (method === 'addTag') {
                    const [userId, itemSpec] = args;

                    cb = (cb => err => {
                      if (!err) {
                        _broadcast('addTag', [userId, itemSpec]);
                      }

                      cb(err);
                    })(cb);

                    const {id} = itemSpec;
                    tagsJson.tags[id] = itemSpec;

                    _saveTags();

                    cb();
                  } else if (method === 'removeTag') {
                    const [userId, id] = args;

                    cb = (cb => err => {
                      if (!err) {
                        _broadcast('removeTag', [userId, id]);
                      }

                      cb(err);
                    })(cb);

                    delete tagsJson.tags[id];

                    _saveTags();

                    cb();
                  } else if (method === 'setTagAttribute') {
                    const [userId, id, {name: attributeName, value: attributeValue}] = args;

                    cb = (cb => err => {
                      if (!err) {
                        _broadcast('setTagAttribute', [userId, id, {name: attributeName, value: attributeValue}]);
                      }

                      cb(err);
                    })(cb);

                    const itemSpec = tagsJson.tags[id];
                    const {attributes} = itemSpec;
                    if (attributeValue !== undefined) {
                      attributes[attributeName] = {
                        value: attributeValue,
                      };
                    } else {
                      delete attributes[attributeName];
                    }

                    _saveTags();

                    cb();
                  } else if (method === 'tagClose') {
                    const [userId, id] = args;

                    cb = (cb => err => {
                      if (!err) {
                        _broadcast('tagClose', [userId, id]);
                      }

                      cb(err);
                    })(cb);

                    const itemSpec = tagsJson.tags[id];
                    itemSpec.open = false;

                    _saveTags();

                    cb();
                  } else if (method === 'tagOpenDetails') {
                    const [userId, id] = args;

                    cb = (cb => err => {
                      if (!err) {
                        _broadcast('tagOpenDetails', [userId, id]);
                      }

                      cb(err);
                    })(cb);

                    const itemSpec = tagsJson.tags[id];
                    itemSpec.details = true;

                    _saveTags();

                    cb();
                  } else if (method === 'tagCloseDetails') {
                    const [userId, id] = args;

                    cb = (cb => err => {
                      if (!err) {
                        _broadcast('tagCloseDetails', [userId, id]);
                      }

                      cb(err);
                    })(cb);

                    const itemSpec = tagsJson.tags[id];
                    itemSpec.details = false;

                    _saveTags();

                    cb();
                  } else if (method === 'tagPlay') {
                    const [userId, id] = args;

                    cb = (cb => err => {
                      if (!err) {
                        _broadcast('tagPlay', [userId, id]);
                      }

                      cb(err);
                    })(cb);

                    const itemSpec = tagsJson.tags[id];
                    itemSpec.paused = false;

                    _saveTags();

                    cb();
                  } else if (method === 'tagPause') {
                    const [userId, id] = args;

                    cb = (cb => err => {
                      if (!err) {
                        _broadcast('tagPause', [userId, id]);
                      }

                      cb(err);
                    })(cb);

                    const itemSpec = tagsJson.tags[id];
                    itemSpec.paused = true;

                    _saveTags();

                    cb();
                  } else if (method === 'tagSeek') {
                    const [userId, id, value] = args;

                    cb = (cb => err => {
                      if (!err) {
                        _broadcast('tagSeek', [userId, id, value]);
                      }

                      cb(err);
                    })(cb);

                    const itemSpec = tagsJson.tags[id];
                    itemSpec.value = value;

                    _saveTags();

                    cb();
                  } else if (method === 'tagSeekUpdate') {
                    const [userId, id, value] = args;

                    const itemSpec = tagsJson.tags[id];
                    itemSpec.value = value;

                    _saveTags();

                    cb();
                  } else if (method === 'loadModule') {
                    const [userId, id] = args;

                    _broadcast('loadModule', [userId, id]);

                    cb();
                  } else if (method === 'unloadModule') {
                    const [userId, id] = args;

                    _broadcast('unloadModule', [userId, id]);

                    cb();
                  } else if (method === 'broadcast') {
                    const [detail] = args;

                    _broadcast('message', [detail]);

                    cb();
                  } else {
                    const err = new Error('no such method:' + JSON.stringify(method));
                    cb(err.stack);
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

          this._cleanup = () => {
            for (let i = 0; i < connections.length; i++) {
              const connection = connections[i];
              connection.close();
            }
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

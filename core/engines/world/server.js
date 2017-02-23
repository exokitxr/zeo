const path = require('path');
const fs = require('fs');

const mkdirp = require('mkdirp');
const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();

const OPEN = 1; // ws.OPEN

const DEFAULT_TAGS = {
  tags: {},
};
const DEFAULT_FILES = {
  files: [],
};
const DEFAULT_EQUIPMENT = {
  equipment: (() => {
    const numEquipments = (1 + 1 + 2 + 8);

    const result = Array(numEquipments);
    for (let i = 0; i < numEquipments; i++) {
      result[i] = null;
    }
    return result;
  })(),
};
const DEFAULT_INVENTORY = {
  items: [],
};

class World {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {hub: {url: hubUrl}, server: {type: serverType}}} = archae;
    const {app, wss, dirname, dataDirectory} = archae.getCore();

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/hub',
    ])
      .then(([
        hub,
      ]) => {
        if (live) {
          const worldPath = path.join(dirname, dataDirectory, 'world');
          const worldTagsJsonPath = path.join(worldPath, 'tags.json');
          const worldFilesJsonPath = path.join(worldPath, 'files.json');
          const worldEquipmentJsonPath = path.join(worldPath, 'equipment.json');
          const worldInventoryJsonPath = path.join(worldPath, 'inventory.json');

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
                  if (match = url.match(/\/archae\/worldWs\?id=(.+)&authentication=(.+)$/)) {
                    const userId = match[1];
                    const authentication = match[2]; // XXX use this to authenticate inventory with the hub

                    const user = {
                      id: userId,
                      hands: {
                        left: null,
                        right: null,
                      },
                      equipment: _clone(DEFAULT_EQUIPMENT),
                      inventory: _clone(DEFAULT_INVENTORY),
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
                      if (connections.length > 0) {
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
                          const [userId, itemSpec, dst] = args;
                          const {id} = itemSpec;
                          const side = dst.match(/^hand:(left|right)$/)[1];

                          const user = usersJson[userId];
                          const {hands} = user;
                          hands[side] = itemSpec;

                          _broadcast('addTag', [userId, itemSpec, dst]);

                          cb();
                        } else if (method === 'moveTag') {
                          const [userId, src, dst] = args;

                          cb = (cb => err => {
                            if (!err) {
                              _broadcast('moveTag', [userId, id, src, dst]);
                            }

                            cb(err);
                          })(cb);

                          let match;
                          if (match = src.match(/^world:(.+)$/)) {
                            const id = match[1];

                            if (match = dst.match(/^hand:(left|right)$/)) {
                              const side = match[1];

                              const itemSpec = tagsJson.tags[id];
                              const user = usersJson[userId];
                              const {hands} = user;
                              hands[side] = itemSpec;

                              _saveTags();

                              cb();
                            } else {
                              cb(_makeInvalidArgsError());
                            }
                          } else if (match = src.match(/^hand:(left|right)$/)) {
                            const side = match[1];

                            if (match = dst.match(/^world:(.+)$/)) {
                              const matrixArrayString = match[1];
                              const matrixArray = JSON.parse(matrixArrayString);

                              const user = usersJson[userId];
                              const {hands} = user;
                              const itemSpec = hands[side];
                              hands[side] = null;

                              itemSpec.matrix = matrixArray;

                              const {id} = itemSpec;
                              tagsJson.tags[id] = itemSpec;

                              _saveTags();

                              cb();
                            } else if (match = dst.match(/^equipment:([0-9]+)$/)) {
                              const equipmentIndex = parseInt(match[1], 10);

                              const user = usersJson[userId];
                              const {hands} = user;
                              const itemSpec = hands[side];
                              hands[side] = null;

                              const {equipment} = user;
                              equipment[equipmentIndex] = itemSpec;

                              // XXX save user equipment here

                              cb();
                            } else {
                              cb(_makeInvalidArgsError());
                            }
                          } else if (match = src.match(/^equipment:([0-9]+)$/)) {
                            const srcEquipmentIndex = parseInt(match[1], 10);

                            if (match = dst.match(/^hand:(left|right)$/)) {
                              const side = match[1];

                              const user = usersJson[userId];
                              const {equipment} = user;
                              const itemSpec = equipment[srcEquipmentIndex];
                              equipment[srcEquipmentIndex] = null;

                              const {hands} = user;
                              hands[side] = itemSpec;

                              // XXX save user equipment here

                              cb();
                            } else if (match = dst.match(/^equipment:([0-9]+)$/)) {
                              const dstEquipmentIndex = parseInt(match[1], 10);

                              const user = usersJson[userId];
                              const {equipment} = user;
                              const itemSpec = equipment[srcEquipmentIndex];
                              equipment[srcEquipmentIndex] = null;
                              equipment[dstEquipmentIndex] = itemSpec;

                              // XXX save user equipment here

                              cb();
                            } else {
                              cb(_makeInvalidArgsError());
                            }
                          } else {
                            cb(_makeInvalidArgsError());
                          }
                        } else if (method === 'setTagAttribute') {
                          const [userId, src, attributeName, attributeValue] = args;

                          cb = (cb => err => {
                            if (!err) {
                              _broadcast('setTagAttribute', [userId, src, attributeName, attributeValue]);
                            }

                            cb(err);
                          })(cb);

                          let match;
                          if (match = src.match(/^world:(.+)$/)) {
                            const id = match[1];

                            const itemSpec = tagsJson.tags[id];
                            const {attributes} = itemSpec;
                            const attribute = attributes[attributeName];
                            attribute.value = attributeValue;

                            _saveTags();

                            cb();
                          } else {
                            cb(_makeInvalidArgsError()); 
                          }
                        } else {
                          const err = new Error('no such method:' + JSON.stringify(method));
                          cb(err.stack);
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

                /* function serveFilesGet(req, res, next) {
                  res.json(filesJson);
                }
                app.get('/archae/world/files.json', serveFilesGet);
                function serveFilesSet(req, res, next) {
                  bodyParserJson(req, res, () => {
                    const {body: data} = req;

                    const _respondInvalid = () => {
                      res.status(400);
                      res.send();
                    };

                    if (
                      typeof data === 'object' && data !== null &&
                      data.files && Array.isArray(data.files)
                    ) {
                      filesJson.files = data.files;

                      _saveFile(worldFilesJsonPath, filesJson)
                        .then(() => {
                          res.send();
                        })
                        .catch(err => {
                          res.status(500);
                          res.send(err.stack);
                        });
                    } else {
                      _respondInvalid();
                    }
                  });
                }
                app.put('/archae/world/files.json', serveFilesSet);
                function serveEquipmentGet(req, res, next) {
                  hub.authHub(req, (err, username) => {
                    if (!err) {
                      if (serverType === 'ranked') {
                        hub.proxyHub(req, res, '/hub/world/equipment.json');
                      } else {
                        res.json(equipmentJson); // XXX make this per-user
                      }
                    } else {
                      res.status(err.code === 'EAUTH' ? 401 : 500);
                      res.send(err.stack);
                    }
                  });
                }
                app.get('/archae/world/equipment.json', serveEquipmentGet);
                function serveEquipmentSet(req, res, next) {
                  bodyParserJson(req, res, () => {
                    hub.authHub(req, (err, username) => {
                      if (!err) {
                        if (serverType === 'ranked') {
                          hub.proxyHub(req, res, '/hub/world/equipment.json');
                        } else {
                          const {body: data} = req;

                          const _respondInvalid = () => {
                            res.status(400);
                            res.send();
                          };

                          if (
                            typeof data === 'object' && data !== null &&
                            data.equipment && Array.isArray(data.equipment)
                          ) {
                            equipmentJson.equipment = data.equipment;

                            _saveFile(worldEquipmentJsonPath, equipmentJson)
                              .then(() => {
                                res.send();
                              })
                              .catch(err => {
                                res.status(500);
                                res.send(err.stack);
                              });
                          } else {
                            _respondInvalid();
                          }
                        }
                      } else {
                        res.status(err.code === 'EAUTH' ? 401 : 500);
                        res.send(err.stack);
                      }
                    });
                  });
                }
                app.put('/archae/world/equipment.json', serveEquipmentSet);
                function serveInventoryGet(req, res, next) {
                  hub.authHub(req, (err, username) => {
                    if (!err) {
                      if (serverType === 'ranked') {
                        hub.proxyHub(req, res, '/hub/world/inventory.json');
                      } else {
                        res.json(inventoryJson);
                      }
                    } else {
                      res.status(err.code === 'EAUTH' ? 401 : 500);
                      res.send(err.stack);
                    }
                  });
                }
                app.get('/archae/world/inventory.json', serveInventoryGet);
                function serveInventorySet(req, res, next) {
                  bodyParserJson(req, res, () => {
                    hub.authHub(req, (err, username) => {
                      if (!err) {
                        if (serverType === 'ranked') {
                          hub.proxyHub(req, res, '/hub/world/inventory.json');
                        } else {
                          const {body: data} = req;

                          const _respondInvalid = () => {
                            res.status(400);
                            res.send();
                          };

                          if (
                            typeof data === 'object' && data !== null &&
                            data.items && Array.isArray(data.items)
                          ) {
                            inventoryJson.items = data.items;

                            _saveFile(worldInventoryJsonPath, inventoryJson)
                              .then(() => {
                                res.send();
                              })
                              .catch(err => {
                                res.status(500);
                                res.send(err.stack);
                              });
                          } else {
                            _respondInvalid();
                          }
                        }
                      } else {
                        res.status(err.code === 'EAUTH' ? 401 : 500);
                        res.send(err.stack);
                      }
                    });
                  });
                }
                app.put('/archae/world/inventory.json', serveInventorySet); */

                const startTime = Date.now();
                function serveStartTime(req, res, next) {
                  res.json({
                    startTime,
                  });
                }
                app.get('/archae/world/start-time.json', serveStartTime);

                this._cleanup = () => {
                  function removeMiddlewares(route, i, routes) {
                    if (
                      route.handle.name === 'serveStartTime'
                    ) {
                      routes.splice(i, 1);
                    }
                    if (route.route) {
                      route.route.stack.forEach(removeMiddlewares);
                    }
                  }
                  app._router.stack.forEach(removeMiddlewares);

                  for (let i = 0; i < connections.length; i++) {
                    const connection = connections[i];
                    connection.close();
                  }
                };
              }
            });
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
const _clone = o => JSON.parse(JSON.stringify(o));
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
const _makeInvalidArgsError = () => {
  const err = new Error('invalid arguments');
  err.code = 'EARGS';
  return err;
};

module.exports = World;

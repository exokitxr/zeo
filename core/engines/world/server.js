const path = require('path');
const fs = require('fs');
const https = require('https');

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
const DEFAULT_EQUIPMENT = (() => {
  const numEquipments = (1 + 1 + 2 + 8);

  const result = Array(numEquipments);
  for (let i = 0; i < numEquipments; i++) {
    result[i] = null;
  }
  return result;
})();
const DEFAULT_INVENTORY = (() => {
  const numItems = 9;

  const result = Array(numItems);
  for (let i = 0; i < numItems; i++) {
    result[i] = null;
  }
  return result;
})();
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

class World {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {hub: {url: hubUrl}}} = archae;
    const {app, wss, dirname, dataDirectory} = archae.getCore();

    const hubSpec = (() => {
      const match = hubUrl.match(/^(.+\..+?)(?::([0-9]*?))?$/);
      return match && {
        host: match[1],
        port: match[2] ? parseInt(match[2], 10) : 443,
      };
    })();

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/bootstrap',
    ])
      .then(([
        bootstrap,
      ]) => {
        if (live) {
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
                const equipmentJson = {
                  equipment: DEFAULT_EQUIPMENT,
                };
                const inventoryJson = {
                  inventory: DEFAULT_INVENTORY,
                };
                const usersJson = {};

                /* const _requestHub = ({token, method, url, body}) => new Promise((accept, reject) => {
                  const proxyReq = https.request({
                    method,
                    hostname: hubSpec.host,
                    port: hubSpec.port,
                    path: url,
                    headers: (() => {
                      const result = {
                        'Authorization': 'Token ' + token, // XXX hub authentication now works via cookies, not this
                      };
                      if (body) {
                        result['Content-Type'] = 'application/json';
                      }
                      return result;
                    })(),
                  });
                  proxyReq.on('error', err => {
                    reject(err);
                  });
                  proxyReq.on('response', proxyRes => {
                    const bs = [];
                    proxyRes.on('data', d => {
                      bs.push(d);
                    });
                    proxyRes.on('end', () => {
                      const b = Buffer.concat(bs);
                      const s = b.toString('utf8');

                      if (proxyRes.statusCode >= 200 && proxyRes.statusCode < 300) {
                        if (/^application\/json(?:;|$)/.test(proxyRes.headers['content-type'])) {
                          const j = JSON.parse(s);

                          accept(j);
                        } else {
                          accept();
                        }
                      } else {
                        const err = new Error('hub returned failure status code: ' + JSON.stringify({
                          method,
                          url,
                          statusCode: proxyRes.statusCode,
                          body: s,
                        }, null, 2));

                        reject(err);
                      }
                    });
                    proxyRes.on('error', err => {
                      reject(err);
                    });
                  });

                  if (body) {
                    proxyReq.end(JSON.stringify(body));
                  } else {
                    proxyReq.end();
                  }
                }); */
                const _requestEquipmentJson = ({token}) => {
                  /* if (hubSpec) { // XXX re-enable hub equipment storage for these
                    return _requestHub({
                      token,
                      method: 'GET',
                      url: '/hub/world/equipment.json',
                    });
                  } else { */
                    return Promise.resolve(equipmentJson);
                  // }
                };
                const _requestInventoryJson = ({token}) => {
                  /* if (hubSpec) {
                    return _requestHub({
                      token,
                      method: 'GET',
                      url: '/hub/world/inventory.json',
                    });
                  } else { */
                    return Promise.resolve(inventoryJson);
                  // }
                };

                const connections = [];

                wss.on('connection', c => {
                  const {url} = c.upgradeReq;

                  let match;
                  if (match = url.match(/\/archae\/worldWs\?id=(.+)$/)) {
                    const userId = match[1];
                    const token = null; // XXX actually authenticate with the token here;

                    Promise.all([
                      _requestEquipmentJson({token}),
                      _requestInventoryJson({token}),
                    ])
                      .then(([
                        equipmentJson,
                        inventoryJson,
                      ]) => {
                        const user = {
                          id: userId,
                          hands: {
                            left: null,
                            right: null,
                          },
                          equipment: equipmentJson.equipment,
                          inventory: inventoryJson.inventory,
                        };
                        usersJson[userId] = user;

                        const _sendInit = () => {
                          const e = {
                            type: 'init',
                            args: [
                              _arrayify(tagsJson.tags),
                              equipmentJson.equipment,
                              inventoryJson.inventory,
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
                        const _saveEquipment = _debounce(next => {
                          /* if (hubSpec) {
                            _requestHub({
                              token,
                              method: 'PUT',
                              url: '/hub/world/equipment.json',
                              body: equipmentJson,
                            })
                              .then(() => {
                                next();
                              })
                              .catch(err => {
                                console.warn('failed to save equipment', err);

                                next();
                              });
                          } else { */
                            console.warn('not saving equipment due to invalid hub spec');
                          // }
                        });
                        const _saveInventory = _debounce(next => {
                          /* if (hubSpec) {
                            _requestHub({
                              token,
                              method: 'PUT',
                              url: '/hub/world/inventory.json',
                              body: inventoryJson,
                            })
                              .then(() => {
                                next();
                              })
                              .catch(err => {
                                console.warn('failed to save inventory', err);

                                next();
                              });
                          } else { */
                            console.warn('not saving inventory due to invalid hub spec');
                          // }
                        });

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

                              cb = (cb => err => {
                                if (!err) {
                                  _broadcast('addTag', [userId, itemSpec, dst]);
                                }

                                cb(err);
                              })(cb);

                              let match;
                              if (dst === 'world') {
                                const {id} = itemSpec;
                                tagsJson.tags[id] = itemSpec;

                                _saveTags();

                                cb();
                              } else if (match = dst.match(/^hand:(left|right)$/)) {
                                const side = match[1];

                                const user = usersJson[userId];
                                const {hands} = user;
                                hands[side] = itemSpec;

                                cb();
                              } else {
                                cb(_makeInvalidArgsError());
                              }
                            } else if (method === 'removeTag') {
                              const [userId, src] = args;

                              cb = (cb => err => {
                                if (!err) {
                                  _broadcast('removeTag', [userId, src]);
                                }

                                cb(err);
                              })(cb);

                              let match;
                              if (match = src.match(/^world:(.+)$/)) {
                                const id = match[1];

                                delete tagsJson.tags[id];

                                _saveTags();

                                cb();
                              } else if (match = src.match(/^hand:(left|right)$/)) {
                                const side = match[1];

                                const user = usersJson[userId];
                                const {hands} = user;
                                delete hands[side];

                                cb();
                              } else {
                                cb(_makeInvalidArgsError());
                              }
                            } else if (method === 'moveTag') {
                              const [userId, src, dst] = args;

                              cb = (cb => err => {
                                if (!err) {
                                  _broadcast('moveTag', [userId, src, dst]);
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
                                  delete tagsJson.tags[id];

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

                                  itemSpec.matrix = DEFAULT_MATRIX;

                                  const {equipment} = user;
                                  equipment[equipmentIndex] = itemSpec;

                                  _saveEquipment();

                                  cb();
                                } else if (match = dst.match(/^inventory:([0-9]+)$/)) {
                                  const inventoryIndex = parseInt(match[1], 10);

                                  const user = usersJson[userId];
                                  const {hands} = user;
                                  const itemSpec = hands[side];
                                  hands[side] = null;

                                  itemSpec.matrix = DEFAULT_MATRIX;

                                  const {inventory} = user;
                                  inventory[inventoryIndex] = itemSpec;

                                  _saveInventory();

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

                                  _saveEquipment();

                                  cb();
                                } else if (match = dst.match(/^equipment:([0-9]+)$/)) {
                                  const dstEquipmentIndex = parseInt(match[1], 10);

                                  const user = usersJson[userId];
                                  const {equipment} = user;
                                  const itemSpec = equipment[srcEquipmentIndex];
                                  equipment[srcEquipmentIndex] = null;
                                  equipment[dstEquipmentIndex] = itemSpec;

                                  _saveEquipment();

                                  cb();
                                } else {
                                  cb(_makeInvalidArgsError());
                                }
                              } else if (match = src.match(/^inventory:([0-9]+)$/)) {
                                const inventoryIndex = parseInt(match[1], 10);

                                if (match = dst.match(/^hand:(left|right)$/)) {
                                  const side = match[1];

                                  const user = usersJson[userId];
                                  const {inventory} = user;
                                  const itemSpec = inventory[inventoryIndex];
                                  inventory[inventoryIndex] = null;

                                  const {hands} = user;
                                  hands[side] = itemSpec;

                                  _saveInventory();

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
                                if (attributeValue !== null) {
                                  attributes[attributeName] = attributeValue;
                                } else {
                                  delete attributes[attributeName];
                                }

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
                      })
                      .catch(err => {
                        console.warn('failed to authenticate connection', err);

                        c.close();
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
                  bootstrap.authHub(req, (err, username) => {
                    if (!err) {
                      if (serverType === 'secure') {
                        bootstrap.proxyHub(req, res, '/hub/world/equipment.json');
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
                    bootstrap.authHub(req, (err, username) => {
                      if (!err) {
                        if (serverType === 'secure') {
                          bootstrap.proxyHub(req, res, '/hub/world/equipment.json');
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
                  bootstrap.authHub(req, (err, username) => {
                    if (!err) {
                      if (serverType === 'secure') {
                        bootstrap.proxyHub(req, res, '/hub/world/inventory.json');
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
                    bootstrap.authHub(req, (err, username) => {
                      if (!err) {
                        if (serverType === 'secure') {
                          bootstrap.proxyHub(req, res, '/hub/world/inventory.json');
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

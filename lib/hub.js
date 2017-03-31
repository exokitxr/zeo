const path = require('path');
const fs = require('fs');
const child_process = require('child_process');

const mkdirp = require('mkdirp');
const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();
const LRU = require('lru-cache');
const passwordHash = require('password-hash-and-salt');
const cookie = require('cookie');
const Busboy = require('busboy');
const sharp = require('sharp');

const auth = require('./auth');

const SERVER_EXPIRY_INTERVAL = 60 * 1000;
const FACES = ['right', 'left', 'top', 'bottom', 'back', 'front'];

const DEFAULT_EQUIPMENT = (() => {
  const numEquipmentItems = (1 + 1 + 2 + 8);
  const result = Array(numEquipmentItems);
  for (let i = 0; i < numEquipmentItems; i++) {
    result[i] = null;
  }
  return result;
})();
const DEFAULT_INVENTORY = (() => {
  const numInventoryItems = 9;
  const result = Array(numInventoryItems);
  for (let i = 0; i < numInventoryItems; i++) {
    result[i] = null;
  }
  return result;
})();
// const GOLD_PLAN_ID = 'gold';
const transparentImgUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const transparentImgBuffer = new Buffer(transparentImgUrl.match(/,(.*)$/)[1], 'base64');

const listen = (a, config, {key, userDb}) => {
  const {dirname, dataDirectory} = a;
  const {wss} = a.getCore();
  const {metadata: {site: {url: siteUrl}, hub: {url: hubUrl, enabled: hubEnabled}}} = config;

  const _filterIsHubHostname = (req, res, next) => {
    if (hubEnabled && req.get('Host') === hubUrl) {
      next();
    } else {
      next('route');
    }
  };

  const _getAuthentication = req => {
    const authorization = req.get('Authorization') || '';
    const match = authorization.match(/^Token (.+)$/);
    return match && match[1];
  };
  const _authenticate = (authentication, cb) => {
    if (authentication) {
      userDb.findOne({
        type: 'token',
        authentication,
      }, (err, t) => {
        if (!err) {
          const username = t ? t.username : null;

          cb(null, username);
        } else {
          cb(err);
        }
      });
    } else {
      process.nextTick(() => {
        cb({
          code: 'EAUTH',
        });
      });
    }
  };

  const _listenPublic = () => {
    a.app.get('/', _filterIsHubHostname, (req, res, next) => {
      req.url = '/vr.html';

      a.app(req, res, next);
    });
  };
  const _listenServers = () => new Promise((accept, reject) => {
    const serversCache = new LRU({
      maxAge: SERVER_EXPIRY_INTERVAL,
      dispose: url => {
        process.nextTick(() => { // only broadcast removal if this is an actual removal as opposed to an update
          if (!serversCache.has(url)) {
            _broadcast('server', [url, null]);
          }
        });
      },
    });

    class Server {
      constructor(worldname, url, users) {
        this.worldname = worldname;
        this.url = url;
        this.users = users;
      }
    }

    const _getServers = () => serversCache.keys()
      .map(k => serversCache.get(k))
      .filter(v => v !== undefined);

    const connections = [];

    const _broadcast = (type, args) => {
      const e = {
        type,
        args,
      };
      const es = JSON.stringify(e);

      for (let i = 0; i < connections.length; i++) {
        const connection = connections[i];
        connection.send(es);
      }
    };

    const _listenServersRequest = () => {
      const _tryBody = (req, tryFn) => {
        const {body: j} = req;

        if (typeof j === 'object' && j !== null && typeof j.token === 'string') {
          const {token} = j;

          return tryFn(token);
        } else {
          return Promise.resolve(false);
        }
      };
      const _tryCookie = (req, tryFn)  => {
        const cookieHeader = req.get('Cookie');

        if (cookieHeader) {
          const c = cookie.parse(cookieHeader);
          const token = c && c.token;

          if (token) {
            return tryFn(token);
          } else {
            return Promise.resolve(false);
          }
        } else {
          return Promise.resolve(false);
        }
      };
      const _tryAuth = (req, res, tryFn, doneFn = () => {
        res.status(401);
        res.send();
      }) => _tryBody(req, tryFn)
        .then(done => {
          if (!done) {
            return _tryCookie(req, tryFn);
          } else {
            return done;
          }
        })
        .then(done => {
          if (!done) {
            doneFn();
          }
        });
      a.app.post('/server/login', bodyParserJson, (req, res, next) => {
        const _tryToken = token => {
          if (auth.parseToken({
            key,
            token,
          })) {
            res.json({
              token,
            });

            return Promise.resolve(true);
          } else {
            return Promise.resolve(false);
          }
        };

        _tryAuth(req, res, _tryToken);
      });
      a.app.post('/server/checkLogin', bodyParserJson, (req, res, next) => {
        const _tryToken = token => {
          if (auth.parseToken({
            key,
            token,
          })) {
            res.json({
              ok: true,
            });

            return Promise.resolve(true);
          } else {
            return Promise.resolve(false);
          }
        };
        const _failToken = () => {
          res.json({
            ok: false,
          });
        };

        _tryAuth(req, res, _tryToken, _failToken);
      });
      a.app.get('/servers/server.json', _filterIsHubHostname, (req, res, next) => {
        res.json({
          type: 'hub',
          url: null,
        });
      });
      a.app.get('/servers/servers.json', _filterIsHubHostname, (req, res, next) => {
        res.set('Access-Control-Allow-Origin', 'https://' + siteUrl);

        res.json({
          servers: _getServers(),
        });
      });
      a.app.get(/^\/servers\/img\/icon\/(.+)$/, _filterIsHubHostname, (req, res, next) => {
        const url = decodeURIComponent(req.params[0]);
        const server = serversCache.get(url);

        if (server) {
          const {worldname} = server;
          const serverIconPath = path.join(dirname, dataDirectory, 'img', 'hub', 'icon', worldname + '.png');

          fs.lstat(serverIconPath, err => {
            if (!err) {
              res.type('image/png');

              const rs = fs.createReadStream(serverIconPath); // XXX serve this statically for etags support
              rs.pipe(res);
            } else {
              res.type('image/png');
              res.send(transparentImgBuffer);
            }
          });
        } else {
          res.status(404);
          res.send();
        }
      });
      a.app.get(/^\/servers\/img\/cubemap\/(.+?)\/(top|bottom|left|right|front|back)\.png$/, _filterIsHubHostname, (req, res, next) => {
        const url = decodeURIComponent(req.params[0]);
        const face = req.params[1];
        const server = serversCache.get(url);

        if (server) {
          const {worldname} = server;
          const serverCubemapFacePath = path.join(dirname, dataDirectory, 'img', 'hub', 'cubemap', worldname + '-' + face + '.png');

          fs.lstat(serverCubemapFacePath, err => {
            if (!err) {
              res.type('image/png');

              const rs = fs.createReadStream(serverCubemapFacePath); // XXX serve this statically for etags support
              rs.pipe(res);
            } else {
              res.type('image/png');
              res.send(transparentImgBuffer);
            }
          });
        } else {
          res.status(404);
          res.send();
        }
      });
      a.app.post('/servers/announce', _filterIsHubHostname, bodyParserJson, (req, res, next) => {
        const {body: j} = req;

        if (
          typeof j == 'object' && j !== null &&
          typeof j.worldname === 'string' &&
          typeof j.url === 'string' &&
          Array.isArray(j.users) && j.users.every(user => typeof user === 'string')
        ) {
          const {worldname, url, users} = j;

          const server = new Server(worldname, url, users);
          serversCache.set(url, server);

          _broadcast('server', [url, server]);

          res.send();
        } else {
          res.status(400);
          res.send();
        }
      });

      a.app.post(/^\/servers\/announceIcon\/(.+)$/, _filterIsHubHostname, (req, res, next) => {
        const isPng = req.get('Content-Type') === 'image/png';
        const url = decodeURIComponent(req.params[0]);
        const server = serversCache.get(url);

        if (isPng && server) { // XXX lock this with a mutex
          const {worldname} = server;
          const serverIconPath = path.join(dirname, dataDirectory, 'img', 'hub', 'icon', worldname + '.png');

          mkdirp(path.dirname(serverIconPath), err => {
            if (!err) {
              const ws = fs.createWriteStream(serverIconPath);
              req.pipe(ws);

              ws.on('finish', () => {
                res.send();
              });
              ws.on('error', err => {
                res.status(500);
                res.send(err.stack);
              });
            } else {
              res.status(500);
              res.send(err.stack);
            }
          });
        } else {
          res.status(404);
          res.send();
        }
      });
      a.app.post(/^\/servers\/announceCubemap\/(.+)$/, _filterIsHubHostname, (req, res, next) => {
        const url = decodeURIComponent(req.params[0]);
        const server = serversCache.get(url);

        if (server) { // XXX lock this with a mutex
          const {worldname} = server;

          res.set('Access-Control-Allow-Origin', 'https://' + url);

          let error = null;

          const busboy = new Busboy({
            headers: req.headers,
          });

          busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
            const face = fieldname;

            if (FACES.indexOf(face) !== -1) {
              if (mimetype === 'image/png') {
                const serverCubemapFacePath = path.join(dirname, dataDirectory, 'img', 'hub', 'cubemap', worldname + '-' + face + '.png');

                mkdirp(path.dirname(serverCubemapFacePath), err => {
                  if (!err) {
                    const flipStreamStart = sharp();
                    const flipStreamMid = (face !== 'top' && face !== 'bottom') ? flipStreamStart.flip() : flipStreamStart.flop();
                    const flipStreamEnd = flipStreamMid.png();

                    const ws = fs.createWriteStream(serverCubemapFacePath);

                    file.pipe(flipStreamEnd).pipe(ws);;

                    ws.on('error', err => {
                      error = error || err;
                    });
                  } else {
                    error = error || new Error('invalid mime type for face:' + filename);

                    file.resume();
                  }
                });
              } else {
                error = error || new Error('invalid mime type for face:' + filename);

                file.resume();
              }
            } else {
              error = error || new Error('invalid mime type for face:' + filename);

              file.resume();
            }
          });
          busboy.on('finish', () => {
            if (!error) {
              res.end();
            } else {
              res.status(500);
              res.send(error.stack);
            }
          });
          req.pipe(busboy);
        } else {
          res.status(404);
          res.send();
        }
      });
    };

    const _listenServersWs = () => {
      wss.on('connection', c => {
        const {url} = c.upgradeReq;

        if (url === '/hubWs') {
          const _sendInit = () => {
            const e = {
              type: 'servers',
              args: [
                _getServers(),
              ],
            };
            const es = JSON.stringify(e);
            c.send(es);
          };
          _sendInit();

          c.on('close', () => {
            connections.splice(connections.indexOf(c), 1);
          });

          connections.push(c);
        }
      });

      for (let i = 0; i < connections.length; i++) {
        const connection = connections[i];
        connection.close();
      }
    };

    _listenServersRequest();
    _listenServersWs();

    accept();
  });
  const _listenWorld = () => new Promise((accept, reject) => {
    const equipmentJsons = {};
    const equipmentJsonPromises = {};
    const _getUsernamePath = username => path.join(dirname, dataDirectory, 'users', username);
    const _getEquipmentJsonPath = username => path.join(_getUsernamePath(username), 'equipment.json');
    const _loadEquipmentJson = username => {
      let entry = equipmentJsonPromises[username];
      if (!entry) {
        entry = new Promise((accept, reject) => {
          fs.readFile(_getEquipmentJsonPath(username), 'utf8', (err, s) => {
            if (!err) {
              const j = JSON.parse(s);
              equipmentJsons[username] = j;

              accept();
            } else if (err.code === 'ENOENT') {
              equipmentJsons[username] = {
                equipment: DEFAULT_EQUIPMENT,
              };

              accept();
            } else {
              console.warn(err);

              accept();
            }
          });
        });
        equipmentJsonPromises[username] = entry;
      }
      return entry;
    };
    const _requestGetEquipmentJson = username => _loadEquipmentJson(username)
      .then(() => equipmentJsons[username]);
    const _requestSetEquipmentJson = (username, equipmentJson) => _loadEquipmentJson(username)
      .then(() => new Promise((accept, reject) => {
        equipmentJsons[username] = equipmentJson;

        const equipmentJsonPath = _getEquipmentJsonPath(username);
        mkdirp(path.dirname(equipmentJsonPath), err => {
          if (!err) {
            const equipmentJsonString = JSON.stringify(equipmentJson, null, 2);

            fs.writeFile(equipmentJsonPath, equipmentJsonString, err => {
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
      }));

    function serveEquipmentGet(req, res, next) {
      _authenticate(_getAuthentication(req), (err, username) => {
        if (!err) {
          _requestGetEquipmentJson(username)
            .then(equipmentJson => {
              res.json(equipmentJson);
            })
            .catch(err => {
              res.status(500);
              res.send(err.stack);
            });
        } else {
          res.status(err.code === 'EAUTH' ? 401 : 500);
          res.send(err.stack);
        }
      });
    }
    a.app.get('/hub/world/equipment.json', serveEquipmentGet);
    function serveEquipmentSet(req, res, next) {
      bodyParserJson(req, res, () => {
        _authenticate(_getAuthentication(req), (err, username) => {
          if (!err) {
            const {body: data} = req;

            const _respondInvalid = () => {
              res.status(400);
              res.send();
            };

            if (
              typeof data === 'object' && data !== null &&
              data.equipment && Array.isArray(data.equipment)
            ) {
              const equipmentJson = {
                equipment: data.equipment,
              };

              _requestSetEquipmentJson(username, equipmentJson)
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
          } else {
            res.status(err.code === 'EAUTH' ? 401 : 500);
            res.send(err.stack);
          }
        });
      });
    }
    a.app.put('/hub/world/equipment.json', serveEquipmentSet);

    const inventoryJsons = {};
    const inventoryJsonPromises = {};
    const _getInventoryJsonPath = username => path.join(_getUsernamePath(username), 'inventory.json');
    const _loadInventoryJson = username => {
      let entry = inventoryJsonPromises[username];
      if (!entry) {
        entry = new Promise((accept, reject) => {
          fs.readFile(_getInventoryJsonPath(username), 'utf8', (err, s) => {
            if (!err) {
              const j = JSON.parse(s);
              inventoryJsons[username] = j;

              accept();
            } else if (err.code === 'ENOENT') {
              inventoryJsons[username] = {
                inventory: DEFAULT_INVENTORY,
              };

              accept();
            } else {
              console.warn(err);

              accept();
            }
          });
        });
        inventoryJsonPromises[username] = entry;
      }
      return entry;
    };
    const _requestGetInventoryJson = username => _loadInventoryJson(username)
      .then(() => inventoryJsons[username]);
    const _requestSetInventoryJson = (username, inventoryJson) => _loadInventoryJson(username)
      .then(() => new Promise((accept, reject) => {
        inventoryJsons[username] = inventoryJson;

        const inventoryJsonPath = _getInventoryJsonPath(username);
        mkdirp(path.dirname(inventoryJsonPath), err => {
          if (!err) {
            const inventoryJsonString = JSON.stringify(inventoryJson, null, 2);

            fs.writeFile(_getInventoryJsonPath(username), inventoryJsonString, err => {
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
      }));
    function serveInventoryGet(req, res, next) {
      _authenticate(_getAuthentication(req), (err, username) => {
        if (!err) {
          _requestGetInventoryJson(username)
            .then(inventoryJson => {
              res.json(inventoryJson);
            })
            .catch(err => {
              res.status(500);
              res.send(err.stack);
            });
        } else {
          res.status(err.code === 'EAUTH' ? 401 : 500);
          res.send(err.stack);
        }
      });
    }
    a.app.get('/hub/world/inventory.json', serveInventoryGet);
    function serveInventorySet(req, res, next) {
      bodyParserJson(req, res, () => {
        _authenticate(_getAuthentication(req), (err, username) => {
          if (!err) {
            const {body: data} = req;

            const _respondInvalid = () => {
              res.status(400);
              res.send();
            };

            if (
              typeof data === 'object' && data !== null &&
              data.inventory && Array.isArray(data.inventory)
            ) {
              const inventoryJson = {
                inventory: data.inventory,
              };

              _requestSetInventoryJson(username, inventoryJson)
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
          } else {
            res.status(err.code === 'EAUTH' ? 401 : 500);
            res.send(err.stack);
          }
        });
      });
    }
    a.app.put('/hub/world/inventory.json', serveInventorySet);

    /* a.app.post('/hub/userState', bodyParser.json(), (req, res, next) => { // port this over to world engine
        const {body: j} = req;

        const _isValidToken = o => typeof o === 'string';
        const _isValidState = o => o  === 'object' && o !== null &&
          typeof o.world === 'string' &&
          Array.isArray(o.matrix) && o.matrix.length === 16 &&
          Array.isArray(o.inventory) && o.inventory.every(item =>
            typeof item === 'object' && item !== null &&
            typeof item.tag === 'string' &&
            typeof item.attributes === 'object' && item.attributes !== null
          );

        if (
          typeof j == 'object' && j !== null &&
          _isValidToken(j.token) &&
          _isValidState(j.state) &&
          _isValidInventory(j.inventory)
        ) {
          const {token, state: {world, matrix, inventory}} = j;

          userDb.findOne({
            type: 'token',
            token,
          }, (err, t) => {
            if (!err) {
              if (t) {
                const {username} = t;

                userDb.update({
                  type: 'user',
                  username,
                }, {
                  $set: {
                    world,
                    matrix,
                    inventory,
                  },
                }, err => {
                  if (!err) {
                    res.json({
                      ok: true,
                    });
                  } else {
                    res.status(500);
                    res.send(err.stack);
                  }
                });
              } else {
                res.status(500);
                res.send(err.stack);
              }
            }
          });
        } else {
          res.status(400);
          res.send();
        }
      }); */

    accept();
  });

  /* const _listenStripe = () => new Promise((accept, reject) => {
    const {dirname, dataDirectory} = a;

    a.app.get('/stripe/publishableKey.json', (req, res, next) => {
      res.json(stripePublishableKey);
    });

    a.app.post('/hub/signUp', bodyParserJson, (req, res, next) => {
      const {body: j} = req;

      if (typeof j == 'object' && j !== null && typeof j.username === 'string' && typeof j.stripeToken === 'string') {
        const {username, stripeToken} = j;

        userDb.findOne({
          type: 'user',
          username,
          plan: null,
        }, (err, user) => {
          if (!err) {
            if (user) {
              console.log('creating customer', JSON.stringify({username}));

              stripe.customers.create({
                description: username,
                source: stripeToken,
              }, (err, customer) => {
                const {id: customerId} = customer;

                console.log('created customer', JSON.stringify({username, customerId}));

                if (!err) {
                  stripe.subscriptions.create({
                    customer: customerId,
                    plan: GOLD_PLAN_ID,
                  }, (err, subscription) => {
                    const {id: subscriptionId} = subscription;

                    console.log('created subscription', JSON.stringify({username, customerId, subscriptionId, plan: GOLD_PLAN_ID}));

                    userDb.update({
                      type: 'user',
                      username,
                    }, {
                      $set: {
                        plan: GOLD_PLAN_ID,
                      }
                    }, err => {
                      if (!err) {
                        console.log('updated user plan', JSON.stringify({username, customerId, subscriptionId, plan: GOLD_PLAN_ID}));

                        res.json({
                          ok: true,
                        });
                      } else {
                        console.warn(err);

                        res.status(500);
                        res.send();
                      }
                    });
                  });
                } else {
                  console.warn(err);

                  res.status(500);
                  res.send();
                }
              });
            } else {
              res.status(400);
              res.send();
            }
          }
        });
      } else {
        res.status(400);
        res.send();
      }
    });

    accept();
  }); */

  return Promise.all([
    _listenPublic(),
    _listenServers(),
    _listenWorld(),
    // _listenStripe(),
  ])
  .then(() => {});
};

module.exports = {
  listen,
};

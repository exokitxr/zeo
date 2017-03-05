const path = require('path');
const fs = require('fs-extra');
const stream = require('stream');
const crypto = require('crypto');
const child_process = require('child_process');

const mkdirp = require('mkdirp');
const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();
const httpProxy = require('http-proxy');
const LRU = require('lru-cache');
const passwordHash = require('password-hash-and-salt');
const nedb = require('nedb');
const Stripe = require('stripe');

const configJs = require('../data/config/config');

const {stripe: {secretKey: stripeSecretKey, publishableKey: stripePublishableKey}} = configJs;
const stripe = Stripe(stripeSecretKey);

const SERVER_EXPIRY_INTERVAL = 60 * 1000;

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
const GOLD_PLAN_ID = 'gold';

const listen = (a, config) => {
  const {dirname, dataDirectory} = a;
  const {metadata: {hub: {url: hubUrl, enabled: hubEnabled}}} = config;

  const _filterIsHubHostname = (req, res, next) => {
    if (hubEnabled && req.get('Host') === hubUrl) {
      next();
    } else {
      next('route');
    }
  };

  const _requestUserDb = () => new Promise((accept, reject) => {
    const userDb = new nedb({
      filename: path.join(dirname, dataDirectory, 'db', 'users.db'),
    });
    userDb.loadDatabase(err => {
      if (!err) {
        accept(userDb);
      } else {
        reject(err);
      }
    });
  });

  return _requestUserDb()
    .then(userDb => {
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

      const _listenUsers = () => new Promise((accept, reject) => {
        a.app.post('/hub/auth', bodyParserJson, (req, res, next) => {
          const {body: j} = req;

          if (typeof j === 'object' && j !== null && typeof j.authentication === 'string') {
            const {authentication} = j;

            userDb.findOne({ // XXX
              type: 'token',
              authentication,
            }, (err, t) => {
              if (!err) {
                const username = t ? t.username : null;

                res.json({
                  username,
                });
              } else {
                res.status(500);
                res.send();
              }
            });
          } else {
            res.status(400);
            res.send();
          }
        });

        accept();
      });
 
      const _listenServers = () => new Promise((accept, reject) => {
        const serversCache = new LRU({
          maxAge: SERVER_EXPIRY_INTERVAL,
        });

        a.app.get('/hub/servers.json', _filterIsHubHostname, (req, res, next) => {
          res.json({
            servers: serversCache.keys()
              .map(k => serversCache.get(k))
              .filter(v => v !== undefined),
          });
        });
        a.app.get('/server/server.json', _filterIsHubHostname, (req, res, next) => {
          res.json({
            type: 'hub',
            url: null,
          });
        });
        a.app.post('/hub/servers/announce', _filterIsHubHostname, bodyParserJson, (req, res, next) => {
          const {body: j} = req;

          if (
            typeof j == 'object' && j !== null &&
            typeof j.username === 'string' &&
            typeof j.worldname === 'string' &&
            typeof j.url === 'string' &&
            Array.isArray(j.users) && j.users.every(user => typeof user === 'string') &&
            typeof j.secure === 'boolean'
          ) {
            const {username, worldname, url, users, secure} = j;

            const server = {
              username,
              worldname,
              url,
              users,
              secure,
            };
            serversCache.set(url, server);

            res.send();
          } else {
            res.status(400);
            res.send();
          }
        });

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

      const _listenWorld = () => new Promise((accept, reject) => {
        const equipmentJsons = {};
        const equipmentJsonPromises = {};
        const _getUsernamePath = username => path.join(dirname, dataDirectory, 'hub', username);
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
        _listenUsers(),
        _listenServers(),
        _listenWorld(),
        // _listenStripe(),
      ])
      .then(() => {});
    });
};

module.exports = {
  listen,
};

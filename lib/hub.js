const path = require('path');
const fs = require('fs-extra');
const stream = require('stream');
const crypto = require('crypto');
const child_process = require('child_process');

const bodyParser = require('body-parser');
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
  const numInventoryItems = 4;
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
      const _listenUsers = () => new Promise((accept, reject) => {
        const _getNewToken = (username, cb) => {
          crypto.randomBytes(32 * 2, (err, b) => {
            if (!err) {
              const token = b.slice(0, 32).toString('base64');
              const authentication = b.slice(32, 64).toString('base64');
              const timestamp = Date.now();

              userDb.insert({
                type: 'token',
                username,
                token,
                authentication,
                timestamp,
              }, err => {
                if (!err) {
                  cb(null, {
                    token,
                    authentication,
                  });
                } else {
                  cb(err);
                }
              });
            } else {
              cb(err);
            }
          });
        };

        a.app.post('/hub/login', bodyParser.json(), (req, res, next) => {
          const {body: j} = req;

          if (typeof j === 'object' && j !== null) {
            if (typeof j.username === 'string' && typeof j.password === 'string') {
              const {username, password} = j;

              userDb.findOne({
                type: 'user',
                username,
              }, (err, user) => {
                if (!err) {
                  if (user) {
                    const {hash, equipment, inventory, plan} = user;

                    passwordHash(password).verifyAgainst(hash, (err, ok) => {
                      if (!err) {
                        if (ok) {
                          _getNewToken(username, (err, {token, authentication}) => {
                            res.json({
                              username,
                              equipment,
                              inventory,
                              plan,
                              token,
                              authentication,
                            });
                          });
                        } else {
                          res.status(401);
                          res.send();
                        }
                      } else {
                        res.status(401);
                        res.send();
                      }
                    });
                  } else {
                    passwordHash(password).hash((err, hash) => {
                      const equipment = DEFAULT_EQUIPMENT;
                      const inventory = DEFAULT_INVENTORY;
                      const plan = null;

                      userDb.insert({
                        type: 'user',
                        username,
                        hash,
                        equipment,
                        inventory,
                        plan,
                      }, err => {
                        if (!err) {
                          _getNewToken(username, (err, {token, authentication}) => {
                            res.json({
                              username,
                              equipment,
                              inventory,
                              plan,
                              token,
                              authentication,
                            });
                          });
                        } else {
                          res.status(500);
                          res.send(err.stack);
                        }
                      });
                    });
                  }
                } else {
                  cb(err);
                }
              });
            } else if (typeof j.token === 'string') {
              const {token} = j;

              userDb.findOne({
                type: 'token',
                token,
              }, (err, t) => {
                if (!err) {
                  if (t) {
                    const {username, token, authentication} = t;

                    userDb.findOne({
                      type: 'user',
                      username,
                    }, (err, u) => {
                      if (!err) {
                        if (u) {
                          const {equipment, inventory, plan} = u;

                          res.json({
                            username,
                            equipment,
                            inventory,
                            plan,
                            token,
                            authentication,
                          });
                        } else {
                          res.json(null);
                        }
                      } else {
                        res.status(500);
                        res.send();
                      }
                    });
                  } else {
                    res.json(null);
                  }
                } else {
                  res.status(500);
                  res.send();
                }
              });
            } else {
              res.status(400);
              res.send();
            }
          } else {
            res.status(400);
            res.send();
          }
        });

        a.app.post('/hub/auth', bodyParser.json(), (req, res, next) => {
          const {body: j} = req;

          if (typeof j === 'object' && j !== null && typeof j.authentication === 'string') {
            const {authentication} = j;

            userDb.findOne({
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
            url: hubUrl,
          });
        });
        a.app.post('/hub/servers/announce', _filterIsHubHostname, bodyParser.json(), (req, res, next) => {
          const {body: j} = req;

          if (
            typeof j == 'object' && j !== null &&
            typeof j.username === 'string' &&
            typeof j.worldname === 'string' &&
            typeof j.url === 'string' &&
            Array.isArray(j.users) && j.users.every(user => typeof user === 'string') &&
            typeof j.ranked === 'boolean'
          ) {
            const {username, worldname, url, users, ranked} = j;

            const server = {
              username,
              worldname,
              url,
              users,
              ranked,
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

      /* const _listenStripe = () => new Promise((accept, reject) => {
        const {dirname, dataDirectory} = a;

        a.app.get('/stripe/publishableKey.json', (req, res, next) => {
          res.json(stripePublishableKey);
        });

        a.app.post('/hub/signUp', bodyParser.json(), (req, res, next) => {
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
        // _listenStripe(),
      ])
      .then(() => {});
    });
};

module.exports = {
  listen,
};

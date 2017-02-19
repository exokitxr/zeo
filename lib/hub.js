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

const IMAGE_NAME = 'zeo-base';
const EXTRA_MOUNTS = [
  '/usr/lib',
];

const SERVER_EXPIRY_INTERVAL = 60 * 1000;

const DEFAULT_MATRIX = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const DEFAULT_INVENTORY = (() => {
  const numInventoryItems = 4;
  const result = Array(numInventoryItems);
  for (let i = 0; i < numInventoryItems; i++) {
    result[i] = null;
  }
  return result;
})();
const GOLD_PLAN_ID = 'gold';

const listen = (a, config) => new Promise((accept, reject) => {
  const {dirname, dataDirectory} = a;
  const {metadata: {hub: {url: hubUrl, enabled: hubEnabled}}} = config;

  const _filterIsHubHostname = (req, res, next) => {
    if (hubEnabled && req.get('Host') === hubUrl) {
      next();
    } else {
      next('route');
    }
  };

  /* const userDb = new nedb({
    filename: path.join(dirname, dataDirectory, 'db', 'users.db'),
  });
  userDb.loadDatabase(err => {
    if (!err) {
      const _listenHosts = () => new Promise((accept, reject) => {
        const hostsProxies = (() => {
          const result = Array(numContainers);
          for (let i = 0; i < numContainers; i++) {
            const worldName = 'world' + _pad(i, 2);

            const hostsProxy = httpProxy.createProxyServer({
              target: 'https://localhost:' + (startPort + i),
              headers: {
                'Host': worldName + '.zeo.sh',
              },
              ws: true,
              secure: false,
            });
            hostsProxy.worldName = worldName;
            hostsProxy.target = 'https://localhost:' + (startPort + i);

            result[i] = hostsProxy;
          }
          return result;
        })();
        const _getHostsProxy = hostHeader => {
          const match = hostHeader.match(/^(world[0-9]+)\.zeo\.sh(?::[0-9]+)?$/);

          if (match) {
            const worldId = match[1];
            const worldNumber = (() => {
              const match = worldId.match(/^world([0-9]+)$/);
              return match && parseInt(match[1], 10);
            })();

            if (worldNumber !== null && worldNumber >= 0 && worldNumber < numContainers) {
              return hostsProxies[worldNumber];
            } else {
              return null;
            }
          } else {
            return null;
          }
        };

        a.app.all('*', (req, res, next) => {
          const hostHeader = req.get('Host') || '';
          const hostsProxy = _getHostsProxy(hostHeader);

          if (hostsProxy) {
            hostsProxy.web(req, res, err => {
              console.warn(err);

              const {worldName} = hostsProxy;

              res.status(500);
              res.type('application/json');
              res.send(JSON.stringify({
                statusCode: 500,
                worldName,
                message: 'world is down',
              }, null, 2));
            });
          } else {
            next();
          }
        });
        a.server.addUpgradeHandler((req, socket, head) => {
          const hostHeader = req.headers['host'] || '';
          const hostsProxy = _getHostsProxy(hostHeader);

          if (hostsProxy) {
            hostsProxy.ws(req, socket, head, err => {
              console.warn(err);

              socket.destroy();
            });
            return false;
          } else {
            return true;
          }
        });

        accept();
      });

      const _listenUser = () => new Promise((accept, reject) => {
        const _getNewToken = (username, cb) => {
          crypto.randomBytes(32, (err, b) => {
            if (!err) {
              const token = b.toString('base64');
              const timestamp = Date.now();

              userDb.insert({
                type: 'token',
                username,
                token,
                timestamp,
              }, err => {
                if (!err) {
                  cb(null, token);
                } else {
                  cb(err);
                }
              });
            } else {
              cb(err);
            }
          });
        };

        a.app.options('/hub/login', (req, res, next) => {
          res.send();
        });
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
                    const {hash, world, matrix, inventory, plan} = user;

                    passwordHash(password).verifyAgainst(hash, (err, ok) => {
                      if (!err) {
                        if (ok) {
                          _getNewToken(username, (err, token) => {
                            res.json({
                              username,
                              world,
                              matrix,
                              inventory,
                              plan,
                              token,
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
                      const world = 'world' + _pad(Math.floor(Math.random() * numContainers), 2);
                      const matrix = DEFAULT_MATRIX;
                      const inventory = DEFAULT_INVENTORY;
                      const plan = null;

                      userDb.insert({
                        type: 'user',
                        username,
                        hash,
                        world,
                        matrix,
                        inventory,
                        plan,
                      }, err => {
                        if (!err) {
                          _getNewToken(username, (err, token) => {
                            res.json({
                              username,
                              world,
                              matrix,
                              inventory,
                              plan,
                              token,
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
                    const {username} = t;

                    userDb.findOne({
                      type: 'user',
                      username,
                    }, (err, u) => {
                      if (!err) {
                        if (u) {
                          const {world, matrix, inventory, plan} = u;

                          res.json({
                            username,
                            world,
                            matrix,
                            inventory,
                            plan,
                            token,
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

        accept();
      });
    } else {
      reject(err);
    }
  }); */
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

        a.app.post('/hub/userState', bodyParser.json(), (req, res, next) => {
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
        });

        accept();
      }); */

      Promise.all([
        // _listenUser(),
        _listenServers(),
        // _listenStripe(),
      ])
        .then(() => {
          accept();
        })
        .catch(reject);
  // });
});

const _pad = (n, width) => {
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
};

module.exports = {
  listen,
};

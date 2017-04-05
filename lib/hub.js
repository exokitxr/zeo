const path = require('path');
const fs = require('fs');

const mkdirp = require('mkdirp');
const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();
const dns = require('native-dns');
const LRU = require('lru-cache');
const ipAddress = require('ip-address');

const auth = require('./auth');

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
// const GOLD_PLAN_ID = 'gold';

const listen = (a, config, {key, userDb}) => {
  const {dirname, dataDirectory} = a;
  const {express, wss} = a.getCore();
  const {
    metadata: {
      home: {
        url: homeUrl,
      },
      hub: {
        url: hubUrl,
      },
      dns: {
        port: dnsPort,
        enabled: dnsEnabled,
      },
      my: {
        enabled: myEnabled,
      },
    },
  } = config;

  const homeHostname = (() => {
    if (homeUrl) {
      const match = homeUrl.match(/^(.+?):([0-9]+)$/);

      if (match) {
        const hostname = match[1];
        return hostname;
      } else {
        return null;
      }
    } else {
      return null;
    }
  })();

  const _filterIsHubHostname = (req, res, next) => {
    if (req.get('Host') === hubUrl) {
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

  const serversCache = new LRU({
    maxAge: SERVER_EXPIRY_INTERVAL,
  });
  const _ip6To4 = ip6 => new ipAddress.Address6(ip6).to4().address;
  const _ip4To6 = ip4 => '::ffff:' + ip4;

  const _listenServers = () => new Promise((accept, reject) => {
    class Server {
      constructor(worldname, url, users, running, address, timestamp) {
        this.worldname = worldname;
        this.url = url;
        this.users = users;
        this.running = running;
        this.address = address;
        this.timestamp = timestamp;
      }
    }

    const _getServers = () => serversCache.keys()
      .map(k => serversCache.get(k))
      .filter(v => v !== undefined)
      .sort((a, b) => b.timestamp - a.timestamp);

    a.app.get('/servers/server.json', _filterIsHubHostname, (req, res, next) => {
      res.json({
        type: 'hub',
        url: null,
      });
    });
    a.app.get('/servers/servers.json', _filterIsHubHostname, (req, res, next) => {
      res.json({
        servers: _getServers(),
      });
    });
    a.app.post('/servers/announce', _filterIsHubHostname, bodyParserJson, (req, res, next) => {
      const {body: j} = req;

      const _isValidServerUrl = url => {
        const match = url.match(/^(.+?)\.(.+?):([0-9]+)$/);

        if (match) {
          const baseHostname = match[2];
          return baseHostname === homeHostname;
        } else {
          return false;
        }
      };

      if (
        typeof j == 'object' && j !== null &&
        typeof j.worldname === 'string' &&
        typeof j.url === 'string' && _isValidServerUrl(j.url) &&
        Array.isArray(j.users) && j.users.every(user => typeof user === 'string')
      ) {
        const address = (() => {
          const {remoteAddress, remoteFamily} = req.connection;

          if (remoteFamily === 'IPv4') {
            return remoteAddress;
          } else if (remoteFamily === 'IPv6') {
            return _ip6To4(remoteAddress);
          } else {
            return null;
          }
        })();

        if (address) {
          const {worldname, url, users} = j;
          const running = true;
          const timestamp = Date.now();

          const server = new Server(worldname, url, users, running, address, timestamp);
          serversCache.set(url, server);

          res.send();

          console.log('server announce', {worldname, url, users});
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

    function serveEquipmentGet(req, res, next) { // XXX rethink these
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

  const _listenDns = () => new Promise((accept, reject) => {
    if (dnsEnabled) {
      const homeAnswers = {
        A: dns.A({
          name: homeHostname,
          address: '127.0.0.1',
          ttl: 3600,
        }),
        AAAA: dns.AAAA({
          name: homeHostname,
          address: '::1',
          ttl: 3600,
        }),
      };

      const dnsServer = dns.createServer();
      dnsServer.on('request', (req, res) => {
        const question = req.question[0];

        if (question.type === dns.consts.NAME_TO_QTYPE.A || question.type === dns.consts.NAME_TO_QTYPE.AAAA) {
          const {name: hostname} = question;

          if (hostname === homeHostname) {
            if (question.type === dns.consts.NAME_TO_QTYPE.A) {
              res.answer.push(homeAnswers.A);
            } else if (question.type === dns.consts.NAME_TO_QTYPE.AAAA) {
              res.answer.push(homeAnswers.AAAA);
            }
          } else {
            const server = (() => {
              let result = null;

              serversCache.forEach((server, url) => {
                if (result === null) {
                  const match = url.match(/^([^:]+)/);
                  const serverHostname = match[1];

                  if (serverHostname === hostname) {
                    result = server;
                  }
                }
              });

              return result;
            })();

            if (server) {
              const {address} = server;

              if (question.type === dns.consts.NAME_TO_QTYPE.A) {
                res.answer.push(dns.A({
                  name: hostname,
                  address: address,
                  ttl: 0,
                }));
              } else if (question.type === dns.consts.NAME_TO_QTYPE.AAAA) {
                res.answer.push(dns.AAAA({
                  name: hostname,
                  address: _ip4To6(address),
                  ttl: 0,
                }));
              }
            }
          }
        }

        res.send();
      });
      dnsServer.on('error', (err, buff, req, res) => {
        console.log(err.stack);
      });
      dnsServer.serve(dnsPort);
    }

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
    _listenServers(),
    _listenWorld(),
    _listenDns(),
    // _listenStripe(),
  ])
  .then(() => {});
};

module.exports = {
  listen,
};

const path = require('path');
const fs = require('fs');
const child_process = require('child_process');

const mkdirp = require('mkdirp');
const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();
const dns = require('native-dns');
const LRU = require('lru-cache');
const psNode = require('ps-node');
const fetch = require('node-fetch');
const portastic = require('portastic');
const passwordHash = require('password-hash-and-salt');
const MultiMutex = require('multimutex');

const auth = require('./auth');

const _resolvePath = (file, directory) => path.normalize(/^\//.test(file) ? file : path.join(directory, file))
const localIndexFilePath = _resolvePath(process.argv[1], process.cwd());

const SERVER_EXPIRY_INTERVAL = 60 * 1000;
const SERVER_START_PORT = 7777;
const SERVER_END_PORT = 7777 + 1000;
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
  const {express, wss} = a.getCore();
  const {
    metadata: {
      site: {
        url: siteUrl,
      },
      home: {
        url: homeUrl,
      },
      hub: {
        url: hubUrl,
      },
      dns: {
        url: dnsUrl,
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

    const serverIconMutex = new MultiMutex();
    const serverCubemapMutex = new MultiMutex();

    class Server {
      constructor(worldname, url, users, running, address, addressFamily, timestamp) {
        this.worldname = worldname;
        this.url = url;
        this.users = users;
        this.running = running;
        this.address = address;
        this.addressFamily = addressFamily;
        this.timestamp = timestamp;
      }
    }

    const _getServers = () => serversCache.keys()
      .map(k => serversCache.get(k))
      .filter(v => v !== undefined)
      .sort((a, b) => b.timestamp - a.timestamp);

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
      a.app.get('/servers/server.json', _filterIsHubHostname, (req, res, next) => {
        res.json({
          type: 'hub',
          url: null,
        });
      });
      a.app.get('/servers/servers.json', _filterIsHubHostname, (req, res, next) => {
        const origin = req.get('Origin');
        if (origin === ('https://' + siteUrl) || origin === ('https://' + homeUrl)) {
          res.set('Access-Control-Allow-Origin', origin);
        }

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
          const {worldname, url, users} = j;
          const running = true;
          const {remoteAddress: address, remoteFamily: addressFamily} = req.connection;
          const timestamp = Date.now();

          const server = new Server(worldname, url, running, users, address, addressFamily, timestamp);
          serversCache.set(url, server);

          _broadcast('server', [url, server]);

          res.send();
        } else {
          res.status(400);
          res.send();
        }
      });
    };

    const _listenLocalRequest = () => {
      if (myEnabled) {
        const serversDirectory = path.join(dirname, dataDirectory, 'hub', 'servers');

        const _findArg = (args, name) => {
          for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            const match = arg.match(/^(.+?)(?:=(.+?))?$/);

            if (match && match[1] === name) {
              return match[2] || null;
            }
          }
          return null;
        };
        const _requestServerProcesses = () => new Promise((accept, reject) => {
          psNode.lookup({
            command: 'node',
            psargs: 'aux',
          }, (err, processes) => {
            if (!err) {
              accept(processes);
            } else {
              reject(err);
            }
          });
        })
          .then(processes => Promise.all(processes.map(process => {
            const pid = parseInt(process.pid, 10);

            return Promise.all([
              new Promise((accept, reject) => {
                fs.readlink(path.join('/', 'proc', String(pid), 'cwd'), (err, cwdPath) => {
                  if (!err) {
                    accept(cwdPath);
                  } else {
                    reject(err);
                  }
                });
              }),
              new Promise((accept, reject) => {
                fs.readFile(path.join('/', 'proc', String(pid), 'cmdline'), 'utf8', (err, cmdlineString) => {
                  if (!err) {
                    const cmdline = cmdlineString.split('\0');

                    accept(cmdline);
                  } else {
                    reject(err);
                  }
                });
              }),
            ])
              .then(([
                cwdPath,
                cmdline,
              ]) => ({
                pid,
                cwdPath,
                cmdline,
              }));
          })))
          .then(processes =>
            processes.map(process => {
              const {pid, cwdPath, cmdline} = process;
              const binPath = cmdline[1];
              const args = cmdline.slice(1);

              const processIndexFilePath = _resolvePath(binPath, cwdPath);
              const worldname = _findArg(args, 'worldname');
              const serverHost = _findArg(args, 'serverHost');
              const port = _findArg(args, 'port');

              if (processIndexFilePath === localIndexFilePath && worldname && serverHost && port) {
                const url = serverHost + ':' + port;

                return {
                  worldname,
                  serverHost,
                  port,
                  url,
                  pid,
                };
              } else {
                return null;
              }
            }).filter(process => process !== null)
          );
        a.app.get('/servers/local.json', _filterIsHubHostname, (req, res, next) => {
          Promise.all([
            new Promise((accept, reject) => {
              fs.readdir(serversDirectory, (err, files) => {
                if (!err) {
                  accept(files);
                } else if (err.code === 'ENOENT') {
                  accept([]);
                } else {
                  reject(err);
                }
              });
            }),
            _requestServerProcesses(),
          ])
            .then(([
              files,
              processes
            ]) => {
              const serverSpecs = files.map(serverName => {
                const process = processes.find(process => {
                  const {serverHost} = process;

                  const match = serverHost.match(/^(.+?)\.(.+?)$/);
                  if (match) {
                    const processServerName = match[1];
                    const processBaseName = match[2];

                    return processServerName === serverName && processBaseName === homeHostname;
                  } else {
                    return false;
                  }
                });
                const worldname = serverName;
                const url = process ? process.url : null;
                const running = Boolean(process);
                const address = '127.0.0.1';
                const addressFamily = 'IPv4';
                const timestamp = Date.now();

                return {
                  worldname: worldname,
                  url: url,
                  running: running,
                  address: address,
                  addressFamily: addressFamily,
                  timestamp: timestamp,
                };
              });

              return Promise.all(serverSpecs.map(serverSpec => {
                const {worldname, url, running, address, addressFamily} = serverSpec;

                if (running) {
                  const {url} = serverSpec;

                  return fetch('https://' + url + '/archae/multiplayer/statuses.json')
                    .then(res => res.json()
                      .then(({statuses}) => statuses.map(({status: {username}}) => username))
                    )
                    .catch(err => {
                      console.warn(err);

                      return Promise.resolve([]);
                    })
                    .then(users => ({
                      worldname: worldname,
                      url: url,
                      running: running,
                      address,
                      addressFamily,
                      users: users,
                    }));
                } else {
                  return Promise.resolve({
                    worldname: worldname,
                    url: url,
                    running: running,
                    address,
                    addressFamily,
                    users: [],
                  });
                }
              }));
            })
            .then(servers => {
              res.json({
                servers,
              });
            })
            .catch(err => {
              res.status(500);
              res.send(err.stack);
            });
        });

        const _startServer = worldname => portastic.find({
          min: SERVER_START_PORT,
          max: SERVER_END_PORT,
        })
          .then(ports => new Promise((accept, reject) => {
            if (ports.length > 0) {
              const serverDirectory = path.join(serversDirectory, worldname);

              mkdirp(serverDirectory, err => {
                if (!err) {
                  const port = ports[0];
                  const serverDataDirectory = path.join(serverDirectory, 'data');
                  const serverCryptoDirectory = path.join(serverDirectory, 'crypto');
                  const serverInstallDirectory = path.join(serverDirectory, 'install');
                  const serverHost = worldname + '.' + homeHostname;

                  const serverProcess = child_process.spawn('node', [
                    localIndexFilePath,
                    'server',
                    'port=' + port,
                    'dataDirectory=' + serverDataDirectory,
                    'cryptoDirectory=' + serverCryptoDirectory,
                    'installDirectory=' + serverInstallDirectory,
                    'serverHost=' + serverHost,
                    'worldname=' + worldname,
                    'hubUrl=' + hubUrl,
                  ], {
                    detached: true,
                    stdio: 'ignore',
                  });
                  const {pid} = serverProcess;

                  console.log('started server ', {worldname, pid});

                  accept(true);
                } else {
                  reject(err);
                }
              });
            } else {
              reject(new Error('No ports available in range ' + JSON.stringify(SERVER_START_PORT)));
            }
          }));
        const _stopServer = worldname => _requestServerProcesses()
          .then(serverProcesses => new Promise((accept, reject) => {
            const serverProcess = serverProcesses.find(serverProcess => serverProcess.worldname === worldname);

            if (serverProcess) {
              const {pid} = serverProcess;
              process.kill(pid);

              console.log('killed server', {worldname, pid});

              accept(true);
            } else {
              accept(false);
            }
          }));
        a.app.post('/servers/create', _filterIsHubHostname, bodyParserJson, (req, res, next) => {
          const {body: data} = req;

          const _invalid = () => {
            res.status(400);
            res.send();
          };
          const _error = err => {
            res.status(500);
            res.send(err.stack);
          };

          if (typeof data === 'object' && data !== null) {
            const {worldname} = data;

            if (typeof worldname === 'string') {
              _startServer(worldname)
                .then(() => {
                  res.send();
                })
                .catch(err => {
                  _error(err);
                });
            } else {
              _invalid();
            }
          } else {
            _invalid();
          }
        });
        a.app.post('/servers/start', _filterIsHubHostname, bodyParserJson, (req, res, next) => {
          const {body: data} = req;

          const _invalid = () => {
            res.status(400);
            res.send();
          };
          const _error = err => {
            res.status(500);
            res.send(err.stack);
          };

          if (typeof data === 'object' && data !== null) {
            const {worldname} = data;

            if (typeof worldname === 'string') {
              _startServer(worldname)
                .then(() => {
                  res.send();
                })
                .catch(err => {
                  _error(err);
                });
            } else {
              _invalid();
            }
          } else {
            _invalid();
          }
        });
        a.app.post('/servers/stop', _filterIsHubHostname, bodyParserJson, (req, res, next) => {
          const {body: data} = req;

          const _invalid = () => {
            res.status(400);
            res.send();
          };
          const _error = err => {
            res.status(500);
            res.send(err.stack);
          };

          if (typeof data === 'object' && data !== null) {
            const {worldname} = data;

            if (typeof worldname === 'string') {
              _stopServer(worldname)
                .then(ok => {
                  if (ok) {
                    res.send();
                  } else {
                    res.status(404);
                    res.send();
                  }
                })
                .catch(err => {
                  _error(err);
                });
            } else {
              _invalid();
            }
          } else {
            _invalid();
          }
        });
        a.app.post('/servers/proxyLogin', _filterIsHubHostname, bodyParserJson, (req, res, next) => {
          const {body: data} = req;

          const _invalid = () => {
            res.status(400);
            res.send();
          };
          const _error = err => {
            res.status(500);
            res.send(err.stack);
          };

          if (typeof data === 'object' && data !== null) {
            const {worldname} = data;

            if (typeof worldname === 'string') {
              _requestServerProcesses()
                .then(processes => {
                  const process = processes.find(process => process.worldname === worldname);

                  if (process) {
                    const {url} = process;

                    fetch('https://' + url + '/server/proxyLogin', {
                      method: 'POST',
                    })
                      .then(proxyRes => proxyRes.json()
                        .then(({token}) => {
                          res.json({
                            token,
                          });
                        })
                      )
                      .catch(err => {
                        _error(err);
                      });
                  } else {
                    res.status(404);
                    res.send();
                  }
                })
                .catch(err => {
                  _error(err);
                });
            } else {
              _invalid();
            }
          } else {
            _invalid();
          }
        });
      }
    };

    _listenServersRequest();
    _listenLocalRequest();

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
      const dnsServer = dns.createServer();
      dnsServer.on('request', (req, res) => {
        const hostname = req.question[0].name;

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

          return server;
        })();

        if (server) {
          const {worldname} = server;
          const {address, addressFamily} = address;

          if (addressFamily === 'IPv4') {
            res.answer.push(dns.A({
              name: hostname,
              address: address,
              ttl: 0,
            }));
          } else if (addressFamily === 'IPv6') {
            res.answer.push(dns.AAAA({
              name: hostname,
              address: address,
              ttl: 0,
            }));
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

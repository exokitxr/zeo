const path = require('path');
const fs = require('fs-extra');
const stream = require('stream');
const crypto = require('crypto');
const child_process = require('child_process');

const bodyParser = require('body-parser');
const httpProxy = require('http-proxy');
const passwordHash = require('password-hash-and-salt');
const nedb = require('nedb');
const Docker = require('dockerode');
const Stripe = require('stripe');

const configJs = require('../data/config/config');

const docker = new Docker();
const {stripe: {secretKey: stripeSecretKey, publishableKey: stripePublishableKey}} = configJs;
const stripe = Stripe(stripeSecretKey);

const IMAGE_NAME = 'zeo-base';
const EXTRA_MOUNTS = [
  '/usr/lib',
];

const DEFAULT_MATRIX = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const GOLD_PLAN_ID = 'gold';

const check = a => new Promise((accept, reject) => {
  docker.getImage(IMAGE_NAME).inspect((err, info) => {
    if (!err) {
      accept();
    } else {
      if (err.statusCode === 404) {
        const newErr = new Error('could not find ' + JSON.stringify(IMAGE_NAME) + ' hub image; build it with scripts/build-hub-image.sh');
        reject(err);
      } else {
        const newErr = new Error('could not connect to docker: ' + JSON.stringify(err));
        reject(newErr);
      }
    }
  });
});

const start = (a, config) => {
  const {dirname, dataDirectory} = a;
  const {hostname, port, metadata: {hub: {numContainers, startPort}}} = config;

  const cryptoDirectoryPath = path.join(dirname, 'data', 'crypto');
  const installedDirectoryPath = path.join(dirname, 'installed');
  const modulesDirectoryPath = path.join(dirname, 'data', 'modules');

  const _getContainerDirectoryPath = index => path.join(dirname, dataDirectory, 'containers', 'container-' + _pad(index, 2));
  const _ensureDirectory = directoryPath => new Promise((accept, reject) => {
    fs.mkdirp(directoryPath, err => {
      if (!err) {
        accept();
      } else {
        reject(err);
      }
    });
  });
  const _fileExists = filePath => new Promise((accept, reject) => {
    fs.exists(filePath, exists => {
      accept(exists);
    });
  });
  const _rsync = (src, dst, cb) => {
    const rsyncProcess = child_process.spawn('rsync', ['-a', src + '/', dst]); // trailing slash forces rsync copy mode
    rsyncProcess.on('close', code => {
      if (code === 0) {
        cb();
      } else {
        const err = new Error('rsync existed with non-zero exit code: ' + code);
        cb(err);
      }
    });
  };
  const _ensureDirectories = () => {
    const _ensureLocalDirectories = () => _ensureDirectory(cryptoDirectoryPath);
    const _ensureContainersDirectories = () => {
      const _ensureContainerDirectories = index => {
        const containerDirectoryPath = _getContainerDirectoryPath(index);
        const containerDataDirectoryPath = path.join(containerDirectoryPath, 'data');
        const containerInstalledDirectoryPath = path.join(containerDirectoryPath, 'installed');
        const containerModulesDirectoryPath = path.join(containerDataDirectoryPath,'modules');

        const _ensureContainerDataDirectory = () => _ensureDirectory(containerDataDirectoryPath);
        const _copyContainerInstalledDirectory = () => Promise.all([
          _fileExists(installedDirectoryPath),
          _fileExists(containerInstalledDirectoryPath),
        ])
          .then(([
            installedExists,
            containerInstalledExists,
          ]) => new Promise((accept, reject) => {
            if (installedExists && !containerInstalledExists) {
              console.log('copying files for container', index);

              _rsync(installedDirectoryPath, containerInstalledDirectoryPath, err => {
                if (!err) {
                  accept();
                } else {
                  reject(err);
                }
              });
            } else {
              accept();
            }
          }));
        const _copyContainerModulesDirectory = () => Promise.all([
          _fileExists(modulesDirectoryPath),
          _fileExists(containerModulesDirectoryPath),
        ])
          .then(([
            modulesExists,
            containerModulesExists,
          ]) => new Promise((accept, reject) => {
            if (modulesExists && !containerModulesExists) {
              _rsync(modulesDirectoryPath, containerModulesDirectoryPath, err => {
                if (!err) {
                  accept();
                } else {
                  reject(err);
                }
              });
            } else {
              accept();
            }
          }));

        return _ensureContainerDataDirectory()
          .then(() =>
            Promise.all([
              _copyContainerInstalledDirectory(),
              _copyContainerModulesDirectory(),
            ])
              .then(() => {})
          );
      };

      const promises = [];
      for (let i = 0; i < numContainers; i++) {
        promises.push(_ensureContainerDirectories(i));
      }
      return Promise.all(promises);
    };

    return _ensureLocalDirectories()
      .then(() => _ensureContainersDirectories());
  };
  const _startContainer = index =>  new Promise((accept, reject) => {
    const containerDirectoryPath = _getContainerDirectoryPath(index);
    const containerDataDirectoryPath = path.join(containerDirectoryPath, 'data');
    const containerInstalledDirectoryPath = path.join(containerDirectoryPath, 'installed');

    const hub = docker.run(IMAGE_NAME, [
      '--',
      'app',
      'host=world' + _pad(index, 2) + '.zeo.sh',
      'hubUrl=' + hostname,
    ], null, {
      Tty: false,
      ExposedPorts: {
        [port + "/tcp"]: {},
      },
      HostConfig: {
        PortBindings: {
          [port + "/tcp"]: [
            {
              "HostIp": "",
              "HostPort": String(startPort + index),
            },
          ],
        },
        Binds: [
          dirname + ":/root/zeo",
          containerDataDirectoryPath + ":/root/zeo/data",
          containerInstalledDirectoryPath + ":/root/zeo/installed",
          cryptoDirectoryPath + ":/root/zeo/data/crypto",
        ].concat(EXTRA_MOUNTS.map(mount => mount + ':' + mount)),
      },
    }, (err, data, container) => {
      if (!err) {
        console.log('started', container.id);

        accept();
      } else {
        reject(err);
      }
    });
    hub.on('container', c => {
      c.attach = (spec, cb) => {
        process.nextTick(() => {
          const s = new stream.PassThrough();
          s.end();
          cb(null, s);
        });
      };
      c.wait = cb => {
        process.nextTick(() => {
          const d = {};
          cb(null, d);
        });
      };
    });
  });

  return _ensureDirectories()
    .then(() => {
      const startPromises = [];
      for (let i = 0; i < numContainers; i++) {
        startPromises.push(_startContainer(i));
      }
      return Promise.all(startPromises);
    });
};

const stop = a => new Promise((accept, reject) => {
  docker.listContainers({
    all: true,
  }, (err, containers) => {
    if (!err) {
      const hubContainers = containers.filter(({Image}) => Image === IMAGE_NAME);

      Promise.all(hubContainers.map(hubContainer => new Promise((accept, reject) => {
        console.log('stopping', hubContainer.Id);

        const container = docker.getContainer(hubContainer.Id);
        container.stop(err => {
          if (!err || err.statusCode === 304) { // not modified
            console.log('removing', hubContainer.Id);

            container.remove(err => {
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
      })))
        .then(() => {
          accept();
        })
        .catch(err => {
          reject(err);
        });
    } else {
      reject(err);
    }
  });
});

const listen = (a, config) => new Promise((accept, reject) => {
  const {dirname, dataDirectory} = a;
  const {metadata: {hub: {numContainers, startPort}}} = config;

  const userDb = new nedb({
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

        const _cors = (req, res) => {
          res.set('Access-Control-Allow-Origin', '*');
          res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
          res.set('Access-Control-Allow-Headers', 'Content-Type');
          res.set('Access-Control-Allow-Credentials', 'true');
        };
        a.app.options('/hub/login', (req, res, next) => {
          _cors(req, res);
          res.send();
        });
        a.app.post('/hub/login', bodyParser.json(), (req, res, next) => {
          const {body: j} = req;

          _cors(req, res);

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
                      const inventory = [];
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
      const _listenStripe = () => new Promise((accept, reject) => {
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
              typeof item.attributes === 'object' && item.attributes !== null &&
              Array.isArray(item.matrix) && item.matrix.length === 16
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
      });

      Promise.all([
        _listenHosts(),
        _listenUser(),
        _listenStripe(),
      ])
        .then(() => {
          accept()
        })
        .catch(reject);
    } else {
      reject(err);
    }
  });
});

const _pad = (n, width) => {
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
};

module.exports = {
  check,
  start,
  stop,
  listen,
};

const path = require('path');
const fs = require('fs-extra');
const stream = require('stream');
const crypto = require('crypto');
const child_process = require('child_process');

const bodyParser = require('body-parser');
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
  const {port, hub: {numContainers, startPort}} = config;

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
        const err = new Error('rsync existed with non-zeo exit code: ' + code);
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

    const hub = docker.run(IMAGE_NAME, ['--', '--site'], null, {
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
  docker.listContainers((err, containers) => {
    if (!err) {
      const hubContainers = containers.filter(({Image}) => Image === IMAGE_NAME);

      Promise.all(hubContainers.map(hubContainer => new Promise((accept, reject) => {
        console.log('stopping ', hubContainer.Id);

        docker.getContainer(hubContainer.Id).stop(err => {
          if (!err) {
            accept();
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

const listen = a => new Promise((accept, reject) => {
  const {dirname, dataDirectory} = a;

  const userDb = new nedb({
    filename: path.join(dirname, dataDirectory, 'db', 'users.db'),
  });
  userDb.loadDatabase(err => {
    if (!err) {
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

        a.app.post('/login', bodyParser.json(), (req, res, next) => {
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
                    const {hash} = user;

                    passwordHash(password).verifyAgainst(hash, (err, ok) => {
                      if (!err) {
                        if (ok) {
                          _getNewToken(username, (err, token) => {
                            res.json({
                              username,
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
                      userDb.insert({
                        type: 'user',
                        username,
                        hash,
                        plan: null,
                      }, err => {
                        if (!err) {
                          _getNewToken(username, (err, token) => {
                            res.json({
                              username,
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
                  const {username} = t;
                  
                  res.json({
                    username,
                    token,
                  });
                } else {
                  res.status(500);
                  res.send(err.stack);
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

        a.app.post('/signUp', bodyParser.json(), (req, res, next) => {
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
                          plan: GOLD_PLAN_ID,
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
      });

      Promise.all([
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

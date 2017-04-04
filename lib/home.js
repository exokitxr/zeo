const path = require('path');
const fs = require('fs');
const child_process = require('child_process');

const mkdirp = require('mkdirp');
const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();
const fetch = require('node-fetch');
const portastic = require('portastic');

const _resolvePath = (file, directory) => path.normalize(/^\//.test(file) ? file : path.join(directory, file))
const localIndexFilePath = _resolvePath(process.argv[1], process.cwd());

const SERVER_START_PORT = 7777;
const SERVER_END_PORT = 7777 + 1000;

const listen = (a, config, {key, userDb}) => {
  const {dirname, dataDirectory} = a;
  const {
    metadata: {
      home: {
        url: homeUrl,
      },
      hub: {
        url: hubUrl,
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

  const _filterIsHomeHostname = (req, res, next) => {
    if (req.get('Host') === homeUrl) {
      next();
    } else {
      next('route');
    }
  };

  const _listenPublic = () => new Promise((accept, reject) => {
    a.app.get('/', _filterIsHomeHostname, (req, res, next) => {
      req.url = '/vr.html';

      a.app(req, res, next);
    });

    accept();
  });

  const _listenServers = () => new Promise((accept, reject) => {
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
    const _requestProcesses = () => new Promise((accept, reject) => {
      fs.readdir('/proc', (err, files) => {
        if (!err) {
          Promise.all(files.map(file => new Promise((accept, reject) => {
            if (/^[0-9]+$/.test(file)) {
              Promise.all([
                new Promise((accept, reject) => {
                  fs.readlink(path.join('/', 'proc', file, 'cwd'), (err, cwd) => {
                    if (!err) {
                      accept(cwd);
                    } else {
                      accept(null);
                    }
                  });
                }),
                new Promise((accept, reject) => {
                  fs.readFile(path.join('/', 'proc', file, 'cmdline'), 'utf8', (err, cmdlineString) => {
                    if (!err) {
                      accept(cmdlineString);
                    } else {
                      accept(null);
                    }
                  });
                }),
              ])
                .then(([
                  cwd,
                  cmdlineString,
                ]) => {
                  if (cwd !== null && cmdlineString !== null) {
                    const pid = parseInt(file, 10);
                    const cmdline = cmdlineString.split('\0');

                    accept({
                      pid,
                      cmdline,
                      cwd,
                    });
                  } else {
                    accept(null);
                  }
                })
                .catch(reject);
            } else {
              accept(null);
            }
          })))
            .then(processes => processes.filter(process => process !== null))
            .then(accept)
            .catch(reject);
        } else {
          reject(err);
        }
      });
    });
    const _requestServerProcesses = () => _requestProcesses()
      .then(processes => processes.filter(process => process.cmdline[0] === 'node'))
      .then(processes =>
        processes.map(process => {
          const {pid, cwd, cmdline} = process;
          const indexFilePath = cmdline[1];
          const args = cmdline.slice(2);

          const processIndexFilePath = _resolvePath(indexFilePath, cwd);
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
      const _requestServerProxyLogin = serverUrl => fetch('https://' + serverUrl + '/server/proxyLogin', {
        method: 'POST',
      })
        .then(res => res.json()
          .then(({token}) => token)
        );
      const _requestServerUsers = serverUrl => fetch('https://' + serverUrl + '/archae/multiplayer/statuses.json')
        .then(res => res.json()
          .then(({statuses}) => statuses.map(({status: {username}}) => username))
        );

   a.app.get('/servers/local.json', _filterIsHomeHostname, (req, res, next) => {
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

              return Promise.all([
                _requestServerUsers(url)
                  .catch(err => {
                    console.warn(err);

                    return Promise.resolve([]);
                  }),
                _requestServerProxyLogin(url)
                  .catch(err => {
                    console.warn(err);

                    return Promise.resolve(null);
                  }),
              ])
                .then(([
                  users,
                  token,
                ])=> ({
                  worldname: worldname,
                  url: url,
                  running: running,
                  address,
                  addressFamily,
                  users: users,
                  token: token,
                }));
              } else {
                return Promise.resolve({
                  worldname: worldname,
                  url: url,
                  running: running,
                  address,
                  addressFamily,
                  users: [],
                  token: null,
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
    a.app.post('/servers/proxyLogin', _filterIsHomeHostname, bodyParserJson, (req, res, next) => {
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

                _requestServerProxyLogin(url)
                  .then(token => {
                    res.json({
                      token,
                    });
                  })
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
    a.app.post('/servers/create', _filterIsHomeHostname, bodyParserJson, (req, res, next) => {
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
    a.app.post('/servers/start', _filterIsHomeHostname, bodyParserJson, (req, res, next) => {
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
    a.app.post('/servers/stop', _filterIsHomeHostname, bodyParserJson, (req, res, next) => {
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

    accept();
  });

  return Promise.all([
    _listenPublic(),
    _listenServers(),
  ])
  .then(() => {});
};

module.exports = {
  listen,
};

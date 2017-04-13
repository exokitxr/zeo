const path = require('path');
const fs = require('fs');
const child_process = require('child_process');

const mkdirp = require('mkdirp');
const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();
const fetch = require('node-fetch');
const httpProxy = require('http-proxy');
const portastic = require('portastic');

const _resolvePath = (file, directory) => path.normalize(/^\//.test(file) ? file : path.join(directory, file))
const localIndexFilePath = _resolvePath(process.argv[1], process.cwd());

const SERVER_START_PORT = 7777;
const SERVER_END_PORT = 7777 + 1000;

const listen = (a, config, {key, userDb}) => {
  const {dirname, dataDirectory, secure} = a;
  const {
    metadata: {
      config: {
        dataDirectorySrc,
        cryptoDirectorySrc,
        installDirectorySrc,
      },
      home: {
        url: homeUrl,
      },
      hub: {
        url: hubUrl,
      },
    },
  } = config;

  const protocolString = !secure ? 'http' : 'https';

  const _listenPublic = () => new Promise((accept, reject) => {
    a.app.get('/', (req, res, next) => {
      req.url = '/vr.html';

      a.app(req, res, next);
    });

    accept();
  });

  const serversDirectory = path.join(dataDirectory, 'hub', 'servers');
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
        const port = _findArg(args, 'port');

        if (processIndexFilePath === localIndexFilePath && worldname && port) {
          const secure = _findArg(args, 'secure') === String(true);
          const protocolString = !secure ? 'http' : 'https';
          const url = protocolString + '://127.0.0.1' + ':' + port;

          return {
            worldname,
            port,
            secure,
            url,
            pid,
          };
        } else {
          return null;
        }
      }).filter(process => process !== null)
    );
  const _requestServerProcess = worldname => _requestServerProcesses()
    .then(serverProcesses => Promise.resolve(serverProcesses.find(serverProcess => serverProcess.worldname === worldname) || null));
  const _requestServerExists = worldname => new Promise((accept, reject) => {
    const serverDirectory = path.join(dirname, serversDirectory, worldname);

    fs.lstat(serverDirectory, err => {
      if (!err) {
        accept(true);
      } else if (err.code === 'ENOENT') {
        accept(false);
      } else {
        reject(err);
      }
    });
  });

  const _listenServers = () => new Promise((accept, reject) => {
    const _startServer = worldname => portastic.find({
      min: SERVER_START_PORT,
      max: SERVER_END_PORT,
    })
      .then(ports => new Promise((accept, reject) => {
        if (ports.length > 0) {
          const serverDirectory = path.join(serversDirectory, worldname);
          const serverLogsDirectory = path.join(serverDirectory, 'logs');

          mkdirp(serverLogsDirectory, err => {
            if (!err) {
              const port = ports[0];
              const serverDataDirectory = path.join(serverDirectory, 'data');
              const serverCryptoDirectory = path.join(serverDirectory, 'crypto');
              const serverInstallDirectory = path.join(serverDirectory, 'installed');
              const serverDataDirectorySrc = path.join(dirname, dataDirectorySrc);
              const serverCryptoDirectorySrc = path.join(dirname, cryptoDirectorySrc);
              const serverInstallDirectorySrc = path.join(dirname, installDirectorySrc);
              const serverLogFile = path.join(serverLogsDirectory, 'server.log');

              const serverProcess = child_process.spawn('bash', [
                '-c',
                [
                  'node',
                  _sanitizeShell(localIndexFilePath),
                  'server',
                  'port=' + _sanitizeShell(port),
                  'secure=' + _sanitizeShell(JSON.stringify(secure)),
                  'dataDirectory=' + _sanitizeShell(serverDataDirectory),
                  'cryptoDirectory=' + _sanitizeShell(serverCryptoDirectory),
                  'installDirectory=' + _sanitizeShell(serverInstallDirectory),
                  'dataDirectorySrc=' + _sanitizeShell(serverDataDirectorySrc),
                  'cryptoDirectorySrc=' + _sanitizeShell(serverCryptoDirectorySrc),
                  'installDirectorySrc=' + _sanitizeShell(serverInstallDirectorySrc),
                  'worldname=' + _sanitizeShell(worldname),
                  'hubUrl=' + _sanitizeShell(hubUrl),
                  '2>&1',
                  '>>' + _sanitizeShell(serverLogFile),
                ].join(' '),
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
      const _stopServer = worldname => _requestServerProcess(worldname)
        .then(serverProcess => {
          if (serverProcess) {
            const {pid} = serverProcess;
            process.kill(pid);

            console.log('killed server', {worldname, pid});

            return Promise.resolve(true);
          } else {
            return Promise.resolve(false);
          }
        });
      const _requestServerProxyLogin = serverUrl => {
        const match = serverUrl.match(/:([0-9]+)$/);

        if (match) {
          const portString = match[1];

          return fetch(`${protocolString}://127.0.0.1:${portString}/server/proxyLogin`, {
            method: 'POST',
          })
            .then(res => res.json()
              .then(({token}) => token)
            );
        } else {
          const err = new Error('invalid server url: ' + JSON.stringify(serverUrl));
          err.code = 'EURL';
          return Promise.reject(err);
        }
      };
      const _requestServerUsers = serverUrl => fetch(serverUrl + '/archae/multiplayer/statuses.json')
        .then(res => res.json()
          .then(({statuses}) => statuses.map(({status: {username}}) => username))
        );

   a.app.get('/home/servers/local.json', (req, res, next) => {
      Promise.all([
        new Promise((accept, reject) => {
          fs.readdir(path.join(dirname, serversDirectory), (err, files) => {
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
          const serverSpecs = files.map(worldname => {
            const process = processes.find(process => process.worldname === worldname);

            const url = process ? process.url : null;
            const protocol = process ? process.protocol : null;
            const port = process ? parseInt(process.port, 10) : null;
            const running = Boolean(process);
            const address = '127.0.0.1';
            const addressFamily = 'IPv4';
            const timestamp = Date.now();

            return {
              worldname: worldname,
              url: url,
              protocol: protocol,
              port: port,
              running: running,
              address: address,
              addressFamily: addressFamily,
              timestamp: timestamp,
            };
          });

          return Promise.all(serverSpecs.map(serverSpec => {
            const {worldname, url, protocol, port, running, address, addressFamily} = serverSpec;

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
                  protocol: protocol,
                  port: port,
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
                  protocol: protocol,
                  port: port,
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
    a.app.post('/home/servers/proxyLogin', bodyParserJson, (req, res, next) => {
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
    a.app.post('/home/servers/create', bodyParserJson, (req, res, next) => {
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

        if (worldname && typeof worldname === 'string') {
          _requestServerExists(worldname)
            .then(exists => {
              if (!exists) {
                _startServer(worldname)
                  .then(() => {
                    res.send();
                  })
                  .catch(_error);
              } else {
                const err = new Error('worldname already exists');
                err.code = 'EEXISTS';
                _error(err);
              }
            })
            .catch(_error);
        } else {
          _invalid();
        }
      } else {
        _invalid();
      }
    });
    a.app.post('/home/servers/start', bodyParserJson, (req, res, next) => {
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
    a.app.post('/home/servers/stop', bodyParserJson, (req, res, next) => {
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
  const _listenProxy = () => new Promise((accept, reject) => {
    const serversProxy = httpProxy.createProxyServer({
      ws: true,
      secure: false,
    });

    const _listenHttpProxy = () => {
      a.app.get(/^\/s\/([^\/]+)(.*)$/, (req, res, next) => {
        const worldname = req.params[0];
        const pathname = req.params[1];

        _requestServerProcess(worldname)
          .then(serverProcess => {
            if (serverProcess) {
              req.url = pathname || '/';

              const {url: serverUrl} = serverProcess;

              serversProxy.web(req, res, {
                target: serverUrl,
              });
            } else {
              res.status(404);
              res.send();
            }
          })
          .catch(err => {
            res.status(500);
            res.send(err.stack);
          });
      });
    };
    const _listenWsProxy = () => {
      a.once('listen', () => {
        const {wss} = a.getCore();

        wss.on('upgrade', e => {
          const {req, socket, head} = e;
          const {url} = req;

          let match;
          if (match = url.match(/^\/s\/([^\/]+)(.*)$/)) {
            const worldname = match[1];
            const pathname = match[2];

            _requestServerProcess(worldname)
              .then(serverProcess => {
                if (serverProcess) {
                  req.url = pathname || '/';

                  const {url: serverUrl} = serverProcess;

                  serversProxy.ws(req, socket, head, {
                    target: serverUrl,
                  });
                } else {
                  socket.destroy();
                }
              });

            e.stopImmediatePropagation();
          }
        });
      });
    };

    _listenHttpProxy();
    _listenWsProxy();

    accept();
  });

  return Promise.all([
    _listenPublic(),
    _listenServers(),
    _listenProxy(),
  ])
  .then(() => {});
};

const _sanitizeShell = s => `'${String(s).replace(/'/g, `'"'`)}'`;

module.exports = {
  listen,
};

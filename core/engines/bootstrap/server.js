const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

const publicIp = require('public-ip');

const SERVER_ANNOUNCE_INTERVAL = 30 * 1000;
const SERVER_ANNOUNCE_RETRY_INTERVAL = 2 * 1000;

class Bootstrap {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {app, wss, dirname, dataDirectory} = archae.getCore();
    const {
      metadata: {
        site: {
          url: siteUrl,
        },
        server: {
          url: serverUrl,
        },
      },
    } = archae;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/config',
    ])
      .then(([
        config,
      ]) => {
        if (live) {
          const _parseUrlSpec = url => {
            const match = url.match(/^(?:([^:]+):\/\/)([^:]+)(?::([0-9]*?))?$/);
            return match && {
              protocol: match[1],
              host: match[2],
              port: match[3] ? parseInt(match[3], 10) : null,
            };
          };
          const siteSpec = _parseUrlSpec(siteUrl);
          const serverSpec = _parseUrlSpec(serverUrl);

          const cleanups = [];
          this._cleanup = () => {
            for (let i = 0; i < cleanups.length; i++) {
              const cleanup = cleanups[i];
              cleanup();
            }
          };

          const connections = [];
          wss.on('connection', c => {
            const {url} = c.upgradeReq;

            let match;
            if (match = url.match(/\/archae\/bootstrapWs$/)) {
              const _sendInit = () => {
                const e = connectionState;
                const es = JSON.stringify(e);

                c.send(es);
              };
              _sendInit();

              connections.push(c);

              c.on('close', () => {
                connections.splice(connections.indexOf(c), 1);
              });
            }
          });
          cleanups.push(() => {
            for (let i = 0; i < connections.length; i++) {
              const connection = connections[i];
              connection.close();
            }
          });
          const _broadcastUpdate = () => {
            const e = connectionState;
            const es = JSON.stringify(e);

            for (let i = 0; i < connections.length; i++) {
              const connection = connections[i];
              connection.send(es);
            }
          };

          const connectionState = {
            protocol: '',
            address: '',
            port: 0,
            state: 'disconnected',
          };

          const _announceServer = () => new Promise((accept, reject) => {
            publicIp.v4().then(ip => {
              const options = {
                method: 'POST',
                host: siteSpec.host,
                port: siteSpec.port,
                path: '/prsnt/announce',
                headers: {
                  'Content-Type': 'application/json',
                },
                rejectUnauthorized: siteSpec.host !== '127.0.0.1',
              };
              const req = (siteSpec.protocol === 'http' ? http : https).request(options);
              const configJson = config.getConfig();
              const {name} = configJson;
              const {protocol, port} = serverSpec;
              const address = ip;
              req.end(JSON.stringify({
                name: name,
                protocol: protocol,
                address: address,
                port: port,
                users: [], // XXX announce the real users from the hub engine
              }));

              req.on('response', res => {
                res.resume();

                res.on('end', () => {
                  const {statusCode} = res;

                  if (statusCode >= 200 && statusCode < 300) {
                    connectionState.state = 'connected';
                    _broadcastUpdate();

                    accept();
                  } else if (statusCode === 502) {
                    connectionState.state = 'firewalled';
                    connectionState.protocol = '';
                    connectionState.address = '';
                    connectionState.port = 0;
                    _broadcastUpdate();

                    accept();
                  } else {
                    connectionState.state = 'disconnected';
                    connectionState.protocol = '';
                    connectionState.address = '';
                    connectionState.port = 0;
                    _broadcastUpdate();

                    const err = new Error('server announce returned error status code: ' + statusCode);
                    err.code = 'EHTTP';
                    err.statusCode = statusCode;
                    err.options = options;
                    reject(err);
                  }
                });
                res.on('error', err => {
                  err.options = options;

                  reject(err);
                });
              });
              req.on('error', err => {
                err.options = options;

                reject(err);
              });

              connectionState.protocol = protocol;
              connectionState.address = address;
              connectionState.port = port;
              connectionState.state = 'connecting';
              _broadcastUpdate();
            }, err => {
              reject(err);
            });
          });

          const _tryServerAnnounce = () => new Promise((accept, reject) => {
            const configJson = config.getConfig();
            const {visibility} = configJson;

            if (visibility === 'public') {
              _announceServer()
                .then(() => {
                  accept(true);
                })
                .catch(err => {
                  // console.warn('server announce failed', err.code, JSON.stringify({statusCode: err.statusCode, options: err.options}));

                  accept(false);
                });
            }
          });

          const _queueServerAnnounce = _debounce(next => {
            _tryServerAnnounce()
              .then(ok => {
                if (ok) {
                  next();
                } else {
                  setTimeout(() => {
                    _queueServerAnnounce();

                    next();
                  }, SERVER_ANNOUNCE_RETRY_INTERVAL);
                }
              });
          });

          if (siteSpec) {
            _queueServerAnnounce();

            const serverAnnounceInterval = setInterval(() => {
              _queueServerAnnounce();
            }, SERVER_ANNOUNCE_INTERVAL);

            cleanups.push(() => {
              clearInterval(serverAnnounceInterval);
              clearInterval(serverIconAnnounceInterval);
            });
          }
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

const _debounce = fn => {
  let running = false;
  let queued = false;

  const _go = () => {
    if (!running) {
      running = true;

      fn(() => {
        running = false;

        if (queued) {
          queued = false;

          _go();
        }
      });
    } else {
      queued = true;
    }
  };
  return _go;
};

module.exports = Bootstrap;

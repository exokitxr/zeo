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
    const {app, dirname, dataDirectory} = archae.getCore();
    const {
      metadata: {
        site: {
          url: siteUrl,
        },
        server: {
          url: serverUrl,
          enabled: serverEnabled,
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

          const _announceServer = () => publicIp.v4()
            .then(ip => new Promise((accept, reject) => {
              const options = {
                method: 'POST',
                host: siteSpec.host,
                port: siteSpec.port,
                path: '/prsnt/announce',
                headers: {
                  'Content-Type': 'application/json',
                },
              };
              const req = (siteSpec.protocol === 'http' ? http : https).request(options);
              req.end(JSON.stringify({
                name: 'Server name', // XXX announce the real server from the config
                protocol: serverSpec.protocol,
                address: ip,
                port: serverSpec.port,
                users: [], // XXX announce the real users from the hub engine
              }));

              req.on('response', res => {
                res.resume();

                res.on('end', () => {
                  const {statusCode} = res;

                  if (statusCode >= 200 && statusCode < 300) {
                    accept();
                  } else {
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

          if (serverEnabled && siteSpec) {
            _queueServerAnnounce();

            const serverAnnounceInterval = setInterval(() => {
              _queueServerAnnounce();
            }, SERVER_ANNOUNCE_INTERVAL);

            cleanups.push(() => {
              clearInterval(serverAnnounceInterval);
              clearInterval(serverIconAnnounceInterval);
            });
          }

          const startTime = Date.now();
          function serveStartTime(req, res, next) {
            res.json({
              startTime,
            });
          }
          app.get('/archae/bootstrap/start-time.json', serveStartTime);

          cleanups.push(() => {
            function removeMiddlewares(route, i, routes) {
              if (
                route.handle.name === 'serveStartTime'
              ) {
                routes.splice(i, 1);
              }
              if (route.route) {
                route.route.stack.forEach(removeMiddlewares);
              }
            }
            app._router.stack.forEach(removeMiddlewares);
          });
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

const path = require('path');
const fs = require('fs');
const https = require('https');

const SERVER_REFRESH_INTERVAL = 30 * 1000;

class Bootstrap {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {app, dirname, dataDirectory} = archae.getCore();
    const {metadata: {hub: {url: hubUrl}, server: {url: serverUrl, username: serverUsername, password: serverPassword}}} = archae;

    const hubSpec = (() => {
      const match = hubUrl.match(/^(.+\..+?)(?::([0-9]*?))?$/);
      return match && {
        host: match[1],
        port: match[2] ? parseInt(match[2], 10) : 443,
      };
    })();

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const username = 'avaer'; // XXX source this from hub login
    const worldname = 'proteus';
    const users = [
      'allie',
      'reede',
      'fay',
      'khromix',
    ];

    const _initialAnnounce = () => {
      if (hubSpec) {
        return _tryRefreshServer();
      } else {
        return Promise.resolve();
      }
    };
    const _queueRefreshServer = _debounce(next => {
      _tryRefreshServer()
        .then(() => {
          next();
        });
    });
    const _tryRefreshServer = () => new Promise((accept, reject) => {
      Promise.all([
        _announceServer(),
      ])
        .then(() => {
          accept();
        })
        .catch(err => {
          console.warn('server hub ping failed:', err);

          accept();
        });
    });
    const _announceServer = () => new Promise((accept, reject) => {
      const options = {
        method: 'POST',
        host: hubSpec.host,
        port: hubSpec.port,
        path: '/servers/announce',
        headers: {
          'Content-Type': 'application/json',
        },
      };
      const req = https.request(options);
      req.end(JSON.stringify({
        username: username,
        worldname: worldname,
        url: serverUrl,
        users: users,
      }));

      req.on('response', res => {
        res.resume();

        res.on('end', () => {
          const {statusCode} = res;

          if (statusCode >= 200 && statusCode < 300) {
            accept();
          } else {
            const err = 'server ping returned error status code: ' + JSON.stringify({
              host: options.host,
              port: options.port,
              path: options.path,
              statusCode: statusCode,
            });
            reject(err);
          }
        });
        res.on('error', err => {
          reject(err);
        });
      });
      req.on('error', err => {
        reject(err);
      });
    });

    return _initialAnnounce()
      .then(() => {
        if (live) {
          if (hubSpec) {
            const serverRefreshInterval = setInterval(() => {
              _queueRefreshServer();
            }, SERVER_REFRESH_INTERVAL);

            this._cleanup = () => {
              clearInterval(serverRefreshInterval);
            };
          }

          const _proxyHub = (req, res, url) => {
            const proxyReq = https.request({
              method: req.method,
              hostname: hubSpec.host,
              port: hubSpec.port,
              path: url,
              headers: req.headers,
            });
            proxyReq.end();
            proxyReq.on('error', err => {
              res.status(500);
              res.end(err.stack);
            });
            proxyReq.on('response', proxyResponse => {
              res.status(proxyResponse.statusCode);
              res.set(proxyResponse.headers);
              proxyResponse.pipe(res);
            });
          };
          const _authHub = (authentication, cb) => {
            if (hubSpec) {
              const proxyReq = https.request({
                method: 'POST',
                hostname: hubSpec.host,
                port: hubSpec.port,
                path: '/hub/auth',
                headers: {
                  'Content-Type': 'application/json',
                },
              });
              proxyReq.end(JSON.stringify({
                authentication,
              }));
              proxyReq.on('error', err => {
                cb(err);
              });
              proxyReq.on('response', proxyResponse => {
                const bs = [];
                proxyResponse.on('data', d => {
                  bs.push(d);
                });
                proxyResponse.on('end', () => {
                  const b = Buffer.concat(bs);
                  const s = b.toString('utf8');
                  const j = _jsonParse(s);
                  const username = j ? j.username : null;

                  if (username) {
                    cb(null, username);
                  } else {
                    cb({
                      code: 'EAUTH',
                    });
                  }
                });
              });
            } else {
              const authenticationString = new Buffer(authentication, 'base64').toString('utf8');
              const match = authenticationString.match(/^(.+?):(.+?)$/);

              if (match) {
                const username = match[1];
                const password = match[2];

                if (username === serverUsername && password === serverPassword) {
                  cb(null, username);
                } else {
                  cb({
                    code: 'EAUTH',
                  });
                }
              } else {
                cb({
                  code: 'EAUTH',
                });
              }
            }
          };
          const _authHubRequest = (req, cb) => {
            const authentication = (() => {
              const authorization = req.get('Authorization') || '';
              const match = authorization.match(/^Token (.+)$/);
              return match && match[1];
            })();
            if (authentication) {
              _authHub(authentication, cb);
            } else {
              process.nextTick(() => {
                cb({
                  code: 'EAUTH',
                });
              });
            }
          };

          return {
            proxyHub: _proxyHub,
            authHub: _authHub,
            authHubRequest: _authHubRequest,
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

const _jsonParse = s => {
  let error = null;
  let result;
  try {
    result = JSON.parse(s);
  } catch (err) {
    error = err;
  }
  if (!error) {
    return result;
  } else {
    return null;
  }
};
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

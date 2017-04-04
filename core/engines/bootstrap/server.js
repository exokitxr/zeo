const path = require('path');
const fs = require('fs');
const https = require('https');

const SERVER_ANNOUNCE_INTERVAL = 30 * 1000;
const SERVER_ICON_ANNOUNCE_INTERVAL = 5 * 60 * 1000;
const SERVER_ANNOUNCE_RETRY_INTERVAL = 2 * 1000;

class Bootstrap {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {app, dirname, dataDirectory} = archae.getCore();
    const {metadata: {hub: {url: hubUrl}, server: {url: serverUrl, worldname: serverWorldname, enabled: serverEnabled}}} = archae;

    const hubSpec = (() => {
      const match = hubUrl.match(/^(.+\..+?)(?::([0-9]*?))?$/);
      return match && {
        host: match[1],
        port: match[2] ? parseInt(match[2], 10) : 443,
      };
    })();

    const cleanups = [];
    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };

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
        worldname: serverWorldname,
        url: serverUrl,
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
    const _announceServerIcon = () => new Promise((accept, reject) => {
      const options = {
        method: 'POST',
        host: hubSpec.host,
        port: hubSpec.port,
        path: '/servers/announceIcon/' + serverUrl,
        headers: {
          'Content-Type': 'image/png',
        },
      };
      const req = https.request(options);

      const serverImagePath = path.join(dirname, dataDirectory, 'img', 'server', 'icon', serverWorldname + '.png');
      const rs = fs.createReadStream(serverImagePath);
      rs.pipe(req);
      rs.on('error', err => {
        reject(err);
      });

      req.on('response', res => {
        res.resume();

        res.on('end', () => {
          const {statusCode} = res;

          if (statusCode >= 200 && statusCode < 300) {
            accept();
          } else {
            const err = new Error('server announce image returned error status code: ' + statusCode);
            err.code = 'EHHTP';
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

    const _makeTryAnnounce = announceFn => () => new Promise((accept, reject) => {
      announceFn()
        .then(() => {
          accept(true);
        })
        .catch(err => {
          console.warn('server announce failed: ', err.code);

          accept(false);
        });
    });
    const _tryServerAnnounce = _makeTryAnnounce(_announceServer);
    const _tryServerIconAnnounce = _makeTryAnnounce(_announceServerIcon);

    const _makeQueueAnnounce = (tryAnnounceFn, retryAnnounceFn) => _debounce(next => {
      tryAnnounceFn()
        .then(ok => {
          if (!ok) {
            setTimeout(retryAnnounceFn, SERVER_ANNOUNCE_RETRY_INTERVAL);
          }

          next();
        });
    });
    const _queueServerAnnounce = _makeQueueAnnounce(_tryServerAnnounce, () => {
      _queueServerAnnounce();
    });
    const _queueServerIconAnnounce = _makeQueueAnnounce(_tryServerIconAnnounce, () => {
      _queueServerIconAnnounce();
    });

    if (serverEnabled && hubSpec) {
      _queueServerAnnounce();
      _queueServerIconAnnounce();

      const serverAnnounceInterval = setInterval(() => {
        _queueServerAnnounce();
      }, SERVER_ANNOUNCE_INTERVAL);

      const serverIconAnnounceInterval = setInterval(() => {
        _queueServerIconAnnounce();
      }, SERVER_ICON_ANNOUNCE_INTERVAL);

      cleanups.push(() => {
        clearInterval(serverAnnounceInterval);
        clearInterval(serverIconAnnounceInterval);
      });
    }

    /* const _proxyHub = (req, res, url) => { // XXX this authentication no longer works and needs to be rethought
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
    }; */
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

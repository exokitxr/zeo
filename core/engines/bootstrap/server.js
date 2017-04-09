const path = require('path');
const fs = require('fs');
const https = require('https');

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
        hub: {
          url: hubUrl,
        },
        server: {
          url: serverUrl,
          worldname: serverWorldname,
          enabled: serverEnabled,
        },
      },
    } = archae;

    const hubSpec = (() => {
      const match = hubUrl.match(/^(.+\..+?)(?::([0-9]*?))?$/);
      return match && {
        host: match[1],
        port: match[2] ? parseInt(match[2], 10) : 443,
      };
    })();
    const serverSpec = (() => {
      const match = serverUrl.match(/^(.+\..+?)(?::([0-9]*?))?$/);
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
        serverHost: serverSpec.host,
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

    if (serverEnabled && hubSpec) {
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

const https = require('https');

const SERVER_PING_INTERVAL = 4 * 60 * 1000;

class Hub {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {app, dirname, dataDirectory} = archae.getCore();
    const {metadata: {server: {url: serverUrl}}} = archae;

    const {metadata: {hub: {url: hubUrl}}} = archae;
    const hubUrlSpec = (() => {
      const match = hubUrl.match(/^(.+?):(.+?)$/);
      return match && {
        host: match[1],
        port: match[2],
      };
    })();

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const username = 'avaer'; // XXX source this from hub login
    const worldname = 'proteus';

    const _queuePingServer = _debounce(next => {
      _tryPingServer()
        .then(() => {
          next();
        });
    });
    const _tryPingServer = () => new Promise((accept, reject) => {
      _pingServer()
        .then(() => {
          accept();
        })
        .catch(err => {
          console.warn('server hub ping failed:', err);

          accept();
        });
    });
    const _pingServer = () => new Promise((accept, reject) => {
      const req = https.request({
        method: 'POST',
        host: hubUrlSpec.host,
        port: hubUrlSpec.port,
        path: '/hub/server',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      req.end(JSON.stringify({
        username: username,
        worldname: worldname,
        url: serverUrl,
      }));

      req.on('response', res => {
        res.resume();

        res.on('end', () => {
          const {statusCode} = res;

          if (statusCode >= 200 && statusCode < 300) {
            accept();
          } else {
            const err = new Error('server ping returned erro status code: ' + JSON.stringify(statusCode));
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

    return _tryPingServer()
      .then(() => {
        if (live) {
          const serverPingInterval = setInterval(() => {
            _queuePingServer();
          }, SERVER_PING_INTERVAL);

          this._cleanup = () => {
            clearInterval(serverPingInterval);
          };
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

module.exports = Hub;

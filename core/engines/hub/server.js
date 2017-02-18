const https = require('https');

const SERVER_REFRESH_INTERVAL = 30 * 1000;

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
    const users = [
      'allie',
      'reede',
      'fay',
      'khromix',
    ];
    const ranked = true;

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
        host: hubUrlSpec.host,
        port: hubUrlSpec.port,
        path: '/hub/servers/announce',
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
        ranked: ranked,
      }));

      req.on('response', res => {
        res.resume();

        res.on('end', () => {
          const {statusCode} = res;

          if (statusCode >= 200 && statusCode < 300) {
            accept();
          } else {
            const err = new Error('server ping returned error status code: ' + JSON.stringify({
              host: options.host,
              port: options.port,
              path: options.path,
              statusCode: statusCode,
            }, null, 2));
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

    return _tryRefreshServer()
      .then(() => {
        if (live) {
          const serverRefreshInterval = setInterval(() => {
            _queueRefreshServer();
          }, SERVER_REFRESH_INTERVAL);

          this._cleanup = () => {
            clearInterval(serverRefreshInterval);
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

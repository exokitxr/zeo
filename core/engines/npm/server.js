const url = require('url');
const querystring = require('querystring');
const https = require('follow-redirects').https;

class Npm {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {app} = archae.getCore();

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _makeSendApiError = reject => (statusCode = 500, message = 'API Error') => {
      const err = new Error(message);
      err.statusCode = statusCode;
      reject(err); 
    };

    const _getString = (res, cb) => {
      const bs = [];
      res.on('data', d => {
        bs.push(d);
      });
      res.on('end', () => {
        const b = Buffer.concat(bs);
        const s = b.toString('utf8');

        cb(null, s);
      });
      res.on('error', err => {
        cb(err);
      });
    };
    const _getJson = (res, cb) => {
      _getString(res, (err, s) => {
        if (!err) {
          const j = _jsonParse(s);

          cb(null, j);
        } else {
          cb(err);
        }
      });
    };

    const _requestPackageJson = module => new Promise((accept, reject) => {
      const _sendApiError = _makeSendApiError(reject);

      https.get({
        hostname: 'unpkg.com',
        path: '/' + module + '/package.json',
      }, proxyRes => {
        if (proxyRes.statusCode >= 200 && proxyRes.statusCode < 300) {
          _getJson(proxyRes, (err, j) => {
            if (!err) {
              if (typeof j === 'object' && j !== null) {
                accept(j);
              } else {
                _sendApiError();
              }
            } else {
              _sendApiError(proxyRes.statusCode);
            }
          });
        } else {
          _sendApiError(proxyRes.statusCode);
        }
      }).on('error', err => {
        _sendApiError(500, err.stack);
      });
    });

    const _requestReadme = module => new Promise((accept, reject) => {
      const _sendApiError = _makeSendApiError(reject);

      https.get({
        hostname: 'unpkg.com',
        path: '/' + module + '/README.md',
      }, proxyRes => {
        if (proxyRes.statusCode >= 200 && proxyRes.statusCode < 300) {
          _getString(proxyRes, (err, s) => {
            if (!err) {
              accept(s);
            } else {
              _sendApiError(proxyRes.statusCode);
            }
          });
        } else if (proxyRes.statusCode === 404) {
          accept(null);
        } else {
          _sendApiError(proxyRes.statusCode);
        }
      }).on('error', err => {
        _sendApiError(500, err.stack);
      });
    });

    const _requestReadmeMd = module => new Promise((accept, reject) => {
      const _sendApiError = _makeSendApiError(reject);

      https.get({
        hostname: 'unpkg.com',
        path: '/' + module + '/README.md',
      }, proxyRes => {
        if (proxyRes.statusCode >= 200 && proxyRes.statusCode < 300) {
          _getString(proxyRes, (err, s) => {
            if (!err) {
              accept(s);
            } else {
              _sendApiError(500, err.stack);
            }
          });
        } else if (proxyRes.statusCode === 404) {
          accept('');
        } else {
          _sendApiError(proxyRes.statusCode);
        }
      }).on('error', err => {
        _sendApiError(500, err.stack);
      });
    });

    const _requestSearch = q => new Promise((accept, reject) => {
      const _sendApiError = _makeSendApiError(reject);

      https.get({
        hostname: 'api.npms.io',
        path: '/v2/search?q=' + encodeURIComponent(q) + '+keywords:zeo-module',
      }, proxyRes => {
        if (proxyRes.statusCode >= 200 && proxyRes.statusCode < 300) {
          _getJson(proxyRes, (err, j) => {
            if (!err) {
              if (typeof j === 'object' && j !== null) {
                const {results} = j;

                if (Array.isArray(results)) {
                  accept(results);
                } else {
                  _sendApiError();
                }
              } else {
                _sendApiError();
              }
            } else {
              _sendApiError(500, err.stack);
            }
          });
        } else {
          _sendApiError(proxyRes.statusCode);
        }
      }).on('error', err => {
        _sendApiError(500, err.stack);
      });
    });

    return {
      requestPackageJson: _requestPackageJson,
      requestReadme: _requestReadme,
      requestReadmeMd: _requestReadmeMd,
      requestSearch: _requestSearch,
    };
  }

  unmount() {
    this._cleanup();
  }
}

const _jsonParse = s => {
  let error = null, result;
  try {
    result = JSON.parse(s);
  } catch(err) {
    error = err;
  }
  if (!error) {
    return result;
  } else {
    return null;
  }
};

module.exports = Npm;

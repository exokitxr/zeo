const url = require('url');
const querystring = require('querystring');
const https = require('https');

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

    function serveSearch(req, res, next) {
      const parsedUrl = url.parse(req.url, true);
      const {query: {q = ''}} = parsedUrl;

      const _sendApiError = (statusCode = 500, message = 'API Error') => {
        res.status(statusCode);
        res.send(message);
      };

      https.get({
        hostname: 'api.npms.io',
        path: '/v2/search?' + querystring.stringify({
          q: q + '+keywords:zeo-mod',
        }),
      }, proxyRes => {
        if (proxyRes.statusCode >= 200 && proxyRes.statusCode < 300) {
          const bs = [];
          proxyRes.on('data', d => {
            bs.push(d);
          });
          proxyRes.on('end', () => {
            const b = Buffer.concat(bs);
            const s = b.toString('utf8');
            const j = _jsonParse(s);

            if (typeof j === 'object' && j !== null) {
              const {results} = j;
              if (Array.isArray(results)) {
                res.json(results);
              } else {
                _sendApiError();
              }
            } else {
              _sendApiError();
            }
          });
        } else {
          _sendApiError(proxyRes.statusCode);
        }
      }).on('error', err => {
        _sendApiError(500, err.stack);
      });
    }
    app.get('/archae/npm/search', serveSearch);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveSearch') {
          routes.splice(i, 1);
        }
        if (route.route) {
          route.route.stack.forEach(removeMiddlewares);
        }
      }
      app._router.stack.forEach(removeMiddlewares);
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

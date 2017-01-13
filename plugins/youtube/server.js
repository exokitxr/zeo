const request = require('request');
const lruCache = require('lru-cache');
const ytdlCoreInfo = require('ytdl-core/lib/info');

const ITAG = 43;

const cache = lruCache({
  max: 100,
});

class Youtube {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {app} = archae.getCore();

    function serveCors(req, res, next) {
      const url = req.url.replace(/^\/archae\/cors\//, '');
      const headers = (() => {
        const result = {};
        for (let k in req.headers) {
          if (!/host|referer/.test(k)) {
            result[k] = req.headers[k];
          }
        }
        return result;
      })();
      const gzip = Boolean(headers['accept-encoding']) && /gzip/.test(headers['accept-encoding']);

      request({
        url,
        headers,
        gzip,
        rejectUnauthorized: false,
      }).on('response', proxyRes => {
        res.status(proxyRes.statusCode);

        for (let k in proxyRes.headers) {
          if (!/connection|transfer\-encoding|alt\-svc/.test(k)) {
            res.set(k, proxyRes.headers[k]);
          }
        }
        res.set('Access-Control-Allow-Origin', '*');

        proxyRes.pipe(res);
      }).on('error', err => {
        res.status(500);
        res.send(err.stack);
      });
    }
    function serveYoutube(req, res, next) {
      const url = req.url.replace(/^\/archae\/youtube\//, '');

      const respond = result => {
        res.type('text/plain; charset=UTF-8');
        res.send(result);
      };

      const entry = cache.get(url);

      if (entry !== undefined) {
        respond(entry);
      } else {
        ytdlCoreInfo(url, (err, info) => {
          const format = info.formats.find(format => format.itag === String(ITAG));
          const src = format.url;

          cache.set(url, src);

          respond(src);
        });
      }
    }
    app.get('/archae/cors/*', serveCors);
    app.get('/archae/youtube/*', serveYoutube);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveCors' || route.handle.name === 'serveYoutube') {
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

module.exports = Youtube;

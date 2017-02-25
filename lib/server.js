const https = require('https');

const listen = a => new Promise((accept, reject) => {
  const {metadata: {hub: {url: hubUrl, enabled: hubEnabled}, server: {url: serverUrl, type: serverType, username: serverUsername, password: serverPassword, enabled: serverEnabled}}} = a;

  const hubSpec = (() => {
    const match = hubUrl.match(/^(.+\..+?)(?::([0-9]*?))?$/);
    return match && {
      host: match[1],
      port: match[2] ? parseInt(match[2], 10) : 443,
    };
  })();

  const _filterIsHubOrServerHostname = (req, res, next) => {
    if (
      (serverEnabled && req.get('Host') === serverUrl) ||
      (hubEnabled && req.get('Host') === hubUrl)
    ) {
      next();
    } else {
      next('route');
    }
  };
  const _filterIsServerHostname = (req, res, next) => {
    if (serverEnabled && req.get('Host') === serverUrl) {
      next();
    } else {
      next('route');
    }
  };

  a.app.get('/', _filterIsHubOrServerHostname, (req, res, next) => {
    req.url = '/vr.html';

    a.app(req, res, next);
  });
  a.app.post('/server/login', _filterIsServerHostname, (req, res, next) => {
    if (hubSpec) {
      const proxyReq = https.request({
        method: 'POST',
        host: hubSpec.host,
        port: hubSpec.port,
        path: '/hub/login',
        headers: (() => {
          const result = {};

          const contentType = req.headers['content-type'];
          if (contentType) {
            result['Content-Type'] = contentType;
          }

          return result;
        })(),
      });
      req.pipe(proxyReq);
      proxyReq.on('response', proxyRes => {
        const contentType = proxyRes.headers['content-type'];
        if (contentType) {
          res.setHeader('Content-Type', contentType);
        }

        res.status(proxyRes.statusCode);
        proxyRes.pipe(res);
      });
      proxyReq.on('error', err => {
        res.status(500);
        res.send(err.stack);
      });
    } else {
      const token = new Buffer(serverUsername + ':' + serverPassword, 'utf8').toString('base64');

      res.json({
        username: serverUsername,
        plan: null,
        token: token,
        authentication: token,
      });
    }
  });
  a.app.get('/server/servers.json', _filterIsServerHostname, (req, res, next) => {
    if (hubSpec) {
      const proxyReq = https.request({
        method: 'GET',
        host: hubSpec.host,
        port: hubSpec.port,
        path: '/hub/servers.json',
      });
      proxyReq.end();
      proxyReq.on('response', proxyRes => {
        const contentType = proxyRes.headers['content-type'];
        if (contentType) {
          res.setHeader('Content-Type', contentType);
        }

        res.status(proxyRes.statusCode);
        proxyRes.pipe(res);
      });
      proxyReq.on('error', err => {
        res.status(500);
        res.send(err.stack);
      });
    } else {
      res.json({
        servers: [
          {
            username: 'username',
            worldname: 'worldname',
            url: serverUrl,
            users: [],
            secure: serverType === 'secure',
          },
        ],
      });
    }
  });
  a.app.get('/server/server.json', _filterIsServerHostname, (req, res, next) => {
    res.json({
      type: 'server',
      url: serverUrl,
    });
  });

  accept();
});

module.exports = {
  listen,
};

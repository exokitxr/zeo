const httpProxy = require('http-proxy');

const listen = a => {
  const {
    metadata: {
      hub: {
        url: hubUrl,
      },
    },
  } = a;

  const _listenProxy = () => new Promise((accept, reject) => {
    const hubProxy = httpProxy.createProxyServer({
      target: hubUrl,
      headers: {
        'Host': hubUrl,
      },
      secure: false,
    });

    a.app.get('/servers/servers.json', (req, res, next) => {
      hubProxy.web(req, res);
    });
    a.app.get('/modules/modules.json', (req, res, next) => {
      req.url = '/archae/rend/search';

      hubProxy.web(req, res);
    });
    a.app.get('/modules/module.json', (req, res, next) => {
      const {q} = req.query;
      req.url = '/archae/rend/mods?q=' + q;

      hubProxy.web(req, res);
    });

    accept();
  });

  const _listenPublic = () => new Promise((accept, reject) => {
    a.app.get(/^\/(docs|modules?|servers)?(\/|\?|$)/, (req, res, next) => {
      const url = (() => {
        const page = req.params[0];
        const tail = req.params[1];

        if (page === 'docs') {
          return '/doc/docs.html';
        } else if (page === 'modules') {
          if (/^\//.test(tail)) {
            return '/module.html';
          } else {
            return '/modules.html';
          }
        } else if (page === 'servers') {
          return '/servers.html';
        } else {
          return '/site.html';
        }
      })();
      req.url = url;

      a.app(req, res, next);
    });

    accept();
  });

  return Promise.all([
    _listenProxy(),
    _listenPublic(),
  ])
    .then(() => {});
};


module.exports = {
  listen,
};

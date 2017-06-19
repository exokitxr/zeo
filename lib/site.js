const path = require('path');
const fs = require('fs');

const httpProxy = require('http-proxy');
const modulequery = require('modulequery');
const vrid = require('vrid');

const listen = a => {
  const {
    dirname,
    metadata: {
      site: {
        url: siteUrl,
      },
      hub: {
        url: hubUrl,
      },
      home: {
        url: homeUrl,
      },
      forum: {
        url: forumUrl,
      },
    },
  } = a;
  const crdsUrl = 'http://127.0.0.1:9999'; // XXX make this an argument

  const _readFile = (p, opts) => new Promise((accept, reject) => {
    fs.readFile(p, opts, (err, d) => {
      if (!err) {
        accept(d);
      } else {
        reject(err);
      }
    });
  });

  const _listenProxy = () => new Promise((accept, reject) => {
    const _listenHubProxy = () => {
      a.app.get('/servers/servers.json', (req, res, next) => {
        res.redirect(hubUrl + '/servers/servers.json');
      });
    };
    _listenForumProxy = () => {
      const forumProxy = httpProxy.createProxyServer({
        target: forumUrl,
        xfwd: true,
      });

      a.app.all(/^\/forum(?:\/|$)/, (req, res, next) => {
        forumProxy.web(req, res);
      });
    };

    _listenHubProxy();
    _listenForumProxy();

    accept();
  });
  const _listenSearch = () => new Promise((accept, reject) => {
    const mq = modulequery({
      dirname: dirname,
      modulePath: path.join('/', 'plugins'),
    });

    a.app.get('/modules/modules.json', (req, res, next) => {
      const q = req.query.q ? decodeURIComponent(req.query.q) : '';

      mq.search(q, {
        keywords: ['zeo-module'],
      })
        .then(modSpecs => {
          res.json(modSpecs);
        })
        .catch(err => {
          res.status(500);
          res.send(err.stack);
        });
    });
    a.app.get('/modules/module.json', (req, res, next) => {
      const q = req.query.q ? decodeURIComponent(req.query.q) : '';

      mq.getModule(q)
        .then(modSpec => {
          res.json(modSpec);
        })
        .catch(err => {
          res.status(500);
          res.send(err.stack);
        });
    });

    accept();
  });
  const _listenWallet = () => vrid({
    origin: siteUrl,
    crdsUrl: crdsUrl,
    sso: {
      secretKey: 'password',
      emailDomain: 'address.zeovr.io',
      redirectUrl: siteUrl + '/forum/session/sso_login',
    },
  })
    .requestApp()
    .then(idApp => {
      a.app.use(idApp);
    });
  const _listenPublic = () => new Promise((accept, reject) => {
    const publicPath = path.join(__dirname, '..', 'public');

    a.app.get(/^\/(docs|modules|buy(?:-success)?|servers)?((?:(?:\/|\?).*)?)$/, (req, res, next) => {
      const page = req.params[0];
      const tail = req.params[1];

      const _serveHtml = (req, res, p) => {
        res.type('text/html');

        const rs = fs.createReadStream(p);
        rs.pipe(res);
        rs.on('error', err => {
          res.status(500);
          res.send(err.stack);
        });
      };

      if (page === 'docs') {
        _serveHtml(req, res, path.join(publicPath, 'doc/docs.html'));
      } else if (page === 'modules') {
        if (/^\//.test(tail)) {
          _serveHtml(req, res, path.join(publicPath, 'module.html'));
        } else {
          _serveHtml(req, res, path.join(publicPath, 'modules.html'));
        }
      } else if (page === 'buy') {
        _serveHtml(req, res, path.join(publicPath, 'buy.html'));
      } else if (page === 'buy-success') {
        _serveHtml(req, res, path.join(publicPath, 'buy-success.html'));
      } else if (page === 'servers') {
        _serveHtml(req, res, path.join(publicPath, 'servers.html'));
      } else {
        _serveHtml(req, res, path.join(publicPath, 'site.html'));
      }
    });

    accept();
  });

  return Promise.all([
    _listenProxy(),
    _listenSearch(),
    _listenWallet(),
    _listenPublic(),
  ])
  .then(() => {});
};

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
    return undefined;
  }
};

module.exports = {
  listen,
};

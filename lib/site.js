const path = require('path');
const fs = require('fs');

const modulequery = require('modulequery');
const assetwallet = require('assetwallet');

const listen = a => {
  const {
    dirname,
    metadata: {
      hub: {
        url: hubUrl,
      },
      home: {
        url: homeUrl,
      },
    },
  } = a;

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
    _listenHomeProxy = () => {
      a.app.get('/home', (req, res, next) => {
        req.url = '/';

        res.redirect(homeUrl);
      });
    };

    _listenHubProxy();
    _listenHomeProxy();

    accept();
  });
  const _listenSearch = () => new Promise((accept, reject) => {
    const mq = modulequery({
      dirname: dirname,
      modulePath: path.join('/', 'plugins'),
    });

    a.app.get('/modules/modules.json', (req, res, next) => {
      const {q = ''} = req.query;

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
      const {q = ''} = req.query;

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
  const _listenWallet = () => _readFile(path.join(__dirname, '..', 'public', 'header.html'), 'utf8')
    .then(headerHtml =>
      assetwallet({
        prefix: '/wallet',
        body: headerHtml,
      }).requestApp()
    )
    .then(assetwalletApp => {
      a.app.use(assetwalletApp);
    });
  const _listenPublic = () => new Promise((accept, reject) => {
    a.app.get(/^\/(docs|modules|servers)?((?:(?:\/|\?).*)?)$/, (req, res, next) => {
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
    _listenSearch(),
    _listenWallet(),
    _listenPublic(),
  ])
    .then(() => {});
};


module.exports = {
  listen,
};

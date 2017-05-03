const path = require('path');
const fs = require('fs');

const modulequery = require('modulequery');
const transclude = require('transclude');
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
  const _listenWallet = ({headerHtml}) => assetwallet({
    prefix: '/wallet',
    body: headerHtml,
  }).requestApp()
    .then(assetwalletApp => {
      a.app.use(assetwalletApp);
    });
  const _listenPublic = ({headerHtml}) => Promise.all([
      transclude.requestTranscludeRequestHandler(path.join(__dirname, '..', 'public', 'site.html'), s =>
        s
          .replace('<!-- header.html -->', headerHtml)
      ),
    ])
    .then(([
      siteHtmlHandler,
    ]) => new Promise((accept, reject) => {
      a.app.get(/^\/(docs|modules|servers)?((?:(?:\/|\?).*)?)$/, (req, res, next) => {
        const _serve = url => {
          req.url = url;

          a.app(req, res, next);
        };

        const page = req.params[0];
        const tail = req.params[1];

        if (page === 'docs') {
          _serve('/doc/docs.html');
        } else if (page === 'modules') {
          if (/^\//.test(tail)) {
            _serve('/module.html');
          } else {
            _serve('/modules.html');
          }
        } else if (page === 'servers') {
          _serve('/servers.html');
        } else {
          siteHtmlHandler(req, res, next);
        }
      });

      accept();
    }));

  return Promise.all([
    _readFile(path.join(__dirname, '..', 'public', 'header.html'), 'utf8'),
  ])
    .then(([
      headerHtml,
    ]) => Promise.all([
      _listenProxy(),
      _listenSearch(),
      _listenWallet({headerHtml}),
      _listenPublic({headerHtml}),
    ]))
    .then(() => {});
};


module.exports = {
  listen,
};

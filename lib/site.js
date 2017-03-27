const listen = a => new Promise((accept, reject) => {
  const {metadata: {site: {url: siteUrl, enabled: siteEnabled}}} = a;

  a.app.get(/^\/(docs|modules?|servers)?(\/|\?|$)/, (req, res, next) => {
    if (siteEnabled && req.get('Host') === siteUrl) {
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
    } else {
      next('route');
    }
  });

  accept();
});

module.exports = {
  listen,
};

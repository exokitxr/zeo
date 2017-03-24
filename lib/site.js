const listen = a => new Promise((accept, reject) => {
  const {metadata: {site: {url: siteUrl, enabled: siteEnabled}}} = a;

  a.app.get(/^\/(docs|modules|servers)?(?:\/|\?|$)/, (req, res, next) => {
    if (siteEnabled && req.get('Host') === siteUrl) {
      const url = (() => {
        const page = req.params[0];

        switch (page) {
          case 'docs':
            return '/doc/docs.html';
          case 'modules':
            return '/modules.html';
          case 'servers':
            return '/servers.html';
          default:
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

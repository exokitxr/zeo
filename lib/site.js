const listen = a => new Promise((accept, reject) => {
  const {metadata: {site: {url: siteUrl, enabled: siteEnabled}}} = a;

  a.app.get(/^\/(?:docs|modules)?(?:\/|\?|$)/, (req, res, next) => {
    if (siteEnabled && req.get('Host') === siteUrl) {
      req.url = '/doc2/docs.html';

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

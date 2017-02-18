const listen = a => new Promise((accept, reject) => {
  const {metadata: {site: {url: siteUrl}}} = a;

  a.app.get('/', (req, res, next) => {
    if (req.get('Host') === siteUrl) {
      req.url = '/site.html';

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

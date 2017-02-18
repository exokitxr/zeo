const listen = a => new Promise((accept, reject) => {
  const {metadata: {server: {url: serverUrl}}} = a;

  a.app.get('/', (req, res, next) => {
    if (req.get('Host') === serverUrl) {
      req.url = '/vr.html';

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

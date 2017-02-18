const listen = a => new Promise((accept, reject) => {
  const {metadata: {server: {hostname: serverHostname}}} = a;

  a.app.get('/', (req, res, next) => {
    if (a.app.getHostname(req) === serverHostname) {
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

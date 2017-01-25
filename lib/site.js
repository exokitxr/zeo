const listen = a => new Promise((accept, reject) => {
  a.app.get('/', a.app.filterIsLocalHostname((req, res, next) => {
    req.url = '/site.html';
    a.app(req, res, next);
  }));

  accept();
});

module.exports = {
  listen,
};

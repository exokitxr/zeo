const listen = a => new Promise((accept, reject) => {
  a.app.get('/', (req, res, next) => {
    req.url = '/vr.html';
    a.app(req, res, next);
  });

  accept();
});

module.exports = {
  listen,
};

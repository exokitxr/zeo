module.exports = a => new Promise((accept, reject) => {
  a.app.get('/', (req, res, next) => {
    req.url = '/site.html';
    a.app(req, res, next);
  });

  accept();
});

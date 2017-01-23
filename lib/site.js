module.exports = a => {
  a.app.get('/', (req, res, next) => {
    req.url = '/site.html';
    a.app(req, res, next);
  });
};

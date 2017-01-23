module.exports = a => {
  a.app.get('/', (req, res, next) => {
    req.url = '/vr.html';
    a.app(req, res, next);
  });
};

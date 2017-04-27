const listen = a => {
  const _listenPublic = () => new Promise((accept, reject) => {
    a.app.get('/', (req, res, next) => {
      req.url = '/vr.html';

      a.app(req, res, next);
    });

    accept();
  });

  return Promise.all([
    _listenPublic(),
  ])
  .then(() => {});
};

module.exports = {
  listen,
};

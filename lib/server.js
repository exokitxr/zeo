const listen = (a, config) => {
  const {metadata: {maxUsers, transient}} = config;

  const _listenPublic = () => new Promise((accept, reject) => {
    a.app.get('/', (req, res, next) => {
      const _serve = (url, status = 200) => {
        req.url = url;
        res.status(status);

        a.app(req, res, next);
      }

      const numUsers = transient.multiplayer ? transient.multiplayer.getNumUsers() : 0;

      if (numUsers < maxUsers) {
        _serve('/vr.html');
      } else {
        _serve('/unavailable.html', 503);
      }
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

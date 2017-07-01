const natUpnp = require('nat-upnp-2');

const listen = (a, config) => {
  const {port} = a;
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
        _serve('/index.html');
      } else {
        _serve('/unavailable.html', 503);
      }
    });

    accept();
  });
  const _listenOpenUpnpPort = () => new Promise((accept, reject) => {
    let errored = false;
    const _recurse = () => {
      const client = natUpnp.createClient();
      client.timeout = 2 * 1000;
      client.portMapping({
        public: port,
        private: port,
        ttl: 10,
      }, err => {
        if (err && !errored) {
          console.warn('Warning: failed to open UPnP port: ' + err.message);
          console.warn('You might need to configure your router to forward port ' + port + '.');

          setTimeout(_recurse, 10 * 1000);

          errored = true;
        } else {
          setTimeout(_recurse, 5 * 60 * 1000);
        }
      });
    };
    _recurse();

    accept();
  });

  return Promise.all([
    _listenPublic(),
    _listenOpenUpnpPort(),
  ])
  .then(() => {});
};

module.exports = {
  listen,
};

const listen = (a, config, {key, userDb}) => {
  const {dirname, dataDirectory} = a;
  const {express, wss} = a.getCore();
  const {
    metadata: {
      home: {
        url: homeUrl,
      },
    },
  } = config;

  const _filterIsHomeHostname = (req, res, next) => {
    if (req.get('Host') === homeUrl) {
      next();
    } else {
      next('route');
    }
  };

  const _listenPublic = () => new Promise((accept, reject) => {
    a.app.get('/', _filterIsHomeHostname, (req, res, next) => {
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

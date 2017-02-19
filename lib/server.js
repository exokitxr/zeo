const listen = a => new Promise((accept, reject) => {
  const {metadata: {server: {url: serverUrl}, current: {url: currentServerUrl}}} = a;

  const _filterIsServerHostname = (req, res, next) => {
    if (req.get('Host') === serverUrl) {
      next();
    } else {
      next('route');
    }
  };

  a.app.get('/', _filterIsServerHostname, (req, res, next) => {
    req.url = '/vr.html';

    a.app(req, res, next);
  });
  a.app.get('/server/server.json', _filterIsServerHostname, (req, res, next) => {
    res.json({
      type: 'server',
      url: currentServerUrl,
    });
  });

  accept();
});

module.exports = {
  listen,
};

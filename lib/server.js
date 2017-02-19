const listen = a => new Promise((accept, reject) => {
  const {metadata: {hub: {url: hubUrl, enabled: hubEnabled}, server: {url: serverUrl, enabled: serverEnabled}}} = a;

  const _filterIsHubOrServerHostname = (req, res, next) => {
    if (
      (serverEnabled && req.get('Host') === serverUrl) ||
      (hubEnabled && req.get('Host') === hubUrl)
    ) {
      next();
    } else {
      next('route');
    }
  };
  const _filterIsServerHostname = (req, res, next) => {
    if (serverEnabled && req.get('Host') === serverUrl) {
      next();
    } else {
      next('route');
    }
  };

  a.app.get('/', _filterIsHubOrServerHostname, (req, res, next) => {
    req.url = '/vr.html';

    a.app(req, res, next);
  });
  a.app.get('/server/server.json', _filterIsServerHostname, (req, res, next) => {
    res.json({
      type: 'server',
      url: serverUrl,
    });
  });

  accept();
});

module.exports = {
  listen,
};

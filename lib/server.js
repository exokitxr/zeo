const path = require('path');
const https = require('https');

const nedb = require('nedb');
const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();
const cookie = require('cookie');
const rnd = require('rnd');

const auth = require('./auth');

const listen = (a, config, {key}) => {
  const {dirname, dataDirectory, metadata: {hub: {url: hubUrl, enabled: hubEnabled}, server: {url: serverUrl, username: serverUsername, password: serverPassword, enabled: serverEnabled}}} = a;

 const _requestUserDb = () => new Promise((accept, reject) => {
    const userDb = new nedb({
      filename: path.join(dirname, dataDirectory, 'db', 'users.db'),
    });
    userDb.loadDatabase(err => {
      if (!err) {
        accept(userDb);
      } else {
        reject(err);
      }
    });
  });

  return _requestUserDb()
    .then(userDb => {
      const hubSpec = (() => {
        const match = hubUrl.match(/^(.+\..+?)(?::([0-9]*?))?$/);
        return match && {
          host: match[1],
          port: match[2] ? parseInt(match[2], 10) : 443,
        };
      })();

      const _filterIsServerHostname = (req, res, next) => {
        if (serverEnabled && req.get('Host') === serverUrl) {
          next();
        } else {
          next('route');
        }
      };

      const _listenPublic = () => {
        a.app.get('/', _filterIsServerHostname, (req, res, next) => {
          req.url = '/vr.html';

          a.app(req, res, next);
        });
      };
      const _listenServer = () => {
        a.app.post('/server/login', bodyParserJson, (req, res, next) => {
          const {body: j} = req;

          const _tryToken = token => {
            if (auth.parseToken({
              key,
              token,
            })) {
              userDb.findOne({
                type: 'token',
                token,
              }, (err, t) => {
                const _respondOk = ({token, username}) => {
                  res.set('Set-Cookie', 'token=' + token + '; HttpOnly');

                  res.json({
                    username,
                    token,
                  });
                };

                if (!err) {
                  if (t) {
                    const {token, username} = t;

                    _respondOk({token, username});
                  } else {
                    const username = [rnd.fakeName(), rnd.fakeName()].join(' ');

                    userDb.insert({
                      type: 'token',
                      token,
                      username,
                    }, err => {
                      if (!err) {
                        _respondOk({token, username});
                      } else {
                        res.status(500);
                        res.send();
                      }
                    });
                  }
                } else {
                  res.status(500);
                  res.send();
                }
              });
            } else {
              res.status(401);
              res.send();
            }
          };

          if (typeof j === 'object' && j !== null && typeof j.token === 'string') {
            const {token} = j;

            _tryToken(token);
          } else {
            const cookieHeader = req.get('Cookie');

            if (cookieHeader) {
              const c = cookie.parse(cookieHeader);
              const token = c && c.token;

              if (token) {
                _tryToken(token);
              } else {
                res.status(400);
                res.send();
              }
            } else {
              res.status(400);
              res.send();
            }
          }
        });
        a.app.post('/server/logout', (req, res, next) => {
          const cookieHeader = req.get('Cookie');

          if (cookieHeader) {
            const c = cookie.parse(cookieHeader);
            const token = c && c.token;

            if (token) {
              if (auth.parseToken({
                key,
                token,
              })) {
                res.set('Set-Cookie', 'token=deleted; expires=Thu, 01 Jan 1970 00:00:00 GMT');
                res.json({
                  ok: true,
                });
              } else {
                res.status(401);
                res.send();
              }
            } else {
              res.status(400);
              res.send();
            }
          } else {
            res.status(400);
            res.send();
          }
        });
        a.app.get('/server/token', (req, res, next) => {
          const cookieHeader = req.get('Cookie');

          if (cookieHeader) {
            const c = cookie.parse(cookieHeader);
            const token = c && c.token;

            if (token) {
              if (auth.parseToken({
                key,
                token,
              })) {
                res.type('text/plain');
                res.send(token);
              } else {
                res.status(401);
                res.send();
              }
            } else {
              res.status(400);
              res.send();
            }
          } else {
            res.status(400);
            res.send();
          }
        });
        a.app.get('/servers/servers.json', _filterIsServerHostname, (req, res, next) => {
          if (hubSpec) {
            const proxyReq = https.request({
              method: 'GET',
              host: hubSpec.host,
              port: hubSpec.port,
              path: '/servers/servers.json',
            });
            proxyReq.end();
            proxyReq.on('response', proxyRes => {
              const contentType = proxyRes.headers['content-type'];
              if (contentType) {
                res.setHeader('Content-Type', contentType);
              }

              res.status(proxyRes.statusCode);
              proxyRes.pipe(res);
            });
            proxyReq.on('error', err => {
              res.status(500);
              res.send(err.stack);
            });
          } else {
            res.json({
              servers: [
                {
                  username: 'username',
                  worldname: 'worldname',
                  url: serverUrl,
                  users: [],
                },
              ],
            });
          }
        });
      };

      _listenPublic();
      _listenServer();
    });
};

module.exports = {
  listen,
};

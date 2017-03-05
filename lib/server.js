const path = require('path');
const https = require('https');

const nedb = require('nedb');
const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();

const auth = require('./auth');

const listen = (a, config, {key}) => {
  const {dirname, dataDirectory, metadata: {hub: {url: hubUrl, enabled: hubEnabled}, server: {url: serverUrl, type: serverType, username: serverUsername, password: serverPassword, enabled: serverEnabled}}} = a;

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
                res.set('Set-Cookie', 'token=' + t + '; HttpOnly');

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
                  const username = 'Username';

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
                  res.json(null);
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
          };
        }
      });

      a.app.post('/server/login', _filterIsServerHostname, (req, res, next) => {
        const token = new Buffer(serverUsername + ':' + serverPassword, 'utf8').toString('base64');

        res.json({
          username: serverUsername,
          plan: null,
          token: token,
          authentication: token,
        });
      });
      a.app.get('/server/servers.json', _filterIsServerHostname, (req, res, next) => {
        if (hubSpec) {
          const proxyReq = https.request({
            method: 'GET',
            host: hubSpec.host,
            port: hubSpec.port,
            path: '/hub/servers.json',
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
                secure: serverType === 'secure',
              },
            ],
          });
        }
      });
      a.app.get('/server/server.json', _filterIsServerHostname, (req, res, next) => {
        res.json({
          type: 'server',
          url: serverUrl,
        });
      });
    });
};

module.exports = {
  listen,
};

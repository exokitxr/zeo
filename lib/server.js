const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const child_process = require('child_process');

const mkdirp = require('mkdirp');
const fetch = require('node-fetch');
const base64 = require('urlsafe-base64');
const nedb = require('nedb');
const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();
const cookie = require('cookie');
const sharp = require('sharp');
const rnd = require('rnd');

const auth = require('./auth');

const {
  RAW_TOKEN_SIZE,
} = auth;

const listen = (a, config, {key, userDb}) => {
  const {
    dirname,
    dataDirectory,
    metadata: {
      home: {
        url: homeUrl,
      },
      hub: {
        url: hubUrl,
        enabled: hubEnabled,
      },
      server: {
        url: serverUrl,
        worldname: serverWorldname,
        enabled: serverEnabled,
      }
    }
  } = a;

  const hubSpec = (() => {
    const match = hubUrl.match(/^(.+\..+?)(?::([0-9]*?))?$/);
    return match && {
      host: match[1],
      port: match[2] ? parseInt(match[2], 10) : 443,
    };
  })();

  const _filterIsServerHostname = (req, res, next) => {
    if (req.get('Host') === serverUrl) {
      next();
    } else {
      next('route');
    }
  };

  const _listenPublic = () => new Promise((accept, reject) => {
    a.app.get('/', _filterIsServerHostname, (req, res, next) => {
      req.url = '/vr.html';

      a.app(req, res, next);
    });

    accept();
  });
  const _listenServer = () => new Promise((accept, reject) => {
    const _tryBody = (req, tryFn) => {
      const {body: j} = req;

      if (typeof j === 'object' && j !== null && typeof j.token === 'string') {
        const {token} = j;

        return tryFn(token);
      } else {
        return Promise.resolve(false);
      }
    };
    const _tryCookie = (req, tryFn)  => {
      const cookieHeader = req.get('Cookie');

      if (cookieHeader) {
        const c = cookie.parse(cookieHeader);
        const token = c && c.token;

        if (token) {
          return tryFn(token);
        } else {
          return Promise.resolve(false);
        }
      } else {
        return Promise.resolve(false);
      }
    };
    const _tryAuth = (req, res, tryFn, doneFn = () => {
      res.status(401);
      res.send();
    }) => _tryBody(req, tryFn)
      .then(done => {
        if (!done) {
          return _tryCookie(req, tryFn);
        } else {
          return done;
        }
      })
      .then(done => {
        if (!done) {
          doneFn();
        }
      });

    a.app.post('/server/login', bodyParserJson, (req, res, next) => {
      const _tryToken = token => new Promise((accept, reject) => {
        const _doOk = ({token, hubToken = null}) => new Promise((accept, reject) => {
          userDb.findOne({
            type: 'token',
            token,
          }, (err, t) => {
            const _respondOk = ({token, username}) => {
              res.set('Set-Cookie', 'token=' + token + '; HttpOnly');

              res.json({
                token,
                username,
              });
            };

            if (!err) {
              if (t) {
                const {token, username} = t;

                _respondOk({
                  token,
                  username,
                });
              } else {
                const username = [rnd.fakeName(), rnd.fakeName()].join(' ');

                userDb.insert({
                  type: 'token',
                  token,
                  hubToken,
                  username,
                }, err => {
                  if (!err) {
                    _respondOk({
                      token,
                      username,
                    });

                    accept(true);
                  } else {
                    console.warn(err);

                    res.status(500);
                    res.send();

                    accept(true);
                  }
                });
              }
            } else {
              console.warn(err);

              res.status(500);
              res.send();

              accept(true);
            }
          });
        });

        userDb.findOne({
          type: 'token',
          $or: [
            {
              token: token,
            },
            {
              hubToken: token,
            },
          ],
        }, (err, t) => {
          if (!err) {
            if (t) {
              const {token} = t;

              _doOk({token});
            } else {
              if (auth.parseToken({
                key,
                token,
              })) {
                _doOk({token});
              } else {
                accept(false);
              }
            }
          } else {
            console.warn(err);

            res.status(500);
            res.send();

            accept(true);
          }
        });
      });

      _tryAuth(req, res, _tryToken);
    });
    a.app.post('/server/logout', (req, res, next) => {
      const _tryToken = token => new Promise((accept, reject) => {
        const _doOk = () => {
          res.set('Set-Cookie', 'token=deleted; expires=Thu, 01 Jan 1970 00:00:00 GMT');
          res.json({
            ok: true,
          });

          accept(true);
        };

        userDb.findOne({
          type: 'token',
          token,
        }, (err, t) => {
          if (!err) {
            if (t) {
              _doOk();

              accept(true);
            } else {
              if (auth.parseToken({
                key,
                token,
              })) {
                _doOk();

                accept(true);
              } else {
                accept(false);
              }
            }
          } else {
            console.warn(err);

            res.status(500);
            res.send();

            accept(true);
          }
        });
      });

      _tryAuth(req, res, _tryToken);
    });
    a.app.post('/server/checkLogin', bodyParserJson, (req, res, next) => {
      const _tryToken = token => new Promise((accept, reject) => {
        const _doOk = () => {
          res.json({
            ok: true,
          });

          accept(true);
        };

        userDb.findOne({
          type: 'token',
          token,
        }, (err, t) => {
          if (!err) {
            if (t) {
              _doOk();
            } else {
              if (auth.parseToken({
                key,
                token,
              })) {
                _doOk();
              } else {
                accept(false);
              }
            }
          } else {
            console.warn(err);

            res.status(500);
            res.send();

            accept(true);
          }
        });
      });
      const _failToken = () => {
        res.json({
          ok: false,
        });
      };

      _tryAuth(req, res, _tryToken, _failToken);
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
    a.app.post('/server/proxyLogin', (req, res, next) => {
      if (
        (req.connection.remoteAddress === '127.0.0.1' && req.connection.remoteFamily === 'IPv4') ||
        ((req.connection.remoteAddress === '::1' || req.connection.remoteAddress === '::ffff:127.0.0.1') && req.connection.remoteFamily === 'IPv6')
      ) {
        const token = auth.makeToken({
          key,
        });

        res.json({
          token,
        });
      } else {
        res.status(401);
        res.send();
      }
    });

    accept();
  });
  const _listenServers = () => new Promise((accept, reject) => {
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
    a.app.get('/servers/server.json', _filterIsServerHostname, (req, res, next) => {
      res.json({
        type: 'server',
        url: serverUrl,
        worldname: serverWorldname,
      });
    });

    accept();
  });

  return Promise.all([
    _listenPublic(),
    _listenServer(),
    _listenServers(),
  ])
    .then(() => {});
};

module.exports = {
  listen,
};

// const http = require('http');
// const https = require('https');

const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();
const cookie = require('cookie');
const rnd = require('rnd');

const auth = require('./auth');

const listen = (a, config, {key, userDb}) => {
  const {
    dirname,
    secure,
    dataDirectory,
    cryptoDirectory,
    installDirectory,
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

  // const protocol = !secure ? http : https;

  /* const hubSpec = (() => {
    const match = hubUrl.match(/^(.+\..+?)(?::([0-9]*?))?$/);
    return match && {
      host: match[1],
      port: match[2] ? parseInt(match[2], 10) : 443,
    };
  })(); */

  const _listenPublic = () => new Promise((accept, reject) => {
    a.app.get('/', (req, res, next) => {
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
    const _tryAuth = (req, tryFn, doneFn) => _tryBody(req, tryFn)
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
    const _tryLogin = req => new Promise((accept, reject) => {
      const _tryToken = token => new Promise((tryAccept, tryReject) => {
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
              const {token, username} = t;

              accept({
                token,
                username,
              });

              tryAccept(true);
            } else {
              if (auth.parseToken({
                key,
                token,
              })) {
                const username = null;
                accept({
                  token,
                  username,
                });

                tryAccept(true);
              } else {
                tryAccept(false);
              }
            }
          } else {
            reject(err);

            tryAccept(true);
          }
        });
      });
      const _failToken = () => {
        const err = new Error('All login methods failed');
        err.code = 'EAUTH';

        reject(err);
      };

      _tryAuth(req, _tryToken, _failToken);
    });

    a.app.post('/server/login', bodyParserJson, (req, res, next) => {
      _tryLogin(req)
        .then(result => {
          const {token, username} = result;

          const _respondOk = ({token, username}) => {
            res.set('Set-Cookie', 'token=' + token + '; HttpOnly');

            res.json({
              token,
              username,
            });
          };

          if (username) {
            _respondOk({
              token,
              username,
            });
          } else {
            const username = [rnd.fakeName(), rnd.fakeName()].join(' ');

            userDb.insert({
              type: 'token',
              token,
              username,
            }, err => {
              if (!err) {
                _respondOk({
                  token,
                  username,
                });
              } else {
                res.status(500);
                res.send();
              }
            });
          }
        })
        .catch(err => {
          console.warn(err);

          res.status(401);
          res.send();
        });
    });
    /* a.app.get('/server/token', (req, res, next) => {
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
    a.app.post('/server/logout', (req, res, next) => {
      _tryLogin(req)
        .then(() => {
          res.set('Set-Cookie', 'token=deleted; expires=Thu, 01 Jan 1970 00:00:00 GMT');
          res.json({
            ok: true,
          });
        })
        .catch(err => {
          console.warn(err);

          res.status(401);
          res.send();
        });
    });
    a.app.post('/server/checkLogin', bodyParserJson, (req, res, next) => {
      res.set('Access-Control-Allow-Origin', '*');

      _tryLogin(req)
        .then(() => {
          res.json({
            ok: true,
          });
        })
        .catch(err => {
          console.warn(err);

          res.json({
            ok: false,
          });
        });
    }); */

    a.app.post('/server/proxyLogin', (req, res, next) => {
      const _respondOk = () => {
        const token = auth.makeToken({
          key,
        });

        res.json({
          token,
        });
      };
      const _respondFail = () => {
        res.status(401);
        res.send();
      };

      if (
        (req.connection.remoteAddress === '127.0.0.1' && req.connection.remoteFamily === 'IPv4') ||
        ((req.connection.remoteAddress === '::1' || req.connection.remoteAddress === '::ffff:127.0.0.1') && req.connection.remoteFamily === 'IPv6')
      ) {
        _respondOk();
      } else {
        _tryLogin(req)
          .then(() => {
            _respondOk();
          })
          .catch(err => {
            console.warn(err);

            _respondFail();
          });
      }
    });

    accept();
  });

  return Promise.all([
    _listenPublic(),
    _listenServer(),
  ])
  .then(() => {});
};

module.exports = {
  listen,
};

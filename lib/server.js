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

  const _tryUrl = (req, tryFn) => {
    const {query} = req;

    if (typeof query.t === 'string' && query.t) {
      const {t: token} = query;

      return tryFn(token);
    } else {
      return Promise.resolve(false);
    }
  };
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
  const _tryAuth = (req, tokenFns, tryFn) => new Promise((accept, reject) => {
    const _recurse = i => {
      if (i < tokenFns.length) {
        const tokenFn = tokenFns[i];

        tokenFn(req, tryFn)
          .then(done => {
            if (done) {
              accept(true);
            } else {
              _recurse(i + 1);
            }
          })
          .catch(reject);
      } else {
        accept(false);
      }
    };
    _recurse(0);
  });
  const _tryGetLogin = req => new Promise((accept, reject) => {
    const _tryToken = token => new Promise((tryAccept, tryReject) => {
      const t = userDb.get().find(j => j.type === 'token' && j.token === token);

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
    });

    _tryAuth(req, [_tryUrl, _tryCookie], _tryToken)
      .then(done => {
        if (!done) {
          const err = new Error('All login methods failed');
          err.code = 'EAUTH';

          reject(err);
        }
      })
      .catch(reject);
  });
  const _tryPostLogin = req => new Promise((accept, reject) => {
    const _tryToken = token => new Promise((tryAccept, tryReject) => {
      const t = userDb.get().find(j => j.type === 'token' && j.token === token);

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
    });

    _tryAuth(req, [_tryUrl, _tryBody, _tryCookie], _tryToken)
      .then(done => {
        if (!done) {
          const err = new Error('All login methods failed');
          err.code = 'EAUTH';

          reject(err);
        }
      })
      .catch(reject);
  });

  const _listenPublic = () => new Promise((accept, reject) => {
    a.app.get('/', (req, res, next) => {
      _tryGetLogin(req)
        .then(() => {
          req.url = '/vr.html';

          a.app(req, res, next);
        })
        .catch(err => {
          if (err.code === 'EAUTH') {
            req.url = '/forbidden.html';
            res.status(403);

            a.app(req, res, next);
          } else {
            res.status(500);
            res.send(err.stack);
          }
        });
    });

    accept();
  });
  const _listenServer = () => new Promise((accept, reject) => {
    a.app.post('/server/login', bodyParserJson, (req, res, next) => {
      _tryPostLogin(req)
        .then(result => {
          const {token, username} = result;

          const _respondOk = ({token, username}) => {
            res.set('Set-Cookie', 'token=' + token + '; HttpOnly');

            const authToken = auth.makeToken({
              key,
            });

            res.json({
              token,
              username,
              authToken,
            });
          };

          if (username) {
            _respondOk({
              token,
              username,
            });
          } else {
            const username = [rnd.fakeName(), rnd.fakeName()].join(' ');

            userDb.get().push({
              type: 'token',
              token,
              username,
            });
            userDb.save();

            _respondOk({
              token,
              username,
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
      _tryPostLogin(req)
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

      _tryPostLogin(req)
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

  return Promise.all([
    _listenPublic(),
    _listenServer(),
  ])
  .then(() => {});
};

module.exports = {
  listen,
};

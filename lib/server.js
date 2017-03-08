const path = require('path');
const fs = require('fs');
const https = require('https');
const child_process = require('child_process');

const mkdirp = require('mkdirp');
const etag = require('etag');
const nedb = require('nedb');
const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();
const cookie = require('cookie');
const rnd = require('rnd');
const equidirectCubemapFaces = require('node-equirect-cubemap-faces');

const auth = require('./auth');
const image = require('./image');

const proceduralartBin = require.resolve('proceduralart');

const listen = (a, config, {key}) => {
  const {dirname, dataDirectory, metadata: {hub: {url: hubUrl, enabled: hubEnabled}, server: {url: serverUrl, worldname: serverWorldname, enabled: serverEnabled, official: serverOfficial}}} = a;

  const imageLib = image.make(a);

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

  return Promise.all([
    _requestUserDb(),
    imageLib.requestServerImages(serverWorldname),
  ])
    .then(([
      userDb,
      {
        iconImg,
        skyboxImg,
        cubeMapImgs,
      },
    ]) => {
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
        const _requestHubCheckLogin = token => fetch('https://' + hubUrl + '/server/checkLogin', {
          method: 'POST',
          body: JSON.stringify({token}),
        })
          .then(res => res.json()
            .then(j => {
              const {ok} = j;
              return ok;
            })
          );

        a.app.post('/server/login', bodyParserJson, (req, res, next) => {
          const _tryToken = token => new Promise((accept, reject) => {
            const _doOk = () => new Promise((accept, reject) => {
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
                    if (serverOfficial && hubSpec) {
                      _requestHubCheckLogin(token)
                        .then(ok => {
                          if (ok) {
                            _doOk();
                          } else  {
                            accept(false);
                          }
                        });
                    } else {
                      accept(false);
                    }
                  }
                }
              } else {
                reject(err);
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
                    if (serverOfficial && hubSpec) {
                      _requestHubCheckLogin(token)
                        .then(ok => {
                          if (ok) {
                            _doOk();
                          } else  {
                            accept(false);
                          }
                        });
                    } else {
                      accept(false);
                    }
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
      };
      const _listenServers = () => {
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
        a.app.get('/servers/img/icon.png', _filterIsServerHostname, (req, res, next) => {
          res.type('image/png');
          res.set('Etag', iconImg.etag);

          res.send(iconImg);
        });
        a.app.get('/servers/img/skybox.png', _filterIsServerHostname, (req, res, next) => {
          res.type('image/png');
          res.set('Etag', skyboxImg.etag);

          res.send(skyboxImg);
        });
        a.app.get(/^\/servers\/img\/cubemap-(top|bottom|left|right|front|back)\.png$/, _filterIsServerHostname, (req, res, next) => {
          const face = req.params[0];
          const cubeMapImg = cubeMapImgs[face];

          res.type('image/png');
          res.set('Etag', cubeMapImg.etag);

          res.send(cubeMapImg);
        });
      };

      _listenPublic();
      _listenServer();
      _listenServers();
    });
};

module.exports = {
  listen,
};

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
  const {express} = a.getCore();

  const serverImagesPath = path.join(dirname, dataDirectory, 'img', 'server');
  const serverImagesIconPath = path.join(serverImagesPath, 'icon');
  const serverImageIconWorldNamePath = path.join(serverImagesIconPath, serverWorldname + '.png');
  const _requestFakeImage = () => new Promise((accept, reject) => {
    https.get('https://www.reddit.com/r/EarthPorn/.json', res => {
      const bs = [];
      res.on('data', d => {
        bs.push(d);
      });
      res.on('end', () => {
        const b = Buffer.concat(bs);
        const s = b.toString('utf8');
        const j = JSON.parse(s);
        accept(j);
      });
    })
    .on('error', reject);
  })
    .then(j => {
      const urls = j.data.children.map(o => o.data.url);
      const validUrls = urls
        .filter(url => /\.(?:png|jpg)$/.test(url))
        .map(url => url.replace(/^http:\/\//, 'https://'));
      const url = validUrls[Math.floor(Math.random() * validUrls.length)];
      return url;
    })
    .then(url => new Promise((accept, reject) => {
      https.get(url, res => {
        const {statusCode} = res;

        if (statusCode >= 200 && statusCode < 300) {
          const resizeStream = sharp()
            .resize(256, 256)
            .png();

          const bs = [];
          resizeStream.on('data', d => {
            bs.push(d);
          });
          resizeStream.on('end', () => {
            const b = Buffer.concat(bs);
            accept(b);
          });

          res.pipe(resizeStream);
        } else {
          const err = new Error('non-zero status code: ' + statusCode);
          reject(err);
        }
      })
      .on('error', reject);
    }));
  const _ensureServerImage = () => new Promise((accept, reject) => {
    fs.lstat(serverImageIconWorldNamePath, err => {
      if (!err) {
        accept();
      } else if (err.code === 'ENOENT') {
        _requestFakeImage()
          .then(d => {
            mkdirp(serverImagesIconPath, err => {
              if (!err) {
                fs.writeFile(serverImageIconWorldNamePath, d, err => {
                  if (!err) {
                    accept();
                  } else {
                    reject(err);
                  }
                });
              } else {
                reject(err);
              }
            });
          })
          .catch(reject);
      } else {
        reject(err);
      }
    });
  });

  return _ensureServerImage()
    .then(() => {
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

        const serverImagesIconStatic = express.static(serverImagesIconPath);
        a.app.get('/servers/img/icon.png', _filterIsServerHostname, (req, res, next) => {
          res.set('Access-Control-Allow-Origin', 'https://' + homeUrl);

          req.url = '/' + serverWorldname + '.png';

          serverImagesIconStatic(req, res, next);
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

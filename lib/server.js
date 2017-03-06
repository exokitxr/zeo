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

const proceduralartBin = require.resolve('proceduralart');

const listen = (a, config, {key}) => {
  const {dirname, dataDirectory, metadata: {hub: {url: hubUrl, enabled: hubEnabled}, server: {url: serverUrl, worldname: serverWorldname, enabled: serverEnabled}}} = a;

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
  const serverImagesPath = path.join(dirname, dataDirectory, 'img', 'server');
  const serverIconImagePath = path.join(serverImagesPath, 'icon', serverWorldname + '.png');
  const serverSkyboxImagePath = path.join(serverImagesPath, 'skybox', serverWorldname + '.png');
  const serverCubemapImagesPath = path.join(serverImagesPath, 'cubemap');
  const _requestServerImages = () => {
    const _requestExists = p => new Promise((accept, reject) => {
      fs.lstat(p, err => {
        if (!err) {
          accept(true);
        } else if (err.code === 'ENOENT') {
          accept(false);
        } else {
          reject(err);
        }
      });
    });

    return Promise.all([
      _requestExists(serverIconImagePath),
      _requestExists(serverSkyboxImagePath),
    ].concat(equidirectCubemapFaces.order.map(face => _requestExists(path.join(serverCubemapImagesPath, serverWorldname + '-' + face + '.png')))))
      .then(existsResults => {
        if (existsResults.every(exists => exists)) {
          const _requestReadImage = srcPath => new Promise((accept, reject) => {
            fs.readFile(srcPath, (err, d) => {
              if (!err) {
                d.etag = etag(d);

                accept(d);
              } else {
                reject(err);
              }
            });
          });
          const _requestReadCubeMapImgs = () => Promise.all(equidirectCubemapFaces.order.map(face => new Promise((accept, reject) => {
            const srcPath = path.join(serverCubemapImagesPath, serverWorldname + '-' + face + '.png');

            fs.readFile(srcPath, (err, d) => {
              if (!err) {
                d.etag = etag(d);

                accept(d);
              } else {
                reject(err);
              }
            });
          })))
            .then(faceImgs => {
              const result = {};
              for (let i = 0; i < faceImgs.length; i++) {
                const faceImg = faceImgs[i];
                result[equidirectCubemapFaces.order[i]] = faceImg;
              }
              return result;
            });

          return Promise.all([
            _requestReadImage(serverIconImagePath),
            _requestReadImage(serverSkyboxImagePath),
            _requestReadCubeMapImgs(),
          ])
            .then(([
              iconImg,
              skyboxImg,
              cubeMapImgs,
            ]) => ({
              iconImg,
              skyboxImg,
              cubeMapImgs,
            }));
        } else {
          const _requestMakeImage = ({
            args,
            dstPath,
          }) => new Promise((accept, reject) => {
            mkdirp(path.dirname(dstPath), err => {
              if (!err) {
                const childProcess = child_process.spawn(process.argv[0], [proceduralartBin].concat(args));
                childProcess.stderr.pipe(process.stderr);

                const ws = fs.createWriteStream(dstPath);
                childProcess.stdout.pipe(ws);

                const bs = [];
                childProcess.stdout.on('data', d => {
                  bs.push(d);
                });

                childProcess.on('close', code => {
                  if (code === 0) {
                    const b = Buffer.concat(bs);
                    b.etag = etag(b);

                    accept(b);
                  } else {
                    const err = new Error('proceduralart exited with non-zero status code: ' + code);
                    reject(err);
                  }
                });
              } else {
                reject(err);
              }
            });
          });
          const _requestMakeCubeMap = img => equidirectCubemapFaces.fromImage(img)
            .then(faceCanvases => Promise.all(faceCanvases.map((faceCanvas, index) => new Promise((accept, reject) => {
              const dstPath = path.join(serverCubemapImagesPath, serverWorldname + '-' + equidirectCubemapFaces.order[index] + '.png');

              mkdirp(path.dirname(dstPath), err => {
                if (!err) {
                  const rs = faceCanvas.pngStream();
                  const ws = fs.createWriteStream(dstPath);

                  rs.pipe(ws);

                  const bs = [];
                  rs.on('data', d => {
                    bs.push(d);
                  });

                  ws.on('finish', () => {
                    const b = Buffer.concat(bs);
                    b.etag = etag(b);

                    accept(b);
                  });

                  rs.on('error', err =>  {
                    reject(err);
                  });
                  ws.on('error', err =>  {
                    reject(err);
                  });
                } else {
                  reject(err);
                }
              });
            })))
              .then(faceImgs => {
                const result = {};
                for (let i = 0; i < faceImgs.length; i++) {
                  const faceImg = faceImgs[i];
                  result[equidirectCubemapFaces.order[i]] = faceImg;
                }
                return result;
              })
            );

          console.warn('Generating server identity -- this might take a minute...');

          return Promise.all([
            {
              args: [serverWorldname, String(64), 'icon'],
              dstPath: serverIconImagePath,
            },
            {
              args: [serverWorldname, String(4096), 'skybox'],
              dstPath: serverSkyboxImagePath,
            },
          ].map(_requestMakeImage))
            .then(([
              iconImg,
              skyboxImg,
            ]) => _requestMakeCubeMap(skyboxImg)
              .then(cubeMapImgs => {
                console.warn('Done generating server identity.');

                return {
                  iconImg,
                  skyboxImg,
                  cubeMapImgs,
                };
              })
            );
        }
      })
  };

  return Promise.all([
    _requestUserDb(),
    _requestServerImages(),
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

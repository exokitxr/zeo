const path = require('path');
const fs = require('fs');

const mkdirp = require('mkdirp');
const ncp = require('ncp');
const mv = require('mv');
const rimraf = require('rimraf');

class Fs {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const cleanups = [];
    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };
    let live = true;
    cleanups.push(() => {
      live = false;
    });

    const fsPath = path.join(__dirname, '..', '..', '..', 'data', 'fs');
    const _ensureFsDirectory = () => new Promise((accept, reject) => {
      mkdirp(fsPath, err => {
        if (!err) {
          accept();
        } else {
          reject(err);
        }
      });
    });

    return _ensureFsDirectory()
      .then(() => {
        if (live) {
          function serveFsList(req, res, next) {
            const p = req.params[0];

            if (req.get('Accept') === 'application/json') {
              const requestPath = path.join(fsPath, p);

              fs.readdir(requestPath, (err, files) => {
                if (!err) {
                  if (files.length > 0) {
                    const result = files.map(name => ({
                      name,
                      type: null,
                      size: null,
                    }));

                    let pending = files.length;
                    function pend() {
                      if (--pending === 0) {
                        res.json(result);
                      }
                    }

                    files.forEach((file, i) => {
                      fs.lstat(path.join(requestPath, file), (err, stats) => {
                        if (!err) {
                          const type = (() => {
                            if (stats.isFile()) {
                              return 'file';
                            } else if (stats.isDirectory()) {
                              return 'directory';
                            } else {
                              return null;
                            }
                          })();
                          const {size} = stats;

                          const fileSpec = result[i];
                          fileSpec.type = type;
                          fileSpec.size = size;
                        } else {
                          console.warn(err);
                        }

                        pend();
                      });
                    });
                  } else {
                    res.json([]);
                  }
                } else if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
                  res.json([]);
                } else {
                  res.status(500);
                  res.send(err.stack);
                }
              });
            } else {
              next();
            }
          }
          app.get(/^\/archae\/fs(\/.*)$/, serveFsList);
          const fsStatic = express.static(fsPath);
          function serveFsStatic(req, res, next) {
            fsStatic(req, res, next);
          }
          app.use('/archae/fs', serveFsStatic);
          function serveFsUpload(req, res, next) {
            const p = req.params[0];

            const ws = fs.createWriteStream(path.join(fsPath, p));
            req.pipe(ws);
            ws.on('finish', () => {
              res.send();
            });
            ws.on('error', err => {
              res.status(500);
              res.send(err.stack);
            });
          }
          app.put(/^\/archae\/fs(\/.*)$/, serveFsUpload);
          function serveFsCreate(req, res, next) {
            const p = req.params[0];

            mkdirp(path.join(fsPath, p), err => {
              if (!err) {
                res.send();
              } else {
                res.status(500);
                res.send(err.stack);
              }
            });
          }
          app.post(/^\/archae\/fs(\/.*)$/, serveFsCreate);
          function serveFsCopy(req, res, next) {
            const src = req.params[0];
            const dst = req.get('To');

            ncp(path.join(fsPath, src), path.join(fsPath, dst), err => {
              if (!err) {
                res.send();
              } else {
                res.status(500);
                res.send(err.stack);
              }
            });
          }
          app.copy(/^\/archae\/fs(\/.*)$/, serveFsCopy);
          function serveFsMove(req, res, next) {
            const src = req.params[0];
            const dst = req.get('To');

            mv(path.join(fsPath, src), path.join(fsPath, dst), err => {
              if (!err) {
                res.send();
              } else {
                res.status(500);
                res.send(err.stack);
              }
            });
          }
          app.move(/^\/archae\/fs(\/.*)$/, serveFsMove);
          function serveFsDelete(req, res, next) {
            const p = req.params[0];

            rimraf(path.join(fsPath, p), err => {
              if (!err) {
                res.send();
              } else {
                res.status(500);
                res.send(err.stack);
              }
            });
          }
          app.delete(/^\/archae\/fs(\/.*)$/, serveFsDelete);

          cleanups.push(() => {
            function removeMiddlewares(route, i, routes) {
              if (
                route.handle.name === 'serveFsList' ||
                route.handle.name === 'serveFsStatic' ||
                route.handle.name === 'serveFsUpload' ||
                route.handle.name === 'serveFsCreate' ||
                route.handle.name === 'serveFsCopy' ||
                route.handle.name === 'serveFsMove' ||
                route.handle.name === 'serveFsDelete'
              ) {
                routes.splice(i, 1);
              }
              if (route.route) {
                route.route.stack.forEach(removeMiddlewares);
              }
            }
            app._router.stack.forEach(removeMiddlewares);
          });
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Fs;

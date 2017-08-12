const path = require('path');
const fs = require('fs');

const mkdirp = require('mkdirp');
const murmur = require('murmurhash');

class Fs {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app, dirname, dataDirectory} = archae.getCore();

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

    const fsPath = path.join(dirname, dataDirectory, 'fs');
    const _ensureDirectory = p => new Promise((accept, reject) => {
      mkdirp(p, err => {
        if (!err) {
          accept();
        } else {
          reject(err);
        }
      });
    });

    return _ensureDirectory(fsPath)
      .then(() => {
        if (live) {
          const fsStatic = express.static(fsPath);
          function serveFsDownload(req, res, next) {
            const fileName = req.params[0] === 'name' ? String(murmur(req.params[1])) : req.params[1];
            req.url = '/' + fileName;
            fsStatic(req, res, next);
          }
          app.get(/^\/archae\/fs\/(name|hash)\/([^\/]+)$/, serveFsDownload);

          function serveFsUpload(req, res, next) {
            const fileName = req.params[0] === 'name' ? String(murmur(req.params[1])) : req.params[1];
            const ws = fs.createWriteStream(path.join(fsPath, fileName));
            req.pipe(ws);
            ws.on('finish', err => {
              res.send();
            });
            ws.on('error', err => {
              res.status(500);
              res.json({
                error: err.stack,
              });
            });
          }
          app.put(/^\/archae\/fs\/(name|hash)\/([^\/]+)$/, serveFsUpload);

          cleanups.push(() => {
            function removeMiddlewares(route, i, routes) {
              if (
                route.handle.name === 'serveFsDownload' ||
                route.handle.name === 'serveFsUpload'
              ) {
                routes.splice(i, 1);
              }
              if (route.route) {
                route.route.stack.forEach(removeMiddlewares);
              }
            }
            app._router.stack.forEach(removeMiddlewares);
          });

          /* class FsFile {
            constructor(dirname, pathname) {
              this.dirname = dirname;
              this.pathname = pathname;
            }

            getPath() {
              const {dirname, pathname} = this;
              return path.join(fsPath, dirname, pathname);
            }

            createReadStream() {
              return fs.createReadStream(this.getPath());
            }

            createWriteStream(opts) {
              return fs.createWriteStream(this.getPath(), opts);
            }

            read(opts) {
              return new Promise((accept, reject) => {
                fs.readFile(this.getPath(), opts, (err, result) => {
                  if (!err) {
                    accept(result);
                  } else {
                    reject(err);
                  }
                });
              });
            }

            write(data, opts) {
              return new Promise((accept, reject) => {
                fs.writeFile(this.getPath(), data, opts, (err, result) => {
                  if (!err) {
                    accept(result);
                  } else {
                    reject(err);
                  }
                });
              });
            }
          }

          const _makeFile = (dirname, pathname) => new FsFile(dirname, pathname);

          return {
            makeFile: _makeFile,
          }; */
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Fs;

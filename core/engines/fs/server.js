const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

const mkdirp = require('mkdirp');
const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();
const rangeParser = require('range-parser');
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
            const rangeString = req.get('Range');
            const range = rangeString && rangeParser(Infinity, rangeString);
            const start = Array.isArray(range) ? range[0].start : 0;
            const ws = fs.createWriteStream(path.join(fsPath, fileName), {
              flags: 'a+',
              start,
            });
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

          // copy file from local server to remote storage
          function serveRemotizeFile(req, res, next) {
            bodyParserJson(req, res, () => {
              if (req.body && req.body.file && req.body.file.id && typeof req.body.file.id === 'number' && req.body.file.name && typeof req.body.file.name === 'string') {
                const id = String(req.body.file.id);
                const rs = fs.createReadStream(path.join(fsPath, id));
                rs.on('error', err => {
                  res.status(500);
                  res.json({
                    error: err.stack,
                  });
                });
                const proxyReq = https.request({
                  method: 'PUT',
                  host: 'my-site.zeovr.io',
                  path: `/files/${id}`,
                });
                proxyReq.on('error', err => {
                  res.status(500);
                  res.json({
                    error: err.stack,
                  });
                });
                proxyReq.on('finish', () => {
                  res.json({});
                });
                rs.pipe(proxyReq);
              } else {
                res.status(400);
                res.json({
                  error: new Error('invalid arguments').stack,
                });
              }
            });
          }
          app.post('/archae/fs/remotizeFile', serveRemotizeFile);

          this._cleanup = () => {
            browser.close();

            clearInterval(interval);

            function removeMiddlewares(route, i, routes) {
              if (
                route.handle.name === 'serveRendImg' ||
                route.handle.name === 'serveSearch' ||
                route.handle.name === 'serveMods'
              ) {
                routes.splice(i, 1);
              }
              if (route.route) {
                route.route.stack.forEach(removeMiddlewares);
              }
            }
            app._router.stack.forEach(removeMiddlewares);
          };

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

          class RemoteFile {
            constructor(id) {
              this.n = id !== undefined ? (typeof id === 'number' ? id : murmur(id)) : _makeN();
            }

            getPath() {
              return path.join(fsPath, String(this.n));
            }

            /* readAsBlob() {
              return fetch(this.getUrl(), {
                credentials: 'include',
              }).then(_resBlob);
            }

            readAsArrayBuffer() {
              return fetch(this.getUrl(), {
                credentials: 'include',
              }).then(_resArrayBuffer);
            } */

            readAsJson() {
              return new Promise((accept, reject) => {
                fs.readFile(this.getPath(), 'utf8', (err, s) => {
                  if (!err) {
                    accept(JSON.parse(s));
                  } else {
                    reject(err);
                  }
                });
              });
            }

            write(d) {
              return new Promise((accept, reject) => {
                fs.writeFile(this.getPath(), d, err => {
                  if (!err) {
                    accept();
                  } else {
                    reject(err);
                  }
                });
              });
            }
          }

          return {
            makeRemoteFile(id) {
              return new RemoteFile(id);
            },
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}
const _makeN = () => {
  const buffer = crypto.randomBytes(4);
  const array = new Uint32Array(buffer.buffer, buffer.byteOffset, 1);
  return array[0];
};

module.exports = Fs;

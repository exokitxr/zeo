const path = require('path');
const fs = require('fs');

const zeode = require('zeode');

class Objects {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {dirname, dataDirectory} = archae;
    const {express, ws, app, wss} = archae.getCore();

    const zeodeDataPath = path.join(dirname, dataDirectory, 'zeode.dat');

    const _getZeode = () => new Promise((accept, reject) => {
      fs.readFile(zeodeDataPath, (err, b) => {
        if (!err || err.code === 'ENOENT') {
          const z = zeode();
          if (b) {
            z.load(b);
          }
          accept(z);
        } else {
          reject(err);
        }
      });
    });

    return _getZeode()
      .then(z => {
        const _writeFileData = (data, byteOffset) => new Promise((accept, reject) => {
          const ws = fs.createWriteStream(zeodeDataPath, {
            flags: 'a',
            start: byteOffset,
          });
          ws.end(data);
          ws.on('finish', () => {
            accept();
          });
          ws.on('error', err => {
            reject(err);
          });
        });
        const _saveChunks = _debounce(next => {
          const promises = [];
          z.save(byteOffset, datas => {
            for (let i = 0; i < datas.length; i++) {
              const data = datas[i];
              promises.push(_writeFileData(data, byteOffset));
              byteOffset += data.length * 4;
            }
          });
          Promise.all(promises)
            .then(() => {
              next();
            })
            .catch(err => {
              console.warn(err);

              next();
            });
        });

        const objectsImgStatic = express.static(path.join(__dirname, 'lib', 'img'));
        function serveObjectsImg(req, res, next) {
          objectsImgStatic(req, res, next);
        }
        app.use('/archae/objects/img', serveObjectsImg);

        const connections = [];
        const _connection = c => {
          const {url} = c.upgradeReq;

          if (url === '/archae/objectsWs') {
            const _broadcast = m => {
              for (let i = 0; i < connections.length) {
                const connection = connections[i];
                if (connection.readyState === ws.OPEN && connection !== c) {
                  connection.send(m);
                }
              }
            };

            c.on('message', msg => {
              const m = JSON.parse(msg);
              const {method} = m;

              if (method === 'getChunk') {
                const {args: {x, y}} = m;

                const chunk = z.getChunk(x, y);
                c.send(JSON.stringify({
                  type: 'response',
                }));
                c.send(chunk ? chunk.getBuffer() : null);
              } else if (method === 'addObject') {
                const {args: {x, y, n, position}} = m;

                const chunk = z.getChunk(x, y);
                if (chunk) {
                  chunk.addObject(n, position);
                }

                _saveChunks();

                _broadcast({
                  type: 'addObject',
                  x,
                  y,
                  n,
                  position,
                });
              } else if (method === 'removeObject') {
                const {args: {index}} = m;

                const chunk = z.getChunk(x, y);
                if (chunk) {
                  chunk.removeObject(index);
                }

                _saveChunks();

                _broadcast({
                  type: 'removeObject',
                  index,
                });
              } else {
                console.warn('objects server got unknown method:', JSON.stringify(method));
              }
            });
            c.on('close', () => {
              connections.splice(connections.indexOf(c), 1);
            });

            connections.push(c);
          }
        };
        wss.on('connection', _connection);

        this._cleanup = () => {
          function removeMiddlewares(route, i, routes) {
            if (route.handle.name === 'serveObjectsImg') {
              routes.splice(i, 1);
            }
            if (route.route) {
              route.route.stack.forEach(removeMiddlewares);
            }
          }
          app._router.stack.forEach(removeMiddlewares);

          for (let i = 0; i < connections.length; i++) {
            const c = connections[i];
            c.close();
          }
          wss.removeListener('connection', _connection);
        };
      });
  }

  unmount() {
    this._cleanup();
  }
}
const _debounce = fn => {
  let running = false;
  let queued = false;

  const _go = () => {
    if (!running) {
      running = true;

      fn(() => {
        running = false;

        if (queued) {
          queued = false;

          _go();
        }
      });
    } else {
      queued = true;
    }
  };
  return _go;
};

module.exports = Objects;

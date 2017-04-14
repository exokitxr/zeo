const path = require('path');

const MultiMutex = require('multimutex');

class Draw {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app, wss} = archae.getCore();
    const {world, fs} = zeo;

    const tagsJson = world.getTags();

    const filesMutex = new MultiMutex();

    const drawBrushesStatic = express.static(path.join(__dirname, 'brushes'));
    function serveDrawBrushes(req, res, next) {
      drawBrushesStatic(req, res, next);
    }
    app.use('/archae/draw/brushes', serveDrawBrushes);

    const _requestDrawIdFile = drawId => new Promise((accept, reject) => {
      const paperEntityTag = (() => {
        const tagIds = Object.keys(tagsJson);

        for (let i = 0; i < tagIds.length; i++) {
          const tagId = tagIds[i];
          const tagJson = tagsJson[tagId];
          const {type, name} = tagJson;

          if (type === 'entity' && name === 'paper') {
            const {attributes} = tagJson;
            const {'paper-id': paperId} = attributes;

            if (paperId) {
              const {value: paperIdValue} = paperId;

              if (paperIdValue === drawId) {
                return tagJson;
              }
            }
          }
        }

        return null;
      })();
      if (paperEntityTag) {
        const {attributes} = paperEntityTag;
        const {file: fileAttribute} = attributes;

        if (fileAttribute) {
          const {value} = fileAttribute;
          const match = (value || '').match(/^fs\/([^\/]+)(\/.*)$/)

          if (match) {
            const id = match[1];
            const path = match[2];

            const file = fs.makeFile(id, path);
            accept(file);
          } else {
            accept(null); // non-local files cannot be served
          }
        } else {
          accept(null);
        }
      } else {
        accept(null);
      }
    });

    const connections = [];

    const _broadcastUpdate = ({peerId, drawId, x, y, width, height, data}) => {
      const e = {
        type: 'drawSpec',
        drawId: drawId,
        x: x,
        y: y,
        width: width,
        height: height,
      };
      const es = JSON.stringify(e);

      for (let i = 0; i < connections.length; i++) {
        const connection = connections[i];
        // if (connection.peerId !== peerId) { // XXX block this to only go through for non-same peers
          connection.send(es);
          connection.send(data);
        // }
      }
    };
    const _saveUpdate = ({drawId, x, y, width, height, data}) => {
      filesMutex.lock(drawId)
        .then(unlock => {
          _requestDrawIdFile(drawId)
            .then(file => {
              if (file) {
                const start = ((y * width) + x) * 4;

                const ws = file.createWriteStream({
                  flags: 'r+',
                  start: start,
                });
                ws.end(data);
                /* ws.on('finish', () => {
                  // write ok
                }); */
                ws.on('error', err => {
                  console.warn(err);
                });
              } else {
                console.warn('draw server could not find file for saving for draw id', {drawId});
              }
            })
            .then(() => {
              unlock();
            })
            .catch(err => {
              console.warn(err);

              unlock();
            });
        });
    };

    wss.on('connection', c => {
      const {url} = c.upgradeReq;

      let match;
      if (match = url.match(/^\/archae\/drawWs\?peerId=(.+?)&drawId=(.+?)$/)) {
        const peerId = decodeURIComponent(match[1]);
        const drawId = decodeURIComponent(match[2]);

        const _sendInit = () => {
          _requestDrawIdFile(drawId)
            .then(file => {
              if (file) {
                return file.read()
                  .then(data => {
                    const numPixels = data.length / 4;
                    const width = Math.sqrt(numPixels);

                    if (width === Math.floor(width)) {
                      const height = width;

                      _broadcastUpdate({
                        peerId,
                        drawId,
                        x: 0,
                        y: 0,
                        width,
                        height,
                        data,
                      });
                    } else {
                      console.warn('draw server read paper file with illegal length', {drawId, dataLength: data.length});
                    }
                  });
              } else {
                console.warn('draw server could not find file for loading for draw id', {drawId});
              }
            })
            .catch(err => {
              console.warn(err);
            });
        };
        _sendInit();

        c.peerId = peerId;

        let currentDrawSpec = null;
        c.on('message', (msg, flags) => {
          if (flags.binary) {
            if (currentDrawSpec !== null) {
              const {x, y, width, height} = currentDrawSpec;
              const data = msg;

              _broadcastUpdate({
                peerId,
                drawId,
                x,
                y,
                width,
                height,
                data,
              });

              _saveUpdate({
                drawId,
                x,
                y,
                width,
                height,
                data,
              });
            } else {
              console.warn('draw received data before draw spec');
            }
          } else {
            const m = JSON.parse(msg);

            if (m && typeof m === 'object' && ('type' in m)) {
              const {type} = m;

              if (type === 'drawSpec') {
                const {x, y, width, height} = m;

                currentDrawSpec = {
                  x,
                  y,
                  width,
                  height,
                };
              } else {
                console.warn('draw invalid message type', {type});
              }
            } else {
              console.warn('draw invalid message', {msg});
            }
          }
        });
        c.on('close', () => {
          connections.splice(connections.indexOf(c), 1);
        });

        connections.push(c);
      }
    });

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveDrawBrushes') {
          routes.splice(i, 1);
        }
        if (route.route) {
          route.route.stack.forEach(removeMiddlewares);
        }
      }
      app._router.stack.forEach(removeMiddlewares);

      for (let i = 0; i < connections.length; i++) {
        const connection = connections[i];
        connection.close();
      }
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Draw;

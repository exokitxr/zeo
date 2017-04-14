const path = require('path');

class Draw {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app, wss} = archae.getCore();
    const {world, fs} = zeo;

    const tagsJson = world.getTags();

    const drawBrushesStatic = express.static(path.join(__dirname, 'brushes'));
    function serveDrawBrushes(req, res, next) {
      drawBrushesStatic(req, res, next);
    }
    app.use('/archae/draw/brushes', serveDrawBrushes);

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
        // if (connection.peerId !== peerId) { // XXX block this to only go through
          connection.send(es);
          connection.send(data);
        // }
      }
    };

    wss.on('connection', c => {
      const {url} = c.upgradeReq;

      let match;
      if (match = url.match(/^\/archae\/drawWs\?peerId=(.+?)&drawId=(.+?)$/)) {
        const peerId = decodeURIComponent(match[1]);
        const drawId = decodeURIComponent(match[2]);

        const _sendInit = () => {
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
                file.read('utf8')
                  .then(data => {
                    console.log('initial read draw file', data.length); // XXX actually serve this to the frontend
                  })
                  .catch(err => {
                    console.warn(err);
                  });
              } else {
                // non-local files cannot be served
              }
            } else {
              console.warn('draw server no paper file to send', {paperEntityTag});
            }
          } else {
            console.warn('draw server no paper entity tag to send', {drawId});
          }

          /* const e = {
            type: 'init',
            statuses: _getAllStatuses(),
          };
          const es = JSON.stringify(e);
          c.send(es); */
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

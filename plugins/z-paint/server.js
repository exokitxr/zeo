const path = require('path');

class ZPaint {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app, wss} = archae.getCore();

    const zPaintBrushesStatic = express.static(path.join(__dirname, 'brushes'));
    function serveZPaintBrushes(req, res, next) {
      zPaintBrushesStatic(req, res, next);
    }
    app.use('/archae/z-paint/brushes', serveZPaintBrushes);

    const connections = [];

    const _broadcastUpdate = ({peerId, paintId, x, y, width, height, data, force = false}) => {
      const e = {
        type: 'paintSpec',
        paintId: paintId,
        x: x,
        y: y,
        width: width,
        height: height,
      };
      const es = JSON.stringify(e);

      for (let i = 0; i < connections.length; i++) {
        const connection = connections[i];
        if (connection.peerId !== peerId || force) {
          connection.send(es);
          connection.send(data);
        }
      }
    };

    wss.on('connection', c => {
      const {url} = c.upgradeReq;

      let match;
      if (match = url.match(/^\/archae\/paintWs\?peerId=(.+?)&paintId=(.+?)$/)) {
        const peerId = decodeURIComponent(match[1]);
        const paintId = decodeURIComponent(match[2]);

        const _sendInit = () => {
        };
        _sendInit();

        c.peerId = peerId;

        let currentDrawSpec = null;
        c.on('message', (msg, flags) => {
          if (flags.binary) {
            if (currentDrawSpec !== null) {
              const {x, y, width, height, canvasWidth, canvasHeight} = currentDrawSpec;
              const data = msg;

              _broadcastUpdate({
                peerId,
                paintId,
                x,
                y,
                width,
                height,
                canvasWidth,
                canvasHeight,
                data,
              });

              _saveUpdate({
                paintId,
                x,
                y,
                width,
                height,
                canvasWidth,
                canvasHeight,
                data,
              });
            } else {
              console.warn('paint received data before paint spec');
            }
          } else {
            const m = JSON.parse(msg);

            if (m && typeof m === 'object' && ('type' in m)) {
              const {type} = m;

              if (type === 'paintSpec') {
                const {x, y, width, height, canvasWidth, canvasHeight} = m;

                currentDrawSpec = {
                  x,
                  y,
                  width,
                  height,
                  canvasWidth,
                  canvasHeight,
                };
              } else {
                console.warn('paint invalid message type', {type});
              }
            } else {
              console.warn('paint invalid message', {msg});
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
        if (route.handle.name === 'serveZPaintBrushes') {
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

module.exports = ZPaint;

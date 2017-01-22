const path = require('path');

class Multiplayer {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app, wss} = archae.getCore();

    const connections = [];
    const statuses = new Map();

    const hmdModelStatic = express.static(path.join(__dirname, 'models', 'hmd'));
    const controllerModelStatic = express.static(path.join(__dirname, 'models', 'controller'));
    function serveHmdModel(req, res, next) {
      hmdModelStatic(req, res, next);
    }
    app.use('/archae/models/hmd', serveHmdModel);
    function serveControllerModel(req, res, next) {
      controllerModelStatic(req, res, next);
    }
    app.use('/archae/models/controller', serveControllerModel);

    const _getAllStatuses = () => {
      const result = [];

      statuses.forEach((status, id) => {
        result.push({
          id,
          status,
        });
      });

      return result;
    };

    wss.on('connection', c => {
      const {url} = c.upgradeReq;
      if (url === '/archae/multiplayer') {
        const remoteAddress = c.upgradeReq.connection.remoteAddress.replace(/^::ffff:/, '');
        console.log('multiplayer connection', remoteAddress);

        const id = _makeId();

        const _sendInit = () => {
          const e = {
            type: 'init',
            id: id,
            statuses: _getAllStatuses(),
          };
          const es = JSON.stringify(e);
          c.send(es);
        };
        _sendInit();

        c.on('message', s => {
          const m = JSON.parse(s);
          if (typeof m === 'object' && m && m.type === 'status' && ('status' in m)) {
            const {status} = m;

            statuses.set(id, status);

            const e = {
              type: 'status',
              id,
              status,
            };
            const es = JSON.stringify(e);
            for (let i = 0; i < connections.length; i++) {
              const connection = connections[i];
              if (connection !== c) {
                connection.send(es);
              }
            }
          }
        });
        c.on('close', () => {
          statuses.delete(id);

          const e = {
            type: 'status',
            id,
            status: null,
          };
          const es = JSON.stringify(e);
          for (let i = 0; i < connections.length; i++) {
            const connection = connections[i];
            if (connection !== c) {
              connection.send(es);
            }
          }

          connections.splice(connections.indexOf(c), 1);
        });

        connections.push(c);
      }
    });

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveHmdModel' || route.handle.name === 'serveControllerModel') {
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

const _makeId = () => Math.random().toString(36).substring(7);

module.exports = Multiplayer;

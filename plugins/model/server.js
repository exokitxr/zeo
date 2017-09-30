const path = require('path');

class Model {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app, ws, wss} = archae.getCore();

    /* const modelsStatic = express.static(path.join(__dirname, 'models'));
    function serveModels(req, res, next) {
      modelsStatic(req, res, next);
    }
    app.use('/archae/models/models', serveModels); */

    const models = [];

    const connections = [];
    const _connection = c => {
      const {url} = c.upgradeReq;

      if (url === '/archae/modelWs') {
        for (let i = 0; i < models.length; i++) {
          const {value, position} = models[i];
          c.send(JSON.stringify({
            type: 'model',
            value,
            position,
          }));
        }

        c.on('message', msg => {
          const m = JSON.parse(msg);
          const {type} = m;
          if (type === 'model') {
            const {value, position} = m;
            models.push({value, position});
          }

          for (let i = 0; i < connections.length; i++) {
            const connection = connections[i];
            if (connection !== c) {
              connection.send(msg);
            }
          }
        });

        connections.push(c);
        c.on('close', () => {
          connections.splice(connections.indexOf(c), 1);
        });
      }
    };
    wss.on('connection', _connection);

    this._cleanup = () => {
      /* function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveModels') {
          routes.splice(i, 1);
        }
        if (route.route) {
          route.route.stack.forEach(removeMiddlewares);
        }
      }
      app._router.stack.forEach(removeMiddlewares); */

      wss.removeListener('connection', _connection);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Model;

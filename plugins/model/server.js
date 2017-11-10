const path = require('path');

class Model {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app, ws, wss} = archae.getCore();

    const models = {};

    const connections = [];
    const _connection = (c, {url}) => {
      if (url === '/archae/modelWs') {
        for (const index in models) {
          const model = models[index];
          if (model) {
            const {id, value, position} = model;
            c.send(JSON.stringify({
              type: 'model',
              value,
              position,
            }));
          }
        }

        c.on('message', msg => {
          const m = JSON.parse(msg);
          const {type} = m;
          if (type === 'add') {
            const {id, value, position} = m;
            models[id] = {id, value, position};
          } else if (type === 'remove') {
            const {id} = m;
            models[id] = null;
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
      wss.removeListener('connection', _connection);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Model;

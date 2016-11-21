class Multiplayer {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {wss} = archae.getCore();

    const connections = [];
    const statuses = new Map();

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
      if (url === '/archae/multiplayerWs') {
        const id = _makeId();

        const e = {
          type: 'statuses',
          statuses: _getAllStatuses(),
        };
        const es = JSON.stringify(e);
        c.send(es);

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
      for (let i = 0; i < connections.length; i++) {
        const connection = connections[i];
        connection.close();
      }
      connections = [];
    };
  }

  unmount() {
    this._cleanup();
  }
}

const _makeId = () => Math.random().toString(36).substring(7);

module.exports = Multiplayer;

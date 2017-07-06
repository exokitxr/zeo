const path = require('path');

class Multiplayer {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, ws, app, wss} = archae.getCore();
    const {metadata: {maxUsers, transient}} = archae;

    const connections = [];
    const statuses = new Map();

    function serverMultiplayerStatuses(req, res, next) {
      res.json({
        statuses: _getAllStatuses(),
      });
    }
    app.get('/archae/multiplayer/statuses.json', serverMultiplayerStatuses);

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

    class Status {
      constructor(username, hmd, controllers, metadata) {
        this.username = username;
        this.hmd = hmd;
        this.controllers = controllers;
        this.metadata = metadata;
      }
    }

    wss.on('connection', c => {
      const {url} = c.upgradeReq;

      let match;
      if (match = url.match(/^\/archae\/multiplayerWs\?id=(.+?)&address=(.+?)&username=(.+?)$/)) {
        if (connections.length < maxUsers) {
          const id = decodeURIComponent(match[1]);
          const address = decodeURIComponent(match[2]);
          const username = decodeURIComponent(match[3]);

          const remoteAddress = c.upgradeReq.connection.remoteAddress.replace(/^::ffff:/, '');
          console.log('multiplayer connection', {id, address, username, remoteAddress});

          const _sendInit = () => {
            const e = {
              type: 'init',
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
              const {hmd, controllers, metadata} = status;

              let newStatus = statuses.get(id);
              const hadStatus = Boolean(newStatus);
              if (hadStatus) {
                newStatus.hmd = hmd;
                newStatus.controllers = controllers;
                newStatus.metadata = metadata;
              } else {
                newStatus = new Status(username, hmd, controllers, metadata);
                statuses.set(id, newStatus);
              }

              const statusUpdate = {
                username: username,
                hmd: newStatus.hmd,
                controllers: newStatus.controllers,
                metadata: newStatus.metadata,
              };
              const e = {
                type: 'status',
                id,
                status: statusUpdate,
              };
              const es = JSON.stringify(e);
              for (let i = 0; i < connections.length; i++) {
                const connection = connections[i];
                if (connection.readyState === ws.OPEN && connection !== c) {
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
              if (connection.readyState === ws.OPEN && connection !== c) {
                connection.send(es);
              }
            }

            connections.splice(connections.indexOf(c), 1);
          });

          connections.push(c);
        } else {
          connection.close();
        }
      }
    });

    const _getNumUsers = () => connections.length;

    transient.multiplayer = {
      getNumUsers: _getNumUsers,
    };

    this._cleanup = () => {
      for (let i = 0; i < connections.length; i++) {
        const connection = connections[i];
        connection.close();
      }

      delete transient.multiplayer;
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Multiplayer;

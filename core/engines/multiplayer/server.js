const events = require('events');
const {EventEmitter} = events;
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
    const skins = new Map();

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
    const _getAllSkins = () => {
      const result = [];
      skins.forEach((status, id) => {
        result.push({
          id,
          skinImgBuffer,
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

            skins.forEach((skinImgBuffer, id) => {
              const e = {
                type: 'skin',
                id: id,
              };
              const es = JSON.stringify(e);
              c.send(es);
              c.send(skinImgBuffer);
            });
          };
          _sendInit();

          // let pendingMessage = null;

          c.on('message', o => {
            if (typeof o === 'string') {
              const m = JSON.parse(o);
              const {type} = m;

              if (type === 'status') {
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

                if (!hadStatus) {
                  multiplayerApi.emit('playerEnter', {
                    id: id,
                    address: address,
                    status: newStatus,
                  });
                }
              } else if (type === 'skin') {
                // pendingMessage = m;
              } else {
                console.warn('multiplayer unknown message type', JSON.stringify(type));
              }
            } else {
              const skinImgBuffer = o;
              skins.set(id, skinImgBuffer);

              const e = {
                type: 'skin',
                id,
              };
              const es = JSON.stringify(e);
              for (let i = 0; i < connections.length; i++) {
                const connection = connections[i];
                if (connection.readyState === ws.OPEN && connection !== c) {
                  connection.send(es);
                  connection.send(skinImgBuffer);
                }
              }

              // pendingMessage = null;
            }
          });
          c.on('close', () => {
            statuses.delete(id);
            skins.delete(id);

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

            multiplayerApi.emit('playerLeave', {id, address});
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

    const multiplayerApi = new EventEmitter();
    return multiplayerApi;
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Multiplayer;

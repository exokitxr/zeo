const events = require('events');
const {EventEmitter} = events;
const path = require('path');

const protocolUtils = require('./lib/utils/protocol-utils');

class Multiplayer {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, ws, app, wss} = archae.getCore();
    const {metadata: {maxUsers, transient}} = archae;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/engines/resource',
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/utils/js-utils',
      '/core/utils/network-utils',
      '/core/utils/skin-utils',
    ]).then(([
      three,
    ]) => {
      if (live) {
        const {THREE} = three;

        const zeroVector = new THREE.Vector3();
        const zeroQuaternion = new THREE.Quaternion();
        const oneVector = new THREE.Vector3(1, 1, 1);

        const buffer = new ArrayBuffer(protocolUtils.BUFFER_SIZE);

        const connections = [];
        const statuses = new Map();
        const usernames = new Map();
        const skins = new Map();

        const _makePlayerStatus = () => ({
          hmd: {
            position: zeroVector.clone(),
            rotation: zeroQuaternion.clone(),
            scale: oneVector.clone(),
          },
          gamepads: {
            left: {
              position: zeroVector.clone(),
              rotation: zeroQuaternion.clone(),
              scale: oneVector.clone(),
            },
            right: {
              position: zeroVector.clone(),
              rotation: zeroQuaternion.clone(),
              scale: oneVector.clone(),
            },
          },
          metadata: {
            menu: {
              open: false,
              position: zeroVector.clone(),
              rotation: zeroQuaternion.clone(),
              scale: oneVector.clone(),
            },
          },
        });

        wss.on('connection', c => {
          const {url} = c.upgradeReq;

          let match;
          if (match = url.match(/^\/archae\/multiplayerWs\?id=(.+?)&address=(.+?)&username=(.+?)$/)) {
            if (connections.length < maxUsers) {
              const n = parseInt(match[1], 10);
              const address = decodeURIComponent(match[2]);
              const username = decodeURIComponent(match[3]);

              const remoteAddress = c.upgradeReq.connection.remoteAddress.replace(/^::ffff:/, '');
              console.log('multiplayer connection', {n, address, username, remoteAddress});

              const _init = () => {
                statuses.forEach((status, n) => {
                  c.send(JSON.stringify({
                    type: 'playerEnter',
                    n,
                    username: usernames.get(n),
                  }));

                  protocolUtils.stringifyUpdate(n, status, buffer, 0);
                  c.send(buffer);
                });
                skins.forEach((skinImgBuffer, n) => {
                  c.send(JSON.stringify({
                    type: 'setSkin',
                    n: n,
                  }));
                  c.send(skinImgBuffer);
                });

                statuses.set(n, _makePlayerStatus());
                usernames.set(n, username);

                const es = JSON.stringify({
                  type: 'playerEnter',
                  n,
                  username,
                });
                for (let i = 0; i < connections.length; i++) {
                  const connection = connections[i];
                  if (connection.readyState === ws.OPEN && connection !== c) {
                    connection.send(es);
                  }
                }

                multiplayerApi.emit('playerEnter', {
                  id: n,
                  address,
                  username,
                });
              };
              _init();

              let pendingMessage = null;
              c.on('message', o => {
                if (typeof o === 'string') {
                  const m = JSON.parse(o);
                  const {type} = m;

                  if (type === 'setSkin') {
                    pendingMessage = m;
                  } else if (type === 'clearSkin') {
                    skins.delete(n);

                    const e = {
                      type: 'clearSkin',
                      n,
                    };
                    const es = JSON.stringify(e);
                    for (let i = 0; i < connections.length; i++) {
                      const connection = connections[i];

                      if (connection.readyState === ws.OPEN && connection !== c) {
                        connection.send(es);
                        connection.send(skinImgBuffer);
                      }
                    }
                  } else {
                    console.warn('multiplayer unknown message type', JSON.stringify(type));
                  }
                } else {
                  if (!pendingMessage) { // update
                    const n = protocolUtils.parseUpdateN(o.buffer, o.byteOffset);

                    const status = statuses.get(n);
                    if (status) {
                      protocolUtils.parseUpdate(
                        status.hmd.position,
                        status.hmd.rotation,
                        status.hmd.scale,
                        status.gamepads.left.position,
                        status.gamepads.left.rotation,
                        status.gamepads.left.scale,
                        status.gamepads.right.position,
                        status.gamepads.right.rotation,
                        status.gamepads.right.scale,
                        status.metadata.menu,
                        status.metadata.menu.position,
                        status.metadata.menu.rotation,
                        status.metadata.menu.scale,
                        buffer,
                        0
                      );

                      for (let i = 0; i < connections.length; i++) {
                        const connection = connections[i];

                        if (connection.readyState === ws.OPEN && connection !== c) {
                          connection.send(o);
                        }
                      }
                    } else {
                      console.warn('multiplayer ignoring status for nonexistent user', {n});
                    }
                  } else { // pending message
                    const skinImgBuffer = o;
                    skins.set(n, skinImgBuffer);

                    const es = JSON.stringify({
                      type: 'setSkin',
                      n,
                    });
                    for (let i = 0; i < connections.length; i++) {
                      const connection = connections[i];
                      if (connection.readyState === ws.OPEN && connection !== c) {
                        connection.send(es);
                        connection.send(skinImgBuffer);
                      }
                    }

                    pendingMessage = null;
                  }
                }
              });
              c.on('close', () => {
                statuses.delete(n);
                usernames.delete(n);
                skins.delete(n);

                const es = JSON.stringify({
                  type: 'playerLeave',
                  n,
                });
                for (let i = 0; i < connections.length; i++) {
                  const connection = connections[i];
                  if (connection.readyState === ws.OPEN && connection !== c) {
                    connection.send(es);
                  }
                }

                connections.splice(connections.indexOf(c), 1);

                multiplayerApi.emit('playerLeave', n);
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
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Multiplayer;

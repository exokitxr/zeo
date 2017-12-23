const protocolUtils = require('./lib/utils/protocol-utils');

class Hand {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {ws, app, wss} = archae.getCore();

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/three',
    ]).then(([
      three,
    ]) => {
      if (live) {
        const {THREE} = three;

        class Grabbable {
          constructor(n, position, rotation, scale, localPosition, localRotation, localScale) {
            this.n = n;
            this.position = position;
            this.rotation = rotation;
            this.scale = scale;
            this.localPosition = localPosition;
            this.localRotation = localRotation;
            this.localScale = localScale;

            this.userId = null;
            this.side = null;
            this.data = {};
          }

          grab(userId, side) {
            const {n} = this;

            this.userId = userId;
            this.side = side;
          }

          release() {
            this.userId = null;
            this.side = null;
          }

          setData(key, value) {
            this.data[key] = value;
          }

          setState(position, rotation, scale, localPosition, localRotation, localScale) {
            this.position = position;
            this.rotation = rotation;
            this.scale = scale;
            this.localPosition = localPosition;
            this.localRotation = localRotation;
            this.localScale = localScale;
          }
        }

        const grabbables = {};
        const interests = {};

        const connections = [];

        const channel = wss.channel('hand');
        channel.on('connection', c => {
          c.userId = null;

          const buffer = new ArrayBuffer(protocolUtils.BUFFER_SIZE);

          const _sendObject = (type, args) => {
            c.send(JSON.stringify({
              type,
              args,
            }));
          };
          const _sendBuffer = buffer => {
            c.send(buffer);
          };
          const _broadcastObject = (interestId, type, args) => {
            if (connections.some(connection => connection !== c)) {
              const es = JSON.stringify({
                type,
                args,
              });

              const interest = interests[interestId];
              for (let i = 0; i < connections.length; i++) {
                const connection = connections[i];

                if (connection.readyState === ws.OPEN && connection !== c) {
                  if (interest.includes(connection.userId)) {
                    connection.send(es);
                  }
                }
              }
            }
          };
          const _broadcastBuffer = (interestId, buffer) => {
            if (connections.some(connection => connection !== c)) {
              const interest = interests[interestId];

              for (let i = 0; i < connections.length; i++) {
                const connection = connections[i];
                if (interest.includes(connection.userId) && connection !== c) {
                  connection.send(buffer);
                }
              }
            }
          };

          const localInterests = [];

          c.on('message', o => {
            if (typeof o === 'string') {
              const m = JSON.parse(o);

              if (typeof m === 'object' && m !== null && typeof m.method === 'string' && Array.isArray(m.args)) {
                const {method, args} = m;

                if (method === 'init') {
                  const [userId] = args;

                  c.userId = userId;
                } else if (method === 'addGrabbable') {
                  const [n, position, rotation, scale, localPosition, localRotation, localScale] = args;

                  const grabbable = grabbables[n];
                  if (!grabbable) {
                    const newGrabbable = new Grabbable(
                      n,
                      new THREE.Vector3().fromArray(position),
                      new THREE.Quaternion().fromArray(rotation),
                      new THREE.Vector3().fromArray(scale),
                      new THREE.Vector3().fromArray(localPosition),
                      new THREE.Quaternion().fromArray(localRotation),
                      new THREE.Vector3().fromArray(localScale)
                    );
                    grabbables[n] = newGrabbable;
                  }

                  let interest = interests[n];
                  if (!interest) {
                    interest = [];
                    interests[n] = interest;
                  }
                  if (!interest.includes(c.userId)) {
                    interest.push(c.userId);
                  }

                  if (!localInterests.includes(n)) {
                    localInterests.push(n);
                  }

                  if (grabbable) {
                    const {userId, side, data} = grabbable;
                    if (userId) {
                      _sendObject('grab', [n, userId, side]);
                    }
                    for (const key in data) {
                      const value = data[key];
                      _sendObject('data', [n, key, value]);
                    }

                    const {position, rotation, scale, localPosition, localRotation, localScale} = grabbable;
                    _sendBuffer(protocolUtils.stringifyUpdate(n, position, rotation, scale, localPosition, localRotation, localScale, buffer, 0));
                  }
                } else if (method === 'removeGrabbable') {
                  const [n] = args;

                  const grabbable = grabbables[n];

                  if (grabbable) {
                    delete grabbables[n];

                    const interest = interests[n];
                    interest.splice(interest.indexOf(c.userId), 1);
                    if (interest.length === 0) {
                      delete interests[n];
                    }

                    localInterests.splice(localInterests.indexOf(n), 1);
                  }
                } else if (method === 'grab') {
                  const [n, side] = args;

                  const grabbable = grabbables[n];

                  if (grabbable) {
                    grabbable.grab(c.userId, side);
                    _broadcastObject(n, 'grab', [n, c.userId, side]);
                  }
                } else if (method === 'release') {
                  const [n] = args;

                  const grabbable = grabbables[n];

                  if (grabbable) {
                    grabbable.release();
                    _broadcastObject(n, 'release', [n]);
                  }
                } else if (method === 'data') {
                  const [n, key, value] = args;

                  const grabbable = grabbables[n];

                  if (grabbable) {
                    grabbable.setData(key, value);

                    _broadcastObject(n, 'data', [n, key, value]);
                  }
                } else {
                  console.warn('no such hand method:' + JSON.stringify(method));
                }
              } else {
                console.warn('invalid message', m);
              }
            } else {
              if (o.byteOffset % 4 !== 0) {
                const b = new Uint8Array(new ArrayBuffer(o.byteLength));
                b.set(new Uint8Array(o.buffer, o.byteOffset, o.byteLength));
                o = b;
              }
              const n = protocolUtils.parseUpdateN(o.buffer, o.byteOffset);
              const grabbable = grabbables[n];

              if (grabbable) {
                protocolUtils.parseUpdate(grabbable.position, grabbable.rotation, grabbable.scale, grabbable.localPosition, grabbable.localRotation, grabbable.localScale, o.buffer, o.byteOffset);

                _broadcastBuffer(n, o);
              }
            }
          });

          connections.push(c);

          c.on('close', () => {
            for (let i = 0; i < localInterests.length; i++) {
              const n = localInterests[i];
              const interest = interests[n];

              interest.splice(interest.indexOf(c.userId), 1);
              if (interest.length === 0) {
                delete interests[n];
              }
            }

            connections.splice(connections.indexOf(c), 1);
          });
        });

        this._cleanup = () => {
          for (let i = 0; i < connections.length; i++) {
            const connection = connections[i];
            connection.close();
          }
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Hand;

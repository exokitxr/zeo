class Hand {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {app, wss} = archae.getCore();

    class Grabbable {
      constructor(id, position, rotation, scale) {
        this.id = id;
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;

        this.userId = null;
        this.side = null;
      }

      grab(userId, side) {
        const {id} = this;

        this.userId = userId;
        this.side = side;
      }

      release() {
        const {userId} = this;

        if (userId !== null) {
          const {id, side} = this;

          this.userId = null;
          this.side = null;

          return {
            userId,
            side,
          };
        } else {
          return null;
        }
      }

      setState(position, rotation, scale) {
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
      }
    }

    const grabbables = {};
    const interests = {};

    const connections = [];

    wss.on('connection', c => {
      const {url} = c.upgradeReq;

      let match;
      if (match = url.match(/\/archae\/handWs\?id=(.+)$/)) {
        const userId = match[1];
        c.userId = userId;

        const _send = (type, args) => {
          const e = {
            type,
            args,
          };
          const es = JSON.stringify(e);

          c.send(es);
        };
        const _broadcast = (interestId, type, args) => {
          if (connections.some(connection => connection !== c)) {
            const e = {
              type,
              args,
            };
            const es = JSON.stringify(e);

            const interest = interests[interestId];
            for (let i = 0; i < connections.length; i++) {
              const connection = connections[i];
              const {userId} = connection;
              if (interest.includes(userId) && connection !== c) {
                connection.send(es);
              }
            }
          }
        };

        const localInterests = [];

        c.on('message', s => {
          const m = _jsonParse(s);

          if (typeof m === 'object' && m !== null && typeof m.method === 'string' && Array.isArray(m.args)) {
            const {method, args} = m;

            if (method === 'addGrabbable') {
              const [id, position, rotation, scale] = args;

              const grabbable = grabbables[id];
              if (!grabbable) {
                const newGrabbable = new Grabbable(id, position, rotation, scale);
                grabbables[id] = newGrabbable;
              }

              let interest = interests[id];
              if (!interest) {
                interest = [];
                interests[id] = interest;
              }
              if (!interest.includes(userId)) {
                interest.push(userId);
              }

              if (!localInterests.includes(id)) {
                localInterests.push(id);
              }

              if (grabbable) {
                const {userId, side} = grabbable;
                if (userId) {
                  _send('grab', [id, userId, side]);
                }

                const {position, rotation, scale} = grabbable;
                _send('update', [id, position, rotation, scale]);
              }
            } else if (method === 'removeGrabbable') {
              const [id] = args;

              const grabbable = grabbables[id];

              if (grabbable) {
                const releaseSpec = grabbable.release();
                if (releaseSpec) {
                  const {userId, side} = releaseSpec;
                  _broadcast(id, 'release', [id]);
                }

                _broadcast(id, 'destroy', [id]);

                delete grabbables[id];
                delete interests[id];

                localInterests.splice(localInterests.indexOf(id), 1);
              }
            } else if (method === 'grab') {
              const [id, side] = args;

              const grabbable = grabbables[id];

              if (grabbable) {
                const releaseSpec = grabbable.release();
                if (releaseSpec) {
                  const {userId, side} = releaseSpec;
                  _broadcast(id, 'release', [id]);
                }

                grabbable.grab(userId, side);
                _broadcast(id, 'grab', [id, userId, side]);
              }
            } else if (method === 'release') {
              const [id] = args;

              const grabbable = grabbables[id];

              if (grabbable) {
                const releaseSpec = grabbable.release();
                if (releaseSpec) {
                  const {userId, side} = releaseSpec;
                  _broadcast(id, 'release', [id]);
                }
              }
            } else if (method === 'setState') {
              const [id, position, rotation, scale] = args;

              const grabbable = grabbables[id];

              if (grabbable) {
                const releaseSpec = grabbable.release();
                if (releaseSpec) {
                  const {userId, side} = releaseSpec;
                  _broadcast(id, 'release', [id]);
                }

                grabbable.setState(position, rotation, scale);
                _broadcast(id, 'update', [id, position, rotation, scale]);
              }
            } else if (method === 'update') {
              const [id, position, rotation, scale] = args;

              const grabbable = grabbables[id];

              if (grabbable) {
                grabbable.setState(position, rotation, scale);
                _broadcast(id, 'update', [id, position, rotation, scale]);
              }
            } else {
              console.warn('no such hand method:' + JSON.stringify(method));
            }
          } else {
            console.warn('invalid message', m);
          }
        });

        connections.push(c);

        c.on('close', () => {
          for (let i = 0; i < localInterests.length; i++) {
            const id = localInterests[i];
            const interest = interests[id];

            interest.splice(interest.indexOf(userId), 1);
            if (interest.length === 0) {
              delete interests[id];
            }
          }

          connections.splice(connections.indexOf(c), 1);
        });
      }
    });

    this._cleanup = () => {
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

const _jsonParse = s => {
  let error = null;
  let result;
  try {
    result = JSON.parse(s);
  } catch (err) {
    error = err;
  }
  if (!error) {
    return result;
  } else {
    return null;
  }
};
const _arrayify = o => Object.keys(o).map(k => o[k]);

module.exports = Hand;

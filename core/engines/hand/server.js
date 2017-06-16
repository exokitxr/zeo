const OPEN = 1; // ws.OPEN

class Hand {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {app, wss} = archae.getCore();

    const usersJson = {};

    const connections = [];

    wss.on('connection', c => {
      const {url} = c.upgradeReq;

      let match;
      if (match = url.match(/\/archae\/handWs\?id=(.+)$/)) {
        const userId = match[1];

        const user = {
          id: userId,
          hands: {
            left: null,
            right: null,
          },
        };
        usersJson[userId] = user;

        const _sendInit = () => {
          const e = {
            type: 'init',
            args: [
              _arrayify(usersJson).filter(userSpec => userSpec.id !== userId),
            ],
          };
          const es = JSON.stringify(e);
          c.send(es);
        };
        _sendInit();

        const _broadcast = (type, args) => {
          if (connections.some(connection => connection !== c)) {
            const e = {
              type,
              args,
            };
            const es = JSON.stringify(e);

            for (let i = 0; i < connections.length; i++) {
              const connection = connections[i];
              if (connection !== c) {
                connection.send(es);
              }
            }
          }
        };

        c.on('message', s => {
          const m = _jsonParse(s);

          if (typeof m === 'object' && m !== null && typeof m.method === 'string' && Array.isArray(m.args)) {
            const {method, args} = m;

            if (method === 'grab') {
              const [side, id] = args;

              user.hands[side] = id;

              _broadcast('grab', [userId, side, id]);
            } else if (method === 'release') {
              const [side] = args;

              user.hands[side] = null;

              _broadcast('release', [userId, side]);
            } else {
              console.warn('no such hand method:' + JSON.stringify(method));
            }
          } else {
            console.warn('invalid message', m);
          }
        });

        const cleanups = [];
        const cleanup = () => {
          for (let i = 0; i < cleanups.length; i++) {
            const cleanup = cleanups[i];
            cleanup();
          }
        };

        c.on('close', () => {
          cleanup();
        });

        connections.push(c);
        cleanups.push(() => {
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

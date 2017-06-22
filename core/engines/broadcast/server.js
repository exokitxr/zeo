class Broadcast {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {app, wss} = archae.getCore();

    const connections = [];

    wss.on('connection', c => {
      const {url} = c.upgradeReq;

      let match;
      if (match = url.match(/\/archae\/broadcastWs\?id=(.+)$/)) {
        const userId = match[1];

        c.on('message', s => {
          const m = _jsonParse(s);

          if (typeof m === 'object' && m !== null && typeof m.event === 'string' && Array.isArray(m.args)) {
            const {event, args} = m;

            if (connections.some(connection => connection !== c)) {
              const e = {
                event,
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

module.exports = Broadcast;

console.log('load wss server');

const server = ({wss}) => ({
  mount() {
    const connections = [];

    wss.on('connection', c => {
      const {url} = c.upgradeReq;

      if (url === '/archae/engineWs') {
        c.on('message', s => {
          const m = JSON.parse(s);
          if (typeof m === 'object' && m && typeof m.event === 'string' && ('data' in m)) {
            const {event, data} = m;
            const e = {
              event,
              data,
            };
            const es = JSON.stringify(e);
            for (let i = 0; i < connections.length; i++) {
              const connection = connections[i];
              connection.send(es);
            }
          }
        });
        c.on('close', () => {
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
  },
  unmount() {
    this._cleanup();
  },
});

module.exports = server;

class WebRtc {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {wss} = archae.getCore();

    const connections = [];

    wss.on('connection', c => {
      const {url} = c.upgradeReq;

      if (url === '/archae/webrtc') {
        let id = null; // XXX
        c.on('message', (msg, flags) => {
          if (!flags.binary) {
            const e = JSON.parse(msg);
            const {type} = e;

            if (type === 'init') {
              const {id: messageId} = e;
              id = messageId;
            } else {
              console.warn('unknown message type', JSON.stringify(type));
            }
          } else {
            if (id !== null) {
              const e = {
                type: 'id',
                id: id,
              };
              const es = JSON.stringify(e);

              for (let i = 0; i < connections.length; i++) {
                const connection = connections[i];
                if (connection !== c) {
                  connection.send(es);
                  connection.send(msg);
                }
              }
            } else {
              console.warn('webrtc broadcast before init');
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
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = WebRtc;

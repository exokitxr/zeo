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
        c.on('message', (msg, flags) => {
          // if (flags.binary) {
            for (let i = 0; i < connections.length; i++) {
              const connection = connections[i];
              // if (connection !== c) {
                connection.send(msg);
              // }
            }
          // }
        });
        c.on('close', () => {
          connections.splice(connections.indexOf(c), 1);

          if (connectionSubscriptionIds.length > 0) {
            _filterSubscriptions(subscription => !connectionSubscriptionIds.includes(subscription.id));
          }
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

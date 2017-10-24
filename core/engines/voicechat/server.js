class VoiceChat {
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
      if (match = url.match(/\/archae\/voicechatWs\?id=(.+)$/)) {
        const peerId = parseInt(decodeURIComponent(match[1]), 10);

        c.peerId = peerId;
        c.on('message', (s, flags) => {
          const {target} = JSON.parse(s);

          const c = connections.find(connection => connection.peerId === target);
          if (c) {
            c.send(s);
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
      connections.length = 0;
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = VoiceChat;

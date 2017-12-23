class VoiceChat {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {app, wss} = archae.getCore();

    const connections = [];

    const channel = wss.channel('voicechat');
    channel.on('connection', c => {
      c.peerId = null;

      c.on('message', (s, flags) => {
        const m = JSON.parse(s);

        const {type} = m;
        if (type === 'init') {
          const {id: peerId} = m;

          c.peerId = peerId;
        } else {
          const {target} = m;

          const c = connections.find(connection => connection.peerId === target);
          if (c) {
            c.send(s);
          }
        }
      });
      c.on('close', () => {
        connections.splice(connections.indexOf(c), 1);
      });

      connections.push(c);
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

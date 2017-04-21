const events = require('events');
const {EventEmitter} = events;

class VoiceChat {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {app, wss} = archae.getCore();

    const connections = [];
    const audioBuffers = new Map();

    class AudioBuffer extends EventEmitter {
      constructor() {
        super();
      }

      write(d) {
        this.emit('update', d);
      }
    }

    const _getAudioBuffer = id => {
      let audioBuffer = audioBuffers.get(id);
      if (!audioBuffer) {
        audioBuffer = new AudioBuffer();
        audioBuffer.on('update', d => {
          const e = {
            type: 'id',
            id: id,
          };
          const es = JSON.stringify(e);

          for (let i = 0; i < connections.length; i++) {
            const connection = connections[i];
            if (connection.peerId !== id) {
              connection.send(es);
              connection.send(d);
            }
          }
        });
        audioBuffers.set(id, audioBuffer);
      }
      return audioBuffer;
    };
    const _removeAudioBuffer = id => {
      const audioBuffer = audioBuffers.get(id);

      if (audioBuffer) {
        audioBuffers.delete(id);
      }
    };

    wss.on('connection', c => {
      const {url} = c.upgradeReq;

      let match;
      if (match = url.match(/\/archae\/voicechatWs\?id=(.+)$/)) {
        const peerId = decodeURIComponent(match[1]);

        c.peerId = peerId;
        c.on('message', (msg, flags) => {
          if (flags.binary) {
            const audioBuffer = _getAudioBuffer(c.peerId);
            audioBuffer.write(msg);
          } else {
            console.warn('voicechat invalid message', {msg, flags});
          }
        });
        c.on('close', () => {
          connections.splice(connections.indexOf(c), 1);

          if (c.peerId !== null) {
            _removeAudioBuffer(c.peerId);
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
      connections.length = 0;
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = VoiceChat;

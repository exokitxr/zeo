const events = require('events');
const {EventEmitter} = events;
const stream = require('stream');
const {PassThrough} = stream;
const child_process = require('child_process');

const MIN_BUFFER_LENGTH = 64 * 1024;
const MAX_BUFFER_LENGTH = MIN_BUFFER_LENGTH * 2;

class VoiceChat {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {app, wss} = archae.getCore();

    const connections = [];
    const audioBuffers = new Map();
    const audioStreams = [];

    class AudioBuffer extends EventEmitter {
      constructor() {
        super();

        this.buffers = [];
        this.length = 0;

        const ffmpeg = child_process.spawn('ffmpeg', [
          '-loglevel', 'panic',
          // '-re',
          '-i', '-',
          '-f', 's16le',
          '-ar', '44100',
          '-ac', '1',
          '-acodec', 'pcm_s16le',
          'pipe:1'
        ]);
        ffmpeg.stdout.on('data', d => {
          this.emit('update', d);
        });

        ffmpeg.stderr.pipe(process.stderr);
        ffmpeg.on('error', err => {
          console.warn(err);
        });
        ffmpeg.on('exit', exitCode => {
          if (exitCode !== 0) {
            console.warn('ffmpeg non-zero exit code: ' + exitCode);
          }
        });
        this._ffmpeg = ffmpeg;
      }

      write(d) {
        const {_ffmpeg: ffmpeg} = this;
        ffmpeg.stdin.write(d);
      }

      close() {
        const {_ffmpeg: ffmpeg} = this;
        ffmpeg.kill();
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
        audioBuffer.close();

        audioBuffers.delete(id);
      }
    };

    wss.on('connection', c => {
      const {url} = c.upgradeReq;

      let match;
      if (match = url.match(/\/archae\/voicechatWs\?id=(.+)$/)) {
        const peerId = match[1];

        c.peerId = peerId;
        c.on('message', (msg, flags) => {
          if (flags.binary) {
            const audioBuffer = _getAudioBuffer(c.peerId);
            audioBuffer.write(msg);
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

      for (let i = 0; i < audioStreams.length; i++) {
        const audioStream = audioStreams[i];
        audioStream.close();
      }
    };
  }

  unmount() {
    this._cleanup();
  }
}

const _debounce = fn => {
  let running = false;
  let queued = false;

  const _go = () => {
    if (!running) {
      running = true;

      fn(() => {
        running = false;

        if (queued) {
          queued = false;

          _go();
        }
      });
    } else {
      queued = true;
    }
  };
  return _go;
};

module.exports = VoiceChat;

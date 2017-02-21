const events = require('events');
const {EventEmitter} = events;
const stream = require('stream');
const {PassThrough} = stream;
const child_process = require('child_process');

const MIN_BUFFER_LENGTH = 4 * 1024;
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
          this.buffers.push(d);
          this.length += d.length;

          this.emit('update', d);

          if (this.length > MAX_BUFFER_LENGTH) {
            const buffer = Buffer.concat(this.buffers, this.length).slice(-MIN_BUFFER_LENGTH);
            this.buffers = [buffer];
            this.length = buffer.length;
          }
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
    }

    class AudioStream extends PassThrough {
      constructor(audioBuffer) {
        super();

        this.audioBuffer = audioBuffer;

        this._ffmpeg = null;

        this.listen();
      }

      listen() {
        const {audioBuffer} = this;

        const ffmpeg = child_process.spawn('ffmpeg', [
          '-loglevel', 'panic',
          // '-re',
          '-f', 's16le',
          '-ar', '44100',
          '-ac', '1',
          '-i', '-',
          // '-codec:a', 'libopus',
          // '-f', 'ogg',
          '-f', 'wav',
          'pipe:1',
        ]);
        ffmpeg.stderr.pipe(process.stderr);
        ffmpeg.on('error', err => {
          console.warn(err);
        });
        ffmpeg.on('exit', exitCode => {
          if (exitCode !== 0) {
            console.warn('ffmpeg non-zero exit code: ' + exitCode);
          }
        });

        const {buffers} = audioBuffer;
        for (let i = 0; i < buffers.length; i++) {
          const buffer = buffers[i];
          ffmpeg.stdin.write(buffer);
        }
        ffmpeg.stdout.pipe(this, {
          end: false,
        });

        this.on('error', err => {
          console.log('stream error', err);
        });
        ffmpeg.on('error', err => {
          console.log('ffmpeg error', err);
        });
        ffmpeg.stdin.on('error', err => {
          console.log('ffmpeg stdin error', err);
        });
        ffmpeg.stdout.on('error', err => {
          console.log('ffmpeg stdout error', err);
        });
        ffmpeg.stderr.on('error', err => {
          console.log('ffmpeg stderr error', err);
        });
        this._ffmpeg = ffmpeg;

        const _update = d => {
          ffmpeg.stdin.write(d);
        };
        audioBuffer.on('update', _update);
        ffmpeg.stdin.on('close', () => {
          audioBuffer.removeListener('update', _update);

          this.emit('close');
        });
      }

      pipe(outStream, options) {
        PassThrough.prototype.pipe.call(this, outStream, options);

        outStream.on('close', () => {
          const {_ffmpeg: ffmpeg} = this;
          ffmpeg.kill();
        });
        outStream.on('error', err => {
          console.log('out stream error', err);
        });
        outStream.connection.on('error', err => { // XXX this one is hammered
          console.log('out stream connection error', err);
        });
      }

      close() {
        const {_ffmpeg: ffmpeg} = this;
        ffmpeg.kill();
      }
    }

    const _getAudioBuffer = id => { // XXX time these out when not used
      let audioBuffer = audioBuffers.get(id);
      if (!audioBuffer) {
        audioBuffer = new AudioBuffer();
        audioBuffers.set(id, audioBuffer);
      }
      return audioBuffer;
    };

    wss.on('connection', c => {
      const {url} = c.upgradeReq;

      if (url === '/archae/voicechat') {
        let id = null;

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
              const audioBuffer = _getAudioBuffer(id);
              audioBuffer.write(msg);
            } else {
              console.warn('voicechat broadcast before init');
            }
          }
        });
        c.on('close', () => {
          connections.splice(connections.indexOf(c), 1);
        });

        connections.push(c);
      }
    });

    app.get('/archae/voicechat/:id', (req, res, next) => {
      const {id} = req.params;

      const audioStream = new AudioStream(_getAudioBuffer(id));
      audioStreams.push(audioStream);
      audioStream.on('close', () => {
        audioStreams.splice(audioStreams.indexOf(audioStream), 1);
      });

      res.type('audio/wav');
      audioStream.pipe(res);
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

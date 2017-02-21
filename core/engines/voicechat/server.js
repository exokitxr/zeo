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

    const _decodeAudio = (d, dataCb, doneCb) => {
      const ffmpeg = child_process.execFile('ffmpeg', [
        '-i', '-',
        '-f', 's16le',
        '-ar', '44100',
        '-ac', '1',
        '-acodec', 'pcm_s16le',
        'pipe:1'
      ]);
      ffmpeg.stdin.end(d);      
      ffmpeg.stdout.on('data', d => {
        dataCb(d);
      });
      ffmpeg.stderr.pipe(process.stderr);
      ffmpeg.on('close', exitCode => {
        if (exitCode === 0) {
          doneCb();
        } else {
          const err = new Error('ffmpeg exited with non-zero exit code');
          err.exitCode = exitCode;
          doneCb(err);
        }
      });
    };

    const connections = [];
    const audioBuffers = new Map();
    const audioStreams = [];

    class AudioBuffer extends EventEmitter {
      constructor() {
        super();

        this.buffers = [];
        this.length = 0;
      }

      write(d) {
        this.buffers.push(d);
        this.length += d.length;

        this.emit('update', d);

        if (this.length > MAX_BUFFER_LENGTH) {
          const buffer = Buffer.concat(this.buffers, this.length).slice(-MIN_BUFFER_LENGTH);
          this.buffers = [buffer];
          this.length = buffer.length;
        }
      }
    }

    class AudioStream extends PassThrough {
      constructor(audioBuffer) {
        this.audioBuffer = audioBuffer;

        this._ffmpeg = null;

        this.listen();
      }

      listen() {
        const {audioBuffer} = this;
        const {buffers} = audioBuffer;

        const ffmpeg = child_process.execFile('ffmpeg', [
          '-f', 's16le',
          '-ar', '44100',
          '-ac', '1',
          '-i', '-',
          '-codec:a', 'libmp3lame',
          '-f', 'mp3',
          'pipe:1',
        ]);
        ffmpeg.stderr.pipe(process.stderr);

        for (let i = 0; i < buffers.length; i++) {
          const buffer = buffers[i];
          ffmpeg.write(buffer);
        }
        ffmpeg.stdout.pipe(this, {
          end: false,
        });
        this._ffmpeg = ffmpeg;

        const update = d => {
          ffmpeg.write(d);
        };
        audioBuffer.on('update', update);
        ffmpeg.on('close', () => {
          audioBuffer.removeListener('update', update);

          this.emit('close');
        });
      }

      pipe(outStream, options) {
        super.pipe(outStream, options);

        outStream.on('close', () => {
          const {_ffmpeg: ffmpeg} = this;
          ffmpeg.kill();
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

        let running = false;
        const queue = [];
        const _tryDecodeAudio = msg => {
          if (id !== null) {
            if (!running) {
              running = true;

              const audioBuffer = _getAudioBuffer(id);
              _decodeAudio(msg, d => {
                audioBuffer.write(d);
              }, err => {
                if (err) {
                  console.warn(err);
                }

                running = false;
                if (queue.length > 0) {
                  const msg = queue.shift();
                  _tryDecodeAudio(msg);
                }
              });
            } else {
              queue.push(msg);
            }
          } else {
            console.warn('voicechat broadcast before init');
          }
        };

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
            _tryDecodeAudio(msg);
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

      res.type('audio/ogg');
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

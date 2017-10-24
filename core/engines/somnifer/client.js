const ANALYSER_RESOLUTION = 32;

class Somnifer {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/three',
    ]).then(([
      three,
    ]) => {
      if (live) {
        const {THREE, camera} = three;

        const listener = new THREE.AudioListener();
        camera.add(listener);

        const bodies = [];

        class SoundBody {
          constructor() {
            const sound = new THREE.PositionalAudio(listener);
            // sound.setDistanceModel('linear');
            // sound.setRolloffFactor(1);
            this.sound = sound;

            const analyser = new THREE.AudioAnalyser(sound, ANALYSER_RESOLUTION);
            this.analyser = analyser;

            this.object = null;

            bodies.push(this);
          }

          setInputElement(el) {
            this.sound.setNodeSource(this.sound.context.createMediaElementSource(el));
          }

          setInputElements(els) {
            const {sound} = this;

            const sources = els.map(el => sound.context.createMediaElementSource(el));
            const merger = sound.context.createChannelMerger(2);

            let outputIndex = 0;
            for (let i = 0; i < sources.length; i++) {
              const source = sources[i];

              for (let j = 0; j < source.numberOfOutputs; j++) {
                source.connect(merger, j, 0);
                source.connect(merger, j, 1);
              }
            }

            sound.setNodeSource(merger);
          }

          setInputMediaStream(mediaStream) {
            this.sound.setNodeSource(this.sound.context.createMediaStreamSource(mediaStream));
          }

          setInputSource(source) {
            this.sound.setNodeSource(source);
          }

          setObject(object) {
            object.add(this.sound);
            object.updateMatrixWorld();
            this.object = object;
          }

          getAmplitude() {
            return this.analyser.getAverageFrequency() / 255;
          }

          destroy() {
            if (this.object) {
              this.object.remove(this.sound);
            }
            bodies.splice(bodies.indexOf(this), 1);
          }
        }

        this._cleanup = () => {
          camera.remove(listener);

          while (bodies.length > 0) {
            const body = bodies[0];
            body.destroy();
          }
        };

        class SoundApi {
          requestSfx(url) {
            return new Promise((accept, reject) => {
              const audio = document.createElement('audio');

              audio.oncanplay = () => {
                _cleanup();

                audio.trigger = () => {
                  audio.currentTime = 0;

                  if (audio.paused) {
                    audio.play();
                  }
                };
                audio.start = () => {
                  audio.currentTime = 0;
                  audio.loop = true;

                  if (audio.paused) {
                    audio.play();
                  }
                };
                audio.stop = () => {
                  audio.loop = false;

                  if (!audio.paused) {
                    audio.pause();
                  }
                };

                accept(audio);
              };
              audio.onerror = err => {
                reject(err);
              };

              // audio.crossOrigin = true;
              audio.src = url;

              document.body.appendChild(audio);

              const _cleanup = () => {
                audio.oncanplay = null;
                audio.onerror = null;

                document.body.removeChild(audio);
              };
            });
          }

          makeBody() {
            return new SoundBody();
          }
        }
        const soundApi = new SoundApi();

        return soundApi;
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Somnifer;

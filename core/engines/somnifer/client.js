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
            this.sound = sound;

            const analyser = new THREE.AudioAnalyser(sound, ANALYSER_RESOLUTION);
            this.analyser = analyser;

            this.object = null;

            bodies.push(this);
          }

          setInputElement(el) {
            const {sound} = this;

            const source = sound.context.createMediaElementSource(el);
            sound.setNodeSource(source);
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
            const {sound} = this;

            const source = sound.context.createMediaStreamSource(mediaStream);
            sound.setNodeSource(source);
          }

          setInputSource(source) {
            const {sound} = this;

            sound.setNodeSource(source);
          }

          setObject(object) {
            const {sound} = this;

            object.add(sound);

            this.object = object;
          }

          getAmplitude() {
            const {analyser} = this;

            return analyser.getAverageFrequency() / 255;
          }

          destroy() {
            const {sound, object} = this;

            if (object) {
              object.remove(sound);
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

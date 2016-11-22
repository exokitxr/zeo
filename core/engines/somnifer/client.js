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

    return archae.requestEngines([
      '/core/engines/three',
    ]).then(([
      three,
    ]) => {
      if (live) {
        const {THREE, camera} = three;

        const listener = new THREE.AudioListener();
        camera.add(listener);

        const bodies = [];

        class Body {
          constructor() {
            const sound = new THREE.PositionalAudio(listener);
            this.sound = sound;

            const analyser = new THREE.AudioAnalyser(sound, ANALYSER_RESOLUTION);
            this.analyser = analyser;

            this.object = null;

            bodies.push(this);
          }

          setInput(inputEl) {
            const {sound} = this;

            const source = sound.context.createMediaElementSource(inputEl);
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

        const sound = {
          Body,
        };
        return {
          sound,
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Somnifer;

const BezierEasing = require('bezier-easing');

const ease = BezierEasing(0, 1, 0, 1);

const Anima = {
  mount() {
    class Animation {
      constructor(duration) {
        this.startTime = Date.now();
        this.endTime = this.startTime + duration;
      }

      getValue() {
        const {startTime, endTime} = this;
        const now = Date.now();

        return ease(Math.max(Math.min((now - startTime) / (endTime - startTime), 1), 0));
      }
    }

    class AnimaApi {
      makeAnimation(duration) {
        return new Animation(duration);
      }
    }
    const animaApi = new AnimaApi();

    return animaApi;
  },
  unmount() {},
};

module.exports = Anima;

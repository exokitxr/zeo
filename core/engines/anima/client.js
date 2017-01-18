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

    const makeAnimation = duration => new Animation(duration);

    return {
      makeAnimation,
    };
  },
  unmount() {},
};

module.exports = Anima;

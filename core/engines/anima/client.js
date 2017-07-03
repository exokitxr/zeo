const BezierEasing = require('bezier-easing');

const ease = BezierEasing(0, 1, 0, 1);

const Anima = {
  mount() {
    class Animation {
      constructor(startValue, endValue, duration) {
        this.startValue = startValue;
        this.endValue = endValue;
        this.startTime = Date.now();
        this.endTime = this.startTime + duration;
      }

      getValue() {
        const {startValue, endValue, startTime, endTime} = this;
        const now = Date.now();
        return startValue + ease(Math.max(Math.min((now - startTime) / (endTime - startTime), 1), 0)) * (endValue - startValue);
      }

      isDone() {
        return Date.now() >= this.endTime;
      }

      finish() {
        this.endTime = Date.now();
      }
    }

    const _makeAnimation = (startValue, endValue, duration) => new Animation(startValue, endValue, duration);

    return {
      makeAnimation: _makeAnimation,
    };
  },
  unmount() {},
};

module.exports = Anima;

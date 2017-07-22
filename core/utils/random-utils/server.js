const path = require('path');

const alea = require('alea-zeo');

class RandomUtils {
  mount() {
    return {
      alea,
    };
  }
  unmount() {}
}

module.exports = RandomUtils;

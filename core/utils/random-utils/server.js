const path = require('path');

const alea = require('alea-zeo');
const indev = require('indev');

class RandomUtils {
  mount() {
    return {
      alea,
      indev,
    };
  }
  unmount() {}
}

module.exports = RandomUtils;

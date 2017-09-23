const path = require('path');

const alea = require('alea-zeo');
const indev = require('indev');
const vxl = require('vxl');

class RandomUtils {
  mount() {
    return {
      alea,
      indev,
      vxl,
    };
  }
  unmount() {}
}

module.exports = RandomUtils;

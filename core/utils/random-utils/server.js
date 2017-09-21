const path = require('path');

const alea = require('alea-zeo');
const indev = require('indev');
const vxlPath = path.resolve(require.resolve('vxl'), '..');
const vxl = require(vxlPath);

class RandomUtils {
  mount() {
    return {
      alea,
      indev,
      vxlPath,
      vxl,
    };
  }
  unmount() {}
}

module.exports = RandomUtils;

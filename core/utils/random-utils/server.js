const path = require('path');

const alea = require('alea-zeo');
const vxlPath = path.resolve(require.resolve('/home/k/vxl'), '..');
const vxl = require(vxlPath);

class RandomUtils {
  mount() {
    return {
      alea,
      vxlPath,
      vxl,
    };
  }
  unmount() {}
}

module.exports = RandomUtils;

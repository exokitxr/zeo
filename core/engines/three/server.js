const path = require('path');

const THREE = require('three-zeo');

class Three {
  mount() {
    return {
      THREE,
    };
  }
  unmount() {}
}

module.exports = Three;

const murmur = require('murmurhash');

module.exports = {
  mount() {
    return {
      murmur,
    };
  },
  unmount() {},
};

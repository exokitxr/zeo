const jimp = require('jimp');

module.exports = {
  mount() {
    return {
      jimp,
    };
  },
  unmount() {},
};

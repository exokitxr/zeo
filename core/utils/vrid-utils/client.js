const vrid = require('vrid');

module.exports = {
  mount() {
    return {
      vridApi: vrid,
    };
  },
  unmount() {},
};

const alea = require('./lib/alea');

module.exports = {
  mount() {
    return {
      alea,
    };
  },
  unmount() {},
};

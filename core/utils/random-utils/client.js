const alea = require('./lib/alea');
const chnkr = require('chnkr');

module.exports = {
  mount() {
    return {
      alea,
      chnkr,
    };
  },
  unmount() {},
};

const alea = require('alea-zeo');
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

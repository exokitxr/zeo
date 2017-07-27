const events = require('events');
const bffr = require('bffr');

module.exports = {
  mount() {
    return {
      events,
      bffr,
    };
  },
  unmount() {},
};

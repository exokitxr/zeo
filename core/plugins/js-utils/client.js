const events = require('events');

module.exports = {
  mount() {
    return {
      events,
    };
  },
  unmount() {},
};

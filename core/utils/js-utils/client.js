const events = require('events');
const mod = require('mod-loop');
const bffr = require('bffr');

module.exports = {
  mount() {
    return {
      events,
      mod,
      bffr,
    };
  },
  unmount() {},
};

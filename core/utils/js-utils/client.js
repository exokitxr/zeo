const events = require('events');
const mod = require('mod-loop');
const bffr = require('bffr');
const sbffr = require('sbffr');

module.exports = {
  mount() {
    return {
      events,
      mod,
      bffr,
      sbffr,
    };
  },
  unmount() {},
};

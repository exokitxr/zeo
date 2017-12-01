const events = require('events');
const mod = require('mod-loop');
const base64 = require('bass64');
const bffr = require('bffr');
const sbffr = require('sbffr');

module.exports = {
  mount() {
    return {
      events,
      mod,
      base64,
      bffr,
      sbffr,
    };
  },
  unmount() {},
};

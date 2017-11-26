const ws = require('ws');
const AutoWs = require('autows');
AutoWs.config.WebSocket = ws;

module.exports = {
  mount() {
    return {
      AutoWs,
    };
  },
  unmount() {},
};

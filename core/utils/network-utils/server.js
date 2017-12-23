const ws = require('ws');
const AutoWsClient = require('autows/client.js');
const AutoWsServer = require('autows');
AutoWsClient.config.WebSocket = ws;

module.exports = {
  mount() {
    return {
      AutoWsClient,
      AutoWsServer,
    };
  },
  unmount() {},
};

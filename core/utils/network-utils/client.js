const AutoWs = require('autows/client.js');

class NetworkUtils {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {offline}} = archae;

    return {
      AutoWs: !offline ? AutoWs : null,
    };
  }
}

module.exports = NetworkUtils;

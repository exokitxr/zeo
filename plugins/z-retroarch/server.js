const retroarch = require('retroarch');

const {
  PORT,
} = require('./lib/constants/constants');

class Retroarch {
  mount() {
    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return retroarch.listen({
      port: PORT,
    })
      .then(server => {
        const _cleanup = () => {
          server.close();
        };

        if (live) {
          this._cleanup = _cleanup;
        } else {
          _cleanup();
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Retroarch;

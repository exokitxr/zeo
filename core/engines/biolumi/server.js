const path = require('path');
const child_process = require('child_process');

const rasterize = require('rasterize/backend');

class Biolumi {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {port} = archae;
    const {express, app, wss} = archae.getCore();

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return rasterize({
      express,
      app,
      wss,
      port,
    })
      .then(({
        type,
        cleanup,
      })=> {
        if (live) {
          if (type === 'internal') {
            console.warn('warning: Could not start Chrome. Using *slow* local rendering; VR clients will experience hitching. To fix this, install Chrome.');
          }

          this._cleanup = cleanup;
        } else {
          cleanup();
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Biolumi;

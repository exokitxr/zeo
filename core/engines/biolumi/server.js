const path = require('path');
const child_process = require('child_process');

const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();
const rasterize = require('./rasterize/lib/backend');

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
      .then(cleanup => {
        if (live) {
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

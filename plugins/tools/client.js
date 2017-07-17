const protocolUtils = require('./lib/utils/protocol-utils');
const toolsLib = require('./lib/tools/index');

const dataSymbol = Symbol();

class Tools {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    const tools = toolsLib({archae});

    const cleanups = tools.map(makeItem => makeItem());

    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Tools;

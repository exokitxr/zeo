const protocolUtils = require('./lib/utils/protocol-utils');
const toolsLib = require('./lib/tools/index');

const pixelSize = 0.015;
const dataSymbol = Symbol();

class Tools {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {utils: {sprite: spriteUtils}} = zeo;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _requestImage = url => new Promise((accept, reject) => {
      const img = new Image();

      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(img);
      };

      img.crossOrigin = 'Anonymous';
      img.src = url;
    });

    return _requestImage('/archae/tools/img/arrow.png')
      .then(arrowImg => {
        if (live) {
          return spriteUtils.requestSpriteGeometry(spriteUtils.getImageData(arrowImg), pixelSize)
            .then(arrowGeometrySpec => {
              if (live) {
                const data = {
                  arrowGeometrySpec,
                };
                const tools = toolsLib({archae, data});
                const cleanups = tools.map(makeItem => makeItem());

                this._cleanup = () => {
                  for (let i = 0; i < cleanups.length; i++) {
                    const cleanup = cleanups[i];
                    cleanup();
                  }
                };
              }
            });
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Tools;

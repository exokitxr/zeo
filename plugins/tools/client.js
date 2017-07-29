const protocolUtils = require('./lib/utils/protocol-utils');
const toolsLib = require('./lib/tools/index');

const CRAFT_PLUGIN = 'plugins-craft';

class Tools {
  mount() {
    const {three, elements, utils: {sprite: spriteUtils}} = zeo;
    const {THREE} = three;

    const pixelSize = 0.015;
    const arrowMatrix = (() => {
      const position = new THREE.Vector3(pixelSize, 0, -pixelSize*16);
      const rotation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        -Math.PI / 4
      ).premultiply(new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, -1)
      )).premultiply(new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 1, 0)
      ));
      const scale = new THREE.Vector3(2, 2, 2);
      return new THREE.Matrix4().compose(position, rotation, scale);
    })();

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
          return spriteUtils.requestSpriteGeometry(spriteUtils.getImageData(arrowImg), pixelSize, arrowMatrix)
            .then(arrowGeometrySpec => {
              if (live) {
                let craftElement = null;
                const elementListener = elements.makeListener(CRAFT_PLUGIN);
                elementListener.on('add', entityElement => {
                  craftElement = entityElement;

                  if (recipeQueue.length > 0) {
                    for (let i = 0; i < recipeQueue.length; i++) {
                      const recipe = recipeQueue[i];
                      craftElement.registerRecipe(recipe);
                    }
                    recipeQueue.length = 0;
                  }
                });
                elementListener.on('remove', () => {
                  craftElement = null;
                });
                const recipeQueue = [];

                const recipes = {
                  register(recipe) {
                    if (craftElement) {
                      craftElement.registerRecipe(recipe);
                    } else {
                      recipeQueue.push(recipe);
                    }
                  },
                  unregister(recipe) {
                    if (craftElement) {
                      craftElement.registerRecipe(recipe);
                    } else {
                      const index = recipeQueue.indexOf(recipe);

                      if (index !== -1) {
                        recipeQueue.splice(index, 1);
                      }
                    }
                  },
                };
                const data = {
                  arrowGeometrySpec,
                };
                const tools = toolsLib({recipes, data});
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

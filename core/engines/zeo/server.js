const path = require('path');
const fs = require('fs');

class Zeo {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {app, dirname, dataDirectory} = archae.getCore();

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/three',
      '/core/engines/tags',
      '/core/engines/world',
      '/core/engines/multiplayer',
      '/core/engines/fs',
      '/core/utils/js-utils',
      '/core/utils/hash-utils',
      '/core/utils/random-utils',
      '/core/utils/image-utils',
    ])
      .then(([
        three,
        tags,
        world,
        multiplayer,
        fs,
        jsUtils,
        hashUtils,
        randomUtils,
        imageUtils,
      ]) => {
        if (live) {
          const {app} = archae.getCore();

          class ZeoThreeApi {
            constructor() {
              this.THREE = three.THREE;
            }
          }

          class ZeoElementsApi {
            getWorldElement() {
              return tags.getWorldElement();
            }

            requestElement(selector) {
              return tags.requestElement(selector);
            }

            registerEntity(pluginInstance, entityApi) {
              tags.registerEntity(pluginInstance, entityApi);
            }

            unregisterEntity(pluginInstance, entityApi) {
              tags.unregisterEntity(pluginInstance, entityApi);
            }
          }

          class ZeoWorldApi {
            getTags() {
              return world.getTags();
            }
          }

          class ZeoMultiplayerApi {
            getPlayerStatuses() {
              return multiplayer.getPlayerStatuses();
            }
          }

          class ZeoItemsApi {
            getFile(id) {
              return fs.makeRemoteFile(id);
            }
          }

          class ZeoUtilsApi {
            constructor() {
              this.js = jsUtils;
              this.hash = hashUtils;
              this.random = randomUtils;
              this.image = imageUtils;
            }
          }

          class ZeoApi {
            constructor() {
              this.three = new ZeoThreeApi();
              this.elements = new ZeoElementsApi();
              this.world = new ZeoWorldApi();
              this.items = new ZeoItemsApi();
              this.multiplayer = new ZeoMultiplayerApi();
              this.utils = new ZeoUtilsApi();
            }
          }
          const zeoApi = new ZeoApi();
          global.zeo = zeoApi;

          world.initTags()
            .catch(err => {
              console.warn(err);
            });

          this._cleanup = () => {};

          return zeoApi;
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Zeo;

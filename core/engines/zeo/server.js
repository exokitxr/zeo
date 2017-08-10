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
      '/core/engines/fs',
      '/core/utils/hash-utils',
      '/core/utils/random-utils',
    ])
      .then(([
        three,
        tags,
        world,
        fs,
        hashUtils,
        randomUtils,
      ]) => {
        if (live) {
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

          class ZeoFsApi {
            makeFile(id, pathname) {
              return fs.makeFile(id, pathname);
            }
          }

          class ZeoUtilsApi {
            constructor() {
              this.hash = hashUtils;
              this.random = randomUtils;
            }
          }

          class ZeoApi {
            constructor() {
              this.three = new ZeoThreeApi();
              this.elements = new ZeoElementsApi();
              this.world = new ZeoWorldApi();
              this.fs = new ZeoFsApi();
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

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
      '/core/engines/tags',
      '/core/engines/world',
      '/core/engines/fs',
    ])
      .then(([
        tags,
        world,
        fs,
      ]) => {
        if (live) {
          class ZeoWorldApi {
            getTags() {
              return world.getTags();
            }
          }

          class ZeoElementsApi {
            getWorldElement() {
              return tags.getWorldElement();
            }

            registerEntity(pluginInstance, entityApi) {
              tags.registerEntity(pluginInstance, entityApi);
            }

            unregisterEntity(pluginInstance, entityApi) {
              tags.unregisterEntity(pluginInstance, entityApi);
            }
          }

          class ZeoFsApi {
            makeFile(id, pathname) {
              return fs.makeFile(id, pathname);
            }
          }

          class ZeoApi {
            constructor() {
              this.elements = new ZeoElementsApi();
              this.world = new ZeoWorldApi();
              this.fs = new ZeoFsApi();
            }
          }
          const zeoApi = new ZeoApi();
          global.zeo = zeoApi;

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

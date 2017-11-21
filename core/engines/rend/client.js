class Rend {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {
      metadata: {
        site: {
          url: siteUrl,
        },
        server: {
          enabled: serverEnabled,
        },
      },
    } = archae;

    const cleanups = [];
    this._cleanup = () => {
      const oldCleanups = cleanups.slice();
      for (let i = 0; i < oldCleanups.length; i++) {
        const cleanup = oldCleanups[i];
        cleanup();
      }
    };

    let live = true;
    cleanups.push(() => {
      live = false;
    });

    return archae.requestPlugins([
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/utils/js-utils',
    ]).then(([
      three,
      webvr,
      jsUtils,
    ]) => {
      if (live) {
        const {THREE, scene, renderer} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;

        const auxObjects = {
          controllerMeshes: null,
        };
        const statusState = {
          state: 'connecting',
          url: '',
          address: '',
          port: 0,
          username: '',
          users: [],
        };

        scene.onBeforeRender = () => {
          rendApi.emit('beforeRender');
        };
        scene.onAfterRender = () => {
          rendApi.emit('afterRender');
        };
        scene.onRenderEye = camera => {
          rendApi.emit('updateEye', camera);
        };
        scene.onBeforeRenderEye = () => {
          rendApi.emit('updateEyeStart');
        };
        scene.onAfterRenderEye = () => {
          rendApi.emit('updateEyeEnd');
        };

        cleanups.push(() => {
          scene.onRenderEye = null;
          scene.onBeforeRenderEye = null;
          scene.onAfterRenderEye = null;
        });

        class RendApi extends EventEmitter {
          constructor() {
            super();

            this.setMaxListeners(100);
          }

          getStatus(name) {
            return statusState[name];
          }

          setStatus(name, value) {
            statusState[name] = value;
          }

          getAuxObject(name) {
            return auxObjects[name];
          }

          registerAuxObject(name, object) {
            auxObjects[name] = object;
          }

          update() {
            this.emit('update');
          }

          updateStart() {
            this.emit('updateStart');
          }

          updateEnd() {
            this.emit('updateEnd');
          }

          grab(options) {
            this.emit('grab', options);
          }

          release(options) {
            this.emit('release', options);
          }

          setEntity(item) {
            this.emit('entitychange', item);
          }

          addPlane(plane) {
            uiTracker.addPlane(plane);
          }

          removePage(page) {
            uiTracker.removePage(page);
          }

          loadEntities(itemSpecs) {
            this.emit('loadEntities', itemSpecs);
          }

          saveAllEntities() {
            this.emit('saveAllEntities');
          }

          clearAllEntities() {
            this.emit('clearAllEntities');
          }

          /* getHoverState(side) {
            return uiTracker.getHoverState(side);
          } */
        }
        const rendApi = new RendApi();
        return rendApi;
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Rend;

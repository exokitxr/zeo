class Stck {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/utils/js-utils',
    ]).then(([
      jsUtils,
    ]) => {
      if (live) {
        const {events} = jsUtils;
        const {EventEmitter} = events;

        const bodies = {};

        const worker = new Worker('archae/plugins/_core_engines_stck/build/worker.js');
        worker.requestAddBody = (id, type, spec) => {
          worker.postMessage({
            method: 'addBody',
            args: [id, type, spec],
          });
        };
        worker.requestRemoveBody = (id) => {
          worker.postMessage({
            method: 'removeBody',
            args: [id],
          });
        };
        worker.requestSetState = (id, spec) => {
          worker.postMessage({
            method: 'setState',
            args: [id, spec],
          });
        };
        worker.onmessage = e => {
          const {data} = e;
          const {id, position, rotation, scale, velocity} = data;
          const body = bodies[id];
          body.update(position, rotation, scale, velocity);
        };

        class Body extends EventEmitter {
          constructor(id) {
            super();

            this.id = id;
          }

          setState(position, rotation, scale, velocity) {
            const {id} = this;

            worker.requestSetState(id, {
              position,
              rotation,
              scale,
              velocity,
            });
          }

          update(position, rotation, scale, velocity) {
            this.emit('update', {
              position,
              rotation,
              scale,
              velocity,
            });
          }
        }

        const _makeDynamicBoxBody = (position, size) => {
          const id = _makeId();
          const body = new Body(id);
          bodies[id] = body;

          worker.requestAddBody(id, 'dynamicBox', {
            position: position,
            rotation: [0, 0, 0, 1],
            scale: size,
          });

          return body;
        };
        const _makeStaticHeightfieldBody = (position, width, depth, data) => {
          const id = _makeId();
          const body = new Body(id);
          bodies[id] = body;

          worker.requestAddBody(id, 'staticHeightfield', {
            position,
            width,
            depth,
            data,
          });

          return body;
        };
        const _destroyBody = body => {
          const {id} = body;

          worker.requestRemoveBody(id);

          delete bodies[id];
        };

        return {
          makeDynamicBoxBody: _makeDynamicBoxBody,
          makeStaticHeightfieldBody: _makeStaticHeightfieldBody,
          destroyBody: _destroyBody,
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _makeId = () => Math.random().toString(36).substring(7);
const _arrayEquals = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

module.exports = Stck;

const protocolUtils = require('./lib/utils/protocol-utils');

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
      '/core/engines/three',
      '/core/utils/js-utils',
      '/core/utils/hash-utils',
    ]).then(([
      three,
      jsUtils,
      hashUtils,
    ]) => {
      if (live) {
        const {THREE} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;
        const {murmur} = hashUtils;

        const _makeN = () => murmur(Math.random());

        const bodies = {};

        const worker = new Worker('archae/plugins/_core_engines_stck/build/worker.js');
        worker.requestAddBody = (n, type, spec) => {
          worker.postMessage({
            method: 'addBody',
            args: [n, type, spec],
          });
        };
        worker.requestRemoveBody = n => {
          worker.postMessage({
            method: 'removeBody',
            args: [n],
          });
        };
        worker.requestSetState = (n, spec) => {
          worker.postMessage({
            method: 'setState',
            args: [n, spec],
          });
        };
        worker.onmessage = e => {
          const {data} = e;
          const n = protocolUtils.parseUpdateN(data);
          const body = bodies[n];

          if (body) {
            protocolUtils.parseUpdate(body.position, body.rotation, body.scale, body.velocity, data);
            body.emitUpdate();
          }
        };

        class Body extends EventEmitter {
          constructor(n, position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3(), velocity = new THREE.Vector3()) {
            super();

            this.n = n;
            this.position = position;
            this.rotation = rotation;
            this.scale = scale;
            this.velocity = velocity;
          }

          setState(position, rotation, scale, velocity) {
            this.position.copy(position);
            this.rotation.copy(rotation);
            this.scale.copy(scale);
            this.velocity.copy(velocity);

            const {n} = this;
            worker.requestSetState(n, {
              position: this.position,
              rotation: this.rotation,
              scale: this.scale,
              velocity: this.velocity,
            });
          }

          emitUpdate() {
            this.emit('update');
          }
        }

        const _makeDynamicBoxBody = (position, size, velocity) => {
          const n = _makeN();
          const body = new Body(n);
          bodies[n] = body;

          worker.requestAddBody(n, 'dynamicBox', {
            position: position.toArray(),
            rotation: [0, 0, 0, 1],
            scale: [1, 1, 1],
            size: size.toArray(),
            velocity: velocity.toArray(),
          });

          return body;
        };
        const _makeStaticHeightfieldBody = (position, width, depth, data) => {
          const n = _makeN();
          const body = new Body(n);
          bodies[n] = body;

          worker.requestAddBody(n, 'staticHeightfield', {
            position: position.toArray(),
            width,
            depth,
            data,
          });

          return body;
        };
        const _destroyBody = body => {
          const {n} = body;

          worker.requestRemoveBody(n);

          delete bodies[n];
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

module.exports = Stck;

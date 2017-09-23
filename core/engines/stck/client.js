const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_CELLS = 16;
// const NUM_CELLS_HEIGHT = 128;
// const NUM_CHUNKS_HEIGHT = NUM_CELLS_HEIGHT / NUM_CELLS;

let numBodyTypes = 0;
const STATIC_BODY_TYPES = {
  staticHeightfield: numBodyTypes++,
  staticBlockfield: numBodyTypes++,
};

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
    ]).then(([
      three,
      jsUtils,
    ]) => {
      if (live) {
        const {THREE} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;

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
        /* worker.requestSetState = (n, spec) => {
          worker.postMessage({
            method: 'setState',
            args: [n, spec],
          });
        }; */
        worker.requestSetData = (n, data) => {
          worker.postMessage({
            method: 'setData',
            args: [n, data],
          });
        };
        worker.onmessage = e => {
          const {data} = e;
          const n = protocolUtils.parseN(data);
          const body = bodies[n];

          if (body) {
            const type = protocolUtils.parseType(data);

            if (type === protocolUtils.TYPE_UPDATE) {
              protocolUtils.parseUpdate(body.position, body.rotation, body.scale, body.velocity, data);
              body.emit('update');
            } else if (type === protocolUtils.TYPE_COLLIDE) {
              body.emit('collide');
            }
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

          /* setState(position, rotation, scale, velocity) {
            worker.requestSetState(this.n, {
              position,
              rotation,
              scale,
              velocity,
            });
          } */

          setData(data) {
            worker.requestSetData(this.n, data);
          }
        }

        return {
          makeDynamicBoxBody(position, size, velocity) {
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
          },
          makeStaticHeightfieldBody(position, width, depth, data) {
            const ox = Math.floor(position.x / NUM_CELLS);
            const oz = Math.floor(position.z / NUM_CELLS);
            const n = _getStaticBodyIndex(STATIC_BODY_TYPES.staticHeightfield, ox, oz);
            const body = new Body(n);
            bodies[n] = body;

            worker.requestAddBody(n, 'staticHeightfield', {
              position: position.toArray(),
              width,
              depth,
              data,
            });

            return body;
          },
          makeStaticBlockfieldBody(position, width, height, depth, data) {
            const ox = Math.floor(position.x / NUM_CELLS);
            const oz = Math.floor(position.z / NUM_CELLS);
            const n = _getStaticBodyIndex(STATIC_BODY_TYPES.staticBlockfield, ox, oz);
            const body = new Body(n);
            bodies[n] = body;

            worker.requestAddBody(n, 'staticBlockfield', {
              position: position.toArray(),
              width,
              height,
              depth,
              data,
            });

            return body;
          },
          destroyBody(body) {
            const {n} = body;

            worker.requestRemoveBody(n);

            delete bodies[n];
          },
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

let ns = 0;
const _makeN = () => ns++;
function mod(value, divisor) {
  var n = value % divisor;
  return n < 0 ? (divisor + n) : n;
}
const _getStaticBodyIndex = (t, x, z) => (mod(t, 0xFFFF) << 16) | (mod(x, 0xFF) << 8) | mod(z, 0xFF);

module.exports = Stck;
